// @ts-nocheck
/**
 * =============================================================================
 * BACKEND — SMS (2FA_AUTH) + approval email with proposal PDF  (Nov 24 2026)
 * =============================================================================
 * Swagger: http://localhost:3050/api-docs  (tags: SMS, Email)
 *
 * SMS
 *   utils/otp/sms.ts — ChairBord-only TypeScript SMS helper (2FA_AUTH)
 *   POST /api/send-sms in server.ts + Swagger tag SMS
 *
 * Approval email + proposal PDF
 *   utils/emails/approvalemail.ts — send from EMAIL_USER / EMAIL_PASSWORD
 *   utils/emails/buildProposalDocument.ts — load quotation by id → proposal data
 *   utils/emails/renderProposalPdfHtml.ts + proposalPdfStyles.ts — FE-matching 3-page HTML
 *   utils/emails/generateProposalPdf.ts — Puppeteer PDF
 *   utils/emails/proposalCompany.ts — company / bank constants
 *   assets/chairbord-solar-logo.png — logo for PDF
 *   POST /api/send-approval-email in server.ts + Swagger tag Email
 *
 * On admin approve (controllers/adminController.ts)
 *   non-fatal email send by quotationId (approve still 200 if mail fails)
 *
 * Project cost = quotation subtotal (not proposal / loan)
 *
 * Env
 *   EMAIL_USER=connect@chairbord.com
 *   EMAIL_PASSWORD=...
 *   SMS_URL / DLT_*  (existing)
 *
 * Deps
 *   nodemailer, puppeteer (+ @types/nodemailer)
 *
 * Related OTP (approve modal): BACKEND_APPROVAL_OTP.ts · §73 / §CA
 * HANDOFF §72 · REQUIRED §BZ
 * =============================================================================
 */

/* -------------------------------------------------------------------------- */
/* API                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Method  Path                      Body
 * ------  ------------------------  ------------------------------------------
 * POST    /api/send-sms             mobileNumber, message, otpNumber
 * POST    /api/send-approval-email  quotationId (required), optional to, cc
 *                                   (+ optional kind: "consent" | "approved")
 */

/* Example: SMS
curl -s -X POST http://localhost:3050/api/send-sms \
  -H 'Content-Type: application/json' \
  -d '{"mobileNumber":"9876543210","message":"login","otpNumber":"123456"}'
*/

/* Example: approval email
curl -s -X POST http://localhost:3050/api/send-approval-email \
  -H 'Content-Type: application/json' \
  -d '{"quotationId":"QT-5MXYEQ"}'
*/

/* -------------------------------------------------------------------------- */
/* File checklist                                                             */
/* -------------------------------------------------------------------------- */

/*
utils/otp/sms.ts
utils/emails/approvalemail.ts
utils/emails/buildProposalDocument.ts
utils/emails/renderProposalPdfHtml.ts
utils/emails/proposalPdfStyles.ts
utils/emails/generateProposalPdf.ts
utils/emails/proposalCompany.ts
assets/chairbord-solar-logo.png
server.ts                         — POST /api/send-sms, POST /api/send-approval-email + Swagger
controllers/adminController.ts    — non-fatal sendQuotationApprovalEmail on approve
package.json                      — nodemailer, puppeteer, @types/nodemailer
.env                              — EMAIL_USER, EMAIL_PASSWORD, SMS_URL, DLT_*
*/

/* -------------------------------------------------------------------------- */
/* Behavior notes                                                             */
/* -------------------------------------------------------------------------- */

/**
 * SMS (2FA_AUTH only):
 *   "Your OTP for ChairBord {message} is: {otpNumber} .Please do not share..."
 *   Requires SMS_URL, DLT_API_KEY, DLT_SENDER_ID, DLT_TEMPLATE_ID_2FA_AUTH
 *
 * Approval email:
 *   Load quotation by id → build FE-matching 3-page proposal PDF (Puppeteer) →
 *   nodemailer from EMAIL_USER → to (or customer.email)
 *   Project cost line + PDF total = subtotal
 *
 * Admin approve:
 *   try { await sendQuotationApprovalEmail({ quotationId }) }
 *   catch { log non-fatal }  // status update still succeeds
 */

export {}
