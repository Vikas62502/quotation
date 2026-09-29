// @ts-nocheck
/**
 * =============================================================================
 * BACKEND REFERENCE — Subvendors + office-inside ledger (Sep 2026)
 * =============================================================================
 *
 * Frontend:
 *   - Admin Panel → ⋯ → Subvendor
 *   - Route: GET /dashboard/subvendors  (`app/dashboard/subvendors/page.tsx`)
 *   - `lib/api.ts` → `api.admin.subvendors`
 *   - `lib/admin-subvendors.ts` + `lib/admin-subvendor-ledger.ts`
 *
 * Auth: admin JWT (role admin / super-admin, or access includes "admin").
 * 403 for dealer / visitor / account-management unless they have admin access.
 *
 * Two tables:
 *   1) subvendors          — office inside (linked dealer) + office outside (registration)
 *   2) subvendor_ledger    — editable amounts per approved quotation
 *
 * -----------------------------------------------------------------------------
 * SQL
 * -----------------------------------------------------------------------------
 *
 * CREATE TABLE IF NOT EXISTS subvendors (
 *   id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *   kind          VARCHAR(32) NOT NULL CHECK (kind IN ('office_inside', 'office_outside')),
 *   dealer_id     VARCHAR(64) NULL REFERENCES dealers(id) ON DELETE SET NULL,
 *   name          VARCHAR(255) NOT NULL,
 *   contact_name  VARCHAR(255) NOT NULL DEFAULT '',
 *   mobile        VARCHAR(32)  NOT NULL DEFAULT '',
 *   email         VARCHAR(255) NOT NULL DEFAULT '',
 *   city          VARCHAR(128) NOT NULL DEFAULT '',
 *   category      VARCHAR(64)  NOT NULL DEFAULT 'Other',
 *   notes         TEXT         NOT NULL DEFAULT '',
 *   created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
 *   updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
 * );
 *
 * CREATE UNIQUE INDEX IF NOT EXISTS subvendors_office_inside_dealer_uidx
 *   ON subvendors (dealer_id)
 *   WHERE kind = 'office_inside' AND dealer_id IS NOT NULL;
 *
 * CREATE INDEX IF NOT EXISTS subvendors_kind_idx ON subvendors (kind);
 *
 * CREATE TABLE IF NOT EXISTS subvendor_ledger (
 *   id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *   quotation_id     VARCHAR(64) NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
 *   vendor_id        UUID NULL REFERENCES subvendors(id) ON DELETE SET NULL,
 *   loan_amount      NUMERIC(14, 2) NOT NULL DEFAULT 0,
 *   cash_amount      NUMERIC(14, 2) NOT NULL DEFAULT 0,
 *   received_amount  NUMERIC(14, 2) NOT NULL DEFAULT 0,
 *   remaining        NUMERIC(14, 2) NOT NULL DEFAULT 0,
 *   proposal         NUMERIC(14, 2) NOT NULL DEFAULT 0,
 *   cost_of_site     NUMERIC(14, 2) NOT NULL DEFAULT 0,
 *   file_charges     NUMERIC(14, 2) NOT NULL DEFAULT 0,
 *   pi               NUMERIC(14, 2) NOT NULL DEFAULT 0,
 *   gst_charges      NUMERIC(14, 2) NOT NULL DEFAULT 0,
 *   others           NUMERIC(14, 2) NOT NULL DEFAULT 0,
 *   updated_by       VARCHAR(64) NULL,
 *   created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 *   updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 *   UNIQUE (quotation_id)
 * );
 *
 * CREATE INDEX IF NOT EXISTS subvendor_ledger_vendor_idx ON subvendor_ledger (vendor_id);
 *
 * -----------------------------------------------------------------------------
 * Sequelize models (copy-paste)
 * -----------------------------------------------------------------------------
 *
 * Subvendor.init({
 *   id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
 *   kind: { type: DataTypes.STRING(32), allowNull: false },
 *   dealerId: { type: DataTypes.STRING(64), allowNull: true, field: 'dealer_id' },
 *   name: { type: DataTypes.STRING(255), allowNull: false },
 *   contactName: { type: DataTypes.STRING(255), allowNull: false, defaultValue: '', field: 'contact_name' },
 *   mobile: { type: DataTypes.STRING(32), allowNull: false, defaultValue: '' },
 *   email: { type: DataTypes.STRING(255), allowNull: false, defaultValue: '' },
 *   city: { type: DataTypes.STRING(128), allowNull: false, defaultValue: '' },
 *   category: { type: DataTypes.STRING(64), allowNull: false, defaultValue: 'Other' },
 *   notes: { type: DataTypes.TEXT, allowNull: false, defaultValue: '' },
 * }, { tableName: 'subvendors', underscored: true, timestamps: true })
 *
 * SubvendorLedger.init({
 *   id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
 *   quotationId: { type: DataTypes.STRING(64), allowNull: false, unique: true, field: 'quotation_id' },
 *   vendorId: { type: DataTypes.UUID, allowNull: true, field: 'vendor_id' },
 *   loanAmount: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0, field: 'loan_amount' },
 *   cashAmount: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0, field: 'cash_amount' },
 *   receivedAmount: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0, field: 'received_amount' },
 *   remaining: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
 *   proposal: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
 *   costOfSite: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0, field: 'cost_of_site' },
 *   fileCharges: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0, field: 'file_charges' },
 *   pi: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
 *   gstCharges: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0, field: 'gst_charges' },
 *   others: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
 *   updatedBy: { type: DataTypes.STRING(64), allowNull: true, field: 'updated_by' },
 * }, { tableName: 'subvendor_ledger', underscored: true, timestamps: true })
 *
 * -----------------------------------------------------------------------------
 * Endpoints
 * -----------------------------------------------------------------------------
 *
 * GET    /admin/subvendors
 * POST   /admin/subvendors
 * PATCH  /admin/subvendors/:id
 * DELETE /admin/subvendors/:id
 *
 * GET    /admin/subvendors/ledger
 * PATCH  /admin/subvendors/ledger/:quotationId
 *
 * Query on GET /admin/subvendors:
 *   kind = office_inside | office_outside  (optional)
 *
 * Query on GET /admin/subvendors/ledger:
 *   vendorId  (optional — filter by subvendors.dealer_id)
 *   search    (optional — customer name / mobile / vendor name)
 *
 * -----------------------------------------------------------------------------
 * Request / response
 * -----------------------------------------------------------------------------
 *
 * POST /admin/subvendors body:
 * {
 *   "kind": "office_inside" | "office_outside",
 *   "dealerId": "uuid-or-empty",          // required when kind=office_inside
 *   "name": "Vendor name",                // required when kind=office_outside
 *   "contactName": "",
 *   "mobile": "",
 *   "email": "",
 *   "city": "",
 *   "category": "Other",
 *   "notes": ""
 * }
 *
 * Accept snake_case aliases: dealer_id, contact_name.
 *
 * Validation:
 *   office_inside  → dealerId required; name may be filled from dealer profile
 *   office_outside → name required; dealerId ignored / null
 *   office_inside unique per dealer_id (409 SUBVENDOR_DUP if already linked)
 *
 * GET /admin/subvendors 200:
 * {
 *   "success": true,
 *   "data": {
 *     "subvendors": [ { id, kind, dealerId, name, contactName, mobile, email, city, category, notes, createdAt, updatedAt } ]
 *   }
 * }
 *
 * PATCH /admin/subvendors/ledger/:quotationId body (partial — only sent fields):
 * {
 *   "loanAmount": 100000,
 *   "cashAmount": 80000,
 *   "receivedAmount": 40000,
 *   "remaining": 60000,
 *   "proposal": 180000,
 *   "costOfSite": 150000,
 *   "fileCharges": 2000,
 *   "pi": 1500,
 *   "gstCharges": 900,
 *   "others": 0
 * }
 *
 * Accept snake_case: loan_amount, cash_amount, received_amount, cost_of_site, file_charges, gst_charges.
 * Amounts are INR integers (round). Missing keys must NOT reset existing columns to 0.
 *
 * Upsert by quotation_id. Set vendor_id from the office_inside subvendor whose dealer_id
 * matches the quotation.dealer_id when possible.
 *
 * GET /admin/subvendors/ledger 200:
 * {
 *   "success": true,
 *   "data": {
 *     "items": [
 *       {
 *         "quotationId": "...",
 *         "vendorId": "...",
 *         "loanAmount": 0,
 *         "cashAmount": 0,
 *         "receivedAmount": 0,
 *         "remaining": 0,
 *         "proposal": 0,
 *         "costOfSite": 0,
 *         "fileCharges": 0,
 *         "pi": 0,
 *         "gstCharges": 0,
 *         "others": 0,
 *         "updatedAt": "..."
 *       }
 *     ]
 *   }
 * }
 *
 * Echo both camelCase and snake_case on GET (frontend reads camelCase first).
 *
 * -----------------------------------------------------------------------------
 * Controller sketch
 * -----------------------------------------------------------------------------
 */

function roundInr(value) {
  const n = Math.round(Number(value) || 0)
  return Number.isFinite(n) && n >= 0 ? n : 0
}

function publicSubvendor(row) {
  return {
    id: row.id,
    kind: row.kind,
    dealerId: row.dealerId || row.dealer_id || "",
    dealer_id: row.dealerId || row.dealer_id || "",
    name: row.name,
    contactName: row.contactName || row.contact_name || "",
    contact_name: row.contactName || row.contact_name || "",
    mobile: row.mobile || "",
    email: row.email || "",
    city: row.city || "",
    category: row.category || "Other",
    notes: row.notes || "",
    createdAt: row.createdAt || row.created_at,
    updatedAt: row.updatedAt || row.updated_at,
  }
}

function publicLedger(row) {
  const n = (v) => roundInr(v)
  return {
    quotationId: row.quotationId || row.quotation_id,
    quotation_id: row.quotationId || row.quotation_id,
    vendorId: row.vendorId || row.vendor_id || null,
    vendor_id: row.vendorId || row.vendor_id || null,
    loanAmount: n(row.loanAmount ?? row.loan_amount),
    loan_amount: n(row.loanAmount ?? row.loan_amount),
    cashAmount: n(row.cashAmount ?? row.cash_amount),
    cash_amount: n(row.cashAmount ?? row.cash_amount),
    receivedAmount: n(row.receivedAmount ?? row.received_amount),
    received_amount: n(row.receivedAmount ?? row.received_amount),
    remaining: n(row.remaining),
    proposal: n(row.proposal),
    costOfSite: n(row.costOfSite ?? row.cost_of_site),
    cost_of_site: n(row.costOfSite ?? row.cost_of_site),
    fileCharges: n(row.fileCharges ?? row.file_charges),
    file_charges: n(row.fileCharges ?? row.file_charges),
    pi: n(row.pi),
    gstCharges: n(row.gstCharges ?? row.gst_charges),
    gst_charges: n(row.gstCharges ?? row.gst_charges),
    others: n(row.others),
    updatedAt: row.updatedAt || row.updated_at,
  }
}

/**
 * POST /admin/subvendors
 * PATCH /admin/subvendors/:id
 * DELETE /admin/subvendors/:id  (do not delete ledger rows; ON DELETE SET NULL vendor_id)
 *
 * PATCH ledger: findOrCreate by quotation_id, then assign only provided amount keys.
 *
 * Error codes:
 *   AUTH_004          — not admin
 *   VAL_KIND          — kind missing / invalid
 *   VAL_DEALER        — office_inside without dealerId
 *   VAL_NAME          — office_outside without name
 *   SUBVENDOR_DUP     — that dealer is already an office_inside vendor (409)
 *   SUBVENDOR_404     — id not found
 *   QUOTATION_404     — ledger quotation id not found
 */
export const SUBVENDOR_ERROR_CODES = {
  AUTH_004: "AUTH_004",
  VAL_KIND: "VAL_KIND",
  VAL_DEALER: "VAL_DEALER",
  VAL_NAME: "VAL_NAME",
  SUBVENDOR_DUP: "SUBVENDOR_DUP",
  SUBVENDOR_404: "SUBVENDOR_404",
  QUOTATION_404: "QUOTATION_404",
}

export { publicSubvendor, publicLedger, roundInr }
