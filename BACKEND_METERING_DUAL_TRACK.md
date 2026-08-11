# Backend handoff — Metering dual track (Meter process + Bank process) — Jul 2026

**Frontend surfaces (same APIs):**
- Admin → Quotations → **Metering**
- `/dashboard/metering` (metering login)
- Installer dashboard → **Metering** tab (`role: installer` / `installation-team`)

**Related existing docs:**
- Meter pipeline stages: `BACKEND_METERING_DISCOM_WCC_METER_INSTALL.md`
- Role sync across devices: `BACKEND_ROLE_DASHBOARD_SYNC.md`
- Send to Metering: `BACKEND_SEND_TO_METERING.ts`

---

## Product UI (two separate tracks)

```
LEFT — Meter process (sequential)
  Meter Pending
    → To Discom
  Meter in Discom
    → To WCC Pending   (only if Installation approved)
  WCC Pending
    → Save WCC → Meter Installation Pending
  Meter Installation Pending
    → To Final Step
  Final Step (mco)
    → To Confirmation (pending_baldev)

RIGHT — Bank process (parallel track, NOT sequential after Final Step)
  Bank Process     ← loan / cash+loan files still in metering, bank not done
  Pending Payment  ← loan / cash+loan files after bank process marked done
```

Bank tabs are a **parallel** queue for payment-type `loan` or `mix` (cash+loan). A row can appear in **both** a Meter tab and a Bank tab at the same time.

---

## Checklist — what backend must deliver

| # | Item | Status if already done |
|---|------|------------------------|
| 1 | Persist + echo statuses: `pending_metering`, `metering_approved`, `meter_installation_pending`, `mco` | See `BACKEND_METERING_DISCOM_WCC_METER_INSTALL.md` |
| 2 | Persist + echo `meteringWccAfterDiscom` / `metering_wcc_after_discom` | Same doc §3 |
| 3 | Allow transitions: Discom → WCC flag → `meter_installation_pending` → `mco` | Same doc §2 / §6 |
| 4 | **NEW** Persist + echo `bankProcessDone` / `bank_process_done` | This doc §B |
| 5 | **NEW** Persist bank details save + optional “move to pending payment” | This doc §B |
| 6 | **NEW** Authorize `installer` (+ optionally `installation-team`) on metering read/write routes used by Installer → Metering | This doc §C |
| 7 | Echo payment type (`loan` / `mix` / `cash`) on every metering list row | This doc §B.3 |

---

## A) Meter process (left) — status map

| UI tab | Backend signal |
|--------|----------------|
| Meter Pending | `installationStatus` / `meteringStatus` ∈ `pending_metering`, `metering_in_progress` and **not** WCC-after-discom |
| Meter in Discom | `metering_approved` and `meteringWccAfterDiscom !== true` |
| WCC Pending | `meteringWccAfterDiscom === true` **or** entry path (installation approved, not yet `pending_metering`) |
| Meter Installation Pending | `meter_installation_pending` |
| Final Step | `mco` (+ `mcoAt` / `mco_at`) |

### Key endpoints (SPA already calls)

| Action | Method / path (fallbacks) |
|--------|---------------------------|
| To Discom | `POST/PATCH` `/metering/quotations/{id}/status` action `approve` (or `forceSetStatus` → `metering_approved`) |
| To WCC Pending | `PATCH` `/admin/quotations/{id}/metering-wcc-after-discom` `{ meteringWccAfterDiscom: true }` |
| To Meter Install | `PATCH` `…/installation-status` (etc.) body `meter_installation_pending` |
| To Final Step | `forceAdvanceToMco` / metering `send_to_mco` |
| Details / MCO docs | `POST` `/metering/quotations/{id}/details`, `…/mco-documents` |
| To Confirmation | metering status `mark_completed` → `pending_baldev` |

Full rules: **`BACKEND_METERING_DISCOM_WCC_METER_INSTALL.md`**.

---

## B) Bank process (right) — **required new work**

### B.1 Persist bank-done flag

| Field | Type | Meaning |
|-------|------|---------|
| `bankProcessDone` / `bank_process_done` | boolean | `false`/absent → **Bank Process** tab; `true` → **Pending Payment** tab |
| `bankProcessDoneAt` / `bank_process_done_at` | timestamp (optional) | When marked done |

```sql
ALTER TABLE quotations
  ADD COLUMN IF NOT EXISTS bank_process_done BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS bank_process_done_at TIMESTAMP NULL;
```

### B.2 Who appears in Bank tabs

Row is bank-eligible when payment type is **loan** or **mix** (cash+loan), **and** it is already in the **meter pipeline** (Meter Pending / Discom / post-Discom WCC / Meter Install / Final Step).

**Do not** put Installation → **Approved** rows into Bank Process until they have entered metering (`pending_metering` / later). Those stay on the meter track under WCC Pending entry only.

| UI tab | Filter |
|--------|--------|
| Bank Process | meter-pipeline **and** payment ∈ `{loan, mix}` **and** `bank_process_done !== true` |
| Pending Payment | meter-pipeline **and** payment ∈ `{loan, mix}` **and** `bank_process_done === true` |

### B.3 Echo payment type on GET

Every admin / metering / installer queue row must include at least one of:

```json
{
  "paymentType": "loan",
  "payment_type": "loan",
  "paymentMode": "loan",
  "payment_mode": "loan"
}
```

Accepted values for bank eligibility: `loan`, `mix` (also tolerate `cash_loan`, `cash+loan`).

Also echo loan/cash amounts used by Admin Metering amount cell if already stored (`loanAmount`, `cashAmount`, etc.).

### B.4 Save bank details + move to Pending Payment

Admin UI saves bank details and can move the row to Pending Payment in one step.

**Preferred endpoint:**

```http
PATCH /api/admin/quotations/{id}/bank-process
Authorization: Bearer <ADMIN_or_INSTALLER_JWT>
Content-Type: application/json

{
  "bankName": "…",
  "bankIfsc": "…",
  "loanAmount": 150000,
  "bankProcessDone": true,
  "bank_process_done": true,
  "moveToPendingPayment": true
}
```

**Fallbacks SPA may also try** (implement at least one):

```http
PATCH /api/admin/quotations/{id}/payment-details
PATCH /api/quotations/{id}/payment-details
PATCH /api/admin/quotations/{id}/installation-status
```

with the same boolean fields in the body.

**On `bankProcessDone: true` / `moveToPendingPayment: true`:**
1. Persist bank fields
2. Set `bank_process_done = true`, `bank_process_done_at = NOW()`
3. Do **not** change metering stage (row stays in whatever Meter tab it was in)
4. Return updated quotation JSON including `bankProcessDone: true`

**Idempotent:** Re-PATCH when already done → **200**.

### B.5 Auth for bank endpoints

| Role | Access |
|------|--------|
| `admin` / `super-admin` | Full |
| `installer` | Read metering queues + write bank-process / metering details (Installer → Metering) |
| `metering` | Meter pipeline + details (existing) |
| `installation-team` | Same as installer if you want field teams to use the Metering tab; otherwise 403 is OK |

---

## C) Installer / metering role access (required for Installer → Metering)

Installer dashboard now mounts the same metering panel. Backend must **not** return `403 AUTH_004` solely because JWT role is `installer`.

### Allow these roles on:

| Area | Routes |
|------|--------|
| Queue read | `GET /installer/quotations`, `GET /installer/queue`, `GET /quotations` (approved / metering statuses) |
| Metering status | `POST/PATCH /metering/quotations/{id}/status`, `/decision`, `/metering-status` |
| Metering details | `POST /metering/quotations/{id}/details` (+ document upload) |
| MCO docs | `POST /metering/quotations/{id}/mco-documents` (aliases) |
| WCC flag | `PATCH /admin/quotations/{id}/metering-wcc-after-discom` **or** equivalent body on status PATCH |
| Ops status | `PATCH` installation-status / workflow-status / metering-status |
| Force MCO | existing force-advance routes |
| Bank process | §B.4 |

Optional dedicated aliases (SPA already falls through):

```text
PATCH|POST /api/installer/quotations/{id}/send-to-metering
PATCH|POST /api/installer/quotations/{id}/metering-handoff
```

---

## D) GET response shape (minimum for tabs after refresh)

```json
{
  "id": "…",
  "installationStatus": "metering_approved",
  "installation_status": "metering_approved",
  "meteringStatus": "metering_approved",
  "metering_status": "metering_approved",
  "meteringApprovedAt": "2026-07-25T10:00:00.000Z",
  "meteringWccAfterDiscom": false,
  "metering_wcc_after_discom": false,
  "mcoAt": null,
  "paymentType": "loan",
  "payment_type": "loan",
  "bankProcessDone": false,
  "bank_process_done": false,
  "bankName": "…",
  "bankIfsc": "…",
  "discomName": "…",
  "remarks": "…",
  "authorizedRepresentative": "…"
}
```

**No `localStorage` dependency** for Discom→WCC or Bank Process tabs after refresh — all of the above must come from the API.

---

## E) Transition diagram

```
                    ┌─────────────────────────────────────────────┐
                    │           METER PROCESS (left)              │
pending_metering ──► metering_approved ──► [WCC flag] ──►        │
                         │                      │                 │
                         │                      ▼                 │
                         │         meter_installation_pending     │
                         │                      │                 │
                         │                      ▼                 │
                         └──────────────────── mco ──► pending_baldev
                                          ▲
                                          │
┌─────────────────────────────────────────┴──────────────────────┐
│           BANK PROCESS (right) — parallel                       │
│  paymentType ∈ {loan, mix}                                      │
│  bank_process_done=false  → Bank Process tab                    │
│  bank_process_done=true   → Pending Payment tab                 │
│  (does not move metering stage)                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## F) QA

1. Admin → Metering: left group shows 5 meter tabs; right group shows Bank Process + Pending Payment with different outline.
2. Loan quotation in Meter Pending also appears under Bank Process.
3. Save bank + move → disappears from Bank Process, appears under Pending Payment; still visible in its Meter tab.
4. Refresh browser → same tabs (flags persisted).
5. Meter in Discom → To WCC → WCC Pending count +1; GET returns `meteringWccAfterDiscom: true`.
6. WCC save (post-Discom) → `meter_installation_pending`, flag cleared.
7. Meter Install → Final Step → `mco` + `mcoAt`.
8. Installer login → Metering tab: queue loads (no AUTH_004); can open Details / move stages if granted (§C).
9. Cash-only quotations never appear in Bank Process / Pending Payment.

---

## G) Related frontend

| File | Role |
|------|------|
| `app/dashboard/admin/page.tsx` | Admin Metering dual-track tabs + full WCC/bank modals |
| `components/metering/metering-workflow-panel.tsx` | Shared panel (metering login + installer) |
| `lib/api.ts` | `api.metering.*`, `setMeteringWccAfterDiscom`, `forceAdvanceToMco`, ops status PATCH |
| `BACKEND_METERING_DISCOM_WCC_METER_INSTALL.md` | Meter pipeline detail |
