# Backend changes handoff (May 2026)

Action items for the backend team from recent frontend work. Full detail lives in `BACKEND_CHANGES_REQUIRED.md` (**§7.8**, **§7.9**, dealer calling queue **§E / §E.1 / §E.2 / §H / §J**, **§J.1**, **§X**, **§Z**). **Calling queue:** current lead until Submit — **§4.5.1** / **§E.1**; **reschedule 500** — **§4.5.2** / **§E.2**. Reference implementations: `BACKEND_ADMIN_QUOTATION_STATUS.ts` (HR uploads, `patchDealerCallingQueueAction`), `lib/quotation-pdf-display.ts` (PDF wording), `lib/calling-remark-payload.ts` (remark PATCH body), `lib/api.ts` (HR/admin calling-actions query params), `lib/visit-report.ts` (admin visit list mapping).

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

## 2. Quotation `products` JSON — PDF display, brands, validation (May 2026)

**Frontend:** `lib/quotation-api-payload.ts`, `lib/quotation-pdf-display.ts`, `lib/quotation-proposal-document.ts`, `components/product-selection-form.tsx`.

Proposal PDF is **client-generated**; backend stores/returns `products` and optional `dealer` on GET.

### 2.1 PDF panel range keys

| Field | Scope |
|-------|--------|
| `pdfPanelRangeKey` | `dcr` / `non-dcr` |
| `pdfDcrPanelRangeKey` | `both` — DCR |
| `pdfNonDcrPanelRangeKey` | `both` — Non-DCR |

**Values:** `waaree_540_560_bifacial`, `waaree_580_700_bifacial_topcon`, `adani_540_580_bifacial`, `adani_610_625_bifacial_topcon`, `premier_600_625_bifacial_topcon`, **`tata_530_570`** (Tata DCR Jun 2026 package).

**Snake_case:** `pdf_panel_range_key`, `pdf_dcr_panel_range_key`, `pdf_non_dcr_panel_range_key`.

**Legacy:** `pdfUsePanelSizeRange` (old rows only). **`pdfUseInverterBrandOptions` no longer sent.**

**Save flow:** `POST` strips PDF keys → **`PATCH /api/quotations/{id}/products`** saves them.

**Uncheck / clear:** Frontend sends `pdfPanelRangeKey: ""` (and snake_case `null`) when a box is unchecked. Backend must **remove or null out** stored keys on PATCH — do not ignore empty strings or leave stale keys (otherwise PDF keeps old “As per the set” behaviour).

When a range key is set, PDF shows panel spec as **“As per the set”** and inverter brand as **“As per the set”** when any range is active; allow **qty 0 / omitted** on backend validation.

**Panel size on GET:** Prefer `panelSize` over legacy `dcrPanelSize` when both exist for DCR quotations (frontend syncs on save; avoid returning conflicting duplicates).

### 2.2 Combined brand strings (if whitelisted)

| Field | Extra values |
|-------|----------------|
| `inverterBrand` | `Vsole/Xwatt/Saatvik`, `Vsole/Xwatt`, catalog brands (GoodWe, Polycab, …), **`As per the set`** (Tata DCR only) |
| `meterBrand` | `L&T/HPL/Genus/Secure` |

### 2.3 DCR inverter brand — Tata vs all other packages (Jun 2026)

**Frontend:** `lib/quotation-api-payload.ts` (`toCatalogCompatibleProducts`, `restoreDcrPackageDisplayForForm`), `components/product-selection-form.tsx`.

| Package | UI | `inverterBrand` on POST/PATCH | `inverterSize` |
|---------|-----|------------------------------|----------------|
| **Tata DCR** (`panelBrand` = `Tata`) | Read-only **As per the set** | **`As per the set`** | **`As per the set`** |
| **Other DCR** (Adani, Waaree, Premier, …) | Dropdown; **default** `Vsole/Xwatt`; dealer may pick another catalog brand | User’s choice (default `Vsole/Xwatt` if empty) | Concrete kW e.g. `5kW`, `10kW` |

**Tata DCR also sends:**

- `panelSize`: `As per the set`
- `panelQuantity`: `0`
- `pdfPanelRangeKey`: `tata_530_570`

**Backend must:**

1. **Accept and persist** literal `As per the set` on `inverterBrand`, `inverterSize`, and `panelSize` for Tata rows — do **not** rewrite to `530W` / `Vsole/Xwatt` on save.
2. **Return the same strings on GET** so edit/reload shows Tata package-set correctly (`restoreDcrPackageDisplayForForm` uses `panelBrand === "tata"` + `pdfPanelRangeKey`).
3. **Allow `panelQuantity` / `dcrPanelQuantity` = 0** when `panelBrand === "Tata"` OR `pdfPanelRangeKey === "tata_530_570"` OR `inverterBrand` / `panelSize` is `As per the set` (same relaxation as other PDF range keys).
4. **Do not require** `inverterSize` to match `^\d+kW$` when value is `As per the set`.
5. **Do not require** `panelSize` to match `^\d+W$` when value is `As per the set`.
6. For **non-Tata DCR**, accept any **catalog inverter brand** the dealer selects; only default to `Vsole/Xwatt` when the field is omitted (frontend default, not a server overwrite on PATCH).

**Example — Tata DCR (`POST` body + `PATCH` products):**

```json
{
  "systemType": "dcr",
  "phase": "1-Phase",
  "panelBrand": "Tata",
  "panelSize": "As per the set",
  "panelQuantity": 0,
  "dcrPanelBrand": "Tata",
  "dcrPanelSize": "As per the set",
  "dcrPanelQuantity": 0,
  "inverterType": "String Inverter",
  "inverterBrand": "As per the set",
  "inverterSize": "As per the set",
  "structureSize": "3.1kW",
  "pdfPanelRangeKey": "tata_530_570",
  "centralSubsidy": 78000
}
```

**Example — Adani DCR (dealer changed inverter to GoodWe):**

```json
{
  "systemType": "dcr",
  "panelBrand": "Adani",
  "panelSize": "555W",
  "panelQuantity": 10,
  "inverterBrand": "GoodWe",
  "inverterSize": "10kW",
  "pdfPanelRangeKey": "adani_610_625_bifacial_topcon"
}
```

**Validation pseudocode:**

```ts
const AS_PER_SET = /^(as per the set|as per set)$/i

function isTataDcrPackage(p: Products): boolean {
  return p.systemType === "dcr" && String(p.panelBrand || p.dcrPanelBrand || "").trim().toLowerCase() === "tata"
}

function isPackageSetField(v?: string): boolean {
  return AS_PER_SET.test(String(v || "").trim())
}

// Tata OR pdf range OR as-per-set labels → allow panel qty 0
function panelQtyOk(p: Products): boolean {
  if (p.pdfPanelRangeKey || isTataDcrPackage(p) || isPackageSetField(p.panelSize)) return true
  return (p.panelQuantity ?? 0) > 0
}

// inverterBrand: allow catalog brands + Vsole/Xwatt + As per the set (Tata)
// Do NOT strip or normalize user-selected GoodWe/Polycab on non-Tata DCR
```

### 2.4 GET quotation — `dealer`

Return `dealer: { id, firstName, lastName, email, mobile, username, role }` for proposal “Dealer Details”.

### 2.5 `validUntil` (optional)

Use **createdAt + 7 days** (frontend uses 7-day validity; reference controller may still use 5).

### Example `products` (non-Tata DCR + PDF range)

```json
{
  "systemType": "dcr",
  "panelBrand": "Adani",
  "panelSize": "610W",
  "panelQuantity": 0,
  "inverterBrand": "Vsole/Xwatt",
  "inverterSize": "10kW",
  "meterBrand": "L&T/HPL/Genus/Secure",
  "pdfPanelRangeKey": "adani_610_625_bifacial_topcon"
}
```

### Endpoints

| Method | Path |
|--------|------|
| `POST` | `/api/quotations` |
| `PATCH` | `/api/quotations/{id}/products` |
| `GET` | `/api/quotations`, `/api/quotations/{id}` |

### Do not

Use PDF keys in pricing/catalog validation. Do not strip PDF keys on PATCH.

### Checklist

- [ ] Persist `pdf*PanelRangeKey` on `products`
- [ ] PATCH clears keys when frontend sends `""` / `null`
- [ ] PATCH products after create works
- [ ] Relax panel qty when range keys set
- [ ] Allow combined inverter/meter brands (`Vsole/Xwatt`, etc.)
- [ ] Add PDF key **`tata_530_570`**
- [ ] Accept **`As per the set`** on `inverterBrand`, `inverterSize`, `panelSize` (Tata DCR)
- [ ] Persist Tata rows **without** rewriting to `530W` / `Vsole/Xwatt`
- [ ] Non-Tata DCR: persist dealer-selected catalog `inverterBrand` (default `Vsole/Xwatt` only when omitted)
- [ ] Relax panel qty for Tata / as-per-set / `tata_530_570`
- [ ] Return `dealer` on GET quotation
- [ ] (Optional) `validUntil` +7 days

**Full spec:** `BACKEND_CHANGES_REQUIRED.md` §X.

### 2.6 Pricing tables API (optional but recommended)

`GET /api/quotations/pricing-tables` — see `BACKEND_PRICING_TABLES_API.md`. Frontend **falls back** to `lib/pricing-tables.ts` if missing; implement to sync DCR set prices and presets from DB (June 2026 matrix: Adani 555W / Topcon 620W, Waaree 540W, Premier Energies, inverter preset **Vsole/Xwatt**). Response shape: `{ success, data: { dcr, nonDcr, both, panels, inverters, …, systemConfigurations } }`.

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
| `nextFollowUpAt` / `next_follow_up_at` | ISO-8601 — **required** for reschedule / decision-pending hold (§4.5.2) |
| `actionAt` / `action_at` | ISO-8601 — when the action occurred |

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

### 4.5.1 Current lead must stay until Submit (Jun 2026 — dealer bug fix)

**Symptom:** Dealer opens **Calling Data → Current Lead**, taps **Start Call**, fills connection/status/remarks, then the lead **vanishes** or **another lead appears** before **Submit Current Lead**.

**Frontend:** `app/dashboard/calling-data/page.tsx` pins the active lead client-side and ignores API `nextLead` during `in_progress`. **Backend must still enforce** correct queue semantics so refresh, other devices, and realtime events stay consistent.

#### State machine (per dealer)

```
queued/assigned ──(PATCH start)──► in_progress ──(PATCH called|follow_up|not_interested|rescheduled)──► completed/rescheduled
                                         │                                                              │
                                         └── dealer keeps THIS lead until completion PATCH ────────────┘
```

#### Required backend rules

| # | Rule |
|---|------|
| 1 | **`PATCH …/action` with `action: "start"`** — set `assigned_dealer_id` = JWT dealer, `status` = `in_progress`. Return **`lead`** = same `id` (updated). **Do not** include `nextLead`. **Do not** pre-allocate the next pool row to this dealer. |
| 2 | **`GET …/calling-queue/current`** — if this dealer has an `in_progress` lead, **`currentLead` (or `lead`) MUST be that row** with full fields (`name`, `mobile`, `address`, `customerNote`, `callRemark`, etc.). |
| 3 | **`GET …/calling-queue/next`** while `in_progress` exists — return the **same** `in_progress` lead as head, **or** return counts/history only **without** a different `nextLead`. Never return a **new** queued lead as queue head until the open call is submitted. |
| 4 | **Completion PATCH** (`called`, `follow_up`, `not_interested`, `rescheduled`) — persist `callRemark` / structured status fields, close or reschedule the lead, **then** advance queue and return **`nextLead`**. |
| 5 | **One open call per dealer (recommended)** — at most one `in_progress` row per `assigned_dealer_id`; reject second `start` on another lead until first is completed (frontend also blocks). |
| 6 | **`LEAD_004` on start** — claim unassigned pool lead to JWT dealer on first `start` (see §3). |
| 7 | **Queue refresh** — any GET that omits the dealer’s `in_progress` lead causes UI flicker; always include it in `currentLead` / `leads` / `currentQueue` until completion. |

#### Wrong vs correct `start` response

**Wrong** (causes skip / empty current lead):

```json
{
  "success": true,
  "lead": { "id": "lead-A", "status": "in_progress" },
  "nextLead": { "id": "lead-B", "status": "queued" }
}
```

**Correct:**

```json
{
  "success": true,
  "data": {
    "lead": {
      "id": "lead-A",
      "status": "in_progress",
      "assignedDealerId": "dealer-uuid",
      "name": "Customer",
      "mobile": "9876543210",
      "customerNote": "…"
    }
  }
}
```

#### Wrong vs correct GET `/current` while call open

**Wrong:** `currentLead` = next queued lead B while lead A is still `in_progress` for this dealer.

**Correct:** `currentLead` = lead A (`in_progress`); lead B appears only after completion PATCH on A.

#### Suggested SQL guard (adjust table names)

```sql
-- On PATCH start: do not pick next lead in same transaction
UPDATE hr_calling_leads
SET assigned_dealer_id = $dealer_id, status = 'in_progress', updated_at = NOW()
WHERE id = $lead_id
  AND (assigned_dealer_id IS NULL OR assigned_dealer_id = $dealer_id);

-- On GET current for dealer:
SELECT * FROM hr_calling_leads
WHERE assigned_dealer_id = $dealer_id AND status = 'in_progress'
ORDER BY updated_at DESC
LIMIT 1;
-- If row exists, use as currentLead; else allocate next from pool.
```

#### Backend checklist (add to §4 checklist)

- [ ] `start` never returns `nextLead`
- [ ] `GET /current` returns dealer’s `in_progress` lead when present
- [ ] `GET /next` does not advance past open `in_progress` call
- [ ] Completion actions return `nextLead` only after closing current lead
- [ ] `callRemark` + structured status persisted on completion PATCH
- [ ] `customerNote` echoed on GET while call is open

#### QA

1. Dealer **Start** on lead A → Current Lead still shows A after refresh / tab switch.
2. Fill status + remark → submit → **then** lead B appears.
3. Double **Start** on A → still A (no skip to B).
4. Dealer B cannot see A while A is `in_progress` for dealer A.
5. HR upload pool lead: first **Start** assigns to dealer; no `LEAD_004`.

### 4.5.2 Reschedule / Decision Pending — fix 500 on Submit (Jun 2026)

**Symptom:** Dealer on **Calling Data → Current Lead** selects **Connected → Decision Pending → Callback Scheduled** (or other hold reason), sets **Reschedule date and time**, clicks **Submit** → toast **“Action failed — Internal server error”** (HTTP 500).

**Frontend:** `app/dashboard/calling-data/page.tsx`, `lib/calling-remark-payload.ts` (`enrichCallingActionPayload`, `cleanFreeCallRemark`). On 500 / invalid transition, frontend retries `start` then falls back to **`action: "follow_up"`** with the same `nextFollowUpAt`. **Backend must accept both actions** and must not 500.

#### UI → API mapping (Decision Pending + reschedule)

| UI field | Backend field |
|----------|----------------|
| Hold Reason (e.g. Callback Scheduled) | `statusText` / `status_text` = `Callback Scheduled` |
| (derived) | `statusCategory` / `status_category` = **`schedule`** |
| Remarks textarea | `remark` (free text only) + combined `callRemark` |
| Reschedule datetime | **`nextFollowUpAt`** / **`next_follow_up_at`** (ISO-8601 UTC) |
| Submit | **`action`** = **`rescheduled`** (preferred) or **`follow_up`** (accepted alias) |

#### Example PATCH body (frontend sends camelCase + snake_case)

```json
{
  "action": "rescheduled",
  "callRemark": "[schedule] Callback Scheduled | Adani panel 620w",
  "call_remark": "[schedule] Callback Scheduled | Adani panel 620w",
  "statusCategory": "schedule",
  "status_category": "schedule",
  "statusText": "Callback Scheduled",
  "status_text": "Callback Scheduled",
  "remark": "Adani panel 620w",
  "nextFollowUpAt": "2026-06-11T05:07:00.000Z",
  "next_follow_up_at": "2026-06-11T05:07:00.000Z",
  "actionAt": "2026-06-05T10:37:00.000Z",
  "action_at": "2026-06-05T10:37:00.000Z"
}
```

#### Required server behavior

| # | Rule |
|---|------|
| 1 | **`PATCH …/action`** with `action` in **`rescheduled`** \| **`follow_up`** and **`nextFollowUpAt` / `next_follow_up_at` present** — persist follow-up time; set lead **`status` = `rescheduled`** (not `completed`). |
| 2 | **Do not return HTTP 500** for valid payloads — return **`400` `VAL_001`** if `nextFollowUpAt` missing/invalid, or **`LEAD_005`** for bad transition (never uncaught exception). |
| 3 | **Accept `follow_up` as alias** when `nextFollowUpAt` is set and `status_category` = `schedule` — same DB update as `rescheduled`. |
| 4 | **Transition:** `in_progress` → `rescheduled` (and `assigned` → `rescheduled` after implicit/auto `start` if your API requires it). |
| 5 | **Replace** `call_remark` on submit — store **one** canonical tagged string; **do not append** nested `[schedule] Callback Scheduled` chains (causes VARCHAR overflow → 500). |
| 6 | **`call_remark` / `remark` columns** — use **TEXT** (or length ≥ 4000); validate max length server-side before insert. |
| 7 | Parse tagged `callRemark` with `parseTaggedCallRemark()`; normalize category via `normalizeStatusCategory()` — **`schedule`** must be allowed. |
| 8 | **After success:** return updated **`lead`** + **`nextLead`** (per §4.5); include row in **`scheduledLeads`** / **`rescheduledLeads`** when `next_follow_up_at > NOW()`. |
| 9 | Echo **`nextFollowUpAt`** on GET queue + history items (`dialledActions`, HR/admin calling-actions). |

#### Wrong vs correct persistence

**Wrong** (often causes 500 or bloated rows):

```sql
-- Appends to existing call_remark
UPDATE hr_calling_leads SET call_remark = CONCAT(call_remark, ' | ', $new) ...

-- action enum missing 'rescheduled'
-- next_follow_up_at NOT NULL but body only had nextFollowUpAt and mapper ignored it
```

**Correct:**

```sql
UPDATE hr_calling_leads
SET
  status = 'rescheduled',
  action = $action,  -- 'rescheduled' or 'follow_up'
  status_category = 'schedule',
  status_text = $status_text,
  remark = $remark,
  call_remark = $call_remark,
  next_follow_up_at = $next_follow_up_at::timestamptz,
  action_at = $action_at::timestamptz,
  updated_at = NOW()
WHERE id = $lead_id AND assigned_dealer_id = $dealer_id;
```

#### Example success response

```json
{
  "success": true,
  "data": {
    "lead": {
      "id": "lead-uuid",
      "status": "rescheduled",
      "action": "rescheduled",
      "statusCategory": "schedule",
      "statusText": "Callback Scheduled",
      "callRemark": "[schedule] Callback Scheduled | Adani panel 620w",
      "nextFollowUpAt": "2026-06-11T05:07:00.000Z"
    },
    "nextLead": { "id": "next-uuid", "status": "assigned", "name": "…" },
    "scheduledLeads": [
      { "id": "lead-uuid", "status": "rescheduled", "nextFollowUpAt": "2026-06-11T05:07:00.000Z" }
    ],
    "pendingCount": 40
  }
}
```

#### Backend checklist (reschedule)

- [ ] `rescheduled` and `follow_up` + `nextFollowUpAt` both update lead to `status: rescheduled`
- [ ] Accept `nextFollowUpAt` **and** `next_follow_up_at`
- [ ] `status_category: schedule` + `Callback Scheduled` (and other hold reasons) persist without 500
- [ ] `call_remark` TEXT / adequate length; replace not concat
- [ ] `in_progress` → `rescheduled` transition allowed
- [ ] Row appears in `scheduledLeads` when follow-up is in the future
- [ ] No 500 for valid dealer-owned lead — use `VAL_001` / `LEAD_005` instead

#### QA

1. Start call → Connected → Decision Pending → Callback Scheduled → pick future datetime → Submit → **200**, lead in **Scheduled** tab.
2. Same flow with long remark (repeat submit 5×) → still **200** (no remark bloat 500).
3. Send only `action: follow_up` + `next_follow_up_at` → same result as `rescheduled`.
4. Omit `nextFollowUpAt` → **400** `VAL_001`, not 500.
5. HR/Admin calling-actions list shows `actionAt`, `callRemark`, `nextFollowUpAt` for the row.

**Reference:** `BACKEND_CHANGES_REQUIRED.md` **§E.2**; `BACKEND_ADMIN_QUOTATION_STATUS.ts` → `patchDealerCallingQueueAction`.

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
7. **Decision Pending reschedule** → Submit returns 200; lead in Scheduled tab; no Internal Server Error (see §4.5.2).

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

**Summary cards (Interested / Follow Up / Not Interested / Others):** see **§7** — requires structured `statusText` + `statusCategory` (or parseable `callRemark`) on every row.

**Weekly alignment:** same as `lib/calling-report-date-range.ts` — week = **Monday 00:00** through **Sunday end of day** in the timezone you document for reporting.

### Checklist

- [ ] PATCH action accepts `callRemark` + `call_remark` + structured `statusCategory` / `statusText` / `remark`
- [ ] Persist `call_remark` and structured columns; echo on GET
- [ ] Optional PATCH lead `customerNote`
- [ ] `POST /customers` accepts `notes` / `remarks`
- [ ] Queue GET returns `scheduledLeads`, `dialledActions`, `connectedActions`, `notConnectedActions` separately
- [ ] `start` does not return `nextLead`; completion actions do
- [ ] **`GET /current` returns `in_progress` lead until Submit** (§4.5.1)
- [ ] **`GET /next` does not skip past open `in_progress` call** (§4.5.1)
- [ ] **Reschedule Submit** — `rescheduled` / `follow_up` + `nextFollowUpAt` → `status: rescheduled`, no 500 (§4.5.2)
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

## 6. Dealer dashboard — Total Value (approved quotations only)

**Frontend:** `app/dashboard/page.tsx` — the **Total Value** stat card sums amounts **only** where `status` is `approved` (case-insensitive). Uses the **same amount as the table AMOUNT column**: `subtotal` (package/set price) → `totalAmount` → `finalAmount`. Display: full INR (e.g. `₹1,89,000`), not lakhs shorthand. Subtitle: **“Approved quotation value”**.

**Current API:** Dealer loads all quotations via `GET /api/quotations` and aggregates client-side. **No new endpoint is required** if list/detail responses are complete.

### Required on `GET /api/quotations` (dealer JWT)

Each quotation object must include:

| Field | Notes |
|-------|--------|
| `status` | `pending`, `approved`, `rejected`, etc. — set to **`approved`** when admin approves |
| `subtotal` | Root and/or `pricing.subtotal` — **primary** (matches AMOUNT column / set price) |
| `totalAmount` | Root and/or `pricing.totalAmount` — fallback |
| `finalAmount` | Root and/or `pricing.finalAmount` — last fallback (after subsidy; can be much lower than subtotal) |

**Do not** include `pending` / `rejected` rows in any server-side `approvedQuotationValue` aggregate.

### Optional — `GET /api/dealers/me/dashboard-stats` (recommended)

Avoids loading full quotation lists for one number.

```json
{
  "success": true,
  "data": {
    "totalQuotations": 27,
    "uniqueCustomers": 23,
    "thisMonthQuotations": 0,
    "approvedQuotationCount": 5,
    "approvedQuotationValue": 1250000
  }
}
```

| Field | Rule |
|-------|------|
| `approvedQuotationValue` | `SUM(ABS(COALESCE(final_amount, total_amount, 0)))` WHERE `LOWER(status) = 'approved'` AND `dealer_id =` authenticated dealer |
| `approvedQuotationCount` | `COUNT(*)` with same filter |
| `thisMonthQuotations` | `created_at` in current calendar month (dealer scope) |

**SQL (adjust names):**

```sql
SELECT COALESCE(SUM(ABS(COALESCE(final_amount, total_amount, 0))), 0) AS approved_quotation_value,
       COUNT(*) AS approved_quotation_count
FROM quotations
WHERE dealer_id = $dealerId
  AND LOWER(TRIM(status)) = 'approved';
```

### Admin approval

When admin sets quotation status to approved (`PATCH` admin quotation status — see `BACKEND_ADMIN_QUOTATION_STATUS.ts`), persist `status = 'approved'` and keep `final_amount` / `total_amount` in sync with pricing so dealer dashboard totals match the **Amount** column in the table.

### Checklist

- [ ] `GET /api/quotations` returns `status`, `finalAmount` (or `pricing.finalAmount`), `totalAmount` for every dealer row
- [ ] Admin approve flow sets `status` to `approved` reliably
- [ ] (Optional) `GET /api/dealers/me/dashboard-stats` with `approvedQuotationValue`

**Full spec:** `BACKEND_CHANGES_REQUIRED.md` §7.9.

---

## 7. HR Dealer Actions — summary buckets (Interested / Follow Up / Not Interested)

**Frontend:** `app/dashboard/hr/page.tsx` (Dealer Actions tab), `lib/calling-action-summary.ts`, `lib/calling-remark-payload.ts`. **API-only** — no `localStorage` merge for this tab.

### Problem

HR summary cards were wrong when backend returned only `action: "called"` without the dealer’s selected **status text** (e.g. `Already Installed Solar` counted as Interested). Counts must match the **dealer calling status picker** (`app/dashboard/calling-data/page.tsx`).

**UI (May 2026):** Primary HR cards are **Connected** vs **Not Connected** (same rules as dealer Calling Data). Under **Connected**, sub-counts show Interested / Follow Up / Not Interested. Optional GET fields `connectedActions` / `notConnectedActions` on queue response are not required if each row has `statusText` or tagged `callRemark`.

### Required on PATCH (dealer completes a call)

`PATCH /api/dealers/me/calling-queue/{leadId}/action` (and HR/admin equivalents) must persist:

| Field | Example |
|-------|---------|
| `action` | `called` \| `follow_up` \| `not_interested` \| `rescheduled` |
| `callRemark` / `call_remark` | `[competition] Already Installed Solar \| optional note` |
| `statusCategory` / `status_category` | `competition`, `customer_intent`, `schedule`, `call_connectivity`, … |
| `statusText` / `status_text` | Exact label from picker, e.g. `Interested`, `Callback Later`, `Already Installed Solar` |

Tagged remark format (frontend sends all of the above):

```text
[{statusCategory}] {statusText} | {freeRemark}
```

Reference: `enrichCallingActionPayload()` in `lib/calling-remark-payload.ts`, `BACKEND_ADMIN_QUOTATION_STATUS.ts` (`patchDealerCallingQueueAction`).

### Required on GET (HR / Admin calling-actions)

Each row in `GET /api/hr/calling-actions` (and admin paths in §4.8) must echo:

| Field | Required for summary |
|-------|----------------------|
| `action`, `actionAt` | Yes |
| `callRemark` or `call_remark` | Yes (fallback parse) |
| `statusCategory` / `status_category` | **Strongly recommended** |
| `statusText` / `status_text` | **Strongly recommended** — exact picker label |
| `dealerId`, `dealerName`, `leadId` | Yes |
| Customer `name`, `mobile`, `address` | Display only |

Frontend classification (`lib/calling-action-summary.ts`):

| Bucket | Examples |
|--------|----------|
| **Interested** | `Interested`, `Highly Interested`, `Site Visit Scheduled`, `Quotation Shared`, `Valid Lead`, … |
| **Follow Up** | `Callback Later`, `Rescheduled`, `Follow-up Pending`, `action: follow_up` |
| **Not Interested** | `Not Interested`, `Already Installed Solar`, `Chose Competitor`, `action: not_interested` |
| **Others** | `start`, connectivity-only rows, unclassified |

Do **not** classify using substring `includes("interested")` on status text.

### Optional — server-side aggregates

```json
{
  "actions": [ /* ... */ ],
  "summary": {
    "interested": 12,
    "followUp": 5,
    "notInterested": 48,
    "others": 3,
    "total": 68
  }
}
```

If omitted, frontend computes from `actions[]` using the same rules.

### Checklist

- [ ] PATCH persists `status_category` + `status_text` + `call_remark` on every submit
- [ ] GET returns structured fields on every action row (not only `action: called`)
- [ ] `Already Installed Solar` / `Not Interested` rows are **not** counted as Interested
- [ ] `Interested` / `Highly Interested` rows count as Interested
- [ ] HR GET honours `dealerId` + `startDate` / `endDate` for **All Dealers** and per-dealer filters

**Full spec:** `BACKEND_CHANGES_REQUIRED.md` §J.1.

---

## 6. Account Management — Payment Management dealer filter

**Frontend:** `app/dashboard/account-management/page.tsx` — **Payment Management** tab filters approved payment rows by dealer (dropdown **All Dealers** / specific dealer / **Unassigned**).

**Filtering is client-side today.** No new endpoint is required if list payloads already include dealer fields.

### Required on approved quotation list

Used by account-management: `GET /api/quotations?status=approved` (or role-scoped equivalent).

Each row **must** include:

| Field | Purpose |
|-------|---------|
| `dealerId` / `dealer_id` | Filter key (UUID) |
| `dealer` | `{ id, firstName, lastName, mobile, email, username, role }` for display |
| `statusApprovedAt` / `approved_at` | Approve-date range filter |
| `fileLoginAt` / `file_login_at` | File-login date filter |
| `paymentType` / `payment_type`, `paymentStatus`, `paymentMode` | Payment-type / status filters |
| `installments` / `paymentPhases` / `payment_phases` | Installment **count** filter (array length) |
| `subtotal`, `remaining`, `remainingAmount` | Payment amounts |
| `bankName`, `bankIfsc` | Loan / cash+loan display |

**Installment count filter:** Frontend matches `phases.length === N` (exact count). Persist the full installment array on PATCH; do not return stale partial arrays.

### Optional — server-side dealer filter (performance)

When the approved list is large:

```
GET /api/quotations?status=approved&dealerId={uuid}
GET /api/quotations?status=approved&dealerId=unassigned
```

- Auth: **account-management**, **admin** (same as existing approved list).
- `dealerId=unassigned` → rows with null/empty `dealer_id`.
- Omit param → all dealers (current behaviour).

### Optional — server-side installment count

```
GET /api/quotations?status=approved&installmentCount=2
```

Exact match on number of installment/phase rows (not “has installment 2”).

### Checklist

- [ ] Approved list returns `dealerId` + nested `dealer` on every row used by account-management
- [ ] `installments` / `payment_phases` array reflects true count after PATCH
- [ ] Approve / file-login timestamps exposed for date-range filters
- [ ] (Optional) `dealerId` query param on approved list for account-management role

**Reference:** `BACKEND_CHANGES_REQUIRED.md` §6.5, §7.9; `BACKEND_ADMIN_QUOTATION_STATUS.ts` (installments PATCH).

---

## 7. Admin Overview — total kW (capacity) by dealer

**Frontend:** `app/dashboard/admin/page.tsx` — **Overview → Dealers by Revenue** sums **system kW** from each dealer’s **approved** quotations (same approval-date + dealer filters as revenue). Example: Sunil with 12 approved quotations this month → **total kW = sum of all 12 system sizes**.

**Calculation is client-side** via:
- `lib/merge-quotation-products.ts` — merges product fields from all API shapes
- `lib/quotation-system-kw.ts` — computes kW per quotation and sums

**Endpoint used today:** `GET /api/admin/quotations` (full list; no new endpoint required).

---

### Required — `GET /admin/quotations` list rows

Each quotation row must include enough **product / system-size** data to compute kW. The frontend merges these sources (in priority order):

| Source | Notes |
|--------|--------|
| `products` | JSON/JSONB object (preferred) — may be stringified JSON |
| `quotationProduct` | Sequelize / separate-table row (object) |
| `quotationProducts[]` | Array — first row used if present |
| Flattened root fields | `panelSize` / `panel_size`, `panelQuantity` / `panel_quantity`, etc. |
| Precomputed (best) | `systemKw` / `system_kw` or `systemSize` / `system_size` |

**Do not** return `products: {}` with no panel fields anywhere else — that produces **0 kW** even when revenue is correct.

#### Fields used to compute kW (by system type)

| System type | Required fields (camelCase or snake_case) |
|-------------|-------------------------------------------|
| DCR / Non-DCR | `systemType`, `panelSize`, `panelQuantity` |
| DCR-only | `dcrPanelSize`, `dcrPanelQuantity` (or same as panel fields) |
| BOTH | `dcrPanelSize`, `dcrPanelQuantity`, `nonDcrPanelSize`, `nonDcrPanelQuantity` |
| CUSTOMIZE | `customPanels[]` with `size`, `quantity` |
| Fallback | `inverterSize`, then `structureSize` |
| Precomputed | `systemKw` / `system_kw` (numeric kW) or `systemSize` / `system_size` (e.g. `"5.5kW"`) |

#### kW formula (matches frontend `calculateSystemSize`)

```
kW = (panelSizeW × panelQuantity) / 1000
```

For BOTH: sum DCR kW + Non-DCR kW. For CUSTOMIZE: sum all custom panel rows.

#### Also required on same rows (already used for revenue card)

| Field | Purpose |
|-------|---------|
| `status` = `approved` | Only approved rows count toward kW |
| `statusApprovedAt` / `status_approved_at` / `approvedAt` | Date-range filter (default: this month) |
| `dealerId` / `dealer_id` + nested `dealer` | Per-dealer breakdown |
| `pricing.subtotal` or flattened `subtotal` | Revenue (unchanged) |

---

### Recommended — normalized `products` on list responses

If product data lives in `quotation_products` table, **either**:

1. **Include joined row** as `quotationProduct` / `quotationProducts` on list (frontend merges automatically), **or**
2. **Serialize merged `products`** on every list/detail response (simplest for all clients):

```json
{
  "id": "uuid",
  "status": "approved",
  "statusApprovedAt": "2026-05-15T10:00:00Z",
  "dealerId": "dealer-uuid",
  "subtotal": 297000,
  "products": {
    "systemType": "non-dcr",
    "panelSize": "550W",
    "panelQuantity": 12
  }
}
```

Or with precomputed size (fastest, no parsing):

```json
{
  "systemKw": 6.6,
  "products": { "systemType": "non-dcr", "panelSize": "550W", "panelQuantity": 12 }
}
```

---

### Optional — server-side aggregates

For faster admin dashboard when quotation volume is high:

```
GET /api/admin/overview/dealer-stats?range=this_month&dealerId=
```

```json
{
  "dealers": [
    {
      "dealerId": "uuid",
      "dealerName": "Sunil Choudhry",
      "approvedCount": 12,
      "revenue": 2970000,
      "totalKw": 72.6
    }
  ],
  "totalKw": 842.3,
  "totalRevenue": 125000000
}
```

- `totalKw` = sum of per-quotation system size for **approved** rows in range (same rules as frontend, or use stored `system_kw`).
- Filter params: `this_month`, `week`, `last_month`, `custom` + `from`/`to`, optional `dealerId`.

---

### Optional — persisted `system_kw` column

```sql
ALTER TABLE quotations ADD COLUMN system_kw NUMERIC(10,2) NULL;
```

Set on create/update from products (same formula as frontend). Return as `systemKw` / `system_kw` on list/detail. Frontend **prefers this** when present.

Example trigger on product save:

```sql
-- Pseudocode: system_kw = (parse_w(panel_size) * panel_quantity) / 1000
UPDATE quotations SET system_kw = computed_kw WHERE id = :id;
```

---

### Backend checklist

- [ ] `GET /admin/quotations` includes product data (`products` **or** `quotationProduct` **or** root panel fields **or** `system_kw`)
- [ ] Empty `products: {}` without panel fields elsewhere is fixed (root cause of 0 kW in production)
- [ ] `statusApprovedAt` set when status becomes `approved`
- [ ] `dealerId` present on every quotation row
- [ ] (Recommended) Merge `quotationProduct` into `products` on list serializer
- [ ] (Optional) `system_kw` column maintained on quotation create/update
- [ ] (Optional) `GET /admin/overview/dealer-stats` with `totalKw` per dealer

### QA — verify kW matches revenue dealers

1. Pick dealer with known approved count (e.g. 12 this month).
2. Open admin **Overview → Dealers by Revenue** — kW should be **> 0** if quotations have panel config.
3. Sum manually: each approved quotation’s `(panelSize × panelQuantity) / 1000` should match dealer total (± rounding).
4. If revenue correct but kW still 0 → inspect API row: missing `products`, `quotationProduct`, and panel root fields.

**Reference:** `lib/merge-quotation-products.ts`, `lib/quotation-system-kw.ts`, `lib/pricing-tables.ts` (`calculateSystemSize`).

---

## 8. Mobile app — API URL (HTTPS)

**Frontend:** Capacitor WebView + `lib/resolve-api-base-url.ts` uses **`https://api.inventory.chairbordsolar.com/api`**.

- HTTP URLs **301 redirect to HTTPS**; Android WebView **fails POST login** on redirect.
- **No API code change** if production serves HTTPS on the same host.
- Ensure CORS allows `https://quotation.chairbordsolar.com` (and dev origins if needed).

---

## 9. Payment Management → Admin Installation (Accounts release only)

> **BLOCKER — data not showing:** Admin Installation tab stays empty until backend implements **`PATCH /quotations/{id}/installation-release`** and returns release fields on **`GET /admin/quotations`**.  
> **Give backend team:** [`BACKEND_INSTALLATION_RELEASE.md`](./BACKEND_INSTALLATION_RELEASE.md) (step-by-step + SQL + curl QA) and `BACKEND_ADMIN_QUOTATION_STATUS.ts` → `patchQuotationInstallationRelease`.

**Frontend:** `app/dashboard/account-management/page.tsx` (Payment Management / **Send to Installer**), `app/dashboard/admin/page.tsx` (Admin → **Installation**), `lib/operational-install-queue.ts` (`shouldShowInAdminInstallationTab`, `isQuotationSentToInstaller`).

**Full spec:** `BACKEND_CHANGES_REQUIRED.md` — **Installation release & planned installation date**, **§6.4.C.7–C.8**, **§M**.

### Root cause (why Installation tab is empty today)

| Step | Expected | If backend missing |
|------|----------|-------------------|
| Account team clicks **Send to Installer** | `PATCH …/installation-release` saves DB flags | 404/403 → only browser localStorage; admin refresh loses data |
| Admin opens **Installation** tab | `GET /admin/quotations` returns `installationReadyForInstaller: true` | Field absent/false → frontend hides all rows |
| Green badge in Payment Management | Same flags on `GET /quotations?status=approved` | Badge may show locally but admin panel empty |

**Minimum backend deliverable:** Implement §A + §B below, then verify with curl in `BACKEND_INSTALLATION_RELEASE.md` §11.

### Product rule (what the UI enforces)

| Payment Management (Account team) | Admin → Installation tab |
|-----------------------------------|---------------------------|
| **Send to Installer** **not** clicked | Row **must not** appear |
| **Sent to installer** (badge shown) | Row **appears** |
| Sent, **no installation photos** | **Pending Installation** |
| Sent, **photos uploaded** / `installer_approved` | **Approved Installation** |
| After **Send to Metering** (manual) | Row leaves Installation → **Metering** tab |

The frontend **only** treats a quotation as “sent” when **`installationReadyForInstaller === true`** and/or **`installationReleasedAt`** is set (from API or the release PATCH). It does **not** show approved quotations that were never released from Payment Management.

### Problem if backend is incomplete

- Payment Management shows **Sent to installer**, but Admin **Installation** is empty after refresh (especially on another browser/device) → release flags not persisted or not returned on **`GET /api/admin/quotations`**.
- Non-released approved quotations appear in installer/admin lists → queue not gated on release fields.
- Upload completes but row stays in **Pending** → `installationStatus` / image URLs not returned on admin list GET.

### Required quotation fields (persist + return on GET)

| Field (camelCase) | snake_case | Type | When set |
|-------------------|------------|------|----------|
| `installationReadyForInstaller` | `installation_ready_for_installer` | boolean | Account team clicks **Send to Installer** |
| `installationReleasedAt` | `installation_released_at` | ISO 8601 | Same action |
| `installationStatus` | `installation_status` | string | Workflow (see below) |
| `installationScheduledAt` | `installation_scheduled_at` | `YYYY-MM-DD` | Optional; admin planned date |
| `installationTeamId` | `installation_team_id` | UUID | Optional; team assignment |

Also return installation **photo URLs** on list/detail (`documents`, `siteCompletionImages`, `installationImageUrls`, per-field `*Url`, etc.) so **Approved Installation** works after refresh without relying on browser cache.

### A) PATCH — release to installer (Account Management)

**Preferred:** `PATCH /api/quotations/{quotationId}/installation-release`

**Body:**

```json
{
  "installationReadyForInstaller": true,
  "installationReleasedAt": "2026-06-05T10:30:00.000Z"
}
```

**Backend must:**

1. Set `installation_ready_for_installer = true` and `installation_released_at` (prefer client ISO or server `NOW()`).
2. Set **`installation_status = pending_installer`** when first released (recommended — matches **Pending Installation** tab).
3. **Do not** add the row to installer/admin operational lists until this PATCH succeeds.
4. **Auth:** account-management role (or equivalent).

**Fallback paths** (frontend tries in order — see `lib/api.ts` → `releaseForInstallation`):

- `PATCH /api/quotations/{id}/installation/ready`
- `PATCH /api/quotations/{id}/payment-details` (merge only release fields; do not wipe unrelated payment data)

### B) GET — list endpoints must echo release + workflow

Return the fields above on **each quotation object** (top level, not only nested under undocumented keys):

| Endpoint | Used by |
|----------|---------|
| `GET /api/admin/quotations` | Admin → Installation tab |
| `GET /api/quotations/{id}` | Row refresh after upload |
| Account Management approved/payments list | Payment Management **Sent to installer** badge |
| `GET /api/installer/quotations` | Installer dashboard (nested `quotation` OK if flattened fields also present) |

**Installer queue filter:** Only return quotations where **`installation_ready_for_installer = true`** OR **`installation_released_at IS NOT NULL`**. Do **not** include rows that are merely `status = approved` without release. See **§M** in `BACKEND_CHANGES_REQUIRED.md`.

### C) Installation workflow — Pending vs Approved tabs

**Pending Installation** (sent, work not done):

- `installation_status` in: `pending_installer`, `installer_in_progress`, `in_progress`, or empty/null right after release.

**Approved Installation** (photos uploaded / install complete):

- `installation_status` in: `installer_approved`, `pending_baldev`, `baldev_approved`, `completed`  
  **or** (legacy) `pending_metering` / metering stages if already in pipeline.
- **Plus:** persist and return at least one installation completion image URL on the quotation row.

**On completion upload** (installer or admin):

- `POST` / `PATCH` installer completion routes → set **`installation_status = installer_approved`** (preferred).
- **Do not** auto-set **`pending_metering`** on upload — metering starts only when admin/installation team clicks **Send to Metering** (`PATCH` with `pending_metering`). See `sendQuotationToMetering()` in `lib/api.ts`.

**Revert to pending** (admin):

- Accept `installation_status = pending_installer` from admin JWT (idempotent **200**).

### D) PATCH — Send to Metering (manual handoff)

When admin/installation team sends to metering, accept:

```json
{
  "installationStatus": "pending_metering",
  "installation_status": "pending_metering"
}
```

**Paths tried by frontend:** `PATCH /api/admin/quotations/{id}/installation-status` (and fallbacks in `lib/api.ts`).

**Auth:** `admin`, `installation-team`, or `installer` (installation team uses same handoff).

After success, row should appear under Admin → **Metering → Processing**, not Installation.

### E) SQL / migration (if columns missing)

```sql
ALTER TABLE quotations
  ADD COLUMN IF NOT EXISTS installation_ready_for_installer BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS installation_released_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS installation_scheduled_at DATE NULL,
  ADD COLUMN IF NOT EXISTS installation_team_id UUID NULL,
  ADD COLUMN IF NOT EXISTS installation_status TEXT NULL;

CREATE INDEX IF NOT EXISTS idx_quotations_installation_release
  ON quotations (installation_ready_for_installer, installation_released_at)
  WHERE installation_ready_for_installer = TRUE;
```

### Backend checklist

- [ ] `PATCH …/installation-release` (or `/installation/ready`) persists release flag + timestamp
- [ ] First release sets `installation_status = pending_installer` (recommended)
- [ ] `GET /api/admin/quotations` returns `installationReadyForInstaller`, `installationReleasedAt`, `installationStatus` on every row
- [ ] Account Management payments/approved list returns same release fields (for **Sent to installer** badge)
- [ ] Installer queue GET **only** includes released quotations
- [ ] Completion upload sets `installer_approved` + returns image URLs on subsequent GET
- [ ] Upload does **not** auto-advance to `pending_metering`
- [ ] Manual **Send to Metering** PATCH allowed for admin + installation-team
- [ ] Non-released approved quotations **never** appear in installation/installer operational APIs

### QA

1. Approve quotation in admin — **do not** send from Payment Management → **must not** appear in Admin Installation or installer queue.
2. Payment Management → **Send to Installer** → appears in Admin **Pending Installation** with **Sent to installation** date.
3. Hard refresh / different browser (same user role) → row still visible (proves server persistence, not localStorage only).
4. Upload installation photos → moves to **Approved Installation**; `GET /admin/quotations` shows `installationStatus: installer_approved` + URLs.
5. **Send to Metering** → row disappears from Installation; appears in Metering **Processing**.
6. Payment row still shows **Sent to installer**; unreleased neighbours stay out of Installation tab.

**Reference:** `lib/operational-install-queue.ts`, `lib/api.ts` (`releaseForInstallation`, `sendQuotationToMetering`), `BACKEND_CHANGES_REQUIRED.md` §M.

---

## 8. Admin Visitor Reports — list all visits with status (Jun 2026)

### Problem

Admin → **Visitor Reports** tab needs a **system-wide** visit list (all dealers, all visitors) with **status badges** and filters by **visitor**, **status**, **date range**, and **search**. Today there is only `GET /visitors/me/visits` (scoped to logged-in visitor) and `GET /quotations/{id}/visits` (per quotation). Admin cannot load a report without N+1 quotation calls.

### Frontend (implemented)

| File | Role |
|------|------|
| `app/dashboard/admin/page.tsx` | **Visitor Reports** tab — filters, status summary cards, visit rows |
| `lib/visit-report.ts` | Maps API visit → report row; normalizes `status`; client-side filters |
| `lib/api.ts` | `api.admin.visits.getAll()` → tries `GET /admin/visits`, falls back to `GET /visits` |

**Initial load:** `GET /admin/visits?limit=2000&status=all` (admin JWT). **Frontend fallback (Jun 2026):** if list endpoints fail, aggregates `GET /quotations/{id}/visits` across all admin quotations (`lib/load-admin-visitor-reports.ts`) so reports populate before `/admin/visits` ships.

**Client-side filters today** (server should support same query params for scale):

| Filter | Query param | Notes |
|--------|-------------|--------|
| Visitor | `visitorId` | Match `visit_assignments.visitor_id` |
| Status | `status` | `pending` \| `approved` \| `completed` \| `incomplete` \| `rejected` \| `rescheduled` \| **`all`** |
| Date range | `startDate`, `endDate` | ISO `YYYY-MM-DD` on `visitDate` |
| Search | `search` | Customer name, mobile, quotation id, location, visitor name, dealer name |

### Required endpoint (preferred)

```
GET /api/admin/visits
Authorization: Bearer {admin_token}
```

**Fallback (if same handler):** `GET /api/visits` with **admin** role — must return **all** visits, not dealer-scoped only.

### Response (200)

```json
{
  "success": true,
  "data": {
    "visits": [
      {
        "id": "visit_456",
        "quotationId": "QT-ABC123",
        "dealerId": "dealer_123",
        "visitDate": "2025-12-20",
        "visitTime": "14:00",
        "visitStartTime": "14:00",
        "visitEndTime": "16:00",
        "location": "123 MG Road, Jaipur, Rajasthan - 302012",
        "locationLink": "https://maps.google.com/?q=26.9124,75.7873",
        "notes": "Customer prefers afternoon visit",
        "status": "completed",
        "rejectionReason": null,
        "createdAt": "2025-12-17T14:30:00Z",
        "updatedAt": "2025-12-20T16:05:00Z",
        "visitors": [
          { "visitorId": "visitor_001", "visitorName": "Rajesh Kumar" }
        ],
        "quotation": {
          "id": "QT-ABC123",
          "dealerId": "dealer_123",
          "status": "approved",
          "finalAmount": 285950
        },
        "customer": {
          "firstName": "Amit",
          "lastName": "Sharma",
          "mobile": "9876543210"
        },
        "dealer": {
          "id": "dealer_123",
          "firstName": "John",
          "lastName": "Doe"
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 2000,
      "total": 142,
      "totalPages": 1
    }
  }
}
```

**Field aliases accepted by frontend mapper** (`lib/visit-report.ts`): `date` / `visitDate`, `visitStatus` / `visit_status` / `status`, `visitLocation` / `location`, `otherVisitors` / `visitors`, snake_case mirrors optional.

### Status enum (must match visitor dashboard)

`pending` → `approved` → (`completed` | `incomplete` | `rescheduled` | `rejected`)

Do **not** default omitted `status` to a filter that hides non-pending rows when `status=all` is sent.

### Auth & scope

| Role | `GET /admin/visits` |
|------|---------------------|
| **admin** | All visits |
| dealer | 403 (use own quotation visits) |
| visitor | 403 (use `GET /visitors/me/visits`) |

### SQL sketch (adjust names)

```sql
SELECT v.*,
       json_agg(json_build_object('visitorId', va.visitor_id, 'visitorName', va.visitor_name)) AS visitors
FROM visits v
LEFT JOIN visit_assignments va ON va.visit_id = v.id
LEFT JOIN quotations q ON q.id = v.quotation_id
LEFT JOIN customers c ON c.id = q.customer_id
LEFT JOIN dealers d ON d.id = v.dealer_id
WHERE ($1::text IS NULL OR $1 = 'all' OR v.status = $1)
  AND ($2::uuid IS NULL OR EXISTS (
        SELECT 1 FROM visit_assignments va2
        WHERE va2.visit_id = v.id AND va2.visitor_id = $2))
  AND ($3::date IS NULL OR v.visit_date >= $3)
  AND ($4::date IS NULL OR v.visit_date <= $4)
GROUP BY v.id
ORDER BY v.visit_date DESC, v.visit_time DESC
LIMIT $5 OFFSET $6;
```

Join **customer** and **dealer** name fields in application layer or JSON subselect for list performance.

### Indexes (recommended)

- Existing: `idx_visit_status`, `idx_visit_date`, `idx_assignment_visitor`
- Optional composite: `(visit_date DESC, status)` for admin report default sort

### Realtime (optional)

Emit `backend:mutation` with `path` containing `visit` when visit status changes so Admin Visitor Reports tab can refresh (frontend already listens when tab is open).

### Checklist

- [ ] Implement `GET /api/admin/visits` (admin auth)
- [ ] Support `status=all` and individual status values
- [ ] Support `visitorId`, `startDate`, `endDate`, `search`, `page`, `limit`
- [ ] Return `visitors[]` with `visitorId` + `visitorName` per visit
- [ ] Return nested `customer`, `dealer`, `quotation` (minimal fields OK for list)
- [ ] Return `rejectionReason` / `notes` for incomplete / rejected / rescheduled rows
- [ ] Paginate when `total > limit` (frontend currently requests `limit=2000`)
- [ ] 404 on `/admin/visits` → frontend falls back to `GET /visits` (implement one path in production)

### Completion details modal (admin — eye button on **Completed** rows)

**Frontend:** `components/admin-visit-details-dialog.tsx` → `GET /quotations/{quotationId}/visits`, match visit `id`, show **only** visitor-entered completion data (dimensions, notes, images).

**No new endpoint required** if `GET /quotations/{id}/visits` returns full completion payload for **admin** JWT (same fields as visitor complete flow).

| Field | Required for modal |
|-------|-------------------|
| `notes` | Visit / completion notes (e.g. `3kw`) |
| `length`, `width` | Site dimensions |
| `backLegFeet`, `midLegFeet`, `frontLegFeet` (or snake_case) | Leg measurements in feet |
| `unit` | `feet` or `cm` |
| `rowDiagramImage` / `row_diagram_image` | **Public or signed HTTPS URL** (not raw S3 path that 403s) |
| `meterImage` / `meter_image` | Same |
| `images` / `siteImages` / `completionImages` | Array of accessible image URLs |
| `completionDetails` / `siteDimensions` | Optional nested mirrors of above |

**Also fix on list/report rows (not in completion modal, but visible in report list):**

- `visitors[].visitorName` — not only `visitorId` UUID
- `customer.firstName` / `lastName` on quotation join — avoid `N/A` in report list

**Media:** Reuse **§U** (public/signed URLs) for visit upload URLs so row diagram / meter / site images open in browser.

### QA

1. Admin → Visitor Reports → all assigned visits appear with correct status badges.
2. Filter by **visitor** → only that visitor’s assignments show.
3. Filter by **status** = `completed` → only completed rows.
4. Date range **this month** matches `visitDate` boundaries.
5. Search by customer mobile or quotation id returns matching rows.
6. Visitor completes visit on mobile → admin report shows `completed` after refresh (or realtime).

**Reference:** `lib/visit-report.ts`, `app/dashboard/admin/page.tsx`, `BACKEND_CHANGES_REQUIRED.md` **§Z**.

---

## Related docs

| Doc | Section |
|-----|---------|
| `BACKEND_CHANGES_REQUIRED.md` | §6.4–6.5 (installation workflow, uploads), **Installation release & planned date**, **§M** (accounts release gate), §7.7–7.9, dealer queue (~2307), **§J** + **§J.1**, §X (PDF flags) |
| `BACKEND_ADMIN_QUOTATION_STATUS.ts` | HR upload handlers + `computeHrUploadLeadCounts` + `patchDealerCallingQueueAction` |
| `lib/quotation-pdf-display.ts` | PDF display helpers (frontend + spec for server) |
| `lib/calling-lead-assignee.ts` | Assignee normalization spec for backend field names |
| `lib/calling-remark-payload.ts` | PATCH action body for remarks |
| `lib/calling-report-date-range.ts` | HR **GET** `startDate` / `endDate` + `range` semantics |
| `lib/calling-lead-session.ts` | Client-side draft keys (not a backend contract) |
| `lib/calling-action-summary.ts` | HR Interested / Follow Up / Not Interested bucket rules |
| `lib/quotation-system-kw.ts` | Admin overview kW sum per dealer (frontend; optional `system_kw` on API) |
| `lib/merge-quotation-products.ts` | Merges `products` + `quotationProduct` + flat row fields for kW |
| `lib/operational-install-queue.ts` | Payment **Send to Installer** gate + Admin Installation pending/approved rules |
| `lib/visit-report.ts` | Admin Visitor Reports — status normalization, filters, row mapping |
| **`BACKEND_INSTALLATION_RELEASE.md`** | **BLOCKER:** Installation tab — PATCH release + GET list fields + QA curls |
