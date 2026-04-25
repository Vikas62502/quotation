/** Shared with installer + metering dashboards: account-management "send to installation" gate. */
export const INSTALLER_RELEASE_MAP_KEY = "installerReleaseMap"

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
