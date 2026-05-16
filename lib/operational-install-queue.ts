/** Shared with installer + metering dashboards: account-management "send to installation" gate. */
export const INSTALLER_RELEASE_MAP_KEY = "installerReleaseMap"

/** Admin Installation tab: optional override for planned install date (YYYY-MM-DD), keyed by quotation id. */
export const ADMIN_INSTALLATION_SCHEDULED_MAP_KEY = "installationScheduledDateMap"

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

/** True when quotation should appear on installer / metering operational queues. */
export function isQuotationReleasedToInstaller(q: OperationalQuotationRecord, localReleaseMap?: Record<string, any>): boolean {
  const workflowStatus = getInstallationWorkflowStatus(q)
  const status = String(q.status || "").toLowerCase()
  return (
    q.installationReadyForInstaller === true ||
    q.installation_ready_for_installer === true ||
    q.readyForInstallation === true ||
    q.ready_for_installation === true ||
    q.releaseToInstaller === true ||
    localReleaseMap?.[q.id]?.installationReadyForInstaller === true ||
    workflowStatus === "pending_installer" ||
    workflowStatus === "installer_in_progress" ||
    workflowStatus === "installer_approved" ||
    workflowStatus === "pending_baldev" ||
    workflowStatus === "baldev_approved" ||
    workflowStatus === "completed" ||
    status === "approved"
  )
}

export function extractQuotationListFromApiResponse(response: any): any[] {
  if (Array.isArray(response)) return response
  if (Array.isArray(response?.quotations)) return response.quotations
  if (Array.isArray(response?.data?.quotations)) return response.data.quotations
  return []
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
