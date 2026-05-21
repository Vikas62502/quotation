# Backend changes handoff (May 2026)

Action items for the backend team from recent frontend work. Full detail lives in `BACKEND_CHANGES_REQUIRED.md` (**§7.8**, dealer calling queue **§E / §H / §J**, **§X**). Reference implementations: `BACKEND_ADMIN_QUOTATION_STATUS.ts` (HR uploads, `patchDealerCallingQueueAction`), `lib/quotation-pdf-display.ts` (PDF wording), `lib/calling-remark-payload.ts` (remark PATCH body), `lib/api.ts` (HR/admin calling-actions query params).

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

## 4. Calling remarks, queue tabs & start vs submit

**Frontend:** `app/dashboard/calling-data/page.tsx`, `lib/calling-remark-payload.ts`, `lib/calling-lead-session.ts`, `app/dashboard/new-quotation/page.tsx`, `components/customer-details-form.tsx` (`remarks` on customer).

Browser **sessionStorage** holds drafts until Submit; **backend must persist** on action and return data in the correct queue buckets.

### 4.1 Persist call remarks on dealer action

`PATCH /api/dealers/me/calling-queue/{leadId}/action`

**Accept any of these in the body** (frontend sends camelCase + snake_case when remarks are submitted):

| Field | Example |
|-------|---------|
| `callRemark` / `call_remark` | `[call_connectivity] Call Unanswered \| Customer asked callback evening` |
| `statusCategory` / `status_category` | `call_connectivity` |
| `statusText` / `status_text` | `Call Unanswered` |
| `remark` | `Customer asked callback evening` (free text only) |

**Tagged format** (parse with `parseTaggedCallRemark()` in `BACKEND_ADMIN_QUOTATION_STATUS.ts`):

```text
[statusCategory] statusText | optional free remark
```

**Allowed `statusCategory` values:** `call_connectivity`, `lead_validity`, `customer_intent`, `financial`, `competition`, `schedule`, `other`.

**Persist on the lead row (recommended columns):**

- `status_category`, `status_text`, `remark` (structured)
- `call_remark` (legacy combined string, same as frontend)
- `action`, `action_at`, `next_follow_up_at` when applicable

**On `action: "start"`:** remark fields are usually omitted — only set `status` → `in_progress` and assignee. **Do not require** `callRemark` for start.

**On `action` in `called` \| `follow_up` \| `not_interested` \| `rescheduled`:** **require** valid remark payload (or at least `statusCategory` + `statusText`) so history tabs have data.

**Return on GET** (lead + history items): `callRemark`, `call_remark`, and optionally denormalized `statusCategory`, `statusText`, `remark`.

### 4.2 Customer note on calling lead (optional PATCH)

Frontend shows **Customer Note** on Current Lead (separate from call remarks).

| Method | Path | Body |
|--------|------|------|
| `PATCH` | `/api/dealers/me/calling-queue/{leadId}` | `{ "customerNote": "..." }` or `customer_note` |

Echo on lead object: `customerNote` / `customer_note` in `GET /next`, `GET /current`, and queue lists.

If not implemented, frontend keeps note in **sessionStorage only** until quotation prefill — **persist is strongly preferred**.

### 4.3 Quotation prefill — customer `notes` / `remarks`

`POST /api/customers` (and `PUT` if used)

Accept optional:

```json
{
  "firstName": "Sunita",
  "lastName": "Customer",
  "mobile": "9660016677",
  "address": { "street": "...", "city": "...", "state": "...", "pincode": "..." },
  "notes": "Customer note from calling\n\nCall remark free text",
  "remarks": "same as notes"
}
```

Frontend sends **`remarks`** and **`notes`** with the same value when prefilled from Calling Data.

### 4.4 Separate queue arrays per tab (critical)

`GET /api/dealers/me/calling-queue/next` and `GET /api/dealers/me/calling-queue/current` should return **distinct lists** so Scheduled / Dialled / Connected / Not Connected tabs do not show the same rows.

| Response key | Tab | Rule |
|--------------|-----|------|
| `scheduledLeads` / `upcomingFollowUps` / `rescheduledLeads` | **Scheduled** | Future `nextFollowUpAt` > now, status `rescheduled` (or scheduled) |
| `dialledActions` | **Dialled** | Completed dial attempts: actions in `called`, `follow_up`, `not_interested`, `rescheduled` **without** upcoming future follow-up |
| `connectedActions` | **Connected** | Subset of dialled where `status_text` is **not** a not-connected reason (see frontend `NOT_CONNECTED_REASONS`) |
| `notConnectedActions` | **Not Connected** | Subset where `status_text` is call-unanswered / switched off / not reachable / etc. |
| `recentActions` / `actionHistory` | History / analytics | Union or superset for counts |

**Do not** put future scheduled follow-ups only in `dialledActions` — they belong under **`scheduledLeads`**.

Each action item should include: `id`, `leadId`, `name`, `mobile`, `action`, `actionAt`, `callRemark`, `nextFollowUpAt`, `kNumber`, `address`, `customerNote` (if stored).

### 4.5 `start` must not skip to the next lead

**Problem:** If `PATCH .../action` with `action: "start"` returns `nextLead` / replaces the current queue head, dealers skip leads when tapping Start multiple times.

**Required:**

| Action | Behavior |
|--------|----------|
| `start` | Set assignee + `in_progress`; **return the same lead** (updated). **Do not** return `nextLead` or advance queue. |
| `called` / `follow_up` / `not_interested` / `rescheduled` | Complete workflow; **then** return `nextLead` / updated counts / next queue head. |

Example **`start` response** (no next lead):

```json
{
  "success": true,
  "lead": { "id": "...", "status": "in_progress", "assignedDealerId": "dealer-uuid", "..." }
}
```

Example **after Submit** (`called`):

```json
{
  "success": true,
  "lead": { "...completed or rescheduled..." },
  "nextLead": { "id": "next-uuid", "..." },
  "pendingCount": 42
}
```

### 4.6 Reference

- `BACKEND_ADMIN_QUOTATION_STATUS.ts` → `patchDealerCallingQueueAction`, `parseTaggedCallRemark`, `callingActionToApiJson`
- `lib/calling-remark-payload.ts` → `enrichCallingActionPayload()` (frontend body shape)

### 4.7 QA

1. Submit Current Lead with remarks → `GET` history shows `callRemark`; HR/admin calling actions list shows same text.
2. **Scheduled** tab: only future follow-ups; **Dialled** tab: past actions without duplicating scheduled rows.
3. Double **Start** on same lead → still same lead until Submit.
4. **Create Quotation** from calling → customer `notes` saved on `POST /customers`.
5. Reload app → remarks visible from API (not only browser storage).
6. HR **Dealer Calling Actions**: `GET` with `dealerId` + `startDate`/`endDate` returns filtered rows; **Custom** range sends both dates (see §4.8).

### 4.8 HR / Admin — GET calling-actions (date & dealer filters)

**Frontend:** `lib/api.ts` (`api.hr.callingActions.getAll`, `api.admin.callingActions.getAll`), `lib/calling-report-date-range.ts`, `app/dashboard/hr/page.tsx`, `app/dashboard/admin/page.tsx`.

HR refetches this list when **preset/custom range** or **dealer** changes and sends:

| Query param | Purpose |
|-------------|---------|
| `limit` | e.g. `2000` |
| `dealerId` | Optional — restrict to one salesperson (dealer UUID) |
| `range` | `daily` \| `weekly` \| `monthly` \| `last_month` \| `all` \| **`custom`** |
| `startDate`, `endDate` | ISO 8601 — inclusive window on **`action_at`** (recommended) |

For **every** preset including **custom**, the SPA sends **`startDate` and `endDate`** built from `buildCallingActionsQueryDates()` so the backend can filter by timestamp alone. If you only implement date filtering, that is sufficient; **`range`** can be logged or used as a hint.

**Paths to implement** (at least one per surface — see `lib/api.ts` fallback order):

- HR: `GET /api/hr/calling-actions`, `GET /api/hr/calling-queue/actions`
- Admin: `GET /api/admin/calling-actions`, `GET /api/admin/calling-queue/actions`, `GET /api/admin/leads/actions`

**Response:** array under `actions` / `callingActions` / `items` / `logs` / `data`; each item needs at minimum `id`, `leadId`, `dealerId`, `dealerName`, `action`, `actionAt`, `callRemark` (and customer fields if stored).

**Weekly alignment:** same as `lib/calling-report-date-range.ts` — week = **Monday 00:00** through **Sunday end of day** in the timezone you document for reporting.

### Checklist

- [ ] PATCH action accepts `callRemark` + `call_remark` + structured `statusCategory` / `statusText` / `remark`
- [ ] Persist `call_remark` and structured columns; echo on GET
- [ ] Optional PATCH lead `customerNote`
- [ ] `POST /customers` accepts `notes` / `remarks`
- [ ] Queue GET returns `scheduledLeads`, `dialledActions`, `connectedActions`, `notConnectedActions` separately
- [ ] `start` does not return `nextLead`; completion actions do
- [ ] HR/Admin **GET calling-actions** honours `dealerId` + `startDate` / `endDate` (and optional `range=custom`)

---

## 5. Frontend (implemented)

| File | Role |
|------|------|
| `lib/hr-upload-lead-display.ts` | Count buckets + table labels (`Unassigned`/`Pending` vs dealer name/`Completed`) |
| `app/dashboard/hr/page.tsx` | Uploaded Data tab, batch modal, **calling actions** date + dealer filters |
| `app/dashboard/admin/page.tsx` | **Calling Reports** tab — same date presets + custom + employee filter |
| `lib/calling-report-date-range.ts` | Preset/custom bounds + ISO params for HR calling-actions `GET` |
| `lib/quotation-pdf-display.ts` | PDF panel range + inverter brand options |
| `lib/calling-lead-assignee.ts` | Calling assignee match + `LEAD_004` detection |
| `lib/calling-remark-payload.ts` | Remark payload enrichment for PATCH action |
| `lib/calling-lead-session.ts` | Browser draft per lead (until API echoes back) |
| `lib/phone-dialer.ts` | Copy number on Start (no `tel:` redirect on desktop) |
| `app/dashboard/calling-data/page.tsx` | Queue tabs, pin lead until Submit, remarks + quotation prefill |
| `app/dashboard/new-quotation/page.tsx` | Prefill `prefillRemarks`, Back to Calling Data |
| `components/customer-details-form.tsx` | Optional `remarks` on customer step |

**HR table rules (frontend):**

- **Completed** — dealer name shown + status completed/done/closed → counts toward **Completed**
- **Unassigned** + **Pending** — all other rows (including dealer allocated but call not finished) → counts toward **Unassigned**
- HR summary shows **Unassigned** and **Completed** only (no separate Assigned badge)

**Fallback:** If API returns upload-time `assignedCount === rowCount` with no completed rows, counts are corrected client-side until GET aggregates are fixed.

---

## Related docs

| Doc | Section |
|-----|---------|
| `BACKEND_CHANGES_REQUIRED.md` | §7.7–7.8 (calling queue, HR uploads), dealer queue (~2307), **§J** (calling-actions GET), §X (PDF flags) |
| `BACKEND_ADMIN_QUOTATION_STATUS.ts` | HR upload handlers + `computeHrUploadLeadCounts` + `patchDealerCallingQueueAction` |
| `lib/quotation-pdf-display.ts` | PDF display helpers (frontend + spec for server) |
| `lib/calling-lead-assignee.ts` | Assignee normalization spec for backend field names |
| `lib/calling-remark-payload.ts` | PATCH action body for remarks |
| `lib/calling-report-date-range.ts` | HR **GET** `startDate` / `endDate` + `range` semantics |
| `lib/calling-lead-session.ts` | Client-side draft keys (not a backend contract) |
