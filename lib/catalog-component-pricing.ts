/** Admin Catalog — component categories with brand sub-tabs and row pricing. */

export const CATALOG_COMPONENT_KEYS = [
  "panel",
  "inverter",
  "structure",
  "cable",
  "meter",
  "accessories",
] as const

export type CatalogComponentKey = (typeof CATALOG_COMPONENT_KEYS)[number]

export const CATALOG_COMPONENT_LABELS: Record<CatalogComponentKey, string> = {
  panel: "Panel",
  inverter: "Inverter",
  structure: "Structure",
  cable: "Cable",
  meter: "Meter",
  accessories: "Accessories",
}

/** DCR / Non-DCR are content types — not brands. */
export const PANEL_CONTENT_TYPES = ["dcr", "nonDcr"] as const
export type PanelContentType = (typeof PANEL_CONTENT_TYPES)[number]

export const PANEL_CONTENT_TYPE_LABELS: Record<PanelContentType, string> = {
  dcr: "DCR",
  nonDcr: "Non-DCR",
}

/** Panel technology / cell spec (replaces watt in Price set). */
export const PANEL_SPEC_OPTIONS = ["Topcon", "Bifacial"] as const
export type PanelSpec = (typeof PANEL_SPEC_OPTIONS)[number]

const LEGACY_TYPE_BRAND_NAMES = new Set(["dcr", "non-dcr", "nondcr", "non dcr"])

export const INVERTER_PHASE_OPTIONS = ["1-Phase", "3-Phase"] as const
export type InverterPhase = (typeof INVERTER_PHASE_OPTIONS)[number]

export const INVERTER_STRING_OPTIONS = ["Single string", "Dual string", "Multi string"] as const

/** Structure sold by kg or by piece — price fields follow measurement. */
export const STRUCTURE_MEASUREMENT_OPTIONS = ["kg", "piece"] as const
export type StructureMeasurement = (typeof STRUCTURE_MEASUREMENT_OPTIONS)[number]

export const STRUCTURE_MEASUREMENT_LABELS: Record<StructureMeasurement, string> = {
  kg: "Kg",
  piece: "Piece",
}

export type CatalogBrandRow = {
  id: string
  /** Real manufacturer brand (Adani, Waaree, …) — never DCR / Non-DCR. */
  brand?: string
  /** Panel content type (separate from brand). */
  contentType?: PanelContentType
  watt?: number
  perWattPrice?: number
  totalPrice?: number
  /** Inverter */
  kw?: number
  phases?: string
  singleString?: string
  price?: number
  /** Structure */
  product?: string
  measurement?: StructureMeasurement
  /** Qty in kg when measurement is kg; unused for piece. */
  quantity?: number
  perKgPrice?: number
  perPiecePrice?: number
  /** @deprecated prefer quantity when measurement is kg */
  weightKg?: number
  /** Cable */
  mmThickness?: number
  perMeterPrice?: number
  spec?: string
  unitPrice?: number
}

export type CatalogBrandBucket = {
  name: string
  rows: CatalogBrandRow[]
}

export type CatalogComponentPricingData = {
  version: 1
  categories: Record<CatalogComponentKey, { brands: CatalogBrandBucket[] }>
}

const STORAGE_KEY = "admin-catalog-component-pricing-v1"

export function emptyCatalogComponentPricing(): CatalogComponentPricingData {
  const categories = {} as CatalogComponentPricingData["categories"]
  for (const key of CATALOG_COMPONENT_KEYS) {
    categories[key] = { brands: [] }
  }
  return { version: 1, categories }
}

/** True when every category has no priced rows (empty brands or empty buckets). */
export function isCatalogComponentPricingEmpty(
  data: CatalogComponentPricingData | null | undefined,
): boolean {
  if (!data?.categories) return true
  return CATALOG_COMPONENT_KEYS.every((key) => {
    const brands = data.categories[key]?.brands || []
    return brands.every((b) => !b.rows?.length)
  })
}

export function newBrandRowId(): string {
  return `row-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

export function computePanelTotal(watt: number, perWatt: number): number {
  const w = Number(watt) || 0
  const p = Number(perWatt) || 0
  return Math.round(w * p * 100) / 100
}

function parseContentType(raw: unknown, fallbackBrand?: string): PanelContentType {
  const s = String(raw ?? "").trim().toLowerCase()
  if (s === "dcr") return "dcr"
  if (s === "nondcr" || s === "non-dcr" || s === "non dcr" || s === "non_dcr") return "nonDcr"
  const brandKey = String(fallbackBrand || "").trim().toLowerCase()
  if (LEGACY_TYPE_BRAND_NAMES.has(brandKey)) {
    return brandKey === "dcr" ? "dcr" : "nonDcr"
  }
  return "dcr"
}

function isLegacyTypeBrandName(name: string): boolean {
  return LEGACY_TYPE_BRAND_NAMES.has(String(name || "").trim().toLowerCase())
}

/** Normalize API / localStorage payload into a complete Price set shape. */
export function normalizeCatalogComponentPricing(
  raw: unknown,
): CatalogComponentPricingData {
  const parsed =
    raw && typeof raw === "object" ? (raw as Partial<CatalogComponentPricingData>) : null
  if (!parsed || !parsed.categories || typeof parsed.categories !== "object") {
    return emptyCatalogComponentPricing()
  }
  const base = emptyCatalogComponentPricing()
  for (const key of CATALOG_COMPONENT_KEYS) {
    const bucket = (parsed.categories as Record<string, { brands?: unknown }>)[key]
    base.categories[key] = {
      brands: Array.isArray(bucket?.brands)
        ? (bucket!.brands as CatalogBrandBucket[])
            .filter((b) => b && String(b.name || "").trim())
            .map((b) => ({
              name: String(b.name).trim(),
              rows: Array.isArray(b.rows)
                ? b.rows.map((r) => {
                    const bucketName = String(b.name || "").trim()
                    const rawBrand = r.brand != null ? String(r.brand).trim() : bucketName
                    const contentType = parseContentType(
                      (r as { contentType?: unknown }).contentType ??
                        (r as { content_type?: unknown }).content_type,
                      rawBrand,
                    )
                    const brand = isLegacyTypeBrandName(rawBrand) ? "" : rawBrand
                    return {
                      id: String(r.id || newBrandRowId()),
                      brand: brand || undefined,
                      contentType,
                      watt: r.watt != null ? Number(r.watt) : undefined,
                      perWattPrice: r.perWattPrice != null ? Number(r.perWattPrice) : undefined,
                      totalPrice: r.totalPrice != null ? Number(r.totalPrice) : undefined,
                      kw: r.kw != null ? Number(r.kw) : undefined,
                      phases: r.phases != null ? String(r.phases) : undefined,
                      singleString:
                        r.singleString != null
                          ? String(r.singleString)
                          : (r as { single_string?: unknown }).single_string != null
                            ? String((r as { single_string?: unknown }).single_string)
                            : undefined,
                      price: r.price != null ? Number(r.price) : undefined,
                      product:
                        r.product != null
                          ? String(r.product)
                          : r.spec != null
                            ? String(r.spec)
                            : undefined,
                      measurement: (() => {
                        const m = String((r as { measurement?: unknown }).measurement ?? "")
                          .trim()
                          .toLowerCase()
                        if (m === "piece" || m === "pcs" || m === "pc") return "piece" as const
                        if (m === "kg" || m === "kgs") return "kg" as const
                        if (r.perPiecePrice != null && r.perKgPrice == null && r.weightKg == null) {
                          return "piece" as const
                        }
                        return "kg" as const
                      })(),
                      quantity:
                        r.quantity != null
                          ? Number(r.quantity)
                          : r.weightKg != null
                            ? Number(r.weightKg)
                            : undefined,
                      perKgPrice: r.perKgPrice != null ? Number(r.perKgPrice) : undefined,
                      perPiecePrice:
                        r.perPiecePrice != null ? Number(r.perPiecePrice) : undefined,
                      weightKg: r.weightKg != null ? Number(r.weightKg) : undefined,
                      mmThickness: (() => {
                        if (r.mmThickness != null) return Number(r.mmThickness)
                        const mmRaw =
                          (r as { mm?: unknown; thicknessMm?: unknown }).mm ??
                          (r as { thicknessMm?: unknown }).thicknessMm
                        if (mmRaw != null && Number.isFinite(Number(mmRaw))) return Number(mmRaw)
                        const fromSpec = String(r.spec ?? "").match(/(\d+(?:\.\d+)?)/)
                        return fromSpec ? Number(fromSpec[1]) : undefined
                      })(),
                      perMeterPrice: (() => {
                        if (r.perMeterPrice != null) return Number(r.perMeterPrice)
                        const alt = (r as { per_meter_price?: unknown }).per_meter_price
                        if (alt != null) return Number(alt)
                        if (r.unitPrice != null) return Number(r.unitPrice)
                        if (r.price != null) return Number(r.price)
                        return undefined
                      })(),
                      spec: r.spec != null ? String(r.spec) : undefined,
                      unitPrice: r.unitPrice != null ? Number(r.unitPrice) : undefined,
                    }
                  })
                : [],
            }))
            .filter((b) => !isLegacyTypeBrandName(b.name) || b.rows.length > 0)
        : [],
    }
  }
  return normalizePanelRowsToBrandBuckets({ ...base, version: 1 })
}

/** Local cache only — prefer API via fetchCatalogComponentPricing. */
export function loadCatalogComponentPricing(): CatalogComponentPricingData {
  if (typeof window === "undefined") return emptyCatalogComponentPricing()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyCatalogComponentPricing()
    return normalizeCatalogComponentPricing(JSON.parse(raw))
  } catch {
    return emptyCatalogComponentPricing()
  }
}

/** Drop stale local dummy / cache (e.g. after switching to API). */
export function clearCatalogComponentPricingCache() {
  if (typeof window === "undefined") return
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

/** Real brand names only — never DCR / Non-DCR. */
export function panelBrandSelectOptions(
  catalogBrands: string[],
  extraBrands: string[] = [],
): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const name of [...catalogBrands, ...extraBrands]) {
    const trimmed = String(name || "").trim()
    if (!trimmed || isLegacyTypeBrandName(trimmed)) continue
    const key = trimmed.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(trimmed)
  }
  return out
}

/** Keep one bucket per real brand; strip legacy DCR/Non-DCR brand buckets. */
export function normalizePanelRowsToBrandBuckets(
  data: CatalogComponentPricingData,
): CatalogComponentPricingData {
  const next = JSON.parse(JSON.stringify(data)) as CatalogComponentPricingData
  const byBrand = new Map<string, CatalogBrandRow[]>()

  for (const bucket of next.categories.panel.brands) {
    const bucketName = String(bucket.name || "").trim()
    for (const row of bucket.rows) {
      const contentType = parseContentType(row.contentType, row.brand || bucketName)
      let brand = String(row.brand || "").trim()
      if (!brand && !isLegacyTypeBrandName(bucketName)) brand = bucketName
      if (isLegacyTypeBrandName(brand)) brand = ""
      const key = brand || `__unbranded__${contentType}`
      const list = byBrand.get(key) || []
      list.push({ ...row, brand: brand || undefined, contentType })
      byBrand.set(key, list)
    }
    if (bucketName && !isLegacyTypeBrandName(bucketName) && !byBrand.has(bucketName)) {
      byBrand.set(bucketName, [])
    }
  }

  next.categories.panel.brands = Array.from(byBrand.entries()).map(([key, rows]) => ({
    name: key.startsWith("__unbranded__") ? "Unbranded" : key,
    rows,
  }))
  return next
}

export function saveCatalogComponentPricing(data: CatalogComponentPricingData) {
  if (typeof window === "undefined") return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

const CUSTOM_BRANDS_KEY = "admin-catalog-custom-panel-brands-v1"

/** Brands added via “Add new brand” — kept for dropdown next time. */
export function loadCustomPanelBrands(): string[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(CUSTOM_BRANDS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((n) => String(n || "").trim())
      .filter((n) => n && !isLegacyTypeBrandName(n))
  } catch {
    return []
  }
}

export function rememberCustomPanelBrand(name: string) {
  if (typeof window === "undefined") return
  const trimmed = String(name || "").trim()
  if (!trimmed || isLegacyTypeBrandName(trimmed)) return
  const existing = loadCustomPanelBrands()
  if (existing.some((n) => n.toLowerCase() === trimmed.toLowerCase())) return
  localStorage.setItem(CUSTOM_BRANDS_KEY, JSON.stringify([...existing, trimmed]))
}

/** Seed Panel brands from product-catalog names only (not DCR / Non-DCR). */
export function seedPanelBrandsFromNames(
  data: CatalogComponentPricingData,
  brandNames: string[],
): CatalogComponentPricingData {
  const next = JSON.parse(JSON.stringify(data)) as CatalogComponentPricingData
  const existing = new Set(
    next.categories.panel.brands.map((b) => b.name.trim().toLowerCase()),
  )
  for (const name of brandNames) {
    const trimmed = String(name || "").trim()
    if (!trimmed || isLegacyTypeBrandName(trimmed)) continue
    if (existing.has(trimmed.toLowerCase())) continue
    next.categories.panel.brands.push({ name: trimmed, rows: [] })
    existing.add(trimmed.toLowerCase())
  }
  // Drop empty legacy DCR/Non-DCR brand buckets
  next.categories.panel.brands = next.categories.panel.brands.filter(
    (b) => !isLegacyTypeBrandName(b.name) || b.rows.length > 0,
  )
  return next
}
