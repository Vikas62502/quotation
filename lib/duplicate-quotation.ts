import { api } from "@/lib/api"
import type { Customer, Quotation, ProductSelection } from "@/lib/quotation-context"
import {
  mergeQuotationProductsForDisplay,
  productsWithPdfDisplayFlags,
  toCatalogCompatibleProducts,
} from "@/lib/quotation-api-payload"
import { isPdfCommercialSet } from "@/lib/quotation-pdf-display"
import { setCurrentQuotationForMobile } from "@/lib/quotation-current"

function pickStr(...vals: unknown[]): string {
  for (const v of vals) {
    if (v === undefined || v === null) continue
    const s = String(v).trim()
    if (s) return s
  }
  return ""
}

function customerFromQuotationRow(raw: any): Customer {
  const c =
    raw?.customer && typeof raw.customer === "object" ? raw.customer : raw || {}
  const address =
    c.address && typeof c.address === "object"
      ? c.address
      : {
          street: c.street || c.line1 || "",
          city: c.city || "",
          state: c.state || "",
          pincode: c.pincode || c.postal_code || "",
        }
  const words = pickStr(c.firstName, c.first_name, c.name).split(/\s+/).filter(Boolean)
  return {
    firstName: words[0] || pickStr(c.firstName, c.first_name) || "Customer",
    lastName: pickStr(c.lastName, c.last_name) || words.slice(1).join(" "),
    mobile: pickStr(c.mobile, c.phone).replace(/\D/g, "").slice(-10),
    email: pickStr(c.email),
    address: {
      street: pickStr(address.street, address.line1),
      city: pickStr(address.city),
      state: pickStr(address.state),
      pincode: pickStr(address.pincode, address.postal_code),
    },
    remarks: pickStr(c.remarks, c.notes) || undefined,
  }
}

/**
 * Instantly create a second quotation row for the same customer + same system.
 * Does not open the revise wizard — used by Quotations list Actions.
 */
export async function duplicateQuotationRow(source: Quotation): Promise<{ id: string }> {
  if (!source?.id) throw new Error("Quotation id is required")

  let full: any = source
  try {
    full = await api.quotations.getById(source.id)
  } catch {
    full = source
  }

  const customer = customerFromQuotationRow(full)
  if (!customer.mobile) {
    throw new Error("Customer mobile is required to duplicate this quotation")
  }

  const products: ProductSelection = mergeQuotationProductsForDisplay(full)
  if (!products.systemType) {
    throw new Error("System configuration is missing on this quotation")
  }

  const pricing = full?.pricing && typeof full.pricing === "object" ? full.pricing : {}
  const subtotal = Number(
    pricing.subtotal ?? full.subtotal ?? products.systemPrice ?? full.totalAmount ?? 0,
  )
  if (!(subtotal > 0)) {
    throw new Error("Quotation amount is missing — cannot duplicate")
  }

  const isCommercialSet = isPdfCommercialSet(products)
  const centralSubsidy = isCommercialSet
    ? 0
    : Number(pricing.centralSubsidy ?? products.centralSubsidy ?? full.centralSubsidy ?? 0)
  const stateSubsidy = isCommercialSet
    ? 0
    : Number(pricing.stateSubsidy ?? products.stateSubsidy ?? full.stateSubsidy ?? 0)
  const totalSubsidy = centralSubsidy + stateSubsidy
  const amountAfterSubsidy = subtotal - totalSubsidy
  const discountAmount = Number(pricing.discountAmount ?? full.discount ?? 0)
  const finalAmount = Math.max(
    0,
    Number(pricing.finalAmount ?? full.finalAmount ?? amountAfterSubsidy - discountAmount),
  )
  const totalAmount = Math.max(
    0,
    Number(pricing.totalAmount ?? full.totalAmount ?? finalAmount),
  )

  const customerId = pickStr(
    full.customerId,
    full.customer_id,
    full.customer?.id,
    (source as any).customerId,
  )

  const productsForApi = productsWithPdfDisplayFlags(toCatalogCompatibleProducts(products))

  const body: Record<string, unknown> = {
    ...(customerId ? { customerId } : {}),
    customer,
    products: {
      ...productsForApi,
      systemPrice: subtotal,
      centralSubsidy,
      stateSubsidy,
    },
    subtotal,
    totalAmount,
    finalAmount,
    centralSubsidy,
    stateSubsidy,
    totalSubsidy,
    amountAfterSubsidy,
    discountAmount,
    allowAdditionalQuotation: true,
    allow_additional_quotation: true,
    allowDuplicateMobile: true,
    isCurrent: true,
    is_current: true,
    setAsCurrent: true,
    sourceQuotationId: source.id,
    source_quotation_id: source.id,
    previousQuotationId: source.id,
    previous_quotation_id: source.id,
    notes: `Duplicate of ${source.id}`,
    ...(isCommercialSet
      ? { pdfCommercialSet: true, pdf_commercial_set: true, isCommercial: true }
      : {}),
  }

  const created = await api.quotations.create(body)
  const newId = String(created?.id || created?.quotationId || "").trim()
  if (!newId) throw new Error("Duplicate created but no quotation id returned")

  try {
    await api.quotations.updateProducts(newId, productsForApi)
  } catch {
    // non-fatal — create may have already stored products
  }

  setCurrentQuotationForMobile(customer.mobile, newId)
  return { id: newId }
}
