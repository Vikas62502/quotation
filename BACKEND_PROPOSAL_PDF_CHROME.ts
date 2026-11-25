// @ts-nocheck
/**
 * =============================================================================
 * BACKEND — Proposal PDF: use system Chrome (not broken Puppeteer cache)
 *           Nov 25 2026
 * =============================================================================
 * Symptom (Admin File login → consent email):
 *   POST /api/send-approval-email fails with:
 *   "Failed to launch the browser process! … Chrome for Testing …
 *    mac_arm-127… Framework … (no such file)"
 *
 * Root cause:
 *   utils/emails/generateProposalPdf.ts used puppeteer.launch() default,
 *   which points at a broken cached "Google Chrome for Testing" binary.
 *
 * Fix (shipped on inventorybackend):
 *   1. Prefer PUPPETEER_EXECUTABLE_PATH
 *   2. Prefer installed system Chrome / Chromium paths
 *   3. Try puppeteer channel: 'chrome'
 *   4. Only fall back to bundled Chrome for Testing if nothing else exists
 *   5. Never try bundled first when system Chrome is present
 *
 * Env (.env):
 *   PUPPETEER_EXECUTABLE_PATH=/Applications/Google Chrome.app/Contents/MacOS/Google Chrome
 *   (Linux example: /usr/bin/google-chrome-stable)
 *   EMAIL_USER / EMAIL_PASSWORD still required for send
 *
 * Restart API after setting env (dotenv loads at boot).
 *
 * Related: BACKEND_SMS_APPROVAL_EMAIL.ts · §72 / §BZ
 *          BACKEND_APPROVAL_OTP.ts · §73 / §CA (kind=consent on file login)
 * HANDOFF §77 · REQUIRED §CE
 * =============================================================================
 */

/* -------------------------------------------------------------------------- */
/* API (unchanged contract)                                                   */
/* -------------------------------------------------------------------------- */

/**
 * POST /api/send-approval-email
 *   body: { quotationId, to?, cc?, kind?: "consent" | "approved" }
 *
 * Pipeline:
 *   buildProposalDocumentFromQuotationId
 *   → generateQuotationProposalPdfFromDocument  (Puppeteer / system Chrome)
 *   → nodemailer attachment
 *
 * curl:
 *   curl -s -X POST http://localhost:3050/api/send-approval-email \
 *     -H 'Content-Type: application/json' \
 *     -H "Authorization: Bearer $TOKEN" \
 *     -d '{"quotationId":"QT-HB2SDF","to":"customer@example.com","kind":"consent"}'
 */

/* -------------------------------------------------------------------------- */
/* File checklist                                                             */
/* -------------------------------------------------------------------------- */

/*
utils/emails/generateProposalPdf.ts   — launchBrowser with system Chrome first
.env                                  — PUPPETEER_EXECUTABLE_PATH=…
utils/emails/approvalemail.ts         — unchanged callers
server.ts                             — POST /api/send-approval-email
*/

/* -------------------------------------------------------------------------- */
/* Acceptance                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * [ ] System Chrome path exists on the host (or PUPPETEER_EXECUTABLE_PATH set)
 * [ ] POST /api/send-approval-email returns 200 with messageId (not SYS_001 launch error)
 * [ ] Admin File login → Save sends consent PDF without Puppeteer Framework dlopen error
 * [ ] API restarted after .env change
 */
