// @ts-nocheck
/* global Quotation, SubvendorLedger */
/**
 * =============================================================================
 * BACKEND — Approve Proposal amount → Accounts Proposal  (Oct 26 2026)
 * =============================================================================
 *
 * APPLY THIS. Copy-paste into the live PATCH status handler + Quotation serializer.
 * Full status handler also lives in BACKEND_ADMIN_QUOTATION_STATUS.ts (`patchAdminQuotationStatus`).
 *
 * Frontend (shipped):
 *   Admin All quotations → Approve
 *     Loan / Cash + loan → required "Proposal amount" field
 *     Cash               → no field; Accounts Proposal = quotation subtotal
 *   lib/api.ts → api.admin.quotations.updateStatus
 *   Account Management ledger field: Proposal (`subvendor_ledger.proposal`)
 *
 * Auth: admin JWT (same as existing PATCH /admin/quotations/:id/status).
 *
 * -----------------------------------------------------------------------------
 * What to persist
 * -----------------------------------------------------------------------------
 *
 * | paymentType | Body.proposal                         | quotations.proposal        | subvendor_ledger.proposal |
 * |-------------|---------------------------------------|----------------------------|---------------------------|
 * | loan        | required, INR integer > 0             | that amount                | same                      |
 * | mix         | required, INR integer > 0             | that amount                | same                      |
 * | cash        | optional (SPA may send subtotal)      | quotation subtotal         | same                      |
 *
 * Reject (`status=rejected`): quotations.proposal = null. Do not wipe ledger PI / GST / others.
 *
 * Do not invent GST here. Accounts GST stays (proposal − PI) × 8.9% on the SPA.
 *
 * -----------------------------------------------------------------------------
 * SQL
 * -----------------------------------------------------------------------------
 *
 * Postgres:
 *   ALTER TABLE quotations ADD COLUMN IF NOT EXISTS proposal NUMERIC(14,2);
 *
 * MySQL:
 *   ALTER TABLE quotations ADD COLUMN proposal DECIMAL(14,2) NULL;
 *
 * subvendor_ledger.proposal already exists (BACKEND_SUBVENDORS.ts). No ledger ALTER.
 *
 * Sequelize (Quotation):
 *   proposal: { type: DataTypes.DECIMAL(14, 2), allowNull: true },
 *
 * -----------------------------------------------------------------------------
 * Route (existing — no new path)
 * -----------------------------------------------------------------------------
 *
 *   PATCH /admin/quotations/:quotationId/status
 *
 * Loan example:
 * {
 *   "status": "approved",
 *   "paymentType": "loan",
 *   "paymentMode": "loan",
 *   "proposal": 210000,
 *   "proposalAmount": 210000,
 *   "loanAmount": 210000,
 *   "bankName": "State Bank of India",
 *   "bankIfsc": "SBIN0001234"
 * }
 *
 * Cash + loan example:
 * {
 *   "status": "approved",
 *   "paymentType": "mix",
 *   "proposal": 225000,
 *   "loanAmount": 150000,
 *   "cashAmount": 75000,
 *   "bankName": "...",
 *   "bankIfsc": "SBIN0001234"
 * }
 *
 * Cash example (proposal may be omitted — still store subtotal):
 * {
 *   "status": "approved",
 *   "paymentType": "cash",
 *   "paymentMode": "cash"
 * }
 *
 * Accept aliases: proposalAmount, proposal_amount.
 *
 * -----------------------------------------------------------------------------
 * Errors
 * -----------------------------------------------------------------------------
 *
 *   VAL_PROPOSAL  400  loan / mix and proposal missing or ≤ 0
 *
 * Loan / mix bank + loan/cash amount errors stay as they are (VAL_003 / VAL_004 / VAL_005 / amount codes).
 *
 * -----------------------------------------------------------------------------
 * GET echo (required)
 * -----------------------------------------------------------------------------
 *
 * PATCH response, GET /quotations?status=approved, GET /quotations/:id, GET /admin/quotations:
 *
 *   proposal: 210000
 *
 * Also echo snake_case `proposal_amount` if the rest of the payload is mixed-case.
 * Account Management seeds Proposal from quotation.proposal when ledger is empty.
 *
 * GET /admin/subvendors/ledger already returns `proposal` — keep that.
 * After approve, the ledger row MUST exist with proposal set so Accounts is not ₹0.
 *
 * -----------------------------------------------------------------------------
 * Ledger upsert rules
 * -----------------------------------------------------------------------------
 *
 * After quotation.update on approve:
 *   findOrCreate subvendor_ledger WHERE quotation_id = :id
 *   UPDATE only: proposal, and loanAmount / cashAmount when those were set
 *   Do NOT set pi, gstCharges, others, fileCharges, costOfSite, receivedAmount to 0
 *
 * If ledger upsert fails, still return 200 for the status change (log the error).
 * SPA also PATCHes /admin/subvendors/ledger/:id with { proposal } as a fallback.
 */

export function parseApproveProposalAmount(raw) {
  if (raw === undefined || raw === null || raw === "") return null
  const n = typeof raw === "number" ? raw : Number(String(raw).replace(/[₹,\s]/g, ""))
  if (!Number.isFinite(n) || n < 0) return null
  return Math.round(n)
}

/** Same subtotal Account Management shows (gross − discount). */
export function pickQuotationSubtotalForProposal(row) {
  const q = row.get ? row.get({ plain: true }) : row
  const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0)
  const amSubtotal = Math.max(
    0,
    Math.round(
      n(q.subtotal) ||
        n(q.pricing?.subtotal) ||
        n(q.pricing?.totalAmount) ||
        n(q.totalAmount) ||
        n(q.finalAmount),
    ),
  )
  const discountAmount = n(q.discountAmount ?? q.discount_amount ?? q.pricing?.discountAmount)
  return Math.max(0, amSubtotal - Math.max(0, Math.round(discountAmount)))
}

/**
 * Returns { ok, proposal } or { ok: false, code, message }.
 * paymentType is already normalized to loan | cash | mix.
 */
export function resolveApproveProposal({ paymentType, proposalRaw, quotationSubtotal }) {
  const subtotal = Math.max(0, Math.round(Number(quotationSubtotal) || 0))
  if (paymentType === "cash") {
    return { ok: true, proposal: subtotal }
  }
  const parsed = parseApproveProposalAmount(proposalRaw)
  if (parsed == null || parsed <= 0) {
    return {
      ok: false,
      code: "VAL_PROPOSAL",
      message: "proposal required for loan / cash + loan approval",
    }
  }
  return { ok: true, proposal: parsed }
}

export function proposalFieldsForApi(q) {
  const n = q?.proposal ?? q?.proposalAmount ?? q?.proposal_amount ?? null
  const amount = n == null || n === "" ? null : Math.round(Number(n))
  const value = Number.isFinite(amount) ? amount : null
  return { proposal: value, proposalAmount: value, proposal_amount: value }
}

/**
 * Call after quotation.update + reload on approve.
 * Never throw to the status handler — wrap in try/catch at the call site.
 */
export async function upsertLedgerProposalOnApprove({
  Ledger,
  quotationId,
  proposal,
  loanAmount,
  cashAmount,
}) {
  if (!Ledger?.findOrCreate) return
  if (proposal == null) return
  const [ledgerRow] = await Ledger.findOrCreate({
    where: { quotationId },
    defaults: {
      quotationId,
      quotation_id: quotationId,
      proposal,
    },
  })
  const patch = { proposal }
  if (loanAmount != null) patch.loanAmount = loanAmount
  if (cashAmount != null) patch.cashAmount = cashAmount
  await ledgerRow.update(patch)
}

/**
 * Snippet for PATCH /admin/quotations/:quotationId/status
 * Merge into your existing approve branch (after loan/cash amount resolve).
 */
export async function applyProposalOnApprove({
  body,
  paymentType,
  quotation,
  updates,
  quotationId,
  db,
  req,
}) {
  const quotationSubtotal = pickQuotationSubtotalForProposal(quotation)
  const result = resolveApproveProposal({
    paymentType,
    proposalRaw: body.proposal ?? body.proposalAmount ?? body.proposal_amount,
    quotationSubtotal,
  })
  if (!result.ok) return result
  updates.proposal = result.proposal
  return { ok: true, proposal: result.proposal, quotationSubtotal }
}

export async function persistLedgerAfterApprove({
  statusRaw,
  updates,
  quotationId,
  db,
  req,
}) {
  if (statusRaw !== "approved" || updates.proposal == null) return
  const Ledger =
    (typeof SubvendorLedger !== "undefined" ? SubvendorLedger : null) ||
    db?.SubvendorLedger ||
    req.db?.SubvendorLedger
  try {
    await upsertLedgerProposalOnApprove({
      Ledger,
      quotationId,
      proposal: updates.proposal,
      loanAmount: updates.loanAmount,
      cashAmount: updates.cashAmount,
    })
  } catch (ledgerErr) {
    console.error("approve proposal ledger upsert failed", ledgerErr)
  }
}

/**
 * On reject, clear quotation.proposal. Do not delete the ledger row.
 */
export function clearProposalOnReject(updates) {
  updates.proposal = null
}

/**
 * Merge into quotationToApiJson / GET list item:
 *   ...proposalFieldsForApi(q)
 */
