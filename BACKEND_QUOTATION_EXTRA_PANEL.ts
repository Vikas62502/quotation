// @ts-nocheck
/**
 * =============================================================================
 * BACKEND REFERENCE — PDF range checkbox allows +1 extra panel
 * =============================================================================
 *
 * Frontend (Oct 2026):
 *   Unchecked PDF panel-range boxes → package panel count (e.g. 8 × 620W).
 *   Checked box (540–580 / 610–625 / 600–630, etc.) → one extra panel (9).
 *   Quantity stays visible and is POSTed. Uncheck clamps back to 8.
 *
 * Live risk:
 *   If validateProductSelection (or a DC-watt cap) uses
 *     panelW * qty <= systemKw * 1000 + 400
 *   then 9 × 620W = 5580W fails a 5kW package (max 5400W) → 400.
 *   Frontend may surface that as VAL_003. Do not reuse VAL_003.
 *
 * No new field. pdfPanelRangeKey (or DCR/Non-DCR twin) is the flag.
 *
 * Wire into: validateProductSelection, POST /api/quotations,
 *            PATCH /api/quotations/:id/products, GET quotation products JSON.
 *
 * Do not change pricing / subsidy from this extra panel.
 *
 * -----------------------------------------------------------------------------
 * 1) Cap
 * -----------------------------------------------------------------------------
 */

export const MAX_PACKAGE_OVERSHOOT_WATTS = 400

function parsePanelWatts(panelSize) {
  const n = Number.parseFloat(String(panelSize || "").replace(/[^\d.]/g, ""))
  return Number.isFinite(n) && n > 0 ? n : 0
}

function parseSystemKw(structureSize, inverterSize) {
  const source = String(structureSize || inverterSize || "").trim()
  const n = Number.parseFloat(source.replace(/kW/i, ""))
  return Number.isFinite(n) && n > 0 ? n : 0
}

function hasPdfRangeKey(value) {
  return Boolean(String(value || "").trim())
}

export function maxPanelQuantityForPackage(systemKw, panelSize, { allowExtraPanel } = {}) {
  const panelW = parsePanelWatts(panelSize)
  if (!(systemKw > 0) || panelW <= 0) return 0
  let maxW = systemKw * 1000 + MAX_PACKAGE_OVERSHOOT_WATTS
  if (allowExtraPanel) maxW += panelW
  return Math.max(1, Math.floor(maxW / panelW))
}

/**
 * In validateProductSelection:
 *
 *   const extra = hasPdfRangeKey(products.pdfPanelRangeKey || products.pdf_panel_range_key)
 *   const maxQty = maxPanelQuantityForPackage(systemKw, products.panelSize, {
 *     allowExtraPanel: extra,
 *   })
 *   if (products.panelQuantity > maxQty) { 400 VAL_PRODUCT — not VAL_003 }
 *
 * Persist products.panelQuantity as sent. Do not rewrite 9 → 8.
 * GET must echo the same integer.
 *
 * BOTH:
 *   dcrPanelQuantity    + pdfDcrPanelRangeKey
 *   nonDcrPanelQuantity + pdfNonDcrPanelRangeKey
 *
 * Tata / As per the set may still send panelQuantity 0 (existing §X 2.3).
 * If the dealer sent 9 with a non-Tata range key, keep 9 — do not force 0.
 */

export function publicPanelQuantityFields(products) {
  const extra = hasPdfRangeKey(products.pdfPanelRangeKey || products.pdf_panel_range_key)
  const systemKw = parseSystemKw(products.structureSize, products.inverterSize)
  const qty = Number(products.panelQuantity ?? products.panel_quantity) || 0
  return {
    panelQuantity: qty,
    panel_quantity: qty,
    pdfPanelRangeKey: extra
      ? String(products.pdfPanelRangeKey || products.pdf_panel_range_key).trim()
      : "",
    pdf_panel_range_key: extra
      ? String(products.pdfPanelRangeKey || products.pdf_panel_range_key).trim()
      : null,
    maxPanelQuantity: maxPanelQuantityForPackage(systemKw, products.panelSize, {
      allowExtraPanel: extra,
    }),
  }
}

/**
 * -----------------------------------------------------------------------------
 * 2) Example bodies
 * -----------------------------------------------------------------------------
 *
 * Checked (extra panel):
 * {
 *   "panelBrand": "Adani",
 *   "panelSize": "620W",
 *   "panelQuantity": 9,
 *   "structureSize": "5kW",
 *   "inverterSize": "5.4kW",
 *   "pdfPanelRangeKey": "adani_610_625_bifacial_topcon",
 *   "pdfUsePanelSizeRange": true
 * }
 *
 * Unchecked:
 * {
 *   "panelSize": "620W",
 *   "panelQuantity": 8,
 *   "pdfPanelRangeKey": "",
 *   "pdfUsePanelSizeRange": false
 * }
 */

export const QUOTATION_PRODUCT_ERROR_CODES = {
  VAL_003: "VAL_003", // finalAmount missing only — not catalog / qty cap
  VAL_PRODUCT: "VAL_PRODUCT",
}
