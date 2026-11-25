// @ts-nocheck
/**
 * =============================================================================
 * BACKEND — Consent email from Admin Actions (not File login)  (Nov 25 2026)
 * =============================================================================
 * Frontend (shipped):
 *   - File login modal has NO customer email / does NOT send mail
 *   - Actions column ALWAYS shows consent control (not gated on File login):
 *       Mail icon  → fresh → Send consent email modal
 *       Done       → already sent → Resend modal
 *   - Modal calls POST /api/send-approval-email { quotationId, to, kind: "consent" }
 *
 * Backend (shipped on inventorybackend):
 *   1. Columns on quotations:
 *        consentEmailSentAt  TIMESTAMPTZ NULL
 *        consentEmailSentTo  VARCHAR(255) NULL
 *   2. On successful send-approval-email with kind=consent → stamp both fields
 *   3. GET list/detail echo:
 *        consentEmailSentAt / consent_email_sent_at
 *        consentEmailSentTo / consent_email_sent_to
 *        consentEmailSent / consent_email_sent  (boolean)
 *   4. File-login PATCH must NOT send email (FE no longer expects that)
 *
 * Env (PDF): PUPPETEER_EXECUTABLE_PATH + EMAIL_USER / EMAIL_PASSWORD — see §77 / §CE
 *
 * HANDOFF §79 · REQUIRED §CG · related §73 / §CA, §77 / §CE
 * =============================================================================
 */

/* -------------------------------------------------------------------------- */
/* API                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * POST /api/send-approval-email
 *   body: { quotationId, to?, kind: "consent" | "approved", cc? }
 *
 * When kind=consent and send succeeds:
 *   UPDATE quotations SET consentEmailSentAt=now(), consentEmailSentTo=:to
 *   response.data includes consentEmailSent, consentEmailSentAt, consentEmailSentTo
 *
 * curl:
 *   curl -s -X POST http://localhost:3050/api/send-approval-email \
 *     -H 'Content-Type: application/json' \
 *     -H "Authorization: Bearer $TOKEN" \
 *     -d '{"quotationId":"QT-HB2SDF","to":"customer@example.com","kind":"consent"}'
 */

/* -------------------------------------------------------------------------- */
/* Files                                                                      */
/* -------------------------------------------------------------------------- */

/*
models/Quotation.ts                 — consentEmailSentAt / consentEmailSentTo
config/sequelizeBootstrap.ts        — ensureConsentEmailSentColumns
utils/quotationApiJson.ts           — echo on admin metadata
server.ts                           — stamp on kind=consent after send
utils/emails/generateProposalPdf.ts — system Chrome (§CE)
utils/emails/approvalemail.ts       — send PDF
*/

/* -------------------------------------------------------------------------- */
/* Acceptance                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * [ ] File login save does not send email
 * [ ] Actions shows Mail/Done on every quotation row (File login Not set included)
 * [ ] Actions Mail → modal → 200 + Done shows after refresh (API flag, not only localStorage)
 * [ ] Resend updates consentEmailSentAt / consentEmailSentTo
 * [ ] GET quotations includes consentEmailSent*
 */
