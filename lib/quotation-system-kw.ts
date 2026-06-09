import type { Quotation } from "@/lib/quotation-context"
import { mergeQuotationProductSources } from "@/lib/merge-quotation-products"
import { isAsPerTheSetLabel } from "@/lib/quotation-pdf-display"
import { calculateSystemSize, getPricingData, type QuotationProductsPhaseInput } from "@/lib/pricing-tables"

type QuotationRow = Record<string, unknown>

function pickNonEmpty(...values: unknown[]): string {
  for (const value of values) {
    const text = String(value ?? "").trim()
    if (text) return text
  }
  return ""
}

function pickNumber(...values: unknown[]): number | undefined {
  for (const value of values) {
    if (value === null || value === undefined || value === "") continue
    const n = typeof value === "number" ? value : Number.parseFloat(String(value).replace(/,/g, ""))
    if (!Number.isNaN(n) && n > 0) return n
  }
  return undefined
}

export function kwFromSizeLabel(label: string | null | undefined): number {
  if (!label) return 0
  const normalized = String(label).trim().replace(/,/g, "")
  const matched = normalized.match(/([\d.]+)\s*kW/i)
  if (matched) {
    const n = Number.parseFloat(matched[1])
    return Number.isNaN(n) || n <= 0 ? 0 : n
  }
  const n = Number.parseFloat(normalized)
  return Number.isNaN(n) || n <= 0 ? 0 : n
}

function kwFromPanelPair(
  panelSize: string | undefined | null,
  panelQuantity: number | undefined | null,
): number {
  if (!panelSize || !panelQuantity || panelQuantity <= 0) return 0
  const systemSize = calculateSystemSize(panelSize, panelQuantity)
  return systemSize !== "0kW" ? kwFromSizeLabel(systemSize) : 0
}

/** Merge products from nested objects and flattened API row fields (camelCase + snake_case). */
export function resolveQuotationProductsForKw(quotation: unknown): QuotationProductsPhaseInput {
  return mergeQuotationProductSources(quotation)
}

function getDirectSystemKwFromQuotation(quotation: unknown): number {
  if (!quotation || typeof quotation !== "object") return 0

  const record = quotation as QuotationRow
  const merged = mergeQuotationProductSources(quotation) as QuotationRow
  const pricing =
    record.pricing && typeof record.pricing === "object" && !Array.isArray(record.pricing)
      ? (record.pricing as QuotationRow)
      : null

  const directKw = pickNumber(
    merged.systemKw,
    merged.system_kw,
    record.systemKw,
    record.system_kw,
    pricing?.systemKw,
    pricing?.system_kw,
  )
  if (directKw) return directKw

  const sizeLabel = pickNonEmpty(
    merged.systemSize,
    merged.system_size,
    record.systemSize,
    record.system_size,
    pricing?.systemSize,
    pricing?.system_size,
  )
  return kwFromSizeLabel(sizeLabel)
}

/** Numeric system size (kW) from quotation products — same rules as admin system-size display. */
export function getQuotationSystemKwFromProducts(
  products: QuotationProductsPhaseInput | null | undefined,
): number {
  if (!products) return 0

  const systemType = String(products.systemType || "").toLowerCase()

  if (systemType === "both") {
    const dcrKw = kwFromPanelPair(products.dcrPanelSize, products.dcrPanelQuantity)
    const nonDcrKw = kwFromPanelPair(products.nonDcrPanelSize, products.nonDcrPanelQuantity)
    if (dcrKw > 0 || nonDcrKw > 0) return dcrKw + nonDcrKw
    // Mis-labeled BOTH rows may only have panelSize — fall through
  }

  if (systemType === "customize" && products.customPanels?.length) {
    const totalKw =
      products.customPanels.reduce((sum, panel) => {
        if (!panel.size || !panel.quantity) return sum
        const systemSize = calculateSystemSize(panel.size, panel.quantity)
        return systemSize !== "0kW" ? sum + kwFromSizeLabel(systemSize) : sum
      }, 0) || 0
    if (totalKw > 0) return totalKw
  }

  const panelCandidates = [
    kwFromPanelPair(products.panelSize, products.panelQuantity),
    kwFromPanelPair(products.dcrPanelSize, products.dcrPanelQuantity),
    kwFromPanelPair(products.nonDcrPanelSize, products.nonDcrPanelQuantity),
    kwFromSizeLabel(products.structureSize),
    kwFromSizeLabel(products.inverterSize),
  ].filter((n) => n > 0)

  if (panelCandidates.length === 0) {
    const structureKw = kwFromSizeLabel(products.structureSize)
    if (structureKw > 0) return structureKw
    const inverterKw = kwFromSizeLabel(products.inverterSize)
    if (inverterKw > 0 && systemType) return inverterKw
    return 0
  }

  // Single-system rows: use largest plausible kW (avoid double-counting duplicate aliases).
  if (systemType === "both" && panelCandidates.length >= 2) {
    const dcrKw = kwFromPanelPair(products.dcrPanelSize, products.dcrPanelQuantity)
    const nonDcrKw = kwFromPanelPair(products.nonDcrPanelSize, products.nonDcrPanelQuantity)
    if (dcrKw > 0 && nonDcrKw > 0) return dcrKw + nonDcrKw
  }

  return Math.max(...panelCandidates)
}

/** Rounded kW label for PDF header / previews — never “As per the set” (Tata package uses structureSize). */
export function getQuotationSystemKwLabelForPdf(
  products: QuotationProductsPhaseInput | null | undefined,
): string {
  const kw = getQuotationSystemKwFromProducts(products)
  if (kw > 0) return `${Math.max(1, Math.round(kw))} kW`

  const fromCalc = calculateSystemSize(products?.panelSize || "", products?.panelQuantity || 0)
  if (fromCalc && fromCalc !== "0kW") {
    return fromCalc.replace(/kW/i, " kW").replace(/\s+/g, " ").trim()
  }

  const structureKw = kwFromSizeLabel(products?.structureSize)
  if (structureKw > 0) return `${Math.max(1, Math.round(structureKw))} kW`

  const inv = products?.inverterSize?.trim()
  if (inv && !isAsPerTheSetLabel(inv)) {
    return inv.replace(/kW/i, " kW").replace(/\s+/g, " ").trim()
  }

  return "—"
}

type PricedSystemRow = {
  systemSize: string
  price: number
  systemType: string
  phase?: string
  panelType?: string
}

function quotationAmountForKw(quotation: unknown): number {
  if (!quotation || typeof quotation !== "object") return 0
  const q = quotation as QuotationRow
  const products = mergeQuotationProductSources(quotation) as QuotationRow
  const pricing =
    q.pricing && typeof q.pricing === "object" && !Array.isArray(q.pricing)
      ? (q.pricing as QuotationRow)
      : null

  for (const value of [
    q.subtotal,
    pricing?.subtotal,
    q.finalAmount,
    pricing?.finalAmount,
    q.totalAmount,
    pricing?.totalAmount,
    products.systemPrice,
  ]) {
    const n = typeof value === "number" ? value : Number.parseFloat(String(value ?? "").replace(/,/g, ""))
    if (!Number.isNaN(n) && n > 0) return Math.abs(n)
  }
  return 0
}

function collectPricedSystemRows(): PricedSystemRow[] {
  const data = getPricingData()
  const rows: PricedSystemRow[] = []
  for (const p of data.dcr || []) {
    if (p.price > 0) rows.push({ systemSize: p.systemSize, price: p.price, systemType: "dcr", phase: p.phase, panelType: p.panelType })
  }
  for (const p of data.nonDcr || []) {
    if (p.price > 0) {
      rows.push({ systemSize: p.systemSize, price: p.price, systemType: "non-dcr", phase: p.phase, panelType: p.panelType })
    }
  }
  for (const p of data.both || []) {
    if (p.price > 0) {
      rows.push({ systemSize: p.systemSize, price: p.price, systemType: "both", phase: p.phase, panelType: p.panelType })
    }
  }
  return rows
}

/** Match subtotal to catalog price when API omits panel fields. */
export function inferSystemKwFromPricingTables(quotation: unknown): number {
  const amount = quotationAmountForKw(quotation)
  if (amount <= 0) return 0

  const products = mergeQuotationProductSources(quotation) as QuotationRow
  const systemType = String(products.systemType || "").toLowerCase()
  const phase = String(products.phase || "").trim()
  const panelBrand = String(products.panelBrand || products.dcrPanelBrand || "").trim()

  const rows = collectPricedSystemRows()
  let bestKw = 0
  let bestDiff = Number.POSITIVE_INFINITY

  const tryMatch = (strict: boolean) => {
    for (const row of rows) {
      if (strict) {
        if (systemType && row.systemType !== systemType) continue
        if (phase && row.phase && row.phase !== phase) continue
        if (panelBrand && row.panelType && row.panelType !== panelBrand) continue
      }
      const diff = Math.abs(row.price - amount)
      if (diff / amount > 0.08) continue
      if (diff < bestDiff) {
        bestDiff = diff
        bestKw = kwFromSizeLabel(row.systemSize)
      }
    }
  }

  tryMatch(true)
  if (bestKw <= 0) {
    bestDiff = Number.POSITIVE_INFINITY
    tryMatch(false)
  }
  return bestKw > 0 ? bestKw : 0
}

export function getQuotationSystemKw(quotation: Pick<Quotation, "products"> | unknown): number {
  const directKw = getDirectSystemKwFromQuotation(quotation)
  if (directKw > 0) return directKw

  const products = resolveQuotationProductsForKw(quotation)
  const fromProducts = getQuotationSystemKwFromProducts(products)
  if (fromProducts > 0) return fromProducts

  return inferSystemKwFromPricingTables(quotation)
}

export function formatOverviewKw(kw: number): string {
  if (!Number.isFinite(kw) || kw <= 0) return "0 kW"
  if (kw >= 1000) return `${(kw / 1000).toFixed(2)} MW`
  return `${kw.toFixed(1)} kW`
}

export function sumQuotationsSystemKw(quotations: unknown[]): number {
  return quotations.reduce((sum, q) => sum + getQuotationSystemKw(q), 0)
}
