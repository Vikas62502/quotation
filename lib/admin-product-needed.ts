import type { Quotation } from "@/lib/quotation-context"
import { formatPersonName } from "@/lib/name-display"
import { mergeQuotationProductSources } from "@/lib/merge-quotation-products"
import { getQuotationSystemKwFromProducts } from "@/lib/quotation-system-kw"
import { gatherInstallationPublicImageUrls } from "@/lib/installation-public-images"
import {
  isInstallationApprovedForAdminTab,
  type OperationalQuotationRecord,
} from "@/lib/operational-install-queue"
import {
  boundsToApiIsoRange,
  getCustomBoundsFromYmd,
  getPresetBounds,
} from "@/lib/calling-report-date-range"

export type ProductNeededTab = "file_login" | "login_approved"

export type ProductNeededDateRange =
  | "all"
  | "today"
  | "yesterday"
  | "this_week"
  | "this_month"
  | "last_month"
  | "custom"

export type ProductNeededRow = {
  quotationId: string
  dealerId?: string
  customerName: string
  customerMobile: string
  dealerName: string
  systemKw: string
  systemType: string
  panels: string
  inverter: string
  fileLoginAt?: string
  fileLoginStatus?: string
  statusApprovedAt?: string
  quotationStatus?: string
}

function hasFileLogin(quotation: Quotation): boolean {
  const status = String(quotation.fileLoginStatus || "").toLowerCase()
  if (status === "already_login" || status === "login_now") return true
  return Boolean(quotation.fileLoginAt?.trim())
}

function isLoginApproved(quotation: Quotation): boolean {
  return hasFileLogin(quotation) && String(quotation.status || "").toLowerCase() === "approved"
}

/** Installation approved and/or completion images uploaded (Approved Installation tab rules). */
export function isQuotationEligibleForProductNeeded(
  quotation: Quotation | Record<string, unknown>,
): boolean {
  const record = quotation as Record<string, unknown>
  const imageUrlCount = gatherInstallationPublicImageUrls(record).length
  return isInstallationApprovedForAdminTab(quotation as OperationalQuotationRecord, {
    imageUrlCount,
  })
}

function formatPanelLine(brand?: string, size?: string, quantity?: number): string {
  const b = String(brand || "").trim()
  const s = String(size || "").trim()
  const q = quantity && quantity > 0 ? quantity : 0
  if (!b && !s && !q) return ""
  const parts = [b, s].filter(Boolean).join(" ")
  if (q > 0) return parts ? `${parts} × ${q}` : `× ${q}`
  return parts || "—"
}

function buildPanelsSummary(products: Record<string, unknown>): string {
  const systemType = String(products.systemType || "").toLowerCase()

  if (systemType === "both") {
    const dcr = formatPanelLine(
      String(products.dcrPanelBrand || ""),
      String(products.dcrPanelSize || ""),
      Number(products.dcrPanelQuantity) || 0,
    )
    const nonDcr = formatPanelLine(
      String(products.nonDcrPanelBrand || ""),
      String(products.nonDcrPanelSize || ""),
      Number(products.nonDcrPanelQuantity) || 0,
    )
    const lines: string[] = []
    if (dcr) lines.push(`DCR: ${dcr}`)
    if (nonDcr) lines.push(`Non-DCR: ${nonDcr}`)
    return lines.length > 0 ? lines.join(" | ") : "—"
  }

  if (systemType === "customize" && Array.isArray(products.customPanels)) {
    const lines = (products.customPanels as Array<{ brand?: string; size?: string; quantity?: number }>)
      .map((panel) => formatPanelLine(panel.brand, panel.size, panel.quantity))
      .filter(Boolean)
    return lines.length > 0 ? lines.join(" | ") : "—"
  }

  const primary = formatPanelLine(
    String(products.panelBrand || products.dcrPanelBrand || ""),
    String(products.panelSize || products.dcrPanelSize || ""),
    Number(products.panelQuantity || products.dcrPanelQuantity) || 0,
  )
  return primary || "—"
}

function buildInverterSummary(products: Record<string, unknown>): string {
  const brand = String(products.inverterBrand || "").trim()
  const size = String(products.inverterSize || "").trim()
  if (brand && size) return `${brand} · ${size}`
  return brand || size || "—"
}

function fileLoginStatusLabel(status?: string): string {
  const raw = String(status || "").toLowerCase()
  if (raw === "already_login") return "Already logged in"
  if (raw === "login_now") return "Login now"
  return raw ? raw : "—"
}

export function buildProductNeededRow(
  quotation: Quotation,
  dealerName: string,
): ProductNeededRow {
  const products = mergeQuotationProductSources(quotation) as Record<string, unknown>
  const kw = getQuotationSystemKwFromProducts(products)
  const systemType = String(products.systemType || "—").toUpperCase()

  return {
    quotationId: quotation.id,
    dealerId: quotation.dealerId,
    customerName: formatPersonName(
      quotation.customer?.firstName,
      quotation.customer?.lastName,
      "Unknown",
    ),
    customerMobile: quotation.customer?.mobile || "—",
    dealerName: dealerName || "—",
    systemKw: kw > 0 ? `${kw}kW` : "—",
    systemType,
    panels: buildPanelsSummary(products),
    inverter: buildInverterSummary(products),
    fileLoginAt: quotation.fileLoginAt,
    fileLoginStatus: fileLoginStatusLabel(quotation.fileLoginStatus),
    statusApprovedAt: quotation.statusApprovedAt,
    quotationStatus: quotation.status,
  }
}

export type ProductNeededFilterOptions = {
  dealerId?: string
  search?: string
  dateRange?: ProductNeededDateRange
  customFrom?: string
  customTo?: string
  dateField?: "file_login" | "approved"
}

function readInstallerApprovedAt(quotation: Quotation | Record<string, unknown>): string | undefined {
  const q = quotation as Record<string, unknown>
  const raw = q.installerApprovedAt ?? q.installer_approved_at
  return typeof raw === "string" && raw.trim() ? raw.trim() : undefined
}

export function getProductNeededDateBounds(
  dateRange: ProductNeededDateRange,
  customFrom: string,
  customTo: string,
): { start: Date; end: Date } | null {
  if (dateRange === "all") return null

  if (dateRange === "custom") {
    return getCustomBoundsFromYmd(customFrom, customTo)
  }

  if (dateRange === "yesterday") {
    const now = new Date()
    const start = new Date(now)
    start.setDate(start.getDate() - 1)
    start.setHours(0, 0, 0, 0)
    const end = new Date(start)
    end.setHours(23, 59, 59, 999)
    return { start, end }
  }

  const preset =
    dateRange === "today"
      ? "daily"
      : dateRange === "this_week"
        ? "weekly"
        : dateRange === "this_month"
          ? "monthly"
          : "last_month"
  return getPresetBounds(preset)
}

export function isProductNeededCustomRangePending(
  dateRange: ProductNeededDateRange,
  customFrom: string,
  customTo: string,
): boolean {
  return dateRange === "custom" && !getProductNeededDateBounds(dateRange, customFrom, customTo)
}

function getProductNeededDateIso(
  quotation: Quotation,
  dateField: "file_login" | "approved",
): string | undefined {
  if (dateField === "approved") {
    return quotation.statusApprovedAt ?? (quotation as Record<string, unknown>).approvedAt as string | undefined
  }
  return (
    quotation.fileLoginAt ??
    ((quotation as Record<string, unknown>).file_login_at as string | undefined) ??
    readInstallerApprovedAt(quotation)
  )
}

function getProductNeededRowDateIso(
  row: ProductNeededRow,
  dateField: "file_login" | "approved",
): string | undefined {
  if (dateField === "approved") return row.statusApprovedAt
  return row.fileLoginAt
}

function matchesDateRange(
  isoDate: string | undefined,
  range: ProductNeededDateRange,
  customFrom: string,
  customTo: string,
): boolean {
  if (range === "all") return true
  const bounds = getProductNeededDateBounds(range, customFrom, customTo)
  if (!bounds) return false
  if (!isoDate) return false
  const date = new Date(isoDate)
  if (Number.isNaN(date.getTime())) return false
  return date >= bounds.start && date <= bounds.end
}

export function filterQuotationsForProductNeeded(
  quotations: Quotation[],
  tab: ProductNeededTab,
  options: ProductNeededFilterOptions = {},
): Quotation[] {
  const {
    dealerId = "all",
    search = "",
    dateRange = "all",
    customFrom = "",
    customTo = "",
    dateField = tab === "login_approved" ? "approved" : "file_login",
  } = options

  if (isProductNeededCustomRangePending(dateRange, customFrom, customTo)) {
    return []
  }

  const normalizedSearch = search.trim().toLowerCase()

  return quotations.filter((quotation) => {
    if (!isQuotationEligibleForProductNeeded(quotation)) return false
    if (tab === "file_login" && !hasFileLogin(quotation)) return false
    if (tab === "login_approved" && !isLoginApproved(quotation)) return false

    if (dealerId !== "all" && quotation.dealerId !== dealerId) return false

    const dateIso = getProductNeededDateIso(quotation, dateField)
    if (!matchesDateRange(dateIso, dateRange, customFrom, customTo)) return false

    if (!normalizedSearch) return true

    const haystack = [
      quotation.id,
      quotation.customer?.firstName,
      quotation.customer?.lastName,
      quotation.customer?.mobile,
      quotation.dealerId,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()

    return haystack.includes(normalizedSearch)
  })
}

export function filterProductNeededRows(
  rows: ProductNeededRow[],
  tab: ProductNeededTab,
  options: ProductNeededFilterOptions = {},
): ProductNeededRow[] {
  const {
    dealerId = "all",
    search = "",
    dateRange = "all",
    customFrom = "",
    customTo = "",
    dateField = tab === "login_approved" ? "approved" : "file_login",
  } = options

  if (isProductNeededCustomRangePending(dateRange, customFrom, customTo)) {
    return []
  }

  const normalizedSearch = search.trim().toLowerCase()

  return rows.filter((row) => {
    if (dealerId !== "all" && row.dealerId !== dealerId) return false

    const dateIso = getProductNeededRowDateIso(row, dateField)
    if (!matchesDateRange(dateIso, dateRange, customFrom, customTo)) return false

    if (!normalizedSearch) return true

    const haystack = [row.quotationId, row.customerName, row.customerMobile, row.dealerName]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()

    return haystack.includes(normalizedSearch)
  })
}

function sharedProductNeededFilterOptions(
  filters: Pick<
    ProductNeededFilterOptions,
    "dealerId" | "search" | "dateRange" | "customFrom" | "customTo"
  >,
): Omit<ProductNeededFilterOptions, "dateField"> {
  return {
    dealerId: filters.dealerId,
    search: filters.search,
    dateRange: filters.dateRange,
    customFrom: filters.customFrom,
    customTo: filters.customTo,
  }
}

export function productNeededRowsToCsv(rows: ProductNeededRow[], tab: ProductNeededTab): string {
  const headers =
    tab === "login_approved"
      ? [
          "Quotation ID",
          "Customer",
          "Mobile",
          "Dealer",
          "System kW",
          "System Type",
          "Panels",
          "Inverter",
          "File Login Status",
          "File Login Date",
          "Approved Date",
        ]
      : [
          "Quotation ID",
          "Customer",
          "Mobile",
          "Dealer",
          "System kW",
          "System Type",
          "Panels",
          "Inverter",
          "File Login Status",
          "File Login Date",
        ]

  const escape = (value: unknown) => {
    const raw = String(value ?? "")
    return `"${raw.replace(/"/g, '""')}"`
  }

  const dataRows = rows.map((row) => {
    const base = [
      row.quotationId,
      row.customerName,
      row.customerMobile,
      row.dealerName,
      row.systemKw,
      row.systemType,
      row.panels,
      row.inverter,
      row.fileLoginStatus || "",
      row.fileLoginAt ? new Date(row.fileLoginAt).toLocaleString("en-IN") : "",
    ]
    if (tab === "login_approved") {
      base.push(row.statusApprovedAt ? new Date(row.statusApprovedAt).toLocaleString("en-IN") : "")
    }
    return base
  })

  return [headers, ...dataRows].map((row) => row.map(escape).join(",")).join("\n")
}

export function formatProductNeededDate(value?: string): string {
  if (!value) return "—"
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export type ProductNeededTabCounts = {
  fileLogin: number
  loginApproved: number
}

export type ProductNeededApiFilters = {
  tab: ProductNeededTab
  dealerId?: string
  search?: string
  startDate?: string
  endDate?: string
  dateField?: "file_login" | "approved"
  page?: number
  limit?: number
}

export function buildProductNeededDateBounds(
  dateRange: ProductNeededDateRange,
  customFrom: string,
  customTo: string,
): { startDate?: string; endDate?: string } {
  const bounds = getProductNeededDateBounds(dateRange, customFrom, customTo)
  if (!bounds) return {}
  return boundsToApiIsoRange(bounds)
}

export function buildProductNeededApiFilters(options: {
  tab: ProductNeededTab
  dealerId: string
  search: string
  dateRange: ProductNeededDateRange
  customFrom: string
  customTo: string
}): ProductNeededApiFilters {
  const { startDate, endDate } = buildProductNeededDateBounds(
    options.dateRange,
    options.customFrom,
    options.customTo,
  )

  return {
    tab: options.tab,
    dealerId: options.dealerId !== "all" ? options.dealerId : undefined,
    search: options.search.trim() || undefined,
    startDate,
    endDate,
    dateField: options.tab === "login_approved" ? "approved" : "file_login",
    page: 1,
    limit: 2000,
  }
}

export function mapProductNeededRowFromApi(raw: Record<string, unknown>): ProductNeededRow {
  const fileLoginStatusRaw = String(raw.fileLoginStatus ?? raw.file_login_status ?? "").trim()
  return {
    quotationId: String(raw.quotationId ?? raw.quotation_id ?? ""),
    dealerId: String(raw.dealerId ?? raw.dealer_id ?? "") || undefined,
    customerName: String(raw.customerName ?? raw.customer_name ?? "Unknown"),
    customerMobile: String(raw.customerMobile ?? raw.customer_mobile ?? "—"),
    dealerName: String(raw.dealerName ?? raw.dealer_name ?? "—"),
    systemKw: String(raw.systemKw ?? raw.system_kw ?? "—"),
    systemType: String(raw.systemType ?? raw.system_type ?? "—").toUpperCase(),
    panels: String(raw.panels ?? "—"),
    inverter: String(raw.inverter ?? "—"),
    fileLoginAt: (raw.fileLoginAt ?? raw.file_login_at) as string | undefined,
    fileLoginStatus: fileLoginStatusRaw
      ? fileLoginStatusLabel(fileLoginStatusRaw)
      : String(raw.fileLoginStatus ?? raw.file_login_status ?? "—"),
    statusApprovedAt: (raw.statusApprovedAt ?? raw.status_approved_at ?? raw.approvedAt) as
      | string
      | undefined,
    quotationStatus: String(raw.quotationStatus ?? raw.quotation_status ?? raw.status ?? ""),
  }
}

export function extractProductNeededFromApiResponse(response: unknown): {
  rows: ProductNeededRow[]
  tabCounts?: ProductNeededTabCounts
  total?: number
} {
  const body = (response ?? {}) as Record<string, unknown>
  const nested =
    body.data && typeof body.data === "object" && !Array.isArray(body.data)
      ? (body.data as Record<string, unknown>)
      : null
  const data = nested ?? body
  const rowsRaw = data.rows ?? data.productNeeded ?? data.items ?? data.quotations ?? []
  const rows = Array.isArray(rowsRaw)
    ? rowsRaw
        .filter((row) => row && typeof row === "object")
        .map((row) => mapProductNeededRowFromApi(row as Record<string, unknown>))
    : []

  const countsRaw = (data.tabCounts ?? data.tab_counts) as Record<string, unknown> | undefined
  const tabCounts =
    countsRaw && typeof countsRaw === "object"
      ? {
          fileLogin: Number(countsRaw.fileLogin ?? countsRaw.file_login ?? 0),
          loginApproved: Number(countsRaw.loginApproved ?? countsRaw.login_approved ?? 0),
        }
      : undefined

  const pagination = data.pagination as Record<string, unknown> | undefined
  const total = Number(
    pagination?.total ?? data.total ?? data.totalRows ?? data.total_rows ?? rows.length,
  )

  return {
    rows,
    tabCounts,
    total: Number.isFinite(total) ? total : rows.length,
  }
}

export function countProductNeededTabs(
  quotations: Quotation[],
  filters: Omit<ProductNeededFilterOptions, "dateField"> = {},
): ProductNeededTabCounts {
  const shared = sharedProductNeededFilterOptions(filters)
  return {
    fileLogin: filterQuotationsForProductNeeded(quotations, "file_login", {
      ...shared,
      dateField: "file_login",
    }).length,
    loginApproved: filterQuotationsForProductNeeded(quotations, "login_approved", {
      ...shared,
      dateField: "approved",
    }).length,
  }
}
