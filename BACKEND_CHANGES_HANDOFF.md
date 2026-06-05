# Backend changes handoff (May 2026)

Action items for the backend team from recent frontend work. Full detail lives in `BACKEND_CHANGES_REQUIRED.md` (**§7.8**, **§7.9**, dealer calling queue **§E / §H / §J**, **§J.1**, **§X**). Reference implementations: `BACKEND_ADMIN_QUOTATION_STATUS.ts` (HR uploads, `patchDealerCallingQueueAction`), `lib/quotation-pdf-display.ts` (PDF wording), `lib/calling-remark-payload.ts` (remark PATCH body), `lib/api.ts` (HR/admin calling-actions query params).

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

**Values:** `waaree_540_560_bifacial`, `waaree_580_700_bifacial_topcon`, `adani_540_580_bifacial`, `adani_610_625_bifacial_topcon`, `premier_600_625_bifacial_topcon`.

**Snake_case:** `pdf_panel_range_key`, `pdf_dcr_panel_range_key`, `pdf_non_dcr_panel_range_key`.

**Legacy:** `pdfUsePanelSizeRange` (old rows only). **`pdfUseInverterBrandOptions` no longer sent.**

**Save flow:** `POST` strips PDF keys → **`PATCH /api/quotations/{id}/products`** saves them.

**Uncheck / clear:** Frontend sends `pdfPanelRangeKey: ""` (and snake_case `null`) when a box is unchecked. Backend must **remove or null out** stored keys on PATCH — do not ignore empty strings or leave stale keys (otherwise PDF keeps old “As per the set” behaviour).

When a range key is set, PDF shows panel spec as **“As per the set”** and inverter brand as **“As per the set”** when any range is active; allow **qty 0 / omitted** on backend validation.

**Panel size on GET:** Prefer `panelSize` over legacy `dcrPanelSize` when both exist for DCR quotations (frontend syncs on save; avoid returning conflicting duplicates).

### 2.2 Combined brand strings (if whitelisted)

| Field | Extra values |
|-------|----------------|
| `inverterBrand` | `Vsole/Xwatt/Saatvik`, `Vsole/Xwatt` |
| `meterBrand` | `L&T/HPL/Genus/Secure` |

### 2.3 GET quotation — `dealer`

Return `dealer: { id, firstName, lastName, email, mobile, username, role }` for proposal “Dealer Details”.

### 2.4 `validUntil` (optional)

Use **createdAt + 7 days** (frontend uses 7-day validity; reference controller may still use 5).

### Example `products`

```json
{
  "systemType": "dcr",
  "panelBrand": "Adani",
  "panelSize": "610W",
  "panelQuantity": 0,
  "inverterBrand": "Vsole/Xwatt/Saatvik",
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
- [ ] Return `dealer` on GET quotation
- [ ] (Optional) `validUntil` +7 days

**Full spec:** `BACKEND_CHANGES_REQUIRED.md` §X.

### 2.5 Pricing tables API (optional but recommended)

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

**Summary cards (Interested / Follow Up / Not Interested / Others):** see **§7** — requires structured `statusText` + `statusCategory` (or parseable `callRemark`) on every row.

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

## Related docs

| Doc | Section |
|-----|---------|
| `BACKEND_CHANGES_REQUIRED.md` | §6.5 + **§6.5.1** (admin kW / product merge), §7.7–7.9 (calling queue, HR uploads, dealer dashboard stats), dealer queue (~2307), **§J** + **§J.1** (calling-actions GET + summary buckets), §X (PDF flags) |
| `BACKEND_ADMIN_QUOTATION_STATUS.ts` | HR upload handlers + `computeHrUploadLeadCounts` + `patchDealerCallingQueueAction` |
| `lib/quotation-pdf-display.ts` | PDF display helpers (frontend + spec for server) |
| `lib/calling-lead-assignee.ts` | Assignee normalization spec for backend field names |
| `lib/calling-remark-payload.ts` | PATCH action body for remarks |
| `lib/calling-report-date-range.ts` | HR **GET** `startDate` / `endDate` + `range` semantics |
| `lib/calling-lead-session.ts` | Client-side draft keys (not a backend contract) |
| `lib/calling-action-summary.ts` | HR Interested / Follow Up / Not Interested bucket rules |
| `lib/quotation-system-kw.ts` | Admin overview kW sum per dealer (frontend; optional `system_kw` on API) |
| `lib/merge-quotation-products.ts` | Merges `products` + `quotationProduct` + flat row fields for kW |
