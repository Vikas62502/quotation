// @ts-nocheck
/**
 * =============================================================================
 * BACKEND REFERENCE — Account Management installment replace (remove + submit)
 * =============================================================================
 *
 * Frontend (Jul 2026):
 *   - `app/dashboard/account-management/page.tsx` → Manage → Remove installment → Submit
 *   - `lib/api.ts` → `api.quotations.updatePaymentDetails`
 *
 * Problem fixed on SPA:
 *   - User removes 1+ installment rows and submits; after refresh deleted rows reappear.
 *   - Cause: backend **merged** incoming phases with existing DB rows instead of **replacing**.
 *
 * Required behavior:
 *   **REPLACE** the full installment set with the `phases` / `installments` array in the
 *   request body. Empty array `[]` clears all installments.
 *
 * -----------------------------------------------------------------------------
 * Endpoints (client try order — see lib/api.ts updatePaymentDetails)
 * -----------------------------------------------------------------------------
 *
 * 1) PUT /api/quotations/:quotationId/installments          (preferred for replace)
 * 2) PATCH /api/quotations/:quotationId/payment-details
 * 3) PATCH /api/quotations/:quotationId/installments
 *
 * Auth: `account-management` or `admin` only.
 * Quotation must be `status = approved`.
 *
 * -----------------------------------------------------------------------------
 * Request body flags (any of these ⇒ full replace, not merge)
 * -----------------------------------------------------------------------------
 *
 *   replaceInstallments: true
 *   replace: true
 *
 * Frontend always sends `replaceInstallments: true` on Submit.
 *
 * -----------------------------------------------------------------------------
 * Request body shape
 * -----------------------------------------------------------------------------
 *
 * PATCH /payment-details:
 * {
 *   "paymentType": "loan" | "cash" | "mix",
 *   "paymentMode": "cash" | "upi" | "loan" | "cheque" | ...,
 *   "paymentStatus": "pending" | "partial" | "completed",
 *   "replaceInstallments": true,
 *   "installments": [ ...same as phases... ],
 *   "phases": [
 *     {
 *       "phaseNumber": 1,
 *       "phaseName": "Installment 1",
 *       "amount": 132000,
 *       "paidAmount": 132000,
 *       "status": "completed",
 *       "dueDate": "2026-06-24",
 *       "paymentDate": "2026-06-24T10:00:00.000Z",
 *       "paymentMode": "loan",
 *       "transactionId": "BY TRANSFER ...",
 *       "note": "optional"
 *     }
 *   ],
 *   "subsidyCheques": [ optional audit array ]
 * }
 *
 * PUT /installments:
 * {
 *   "replace": true,
 *   "replaceInstallments": true,
 *   "installments": [ ...phase rows... ],
 *   "paymentStatus": "partial",
 *   "paymentType": "loan",
 *   "paymentMode": "loan"
 * }
 *
 * -----------------------------------------------------------------------------
 * Persistence rules
 * -----------------------------------------------------------------------------
 *
 * A) JSON column on quotations (`payment_phases` / `installments`):
 *    SET payment_phases = JSON.stringify(phasesFromBody)   -- including []
 *
 * B) Relational table `quotation_installments` (or `payment_phases`):
 *    BEGIN TRANSACTION
 *      DELETE FROM quotation_installments WHERE quotation_id = :id
 *      INSERT rows from body.phases (0 rows if empty array)
 *    COMMIT
 *
 *    Do NOT leave orphan rows when phase count decreases.
 *    Do NOT upsert-only by phase_number (that preserves deleted rows).
 *
 * C) Recompute on every save:
 *    remaining_amount = subtotal - SUM(paid_amount)
 *    payment_status from sum paid vs subtotal if body.paymentStatus omitted
 *
 * D) Validation:
 *    - SUM(paidAmount) <= subtotal (tolerance ₹1)
 *    - per row: paidAmount <= amount (or amount = max(amount, paidAmount) server-side)
 *    - phaseNumber sequential 1..N after save
 *
 * -----------------------------------------------------------------------------
 * GET responses (must reflect replace immediately)
 * -----------------------------------------------------------------------------
 *
 * On GET /api/quotations?status=approved and GET /api/quotations/:id return:
 *
 *   installments | paymentPhases | payment_phases  — same array, exact length = DB count
 *   paymentStatus, paymentMode, paymentType
 *   remaining | remainingAmount
 *   subsidyCheques (optional)
 *
 * Frontend Payment Management filter **Installment count** uses array.length exactly.
 * Returning 3 rows when user saved 2 breaks UX.
 *
 * -----------------------------------------------------------------------------
 * Response envelope (PATCH / PUT success)
 * -----------------------------------------------------------------------------
 *
 * {
 *   "success": true,
 *   "data": {
 *     "id": "...",
 *     "installments": [ ...persisted rows... ],
 *     "paymentPhases": [ ...same... ],
 *     "paymentStatus": "partial",
 *     "remaining": 57000,
 *     ...
 *   }
 * }
 *
 * Frontend reads `data.installments` / `data.paymentPhases` after save.
 *
 * -----------------------------------------------------------------------------
 * SQL sketch (PostgreSQL, relational model)
 * -----------------------------------------------------------------------------
 */

const REPLACE_FLAGS = ["replaceInstallments", "replace", "syncInstallments"]

function shouldReplaceInstallments(body) {
  if (!body || typeof body !== "object") return true // frontend always replace on Submit
  for (const key of REPLACE_FLAGS) {
    if (body[key] === true || body[key] === "replace" || body[key] === 1) return true
  }
  // Default true for payment-details Submit from Account Management (Jul 2026)
  return body.phases !== undefined || body.installments !== undefined
}

function normalizePhasesInput(body) {
  const raw = body.phases ?? body.installments ?? []
  if (!Array.isArray(raw)) return []
  return raw.map((p, index) => ({
    phaseNumber: Number(p.phaseNumber) || index + 1,
    phaseName: String(p.phaseName || `Installment ${index + 1}`),
    amount: Math.max(0, Math.round(Number(p.amount) || 0)),
    paidAmount: Math.max(0, Math.round(Number(p.paidAmount) || 0)),
    status: p.status || "pending",
    dueDate: p.dueDate || null,
    paymentDate: p.paymentDate || null,
    paymentMode: p.paymentMode || null,
    transactionId: p.transactionId || null,
    note: p.note || p.remarks || null,
  }))
}

/**
 * Shared replace logic — call from PUT /installments and PATCH /payment-details.
 */
export async function replaceQuotationInstallments(quotation, body, { transaction } = {}) {
  const phases = normalizePhasesInput(body)
  const subtotal = pickQuotationSubtotalForPayments(quotation)
  let sumPaid = 0
  for (const p of phases) {
    sumPaid += p.paidAmount
    p.amount = Math.max(p.amount, p.paidAmount)
    if (!p.status || p.status === "pending") {
      p.status = p.paidAmount >= p.amount ? "completed" : p.paidAmount > 0 ? "partial" : "pending"
    }
  }
  if (sumPaid > subtotal + 1) {
    const err = new Error(`Total paid (${sumPaid}) exceeds subtotal (${subtotal})`)
    err.code = "VAL_012"
    throw err
  }

  const remaining = Math.max(0, subtotal - sumPaid)
  let paymentStatus = body.paymentStatus
  if (!paymentStatus) {
    if (sumPaid <= 0) paymentStatus = "pending"
    else if (sumPaid >= subtotal) paymentStatus = "completed"
    else paymentStatus = "partial"
  }

  // --- Option A: JSON column ---
  // await quotation.update({ payment_phases: phases, payment_status: paymentStatus, remaining_amount: remaining }, { transaction })

  // --- Option B: relational ---
  // await QuotationInstallment.destroy({ where: { quotationId: quotation.id }, transaction })
  // if (phases.length) await QuotationInstallment.bulkCreate(phases.map(p => ({ ...p, quotationId: quotation.id })), { transaction })

  return { phases, paymentStatus, remaining, sumPaid }
}

/**
 * PUT /quotations/:quotationId/installments
 */
export async function putQuotationInstallments(req, res) {
  try {
    const user = req.user
    if (!user || !["account-management", "admin"].includes(user.role)) {
      return res.status(403).json({ success: false, error: { code: "AUTH_004", message: "Forbidden" } })
    }
    const quotationId = req.params.quotationId || req.params.id
    const quotation = await Quotation.findByPk(quotationId)
    if (!quotation) {
      return res.status(404).json({ success: false, error: { code: "RES_001", message: "Not found" } })
    }
    if (String(quotation.status || "").toLowerCase() !== "approved") {
      return res.status(400).json({ success: false, error: { code: "VAL_010", message: "Not approved" } })
    }

    const body = req.body || {}
    if (!shouldReplaceInstallments(body)) {
      return res.status(400).json({
        success: false,
        error: { code: "VAL_013", message: "PUT /installments requires replace mode" },
      })
    }

    const result = await replaceQuotationInstallments(quotation, body)
    await quotation.update({
      paymentPhases: result.phases,
      paymentStatus: result.paymentStatus,
      remainingAmount: result.remaining,
      ...(body.paymentMode ? { paymentMode: String(body.paymentMode).toLowerCase() } : {}),
      ...(body.paymentType ? { paymentType: String(body.paymentType).toLowerCase() } : {}),
    })
    await quotation.reload()

    return res.json({ success: true, data: quotationToApiJson(quotation) })
  } catch (e) {
    if (e.code === "VAL_012") {
      return res.status(400).json({ success: false, error: { code: e.code, message: e.message } })
    }
    console.error(e)
    return res.status(500).json({ success: false, error: { code: "SYS_001", message: "Internal error" } })
  }
}

/**
 * PATCH /quotations/:quotationId/payment-details — use replace when phases/installments present.
 */
export async function patchQuotationPaymentDetailsWithReplace(req, res) {
  try {
    const user = req.user
    if (!user || !["account-management", "admin"].includes(user.role)) {
      return res.status(403).json({ success: false, error: { code: "AUTH_004", message: "Forbidden" } })
    }
    const quotationId = req.params.quotationId || req.params.id
    const quotation = await Quotation.findByPk(quotationId)
    if (!quotation) {
      return res.status(404).json({ success: false, error: { code: "RES_001", message: "Not found" } })
    }

    const body = req.body || {}
    const hasPhasePayload = Array.isArray(body.phases) || Array.isArray(body.installments)

    // Legacy: installation-release-only PATCH may hit this route — merge release fields only.
    if (!hasPhasePayload) {
      // ... existing merge logic for installationReadyForInstaller only ...
      return res.status(400).json({ success: false, error: { code: "VAL_011", message: "phases required" } })
    }

    const result = await replaceQuotationInstallments(quotation, body)
    const subsidyNormalized = normalizeSubsidyChequesFromRequestBody(body)

    await quotation.update({
      paymentPhases: result.phases,
      paymentStatus: result.paymentStatus,
      remainingAmount: result.remaining,
      ...(subsidyNormalized !== undefined ? { subsidyCheques: subsidyNormalized } : {}),
      ...(body.paymentMode ? { paymentMode: String(body.paymentMode).toLowerCase() } : {}),
      ...(body.paymentType ? { paymentType: String(body.paymentType).toLowerCase() } : {}),
    })
    await quotation.reload()

    return res.json({ success: true, data: quotationToApiJson(quotation) })
  } catch (e) {
    if (e.code === "VAL_012") {
      return res.status(400).json({ success: false, error: { code: e.code, message: e.message } })
    }
    console.error(e)
    return res.status(500).json({ success: false, error: { code: "SYS_001", message: "Internal error" } })
  }
}

/**
 * QA checklist
 * 1. Quotation with 3 installments → remove 1 in UI → Submit with 2 phases → GET returns length 2.
 * 2. Remove all installments → Submit phases: [] → GET returns [] (not 1 stale row).
 * 3. installmentCount filter on GET list matches array.length after save.
 * 4. payment-details PATCH with only installationReadyForInstaller does NOT wipe phases (merge release only).
 */

export { shouldReplaceInstallments, normalizePhasesInput }
