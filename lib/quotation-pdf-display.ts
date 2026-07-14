import type { ProductSelection } from "@/lib/quotation-context"

/** Shown on proposal PDF and DCR pricing catalog when a PDF panel range is selected. */
export const QUOTATION_AS_PER_THE_SET_LABEL = "As per the set"

export function isAsPerTheSetLabel(value?: string | null): boolean {
  const v = String(value ?? "").trim().toLowerCase()
  return v === QUOTATION_AS_PER_THE_SET_LABEL.toLowerCase() || v === "as per set"
}

/** Panel row is complete when brand/size are set and qty, PDF range, or package-set label applies. */
export function isPanelRowComplete(
  brand: string,
  size: string,
  quantity: number,
  rangeKey?: string,
): boolean {
  if (!brand?.trim() || !size?.trim()) return false
  if (rangeKey?.trim()) return true
  if (isAsPerTheSetLabel(size)) return true
  return quantity > 0
}

export function isInverterInfoComplete(inverterBrand?: string, inverterSize?: string): boolean {
  if (isAsPerTheSetLabel(inverterBrand) || isAsPerTheSetLabel(inverterSize)) return true
  return Boolean(inverterBrand?.trim() && inverterSize?.trim())
}

/** Extra combined inverter labels appended after catalog brands in the dropdown. */
export const QUOTATION_EXTRA_INVERTER_BRAND_OPTIONS = ["Vsole/Xwatt"] as const

/** Map retired Saatvik labels to the current combined brand for display. */
export function normalizeInverterBrandForDisplay(brand?: string): string {
  const trimmed = (brand || "").trim()
  if (!trimmed) return ""
  const lower = trimmed.toLowerCase()
  if (lower === "saatvik" || lower === "vsole/xwatt/saatvik") return "Vsole/Xwatt"
  return trimmed
}

/** @deprecated use buildInverterBrandDropdownOptions */
export const QUOTATION_INVERTER_BRAND_OPTIONS = QUOTATION_EXTRA_INVERTER_BRAND_OPTIONS

/** Catalog brands (Goodwe, Vsole, Xwatt, …) plus combined PDF options at the end. */
export function buildInverterBrandDropdownOptions(catalogBrands?: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []

  for (const brand of catalogBrands ?? []) {
    const trimmed = brand?.trim()
    if (!trimmed) continue
    const key = trimmed.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    result.push(trimmed)
  }

  for (const extra of QUOTATION_EXTRA_INVERTER_BRAND_OPTIONS) {
    const key = extra.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    result.push(extra)
  }

  return result
}

/** Combined meter label for quotation form dropdown and PDF. */
export const QUOTATION_COMBINED_METER_BRAND = "L&T/HPL/Genus/Secure"

/** Catalog meter brands plus combined option at the end. */
export function buildMeterBrandDropdownOptions(catalogBrands?: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []

  for (const brand of catalogBrands ?? []) {
    const trimmed = brand?.trim()
    if (!trimmed) continue
    const key = trimmed.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    result.push(trimmed)
  }

  const combinedKey = QUOTATION_COMBINED_METER_BRAND.toLowerCase()
  if (!seen.has(combinedKey)) {
    result.push(QUOTATION_COMBINED_METER_BRAND)
  }

  return result
}

export type PdfPanelRangeKey =
  | "waaree_540_560_bifacial"
  | "waaree_580_700_bifacial_topcon"
  | "adani_540_580_bifacial"
  | "adani_610_625_bifacial_topcon"
  | "premier_600_625_bifacial_topcon"
  | "ina_500_600_bifacial"
  | "tata_530_570"
  | "renewsys_540_580"
  | "renewsys_600_630_bifacial_topcon"

/** Fixed panel watt range for Tata DCR package sets (Jun 2026 sheet). */
export const TATA_DCR_PANEL_RANGE_KEY: PdfPanelRangeKey = "tata_530_570"

/** INA DCR package — 500W–600W bifacial range on proposal PDF. */
export const INA_DCR_PANEL_RANGE_KEY: PdfPanelRangeKey = "ina_500_600_bifacial"

/** Default PDF panel range when a DCR browse package column is selected. */
export function defaultPdfPanelRangeKeyForDcrPricingType(panelType: string): PdfPanelRangeKey | null {
  const normalized = panelType.trim().toLowerCase()
  // Optional brands (Waaree / Adani / Premier): leave unchecked — PDF uses entered W × qty for size + system kW.
  if (normalized === "ina") return INA_DCR_PANEL_RANGE_KEY
  if (normalized === "tata") return TATA_DCR_PANEL_RANGE_KEY
  return null
}

export function isTopconPdfPanelRangeKey(key?: string | null): boolean {
  return String(key ?? "").toLowerCase().includes("topcon")
}

/** True when stored PDF range keys indicate a TOPCon package (Adani Topcon, Premier, Waaree 580+, etc.). */
export function usesTopconPanelPackage(products: ProductSelection | null | undefined): boolean {
  if (!products) return false
  const source = products as PdfDisplaySource
  return (
    isTopconPdfPanelRangeKey(resolvePdfPanelRangeKey(source, "primary")) ||
    isTopconPdfPanelRangeKey(resolvePdfPanelRangeKey(source, "dcr")) ||
    isTopconPdfPanelRangeKey(resolvePdfPanelRangeKey(source, "nonDcr"))
  )
}

export type PanelPdfRangeOption = {
  key: PdfPanelRangeKey
  label: string
  pdfSpecification: string
}

const PANEL_RANGE_CATALOG: PanelPdfRangeOption[] = [
  {
    key: "waaree_540_560_bifacial",
    label: "540-560W Bifacial",
    pdfSpecification: "540-560W Bifacial",
  },
  {
    key: "waaree_580_700_bifacial_topcon",
    label: "580-700W Bifacial Topcon",
    pdfSpecification: "580-700W Bifacial Topcon",
  },
  {
    key: "adani_540_580_bifacial",
    label: "540-580W Bifacial",
    pdfSpecification: "540-580W Bifacial",
  },
  {
    key: "adani_610_625_bifacial_topcon",
    label: "610-625W Bifacial Topcon",
    pdfSpecification: "610-625W Bifacial Topcon",
  },
  {
    key: "premier_600_625_bifacial_topcon",
    label: "600-625W Bifacial Topcon",
    pdfSpecification: "600-625W Bifacial Topcon",
  },
  {
    key: "ina_500_600_bifacial",
    label: "500-600W Bifacial",
    pdfSpecification: "500W - 600W",
  },
  {
    key: "tata_530_570",
    label: "530W - 570W",
    pdfSpecification: "530W - 570W",
  },
  {
    key: "renewsys_540_580",
    label: "540-580W",
    pdfSpecification: "540-580W",
  },
  {
    key: "renewsys_600_630_bifacial_topcon",
    label: "600-630W Bifacial Topcon",
    pdfSpecification: "600-630W Bifacial Topcon",
  },
]

const PANEL_RANGE_BY_BRAND: Record<string, PdfPanelRangeKey[]> = {
  waaree: ["waaree_540_560_bifacial", "waaree_580_700_bifacial_topcon"],
  adani: ["adani_540_580_bifacial", "adani_610_625_bifacial_topcon"],
  premierenergies: ["premier_600_625_bifacial_topcon"],
  premier: ["premier_600_625_bifacial_topcon"],
  ina: ["ina_500_600_bifacial"],
  tata: [TATA_DCR_PANEL_RANGE_KEY],
  // Optional on PDF — do not auto-select; exact entered size (e.g. 545W) until user checks a range.
  renewsys: ["renewsys_540_580", "renewsys_600_630_bifacial_topcon"],
}

function normalizePanelBrandKey(brand?: string): string {
  return String(brand || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
}

export function getPanelPdfRangeOptionsForBrand(panelBrand?: string): PanelPdfRangeOption[] {
  const keys = PANEL_RANGE_BY_BRAND[normalizePanelBrandKey(panelBrand)] || []
  return PANEL_RANGE_CATALOG.filter((option) => keys.includes(option.key))
}

/** Default PDF range checkbox when a panel brand is chosen (INA, Tata package sets, etc.). */
export function defaultPdfPanelRangeKeyForPanelBrand(panelBrand?: string): PdfPanelRangeKey | "" {
  const brandKey = normalizePanelBrandKey(panelBrand)
  // Optional ranges (Waaree / Adani / Premier / RenewSys): leave unchecked so the entered
  // panel size (e.g. 625W) and quantity drive PDF text + system kW until a range is chosen.
  if (
    brandKey === "renewsys" ||
    brandKey === "waaree" ||
    brandKey === "adani" ||
    brandKey === "premier" ||
    brandKey === "premierenergies"
  ) {
    return ""
  }
  const keys = PANEL_RANGE_BY_BRAND[brandKey] || []
  return keys[0] ?? ""
}

/** Pick RenewSys PDF range from entered panel watts when only the legacy boolean is set. */
export function renewsysPdfRangeKeyForPanelWatts(panelW: number): PdfPanelRangeKey {
  return panelW >= 600 ? "renewsys_600_630_bifacial_topcon" : "renewsys_540_580"
}

/** True when the PDF range key is one of the options for this panel brand. */
export function isPdfPanelRangeKeyAllowedForBrand(
  key: string | null | undefined,
  panelBrand?: string,
): boolean {
  const trimmed = String(key || "").trim()
  if (!trimmed) return false
  // Accept briefly-lived key from first RenewSys ship if anything saved it
  const normalizedKey =
    trimmed === "renewsys_600_630" ? "renewsys_600_630_bifacial_topcon" : trimmed
  const option = getPanelPdfRangeOption(normalizedKey)
  if (!option) return false
  const allowed = PANEL_RANGE_BY_BRAND[normalizePanelBrandKey(panelBrand)] || []
  return allowed.includes(option.key)
}

type PdfDisplaySource = ProductSelection & Record<string, unknown>

function brandForPdfRangeField(
  products: PdfDisplaySource,
  field: "pdfPanelRangeKey" | "pdfDcrPanelRangeKey" | "pdfNonDcrPanelRangeKey",
): string {
  if (field === "pdfDcrPanelRangeKey") {
    return String(products.dcrPanelBrand || products.panelBrand || products.panel_brand || "")
  }
  if (field === "pdfNonDcrPanelRangeKey") {
    return String(products.nonDcrPanelBrand || products.non_dcr_panel_brand || "")
  }
  return String(products.panelBrand || products.dcrPanelBrand || products.panel_brand || "")
}

/** Drop range keys that do not belong to the current brand (e.g. Adani Topcon left on RenewSys). */
export function sanitizePdfPanelRangesForBrands(products: ProductSelection): ProductSelection {
  const next = { ...products }
  const record = next as ProductSelection & Record<string, unknown>

  const primaryBrand = brandForPdfRangeField(next as PdfDisplaySource, "pdfPanelRangeKey")
  const primaryRaw = String(next.pdfPanelRangeKey || record.pdf_panel_range_key || "").trim()
  if (primaryRaw && !isPdfPanelRangeKeyAllowedForBrand(primaryRaw, primaryBrand)) {
    next.pdfPanelRangeKey = ""
    next.pdfUsePanelSizeRange = false
    record.pdf_panel_range_key = null
    record.pdf_use_panel_size_range = false
  } else if (primaryRaw === "renewsys_600_630") {
    next.pdfPanelRangeKey = "renewsys_600_630_bifacial_topcon"
  }

  const dcrBrand = brandForPdfRangeField(next as PdfDisplaySource, "pdfDcrPanelRangeKey")
  const dcrRaw = String(next.pdfDcrPanelRangeKey || record.pdf_dcr_panel_range_key || "").trim()
  if (dcrRaw && !isPdfPanelRangeKeyAllowedForBrand(dcrRaw, dcrBrand)) {
    next.pdfDcrPanelRangeKey = ""
    record.pdf_dcr_panel_range_key = null
  } else if (dcrRaw === "renewsys_600_630") {
    next.pdfDcrPanelRangeKey = "renewsys_600_630_bifacial_topcon"
  }

  const nonDcrBrand = brandForPdfRangeField(next as PdfDisplaySource, "pdfNonDcrPanelRangeKey")
  const nonDcrRaw = String(
    next.pdfNonDcrPanelRangeKey || record.pdf_non_dcr_panel_range_key || "",
  ).trim()
  if (nonDcrRaw && !isPdfPanelRangeKeyAllowedForBrand(nonDcrRaw, nonDcrBrand)) {
    next.pdfNonDcrPanelRangeKey = ""
    record.pdf_non_dcr_panel_range_key = null
  } else if (nonDcrRaw === "renewsys_600_630") {
    next.pdfNonDcrPanelRangeKey = "renewsys_600_630_bifacial_topcon"
  }

  return next
}

/** Backfill empty PDF range keys from panel brand — e.g. INA → 500–600W Bifacial. */
export function applyDefaultPdfPanelRanges(products: ProductSelection): ProductSelection {
  const next = sanitizePdfPanelRangesForBrands({ ...products })
  const record = next as ProductSelection & Record<string, unknown>
  const panelType = String(next.panelType || record.panel_type || "").trim().toLowerCase()

  const brandForPrimaryRange =
    panelType === "ina"
      ? "INA"
      : next.panelBrand || next.dcrPanelBrand || ""
  const primaryDefault = defaultPdfPanelRangeKeyForPanelBrand(brandForPrimaryRange)
  const existingPrimary = String(next.pdfPanelRangeKey || record.pdf_panel_range_key || "").trim()
  if (primaryDefault && !existingPrimary) {
    next.pdfPanelRangeKey = primaryDefault
    next.pdfUsePanelSizeRange = true
  } else if (panelType === "ina" && existingPrimary && !existingPrimary.startsWith("ina_")) {
    next.pdfPanelRangeKey = INA_DCR_PANEL_RANGE_KEY
    next.pdfUsePanelSizeRange = true
  }

  const dcrBrandForRange =
    panelType === "ina" ? "INA" : next.dcrPanelBrand || next.panelBrand || ""
  const dcrDefault = defaultPdfPanelRangeKeyForPanelBrand(dcrBrandForRange)
  const existingDcr = String(next.pdfDcrPanelRangeKey || record.pdf_dcr_panel_range_key || "").trim()
  if (dcrDefault && !existingDcr) {
    next.pdfDcrPanelRangeKey = dcrDefault
  } else if (panelType === "ina" && existingDcr && !existingDcr.startsWith("ina_")) {
    next.pdfDcrPanelRangeKey = INA_DCR_PANEL_RANGE_KEY
  }

  const nonDcrDefault = defaultPdfPanelRangeKeyForPanelBrand(next.nonDcrPanelBrand)
  const existingNonDcr = String(
    next.pdfNonDcrPanelRangeKey || record.pdf_non_dcr_panel_range_key || "",
  ).trim()
  if (nonDcrDefault && !existingNonDcr) {
    next.pdfNonDcrPanelRangeKey = nonDcrDefault
  }

  return next
}

export function getPanelPdfRangeOption(key?: string | null): PanelPdfRangeOption | null {
  if (!key) return null
  return PANEL_RANGE_CATALOG.find((option) => option.key === key) ?? null
}

export function getPanelPdfRangeLabel(key?: string | null): string | null {
  return getPanelPdfRangeOption(key)?.pdfSpecification ?? null
}

function pickPdfPanelRangeKey(
  products: PdfDisplaySource,
  field: "pdfPanelRangeKey" | "pdfDcrPanelRangeKey" | "pdfNonDcrPanelRangeKey",
  snakeField: string,
): PdfPanelRangeKey | null {
  const hasCamel = Object.prototype.hasOwnProperty.call(products, field)
  const hasSnake = Object.prototype.hasOwnProperty.call(products, snakeField)
  let raw = products[field] ?? products[snakeField]
  if (typeof raw === "string" && raw.trim() === "renewsys_600_630") {
    raw = "renewsys_600_630_bifacial_topcon"
  }
  const brand = brandForPdfRangeField(products, field)

  if (hasCamel || hasSnake) {
    if (raw === null || raw === undefined || (typeof raw === "string" && !raw.trim())) {
      return null
    }
    if (typeof raw === "string" && raw.trim()) {
      const option = getPanelPdfRangeOption(raw.trim())
      if (!option) return null
      // Stale Adani/Waaree keys left on RenewSys (etc.) must not drive PDF/details.
      if (!isPdfPanelRangeKeyAllowedForBrand(option.key, brand)) return null
      return option.key
    }
  }

  if (field === "pdfPanelRangeKey" && Boolean(products.pdfUsePanelSizeRange ?? products.pdf_use_panel_size_range)) {
    const brandKey = normalizePanelBrandKey(brand)
    // Optional-range brands: only an explicit checkbox key drives the PDF — never invent from
    // the legacy boolean (that left Waaree/Adani showing a range while boxes looked unchecked).
    if (
      brandKey === "waaree" ||
      brandKey === "adani" ||
      brandKey === "premier" ||
      brandKey === "premierenergies" ||
      brandKey === "renewsys"
    ) {
      return null
    }
    if (brandKey === "ina") return "ina_500_600_bifacial"
    return null
  }
  return null
}

export function resolvePdfPanelRangeKey(
  products: PdfDisplaySource,
  scope: "primary" | "dcr" | "nonDcr" = "primary",
): PdfPanelRangeKey | null {
  if (scope === "dcr") {
    return pickPdfPanelRangeKey(products, "pdfDcrPanelRangeKey", "pdf_dcr_panel_range_key")
  }
  if (scope === "nonDcr") {
    return pickPdfPanelRangeKey(products, "pdfNonDcrPanelRangeKey", "pdf_non_dcr_panel_range_key")
  }
  return pickPdfPanelRangeKey(products, "pdfPanelRangeKey", "pdf_panel_range_key")
}

export function shouldHidePanelQuantityOnPdf(
  products: PdfDisplaySource,
  scope: "primary" | "dcr" | "nonDcr" = "primary",
): boolean {
  return resolvePdfPanelRangeKey(products, scope) != null
}

export function isPdfCommercialSet(products: PdfDisplaySource | null | undefined): boolean {
  if (!products) return false
  const raw = products as Record<string, unknown>
  if (products.pdfCommercialSet === true || raw.pdf_commercial_set === true) return true
  const text = String(products.pdfCommercialSet ?? raw.pdf_commercial_set ?? "")
    .trim()
    .toLowerCase()
  return text === "true" || text === "1"
}

export function readPdfDisplayFlags(products: PdfDisplaySource) {
  const primaryRange = resolvePdfPanelRangeKey(products, "primary")
  const dcrRange = resolvePdfPanelRangeKey(products, "dcr")
  const nonDcrRange = resolvePdfPanelRangeKey(products, "nonDcr")
  return {
    pdfPanelRangeKey: primaryRange,
    pdfDcrPanelRangeKey: dcrRange,
    pdfNonDcrPanelRangeKey: nonDcrRange,
    pdfCommercialSet: isPdfCommercialSet(products),
    /** @deprecated use pdfPanelRangeKey */
    usePanelSizeRange: primaryRange != null,
    /** @deprecated inverter brand comes from dropdown */
    useInverterBrandOptions: false,
  }
}

export function formatPanelSizeForPdf(
  panelSize: string | undefined,
  rangeKey?: PdfPanelRangeKey | null,
): string {
  if (rangeKey) {
    return getPanelPdfRangeLabel(rangeKey) ?? QUOTATION_AS_PER_THE_SET_LABEL
  }
  if (isAsPerTheSetLabel(panelSize)) return QUOTATION_AS_PER_THE_SET_LABEL
  if (!panelSize?.trim()) return ""
  return panelSize.trim()
}

/** When a PDF range is selected, hide panel count on PDF. */
export function formatPanelSizeWithQuantityForPdf(
  panelSize: string | undefined,
  quantity: number | undefined,
  rangeKey?: PdfPanelRangeKey | null,
): string {
  const size = formatPanelSizeForPdf(panelSize, rangeKey)
  if (!size) return ""
  const showQty = !rangeKey && quantity != null && Number(quantity) > 0
  return showQty ? `${size} × ${quantity}` : size
}

export function formatPanelBrandLineForPdf(
  brand: string | undefined,
  panelSize: string | undefined,
  quantity: number | undefined,
  rangeKey?: PdfPanelRangeKey | null,
): string {
  const brandPart = (brand || "").trim()
  const sizeQty = formatPanelSizeWithQuantityForPdf(panelSize, quantity, rangeKey)
  const parts: string[] = []
  if (brandPart) parts.push(brandPart)
  if (sizeQty) parts.push(sizeQty)
  return parts.join(" ").trim() || "N/A"
}

export function getPdfInverterLine(products: ProductSelection): string {
  if (isAsPerTheSetLabel(products.inverterSize) || isAsPerTheSetLabel(products.inverterBrand)) {
    return QUOTATION_AS_PER_THE_SET_LABEL
  }
  const segments: string[] = []
  const inverterBrand = normalizeInverterBrandForDisplay(products.inverterBrand)
  if (inverterBrand) segments.push(inverterBrand)
  if (products.inverterType?.trim()) segments.push(products.inverterType.trim())
  if (products.inverterSize?.trim()) segments.push(products.inverterSize.trim())
  return segments.join(" - ") || "N/A"
}

export function getPdfPanelSpecLine(products: ProductSelection): string {
  const rangeKey = resolvePdfPanelRangeKey(products as PdfDisplaySource, "primary")
  return formatPanelBrandLineForPdf(
    products.panelBrand,
    products.panelSize,
    products.panelQuantity,
    rangeKey,
  )
}

/** Fixed Mounting Structure specification lines on the solar proposal PDF. */
export const MOUNTING_STRUCTURE_PDF_SPEC_LINES = [
  "Tata GI Structure & Tata GI Pipes(2mm)",
  "Leg-72*72",
  "Rafter-60*40",
  "Parlin-40*40",
] as const

export function getMountingStructurePdfSpecification(): string {
  return MOUNTING_STRUCTURE_PDF_SPEC_LINES.join("\n")
}

export function getMountingStructurePdfBrandModel(
  products: Pick<ProductSelection, "structureType" | "structureSize">,
): string {
  const type = products.structureType?.trim()
  const size = products.structureSize?.trim()
  if (type && size) return `${type} — ${size}`
  if (type) return type
  return `GI Structure for RCC/Tin Roof — ${size || "As Required"}`
}
