import type { Customer, ProductSelection } from "@/lib/quotation-context"
import { DCR_AS_PER_THE_SET } from "@/lib/pricing-tables"
import {
  isAsPerTheSetLabel,
  TATA_DCR_PANEL_RANGE_KEY,
} from "@/lib/quotation-pdf-display"

/** PDF-only flags — strip before catalog validation until backend ignores them (§X). */
export function stripPdfDisplayFlags(products: ProductSelection): ProductSelection {
  const {
    pdfPanelRangeKey: _p,
    pdfDcrPanelRangeKey: _d,
    pdfNonDcrPanelRangeKey: _n,
    pdfUsePanelSizeRange: _a,
    pdfUseInverterBrandOptions: _b,
    ...rest
  } = products as ProductSelection & {
    pdf_panel_range_key?: string
    pdf_dcr_panel_range_key?: string
    pdf_non_dcr_panel_range_key?: string
    pdf_use_panel_size_range?: boolean
    pdf_use_inverter_brand_options?: boolean
  }
  const stripped = { ...rest } as ProductSelection & Record<string, unknown>
  delete stripped.pdf_panel_range_key
  delete stripped.pdf_dcr_panel_range_key
  delete stripped.pdf_non_dcr_panel_range_key
  delete stripped.pdf_use_panel_size_range
  delete stripped.pdf_use_inverter_brand_options
  return stripped as ProductSelection
}

type PdfFlagRecord = ProductSelection & Record<string, unknown>

function pdfRangeKeyValue(products: PdfFlagRecord, camel: string, snake: string): string | null {
  const raw = products[camel] ?? products[snake]
  if (raw === null || raw === undefined) return null
  const trimmed = String(raw).trim()
  return trimmed || null
}

/**
 * PDF display flags for API persist — always includes keys so unchecked boxes clear stored values.
 */
export function buildPdfDisplayFlagsPayload(products: ProductSelection): PdfFlagRecord {
  const record = products as PdfFlagRecord
  const primary = pdfRangeKeyValue(record, "pdfPanelRangeKey", "pdf_panel_range_key")
  const dcr = pdfRangeKeyValue(record, "pdfDcrPanelRangeKey", "pdf_dcr_panel_range_key")
  const nonDcr = pdfRangeKeyValue(record, "pdfNonDcrPanelRangeKey", "pdf_non_dcr_panel_range_key")
  const useLegacyRange = primary != null

  return {
    pdfPanelRangeKey: primary ?? "",
    pdfDcrPanelRangeKey: dcr ?? "",
    pdfNonDcrPanelRangeKey: nonDcr ?? "",
    pdf_panel_range_key: primary,
    pdf_dcr_panel_range_key: dcr,
    pdf_non_dcr_panel_range_key: nonDcr,
    pdfUsePanelSizeRange: useLegacyRange,
    pdf_use_panel_size_range: useLegacyRange,
    pdfUseInverterBrandOptions: false,
    pdf_use_inverter_brand_options: false,
  }
}

const CATALOG_DEFAULT_INVERTER_BRAND = "Vsole/Xwatt"

export { CATALOG_DEFAULT_INVERTER_BRAND as DEFAULT_DCR_INVERTER_BRAND }

/** DCR inverter brand: Tata package-set vs all other DCR slabs. */
export function resolveDcrInverterBrandForPackage(products: ProductSelection): string {
  if (isTataDcrPackageSet(products)) return DCR_AS_PER_THE_SET
  if (String(products.systemType || "").trim().toLowerCase() === "dcr") {
    return products.inverterBrand?.trim() || CATALOG_DEFAULT_INVERTER_BRAND
  }
  return products.inverterBrand || ""
}

export function resolveDcrInverterSizeForPackage(
  products: ProductSelection,
  fallbackSize?: string,
): string {
  if (isTataDcrPackageSet(products)) return DCR_AS_PER_THE_SET
  return fallbackSize || products.inverterSize || ""
}
function parseNominalSystemKw(...sources: (string | undefined)[]): number {
  for (const source of sources) {
    const match = String(source ?? "").match(/([\d.]+)\s*kW/i)
    if (!match) continue
    const kw = Number.parseFloat(match[1])
    if (!Number.isNaN(kw) && kw > 0) return kw
  }
  return 0
}

/** Map decimal Tata slab labels (3.1kW, 5.1kW) to integer kW the catalog accepts. */
function normalizeStructureSizeForCatalog(size: string): string {
  const kw = parseNominalSystemKw(size)
  if (kw <= 0) return size
  if (Math.abs(kw - 3.1) < 0.05) return "3kW"
  if (Math.abs(kw - 5.1) < 0.05) return "5kW"
  if (Number.isInteger(kw)) return `${kw}kW`
  return `${Math.round(kw)}kW`
}

function normalizeAsPerSetCableSize(size: string | undefined): string | undefined {
  if (!size?.trim()) return size
  if (isAsPerTheSetLabel(size)) return "As per Set"
  return size
}

/** Tata DCR package rows use “as per the set” — backend catalog still expects concrete SKUs. */
export function isTataDcrPackageSet(products: ProductSelection): boolean {
  const systemType = String(products.systemType || "").trim().toLowerCase()
  const brand = (products.panelBrand || products.dcrPanelBrand || "").trim().toLowerCase()
  if (systemType !== "dcr" || brand !== "tata") return false
  return true
}

/**
 * Map DCR package-set fields to catalog-valid values for create/update APIs.
 * PDF flags (applied separately) preserve Tata range / as-per-set display.
 */
export function toCatalogCompatibleProducts(products: ProductSelection): ProductSelection {
  let next: ProductSelection = { ...products }

  if (next.structureSize && /[\d.]+kW/i.test(next.structureSize)) {
    const normalizedStructure = normalizeStructureSizeForCatalog(next.structureSize)
    if (normalizedStructure !== next.structureSize) {
      next = { ...next, structureSize: normalizedStructure }
    }
  }

  next = {
    ...next,
    acCableSize: normalizeAsPerSetCableSize(next.acCableSize) ?? next.acCableSize,
    dcCableSize: normalizeAsPerSetCableSize(next.dcCableSize) ?? next.dcCableSize,
  }

  if (String(next.systemType || "").trim().toLowerCase() === "dcr" && !isTataDcrPackageSet(next)) {
    return {
      ...next,
      inverterBrand: next.inverterBrand?.trim() || CATALOG_DEFAULT_INVERTER_BRAND,
    }
  }

  if (!isTataDcrPackageSet(next)) return next

  const systemKw = parseNominalSystemKw(next.structureSize, next.inverterSize)
  const structureSize = normalizeStructureSizeForCatalog(
    next.structureSize || (systemKw > 0 ? `${systemKw}kW` : "5kW"),
  )
  const panelBrand = next.panelBrand || next.dcrPanelBrand || "Tata"

  return {
    ...next,
    panelBrand,
    panelSize: DCR_AS_PER_THE_SET,
    panelQuantity: 0,
    dcrPanelBrand: panelBrand,
    dcrPanelSize: DCR_AS_PER_THE_SET,
    dcrPanelQuantity: 0,
    inverterBrand: DCR_AS_PER_THE_SET,
    inverterSize: DCR_AS_PER_THE_SET,
    structureSize,
  }
}

/** Keep dcrPanel* in sync with primary panel fields for DCR-only quotations. */
export function syncDcrPanelFieldsFromPrimary(products: ProductSelection): ProductSelection {
  if (products.systemType !== "dcr") return products
  if (!products.panelBrand?.trim() && !products.panelSize?.trim()) return products
  return {
    ...products,
    dcrPanelBrand: products.panelBrand || products.dcrPanelBrand || "",
    dcrPanelSize: products.panelSize || products.dcrPanelSize || "",
    dcrPanelQuantity:
      products.panelQuantity != null && products.panelQuantity > 0
        ? products.panelQuantity
        : products.dcrPanelQuantity || 0,
  }
}

/**
 * Restore DCR package-set values in the form after API round-trip (catalog stores 530W / Vsole, etc.).
 * PDF flags and “as per the set” labels are kept for UI + proposal PDF.
 */
export function restoreDcrPackageDisplayForForm(products: ProductSelection): ProductSelection {
  if (String(products.systemType || "").toLowerCase() !== "dcr") return products

  const record = products as ProductSelection & Record<string, unknown>
  const brand = (products.panelBrand || products.dcrPanelBrand || "").trim().toLowerCase()
  const existingRange = String(products.pdfPanelRangeKey || record.pdf_panel_range_key || "").trim()
  const pdfPanelRangeKey = existingRange

  const isTataDcrPackage =
    brand === "tata" ||
    pdfPanelRangeKey === TATA_DCR_PANEL_RANGE_KEY ||
    String(record.tata_dcr_panel_range || "").trim() === "true"

  const asPerSetPackage =
    isAsPerTheSetLabel(products.panelSize) ||
    isAsPerTheSetLabel(products.dcrPanelSize) ||
    isAsPerTheSetLabel(products.inverterSize) ||
    isAsPerTheSetLabel(products.inverterBrand) ||
    isTataDcrPackage

  if (!asPerSetPackage) return products

  const panelBrand = products.panelBrand || products.dcrPanelBrand || ""

  return {
    ...products,
    panelBrand,
    pdfPanelRangeKey: pdfPanelRangeKey || products.pdfPanelRangeKey,
    panelSize: DCR_AS_PER_THE_SET,
    panelQuantity: 0,
    dcrPanelBrand: products.dcrPanelBrand || panelBrand,
    dcrPanelSize: DCR_AS_PER_THE_SET,
    dcrPanelQuantity: 0,
    inverterBrand: DCR_AS_PER_THE_SET,
    inverterSize: DCR_AS_PER_THE_SET,
  }
}

/** Merge catalog-safe products with explicit PDF flag clears for updateProducts. */
export function productsWithPdfDisplayFlags(products: ProductSelection): ProductSelection {
  const synced = syncDcrPanelFieldsFromPrimary(products)
  const catalogSafe = toCatalogCompatibleProducts(synced)
  return {
    ...catalogSafe,
    ...buildPdfDisplayFlagsPayload(synced),
  } as ProductSelection
}

/** @deprecated use buildPdfDisplayFlagsPayload */
export function extractPdfDisplayFlags(products: ProductSelection): Partial<ProductSelection> {
  return buildPdfDisplayFlagsPayload(products)
}

export function hasPdfDisplayFlags(flags: Partial<ProductSelection>): boolean {
  return Boolean(
    flags.pdfPanelRangeKey ||
      flags.pdfDcrPanelRangeKey ||
      flags.pdfNonDcrPanelRangeKey ||
      flags.pdfUsePanelSizeRange ||
      flags.pdfUseInverterBrandOptions,
  )
}

/** Body for POST /customers — only fields the API schema documents. */
export function buildCustomerCreatePayload(customer: Customer): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    firstName: customer.firstName,
    lastName: customer.lastName,
    mobile: customer.mobile,
    address: customer.address,
  }
  if (customer.email?.trim()) {
    payload.email = customer.email.trim()
  }
  return payload
}

export function buildCustomerCreatePayloadWithNotes(customer: Customer): Record<string, unknown> {
  const payload = buildCustomerCreatePayload(customer)
  if (customer.remarks?.trim()) {
    const notes = customer.remarks.trim()
    payload.notes = notes
    payload.remarks = notes
  }
  return payload
}

export function normalizeCustomersListResponse(response: unknown): Array<{
  id: string
  mobile?: string
  dealerId?: string
  dealerName?: string
  dealers?: string[]
  dealer?: { firstName?: string; lastName?: string; username?: string }
}> {
  const pickList = (): unknown[] => {
    if (Array.isArray(response)) return response
    const r = response as Record<string, unknown>
    if (Array.isArray(r.customers)) return r.customers
    const data = r.data as Record<string, unknown> | undefined
    if (data && Array.isArray(data.customers)) return data.customers
    return []
  }

  return pickList().map((row) => {
    const c = (row || {}) as Record<string, unknown>
    const nestedDealer = c.dealer as Record<string, unknown> | undefined
    return {
      id: String(c.id || ""),
      mobile: typeof c.mobile === "string" ? c.mobile : undefined,
      dealerId: typeof c.dealerId === "string" ? c.dealerId : typeof c.dealer_id === "string" ? c.dealer_id : undefined,
      dealerName:
        typeof c.dealerName === "string"
          ? c.dealerName
          : typeof c.dealer_name === "string"
            ? c.dealer_name
            : undefined,
      dealers: Array.isArray(c.dealers) ? (c.dealers as string[]) : undefined,
      dealer: nestedDealer
        ? {
            firstName: typeof nestedDealer.firstName === "string" ? nestedDealer.firstName : undefined,
            lastName: typeof nestedDealer.lastName === "string" ? nestedDealer.lastName : undefined,
            username: typeof nestedDealer.username === "string" ? nestedDealer.username : undefined,
          }
        : undefined,
    }
  })
}

export function normalizeMobileForMatch(value: string): string {
  return String(value || "").replace(/\D/g, "")
}

export function normalizeQuotationsListResponse(response: unknown): Record<string, unknown>[] {
  if (Array.isArray(response)) return response as Record<string, unknown>[]
  const r = response as Record<string, unknown>
  if (Array.isArray(r.quotations)) return r.quotations as Record<string, unknown>[]
  const data = r.data as Record<string, unknown> | undefined
  if (data && Array.isArray(data.quotations)) return data.quotations as Record<string, unknown>[]
  return []
}

export function resolveDealerNameFromQuotationRow(row: unknown): string {
  if (!row || typeof row !== "object") return "Unknown Dealer"
  const q = row as Record<string, unknown>
  const nested = q.dealer as Record<string, unknown> | undefined
  if (nested && typeof nested === "object") {
    const fullName = `${nested.firstName || ""} ${nested.lastName || ""}`.trim()
    if (fullName) return fullName
    if (typeof nested.username === "string" && nested.username.trim()) return nested.username.trim()
  }
  for (const key of ["dealerName", "dealer_name", "assignedDealerName", "assigned_dealer_name"]) {
    const val = q[key]
    if (typeof val === "string" && val.trim()) return val.trim()
  }
  return "Unknown Dealer"
}

export function resolveDealerNameFromCustomerRow(row: unknown): string | null {
  if (!row || typeof row !== "object") return null
  const c = row as Record<string, unknown>
  if (Array.isArray(c.dealers) && c.dealers.length > 0) {
    const first = c.dealers.find((d) => typeof d === "string" && d.trim())
    if (typeof first === "string") return first.trim()
  }
  for (const key of ["dealerName", "dealer_name"]) {
    const val = c[key]
    if (typeof val === "string" && val.trim()) return val.trim()
  }
  const nested = c.dealer as Record<string, unknown> | undefined
  if (nested && typeof nested === "object") {
    const fullName = `${nested.firstName || ""} ${nested.lastName || ""}`.trim()
    if (fullName) return fullName
    if (typeof nested.username === "string" && nested.username.trim()) return nested.username.trim()
  }
  return null
}

export function findQuotationRowByMobile(list: unknown[], mobile: string): Record<string, unknown> | null {
  const target = normalizeMobileForMatch(mobile)
  if (!target) return null
  for (const row of list) {
    if (!row || typeof row !== "object") continue
    const q = row as Record<string, unknown>
    const customer = q.customer as Record<string, unknown> | undefined
    const rowMobile = normalizeMobileForMatch(
      String(q.mobile || q.customerMobile || q.customer_mobile || customer?.mobile || ""),
    )
    if (rowMobile && rowMobile === target) return q
  }
  return null
}

export function formatExistingCustomerAssignedError(dealerName: string): string {
  const label = dealerName.trim() || "Unknown Dealer"
  return `This customer already exists and is assigned to ${label}. Please update the existing quotation instead of creating a new one.`
}

export function formatDuplicateQuotationError(dealerName: string): string {
  const label = dealerName.trim() || "Unknown Dealer"
  return `A quotation already exists for this mobile number. This customer is assigned to ${label}. Please update the existing quotation instead of creating a fresh one.`
}
