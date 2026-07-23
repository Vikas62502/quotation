// @ts-nocheck
/**
 * =============================================================================
 * BACKEND REFERENCE — Admin Product Needed (Jul 2026)
 * =============================================================================
 *
 * Frontend:
 *   - Admin Panel → Overview → Product Needed (brand card dashboard)
 *   - `lib/api.ts` → `api.admin.productNeeded.getAll`
 *   - `lib/load-admin-product-needed.ts`
 *   - `lib/admin-product-needed.ts` (eligibility + brand aggregation)
 *
 * Endpoint:
 *   GET /admin/product-needed
 *
 * Auth: admin JWT only (403 for dealer / visitor / account-management).
 *
 * WHY THIS EXISTS
 *   Procurement needs totals for installation-pending jobs only, grouped by brand
 *   (one Waaree card with 540W / 560W lines inside; Tata "as per the set" = set count).
 *   Frontend can build this from GET /admin/quotations, but a dedicated route is
 *   preferred for large datasets and correct server-side filtering.
 *
 * -----------------------------------------------------------------------------
 * Query parameters
 * -----------------------------------------------------------------------------
 *
 * | Param      | Type   | Description |
 * |------------|--------|-------------|
 * | scope      | string | `installation_pending` (default). Ignore legacy `tab=file_login|login_approved`. |
 * | page       | int    | Default 1 |
 * | limit      | int    | Default 500, max 2000 (frontend sends 2000) |
 * | dealerId   | string | Filter by quotation.dealer_id |
 * | search     | string | ILIKE on quotation id, customer name, mobile, panel/inverter brand text |
 * | startDate  | YYYY-MM-DD | Inclusive lower bound |
 * | endDate    | YYYY-MM-DD | Inclusive upper bound |
 * | dateField  | string | `installation_released` (default) or `created` |
 *
 * -----------------------------------------------------------------------------
 * Eligibility — MUST match Admin → Pending Installation
 * -----------------------------------------------------------------------------
 *
 * INCLUDE when ALL true:
 *   1. Sent / released to installer:
 *        installation_ready_for_installer = true
 *        OR ready_for_installation = true
 *        OR installation_released_at IS NOT NULL
 *        OR installation_status IN ('pending_installer', 'installer_in_progress')
 *   2. NOT partial approved
 *   3. NOT upload-complete / approved / past installation:
 *        installation_status NOT IN (
 *          installer_approved, pending_metering, metering_in_progress,
 *          metering_approved, meter_installation_pending, meter_install_pending,
 *          mco, pending_baldev, baldev_approved, completed,
 *          installer_partial_approved, partial_approved
 *        )
 *   4. installer_approved_at IS NULL
 *   5. metering_status NOT IN (pending_metering, metering_in_progress, metering_approved, mco)
 *
 * Also ensure GET /admin/quotations returns the same release + status fields so the
 * SPA fallback stays correct if this route is missing.
 *
 * -----------------------------------------------------------------------------
 * Response envelope
 * -----------------------------------------------------------------------------
 *
 * {
 *   "success": true,
 *   "data": {
 *     "rows": [ { ...ProductNeededRow } ],
 *     "aggregates": {                    // OPTIONAL but recommended
 *       "jobCount": 22,
 *       "totalPanels": 151,
 *       "totalInverters": 22,
 *       "panels": [ { ...BrandCard } ],
 *       "inverters": [ { ...BrandCard } ]
 *     },
 *     "pagination": {
 *       "page": 1,
 *       "limit": 2000,
 *       "total": 22,
 *       "totalPages": 1
 *     }
 *   }
 * }
 *
 * BrandCard (one card per brand — NOT one card per wattage):
 * {
 *   brand: "Waaree",
 *   totalQuantity: 63,
 *   jobCount: 8,
 *   sizes: [
 *     { size: "540W", quantity: 54, jobCount: 7, unit: "panels" },
 *     { size: "560W", quantity: 9,  jobCount: 1, unit: "panels" }
 *   ]
 * }
 *
 * unit:
 *   - "panels" | "units" when quantity > 0
 *   - "sets" when size matches /as per/i or package-set with no watt qty
 *     → count 1 set per job (e.g. Tata As per the set across 2 jobs → quantity: 2)
 *
 * -----------------------------------------------------------------------------
 * Row shape
 * -----------------------------------------------------------------------------
 *
 * {
 *   quotationId: string,
 *   dealerId: string,
 *   customerName: string,
 *   customerMobile: string,
 *   dealerName: string,
 *   systemKw: string,                 // "5kW" or "—"
 *   systemType: string,               // DCR | NON-DCR | BOTH | CUSTOMIZE
 *   panels: string,                   // human summary
 *   inverter: string,                 // "Brand · size"
 *   panelLines: [                     // REQUIRED for accurate brand cards
 *     { brand: "Adani", size: "540W", quantity: 10 },
 *     { brand: "Tata",  size: "As per the set", quantity: 0 }  // → 1 set
 *   ],
 *   inverterBrand: string,
 *   inverterSize: string,
 *   inverterQuantity: number,         // usually 1; 0 + "as per the set" → 1 set
 *   installationReleasedAt: ISO | null,
 *   quotationStatus: string
 * }
 *
 * Products: merge quotations.products JSON + quotation_products (same as admin list).
 * Panels + inverter ONLY — no structure / meter / cable.
 */

const INSTALLATION_PENDING_WHERE = `
  (
    q.installation_ready_for_installer IS TRUE
    OR q.ready_for_installation IS TRUE
    OR q.installation_released_at IS NOT NULL
    OR LOWER(COALESCE(q.installation_status, '')) IN ('pending_installer', 'installer_in_progress')
  )
  AND COALESCE(q.installation_partial_approved, FALSE) IS NOT TRUE
  AND COALESCE(LOWER(q.installation_status), '') NOT IN (
    'installer_approved',
    'pending_metering',
    'metering_in_progress',
    'metering_approved',
    'meter_installation_pending',
    'meter_install_pending',
    'mco',
    'pending_baldev',
    'baldev_approved',
    'completed',
    'installer_partial_approved',
    'partial_approved'
  )
  AND q.installer_approved_at IS NULL
  AND COALESCE(LOWER(q.metering_status), '') NOT IN (
    'pending_metering',
    'metering_in_progress',
    'metering_approved',
    'mco'
  )
`

function buildDateWhere(dateField, startDate, endDate) {
  const col =
    dateField === "created"
      ? "q.created_at"
      : "COALESCE(q.installation_released_at, q.status_approved_at, q.created_at)"
  const parts = []
  if (startDate) parts.push(`${col}::date >= $startDate::date`)
  if (endDate) parts.push(`${col}::date <= $endDate::date`)
  return parts.length ? parts.join(" AND ") : "TRUE"
}

function normalizePanelSize(size) {
  const raw = String(size || "").trim()
  if (!raw) return "—"
  const watt = raw.match(/(\d+(?:\.\d+)?)\s*[Ww]/)
  if (watt) return `${watt[1]}W`
  return raw
}

function isSetLine(size) {
  const raw = String(size || "").trim().toLowerCase()
  if (!raw || raw === "—") return false
  if (/as\s*per/.test(raw)) return true
  if (/\bset\b/.test(raw) && !/\d+(?:\.\d+)?\s*w/.test(raw)) return true
  return false
}

/** When qty missing on set packages, count 1 set per job. */
function resolveQty(quantity, size, kind) {
  const q = Number(quantity) || 0
  if (q > 0) return { quantity: q, unit: kind === "panel" ? "panels" : "units" }
  if (isSetLine(size)) return { quantity: 1, unit: "sets" }
  if (kind === "inverter" && String(size || "").trim() && String(size).trim() !== "—") {
    return { quantity: 1, unit: "units" }
  }
  return { quantity: 0, unit: kind === "panel" ? "panels" : "units" }
}

function extractPanelLines(products) {
  const systemType = String(products.systemType || products.system_type || "").toLowerCase()
  const lines = []

  const push = (brand, size, quantity) => {
    const b = String(brand || "").trim() || "—"
    const s = normalizePanelSize(size)
    const q = Number(quantity) || 0
    if (b === "—" && s === "—" && !q) return
    lines.push({ brand: b, size: s, quantity: q })
  }

  if (systemType === "both") {
    push(products.dcrPanelBrand, products.dcrPanelSize, products.dcrPanelQuantity)
    push(products.nonDcrPanelBrand, products.nonDcrPanelSize, products.nonDcrPanelQuantity)
    return lines
  }
  if (systemType === "customize" && Array.isArray(products.customPanels)) {
    for (const p of products.customPanels) push(p.brand, p.size, p.quantity)
    return lines
  }
  push(
    products.panelBrand || products.dcrPanelBrand,
    products.panelSize || products.dcrPanelSize,
    products.panelQuantity || products.dcrPanelQuantity,
  )
  return lines
}

function formatPanelLine(brand, size, quantity) {
  const b = String(brand || "").trim()
  const s = String(size || "").trim()
  const q = quantity && quantity > 0 ? Number(quantity) : 0
  if (!b && !s && !q) return ""
  const parts = [b, s].filter(Boolean).join(" ")
  if (q > 0) return parts ? `${parts} × ${q}` : `× ${q}`
  return parts || "—"
}

function buildPanelsSummary(products) {
  const systemType = String(products.systemType || products.system_type || "").toLowerCase()
  if (systemType === "both") {
    const dcr = formatPanelLine(products.dcrPanelBrand, products.dcrPanelSize, products.dcrPanelQuantity)
    const nonDcr = formatPanelLine(
      products.nonDcrPanelBrand,
      products.nonDcrPanelSize,
      products.nonDcrPanelQuantity,
    )
    const parts = []
    if (dcr) parts.push(`DCR: ${dcr}`)
    if (nonDcr) parts.push(`Non-DCR: ${nonDcr}`)
    return parts.length ? parts.join(" | ") : "—"
  }
  if (systemType === "customize" && Array.isArray(products.customPanels)) {
    const parts = products.customPanels
      .map((p) => formatPanelLine(p.brand, p.size, p.quantity))
      .filter(Boolean)
    return parts.length ? parts.join(" | ") : "—"
  }
  return (
    formatPanelLine(
      products.panelBrand || products.dcrPanelBrand,
      products.panelSize || products.dcrPanelSize,
      products.panelQuantity || products.dcrPanelQuantity,
    ) || "—"
  )
}

function buildInverterSummary(products) {
  const brand = String(products.inverterBrand || products.inverter_brand || "").trim()
  const size = String(products.inverterSize || products.inverter_size || "").trim()
  if (brand && size) return `${brand} · ${size}`
  return brand || size || "—"
}

/**
 * Group rows into one card per brand with size breakdowns.
 * Keep in sync with aggregateProductNeededDashboard in lib/admin-product-needed.ts
 */
function buildBrandAggregates(rows) {
  const panelMap = new Map()
  const inverterMap = new Map()

  const add = (map, brand, size, quantity, unit, quotationId) => {
    if (quantity <= 0) return
    const bKey = String(brand || "—").trim().toLowerCase() || "—"
    const sKey = String(size || "—").trim().toLowerCase() || "—"
    if (!map.has(bKey)) {
      map.set(bKey, { brand: String(brand || "—").trim() || "—", jobs: new Set(), sizes: new Map() })
    }
    const brandEntry = map.get(bKey)
    brandEntry.jobs.add(quotationId)
    if (!brandEntry.sizes.has(sKey)) {
      brandEntry.sizes.set(sKey, {
        size: String(size || "—").trim() || "—",
        quantity: 0,
        jobs: new Set(),
        unit,
      })
    }
    const sizeEntry = brandEntry.sizes.get(sKey)
    sizeEntry.quantity += quantity
    sizeEntry.jobs.add(quotationId)
    if (unit === "sets") sizeEntry.unit = "sets"
  }

  for (const row of rows) {
    for (const line of row.panelLines || []) {
      const resolved = resolveQty(line.quantity, line.size, "panel")
      add(panelMap, line.brand, line.size, resolved.quantity, resolved.unit, row.quotationId)
    }

    let invBrand = String(row.inverterBrand || "").trim() || "—"
    let invSize = String(row.inverterSize || "").trim() || "—"
    if (isSetLine(invBrand) && (invSize === "—" || !invSize)) {
      invSize = invBrand
      invBrand = "As per the set"
    }
    const invResolved = resolveQty(row.inverterQuantity, invSize !== "—" ? invSize : invBrand, "inverter")
    if (invResolved.quantity > 0) {
      add(inverterMap, invBrand, invSize, invResolved.quantity, invResolved.unit, row.quotationId)
    }
  }

  const toCards = (map) =>
    Array.from(map.values())
      .map((entry) => {
        const sizes = Array.from(entry.sizes.values())
          .map((s) => ({
            size: s.size,
            quantity: s.quantity,
            jobCount: s.jobs.size,
            unit: s.unit,
          }))
          .sort((a, b) => b.quantity - a.quantity || a.size.localeCompare(b.size))
        return {
          brand: entry.brand,
          totalQuantity: sizes.reduce((n, s) => n + s.quantity, 0),
          jobCount: entry.jobs.size,
          sizes,
        }
      })
      .sort((a, b) => b.totalQuantity - a.totalQuantity || a.brand.localeCompare(b.brand))

  const panels = toCards(panelMap)
  const inverters = toCards(inverterMap)
  return {
    jobCount: rows.length,
    totalPanels: panels.reduce((n, c) => n + c.totalQuantity, 0),
    totalInverters: inverters.reduce((n, c) => n + c.totalQuantity, 0),
    panels,
    inverters,
  }
}

/**
 * Pseudocode handler — adapt to your ORM (Sequelize / Prisma / raw SQL).
 */
export async function getAdminProductNeeded(req, res) {
  const user = req.admin ?? req.user
  if (!user || (user.role !== "admin" && user.role !== "super-admin")) {
    return res.status(403).json({ success: false, message: "Forbidden" })
  }

  const page = Math.max(1, parseInt(req.query.page, 10) || 1)
  const limit = Math.min(2000, Math.max(1, parseInt(req.query.limit, 10) || 500))
  const dealerId = req.query.dealerId ? String(req.query.dealerId).trim() : null
  const search = req.query.search ? String(req.query.search).trim() : null
  const dateField = String(req.query.dateField || "installation_released")
  const startDate = req.query.startDate || null
  const endDate = req.query.endDate || null

  // 1) SELECT quotations matching INSTALLATION_PENDING_WHERE
  //    + dealerId + search + buildDateWhere(dateField, startDate, endDate)
  // 2) JOIN customers, dealers, quotation_products / products JSON
  // 3) Map each quotation → ProductNeededRow with panelLines + inverter fields
  // 4) aggregates = buildBrandAggregates(rows)
  // 5) Paginate rows (aggregates should use FULL filtered set, not just current page —
  //    either compute aggregates before pagination, or return aggregates only when page=1)

  void page
  void limit
  void dealerId
  void search
  void dateField
  void startDate
  void endDate

  const rows = [] // mapped ProductNeededRow[]
  const aggregates = buildBrandAggregates(rows)
  const total = rows.length

  return res.json({
    success: true,
    data: {
      rows,
      aggregates,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 0,
      },
    },
  })
}

/**
 * QA checklist
 * 1. Only installation-pending (sent to installer, not approved) jobs appear.
 * 2. One Waaree brand card lists 540W and 560W separately inside — not two top-level cards.
 * 3. Adani 540W / 620W quantities sum correctly across jobs.
 * 4. Tata "As per the set" with qty 0 → unit sets, quantity = job count (e.g. 2).
 * 5. Inverters grouped by brand (Vsole/Xwatt → 3kW + 5kW lines).
 * 6. dealerId + date range filters work server-side.
 * 7. Without this route (404), frontend falls back to GET /admin/quotations client-side.
 */

export {
  INSTALLATION_PENDING_WHERE,
  buildDateWhere,
  buildPanelsSummary,
  buildInverterSummary,
  extractPanelLines,
  buildBrandAggregates,
  resolveQty,
  isSetLine,
}
