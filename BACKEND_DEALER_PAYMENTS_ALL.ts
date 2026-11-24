// @ts-nocheck
/**
 * =============================================================================
 * BACKEND — Dealer / agent Payments: return ALL approved files  (Nov 24 2026)
 * =============================================================================
 * Frontend: /dashboard/payments (agent login, e.g. Harshita)
 *   Fetches every page of GET /quotations?status=approved&limit=1000
 *   Shows every approved quotation for that dealer — including settled/completed.
 *
 * Bug: agent Payments looked incomplete — not all of this agent’s files / payment
 * data coming through. FE now pages until exhausted; API must support that.
 *
 * HANDOFF §74 · REQUIRED §CB
 * =============================================================================
 */

/**
 * Route (dealer JWT):
 *   GET /api/quotations?status=approved&page=1&limit=1000&includeMedia=false&includeVisits=false
 *
 * Scope:
 *   Non-admin dealer → WHERE dealerId = req.dealer.id only (never other agents).
 *   Do NOT silently cap results below pagination.total.
 *
 * Pagination (required on every page):
 *   {
 *     success: true,
 *     data: {
 *       quotations: [ ... ],
 *       pagination: {
 *         page, limit, total, totalPages, hasNext, hasPrev
 *       }
 *     }
 *   }
 *   total = full approved count for this dealer (including settled / completed).
 *   hasNext = page < totalPages. FE walks pages until hasNext is false.
 *
 * Max limit: allow up to 1000 (already). Do not return a smaller hard-coded slice
 * that ignores page/limit.
 */

/**
 * Each quotation row MUST include (even when includeMedia=false):
 *
 * Identity
 *   id, dealerId / dealer_id, dealer: { id, name?, username? }
 *   status: "approved"
 *   statusApprovedAt / status_approved_at
 *   createdAt
 *
 * Customer
 *   customer: { firstName, lastName, mobile, email? }
 *
 * Amounts
 *   subtotal, discount / discountAmount
 *   bankFees / bank_fees
 *   paymentType | paymentMode  (loan | cash | mix)
 *   loanAmount / loan_amount, cashAmount / cash_amount
 *   proposal (if set)
 *   remaining / remainingAmount
 *   paymentStatus / payment_status  (pending | partial | completed)
 *
 * Installments (required for Paid / Remaining / L–C split on Payments UI)
 *   installments | paymentPhases | payment_phases: [{
 *     phaseNumber, phaseName?, amount, paidAmount, paymentMode, status?
 *   }]
 *   Do NOT strip phases when includeMedia=false — media only.
 *
 * Settlement (still return the row — FE lists settled as completed)
 *   finalSettlementApplied / final_settlement_applied
 *   finalSettlementAmount / final_settlement_amount
 *
 * Do NOT exclude settled / completed / remaining=0 quotations from status=approved.
 */

/**
 * Checklist
 * [ ] Dealer GET /quotations?status=approved scoped to req.dealer.id
 * [ ] pagination.total / totalPages / hasNext accurate for full agent set
 * [ ] Payment phases always on list rows (includeMedia=false OK)
 * [ ] Settled + completed approved files still in the list
 * [ ] dealerId echoed consistently (string match FE dealer.id)
 *
 * curl (agent token):
 *   curl -s "http://localhost:3050/api/quotations?status=approved&page=1&limit=1000&includeMedia=false" \
 *     -H "Authorization: Bearer $DEALER_TOKEN"
 */

export {}
