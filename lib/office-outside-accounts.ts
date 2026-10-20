/**
 * Admin → Quotations → All Outside: separate Office Outside records (not All quotations).
 * Create → assign outside vendor → Send to Accounts → Accounts Office Outside ledger.
 */

import type { Customer, ProductSelection, Quotation } from "@/lib/quotation-context"
import { formatPersonName } from "@/lib/name-display"

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
  /** Admin subvendor id where kind === office_outside */
  outsideVendorId: string
  outsideVendorName?: string
  sentToAccountsAt?: string
  requirementSlip?: RequirementSlipData
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
    mobile: String(customer.mobile || "").replace(/\D/g, "").slice(-10),
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

function readRecords(): Record<string, OfficeOutsideRecord> {
  if (typeof window === "undefined") return {}
  try {
    const raw = JSON.parse(localStorage.getItem(OFFICE_OUTSIDE_RECORDS_STORAGE_KEY) || "{}")
    return raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, OfficeOutsideRecord>)
      : {}
  } catch {
    return {}
  }
}

function writeRecords(map: Record<string, OfficeOutsideRecord>) {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(OFFICE_OUTSIDE_RECORDS_STORAGE_KEY, JSON.stringify(map))
  } catch {
    // no-op
  }
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
  return Object.values(readRecords()).sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  )
}

export function getOfficeOutsideRecord(id: string): OfficeOutsideRecord | null {
  const key = String(id || "").trim()
  if (!key) return null
  return readRecords()[key] || null
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
    mobile: snapshot?.mobile || String(input.mobile || "").replace(/\D/g, "").slice(-10),
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
  const prev = readRecords()
  writeRecords({ ...prev, [id]: row })
  return row
}

export function updateOfficeOutsideRecord(
  id: string,
  patch: Partial<Omit<OfficeOutsideRecord, "id" | "createdAt">>,
): OfficeOutsideRecord {
  const prev = readRecords()
  const existing = prev[id]
  if (!existing) throw new Error("Office Outside record not found")
  const next: OfficeOutsideRecord = {
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
        ? String(patch.mobile).replace(/\D/g, "").slice(-10)
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
  writeRecords({ ...prev, [id]: next })
  return next
}

export function setOutsideVendorForRecord(
  recordId: string,
  outsideVendorId: string,
  outsideVendorName?: string,
) {
  return updateOfficeOutsideRecord(recordId, {
    outsideVendorId,
    outsideVendorName: outsideVendorName || undefined,
  })
}

export function setOfficeOutsideFileType(
  recordId: string,
  fileType: OfficeOutsideFileType | string,
) {
  const normalized = normalizeOfficeOutsideFileType(fileType)
  if (!normalized) throw new Error("Select file type: Loan, Cash, or Cash + loan")
  return updateOfficeOutsideRecord(recordId, { fileType: normalized })
}

export function markOfficeOutsideSentToAccounts(recordId: string) {
  const row = getOfficeOutsideRecord(recordId)
  if (!row?.outsideVendorId) {
    throw new Error("Select an outside vendor before sending to Accounts")
  }
  return updateOfficeOutsideRecord(recordId, {
    sentToAccountsAt: new Date().toISOString(),
  })
}

export function saveOfficeOutsideRequirementSlip(
  recordId: string,
  slip: { items: string; notes: string },
) {
  const row = getOfficeOutsideRecord(recordId)
  if (!row?.outsideVendorId) {
    throw new Error("Select an outside vendor before editing the requirement slip")
  }
  return updateOfficeOutsideRecord(recordId, {
    requirementSlip: {
      items: String(slip.items || "").trim(),
      notes: String(slip.notes || "").trim(),
      updatedAt: new Date().toISOString(),
    },
  })
}

export function listOfficeOutsidePending(): OfficeOutsideRecord[] {
  return readOfficeOutsideRecords().filter((row) => !row.sentToAccountsAt)
}

export function listOfficeOutsideSentToAccounts(): OfficeOutsideRecord[] {
  return readOfficeOutsideRecords().filter((row) => Boolean(row.sentToAccountsAt && row.outsideVendorId))
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
  }
}

export function deleteOfficeOutsideRecord(id: string) {
  const prev = readRecords()
  if (!prev[id]) return
  const next = { ...prev }
  delete next[id]
  writeRecords(next)
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
    outsideVendorId: row.outsideVendorId || undefined,
    outsideVendorName: row.outsideVendorName || undefined,
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
    mobile: String(row.mobile || "").replace(/\D/g, "").slice(-10),
    email: String(row.email || "").trim() || undefined,
    address: String(row.address || "").trim() || undefined,
    notes: String(row.notes || "").trim() || undefined,
    customer,
    products,
    discount: Math.max(0, Math.round(Number(row.discount) || 0)),
    subtotal,
    amount: subtotal,
    fileType: normalizeOfficeOutsideFileType(String(row.fileType || row.file_type || "")),
    outsideVendorId: String(row.outsideVendorId || row.outside_vendor_id || "").trim(),
    outsideVendorName: String(row.outsideVendorName || row.outside_vendor_name || "").trim() || undefined,
    sentToAccountsAt: String(row.sentToAccountsAt || row.sent_to_accounts_at || "").trim() || undefined,
    requirementSlip: slip
      ? {
          items: String(slip.items || "").trim(),
          notes: String(slip.notes || "").trim(),
          updatedAt: String(slip.updatedAt || slip.updated_at || new Date().toISOString()),
        }
      : undefined,
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
  if (!remote.length) return readOfficeOutsideRecords()
  const prev = readRecords()
  const next: Record<string, OfficeOutsideRecord> = { ...prev }
  for (const row of remote) next[row.id] = { ...prev[row.id], ...row }
  writeRecords(next)
  return readOfficeOutsideRecords()
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
