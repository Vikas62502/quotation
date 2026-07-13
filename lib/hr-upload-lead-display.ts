/**
 * HR Uploaded Lead Data — table labels, status badges, and batch counts.
 *
 * Three buckets (matches BACKEND_CHANGES_REQUIRED.md §7.8):
 * - Unassigned: no valid dealer assignee and not completed
 * - Assigned: dealer present, call not finished yet → dealer name + Pending
 * - Completed: dealer assigned and call finished
 */

export type HrUploadLeadRow = {
  assignedDealerId?: string
  assignedDealerName?: string
  assignmentStatus?: string
}

export type HrLeadCountBucket = "unassigned" | "assigned" | "completed"

export type HrLeadRowDisplay = {
  bucket: HrLeadCountBucket
  dealerLabel: string
  statusLabel: string
  statusBadgeClassName: string
}

export const HR_UPLOAD_COUNT_LEGEND =
  "Unassigned = no dealer yet • Assigned = dealer has the lead, call pending • Completed = call finished"

const UNASSIGNED_DEALER_TOKENS = new Set([
  "",
  "unassigned",
  "null",
  "none",
  "-",
  "na",
  "n/a",
  "pool",
  "open",
])

export const normalizeDealerAssigneeToken = (raw?: string) => {
  const value = String(raw ?? "").trim()
  if (UNASSIGNED_DEALER_TOKENS.has(value.toLowerCase())) return ""
  return value
}

export const rowHasAssignedDealer = (row: HrUploadLeadRow) => {
  const id = normalizeDealerAssigneeToken(row.assignedDealerId)
  const name = normalizeDealerAssigneeToken(row.assignedDealerName)
  return Boolean(id || name)
}

export const isCompletedAssignmentStatus = (value?: string) => {
  const status = String(value || "").trim().toLowerCase()
  return status === "completed" || status === "done" || status === "closed" || status === "complete"
}

/** Completed in HR table = dealer present and status is completed. */
export const isHrUploadLeadCompleted = (row: HrUploadLeadRow) =>
  rowHasAssignedDealer(row) && isCompletedAssignmentStatus(row.assignmentStatus)

export const classifyHrUploadLeadBucket = (row: HrUploadLeadRow): HrLeadCountBucket => {
  if (isHrUploadLeadCompleted(row)) return "completed"
  if (rowHasAssignedDealer(row)) return "assigned"
  return "unassigned"
}

export const computeHrUploadLeadCounts = (rows: HrUploadLeadRow[]) => {
  const counts = { assigned: 0, unassigned: 0, completed: 0 }
  for (const row of rows) {
    const bucket = classifyHrUploadLeadBucket(row)
    counts[bucket] += 1
  }
  return counts
}

/** Table: Assigned Dealer + Status columns. */
export const getHrLeadRowDisplay = (row: HrUploadLeadRow): HrLeadRowDisplay => {
  const dealerName = normalizeDealerAssigneeToken(row.assignedDealerName)

  if (isHrUploadLeadCompleted(row)) {
    return {
      bucket: "completed",
      dealerLabel: dealerName || "—",
      statusLabel: "Completed",
      statusBadgeClassName: "border-emerald-200 text-emerald-800 bg-emerald-50",
    }
  }

  if (rowHasAssignedDealer(row)) {
    return {
      bucket: "assigned",
      dealerLabel: dealerName || "—",
      statusLabel: "Pending",
      statusBadgeClassName: "border-sky-200 text-sky-900 bg-sky-50",
    }
  }

  return {
    bucket: "unassigned",
    dealerLabel: "Unassigned",
    statusLabel: "Pending",
    statusBadgeClassName: "border-amber-200 text-amber-900 bg-amber-50",
  }
}

/** Normalize API counts — preserve three buckets; derive missing unassigned from invariant. */
export const normalizeHrUploadCountsForHrView = (counts: {
  rowCount: number
  assigned?: number
  unassigned?: number
  completed?: number
}) => {
  const rowCount = Math.max(0, counts.rowCount)
  const completed = Math.min(rowCount, Math.max(0, counts.completed ?? 0))
  const assigned = Math.min(rowCount - completed, Math.max(0, counts.assigned ?? 0))
  const unassignedExplicit = counts.unassigned
  const unassigned =
    unassignedExplicit !== undefined
      ? Math.min(rowCount - completed - assigned, Math.max(0, unassignedExplicit))
      : Math.max(0, rowCount - completed - assigned)
  return { rowCount, assigned, unassigned, completed }
}

const isUploadSeedAssignedCountArtifact = (
  rowCount: number,
  assigned: number,
  unassigned: number,
  completed: number,
) => rowCount > 0 && assigned === rowCount && unassigned === 0 && completed === 0

const sanitizeHrUploadApiCounts = (counts: {
  rowCount: number
  assigned: number
  unassigned: number
  completed: number
}) => {
  if (isUploadSeedAssignedCountArtifact(counts.rowCount, counts.assigned, counts.unassigned, counts.completed)) {
    return normalizeHrUploadCountsForHrView({ rowCount: counts.rowCount, assigned: 0, unassigned: counts.rowCount, completed: 0 })
  }
  return normalizeHrUploadCountsForHrView(counts)
}

const reconcileCountsWithSampleRows = (
  counts: { assigned: number; unassigned: number; completed: number; rowCount: number },
  rows: HrUploadLeadRow[],
) => {
  if (rows.length === 0) {
    return normalizeHrUploadCountsForHrView(counts)
  }

  const sample = computeHrUploadLeadCounts(rows)
  const sampleAllUnassignedPending =
    sample.unassigned === rows.length && sample.assigned === 0 && sample.completed === 0

  if (
    sampleAllUnassignedPending &&
    isUploadSeedAssignedCountArtifact(counts.rowCount, counts.assigned, counts.unassigned, counts.completed)
  ) {
    return normalizeHrUploadCountsForHrView({
      rowCount: counts.rowCount,
      assigned: 0,
      unassigned: counts.rowCount,
      completed: 0,
    })
  }

  if (counts.rowCount > 0 && rows.length >= counts.rowCount) {
    return { ...sample, rowCount: counts.rowCount }
  }

  return normalizeHrUploadCountsForHrView({
    rowCount: counts.rowCount,
    assigned: counts.assigned,
    unassigned: counts.unassigned,
    completed: counts.completed,
  })
}

const parseOptionalCount = (value: unknown) => {
  const n = Number(value)
  return Number.isFinite(n) && n >= 0 ? n : undefined
}

export const extractHrUploadCountsFromApi = (apiItem?: Record<string, unknown> | null) => {
  if (!apiItem) return null
  const rowCount = parseOptionalCount(apiItem.rowCount ?? apiItem.totalRows ?? apiItem.count)
  const assigned = parseOptionalCount(
    apiItem.assignedCount ?? (apiItem.counts as { assigned?: number })?.assigned,
  )
  const unassigned = parseOptionalCount(
    apiItem.unassignedCount ?? (apiItem.counts as { unassigned?: number })?.unassigned,
  )
  const completed = parseOptionalCount(
    apiItem.completedCount ?? (apiItem.counts as { completed?: number })?.completed,
  )
  if (rowCount === undefined && assigned === undefined && unassigned === undefined && completed === undefined) {
    return null
  }
  const resolvedRowCount = rowCount ?? 0
  return sanitizeHrUploadApiCounts({
    rowCount: resolvedRowCount,
    assigned: assigned ?? 0,
    unassigned: unassigned ?? 0,
    completed: completed ?? 0,
  })
}

export const resolveHrUploadBatchCounts = (
  rows: HrUploadLeadRow[],
  rowCountHint: number,
  apiItem?: Record<string, unknown> | null,
) => {
  const rowCountHintResolved = rowCountHint > 0 ? rowCountHint : rows.length
  const apiCounts = extractHrUploadCountsFromApi(apiItem)
  const rowCount = apiCounts?.rowCount || rowCountHintResolved

  if (rows.length > 0 && (rowCount === 0 || rows.length >= rowCount)) {
    const computed = computeHrUploadLeadCounts(rows)
    return { ...computed, rowCount: rowCount || rows.length }
  }

  if (apiCounts && rowCount > 0) {
    return reconcileCountsWithSampleRows(
      {
        assigned: apiCounts.assigned,
        unassigned: apiCounts.unassigned,
        completed: apiCounts.completed,
        rowCount,
      },
      rows,
    )
  }

  if (rows.length > 0) {
    const computed = computeHrUploadLeadCounts(rows)
    return { ...computed, rowCount: rowCount || rows.length }
  }

  return normalizeHrUploadCountsForHrView({ rowCount, assigned: 0, unassigned: rowCount, completed: 0 })
}
