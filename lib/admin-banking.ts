import type { Quotation } from "@/lib/quotation-context"
import {
  summarizeQuotationPayment,
  type DealerPaymentInstallment,
  type DealerPaymentRow,
} from "@/lib/dealer-payment-summary"

export type BankingSubTab = "pending_second" | "second_received" | "pending_first" | "completed"

export const BANKING_SUB_TABS: { value: BankingSubTab; label: string }[] = [
  { value: "pending_second", label: "Pending Second installment" },
  { value: "second_received", label: "Second installment received" },
  { value: "pending_first", label: "Pending first installment" },
  { value: "completed", label: "Completed" },
]

function isLoanSideMode(mode?: string | null): boolean {
  return (
    String(mode || "")
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, "_") === "loan"
  )
}

export function getLoanSideInstallments(row: DealerPaymentRow): DealerPaymentInstallment[] {
  if (row.paymentType === "loan") return row.installments
  return row.installments.filter((phase) => isLoanSideMode(phase.paymentMode))
}

export function getLoanRemaining(row: DealerPaymentRow): number {
  if (row.paymentType === "loan") return Math.max(0, row.remainingAmount)
  return Math.max(0, row.loanRemaining)
}

export function getFirstLoanInstallmentPaid(row: DealerPaymentRow): number {
  const loanPhases = getLoanSideInstallments(row)
  const first =
    loanPhases.find((phase) => phase.phaseNumber === 1) ||
    [...loanPhases].sort((a, b) => a.phaseNumber - b.phaseNumber)[0]
  return Math.max(0, first?.paidAmount || 0)
}

export function getSecondInstallmentPaid(row: DealerPaymentRow): number {
  const loanPhases = getLoanSideInstallments(row)
  const second =
    loanPhases.find((phase) => phase.phaseNumber === 2) ||
    [...loanPhases].sort((a, b) => a.phaseNumber - b.phaseNumber)[1]
  return Math.max(0, second?.paidAmount || 0)
}

export function getSecondInstallmentRemaining(row: DealerPaymentRow): number {
  const loanPhases = getLoanSideInstallments(row)
  const second =
    loanPhases.find((phase) => phase.phaseNumber === 2) ||
    [...loanPhases].sort((a, b) => a.phaseNumber - b.phaseNumber)[1]
  if (second) return Math.max(0, (second.amount || 0) - (second.paidAmount || 0))
  return getLoanRemaining(row)
}

/**
 * Banking buckets for Loan / Cash+loan files from Accounts:
 * - pending_second: exactly one loan installment has been paid, loan remaining (I2) is still due, partial
 * - second_received: two or more loan installments have payment
 * - pending_first: no loan installment paid yet
 * - completed: loan remaining is 0
 */
export function getBankingLoanStage(row: DealerPaymentRow): BankingSubTab | null {
  if (row.paymentType !== "loan" && row.paymentType !== "mix") return null

  const loanRemaining = getLoanRemaining(row)
  const paidLoanPhases = getLoanSideInstallments(row).filter((phase) => (phase.paidAmount || 0) > 0)

  // Loan remaining ₹0 (including mix with no loan) always sits in Completed / green.
  if (loanRemaining <= 0) return "completed"
  if (paidLoanPhases.length === 0) return "pending_first"
  if (paidLoanPhases.length === 1) return "pending_second"
  return "second_received"
}

export type BankingPaymentRow = DealerPaymentRow & {
  quotation: Quotation
  stage: BankingSubTab
  firstLoanPaid: number
  secondPaid: number
  secondRemaining: number
  loanRemaining: number
}

export function buildBankingRows(quotations: Quotation[]): BankingPaymentRow[] {
  const rows: BankingPaymentRow[] = []
  for (const quotation of quotations) {
    if (String(quotation.status || "").toLowerCase() !== "approved") continue
    const summary = summarizeQuotationPayment(quotation)
    const stage = getBankingLoanStage(summary)
    if (!stage) continue
    rows.push({
      ...summary,
      quotation,
      stage,
      firstLoanPaid: getFirstLoanInstallmentPaid(summary),
      secondPaid: getSecondInstallmentPaid(summary),
      secondRemaining: getSecondInstallmentRemaining(summary),
      loanRemaining: getLoanRemaining(summary),
    })
  }
  return rows.sort((a, b) => {
    const aTime = new Date(a.approvedAt || a.createdAt).getTime()
    const bTime = new Date(b.approvedAt || b.createdAt).getTime()
    return (Number.isFinite(bTime) ? bTime : 0) - (Number.isFinite(aTime) ? aTime : 0)
  })
}
