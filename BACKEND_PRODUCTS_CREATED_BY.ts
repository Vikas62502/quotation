// @ts-nocheck
/**
 * =============================================================================
 * BACKEND REFERENCE — Fix products_created_by_fkey (Jul 2026)
 * =============================================================================
 *
 * Handoff section: BACKEND_CHANGES_HANDOFF.md §14
 *
 * Frontend:
 *   - Quotation Admin → Accounts → Open Super Admin → Add Product / Tally import
 *   - `inventory-sa/lib/api.ts` → `productsApi.create`
 *   - `inventory-sa/lib/resolve-inventory-created-by.ts` (sends created_by fallback)
 *
 * Live error:
 *   insert or update on table "products" violates foreign key constraint
 *   "products_created_by_fkey"
 *   code: SYS_001
 *
 * Cause:
 *   Quotation POST /auth/login JWT is reused on inventory API.
 *   POST /products sets created_by = jwt.sub / req.user.id
 *   That id is NOT in inventory `users` → FK fails.
 *
 * =============================================================================
 * REQUIRED CHANGE (minimum)
 * =============================================================================
 *
 * Before every Products.create / INSERT that sets created_by:
 *   created_by = await resolveInventoryCreatedBy(req)
 *
 * Never write jwt.sub into products.created_by unless that id exists in
 * inventory `users` (or you upsert it first).
 *
 * Also honor body:
 *   created_by | createdBy   (frontend may send a valid inventory users.id)
 *
 * Return real errors (400 INV_USER_MISSING) — not bare SYS_001 "Server error".
 *
 * Apply the same resolver anywhere else you set products.created_by
 * (bulk import, admin create, etc.).
 */

/**
 * Resolve a valid inventory `users.id` for products.created_by.
 * Adapt Users / Products models to your ORM.
 */
export async function resolveInventoryCreatedBy(req, Users) {
  const jwtId = String(req.user?.id || req.user?.sub || "").trim()
  const username = String(req.user?.username || "").trim()
  const roleRaw = String(req.user?.role || "super-admin")
    .toLowerCase()
    .replace(/_/g, "-")
  const inventoryRole =
    roleRaw === "admin" || roleRaw === "super-admin" || roleRaw === "superadmin"
      ? "super-admin"
      : "super-admin"

  // 1) JWT id already in inventory users
  if (jwtId) {
    const byId = await Users.findByPk(jwtId)
    if (byId) return byId.id
  }

  // 2) Valid body override from SPA
  const bodyId = String(req.body?.created_by || req.body?.createdBy || "").trim()
  if (bodyId) {
    const byBody = await Users.findByPk(bodyId)
    if (byBody) return byBody.id
  }

  // 3) Same username already in inventory users
  if (username) {
    const byName = await Users.findOne({ where: { username } })
    if (byName) return byName.id
  }

  // 4) Upsert inventory user from quotation JWT (permanent fix)
  if (jwtId) {
    const [row] = await Users.findOrCreate({
      where: { id: jwtId },
      defaults: {
        id: jwtId,
        username: username || `quotation-${jwtId.slice(0, 8)}`,
        name: req.user?.name || req.user?.firstName || username || "Quotation Admin",
        role: inventoryRole,
        is_active: true,
        // Auth is quotation JWT — password not used for this bridge user
        password_hash: "!",
      },
    })
    return row.id
  }

  // 5) Last resort: any active super-admin / admin
  const sa =
    (await Users.findOne({
      where: { role: "super-admin", is_active: true },
      order: [["created_at", "ASC"]],
    })) ||
    (await Users.findOne({
      where: { role: "admin", is_active: true },
      order: [["created_at", "ASC"]],
    }))
  if (sa) return sa.id

  const err = new Error(
    "No inventory user available for products.created_by. Upsert quotation Admin into inventory users.",
  )
  err.status = 400
  err.code = "INV_USER_MISSING"
  throw err
}

/**
 * Pseudocode — wire into existing POST /products handler.
 */
export async function createProductHandler(req, res, { Users, Products }) {
  try {
    const user = req.user
    const role = String(user?.role || "")
      .toLowerCase()
      .replace(/_/g, "-")
    if (!["admin", "super-admin", "superadmin"].includes(role)) {
      return res.status(403).json({
        success: false,
        code: "AUTH_003",
        error: "Admin or Super Admin role required",
      })
    }

    const created_by = await resolveInventoryCreatedBy(req, Users)

    // Parse serial_numbers if present (JSON string or array) — optional on create
    let serialNumbers = req.body?.serial_numbers
    if (typeof serialNumbers === "string" && serialNumbers.trim()) {
      try {
        serialNumbers = JSON.parse(serialNumbers)
      } catch {
        /* keep string / ignore */
      }
    }

    const product = await Products.create({
      name: req.body.name,
      model: req.body.model,
      category: req.body.category,
      wattage: req.body.wattage || null,
      quantity: Number(req.body.quantity) || 0,
      unit: req.body.unit || "NOS",
      unit_price: Number(req.body.unit_price) || 0,
      default_price:
        req.body.default_price !== undefined ? Number(req.body.default_price) : undefined,
      selling_price:
        req.body.selling_price !== undefined ? Number(req.body.selling_price) : undefined,
      created_by, // MUST be a real inventory users.id
    })

    // Attach serials if provided (or SPA will PUT /products/:id next)
    if (Array.isArray(serialNumbers) && serialNumbers.length > 0) {
      // existing serial insert logic…
      void serialNumbers
    }

    return res.status(201).json({ success: true, data: product })
  } catch (error) {
    const status = error.status || 500
    return res.status(status).json({
      success: false,
      code: error.code || (status === 500 ? "SYS_001" : "BAD_REQUEST"),
      error: error.message || "Failed to create product",
    })
  }
}

/**
 * Optional one-time SQL check (run as ops):
 *
 * -- JWT sub that failed create:
 * SELECT id, username, role, is_active FROM users WHERE id = '<jwt-sub>';
 * -- If 0 rows → this bug. After fix, row should exist or created_by elsewhere.
 *
 * -- Orphan check:
 * SELECT p.id, p.name, p.created_by
 * FROM products p
 * LEFT JOIN users u ON u.id = p.created_by
 * WHERE p.created_by IS NOT NULL AND u.id IS NULL;
 */

/**
 * QA checklist
 * 1. Quotation Admin login → Open Super Admin → Tally import / Add Product → 201/200
 * 2. No products_created_by_fkey in response
 * 3. SELECT users WHERE id = jwt.sub  → 1 row (after upsert) OR created_by = other valid user
 * 4. Inventory-native super-admin create still works
 * 5. Body created_by with valid users.id is accepted when JWT user missing
 * 6. Error path returns INV_USER_MISSING / real message — not only "Server error"
 */

export default {
  resolveInventoryCreatedBy,
  createProductHandler,
}
