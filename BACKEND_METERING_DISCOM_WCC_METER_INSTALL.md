# Backend handoff — Meter in Discom → WCC Pending → Meter Installation Pending (Jul 2026)

Frontend Admin → **Metering** flow uses **server fields only** (no `localStorage` for Discom → WCC).

---

## Product flow (Admin UI)

```
Meter Pending
  → To Discom
Meter in Discom
  → To WCC Pending   (only if Installation is approved / upload complete)
WCC Pending
  → Save WCC details
Meter Installation Pending
  → To Final Step (MCO)
```

**Gate:** From Meter in Discom, the row may move to WCC Pending **only** when customer installation is completed and approved (`installer_approved` / upload-complete). If not approved, UI blocks with a toast (no API call).

**Also still valid (entry path):**

```
Installation → Approved
  → Metering → WCC Pending (fill Discom name + Assigned person)
  → Save → Meter Pending (pending_metering)
```

---

## Summary

| Area | Frontend behaviour | Backend needed |
|------|--------------------|----------------|
| **New stage** | Meter Installation Pending tab | Accept + persist `meter_installation_pending` |
| **Discom → WCC** | `api.admin.quotations.setMeteringWccAfterDiscom(id, true)` | Persist `meteringWccAfterDiscom` / `metering_wcc_after_discom` |
| **WCC save (post-Discom)** | `PATCH` → `meter_installation_pending` (+ clear flag) | Accept transition; clear WCC-after-discom flag |
| **WCC save (entry)** | `PATCH` → `pending_metering` | Unchanged |
| **GET lists** | Tabs read stage + flag from API | Echo statuses + `meteringWccAfterDiscom` |
| **Final Step** | From Meter Installation Pending → `mco` | Allow `meter_installation_pending` → `mco` |

---

## 1. New operational status: `meter_installation_pending`

### 1.1 Enum / DB

Add to the same column(s) as other ops stages (`installation_status` / `metering_status`):

```text
pending_metering
metering_in_progress
metering_approved              ← Meter in Discom (UI)
meter_installation_pending     ← NEW (Meter Installation Pending UI)
mco
…
```

Optional audit:

```sql
ALTER TABLE quotations
  ADD COLUMN IF NOT EXISTS meter_installation_pending_at TIMESTAMP NULL;
```

Set `meter_installation_pending_at = NOW()` when entering this stage.

### 1.2 Accept on operational status PATCH

Same routes as today (frontend tries until one works):

| Method | Path |
|--------|------|
| `PATCH` | `/api/admin/quotations/{id}/installation-status` |
| `PATCH` | `/api/admin/quotations/{id}/workflow-status` |
| `PATCH` | `/api/quotations/{id}/status` |
| `PATCH` | `/api/quotations/{id}/metering-status` |

**Body (frontend sends):**

```json
{
  "installationStatus": "meter_installation_pending",
  "installation_status": "meter_installation_pending",
  "meteringStatus": "meter_installation_pending",
  "metering_status": "meter_installation_pending",
  "status": "meter_installation_pending"
}
```

**Auth:** `admin` JWT (same as other admin ops patches).

**Idempotency:** Re-PATCH when already `meter_installation_pending` → **200** + current row.

---

## 2. Allowed transitions

```
pending_metering | metering_in_progress
  -- approve / To Discom --> metering_approved

metering_approved
  -- set meteringWccAfterDiscom=true --> WCC Pending (UI)
  -- PATCH meter_installation_pending --> meter_installation_pending
       (after WCC details saved on post-Discom path; clear flag)

meter_installation_pending
  -- send_to_mco / force MCO --> mco  (+ mcoAt)

mco
  -- move_back (optional) --> metering_approved | meter_installation_pending
```

**Do not** require a direct jump `metering_approved` → `mco` for this product path (UI goes through Meter Installation Pending). Existing `send_to_mco` from `metering_approved` may remain for legacy/metering-role flows.

---

## 3. Server flag: post-Discom WCC queue (required)

| Field | Type | Meaning |
|-------|------|---------|
| `meteringWccAfterDiscom` / `metering_wcc_after_discom` | boolean | Row is in post-Discom WCC Pending |
| `meteringWccAfterDiscomAt` / `metering_wcc_after_discom_at` | timestamp | When flagged |

**Set true** when admin clicks **To WCC Pending** from Meter in Discom.

**Clear** when WCC is saved and status becomes `meter_installation_pending` (or when moving back to Meter Pending / Discom).

### Endpoints (frontend tries in order)

```http
PATCH /api/admin/quotations/{id}/metering-wcc-after-discom
Content-Type: application/json

{ "meteringWccAfterDiscom": true, "metering_wcc_after_discom": true }
```

Fallback — existing installation-status PATCH:

```json
{
  "installationStatus": "metering_approved",
  "installation_status": "metering_approved",
  "meteringStatus": "metering_approved",
  "metering_status": "metering_approved",
  "meteringWccAfterDiscom": true,
  "metering_wcc_after_discom": true
}
```

**Validation:** Reject `meteringWccAfterDiscom: true` unless:

1. Current metering stage is `metering_approved`, and  
2. Installation is approved (`installer_approved` or upload-complete equivalent — not `installer_partial_approved`).

Return **400** with a clear message if installation is not approved.

**GET:** Echo the flag on `GET /api/admin/quotations` and metering list rows. **Required** so Admin tabs work after refresh with no client storage.

---

## 4. WCC details save (unchanged route, two outcomes)

Frontend still calls metering details save, then operational status PATCH:

| Path into WCC | After save — status PATCH |
|---------------|---------------------------|
| Entry (Installation Approved → WCC) | `pending_metering` |
| Post-Discom (Meter in Discom → WCC) | `meter_installation_pending` (+ clear `meteringWccAfterDiscom`) |

Details payload (existing):

- `discomName`
- `remarks`
- `authorizedRepresentative` / assigned person
- `discomLocation` (optional)
- WCC image fields as already documented for Admin WCC modal

Persist details; then accept the status PATCH above.

---

## 5. GET / list requirements

`GET /api/admin/quotations` (and metering queues if used) must return:

| Field | Values used by UI |
|-------|-------------------|
| `installationStatus` / `installation_status` | incl. `meter_installation_pending` |
| `meteringStatus` / `metering_status` | same |
| `meteringApprovedAt` / `metering_approved_at` | when in/after Discom |
| `meteringWccAfterDiscom` / `metering_wcc_after_discom` | boolean (**required**) |
| Discom / remarks / assigned person | as today |

**Tab mapping (frontend):**

| UI tab | Stage / flag |
|--------|----------------|
| Meter Pending | `pending_metering` / `metering_in_progress` — **Send to Metering, no Discom/WCC action yet** |
| Meter in Discom | `metering_approved` and **not** `meteringWccAfterDiscom` |
| WCC Pending | Installation-approved **not yet sent to metering**, **or** `meteringWccAfterDiscom` |
| Meter Installation Pending | `meter_installation_pending` |
| Final Step | `mco` |

---

## 6. Final Step from Meter Installation Pending

Admin **To Final Step** uses `forceAdvanceToMco` / MCO routes.

Backend must allow:

```text
meter_installation_pending → mco
```

Set `mcoAt` / `mco_at`. Return updated statuses on GET.

If action-based `send_to_mco` only allows `metering_approved`, either:

1. Extend allow-list to include `meter_installation_pending`, or  
2. Accept admin force/status PATCH to `mco` from `meter_installation_pending` (no `WF_003`).

---

## 7. Backend QA checklist

- [ ] `PATCH` flag `meteringWccAfterDiscom: true` from `metering_approved` → **200**; GET echoes flag
- [ ] Admin WCC Pending shows row after refresh (no localStorage)
- [ ] `PATCH` `meter_installation_pending` from post-Discom WCC → **200**; flag cleared on GET
- [ ] Idempotent re-PATCH `meter_installation_pending` → **200**
- [ ] Entry WCC save still → `pending_metering`
- [ ] `meter_installation_pending` → `mco` works (no false `WF_003`)
- [ ] Partial installation (`installer_partial_approved`) cannot set post-Discom WCC flag

---

## Frontend references

- `app/dashboard/admin/page.tsx` — `moveAdminMeteringFromDiscomToWcc`, `saveAdminWccMeteringDetails`, `setAdminMeteringStage`, Meter Pending table columns
- `lib/api.ts` — `api.admin.quotations.setMeteringWccAfterDiscom`, `updateOperationalStatus`
- Living doc: `BACKEND_CHANGES_REQUIRED.md` **§L.2**, **§L.3**

---

## 8. Admin Metering list — complete row payload (Meter Pending / Discom / WCC / etc.)

**Problem:** Admin → **Metering → Meter Pending** (and sibling tabs) show **N/A** for Address, Remarks, Assigned person when `GET /api/admin/quotations` omits metering/location fields on list rows.

**Frontend reads these columns from each list row** (no per-row detail fetch for the table):

| UI column | Required API fields (camelCase + snake_case) |
|-----------|-----------------------------------------------|
| **Customer** | `id`, `customer.firstName`, `customer.lastName`, `customer.mobile`, `customer.email` |
| **Dealer** | Nested `dealer` `{ firstName, lastName, mobile, username }` **or** `dealerId` + dealer lookup |
| **Amount** | `pricing.subtotal` / `subtotal` / `totalAmount`; for loan/mix: `loanAmount`, `cashAmount`, `paymentPhases[]`, `filePaymentType`, `fileBankName`, `fileBankIfsc`, `bankName`, `bankIfsc` |
| **Date** | `statusUpdatedAt`, `meteringApprovedAt`, `installationScheduledAt`, `createdAt` (any one usable) |
| **Phase** | `products.phase` / `quotationProduct.phase` / flattened `phase` |
| **Address** | `visitLocation` / `visit_location` **or** `customer.address` `{ street, city, state, pincode }` **or** `location` |
| **Discom name** | `discomName` / `discom_name` (from metering details save) |
| **Remarks** | `remarks` / `metering_remarks` / `meteringRemarks` |
| **Assigned person** | `authorizedRepresentative` / `authorized_representative` / `assignedPersonName` / `assigned_person_name` |
| **Status** | `installationStatus` / `meteringStatus` (e.g. `pending_metering`, `metering_approved`, `meter_installation_pending`) |
| **Tab routing** | `meteringWccAfterDiscom` / `metering_wcc_after_discom` |

### Backend must

1. **Return all metering detail fields on list GET** — not only on `GET /api/quotations/{id}`. Values saved via `POST/PATCH` metering details must appear on **`GET /api/admin/quotations`** without a separate detail call.
2. **Return visit/address fields** from quotation + customer join (`visitLocation` from site visit / customer address used elsewhere in Installation tab).
3. **Return nested `dealer`** on admin list (or ensure `dealerId` resolves — frontend also loads dealers, but nested object is preferred).
4. **Return payment fields** for Amount column: `loanAmount`, `paymentPhases`, `filePaymentType`, bank name/IFSC when file login completed.
5. **Echo snake_case mirrors** where DB uses snake_case (`discom_name`, `visit_location`, etc.) — frontend merges both.

### Example list row (minimal metering-complete)

```json
{
  "id": "QT-WAT8JP",
  "customer": {
    "firstName": "Mamta",
    "lastName": "kumari",
    "mobile": "9876543210",
    "address": { "street": "12 Main Rd", "city": "Jaipur", "state": "Rajasthan", "pincode": "302001" }
  },
  "dealer": { "firstName": "Sunil", "lastName": "Choudhary", "mobile": "9988776655" },
  "pricing": { "subtotal": 195000 },
  "loanAmount": 150000,
  "filePaymentType": "loan",
  "fileBankName": "State Bank of India",
  "fileBankIfsc": "SBIN0032365",
  "paymentPhases": [{ "phaseNumber": 2, "amount": 45000 }],
  "visitLocation": "12 Main Rd, Jaipur",
  "discomName": "AEN OM KALWAR",
  "remarks": "Meter pending at discom",
  "authorizedRepresentative": "Ramesh Kumar",
  "installationStatus": "pending_metering",
  "meteringStatus": "pending_metering",
  "statusUpdatedAt": "2026-07-04T10:00:00.000Z",
  "products": { "phase": "1-Phase" }
}
```

### QA

- [ ] Save metering details (Discom + Assigned person + Remarks) → refresh Admin Metering → columns populated (not N/A)
- [ ] Rows with visit location show Address without opening Details modal
- [ ] Loan/mix rows show loan amount + I2 + bank line in Amount column
- [ ] All Metering sub-tabs (Pending, Discom, WCC, Meter Installation Pending) use same list fields
