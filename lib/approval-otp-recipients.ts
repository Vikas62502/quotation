/** Admin approve OTP SMS recipients (must match inventorybackend/utils/otp/approvalOtp.ts). */
export type ApprovalOtpRecipientKey = "kamlesh" | "sunil" | "hr"

export const APPROVAL_OTP_RECIPIENTS: Array<{
  key: ApprovalOtpRecipientKey
  label: string
  mobileNumber: string
  hint?: string
}> = [
  {
    key: "kamlesh",
    label: "Kamlesh Sir",
    mobileNumber: "9269666646",
    hint: "Default",
  },
  {
    key: "sunil",
    label: "Sunil Sir",
    mobileNumber: "9251666646",
    hint: "If Kamlesh unavailable",
  },
  {
    key: "hr",
    label: "HR",
    mobileNumber: "9251005610",
  },
]

export const DEFAULT_APPROVAL_OTP_RECIPIENT: ApprovalOtpRecipientKey = "kamlesh"

export function approvalOtpRecipientLabel(key: ApprovalOtpRecipientKey | string | undefined): string {
  const found = APPROVAL_OTP_RECIPIENTS.find((r) => r.key === key)
  return found?.label || String(key || "").trim() || "—"
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function pickEmail(...values: unknown[]): string {
  for (const v of values) {
    const t = String(v ?? "").trim()
    if (t && t.includes("@") && !t.startsWith("@") && !t.endsWith("@")) return t
  }
  return ""
}

/**
 * Prefill File login / consent email from documents upload first, then quotation customer.
 * Checks documents.emailId / contactEmail and customer.email (plus snake_case aliases).
 */
export function getQuotationCustomerEmail(
  quotation: {
    customer?: { email?: string | null } | null
    customerEmail?: string | null
    email?: string | null
    emailId?: string | null
    email_id?: string | null
    documents?: Record<string, unknown> | null
    documentDetails?: Record<string, unknown> | null
    quotationDocuments?: Record<string, unknown> | null
  } | null | undefined,
  extras?: { contactEmail?: string | null },
): string {
  if (!quotation && !extras?.contactEmail) return ""
  const docs =
    asRecord(quotation?.documents) ||
    asRecord(quotation?.documentDetails) ||
    asRecord(quotation?.quotationDocuments) ||
    {}
  const customer = asRecord(quotation?.customer)

  return pickEmail(
    extras?.contactEmail,
    docs.emailId,
    docs.email_id,
    docs.contactEmail,
    docs.contact_email,
    docs.email,
    quotation?.emailId,
    quotation?.email_id,
    customer?.email,
    quotation?.customerEmail,
    quotation?.email,
  )
}

export function isValidCustomerEmail(email: string): boolean {
  const t = email.trim()
  return t.length > 3 && t.includes("@") && !t.startsWith("@") && !t.endsWith("@")
}
