// @ts-nocheck
/**
 * =============================================================================
 * BACKEND REFERENCE — Structure type "Mono Real"
 * =============================================================================
 *
 * Frontend (Oct 2026):
 *   Structure Configuration dropdown always offers "Mono Real" (SPA merges it
 *   even when GET product-catalog only lists GI Structure).
 *   PDF mounting-structure spec becomes "Mono Real Structure" when selected.
 *
 * Live risk (same class as §BF ACDB As per the set):
 *   POST /api/quotations  and  PATCH /api/quotations/:id/products
 *   → 400 Invalid structure type: Mono Real
 *   Frontend may surface that as VAL_003 "Final amount is required".
 *   Do not reuse VAL_003 for catalog failures.
 *
 * Canonical label: "Mono Real"  (not "GI Structure", not "Mono Rail" on disk)
 *
 * Wire into: validateProductSelection, product-catalog GET merge,
 *            POST /api/quotations, PATCH /api/quotations/:id/products,
 *            GET quotation products JSON, pricing-tables.structures.
 *
 * -----------------------------------------------------------------------------
 * 1) Allowlist
 * -----------------------------------------------------------------------------
 */

export const MONO_REAL_STRUCTURE_TYPE = "Mono Real"

export function isMonoRealStructureType(value) {
  const v = String(value || "").trim().toLowerCase().replace(/\s+/g, " ")
  return v === "mono rail" || v === "mono rail"
}

export function canonicalStructureType(value) {
  if (isMonoRealStructureType(value)) return MONO_REAL_STRUCTURE_TYPE
  return String(value || "").trim()
}

/**
 * In validateProductSelection (structure type branch):
 *
 *   const type = canonicalStructureType(products.structureType)
 *   const catalogTypes = catalog?.structures?.types || []
 *   const allowed =
 *     isMonoRealStructureType(type) ||
 *     catalogTypes.some((t) => String(t).trim().toLowerCase() === type.toLowerCase())
 *
 *   if (!allowed) {
 *     // 400 VAL_PRODUCT — "Invalid structure type: …"
 *     // NOT VAL_003
 *   }
 *
 * Persist `type` (canonical "Mono Real"). GET must echo the same string.
 * Do not rewrite to "GI Structure".
 *
 * Structure sizes: reuse existing catalog sizes (1kW, 2kW, 3kW, 5kW, 10kW, …).
 * No new size enum.
 */

/**
 * -----------------------------------------------------------------------------
 * 2) Product catalog GET — always include Mono Real
 * -----------------------------------------------------------------------------
 *
 * GET /api/quotations/product-catalog  (and admin catalog GET)
 *
 *   structures.types = unique merge of stored types + ["Mono Real"]
 *
 * PUT catalog must accept "Mono Real" in types[] (do not strip it).
 */

export function mergeStructureTypes(catalogTypes) {
  const seen = new Set()
  const result = []
  for (const type of [...(catalogTypes || []), MONO_REAL_STRUCTURE_TYPE]) {
    const trimmed = String(type || "").trim()
    if (!trimmed) continue
    const key = trimmed.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    result.push(isMonoRealStructureType(trimmed) ? MONO_REAL_STRUCTURE_TYPE : trimmed)
  }
  return result
}

/**
 * -----------------------------------------------------------------------------
 * 3) Pricing tables — structures[]
 * -----------------------------------------------------------------------------
 *
 * Same INR as GI Structure. Add if missing on GET/PUT seed:
 *
 *   { "type": "Mono Real", "size": "1kW",  "price": 8000 }
 *   { "type": "Mono Real", "size": "3kW",  "price": 24000 }
 *   { "type": "Mono Real", "size": "5kW",  "price": 40000 }
 *   { "type": "Mono Real", "size": "10kW", "price": 80000 }
 *
 * Lookup: type + size. If no Mono Real row, fall back to GI Structure same size.
 * Do not 400 when the extra rows are not seeded yet.
 */

export const MONO_REAL_STRUCTURE_PRICING = [
  { type: MONO_REAL_STRUCTURE_TYPE, size: "1kW", price: 8000 },
  { type: MONO_REAL_STRUCTURE_TYPE, size: "3kW", price: 24000 },
  { type: MONO_REAL_STRUCTURE_TYPE, size: "5kW", price: 40000 },
  { type: MONO_REAL_STRUCTURE_TYPE, size: "10kW", price: 80000 },
]

export function mergeMonoRealStructurePricing(structures) {
  const rows = Array.isArray(structures) ? [...structures] : []
  for (const extra of MONO_REAL_STRUCTURE_PRICING) {
    const exists = rows.some(
      (row) =>
        isMonoRealStructureType(row.type) &&
        String(row.size || "").trim().toLowerCase() === extra.size.toLowerCase(),
    )
    if (!exists) rows.push(extra)
  }
  return rows
}

/**
 * -----------------------------------------------------------------------------
 * 4) Persist + GET echo
 * -----------------------------------------------------------------------------
 *
 * POST /api/quotations  and  PATCH /api/quotations/:id/products
 *
 * Body (products):
 * {
 *   "structureType": "Mono Real",
 *   "structure_type": "Mono Real",
 *   "structureSize": "5kW",
 *   "structurePrice": 40000
 * }
 *
 * GET products must echo camelCase first:
 * {
 *   "structureType": "Mono Real",
 *   "structure_type": "Mono Real"
 * }
 *
 * Missing / empty stays empty. Do not default Mono Real quotations back to GI.
 */

export function publicStructureTypeFields(products) {
  const structureType = canonicalStructureType(
    products.structureType || products.structure_type,
  )
  return {
    structureType,
    structure_type: structureType,
    structureSize: products.structureSize || products.structure_size || "",
    structure_size: products.structureSize || products.structure_size || "",
    structurePrice: Number(products.structurePrice ?? products.structure_price) || 0,
    structure_price: Number(products.structurePrice ?? products.structure_price) || 0,
  }
}

export const QUOTATION_PRODUCT_ERROR_CODES = {
  VAL_003: "VAL_003", // finalAmount missing only — not catalog
  VAL_PRODUCT: "VAL_PRODUCT",
}
