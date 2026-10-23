/**
 * Admin → Quotations → All Outside: separate Office Outside records (not All quotations).
 * Source of truth is GET/POST/PATCH `/admin/office-outside` (database), not localStorage.
 * Create → assign outside vendor → Send to Accounts → Accounts list.
 * Accounts can then Send to Outside → Vendor Outside.
 * One customer (10-digit mobile) = one live Office Outside quotation.
 */

import type { Customer, ProductSelection, Quotation } from "@/lib/quotation-context"
import { formatPersonName } from "@/lib/name-display"
import { api, ApiError } from "@/lib/api"

export const OFFICE_OUTSIDE_RECORDS_STORAGE_KEY = "officeOutsideRecordsById"

/** @deprecated kept for older link cache; prefer OfficeOutsideRecord */
export const OFFICE_OUTSIDE_ACCOUNTS_STORAGE_KEY = "officeOutsideAccountsByQuotation"

export type RequirementSlipData = {
  items: string
  notes: string
  updatedAt: string
}

export type OfficeOutsideFileType = "loan" | "cash" | "mix"

export const OFFICE_OUTSIDE_FILE_TYPES: { value: OfficeOutsideFileType; label: string }[] = [
  { value: "loan", label: "Loan" },
  { value: "cash", label: "Cash" },
  { value: "mix", label: "Cash + loan" },
]

export function officeOutsideFileTypeLabel(value?: string | null): string {
  if (value === "loan") return "Loan"
  if (value === "mix") return "Cash + loan"
  if (value === "cash") return "Cash"
  return ""
}

export function normalizeOfficeOutsideFileType(value?: string | null): OfficeOutsideFileType | undefined {
  const raw = String(value || "").trim().toLowerCase()
  if (raw === "loan" || raw === "cash") return raw
  if (raw === "mix" || raw === "cash+loan" || raw === "cash + loan") return "mix"
  return undefined
}

/** Standalone Office Outside row — different dataset from dealer quotations. */
export type OfficeOutsideRecord = {
  id: string
  customerName: string
  mobile: string
  email?: string
  address?: string
  amount: number
  notes?: string
  /** Full quotation-form snapshot (same shape as dealer quotation, stored only here). */
  customer?: Customer
  products?: ProductSelection
  discount?: number
  subtotal?: number
  /** Loan / Cash / Cash + loan */
  fileType?: OfficeOutsideFileType
  loanAmount?: number
  cashAmount?: number
  /** Admin subvendor id where kind === office_outside */
  outsideVendorId: string
  outsideVendorName?: string
  /** Accounts → Vendor Outside */
  sentToOutsideAt?: string
  /** All Outside → Accounts list */
  sentToAccountsAt?: string
  requirementSlip?: RequirementSlipData
  installments?: unknown
  paymentStatus?: string
  paymentMode?: string
  createdAt: string
  updatedAt: string
}

export function formatOfficeOutsideAddress(customer?: Customer | null): string {
  if (!customer?.address) return ""
  return [
    customer.address.street,
    customer.address.city,
    customer.address.state,
    customer.address.pincode,
  ]
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join(", ")
}

/** List + 1-page quotation always show subtotal (set price), not amount after subsidy. */
export function officeOutsideSubtotalAmount(row?: OfficeOutsideRecord | null): number {
  if (!row) return 0
  const subtotal = Math.round(Number(row.subtotal) || 0)
  if (subtotal > 0) return subtotal
  const systemPrice = Math.round(Number(row.products?.systemPrice) || 0)
  if (systemPrice > 0) return systemPrice
  return Math.round(Number(row.amount) || 0)
}

/**
 * Loan / cash for Vendor Outside + Accounts.
 * Loan file → loan amount = subtotal (unless a stored loan amount is already set).
 * Cash file → cash amount = subtotal. Mix uses stored split, else loan = subtotal.
 */
export function officeOutsideLoanCashAmounts(
  row?: OfficeOutsideRecord | null,
  stored?: { loanAmount?: number; cashAmount?: number } | null,
): { loanAmount: number; cashAmount: number } {
  const subtotal = officeOutsideSubtotalAmount(row)
  const type = normalizeOfficeOutsideFileType(row?.fileType)
  const pickPositive = (...values: unknown[]) => {
    for (const value of values) {
      const n = Math.max(0, Math.round(Number(value) || 0))
      if (n > 0) return n
    }
    return 0
  }
  const productExtras = row?.products as Record<string, unknown> | undefined
  const storedLoan = pickPositive(
    stored?.loanAmount,
    row?.loanAmount,
    productExtras?.officeOutsideLoanAmount,
  )
  const storedCash = pickPositive(
    stored?.cashAmount,
    row?.cashAmount,
    productExtras?.officeOutsideCashAmount,
  )
  if (type === "loan") {
    return { loanAmount: storedLoan > 0 ? storedLoan : subtotal, cashAmount: 0 }
  }
  if (type === "cash") {
    return { loanAmount: 0, cashAmount: storedCash > 0 ? storedCash : subtotal }
  }
  if (type === "mix") {
    return reconcileMixLoanCash(subtotal, storedLoan, storedCash)
  }
  return { loanAmount: storedLoan, cashAmount: storedCash }
}

/** Cash + loan must sum to subtotal. If loan is the full amount, cash is 0. */
export function reconcileMixLoanCash(
  subtotalRaw: number,
  loanRaw: number,
  cashRaw: number,
): { loanAmount: number; cashAmount: number } {
  const cap = Math.max(0, Math.round(Number(subtotalRaw) || 0))
  let loanAmount = Math.max(0, Math.round(Number(loanRaw) || 0))
  let cashAmount = Math.max(0, Math.round(Number(cashRaw) || 0))
  if (loanAmount > cap) loanAmount = cap
  if (cashAmount > cap) cashAmount = cap
  if (loanAmount >= cap) return { loanAmount: cap, cashAmount: 0 }
  if (cashAmount >= cap && loanAmount <= 0) return { loanAmount: 0, cashAmount: cap }
  if (loanAmount > 0 && cashAmount > 0 && loanAmount + cashAmount !== cap) {
    cashAmount = Math.max(0, cap - loanAmount)
  } else if (loanAmount > 0 && cashAmount <= 0) {
    cashAmount = Math.max(0, cap - loanAmount)
  } else if (cashAmount > 0 && loanAmount <= 0) {
    loanAmount = Math.max(0, cap - cashAmount)
  } else if (loanAmount <= 0 && cashAmount <= 0) {
    loanAmount = cap
    cashAmount = 0
  }
  return { loanAmount, cashAmount }
}

/** Persist amount + loan/cash from All Outside. Loan file uses loan amount; cash uses cash = amount. */
export function officeOutsideAmountsToSave(
  row: Pick<OfficeOutsideRecord, "fileType">,
  amountRaw: number,
  loanRaw: number,
  cashRaw = 0,
): { subtotal: number; amount: number; loanAmount: number; cashAmount: number } {
  const subtotal = Math.max(0, Math.round(Number(amountRaw) || 0))
  const type = normalizeOfficeOutsideFileType(row.fileType)
  let loanAmount = Math.max(0, Math.round(Number(loanRaw) || 0))
  let cashAmount = Math.max(0, Math.round(Number(cashRaw) || 0))
  if (type === "cash") {
    loanAmount = 0
    cashAmount = cashAmount > 0 ? Math.min(cashAmount, subtotal) : subtotal
  } else if (type === "mix") {
    const mix = reconcileMixLoanCash(subtotal, loanAmount, cashAmount)
    loanAmount = mix.loanAmount
    cashAmount = mix.cashAmount
  } else {
    cashAmount = 0
    if (loanAmount <= 0) loanAmount = subtotal
  }
  return { subtotal, amount: subtotal, loanAmount, cashAmount }
}

export function customerFromOfficeOutsideRecord(row?: OfficeOutsideRecord | null): Customer | undefined {
  if (!row) return undefined
  if (row.customer?.firstName || row.customer?.mobile) {
    return {
      firstName: row.customer.firstName || "",
      lastName: row.customer.lastName || "",
      mobile: row.customer.mobile || row.mobile || "",
      email: row.customer.email || row.email || "",
      address: {
        street: row.customer.address?.street || "",
        city: row.customer.address?.city || "",
        state: row.customer.address?.state || "",
        pincode: row.customer.address?.pincode || "",
      },
      remarks: row.customer.remarks || row.notes || "",
    }
  }
  const parts = String(row.customerName || "").trim().split(/\s+/)
  const firstName = parts[0] || ""
  const lastName = parts.slice(1).join(" ")
  if (!firstName && !row.mobile) return undefined
  return {
    firstName,
    lastName,
    mobile: row.mobile || "",
    email: row.email || "",
    address: {
      street: row.address || "",
      city: "",
      state: "",
      pincode: "",
    },
    remarks: row.notes || "",
  }
}

export function snapshotFromOfficeOutsideForm(input: {
  customer: Customer
  products: ProductSelection
  discount?: number
  subtotal?: number
  totalAmount?: number
  fileType?: OfficeOutsideFileType | string
}): {
  customerName: string
  mobile: string
  email?: string
  address?: string
  notes?: string
  amount: number
  discount?: number
  subtotal?: number
  fileType?: OfficeOutsideFileType
  customer: Customer
  products: ProductSelection
} {
  const customer = input.customer
  return {
    customerName: formatPersonName(customer.firstName, customer.lastName, "Customer"),
    mobile: normalizeOfficeOutsideMobile(customer.mobile),
    email: String(customer.email || "").trim() || undefined,
    address: formatOfficeOutsideAddress(customer) || undefined,
    notes: String(customer.remarks || "").trim() || undefined,
    amount: Math.max(0, Math.round(Number(input.subtotal ?? input.totalAmount) || 0)),
    discount: Math.max(0, Math.round(Number(input.discount) || 0)),
    subtotal: Math.max(0, Math.round(Number(input.subtotal ?? input.totalAmount) || 0)),
    fileType: normalizeOfficeOutsideFileType(input.fileType),
    customer,
    products: input.products,
  }
}

/** Legacy quotation↔vendor link (optional migration). */
export type OfficeOutsideAccountsLink = {
  quotationId: string
  outsideVendorId: string
  outsideVendorName?: string
  sentToAccountsAt?: string
  requirementSlip?: RequirementSlipData
  updatedAt: string
}

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? `OO-${crypto.randomUUID().slice(0, 8).toUpperCase()}`
    : `OO-${Date.now().toString(36).toUpperCase()}`

export function normalizeOfficeOutsideMobile(value?: string | null): string {
  return String(value || "").replace(/\D/g, "").slice(-10)
}

export function clearOfficeOutsideRecordsCache() {
  if (typeof window === "undefined") return
  try {
    localStorage.removeItem(OFFICE_OUTSIDE_RECORDS_STORAGE_KEY)
  } catch {
    // no-op
  }
}

export function sortOfficeOutsideRecords(rows: OfficeOutsideRecord[]): OfficeOutsideRecord[] {
  return [...rows].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  )
}

export function findOfficeOutsideRecordByMobile(
  records: OfficeOutsideRecord[],
  mobile?: string | null,
): OfficeOutsideRecord | null {
  const key = normalizeOfficeOutsideMobile(mobile)
  if (key.length !== 10) return null
  return records.find((row) => normalizeOfficeOutsideMobile(row.mobile) === key) || null
}

export function dedupeOfficeOutsideRecordsByMobile(records: OfficeOutsideRecord[]): OfficeOutsideRecord[] {
  const byMobile = new Map<string, OfficeOutsideRecord>()
  const noMobile: OfficeOutsideRecord[] = []
  for (const row of sortOfficeOutsideRecords(records)) {
    const mobile = normalizeOfficeOutsideMobile(row.mobile)
    if (mobile.length !== 10) {
      noMobile.push(row)
      continue
    }
    if (!byMobile.has(mobile)) byMobile.set(mobile, row)
  }
  return sortOfficeOutsideRecords([...byMobile.values(), ...noMobile])
}

export function upsertOfficeOutsideRecordInList(
  records: OfficeOutsideRecord[],
  next: OfficeOutsideRecord,
): OfficeOutsideRecord[] {
  const mobile = normalizeOfficeOutsideMobile(next.mobile)
  return sortOfficeOutsideRecords([
    next,
    ...records.filter((row) => {
      if (row.id === next.id) return false
      if (mobile.length === 10 && normalizeOfficeOutsideMobile(row.mobile) === mobile) return false
      return true
    }),
  ])
}

export function removeOfficeOutsideRecordFromList(
  records: OfficeOutsideRecord[],
  id: string,
): OfficeOutsideRecord[] {
  const key = String(id || "").trim()
  return records.filter((row) => row.id !== key)
}

function readLegacyLinks(): Record<string, OfficeOutsideAccountsLink> {
  if (typeof window === "undefined") return {}
  try {
    const raw = JSON.parse(localStorage.getItem(OFFICE_OUTSIDE_ACCOUNTS_STORAGE_KEY) || "{}")
    return raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, OfficeOutsideAccountsLink>)
      : {}
  } catch {
    return {}
  }
}

function writeLegacyLinks(map: Record<string, OfficeOutsideAccountsLink>) {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(OFFICE_OUTSIDE_ACCOUNTS_STORAGE_KEY, JSON.stringify(map))
  } catch {
    // no-op
  }
}

export function readOfficeOutsideRecords(): OfficeOutsideRecord[] {
  return []
}

export function getOfficeOutsideRecord(
  id: string,
  records: OfficeOutsideRecord[] = [],
): OfficeOutsideRecord | null {
  const key = String(id || "").trim()
  if (!key) return null
  return records.find((row) => row.id === key) || null
}

export function createOfficeOutsideRecord(input: {
  customerName: string
  mobile: string
  email?: string
  address?: string
  amount?: number
  notes?: string
  customer?: Customer
  products?: ProductSelection
  discount?: number
  subtotal?: number
  fileType?: OfficeOutsideFileType | string
  outsideVendorId?: string
  outsideVendorName?: string
}): OfficeOutsideRecord {
  const id = newId()
  const now = new Date().toISOString()
  const snapshot = input.customer
    ? snapshotFromOfficeOutsideForm({
        customer: input.customer,
        products: input.products || ({} as ProductSelection),
        discount: input.discount,
        subtotal: input.subtotal,
        totalAmount: input.amount,
        fileType: input.fileType,
      })
    : null
  const row: OfficeOutsideRecord = {
    id,
    customerName: snapshot?.customerName || String(input.customerName || "").trim(),
    mobile: snapshot?.mobile || normalizeOfficeOutsideMobile(input.mobile),
    email: snapshot?.email || String(input.email || "").trim() || undefined,
    address: snapshot?.address || String(input.address || "").trim() || undefined,
    amount: snapshot?.amount ?? Math.max(0, Math.round(Number(input.amount) || 0)),
    notes: snapshot?.notes || String(input.notes || "").trim() || undefined,
    customer: snapshot?.customer || input.customer,
    products: snapshot?.products || input.products,
    discount: snapshot?.discount ?? (input.discount != null ? Math.max(0, Math.round(Number(input.discount) || 0)) : undefined),
    subtotal: snapshot?.subtotal ?? (input.subtotal != null ? Math.max(0, Math.round(Number(input.subtotal) || 0)) : undefined),
    fileType: snapshot?.fileType || normalizeOfficeOutsideFileType(input.fileType),
    outsideVendorId: String(input.outsideVendorId || "").trim(),
    outsideVendorName: input.outsideVendorName || undefined,
    createdAt: now,
    updatedAt: now,
  }
  return row
}

export function patchOfficeOutsideRecord(
  existing: OfficeOutsideRecord,
  patch: Partial<Omit<OfficeOutsideRecord, "id" | "createdAt">>,
): OfficeOutsideRecord {
  return {
    ...existing,
    ...patch,
    id: existing.id,
    createdAt: existing.createdAt,
    customerName:
      patch.customerName !== undefined
        ? String(patch.customerName).trim()
        : existing.customerName,
    mobile:
      patch.mobile !== undefined
        ? normalizeOfficeOutsideMobile(patch.mobile)
        : existing.mobile,
    amount:
      patch.amount !== undefined
        ? Math.max(0, Math.round(Number(patch.amount) || 0))
        : existing.amount,
    outsideVendorId:
      patch.outsideVendorId !== undefined
        ? String(patch.outsideVendorId).trim()
        : existing.outsideVendorId,
    fileType:
      patch.fileType !== undefined
        ? normalizeOfficeOutsideFileType(patch.fileType)
        : existing.fileType,
    updatedAt: new Date().toISOString(),
  }
}

export function updateOfficeOutsideRecord(
  existing: OfficeOutsideRecord,
  patch: Partial<Omit<OfficeOutsideRecord, "id" | "createdAt">>,
): OfficeOutsideRecord {
  return patchOfficeOutsideRecord(existing, patch)
}

export function setOutsideVendorForRecord(
  record: OfficeOutsideRecord,
  outsideVendorId: string,
  outsideVendorName?: string,
) {
  return patchOfficeOutsideRecord(record, {
    outsideVendorId,
    outsideVendorName: outsideVendorName || undefined,
  })
}

export function setOfficeOutsideFileType(
  record: OfficeOutsideRecord,
  fileType: OfficeOutsideFileType | string,
) {
  const normalized = normalizeOfficeOutsideFileType(fileType)
  if (!normalized) throw new Error("Select file type: Loan, Cash, or Cash + loan")
  return patchOfficeOutsideRecord(record, { fileType: normalized })
}

export function markOfficeOutsideSentToAccounts(record: OfficeOutsideRecord) {
  if (!record.outsideVendorId) {
    throw new Error("Select an outside vendor before sending to Accounts")
  }
  return patchOfficeOutsideRecord(record, {
    sentToAccountsAt: new Date().toISOString(),
  })
}

export function saveOfficeOutsideRequirementSlip(
  record: OfficeOutsideRecord,
  slip: { items: string; notes: string },
) {
  if (!record.outsideVendorId) {
    throw new Error("Select an outside vendor before editing the requirement slip")
  }
  return patchOfficeOutsideRecord(record, {
    requirementSlip: {
      items: String(slip.items || "").trim(),
      notes: String(slip.notes || "").trim(),
      updatedAt: new Date().toISOString(),
    },
  })
}

function parseOfficeOutsideTime(raw: unknown): string | undefined {
  if (raw == null || raw === false || raw === "") return undefined
  const direct = String(raw).trim()
  if (!direct || direct === "null" || direct === "undefined") return undefined
  return direct
}

/** Vendor Outside queue: after Accounts taps Send to Outside. */
export function isOfficeOutsideOnVendorOutside(row?: OfficeOutsideRecord | null): boolean {
  if (!row) return false
  return Boolean(row.sentToOutsideAt)
}

/** Accounts list: after All Outside taps Send to Accounts. */
export function isOfficeOutsideOnAccounts(row?: OfficeOutsideRecord | null): boolean {
  if (!row) return false
  return Boolean(row.sentToAccountsAt)
}

export function listOfficeOutsidePending(records: OfficeOutsideRecord[] = []): OfficeOutsideRecord[] {
  return records.filter((row) => !isOfficeOutsideOnAccounts(row))
}

export function listOfficeOutsideSentToOutside(records: OfficeOutsideRecord[] = []): OfficeOutsideRecord[] {
  return records.filter((row) => isOfficeOutsideOnVendorOutside(row))
}

export function listOfficeOutsideSentToAccounts(records: OfficeOutsideRecord[] = []): OfficeOutsideRecord[] {
  return records.filter((row) => isOfficeOutsideOnAccounts(row))
}

export function isOfficeOutsideRecordId(id?: string | null): boolean {
  return /^OO-/i.test(String(id || "").trim())
}

/** Synthetic quotation so Accounts can render Office Outside in the same table. */
export function quotationFromOfficeOutsideRecord(row: OfficeOutsideRecord): Quotation {
  const customer = customerFromOfficeOutsideRecord(row) || {
    firstName: String(row.customerName || "Customer").trim() || "Customer",
    lastName: "",
    mobile: row.mobile || "",
    email: row.email || "",
    address: {
      street: row.address || "",
      city: "",
      state: "",
      pincode: "",
    },
    remarks: row.notes || "",
  }
  const subtotal = officeOutsideSubtotalAmount(row)
  const loanCash = officeOutsideLoanCashAmounts(row)
  const vendorName = String(row.outsideVendorName || "").trim()
  const [vendorFirst, ...vendorRest] = vendorName.split(/\s+/).filter(Boolean)
  return {
    id: row.id,
    customer,
    products: (row.products || {}) as ProductSelection,
    discount: row.discount ?? 0,
    subtotal,
    totalAmount: subtotal,
    finalAmount: subtotal,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    dealerId: row.outsideVendorId,
    dealer: row.outsideVendorId
      ? {
          id: row.outsideVendorId,
          firstName: vendorFirst || vendorName || "Vendor",
          lastName: vendorRest.join(" "),
          email: "",
          mobile: "",
          username: "",
          role: "dealer",
        }
      : null,
    status: "approved",
    isCurrent: true,
    paymentMode: row.fileType,
    filePaymentType: row.fileType,
    loanAmount: loanCash.loanAmount > 0 ? loanCash.loanAmount : undefined,
    cashAmount: loanCash.cashAmount > 0 ? loanCash.cashAmount : undefined,
  }
}

export function deleteOfficeOutsideRecord(_id: string) {
  clearOfficeOutsideRecordsCache()
}

export function officeOutsideRecordToApiBody(row: Partial<OfficeOutsideRecord>): Record<string, unknown> {
  return {
    id: row.id,
    customerName: row.customerName,
    mobile: row.mobile,
    email: row.email || "",
    address: row.address || "",
    notes: row.notes || "",
    customer: row.customer || undefined,
    products: row.products || undefined,
    discount: row.discount ?? 0,
    subtotal: officeOutsideSubtotalAmount(row as OfficeOutsideRecord),
    amount: officeOutsideSubtotalAmount(row as OfficeOutsideRecord),
    fileType: row.fileType || undefined,
    ...(row.loanAmount != null ? { loanAmount: row.loanAmount } : {}),
    ...(row.cashAmount != null ? { cashAmount: row.cashAmount } : {}),
    outsideVendorId: row.outsideVendorId || undefined,
    outsideVendorName: row.outsideVendorName || undefined,
    sentToOutsideAt: row.sentToOutsideAt || undefined,
    sentToAccountsAt: row.sentToAccountsAt || undefined,
    requirementSlip: row.requirementSlip || undefined,
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

export function mapApiRowToOfficeOutsideRecord(raw: unknown): OfficeOutsideRecord | null {
  const row = asRecord(raw)
  if (!row) return null
  const id = String(row.id || "").trim()
  if (!id) return null
  const customer = (asRecord(row.customer) || asRecord(row.customer_json) || undefined) as
    | Customer
    | undefined
  const products = (asRecord(row.products) || asRecord(row.products_json) || undefined) as
    | ProductSelection
    | undefined
  const slip = asRecord(row.requirementSlip) || asRecord(row.requirement_slip)
  const subtotal = Math.max(
    0,
    Math.round(Number(row.subtotal ?? row.amount ?? products?.systemPrice) || 0),
  )
  return {
    id,
    customerName: String(row.customerName || row.customer_name || "").trim(),
    mobile: normalizeOfficeOutsideMobile(String(row.mobile || "")),
    email: String(row.email || "").trim() || undefined,
    address: String(row.address || "").trim() || undefined,
    notes: String(row.notes || "").trim() || undefined,
    customer,
    products,
    discount: Math.max(0, Math.round(Number(row.discount) || 0)),
    subtotal,
    amount: subtotal,
    fileType: normalizeOfficeOutsideFileType(String(row.fileType || row.file_type || "")),
    loanAmount:
      Math.max(
        0,
        Math.round(
          Number(
            row.loanAmount ??
              row.loan_amount ??
              asRecord(products)?.officeOutsideLoanAmount ??
              asRecord(products)?.loanAmount,
          ) || 0,
        ),
      ) || undefined,
    cashAmount:
      Math.max(
        0,
        Math.round(
          Number(
            row.cashAmount ??
              row.cash_amount ??
              asRecord(products)?.officeOutsideCashAmount ??
              asRecord(products)?.cashAmount,
          ) || 0,
        ),
      ) || undefined,
    outsideVendorId: String(
      row.outsideVendorId ||
        row.outside_vendor_id ||
        row.vendorId ||
        row.vendor_id ||
        asRecord(row.vendor)?.id ||
        asRecord(row.outsideVendor)?.id ||
        asRecord(row.outside_vendor)?.id ||
        "",
    ).trim(),
    outsideVendorName:
      String(
        row.outsideVendorName ||
          row.outside_vendor_name ||
          row.vendorName ||
          row.vendor_name ||
          asRecord(row.vendor)?.name ||
          asRecord(row.outsideVendor)?.name ||
          asRecord(row.outside_vendor)?.name ||
          "",
      ).trim() || undefined,
    sentToOutsideAt: (() => {
      const fromRow = parseOfficeOutsideTime(row.sentToOutsideAt ?? row.sent_to_outside_at)
      if (fromRow) return fromRow
      return parseOfficeOutsideTime(asRecord(products)?.officeOutsideSentToOutsideAt)
    })(),
    sentToAccountsAt: (() => {
      const hasAccountsKey = row.sentToAccountsAt !== undefined || row.sent_to_accounts_at !== undefined
      const fromRow = parseOfficeOutsideTime(row.sentToAccountsAt ?? row.sent_to_accounts_at)
      if (fromRow) return fromRow
      if (hasAccountsKey) return undefined
      const status = String(row.status || row.accountsStatus || row.accounts_status || "").trim().toLowerCase()
      if (status === "pending" || status === "reverted") return undefined
      return parseOfficeOutsideTime(asRecord(products)?.officeOutsideSentToAccountsAt)
    })(),
    requirementSlip: slip
      ? {
          items: String(slip.items || "").trim(),
          notes: String(slip.notes || "").trim(),
          updatedAt: String(slip.updatedAt || slip.updated_at || new Date().toISOString()),
        }
      : undefined,
    installments: Array.isArray(row.installments)
      ? row.installments
      : Array.isArray(row.installments_json)
        ? row.installments_json
        : Array.isArray(row.paymentPhases)
          ? row.paymentPhases
          : Array.isArray(row.payment_phases)
            ? row.payment_phases
            : undefined,
    paymentStatus: String(row.paymentStatus || row.payment_status || "").trim() || undefined,
    paymentMode: String(row.paymentMode || row.payment_mode || "").trim() || undefined,
    createdAt: String(row.createdAt || row.created_at || new Date().toISOString()),
    updatedAt: String(row.updatedAt || row.updated_at || new Date().toISOString()),
  }
}

export function pickOfficeOutsideListFromApi(response: unknown): OfficeOutsideRecord[] {
  const root = asRecord(response)
  if (!root) return []
  const nested = asRecord(root.data)
  const list = [nested?.records, nested?.items, root.records, root.items, root.data].find((value) =>
    Array.isArray(value),
  )
  if (!Array.isArray(list)) return []
  return list.map(mapApiRowToOfficeOutsideRecord).filter((row): row is OfficeOutsideRecord => Boolean(row))
}

export function pickOfficeOutsideRecordFromApi(response: unknown): OfficeOutsideRecord | null {
  const root = asRecord(response)
  if (!root) return null
  const nested = asRecord(root.data)
  return (
    mapApiRowToOfficeOutsideRecord(nested?.record) ||
    mapApiRowToOfficeOutsideRecord(nested) ||
    mapApiRowToOfficeOutsideRecord(root.record) ||
    mapApiRowToOfficeOutsideRecord(root)
  )
}

export function mergeOfficeOutsideRecordsFromApi(remote: OfficeOutsideRecord[]) {
  clearOfficeOutsideRecordsCache()
  return dedupeOfficeOutsideRecordsByMobile(remote)
}

export type OfficeOutsideListParams = {
  status?: "all" | "pending" | "outside" | "sent"
  search?: string
  vendorId?: string
  fileType?: "loan" | "cash" | "mix"
  mobile?: string
}

function stampOutsideProducts(
  row: OfficeOutsideRecord,
  patch: { sentToOutsideAt?: string | null; sentToAccountsAt?: string | null },
): Record<string, unknown> {
  const products = { ...((row.products || {}) as Record<string, unknown>) }
  if (patch.sentToOutsideAt !== undefined) {
    products.officeOutsideSentToOutsideAt = patch.sentToOutsideAt || null
  }
  if (patch.sentToAccountsAt !== undefined) {
    products.officeOutsideSentToAccountsAt = patch.sentToAccountsAt || null
  }
  return products
}

export async function fetchOfficeOutsideRecordsFromApi(
  params?: OfficeOutsideListParams,
): Promise<OfficeOutsideRecord[]> {
  const res = await api.admin.officeOutside.getAll(params)
  return mergeOfficeOutsideRecordsFromApi(pickOfficeOutsideListFromApi(res))
}

export async function retrieveOfficeOutsideFromAccountsApi(
  id: string,
  current?: OfficeOutsideRecord | null,
): Promise<OfficeOutsideRecord | null> {
  const key = String(id || "").trim()
  if (!key) throw new Error("Office Outside record id required")
  try {
    await api.admin.officeOutside.retrieveFromAccounts(key)
  } catch {
    // PATCH below still returns the file to All Outside pending.
  }
  const res = await api.admin.officeOutside.update(key, {
    sentToAccountsAt: null,
    sent_to_accounts_at: null,
    sentToOutsideAt: null,
    sent_to_outside_at: null,
    products: current
      ? stampOutsideProducts(current, { sentToAccountsAt: null, sentToOutsideAt: null })
      : undefined,
  })
  const remote = pickOfficeOutsideRecordFromApi(res)
  return remote
    ? { ...remote, sentToAccountsAt: undefined, sentToOutsideAt: undefined }
    : current
      ? { ...current, sentToAccountsAt: undefined, sentToOutsideAt: undefined }
      : null
}

/** Accounts → Vendor Outside. File stays on the Accounts list. */
export async function sendOfficeOutsideToOutsideApi(row: OfficeOutsideRecord): Promise<OfficeOutsideRecord> {
  const iso = new Date().toISOString()
  const accountsAt = row.sentToAccountsAt || iso
  try {
    await api.admin.officeOutside.sendToOutside(row.id)
  } catch {
    // PATCH below still marks Vendor Outside.
  }
  const res = await api.admin.officeOutside.update(row.id, {
    sentToOutsideAt: iso,
    sent_to_outside_at: iso,
    sentToAccountsAt: accountsAt,
    sent_to_accounts_at: accountsAt,
    products: stampOutsideProducts(row, { sentToOutsideAt: iso, sentToAccountsAt: accountsAt }),
  })
  const remote = pickOfficeOutsideRecordFromApi(res)
  return {
    ...(remote || row),
    sentToOutsideAt: remote?.sentToOutsideAt || iso,
    sentToAccountsAt: remote?.sentToAccountsAt || accountsAt,
  }
}

/** Undo Send to Outside. File stays on Accounts. */
export async function retrieveOfficeOutsideFromOutsideApi(
  row: OfficeOutsideRecord,
): Promise<OfficeOutsideRecord> {
  const accountsAt = row.sentToAccountsAt || new Date().toISOString()
  const res = await api.admin.officeOutside.update(row.id, {
    sentToOutsideAt: null,
    sent_to_outside_at: null,
    sentToAccountsAt: accountsAt,
    sent_to_accounts_at: accountsAt,
    products: stampOutsideProducts(row, { sentToOutsideAt: null, sentToAccountsAt: accountsAt }),
  })
  const remote = pickOfficeOutsideRecordFromApi(res)
  return {
    ...(remote || row),
    sentToOutsideAt: undefined,
    sentToAccountsAt: remote?.sentToAccountsAt || accountsAt,
  }
}

/** All Outside → Accounts list. Does not put the file on Vendor Outside. */
export async function sendOfficeOutsideToAccountsApi(row: OfficeOutsideRecord): Promise<OfficeOutsideRecord> {
  const iso = new Date().toISOString()
  const keepOutside = row.sentToOutsideAt || undefined
  try {
    await api.admin.officeOutside.sendToAccounts(row.id)
  } catch {
    // PATCH below still marks Accounts.
  }
  const loanCash = officeOutsideLoanCashAmounts(row)
  await api.admin.officeOutside.ledger
    .update(row.id, {
      proposal: officeOutsideSubtotalAmount(row),
      loanAmount: loanCash.loanAmount,
      cashAmount: loanCash.cashAmount,
    })
    .catch(() => null)
  const products = stampOutsideProducts(row, {
    sentToAccountsAt: iso,
    sentToOutsideAt: keepOutside || null,
  })
  let remote: OfficeOutsideRecord | null = null
  try {
    const res = await api.admin.officeOutside.update(row.id, {
      sentToAccountsAt: iso,
      sent_to_accounts_at: iso,
      sentToOutsideAt: keepOutside || null,
      sent_to_outside_at: keepOutside || null,
      products,
    })
    remote = pickOfficeOutsideRecordFromApi(res)
  } catch {
    const res = await api.admin.officeOutside.update(row.id, {
      sentToAccountsAt: iso,
      sent_to_accounts_at: iso,
      products,
    })
    remote = pickOfficeOutsideRecordFromApi(res)
  }
  return {
    ...(remote || row),
    sentToAccountsAt: remote?.sentToAccountsAt || iso,
    sentToOutsideAt: keepOutside,
  }
}

export async function sendOfficeOutsideToAccountsFromVendorApi(
  row: OfficeOutsideRecord,
): Promise<OfficeOutsideRecord> {
  return sendOfficeOutsideToAccountsApi(row)
}

/** Vendor Outside queue: files Accounts sent to Outside. */
export async function fetchOfficeOutsideVendorOutsideRecordsFromApi(): Promise<OfficeOutsideRecord[]> {
  const [fromOutside, fromSent, all] = await Promise.all([
    fetchOfficeOutsideRecordsFromApi({ status: "outside" }).catch(() => [] as OfficeOutsideRecord[]),
    fetchOfficeOutsideRecordsFromApi({ status: "sent" }).catch(() => [] as OfficeOutsideRecord[]),
    fetchOfficeOutsideRecordsFromApi({ status: "all" }).catch(() => [] as OfficeOutsideRecord[]),
  ])
  const byId = new Map<string, OfficeOutsideRecord>()
  for (const row of [...fromOutside, ...fromSent, ...all]) {
    if (isOfficeOutsideOnVendorOutside(row)) byId.set(row.id, row)
  }
  return sortOfficeOutsideRecords([...byId.values()])
}

/** Accounts list: after All Outside Send to Accounts. */
export async function fetchOfficeOutsideSentRecordsFromApi(): Promise<OfficeOutsideRecord[]> {
  const [fromSent, fromOutside, all] = await Promise.all([
    fetchOfficeOutsideRecordsFromApi({ status: "sent" }).catch(() => [] as OfficeOutsideRecord[]),
    fetchOfficeOutsideRecordsFromApi({ status: "outside" }).catch(() => [] as OfficeOutsideRecord[]),
    fetchOfficeOutsideRecordsFromApi({ status: "all" }).catch(() => [] as OfficeOutsideRecord[]),
  ])
  const byId = new Map<string, OfficeOutsideRecord>()
  for (const row of [...fromSent, ...fromOutside, ...all]) {
    if (isOfficeOutsideOnAccounts(row)) byId.set(row.id, row)
  }
  return sortOfficeOutsideRecords([...byId.values()])
}

export function pickOfficeOutsideDuplicateId(error: unknown): string | null {
  if (!(error instanceof ApiError)) return null
  const code = String(error.code || "").toUpperCase()
  if (code !== "OO_DUPLICATE_CUSTOMER" && code !== "HTTP_409") return null
  const fromDetails = error.details?.find((item) =>
    /existing/i.test(String(item.field || "")),
  )
  const fromDetailMessage = String(fromDetails?.message || "").match(/OO-[A-Z0-9]+/i)
  if (fromDetailMessage?.[0]) return fromDetailMessage[0]
  if (fromDetails?.field && /^OO-/i.test(String(fromDetails.message || ""))) {
    return String(fromDetails.message).trim()
  }
  const fromMessage = String(error.message || "").match(/OO-[A-Z0-9]+/i)
  return fromMessage?.[0] || null
}

export async function persistOfficeOutsideRecordToApi(input: {
  recordId?: string
  body: Record<string, unknown>
}): Promise<OfficeOutsideRecord> {
  const mobile = normalizeOfficeOutsideMobile(String(input.body.mobile || ""))
  let existing: OfficeOutsideRecord | null = null
  if (mobile.length === 10) {
    try {
      const matches = await fetchOfficeOutsideRecordsFromApi({ mobile, search: mobile })
      existing = findOfficeOutsideRecordByMobile(matches, mobile)
    } catch {
      existing = null
    }
  }
  if (existing && input.recordId && existing.id !== input.recordId) {
    throw new Error("This customer already has an Office Outside quotation. Open that row to edit.")
  }
  const targetId = input.recordId || existing?.id
  if (targetId) {
    const res = await api.admin.officeOutside.update(targetId, { ...input.body, id: targetId })
    const remote = pickOfficeOutsideRecordFromApi(res)
    if (!remote) throw new Error("Office Outside save did not return a record from the API")
    return remote
  }
  try {
    const createBody = { ...input.body }
    delete createBody.id
    const res = await api.admin.officeOutside.create(createBody)
    const remote = pickOfficeOutsideRecordFromApi(res)
    if (!remote) throw new Error("Office Outside save did not return a record from the API")
    return remote
  } catch (error) {
    const existingId = pickOfficeOutsideDuplicateId(error)
    if (existingId) {
      const res = await api.admin.officeOutside.update(existingId, input.body)
      const remote = pickOfficeOutsideRecordFromApi(res)
      if (remote) return remote
    }
    if (
      mobile.length === 10 &&
      error instanceof ApiError &&
      (error.code === "OO_DUPLICATE_CUSTOMER" || error.code === "HTTP_409")
    ) {
      const matches = await fetchOfficeOutsideRecordsFromApi({ mobile, search: mobile })
      const existing = findOfficeOutsideRecordByMobile(matches, mobile)
      if (existing) {
        const res = await api.admin.officeOutside.update(existing.id, input.body)
        const remote = pickOfficeOutsideRecordFromApi(res)
        if (remote) return remote
      }
    }
    throw error
  }
}

/* ——— Legacy quotation-link helpers (still used by older UI paths) ——— */

export function readOfficeOutsideAccountsMap(): Record<string, OfficeOutsideAccountsLink> {
  return readLegacyLinks()
}

export function getOfficeOutsideAccountsLink(quotationId: string): OfficeOutsideAccountsLink | null {
  const id = String(quotationId || "").trim()
  if (!id) return null
  return readLegacyLinks()[id] || null
}

export function upsertOfficeOutsideAccountsLink(
  quotationId: string,
  patch: Partial<Omit<OfficeOutsideAccountsLink, "quotationId" | "updatedAt">> & {
    outsideVendorId?: string
  },
): OfficeOutsideAccountsLink {
  const id = String(quotationId || "").trim()
  const prev = readLegacyLinks()
  const existing = prev[id]
  const next: OfficeOutsideAccountsLink = {
    quotationId: id,
    outsideVendorId: String(patch.outsideVendorId ?? existing?.outsideVendorId ?? "").trim(),
    outsideVendorName: patch.outsideVendorName ?? existing?.outsideVendorName,
    sentToAccountsAt: patch.sentToAccountsAt ?? existing?.sentToAccountsAt,
    requirementSlip: patch.requirementSlip ?? existing?.requirementSlip,
    updatedAt: new Date().toISOString(),
  }
  writeLegacyLinks({ ...prev, [id]: next })
  return next
}

export function setOutsideVendorForQuotation(
  quotationId: string,
  outsideVendorId: string,
  outsideVendorName?: string,
) {
  return upsertOfficeOutsideAccountsLink(quotationId, {
    outsideVendorId,
    outsideVendorName: outsideVendorName || undefined,
  })
}

export function markQuotationSentToAccounts(quotationId: string) {
  const link = getOfficeOutsideAccountsLink(quotationId)
  if (!link?.outsideVendorId) {
    throw new Error("Select an outside vendor before sending to Accounts")
  }
  return upsertOfficeOutsideAccountsLink(quotationId, {
    sentToAccountsAt: new Date().toISOString(),
  })
}

export function saveRequirementSlip(
  quotationId: string,
  slip: { items: string; notes: string },
): OfficeOutsideAccountsLink {
  const link = getOfficeOutsideAccountsLink(quotationId)
  if (!link?.outsideVendorId) {
    throw new Error("Select an outside vendor before editing the requirement slip")
  }
  return upsertOfficeOutsideAccountsLink(quotationId, {
    requirementSlip: {
      items: String(slip.items || "").trim(),
      notes: String(slip.notes || "").trim(),
      updatedAt: new Date().toISOString(),
    },
  })
}

export function listQuotationsSentToAccounts(): OfficeOutsideAccountsLink[] {
  return Object.values(readLegacyLinks()).filter((row) => Boolean(row.sentToAccountsAt && row.outsideVendorId))
}

export function listQuotationsWithOutsideVendor(): OfficeOutsideAccountsLink[] {
  return Object.values(readLegacyLinks()).filter((row) => Boolean(row.outsideVendorId))
}

export function quotationHasOutsideVendor(quotationId: string): boolean {
  return Boolean(getOfficeOutsideAccountsLink(quotationId)?.outsideVendorId)
}

export function quotationSentToAccounts(quotationId: string): boolean {
  const link = getOfficeOutsideAccountsLink(quotationId)
  return Boolean(link?.sentToAccountsAt && link?.outsideVendorId)
}

export function listLinksForOutsideVendor(outsideVendorId: string): OfficeOutsideAccountsLink[] {
  const id = String(outsideVendorId || "").trim()
  if (!id) return []
  return Object.values(readLegacyLinks()).filter((row) => row.outsideVendorId === id)
}
