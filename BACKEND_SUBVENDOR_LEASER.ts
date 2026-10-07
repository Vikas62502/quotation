// @ts-nocheck
/**
 * =============================================================================
 * BACKEND — Dealer leaser payments (Account Management → Subvendor office)
 * =============================================================================
 *
 * Frontend (Oct 2026):
 *   - Account Management → Subvendor office → Dealer leaser → Manage
 *   - `lib/api.ts` → `api.admin.subvendors.leaser`
 *   - `lib/admin-subvendors.ts` (`SubvendorLeaserPayment`)
 *   - `components/admin-subvendor-panel.tsx`
 *
 * Auth: same admin JWT as `/admin/subvendors` (role admin / super-admin, or access includes "admin").
 * 403 for dealer / visitor / account-management unless they have admin access.
 *
 * Why:
 *   Dealer leaser payments are still localStorage-only. Refresh / other devices lose rows.
 *   Current balance must start at 0 and equal SUM(payment.amount) — never file-charges.
 *
 * Also persist on `subvendors` (frontend already sends these on POST/PATCH vendor):
 *   file_cost_per_kw, leaser_paid, leaser_remaining
 *
 * -----------------------------------------------------------------------------
 * UI contract (do not invent a different meaning)
 * -----------------------------------------------------------------------------
 *
 * Per office_inside vendor:
 *   Total file      = count of that dealer's current approved customers (frontend-derived)
 *   kW              = sum of those customers' system kW (frontend-derived)
 *   Current balance = SUM(leaser payment amounts) — INITIAL 0
 *   Total profit    = frontend-derived from proposal × profit_ratio
 *
 * Each payment row:
 *   date (YYYY-MM-DD), amount (INR int), paymentType (Cash|Bank|UPI|Cheque|Other),
 *   remark (string), customerIds (quotation ids, multi-select), sortOrder (Payment 1, 2, …)
 *
 * Newest payment is shown on top; sortOrder 1 stays Payment 1 (older, lower in the list).
 *
 * -----------------------------------------------------------------------------
 * SQL
 * -----------------------------------------------------------------------------
 *
 * ALTER TABLE subvendors
 *   ADD COLUMN IF NOT EXISTS file_cost_per_kw NUMERIC(14, 2) NOT NULL DEFAULT 1000,
 *   ADD COLUMN IF NOT EXISTS leaser_paid NUMERIC(14, 2) NOT NULL DEFAULT 0,
 *   ADD COLUMN IF NOT EXISTS leaser_remaining NUMERIC(14, 2) NOT NULL DEFAULT 0;
 *
 * CREATE TABLE IF NOT EXISTS subvendor_leaser_payments (
 *   id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *   vendor_id      UUID NOT NULL REFERENCES subvendors(id) ON DELETE CASCADE,
 *   payment_date   DATE NOT NULL,
 *   amount         NUMERIC(14, 2) NOT NULL DEFAULT 0,
 *   payment_type   VARCHAR(32) NOT NULL DEFAULT 'Cash',
 *   remark         TEXT NOT NULL DEFAULT '',
 *   customer_ids   JSONB NOT NULL DEFAULT '[]'::jsonb,
 *   sort_order     INTEGER NOT NULL DEFAULT 1,
 *   created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 *   updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
 * );
 *
 * CREATE INDEX IF NOT EXISTS subvendor_leaser_payments_vendor_idx
 *   ON subvendor_leaser_payments (vendor_id, sort_order);
 *
 * customer_ids is a JSON array of quotation id strings, e.g. ["uuid-1","uuid-2"].
 *
 * -----------------------------------------------------------------------------
 * Sequelize (copy-paste)
 * -----------------------------------------------------------------------------
 *
 * // on Subvendor.init add:
 * fileCostPerKw: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 1000, field: 'file_cost_per_kw' },
 * leaserPaid: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0, field: 'leaser_paid' },
 * leaserRemaining: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0, field: 'leaser_remaining' },
 *
 * SubvendorLeaserPayment.init({
 *   id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
 *   vendorId: { type: DataTypes.UUID, allowNull: false, field: 'vendor_id' },
 *   date: { type: DataTypes.DATEONLY, allowNull: false, field: 'payment_date' },
 *   amount: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
 *   paymentType: { type: DataTypes.STRING(32), allowNull: false, defaultValue: 'Cash', field: 'payment_type' },
 *   remark: { type: DataTypes.TEXT, allowNull: false, defaultValue: '' },
 *   customerIds: { type: DataTypes.JSONB, allowNull: false, defaultValue: [], field: 'customer_ids' },
 *   sortOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1, field: 'sort_order' },
 * }, { tableName: 'subvendor_leaser_payments', underscored: true, timestamps: true })
 *
 * Subvendor.hasMany(SubvendorLeaserPayment, { foreignKey: 'vendorId', as: 'leaserPayments' })
 * SubvendorLeaserPayment.belongsTo(Subvendor, { foreignKey: 'vendorId' })
 *
 * -----------------------------------------------------------------------------
 * Endpoints
 * -----------------------------------------------------------------------------
 *
 * GET  /admin/subvendors/leaser
 * GET  /admin/subvendors/:id/leaser
 * PUT  /admin/subvendors/:id/leaser     ← replace ALL payments for that vendor
 *
 * Query on GET /admin/subvendors/leaser:
 *   vendorId  (optional)
 *
 * PUT is a full replace for that vendor (matches Manage → Save payments).
 *   - Delete existing rows for vendor_id
 *   - Insert the sent payments (keep client `id` when it is a valid UUID; else generate)
 *   - Set subvendors.leaser_paid = SUM(amount)
 *   - Set subvendors.leaser_remaining from body.leaserRemaining if sent, else leave column
 *   - Do NOT compute current balance from file charges / kW / customer count
 *
 * GET /admin/subvendors (and GET by id) must echo:
 *   fileCostPerKw / file_cost_per_kw
 *   leaserPaid / leaser_paid           ← this IS current balance
 *   leaserRemaining / leaser_remaining
 *
 * PATCH /admin/subvendors/:id already receives those keys from the SPA. Persist them.
 * If a key is omitted on PATCH, do not reset it to 0.
 *
 * -----------------------------------------------------------------------------
 * Request / response
 * -----------------------------------------------------------------------------
 *
 * PUT /admin/subvendors/:id/leaser body:
 * {
 *   "payments": [
 *     {
 *       "id": "optional-uuid",
 *       "date": "2026-10-07",
 *       "amount": 20000,
 *       "paymentType": "Cash",
 *       "remark": "casg",
 *       "customerIds": ["quotation-id-1", "quotation-id-2"],
 *       "sortOrder": 1
 *     }
 *   ],
 *   "leaserPaid": 20000,
 *   "leaserRemaining": 0
 * }
 *
 * Accept snake_case: payment_type, customer_ids, sort_order, leaser_paid, leaser_remaining,
 * payment_date as alias of date.
 *
 * paymentType allowed: Cash, Bank, UPI, Cheque, Other. Unknown → "Cash".
 * amount: INR integer ≥ 0. date: YYYY-MM-DD (empty → today UTC).
 * customerIds: array of strings (quotation ids). Invalid / missing → [].
 * sortOrder: integer ≥ 1. If omitted, use 1..n in body order.
 *
 * Empty payments [] is valid (clears that vendor's leaser; current balance → 0).
 *
 * GET /admin/subvendors/leaser 200:
 * {
 *   "success": true,
 *   "data": {
 *     "payments": [
 *       {
 *         "id": "...",
 *         "vendorId": "...",
 *         "vendor_id": "...",
 *         "date": "2026-10-07",
 *         "amount": 20000,
 *         "paymentType": "Cash",
 *         "payment_type": "Cash",
 *         "remark": "casg",
 *         "customerIds": ["quotation-id-1"],
 *         "customer_ids": ["quotation-id-1"],
 *         "sortOrder": 1,
 *         "sort_order": 1,
 *         "createdAt": "...",
 *         "updatedAt": "..."
 *       }
 *     ]
 *   }
 * }
 *
 * GET /admin/subvendors/:id/leaser 200:
 * {
 *   "success": true,
 *   "data": {
 *     "vendorId": "...",
 *     "currentBalance": 20000,
 *     "current_balance": 20000,
 *     "leaserPaid": 20000,
 *     "leaser_paid": 20000,
 *     "payments": [ ...same as above, that vendor only... ]
 *   }
 * }
 *
 * currentBalance MUST equal SUM(payments.amount) and MUST be 0 when there are no rows.
 * Echo camelCase + snake_case. SPA reads camelCase first.
 *
 * Order on GET: sort_order ASC (Payment 1 first). Frontend reverses for newest-on-top.
 *
 * Errors:
 *   AUTH_004        — not admin
 *   SUBVENDOR_404   — vendor id not found / not office_inside
 *   VAL_PAYMENTS    — payments missing or not an array
 *   VAL_AMOUNT      — amount negative / not a number
 *
 * -----------------------------------------------------------------------------
 * Controller sketch
 * -----------------------------------------------------------------------------
 */

const LEASER_TYPES = ["Cash", "Bank", "UPI", "Cheque", "Other"]

function roundInr(value) {
  const n = Math.round(Number(value) || 0)
  return Number.isFinite(n) && n >= 0 ? n : 0
}

function asText(value) {
  return value == null ? "" : String(value).trim()
}

function asCustomerIds(raw) {
  if (!Array.isArray(raw)) return []
  return raw.map((value) => asText(value)).filter(Boolean)
}

function publicLeaserPayment(row) {
  const customerIds = asCustomerIds(row.customerIds ?? row.customer_ids)
  const paymentType = LEASER_TYPES.includes(row.paymentType || row.payment_type)
    ? row.paymentType || row.payment_type
    : "Cash"
  return {
    id: row.id,
    vendorId: row.vendorId || row.vendor_id,
    vendor_id: row.vendorId || row.vendor_id,
    date: asText(row.date || row.payment_date),
    amount: roundInr(row.amount),
    paymentType,
    payment_type: paymentType,
    remark: asText(row.remark ?? row.remarks),
    customerIds,
    customer_ids: customerIds,
    sortOrder: Math.max(1, roundInr(row.sortOrder ?? row.sort_order) || 1),
    sort_order: Math.max(1, roundInr(row.sortOrder ?? row.sort_order) || 1),
    createdAt: row.createdAt || row.created_at,
    updatedAt: row.updatedAt || row.updated_at,
  }
}

/**
 * GET  /admin/subvendors/leaser
 * GET  /admin/subvendors/:id/leaser
 * PUT  /admin/subvendors/:id/leaser
 *
 * After PUT: vendor.leaserPaid = sum(payments.amount). That value is current balance (starts 0).
 * Never set current balance / leaser_paid from file_cost_per_kw × kW.
 */
export const SUBVENDOR_LEASER_ERROR_CODES = {
  AUTH_004: "AUTH_004",
  SUBVENDOR_404: "SUBVENDOR_404",
  VAL_PAYMENTS: "VAL_PAYMENTS",
  VAL_AMOUNT: "VAL_AMOUNT",
}

export { publicLeaserPayment, roundInr, asCustomerIds, LEASER_TYPES }
