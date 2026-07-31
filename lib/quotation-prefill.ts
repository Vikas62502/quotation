import type { Customer } from "@/lib/quotation-context"

function pickStr(...vals: unknown[]): string {
  for (const v of vals) {
    if (v === undefined || v === null) continue
    const s = String(v).trim()
    if (s) return s
  }
  return ""
}

export type CustomerAddressParts = {
  street: string
  city: string
  state: string
  pincode: string
}

/** Pull street/city/state/pincode from many API / list shapes. */
export function extractAddressFromRecord(
  source: Record<string, unknown> | null | undefined,
): CustomerAddressParts {
  if (!source) return { street: "", city: "", state: "", pincode: "" }

  const nested =
    (source.address && typeof source.address === "object"
      ? (source.address as Record<string, unknown>)
      : null) ||
    (source.billingAddress && typeof source.billingAddress === "object"
      ? (source.billingAddress as Record<string, unknown>)
      : null) ||
    (source.billing_address && typeof source.billing_address === "object"
      ? (source.billing_address as Record<string, unknown>)
      : null) ||
    (source.customerAddress && typeof source.customerAddress === "object"
      ? (source.customerAddress as Record<string, unknown>)
      : null) ||
    (source.customer_address && typeof source.customer_address === "object"
      ? (source.customer_address as Record<string, unknown>)
      : null)

  const stringAddress = pickStr(
    typeof source.address === "string" ? source.address : "",
    source.customerAddress,
    source.customer_address,
    source.streetAddress,
    source.street_address,
    source.fullAddress,
    source.full_address,
    source.visitLocation,
    source.visit_location,
    source.location,
  )

  const street = pickStr(
    nested?.street,
    nested?.line1,
    nested?.line_1,
    nested?.addressLine1,
    nested?.address_line1,
    nested?.address_line_1,
    source.street,
    source.line1,
    source.line_1,
    source.addressLine1,
    source.address_line1,
    source.streetAddress,
    source.street_address,
    stringAddress,
  )
  const city = pickStr(nested?.city, source.city, source.customerCity, source.customer_city)
  const state = pickStr(nested?.state, source.state, source.customerState, source.customer_state)
  const pincode = pickStr(
    nested?.pincode,
    nested?.postal_code,
    nested?.zip,
    source.pincode,
    source.postal_code,
    source.zip,
    source.customerPincode,
    source.customer_pincode,
  )

  return { street, city, state, pincode }
}

/**
 * Map quotation detail / customer API payload into Customer form shape.
 * Accepts either a quotation (with nested customer) or a customer row.
 */
export function mapApiRecordToCustomer(raw: unknown): Customer | null {
  if (!raw || typeof raw !== "object") return null
  const root = raw as Record<string, unknown>
  const c =
    root.customer && typeof root.customer === "object"
      ? (root.customer as Record<string, unknown>)
      : root

  const nameBlob = pickStr(c.firstName, c.first_name, c.name, root.customerName, root.customer_name)
  const words = nameBlob.split(/\s+/).filter(Boolean)
  const firstName = pickStr(c.firstName, c.first_name) || words[0] || ""
  const lastName =
    pickStr(c.lastName, c.last_name) || (words.length > 1 ? words.slice(1).join(" ") : "")
  const mobile = pickStr(
    c.mobile,
    c.phone,
    c.phoneNumber,
    c.phone_number,
    root.mobile,
    root.customerMobile,
    root.customer_mobile,
  )
    .replace(/\D/g, "")
    .slice(-10)

  if (!firstName && !mobile) return null

  const fromCustomer = extractAddressFromRecord(c)
  const fromRoot = extractAddressFromRecord(root)
  const address: CustomerAddressParts = {
    street: fromCustomer.street || fromRoot.street,
    city: fromCustomer.city || fromRoot.city,
    state: fromCustomer.state || fromRoot.state,
    pincode: fromCustomer.pincode || fromRoot.pincode,
  }

  return {
    firstName: firstName || "Customer",
    lastName,
    mobile,
    email: pickStr(c.email, root.email, root.customerEmail, root.customer_email),
    address,
    remarks: pickStr(c.remarks, c.notes, root.remarks) || undefined,
  }
}

export function customerHasAnyAddress(customer: Customer | null | undefined): boolean {
  if (!customer?.address) return false
  const { street, city, state, pincode } = customer.address
  return Boolean(
    String(street || "").trim() ||
      String(city || "").trim() ||
      String(state || "").trim() ||
      String(pincode || "").trim(),
  )
}

/** Build customer from Calling Data / URL prefill query params. */
export function customerFromPrefillSearchParams(params: URLSearchParams): Customer | null {
  const prefillName = params.get("prefillName") || ""
  const prefillMobile = (params.get("prefillMobile") || "").replace(/\D/g, "").slice(-10)
  const prefillAddress = params.get("prefillAddress") || ""
  const prefillCity = params.get("prefillCity") || ""
  const prefillState = params.get("prefillState") || ""
  const prefillPincode = params.get("prefillPincode") || ""
  const prefillEmail = params.get("prefillEmail") || ""
  const prefillRemarks =
    params.get("prefillRemarks") ||
    [params.get("prefillCustomerNote"), params.get("prefillCallRemark")].filter(Boolean).join("\n\n")

  if (
    !prefillName &&
    !prefillMobile &&
    !prefillAddress &&
    !prefillCity &&
    !prefillState &&
    !prefillPincode &&
    !prefillRemarks
  ) {
    return null
  }

  const words = prefillName.trim().split(/\s+/).filter(Boolean)
  const firstName = words[0] || ""
  const lastName = words.slice(1).join(" ") || "Customer"

  return {
    firstName,
    lastName,
    mobile: prefillMobile,
    email: prefillEmail,
    address: {
      street: prefillAddress,
      city: prefillCity,
      state: prefillState,
      pincode: prefillPincode,
    },
    remarks: prefillRemarks.trim() || undefined,
  }
}

export function prefillSignatureFromSearchParams(params: URLSearchParams): string {
  return [
    params.get("prefillName") || "",
    params.get("prefillMobile") || "",
    params.get("prefillAddress") || "",
    params.get("prefillCity") || "",
    params.get("prefillState") || "",
    params.get("prefillPincode") || "",
    params.get("prefillEmail") || "",
    params.get("prefillRemarks") ||
      [params.get("prefillCustomerNote"), params.get("prefillCallRemark")].filter(Boolean).join("\n\n"),
  ].join("|")
}

/** Prefer non-empty address / contact fields from `rich` over `base`. */
export function mergeCustomerPreferringComplete(
  base: Customer | null | undefined,
  rich: Customer | null | undefined,
): Customer | null {
  if (!base && !rich) return null
  if (!base) return rich || null
  if (!rich) return base
  const pick = (a?: string, b?: string) => {
    const x = String(a || "").trim()
    const y = String(b || "").trim()
    return y || x
  }
  return {
    firstName: pick(base.firstName, rich.firstName) || "Customer",
    lastName: pick(base.lastName, rich.lastName),
    mobile: pick(base.mobile, rich.mobile),
    email: pick(base.email, rich.email),
    address: {
      street: pick(base.address?.street, rich.address?.street),
      city: pick(base.address?.city, rich.address?.city),
      state: pick(base.address?.state, rich.address?.state),
      pincode: pick(base.address?.pincode, rich.address?.pincode),
    },
    remarks: pick(base.remarks, rich.remarks) || undefined,
  }
}

/** True when street/city/state/pincode all look filled. */
export function customerHasUsableAddress(customer: Customer | null | undefined): boolean {
  if (!customer?.address) return false
  const { street, city, state, pincode } = customer.address
  return Boolean(
    String(street || "").trim() &&
      String(city || "").trim() &&
      String(state || "").trim() &&
      String(pincode || "").trim(),
  )
}

/** Read prefill params from hook + window (hook can lag one frame on client navigation). */
export function getPrefillSearchParams(searchParams: URLSearchParams): URLSearchParams {
  if (prefillSignatureFromSearchParams(searchParams)) return searchParams
  if (typeof window === "undefined") return searchParams
  const fromLocation = new URLSearchParams(window.location.search)
  if (prefillSignatureFromSearchParams(fromLocation)) return fromLocation
  return searchParams
}
