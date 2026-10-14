// @ts-nocheck
/**
 * =============================================================================
 * BACKEND — Office Inside installment: Collect self vs To Chairbord
 * =============================================================================
 *
 * Frontend (Oct 2026):
 *   - Account Management → Payment management (all files)
 *   - Cash / UPI only: **Office** dropdown **Chairbord** (default) | **Other**
 *   - Chairbord: installment save only; no auto leaser row
 *   - Other: office-inside subvendor dropdown + Amount (≤ paidAmount)
 *   - Amount posts to that subvendor’s leaser (`lp-collect-{quotationId}-{phaseNumber}`)
 *   - Legacy `self` still means the file’s own office-inside vendor
 *   - `app/dashboard/account-management/page.tsx`
 *   - `lib/api.ts` → `api.quotations.updatePaymentDetails` (phase.collectDestination)
 *   - After save, SPA PUT `/admin/subvendors/:id/leaser` with id `lp-collect-{quotationId}-{phaseNumber}`
 *
 * Auth: same as installment replace — `account-management` or `admin`.
 *
 * Why:
 *   Vendor collected Cash/UPI themselves → that amount belongs on *their* dealer leaser.
 *   “To Chairbord” is the existing installment flow (no auto leaser row).
 *
 * -----------------------------------------------------------------------------
 * Do / do not
 * -----------------------------------------------------------------------------
 *
 * DO:
 *   - Persist collectDestination, collectKind, collectSelfAmount, collectChairbordAmount
 *     and echo them on GET
 *   - Allow extra phase keys (do not 400 Joi “unknown field”)
 *   - Persist leaser payment `id` exactly as sent, including `lp-self-…` (TEXT, not UUID-only)
 *   - Persist leaser `date` as DATEONLY YYYY-MM-DD **as sent** (Accounts installment Due Date)
 *   - Echo installment `dueDate` as YYYY-MM-DD on GET
 *   - Default missing collectDestination to chairbord (do not 400)
 *
 * DO NOT:
 *   - Create leaser rows inside the installment save handler (SPA already PUTs leaser)
 *   - Reject installment save because `collectDestination` is present
 *   - Replace `lp-self-…` ids with generated UUIDs (causes duplicate leaser rows on next save)
 *   - Rewrite leaser `date` to NOW() / created_at / installment paymentDate
 *
 * No new HTTP routes. Builds on §AB (installment replace) + §BG (dealer leaser).
 *
 * -----------------------------------------------------------------------------
 * A) Installment field
 * -----------------------------------------------------------------------------
 *
 * Per phase in PUT/PATCH installment body:
 *
 *   collectDestination: "self" | "chairbord" | "other"
 *   collectKind: "complete" | "partial"
 *   collectSelfAmount: number   // INR; leaser amount when Other/self > 0
 *   collectChairbordAmount: number
 *   collectVendorId: string     // office-inside subvendor id when Other
 *
 * Aliases (read any, write both):
 *   collect_destination, collectedBy, collected_by,
 *   collect_kind, collect_self_amount, collect_chairbord_amount,
 *   collect_vendor_id / collectVendorId
 *
 * Rules:
 *   - Allowed values: "self", "chairbord", "other" (also collect_other / vendor / office → other; collect_self → self; to_chairbord / company → chairbord)
 *   - Only meaningful when that phase paymentMode is cash or upi
 *   - Loan / bank_transfer / cheque / card / missing → store NULL
 *   - Missing on old clients → NULL (treat as Chairbord; do not 400)
 *   - Unknown string → NULL, do not 400
 *
 * Example phase (Office Inside, UPI, Self + Partial):
 *
 * {
 *   "phaseNumber": 2,
 *   "phaseName": "Installment 2",
 *   "amount": 75000,
 *   "paidAmount": 30000,
 *   "status": "partial",
 *   "dueDate": "2026-09-18",
 *   "paymentMode": "upi",
 *   "collectDestination": "self",
 *   "collect_destination": "self",
 *   "collectKind": "partial",
 *   "collect_kind": "partial",
 *   "collectSelfAmount": 5000,
 *   "collect_self_amount": 5000,
 *   "collectChairbordAmount": 25000,
 *   "collect_chairbord_amount": 25000,
 *   "transactionId": "…",
 *   "note": ""
 * }
 *
 * SQL (relational table — skip if phases live only in JSON):
 *
 *   ALTER TABLE quotation_installments
 *     ADD COLUMN IF NOT EXISTS collect_destination VARCHAR(16) NULL,
 *     ADD COLUMN IF NOT EXISTS collect_kind VARCHAR(16) NULL,
 *     ADD COLUMN IF NOT EXISTS collect_self_amount NUMERIC(14, 2) NULL,
 *     ADD COLUMN IF NOT EXISTS collect_chairbord_amount NUMERIC(14, 2) NULL,
 *     ADD COLUMN IF NOT EXISTS collect_vendor_id VARCHAR(80) NULL;
 *
 * JSON column path: keep the keys inside payment_phases / installments JSON as sent.
 *
 * GET /quotations?status=approved, GET /quotations/:id, and the installment save
 * response must echo each phase:
 *
 *   collectDestination / collect_destination
 *   collectKind / collect_kind
 *   collectSelfAmount / collect_self_amount
 *   collectChairbordAmount / collect_chairbord_amount
 *   collectVendorId / collect_vendor_id
 *
 * If collectDestination is omitted, the dialog always reopens as Chairbord after refresh.
 *
 * Joi / class-validator: phase objects must allow unknown keys OR explicitly allow
 * collectDestination. Strict strip/reject of extra keys breaks Account Management save.
 *
 * -----------------------------------------------------------------------------
 * B) Leaser ids — persist `lp-self-*` as TEXT
 * -----------------------------------------------------------------------------
 *
 * After installment save, frontend:
 *   1. GET  /admin/subvendors/leaser?vendorId=:id
 *   2. PUT  /admin/subvendors/:id/leaser
 *
 * Auto rows:
 *   id            = "lp-collect-" + quotationId + "-" + phaseNumber
 *                   (legacy cleanup still removes "lp-self-" + quotationId + "-" + phaseNumber)
 *   vendorId      = selected office_inside subvendor id (collectVendorId)
 *   date          = Accounts installment **Due Date** (phase.dueDate YYYY-MM-DD).
 *                   Fallback paymentDate only when dueDate is empty.
 *                   Persist DATEONLY as sent. Do **not** set to NOW() / created_at.
 *   amount        = self share only
 *                   collectedBy chairbord → skip (no row)
 *                   self + complete → paidAmount
 *                   self + partial → collectSelfAmount (e.g. 5000 of 30000)
 *                   skipped when self amount <= 0
 *   paymentType   = "Cash" | "UPI"     (from phase paymentMode)
 *   remark        = phase.note or "Installment N — {customer} (collect self)"
 *   customerIds   = [ quotationId ]
 *   sortOrder     = appended after existing non-auto rows
 *
 * When the user switches that phase to Chairbord / Loan / unpaid:
 *   SPA omits that `lp-self-*` id from the PUT body (full replace, so the row is deleted).
 *
 * CHANGE from original §BG:
 *   Do NOT “keep id only if UUID, else generate”.
 *   Persist body.payments[].id as-is when non-empty (UUID *or* `lp-self-…`).
 *
 * SQL:
 *
 *   ALTER TABLE subvendor_leaser_payments
 *     ALTER COLUMN id TYPE TEXT;
 *   -- If the table was created as UUID PK, recreate PK as TEXT.
 *
 * Sequelize:
 *   id: { type: DataTypes.STRING(80), primaryKey: true }
 *
 * Empty / missing id → generate UUID (manual Manage rows).
 *
 * -----------------------------------------------------------------------------
 * C) Leaser date = Accounts Due Date (**§BP**)
 * -----------------------------------------------------------------------------
 *
 * SPA sends payments[].date = phase.dueDate (Office Inside Due Date input).
 * Example: installment dueDate "2026-09-18" → leaser date "2026-09-18"
 * (not the day the installment was saved).
 *
 * PUT /admin/subvendors/:id/leaser:
 *   - Store date / payment_date as DATE (DATEONLY), calendar day as sent
 *   - Accept `date` or `payment_date`
 *   - Empty date → today YYYY-MM-DD; a **sent** date must not be overwritten
 *
 * GET leaser:
 *   - Echo `date` and `payment_date` as "YYYY-MM-DD" (not ISO datetime)
 *   - Do not convert DATEONLY through UTC midnight in a way that shifts IST
 *
 * GET installments (approved list + quotation detail + installment save):
 *   - Echo each phase `dueDate` / `due_date` as "YYYY-MM-DD"
 *   - SPA overlays existing lp-self-* rows from this field after refresh
 *
 * -----------------------------------------------------------------------------
 * Normalize helper (installment)
 * -----------------------------------------------------------------------------
 */

const COLLECT_SELF = "self"
const COLLECT_CHAIRBORD = "chairbord"

function normalizeCollectDestination(raw, paymentMode) {
  const mode = String(paymentMode || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
  const cashOrUpi = mode === "cash" || mode === "upi"
  if (!cashOrUpi) return null
  const s = String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
  if (s === "self" || s === "collect_self") return COLLECT_SELF
  if (s === "other" || s === "collect_other" || s === "vendor" || s === "office") return "other"
  if (s === "chairbord" || s === "to_chairbord" || s === "company") return COLLECT_CHAIRBORD
  return null
}

function pickCollectDestination(phase) {
  return normalizeCollectDestination(
    phase.collectDestination ??
      phase.collect_destination ??
      phase.collectedBy ??
      phase.collected_by,
    phase.paymentMode || phase.mode || phase.payment_method,
  )
}

/** Persist / echo leaser + installment calendar days as YYYY-MM-DD (DATEONLY). */
function calendarDateYmd(raw, fallback) {
  const text = String(raw || fallback || "").trim()
  const match = text.match(/^(\d{4}-\d{2}-\d{2})/)
  if (match) return match[1]
  const parsed = new Date(text)
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10)
  return new Date().toISOString().slice(0, 10)
}

/**
 * Add to normalizePhasesInput in BACKEND_INSTALLMENT_REPLACE.ts:
 *
 *   collectDestination: pickCollectDestination(p),
 *
 * And include it on GET JSON for each installment.
 *
 * Leaser PUT: if (asText(row.id)) use it; else uuidV4().
 *
 * QA:
 * 1. Office Inside + Cash + Collect self + paid > 0 → save → GET installment has
 *    collectDestination: "self". GET leaser includes id lp-self-{quotationId}-1
 *    with that amount and customerIds [quotationId].
 * 2. Switch to To Chairbord → save → collectDestination "chairbord", lp-self-* gone.
 * 3. Office Outside / Loan phase: no collectDestination required; extra key must not 400.
 * 4. Refresh dialog: Collect self radio still selected.
 * 5. Due Date 2026-09-18, save Collect self today → GET leaser date is "2026-09-18"
 *    (not today). Refresh Manage still shows 18/09/2026.
 */

export {
  COLLECT_SELF,
  COLLECT_CHAIRBORD,
  normalizeCollectDestination,
  pickCollectDestination,
  calendarDateYmd,
}
