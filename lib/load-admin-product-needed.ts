import type { Dealer } from "@/lib/auth-context"
import { api, ApiError } from "@/lib/api"
import type { Quotation } from "@/lib/quotation-context"
import {
  buildProductNeededApiFilters,
  buildProductNeededRow,
  extractProductNeededFromApiResponse,
  filterProductNeededRows,
  filterQuotationsForProductNeeded,
  isProductNeededCustomRangePending,
  type ProductNeededApiFilters,
  type ProductNeededDateRange,
  type ProductNeededFilterOptions,
  type ProductNeededRow,
} from "@/lib/admin-product-needed"

export type AdminProductNeededLoadSource = "admin_product_needed" | "quotations" | "local" | "none"

export interface AdminProductNeededLoadResult {
  rows: ProductNeededRow[]
  source: AdminProductNeededLoadSource
  /** True when API mode is on but no endpoint or data path worked. */
  unavailable: boolean
  /** Custom range selected but from/to not set yet. */
  customRangePending: boolean
}

export interface AdminProductNeededLoadOptions {
  quotations: Quotation[]
  dealers: Dealer[]
  useApi: boolean
  getDealerName: (dealerId: string, quotation?: Quotation) => string
  dealerId: string
  search: string
  dateRange: ProductNeededDateRange
  customFrom: string
  customTo: string
}

function toSharedFilters(
  filters: Omit<AdminProductNeededLoadOptions, "quotations" | "dealers" | "useApi" | "getDealerName">,
): ProductNeededFilterOptions {
  return {
    dealerId: filters.dealerId,
    search: filters.search,
    dateRange: filters.dateRange,
    customFrom: filters.customFrom,
    customTo: filters.customTo,
  }
}

function buildRowsFromQuotations(
  quotationList: Quotation[],
  filters: Omit<AdminProductNeededLoadOptions, "quotations" | "dealers" | "useApi" | "getDealerName">,
  getDealerName: (dealerId: string, quotation?: Quotation) => string,
): ProductNeededRow[] {
  return filterQuotationsForProductNeeded(quotationList, toSharedFilters(filters)).map((quotation) =>
    buildProductNeededRow(quotation, getDealerName(quotation.dealerId, quotation)),
  )
}

function applyClientFiltersToApiRows(
  rows: ProductNeededRow[],
  filters: Omit<AdminProductNeededLoadOptions, "quotations" | "dealers" | "useApi" | "getDealerName">,
): ProductNeededRow[] {
  return filterProductNeededRows(rows, toSharedFilters(filters))
}

async function tryAdminProductNeededEndpoint(
  filters: ProductNeededApiFilters,
): Promise<ReturnType<typeof extractProductNeededFromApiResponse> | null> {
  try {
    const response = await api.admin.productNeeded.getAll(filters)
    return extractProductNeededFromApiResponse(response)
  } catch (error) {
    if (
      error instanceof ApiError &&
      (error.code === "HTTP_404" || error.code === "HTTP_405" || error.code === "HTTP_501")
    ) {
      return null
    }
    throw error
  }
}

function loadFromLocalStorage(
  dealers: Dealer[],
  options: Omit<AdminProductNeededLoadOptions, "quotations" | "useApi">,
): ProductNeededRow[] {
  const allQuotations = JSON.parse(localStorage.getItem("quotations") || "[]") as Quotation[]
  void dealers
  return buildRowsFromQuotations(allQuotations, options, options.getDealerName)
}

async function fetchQuotationListFallback(existing: Quotation[]): Promise<Quotation[]> {
  if (existing.length > 0) return existing
  try {
    const response = await api.admin.quotations.getAll({ page: 1, limit: 2000 })
    const raw = (response as Record<string, unknown>)?.quotations
    return Array.isArray(raw)
      ? (raw.map((q) => ({
          ...(q as Quotation),
          id: String((q as Quotation).id || ""),
          customer: ((q as Quotation).customer || {}) as Quotation["customer"],
          dealerId: String((q as Quotation).dealerId || ""),
        })) as Quotation[])
      : []
  } catch {
    return []
  }
}

export async function loadAdminProductNeededRows(
  options: AdminProductNeededLoadOptions,
): Promise<AdminProductNeededLoadResult> {
  const { quotations, dealers, useApi, getDealerName, ...filters } = options
  const customRangePending = isProductNeededCustomRangePending(
    filters.dateRange,
    filters.customFrom,
    filters.customTo,
  )

  if (customRangePending) {
    return {
      rows: [],
      source: useApi ? "quotations" : "local",
      unavailable: false,
      customRangePending: true,
    }
  }

  const apiFilters = buildProductNeededApiFilters(filters)

  if (!useApi) {
    return {
      rows: loadFromLocalStorage(dealers, { ...filters, dealers, getDealerName }),
      source: "local",
      unavailable: false,
      customRangePending: false,
    }
  }

  let quotationList = quotations

  const fromAdmin = await tryAdminProductNeededEndpoint(apiFilters)
  if (fromAdmin !== null) {
    quotationList = await fetchQuotationListFallback(quotationList)
    // Prefer quotation list so panel/inverter totals use structured product fields
    // and the installation-pending gate matches Admin → Pending Installation.
    const rows =
      quotationList.length > 0
        ? buildRowsFromQuotations(quotationList, filters, getDealerName)
        : applyClientFiltersToApiRows(fromAdmin.rows, filters)

    return {
      rows,
      source: quotationList.length > 0 ? "quotations" : "admin_product_needed",
      unavailable: false,
      customRangePending: false,
    }
  }

  quotationList = await fetchQuotationListFallback(quotationList)

  if (quotationList.length > 0) {
    return {
      rows: buildRowsFromQuotations(quotationList, filters, getDealerName),
      source: "quotations",
      unavailable: false,
      customRangePending: false,
    }
  }

  return {
    rows: [],
    source: "none",
    unavailable: true,
    customRangePending: false,
  }
}
