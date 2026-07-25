// @ts-nocheck
/**
 * =============================================================================
 * BACKEND REFERENCE — Fix stock_requests_dispatched_by_id_fkey (Jul 2026)
 * =============================================================================
 *
 * Handoff: BACKEND_CHANGES_HANDOFF.md §16
 * Related: BACKEND_PRODUCTS_CREATED_BY.ts (same root cause / same resolver)
 *
 * Frontend:
 *   - Quotation Admin → Inventory → Stock Requests → Review & Dispatch
 *   - SPA may send dispatched_by / dispatched_by_id (valid inventory users.id)
 *
 * Live error:
 *   insert or update on table "stock_requests" violates foreign key constraint
 *   "stock_requests_dispatched_by_id_fkey"
 *
 * Cause:
 *   POST /stock-requests/:id/dispatch sets
 *     stock_requests.dispatched_by_id = jwt.sub / req.user.id
 *   Quotation Admin JWT id is NOT in inventory `users` → FK fails.
 *
 * REQUIRED:
 *   Before updating stock_requests on dispatch, resolve a valid inventory users.id
 *   (same as products.created_by — upsert JWT user if missing).
 *   Honor body: dispatched_by | dispatched_by_id | dispatchedBy | dispatchedById
 */

export async function postStockRequestDispatch(req, res, { StockRequests, Users, db }) {
  try {
    const id = req.params.id
    const request = await StockRequests.findByPk(id)
    if (!request) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_001", message: "Stock request not found" },
      })
    }

    const rejection = req.body?.rejection_reason || req.body?.rejectionReason || null
    if (rejection) {
      await request.update({
        status: "rejected",
        rejection_reason: String(rejection).trim(),
      })
      return res.status(200).json({ success: true, ...request.toJSON?.() })
    }

    const bodyActor = String(
      req.body?.dispatched_by_id ||
        req.body?.dispatched_by ||
        req.body?.dispatchedById ||
        req.body?.dispatchedBy ||
        "",
    ).trim()

    let dispatched_by_id = null
    if (bodyActor) {
      const byBody = await Users.findByPk(bodyActor)
      if (byBody) dispatched_by_id = byBody.id
    }

    const jwtId = String(req.user?.id || req.user?.sub || "").trim()
    if (!dispatched_by_id && jwtId) {
      const byId = await Users.findByPk(jwtId)
      if (byId) dispatched_by_id = byId.id
    }

    // Upsert quotation JWT into inventory users (permanent fix — same as §14)
    if (!dispatched_by_id && jwtId) {
      const [row] = await Users.findOrCreate({
        where: { id: jwtId },
        defaults: {
          id: jwtId,
          username: req.user?.username || `user_${jwtId.slice(0, 8)}`,
          name: req.user?.name || req.user?.username || "Quotation Admin",
          role: "super-admin",
          is_active: true,
        },
      })
      dispatched_by_id = row.id
    }

    if (!dispatched_by_id) {
      return res.status(400).json({
        success: false,
        error: {
          code: "INV_USER_MISSING",
          message:
            "Cannot dispatch: no inventory user for dispatched_by_id. Upsert JWT user into inventory users or send a valid dispatched_by_id.",
        },
      })
    }

    let items = req.body?.items
    if (typeof items === "string") {
      try {
        items = JSON.parse(items)
      } catch {
        items = null
      }
    }

    let serial_numbers = req.body?.serial_numbers
    if (typeof serial_numbers === "string") {
      try {
        serial_numbers = JSON.parse(serial_numbers)
      } catch {
        serial_numbers = null
      }
    }

    // … existing stock deduction + serial mark-dispatched logic …
    void items
    void serial_numbers
    void db

    await request.update({
      status: "dispatched",
      dispatched_by_id,
      dispatched_at: new Date(),
    })

    return res.status(200).json({ success: true, ...request.toJSON?.() })
  } catch (error) {
    console.error("[stock-requests/dispatch]", error)
    const msg = String(error?.message || error || "")
    if (/dispatched_by_id_fkey|stock_requests_dispatched_by/i.test(msg)) {
      return res.status(400).json({
        success: false,
        error: {
          code: "INV_USER_MISSING",
          message:
            "dispatched_by_id is not in inventory users — resolve/upsert JWT user before update",
          details: msg,
        },
      })
    }
    return res.status(500).json({
      success: false,
      error: { code: "SYS_001", message: msg || "Internal error" },
    })
  }
}

export default { postStockRequestDispatch }
