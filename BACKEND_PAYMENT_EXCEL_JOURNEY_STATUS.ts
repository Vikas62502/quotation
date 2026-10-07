// @ts-nocheck
/**
 * =============================================================================
 * BACKEND REFERENCE — Account Management Office Inside **Download Excel**
 * =============================================================================
 *
 * Frontend (Oct 2026):
 *   - `app/dashboard/account-management/page.tsx` → Office Inside → **Download Excel**
 *   - Client-side CSV (`downloadFilteredPaymentsExcel`) — **no new download endpoint**
 *   - `lib/customer-journey.ts` → `getJourneyFileStatusStages`, `formatJourneyStageStatusLabel`
 *
 * -----------------------------------------------------------------------------
 * What changed (Oct 2026) — GET list payload, not a new route
 * -----------------------------------------------------------------------------
 *
 * Excel now needs **dealer name + dealer mobile** on every approved row.
 * If `dealer` is omitted / nested without `mobile`, those CSV columns are blank
 * even though the payment card shows "Dealer: … • …".
 *
 * Installation / Metering Excel cells:
 *   - stage **completed / approved** → **date only** (en-IN, e.g. 3/10/2026)
 *   - otherwise → status text only (`Pending` | `In Progress`)
 *   - do not concatenate "Approved · date"
 *
 * Excel **no longer** exports (keep returning the fields for the UI; just not CSV):
 *   Payment Status, File login date, File login status, Installment Count,
 *   Admin Approval Status, Final Confirmation Status, File Status.
 *
 * -----------------------------------------------------------------------------
 * Endpoint (existing)
 * -----------------------------------------------------------------------------
 *
 *   GET /api/quotations?status=approved&page=1&limit=1000
 *   GET /api/admin/quotations   (admin JWT — same nested `dealer` + dates)
 *
 * Auth: `account-management`, `admin`
 * Must return only `status = approved` rows for account-management role.
 *
 * -----------------------------------------------------------------------------
 * Excel columns the SPA writes (in order)
 * -----------------------------------------------------------------------------
 *
 * Quotation ID, Customer Name, Customer Mobile, **Dealer Name**, **Dealer Mobile**,
 * Payment Type, Bank & IFSC, Approve date, Subtotal, [Cost of Site, Profit],
 * Loan Amount, Cash Amount, Discount, Paid Amount, Loan Paid, Cash Paid,
 * Remaining Amount, Loan Remaining, Cash Remaining,
 * **Installation Status**, **Metering Status**
 *
 * -----------------------------------------------------------------------------
 * Required fields on each approved list row
 * -----------------------------------------------------------------------------
 *
 * Nested dealer (MUST be present — this is why Excel dealer columns were empty):
 *
 * {
 *   "dealerId": "…",
 *   "dealer_id": "…",
 *   "dealer": {
 *     "id": "…",
 *     "firstName": "Harshita",
 *     "first_name": "Harshita",
 *     "lastName": "naruka",
 *     "last_name": "naruka",
 *     "mobile": "9251005606",
 *     "phone": "9251005606",
 *     "username": "…",
 *     "email": "…"
 *   }
 * }
 *
 * Echo camelCase + snake_case. SPA reads `dealer.firstName` / `dealer.lastName` /
 * `dealer.mobile` (fallback `dealer.phone`). Never omit `dealer` when dealerId is set.
 *
 * Workflow + dates for Installation / Metering Excel cells:
 *
 * | Field (camelCase) | snake_case aliases | Purpose |
 * |-------------------|--------------------|---------|
 * | `status` | — | Approve date / admin gate |
 * | `statusApprovedAt` | `status_approved_at`, `approved_at` | Approve date column |
 * | `installationStatus` | `installation_status` | Pending / In Progress / Approved |
 * | `installerApprovedAt` | `installer_approved_at` | Installation Excel **date** when approved |
 * | `installationApprovedAt` | `installation_approved_at` | Alias |
 * | `installationCompletedAt` | `installation_completed_at` | Alias |
 * | `meteringStage` | `metering_stage` | Metering workflow |
 * | `meteringStatus` | `metering_status` | Alias |
 * | `mcoStatus` | `mco_status` | Final Step / MCO → metering Completed |
 * | `meteringWccAfterDiscom` | `metering_wcc_after_discom` | Metering In Progress |
 * | `meteringApprovedAt` | `metering_approved_at` | Metering Excel **date** |
 * | `meteringCompletedAt` | `metering_completed_at` | Alias |
 * | `mcoAt` | `mco_at` | Preferred date when metering is Completed |
 *
 * **Do not** omit `installationStatus` on account-management list GET — without it
 * Installation Status exports as **Pending** even when installer UI shows Approved.
 *
 * Persist installer / metering approved timestamps on the same write that sets
 * `installer_approved` / `mco`. Empty date + completed status → SPA falls back to
 * the word "Approved" / "Completed" instead of a date.
 *
 * -----------------------------------------------------------------------------
 * Metering FILE STATUS (Payment Management + dashboards) — Jul 2026
 * -----------------------------------------------------------------------------
 *
 * Align labels with Admin → Metering tabs. Frontend: `resolveMeteringJourneyStatus`
 * in `lib/customer-journey.ts`.
 *
 * | Admin Metering tab              | Persist / return                          | FILE STATUS → Metering |
 * |---------------------------------|-------------------------------------------|-------------------------|
 * | Meter Pending                   | `pending_metering`                        | **Pending**             |
 * | Meter in Discom                 | `metering_approved` (or stage `approved`) | **In Progress**         |
 * | WCC Pending                     | `meteringWccAfterDiscom: true`            | **In Progress**         |
 * | Meter Installation Pending      | `meter_installation_pending`              | **In Progress**         |
 * | Final Step                      | `mco`                                     | **Completed**           |
 * | After Final Step (Baldev+)      | `pending_baldev` / `baldev_approved` / `completed` | **Completed**  |
 * | Not sent to metering yet        | (no metering stage)                       | **Pending**             |
 *
 * Labels for Excel / UI: `Pending` | `In Progress` | `Completed`
 * (`formatJourneyStageStatusLabel`).
 *
 * Persist these on every transition and return them on:
 *   GET /api/quotations?status=approved
 *   GET /api/admin/quotations
 *   GET /api/metering/quotations
 *
 * -----------------------------------------------------------------------------
 * Optional — pre-computed journey block (recommended for reporting / future server export)
 * -----------------------------------------------------------------------------
 *
 * Return on each row (or nested under `quotation`):
 *
 * {
 *   "journeyStageProgress": {
 *     "adminApproval": "completed" | "pending" | "in_progress",
 *     "installation": "completed" | "pending" | "in_progress",
 *     "metering": "completed" | "pending" | "in_progress",
 *     "finalConfirmation": "completed" | "pending" | "in_progress"
 *   },
 *   "fileStatus": "Pending Metering",
 *   "journeyHolder": "Metering"
 * }
 *
 * Frontend **today** computes these client-side from raw workflow fields; pre-computed
 * values are optional but must match logic below if added.
 *
 * -----------------------------------------------------------------------------
 * Journey logic (must match `lib/customer-journey.ts`)
 * -----------------------------------------------------------------------------
 */

type JourneyStageStatus = "completed" | "pending" | "in_progress"

function getInstallationWorkflowStatus(q: Record<string, unknown>): string {
  return String(q.installationStatus || q.installation_status || "").toLowerCase()
}

function getMeteringWorkflowRaw(q: Record<string, unknown>): string {
  return String(
    q.meteringStage ||
      q.metering_stage ||
      q.meteringStatus ||
      q.metering_status ||
      q.mcoStatus ||
      q.mco_status ||
      "",
  ).toLowerCase()
}

function isInstallationCompleteForMetering(q: Record<string, unknown>): boolean {
  const install = getInstallationWorkflowStatus(q)
  return (
    install === "installer_approved" ||
    install === "completed" ||
    install === "pending_baldev" ||
    install === "baldev_approved"
  )
}

export function formatJourneyStageStatusLabel(
  status: JourneyStageStatus,
  stage?: "adminApproval" | "installation" | "metering" | "finalConfirmation",
): string {
  if (status === "completed") {
    if (stage === "installation") return "Approved"
    return "Completed"
  }
  if (status === "in_progress") return "In Progress"
  return "Pending"
}

export function getJourneyStageProgress(q: Record<string, unknown>) {
  const approvalStatus = String(q.status || "pending").toLowerCase()
  const installStatus = getInstallationWorkflowStatus(q)
  const meteringRaw = getMeteringWorkflowRaw(q)
  const meteringStage =
    meteringRaw ||
    (["pending_metering", "metering_in_progress", "metering_approved", "mco"].includes(installStatus)
      ? installStatus
      : "")

  const adminApproval: JourneyStageStatus =
    approvalStatus === "approved" ? "completed" : "pending"

  let installation: JourneyStageStatus = "pending"
  let metering: JourneyStageStatus = "pending"
  let finalConfirmation: JourneyStageStatus = "pending"

  // Installation FILE STATUS — same buckets as Admin → Installation tabs:
  // | Pending Installation | Pending      | pending_installer, installer_in_progress, unset |
  // | Partial Approved     | In Progress  | installer_partial_approved / partial flag       |
  // | Approved Installation | Approved      | installer_approved (+ photos / installerApprovedAt) |
  const isPartial =
    installStatus === "installer_partial_approved" ||
    installStatus === "partial_approved" ||
    q.installationPartialApproved === true ||
    q.installation_partial_approved === true ||
    q.installationPartialApproved === 1 ||
    q.installation_partial_approved === "true"
  const isApprovedInstall =
    !isPartial &&
    (isInstallationCompleteForMetering(q) ||
      Boolean(q.installerApprovedAt || q.installer_approved_at))

  if (isPartial) {
    installation = "in_progress"
  } else if (isApprovedInstall) {
    installation = "completed" // UI label for installation stage = "Approved"
  }
  // else Pending (includes installer_in_progress — still Pending Installation tab)

  // Metering FILE STATUS (align Admin Metering tabs):
  // Final Step (mco) → Completed
  // Meter Pending (pending_metering) → Pending
  // Meter in Discom / WCC / Meter Installation → In Progress
  const wccFlag = q.meteringWccAfterDiscom ?? q.metering_wcc_after_discom
  const isWcc =
    wccFlag === true || wccFlag === 1 || wccFlag === "true" || wccFlag === "1"
  if (
    ["pending_baldev", "baldev_approved", "completed"].includes(installStatus) ||
    ["pending_baldev", "baldev_approved", "completed", "mco"].includes(meteringStage) ||
    meteringStage.includes("mco")
  ) {
    metering = "completed"
  } else if (
    isWcc ||
    ["metering_approved", "metering_in_progress", "meter_installation_pending", "meter_install_pending"].includes(
      meteringStage,
    ) ||
    meteringStage.includes("meter_install")
  ) {
    metering = "in_progress"
  } else if (meteringStage === "pending_metering") {
    metering = "pending"
  } else {
    metering = "pending"
  }

  if (installStatus === "pending_baldev" || meteringStage === "pending_baldev") {
    finalConfirmation = "in_progress"
  }
  if (
    installStatus === "baldev_approved" ||
    installStatus === "completed" ||
    meteringStage === "baldev_approved"
  ) {
    finalConfirmation = "completed"
  }

  return { adminApproval, installation, metering, finalConfirmation }
}

export function getJourneyHoldInfo(q: Record<string, unknown>) {
  const opsStatus = getInstallationWorkflowStatus(q)
  const approvalStatus = String(q.status || "pending").toLowerCase()

  if (approvalStatus !== "approved") {
    return { holder: "Admin Approval", stageLabel: "Pending Admin Approval" }
  }
  if (opsStatus === "pending_installer") {
    return { holder: "Installer", stageLabel: "Pending Installer" }
  }
  if (opsStatus === "installer_in_progress") {
    return { holder: "Installer", stageLabel: "Installer In Progress" }
  }
  if (opsStatus === "installer_approved") {
    return { holder: "Metering", stageLabel: "Pending Metering" }
  }
  if (opsStatus === "pending_metering" || opsStatus === "metering_in_progress") {
    return { holder: "Metering", stageLabel: "Metering Processing" }
  }
  if (opsStatus === "metering_approved") {
    return { holder: "Metering", stageLabel: "Metering Approved" }
  }
  if (opsStatus === "mco") {
    return { holder: "Metering", stageLabel: "MCO Docs Pending" }
  }
  if (opsStatus === "pending_baldev") {
    return { holder: "Baldev", stageLabel: "Pending Final Confirmation" }
  }
  if (opsStatus === "baldev_approved" || opsStatus === "completed") {
    return { holder: "Completed", stageLabel: "Final Approved" }
  }
  return { holder: "Operations", stageLabel: "Workflow Pending" }
}

/**
 * Example: build Excel journey cells for one quotation row
 */
export function buildPaymentExcelJourneyCells(q: Record<string, unknown>) {
  const progress = getJourneyStageProgress(q)
  const hold = getJourneyHoldInfo(q)
  const installments = q.installments || q.paymentPhases || q.payment_phases || []
  const count = Array.isArray(installments) ? installments.length : 0
  return {
    installmentCount: count,
    adminApprovalStatus: formatJourneyStageStatusLabel(progress.adminApproval),
    installationStatus: formatJourneyStageStatusLabel(progress.installation, "installation"),
    meteringStatus: formatJourneyStageStatusLabel(progress.metering, "metering"),
    finalConfirmationStatus: formatJourneyStageStatusLabel(progress.finalConfirmation, "finalConfirmation"),
    fileStatus: hold.stageLabel,
  }
}

/**
 * -----------------------------------------------------------------------------
 * installation_status enum (workflow — keep in sync with installer/metering PATCH)
 * -----------------------------------------------------------------------------
 *
 *   pending_installer
 *   installer_in_progress
 *   installer_partial_approved   // Partial Approved tab → FILE STATUS In Progress
 *   installer_approved
 *   pending_metering
 *   metering_in_progress
 *   metering_approved
 *   mco
 *   pending_baldev
 *   baldiv_approved   (typo guard: also accept baldev_approved)
 *   baldev_approved
 *   completed
 *
 * When metering is stored separately, set meteringStage / metering_status instead of
 * overloading installation_status after installer_approved.
 *
 * -----------------------------------------------------------------------------
 * Sequelize / SQL — include on GET /quotations list serializer
 * -----------------------------------------------------------------------------
 *
 *   attributes: [
 *     'id', 'status', 'installation_status', 'metering_stage', 'metering_status',
 *     'mco_status', 'metering_wcc_after_discom',
 *     'installation_ready_for_installer', 'installation_released_at',
 *     'installation_partial_approved', 'installer_approved_at',
 *     'installation_approved_at', 'installation_completed_at',
 *     'metering_approved_at', 'metering_completed_at', 'mco_at',
 *     'status_approved_at', 'file_login_at', 'file_login_status',
 *     'dealer_id',
 *   ],
 *   include: [
 *     { model: QuotationInstallment, as: 'installments' },
 *     { model: Customer, as: 'customer' },
 *     { model: Dealer, as: 'dealer', attributes: ['id', 'first_name', 'last_name', 'mobile', 'phone', 'username', 'email'] },
 *   ]
 *
 * Serializer MUST nest dealer (do not send dealerId alone):
 *
 * function publicDealer(d) {
 *   if (!d) return null
 *   const firstName = String(d.firstName || d.first_name || "")
 *   const lastName = String(d.lastName || d.last_name || "")
 *   const mobile = String(d.mobile || d.phone || "")
 *   return {
 *     id: d.id,
 *     firstName, first_name: firstName,
 *     lastName, last_name: lastName,
 *     mobile, phone: mobile,
 *     username: d.username || "",
 *     email: d.email || "",
 *   }
 * }
 *
 * -----------------------------------------------------------------------------
 * Checklist
 * -----------------------------------------------------------------------------
 *
 * - [ ] GET /api/quotations?status=approved **nests `dealer`** with firstName, lastName, **mobile**
 * - [ ] GET /api/admin/quotations same nested dealer
 * - [ ] GET /api/quotations?status=approved returns installationStatus on every row
 * - [ ] installer_approved_at set when Complete & Mark as Approved (Excel Installation date)
 * - [ ] mco_at / metering_approved_at set when metering reaches Completed (Excel Metering date)
 * - [ ] installation_ready_for_installer + installation_released_at on every released row
 * - [ ] installer_partial_approved / installation_partial_approved persisted for Partial Approved
 * - [ ] Installation: Pending Install→Pending; Partial→In Progress; Approved Install→date (or Approved)
 * - [ ] Account filter Installation·Pending count ≈ Admin Pending Installation (same Send-to-Installer set)
 * - [ ] meteringStage / meteringStatus returned when quotation is in metering pipeline
 * - [ ] meteringWccAfterDiscom returned for WCC Pending rows
 * - [ ] Metering: Final Step=mco→date/Completed; Meter Pending→Pending; Discom/WCC/Install→In Progress
 * - [ ] PATCH installation-release / installer / metering / baldev updates reflected on next GET
 *
 * -----------------------------------------------------------------------------
 * QA
 * -----------------------------------------------------------------------------
 *
 * 1. Download Excel → **Dealer Name** and **Dealer Mobile** match the payment card.
 * 2. Send to Installer → Installation Status = **Pending**.
 * 3. Partial Approved → Installation Status = **In Progress**.
 * 4. installer_approved → Installation Status = **date only** (installerApprovedAt), not "Approved · date".
 * 5. pending_metering → Metering Status = **Pending**.
 * 6. metering_approved / WCC / meter_installation_pending → Metering Status = **In Progress**.
 * 7. mco (Final Step) → Metering Status = **date only** (mcoAt / meteringApprovedAt).
 * 8. Excel does **not** include Payment Status, File login, Installment Count, Admin Approval,
 *    Final Confirmation, or File Status (those stay on the live cards).
 * 9. Refresh / other device → dealer + dates unchanged (API fields, not localStorage).
 *
 * Related: BACKEND_CHANGES_REQUIRED.md **§BJ** (and §AC), BACKEND_CHANGES_HANDOFF.md **§56**,
 * BACKEND_INSTALLATION_RELEASE.md, BACKEND_METERING_DISCOM_WCC_METER_INSTALL.md.
 */
