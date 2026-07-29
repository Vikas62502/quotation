// @ts-nocheck
/**
 * =============================================================================
 * BACKEND REFERENCE — Fix sales_created_by_fkey on POST /sales (Jul 2026)
 * =============================================================================
 *
 * Handoff: BACKEND_CHANGES_HANDOFF.md §20
 * Related: BACKEND_PRODUCTS_CREATED_BY.ts, BACKEND_STOCK_REQUESTS_DISPATCHED_BY.ts
 *          (same root cause / same resolver)
 *
 * Frontend:
 *   - Quotation Admin → Inventory → Agent → New B2B / B2C Sale → Record Sale
 *   - SPA sends created_by / createdBy / created_by_id / createdById
 *     (valid inventory users.id when resolvable; retries with fallback on FK)
 *
 * Live error:
 *   insert or update on table "sales" violates foreign key constraint
 *   "sales_created_by_fkey"
 *
 * Cause:
 *   POST /sales sets sales.created_by = jwt.sub / req.user.id
 *   Quotation Admin JWT id is NOT in inventory `users` → FK fails.
 *
 * REQUIRED:
 *   Before INSERT into sales, resolve a valid inventory users.id
 *   (same as products.created_by / stock_requests.dispatched_by_id).
 *   Honor body: created_by | createdBy | created_by_id | createdById
 *   Else upsert JWT user into inventory users, then set created_by.
 *   Never INSERT with a bare JWT id missing from users.
 */

/** Reuse the same helper as products / dispatch (copy from BACKEND_PRODUCTS_CREATED_BY.ts). */
export async function resolveInventoryCreatedBy(req, Users) {
  const bodyId = String(
    req.body?.created_by ||
      req.body?.createdBy ||
      req.body?.created_by_id ||
      req.body?.createdById ||
      "",
  ).trim()

  if (bodyId) {
    const byBody = await Users.findByPk(bodyId)
    if (byBody) return byBody.id
  }

  const jwtId = String(req.user?.id || req.user?.sub || "").trim()
  if (jwtId) {
    const byJwt = await Users.findByPk(jwtId)
    if (byJwt) return byJwt.id

    // Permanent fix: upsert quotation Admin JWT into inventory users
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
    return row.id
  }

  const fallback = await Users.findOne({
    where: { is_active: true },
    order: [["created_at", "ASC"]],
  })
  if (fallback) return fallback.id

  const err = new Error(
    "No inventory user available for sales.created_by. Upsert quotation Admin into inventory users.",
  )
  err.code = "INV_USER_MISSING"
  throw err
}

/**
 * Example POST /sales handler — only the created_by resolution is required.
 * Keep existing sale/item/stock deduction logic unchanged.
 */
export async function postSale(req, res, { Sales, SaleItems, Users, db }) {
  try {
    let created_by
    try {
      created_by = await resolveInventoryCreatedBy(req, Users)
    } catch (e) {
      return res.status(400).json({
        success: false,
        error: {
          code: e.code || "INV_USER_MISSING",
          message:
            e.message ||
            "Cannot create sale: no inventory user for created_by. Upsert JWT user into inventory users or send a valid created_by.",
        },
      })
    }

    // … existing validation: type, customer_name, items, admin_id, stock checks …

    const sale = await Sales.create({
      type: req.body.type, // B2B | B2C
      customer_name: req.body.customer_name,
      customer_phone: req.body.customer_phone || null,
      company_name: req.body.company_name || null,
      gst_number: req.body.gst_number || null,
      tax_amount: req.body.tax_amount ?? 0,
      discount_amount: req.body.discount_amount ?? 0,
      notes: req.body.notes || null,
      admin_id: req.body.admin_id || null,
      created_by, // MUST be a real inventory users.id
      // … remaining existing columns …
    })

    // … create SaleItems, deduct admin stock, serials, etc. …
    void SaleItems
    void db

    return res.status(201).json({ success: true, data: sale })
  } catch (err) {
    // Map raw FK to clear error (do not return opaque SYS_001 / 500 with only PG text)
    const msg = String(err?.message || "")
    if (/sales_created_by_fkey/i.test(msg)) {
      return res.status(400).json({
        success: false,
        error: {
          code: "INV_USER_MISSING",
          message:
            "sales.created_by is not a valid inventory users.id. Upsert JWT into users or honor body created_by.",
        },
      })
    }
    throw err
  }
}

/**
 * QA
 * ---
 * 1. Quotation Admin → Inventory → Agent → New B2B Sale → Record Sale → **201**
 * 2. SELECT s.id, s.created_by FROM sales s
 *    JOIN users u ON u.id = s.created_by
 *    WHERE s.id = '<new-sale-id>';  → 1 row
 * 3. No sales_created_by_fkey in response
 * 4. Body created_by with valid users.id accepted when JWT user missing
 * 5. After first successful sale, SELECT users WHERE id = '<jwt-sub>' → row exists (upsert path)
 *
 * SQL check for orphans:
 *   SELECT s.id, s.created_by
 *   FROM sales s
 *   LEFT JOIN users u ON u.id = s.created_by
 *   WHERE s.created_by IS NOT NULL AND u.id IS NULL;
 */
