// @ts-nocheck
/**
 * =============================================================================
 * BACKEND — Dealer Payments remaining must match Accounts  (Nov 24 2026)
 * =============================================================================
 * Frontend bug (fixed in SPA): /dashboard/payments showed Remaining ₹0 / Completed
 * while Accounts still showed a balance (e.g. Amount ₹1,86,000, Paid ₹1,30,200 →
 * Remaining should be ₹55,800).
 *
 * Cause: list GET often echoes remaining=0 or paymentStatus=completed (after-subsidy
 * / reconcile) while installment paidAmounts still leave a gap. FE must not treat
 * that as settled. Backend should echo consistent remaining for dealers too.
 *
 * HANDOFF §76 · REQUIRED §CD
 * Related: BACKEND_DEALER_PAYMENTS_ALL.ts · §74 / §CB
 * =============================================================================
 */

/**
 * GET /api/quotations?status=approved (dealer JWT)
 *
 * Remaining math (same as Account Management):
 *   paidAmount     = SUM(installment.paidAmount)   // never infer from remaining
 *   bankFees       = quotations.bank_fees (loan/mix only; else 0)
 *   discountAmount = quotations.discountAmount / discount
 *   cap            = max(0, subtotal − discountAmount − bankFees)
 *   remaining      = max(0, cap − paidAmount)
 *
 * Only force remaining = 0 when final settlement is applied:
 *   finalSettlementApplied === true  OR  finalSettlementAmount > 0
 *   (optional: discount alone covers unpaid gap — discount > 0 && remaining ≤ discount)
 *
 * Do NOT set remaining=0 solely because:
 *   - paymentStatus === "completed" while cap − paid > 0
 *   - amount-after-subsidy remaining is 0 while installment gap > 0
 *
 * Echo on every list row (includeMedia=false OK):
 *   subtotal, discountAmount, bankFees / bank_fees
 *   paidAmount, remaining / remainingAmount
 *   paymentStatus  — pending | partial | completed derived from installment math above
 *   installments / paymentPhases with paidAmount + paymentMode
 *   finalSettlementApplied / finalSettlementAmount
 *
 * Example (loan):
 *   subtotal 186000, paid 130200, bankFees 0, no settlement
 *   → remaining 55800, paymentStatus "partial"
 *
 * Checklist
 * [ ] Dealer list remaining = cap − SUM(phase.paidAmount)
 * [ ] paymentStatus matches that remaining (not stale completed)
 * [ ] Settlement flags only clear remaining when actually settled
 * [ ] Phases always present for Payments UI
 */

export {}
