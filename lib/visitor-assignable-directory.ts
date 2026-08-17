/**
 * Directory of users Admin granted Visitor access.
 * Used so Schedule Visit dropdown can include dealers/ops with the Visitor
 * checkbox, not only legacy rows from GET /dealers/visitors.
 */
import {
  getAccessOverride,
  hasAccess,
  normalizeAccessList,
  type UserAccessKey,
} from "@/lib/user-access"

const STORAGE_KEY = "visitorAssignableDirectory"

export type AssignableVisitorProfile = {
  id: string
  username: string
  firstName: string
  lastName: string
  email?: string
  mobile?: string
  employeeId?: string
  isActive?: boolean
  access: UserAccessKey[]
}

function readAll(): Record<string, AssignableVisitorProfile> {
  if (typeof window === "undefined") return {}
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}")
    if (!parsed || typeof parsed !== "object") return {}
    return parsed as Record<string, AssignableVisitorProfile>
  } catch {
    return {}
  }
}

function writeAll(map: Record<string, AssignableVisitorProfile>) {
  if (typeof window === "undefined") return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
}

export function upsertAssignableVisitor(profile: {
  id?: string
  username?: string
  firstName?: string
  lastName?: string
  email?: string
  mobile?: string
  employeeId?: string
  isActive?: boolean
  access?: unknown
  permissions?: unknown
}) {
  const username = String(profile.username || "")
    .trim()
    .toLowerCase()
    .replace(/@+$/, "")
  if (!username) return

  const access = normalizeAccessList(profile.access ?? profile.permissions)
  const override = getAccessOverride(username)
  const merged = Array.from(new Set([...access, ...override])) as UserAccessKey[]
  const map = readAll()

  if (!hasAccess(merged, "visitor")) {
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
    employeeId: profile.employeeId || prev?.employeeId,
    isActive: profile.isActive ?? prev?.isActive ?? true,
    access: merged,
  }
  writeAll(map)
}

export function syncAssignableVisitorsFromUsers(
  users: Array<{
    id?: string
    username?: string
    firstName?: string
    lastName?: string
    email?: string
    mobile?: string
    employeeId?: string
    isActive?: boolean
    access?: unknown
    permissions?: unknown
  }>,
) {
  for (const user of users) {
    upsertAssignableVisitor(user)
  }
}

export function listAssignableVisitorsFromDirectory(): AssignableVisitorProfile[] {
  return Object.values(readAll()).filter((u) => u.isActive !== false && hasAccess(u.access, "visitor"))
}
