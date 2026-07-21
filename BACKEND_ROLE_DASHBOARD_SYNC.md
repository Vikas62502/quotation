# Backend handoff — Admin/Accounts updates must appear in individual role logins (Jul 2026)

**Goal:** When the **admin panel** or **Account Management** updates Installation, Metering, Final Confirmation (Baldev), or Accounts/Payments, the change must show up in the matching **individual role login** dashboard — on **any device**.

Roles / logins:
- Installer / Installation team → `app/dashboard/installer/page.tsx`
- Metering → `app/dashboard/metering/page.tsx`
- Baldev / Final confirmation → `app/dashboard/baldev/page.tsx`
- Account Management → `app/dashboard/account-management/page.tsx`

---

## Root cause (why it doesn't sync today)

1. **Device-local gate.** Account Management "Send to Installer" is written to browser `localStorage["installerReleaseMap"]` and only *best-effort* to the API. Installer/metering dashboards hide a quotation unless a release flag is present. On a **different device** (real individual login), that localStorage is empty → row never appears — unless the **backend persisted** `installationReadyForInstaller` / `installationReleasedAt`.

2. **Silent endpoint fallbacks.** Admin/AM stage writes iterate candidate endpoints and treat `404/405/501` as "try next", then return without a hard error. If **no** backend route exists, the UI shows success but **nothing persists**, so individual dashboards (which re-fetch from API) never reflect it.

3. **Field divergence.** Individual dashboards read specific fields. If admin writes a different field (or only one of them), the role queue misses it. Backend must keep the fields below **in sync** on every transition.

The frontend already reads **all** the field name variants below (camelCase + snake_case). Backend just needs to **persist** them and **return** them on the role list endpoints.

---

## Canonical fields (persist + return on every quotation)

Return these on **all** quotation reads: `GET /quotations`, `GET /quotations/:id`, `GET /admin/quotations`, `GET /installer/quotations` (queue), `GET /metering/*`, and any baldev list.

| Field (return camelCase; snake_case also accepted) | Meaning |
|---|---|
| `status` | `approved` etc. (admin approval) |
| `paymentStatus` | `pending` \| `partial` \| `completed` |
| `remaining` / `remainingAmount` | payment remaining (0 after settle) |
| `discountAmount` | INR discount incl. final settlement |
| `installationReadyForInstaller` (bool) | Account Management released to installer |
| `installationReleasedAt` (ISO) | when released |
| `installationStatus` | installation workflow stage (see values) |
| `installerApprovedAt` (ISO) | installer completed/approved |
| `installationScheduledDate` (YYYY-MM-DD) | planned install date |
| `installationTeam` / assignment fields | assigned team |
| `meteringStage` / `meteringStatus` | metering workflow stage (see values) |
| `mcoStatus` / `mcoAt` | MCO stage |
| `fileLoginStatus` | `already_login` \| `login_now` |
| `installments` / `paymentPhases` | installment rows |
| `subsidyCheques` | AM subsidy cheque audit (JSON) |

### Stage value vocab (must be consistent across roles)

`installationStatus`:
```
pending_installer → installer_in_progress → installer_partial_approved
→ installer_approved → pending_metering → metering_in_progress
→ metering_approved → meter_installation_pending → mco
→ pending_baldev → baldev_approved → completed
```

`meteringStage` / `meteringStatus`:
```
pending_metering → metering_in_progress → metering_approved
→ meter_installation_pending → mco
```

---

## Per-role requirements

### A) Installer / Installation login

**Frontend reads:** `installationStatus`, `installationReadyForInstaller`, `installationReleasedAt`, `installerApprovedAt`; queue via `GET /installer/quotations` (fallbacks `/installer/queue`, `/quotations`).

**Visibility rule (frontend):** row shows only if `isQuotationSentToInstaller(q)` is true — satisfied by **any** of:
`installationReadyForInstaller | installation_ready_for_installer | readyForInstallation | releaseToInstaller | installationReleasedAt`.

**Backend must:**
1. Persist the release when Account Management calls **`PATCH /quotations/:id/installation-release`** (fallbacks tried: `/installation/ready`, `/payment-details`) with:
   ```json
   { "installationReadyForInstaller": true, "installationReleasedAt": "2026-07-21T…Z" }
   ```
   Implement **at least one** of these routes for real (not 404) so it persists server-side, **not** just the AM browser.
2. `GET /installer/quotations` must return every quotation where `installationReadyForInstaller = true` (or released), regardless of which device/user released it.
3. Persist installer completion (`installer_approved` + `installerApprovedAt`) when installer uploads completion docs, and reflect it in `GET /admin/quotations` and `GET /installer/quotations`.

### B) Metering login

**Frontend reads:** `meteringStage/metering_status/mcoStatus` (and `installationStatus` as secondary). Fetch: `GET /installer/quotations?status=pending_installer|approved`, then `GET /quotations?status=approved`.

**Backend must:**
1. When admin **Send to Metering** (`sendQuotationToMetering` → sets `pending_metering`; also `PATCH /admin/quotations/:id/installation-status` / `/workflow-status`), persist **both** `installationStatus = "pending_metering"` **and** `meteringStatus = "pending_metering"` so the metering queue sees it.
2. When admin runs metering actions (`PATCH /metering/quotations/:id/status` action `start|approve|mark_completed|move_back`, `POST /metering/quotations/:id/details`, `/mco-documents`), persist the resulting `meteringStage` and echo it on GET.
3. Metering login queue must return quotations where `meteringStage ∈ {pending_metering, metering_in_progress, metering_approved, meter_installation_pending, mco}` for **any** device. Ensure role `metering` is authorized on `/metering/*` and on `GET /quotations?status=approved`.
4. On metering completion, set `installationStatus = "pending_baldev"` (see C) so Baldev sees it.

### C) Baldev / Final confirmation login

**Frontend reads:** **only** `installationStatus`. Queue = `installationStatus ∈ {installer_approved, pending_baldev, installer_in_progress}`; final-closed = `{baldev_approved, completed}`. Fetch: `GET /quotations?status=approved`.

**Backend must:**
1. When metering completes (MCO done), set **`installationStatus = "pending_baldev"`** on the quotation (in addition to metering fields). Without this, Baldev never sees the row.
2. When admin/baldev uploads final confirmation docs (`uploadFinalConfirmationDocuments`), set `installationStatus = "baldev_approved"` (or `completed`) and persist.
3. `GET /quotations?status=approved` must return `installationStatus` for role `baldev`; authorize role `baldev` on that endpoint.

### D) Account Management login

**Frontend reads:** `GET /quotations?status=approved`; fields `paymentStatus`, `remaining/remainingAmount`, `discountAmount`, `installments/paymentPhases`, `subsidyCheques`, `installationReadyForInstaller`, `fileLoginStatus`.

**Backend must:**
1. Persist and return `paymentStatus`, `remaining`, `discountAmount`, `installments`, `subsidyCheques` (see `BACKEND_FINAL_SETTLEMENT.md` + §AB in `BACKEND_CHANGES_REQUIRED.md`).
2. Persist `subsidyCheques` JSON on `PATCH /quotations/:id/payment-details` and echo on GET (today it lives in `localStorage["quotationSubsidyCheques"]` if backend drops it).
3. Return `installationReadyForInstaller` / `installationReleasedAt` so the AM "Sent to installer" badge is correct across devices.

---

## Endpoints that must exist for real (no silent 404)

The client swallows `404/405/501` and moves on, so these currently can no-op. Implement at least the **first** listed for each:

| Action | Endpoint(s) tried (implement one) |
|---|---|
| Release to installer | `PATCH /quotations/:id/installation-release` · `/installation/ready` · `/payment-details` |
| Send to metering | `PATCH /admin/quotations/:id/installation-status` · `/workflow-status` · `/quotations/:id/status` · `/quotations/:id/metering-status` |
| Metering action | `PATCH /metering/quotations/:id/status` · `/decision` · `/quotations/:id/metering-status` |
| Metering details | `POST /metering/quotations/:id/details` · `/quotations/:id/metering-details` |
| MCO docs | `POST /metering/quotations/:id/mco-documents` · `/documents` |
| Final confirmation docs | admin/baldev upload routes (`uploadFinalConfirmationDocuments`) |
| Payment / settlement | `PATCH /quotations/:id/payment-details` · `POST /quotations/:id/final-settlement` · `PATCH /quotations/:id/pricing` |

**Recommendation:** on success, return the **updated quotation** (with all canonical fields) so the frontend can trust the response instead of re-deriving.

---

## Cross-role field-sync matrix (write these together)

| Transition (who) | Set on quotation |
|---|---|
| AM: Send to Installer | `installationReadyForInstaller=true`, `installationReleasedAt=now`, `installationStatus=pending_installer` (if unset) |
| Installer: complete | `installationStatus=installer_approved`, `installerApprovedAt=now` |
| Admin: Send to Metering | `installationStatus=pending_metering` **and** `meteringStatus=pending_metering` |
| Metering: start | `meteringStatus=metering_in_progress` |
| Metering: approve | `meteringStatus=metering_approved` |
| Metering: WCC after discom | `meteringStatus=meter_installation_pending` |
| Metering: MCO / complete | `mcoStatus=mco` (or `meteringStatus=mco`) **and** `installationStatus=pending_baldev` |
| Baldev: final confirm | `installationStatus=baldev_approved` (or `completed`) |
| AM: payment / settlement | `paymentStatus`, `remaining`, `discountAmount`, `installments`, `subsidyCheques` |

---

## Authorization

Each role's JWT must be allowed to **read** the quotations it needs:

| Role | Must be authorized on |
|---|---|
| `installer` / `installation-team` | `GET /installer/quotations`, `GET /quotations` (approved) |
| `metering` | `GET /metering/*`, `GET /quotations?status=approved`, `PATCH /metering/*` |
| `baldev` | `GET /quotations?status=approved` |
| `account-management` | `GET /quotations?status=approved`, `PATCH /quotations/:id/pricing|discount|payment-details|installation-release` |

---

## Test plan (multi-device is the point)

1. **Device 1 (Account Management login):** open a customer → **Send to Installer**.
2. **Device 2 (Installer login):** refresh → customer appears in installer queue. ✅ (fails today if release only hit localStorage)
3. Installer completes → **Device 3 (Admin):** shows `installer_approved`.
4. Admin: **Send to Metering** → **Device 4 (Metering login):** customer appears in metering pending.
5. Metering: approve → WCC → MCO complete.
6. **Device 5 (Baldev login):** customer appears in Final confirmation queue (`installationStatus=pending_baldev`). ✅ (fails today if metering completion didn't set `installationStatus`)
7. Baldev: final confirm → Admin shows `completed`.
8. AM: apply final settlement → all logins show `paymentStatus=completed`, `remaining=0`, discount `d`.
9. Repeat each step logging in on a **fresh browser** (empty localStorage) to prove server-side persistence.

---

## Checklist

- [ ] `installation-release` persists server-side (real route, not 404) + returned on GET
- [ ] `GET /installer/quotations` returns all released rows regardless of device
- [ ] Send to Metering sets `installationStatus` **and** `meteringStatus`
- [ ] Metering completion sets `installationStatus=pending_baldev`
- [ ] Baldev queue driven by persisted `installationStatus`
- [ ] `subsidyCheques`, `installments`, `paymentStatus`, `remaining`, `discountAmount` persisted + returned
- [ ] All role JWTs authorized on the read/write endpoints above
- [ ] Stage-write endpoints return the updated quotation with canonical fields
- [ ] Verified on fresh-browser logins per role (no localStorage assist)

---

## Frontend references

| Area | File |
|---|---|
| Release/visibility helpers | `lib/operational-install-queue.ts` (`isQuotationSentToInstaller`, `getInstallationWorkflowStatus`, `getMeteringWorkflowStage`) |
| Installer dashboard | `app/dashboard/installer/page.tsx`, `lib/load-operational-installation-rows.ts` |
| Metering dashboard | `app/dashboard/metering/page.tsx` |
| Baldev dashboard | `app/dashboard/baldev/page.tsx` |
| Account Management | `app/dashboard/account-management/page.tsx` |
| API client | `lib/api.ts` (`quotations.*`, `installer.*`, `metering.*`, `admin.quotations.*`) |
| Related docs | `BACKEND_FINAL_SETTLEMENT.md`, `BACKEND_CHANGES_REQUIRED.md` (§AB), `BACKEND_METERING_DISCOM_WCC_METER_INSTALL.md`, `BACKEND_INSTALLATION_RELEASE.md` |
