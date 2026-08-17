/**
 * Directory of users Admin granted Quotation access.
 * HR Select/Manage dealers must include visitors/ops with Quotation checkbox,
 * not only rows from GET /hr/dealers or /admin/dealers.
 */
import {
  getAccessOverride,
  hasAccess,
  normalizeAccessList,
  type UserAccessKey,
} from "@/lib/user-access"

const STORAGE_KEY = "quotationAssignableDirectory"

export type AssignableQuotationProfile = {
  id: string
  username: string
  firstName: string
  lastName: string
  email?: string
  mobile?: string
  isActive?: boolean
  role?: string
  access: UserAccessKey[]
}

function readAll(): Record<string, AssignableQuotationProfile> {
  if (typeof window === "undefined") return {}
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}")
    if (!parsed || typeof parsed !== "object") return {}
    return parsed as Record<string, AssignableQuotationProfile>
  } catch {
    return {}
  }
}

function writeAll(map: Record<string, AssignableQuotationProfile>) {
  if (typeof window === "undefined") return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
}

function normalizeAccessUsername(username?: string | null): string {
  return String(username || "")
    .trim()
    .toLowerCase()
    .replace(/@+$/, "")
}

export function upsertAssignableQuotationUser(profile: {
  id?: string
  username?: string
  firstName?: string
  lastName?: string
  email?: string
  mobile?: string
  isActive?: boolean
  role?: string
  access?: unknown
  permissions?: unknown
}) {
  const username = normalizeAccessUsername(profile.username)
  if (!username) return

  const access = normalizeAccessList(profile.access ?? profile.permissions)
  const override = getAccessOverride(username)
  const merged = Array.from(new Set([...access, ...override])) as UserAccessKey[]
  const map = readAll()

  if (!hasAccess(merged, "quotation")) {
    delete map[username]
    writeAll(map)
    return
  }

  const prev = map[username]
  map[username] = {
    id: String(profile.id || prev?.id || username),
    username: String(profile.username || username).trim().replace(/@+$/, ""),
    firstName: String(profile.firstName || prev?.firstName || "").trim(),
    lastName: String(profile.lastName || prev?.lastName || "").trim(),
    email: profile.email || prev?.email || "",
    mobile: profile.mobile || prev?.mobile || "",
    isActive: profile.isActive ?? prev?.isActive ?? true,
    role: profile.role || prev?.role,
    access: merged,
  }
  writeAll(map)
}

export function syncAssignableQuotationFromUsers(
  users: Array<{
    id?: string
    username?: string
    firstName?: string
    lastName?: string
    email?: string
    mobile?: string
    isActive?: boolean
    role?: string
    access?: unknown
    permissions?: unknown
  }>,
) {
  for (const user of users) {
    upsertAssignableQuotationUser(user)
  }
}

export function listAssignableQuotationFromDirectory(): AssignableQuotationProfile[] {
  return Object.values(readAll()).filter((u) => u.isActive !== false && hasAccess(u.access, "quotation"))
}
