import type { Customer, ProductSelection } from "@/lib/quotation-context"

/** PDF-only flags — strip before catalog validation until backend ignores them (§X). */
export function stripPdfDisplayFlags(products: ProductSelection): ProductSelection {
  const {
    pdfPanelRangeKey: _p,
    pdfDcrPanelRangeKey: _d,
    pdfNonDcrPanelRangeKey: _n,
    pdfUsePanelSizeRange: _a,
    pdfUseInverterBrandOptions: _b,
    ...rest
  } = products as ProductSelection & {
    pdf_panel_range_key?: string
    pdf_dcr_panel_range_key?: string
    pdf_non_dcr_panel_range_key?: string
    pdf_use_panel_size_range?: boolean
    pdf_use_inverter_brand_options?: boolean
  }
  const stripped = { ...rest } as ProductSelection & Record<string, unknown>
  delete stripped.pdf_panel_range_key
  delete stripped.pdf_dcr_panel_range_key
  delete stripped.pdf_non_dcr_panel_range_key
  delete stripped.pdf_use_panel_size_range
  delete stripped.pdf_use_inverter_brand_options
  return stripped as ProductSelection
}

export function extractPdfDisplayFlags(products: ProductSelection): Partial<ProductSelection> {
  const flags: Partial<ProductSelection> = {}
  if (products.pdfPanelRangeKey) flags.pdfPanelRangeKey = products.pdfPanelRangeKey
  if (products.pdfDcrPanelRangeKey) flags.pdfDcrPanelRangeKey = products.pdfDcrPanelRangeKey
  if (products.pdfNonDcrPanelRangeKey) flags.pdfNonDcrPanelRangeKey = products.pdfNonDcrPanelRangeKey
  if (products.pdfUsePanelSizeRange) flags.pdfUsePanelSizeRange = true
  if (products.pdfUseInverterBrandOptions) flags.pdfUseInverterBrandOptions = true
  return flags
}

export function hasPdfDisplayFlags(flags: Partial<ProductSelection>): boolean {
  return Boolean(
    flags.pdfPanelRangeKey ||
      flags.pdfDcrPanelRangeKey ||
      flags.pdfNonDcrPanelRangeKey ||
      flags.pdfUsePanelSizeRange ||
      flags.pdfUseInverterBrandOptions,
  )
}

/** Body for POST /customers — only fields the API schema documents. */
export function buildCustomerCreatePayload(customer: Customer): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    firstName: customer.firstName,
    lastName: customer.lastName,
    mobile: customer.mobile,
    address: customer.address,
  }
  if (customer.email?.trim()) {
    payload.email = customer.email.trim()
  }
  return payload
}

export function buildCustomerCreatePayloadWithNotes(customer: Customer): Record<string, unknown> {
  const payload = buildCustomerCreatePayload(customer)
  if (customer.remarks?.trim()) {
    const notes = customer.remarks.trim()
    payload.notes = notes
    payload.remarks = notes
  }
  return payload
}

export function normalizeCustomersListResponse(response: unknown): Array<{
  id: string
  mobile?: string
  dealerId?: string
  dealerName?: string
  dealers?: string[]
  dealer?: { firstName?: string; lastName?: string; username?: string }
}> {
  const pickList = (): unknown[] => {
    if (Array.isArray(response)) return response
    const r = response as Record<string, unknown>
    if (Array.isArray(r.customers)) return r.customers
    const data = r.data as Record<string, unknown> | undefined
    if (data && Array.isArray(data.customers)) return data.customers
    return []
  }

  return pickList().map((row) => {
    const c = (row || {}) as Record<string, unknown>
    const nestedDealer = c.dealer as Record<string, unknown> | undefined
    return {
      id: String(c.id || ""),
      mobile: typeof c.mobile === "string" ? c.mobile : undefined,
      dealerId: typeof c.dealerId === "string" ? c.dealerId : typeof c.dealer_id === "string" ? c.dealer_id : undefined,
      dealerName:
        typeof c.dealerName === "string"
          ? c.dealerName
          : typeof c.dealer_name === "string"
            ? c.dealer_name
            : undefined,
      dealers: Array.isArray(c.dealers) ? (c.dealers as string[]) : undefined,
      dealer: nestedDealer
        ? {
            firstName: typeof nestedDealer.firstName === "string" ? nestedDealer.firstName : undefined,
            lastName: typeof nestedDealer.lastName === "string" ? nestedDealer.lastName : undefined,
            username: typeof nestedDealer.username === "string" ? nestedDealer.username : undefined,
          }
        : undefined,
    }
  })
}

export function normalizeMobileForMatch(value: string): string {
  return String(value || "").replace(/\D/g, "")
}

export function normalizeQuotationsListResponse(response: unknown): Record<string, unknown>[] {
  if (Array.isArray(response)) return response as Record<string, unknown>[]
  const r = response as Record<string, unknown>
  if (Array.isArray(r.quotations)) return r.quotations as Record<string, unknown>[]
  const data = r.data as Record<string, unknown> | undefined
  if (data && Array.isArray(data.quotations)) return data.quotations as Record<string, unknown>[]
  return []
}

export function resolveDealerNameFromQuotationRow(row: unknown): string {
  if (!row || typeof row !== "object") return "Unknown Dealer"
  const q = row as Record<string, unknown>
  const nested = q.dealer as Record<string, unknown> | undefined
  if (nested && typeof nested === "object") {
    const fullName = `${nested.firstName || ""} ${nested.lastName || ""}`.trim()
    if (fullName) return fullName
    if (typeof nested.username === "string" && nested.username.trim()) return nested.username.trim()
  }
  for (const key of ["dealerName", "dealer_name", "assignedDealerName", "assigned_dealer_name"]) {
    const val = q[key]
    if (typeof val === "string" && val.trim()) return val.trim()
  }
  return "Unknown Dealer"
}

export function resolveDealerNameFromCustomerRow(row: unknown): string | null {
  if (!row || typeof row !== "object") return null
  const c = row as Record<string, unknown>
  if (Array.isArray(c.dealers) && c.dealers.length > 0) {
    const first = c.dealers.find((d) => typeof d === "string" && d.trim())
    if (typeof first === "string") return first.trim()
  }
  for (const key of ["dealerName", "dealer_name"]) {
    const val = c[key]
    if (typeof val === "string" && val.trim()) return val.trim()
  }
  const nested = c.dealer as Record<string, unknown> | undefined
  if (nested && typeof nested === "object") {
    const fullName = `${nested.firstName || ""} ${nested.lastName || ""}`.trim()
    if (fullName) return fullName
    if (typeof nested.username === "string" && nested.username.trim()) return nested.username.trim()
  }
  return null
}

export function findQuotationRowByMobile(list: unknown[], mobile: string): Record<string, unknown> | null {
  const target = normalizeMobileForMatch(mobile)
  if (!target) return null
  for (const row of list) {
    if (!row || typeof row !== "object") continue
    const q = row as Record<string, unknown>
    const customer = q.customer as Record<string, unknown> | undefined
    const rowMobile = normalizeMobileForMatch(
      String(q.mobile || q.customerMobile || q.customer_mobile || customer?.mobile || ""),
    )
    if (rowMobile && rowMobile === target) return q
  }
  return null
}

export function formatExistingCustomerAssignedError(dealerName: string): string {
  const label = dealerName.trim() || "Unknown Dealer"
  return `This customer already exists and is assigned to ${label}. Please update the existing quotation instead of creating a new one.`
}

export function formatDuplicateQuotationError(dealerName: string): string {
  const label = dealerName.trim() || "Unknown Dealer"
  return `A quotation already exists for this mobile number. This customer is assigned to ${label}. Please update the existing quotation instead of creating a fresh one.`
}
