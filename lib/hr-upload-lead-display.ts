/**
 * HR Uploaded Lead Data — table labels, status badges, and batch counts.
 *
 * HR view uses two buckets only:
 * - Completed: dealer assigned AND call finished → dealer name + Completed
 * - Unassigned: everything else → Unassigned + Pending (includes in-queue / assigned-but-not-done)
 */

export type HrUploadLeadRow = {
  assignedDealerId?: string
  assignedDealerName?: string
  assignmentStatus?: string
}

export type HrLeadCountBucket = "unassigned" | "completed"

export type HrLeadRowDisplay = {
  bucket: HrLeadCountBucket
  dealerLabel: string
  statusLabel: string
  statusBadgeClassName: string
}

export const HR_UPLOAD_COUNT_LEGEND =
  "Completed = dealer assigned and call finished • Unassigned + Pending = not completed yet (waiting or in progress)"

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

export const classifyHrUploadLeadBucket = (row: HrUploadLeadRow): HrLeadCountBucket =>
  isHrUploadLeadCompleted(row) ? "completed" : "unassigned"

export const computeHrUploadLeadCounts = (rows: HrUploadLeadRow[]) => {
  const counts = { assigned: 0, unassigned: 0, completed: 0 }
  for (const row of rows) {
    if (isHrUploadLeadCompleted(row)) {
      counts.completed += 1
    } else {
      counts.unassigned += 1
    }
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

  return {
    bucket: "unassigned",
    dealerLabel: "Unassigned",
    statusLabel: "Pending",
    statusBadgeClassName: "border-amber-200 text-amber-900 bg-amber-50",
  }
}

/** HR summary: only Unassigned + Completed (assigned middle bucket not used). */
export const normalizeHrUploadCountsForHrView = (counts: {
  rowCount: number
  assigned?: number
  unassigned?: number
  completed?: number
}) => {
  const rowCount = counts.rowCount
  const completed = Math.min(rowCount, Math.max(0, counts.completed ?? 0))
  const unassigned = Math.max(0, rowCount - completed)
  return { rowCount, assigned: 0, unassigned, completed }
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
    return normalizeHrUploadCountsForHrView({ rowCount: counts.rowCount, completed: 0 })
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
    sample.unassigned === rows.length && sample.completed === 0

  if (
    sampleAllUnassignedPending &&
    isUploadSeedAssignedCountArtifact(counts.rowCount, counts.assigned, counts.unassigned, counts.completed)
  ) {
    return normalizeHrUploadCountsForHrView({ rowCount: counts.rowCount, completed: 0 })
  }

  if (counts.rowCount > 0 && rows.length >= counts.rowCount) {
    return { ...sample, rowCount: counts.rowCount }
  }

  return normalizeHrUploadCountsForHrView({
    rowCount: counts.rowCount,
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
  const completed = parseOptionalCount(apiItem.completedCount ?? (apiItem.counts as { completed?: number })?.completed)
  if (rowCount === undefined && completed === undefined) return null
  const resolvedRowCount = rowCount ?? 0
  const resolvedCompleted = completed ?? 0
  return sanitizeHrUploadApiCounts({
    rowCount: resolvedRowCount,
    assigned: 0,
    unassigned: 0,
    completed: resolvedCompleted,
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
        assigned: 0,
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

  return normalizeHrUploadCountsForHrView({ rowCount, completed: 0 })
}
