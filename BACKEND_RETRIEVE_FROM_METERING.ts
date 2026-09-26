// @ts-nocheck
/**
 * =============================================================================
 * BACKEND — Admin **Retrieve from Metering** (Meter Pending → Installation approved)
 * =============================================================================
 *
 * Frontend:
 *   - Admin → Quotations → **Retrieve** (when in early metering)
 *   - Admin → Metering → Meter Pending → **Retrieve**
 *   - `lib/api.ts` → `retrieveQuotationFromMetering`
 *   - `lib/operational-install-queue.ts` → `canRetrieveFromMeteringPipeline`,
 *     `markAdminMeteringRetrieved` (browser overlay only — GET must persist)
 *
 * Product:
 *   Pull a quotation back from Meter Pending before Discom / WCC / MCO so admin can
 *   fix installation or re-send to Metering later.
 *
 * Live bug (HANDOFF §53): Retrieve 200 / local hide, then GET still
 * `metering_status: pending_metering` → row bounces back to Meter Pending.
 *
 * NOT the same as:
 *   - Admin Installation **Revert** (approved → pending_installer) — see
 *     `BACKEND_INSTALLATION_REVERT.ts`
 *   - **Retrieve from Installation** (undo Send to Installer) — see
 *     `BACKEND_RETRIEVE_FROM_INSTALLATION.ts`
 *
 * =============================================================================
 */

const EARLY_METERING = new Set([
  "pending_metering",
  "metering_in_progress",
  "processing",
  "installer_approved",
  "",
])
const LATE_METERING = new Set([
  "metering_approved",
  "meter_installation_pending",
  "meter_install",
  "meter_install_pending",
  "mco",
  "pending_baldev",
  "baldev_approved",
  "completed",
])

function norm(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
}

function currentStages(q) {
  const install = norm(q.installation_status || q.installationStatus)
  const metering = norm(q.metering_status || q.meteringStatus || q.metering_stage || q.meteringStage)
  return { install, metering }
}

function requireAdmin(req, res) {
  const user = req.user || req.dealer
  if (!user || user.role !== "admin") {
    res.status(403).json({ success: false, error: { code: "AUTH_004", message: "Forbidden" } })
    return null
  }
  return user
}

/**
 * Apply retrieve-from-metering: Meter Pending → installer_approved.
 * Keep Payment Management release flags (installation_ready_for_installer).
 *
 * Admin Meter Pending shows Retrieve for every processing row. Honour
 * `force` / `adminOverride` / `retrieveFromMetering` so missing `meteringStage`
 * does not 409 ("not in early Meter Pending").
 *
 * CRITICAL: metering_status / metering_stage must be NULL — never copy
 * installer_approved into metering columns. GET after this write must echo
 * the same or the SPA Meter Pending list bounces the row back.
 */
export async function applyRetrieveFromMetering(quotation, reqBody = {}) {
  const { install, metering } = currentStages(quotation)
  const force =
    reqBody.force === true ||
    reqBody.adminOverride === true ||
    reqBody.allowRevert === true ||
    reqBody.retrieveFromMetering === true

  if (LATE_METERING.has(metering) && !force) {
    const err = new Error("Quotation is past Meter Pending — retrieve not allowed.")
    err.status = 409
    err.code = "WF_RETRIEVE_METERING_002"
    throw err
  }
  // Discom / WCC / MCO stay blocked even with force — use late-stage revert.
  if (
    metering === "meter_installation_pending" ||
    metering === "mco" ||
    install === "meter_installation_pending" ||
    install === "mco" ||
    install === "pending_baldev" ||
    install === "baldev_approved"
  ) {
    const err = new Error("Quotation is past Meter Pending — retrieve not allowed.")
    err.status = 409
    err.code = "WF_RETRIEVE_METERING_002"
    throw err
  }

  const inEarly =
    EARLY_METERING.has(metering) ||
    EARLY_METERING.has(install) ||
    metering === "pending_metering" ||
    install === "pending_metering" ||
    metering === "metering_in_progress" ||
    install === "metering_in_progress"

  // Meter Pending list can have installer_approved + empty meteringStage after Send to Metering.
  if (!inEarly && !force) {
    const err = new Error(
      `Cannot retrieve from metering while stage is '${metering || install || "unset"}'. Use late-stage revert flows.`,
    )
    err.status = 409
    err.code = "WF_RETRIEVE_METERING_001"
    throw err
  }

  await quotation.update({
    installationStatus: "installer_approved",
    installation_status: "installer_approved",
    meteringStatus: null,
    metering_status: null,
    meteringStage: null,
    metering_stage: null,
    pendingMeteringAt: null,
    pending_metering_at: null,
    meteringWccAfterDiscom: false,
    metering_wcc_after_discom: false,
    // Do NOT clear installation_ready_for_installer / installation_released_at.
    // Do NOT change quotations.status (still approved).
    // Do NOT write installer_approved into metering_status.
  })
  await quotation.reload()
  return quotation
}

/**
 * PATCH|POST /api/admin/quotations/:id/retrieve-from-metering
 *
 * Body from frontend:
 * {
 *   "installationStatus": "installer_approved",
 *   "installation_status": "installer_approved",
 *   "meteringStatus": "",
 *   "metering_status": "",
 *   "meteringStage": "",
 *   "metering_stage": "",
 *   "target": "installer_approved",
 *   "retrieveFromMetering": true,
 *   "allowRevert": true,
 *   "force": true,
 *   "adminOverride": true,
 *   "source": "admin"
 * }
 */
export async function postAdminRetrieveFromMetering(req, res) {
  const user = requireAdmin(req, res)
  if (!user) return
  const quotationId = req.params.quotationId || req.params.id

  try {
    const quotation = await Quotation.findByPk(quotationId)
    if (!quotation) {
      return res.status(404).json({ success: false, error: { code: "RES_001", message: "Not found" } })
    }

    await applyRetrieveFromMetering(quotation, req.body || {})
    const data = quotationToApiJson(quotation)
    return res.json({ success: true, data })
  } catch (e) {
    const status = e?.status || 500
    return res.status(status).json({
      success: false,
      error: { code: e?.code || "SYS_001", message: e?.message || "Internal error" },
    })
  }
}

/**
 * Generic PATCH /installation-status with installer_approved:
 * if retrieveFromMetering / empty metering fields / force retrieve, call
 * applyRetrieveFromMetering — do not set metering_status = installer_approved.
 */
export async function patchInstallationStatusIfRetrieve(quotation, reqBody = {}) {
  const target = norm(reqBody.installation_status || reqBody.installationStatus || reqBody.target)
  const retrieve =
    reqBody.retrieveFromMetering === true ||
    reqBody.allowRevert === true ||
    (target === "installer_approved" &&
      (reqBody.meteringStatus === "" ||
        reqBody.metering_status === "" ||
        reqBody.meteringStatus === null ||
        reqBody.metering_status === null))
  if (target === "installer_approved" && retrieve) {
    return applyRetrieveFromMetering(quotation, { ...reqBody, retrieveFromMetering: true, force: true })
  }
  return null
}

/**
 * Optional: same handler on metering-handoff with retrieve flag
 *
 * PATCH /api/admin/quotations/:id/metering-handoff
 * { "retrieveFromMetering": true, "target": "installer_approved", "allowRevert": true }
 */

/*
router.patch("/admin/quotations/:id/retrieve-from-metering", authAdmin, postAdminRetrieveFromMetering)
router.post ("/admin/quotations/:id/retrieve-from-metering", authAdmin, postAdminRetrieveFromMetering)
*/

// -----------------------------------------------------------------------------
// Meter Pending queue — installer_approved + empty metering is NOT Meter Pending
// -----------------------------------------------------------------------------
export function isMeterPendingQueueRow(q) {
  const { install, metering } = currentStages(q)
  return (
    metering === "pending_metering" ||
    metering === "metering_in_progress" ||
    install === "pending_metering" ||
    install === "metering_in_progress"
  )
}

// -----------------------------------------------------------------------------
// GET after retrieve — MUST echo on next list load
// -----------------------------------------------------------------------------
/*
{
  "installationStatus": "installer_approved",
  "installation_status": "installer_approved",
  "meteringStatus": null,
  "metering_status": null,
  "meteringStage": null,
  "metering_stage": null,
  "installationReadyForInstaller": true,   // unchanged
  "installationReleasedAt": "…"           // unchanged
}
*/

// -----------------------------------------------------------------------------
// QA
// -----------------------------------------------------------------------------
/*
1. Send quotation to Metering (pending_metering).
2. Admin → Meter Pending → Retrieve → 200.
3. GET by-id + list: installation_status = installer_approved; metering_status null.
4. Hard refresh / other device: row NOT in Meter Pending; Send to Metering on Quotations.
5. Retrieve from metering_approved / meter_install / mco → 409.
6. Dedicated route 404 is a miss — generic installation-status PATCH must still null metering.
*/
