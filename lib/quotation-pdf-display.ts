import type { ProductSelection } from "@/lib/quotation-context"

/** Shown on PDF when `pdfUsePanelSizeRange` is true (exact size stays in DB for pricing). */
export const PDF_PANEL_SIZE_RANGE_LABEL = "540W-620W"

/** Shown on PDF when `pdfUseInverterBrandOptions` is true. */
export const PDF_INVERTER_BRAND_OPTIONS_LABEL = "Vsole/Xwatt/Saatvik"

type PdfDisplaySource = Pick<
  ProductSelection,
  "pdfUsePanelSizeRange" | "pdfUseInverterBrandOptions"
> &
  Record<string, unknown>

export function readPdfDisplayFlags(products: PdfDisplaySource) {
  return {
    usePanelSizeRange: Boolean(
      products.pdfUsePanelSizeRange ?? products.pdf_use_panel_size_range,
    ),
    useInverterBrandOptions: Boolean(
      products.pdfUseInverterBrandOptions ?? products.pdf_use_inverter_brand_options,
    ),
  }
}

export function formatPanelSizeForPdf(
  panelSize: string | undefined,
  usePanelSizeRange: boolean,
): string {
  if (!panelSize?.trim()) return ""
  return usePanelSizeRange ? PDF_PANEL_SIZE_RANGE_LABEL : panelSize.trim()
}

/** When range checkbox is on, hide panel count (no "× 9") on PDF. */
export function formatPanelSizeWithQuantityForPdf(
  panelSize: string | undefined,
  quantity: number | undefined,
  usePanelSizeRange: boolean,
): string {
  const size = formatPanelSizeForPdf(panelSize, usePanelSizeRange)
  if (!size) return ""
  const showQty = !usePanelSizeRange && quantity != null && Number(quantity) > 0
  return showQty ? `${size} × ${quantity}` : size
}

export function formatPanelBrandLineForPdf(
  brand: string | undefined,
  panelSize: string | undefined,
  quantity: number | undefined,
  usePanelSizeRange: boolean,
): string {
  const brandPart = (brand || "").trim()
  const sizeQty = formatPanelSizeWithQuantityForPdf(panelSize, quantity, usePanelSizeRange)
  const parts: string[] = []
  if (brandPart) parts.push(brandPart)
  if (sizeQty) parts.push(sizeQty)
  return parts.join(" ").trim() || "N/A"
}

export function getPdfInverterLine(products: ProductSelection): string {
  const { useInverterBrandOptions } = readPdfDisplayFlags(products)
  const segments: string[] = []

  if (useInverterBrandOptions) {
    segments.push(`Inverter Brand- ${PDF_INVERTER_BRAND_OPTIONS_LABEL}`)
  } else if (products.inverterBrand?.trim()) {
    segments.push(products.inverterBrand.trim())
  }

  if (products.inverterType?.trim()) segments.push(products.inverterType.trim())
  if (products.inverterSize?.trim()) segments.push(products.inverterSize.trim())

  return segments.join(" - ") || "N/A"
}

export function getPdfPanelSpecLine(products: ProductSelection): string {
  const { usePanelSizeRange } = readPdfDisplayFlags(products)
  return formatPanelBrandLineForPdf(
    products.panelBrand,
    products.panelSize,
    products.panelQuantity,
    usePanelSizeRange,
  )
}
