// @ts-nocheck
/**
 * =============================================================================
 * BACKEND — Fast quotation / installer / metering lists  (Oct 26 2026)
 * =============================================================================
 *
 * APPLY THIS. Frontend already ships:
 *   Every list GET sends includeMedia=false&includeVisits=false
 *   Admin Installation + Metering fire installer-queue status filters in parallel
 *   Extra pagination pages fetch in parallel (page 2..N together)
 *   GET /quotations/:id is unchanged — full documents + photos
 *
 * No new route. Honor query flags on existing list endpoints.
 *
 * -----------------------------------------------------------------------------
 * Query flags
 * -----------------------------------------------------------------------------
 *
 *   includeMedia=false   omit photo / document / completion image payloads
 *   includeVisits=false  omit visit history arrays
 *
 * Treat string "false" / "0" / "no" as false. Missing flag on LIST = false
 * (same as frontend default). includeMedia=true keeps today's full payload.
 *
 * Apply on:
 *   GET /quotations
 *   GET /admin/quotations
 *   GET /account-management/quotations
 *   GET /installer/quotations
 *   GET /installer/queue
 *
 * Do NOT apply on:
 *   GET /quotations/:id
 *   GET /admin/quotations/:id
 *   POST/PATCH document upload responses
 *
 * When includeMedia is false, still return identity + workflow fields:
 *   id, status, paymentType, proposal, subtotal, customer, dealer,
 *   installationStatus, installation_status, installationReadyForInstaller,
 *   installerApprovedAt, meteringStatus, meteringStage, mcoStatus, …
 * Omit (or empty array) heavy keys, including:
 *   documents, document, installationCompletion, installerCompletion,
 *   siteCompletionImages, homeFrontPhoto, homeWithPersonPhoto,
 *   inverterWithCustomerPhoto, plantWithCustomerPhoto,
 *   inverterSerialNumberPhoto, panelSerialNumberPhoto, geoTagPlantPhoto,
 *   otherImages, installationImageUrls
 * When includeVisits is false, omit visits / visitHistory / visitorVisits.
 *
 * Unknown query keys must not 400. Concurrent GETs of page=1,2,3… must all 200.
 *
 * -----------------------------------------------------------------------------
 * Installer queue status filters
 * -----------------------------------------------------------------------------
 *
 * GET /installer/quotations?status=… and GET /installer/queue?status=…
 * must accept (do not 400) and filter installation_status / metering:
 *
 *   pending_installer
 *   approved                 (installer-approved rows — keep existing meaning)
 *   installer_in_progress
 *   installer_approved
 *   pending_baldev
 *   pending_metering
 *   metering_in_progress
 *   metering_approved
 *   meter_installation_pending
 *   mco
 *
 * Unfiltered GET (no status) still returns the role's full queue.
 * Empty filter result = 200 { quotations: [] }, not 404.
 *
 * Admin Installation now calls all of:
 *   pending_installer, approved, installer_in_progress, installer_approved, pending_baldev
 * in one Promise.all. Metering calls pending_metering … mco in parallel plus
 * one unfiltered queue page.
 *
 * -----------------------------------------------------------------------------
 * What NOT to change
 * -----------------------------------------------------------------------------
 *
 * List item still needs nested dealer + customer names, kW, amounts, status.
 * Do not drop installationStatus from the list — tabs break without it.
 * Do not require includeMedia=true for the row to appear.
 */

const FALSEY = new Set(["false", "0", "no", "off"])

export function queryFlagEnabled(raw, defaultValue = false) {
  if (raw === undefined || raw === null || raw === "") return defaultValue
  if (typeof raw === "boolean") return raw
  const s = String(raw).trim().toLowerCase()
  if (FALSEY.has(s)) return false
  if (s === "true" || s === "1" || s === "yes" || s === "on") return true
  return defaultValue
}

const MEDIA_KEYS = [
  "documents",
  "document",
  "installationCompletion",
  "installerCompletion",
  "installerInstallation",
  "siteCompletionImages",
  "site_completion_images",
  "homeFrontPhoto",
  "home_front_photo",
  "homeWithPersonPhoto",
  "home_with_person_photo",
  "inverterWithCustomerPhoto",
  "inverter_with_customer_photo",
  "plantWithCustomerPhoto",
  "plant_with_customer_photo",
  "inverterSerialNumberPhoto",
  "inverter_serial_number_photo",
  "panelSerialNumberPhoto",
  "panel_serial_number_photo",
  "geoTagPlantPhoto",
  "geo_tag_plant_photo",
  "otherImages",
  "other_images",
  "installationImageUrls",
  "installation_image_urls",
]

const VISIT_KEYS = ["visits", "visitHistory", "visit_history", "visitorVisits", "visitor_visits"]

export function stripHeavyListFields(row, { includeMedia, includeVisits }) {
  if (!row || typeof row !== "object") return row
  const out = { ...row }
  if (!includeMedia) {
    for (const key of MEDIA_KEYS) delete out[key]
  }
  if (!includeVisits) {
    for (const key of VISIT_KEYS) delete out[key]
  }
  return out
}

export function listQueryFromReq(req) {
  const q = req.query || {}
  return {
    includeMedia: queryFlagEnabled(q.includeMedia ?? q.include_media, false),
    includeVisits: queryFlagEnabled(q.includeVisits ?? q.include_visits, false),
  }
}

/** Call on every list item before res.json. Detail GET skips this. */
export function mapQuotationListItem(row, req) {
  return stripHeavyListFields(row, listQueryFromReq(req))
}

export const INSTALLER_QUEUE_STATUS_ALIASES = {
  pending_installer: ["pending_installer", "pending", "released", "sent_to_installer"],
  approved: ["approved", "installer_approved"],
  installer_in_progress: ["installer_in_progress", "in_progress"],
  installer_approved: ["installer_approved"],
  pending_baldev: ["pending_baldev"],
  pending_metering: ["pending_metering", "meter_pending"],
  metering_in_progress: ["metering_in_progress"],
  metering_approved: ["metering_approved"],
  meter_installation_pending: ["meter_installation_pending", "meter_install"],
  mco: ["mco"],
}

export function installerQueueStatusMatches(rowStatus, queryStatus) {
  if (!queryStatus) return true
  const want = String(queryStatus).trim().toLowerCase()
  const have = String(rowStatus || "").trim().toLowerCase()
  const aliases = INSTALLER_QUEUE_STATUS_ALIASES[want] || [want]
  return aliases.includes(have)
}
