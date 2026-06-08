import type { Quotation } from "@/lib/quotation-context"

export type VisitStatus =
  | "pending"
  | "approved"
  | "completed"
  | "incomplete"
  | "rejected"
  | "rescheduled"

export type VisitStatusFilter = VisitStatus | "all"

export const VISIT_STATUS_FILTER_OPTIONS: Array<{ value: VisitStatusFilter; label: string }> = [
  { value: "all", label: "All statuses" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "completed", label: "Completed" },
  { value: "incomplete", label: "Incomplete" },
  { value: "rescheduled", label: "Rescheduled" },
  { value: "rejected", label: "Rejected" },
]

export interface VisitVisitorRef {
  visitorId: string
  visitorName: string
}

export interface AdminVisitReportRow {
  id: string
  quotationId: string
  customerName: string
  customerMobile: string
  dealerId: string
  dealerName: string
  visitorNames: string
  visitorIds: string[]
  date: string
  time: string
  location: string
  status: VisitStatus
  notes?: string
  rejectionReason?: string
  createdAt: string
}

export const normalizeVisitStatus = (value?: string): VisitStatus => {
  const raw = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
  if (!raw) return "pending"
  if (raw === "approve" || raw === "approved") return "approved"
  if (raw === "complete" || raw === "completed") return "completed"
  if (raw === "incomplete" || raw === "partially_completed") return "incomplete"
  if (raw === "reschedule" || raw === "rescheduled") return "rescheduled"
  if (raw === "reject" || raw === "rejected") return "rejected"
  if (raw === "pending") return "pending"
  return "pending"
}

const resolveVisitTimeRange = (visit: Record<string, unknown>) => {
  const start = String(visit?.visitStartTime || visit?.startTime || "").trim()
  const end = String(visit?.visitEndTime || visit?.endTime || "").trim()
  if (start && end) return `${start} - ${end}`
  const explicitRange = String(visit?.visitTimeRange || visit?.timeRange || "").trim()
  if (explicitRange) return explicitRange
  return String(visit?.visitTime || visit?.time || "").trim()
}

const getSafeLastName = (lastName?: string) => {
  const cleaned = (lastName || "").trim()
  return cleaned.toLowerCase() === "na" ? "" : cleaned
}

export const extractVisitsFromApiResponse = (payload: unknown): Record<string, unknown>[] => {
  if (!payload || typeof payload !== "object") return []
  const root = payload as Record<string, unknown>
  if (Array.isArray(root.visits)) return root.visits as Record<string, unknown>[]
  if (Array.isArray(root.data) && root.data.length && typeof root.data[0] === "object") {
    return root.data as Record<string, unknown>[]
  }
  const nested = root.data
  if (nested && typeof nested === "object" && Array.isArray((nested as Record<string, unknown>).visits)) {
    return (nested as Record<string, unknown>).visits as Record<string, unknown>[]
  }
  if (Array.isArray(payload)) return payload as Record<string, unknown>[]
  if (root.id) return [root]
  return []
}

export const mapVisitToAdminReportRow = (
  visit: Record<string, unknown>,
  options?: {
    quotationById?: Map<string, Quotation>
    dealerNameById?: Map<string, string>
    visitorNameById?: Map<string, string>
  },
): AdminVisitReportRow => {
  const quotationById = options?.quotationById
  const dealerNameById = options?.dealerNameById
  const visitorNameById = options?.visitorNameById

  const quotationPayload =
    (visit.quotation as Record<string, unknown> | undefined) ||
    (visit.quotationId && quotationById?.get(String(visit.quotationId))
      ? (quotationById.get(String(visit.quotationId)) as unknown as Record<string, unknown>)
      : undefined)
  const customer =
    (visit.customer as Record<string, unknown> | undefined) ||
    (quotationPayload?.customer as Record<string, unknown> | undefined) ||
    {}
  const customerFirst = String(customer.firstName || "").trim()
  const customerLast = getSafeLastName(String(customer.lastName || ""))
  const customerName = `${customerFirst} ${customerLast}`.trim() || "N/A"
  const customerMobile = String(customer.mobile || "").trim()

  const quotationId = String(
    visit.quotationId || quotationPayload?.id || (visit.quotation as Record<string, unknown> | undefined)?.id || "",
  )
  const dealerPayload = visit.dealer as Record<string, unknown> | undefined
  const dealerId = String(
    visit.dealerId || dealerPayload?.id || quotationPayload?.dealerId || "",
  )
  const dealerFromMap = dealerId && dealerNameById?.get(dealerId)
  const dealerName =
    dealerFromMap ||
    `${String(dealerPayload?.firstName || "").trim()} ${String(dealerPayload?.lastName || "").trim()}`.trim() ||
    "N/A"

  const rawVisitors = Array.isArray(visit.visitors)
    ? visit.visitors
    : Array.isArray(visit.otherVisitors)
      ? visit.otherVisitors
      : []
  const visitorRefs: VisitVisitorRef[] = (rawVisitors as Record<string, unknown>[])
    .map((item) => {
      const visitorId = String(item?.visitorId || item?.id || "").trim()
      const visitorName =
        String(item?.visitorName || item?.name || "").trim() ||
        (visitorId && visitorNameById?.get(visitorId)) ||
        ""
      return { visitorId, visitorName }
    })
    .filter((item) => item.visitorId || item.visitorName)

  return {
    id: String(visit.id || ""),
    quotationId,
    customerName,
    customerMobile,
    dealerId,
    dealerName,
    visitorNames:
      visitorRefs.map((v) => v.visitorName || v.visitorId).filter(Boolean).join(", ") || "Unassigned",
    visitorIds: visitorRefs.map((v) => v.visitorId).filter(Boolean),
    date: String(visit.visitDate || visit.date || ""),
    time: resolveVisitTimeRange(visit),
    location: String(visit.location || visit.visitLocation || ""),
    status: normalizeVisitStatus(
      String(visit.status || visit.visitStatus || visit.visit_status || ""),
    ),
    notes: visit.notes ? String(visit.notes) : undefined,
    rejectionReason: visit.rejectionReason
      ? String(visit.rejectionReason)
      : visit.rejection_reason
        ? String(visit.rejection_reason)
        : undefined,
    createdAt: String(visit.createdAt || ""),
  }
}

export const visitMatchesVisitorFilter = (row: AdminVisitReportRow, visitorId: string) => {
  if (visitorId === "all") return true
  return row.visitorIds.includes(visitorId)
}

export const visitMatchesStatusFilter = (row: AdminVisitReportRow, status: VisitStatusFilter) => {
  if (status === "all") return true
  return row.status === status
}

export const visitMatchesSearch = (row: AdminVisitReportRow, search: string) => {
  const q = search.trim().toLowerCase()
  if (!q) return true
  return (
    row.customerName.toLowerCase().includes(q) ||
    row.customerMobile.includes(q) ||
    row.quotationId.toLowerCase().includes(q) ||
    row.dealerName.toLowerCase().includes(q) ||
    row.visitorNames.toLowerCase().includes(q) ||
    row.location.toLowerCase().includes(q)
  )
}

export const visitMatchesDateRange = (
  row: AdminVisitReportRow,
  startDate?: string,
  endDate?: string,
) => {
  if (!row.date) return !startDate && !endDate
  if (startDate && row.date < startDate) return false
  if (endDate && row.date > endDate) return false
  return true
}

export const getVisitStatusBadgeClass = (status: VisitStatus) => {
  switch (status) {
    case "approved":
      return "bg-green-600 text-white"
    case "completed":
      return "bg-blue-600 text-white"
    case "incomplete":
      return "bg-orange-600 text-white"
    case "rescheduled":
      return "bg-purple-600 text-white"
    case "rejected":
      return "bg-red-600 text-white"
    default:
      return "bg-yellow-600 text-white"
  }
}

export const getVisitStatusLabel = (status: VisitStatus) =>
  status.charAt(0).toUpperCase() + status.slice(1)

export const buildVisitStatusSummary = (rows: AdminVisitReportRow[]) => {
  const summary = {
    total: rows.length,
    pending: 0,
    approved: 0,
    completed: 0,
    incomplete: 0,
    rescheduled: 0,
    rejected: 0,
  }
  rows.forEach((row) => {
    summary[row.status] += 1
  })
  return summary
}
