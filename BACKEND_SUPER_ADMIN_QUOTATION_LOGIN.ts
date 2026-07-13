// @ts-nocheck
/**
 * =============================================================================
 * BACKEND REFERENCE — Super Admin on Quotation Admin Login + Inventory data
 * =============================================================================
 *
 * Frontend (Jul 2026):
 *   - Login: `app/login/page.tsx` + `lib/auth-context.tsx` → `login()`
 *   - Access helper: `lib/admin-access.ts`
 *   - Admin Panel: `app/dashboard/admin/page.tsx` (Accounts tab → Inventory card)
 *   - Inventory UI: `app/dashboard/inventory/page.tsx`
 *                 `components/inventory/super-admin-inventory-panel.tsx`
 *
 * Goal:
 *   1. Quotation `/login` must accept **super-admin** users (same form as admin/dealer).
 *   2. Returned JWT + `user.role` must open Admin Panel and Super Admin Inventory.
 *   3. Same Bearer token must authorize **all** inventory Super Admin APIs and
 *      return **full** datasets (products, users, stock requests, sales, returns).
 *
 * -----------------------------------------------------------------------------
 * 1) Auth — POST /api/auth/login
 * -----------------------------------------------------------------------------
 *
 * Request (unchanged):
 *   { "username": "...", "password": "..." }
 *
 * Success must include:
 *   {
 *     "token": "<JWT>",
 *     "refreshToken": "<optional>",
 *     "user": {
 *       "id": "...",
 *       "username": "...",
 *       "firstName": "...",
 *       "lastName": "...",
 *       "email": "...",
 *       "role": "super-admin",   // REQUIRED — not "dealer"
 *       "isActive": true,
 *       ...
 *     }
 *   }
 *
 * Accepted role strings (normalize to hyphen form in JWT + response):
 *   - "super-admin"   (preferred)
 *   - "superadmin"
 *   - "super_admin"   (map → "super-admin" in response)
 *
 * Also keep existing:
 *   - "admin" → Admin Panel (same privileges for quotation admin routes)
 *
 * Frontend maps via `mapBackendRoleToAdminUserRole()`:
 *   admin        → role "admin"
 *   super-admin  → role "super-admin"
 *
 * Reject inactive users (isActive / is_active === false) with 401/403.
 *
 * -----------------------------------------------------------------------------
 * 2) JWT claims
 * -----------------------------------------------------------------------------
 *
 * JWT payload MUST include a role claim readable by middleware, e.g.:
 *   { "sub": "<userId>", "role": "super-admin", ... }
 *
 * Quotation Admin Panel routes that currently allow `admin` MUST also allow
 * `super-admin` (same as admin). Examples:
 *   GET  /api/admin/quotations
 *   GET  /api/admin/dealers
 *   GET  /api/admin/customers
 *   GET  /api/admin/visits
 *   PATCH /api/admin/quotations/:id/...
 *   (and any other /admin/* used by Admin Panel)
 *
 * Do NOT require username === "admin". Frontend no longer gates on that alone.
 *
 * -----------------------------------------------------------------------------
 * 3) Shared token for Inventory APIs (critical)
 * -----------------------------------------------------------------------------
 *
 * Frontend stores quotation login token in `localStorage.authToken` and reuses it
 * for inventory calls (`Authorization: Bearer <token>`).
 *
 * API base URL (frontend): `NEXT_PUBLIC_API_URL` or
 *   https://api.inventory.chairbordsolar.com/api
 *
 * Backend options (pick one and document):
 *
 *   A) **Same auth service** — JWT from POST /auth/login is valid on inventory
 *      routes (/products, /users, /stock-requests, …). Preferred.
 *
 *   B) **Bridge** — POST /auth/login for super-admin returns a token that inventory
 *      middleware already trusts (same signing secret / issuer).
 *
 *   C) **Do not** force a second inventory-only login for Super Admin from this SPA.
 *
 * If inventory previously required POST /inventory-auth/login only, either:
 *   - Accept quotation /auth/login JWT on inventory routes for role super-admin|admin, OR
 *   - Make /auth/login issue the same token shape inventory already validates.
 *
 * -----------------------------------------------------------------------------
 * 4) Inventory authorization — role allow-list
 * -----------------------------------------------------------------------------
 *
 * CRITICAL (Jul 2026): Quotation **Admin** (`role: "admin"` from POST /auth/login)
 * MUST be allowed on inventory Super Admin Inventory routes — same as `super-admin`.
 *
 * SPA flow: Admin Panel → Accounts → Open Inventory uses the quotation Admin JWT.
 *
 * LOCAL EVIDENCE (api.inventory.chairbordsolar.com — quotation Admin session):
 *   GET /products                         → 200  (works)
 *   GET /users?role=admin                 → 401  Invalid token or user inactive
 *   GET /users                            → 401
 *   GET /users/agents                     → 401
 *   GET /sales                            → 401
 *   GET /stock-requests                   → 401
 *   GET /stock-returns                    → 401
 *   GET /admin-inventory                  → 401
 *   GET /admin/users                      → 404  Route not found (DO NOT USE — SPA uses /users)
 *
 * That is a backend bug: align allow-list with /products for all SA routes above.
 *
 * Allow roles on inventory SA APIs:
 *   - admin          ← quotation Admin login (REQUIRED)
 *   - super-admin    ← super admin login (REQUIRED)
 *   - superadmin / super_admin (normalize to super-admin)
 *
 * Deny: dealer, agent, account-management, visitor, installer, etc. → 403.
 *
 * Do NOT require a separate /inventory-auth/login for quotation Admin.
 * Do NOT reject quotation Admin with "Invalid token or user inactive" when
 * the JWT is valid and user.isActive / is_active is true.
 * Do NOT invent /admin/users — use GET /users?role=admin.
 *
 * Endpoints used by frontend (must return data for admin AND super-admin):
 *
 * | Method | Path | Purpose |
 * |--------|------|---------|
 * | GET | /products | Full catalog + central qty |
 * | POST | /products | Add product |
 * | PUT | /products/:id | Edit / selling price |
 * | DELETE | /products/:id | Delete product |
 * | GET | /users?role=admin | All admins — MUST allow quotation admin JWT |
 * | GET | /users?role=agent or /users/agents | All agents |
 * | POST | /users | Create admin / agent / account |
 * | PUT | /users/:id | Activate / deactivate |
 * | GET | /stock-requests | All requests |
 * | POST | /stock-requests | Create request on behalf of admin |
 * | POST | /stock-requests/:id/dispatch | Approve / reject / dispatch |
 * | GET | /admin-inventory/admin/:adminId | Stock for selected admin |
 * | GET | /admin-inventory/admin/:adminId/serials/:productId | Serials |
 * | GET | /sales | All sales |
 * | POST | /sales | B2B / B2C sale |
 * | PUT | /sales/:id | Approve sale |
 * | GET | /stock-returns?status=pending | Pending returns |
 * | POST | /stock-returns/:id/process | Process return |
 *
 * **Data scope for admin + super-admin:** return **all** rows (every admin’s
 * stock requests, all products, all sales).
 *
 * -----------------------------------------------------------------------------
 * 5) Example middleware snippet
 * -----------------------------------------------------------------------------
 */

function normalizeRole(raw) {
  return String(raw || "")
    .toLowerCase()
    .replace(/_/g, "-")
    .trim()
}

/** Quotation Admin Panel + Inventory Super Admin Inventory (Accounts → Open Inventory) */
function isQuotationAdminOrSuperAdmin(role) {
  const r = normalizeRole(role)
  return r === "admin" || r === "super-admin" || r === "superadmin"
}

/** Express-style guard for quotation /admin/* routes */
function requireQuotationAdmin(req, res, next) {
  const role = req.user?.role || req.auth?.role
  if (!isQuotationAdminOrSuperAdmin(role)) {
    return res.status(403).json({
      success: false,
      error: { code: "AUTH_003", message: "Admin or Super Admin role required" },
    })
  }
  return next()
}

/**
 * Guard for inventory APIs used by Super Admin Inventory panel.
 * Quotation Admin JWT MUST pass — same allow-list as super-admin.
 */
function requireInventoryAdminAccess(req, res, next) {
  const role = req.user?.role || req.auth?.role
  if (!isQuotationAdminOrSuperAdmin(role)) {
    return res.status(403).json({
      success: false,
      error: {
        code: "AUTH_003",
        message: "Admin or Super Admin role required for inventory",
      },
    })
  }
  // Optional: only reject when DB says inactive — never for missing inventory-only row
  // if quotation Admin is authenticated via shared JWT.
  if (req.user && req.user.is_active === false) {
    return res.status(401).json({
      success: false,
      error: { code: "AUTH_004", message: "Invalid token or user inactive" },
    })
  }
  return next()
}

/**
 * Apply requireInventoryAdminAccess to ALL of:
 *   /users*, /sales*, /stock-requests*, /stock-returns*, /admin-inventory*, /products*
 *
 * Fix for current bug (local console):
 *   - GET /products → 200 with quotation Admin JWT
 *   - GET /users, /sales, /stock-requests, /stock-returns, /admin-inventory → 401
 *   - GET /admin/users → 404 (ignore; SPA does not call this)
 *   - Align every SA route to requireInventoryAdminAccess (admin | super-admin)
 */

/**
 * -----------------------------------------------------------------------------
 * 6) Checklist
 * -----------------------------------------------------------------------------
 *
 * - [ ] POST /auth/login succeeds for admin + super-admin
 * - [ ] GET /users?role=admin with quotation Admin JWT → 200 (not 401)
 * - [ ] GET /users/agents, /sales, /stock-requests, /stock-returns, /admin-inventory → 200
 * - [ ] Same allow-list as GET /products
 * - [ ] Do NOT return "Invalid token or user inactive" for active quotation Admin
 * - [ ] Do NOT require GET /admin/users
 *
 * -----------------------------------------------------------------------------
 * 7) QA curls
 * -----------------------------------------------------------------------------
 *
 *   curl -sS -X POST "$API/auth/login" -H "Content-Type: application/json" \
 *     -d '{"username":"admin","password":"..."}'
 *   TOKEN=...
 *
 *   curl -sS -o /dev/null -w "%{http_code}\n" "$API/products" -H "Authorization: Bearer $TOKEN"
 *   # 200
 *
 *   curl -sS "$API/users?role=admin" -H "Authorization: Bearer $TOKEN"
 *   # 200 + list — NOT 401 Invalid token or user inactive
 *
 *   for p in /users/agents /sales /stock-requests "/stock-returns?status=pending" /admin-inventory; do
 *     curl -sS -o /dev/null -w "$p %{http_code}\n" "$API$p" -H "Authorization: Bearer $TOKEN"
 *   done
 *   # Expect 200 each
 *
 * Frontend QA:
 *   1. /login as Admin → Accounts → Open Inventory
 *   2. No amber §AD warning; Admins load; Sales/Requests tabs load without 401
 *   3. Hard refresh keeps session (no /inventory-auth/login)
 *
 * Related: BACKEND_CHANGES_REQUIRED.md §AD.5.1, BACKEND_CHANGES_HANDOFF.md §12
 */
