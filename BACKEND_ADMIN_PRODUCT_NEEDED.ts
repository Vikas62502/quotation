// @ts-nocheck
/**
 * =============================================================================
 * BACKEND REFERENCE — Admin Product Needed
 * =============================================================================
 *
 * Frontend:
 *   - Admin Panel → Product Needed tab
 *   - `lib/api.ts` → `api.admin.productNeeded.getAll`
 *   - `lib/load-admin-product-needed.ts` (API first, quotation-list fallback)
 *   - `lib/admin-product-needed.ts` (row shape + client fallback filters)
 *
 * Endpoint (required for production):
 *   GET /admin/product-needed
 *
 * Auth: admin JWT only (403 for dealer / visitor / account-management).
 *
 * -----------------------------------------------------------------------------
 * Query parameters
 * -----------------------------------------------------------------------------
 *
 * | Param      | Type   | Description |
 * |------------|--------|-------------|
 * | tab        | string | `file_login` (default) or `login_approved` |
 * | page       | int    | Default 1 |
 * | limit      | int    | Default 500, max 2000 (frontend sends 2000) |
 * | dealerId   | string | Filter by quotation.dealer_id |
 * | search     | string | ILIKE on quotation id, customer name, mobile |
 * | startDate  | YYYY-MM-DD | Inclusive lower bound |
 * | endDate    | YYYY-MM-DD | Inclusive upper bound |
 * | dateField  | string | `file_login` (default) or `approved` — which timestamp startDate/endDate apply to |
 *
 * Tab rules (must match frontend `filterQuotationsForProductNeeded`):
 *   file_login:
 *     file_login_status IN ('already_login','login_now') OR file_login_at IS NOT NULL
 *   login_approved:
 *     same file-login rule AND LOWER(status) = 'approved'
 *
 * Installation gate (required for ALL rows — match `isQuotationEligibleForProductNeeded`):
 *   installation_status IN (
 *     'installer_approved','pending_metering','metering_in_progress','metering_approved',
 *     'mco','pending_baldev','baldev_approved','completed'
 *   )
 *   OR installer_approved_at IS NOT NULL
 *   OR at least one installation completion image URL on the quotation
 *     (siteCompletionImages, per-field *Url, installationImageUrls, etc.)
 *
 * Date filter column:
 *   dateField=file_login  → filter on quotations.file_login_at
 *   dateField=approved    → filter on quotations.status_approved_at
 *
 * Sort: file_login_at DESC NULLS LAST for file_login tab;
 *       status_approved_at DESC for login_approved tab.
 *
 * -----------------------------------------------------------------------------
 * Response envelope
 * -----------------------------------------------------------------------------
 *
 * {
 *   "success": true,
 *   "data": {
 *     "rows": [ { ...ProductNeededRow } ],
 *     "tabCounts": {
 *       "fileLogin": 42,
 *       "loginApproved": 18
 *     },
 *     "pagination": {
 *       "page": 1,
 *       "limit": 2000,
 *       "total": 42,
 *       "totalPages": 1
 *     }
 *   }
 * }
 *
 * `tabCounts` should reflect global counts (ignoring tab filter) but MAY respect
 * dealerId/search/date filters if cheap; frontend only uses them for tab badges.
 *
 * -----------------------------------------------------------------------------
 * Row shape (camelCase; snake_case aliases accepted on read by frontend)
 * -----------------------------------------------------------------------------
 *
 * {
 *   quotationId: string,
 *   customerName: string,
 *   customerMobile: string,
 *   dealerName: string,
 *   systemKw: string,          // e.g. "5kW" or "—"
 *   systemType: string,        // e.g. "DCR", "BOTH", "CUSTOMIZE"
 *   panels: string,            // human-readable summary — panels ONLY
 *   inverter: string,          // brand · size — inverter ONLY
 *   fileLoginStatus: string,   // "Already logged in" | "Login now" | "—"
 *   fileLoginAt: ISO string | null,
 *   statusApprovedAt: ISO string | null,
 *   quotationStatus: string
 * }
 *
 * Do NOT include structure, meter, cable, or other SKUs — procurement view is
 * panels + inverter only (see `buildPanelsSummary` / `buildInverterSummary` in
 * `lib/admin-product-needed.ts` for parity).
 *
 * Products source: merge `quotations.products` JSON with `quotation_products` row
 * (same as GET /admin/quotations). Frontend uses `mergeQuotationProductSources`.
 *
 * Required quotation columns on GET (if using fallback list instead of this route):
 *   fileLoginStatus, fileLoginAt, status, statusApprovedAt, dealerId,
 *   customer { firstName, lastName, mobile }, products / quotationProduct join.
 *
 * -----------------------------------------------------------------------------
 * Example SQL sketch (PostgreSQL)
 * -----------------------------------------------------------------------------
 */

const FILE_LOGIN_WHERE = `
  (
    q.file_login_status IN ('already_login', 'login_now')
    OR q.file_login_at IS NOT NULL
  )
`

const LOGIN_APPROVED_WHERE = `
  ${FILE_LOGIN_WHERE}
  AND LOWER(q.status) = 'approved'
`

function buildTabWhere(tab) {
  return tab === "login_approved" ? LOGIN_APPROVED_WHERE : FILE_LOGIN_WHERE
}

function buildDateWhere(dateField, startDate, endDate) {
  const col = dateField === "approved" ? "q.status_approved_at" : "q.file_login_at"
  const parts = []
  if (startDate) parts.push(`${col}::date >= $startDate::date`)
  if (endDate) parts.push(`${col}::date <= $endDate::date`)
  return parts.length ? parts.join(" AND ") : "TRUE"
}

/**
 * Pseudocode handler — adapt to your ORM (Sequelize / Prisma / raw SQL).
 */
export async function getAdminProductNeeded(req, res) {
  const user = req.admin ?? req.user
  if (!user || user.role !== "admin") {
    return res.status(403).json({ success: false, message: "Forbidden" })
  }

  const tab = String(req.query.tab || "file_login").toLowerCase() === "login_approved"
    ? "login_approved"
    : "file_login"
  const page = Math.max(1, parseInt(req.query.page, 10) || 1)
  const limit = Math.min(2000, Math.max(1, parseInt(req.query.limit, 10) || 500))
  const offset = (page - 1) * limit
  const dealerId = req.query.dealerId ? String(req.query.dealerId).trim() : null
  const search = req.query.search ? String(req.query.search).trim() : null
  const dateField = String(req.query.dateField || (tab === "login_approved" ? "approved" : "file_login"))
  const startDate = req.query.startDate || null
  const endDate = req.query.endDate || null

  // 1) Base query with joins: quotations q, customers c, dealers d, quotation_products qp (optional)
  // 2) WHERE buildTabWhere(tab) AND dealer filter AND search AND buildDateWhere(...)
  // 3) Map each row → ProductNeededRow using same panel/inverter formatting as frontend
  // 4) Compute tabCounts with two COUNT queries (file_login + login_approved) under same filters except tab

  const rows = [] // mapped ProductNeededRow[]
  const total = 0
  const fileLoginCount = 0
  const loginApprovedCount = 0

  return res.json({
    success: true,
    data: {
      rows,
      tabCounts: {
        fileLogin: fileLoginCount,
        loginApproved: loginApprovedCount,
      },
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
 * Panel summary helpers — keep in sync with lib/admin-product-needed.ts
 */
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
    const nonDcr = formatPanelLine(products.nonDcrPanelBrand, products.nonDcrPanelSize, products.nonDcrPanelQuantity)
    const lines = []
    if (dcr) lines.push(`DCR: ${dcr}`)
    if (nonDcr) lines.push(`Non-DCR: ${nonDcr}`)
    return lines.length ? lines.join(" | ") : "—"
  }
  if (systemType === "customize" && Array.isArray(products.customPanels)) {
    const lines = products.customPanels
      .map((p) => formatPanelLine(p.brand, p.size, p.quantity))
      .filter(Boolean)
    return lines.length ? lines.join(" | ") : "—"
  }
  const primary = formatPanelLine(
    products.panelBrand || products.dcrPanelBrand,
    products.panelSize || products.dcrPanelSize,
    products.panelQuantity || products.dcrPanelQuantity,
  )
  return primary || "—"
}

function buildInverterSummary(products) {
  const brand = String(products.inverterBrand || products.inverter_brand || "").trim()
  const size = String(products.inverterSize || products.inverter_size || "").trim()
  if (brand && size) return `${brand} · ${size}`
  return brand || size || "—"
}

/**
 * QA checklist
 * 1. Quotation with file_login_status=login_now appears in file_login tab.
 * 2. Approved + file login appears in login_approved only.
 * 3. BOTH system shows DCR and Non-DCR panel lines.
 * 4. dealerId + date range filters work server-side.
 * 5. Without this route, frontend falls back to GET /admin/quotations client-side build.
 */

export { buildTabWhere, buildDateWhere, buildPanelsSummary, buildInverterSummary }
