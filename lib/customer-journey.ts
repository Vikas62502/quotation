import type { Quotation } from "@/lib/quotation-context"
import { getCustomBoundsFromYmd, getPresetBounds } from "@/lib/calling-report-date-range"
import {
  getInstallationWorkflowStatus,
  getMeteringWorkflowRaw,
  isInstallationCompleteForMetering,
} from "@/lib/operational-install-queue"

export type JourneyStageStatus = "completed" | "pending" | "in_progress"

export type JourneyStageProgress = {
  adminApproval: JourneyStageStatus
  installation: JourneyStageStatus
  metering: JourneyStageStatus
  finalConfirmation: JourneyStageStatus
}

export type JourneyHoldInfo = {
  holder: string
  stageLabel: string
}

export function getJourneyFileLoginLabel(quotation: Quotation): string {
  const raw = String((quotation as any).fileLoginStatus || (quotation as any).file_login_status || "").toLowerCase()
  if (raw === "already_login") return "Already login"
  if (raw === "login_now") return "Login now"
  return "Not set"
}

export function hasJourneyFileLoginStatus(quotation: Quotation): boolean {
  const raw = String((quotation as any).fileLoginStatus || (quotation as any).file_login_status || "").toLowerCase()
  return raw === "already_login" || raw === "login_now"
}

export type JourneyDateRangeFilter =
  | "all"
  | "today"
  | "yesterday"
  | "week"
  | "this_month"
  | "last_month"
  | "year"
  | "custom"

/** Date used for journey filters/sort — prefers file login date, then created date. */
export function getJourneyFilterDate(quotation: Quotation): Date | null {
  const qAny = quotation as Record<string, unknown>
  const raw =
    quotation.fileLoginAt ||
    qAny.file_login_at ||
    quotation.createdAt ||
    qAny.created_at
  if (!raw) return null
  const d = new Date(String(raw))
  return Number.isNaN(d.getTime()) ? null : d
}

/** @deprecated Use getJourneyFilterDate */
export const getJourneyMonthDate = getJourneyFilterDate

function dayStart(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function dayEnd(d: Date): Date {
  const x = new Date(d)
  x.setHours(23, 59, 59, 999)
  return x
}

function getYesterdayBounds(now = new Date()) {
  const y = new Date(now)
  y.setDate(y.getDate() - 1)
  return { start: dayStart(y), end: dayEnd(y) }
}

function getYearBounds(now = new Date()) {
  return {
    start: dayStart(new Date(now.getFullYear(), 0, 1)),
    end: dayEnd(new Date(now.getFullYear(), 11, 31)),
  }
}

export function getJourneyDateRangeBounds(
  filter: JourneyDateRangeFilter,
  customFromYmd: string,
  customToYmd: string,
  now = new Date(),
): { start: Date; end: Date } | null {
  switch (filter) {
    case "all":
      return null
    case "today":
      return getPresetBounds("daily", now)
    case "yesterday":
      return getYesterdayBounds(now)
    case "week":
      return getPresetBounds("weekly", now)
    case "this_month":
      return getPresetBounds("monthly", now)
    case "last_month":
      return getPresetBounds("last_month", now)
    case "year":
      return getYearBounds(now)
    case "custom":
      return getCustomBoundsFromYmd(customFromYmd, customToYmd)
    default:
      return null
  }
}

export function matchesJourneyDateRangeFilter(
  quotation: Quotation,
  filter: JourneyDateRangeFilter,
  customFromYmd: string,
  customToYmd: string,
): boolean {
  if (filter === "all") return true
  const bounds = getJourneyDateRangeBounds(filter, customFromYmd, customToYmd)
  if (!bounds) return false
  const date = getJourneyFilterDate(quotation)
  if (!date) return false
  return date.getTime() >= bounds.start.getTime() && date.getTime() <= bounds.end.getTime()
}

export function getJourneyHoldInfo(quotation: Quotation): JourneyHoldInfo {
  const opsStatus = String(
    (quotation as any).installationStatus || (quotation as any).installation_status || "",
  ).toLowerCase()
  const approvalStatus = String(quotation.status || "pending").toLowerCase()

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

export function formatJourneyStageStatusLabel(status: JourneyStageStatus): string {
  if (status === "completed") return "Completed"
  if (status === "in_progress") return "In Progress"
  return "Pending"
}

export function getJourneyStageProgress(quotation: Quotation): JourneyStageProgress {
  const approvalStatus = String(quotation.status || "pending").toLowerCase()
  const installStatus = getInstallationWorkflowStatus(quotation as Record<string, unknown>)
  const meteringRaw = getMeteringWorkflowRaw(quotation as Record<string, unknown>)
  const meteringStage =
    meteringRaw ||
    (["pending_metering", "metering_in_progress", "metering_approved", "mco"].includes(installStatus)
      ? installStatus
      : "")

  const adminApproval: JourneyStageStatus = approvalStatus === "approved" ? "completed" : "pending"

  let installation: JourneyStageStatus = "pending"
  let metering: JourneyStageStatus = "pending"
  let finalConfirmation: JourneyStageStatus = "pending"

  if (installStatus === "installer_in_progress" || installStatus === "pending_installer") {
    installation = "in_progress"
  }
  if (isInstallationCompleteForMetering(quotation as Record<string, unknown>)) {
    installation = "completed"
  }

  if (["pending_metering", "metering_in_progress", "mco"].includes(meteringStage)) {
    metering = "in_progress"
  }
  if (
    ["metering_approved", "pending_baldev", "baldev_approved", "completed"].includes(meteringStage) ||
    ["pending_baldev", "baldev_approved", "completed"].includes(installStatus)
  ) {
    metering = "completed"
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

  return {
    adminApproval,
    installation,
    metering,
    finalConfirmation,
  }
}

export function matchesCustomerJourneySearch(quotation: Quotation, searchTerm: string): boolean {
  const normalized = searchTerm.trim().toLowerCase()
  if (!normalized) return true

  const hold = getJourneyHoldInfo(quotation)
  const progress = getJourneyStageProgress(quotation)
  const tokens = [
    quotation.id,
    quotation.customer?.firstName,
    quotation.customer?.lastName,
    quotation.customer?.mobile,
    getJourneyFileLoginLabel(quotation),
    hold.holder,
    hold.stageLabel,
    progress.adminApproval,
    progress.installation,
    progress.metering,
    progress.finalConfirmation,
  ]

  return tokens.some((token) => String(token || "").toLowerCase().includes(normalized))
}
