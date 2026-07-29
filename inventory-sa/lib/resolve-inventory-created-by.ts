import { authService, type User } from "@/inventory-sa/lib/auth"
import { usersApi } from "@/inventory-sa/lib/api"

function asUserList(raw: unknown): User[] {
  if (Array.isArray(raw)) return raw as User[]
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>
    for (const key of ["users", "data", "items", "results"]) {
      if (Array.isArray(obj[key])) return obj[key] as User[]
    }
    if (obj.data && typeof obj.data === "object" && !Array.isArray(obj.data)) {
      const nested = obj.data as Record<string, unknown>
      if (Array.isArray(nested.users)) return nested.users as User[]
    }
  }
  return []
}

async function loadInventoryUserCatalog(): Promise<User[]> {
  try {
    return asUserList(await usersApi.getAll())
  } catch {
    try {
      return asUserList(await usersApi.getAll("super-admin"))
    } catch {
      try {
        return asUserList(await usersApi.getAll("admin"))
      } catch {
        return []
      }
    }
  }
}

function pickPreferredInventoryUser(catalog: User[], excludeIds: Set<string> = new Set()): User | null {
  const usable = catalog.filter((u) => u?.id && !excludeIds.has(String(u.id)))
  if (usable.length === 0) return null

  const preferred = usable.find((u) => {
    const role = String(u.role || "")
      .toLowerCase()
      .replace(/_/g, "-")
    return (
      (role === "super-admin" ||
        role === "superadmin" ||
        role === "super-admin-manager" ||
        role === "admin") &&
      u.is_active !== false
    )
  })
  return preferred || usable.find((u) => u.is_active !== false) || usable[0] || null
}

/**
 * Quotation Admin JWT `sub` is often missing from inventory `users`, so writes fail with:
 *   products_created_by_fkey / stock_requests_dispatched_by_id_fkey
 *
 * Always returns an inventory `users.id` when one can be resolved (never rely on
 * "omit field → backend uses JWT" — many backends ignore body and still write JWT).
 */
export async function resolveInventoryCreatedByForWrite(
  options?: { excludeIds?: string[] },
): Promise<string | null> {
  const excludeIds = new Set((options?.excludeIds || []).map((id) => String(id || "").trim()).filter(Boolean))
  const me = authService.getUser()

  // Prefer JWT user when they already exist in inventory users.
  if (me?.id && !excludeIds.has(String(me.id))) {
    try {
      await usersApi.getById(me.id)
      return String(me.id)
    } catch {
      // Expected for quotation-admin sessions that were never synced into inventory users.
    }
  }

  const catalog = await loadInventoryUserCatalog()
  if (catalog.length === 0) return null

  const username = String(me?.username || "")
    .trim()
    .toLowerCase()
  if (username) {
    const byUsername = catalog.find(
      (u) =>
        String(u.username || "").trim().toLowerCase() === username &&
        u.id &&
        !excludeIds.has(String(u.id)),
    )
    if (byUsername?.id) return String(byUsername.id)
  }

  const preferred = pickPreferredInventoryUser(catalog, excludeIds)
  return preferred?.id ? String(preferred.id) : null
}
