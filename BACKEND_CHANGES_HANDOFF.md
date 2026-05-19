# Backend changes handoff (May 2026)

Action items for the backend team from recent frontend work. Full detail lives in `BACKEND_CHANGES_REQUIRED.md` (**§7.8**, **§X**). Reference implementations: `BACKEND_ADMIN_QUOTATION_STATUS.ts` (HR uploads), `lib/quotation-pdf-display.ts` (PDF wording).

---

## 1. HR uploaded leads — correct Assigned / Unassigned counts

### Problem

`GET /api/hr/leads/uploads` (and upload detail) sometimes returns **`assignedCount: rowCount`** and **`unassignedCount: 0`** while every row is still **Unassigned** + **Pending**. That happens when upload-time stats (`POST` response `assigned`) are reused as live batch counts.

### What HR expects (matches table columns)

| Count | Per lead |
|-------|----------|
| **Unassigned** | No valid `assignedDealerId` (null/empty/sentinel) and status `queued` / `pending` |
| **Assigned** | Valid dealer UUID + status `assigned` or `in_progress` (not completed) |
| **Completed** | Status `completed` / `done` / `closed` |

**Invariant:** `assignedCount + unassignedCount + completedCount === rowCount`

### Endpoints

| Method | Path | Change |
|--------|------|--------|
| `GET` | `/api/hr/leads/uploads` | Return live `assignedCount`, `unassignedCount`, `completedCount` per batch (SQL aggregate, not upload-time `assigned`) |
| `GET` | `/api/hr/leads/uploads/{uploadId}` | Same counts for **full batch** (not current page only) + paginated `rows[]` with `assignedDealerId`, `assignedDealerName`, `status` |
| `POST` | `/api/hr/leads/upload-csv` | Keep **`assignedAtUpload`** / **`queuedAtUpload`** — do **not** expose these as `assignedCount` on GET |

### POST upload response (keep distinct keys)

```json
{
  "success": true,
  "parsed": 1000,
  "created": 1000,
  "assignedAtUpload": 3,
  "queuedAtUpload": 997,
  "uploadId": "upload_abc"
}
```

### GET list item example

```json
{
  "id": "upload_abc",
  "fileName": "leads.csv",
  "rowCount": 1000,
  "assignedCount": 3,
  "unassignedCount": 997,
  "completedCount": 0,
  "dealerIds": ["dealer-uuid-1", "dealer-uuid-2"]
}
```

### Per-row rules

- **`dealerIds` on batch** = dealer **pool** at upload — do **not** set `assigned_dealer_id` on every lead from this list.
- **Unassigned row:** `assignedDealerId: null`, `status: "queued"` (frontend shows “Unassigned” / “Pending”).
- **Assigned row:** real dealer UUID + `assignedDealerName` from join + `status: "assigned"` or `"in_progress"`.

### SQL (adjust table/column names)

```sql
SELECT
  upload_id,
  COUNT(*) AS row_count,
  SUM(CASE WHEN LOWER(status) IN ('completed', 'done', 'closed') THEN 1 ELSE 0 END) AS completed_count,
  SUM(CASE
    WHEN LOWER(status) NOT IN ('completed', 'done', 'closed')
     AND assigned_dealer_id IS NOT NULL
     AND TRIM(assigned_dealer_id) <> ''
     AND LOWER(TRIM(assigned_dealer_id)) NOT IN ('unassigned', 'null', 'none', '-', 'na', 'n/a', 'pool', 'open')
    THEN 1 ELSE 0 END) AS assigned_count,
  SUM(CASE
    WHEN LOWER(status) NOT IN ('completed', 'done', 'closed')
     AND (
       assigned_dealer_id IS NULL
       OR TRIM(assigned_dealer_id) = ''
       OR LOWER(TRIM(assigned_dealer_id)) IN ('unassigned', 'null', 'none', '-', 'na', 'n/a', 'pool', 'open')
     )
    THEN 1 ELSE 0 END) AS unassigned_count
FROM hr_leads
GROUP BY upload_id;
```

### Reference code

- `computeHrUploadLeadCounts()` in `BACKEND_ADMIN_QUOTATION_STATUS.ts`
- `getHrLeadsUploads` / `getHrLeadsUploadById` in same file

### QA

1. Upload 1000 leads, 3 allocated at upload → POST `assignedAtUpload: 3`.
2. GET list → `assignedCount: 3`, `unassignedCount: 997`, `completedCount: 0` (not 1000 assigned).
3. Modal rows: `assignedDealerId: null`, `status: queued` → header counts still match batch object.

---

## 2. Quotation PDF display flags (products JSON)

### Purpose

Optional booleans on `products` change **PDF / preview text only** — not pricing, catalog validation, or stored `panelSize` / `inverterBrand` used for calculations.

| Field | When `true`, PDF shows |
|-------|-------------------------|
| `pdfUsePanelSizeRange` | **540W-620W** instead of exact size (e.g. `555W`) |
| `pdfUseInverterBrandOptions` | **Inverter Brand- Vsole/Xwatt/Saatvik** instead of selected brand only |

Snake_case aliases (optional): `pdf_use_panel_size_range`, `pdf_use_inverter_brand_options`.

### Endpoints

| Method | Path | Change |
|--------|------|--------|
| `POST` | `/api/quotations` | Accept flags inside `products`; persist in JSON/JSONB |
| `PATCH` | `/api/quotations/{id}/products` | Merge flags; return on response |
| `GET` | `/api/quotations`, `/api/quotations/{id}` | Echo flags unchanged |

### Example `products` fragment

```json
{
  "systemType": "dcr",
  "panelBrand": "Adani",
  "panelSize": "555W",
  "panelQuantity": 9,
  "inverterBrand": "Saatvik",
  "inverterSize": "5kW",
  "pdfUsePanelSizeRange": true,
  "pdfUseInverterBrandOptions": true
}
```

### Do not

- Use these flags in `validateProductSelection`, `calculatePricing`, or `systemSize` derivation.
- Strip flags when saving `products` (frontend only sends `true` when checked).

### Server-generated PDFs

If the API builds PDFs server-side, mirror `lib/quotation-pdf-display.ts`:

- `formatPanelSizeForPdf(size, usePanelSizeRange)` → `540W-620W` or exact size
- `getPdfInverterLine(products)` → multi-brand line when flag set

### Checklist

- [ ] Persist optional booleans on create + PATCH products
- [ ] Echo on GET quotation(s)
- [ ] Ignore in pricing/validation
- [ ] (If applicable) Server PDF uses same display rules

---

## 3. Dealer calling queue — fix `LEAD_004` (“Lead not assigned to dealer”)

**Symptom:** Dealer sees a lead under **Current Lead**, taps **Start Call**, gets **403 / `LEAD_004`**.

**Cause:** `GET /calling-queue/next` returns a lead the dealer may **view** (pool / batch), but `PATCH .../action` rejects because `assigned_dealer_id` is null or belongs to another dealer.

**Frontend mitigations (already shipped):** dialer opens immediately; retries assign via `POST .../claim`, `POST .../assign`, `PATCH .../calling-queue/{id}`; on persistent `LEAD_004` the UI updates locally to `in_progress` **without** showing the error. **Backend must still implement Option A or C** so `called` / follow-up actions persist and data stays in sync across devices.

### Required backend behavior (pick one or combine)

#### Option A — Auto-assign on `start` (recommended)

`PATCH /api/dealers/me/calling-queue/{leadId}/action`

When `action === "start"` and the authenticated dealer is allowed to work the lead:

1. If `assigned_dealer_id` is empty and the lead is in the dealer’s eligible pool (upload `dealerIds`, `eligibleDealerIds`, or allocator rules), set `assigned_dealer_id = dealer.id` and `status = in_progress` (or `assigned` then `in_progress`).
2. If already assigned to **this** dealer, proceed with transition to `in_progress`.
3. If assigned to **another** dealer, return **`LEAD_004`** (do not return this lead from `/next` for other dealers).

Optional body flags the frontend may send (treat as hints):

```json
{
  "action": "start",
  "claim": true,
  "autoAssign": true,
  "assignedDealerId": "<dealer-uuid-from-jwt>"
}
```

#### Option B — Claim / assign endpoints

Implement **at least one** (frontend already calls these if present):

| Method | Path |
|--------|------|
| `POST` | `/api/dealers/me/calling-queue/{leadId}/claim` |
| `POST` | `/api/dealers/me/calling-queue/{leadId}/assign` body `{ assignedDealerId, status: "assigned" }` |
| `PATCH` | `/api/dealers/me/calling-queue/{leadId}` body `{ assignedDealerId, status }` |

- Auth: dealer JWT.
- Sets `assigned_dealer_id` to current dealer if lead is pool/unassigned and dealer is eligible.
- Returns updated lead + **409** if already claimed by someone else.

#### Option C — Assign before returning from `/next`

`GET /api/dealers/me/calling-queue/next` (and `/current`)

- When allocating the next lead to a dealer, **persist** `assigned_dealer_id` on that row **before** returning it (work-queue model).
- Response lead must include `assignedDealerId` = dealer’s UUID (same as JWT `dealers.id`).

### Assignee fields on every lead object

| Field | Rule |
|-------|------|
| `assignedDealerId` / `assigned_dealer_id` | UUID of dealer who must call — **must match JWT id** when lead is “theirs” |
| `assignedDealerName` | Join from `dealers` table |
| `dealerId` / `dealerName` | Uploader / CRM only — **not** calling assignee |

Sentinels treated as unassigned: `unassigned`, `null`, `none`, `pool`, `open`, etc.

### `GET /next` must not contradict `PATCH`

- Do **not** return a lead in `lead` / `nextLead` / `currentLead` if this dealer cannot `PATCH` it.
- `/next` and `/current` should use the **same** visibility and allocation rules.

### On action completion

After `called` / `follow_up` / `not_interested` / `rescheduled`:

- Set lead status appropriately (`completed`, `rescheduled`, etc.).
- Allocate next queued lead to the same dealer when under active cap (see `BACKEND_CHANGES_REQUIRED.md` §7.7, §G).

### QA

1. HR uploads batch with dealer pool; dealer A opens Calling Data → sees one current lead.
2. **Start Call** → **200**, lead moves to `in_progress` (no `LEAD_004`).
3. Dealer B does not see A’s in-progress lead in `/next`.
4. Pool lead with no assignee: first `start` assigns to current dealer; second dealer gets `LEAD_004` or a different lead.

### Reference

- `BACKEND_CHANGES_REQUIRED.md` — Dealer calling queue section (~line 2307), §7.7 work queue, error `LEAD_004`
- `lib/calling-lead-assignee.ts`, `lib/api.ts` → `claimCallingLead`, `updateCallingLeadAction`

---

## 4. Frontend (implemented)

| File | Role |
|------|------|
| `lib/hr-upload-lead-display.ts` | Count buckets + table labels (`Unassigned`/`Pending` vs dealer name/`Completed`) |
| `app/dashboard/hr/page.tsx` | Uploaded Data tab, batch modal, colored summary badges |
| `lib/quotation-pdf-display.ts` | PDF panel range + inverter brand options |
| `lib/calling-lead-assignee.ts` | Calling assignee match + `LEAD_004` detection |
| `app/dashboard/calling-data/page.tsx` | `handleStartCall` — dial + assign retries + optimistic `in_progress` if `LEAD_004` |

**HR table rules (frontend):**

- **Completed** — dealer name shown + status completed/done/closed → counts toward **Completed**
- **Unassigned** + **Pending** — all other rows (including dealer allocated but call not finished) → counts toward **Unassigned**
- HR summary shows **Unassigned** and **Completed** only (no separate Assigned badge)

**Fallback:** If API returns upload-time `assignedCount === rowCount` with no completed rows, counts are corrected client-side until GET aggregates are fixed.

---

## Related docs

| Doc | Section |
|-----|---------|
| `BACKEND_CHANGES_REQUIRED.md` | §7.7–7.8 (calling queue, HR uploads), dealer queue (~2307), §X (PDF flags) |
| `BACKEND_ADMIN_QUOTATION_STATUS.ts` | HR upload handlers + `computeHrUploadLeadCounts` |
| `lib/quotation-pdf-display.ts` | PDF display helpers (frontend + spec for server) |
| `lib/calling-lead-assignee.ts` | Assignee normalization spec for backend field names |
