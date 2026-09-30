// @ts-nocheck
/**
 * =============================================================================
 * BACKEND REFERENCE — Quotation ACDB/DCDB As per the set + lithium battery
 * =============================================================================
 *
 * Live bug (Sep 2026):
 *   Saving / revising a quotation (Tata package, ACDB/DCDB = "As per the set")
 *   returns 400 with details:
 *     - Invalid ACDB option: As per the set
 *     - Invalid DCDB option: As per the set
 *   Frontend currently wraps this as VAL_003 "Final amount is required" even
 *   when finalAmount is present (e.g. ₹302,000). Do not reuse VAL_003 for
 *   catalog errors.
 *
 * Frontend:
 *   - Form/PDF keep "As per the set" for Tata ACDB/DCDB
 *   - SPA maps to Havells+Elmex / Elmex on POST only as a workaround
 *   - Lithium checkbox: products.includeLithiumBattery
 *
 * Wire into: validateProductSelection, POST /api/quotations,
 *            PATCH /api/quotations/:id/products, GET quotation products JSON.
 *
 * -----------------------------------------------------------------------------
 * 1) ACDB / DCDB — accept package-set labels
 * -----------------------------------------------------------------------------
 */

export const AS_PER_THE_SET_LABELS = ["as per the set", "as per set"]

export function isAsPerSetLabel(value) {
  const v = String(value || "").trim().toLowerCase()
  return v === "as per the set" || v === "as per set"
}

/**
 * In validateProductSelection (ACDB / DCDB branches):
 *
 *   if (isAsPerSetLabel(products.acdb)) { /* valid — skip catalog SKU list *\/ }
 *   if (isAsPerSetLabel(products.dcdb)) { /* valid — skip catalog SKU list *\/ }
 *
 * Persist verbatim. GET must echo the same string (do not rewrite to
 * "Havells+Elmex (1-Phase)" on GET).
 *
 * Same rule already exists for inverterBrand / inverterSize / panelSize
 * (BACKEND_CHANGES_REQUIRED.md §2.2). Apply it to acdb + dcdb.
 *
 * Error code for catalog failures: VAL_PRODUCT (or existing product code).
 * Do NOT return VAL_003 (that means finalAmount missing).
 */

/**
 * -----------------------------------------------------------------------------
 * 2) Lithium battery include flag
 * -----------------------------------------------------------------------------
 *
 * Persist on quotation products (JSONB column or quotation_products row):
 *
 *   includeLithiumBattery  boolean  (default false)
 *   include_lithium_battery  (snake alias)
 *   batteryCapacity / battery_capacity  string  (e.g. "100kWh")
 *   hybridInverter / hybrid_inverter    string
 *   batteryPrice / battery_price        number
 *
 * POST /api/quotations  and  PATCH /api/quotations/:id/products
 *
 * Body (products):
 * {
 *   "includeLithiumBattery": true,
 *   "include_lithium_battery": true,
 *   "batteryCapacity": "100kWh",
 *   "hybridInverter": "Vsole",
 *   "batteryPrice": 2006000
 * }
 *
 * GET must echo camelCase first:
 * {
 *   "includeLithiumBattery": true,
 *   "include_lithium_battery": true,
 *   "batteryCapacity": "100kWh"
 * }
 *
 * PATCH: if includeLithiumBattery is omitted, keep stored value (do not force false).
 * If sent (including false), save that value.
 *
 * Proposal PDF shows a Lithium Battery row only when the flag is true.
 */

export function publicLithiumBatteryFields(products) {
  const included =
    products.includeLithiumBattery === true ||
    products.include_lithium_battery === true ||
    String(products.includeLithiumBattery ?? products.include_lithium_battery ?? "")
      .trim()
      .toLowerCase() === "true"
  return {
    includeLithiumBattery: included,
    include_lithium_battery: included,
    batteryCapacity: products.batteryCapacity || products.battery_capacity || "",
    battery_capacity: products.batteryCapacity || products.battery_capacity || "",
    hybridInverter: products.hybridInverter || products.hybrid_inverter || "",
    hybrid_inverter: products.hybridInverter || products.hybrid_inverter || "",
    batteryPrice: Number(products.batteryPrice ?? products.battery_price) || 0,
    battery_price: Number(products.batteryPrice ?? products.battery_price) || 0,
  }
}

export const QUOTATION_PRODUCT_ERROR_CODES = {
  VAL_003: "VAL_003", // finalAmount missing only — not catalog
  VAL_PRODUCT: "VAL_PRODUCT",
}
