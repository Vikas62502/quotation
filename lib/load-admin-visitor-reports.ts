import type { Dealer, Visitor } from "@/lib/auth-context"
import { api } from "@/lib/api"
import type { Quotation } from "@/lib/quotation-context"
import {
  extractVisitsFromApiResponse,
  mapVisitToAdminReportRow,
  type AdminVisitReportRow,
  type VisitStatusFilter,
} from "@/lib/visit-report"

export interface AdminVisitorReportFilters {
  status?: VisitStatusFilter
  visitorId?: string
  startDate?: string
  endDate?: string
  search?: string
}

const QUOTATION_VISIT_FETCH_CONCURRENCY = 10

export type AdminVisitorReportLoadSource =
  | "admin_visits"
  | "visits"
  | "quotations"
  | "local"
  | "none"

export interface AdminVisitorReportLoadResult {
  rows: AdminVisitReportRow[]
  source: AdminVisitorReportLoadSource
  /** True when no API path could load visits (show backend setup message). */
  unavailable: boolean
}

const sortReportRows = (rows: AdminVisitReportRow[]) =>
  [...rows].sort((a, b) => {
    const aKey = `${a.date || ""}T${a.time || ""}`
    const bKey = `${b.date || ""}T${b.time || ""}`
    return bKey.localeCompare(aKey)
  })

const buildMapOptions = (
  quotations: Quotation[],
  dealers: Dealer[],
  visitors: Visitor[],
) => {
  const quotationById = new Map(quotations.map((q) => [String(q.id || ""), q]))
  const dealerNameById = new Map(
    dealers.map((d) => [String(d.id || ""), `${d.firstName || ""} ${d.lastName || ""}`.trim()]),
  )
  const visitorNameById = new Map(
    visitors.map((v) => [String(v.id || ""), `${v.firstName || ""} ${v.lastName || ""}`.trim()]),
  )
  return { quotationById, dealerNameById, visitorNameById }
}

const mapVisitRecords = (
  visitsList: Record<string, unknown>[],
  mapOptions: ReturnType<typeof buildMapOptions>,
) => visitsList.map((visit) => mapVisitToAdminReportRow(visit, mapOptions))

async function tryListEndpoint(
  fetcher: () => Promise<unknown>,
): Promise<Record<string, unknown>[] | null> {
  try {
    const response = await fetcher()
    return extractVisitsFromApiResponse(response)
  } catch {
    return null
  }
}

async function aggregateVisitsFromQuotations(
  quotationList: Quotation[],
  mapOptions: ReturnType<typeof buildMapOptions>,
): Promise<{ rows: AdminVisitReportRow[]; anySuccess: boolean }> {
  const rows: AdminVisitReportRow[] = []
  let anySuccess = false

  for (let i = 0; i < quotationList.length; i += QUOTATION_VISIT_FETCH_CONCURRENCY) {
    const chunk = quotationList.slice(i, i + QUOTATION_VISIT_FETCH_CONCURRENCY)
    await Promise.all(
      chunk.map(async (quotation) => {
        const quotationId = String(quotation.id || "").trim()
        if (!quotationId) return

        try {
          const response = await api.visits.getByQuotation(quotationId)
          anySuccess = true
          const visitsList = extractVisitsFromApiResponse(response)
          visitsList.forEach((visit) => {
            rows.push(
              mapVisitToAdminReportRow(
                {
                  ...visit,
                  quotationId,
                  quotation,
                  customer: visit.customer ?? quotation.customer,
                  dealerId: visit.dealerId ?? quotation.dealerId,
                },
                mapOptions,
              ),
            )
          })
        } catch {
          // Per-quotation failure — continue other quotations
        }
      }),
    )
  }

  return { rows, anySuccess }
}

function loadFromLocalStorage(
  mapOptions: ReturnType<typeof buildMapOptions>,
): AdminVisitReportRow[] {
  const allQuotations = JSON.parse(localStorage.getItem("quotations") || "[]") as Quotation[]
  const rows: AdminVisitReportRow[] = []

  allQuotations.forEach((quotation) => {
    const storedVisits = localStorage.getItem(`visits_${quotation.id}`)
    if (!storedVisits) return
    const quotationVisits = JSON.parse(storedVisits) as Record<string, unknown>[]
    quotationVisits.forEach((visit) => {
      rows.push(
        mapVisitToAdminReportRow(
          {
            ...visit,
            quotationId: quotation.id,
            quotation,
          },
          mapOptions,
        ),
      )
    })
  })

  return rows
}

const buildListQueryParams = (filters?: AdminVisitorReportFilters) => {
  const params: Record<string, string | number> = { limit: 2000, status: "all" }
  if (filters?.status && filters.status !== "all") params.status = filters.status
  if (filters?.visitorId && filters.visitorId !== "all") params.visitorId = filters.visitorId
  if (filters?.startDate) params.startDate = filters.startDate
  if (filters?.endDate) params.endDate = filters.endDate
  if (filters?.search?.trim()) params.search = filters.search.trim()
  return params
}

export async function loadAdminVisitorReportRows(options: {
  quotations: Quotation[]
  dealers: Dealer[]
  visitors: Visitor[]
  useApi: boolean
  filters?: AdminVisitorReportFilters
}): Promise<AdminVisitorReportLoadResult> {
  const { quotations, dealers, visitors, useApi, filters } = options
  const mapOptions = buildMapOptions(quotations, dealers, visitors)
  const listParams = buildListQueryParams(filters)

  if (!useApi) {
    return {
      rows: sortReportRows(loadFromLocalStorage(mapOptions)),
      source: "local",
      unavailable: false,
    }
  }

  const fromAdmin = await tryListEndpoint(() => api.admin.visits.getAll(listParams))
  if (fromAdmin !== null) {
    return {
      rows: sortReportRows(mapVisitRecords(fromAdmin, mapOptions)),
      source: "admin_visits",
      unavailable: false,
    }
  }

  const fromVisits = await tryListEndpoint(() => api.visits.getAll(listParams))
  if (fromVisits !== null) {
    return {
      rows: sortReportRows(mapVisitRecords(fromVisits, mapOptions)),
      source: "visits",
      unavailable: false,
    }
  }

  let quotationList = quotations
  if (quotationList.length === 0) {
    try {
      const response = await api.admin.quotations.getAll({ page: 1, limit: 1000 })
      quotationList = (response?.quotations || []).map((q: Record<string, unknown>) => ({
        ...q,
        id: String(q.id || ""),
        customer: (q.customer as Quotation["customer"]) || {},
        dealerId: String(q.dealerId || ""),
      })) as Quotation[]
    } catch {
      quotationList = []
    }
  }

  const { rows, anySuccess } = await aggregateVisitsFromQuotations(quotationList, mapOptions)
  if (anySuccess || quotationList.length > 0) {
    return {
      rows: sortReportRows(rows),
      source: "quotations",
      unavailable: false,
    }
  }

  return {
    rows: [],
    source: "none",
    unavailable: true,
  }
}
