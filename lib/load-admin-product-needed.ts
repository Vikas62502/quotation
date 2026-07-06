import type { Dealer } from "@/lib/auth-context"
import { api, ApiError } from "@/lib/api"
import type { Quotation } from "@/lib/quotation-context"
import {
  buildProductNeededApiFilters,
  buildProductNeededRow,
  countProductNeededTabs,
  extractProductNeededFromApiResponse,
  filterProductNeededRows,
  filterQuotationsForProductNeeded,
  isProductNeededCustomRangePending,
  type ProductNeededApiFilters,
  type ProductNeededDateRange,
  type ProductNeededFilterOptions,
  type ProductNeededRow,
  type ProductNeededTab,
  type ProductNeededTabCounts,
} from "@/lib/admin-product-needed"

export type AdminProductNeededLoadSource = "admin_product_needed" | "quotations" | "local" | "none"

export interface AdminProductNeededLoadResult {
  rows: ProductNeededRow[]
  tabCounts: ProductNeededTabCounts
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
  tab: ProductNeededTab
  dealerId: string
  search: string
  dateRange: ProductNeededDateRange
  customFrom: string
  customTo: string
}

function toSharedFilters(
  filters: Omit<AdminProductNeededLoadOptions, "quotations" | "dealers" | "useApi" | "getDealerName">,
): Omit<ProductNeededFilterOptions, "dateField"> {
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
  tab: ProductNeededTab,
  filters: Omit<AdminProductNeededLoadOptions, "quotations" | "dealers" | "useApi" | "getDealerName">,
  getDealerName: (dealerId: string, quotation?: Quotation) => string,
): ProductNeededRow[] {
  return filterQuotationsForProductNeeded(quotationList, tab, {
    ...toSharedFilters(filters),
    dateField: tab === "login_approved" ? "approved" : "file_login",
  }).map((quotation) => buildProductNeededRow(quotation, getDealerName(quotation.dealerId, quotation)))
}

function applyClientFiltersToApiRows(
  rows: ProductNeededRow[],
  quotationList: Quotation[],
  tab: ProductNeededTab,
  filters: Omit<AdminProductNeededLoadOptions, "quotations" | "dealers" | "useApi" | "getDealerName">,
): ProductNeededRow[] {
  const shared = toSharedFilters(filters)
  const dateField = tab === "login_approved" ? "approved" : "file_login"

  if (quotationList.length > 0) {
    const allowedIds = new Set(
      filterQuotationsForProductNeeded(quotationList, tab, { ...shared, dateField }).map((q) =>
        String(q.id || ""),
      ),
    )
    return rows.filter((row) => allowedIds.has(row.quotationId))
  }

  return filterProductNeededRows(rows, tab, { ...shared, dateField })
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
  tab: ProductNeededTab,
  options: Omit<AdminProductNeededLoadOptions, "quotations" | "useApi">,
): ProductNeededRow[] {
  const allQuotations = JSON.parse(localStorage.getItem("quotations") || "[]") as Quotation[]
  void dealers
  return buildRowsFromQuotations(allQuotations, tab, options, options.getDealerName)
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
  const { quotations, dealers, useApi, getDealerName, tab, ...filters } = options
  const sharedFilters = toSharedFilters({ tab, ...filters })
  const customRangePending = isProductNeededCustomRangePending(
    filters.dateRange,
    filters.customFrom,
    filters.customTo,
  )

  if (customRangePending) {
    const quotationList = useApi ? quotations : (JSON.parse(localStorage.getItem("quotations") || "[]") as Quotation[])
    return {
      rows: [],
      tabCounts: countProductNeededTabs(quotationList, sharedFilters),
      source: useApi ? "admin_product_needed" : "local",
      unavailable: false,
      customRangePending: true,
    }
  }

  const apiFilters = buildProductNeededApiFilters({ tab, ...filters })

  if (!useApi) {
    const allQuotations = JSON.parse(localStorage.getItem("quotations") || "[]") as Quotation[]
    return {
      rows: loadFromLocalStorage(dealers, tab, { ...filters, tab, getDealerName }),
      tabCounts: countProductNeededTabs(allQuotations, sharedFilters),
      source: "local",
      unavailable: false,
      customRangePending: false,
    }
  }

  let quotationList = quotations

  const fromAdmin = await tryAdminProductNeededEndpoint(apiFilters)
  if (fromAdmin !== null) {
    quotationList = await fetchQuotationListFallback(quotationList)

    const rows = applyClientFiltersToApiRows(fromAdmin.rows, quotationList, tab, { tab, ...filters })
    const tabCounts =
      quotationList.length > 0
        ? countProductNeededTabs(quotationList, sharedFilters)
        : (fromAdmin.tabCounts ?? {
            fileLogin: filterProductNeededRows(fromAdmin.rows, "file_login", {
              ...sharedFilters,
              dateField: "file_login",
            }).length,
            loginApproved: filterProductNeededRows(fromAdmin.rows, "login_approved", {
              ...sharedFilters,
              dateField: "approved",
            }).length,
          })

    return {
      rows,
      tabCounts,
      source: "admin_product_needed",
      unavailable: false,
      customRangePending: false,
    }
  }

  quotationList = await fetchQuotationListFallback(quotationList)

  if (quotationList.length > 0) {
    return {
      rows: buildRowsFromQuotations(quotationList, tab, { tab, ...filters }, getDealerName),
      tabCounts: countProductNeededTabs(quotationList, sharedFilters),
      source: "quotations",
      unavailable: false,
      customRangePending: false,
    }
  }

  return {
    rows: [],
    tabCounts: { fileLogin: 0, loginApproved: 0 },
    source: "none",
    unavailable: true,
    customRangePending: false,
  }
}
