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
>

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
    next = { ...next, pdfCommercialSet: true, pdf_commercial_set: true }
  } else if (stored.pdfCommercialSet === false && !isPdfCommercialSet(next)) {
    next = { ...next, pdfCommercialSet: false, pdf_commercial_set: false }
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

  // Drop cached Adani/Waaree keys that do not match the current panel brand (e.g. RenewSys).
  return sanitizePdfPanelRangesForBrands(next)
}
