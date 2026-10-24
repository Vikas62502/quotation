// @ts-nocheck
/**
 * =============================================================================
 * BACKEND — Dealer leaser payments (Account Management → Subvendor office)
 * =============================================================================
 *
 * Frontend (Oct 2026):
 *   - Account Management → Vendor Office → Dealer leaser → Manage
 *   - Account Management → Vendor Outside → Vendor leaser → Manage
 *     (office_outside vendors; customers are Office Outside records, ids OO-*)
 *   - `lib/api.ts` → `api.admin.subvendors.leaser`
 *   - `lib/admin-subvendors.ts` (`SubvendorLeaserPayment`)
 *   - `components/admin-subvendor-panel.tsx`
 *
 * Auth: same admin JWT as `/admin/subvendors` (role admin / super-admin, or access includes "admin").
 * Account-management JWT may PUT leaser for both office_inside and office_outside vendors.
 * 403 for dealer / visitor unless they have admin or accounts access.
 *
 * CHANGELOG Oct 24 2026 — Bill ₹0 zeros GST / profit / remaining  ← APPLY THIS
 *   Vendor Outside leaser (office_outside vendors only):
 *     If SUM(bills.basicAmount) is 0 (or no bill rows):
 *       GST = 0, Profit vendor = 0, Total remaining = 0
 *     even when Accounts Paid amount / subtotal / charges are > 0.
 *   APPLY on PUT /admin/subvendors/:id/leaser:
 *     1. Persist body.leaserRemaining / leaser_remaining AS SENT.
 *        The SPA now sends 0 when bill is 0. Do not overwrite with
 *        (paid − bill − charges − GST) − leaser_paid if that would be > 0
 *        while billSum is 0.
 *     2. If leaserRemaining is omitted AND you recompute for office_outside:
 *          billSum = SUM(subvendor_vendor_bills.basic_amount) for that vendor
 *          if billSum <= 0 → leaser_remaining = 0
 *          else remaining = max(0, profit − leaser_paid)
 *        Use officeOutsideLeaserGst / officeOutsideLeaserProfit /
 *        officeOutsideLeaserRemaining below. Do not use loan, file charges,
 *        or profit_ratio.
 *     3. No new HTTP route. GST / profit stay FE unless you already echo them.
 *        Payments-first then Bills is UI-only — do not change GET payment order.
 *   office_inside leaser is unchanged (profit_ratio of complete profit).
 *
 * CHANGELOG Oct 24 2026 — Paid amount on Vendor Office + Vendor Outside  ← APPLY THIS
 *   No new leaser field. Paid amount is FE-derived from Accounts installments:
 *     office_inside  → SUM(quotation installment paidAmount) for that dealer
 *     office_outside → SUM(office_outside_records installments.paidAmount)
 *   GET quotations (approved) must echo paidAmount on each phase.
 *   GET /admin/office-outside must echo installments + paidAmount (see BACKEND_OFFICE_OUTSIDE.ts).
 *   PUT /admin/subvendors/:id/leaser still only stores leaser payment rows.
 *   body.leaserRemaining is FE:
 *     office_inside  = profit vendor − leaser_paid
 *     office_outside = 0 when bill is 0, else (paid − bill − charges − GST) − leaser_paid
 *   Persist leaserRemaining as sent. Do not recompute from loan amount.
 *
 * CHANGELOG Oct 23 2026 — Vendor leaser bills are a separate route
 *   Do NOT put bill rows on PUT /admin/subvendors/:id/leaser.
 *   Bills (date, basic, payment mode, customer, upload) live on:
 *     GET/PUT /admin/subvendors/bills  and  /admin/subvendors/:id/bills
 *   Copy-paste: BACKEND_SUBVENDOR_BILLS.ts
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
 * Per office_inside vendor (row + Manage header — all FE-derived except payment):
 *   Total file        = count of that dealer's current approved customers
 *   kW                = sum of those customers' system kW
 *   Subtotal          = sum of file subtotals
 *   Paid amount       = SUM of Accounts Paid (installment paidAmounts) for that dealer
 *   Cost of site vendor = sum of office-inside ledger cost of site (PI + file charges + GST + others)
 *                       If PI is 0 for a file, that file's cost of site vendor is 0.
 *   Profit vendor     = sum of (file subtotal − cost of site vendor) × (profitRatio / 100)
 *                       Example: 50% → 50% of that complete profit. 0% → ₹0. 100% → complete profit.
 *                       If PI is 0 for a file, that file's profit vendor is 0.
 *   Total payment     = SUM(leaser payment amounts) = leaser_paid — INITIAL 0
 *                       (UI label; same as former Current balance)
 *   Total remaining   = Profit vendor − Total payment
 *
 * Per office_outside vendor (Vendor Outside — same leaser table / routes):
 *   Customers in the dropdown = sent Office Outside records for that vendor (ids OO-*)
 *   Paid amount = SUM of Accounts Paid (installment paidAmounts) for that vendor's files
 *   GST (FE) = (subtotal − bill) × 9.8%  — 0 when bill is 0
 *   Profit vendor (FE) = paid amount − bill − charges − GST  — 0 when bill is 0
 *   Total remaining stored on PUT = that profit − leaser_paid  — 0 when bill is 0
 *   Example: paid ₹1,70,000, bill ₹0, charges ₹4,000 → GST ₹0, profit ₹0, remaining ₹0
 *            (not GST ₹24,500 / profit ₹1,41,500).
 *   Do NOT compute remaining from loan amount, file charges, or profit_ratio for this kind.
 *
 * Download Mini / Full statement is **client CSV**. No download endpoint.
 *
 * -----------------------------------------------------------------------------
 * Two different “cost of site” fields — do not merge (**§BN**)
 * -----------------------------------------------------------------------------
 *
 * Office Inside persist (same Submit):
 *
 *   quotations.site_cost / payment-details `siteCost`
 *     = table Cost of site = PI + others
 *     Profit (Office Inside table / Excel / Total Profit card)
 *       = subtotal − site_cost
 *
 *   subvendor_ledger.cost_of_site / PATCH ledger `costOfSite`
 *     = Cost of site vendor = PI + fileCharges + GST + others; 0 when PI is 0
 *     Complete profit = file subtotal − cost_of_site vendor; 0 when PI is 0
 *     Profit vendor   = complete profit × (profit_ratio / 100)
 *
 * Do **not**:
 *   - copy `quotations.site_cost` onto ledger `cost_of_site` (or the reverse)
 *   - overwrite ledger `costOfSite` from `siteCost` on installment save
 *   - store dealer-leaser remaining from proposal × profit_ratio
 *   - add a stats/download endpoint — remaining is FE: Profit vendor − SUM(leaser)
 *
 * If `subvendors.leaser_remaining` is written on leaser PUT, persist body as sent.
 * office_inside: Profit vendor − leaser_paid, **or** leave 0 and let the SPA compute.
 * office_outside: 0 when bill is 0, else Profit vendor − leaser_paid.
 * office_inside Profit vendor uses profit_ratio as a percent of complete profit
 * (subtotal − cost), not proposal × %. office_outside still ignores profit_ratio.
 *
 * Ledger GET must still echo pi, others, fileCharges, gstCharges, proposal, costOfSite
 * so the SPA can rebuild both pairs after refresh.
 *
 * Each payment row:
 *   date (YYYY-MM-DD calendar day as sent — Collect self uses Accounts Due Date, **§BP**),
 *   amount (INR int), paymentType (Cash|Bank|UPI|Cheque|Other),
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
 *   id             TEXT PRIMARY KEY,
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
 * customer_ids is a JSON array of id strings:
 *   office_inside  → quotation ids
 *   office_outside → office_outside_records.id (OO-…)
 * Do not reject OO-* ids. Do not require a quotations row.
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
 *   id: { type: DataTypes.STRING(80), primaryKey: true },
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
 *   - Insert the sent payments. Persist client `id` as-is when non-empty
 *     (UUID **or** `lp-self-{quotationId}-{phaseNumber}` from Collect self).
 *     Only generate a UUID when id is missing/blank.
 *   - Set subvendors.leaser_paid = SUM(amount)
 *   - Set subvendors.leaser_remaining from body.leaserRemaining if sent
 *     (SPA sends 0 for office_outside when bill is 0). Else if office_outside
 *     and billSum <= 0, set leaser_remaining = 0. Else leave the column.
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
 *       "customerIds": ["quotation-id-1", "OO-A1B2C3D4"],
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
 * amount: INR integer ≥ 0.
 * date: YYYY-MM-DD DATEONLY as sent (`date` or `payment_date`). Empty → today.
 *   Do **not** rewrite a sent date to NOW() / created_at / paymentDate.
 *   Collect-self (`lp-self-*`) sends the installment Due Date (same as Accounts).
 *   GET must echo `date` + `payment_date` as `"YYYY-MM-DD"` (not ISO datetime).
 * customerIds: array of strings (quotation ids or OO-* office-outside record ids). Invalid / missing → [].
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
 *   AUTH_004        — not admin / not accounts
 *   SUBVENDOR_404   — vendor id not found (office_inside OR office_outside is valid)
 *   VAL_PAYMENTS    — payments missing or not an array
 *   VAL_AMOUNT      — amount negative / not a number
 *
 * -----------------------------------------------------------------------------
 * Controller sketch
 * -----------------------------------------------------------------------------
 */

const LEASER_TYPES = ["Cash", "Bank", "UPI", "Cheque", "Other"]

/** Vendor Outside leaser GST = (subtotal − bill) × 9.8%. 0 when bill is 0. */
const OFFICE_OUTSIDE_LEASER_GST_RATE = 0.098

function officeOutsideLeaserGst(subtotal, billAmount) {
  const sub = Math.max(0, Math.round(Number(subtotal) || 0))
  const bill = Math.max(0, Math.round(Number(billAmount) || 0))
  if (bill <= 0) return 0
  return Math.round(Math.max(0, sub - bill) * OFFICE_OUTSIDE_LEASER_GST_RATE)
}

function officeOutsideLeaserProfit(opts) {
  const bill = Math.max(0, Math.round(Number(opts?.billAmount) || 0))
  if (bill <= 0) return 0
  const paid = Math.max(0, Math.round(Number(opts?.paidAmount) || 0))
  return Math.round(
    paid -
      bill -
      Math.max(0, Math.round(Number(opts?.charges) || 0)) -
      Math.max(0, Math.round(Number(opts?.gst) || 0)),
  )
}

function officeOutsideLeaserRemaining(opts) {
  const bill = Math.max(0, Math.round(Number(opts?.billAmount) || 0))
  if (bill <= 0) return 0
  return Math.max(
    0,
    Math.round(Number(opts?.profitVendor) || 0) - Math.max(0, Math.round(Number(opts?.leaserPaid) || 0)),
  )
}

/**
 * PUT /admin/subvendors/:id/leaser — persist remaining as the SPA sent it.
 * office_outside + no bill → remaining 0 even if paid amount is large.
 *
 *   const paid = next.reduce((sum, row) => sum + row.amount, 0)
 *   const sentRemaining = req.body?.leaserRemaining ?? req.body?.leaser_remaining
 *   let remaining
 *   if (sentRemaining != null && sentRemaining !== "") {
 *     remaining = roundInr(sentRemaining)
 *   } else if (vendor.kind === "office_outside") {
 *     const billSum = roundInr(
 *       await SubvendorVendorBill.sum("basicAmount", { where: { vendorId: vendor.id } }),
 *     )
 *     remaining = billSum <= 0
 *       ? 0
 *       : officeOutsideLeaserRemaining({
 *           profitVendor: officeOutsideLeaserProfit({
 *             paidAmount: paidFromAccounts,
 *             billAmount: billSum,
 *             charges: fileChargesPlusOthers,
 *             gst: officeOutsideLeaserGst(subtotal, billSum),
 *           }),
 *           leaserPaid: paid,
 *           billAmount: billSum,
 *         })
 *   } else {
 *     remaining = vendor.leaserRemaining
 *   }
 *   await vendor.update({ leaserPaid: paid, leaserRemaining: remaining })
 */

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

function leaserDateYmd(raw) {
  const text = asText(raw)
  const match = text.match(/^(\d{4}-\d{2}-\d{2})/)
  if (match) return match[1]
  const parsed = new Date(text)
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10)
  return new Date().toISOString().slice(0, 10)
}

function publicLeaserPayment(row) {
  const customerIds = asCustomerIds(row.customerIds ?? row.customer_ids)
  const paymentType = LEASER_TYPES.includes(row.paymentType || row.payment_type)
    ? row.paymentType || row.payment_type
    : "Cash"
  const date = leaserDateYmd(row.date || row.payment_date)
  return {
    id: row.id,
    vendorId: row.vendorId || row.vendor_id,
    vendor_id: row.vendorId || row.vendor_id,
    date,
    payment_date: date,
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

export {
  publicLeaserPayment,
  roundInr,
  asCustomerIds,
  LEASER_TYPES,
  OFFICE_OUTSIDE_LEASER_GST_RATE,
  officeOutsideLeaserGst,
  officeOutsideLeaserProfit,
  officeOutsideLeaserRemaining,
}
