import type { Quotation } from "@/lib/quotation-context"
import {
  summarizeQuotationPayment,
  type DealerPaymentInstallment,
  type DealerPaymentRow,
} from "@/lib/dealer-payment-summary"

export type BankingSubTab = "pending_bank" | "submitted" | "completed"

export const BANKING_SUB_TABS: { value: BankingSubTab; label: string }[] = [
  { value: "pending_bank", label: "Pending from the bank" },
  { value: "submitted", label: "Submitted" },
  { value: "completed", label: "Completed" },
]

export const BANKING_SUBMIT_MAP_KEY = "adminBankingSubmitted"

export type BankingSubmitRecord = {
  assignedPersonName: string
  remarks?: string
  bankLocation?: string
  documentNames: string[]
  submittedAt: string
}

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

export function readBankingSubmitMap(): Record<string, BankingSubmitRecord> {
  if (typeof window === "undefined") return {}
  try {
    const raw = JSON.parse(localStorage.getItem(BANKING_SUBMIT_MAP_KEY) || "{}")
    return raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {}
  } catch {
    return {}
  }
}

export function markBankingSubmitted(quotationId: string, record: BankingSubmitRecord) {
  if (typeof window === "undefined" || !quotationId) return
  try {
    const map = readBankingSubmitMap()
    map[quotationId] = record
    localStorage.setItem(BANKING_SUBMIT_MAP_KEY, JSON.stringify(map))
  } catch {
    // no-op
  }
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => String(item || "").trim()).filter(Boolean)
}

export function isBankingProcessSubmitted(quotation: Quotation): boolean {
  const r = quotation as unknown as Record<string, unknown>
  if (r.bankProcessDone === true || r.bank_process_done === true || r.bankProcessDone === 1) return true
  const person = String(
    r.bankAssignedPersonName || r.bank_assigned_person_name || "",
  ).trim()
  if (person) return true
  const local = readBankingSubmitMap()[String(quotation.id || "").trim()]
  return Boolean(local?.assignedPersonName)
}

/**
 * Banking buckets for Loan / Cash+loan files from Accounts:
 * - pending_bank: first loan installment paid, remaining still due, not submitted
 * - submitted: assigned person + documents submitted; waiting for Accounts payment
 * - completed: Accounts updated payment so loan remaining is ₹0
 *
 * Hidden: 1st installment paid ₹0, and remaining ₹0 never sits in Pending/Submitted.
 */
export function getBankingLoanStage(row: DealerPaymentRow, quotation: Quotation): BankingSubTab | null {
  if (row.paymentType !== "loan" && row.paymentType !== "mix") return null

  const firstPaid = getFirstLoanInstallmentPaid(row)
  if (firstPaid <= 0) return null

  const loanRemaining = getLoanRemaining(row)
  const secondRemaining = getSecondInstallmentRemaining(row)
  if (loanRemaining <= 0) return "completed"
  if (secondRemaining <= 0) return null
  if (isBankingProcessSubmitted(quotation)) return "submitted"
  return "pending_bank"
}

export type BankingPaymentRow = DealerPaymentRow & {
  quotation: Quotation
  stage: BankingSubTab
  firstLoanPaid: number
  secondPaid: number
  secondRemaining: number
  loanRemaining: number
  assignedPersonName: string
  documentNames: string[]
}

export function buildBankingRows(quotations: Quotation[]): BankingPaymentRow[] {
  const localMap = readBankingSubmitMap()
  const rows: BankingPaymentRow[] = []
  for (const quotation of quotations) {
    if (String(quotation.status || "").toLowerCase() !== "approved") continue
    const summary = summarizeQuotationPayment(quotation)
    const stage = getBankingLoanStage(summary, quotation)
    if (!stage) continue
    const r = quotation as unknown as Record<string, unknown>
    const local = localMap[String(quotation.id || "").trim()]
    rows.push({
      ...summary,
      quotation,
      stage,
      firstLoanPaid: getFirstLoanInstallmentPaid(summary),
      secondPaid: getSecondInstallmentPaid(summary),
      secondRemaining: getSecondInstallmentRemaining(summary),
      loanRemaining: getLoanRemaining(summary),
      assignedPersonName: String(
        r.bankAssignedPersonName ||
          r.bank_assigned_person_name ||
          local?.assignedPersonName ||
          "",
      ).trim(),
      documentNames: stringList(r.bankDocumentNames || r.bank_document_names).length
        ? stringList(r.bankDocumentNames || r.bank_document_names)
        : local?.documentNames || [],
    })
  }
  return rows.sort((a, b) => {
    const aTime = new Date(a.approvedAt || a.createdAt).getTime()
    const bTime = new Date(b.approvedAt || b.createdAt).getTime()
    return (Number.isFinite(bTime) ? bTime : 0) - (Number.isFinite(aTime) ? aTime : 0)
  })
}
