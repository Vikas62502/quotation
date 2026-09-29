import type { Quotation } from "@/lib/quotation-context"

export const ADMIN_SUBVENDOR_LEDGER_KEY = "adminSubvendorLedger"
const ACCOUNT_SITE_COST_KEY = "quotationSiteCosts"

export const LEDGER_AMOUNT_FIELDS = [
  "loanAmount",
  "cashAmount",
  "receivedAmount",
  "remaining",
  "proposal",
  "costOfSite",
  "fileCharges",
  "pi",
  "gstCharges",
  "others",
] as const

export type LedgerAmountField = (typeof LEDGER_AMOUNT_FIELDS)[number]

export type SubvendorLedgerAmounts = Partial<Record<LedgerAmountField, number>>

/** @deprecated use SubvendorLedgerAmounts */
export type SubvendorLedgerCharges = SubvendorLedgerAmounts

function asAmount(value: unknown) {
  const n = Math.round(Number(value) || 0)
  return Number.isFinite(n) && n >= 0 ? n : 0
}

function pickStoredAmount(row: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(row, key)) continue
    if (row[key] === undefined || row[key] === null || row[key] === "") continue
    return asAmount(row[key])
  }
  return undefined
}

export function parseLedgerAmounts(raw: unknown): SubvendorLedgerAmounts {
  const row = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {}
  const next: SubvendorLedgerAmounts = {}
  const loanAmount = pickStoredAmount(row, ["loanAmount", "loan_amount"])
  const cashAmount = pickStoredAmount(row, ["cashAmount", "cash_amount"])
  const receivedAmount = pickStoredAmount(row, ["receivedAmount", "received_amount", "paidAmount"])
  const remaining = pickStoredAmount(row, ["remaining", "remainingAmount"])
  const proposal = pickStoredAmount(row, ["proposal", "proposalAmount"])
  const costOfSite = pickStoredAmount(row, ["costOfSite", "cost_of_site", "siteCost"])
  const fileCharges = pickStoredAmount(row, ["fileCharges", "file_charges"])
  const pi = pickStoredAmount(row, ["pi", "piCharges", "pi_charges"])
  const gstCharges = pickStoredAmount(row, ["gstCharges", "gst_charges", "gst"])
  const others = pickStoredAmount(row, ["others", "otherCharges", "other_charges"])
  if (loanAmount != null) next.loanAmount = loanAmount
  if (cashAmount != null) next.cashAmount = cashAmount
  if (receivedAmount != null) next.receivedAmount = receivedAmount
  if (remaining != null) next.remaining = remaining
  if (proposal != null) next.proposal = proposal
  if (costOfSite != null) next.costOfSite = costOfSite
  if (fileCharges != null) next.fileCharges = fileCharges
  if (pi != null) next.pi = pi
  if (gstCharges != null) next.gstCharges = gstCharges
  if (others != null) next.others = others
  return next
}

export function readSubvendorLedger(): Record<string, SubvendorLedgerAmounts> {
  if (typeof window === "undefined") return {}
  try {
    const raw = JSON.parse(localStorage.getItem(ADMIN_SUBVENDOR_LEDGER_KEY) || "{}")
    if (!raw || typeof raw !== "object") return {}
    const out: Record<string, SubvendorLedgerAmounts> = {}
    for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
      if (!id) continue
      out[id] = parseLedgerAmounts(value)
    }
    return out
  } catch {
    return {}
  }
}

export function writeSubvendorLedger(map: Record<string, SubvendorLedgerAmounts>) {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(ADMIN_SUBVENDOR_LEDGER_KEY, JSON.stringify(map))
  } catch {
    // no-op
  }
}

export function getLedgerAmounts(
  map: Record<string, SubvendorLedgerAmounts>,
  quotationId: string,
): SubvendorLedgerAmounts {
  return map[quotationId] ? { ...map[quotationId] } : {}
}

export function getLedgerCharges(
  map: Record<string, SubvendorLedgerAmounts>,
  quotationId: string,
): SubvendorLedgerAmounts {
  return getLedgerAmounts(map, quotationId)
}

export function upsertLedgerAmounts(
  quotationId: string,
  patch: SubvendorLedgerAmounts,
): Record<string, SubvendorLedgerAmounts> {
  const map = readSubvendorLedger()
  if (!quotationId) return map
  const next = { ...getLedgerAmounts(map, quotationId), ...patch }
  map[quotationId] = next
  writeSubvendorLedger(map)
  return map
}

export function upsertLedgerCharges(
  quotationId: string,
  patch: SubvendorLedgerAmounts,
): Record<string, SubvendorLedgerAmounts> {
  return upsertLedgerAmounts(quotationId, patch)
}

function pickFinite(...vals: unknown[]) {
  for (const v of vals) {
    if (v === undefined || v === null || v === "") continue
    const n = Number(v)
    if (Number.isFinite(n) && n >= 0) return Math.round(n)
  }
  return 0
}

export function readAccountSiteCostMap(): Record<string, number> {
  if (typeof window === "undefined") return {}
  try {
    const raw = JSON.parse(localStorage.getItem(ACCOUNT_SITE_COST_KEY) || "{}")
    if (!raw || typeof raw !== "object") return {}
    const out: Record<string, number> = {}
    for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
      const n = asAmount(value)
      if (id && n > 0) out[id] = n
    }
    return out
  } catch {
    return {}
  }
}

export function pickSiteCostFromQuotation(
  quotation: Quotation,
  storedMap?: Record<string, number>,
): number {
  const q = quotation as Quotation & Record<string, unknown>
  const pricing = (q.pricing || {}) as Record<string, unknown>
  const paymentDetails = (q.paymentDetails || q.payment_details || {}) as Record<string, unknown>
  const fromQuotation = pickFinite(
    q.siteCost,
    q.site_cost,
    q.costOfSite,
    q.cost_of_site,
    pricing.siteCost,
    pricing.site_cost,
    paymentDetails.siteCost,
    paymentDetails.site_cost,
  )
  if (fromQuotation > 0) return fromQuotation
  return storedMap?.[quotation.id] || readAccountSiteCostMap()[quotation.id] || 0
}

export function isApprovedQuotation(quotation: { status?: string | null }) {
  return String(quotation.status || "").toLowerCase() === "approved"
}

export type LedgerPaymentType = "loan" | "cash" | "mix" | "unknown"

export function quotationPaymentTypeForLedger(quotation: Quotation): LedgerPaymentType {
  const r = quotation as Quotation & Record<string, unknown>
  const approved = String(r.paymentType || r.payment_type || r.paymentMode || r.payment_mode || "")
    .trim()
    .toLowerCase()
  if (approved === "loan" || approved === "cash" || approved === "mix") return approved
  const file = String(r.filePaymentType || r.file_payment_type || "")
    .trim()
    .toLowerCase()
  if (file === "loan" || file === "cash" || file === "mix") return file
  if (file === "both" || file === "cash_loan" || file === "cash+loan" || file === "cash + loan") return "mix"
  if (approved === "both" || approved === "cash_loan") return "mix"
  return "unknown"
}

export function paymentTypeLabelForLedger(type: LedgerPaymentType) {
  if (type === "loan") return "Loan"
  if (type === "cash") return "Cash"
  if (type === "mix") return "Cash + loan"
  return "—"
}

/** Loan / cash from the customer file by payment type. Full loan → cash 0. Full cash → loan 0. Mix → both. */
export function quotationLoanCashAmountsForLedger(
  quotation: Quotation,
  proposalAmount: number,
): { loanAmount: number; cashAmount: number } {
  const type = quotationPaymentTypeForLedger(quotation)
  const r = quotation as Quotation & Record<string, unknown>
  const proposal = Math.max(0, Math.round(proposalAmount || 0))
  const loanRaw = Math.max(0, Math.round(Number(r.loanAmount ?? r.loan_amount) || 0))
  const cashRaw = Math.max(0, Math.round(Number(r.cashAmount ?? r.cash_amount) || 0))

  if (type === "loan") {
    return { loanAmount: loanRaw > 0 ? loanRaw : proposal, cashAmount: 0 }
  }
  if (type === "cash") {
    return { loanAmount: 0, cashAmount: cashRaw > 0 ? cashRaw : proposal }
  }
  if (type === "mix") {
    let loanAmount = loanRaw
    let cashAmount = cashRaw
    if (loanAmount <= 0 && cashAmount > 0 && cashAmount < proposal) loanAmount = Math.max(0, proposal - cashAmount)
    if (cashAmount <= 0 && loanAmount > 0 && loanAmount < proposal) cashAmount = Math.max(0, proposal - loanAmount)
    return { loanAmount, cashAmount }
  }
  return { loanAmount: loanRaw, cashAmount: cashRaw }
}

export function quotationLoanAmountForLedger(quotation: Quotation, proposalAmount: number): number {
  return quotationLoanCashAmountsForLedger(quotation, proposalAmount).loanAmount
}

export function pickLedgerMapFromApi(response: unknown): Record<string, SubvendorLedgerAmounts> {
  if (!response || typeof response !== "object") return {}
  const root = response as Record<string, unknown>
  const nested =
    root.data && typeof root.data === "object" && !Array.isArray(root.data)
      ? (root.data as Record<string, unknown>)
      : null
  const list = [nested?.items, nested?.ledger, root.items, root.ledger].find((value) => Array.isArray(value))
  const out: Record<string, SubvendorLedgerAmounts> = {}
  if (Array.isArray(list)) {
    for (const row of list) {
      if (!row || typeof row !== "object") continue
      const rec = row as Record<string, unknown>
      const id = String(rec.quotationId || rec.quotation_id || rec.id || "").trim()
      if (!id) continue
      out[id] = parseLedgerAmounts(rec)
    }
    return out
  }
  const mapCandidate = nested && !Array.isArray(nested) ? nested : root
  for (const [id, value] of Object.entries(mapCandidate)) {
    if (!id || id === "success" || id === "data" || id === "items" || id === "ledger") continue
    if (!value || typeof value !== "object") continue
    out[id] = parseLedgerAmounts(value)
  }
  return out
}

export function ledgerPatchToApiBody(patch: SubvendorLedgerAmounts): Record<string, number> {
  const body: Record<string, number> = {}
  if (patch.loanAmount != null) {
    body.loanAmount = patch.loanAmount
    body.loan_amount = patch.loanAmount
  }
  if (patch.cashAmount != null) {
    body.cashAmount = patch.cashAmount
    body.cash_amount = patch.cashAmount
  }
  if (patch.receivedAmount != null) {
    body.receivedAmount = patch.receivedAmount
    body.received_amount = patch.receivedAmount
  }
  if (patch.remaining != null) body.remaining = patch.remaining
  if (patch.proposal != null) body.proposal = patch.proposal
  if (patch.costOfSite != null) {
    body.costOfSite = patch.costOfSite
    body.cost_of_site = patch.costOfSite
  }
  if (patch.fileCharges != null) {
    body.fileCharges = patch.fileCharges
    body.file_charges = patch.fileCharges
  }
  if (patch.pi != null) body.pi = patch.pi
  if (patch.gstCharges != null) {
    body.gstCharges = patch.gstCharges
    body.gst_charges = patch.gstCharges
  }
  if (patch.others != null) body.others = patch.others
  return body
}
