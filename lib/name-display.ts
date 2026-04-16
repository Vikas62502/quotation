export function sanitizeNamePart(value: unknown): string {
  const text = String(value ?? "").trim()
  if (!text) return ""
  const normalized = text.toLowerCase().replace(/\./g, "")
  if (
    normalized === "na" ||
    normalized === "n/a" ||
    normalized === "null" ||
    normalized === "undefined" ||
    normalized === "-"
  ) {
    return ""
  }
  return text
}

export function formatPersonName(
  firstName: unknown,
  lastName: unknown,
  fallback = "Unknown",
): string {
  const first = sanitizeNamePart(firstName)
  const last = sanitizeNamePart(lastName)
  const full = `${first} ${last}`.trim()
  return full || fallback
}
