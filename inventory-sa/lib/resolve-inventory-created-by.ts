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

/**
 * Quotation Admin JWT `sub` is often missing from inventory `users`, so
 * `POST /products` fails with:
 *   products_created_by_fkey
 *
 * Returns an inventory `users.id` the backend can use for `created_by`, or null
 * when the JWT user already exists in inventory (backend can use JWT sub).
 */
export async function resolveInventoryCreatedByForWrite(): Promise<string | null> {
  const me = authService.getUser()
  if (!me?.id) return null

  // JWT user already in inventory users → no override needed.
  try {
    await usersApi.getById(me.id)
    return null
  } catch {
    // Expected for quotation-admin sessions that were never synced into inventory users.
  }

  let catalog: User[] = []
  try {
    catalog = asUserList(await usersApi.getAll())
  } catch {
    try {
      catalog = asUserList(await usersApi.getAll("super-admin"))
    } catch {
      try {
        catalog = asUserList(await usersApi.getAll("admin"))
      } catch {
        return null
      }
    }
  }

  if (catalog.length === 0) return null

  const username = String(me.username || "")
    .trim()
    .toLowerCase()
  if (username) {
    const byUsername = catalog.find(
      (u) => String(u.username || "").trim().toLowerCase() === username && u.id,
    )
    if (byUsername?.id) return String(byUsername.id)
  }

  const preferred = catalog.find((u) => {
    const role = String(u.role || "")
      .toLowerCase()
      .replace(/_/g, "-")
    return (
      (role === "super-admin" || role === "superadmin" || role === "admin") &&
      u.is_active !== false &&
      u.id
    )
  })
  return preferred?.id ? String(preferred.id) : null
}
