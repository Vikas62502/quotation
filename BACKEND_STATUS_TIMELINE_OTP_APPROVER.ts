// @ts-nocheck
/**
 * =============================================================================
 * BACKEND — Status timeline: who verified approve OTP  (Nov 24 2026)
 * =============================================================================
 * Frontend (Admin → Status timeline):
 *   Approved rows show "Verified OTP · Kamlesh Sir / Sunil Sir / HR" (+ mobile).
 *   "Last approved · by …" uses the latest approved history entry.
 *
 * Why names were missing:
 *   Approve PATCH must persist by/byLabel on statusHistory. Prefer body
 *   approvalOtpRecipient; also stash on quotation at verify time so approve
 *   still works if body is stripped. Running API must be restarted after deploy
 *   (plain ts-node does not hot-reload).
 *
 * Recipients (utils/otp/approvalOtp.ts):
 *   kamlesh  Kamlesh Sir  9269666646
 *   sunil    Sunil Sir    9251666646
 *   hr       HR           9251005610
 *
 * HANDOFF §75 · REQUIRED §CC
 * Related: BACKEND_APPROVAL_OTP.ts · §73 / §CA
 * =============================================================================
 */

/* -------------------------------------------------------------------------- */
/* 1) Columns (bootstrap)                                                     */
/* -------------------------------------------------------------------------- */

/*
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS "approvalOtpVerifiedBy" VARCHAR(20) NULL;
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS "approvalOtpVerifiedAt" TIMESTAMPTZ NULL;
*/

/* -------------------------------------------------------------------------- */
/* 2) POST /api/approval-otp/verify                                           */
/* -------------------------------------------------------------------------- */

/**
 * On success:
 *   1. Delete approval_otps row for quotationId
 *   2. UPDATE quotations SET
 *        approvalOtpVerifiedBy = recipientKey,  -- kamlesh|sunil|hr
 *        approvalOtpVerifiedAt = NOW()
 *   3. Response 200 (never include otp digits):
 *      {
 *        success: true,
 *        data: {
 *          quotationId, verified: true,
 *          recipient / recipientKey, recipientLabel, mobileNumber
 *        }
 *      }
 */

/* -------------------------------------------------------------------------- */
/* 3) PATCH /admin/quotations/:id/status  (status=approved)                   */
/* -------------------------------------------------------------------------- */

/**
 * Zod allowlist (updateStatusSchema) MUST include:
 *   approvalOtpRecipient, approval_otp_recipient,
 *   otpRecipient, otp_recipient,
 *   otpVerifiedBy, otp_verified_by,
 *   approvedByOtp, approved_by_otp
 * (+ .passthrough())
 *
 * Resolve verifier:
 *   body.approvalOtpRecipient
 *     ?? body.otpRecipient ?? body.otpVerifiedBy ?? body.approvedByOtp
 *     ?? quotation.approvalOtpVerifiedBy
 *
 * Append statusHistory entry:
 *   {
 *     status: "approved",
 *     at: "<ISO now>",
 *     by: "kamlesh",
 *     byLabel: "Kamlesh Sir",
 *     otpRecipient: "kamlesh",
 *     otpMobile: "9269666646"
 *   }
 *
 * Then clear stash:
 *   approvalOtpVerifiedBy = null
 *   approvalOtpVerifiedAt = null
 *
 * GET list/detail: readStatusHistoryFromRow MUST keep by / byLabel / otpMobile
 * (do not strip to { status, at } only). Echo via quotationAdminMetadataFields.
 */

/* -------------------------------------------------------------------------- */
/* 4) Files                                                                   */
/* -------------------------------------------------------------------------- */

/*
utils/otp/approvalOtp.ts              — verify returns recipient; stashes on quotation
controllers/adminController.ts        — historyEntry by/byLabel; clear stash
utils/quotationApiJson.ts             — readStatusHistoryFromRow keeps verifier fields
validations/adminValidations.ts       — OTP fields on updateStatusSchema
models/Quotation.ts                   — approvalOtpVerifiedBy / At
config/sequelizeBootstrap.ts          — ensure columns + approval_otps table
*/

/* -------------------------------------------------------------------------- */
/* 5) Checklist                                                               */
/* -------------------------------------------------------------------------- */

/*
[ ] Columns approvalOtpVerifiedBy / approvalOtpVerifiedAt exist
[ ] verify stashes recipient on quotation
[ ] approve reads body OR stash → statusHistory by + byLabel + otpMobile
[ ] approve clears stash
[ ] GET preserves history verifier fields
[ ] Zod allowlists approvalOtpRecipient aliases
[ ] Restart API after deploy
*/

export {}
