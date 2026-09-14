import type { ProductSelection } from "@/lib/quotation-context"
import { isPdfCommercialSet, sanitizePdfPanelRangesForBrands } from "@/lib/quotation-pdf-display"

const STORAGE_PREFIX = "quotation_pdf_flags_"

export type StoredQuotationPdfFlags = {
  pdfPanelRangeKey: string
  pdfDcrPanelRangeKey: string
  pdfNonDcrPanelRangeKey: string
  pdfCommercialSet: boolean
  pdfUsePanelSizeRange: boolean
  /** True once dealer saved — empty range must stay empty on reopen (not re-defaulted). */
  pdfPanelRangeChoiceSaved: boolean
  /** Exact panel size/qty for PDF when API catalog snaps wattage (e.g. 625W). */
  panelSize?: string
  panelQuantity?: number
  dcrPanelSize?: string
  dcrPanelQuantity?: number
}

function storageKey(quotationId: string): string {
  return `${STORAGE_PREFIX}${quotationId}`
}

function clearPrimaryPdfRange(products: ProductSelection): ProductSelection {
  const next = {
    ...products,
    pdfPanelRangeKey: "",
    pdfUsePanelSizeRange: false,
  } as ProductSelection & Record<string, unknown>
  next.pdf_panel_range_key = null
  next.pdf_use_panel_size_range = false
  return next as ProductSelection
}

function setPrimaryPdfRange(products: ProductSelection, key: string): ProductSelection {
  const next = {
    ...products,
    pdfPanelRangeKey: key,
    pdfUsePanelSizeRange: true,
  } as ProductSelection & Record<string, unknown>
  next.pdf_panel_range_key = key
  next.pdf_use_panel_size_range = true
  return next as ProductSelection
}

/** Read PDF display flags cached for a quotation (survives API round-trips until backend persists them). */
export function readLocalQuotationPdfFlags(quotationId: string): StoredQuotationPdfFlags | null {
  if (typeof window === "undefined" || !quotationId.trim()) return null
  try {
    const raw = localStorage.getItem(storageKey(quotationId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<StoredQuotationPdfFlags>
    if (!parsed || typeof parsed !== "object") return null
    return {
      pdfPanelRangeKey: String(parsed.pdfPanelRangeKey || "").trim(),
      pdfDcrPanelRangeKey: String(parsed.pdfDcrPanelRangeKey || "").trim(),
      pdfNonDcrPanelRangeKey: String(parsed.pdfNonDcrPanelRangeKey || "").trim(),
      pdfCommercialSet: parsed.pdfCommercialSet === true,
      pdfUsePanelSizeRange: parsed.pdfUsePanelSizeRange === true,
      pdfPanelRangeChoiceSaved: parsed.pdfPanelRangeChoiceSaved === true || "pdfUsePanelSizeRange" in parsed,
      panelSize: parsed.panelSize,
      panelQuantity: parsed.panelQuantity,
      dcrPanelSize: parsed.dcrPanelSize,
      dcrPanelQuantity: parsed.dcrPanelQuantity,
    }
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
  const primaryKey = String(sanitized.pdfPanelRangeKey || raw.pdf_panel_range_key || "").trim()
  const dcrKey = String(sanitized.pdfDcrPanelRangeKey || raw.pdf_dcr_panel_range_key || "").trim()
  const nonDcrKey = String(
    sanitized.pdfNonDcrPanelRangeKey || raw.pdf_non_dcr_panel_range_key || "",
  ).trim()

  const payload: StoredQuotationPdfFlags = {
    // Keep empty string (not omit) so reopen knows the dealer left the box unchecked.
    pdfPanelRangeKey: primaryKey,
    pdfDcrPanelRangeKey: dcrKey,
    pdfNonDcrPanelRangeKey: nonDcrKey,
    pdfCommercialSet: isPdfCommercialSet(sanitized),
    pdfUsePanelSizeRange: Boolean(primaryKey),
    pdfPanelRangeChoiceSaved: true,
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

  // Local choice always wins on reopen (checked key OR explicit unchecked).
  if (stored.pdfPanelRangeChoiceSaved) {
    if (stored.pdfPanelRangeKey) {
      next = setPrimaryPdfRange(next, stored.pdfPanelRangeKey)
    } else {
      next = clearPrimaryPdfRange(next)
    }
  } else if (stored.pdfPanelRangeKey) {
    next = setPrimaryPdfRange(next, stored.pdfPanelRangeKey)
  }

  if (
    !String(next.pdfDcrPanelRangeKey || record.pdf_dcr_panel_range_key || "").trim() &&
    stored.pdfDcrPanelRangeKey
  ) {
    next = { ...next, pdfDcrPanelRangeKey: stored.pdfDcrPanelRangeKey }
  } else if (stored.pdfPanelRangeChoiceSaved && !stored.pdfDcrPanelRangeKey) {
    next = { ...next, pdfDcrPanelRangeKey: "" }
    ;(next as ProductSelection & Record<string, unknown>).pdf_dcr_panel_range_key = null
  }

  if (
    !String(next.pdfNonDcrPanelRangeKey || record.pdf_non_dcr_panel_range_key || "").trim() &&
    stored.pdfNonDcrPanelRangeKey
  ) {
    next = { ...next, pdfNonDcrPanelRangeKey: stored.pdfNonDcrPanelRangeKey }
  } else if (stored.pdfPanelRangeChoiceSaved && !stored.pdfNonDcrPanelRangeKey) {
    next = { ...next, pdfNonDcrPanelRangeKey: "" }
    ;(next as ProductSelection & Record<string, unknown>).pdf_non_dcr_panel_range_key = null
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
