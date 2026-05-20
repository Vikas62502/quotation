import type { Customer, ProductSelection } from "@/lib/quotation-context"

/** PDF-only flags — strip before catalog validation until backend ignores them (§X). */
export function stripPdfDisplayFlags(products: ProductSelection): ProductSelection {
  const {
    pdfUsePanelSizeRange: _a,
    pdfUseInverterBrandOptions: _b,
    ...rest
  } = products as ProductSelection & {
    pdf_use_panel_size_range?: boolean
    pdf_use_inverter_brand_options?: boolean
  }
  const stripped = { ...rest } as ProductSelection & Record<string, unknown>
  delete stripped.pdf_use_panel_size_range
  delete stripped.pdf_use_inverter_brand_options
  return stripped as ProductSelection
}

export function extractPdfDisplayFlags(products: ProductSelection): Partial<ProductSelection> {
  const flags: Partial<ProductSelection> = {}
  if (products.pdfUsePanelSizeRange) flags.pdfUsePanelSizeRange = true
  if (products.pdfUseInverterBrandOptions) flags.pdfUseInverterBrandOptions = true
  return flags
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

export function normalizeCustomersListResponse(response: unknown): Array<{ id: string; mobile?: string }> {
  if (Array.isArray(response)) return response as Array<{ id: string; mobile?: string }>
  const r = response as Record<string, unknown>
  if (Array.isArray(r.customers)) return r.customers as Array<{ id: string; mobile?: string }>
  const data = r.data as Record<string, unknown> | undefined
  if (data && Array.isArray(data.customers)) return data.customers as Array<{ id: string; mobile?: string }>
  return []
}
