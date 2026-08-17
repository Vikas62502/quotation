/**
 * Cities available when creating quotations and in multi-select city filters.
 * Keep create form + list filters on the same list.
 */
export const SERVICE_CITIES = [
  "Ajmer",
  "Alwar",
  "Banswara",
  "Baran",
  "Barmer",
  "Beawar",
  "Bharatpur",
  "Bhilwara",
  "Bikaner",
  "Bundi",
  "Chittorgarh",
  "Chomu",
  "Churu",
  "Dausa",
  "Dholpur",
  "Dungarpur",
  "Hanumangarh",
  "Jaipur",
  "Jaisalmer",
  "Jalore",
  "Jhalawar",
  "Jhunjhunu",
  "Jodhpur",
  "Karauli",
  "Kota",
  "Nagaur",
  "Pali",
  "Pratapgarh",
  "Rajsamand",
  "Sawai Madhopur",
  "Sikar",
  "Sirohi",
  "Sri Ganganagar",
  "Tonk",
  "Udaipur",
] as const

export type ServiceCity = (typeof SERVICE_CITIES)[number]

export function normalizeCityName(value: unknown): string {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
}

/** Pull customer/lead city from common quotation / customer shapes. */
export function getRecordCity(record: unknown): string {
  if (!record || typeof record !== "object") return ""
  const r = record as Record<string, unknown>
  const customer = (r.customer && typeof r.customer === "object" ? r.customer : null) as Record<
    string,
    unknown
  > | null
  const address =
    (customer?.address && typeof customer.address === "object" ? customer.address : null) ||
    (r.address && typeof r.address === "object" ? r.address : null)
  const a = address as Record<string, unknown> | null
  return normalizeCityName(
    a?.city ||
      customer?.city ||
      r.city ||
      r.customerCity ||
      r.customer_city ||
      r.leadCity ||
      r.lead_city,
  )
}

/**
 * Empty `selectedCities` = no city filter (show all).
 * Otherwise match when record city equals any selected city (case-insensitive).
 */
export function matchesCityFilter(recordOrCity: unknown, selectedCities: string[]): boolean {
  if (!selectedCities.length) return true
  const city =
    typeof recordOrCity === "string" ? normalizeCityName(recordOrCity) : getRecordCity(recordOrCity)
  if (!city) return false
  const lower = city.toLowerCase()
  return selectedCities.some((c) => normalizeCityName(c).toLowerCase() === lower)
}
