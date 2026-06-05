import type { QuotationProductsPhaseInput } from "@/lib/pricing-tables"

type RecordLike = Record<string, unknown>

const PRODUCT_FIELD_KEYS = [
  "systemType",
  "phase",
  "panelBrand",
  "panelSize",
  "panelQuantity",
  "dcrPanelBrand",
  "dcrPanelSize",
  "dcrPanelQuantity",
  "nonDcrPanelBrand",
  "nonDcrPanelSize",
  "nonDcrPanelQuantity",
  "inverterBrand",
  "inverterSize",
  "structureType",
  "structureSize",
  "customPanels",
  "systemSize",
  "systemKw",
  "pdfPanelRangeKey",
  "pdfDcrPanelRangeKey",
  "pdfNonDcrPanelRangeKey",
  "pdfUsePanelSizeRange",
] as const

const CAMEL_TO_SNAKE: Partial<Record<(typeof PRODUCT_FIELD_KEYS)[number], string>> = {
  systemType: "system_type",
  panelBrand: "panel_brand",
  panelSize: "panel_size",
  panelQuantity: "panel_quantity",
  dcrPanelBrand: "dcr_panel_brand",
  dcrPanelSize: "dcr_panel_size",
  dcrPanelQuantity: "dcr_panel_quantity",
  nonDcrPanelBrand: "non_dcr_panel_brand",
  nonDcrPanelSize: "non_dcr_panel_size",
  nonDcrPanelQuantity: "non_dcr_panel_quantity",
  inverterBrand: "inverter_brand",
  inverterSize: "inverter_size",
  structureType: "structure_type",
  structureSize: "structure_size",
  customPanels: "custom_panels",
  systemSize: "system_size",
  systemKw: "system_kw",
  pdfPanelRangeKey: "pdf_panel_range_key",
  pdfDcrPanelRangeKey: "pdf_dcr_panel_range_key",
  pdfNonDcrPanelRangeKey: "pdf_non_dcr_panel_range_key",
  pdfUsePanelSizeRange: "pdf_use_panel_size_range",
}

function isNonEmptyPlainObject(value: unknown): value is RecordLike {
  return typeof value === "object" && value !== null && !Array.isArray(value) && Object.keys(value).length > 0
}

function hasUsableValue(value: unknown): boolean {
  if (value === undefined || value === null) return false
  if (typeof value === "string") return value.trim() !== ""
  if (typeof value === "number") return !Number.isNaN(value) && value > 0
  if (typeof value === "boolean") return true
  if (Array.isArray(value)) return value.length > 0
  return true
}

/** Drop `products` when API sends `{}` so merges do not erase nested panel config. */
export function omitEmptyProductsField<T extends RecordLike>(record: T): T {
  const out = { ...record }
  const parsed = parseProductsJson(out.products)
  if (!parsed && out.products !== undefined && out.products !== null) {
    const raw = out.products
    if (typeof raw === "object" && !Array.isArray(raw) && Object.keys(raw as object).length === 0) {
      delete out.products
    }
  }
  return out
}

export function parseProductsJson(value: unknown): RecordLike | null {
  if (typeof value === "string") {
    const trimmed = value.trim()
    if (!trimmed) return null
    try {
      const parsed = JSON.parse(trimmed) as unknown
      if (isNonEmptyPlainObject(parsed)) return parsed
    } catch {
      return null
    }
    return null
  }
  if (isNonEmptyPlainObject(value)) return value
  return null
}

/** Common API aliases not covered by camelCase/snake_case pairs. */
const PRODUCT_FIELD_ALIASES: Partial<Record<(typeof PRODUCT_FIELD_KEYS)[number], string[]>> = {
  panelQuantity: ["panelCount", "panel_count", "panelsCount", "panels_count", "numberOfPanels", "no_of_panels"],
  panelSize: ["panelWattage", "panel_wattage", "wattage", "panelW"],
  systemKw: ["capacityKw", "capacity_kw", "ratedCapacityKw", "rated_capacity_kw", "kw", "kW"],
  systemSize: ["capacity", "ratedCapacity", "rated_capacity", "system_capacity"],
}

function pickFromRecordAliases(record: RecordLike, canonical: (typeof PRODUCT_FIELD_KEYS)[number]): unknown {
  const snake = CAMEL_TO_SNAKE[canonical]
  const direct = record[canonical] ?? (snake ? record[snake] : undefined)
  if (hasUsableValue(direct)) return direct
  for (const alias of PRODUCT_FIELD_ALIASES[canonical] || []) {
    const value = record[alias]
    if (hasUsableValue(value)) return value
  }
  const target = canonical.toLowerCase().replace(/_/g, "")
  for (const [key, value] of Object.entries(record)) {
    if (!hasUsableValue(value)) continue
    const normalized = key.toLowerCase().replace(/_/g, "")
    if (normalized === target) return value
  }
  return undefined
}

function pickProductFieldsFromRecord(record?: RecordLike | null): RecordLike {
  if (!record) return {}
  const out: RecordLike = {}
  for (const key of PRODUCT_FIELD_KEYS) {
    const value = pickFromRecordAliases(record, key)
    if (hasUsableValue(value)) out[key] = value
  }
  return out
}

function toPositiveNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") return undefined
  const n = typeof value === "number" ? value : Number.parseFloat(String(value).replace(/,/g, ""))
  if (Number.isNaN(n) || n <= 0) return undefined
  return n
}

function normalizePanelSizeLabel(value: unknown): string {
  if (value === null || value === undefined) return ""
  const text = String(value).trim()
  if (!text) return ""
  if (/^\d+(\.\d+)?$/.test(text)) return `${text}W`
  return text
}

function normalizePdfDisplayFields(out: RecordLike): void {
  const pairs: Array<[string, string]> = [
    ["pdfPanelRangeKey", "pdf_panel_range_key"],
    ["pdfDcrPanelRangeKey", "pdf_dcr_panel_range_key"],
    ["pdfNonDcrPanelRangeKey", "pdf_non_dcr_panel_range_key"],
  ]
  for (const [camel, snake] of pairs) {
    const snakeVal = out[snake]
    const camelVal = out[camel]
    if (camelVal === undefined && snakeVal !== undefined) {
      out[camel] = snakeVal === null ? "" : String(snakeVal).trim()
    }
    if (out[camel] === null) out[camel] = ""
    if (typeof out[camel] === "string" && !(out[camel] as string).trim()) {
      out[camel] = ""
      out[snake] = null
    }
  }
  const primary = String(out.pdfPanelRangeKey || "").trim()
  if (!primary) {
    out.pdfUsePanelSizeRange = false
    out.pdf_use_panel_size_range = false
  }
}

function normalizeMergedProducts(merged: RecordLike): RecordLike {
  const out = { ...merged }
  for (const key of ["panelSize", "dcrPanelSize", "nonDcrPanelSize"] as const) {
    if (out[key] !== undefined) out[key] = normalizePanelSizeLabel(out[key])
  }
  for (const key of ["panelQuantity", "dcrPanelQuantity", "nonDcrPanelQuantity"] as const) {
    const n = toPositiveNumber(out[key])
    if (n !== undefined) out[key] = n
  }
  if (out.systemType !== undefined) out.systemType = String(out.systemType).trim().toLowerCase()
  normalizePdfDisplayFields(out)
  return out
}

function firstProductRowFromArray(value: unknown): RecordLike | null {
  if (!Array.isArray(value) || value.length === 0) return null
  const first = value[0]
  return isNonEmptyPlainObject(first) ? first : null
}

/**
 * Merge product fields from `products` JSON, QuotationProduct row(s), nested `quotation`, and flattened list fields.
 * Matches installer dashboard merge so admin overview kW sums use the same system size as quotation tables.
 */
export function mergeQuotationProductSources(raw: unknown): QuotationProductsPhaseInput {
  if (!raw || typeof raw !== "object") return {}

  const record = omitEmptyProductsField(raw as RecordLike)
  const nested =
    record.quotation && typeof record.quotation === "object" && !Array.isArray(record.quotation)
      ? (record.quotation as RecordLike)
      : null

  const quotationProduct =
    parseProductsJson(record.quotationProduct) ||
    parseProductsJson(record.QuotationProduct) ||
    parseProductsJson(record.quotation_product) ||
    firstProductRowFromArray(record.quotationProducts) ||
    firstProductRowFromArray(record.QuotationProducts) ||
    firstProductRowFromArray(record.quotation_products) ||
    (isNonEmptyPlainObject(record.quotationProduct) ? (record.quotationProduct as RecordLike) : null) ||
    (isNonEmptyPlainObject(record.QuotationProduct) ? (record.QuotationProduct as RecordLike) : null)

  const nestedProduct =
    nested?.quotationProduct && typeof nested.quotationProduct === "object" && !Array.isArray(nested.quotationProduct)
      ? (nested.quotationProduct as RecordLike)
      : nested?.QuotationProduct && typeof nested.QuotationProduct === "object" && !Array.isArray(nested.QuotationProduct)
        ? (nested.QuotationProduct as RecordLike)
        : firstProductRowFromArray(nested?.quotationProducts) ||
          firstProductRowFromArray(nested?.QuotationProducts) ||
          firstProductRowFromArray(nested?.quotation_products)

  const product =
    parseProductsJson(record.product) ||
    (isNonEmptyPlainObject(record.product) ? (record.product as RecordLike) : null)

  const productsFromJson =
    parseProductsJson(record.products) ||
    (isNonEmptyPlainObject(record.products) ? (record.products as RecordLike) : null)

  const nestedProductsFromJson =
    nested && parseProductsJson(nested.products)
      ? parseProductsJson(nested.products)
      : nested && isNonEmptyPlainObject(nested.products)
        ? (nested.products as RecordLike)
        : null

  let merged: RecordLike = {}

  if (nested) {
    merged = { ...merged, ...pickProductFieldsFromRecord(nested) }
    if (nestedProductsFromJson) merged = { ...merged, ...nestedProductsFromJson }
  }

  merged = { ...merged, ...pickProductFieldsFromRecord(record) }
  if (productsFromJson) merged = { ...merged, ...productsFromJson }
  if (quotationProduct) merged = { ...merged, ...quotationProduct, ...pickProductFieldsFromRecord(quotationProduct) }
  if (nestedProduct) merged = { ...merged, ...nestedProduct, ...pickProductFieldsFromRecord(nestedProduct) }
  if (product) merged = { ...merged, ...product, ...pickProductFieldsFromRecord(product) }

  const pricing =
    record.pricing && typeof record.pricing === "object" && !Array.isArray(record.pricing)
      ? (record.pricing as RecordLike)
      : nested?.pricing && typeof nested.pricing === "object" && !Array.isArray(nested.pricing)
        ? (nested.pricing as RecordLike)
        : null
  if (pricing) merged = { ...merged, ...pickProductFieldsFromRecord(pricing) }

  const customPanelsRows = record.customPanels ?? record.custom_panels ?? nested?.customPanels ?? nested?.custom_panels
  if (Array.isArray(customPanelsRows) && customPanelsRows.length > 0) {
    merged.customPanels = customPanelsRows
  }

  return normalizeMergedProducts(merged) as QuotationProductsPhaseInput
}
