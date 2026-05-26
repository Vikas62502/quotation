import type { ProductSelection } from "@/lib/quotation-context"

/** Extra combined inverter labels appended after catalog brands in the dropdown. */
export const QUOTATION_EXTRA_INVERTER_BRAND_OPTIONS = ["Vsole/Xwatt/Saatvik", "Vsole/Xwatt"] as const

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
]

const PANEL_RANGE_BY_BRAND: Record<string, PdfPanelRangeKey[]> = {
  waaree: ["waaree_540_560_bifacial", "waaree_580_700_bifacial_topcon"],
  adani: ["adani_540_580_bifacial", "adani_610_625_bifacial_topcon"],
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

export function getPanelPdfRangeOption(key?: string | null): PanelPdfRangeOption | null {
  if (!key) return null
  return PANEL_RANGE_CATALOG.find((option) => option.key === key) ?? null
}

export function getPanelPdfRangeLabel(key?: string | null): string | null {
  return getPanelPdfRangeOption(key)?.pdfSpecification ?? null
}

type PdfDisplaySource = ProductSelection & Record<string, unknown>

function pickPdfPanelRangeKey(
  products: PdfDisplaySource,
  field: "pdfPanelRangeKey" | "pdfDcrPanelRangeKey" | "pdfNonDcrPanelRangeKey",
  snakeField: string,
): PdfPanelRangeKey | null {
  const raw = products[field] ?? products[snakeField]
  if (typeof raw === "string" && raw.trim()) {
    const option = getPanelPdfRangeOption(raw.trim())
    if (option) return option.key
  }
  if (field === "pdfPanelRangeKey" && Boolean(products.pdfUsePanelSizeRange ?? products.pdf_use_panel_size_range)) {
    const brand = normalizePanelBrandKey(
      String(products.panelBrand || products.dcrPanelBrand || products.panel_brand || ""),
    )
    if (brand === "adani") return "adani_610_625_bifacial_topcon"
    if (brand === "waaree") return "waaree_580_700_bifacial_topcon"
    return "adani_610_625_bifacial_topcon"
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

export function readPdfDisplayFlags(products: PdfDisplaySource) {
  const primaryRange = resolvePdfPanelRangeKey(products, "primary")
  const dcrRange = resolvePdfPanelRangeKey(products, "dcr")
  const nonDcrRange = resolvePdfPanelRangeKey(products, "nonDcr")
  return {
    pdfPanelRangeKey: primaryRange,
    pdfDcrPanelRangeKey: dcrRange,
    pdfNonDcrPanelRangeKey: nonDcrRange,
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
  const rangeLabel = getPanelPdfRangeLabel(rangeKey)
  if (rangeLabel) return rangeLabel
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
  const segments: string[] = []
  const brand = products.inverterBrand?.trim()
  if (brand) segments.push(brand)
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
