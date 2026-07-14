import type { ProductSelection } from "@/lib/quotation-context"
import { isPdfCommercialSet, sanitizePdfPanelRangesForBrands } from "@/lib/quotation-pdf-display"

const STORAGE_PREFIX = "quotation_pdf_flags_"

export type StoredQuotationPdfFlags = Pick<
  ProductSelection,
  | "pdfPanelRangeKey"
  | "pdfDcrPanelRangeKey"
  | "pdfNonDcrPanelRangeKey"
  | "pdfCommercialSet"
  | "pdfUsePanelSizeRange"
> & {
  /** Exact panel size/qty for PDF when API catalog snaps wattage (e.g. 625W). */
  panelSize?: string
  panelQuantity?: number
  dcrPanelSize?: string
  dcrPanelQuantity?: number
}

function storageKey(quotationId: string): string {
  return `${STORAGE_PREFIX}${quotationId}`
}

/** Read PDF display flags cached for a quotation (survives API round-trips until backend persists them). */
export function readLocalQuotationPdfFlags(quotationId: string): StoredQuotationPdfFlags | null {
  if (typeof window === "undefined" || !quotationId.trim()) return null
  try {
    const raw = localStorage.getItem(storageKey(quotationId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredQuotationPdfFlags
    return parsed && typeof parsed === "object" ? parsed : null
  } catch {
    return null
  }
}

/** Cache PDF display flags after a successful products save. */
export function writeLocalQuotationPdfFlags(quotationId: string, products: ProductSelection): void {
  if (typeof window === "undefined" || !quotationId.trim()) return
  const sanitized = sanitizePdfPanelRangesForBrands(products)
  const raw = sanitized as ProductSelection & Record<string, unknown>
  const panelSize = String(sanitized.panelSize || raw.panel_size || "").trim() || undefined
  const dcrPanelSize = String(sanitized.dcrPanelSize || raw.dcr_panel_size || "").trim() || undefined
  const panelQuantity = Number(sanitized.panelQuantity ?? raw.panel_quantity)
  const dcrPanelQuantity = Number(sanitized.dcrPanelQuantity ?? raw.dcr_panel_quantity)
  const payload: StoredQuotationPdfFlags = {
    pdfPanelRangeKey:
      String(sanitized.pdfPanelRangeKey || raw.pdf_panel_range_key || "").trim() || undefined,
    pdfDcrPanelRangeKey:
      String(sanitized.pdfDcrPanelRangeKey || raw.pdf_dcr_panel_range_key || "").trim() || undefined,
    pdfNonDcrPanelRangeKey:
      String(sanitized.pdfNonDcrPanelRangeKey || raw.pdf_non_dcr_panel_range_key || "").trim() ||
      undefined,
    pdfCommercialSet: isPdfCommercialSet(sanitized),
    pdfUsePanelSizeRange: Boolean(
      sanitized.pdfUsePanelSizeRange ||
        raw.pdf_use_panel_size_range ||
        sanitized.pdfPanelRangeKey ||
        raw.pdf_panel_range_key,
    ),
    panelSize,
    dcrPanelSize,
    ...(Number.isFinite(panelQuantity) && panelQuantity > 0 ? { panelQuantity } : {}),
    ...(Number.isFinite(dcrPanelQuantity) && dcrPanelQuantity > 0 ? { dcrPanelQuantity } : {}),
  }
  try {
    localStorage.setItem(storageKey(quotationId), JSON.stringify(payload))
  } catch {
    // ignore quota / private mode errors
  }
}

/** Merge locally cached PDF flags when the API response omits them. */
export function applyLocalQuotationPdfFlags(
  quotationId: string | undefined,
  products: ProductSelection,
): ProductSelection {
  if (!quotationId?.trim()) return products
  const stored = readLocalQuotationPdfFlags(quotationId)
  if (!stored) return products

  let next = { ...products }
  const record = next as ProductSelection & Record<string, unknown>

  if (!isPdfCommercialSet(next) && stored.pdfCommercialSet === true) {
    next = { ...next, pdfCommercialSet: true } as ProductSelection
    ;(next as ProductSelection & Record<string, unknown>).pdf_commercial_set = true
  } else if (stored.pdfCommercialSet === false && !isPdfCommercialSet(next)) {
    next = { ...next, pdfCommercialSet: false } as ProductSelection
    ;(next as ProductSelection & Record<string, unknown>).pdf_commercial_set = false
  }

  if (!String(next.pdfPanelRangeKey || record.pdf_panel_range_key || "").trim() && stored.pdfPanelRangeKey) {
    next = { ...next, pdfPanelRangeKey: stored.pdfPanelRangeKey, pdfUsePanelSizeRange: true }
  }
  if (!String(next.pdfDcrPanelRangeKey || record.pdf_dcr_panel_range_key || "").trim() && stored.pdfDcrPanelRangeKey) {
    next = { ...next, pdfDcrPanelRangeKey: stored.pdfDcrPanelRangeKey }
  }
  if (
    !String(next.pdfNonDcrPanelRangeKey || record.pdf_non_dcr_panel_range_key || "").trim() &&
    stored.pdfNonDcrPanelRangeKey
  ) {
    next = { ...next, pdfNonDcrPanelRangeKey: stored.pdfNonDcrPanelRangeKey }
  }

  // Prefer dealer-entered size/qty over catalog-snapped API values (e.g. 625W × 8).
  if (stored.panelSize?.trim()) {
    next = { ...next, panelSize: stored.panelSize.trim() }
    if (String(next.systemType || "").toLowerCase() === "dcr") {
      next = { ...next, dcrPanelSize: stored.dcrPanelSize?.trim() || stored.panelSize.trim() }
    }
  } else if (stored.dcrPanelSize?.trim()) {
    next = { ...next, dcrPanelSize: stored.dcrPanelSize.trim() }
  }
  if (stored.panelQuantity != null && stored.panelQuantity > 0) {
    next = { ...next, panelQuantity: stored.panelQuantity }
    if (String(next.systemType || "").toLowerCase() === "dcr") {
      next = {
        ...next,
        dcrPanelQuantity: stored.dcrPanelQuantity || stored.panelQuantity,
      }
    }
  } else if (stored.dcrPanelQuantity != null && stored.dcrPanelQuantity > 0) {
    next = { ...next, dcrPanelQuantity: stored.dcrPanelQuantity }
  }

  // Drop cached Adani/Waaree keys that do not match the current panel brand (e.g. RenewSys).
  return sanitizePdfPanelRangesForBrands(next)
}
