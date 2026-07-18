import type { Customer, ProductSelection } from "@/lib/quotation-context"
import {
  DCR_AS_PER_THE_SET,
  panelQuantityForNominalSystemKw,
  parsePanelSizeWatts,
} from "@/lib/pricing-tables"
import {
  isAsPerTheSetLabel,
  isPdfCommercialSet,
  TATA_DCR_PANEL_RANGE_KEY,
  INA_DCR_PANEL_RANGE_KEY,
  applyDefaultPdfPanelRanges,
} from "@/lib/quotation-pdf-display"
import { mergeQuotationProductSources } from "@/lib/merge-quotation-products"
import { applyLocalQuotationPdfFlags, writeLocalQuotationPdfFlags } from "@/lib/quotation-pdf-flags-local"

/** PDF-only flags — strip before catalog validation until backend ignores them (§X). */
export function stripPdfDisplayFlags(products: ProductSelection): ProductSelection {
  const {
    pdfPanelRangeKey: _p,
    pdfDcrPanelRangeKey: _d,
    pdfNonDcrPanelRangeKey: _n,
    pdfUsePanelSizeRange: _a,
    pdfUseInverterBrandOptions: _b,
    pdfCommercialSet: _c,
    ...rest
  } = products as ProductSelection & {
    pdf_panel_range_key?: string
    pdf_dcr_panel_range_key?: string
    pdf_non_dcr_panel_range_key?: string
    pdf_use_panel_size_range?: boolean
    pdf_use_inverter_brand_options?: boolean
    pdf_commercial_set?: boolean
  }
  const stripped = { ...rest } as ProductSelection & Record<string, unknown>
  delete stripped.pdf_panel_range_key
  delete stripped.pdf_dcr_panel_range_key
  delete stripped.pdf_non_dcr_panel_range_key
  delete stripped.pdf_use_panel_size_range
  delete stripped.pdf_use_inverter_brand_options
  delete stripped.pdf_commercial_set
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
  const commercial =
    record.pdfCommercialSet === true ||
    record.pdf_commercial_set === true ||
    String(record.pdfCommercialSet ?? record.pdf_commercial_set ?? "")
      .trim()
      .toLowerCase() === "true"

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
    pdfCommercialSet: commercial,
    pdf_commercial_set: commercial,
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

/** Panel sizes the live product-catalog API accepts (see BACKEND_PRODUCT_CATALOG_API.md). */
const API_CATALOG_PANEL_SIZES_WATTS = [
  440, 445, 530, 540, 545, 550, 555, 560, 570, 580, 590, 600, 610, 620, 625, 630, 640, 650, 660, 670, 680, 690, 700,
] as const

/**
 * Keep exact dealer-entered wattage when possible. Only snap unknown sizes to the nearest
 * catalog SKU when within 2W (typos); otherwise keep the entered value (e.g. 625W).
 */
function normalizePanelSizeForApiCatalog(size: string | undefined): string | undefined {
  if (!size?.trim() || isAsPerTheSetLabel(size)) return size
  const watts = parsePanelSizeWatts(size)
  if (watts <= 0) return size

  if ((API_CATALOG_PANEL_SIZES_WATTS as readonly number[]).includes(watts)) {
    return `${watts}W`
  }

  let nearest: number = API_CATALOG_PANEL_SIZES_WATTS[0]
  let nearestDiff = Math.abs(nearest - watts)
  for (const candidate of API_CATALOG_PANEL_SIZES_WATTS) {
    const diff = Math.abs(candidate - watts)
    if (diff < nearestDiff) {
      nearest = candidate
      nearestDiff = diff
    }
  }
  // Far from every catalog SKU — keep dealer entry for PDF / display round-trip.
  if (nearestDiff > 2) return `${watts}W`
  return `${nearest}W`
}

/** INA is not in the backend catalog yet — map to Adani for validateProductSelection. */
const INA_API_PANEL_BRAND_ALIAS = "Adani"
const INA_API_PANEL_SIZE_ALIAS = "555W"

function isInaPanelBrand(brand?: string): boolean {
  return String(brand || "").trim().toLowerCase() === "ina"
}

/** True when the dealer selected an INA DCR package (UI / PDF), even if API uses catalog alias. */
export function isInaPanelPackage(products: ProductSelection): boolean {
  const record = products as ProductSelection & Record<string, unknown>
  return (
    isInaPanelBrand(products.panelBrand) ||
    isInaPanelBrand(products.dcrPanelBrand) ||
    pdfRangeKeyValue(record, "pdfPanelRangeKey", "pdf_panel_range_key") === INA_DCR_PANEL_RANGE_KEY ||
    pdfRangeKeyValue(record, "pdfDcrPanelRangeKey", "pdf_dcr_panel_range_key") === INA_DCR_PANEL_RANGE_KEY ||
    String(record.panelType || record.panel_type || "").trim().toLowerCase() === "ina" ||
    record.inaDcrPackage === true ||
    record.ina_dcr_package === true
  )
}

function stripInaPdfFlagsForApi(flags: PdfFlagRecord): PdfFlagRecord {
  const primary = pdfRangeKeyValue(flags, "pdfPanelRangeKey", "pdf_panel_range_key")
  const dcr = pdfRangeKeyValue(flags, "pdfDcrPanelRangeKey", "pdf_dcr_panel_range_key")
  if (primary !== INA_DCR_PANEL_RANGE_KEY && dcr !== INA_DCR_PANEL_RANGE_KEY) return flags

  return {
    ...flags,
    pdfPanelRangeKey: primary === INA_DCR_PANEL_RANGE_KEY ? "" : (flags.pdfPanelRangeKey ?? ""),
    pdfDcrPanelRangeKey: dcr === INA_DCR_PANEL_RANGE_KEY ? "" : (flags.pdfDcrPanelRangeKey ?? ""),
    pdf_panel_range_key: primary === INA_DCR_PANEL_RANGE_KEY ? null : flags.pdf_panel_range_key,
    pdf_dcr_panel_range_key: dcr === INA_DCR_PANEL_RANGE_KEY ? null : flags.pdf_dcr_panel_range_key,
    pdfUsePanelSizeRange: false,
    pdf_use_panel_size_range: false,
  }
}

function withInaApiCatalogMarkers(products: ProductSelection): ProductSelection {
  const record = products as ProductSelection & Record<string, unknown>
  const primaryRange = pdfRangeKeyValue(record, "pdfPanelRangeKey", "pdf_panel_range_key") ?? ""
  const dcrRange = pdfRangeKeyValue(record, "pdfDcrPanelRangeKey", "pdf_dcr_panel_range_key") ?? ""
  const snappedSize = normalizePanelSizeForApiCatalog(products.panelSize) ?? INA_API_PANEL_SIZE_ALIAS
  const snappedDcrSize =
    normalizePanelSizeForApiCatalog(products.dcrPanelSize || products.panelSize) ?? INA_API_PANEL_SIZE_ALIAS
  const next = { ...products } as ProductSelection & Record<string, unknown>
  next.panelBrand = INA_API_PANEL_BRAND_ALIAS
  next.dcrPanelBrand = INA_API_PANEL_BRAND_ALIAS
  next.panelSize = snappedSize
  next.dcrPanelSize = snappedDcrSize
  next.panelType = "INA"
  next.panel_type = "INA"
  next.inaDcrPackage = true
  next.ina_dcr_package = true
  const inaRange = primaryRange || dcrRange || INA_DCR_PANEL_RANGE_KEY
  next.pdfPanelRangeKey = inaRange
  next.pdfDcrPanelRangeKey = dcrRange || primaryRange || INA_DCR_PANEL_RANGE_KEY
  next.pdf_panel_range_key = inaRange
  next.pdf_dcr_panel_range_key = dcrRange || primaryRange || INA_DCR_PANEL_RANGE_KEY
  next.pdfUsePanelSizeRange = true
  next.pdf_use_panel_size_range = true
  return next as ProductSelection
}

function mapPanelBrandForApiCatalog(brand: string | undefined): string | undefined {
  if (!brand?.trim()) return brand
  if (brand.trim().toLowerCase() === "ina") return INA_API_PANEL_BRAND_ALIAS
  return brand
}

function normalizePanelBrandAndSizeForApiCatalog(products: ProductSelection): ProductSelection {
  const snapSize = (size?: string) => normalizePanelSizeForApiCatalog(size) ?? size
  return {
    ...products,
    panelBrand: mapPanelBrandForApiCatalog(products.panelBrand) ?? products.panelBrand,
    dcrPanelBrand: mapPanelBrandForApiCatalog(products.dcrPanelBrand) ?? products.dcrPanelBrand,
    nonDcrPanelBrand: mapPanelBrandForApiCatalog(products.nonDcrPanelBrand) ?? products.nonDcrPanelBrand,
    panelSize: snapSize(products.panelSize),
    dcrPanelSize: snapSize(products.dcrPanelSize),
    nonDcrPanelSize: snapSize(products.nonDcrPanelSize),
  }
}

/** Restore INA in the form after API round-trip (catalog stores Adani alias). */
export function restoreInaPanelBrandForForm(products: ProductSelection): ProductSelection {
  if (!isInaPanelPackage(products)) return products

  const record = products as ProductSelection & Record<string, unknown>
  const range = String(products.pdfPanelRangeKey || record.pdf_panel_range_key || "").trim()
  const dcrRange = String(products.pdfDcrPanelRangeKey || record.pdf_dcr_panel_range_key || "").trim()

  return {
    ...products,
    panelBrand: "INA",
    dcrPanelBrand: "INA",
    panelType: "INA",
    inaDcrPackage: true,
    pdfPanelRangeKey: range || dcrRange || INA_DCR_PANEL_RANGE_KEY,
    pdfUsePanelSizeRange: true,
  }
}

function hasExplicitPdfCommercialUnset(products: ProductSelection): boolean {
  const raw = products as ProductSelection & Record<string, unknown>
  return raw.pdfCommercialSet === false || raw.pdf_commercial_set === false
}

/** Keep commercial PDF flag when API/detail merge drops it (backend may not persist yet). */
export function preservePdfDisplayFlagsFromPrior(
  prior: ProductSelection | null | undefined,
  next: ProductSelection,
): ProductSelection {
  if (!prior) return next
  if (hasExplicitPdfCommercialUnset(next)) return next
  if (!isPdfCommercialSet(prior) || isPdfCommercialSet(next)) return next
  return {
    ...next,
    ...buildPdfDisplayFlagsPayload({ ...next, pdfCommercialSet: true }),
  }
}

/** Merge API/list product sources and restore DCR package + INA + PDF display fields. */
export function mergeQuotationProductsForDisplay(raw: unknown): ProductSelection {
  const record = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : null
  const quotationId = String(record?.id || "").trim()
  const priorHint =
    record?.products && typeof record.products === "object" && !Array.isArray(record.products)
      ? (record.products as ProductSelection)
      : undefined
  const merged = mergeQuotationProductSources(raw) as ProductSelection
  const fallback = priorHint ?? ({} as ProductSelection)
  const base = merged && Object.keys(merged).length > 0 ? merged : fallback
  const priorDisplay = priorHint ? restoreDcrPackageDisplayForForm(priorHint) : undefined
  const withIna = preserveInaDisplayFromPrior(priorHint, base)
  const withPdfFlags = preservePdfDisplayFlagsFromPrior(priorDisplay, withIna)
  const withLocal = applyLocalQuotationPdfFlags(quotationId || undefined, withPdfFlags)
  return restoreDcrPackageDisplayForForm(withLocal)
}

/**
 * Keep INA panel brand + PDF range when API round-trip replaces catalog alias (Adani) without markers.
 */
export function preserveInaDisplayFromPrior(
  prior: ProductSelection | null | undefined,
  next: ProductSelection,
): ProductSelection {
  const priorDisplay = prior ? restoreDcrPackageDisplayForForm(prior) : null
  if (!priorDisplay || !isInaPanelPackage(priorDisplay)) {
    return restoreDcrPackageDisplayForForm(next)
  }

  if (isInaPanelPackage(next)) {
    return restoreDcrPackageDisplayForForm(next)
  }

  const merged = {
    ...next,
    panelBrand: "INA",
    dcrPanelBrand: "INA",
    panelType: "INA",
    inaDcrPackage: true,
    pdfPanelRangeKey: INA_DCR_PANEL_RANGE_KEY,
    pdfDcrPanelRangeKey: INA_DCR_PANEL_RANGE_KEY,
    pdfUsePanelSizeRange: true,
    panel_type: "INA",
    ina_dcr_package: true,
    pdf_panel_range_key: INA_DCR_PANEL_RANGE_KEY,
    pdf_dcr_panel_range_key: INA_DCR_PANEL_RANGE_KEY,
    pdf_use_panel_size_range: true,
  } as ProductSelection

  return restoreDcrPackageDisplayForForm(merged)
}

/**
 * When a PDF panel range is selected, quantity input is hidden — backfill a catalog-valid
 * count from nominal kW + panel size so create/update APIs do not reject panelQuantity: 0.
 */
export function backfillPanelQuantityForPdfRange(products: ProductSelection): ProductSelection {
  const nominalKw = parseNominalSystemKw(products.structureSize, products.inverterSize)
  if (nominalKw <= 0) return products

  let next = { ...products }

  const primaryRange = pdfRangeKeyValue(next as PdfFlagRecord, "pdfPanelRangeKey", "pdf_panel_range_key") ?? ""
  if (
    primaryRange &&
    (!next.panelQuantity || next.panelQuantity <= 0) &&
    next.panelSize?.trim() &&
    !isAsPerTheSetLabel(next.panelSize)
  ) {
    const qty = panelQuantityForNominalSystemKw(nominalKw, next.panelSize)
    if (qty > 0) {
      next = { ...next, panelQuantity: qty }
      if (next.systemType === "dcr") {
        next = { ...next, dcrPanelQuantity: qty }
      }
    }
  }

  const dcrRange = pdfRangeKeyValue(next as PdfFlagRecord, "pdfDcrPanelRangeKey", "pdf_dcr_panel_range_key") ?? ""
  if (
    dcrRange &&
    (!next.dcrPanelQuantity || next.dcrPanelQuantity <= 0) &&
    next.dcrPanelSize?.trim() &&
    !isAsPerTheSetLabel(next.dcrPanelSize)
  ) {
    const dcrKw =
      next.systemType === "both"
        ? parseNominalSystemKw(
            String(next.dcrPanelSize || "").includes("kW") ? next.dcrPanelSize : undefined,
            next.structureSize,
          ) || nominalKw / 2
        : nominalKw
    const qty = panelQuantityForNominalSystemKw(dcrKw > 0 ? dcrKw : nominalKw, next.dcrPanelSize)
    if (qty > 0) {
      next = { ...next, dcrPanelQuantity: qty }
    }
  }

  const nonDcrRange =
    pdfRangeKeyValue(next as PdfFlagRecord, "pdfNonDcrPanelRangeKey", "pdf_non_dcr_panel_range_key") ?? ""
  if (
    nonDcrRange &&
    (!next.nonDcrPanelQuantity || next.nonDcrPanelQuantity <= 0) &&
    next.nonDcrPanelSize?.trim() &&
    !isAsPerTheSetLabel(next.nonDcrPanelSize)
  ) {
    const nonDcrKw =
      next.systemType === "both"
        ? parseNominalSystemKw(
            String(next.nonDcrPanelSize || "").includes("kW") ? next.nonDcrPanelSize : undefined,
            next.structureSize,
          ) || nominalKw / 2
        : nominalKw
    const qty = panelQuantityForNominalSystemKw(nonDcrKw > 0 ? nonDcrKw : nominalKw, next.nonDcrPanelSize)
    if (qty > 0) {
      next = { ...next, nonDcrPanelQuantity: qty }
    }
  }

  return next
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
  let next: ProductSelection = backfillPanelQuantityForPdfRange(products)

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

  if (isTataDcrPackageSet(next)) {
    const systemKw = parseNominalSystemKw(next.structureSize, next.inverterSize)
    const structureSize = normalizeStructureSizeForCatalog(
      next.structureSize || (systemKw > 0 ? `${systemKw}kW` : "5kW"),
    )
    const panelBrand = next.panelBrand || next.dcrPanelBrand || "Tata"
    next = {
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
  } else if (String(next.systemType || "").trim().toLowerCase() === "dcr") {
    next = {
      ...next,
      inverterBrand: next.inverterBrand?.trim() || CATALOG_DEFAULT_INVERTER_BRAND,
    }
  }

  next = normalizePanelBrandAndSizeForApiCatalog(next)
  if (isInaPanelPackage(products)) {
    next = withInaApiCatalogMarkers(next)
  }
  return backfillPanelQuantityForPdfRange(next)
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
  const withIna = restoreInaPanelBrandForForm(products)

  if (String(withIna.systemType || "").toLowerCase() !== "dcr") {
    return applyDefaultPdfPanelRanges(withIna)
  }

  const record = withIna as ProductSelection & Record<string, unknown>
  const brand = (withIna.panelBrand || withIna.dcrPanelBrand || "").trim().toLowerCase()
  const existingRange = String(withIna.pdfPanelRangeKey || record.pdf_panel_range_key || "").trim()
  const pdfPanelRangeKey = existingRange

  const isTataDcrPackage =
    brand === "tata" ||
    pdfPanelRangeKey === TATA_DCR_PANEL_RANGE_KEY ||
    String(record.tata_dcr_panel_range || "").trim() === "true"

  const asPerSetPackage =
    isAsPerTheSetLabel(withIna.panelSize) ||
    isAsPerTheSetLabel(withIna.dcrPanelSize) ||
    isAsPerTheSetLabel(withIna.inverterSize) ||
    isAsPerTheSetLabel(withIna.inverterBrand) ||
    isTataDcrPackage

  if (!asPerSetPackage) return applyDefaultPdfPanelRanges(withIna)

  const panelBrand = withIna.panelBrand || withIna.dcrPanelBrand || ""

  return applyDefaultPdfPanelRanges({
    ...withIna,
    panelBrand,
    pdfPanelRangeKey: pdfPanelRangeKey || withIna.pdfPanelRangeKey,
    panelSize: DCR_AS_PER_THE_SET,
    panelQuantity: 0,
    dcrPanelBrand: withIna.dcrPanelBrand || panelBrand,
    dcrPanelSize: DCR_AS_PER_THE_SET,
    dcrPanelQuantity: 0,
    inverterBrand: DCR_AS_PER_THE_SET,
    inverterSize: DCR_AS_PER_THE_SET,
  })
}

/** Catalog-safe products payload for create/update APIs (keeps INA markers for round-trip). */
export function productsForApiUpdate(products: ProductSelection): ProductSelection {
  const synced = syncDcrPanelFieldsFromPrimary(products)
  const withQty = backfillPanelQuantityForPdfRange(synced)
  const catalogSafe = toCatalogCompatibleProducts(withQty)
  const flags = buildPdfDisplayFlagsPayload(withQty) as PdfFlagRecord
  if (!isInaPanelPackage(withQty)) {
    return { ...catalogSafe, ...flags } as ProductSelection
  }
  return {
    ...catalogSafe,
    ...flags,
    panelType: "INA",
    panel_type: "INA",
    inaDcrPackage: true,
    ina_dcr_package: true,
  } as ProductSelection
}

/** Merge catalog-safe products with explicit PDF flag clears for updateProducts. */
export function productsWithPdfDisplayFlags(products: ProductSelection): ProductSelection {
  return productsForApiUpdate(products)
}

export function isProductsValidationApiError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  const msg = error.message.toLowerCase()
  return (
    msg.includes("invalid input") ||
    msg.includes("invalid product") ||
    msg.includes("product catalog") ||
    msg.includes("val_003")
  )
}

function dedupeProductPayloads(payloads: ProductSelection[]): ProductSelection[] {
  const seen = new Set<string>()
  const out: ProductSelection[] = []
  for (const payload of payloads) {
    const key = JSON.stringify(payload)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(payload)
  }
  return out
}

/** Try progressively simpler catalog-safe payloads until the API accepts one. */
export function buildProductsApiPayloadCandidates(products: ProductSelection): ProductSelection[] {
  const synced = syncDcrPanelFieldsFromPrimary(products)
  const withQty = backfillPanelQuantityForPdfRange(synced)
  const withFlags = productsForApiUpdate(products)
  const catalogSafe = toCatalogCompatibleProducts(withQty)
  const strippedInaFlags = stripInaPdfFlagsForApi(buildPdfDisplayFlagsPayload(withQty) as PdfFlagRecord)
  const inaWithoutPdfRange = isInaPanelPackage(products)
    ? ({
        ...catalogSafe,
        ...strippedInaFlags,
        panelType: "INA",
        panel_type: "INA",
        inaDcrPackage: true,
        ina_dcr_package: true,
      } as ProductSelection & Record<string, unknown>)
    : null
  const stripped = stripPdfDisplayFlags(catalogSafe)

  const candidates = dedupeProductPayloads(
    inaWithoutPdfRange ? [withFlags, inaWithoutPdfRange, stripped] : [withFlags, stripped],
  )

  // Commercial DCR/BOTH: every candidate must keep the commercial flag + subsidy 0.
  // Otherwise a catalog-retry stripped payload loses the flag and the API rejects with
  // "centralSubsidy is required for dcr and both system types".
  if (!isPdfCommercialSet(products)) return candidates

  const commercialFlags = {
    ...buildPdfDisplayFlagsPayload(products),
    centralSubsidy: 0,
    stateSubsidy: 0,
    isCommercial: true,
  }

  return dedupeProductPayloads(
    candidates.map(
      (payload) =>
        ({
          ...payload,
          ...commercialFlags,
        }) as ProductSelection,
    ),
  )
}

export async function persistQuotationProducts<T>(
  updateFn: (payload: ProductSelection) => Promise<T>,
  products: ProductSelection,
  options?: { quotationId?: string },
): Promise<T> {
  const candidates = buildProductsApiPayloadCandidates(products)
  let lastError: unknown
  for (const payload of candidates) {
    try {
      const result = await updateFn(payload)
      if (options?.quotationId) {
        writeLocalQuotationPdfFlags(options.quotationId, products)
      }
      return result
    } catch (error) {
      lastError = error
      if (!isProductsValidationApiError(error)) throw error
    }
  }
  throw lastError
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
      flags.pdfUseInverterBrandOptions ||
      flags.pdfCommercialSet,
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
