// @ts-nocheck
/**
 * =============================================================================
 * BACKEND — Dealer latest quotation must be Admin "current"  (Nov 25 2026)
 * =============================================================================
 * Product:
 *   When a dealer creates / revises / duplicates a quotation (Recent Quotations),
 *   that id must become the **current** row for the customer so Admin shows it
 *   (not an older is_current=true row).
 *
 * Frontend (shipped):
 *   - POST /quotations always sends isCurrent / is_current / setAsCurrent: true
 *   - After create / revise / duplicate → POST /quotations/:id/restore-current
 *     (fallback set-current / PATCH { isCurrent: true })
 *   - Admin list uses API is_current (then newest) via annotateQuotationsWithCurrent
 *
 * Backend must:
 *   1. On create with setAsCurrent / isCurrent / is_current true (or always on new row):
 *        - INSERT new quotation with is_current = true
 *        - UPDATE other quotations for same customer_id SET is_current = false
 *   2. POST /quotations/:id/restore-current:
 *        - that id is_current=true; others for same customer false
 *   3. GET list/detail echo isCurrent / is_current on every row
 *
 * See also: BACKEND_QUOTATION_SYSTEM_HISTORY.ts · §23
 * HANDOFF §78 · REQUIRED §CF
 * =============================================================================
 */

/* -------------------------------------------------------------------------- */
/* API                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Method  Path                              Body / notes
 * ------  --------------------------------  ---------------------------------
 * POST    /quotations                       isCurrent / is_current / setAsCurrent
 *                                           → new row current; demote siblings
 * POST    /quotations/:id/restore-current   mark this id current
 * POST    /quotations/:id/set-current       alias
 * PATCH   /quotations/:id                   { isCurrent: true, is_current: true }
 * GET     /quotations (+ admin lists)       echo isCurrent / is_current
 */

/* Example after dealer create:
curl -s -X POST http://localhost:3050/api/quotations/QT-NEW/restore-current \
  -H "Authorization: Bearer $DEALER_TOKEN"
*/

/* -------------------------------------------------------------------------- */
/* Acceptance                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * [ ] Dealer creates additional quotation → new id is_current=true, old false
 * [ ] Admin Quotations tab shows the new id as Current (History has older)
 * [ ] restore-current from dealer History updates Admin without localStorage
 * [ ] GET never strips is_current
 */
