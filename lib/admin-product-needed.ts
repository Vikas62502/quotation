import type { Quotation } from "@/lib/quotation-context"
import { formatPersonName } from "@/lib/name-display"
import { mergeQuotationProductSources } from "@/lib/merge-quotation-products"
import { getQuotationSystemKwFromProducts } from "@/lib/quotation-system-kw"
import { gatherInstallationPublicImageUrls } from "@/lib/installation-public-images"
import {
  isInstallationApprovedForAdminTab,
  isInstallationPartialApproved,
  shouldShowInAdminInstallationTab,
  type OperationalQuotationRecord,
} from "@/lib/operational-install-queue"
import {
  boundsToApiIsoRange,
  getCustomBoundsFromYmd,
  getPresetBounds,
} from "@/lib/calling-report-date-range"

export type ProductNeededDateRange =
  | "all"
  | "today"
  | "yesterday"
  | "this_week"
  | "this_month"
  | "last_month"
  | "custom"

export type ProductNeededPanelLine = {
  brand: string
  size: string
  quantity: number
}

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
  panelLines: ProductNeededPanelLine[]
  inverterBrand: string
  inverterSize: string
  inverterQuantity: number
  fileLoginAt?: string
  fileLoginStatus?: string
  statusApprovedAt?: string
  installationReleasedAt?: string
  quotationStatus?: string
}

export type ProductNeededSizeLine = {
  size: string
  quantity: number
  jobCount: number
  /** `sets` when qty is missing / "as per the set" — count 1 per job */
  unit: "panels" | "sets" | "units"
}

/** One card per brand; sizes (540W / 620W / set) listed inside. */
export type ProductNeededBrandCard = {
  key: string
  brand: string
  totalQuantity: number
  jobCount: number
  sizes: ProductNeededSizeLine[]
}

/** @deprecated Prefer ProductNeededBrandCard — kept for any older imports */
export type ProductNeededSkuCard = {
  key: string
  brand: string
  size: string
  quantity: number
  jobCount: number
}

export type ProductNeededDashboard = {
  jobCount: number
  totalPanels: number
  totalInverters: number
  panels: ProductNeededBrandCard[]
  inverters: ProductNeededBrandCard[]
  rows: ProductNeededRow[]
}

/** Installation pending only — same gate as Admin → Pending Installation. */
export function isQuotationEligibleForProductNeeded(
  quotation: Quotation | Record<string, unknown>,
): boolean {
  const record = quotation as OperationalQuotationRecord
  if (!shouldShowInAdminInstallationTab(record)) return false
  if (isInstallationPartialApproved(record)) return false

  const imageUrlCount = gatherInstallationPublicImageUrls(quotation as Record<string, unknown>).length
  if (isInstallationApprovedForAdminTab(record, { imageUrlCount })) return false

  return true
}

function normalizePanelSize(size?: string): string {
  const raw = String(size || "").trim()
  if (!raw) return "—"
  const watt = raw.match(/(\d+(?:\.\d+)?)\s*[Ww]/)
  if (watt) return `${watt[1]}W`
  return raw
}

function normalizeBrand(brand?: string): string {
  const raw = String(brand || "").trim()
  return raw || "—"
}

function formatPanelLine(brand?: string, size?: string, quantity?: number): string {
  const b = normalizeBrand(brand)
  const s = normalizePanelSize(size)
  const q = quantity && quantity > 0 ? quantity : 0
  if (b === "—" && s === "—" && !q) return ""
  const parts = [b !== "—" ? b : "", s !== "—" ? s : ""].filter(Boolean).join(" ")
  if (q > 0) return parts ? `${parts} × ${q}` : `× ${q}`
  return parts || "—"
}

function pushPanelLine(
  lines: ProductNeededPanelLine[],
  brand?: string,
  size?: string,
  quantity?: number,
): void {
  const q = Number(quantity) || 0
  const b = normalizeBrand(brand)
  const s = normalizePanelSize(size)
  if (b === "—" && s === "—" && q <= 0) return
  lines.push({ brand: b, size: s, quantity: q > 0 ? q : 0 })
}

export function extractPanelLines(products: Record<string, unknown>): ProductNeededPanelLine[] {
  const lines: ProductNeededPanelLine[] = []
  const systemType = String(products.systemType || "").toLowerCase()

  if (systemType === "both") {
    pushPanelLine(
      lines,
      String(products.dcrPanelBrand || ""),
      String(products.dcrPanelSize || ""),
      Number(products.dcrPanelQuantity) || 0,
    )
    pushPanelLine(
      lines,
      String(products.nonDcrPanelBrand || ""),
      String(products.nonDcrPanelSize || ""),
      Number(products.nonDcrPanelQuantity) || 0,
    )
    return lines
  }

  if (systemType === "customize" && Array.isArray(products.customPanels)) {
    for (const panel of products.customPanels as Array<{
      brand?: string
      size?: string
      quantity?: number
    }>) {
      pushPanelLine(lines, panel.brand, panel.size, panel.quantity)
    }
    return lines
  }

  pushPanelLine(
    lines,
    String(products.panelBrand || products.dcrPanelBrand || ""),
    String(products.panelSize || products.dcrPanelSize || ""),
    Number(products.panelQuantity || products.dcrPanelQuantity) || 0,
  )
  return lines
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
    const parts: string[] = []
    if (dcr) parts.push(`DCR: ${dcr}`)
    if (nonDcr) parts.push(`Non-DCR: ${nonDcr}`)
    return parts.length > 0 ? parts.join(" | ") : "—"
  }

  if (systemType === "customize" && Array.isArray(products.customPanels)) {
    const parts = (products.customPanels as Array<{ brand?: string; size?: string; quantity?: number }>)
      .map((panel) => formatPanelLine(panel.brand, panel.size, panel.quantity))
      .filter(Boolean)
    return parts.length > 0 ? parts.join(" | ") : "—"
  }

  return (
    formatPanelLine(
      String(products.panelBrand || products.dcrPanelBrand || ""),
      String(products.panelSize || products.dcrPanelSize || ""),
      Number(products.panelQuantity || products.dcrPanelQuantity) || 0,
    ) || "—"
  )
}

function buildInverterSummary(products: Record<string, unknown>): string {
  const brand = normalizeBrand(String(products.inverterBrand || ""))
  const size = String(products.inverterSize || "").trim() || "—"
  if (brand !== "—" && size !== "—") return `${brand} · ${size}`
  if (brand !== "—") return brand
  if (size !== "—") return size
  return "—"
}

/** Parse free-text panel summaries from API rows when structured products are missing. */
export function parsePanelLinesFromSummary(summary: string): ProductNeededPanelLine[] {
  const text = String(summary || "").trim()
  if (!text || text === "—") return []

  const lines: ProductNeededPanelLine[] = []
  const segments = text.split(/\s*\|\s*/)
  const withQty =
    /(?:(?:DCR|Non-?DCR)\s*:\s*)?([A-Za-z][\w./&\-\s]*?)\s+(\d+(?:\.\d+)?\s*[Ww]|As per[^×x]*)\s*[×x]\s*(\d+)/i
  const setOnly =
    /(?:(?:DCR|Non-?DCR)\s*:\s*)?([A-Za-z][\w./&\-\s]*?)\s+(As per[^|]*)/i

  for (const segment of segments) {
    const match = segment.match(withQty)
    if (match) {
      pushPanelLine(lines, match[1], match[2], Number(match[3]) || 0)
      continue
    }
    const setMatch = segment.match(setOnly)
    if (setMatch) {
      pushPanelLine(lines, setMatch[1], setMatch[2], 0)
    }
  }

  return lines
}

export function parseInverterFromSummary(summary: string): {
  brand: string
  size: string
  quantity: number
} {
  const text = String(summary || "").trim()
  if (!text || text === "—") return { brand: "—", size: "—", quantity: 0 }

  const parts = text.split(/\s*[·•\-]\s*/)
  if (parts.length >= 2) {
    return {
      brand: normalizeBrand(parts[0]),
      size: parts.slice(1).join(" · ").trim() || "—",
      quantity: 1,
    }
  }

  return { brand: normalizeBrand(text), size: "—", quantity: 1 }
}

function fileLoginStatusLabel(status?: string): string {
  const raw = String(status || "").toLowerCase()
  if (raw === "already_login") return "Already logged in"
  if (raw === "login_now") return "Login now"
  return raw ? raw : "—"
}

function readInstallationReleasedAt(quotation: Quotation | Record<string, unknown>): string | undefined {
  const q = quotation as Record<string, unknown>
  const raw =
    q.installationReleasedAt ??
    q.installation_released_at ??
    q.statusApprovedAt ??
    q.status_approved_at ??
    q.createdAt ??
    q.created_at
  return typeof raw === "string" && raw.trim() ? raw.trim() : undefined
}

export function buildProductNeededRow(
  quotation: Quotation,
  dealerName: string,
): ProductNeededRow {
  const products = mergeQuotationProductSources(quotation) as Record<string, unknown>
  const kw = getQuotationSystemKwFromProducts(products)
  const systemType = String(products.systemType || "—").toUpperCase()
  const panelLines = extractPanelLines(products)
  const inverterBrand = normalizeBrand(String(products.inverterBrand || ""))
  const inverterSize = String(products.inverterSize || "").trim() || "—"
  const inverterQuantity = inverterBrand !== "—" || inverterSize !== "—" ? 1 : 0

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
    panelLines,
    inverterBrand,
    inverterSize,
    inverterQuantity,
    fileLoginAt: quotation.fileLoginAt,
    fileLoginStatus: fileLoginStatusLabel(quotation.fileLoginStatus),
    statusApprovedAt: quotation.statusApprovedAt,
    installationReleasedAt: readInstallationReleasedAt(quotation),
    quotationStatus: quotation.status,
  }
}

export type ProductNeededFilterOptions = {
  dealerId?: string
  search?: string
  dateRange?: ProductNeededDateRange
  customFrom?: string
  customTo?: string
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
  options: ProductNeededFilterOptions = {},
): Quotation[] {
  const {
    dealerId = "all",
    search = "",
    dateRange = "all",
    customFrom = "",
    customTo = "",
  } = options

  if (isProductNeededCustomRangePending(dateRange, customFrom, customTo)) {
    return []
  }

  const normalizedSearch = search.trim().toLowerCase()

  return quotations.filter((quotation) => {
    if (!isQuotationEligibleForProductNeeded(quotation)) return false
    if (dealerId !== "all" && quotation.dealerId !== dealerId) return false

    const dateIso = readInstallationReleasedAt(quotation)
    if (!matchesDateRange(dateIso, dateRange, customFrom, customTo)) return false

    if (!normalizedSearch) return true

    const products = mergeQuotationProductSources(quotation) as Record<string, unknown>
    const haystack = [
      quotation.id,
      quotation.customer?.firstName,
      quotation.customer?.lastName,
      quotation.customer?.mobile,
      quotation.dealerId,
      buildPanelsSummary(products),
      buildInverterSummary(products),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()

    return haystack.includes(normalizedSearch)
  })
}

export function filterProductNeededRows(
  rows: ProductNeededRow[],
  options: ProductNeededFilterOptions = {},
): ProductNeededRow[] {
  const {
    dealerId = "all",
    search = "",
    dateRange = "all",
    customFrom = "",
    customTo = "",
  } = options

  if (isProductNeededCustomRangePending(dateRange, customFrom, customTo)) {
    return []
  }

  const normalizedSearch = search.trim().toLowerCase()

  return rows.filter((row) => {
    if (dealerId !== "all" && row.dealerId !== dealerId) return false

    const dateIso = row.installationReleasedAt || row.statusApprovedAt || row.fileLoginAt
    if (!matchesDateRange(dateIso, dateRange, customFrom, customTo)) return false

    if (!normalizedSearch) return true

    const haystack = [
      row.quotationId,
      row.customerName,
      row.customerMobile,
      row.dealerName,
      row.panels,
      row.inverter,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()

    return haystack.includes(normalizedSearch)
  })
}

function brandKey(brand: string): string {
  return brand.trim().toLowerCase() || "—"
}

function sizeKey(size: string): string {
  return size.trim().toLowerCase() || "—"
}

/** "As per the set" / package lines — count 1 set per job when panel qty is missing. */
export function isProductNeededSetLine(size: string): boolean {
  const raw = String(size || "").trim().toLowerCase()
  if (!raw || raw === "—") return false
  if (/as\s*per/.test(raw)) return true
  if (/\bset\b/.test(raw) && !/\d+(?:\.\d+)?\s*w/.test(raw)) return true
  return false
}

function resolveLineQuantity(
  quantity: number,
  size: string,
  kind: "panel" | "inverter",
): { quantity: number; unit: ProductNeededSizeLine["unit"] } {
  if (quantity > 0) {
    return { quantity, unit: kind === "panel" ? "panels" : "units" }
  }
  if (isProductNeededSetLine(size)) {
    return { quantity: 1, unit: "sets" }
  }
  if (kind === "inverter" && String(size || "").trim() && String(size).trim() !== "—") {
    return { quantity: 1, unit: "units" }
  }
  return { quantity: 0, unit: kind === "panel" ? "panels" : "units" }
}

type BrandAgg = {
  brand: string
  jobs: Set<string>
  sizes: Map<
    string,
    { size: string; quantity: number; jobs: Set<string>; unit: ProductNeededSizeLine["unit"] }
  >
}

function ensureBrand(map: Map<string, BrandAgg>, brand: string): BrandAgg {
  const key = brandKey(brand)
  let entry = map.get(key)
  if (!entry) {
    entry = { brand: brand.trim() || "—", jobs: new Set(), sizes: new Map() }
    map.set(key, entry)
  }
  return entry
}

function addSizeLine(
  map: Map<string, BrandAgg>,
  brand: string,
  size: string,
  quantity: number,
  unit: ProductNeededSizeLine["unit"],
  quotationId: string,
): void {
  if (quantity <= 0 && brandKey(brand) === "—" && sizeKey(size) === "—") return
  if (quantity <= 0) return

  const brandEntry = ensureBrand(map, brand)
  brandEntry.jobs.add(quotationId)

  const sKey = sizeKey(size)
  const existing = brandEntry.sizes.get(sKey)
  if (existing) {
    existing.quantity += quantity
    existing.jobs.add(quotationId)
    // Prefer sets label if any contribution was set-based
    if (unit === "sets") existing.unit = "sets"
  } else {
    brandEntry.sizes.set(sKey, {
      size: size.trim() || "—",
      quantity,
      jobs: new Set([quotationId]),
      unit,
    })
  }
}

function toBrandCards(map: Map<string, BrandAgg>): ProductNeededBrandCard[] {
  return Array.from(map.entries())
    .map(([key, entry]) => {
      const sizes = Array.from(entry.sizes.values())
        .map((size) => ({
          size: size.size,
          quantity: size.quantity,
          jobCount: size.jobs.size,
          unit: size.unit,
        }))
        .sort(
          (a, b) =>
            b.quantity - a.quantity || a.size.localeCompare(b.size, undefined, { numeric: true }),
        )
      return {
        key,
        brand: entry.brand,
        totalQuantity: sizes.reduce((sum, line) => sum + line.quantity, 0),
        jobCount: entry.jobs.size,
        sizes,
      }
    })
    .sort((a, b) => b.totalQuantity - a.totalQuantity || a.brand.localeCompare(b.brand))
}

export function aggregateProductNeededDashboard(rows: ProductNeededRow[]): ProductNeededDashboard {
  const panelBrands = new Map<string, BrandAgg>()
  const inverterBrands = new Map<string, BrandAgg>()

  for (const row of rows) {
    const panelLines =
      row.panelLines?.length > 0 ? row.panelLines : parsePanelLinesFromSummary(row.panels)

    for (const line of panelLines) {
      if (line.brand === "—" && line.size === "—" && !line.quantity) continue
      const resolved = resolveLineQuantity(line.quantity, line.size, "panel")
      addSizeLine(panelBrands, line.brand, line.size, resolved.quantity, resolved.unit, row.quotationId)
    }

    const parsedInverter = parseInverterFromSummary(row.inverter)
    let inverterBrand = row.inverterBrand || parsedInverter.brand
    let inverterSize = row.inverterSize || parsedInverter.size

    // "As per the set" often lands entirely in brand with empty size
    if (isProductNeededSetLine(inverterBrand) && (inverterSize === "—" || !inverterSize)) {
      inverterSize = inverterBrand
      inverterBrand = "—"
    }

    const inverterResolved = resolveLineQuantity(
      row.inverterQuantity > 0 ? row.inverterQuantity : 0,
      inverterSize !== "—" ? inverterSize : inverterBrand,
      "inverter",
    )

    if (inverterResolved.quantity > 0) {
      const brandLabel =
        inverterBrand !== "—" && !isProductNeededSetLine(inverterBrand)
          ? inverterBrand
          : isProductNeededSetLine(inverterSize)
            ? "As per the set"
            : inverterBrand
      const sizeLabel =
        inverterSize !== "—"
          ? inverterSize
          : isProductNeededSetLine(inverterBrand)
            ? inverterBrand
            : "—"
      addSizeLine(
        inverterBrands,
        brandLabel,
        sizeLabel,
        inverterResolved.quantity,
        inverterResolved.unit,
        row.quotationId,
      )
    }
  }

  const panels = toBrandCards(panelBrands)
  const inverters = toBrandCards(inverterBrands)

  return {
    jobCount: rows.length,
    totalPanels: panels.reduce((sum, card) => sum + card.totalQuantity, 0),
    totalInverters: inverters.reduce((sum, card) => sum + card.totalQuantity, 0),
    panels,
    inverters,
    rows,
  }
}

export function productNeededDashboardToCsv(dashboard: ProductNeededDashboard): string {
  const escape = (value: unknown) => {
    const raw = String(value ?? "")
    return `"${raw.replace(/"/g, '""')}"`
  }

  const sections: string[] = []

  sections.push(
    ["Category", "Brand", "Size / Rating", "Qty", "Unit", "Jobs"].map(escape).join(","),
  )
  for (const card of dashboard.panels) {
    for (const size of card.sizes) {
      sections.push(
        ["Panel", card.brand, size.size, size.quantity, size.unit, size.jobCount]
          .map(escape)
          .join(","),
      )
    }
  }
  for (const card of dashboard.inverters) {
    for (const size of card.sizes) {
      sections.push(
        ["Inverter", card.brand, size.size, size.quantity, size.unit, size.jobCount]
          .map(escape)
          .join(","),
      )
    }
  }

  sections.push("")
  sections.push(
    [
      "Quotation ID",
      "Customer",
      "Mobile",
      "Dealer",
      "System kW",
      "System Type",
      "Panels",
      "Inverter",
    ]
      .map(escape)
      .join(","),
  )
  for (const row of dashboard.rows) {
    sections.push(
      [
        row.quotationId,
        row.customerName,
        row.customerMobile,
        row.dealerName,
        row.systemKw,
        row.systemType,
        row.panels,
        row.inverter,
      ]
        .map(escape)
        .join(","),
    )
  }

  return sections.join("\n")
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

export type ProductNeededApiFilters = {
  scope?: "installation_pending"
  dealerId?: string
  search?: string
  startDate?: string
  endDate?: string
  dateField?: "installation_released" | "created"
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
    scope: "installation_pending",
    dealerId: options.dealerId !== "all" ? options.dealerId : undefined,
    search: options.search.trim() || undefined,
    startDate,
    endDate,
    dateField: "installation_released",
    page: 1,
    limit: 2000,
  }
}

export function mapProductNeededRowFromApi(raw: Record<string, unknown>): ProductNeededRow {
  const fileLoginStatusRaw = String(raw.fileLoginStatus ?? raw.file_login_status ?? "").trim()
  const panels = String(raw.panels ?? "—")
  const inverter = String(raw.inverter ?? "—")
  const parsedInverter = parseInverterFromSummary(inverter)
  const panelLinesRaw = raw.panelLines ?? raw.panel_lines
  const panelLines = Array.isArray(panelLinesRaw)
    ? (panelLinesRaw as Array<Record<string, unknown>>).map((line) => ({
        brand: normalizeBrand(String(line.brand || "")),
        size: normalizePanelSize(String(line.size || "")),
        quantity: Number(line.quantity) || 0,
      }))
    : parsePanelLinesFromSummary(panels)

  return {
    quotationId: String(raw.quotationId ?? raw.quotation_id ?? ""),
    dealerId: String(raw.dealerId ?? raw.dealer_id ?? "") || undefined,
    customerName: String(raw.customerName ?? raw.customer_name ?? "Unknown"),
    customerMobile: String(raw.customerMobile ?? raw.customer_mobile ?? "—"),
    dealerName: String(raw.dealerName ?? raw.dealer_name ?? "—"),
    systemKw: String(raw.systemKw ?? raw.system_kw ?? "—"),
    systemType: String(raw.systemType ?? raw.system_type ?? "—").toUpperCase(),
    panels,
    inverter,
    panelLines,
    inverterBrand: String(raw.inverterBrand ?? raw.inverter_brand ?? parsedInverter.brand),
    inverterSize: String(raw.inverterSize ?? raw.inverter_size ?? parsedInverter.size),
    inverterQuantity: Number(raw.inverterQuantity ?? raw.inverter_quantity ?? parsedInverter.quantity) || 0,
    fileLoginAt: (raw.fileLoginAt ?? raw.file_login_at) as string | undefined,
    fileLoginStatus: fileLoginStatusRaw
      ? fileLoginStatusLabel(fileLoginStatusRaw)
      : String(raw.fileLoginStatus ?? raw.file_login_status ?? "—"),
    statusApprovedAt: (raw.statusApprovedAt ?? raw.status_approved_at ?? raw.approvedAt) as
      | string
      | undefined,
    installationReleasedAt: (raw.installationReleasedAt ??
      raw.installation_released_at ??
      raw.statusApprovedAt ??
      raw.status_approved_at) as string | undefined,
    quotationStatus: String(raw.quotationStatus ?? raw.quotation_status ?? raw.status ?? ""),
  }
}

export function extractProductNeededFromApiResponse(response: unknown): {
  rows: ProductNeededRow[]
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

  const pagination = data.pagination as Record<string, unknown> | undefined
  const total = Number(
    pagination?.total ?? data.total ?? data.totalRows ?? data.total_rows ?? rows.length,
  )

  return {
    rows,
    total: Number.isFinite(total) ? total : rows.length,
  }
}
