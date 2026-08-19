import type { Quotation } from "@/lib/quotation-context"
import { formatPersonName } from "@/lib/name-display"

export type DealerPaymentStatus = "pending" | "partial" | "completed"
export type DealerPaymentType = "loan" | "cash" | "mix" | "unknown"

export type DealerPaymentInstallment = {
  phaseNumber: number
  phaseName: string
  paidAmount: number
  amount: number
  paymentMode?: string
  status?: string
}

export type DealerPaymentRow = {
  quotationId: string
  customerName: string
  customerMobile: string
  status: string
  paymentStatus: DealerPaymentStatus
  paymentType: DealerPaymentType
  paymentTypeLabel: string
  subtotal: number
  paidAmount: number
  remainingAmount: number
  loanAmount: number
  cashAmount: number
  loanPaid: number
  cashPaid: number
  loanRemaining: number
  cashRemaining: number
  installments: DealerPaymentInstallment[]
  createdAt: string
  approvedAt?: string
}

function pickFinite(...vals: unknown[]): number {
  for (const v of vals) {
    if (v === undefined || v === null || v === "") continue
    const n = Number(v)
    if (Number.isFinite(n)) return n
  }
  return 0
}

function optionalFinite(v: unknown): number | undefined {
  if (v === undefined || v === null || v === "") return undefined
  const n = Number(v)
  return Number.isFinite(n) ? n : undefined
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function getDiscountAmount(q: Quotation): number {
  const qx = q as Quotation & Record<string, unknown>
  const pricing = asRecord(qx.pricing)
  const fromPricing = optionalFinite(
    pricing?.discountAmount ?? qx.discountAmount ?? qx.discount_amount,
  )
  if (fromPricing != null && fromPricing > 0) return fromPricing
  const discount = Number(q.discount) || 0
  if (discount > 100) return discount
  if (discount > 0 && discount <= 100) {
    const subtotal = pickFinite(q.subtotal, q.totalAmount, q.finalAmount)
    return Math.round(subtotal * (discount / 100))
  }
  return 0
}

function getOriginalSubtotal(q: Quotation): number {
  const qx = q as Quotation & Record<string, unknown>
  const pricing = asRecord(qx.pricing)
  return Math.max(
    0,
    Math.round(
      pickFinite(
        pricing?.subtotal,
        qx.subtotal,
        qx.totalAmount,
        pricing?.totalAmount,
        qx.finalAmount,
        pricing?.finalAmount,
      ),
    ),
  )
}

function normalizePaymentMode(raw?: string | null): string {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
}

function isLoanSideMode(mode?: string | null): boolean {
  return normalizePaymentMode(mode) === "loan"
}

function extractPaymentPhases(q: Quotation): DealerPaymentInstallment[] {
  const qx = q as Quotation & Record<string, unknown>
  const candidates = [
    qx.installments,
    qx.paymentPhases,
    qx.payment_phases,
    qx.quotationPaymentPhases,
    qx.quotation_payment_phases,
  ]
  for (const candidate of candidates) {
    if (!Array.isArray(candidate) || candidate.length === 0) continue
    const phases = candidate
      .map((phase, index) => {
        const row = asRecord(phase) || {}
        const phaseNumber = Math.max(
          1,
          Math.round(pickFinite(row.phaseNumber, row.phase_number, row.installmentNumber, index + 1)),
        )
        const phaseName = String(row.phaseName || row.phase_name || `Installment ${phaseNumber}`).trim()
        const paidAmount = Math.max(
          0,
          Math.round(pickFinite(row.paidAmount, row.paid_amount, row.amountPaid, row.amount_paid)),
        )
        const amount = Math.max(
          0,
          Math.round(pickFinite(row.amount, row.installmentAmount, row.installment_amount)),
        )
        const paymentMode = String(
          row.paymentMode || row.payment_mode || row.mode || "",
        ).trim() || undefined
        const status = String(row.status || "").trim() || undefined
        return { phaseNumber, phaseName, paidAmount, amount, paymentMode, status }
      })
      .sort((a, b) => a.phaseNumber - b.phaseNumber)
    if (phases.some((phase) => phase.paidAmount > 0 || phase.amount > 0)) return phases
  }
  return []
}

function isFinalSettlementApplied(q: Quotation): boolean {
  const qx = q as Quotation & Record<string, unknown>
  const pricing = asRecord(qx.pricing)
  return (
    qx.finalSettlementApplied === true ||
    qx.final_settlement_applied === true ||
    pricing?.finalSettlementApplied === true ||
    pricing?.final_settlement_applied === true
  )
}

function resolvePaymentType(q: Quotation): DealerPaymentType {
  const qx = q as Quotation & Record<string, unknown>
  const raw = String(qx.paymentType || qx.payment_type || qx.paymentMode || qx.payment_mode || "")
    .trim()
    .toLowerCase()
  if (raw === "loan") return "loan"
  if (raw === "cash") return "cash"
  if (raw === "mix") return "mix"
  return "unknown"
}

function paymentTypeLabel(type: DealerPaymentType): string {
  if (type === "loan") return "Loan"
  if (type === "cash") return "Cash"
  if (type === "mix") return "Cash + loan"
  return "—"
}

function customerNameFromQuotation(q: Quotation): string {
  const c = q.customer
  if (!c) return "Unknown customer"
  const first = String(c.firstName || "").trim()
  const last = String(c.lastName || "").trim()
  const combined = formatPersonName(first, last).trim()
  if (combined) return combined
  return String((c as { name?: string }).name || "Unknown customer")
}

function installmentShortLabel(phase: DealerPaymentInstallment): string {
  const matched = String(phase.phaseName || "").match(/(\d+)/)
  if (matched) return `I${matched[1]}`
  return `I${phase.phaseNumber}`
}

export function formatInstallmentHoverLine(phase: DealerPaymentInstallment): string {
  const mode = phase.paymentMode ? ` (${phase.paymentMode})` : ""
  return `${installmentShortLabel(phase).toLowerCase()}${mode}: ₹${Math.round(phase.paidAmount).toLocaleString("en-IN")}`
}

/**
 * Read-only paid / remaining summary for dealer Payments tab.
 * Same math as Account Management: paid = sum of installment paidAmounts only.
 * Do not infer paid from API remaining — that field is often after-subsidy
 * (e.g. ₹1,90,000 − ₹73,000 subsidy → remaining ₹1,17,000 looks like ₹73,000 paid).
 */
export function summarizeQuotationPayment(q: Quotation): DealerPaymentRow {
  const qx = q as Quotation & Record<string, unknown>
  const phases = extractPaymentPhases(q)
  const phasePaid = phases.reduce((sum, p) => sum + p.paidAmount, 0)
  const subtotal = getOriginalSubtotal(q)
  const discount = getDiscountAmount(q)
  const cap = Math.max(0, subtotal - discount)
  const paymentType = resolvePaymentType(q)

  const loanAmountRaw = Math.max(0, Math.round(pickFinite(qx.loanAmount, qx.loan_amount)))
  const cashAmountRaw = Math.max(0, Math.round(pickFinite(qx.cashAmount, qx.cash_amount)))

  let loanAmount = 0
  let cashAmount = 0
  if (paymentType === "mix") {
    if (loanAmountRaw > 0) loanAmount = Math.min(loanAmountRaw, cap)
    if (cashAmountRaw > 0) cashAmount = Math.min(cashAmountRaw, cap)
    if (loanAmount <= 0 && cashAmount > 0 && cashAmount < cap) loanAmount = Math.max(0, cap - cashAmount)
    if (cashAmount <= 0 && loanAmount > 0 && loanAmount < cap) cashAmount = Math.max(0, cap - loanAmount)
  } else if (paymentType === "loan") {
    loanAmount = loanAmountRaw > 0 ? Math.min(loanAmountRaw, cap) : cap
  } else if (paymentType === "cash") {
    cashAmount = cashAmountRaw > 0 ? Math.min(cashAmountRaw, cap) : cap
  }

  const loanPaid = phases.reduce(
    (sum, p) => (isLoanSideMode(p.paymentMode) ? sum + p.paidAmount : sum),
    0,
  )
  const cashPaid = phases.reduce(
    (sum, p) => (!isLoanSideMode(p.paymentMode) && p.paidAmount > 0 ? sum + p.paidAmount : sum),
    0,
  )

  const paidAmount = phasePaid
  const remainingAmount = isFinalSettlementApplied(q) ? 0 : Math.max(0, cap - phasePaid)

  const loanRemaining =
    paymentType === "mix" || paymentType === "loan"
      ? Math.max(0, loanAmount - loanPaid)
      : 0
  const cashRemaining =
    paymentType === "mix" || paymentType === "cash"
      ? Math.max(0, cashAmount - cashPaid)
      : 0

  let paymentStatus: DealerPaymentStatus = "pending"
  if (remainingAmount <= 0 && (paidAmount > 0 || discount > 0 || isFinalSettlementApplied(q))) {
    paymentStatus = "completed"
  } else if (paidAmount > 0) {
    paymentStatus = "partial"
  }

  return {
    quotationId: String(q.id || ""),
    customerName: customerNameFromQuotation(q),
    customerMobile: String(q.customer?.mobile || "").trim() || "—",
    status: String(q.status || "").toLowerCase() || "unknown",
    paymentStatus,
    paymentType,
    paymentTypeLabel: paymentTypeLabel(paymentType),
    subtotal: cap > 0 ? cap : subtotal,
    paidAmount,
    remainingAmount,
    loanAmount,
    cashAmount,
    loanPaid,
    cashPaid,
    loanRemaining,
    cashRemaining,
    installments: phases,
    createdAt: String(q.createdAt || ""),
    approvedAt: String(qx.statusApprovedAt || qx.status_approved_at || qx.approvedAt || "") || undefined,
  }
}

export function statusBadgeClass(status: DealerPaymentStatus): string {
  if (status === "completed") return "bg-emerald-100 text-emerald-800 border-emerald-200"
  if (status === "partial") return "bg-orange-100 text-orange-800 border-orange-300"
  return "bg-red-100 text-red-800 border-red-300"
}

/** Full row / card tint for dealer Payments grid. */
export function statusRowClass(status: DealerPaymentStatus): string {
  if (status === "completed") {
    return "border-emerald-300 bg-emerald-50/80 hover:bg-emerald-50"
  }
  if (status === "partial") {
    return "border-orange-300 bg-orange-50/80 hover:bg-orange-50"
  }
  return "border-red-300 bg-red-50/80 hover:bg-red-50"
}

export function statusAccentTextClass(status: DealerPaymentStatus): string {
  if (status === "completed") return "text-emerald-700"
  if (status === "partial") return "text-orange-700"
  return "text-red-700"
}

export function statusLabel(status: DealerPaymentStatus): string {
  if (status === "completed") return "Completed"
  if (status === "partial") return "Partial"
  return "Pending"
}
