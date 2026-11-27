// @ts-nocheck
/**
 * =============================================================================
 * BACKEND — File login lock (Send / Pending / Already / Login now)  (Nov 27 2026)
 * =============================================================================
 * Deploy: inventorybackend — restart API after pull.
 * Mirror: inventorybackend/BACKEND_DEALER_FILE_LOGIN.ts
 *
 * Rules
 *   Not set / pending_for_login → dealer can edit
 *   already_login / login_now   → dealer gets 403 AUTH_004
 *   Admin unlocks by Not set (resetFileLogin: true) or Pending for login
 *
 * API
 *   PATCH /api/quotations/:id/file-login
 *   PATCH /api/admin/quotations/:id/file-login
 *
 * Bodies
 *   Send:   { fileLoginStatus:"pending_for_login", filePaymentType:"cash"|… }
 *   Unlock: { resetFileLogin: true }
 *
 * Files (inventorybackend)
 *   controllers/adminController.ts, routes/quotationRoutes.ts,
 *   models/Quotation.ts, config/sequelizeBootstrap.ts, utils/quotationApiJson.ts
 *
 * FE: lib/api.ts → quotations.updateFileLogin / admin.updateFileLogin
 *   Lock UI on already_login | login_now; unlock via admin Not set / Pending
 *
 * Acceptance
 * [ ] Restart API
 * [ ] Dealer send pending → 200
 * [ ] Locked status → dealer 403
 * [ ] Admin reset → dealer can send again
 * =============================================================================
 */
