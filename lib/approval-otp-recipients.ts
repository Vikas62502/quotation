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

export function getQuotationCustomerEmail(quotation: {
  customer?: { email?: string | null } | null
  customerEmail?: string | null
  email?: string | null
} | null | undefined): string {
  if (!quotation) return ""
  const raw =
    quotation.customer?.email ||
    quotation.customerEmail ||
    quotation.email ||
    ""
  return String(raw).trim()
}

export function isValidCustomerEmail(email: string): boolean {
  const t = email.trim()
  return t.length > 3 && t.includes("@") && !t.startsWith("@") && !t.endsWith("@")
}
