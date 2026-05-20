import type { Customer } from "@/lib/quotation-context"

/** Build customer from Calling Data / URL prefill query params. */
export function customerFromPrefillSearchParams(params: URLSearchParams): Customer | null {
  const prefillName = params.get("prefillName") || ""
  const prefillMobile = (params.get("prefillMobile") || "").replace(/\D/g, "").slice(-10)
  const prefillAddress = params.get("prefillAddress") || ""
  const prefillCity = params.get("prefillCity") || ""
  const prefillState = params.get("prefillState") || ""
  const prefillRemarks =
    params.get("prefillRemarks") ||
    [params.get("prefillCustomerNote"), params.get("prefillCallRemark")].filter(Boolean).join("\n\n")

  if (!prefillName && !prefillMobile && !prefillAddress && !prefillCity && !prefillState && !prefillRemarks) {
    return null
  }

  const words = prefillName.trim().split(/\s+/).filter(Boolean)
  const firstName = words[0] || ""
  const lastName = words.slice(1).join(" ") || "Customer"

  return {
    firstName,
    lastName,
    mobile: prefillMobile,
    email: "",
    address: {
      street: prefillAddress,
      city: prefillCity,
      state: prefillState,
      pincode: "",
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
    params.get("prefillRemarks") ||
      [params.get("prefillCustomerNote"), params.get("prefillCallRemark")].filter(Boolean).join("\n\n"),
  ].join("|")
}

/** Read prefill params from hook + window (hook can lag one frame on client navigation). */
export function getPrefillSearchParams(searchParams: URLSearchParams): URLSearchParams {
  if (prefillSignatureFromSearchParams(searchParams)) return searchParams
  if (typeof window === "undefined") return searchParams
  const fromLocation = new URLSearchParams(window.location.search)
  if (prefillSignatureFromSearchParams(fromLocation)) return fromLocation
  return searchParams
}
