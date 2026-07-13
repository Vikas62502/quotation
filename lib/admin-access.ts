import type { UserRole } from "@/lib/auth-context"

/** Backend role strings that mean quotation Admin Panel access. */
export function isBackendAdminLikeRole(raw: unknown): boolean {
  const r = String(raw || "")
    .toLowerCase()
    .replace(/_/g, "-")
    .trim()
  return r === "admin" || r === "super-admin" || r === "superadmin"
}

/** Map API role → app UserRole for admin / super-admin (else null). */
export function mapBackendRoleToAdminUserRole(raw: unknown): "admin" | "super-admin" | null {
  const r = String(raw || "")
    .toLowerCase()
    .replace(/_/g, "-")
    .trim()
  if (r === "admin") return "admin"
  if (r === "super-admin" || r === "superadmin") return "super-admin"
  return null
}

/** True when the signed-in user may use Admin Panel + Super Admin Inventory. */
export function isQuotationAdminAccess(opts: {
  role?: UserRole | string | null
  username?: string | null
}): boolean {
  const role = String(opts.role || "")
    .toLowerCase()
    .replace(/_/g, "-")
  if (role === "admin" || role === "super-admin" || role === "superadmin") return true
  if (String(opts.username || "").toLowerCase() === "admin") return true
  return false
}

/**
 * Inventory effective role for Super Admin Inventory panel (§AD).
 * Quotation Admin JWT is treated as super-admin on inventory APIs — no second login.
 */
export function resolveInventoryEffectiveRole(
  quotationRole: unknown,
  loginUser?: {
    inventoryRole?: string
    inventory_role?: string
    inventoryAccess?: boolean
    inventory_access?: boolean
    requiresInventoryLogin?: boolean
    requires_inventory_login?: boolean
  } | null
): "super-admin" | "admin" | null {
  const fromBackend =
    mapBackendRoleToAdminUserRole(loginUser?.inventoryRole) ||
    mapBackendRoleToAdminUserRole(loginUser?.inventory_role)
  if (fromBackend === "super-admin" || fromBackend === "admin") {
    // Backend grants quotation Admin inventory as super-admin
    return "super-admin"
  }

  const mapped = mapBackendRoleToAdminUserRole(quotationRole)
  if (!mapped) return null
  // Both admin and super-admin open the same Super Admin Inventory with full scope
  return "super-admin"
}

/** Backend / login payload says this session can open Inventory without /inventory-auth/login. */
export function canUseInventoryWithoutRelogin(loginUser?: {
  inventoryAccess?: boolean
  inventory_access?: boolean
  requiresInventoryLogin?: boolean
  requires_inventory_login?: boolean
  role?: string
} | null): boolean {
  if (!loginUser) return false
  if (loginUser.requiresInventoryLogin === true || loginUser.requires_inventory_login === true) {
    return false
  }
  if (loginUser.inventoryAccess === true || loginUser.inventory_access === true) return true
  return isBackendAdminLikeRole(loginUser.role)
}

export type InventoryAuthUserPayload = {
  id: string
  username: string
  name: string
  role: "super-admin" | "admin"
  is_active?: boolean
  inventoryAccess?: boolean
  requiresInventoryLogin?: boolean
  authSource?: "quotation-admin" | "inventory-user" | "super-admin"
}

/** Build inventory-sa auth_user from quotation login (same JWT, no re-login). */
export function buildInventoryAuthUserFromQuotationSession(opts: {
  id: string
  username: string
  firstName?: string
  lastName?: string
  name?: string
  role: unknown
  isActive?: boolean
  loginUser?: Record<string, unknown> | null
}): InventoryAuthUserPayload {
  const effective =
    resolveInventoryEffectiveRole(opts.role, opts.loginUser as any) || "super-admin"
  const name =
    opts.name ||
    [opts.firstName, opts.lastName].filter(Boolean).join(" ").trim() ||
    opts.username
  const quotationAdmin = mapBackendRoleToAdminUserRole(opts.role) === "admin"
  return {
    id: opts.id,
    username: opts.username,
    name,
    role: effective,
    is_active: opts.isActive ?? true,
    inventoryAccess: true,
    requiresInventoryLogin: false,
    authSource: quotationAdmin ? "quotation-admin" : "super-admin",
  }
}
