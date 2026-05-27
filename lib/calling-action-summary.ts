import { parseTaggedCallRemark } from "@/lib/calling-remark-payload"

/** Mirrors dealer calling-data status sets (`app/dashboard/calling-data/page.tsx`). */
export const NOT_INTERESTED_STATUSES = new Set([
  "Not Interested",
  "Not Interested Currently",
  "Already Installed Solar",
  "Already in Discussion with Another Vendor",
  "Call Unanswered",
  "Switched Off",
  "Not Reachable",
  "Busy / Line Busy",
  "Call Disconnected",
  "Wrong Number",
  "Invalid Number",
  "Number Does Not Exist",
  "Invalid Lead",
  "Duplicate Lead",
  "Out of Service Area",
  "Not Eligible for Solar",
  "Tenant (No Ownership)",
  "Commercial / Residential Mismatch",
  "No Roof / Space Issue",
  "Low Electricity Bill",
  "Single Phase Only",
  "Lost Lead",
  "Price Too High",
  "Budget Issue",
  "Trust Issue",
  "Location Not Serviceable",
  "Chose Competitor",
  "No Requirement",
])

export const FOLLOW_UP_STATUSES = new Set([
  "Callback Later",
  "Follow-up Required",
  "Callback Scheduled",
  "Follow-up Pending",
  "Not Picking on Follow-up",
  "Rescheduled",
])

export const INTERESTED_STATUSES = new Set([
  "Interested",
  "Highly Interested",
  "Need More Information",
  "Own House",
  "Suitable Roof Available",
  "High Electricity Bill (>₹2000)",
  "3 Phase Connection Available",
  "Site Visit Scheduled",
  "Site Visit Done",
  "Quotation Shared",
  "Negotiation Ongoing",
  "Converted (Deal Closed)",
  "Payment Received",
  "Installation Pending",
  "Installation Completed",
  "Valid Lead",
])

/** Same list as dealer `NOT_CONNECTED_REASONS` in `app/dashboard/calling-data/page.tsx`. */
export const NOT_CONNECTED_STATUSES_LIST = [
  "Call Unanswered",
  "Switched Off",
  "Not Reachable",
  "Busy / Line Busy",
  "Call Disconnected",
  "Wrong Number",
  "Invalid Number",
  "Number Does Not Exist",
  "Duplicate Lead",
  "Invalid Lead",
  "Out of Service Area",
  "Incoming Not Available",
] as const

const NOT_CONNECTED_REASONS = new Set<string>(NOT_CONNECTED_STATUSES_LIST)

const LOST_REASONS = new Set([
  "Not Interested Currently",
  "Price Too High",
  "Budget Issue",
  "Trust Issue",
  "Location Not Serviceable",
  "Chose Competitor",
  "No Requirement",
  "Already Installed Solar",
  "Low Electricity Bill",
  "Flat Issue",
  "Apartment Issue",
  "Low Space Issue",
])

const DECISION_PENDING_REASONS = new Set([
  "Callback Scheduled",
  "Follow-up Pending",
  "Callback Later",
  "Follow-up Required",
  "Need More Information",
  "Not Picking on Follow-up",
])

export type CallingActionLike = {
  action?: string
  callRemark?: string
  statusCategory?: string
  statusText?: string
  status_category?: string
  status_text?: string
}

export type CallingConnectionKind = "connected" | "not_connected"

export type CallingConnectionSummary = {
  connected: number
  notConnected: number
}

export const CALLING_CONNECTION_LABELS: Record<CallingConnectionKind, string> = {
  connected: "Connected",
  not_connected: "Not Connected",
}

export type CallingActionSummaryBucket = "interested" | "followUp" | "notInterested" | "others"

export type CallingActionSummary = {
  interested: number
  followUp: number
  notInterested: number
  others: number
}

export const CALLING_SUMMARY_BUCKET_LABELS: Record<CallingActionSummaryBucket, string> = {
  interested: "Interested",
  followUp: "Follow Up",
  notInterested: "Not Interested",
  others: "Others",
}

/** Dealer rule: status in NOT_CONNECTED list → not connected; else connected when status exists. */
export function isNotConnectedCallingStatus(status: string): boolean {
  const trimmed = status.trim()
  if (!trimmed) return false
  return NOT_CONNECTED_REASONS.has(trimmed)
}

/** Connected vs not connected — matches dealer Calling Data tabs. */
export function classifyCallingConnection(item: CallingActionLike): CallingConnectionKind {
  const { status, statusCategory } = resolveCallingActionFields(item)
  const categoryKey = statusCategory.toLowerCase().replace(/[\s-]+/g, "_")

  if (status && isNotConnectedCallingStatus(status)) return "not_connected"
  if (categoryKey === "call_connectivity" && status) return "not_connected"

  const action = String(item.action || "")
    .toLowerCase()
    .trim()
  if (action === "start") return "not_connected"

  if (status) return "connected"
  if (["called", "follow_up", "not_interested", "rescheduled"].includes(action)) return "connected"
  return "not_connected"
}

export function buildCallingConnectionSummary(items: CallingActionLike[]): CallingConnectionSummary {
  return items.reduce<CallingConnectionSummary>(
    (acc, item) => {
      if (classifyCallingConnection(item) === "connected") acc.connected += 1
      else acc.notConnected += 1
      return acc
    },
    { connected: 0, notConnected: 0 },
  )
}

export function getCallingConnectionBadgeClass(kind: CallingConnectionKind): string {
  return kind === "connected"
    ? "border-emerald-200 text-emerald-700 bg-emerald-50"
    : "border-slate-300 text-slate-700 bg-slate-50"
}

export function resolveCallingActionFields(item: CallingActionLike) {
  const parsed = parseTaggedCallRemark(item.callRemark)
  return {
    statusCategory: (item.statusCategory || item.status_category || parsed.statusCategory || "").trim(),
    status: (item.statusText || item.status_text || parsed.status || "").trim(),
    remark: parsed.remark,
  }
}

/** Same outcome rules as dealer `getConnectedOutcomeForStatus`. */
export function getConnectedOutcomeForStatus(
  status: string,
): "interested" | "not_interested" | "decision_pending" {
  if (
    LOST_REASONS.has(status) ||
    status === "Not Interested" ||
    status === "Not Interested Currently"
  ) {
    return "not_interested"
  }
  if (
    DECISION_PENDING_REASONS.has(status) ||
    FOLLOW_UP_STATUSES.has(status) ||
    status === "Rescheduled"
  ) {
    return "decision_pending"
  }
  return "interested"
}

/** Classify one action for HR/Admin summary cards (aligned with dealer status picker). */
export function classifyCallingActionSummaryBucket(item: CallingActionLike): CallingActionSummaryBucket {
  const action = String(item.action || "")
    .toLowerCase()
    .trim()
  const { status } = resolveCallingActionFields(item)

  if (action === "not_interested") return "notInterested"
  if (action === "follow_up" || action === "rescheduled") return "followUp"
  if (action === "start") return "others"

  if (status) {
    if (NOT_INTERESTED_STATUSES.has(status) || LOST_REASONS.has(status)) {
      return "notInterested"
    }
    if (FOLLOW_UP_STATUSES.has(status) || DECISION_PENDING_REASONS.has(status)) {
      return "followUp"
    }
    if (INTERESTED_STATUSES.has(status)) {
      return "interested"
    }
    if (isNotConnectedCallingStatus(status)) {
      return "others"
    }

    const outcome = getConnectedOutcomeForStatus(status)
    if (outcome === "not_interested") return "notInterested"
    if (outcome === "decision_pending") return "followUp"
    return "interested"
  }

  if (action === "called") return "others"
  return "others"
}

export function buildCallingActionSummary(items: CallingActionLike[]): CallingActionSummary {
  return items.reduce<CallingActionSummary>(
    (acc, item) => {
      const bucket = classifyCallingActionSummaryBucket(item)
      acc[bucket] += 1
      return acc
    },
    { interested: 0, followUp: 0, notInterested: 0, others: 0 },
  )
}

export function getCallingActionSummaryBadgeClass(bucket: CallingActionSummaryBucket): string {
  switch (bucket) {
    case "interested":
      return "border-emerald-200 text-emerald-700 bg-emerald-50"
    case "followUp":
      return "border-blue-200 text-blue-700 bg-blue-50"
    case "notInterested":
      return "border-rose-200 text-rose-700 bg-rose-50"
    default:
      return "border-amber-200 text-amber-800 bg-amber-50"
  }
}
