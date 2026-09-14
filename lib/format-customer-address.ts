/** Shared person/dealer address shape used in Admin Users + customers. */
export type PersonAddress = {
  street: string
  city: string
  state: string
  pincode: string
}

const EMPTY_ADDRESS: PersonAddress = {
  street: "",
  city: "",
  state: "",
  pincode: "",
}

function firstNonEmpty(...values: unknown[]): string {
  for (const value of values) {
    if (value == null) continue
    const s = String(value).trim()
    if (s) return s
  }
  return ""
}

/**
 * Normalize address from nested `address`, flat columns (`address_street`), or
 * camelCase DB fields (`streetAddress`) so edit forms always show saved values.
 */
export function normalizePersonAddress(source: unknown): PersonAddress {
  if (!source || typeof source !== "object" || Array.isArray(source)) {
    if (typeof source === "string" && source.trim()) {
      return { ...EMPTY_ADDRESS, street: source.trim() }
    }
    return { ...EMPTY_ADDRESS }
  }

  const o = source as Record<string, unknown>
  const nestedRaw = o.address
  const nested =
    nestedRaw && typeof nestedRaw === "object" && !Array.isArray(nestedRaw)
      ? (nestedRaw as Record<string, unknown>)
      : null

  const street = firstNonEmpty(
    nested?.street,
    nested?.streetAddress,
    nested?.street_address,
    nested?.address_street,
    nested?.addressStreet,
    nested?.line1,
    nested?.addressLine1,
    o.street,
    o.streetAddress,
    o.street_address,
    o.address_street,
    o.addressStreet,
    o.line1,
    o.addressLine1,
    typeof nestedRaw === "string" ? nestedRaw : "",
  )
  const city = firstNonEmpty(
    nested?.city,
    nested?.address_city,
    nested?.addressCity,
    o.city,
    o.address_city,
    o.addressCity,
  )
  const state = firstNonEmpty(
    nested?.state,
    nested?.address_state,
    nested?.addressState,
    o.state,
    o.address_state,
    o.addressState,
  )
  const pincode = firstNonEmpty(
    nested?.pincode,
    nested?.pinCode,
    nested?.pin_code,
    nested?.zip,
    nested?.postalCode,
    nested?.address_pincode,
    nested?.addressPincode,
    o.pincode,
    o.pinCode,
    o.pin_code,
    o.zip,
    o.postalCode,
    o.address_pincode,
    o.addressPincode,
  )

  return { street, city, state, pincode }
}

/** Flat + nested fields for backends that store address as columns or JSON. */
export function personAddressWritePayload(address: PersonAddress): Record<string, unknown> {
  const street = String(address.street || "").trim()
  const city = String(address.city || "").trim()
  const state = String(address.state || "").trim()
  const pincode = String(address.pincode || "").trim()
  const nested = { street, city, state, pincode }
  return {
    address: nested,
    address_street: street,
    address_city: city,
    address_state: state,
    address_pincode: pincode,
    streetAddress: street,
    street,
    city,
    state,
    pincode,
  }
}

/** Format API address objects or plain strings for display in tables. */
export function formatCustomerAddress(address: unknown, fallback = "N/A"): string {
  if (typeof address === "string") {
    const trimmed = address.trim()
    return trimmed || fallback
  }
  const a = normalizePersonAddress(address)
  const parts = [a.street, a.city, a.state, a.pincode].filter(Boolean)
  return parts.length > 0 ? parts.join(", ") : fallback
}

export function formatPersonAddressLine(source: unknown, fallback = ""): string {
  const a = normalizePersonAddress(source)
  const parts = [a.street, a.city, a.state, a.pincode].filter(Boolean)
  return parts.length > 0 ? parts.join(", ") : fallback
}

export function formatQuotationVisitLocation(
  q: {
    visitLocation?: unknown
    visit_location?: unknown
    location?: unknown
    customer?: { address?: unknown; location?: unknown } | null
  },
  fallback = "N/A",
): string {
  const visit = String(q.visitLocation || q.visit_location || q.location || "").trim()
  if (visit) return visit
  const customer = q.customer
  if (customer?.location && typeof customer.location === "string" && customer.location.trim()) {
    return customer.location.trim()
  }
  if (customer) {
    const fromCustomer = formatPersonAddressLine(customer, "")
    if (fromCustomer) return fromCustomer
  }
  return formatCustomerAddress(customer?.address, fallback)
}
