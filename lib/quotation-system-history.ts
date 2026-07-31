import type { ProductSelection } from "@/lib/quotation-context"
import { mergeQuotationProductsForDisplay } from "@/lib/quotation-api-payload"
import { mapApiRecordToCustomer } from "@/lib/quotation-prefill"

export type QuotationSystemPricingSnapshot = {
  subtotal: number
  stateSubsidy: number
  centralSubsidy: number
  discountAmount: number
  totalAmount: number
  finalAmount: number
  pdfCommercialSet?: boolean
}

export type QuotationSystemSnapshot = {
  products: ProductSelection
  pricing: QuotationSystemPricingSnapshot
  label: string
  savedAt: string
}

const STORAGE_PREFIX = "quotation-system-history:"
const MAX_ENTRIES = 10

function storageKey(quotationId: string): string {
  return `${STORAGE_PREFIX}${quotationId}`
}

function readStack(quotationId: string): QuotationSystemSnapshot[] {
  if (typeof window === "undefined" || !quotationId) return []
  try {
    const raw = localStorage.getItem(storageKey(quotationId))
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as QuotationSystemSnapshot[]) : []
  } catch {
    return []
  }
}

function writeStack(quotationId: string, stack: QuotationSystemSnapshot[]) {
  if (typeof window === "undefined" || !quotationId) return
  localStorage.setItem(storageKey(quotationId), JSON.stringify(stack.slice(-MAX_ENTRIES)))
}

export function systemSnapshotLabel(products: ProductSelection | null | undefined): string {
  if (!products) return "Previous system"
  const brand =
    products.panelBrand ||
    products.dcrPanelBrand ||
    products.nonDcrPanelBrand ||
    products.panelType ||
    ""
  const type = products.systemType ? String(products.systemType).toUpperCase() : ""
  const parts = [brand, type].filter(Boolean)
  return parts.length > 0 ? parts.join(" · ") : "Previous system"
}

export function buildSystemSnapshotFromQuotation(raw: unknown): QuotationSystemSnapshot {
  const row = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>
  const products = mergeQuotationProductsForDisplay(raw)
  const pricingObj =
    row.pricing && typeof row.pricing === "object"
      ? (row.pricing as Record<string, unknown>)
      : {}

  const subtotal = Number(
    pricingObj.subtotal ?? row.subtotal ?? row.totalAmount ?? products.systemPrice ?? 0,
  )
  const stateSubsidy = Number(
    pricingObj.stateSubsidy ?? products.stateSubsidy ?? row.stateSubsidy ?? 0,
  )
  const centralSubsidy = Number(
    pricingObj.centralSubsidy ?? products.centralSubsidy ?? row.centralSubsidy ?? 0,
  )
  const discountAmount = Number(
    pricingObj.discountAmount ?? row.discount ?? 0,
  )
  const totalAmount = Number(
    pricingObj.totalAmount ?? row.totalAmount ?? Math.max(0, subtotal - stateSubsidy - centralSubsidy - discountAmount),
  )
  const finalAmount = Number(pricingObj.finalAmount ?? row.finalAmount ?? totalAmount)

  return {
    products,
    pricing: {
      subtotal: Number.isFinite(subtotal) ? subtotal : 0,
      stateSubsidy: Number.isFinite(stateSubsidy) ? stateSubsidy : 0,
      centralSubsidy: Number.isFinite(centralSubsidy) ? centralSubsidy : 0,
      discountAmount: Number.isFinite(discountAmount) ? discountAmount : 0,
      totalAmount: Number.isFinite(totalAmount) ? totalAmount : 0,
      finalAmount: Number.isFinite(finalAmount) ? finalAmount : 0,
      pdfCommercialSet: Boolean(products.pdfCommercialSet),
    },
    label: systemSnapshotLabel(products),
    savedAt: new Date().toISOString(),
  }
}

/** Push current system before overwriting (Adani → Waaree keeps Adani for revert). */
export function pushSystemHistory(quotationId: string, snapshot: QuotationSystemSnapshot) {
  if (!quotationId || !snapshot?.products) return
  const stack = readStack(quotationId)
  stack.push(snapshot)
  writeStack(quotationId, stack)
}

export function peekSystemHistory(quotationId: string): QuotationSystemSnapshot | null {
  const stack = readStack(quotationId)
  return stack.length > 0 ? stack[stack.length - 1]! : null
}

export function hasSystemHistory(quotationId: string): boolean {
  return readStack(quotationId).length > 0
}

/**
 * Revert to previous system and store the current one so user can switch again
 * (Adani → Waaree → revert Adani → revert Waaree).
 */
export function swapSystemHistory(
  quotationId: string,
  currentSnapshot: QuotationSystemSnapshot,
): QuotationSystemSnapshot | null {
  const stack = readStack(quotationId)
  const previous = stack.pop()
  if (!previous) return null
  stack.push(currentSnapshot)
  writeStack(quotationId, stack)
  return previous
}

/** Build /dashboard/new-quotation URL for revise-from-list. */
export function buildReviseQuotationHref(quotation: { id: string } & Record<string, any>): string {
  const mapped = mapApiRecordToCustomer(quotation)
  const c = (mapped || quotation.customer || {}) as {
    firstName?: string
    lastName?: string
    mobile?: string
    email?: string
    address?: { street?: string; city?: string; state?: string; pincode?: string }
    remarks?: string
  }
  const name = mapped
    ? [mapped.firstName, mapped.lastName].filter(Boolean).join(" ").trim()
    : [c.firstName, c.lastName].filter(Boolean).join(" ").trim()
  const mobile = mapped?.mobile || (c.mobile ? String(c.mobile).replace(/\D/g, "").slice(-10) : "")
  const email = mapped?.email || c.email || ""
  const street = mapped?.address?.street || c.address?.street || ""
  const city = mapped?.address?.city || c.address?.city || ""
  const state = mapped?.address?.state || c.address?.state || ""
  const pincode = mapped?.address?.pincode || c.address?.pincode || ""
  const remarks = mapped?.remarks || c.remarks || ""

  const params = new URLSearchParams()
  params.set("reviseQuotationId", quotation.id)
  params.set("lockCustomer", "1")
  if (name) params.set("prefillName", name)
  if (mobile) params.set("prefillMobile", mobile)
  if (email) params.set("prefillEmail", email)
  if (street) params.set("prefillAddress", street)
  if (city) params.set("prefillCity", city)
  if (state) params.set("prefillState", state)
  if (pincode) params.set("prefillPincode", pincode)
  if (remarks) params.set("prefillRemarks", remarks)
  return `/dashboard/new-quotation?${params.toString()}`
}
