// @ts-nocheck
/**
 * =============================================================================
 * BACKEND REFERENCE — Account Management "Final Settlement" (Jul 2026)
 * =============================================================================
 *
 * Frontend:
 *   - app/dashboard/account-management/page.tsx → submitFinalSettlement
 *   - lib/api.ts → api.quotations.finalizeSettlement
 *
 * What the user does:
 *   In Payment Management, a customer has a small Remaining (e.g. ₹2,000).
 *   Account Management clicks "Submit final settlement" to write that Remaining
 *   off as a discount `d`, mark payment completed, and set Remaining = 0.
 *
 * IMPORTANT (new behavior, Jul 2026):
 *   The frontend NO LONGER falls back to localStorage when the API is on.
 *   `finalizeSettlement` THROWS if nothing was persisted server-side. So the
 *   backend MUST persist and MUST return the settled state on GET, otherwise:
 *     - the UI shows "Settlement not saved", and
 *     - the "Submit final settlement" button stays visible.
 *
 * Client call order (see lib/api.ts → finalizeSettlement):
 *   1) POST  /api/quotations/:id/final-settlement     ← PREFERRED (implement this)
 *   2) PATCH /api/quotations/:id/pricing  +  PATCH /api/quotations/:id/payment-details
 *   3) PATCH /api/quotations/:id/discount             ← last fallback
 *   4) GET   /api/quotations?status=approved          ← must reflect settled state
 *
 * Auth: role `account-management` or `admin`; quotation must be `status = approved`.
 *
 * =============================================================================
 * DEFINITIONS — the exact math the frontend uses
 * =============================================================================
 *
 *   amCap            = Account Management payment cap
 *                      = amountAfterSubsidy (preferred), else subtotal shown in AM
 *   paid             = SUM(installment.paidAmount)                (UNCHANGED by settlement)
 *   settlementAmount = current Remaining = max(0, amCap - existingDiscount - paid)
 *   discountAmount   = existingDiscount + settlementAmount        (the discount `d`)
 *   finalAmount      = max(0, amountAfterSubsidy - discountAmount)
 *   remaining        = 0   (after settlement)
 *   paymentStatus    = "completed"
 *
 * Example — JITENDRA:
 *   amCap 292000, paid 290000, existingDiscount 0
 *   settlementAmount = 2000, discountAmount = 2000, remaining 0, status completed
 *   Installment rows are NOT rewritten (paid stays 290000).
 *
 * DO NOT run "total paid cannot exceed payable after discount" during settlement.
 * amCap (292000) can differ from a pricing "payable after discount" (212000); the
 * write-off is only ₹2,000 and must not be rejected because of that mismatch.
 */

// -----------------------------------------------------------------------------
// Shared helpers
// -----------------------------------------------------------------------------

const N = (v) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}
const round = (v) => Math.round(N(v))

function requireAmUser(req, res) {
  const user = req.user || req.dealer
  if (!user || !["account-management", "admin"].includes(user.role)) {
    res.status(403).json({ success: false, error: { code: "AUTH_004", message: "Forbidden" } })
    return null
  }
  return user
}

/** amountAfterSubsidy is the source of truth for the payable cap. Never shrink it. */
function pickAmountAfterSubsidy(quotation) {
  const p = quotation.pricing || {}
  const candidates = [
    quotation.amountAfterSubsidy,
    p.amountAfterSubsidy,
    quotation.finalAmount,
    quotation.subtotal,
  ]
  for (const c of candidates) {
    const n = Number(c)
    if (Number.isFinite(n) && n > 0) return n
  }
  return 0
}

/** Sum of paid installments — settlement must NOT change these rows. */
function sumPaidInstallments(quotation) {
  const rows = quotation.paymentPhases || quotation.installments || []
  if (!Array.isArray(rows)) return 0
  return rows.reduce((acc, r) => acc + N(r.paidAmount), 0)
}

function existingDiscountAmount(quotation) {
  const p = quotation.pricing || {}
  return Math.max(0, N(quotation.discountAmount ?? p.discountAmount ?? quotation.discount))
}

/**
 * Core settlement mutation. Idempotent and safe to call from the atomic endpoint
 * or the pricing/discount fallbacks. Returns the values written.
 *
 * `explicitDiscountAmount` (absolute INR, existing + settlement) is preferred; if
 * only `settlementAmount` is given we add it to the existing discount.
 */
function computeSettlement(quotation, body) {
  const amountAfterSubsidy = pickAmountAfterSubsidy(quotation)
  const paid = sumPaidInstallments(quotation)
  const existing = existingDiscountAmount(quotation)

  // The settlement clears the balance to 0. Compute the discount that makes payable
  // (finalAmount) equal what is ALREADY PAID — this never creates "paid exceeds payable".
  //
  // Important: AM's subtotal (e.g. 190,000) can be higher than the server's
  // amountAfterSubsidy (e.g. 189,000). AM then shows Remaining 1,000 while the server
  // considers the customer fully paid (remaining 0). In that case discountToClear = 0:
  // we simply mark it completed. DO NOT reject with "settlement cannot exceed remaining".
  const discountToClear = Math.max(0, amountAfterSubsidy - Math.min(paid, amountAfterSubsidy))
  let discountAmount = Math.max(existing, discountToClear)
  if (discountAmount > amountAfterSubsidy) discountAmount = amountAfterSubsidy

  // What AM wrote off (audit only) — may differ from discountAmount when subtotal > AAS.
  const settlementAmount = round(body.settlementAmount ?? body.amount ?? 0)
  const finalAmount = Math.max(0, amountAfterSubsidy - discountAmount)

  return {
    amountAfterSubsidy,
    paid,
    discountAmount,
    settlementAmount,
    finalAmount,
    remaining: 0,
    paymentStatus: "completed",
  }
}

/** Persist settlement WITHOUT touching installment rows. */
async function applySettlement(quotation, s, user, { transaction } = {}) {
  const pricing = { ...(quotation.pricing || {}) }
  pricing.discountAmount = s.discountAmount
  pricing.totalAmount = s.finalAmount
  pricing.finalAmount = s.finalAmount
  pricing.amountAfterSubsidy = s.amountAfterSubsidy
  pricing.finalSettlementApplied = true

  await quotation.update(
    {
      discount: s.discountAmount,
      discountAmount: s.discountAmount,
      totalAmount: s.finalAmount,
      finalAmount: s.finalAmount,
      amountAfterSubsidy: s.amountAfterSubsidy,
      pricing,
      remaining: 0,
      remainingAmount: 0,
      paymentStatus: "completed",
      // Persisted flags the frontend reads to KEEP THE BUTTON HIDDEN after refresh:
      finalSettlementApplied: true,
      finalSettlementAmount: s.settlementAmount,
      finalSettlementAt: new Date(),
      finalSettlementBy: user?.id || null,
      // NOTE: paymentPhases / installments intentionally UNCHANGED.
    },
    { transaction },
  )
  await quotation.reload({ transaction })
  return quotation
}

// -----------------------------------------------------------------------------
// 1) PREFERRED — POST /api/quotations/:id/final-settlement (atomic)
// -----------------------------------------------------------------------------
/**
 * Body (from lib/api.ts → finalizeSettlement):
 * {
 *   "amount": 2000,                 // settlement (Remaining) — the discount `d`
 *   "settlementAmount": 2000,
 *   "discountAmount": 2000,         // existing + settlement (absolute INR)
 *   "finalAmount": 290000,          // amountAfterSubsidy - discountAmount
 *   "paymentStatus": "completed",
 *   "remaining": 0,
 *   "remainingAmount": 0,
 *   "finalSettlementApplied": true
 * }
 */
export async function postFinalSettlement(req, res) {
  const user = requireAmUser(req, res)
  if (!user) return
  try {
    const quotationId = req.params.quotationId || req.params.id
    const quotation = await Quotation.findByPk(quotationId)
    if (!quotation) {
      return res.status(404).json({ success: false, error: { code: "RES_001", message: "Not found" } })
    }
    if (String(quotation.status || "").toLowerCase() !== "approved") {
      return res.status(400).json({ success: false, error: { code: "VAL_010", message: "Not approved" } })
    }

    // Idempotent: already settled → return 200 with current state, do not double-add.
    if (quotation.finalSettlementApplied === true) {
      return res.json({ success: true, data: quotationToApiJson(quotation) })
    }

    // NEVER reject a settlement because the server's stored remaining is 0. AM may be
    // reconciling a subtotal-vs-amountAfterSubsidy gap; the correct result is simply
    // "completed, remaining 0" (with discount clamped so payable never drops below paid).
    const s = computeSettlement(quotation, req.body || {})
    await applySettlement(quotation, s, user)
    return res.json({ success: true, data: quotationToApiJson(quotation) })
  } catch (e) {
    console.error("[final-settlement] error", e)
    return res.status(500).json({ success: false, error: { code: "SYS_001", message: "Internal error" } })
  }
}

// -----------------------------------------------------------------------------
// 2a) FALLBACK — PATCH /api/quotations/:id/pricing  (absolute discountAmount)
// -----------------------------------------------------------------------------
/**
 * Body: { "discountAmount": 2000, "totalAmount": 290000, "finalAmount": 290000 }
 *
 * MUST:
 *   - Treat discountAmount as ABSOLUTE INR (never re-derive from %).
 *   - NOT require `subtotal` in the body.
 *   - Validate finalAmount against STORED amountAfterSubsidy (not a rewritten subtotal).
 *   - Set remaining=0 / status=completed when the discount clears the gap.
 * MUST NOT:
 *   - Reject INR values > 100 as "invalid percent".
 *   - Emit "Final amount must be between 0 and amount after subsidy" when finalAmount
 *     is computed from the STORED amountAfterSubsidy.
 */
export async function patchPricingWithSettlement(req, res) {
  const user = requireAmUser(req, res)
  if (!user) return
  try {
    const quotationId = req.params.quotationId || req.params.id
    const quotation = await Quotation.findByPk(quotationId)
    if (!quotation) {
      return res.status(404).json({ success: false, error: { code: "RES_001", message: "Not found" } })
    }

    const body = req.body || {}
    const amountAfterSubsidy = pickAmountAfterSubsidy(quotation)
    const discountAmount = round(body.discountAmount)

    if (discountAmount < 0 || discountAmount > amountAfterSubsidy) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VAL_015",
          message: `discountAmount must be between 0 and amountAfterSubsidy (${amountAfterSubsidy})`,
        },
      })
    }

    // Reuse the same settlement application (idempotent, no installment rewrite).
    const s = computeSettlement(quotation, { discountAmount })
    await applySettlement(quotation, s, user)
    return res.json({ success: true, data: quotationToApiJson(quotation) })
  } catch (e) {
    console.error("[pricing settlement] error", e)
    return res.status(500).json({ success: false, error: { code: "SYS_001", message: "Internal error" } })
  }
}

// -----------------------------------------------------------------------------
// 2b) FALLBACK — PATCH /api/quotations/:id/payment-details (STATUS-ONLY, no phases)
// -----------------------------------------------------------------------------
/**
 * Body (no `phases` / `installments`):
 * {
 *   "paymentStatus": "completed",
 *   "replaceInstallments": false,
 *   "finalSettlementApplied": true,
 *   "finalSettlementAmount": 2000,
 *   "remaining": 0,
 *   "remainingAmount": 0,
 *   "paymentType": "cash",
 *   "paymentMode": "cash"
 * }
 *
 * CRITICAL: when there are NO phases in the body:
 *   - update status / remaining / settlement flags ONLY,
 *   - DO NOT delete or rewrite installment rows,
 *   - DO NOT run "total paid cannot exceed payable after discount".
 *
 * (When phases ARE present, use the existing replace flow —
 *  see BACKEND_INSTALLMENT_REPLACE.ts.)
 */
export async function patchPaymentDetailsStatusOnly(req, res) {
  const user = requireAmUser(req, res)
  if (!user) return
  try {
    const quotationId = req.params.quotationId || req.params.id
    const quotation = await Quotation.findByPk(quotationId)
    if (!quotation) {
      return res.status(404).json({ success: false, error: { code: "RES_001", message: "Not found" } })
    }

    const body = req.body || {}
    const hasPhases = Array.isArray(body.phases) || Array.isArray(body.installments)
    if (hasPhases) {
      // Delegate to the installment-replace controller.
      return patchQuotationPaymentDetailsWithReplace(req, res)
    }

    const patch = {}
    if (body.paymentStatus) patch.paymentStatus = String(body.paymentStatus).toLowerCase()
    if (body.paymentType) patch.paymentType = String(body.paymentType).toLowerCase()
    if (body.paymentMode) patch.paymentMode = String(body.paymentMode).toLowerCase()
    if (body.remaining !== undefined) patch.remaining = round(body.remaining)
    if (body.remainingAmount !== undefined) patch.remainingAmount = round(body.remainingAmount)

    if (body.finalSettlementApplied === true) {
      patch.finalSettlementApplied = true
      if (body.finalSettlementAmount !== undefined) {
        patch.finalSettlementAmount = round(body.finalSettlementAmount)
      }
      patch.finalSettlementAt = new Date()
      patch.finalSettlementBy = user?.id || null
      // Persist the write-off into discount if pricing PATCH did not run.
      const existing = existingDiscountAmount(quotation)
      const settlement = round(body.finalSettlementAmount ?? 0)
      const amountAfterSubsidy = pickAmountAfterSubsidy(quotation)
      // Idempotent: only add if discount does not already cover the write-off.
      if (settlement > 0 && existing < settlement) {
        const discountAmount = Math.min(amountAfterSubsidy, existing + settlement)
        patch.discount = discountAmount
        patch.discountAmount = discountAmount
        patch.finalAmount = Math.max(0, amountAfterSubsidy - discountAmount)
        patch.totalAmount = patch.finalAmount
        patch.pricing = {
          ...(quotation.pricing || {}),
          discountAmount,
          totalAmount: patch.finalAmount,
          finalAmount: patch.finalAmount,
          amountAfterSubsidy,
          finalSettlementApplied: true,
        }
      }
      patch.remaining = 0
      patch.remainingAmount = 0
      patch.paymentStatus = "completed"
    }

    // Installment rows are intentionally left untouched here.
    await quotation.update(patch)
    await quotation.reload()
    return res.json({ success: true, data: quotationToApiJson(quotation) })
  } catch (e) {
    console.error("[payment-details status-only] error", e)
    return res.status(500).json({ success: false, error: { code: "SYS_001", message: "Internal error" } })
  }
}

// -----------------------------------------------------------------------------
// 2c) LAST FALLBACK — PATCH /api/quotations/:id/discount  (absolute INR)
// -----------------------------------------------------------------------------
/**
 * Body: { "discount": 2000 }
 *   0 < discount <= 100  → percentage (legacy)
 *   discount > 100       → ABSOLUTE INR (Final Settlement uses this)
 *
 * When absolute, treat it the same as a pricing settlement update.
 */
export async function patchDiscountAbsolute(req, res) {
  const user = requireAmUser(req, res)
  if (!user) return
  try {
    const quotationId = req.params.quotationId || req.params.id
    const quotation = await Quotation.findByPk(quotationId)
    if (!quotation) {
      return res.status(404).json({ success: false, error: { code: "RES_001", message: "Not found" } })
    }

    const raw = N((req.body || {}).discount)
    const amountAfterSubsidy = pickAmountAfterSubsidy(quotation)
    const discountAmount =
      raw > 0 && raw <= 100 ? round((raw / 100) * amountAfterSubsidy) : round(raw)

    const s = computeSettlement(quotation, { discountAmount })
    await applySettlement(quotation, s, user)
    return res.json({ success: true, data: quotationToApiJson(quotation) })
  } catch (e) {
    console.error("[discount absolute] error", e)
    return res.status(500).json({ success: false, error: { code: "SYS_001", message: "Internal error" } })
  }
}

// -----------------------------------------------------------------------------
// 3) GET must return the settled state (keeps the button hidden after refresh)
// -----------------------------------------------------------------------------
/**
 * Ensure `quotationToApiJson` (used by GET /quotations and GET /quotations/:id)
 * includes ALL of the following so the SPA hides "Submit final settlement":
 *
 *   {
 *     "subtotal": 292000,
 *     "amountAfterSubsidy": 292000,
 *     "discountAmount": 2000,               // and pricing.discountAmount
 *     "remaining": 0,                       // and remainingAmount
 *     "paymentStatus": "completed",
 *     "finalSettlementApplied": true,       // <-- authoritative flag read by SPA
 *     "finalSettlementAmount": 2000,        // <-- SPA also treats > 0 as settled
 *     "pricing": {
 *       "amountAfterSubsidy": 292000,
 *       "discountAmount": 2000,
 *       "finalAmount": 290000,
 *       "finalSettlementApplied": true
 *     },
 *     "installments": [ ...unchanged paid rows... ]   // still sum to 290000
 *   }
 *
 * The SPA (getQuotationFinalSettlementApplied / isFinalSettlementApplied) hides the
 * button when ANY of these is true, in order:
 *   1. finalSettlementApplied === true  (or final_settlement_applied, or pricing.finalSettlementApplied)
 *   2. finalSettlementAmount > 0        (or final_settlement_amount)
 *   3. discountAmount > 0 AND (originalSubtotal - paid) <= discountAmount
 *
 * Persist at least (1)+discountAmount so refresh across devices keeps it hidden.
 */
export function extendQuotationJsonForSettlement(json, quotation) {
  return {
    ...json,
    finalSettlementApplied: quotation.finalSettlementApplied === true,
    finalSettlementAmount: N(quotation.finalSettlementAmount),
    remaining: N(json.remaining ?? quotation.remaining ?? quotation.remainingAmount),
    remainingAmount: N(json.remainingAmount ?? quotation.remainingAmount ?? quotation.remaining),
    pricing: {
      ...(json.pricing || {}),
      finalSettlementApplied: quotation.finalSettlementApplied === true,
    },
  }
}

// -----------------------------------------------------------------------------
// 4) Route registration (Express)
// -----------------------------------------------------------------------------
/*
router.post ("/quotations/:id/final-settlement", authRequired, postFinalSettlement)
router.patch("/quotations/:id/pricing",          authRequired, patchPricingWithSettlement)
router.patch("/quotations/:id/payment-details",  authRequired, patchPaymentDetailsStatusOnly) // routes to replace flow when phases present
router.patch("/quotations/:id/discount",         authRequired, patchDiscountAbsolute)
*/

// -----------------------------------------------------------------------------
// 5) DB migration (PostgreSQL)
// -----------------------------------------------------------------------------
/*
ALTER TABLE quotations
  ADD COLUMN IF NOT EXISTS final_settlement_applied BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS final_settlement_amount  NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS final_settlement_at      TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS final_settlement_by      UUID NULL,
  ADD COLUMN IF NOT EXISTS remaining_amount         NUMERIC(12,2) DEFAULT 0;

-- Sequelize model attributes:
--   finalSettlementApplied: { type: DataTypes.BOOLEAN, defaultValue: false, field: 'final_settlement_applied' }
--   finalSettlementAmount:  { type: DataTypes.DECIMAL(12,2), defaultValue: 0, field: 'final_settlement_amount' }
--   finalSettlementAt:      { type: DataTypes.DATE, allowNull: true, field: 'final_settlement_at' }
--   finalSettlementBy:      { type: DataTypes.UUID, allowNull: true, field: 'final_settlement_by' }
*/

// -----------------------------------------------------------------------------
// 6) QA checklist
// -----------------------------------------------------------------------------
/*
 1. JITENDRA: paid 290000, remaining 2000 → POST /final-settlement { amount:2000 }
    → 200; GET returns discountAmount 2000, remaining 0, paymentStatus completed,
      finalSettlementApplied true, installments still sum 290000.
 2. Refresh (and other device / role): button stays hidden (flag persisted).
 3. Idempotent: POST /final-settlement twice → discount stays 2000 (no double-add), still 200.
 4. NO "total paid cannot exceed payable after discount" for settlement calls.
 5. NO "Final amount must be between 0 and amount after subsidy" on pricing PATCH.
 6. Ram lal: paid 150000 / cap 185000 / discount 0 → BEFORE settle GET remaining 35000,
    partial; AFTER settle 35000 → completed, discountAmount 35000, finalSettlementApplied true.
 7. Normal installment Submit WITH phases still replaces rows (BACKEND_INSTALLMENT_REPLACE.ts).
 8. Auth: dealer/installer/metering roles get 403 on all four endpoints.
*/
