import {
  extractQuotationListFromApiResponse,
  extractQuotationListTotalFromApiResponse,
} from "./operational-install-queue"

function extractPaginationTotalPages(response: unknown): number | null {
  if (!response || typeof response !== "object") return null
  const root = response as Record<string, unknown>
  const nested =
    root.data && typeof root.data === "object" && !Array.isArray(root.data)
      ? (root.data as Record<string, unknown>)
      : null
  const pagination = (root.pagination ?? nested?.pagination) as Record<string, unknown> | undefined
  const totalPages = Number(pagination?.totalPages)
  return Number.isFinite(totalPages) && totalPages > 0 ? totalPages : null
}

/** Fetches every page from a paginated quotations list API (default page size 1000). */
export async function fetchAllPaginatedQuotationListPages(
  fetchPage: (page: number, limit: number) => Promise<unknown>,
  options?: { pageSize?: number; maxPages?: number },
): Promise<{ rows: unknown[]; total: number | null }> {
  const pageSize = options?.pageSize ?? 1000
  const maxPages = options?.maxPages ?? 50

  const firstResponse = await fetchPage(1, pageSize)
  const allRows = [...extractQuotationListFromApiResponse(firstResponse)]
  let total = extractQuotationListTotalFromApiResponse(firstResponse)
  const totalPages = extractPaginationTotalPages(firstResponse)

  if (totalPages != null && totalPages > 1) {
    for (let page = 2; page <= Math.min(totalPages, maxPages); page++) {
      const response = await fetchPage(page, pageSize)
      allRows.push(...extractQuotationListFromApiResponse(response))
    }
  } else if (allRows.length === pageSize && (total == null || total > allRows.length)) {
    let page = 2
    while (page <= maxPages) {
      const response = await fetchPage(page, pageSize)
      const rows = extractQuotationListFromApiResponse(response)
      if (rows.length === 0) break
      allRows.push(...rows)
      if (rows.length < pageSize) break
      page++
    }
  }

  const resolvedTotal = Math.max(total ?? 0, allRows.length) || (allRows.length > 0 ? allRows.length : null)
  return { rows: allRows, total: resolvedTotal }
}
