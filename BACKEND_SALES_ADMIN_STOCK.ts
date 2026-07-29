// @ts-nocheck
/**
 * =============================================================================
 * BACKEND REFERENCE — Agent sale must use admin stock, not central (Jul 2026)
 * =============================================================================
 *
 * Handoff: BACKEND_CHANGES_HANDOFF.md §21
 * Related: BACKEND_SALES_CREATED_BY.ts (§20)
 *
 * Frontend:
 *   Quotation Admin → Inventory → Agent tab
 *   "Sell from admin stock" = selected admin (e.g. CHAIRBORD HEAD OFFICE)
 *   New B2B / B2C Sale → Record Sale
 *
 * Live error (wrong stock bucket):
 *   "Insufficient central inventory for sale"
 *
 * Reality:
 *   UI already shows Available qty from GET /admin-inventory/admin/:adminId
 *   (e.g. PIPE Available: 130). Sale is against THAT admin's stock.
 *
 * Cause:
 *   POST /sales ignores admin_id (or only stores it) and still validates /
 *   deducts products.central_stock. Central may be 0 while admin_inventory
 *   has plenty → false "Insufficient central inventory".
 *
 * REQUIRED:
 *   When body has admin_id (or aliases), validate + deduct admin_inventory
 *   for that admin + product. Do NOT require central stock for this path.
 */

/**
 * Resolve target admin for stock deduction.
 * Frontend sends several aliases for compatibility.
 */
export function resolveSaleAdminId(body = {}) {
  return String(
    body.admin_id ||
      body.adminId ||
      body.sell_from_admin_id ||
      body.stock_admin_id ||
      "",
  ).trim()
}

export function isAdminStockSale(body = {}) {
  if (body.use_admin_stock === true || body.stock_source === "admin") return true
  return Boolean(resolveSaleAdminId(body))
}

/**
 * Example stock check + deduct for POST /sales.
 * Plug into your existing sale create transaction.
 *
 * @param AdminInventory  model/table keyed by (admin_id, product_id) with quantity
 * @param Products        only used when NO admin_id (true central / warehouse sale)
 */
export async function assertAndDeductSaleStock(req, { AdminInventory, Products, transaction }) {
  const items = Array.isArray(req.body?.items) ? req.body.items : []
  const adminId = resolveSaleAdminId(req.body)
  const useAdmin = isAdminStockSale(req.body)

  if (useAdmin && !adminId) {
    const err = new Error("admin_id is required for Agent / admin-stock sales")
    err.code = "SALE_ADMIN_REQUIRED"
    throw err
  }

  for (const raw of items) {
    const productId = String(raw.product_id || raw.productId || "").trim()
    const qty = Number(raw.quantity || 0)
    if (!productId || !(qty > 0)) continue

    if (useAdmin) {
      // ---- ADMIN STOCK PATH (Agent tab / Sell from admin stock) ----
      const row = await AdminInventory.findOne({
        where: { admin_id: adminId, product_id: productId },
        transaction,
        lock: transaction?.LOCK?.UPDATE,
      })
      const available = Number(row?.quantity ?? 0)
      if (!row || available < qty) {
        const err = new Error(
          `Insufficient admin inventory for sale (admin=${adminId}, product=${productId}, need=${qty}, available=${available})`,
        )
        err.code = "INSUFFICIENT_ADMIN_STOCK"
        throw err
      }
      await row.update({ quantity: available - qty }, { transaction })
      // Do NOT touch products.central_stock on this path
    } else {
      // ---- CENTRAL / WAREHOUSE PATH (no admin_id) ----
      const product = await Products.findByPk(productId, {
        transaction,
        lock: transaction?.LOCK?.UPDATE,
      })
      const available = Number(product?.central_stock ?? product?.quantity ?? 0)
      if (!product || available < qty) {
        const err = new Error("Insufficient central inventory for sale")
        err.code = "INSUFFICIENT_CENTRAL_STOCK"
        throw err
      }
      await product.update(
        {
          central_stock: available - qty,
          // keep quantity in sync if you dual-write
          ...(product.quantity != null ? { quantity: available - qty } : {}),
        },
        { transaction },
      )
    }
  }
}

/**
 * Wire into POST /sales (pseudocode):
 *
 *   const t = await db.transaction()
 *   try {
 *     await assertAndDeductSaleStock(req, { AdminInventory, Products, transaction: t })
 *     const created_by = await resolveInventoryCreatedBy(req, Users) // §20
 *     const sale = await Sales.create({ ..., admin_id: resolveSaleAdminId(req.body) || null, created_by }, { transaction: t })
 *     // create sale_items ...
 *     await t.commit()
 *     return res.status(201).json({ success: true, data: sale })
 *   } catch (e) {
 *     await t.rollback()
 *     if (e.code === "INSUFFICIENT_ADMIN_STOCK" || e.code === "INSUFFICIENT_CENTRAL_STOCK") {
 *       return res.status(400).json({ success: false, error: { code: e.code, message: e.message } })
 *     }
 *     throw e
 *   }
 *
 * IMPORTANT:
 *   - Never return "Insufficient central inventory for sale" when admin_id is present.
 *   - Persist sale.admin_id so history / approval know which admin stock was used.
 */

/**
 * QA
 * ---
 * 1. Agent tab → select CHAIRBORD HEAD OFFICE → New B2B Sale
 * 2. Pick product with admin Available > 0 and central_stock = 0
 * 3. Record Sale → 201
 * 4. GET /admin-inventory/admin/:adminId → quantity decreased by sold qty
 * 5. products.central_stock unchanged for that product
 * 6. Without admin_id (true central sale), central check still applies
 */
