import type { Quotation, StatusHistoryEntry } from "@/lib/quotation-context"
import { getJourneyDateRangeBounds, type JourneyDateRangeFilter } from "@/lib/customer-journey"

type QuotationRow = Record<string, unknown>

function parseValidDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === "") return null
  const d = new Date(String(value))
  return Number.isNaN(d.getTime()) ? null : d
}

function approvalTimestampFromHistory(history: StatusHistoryEntry[] | undefined): Date | null {
  if (!history?.length) return null

  const approvedEntries = history
    .map((entry) => {
      const status = String(entry.status || "").toLowerCase()
      if (status !== "approved") return null
      return parseValidDate(entry.at)
    })
    .filter((d): d is Date => d !== null)

  if (approvedEntries.length === 0) return null

  // Earliest transition to approved (first time quotation became approved).
  approvedEntries.sort((a, b) => a.getTime() - b.getTime())
  return approvedEntries[0]
}

/**
 * When the quotation was approved — never uses `createdAt`.
 * Used for Dealers by Revenue, This Month cards, and payment date filters.
 */
export function getQuotationApprovalDate(quotation: Quotation | QuotationRow): Date | null {
  const q = quotation as QuotationRow
  const qTyped = quotation as Quotation

  const direct = parseValidDate(
    qTyped.statusApprovedAt ||
      q.statusApprovedAt ||
      q.status_approved_at ||
      q.approvedAt ||
      q.approved_at ||
      q.approvedDate ||
      q.approved_date,
  )
  if (direct) return direct

  const fromHistory = approvalTimestampFromHistory(qTyped.statusHistory)
  if (fromHistory) return fromHistory

  const rawHistory = q.statusHistory ?? q.status_history ?? q.statusChanges
  if (Array.isArray(rawHistory)) {
    const normalized: StatusHistoryEntry[] = rawHistory
      .map((e: unknown) => {
        const row = e as Record<string, unknown>
        return {
          status: String(row.status ?? row.to ?? row.newStatus ?? "").trim(),
          at: String(row.at ?? row.changedAt ?? row.timestamp ?? "").trim(),
        }
      })
      .filter((e) => e.status && e.at)
    return approvalTimestampFromHistory(normalized)
  }

  return null
}

/** True when quotation was approved within the selected range (approval date only). */
export function matchesQuotationApprovalDateFilter(
  quotation: Quotation,
  filter: JourneyDateRangeFilter,
  customFromYmd: string,
  customToYmd: string,
): boolean {
  if (String(quotation.status || "").toLowerCase() !== "approved") return false

  const approvedDate = getQuotationApprovalDate(quotation)
  if (!approvedDate) return false

  const bounds = getJourneyDateRangeBounds(filter, customFromYmd, customToYmd)
  if (!bounds) return true

  const t = approvedDate.getTime()
  return t >= bounds.start.getTime() && t <= bounds.end.getTime()
}
