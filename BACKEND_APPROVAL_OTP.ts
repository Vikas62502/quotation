// @ts-nocheck
/**
 * =============================================================================
 * BACKEND — Approval OTP (4-digit) + consent email on file login  (Nov 24 2026)
 * =============================================================================
 * Frontend (Admin):
 *   1) File login modal → require customer email → PATCH file-login →
 *      POST /api/send-approval-email { quotationId, to, kind: "consent" }
 *   2) Approve modal → payment type / bank / amounts at top → OTP block at bottom →
 *      Send OTP → Verify OTP → only then Approve (PATCH status approved)
 *
 * Recipients (default kamlesh — match live approvalOtp.ts):
 *   kamlesh  Kamlesh Sir  9269666646
 *   sunil    Sunil Sir    9251666646
 *   hr       HR           9251005610
 *
 * OTP rules:
 *   - Random 4 digits every send (different each time)
 *   - Store in DB for 30 minutes then erase
 *   - New OTP for same quotation replaces previous row
 *   - Correct verify → erase immediately
 *   - Never return the OTP digits in API responses
 *
 * Env (existing SMS + email):
 *   SMS_URL, DLT_API_KEY, DLT_SENDER_ID, DLT_TEMPLATE_ID_2FA_AUTH
 *   EMAIL_USER, EMAIL_PASSWORD
 *
 * Swagger: tags SMS + Email — http://localhost:3050/api-docs
 * Status timeline (admin): on approve, persist who verified OTP on statusHistory:
 *   { status: "approved", at, by: "kamlesh"|"sunil"|"hr", byLabel: "Kamlesh Sir", otpMobile }
 * FE sends approvalOtpRecipient on PATCH /admin/quotations/:id/status after Verify OTP.
 *
 * HANDOFF §73 · REQUIRED §CA
 * =============================================================================
 */

/* -------------------------------------------------------------------------- */
/* 1) Table                                                                   */
/* -------------------------------------------------------------------------- */

/*
CREATE TABLE IF NOT EXISTS approval_otps (
  id SERIAL PRIMARY KEY,
  quotation_id VARCHAR(50) NOT NULL UNIQUE,
  otp VARCHAR(4) NOT NULL,
  recipient_key VARCHAR(20) NOT NULL,
  mobile_number VARCHAR(15) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS approval_otps_expires_at_idx ON approval_otps (expires_at);
*/

/* -------------------------------------------------------------------------- */
/* 2) Recipients + helpers                                                    */
/* -------------------------------------------------------------------------- */

type ApprovalOtpRecipient = "kamlesh" | "sunil" | "hr"

const APPROVAL_OTP_RECIPIENTS: Record<
  ApprovalOtpRecipient,
  { label: string; mobileNumber: string }
> = {
  kamlesh: { label: "Kamlesh Sir", mobileNumber: "8210554718" },
  sunil: { label: "Sunil Sir", mobileNumber: "7737755290" },
  hr: { label: "HR", mobileNumber: "9251005610" },
}

const OTP_TTL_MS = 30 * 60 * 1000

function normalizeRecipient(raw: unknown): ApprovalOtpRecipient {
  const key = String(raw || "kamlesh").trim().toLowerCase()
  if (key === "sunil") return "sunil"
  if (key === "hr") return "hr"
  return "kamlesh"
}

function generateFourDigitOtp(): string {
  return String(Math.floor(1000 + Math.random() * 9000))
}

/**
 * Files on inventory API:
 *   models/ApprovalOtp.ts
 *   utils/otp/approvalOtp.ts   — sendApprovalOtp / verifyApprovalOtp
 *   utils/otp/sms.ts           — 2FA_AUTH template
 *   utils/emails/approvalemail.ts — kind: consent | approved
 *   config/sequelizeBootstrap.ts — ensureApprovalOtpsTable()
 *   server.ts — routes below
 */

/* -------------------------------------------------------------------------- */
/* 3) POST /api/approval-otp/send                                             */
/* -------------------------------------------------------------------------- */

/**
 * Body:
 *   quotationId  string  required
 *   recipient    string  optional  kamlesh | sunil | hr  (default kamlesh)
 *
 * Behavior:
 *   1. Ensure quotation exists (404 if not)
 *   2. Delete any existing OTP row for quotationId
 *   3. Purge global expired rows
 *   4. Insert new row: otp, recipient_key, mobile_number, expires_at = now+30m
 *   5. SMS via sendSms(mobile, "quotation approval", otp, "2FA_AUTH")
 *      Template text: Your OTP for ChairBord quotation approval is: {otp} ...
 *
 * 200:
 *   {
 *     success: true,
 *     message: "OTP sent to Kamlesh Sir",
 *     data: {
 *       quotationId, recipient, recipientLabel, mobileNumber, expiresAt
 *       // do NOT include otp
 *     }
 *   }
 *
 * curl:
 *   curl -s -X POST http://localhost:3050/api/approval-otp/send \
 *     -H 'Content-Type: application/json' -H "Authorization: Bearer $TOKEN" \
 *     -d '{"quotationId":"QT-5MXYEQ","recipient":"kamlesh"}'
 */

/* -------------------------------------------------------------------------- */
/* 4) POST /api/approval-otp/verify                                           */
/* -------------------------------------------------------------------------- */

/**
 * Body:
 *   quotationId  string  required
 *   otp          string  required  exactly 4 digits
 *
 * Behavior:
 *   1. Purge expired
 *   2. Load row by quotationId — if missing → 400 "OTP not found or expired..."
 *   3. If expires_at < now → delete row → 400 expired
 *   4. If otp mismatch → 400 "Incorrect OTP" (keep row so user can retry)
 *   5. Match → delete row → 200 { verified: true }
 *
 * Frontend: Approve button stays disabled until this returns success.
 * PATCH /admin/quotations/:id/status approved is a separate call after verify.
 *
 * 200:
 *   { success: true, message: "OTP verified", data: { quotationId, verified: true } }
 *
 * 400 VAL_OTP:
 *   Incorrect / expired / missing / not 4 digits
 *
 * curl:
 *   curl -s -X POST http://localhost:3050/api/approval-otp/verify \
 *     -H 'Content-Type: application/json' -H "Authorization: Bearer $TOKEN" \
 *     -d '{"quotationId":"QT-5MXYEQ","otp":"4821"}'
 */

/* -------------------------------------------------------------------------- */
/* 5) POST /api/send-approval-email — kind=consent | approved                 */
/* -------------------------------------------------------------------------- */

/**
 * Body:
 *   quotationId  required
 *   to           optional (default customer.email)
 *   cc           optional
 *   kind         "consent" | "approved"  (default approved)
 *
 * File login (FE):
 *   kind: "consent"
 *   subject: ChairBord solar proposal & consent — {id}
 *   body: ask customer to review proposal PDF + complete consent
 *   Project cost = quotation subtotal
 *
 * Admin approve (existing non-fatal hook may still send kind approved):
 *   kind: "approved" (or omit)
 *
 * If customer has no email and `to` missing → 400
 *   (FE shows "Please enter the email" before calling)
 *
 * curl (consent after file login):
 *   curl -s -X POST http://localhost:3050/api/send-approval-email \
 *     -H 'Content-Type: application/json' -H "Authorization: Bearer $TOKEN" \
 *     -d '{"quotationId":"QT-5MXYEQ","to":"customer@example.com","kind":"consent"}'
 */

/* -------------------------------------------------------------------------- */
/* 6) Checklist                                                               */
/* -------------------------------------------------------------------------- */

/*
[ ] approval_otps table created on boot
[ ] POST /api/approval-otp/send  — Swagger tag SMS
[ ] POST /api/approval-otp/verify — Swagger tag SMS
[ ] OTP never echoed in JSON
[ ] 4-digit random; 30 min TTL; replace on resend; erase on verify / expiry
[ ] Recipients kamlesh / sunil / hr with phones above
[ ] SMS uses existing 2FA_AUTH DLT template
[ ] send-approval-email accepts kind=consent | approved
[ ] Project cost in email/PDF = subtotal
[ ] Approve status PATCH does not require OTP in body (FE verifies first)
*/

export {}
