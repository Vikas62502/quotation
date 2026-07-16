/** Shared with installer + metering dashboards: account-management "send to installation" gate. */
export const INSTALLER_RELEASE_MAP_KEY = "installerReleaseMap"

/** Admin Installation tab: optional override for planned install date (YYYY-MM-DD), keyed by quotation id. */
export const ADMIN_INSTALLATION_SCHEDULED_MAP_KEY = "installationScheduledDateMap"

/** YYYY-MM-DD, local calendar (avoids UTC shifting calendar day). */
export function addCalendarDaysFromDateString(dateStr: string, days: number): string {
  const base = new Date(dateStr)
  if (Number.isNaN(base.getTime())) return ""
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + days)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

export function toYmdFromStored(stored: string | undefined): string {
  if (!stored) return ""
  const t = stored.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t
  const parsed = new Date(t)
  if (Number.isNaN(parsed.getTime())) return ""
  const y = parsed.getFullYear()
  const m = String(parsed.getMonth() + 1).padStart(2, "0")
  const day = String(parsed.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

export function readInstallationScheduledMap(): Record<string, string> {
  if (typeof window === "undefined") return {}
  try {
    const raw = JSON.parse(localStorage.getItem(ADMIN_INSTALLATION_SCHEDULED_MAP_KEY) || "{}")
    return raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {}
  } catch {
    return {}
  }
}

export function setInstallationScheduledDateInLocalMap(quotationId: string, ymd: string | undefined) {
  if (typeof window === "undefined") return
  try {
    const map = readInstallationScheduledMap()
    if (ymd) map[quotationId] = ymd
    else delete map[quotationId]
    localStorage.setItem(ADMIN_INSTALLATION_SCHEDULED_MAP_KEY, JSON.stringify(map))
  } catch {
    // no-op
  }
}

/** Local-only metering pipeline stages (until backend exposes metering workflow). */
export const METERING_WORKFLOW_MAP_KEY = "meteringWorkflowMap"

export type OperationalQuotationRecord = Record<string, any>

export function flattenWrappedQuotationRow(raw: unknown): OperationalQuotationRecord {
  if (!raw || typeof raw !== "object") return {}
  const r = raw as OperationalQuotationRecord
  const nested = r.quotation
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    return { ...(nested as OperationalQuotationRecord), ...r }
  }
  return { ...r }
}

export function getInstallationWorkflowStatus(q: OperationalQuotationRecord): string {
  return String(q.installationStatus || q.installation_status || "").toLowerCase()
}

/** Metering-specific workflow fields only (do not treat `installer_approved` as metering approved). */
export function getMeteringWorkflowRaw(q: OperationalQuotationRecord): string {
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

/** Installation finished — ready for admin “Send to Metering”. */
export function isInstallationCompleteForMetering(q: OperationalQuotationRecord): boolean {
  const install = getInstallationWorkflowStatus(q)
  return (
    install === "installer_approved" ||
    install === "completed" ||
    install === "pending_baldev" ||
    install === "baldev_approved"
  )
}

/** Partial photo upload saved — not full Approved Installation. */
export function isInstallationPartialApproved(q: OperationalQuotationRecord): boolean {
  const install = getInstallationWorkflowStatus(q)
  if (install === "installer_partial_approved" || install === "partial_approved") return true
  return Boolean(q.installationPartialApproved || q.installation_partial_approved)
}

/** Quotation is already in (or past) the metering queue. */
export function isAlreadyInMeteringPipeline(q: OperationalQuotationRecord): boolean {
  const metering = getMeteringWorkflowRaw(q)
  const install = getInstallationWorkflowStatus(q)
  const meteringStages = new Set([
    "pending_metering",
    "metering_in_progress",
    "metering_approved",
    "mco",
  ])
  return meteringStages.has(metering) || meteringStages.has(install)
}

/** Installation approved — waiting for admin to manually send to metering. */
export function isAwaitingManualMeteringHandoff(q: OperationalQuotationRecord): boolean {
  return getInstallationWorkflowStatus(q) === "installer_approved" && !isAlreadyInMeteringPipeline(q)
}

export type SendToMeteringMenuState = {
  visible: boolean
  enabled: boolean
  hint: string
  sent: boolean
}

/** Ops column / badge label for quotation workflow stage. */
export function getQuotationOpsStageLabel(q: OperationalQuotationRecord): string {
  if (isAwaitingManualMeteringHandoff(q)) return "Pending metering"
  const install = getInstallationWorkflowStatus(q)
  const metering = getMeteringWorkflowRaw(q)
  if (isAlreadyInMeteringPipeline(q)) {
    const meteringStages = new Set([
      "pending_metering",
      "metering_in_progress",
      "metering_approved",
      "mco",
    ])
    const stage = meteringStages.has(metering) ? metering : install
    return stage ? stage.replaceAll("_", " ") : "Pending metering"
  }
  const stage = metering || install
  return stage ? stage.replaceAll("_", " ") : "Not set"
}

/** When to show the manual Send to Metering action (installation approved, not yet in metering queue). */
export function getSendToMeteringMenuState(q: OperationalQuotationRecord): SendToMeteringMenuState {
  const approved = String(q.status || "").toLowerCase() === "approved"

  if (isAlreadyInMeteringPipeline(q)) {
    return { visible: false, enabled: false, hint: "", sent: true }
  }

  if (!isAwaitingManualMeteringHandoff(q)) {
    return { visible: false, enabled: false, hint: "", sent: false }
  }

  if (!approved) {
    return {
      visible: true,
      enabled: false,
      hint: "Approve the quotation before sending to metering",
      sent: false,
    }
  }

  return { visible: true, enabled: true, hint: "", sent: false }
}

/**
 * Admin → Quotations (All tab): manual handoff to Metering without waiting for
 * installer_approved. Pending or approved quotations not already in the metering
 * pipeline may be sent (e.g. Pending Installer after Payment Management release).
 */
export function getAdminQuotationsTabSendToMeteringState(
  q: OperationalQuotationRecord,
): SendToMeteringMenuState {
  const status = String(q.status || "pending").toLowerCase()

  if (isAlreadyInMeteringPipeline(q)) {
    return { visible: false, enabled: false, hint: "", sent: true }
  }

  if (status === "rejected" || status === "completed") {
    return { visible: false, enabled: false, hint: "", sent: false }
  }

  if (status === "pending") {
    return {
      visible: true,
      enabled: true,
      hint: "Send to Metering (quotation status is still Pending)",
      sent: false,
    }
  }

  if (isAwaitingManualMeteringHandoff(q)) {
    return { visible: true, enabled: true, hint: "", sent: false }
  }

  return {
    visible: true,
    enabled: true,
    hint: "Manually send to the Metering tab (installation may still be in progress)",
    sent: false,
  }
}

export type MeteringWorkflowTab = "processing" | "approved" | "meter_install" | "mco"

/** Installation done; metering not approved yet — must not show Move to MCO. */
export function isInstallOnlyApprovedForMetering(q: OperationalQuotationRecord): boolean {
  const installRaw = getInstallationWorkflowStatus(q)
  const meteringRaw = getMeteringWorkflowRaw(q)
  return installRaw === "installer_approved" || meteringRaw === "installer_approved"
}

export function isMeteringApprovedForTransition(q: OperationalQuotationRecord): boolean {
  const meteringRaw = getMeteringWorkflowRaw(q)
  const installRaw = getInstallationWorkflowStatus(q)

  // Installation complete but metering not started — ignore stray metering_approved on API row.
  if (
    installRaw === "installer_approved" ||
    installRaw === "pending_installer" ||
    installRaw === "installer_in_progress" ||
    meteringRaw === "installer_approved"
  ) {
    return false
  }

  if (
    meteringRaw === "metering_approved" ||
    installRaw === "metering_approved" ||
    (meteringRaw === "approved" && !meteringRaw.includes("installer"))
  ) {
    return true
  }

  const hasApprovedTimestamp = Boolean(q.meteringApprovedAt || q.metering_approved_at)
  if (
    hasApprovedTimestamp &&
    installRaw !== "installer_approved" &&
    (meteringRaw === "metering_approved" || installRaw === "metering_approved")
  ) {
    return true
  }

  return false
}

export function getMeteringWorkflowStage(q: OperationalQuotationRecord): MeteringWorkflowTab | null {
  const meteringRaw = getMeteringWorkflowRaw(q)
  const installRaw = getInstallationWorkflowStatus(q)

  if (installRaw === "pending_baldev" || installRaw === "baldev_approved" || installRaw === "completed") {
    return null
  }

  if (meteringRaw === "mco" || meteringRaw.includes("mco") || installRaw === "mco" || q.mcoAt || q.mco_at) {
    return "mco"
  }

  if (
    meteringRaw === "meter_installation_pending" ||
    meteringRaw === "meter_install_pending" ||
    meteringRaw.includes("meter_install") ||
    installRaw === "meter_installation_pending" ||
    installRaw === "meter_install_pending"
  ) {
    return "meter_install"
  }

  if (isMeteringApprovedForTransition(q)) {
    return "approved"
  }

  const inMeteringProcessing =
    meteringRaw === "pending_metering" ||
    meteringRaw === "metering_in_progress" ||
    installRaw === "pending_metering" ||
    installRaw === "metering_in_progress"

  if (inMeteringProcessing) {
    return "processing"
  }

  return null
}

/** Workflow stages after installation photos are uploaded / approved. */
export const INSTALLATION_UPLOAD_COMPLETE_STATUSES = new Set([
  "installer_approved",
  "pending_metering",
  "metering_in_progress",
  "metering_approved",
  "meter_installation_pending",
  "meter_install_pending",
  "mco",
  "pending_baldev",
  "baldev_approved",
  "completed",
])

export function isInstallationUploadCompleteByStatus(q: OperationalQuotationRecord): boolean {
  return INSTALLATION_UPLOAD_COMPLETE_STATUSES.has(getInstallationWorkflowStatus(q))
}

/** Approved Installation tab — upload done or installer queue approved bucket. */
export function isInstallationApprovedForAdminTab(
  q: OperationalQuotationRecord,
  opts?: { imageUrlCount?: number; inInstallerApprovedQueue?: boolean },
): boolean {
  // Partial uploads stay in Partial Approved — never the Approved Installation tab.
  if (isInstallationPartialApproved(q)) return false
  if (isInstallationUploadCompleteByStatus(q)) return true
  if (Boolean(q.installerApprovedAt || q.installer_approved_at)) return true
  if ((opts?.imageUrlCount ?? 0) > 0) return true
  if (opts?.inInstallerApprovedQueue) return true
  return false
}

/** Pending / Partial / Approved Installation tab bucket. */
export function getInstallationAdminTabProgress(
  q: OperationalQuotationRecord,
  uploadComplete: boolean,
): "pending" | "partial" | "done" {
  if (isInstallationPartialApproved(q)) return "partial"
  return uploadComplete ? "done" : "pending"
}

export function readInstallerReleaseMap(): Record<string, { installationReadyForInstaller?: boolean; installationReleasedAt?: string }> {
  if (typeof window === "undefined") return {}
  try {
    const raw = JSON.parse(localStorage.getItem(INSTALLER_RELEASE_MAP_KEY) || "{}")
    return raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {}
  } catch {
    return {}
  }
}

function isTruthyReleaseFlag(value: unknown): boolean {
  return value === true || value === 1 || value === "true" || value === "1"
}

/** Sent row should leave Admin Installation only after real metering handoff (not wrong backend status on release). */
export function shouldHideSentQuotationFromAdminInstallationTab(q: OperationalQuotationRecord): boolean {
  const install = getInstallationWorkflowStatus(q)
  const metering = getMeteringWorkflowRaw(q)

  if (
    metering === "pending_metering" ||
    metering === "metering_in_progress" ||
    metering === "metering_approved" ||
    metering === "mco" ||
    install === "pending_metering" ||
    install === "metering_in_progress" ||
    install === "metering_approved" ||
    install === "mco"
  ) {
    return true
  }

  return false
}

/** Strict gate: only Payment Management “Send to Installer” rows belong on Admin → Installation. */
export function shouldShowInAdminInstallationTab(
  q: OperationalQuotationRecord,
  releaseMap?: Record<string, any>,
): boolean {
  const map = releaseMap ?? readInstallerReleaseMap()
  if (!isQuotationSentToInstaller(q, map)) return false
  if (shouldHideSentQuotationFromAdminInstallationTab(q)) return false
  return true
}

/** Account Management / Payments “Send to Installer” — quotation is in the installation queue. */
export function isQuotationSentToInstaller(
  q: OperationalQuotationRecord,
  releaseMap: Record<string, any> = {},
): boolean {
  const id = String(q.id || "").trim()
  const entry = id ? releaseMap[id] : undefined
  return (
    isTruthyReleaseFlag(q.installationReadyForInstaller) ||
    isTruthyReleaseFlag(q.installation_ready_for_installer) ||
    isTruthyReleaseFlag(q.readyForInstallation) ||
    isTruthyReleaseFlag(q.ready_for_installation) ||
    isTruthyReleaseFlag(q.releaseToInstaller) ||
    Boolean(q.installationReleasedAt || q.installation_released_at) ||
    isTruthyReleaseFlag(entry?.installationReadyForInstaller) ||
    Boolean(entry?.installationReleasedAt)
  )
}

/** Apply Payments / local release map onto admin + installer list rows when API omits flags. */
export function mergeInstallerReleaseOntoQuotation<T extends OperationalQuotationRecord>(
  q: T,
  releaseMap?: Record<string, any>,
  fallback?: OperationalQuotationRecord | null,
): T {
  const map = releaseMap ?? readInstallerReleaseMap()
  const merged = fallback ? ({ ...fallback, ...q } as T) : q
  const sent = isQuotationSentToInstaller(merged, map)
  const releasedAt =
    merged.installationReleasedAt ??
    merged.installation_released_at ??
    (String(merged.id || "").trim() ? map[String(merged.id)]?.installationReleasedAt : undefined)
  const ready =
    merged.installationReadyForInstaller ??
    merged.installation_ready_for_installer ??
    (String(merged.id || "").trim() ? map[String(merged.id)]?.installationReadyForInstaller : undefined) ??
    (sent ? true : undefined)

  if (!ready && !releasedAt) return q
  return {
    ...q,
    ...(ready ? { installationReadyForInstaller: true, installation_ready_for_installer: true } : {}),
    ...(releasedAt ? { installationReleasedAt: releasedAt, installation_released_at: releasedAt } : {}),
  }
}

/** True when quotation should appear on installer operational queues. */
export function isQuotationReleasedToInstaller(q: OperationalQuotationRecord, localReleaseMap?: Record<string, any>): boolean {
  const map = localReleaseMap ?? readInstallerReleaseMap()
  const workflowStatus = getInstallationWorkflowStatus(q)
  return (
    isQuotationSentToInstaller(q, map) ||
    workflowStatus === "pending_installer" ||
    workflowStatus === "installer_in_progress" ||
    workflowStatus === "installer_approved" ||
    workflowStatus === "pending_baldev" ||
    workflowStatus === "baldev_approved" ||
    workflowStatus === "completed"
  )
}

/** Persist API / Payment Management release flags into local map so Admin Installation can read them. */
export function syncInstallerReleaseMapFromRows(rows: unknown[]): Record<
  string,
  { installationReadyForInstaller?: boolean; installationReleasedAt?: string }
> {
  const map = readInstallerReleaseMap()
  rows.forEach((row) => {
    const flat = flattenQuotationListRow(row)
    const id = String(flat.id || "").trim()
    if (!id) return
    const apiSent =
      isTruthyReleaseFlag(flat.installationReadyForInstaller) ||
      isTruthyReleaseFlag(flat.installation_ready_for_installer) ||
      Boolean(flat.installationReleasedAt || flat.installation_released_at)
    if (!apiSent && !map[id]) return
    const releasedAt = String(
      flat.installationReleasedAt ??
        flat.installation_released_at ??
        map[id]?.installationReleasedAt ??
        "",
    ).trim()
    map[id] = {
      installationReadyForInstaller: true,
      ...(releasedAt ? { installationReleasedAt: releasedAt } : {}),
    }
  })
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(INSTALLER_RELEASE_MAP_KEY, JSON.stringify(map))
    } catch {
      // no-op
    }
  }
  return map
}

export function flattenQuotationListRow(raw: unknown): OperationalQuotationRecord {
  if (!raw || typeof raw !== "object") return {}
  const base = flattenWrappedQuotationRow(raw)
  const attrs = (raw as OperationalQuotationRecord).attributes
  if (attrs && typeof attrs === "object" && !Array.isArray(attrs)) {
    return { ...(attrs as OperationalQuotationRecord), ...base }
  }
  return base
}

/** Apply Payment Management release map + API release flags onto a quotation row. */
export function stampInstallerReleaseFromMap(
  q: OperationalQuotationRecord,
  releaseMap?: Record<string, any>,
): OperationalQuotationRecord {
  const map = releaseMap ?? readInstallerReleaseMap()
  const id = String(q.id || "").trim()
  if (!id) return q
  if (!map[id] && !isQuotationSentToInstaller(q, map)) return q
  return mergeInstallerReleaseOntoQuotation(q, map)
}

export function extractQuotationListFromApiResponse(response: any): any[] {
  if (Array.isArray(response)) return response
  if (Array.isArray(response?.quotations)) return response.quotations
  if (Array.isArray(response?.data?.quotations)) return response.data.quotations
  if (Array.isArray(response?.items)) return response.items
  if (Array.isArray(response?.results)) return response.results
  if (Array.isArray(response?.data) && response.data.every((x: unknown) => x && typeof x === "object")) {
    return response.data
  }
  return []
}

/** Total row count from paginated quotation list responses (not limited to returned page size). */
export function extractQuotationListTotalFromApiResponse(response: unknown): number | null {
  if (!response || typeof response !== "object") return null
  const root = response as Record<string, unknown>
  const nested =
    root.data && typeof root.data === "object" && !Array.isArray(root.data)
      ? (root.data as Record<string, unknown>)
      : null
  const pagination = (root.pagination ?? nested?.pagination) as Record<string, unknown> | undefined
  const meta = (root.meta ?? nested?.meta) as Record<string, unknown> | undefined
  const candidates = [
    pagination?.total,
    meta?.total,
    root.total,
    nested?.total,
    root.totalCount,
    nested?.totalCount,
    root.totalQuotations,
    nested?.totalQuotations,
  ]
  for (const value of candidates) {
    const n = Number(value)
    if (Number.isFinite(n) && n >= 0) return n
  }
  return null
}

/** Merge installer-queue / detail payloads into admin list rows without clobbering mapped customer/status. */
export function mergeInstallationMediaSources(
  base: OperationalQuotationRecord,
  extra?: OperationalQuotationRecord | null,
): OperationalQuotationRecord {
  if (!extra) return base
  const documents =
    base.documents || base.document || extra.documents || extra.document
  return {
    ...extra,
    ...base,
    ...(documents ? { documents, document: documents } : {}),
    installation: base.installation || extra.installation,
    installerInstallation: base.installerInstallation || extra.installerInstallation,
    installationCompletion: base.installationCompletion || extra.installationCompletion,
    installerCompletion: base.installerCompletion || extra.installerCompletion,
    siteCompletionImages: base.siteCompletionImages || extra.siteCompletionImages,
    site_completion_images: base.site_completion_images || extra.site_completion_images,
    installerCompletionImages: base.installerCompletionImages || extra.installerCompletionImages,
    installer_completion_images: base.installer_completion_images || extra.installer_completion_images,
    installationImageUrls: base.installationImageUrls || extra.installationImageUrls,
    installation_image_urls: base.installation_image_urls || extra.installation_image_urls,
    existingInstallationImageUrlsJson:
      base.existingInstallationImageUrlsJson || extra.existingInstallationImageUrlsJson,
    existing_installation_image_urls_json:
      base.existing_installation_image_urls_json || extra.existing_installation_image_urls_json,
    installerRemarks: base.installerRemarks ?? extra.installerRemarks,
    installer_remarks: base.installer_remarks ?? extra.installer_remarks,
    piUploadUrl: base.piUploadUrl || extra.piUploadUrl,
    pi_upload_url: base.pi_upload_url || extra.pi_upload_url,
  }
}
