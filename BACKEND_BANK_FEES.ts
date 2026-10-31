// @ts-nocheck
/**
 * =============================================================================
 * BACKEND — Account Management Bank fees (loan / cash+loan)  (Oct 27 2026)
 * =============================================================================
 *
 * APPLY THIS. Persist `quotations.bank_fees` on PATCH payment-details and echo it
 * on every GET. Do NOT store this in localStorage — database is the source of truth.
 *
 * Frontend (shipped):
 *   Account Management → Manage (loan / cash+loan only)
 *     Bank fees input → PATCH payment-details { bankFees, bank_fees, remaining, paymentStatus }
 *     Submit installments also sends bankFees
 *   lib/api.ts → api.quotations.updateBankFees / updatePaymentDetails
 *   Cash files: ignore / store 0
 *
 * Auth: role `account-management` or `admin`; quotation must be `status = approved`.
 *
 * -----------------------------------------------------------------------------
 * Math (must match Account Management)
 * -----------------------------------------------------------------------------
 *
 *   paidAmount     = SUM(installment.paidAmount)     // NEVER add bank_fees
 *   bankFees       = quotations.bank_fees            // loan / mix only; cash = 0
 *   discountAmount = existing discount (settlement `d` if any)
 *   cap            = subtotal − discountAmount − bankFees
 *   remaining      = max(0, cap − paidAmount)
 *   paymentStatus  = remaining ≤ 0 && (paid > 0 || bankFees > 0 || discount > 0)
 *                      ? "completed"
 *                      : paid > 0 ? "partial" : "pending"
 *
 * Example (screenshot remaining ₹2,215):
 *   subtotal 1,89,000  paid 1,86,785  bankFees 2,215
 *   remaining = 0   paymentStatus = completed
 *   Paid column stays ₹1,86,785 (fees are not paid)
 *
 * Do not treat bank fees as final settlement / discount `d`.
 * Do not 400 when paid + bankFees == subtotal (paid still ≤ subtotal).
 *
 * -----------------------------------------------------------------------------
 * SQL
 * -----------------------------------------------------------------------------
 *
 * Postgres:
 *   ALTER TABLE quotations ADD COLUMN IF NOT EXISTS bank_fees NUMERIC(14,2);
 *
 * MySQL:
 *   ALTER TABLE quotations ADD COLUMN bank_fees DECIMAL(14,2) NULL;
 *
 * Sequelize (Quotation):
 *   bankFees: { type: DataTypes.DECIMAL(14, 2), allowNull: true, field: 'bank_fees' },
 *
 * Office Outside rows: same column (or office_outside.bank_fees) echoed on
 * GET /admin/office-outside and accepted on PATCH /admin/office-outside/:id/payment-details.
 *
 * -----------------------------------------------------------------------------
 * Routes (existing — no new path required)
 * -----------------------------------------------------------------------------
 *
 *   PATCH /quotations/:id/payment-details
 *   PATCH /admin/quotations/:id/payment-details
 *   PATCH /admin/office-outside/:id/payment-details
 *
 * Optional aliases the SPA also tries:
 *   PATCH /quotations/:id/bank-fees
 *   PATCH /admin/quotations/:id/bank-fees
 *
 * Fees-only body (replaceInstallments: false — do not wipe installments):
 * {
 *   "bankFees": 2215,
 *   "bank_fees": 2215,
 *   "replaceInstallments": false,
 *   "remaining": 0,
 *   "remainingAmount": 0,
 *   "paymentStatus": "completed"
 * }
 *
 * Installment submit body also includes bankFees + remaining.
 *
 * -----------------------------------------------------------------------------
 * Persist + remaining
 * -----------------------------------------------------------------------------
 */

function parseInr(raw) {
  if (raw === undefined || raw === null || raw === "") return null
  const n = Math.round(Number(String(raw).replace(/[₹,\s]/g, "")))
  if (!Number.isFinite(n) || n < 0) return 0
  return n
}

function pickPaidSum(quotation) {
  const phases =
    quotation.paymentPhases ||
    quotation.payment_phases ||
    quotation.installments ||
    []
  if (!Array.isArray(phases)) return 0
  return phases.reduce((sum, row) => sum + Math.max(0, Math.round(Number(row.paidAmount) || 0)), 0)
}

function pickSubtotal(quotation) {
  return Math.max(
    0,
    Math.round(
      Number(
        quotation.subtotal ??
          quotation.totalAmount ??
          quotation.amountAfterSubsidy ??
          0,
      ) || 0,
    ),
  )
}

function paymentTypeAllowsBankFees(quotation) {
  const t = String(quotation.paymentType || quotation.payment_type || quotation.paymentMode || quotation.payment_mode || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_+-]+/g, "")
  return t === "loan" || t === "mix" || t === "cashloan" || t === "cashandloan"
}

/**
 * Merge into existing PATCH /quotations/:id/payment-details (and office-outside twin).
 * Call this whenever body.bankFees / bank_fees is present OR when recomputing remaining.
 */
export function applyBankFeesFromPaymentDetailsBody(quotation, body = {}) {
  const allows = paymentTypeAllowsBankFees(quotation)
  const parsed = parseInr(body.bankFees ?? body.bank_fees ?? body.bankFee ?? body.bank_fee)
  const stored = Math.max(0, Math.round(Number(quotation.bankFees ?? quotation.bank_fees ?? 0) || 0))
  const bankFees = allows ? (parsed != null ? parsed : stored) : 0
  const discountAmount = Math.max(
    0,
    Math.round(Number(quotation.discountAmount ?? quotation.discount_amount ?? 0) || 0),
  )
  const paid = pickPaidSum(quotation)
  const subtotal = pickSubtotal(quotation)
  const remaining = Math.max(0, subtotal - discountAmount - bankFees - paid)
  let paymentStatus = body.paymentStatus || body.payment_status
  if (!paymentStatus) {
    if (remaining <= 0 && (paid > 0 || bankFees > 0 || discountAmount > 0)) paymentStatus = "completed"
    else if (paid > 0) paymentStatus = "partial"
    else paymentStatus = "pending"
  }
  return {
    bankFees,
    bank_fees: bankFees,
    remainingAmount: remaining,
    remaining: remaining,
    paymentStatus,
    payment_status: paymentStatus,
    paidAmount: paid,
  }
}

/**
 * Echo on quotationToApiJson / GET list / GET detail / office-outside list.
 */
export function bankFeesToApiJson(q) {
  const n = Math.max(0, Math.round(Number(q.bankFees ?? q.bank_fees ?? 0) || 0))
  return { bankFees: n, bank_fees: n }
}

/**
 * Example drop-in for the status-only branch of PATCH payment-details
 * (when replaceInstallments === false / no phases in body):
 *
 *   const feesPatch = applyBankFeesFromPaymentDetailsBody(quotation, body)
 *   await quotation.update({
 *     ...existingUpdates,
 *     bankFees: feesPatch.bankFees,
 *     remainingAmount: feesPatch.remainingAmount,
 *     paymentStatus: feesPatch.paymentStatus,
 *   })
 *
 * GET approved list MUST include bankFees / bank_fees or Account Management
 * Remaining will jump back after refresh (SPA does not use localStorage).
 */
export default {
  applyBankFeesFromPaymentDetailsBody,
  bankFeesToApiJson,
}
