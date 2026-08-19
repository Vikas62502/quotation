import type { Dealer } from "@/lib/auth-context"
import { api } from "@/lib/api"
import type { Quotation } from "@/lib/quotation-context"
import {
  buildProductNeededApiFilters,
  buildProductNeededRow,
  extractProductNeededFromApiResponse,
  filterProductNeededRows,
  filterQuotationsForProductNeeded,
  isProductNeededCustomRangePending,
  isQuotationEligibleForProductNeededFileLogin,
  type ProductNeededApiFilters,
  type ProductNeededDateRange,
  type ProductNeededFilterOptions,
  type ProductNeededRow,
  type ProductNeededScope,
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
  scope?: ProductNeededScope
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
    scope: filters.scope,
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

function apiResponseMatchesScope(
  extracted: ReturnType<typeof extractProductNeededFromApiResponse>,
  expected: ProductNeededScope,
): boolean {
  const returned = String(extracted.scope || "").toLowerCase()
  if (expected === "installation_pending") {
    return !returned || returned === "installation_pending"
  }
  return returned === expected
}

async function tryAdminProductNeededEndpoint(
  filters: ProductNeededApiFilters,
): Promise<ReturnType<typeof extractProductNeededFromApiResponse> | null> {
  try {
    const response = await api.admin.productNeeded.getAll(filters, { suppressErrorLog: true })
    const extracted = extractProductNeededFromApiResponse(response)
    const expected = filters.scope === "file_login" ? "file_login" : "installation_pending"
    if (!apiResponseMatchesScope(extracted, expected)) return null
    return extracted
  } catch {
    return null
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

async function fetchQuotationListFallback(
  existing: Quotation[],
  scope: ProductNeededScope = "installation_pending",
): Promise<Quotation[]> {
  if (existing.length > 0) {
    if (scope !== "file_login") return existing
    if (existing.some((quotation) => isQuotationEligibleForProductNeededFileLogin(quotation))) {
      return existing
    }
  }
  try {
    const response = await api.admin.quotations.getAll({
      page: 1,
      limit: 2000,
      ...(scope === "file_login" ? { status: "pending" } : {}),
    })
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

  const fromAdmin = await tryAdminProductNeededEndpoint(apiFilters)
  if (fromAdmin && fromAdmin.rows.length > 0) {
    return {
      rows: applyClientFiltersToApiRows(fromAdmin.rows, filters),
      source: "admin_product_needed",
      unavailable: false,
      customRangePending: false,
    }
  }

  const quotationList = await fetchQuotationListFallback(quotations, filters.scope)
  const quotationRows = buildRowsFromQuotations(quotationList, filters, getDealerName)
  if (quotationRows.length > 0) {
    return {
      rows: quotationRows,
      source: "quotations",
      unavailable: false,
      customRangePending: false,
    }
  }

  if (fromAdmin) {
    return {
      rows: applyClientFiltersToApiRows(fromAdmin.rows, filters),
      source: "admin_product_needed",
      unavailable: false,
      customRangePending: false,
    }
  }

  return {
    rows: [],
    source: "none",
    unavailable: false,
    customRangePending: false,
  }
}
