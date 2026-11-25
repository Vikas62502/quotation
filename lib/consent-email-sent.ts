/** Local record of consent (proposal PDF) emails sent from Admin Actions. */

const STORAGE_KEY = "admin-consent-email-sent-by-quotation"

export type ConsentEmailSentRecord = {
  sentAt: string
  to: string
}

type ConsentMap = Record<string, ConsentEmailSentRecord>

function readMap(): ConsentMap {
  if (typeof window === "undefined") return {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === "object" ? (parsed as ConsentMap) : {}
  } catch {
    return {}
  }
}

function writeMap(map: ConsentMap) {
  if (typeof window === "undefined") return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
}

export function getConsentEmailSent(quotationId: string): ConsentEmailSentRecord | null {
  if (!quotationId) return null
  return readMap()[quotationId] || null
}

export function isConsentEmailSent(quotationId: string): boolean {
  return Boolean(getConsentEmailSent(quotationId)?.sentAt)
}

export function markConsentEmailSent(quotationId: string, to: string) {
  if (!quotationId) return
  const map = readMap()
  map[quotationId] = {
    sentAt: new Date().toISOString(),
    to: String(to || "").trim(),
  }
  writeMap(map)
}

/** Prefer API flag when present; else localStorage. */
export function quotationConsentEmailDone(
  quotation: {
    id: string
    consentEmailSentAt?: string | null
    consent_email_sent_at?: string | null
    consentEmailSent?: boolean | null
    consent_email_sent?: boolean | null
  } | null | undefined,
): boolean {
  if (!quotation?.id) return false
  if (quotation.consentEmailSent === true || quotation.consent_email_sent === true) return true
  const at = quotation.consentEmailSentAt || quotation.consent_email_sent_at
  if (at) return true
  return isConsentEmailSent(quotation.id)
}
