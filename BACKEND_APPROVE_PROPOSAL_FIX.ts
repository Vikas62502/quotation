// @ts-nocheck
/**
 * =============================================================================
 * BACKEND — FIX: Approve 400 “proposal required for loan/mix approval (INR > 0)”
 *              even when Proposal amount is filled  (Oct 30 2026)
 * =============================================================================
 *
 * APPLY THIS on PATCH /admin/quotations/:id/status.
 * Live screenshot: dialog has Proposal amount ₹1,60,000 + Loan ₹1,60,000,
 * then alert: "proposal required for loan/mix approval (INR > 0)".
 *
 * SPA now always sends integers on all aliases:
 *   {
 *     "status": "approved",
 *     "paymentType": "loan",
 *     "paymentMode": "loan",
 *     "proposal": 160000,
 *     "proposalAmount": 160000,
 *     "proposal_amount": 160000,
 *     "loanAmount": 160000,
 *     "loan_amount": 160000,
 *     "bankName": "State Bank of India",
 *     "bankIfsc": "SBIN0032365"
 *   }
 *
 * Do NOT 400 if any of those proposal keys parse to INR > 0.
 *
 * Typical live bugs:
 *   1. Joi / pick() allowlist strips `proposal` then the handler checks a missing field.
 *   2. Handler only reads `body.proposal_amount` (or only `typeof body.proposal === "number"`).
 *   3. camelCase ↔ snake_case middleware drops one of the keys.
 *   4. Body nested under `data` and proposal is read only from the top level.
 *
 * Add `proposal`, `proposalAmount`, `proposal_amount` to any allowlist / Joi schema.
 * `unknown(true)` OR read proposal BEFORE stripping unknown keys.
 * Parse with Number(...) — accept number 160000 and string "160000".
 *
 * Cash: do not require body.proposal; store quotation subtotal.
 * After approve: persist quotations.proposal AND upsert subvendor_ledger.proposal
 * (do not wipe PI / GST / others). Echo proposal on GET.
 *
 * Full persist rules: BACKEND_APPROVE_PROPOSAL.ts · BACKEND_ADMIN_QUOTATION_STATUS.ts
 */

function pickBody(body) {
  const root = body && typeof body === "object" ? body : {}
  const nested = root.data && typeof root.data === "object" && !Array.isArray(root.data) ? root.data : {}
  return { ...nested, ...root }
}

export function parseApproveProposalAmount(raw) {
  if (raw === undefined || raw === null || raw === "") return null
  const n = typeof raw === "number" ? raw : Number(String(raw).replace(/[₹,\s]/g, ""))
  if (!Number.isFinite(n) || n <= 0) return null
  return Math.round(n)
}

export function pickApproveProposalRaw(body) {
  const src = pickBody(body)
  return (
    src.proposal ??
    src.proposalAmount ??
    src.proposal_amount ??
    src.Proposal ??
    src.proposalInr ??
    src.proposal_inr
  )
}

/**
 * Drop into the approve branch AFTER paymentType is loan | cash | mix.
 * Return { ok:false, code, message } to 400; otherwise set updates.proposal.
 */
export function resolveApproveProposalFromBody({ paymentType, body, quotationSubtotal }) {
  const subtotal = Math.max(0, Math.round(Number(quotationSubtotal) || 0))
  if (paymentType === "cash") {
    return { ok: true, proposal: subtotal }
  }
  const parsed = parseApproveProposalAmount(pickApproveProposalRaw(body))
  if (parsed == null) {
    return {
      ok: false,
      code: "VAL_PROPOSAL",
      message: "proposal required for loan/mix approval (INR > 0)",
    }
  }
  return { ok: true, proposal: parsed }
}

/**
 * Joi / celebrate example — include ALL aliases or they get stripped:
 *
 *   proposal: Joi.number().integer().min(1).optional(),
 *   proposalAmount: Joi.number().integer().min(1).optional(),
 *   proposal_amount: Joi.number().integer().min(1).optional(),
 *
 * And `.unknown(true)` on the status PATCH schema.
 * Do not `.required()` proposal at schema level for cash approvals.
 */

export default {
  parseApproveProposalAmount,
  pickApproveProposalRaw,
  resolveApproveProposalFromBody,
}
