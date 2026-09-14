/**
 * Checkbox dashboard access for operational users.
 * Admin assigns one or more; after login the user only sees granted sections.
 */

export type UserAccessKey =
  | "admin"
  | "quotation"
  | "accounts"
  | "installation"
  | "metering"
  | "final_confirmation"
  | "hr"
  | "visitor"
  | "visitor_reports"
  | "calling_reports"

export type UserAccessOption = {
  key: UserAccessKey
  label: string
  description: string
  href: string
}

export const USER_ACCESS_OPTIONS: UserAccessOption[] = [
  {
    key: "admin",
    label: "Admin",
    description: "Admin panel (dealers, visitors, operations, reports)",
    href: "/dashboard/admin",
  },
  {
    key: "quotation",
    label: "Dealer",
    description: "Dealer dashboard: customers, quotations, payments, calling data",
    href: "/dashboard",
  },
  {
    key: "accounts",
    label: "Accounts",
    description: "Approved quotations and payment management",
    href: "/dashboard/account-management",
  },
  {
    key: "installation",
    label: "Installation",
    description: "Installer workflow and installation teams",
    href: "/dashboard/installer",
  },
  {
    key: "metering",
    label: "Metering",
    description: "Meter process (pending → WCC → install → final step)",
    href: "/dashboard/metering",
  },
  {
    key: "final_confirmation",
    label: "Final confirmation",
    description: "DCR generation, final process, and done",
    href: "/dashboard/baldev",
  },
  {
    key: "hr",
    label: "HR",
    description: "HR leads upload and dealer assignment",
    href: "/dashboard/hr",
  },
  {
    key: "visitor",
    label: "Visitor",
    description: "Visitor site visits dashboard",
    href: "/visitor/dashboard",
  },
  {
    key: "visitor_reports",
    label: "Visitor Reports",
    description: "View-only visitor site visit reports",
    href: "/dashboard/admin?tab=visitor-reports",
  },
  {
    key: "calling_reports",
    label: "Calling Reports",
    description: "View-only calling action reports",
    href: "/dashboard/admin?tab=calling-reports",
  },
]

/** Admin → Users create/edit checkboxes. Admin access is not granted from this form. */
export const ASSIGNABLE_USER_ACCESS_OPTIONS: UserAccessOption[] = USER_ACCESS_OPTIONS.filter(
  (option) => option.key !== "admin",
)

const ACCESS_SET = new Set<string>(USER_ACCESS_OPTIONS.map((o) => o.key))

const STORAGE_KEY = "userAccessOverrides"

/** Prefer this role when creating a user for backends that still require a single `role`. */
const PRIMARY_ROLE_PRIORITY: UserAccessKey[] = [
  "admin",
  "accounts",
  "installation",
  "metering",
  "final_confirmation",
  "hr",
  "visitor",
  "visitor_reports",
  "calling_reports",
  "quotation",
]

const ACCESS_TO_BACKEND_ROLE: Partial<Record<UserAccessKey, string>> = {
  admin: "admin",
  accounts: "account-management",
  installation: "installer",
  metering: "metering",
  final_confirmation: "baldev",
  hr: "hr",
  visitor: "visitor",
  // visitor_reports / calling_reports are not primary roles — omit so they never become role "admin"
  quotation: "dealer",
}

export function normalizeAccessList(raw: unknown): UserAccessKey[] {
  if (!Array.isArray(raw)) return []
  const out: UserAccessKey[] = []
  const seen = new Set<string>()
  for (const item of raw) {
    const key = String(item || "")
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, "_")
    const mapped =
      key === "account_management" || key === "account" || key === "payments"
        ? "accounts"
        : key === "installer" || key === "install"
          ? "installation"
          : key === "baldev" || key === "final" || key === "confirmation"
            ? "final_confirmation"
            : key === "dealer" || key === "quotations"
              ? "quotation"
              : key === "visitor_report" || key === "visitorreports" || key === "visitor_reports_tab"
                ? "visitor_reports"
                : key === "calling_report" || key === "callingreports" || key === "calling_reports_tab"
                  ? "calling_reports"
                  : key
    if (!ACCESS_SET.has(mapped) || seen.has(mapped)) continue
    seen.add(mapped)
    out.push(mapped as UserAccessKey)
  }
  return out
}

/** New SPA keys — older API Zod enums often omit these and return "Invalid option: expected one of …". */
export const REPORT_ONLY_ACCESS_KEYS: readonly UserAccessKey[] = [
  "visitor_reports",
  "calling_reports",
]

/** Access safe to send when the live API has not shipped report keys yet. */
export function accessWithoutReportOnlyKeys(access: UserAccessKey[]): UserAccessKey[] {
  return normalizeAccessList(access).filter((k) => !REPORT_ONLY_ACCESS_KEYS.includes(k))
}

/** True when API rejected `access` / enum (Zod: Invalid option: expected one of "admin"|…). */
export function looksLikeAccessEnumValidationMessage(text: string): boolean {
  const m = String(text || "")
  if (/Invalid option:\s*expected one of/i.test(m)) return true
  if (/visitor_reports|calling_reports/i.test(m) && /invalid|expected one of|enum/i.test(m)) return true
  return false
}

export function getAccessOverrides(): Record<string, UserAccessKey[]> {
  if (typeof window === "undefined") return {}
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}")
    if (!parsed || typeof parsed !== "object") return {}
    const out: Record<string, UserAccessKey[]> = {}
    for (const [username, value] of Object.entries(parsed as Record<string, unknown>)) {
      const key = username.trim().toLowerCase()
      if (!key) continue
      out[key] = normalizeAccessList(value)
    }
    return out
  } catch {
    return {}
  }
}

export function saveAccessOverride(username: string, access: UserAccessKey[]) {
  if (typeof window === "undefined") return
  const key = username.trim().toLowerCase().replace(/@+$/, "")
  if (!key) return
  const normalized = normalizeAccessList(access)
  const current = getAccessOverrides()
  current[key] = normalized
  // Also store raw key if Admin username had trailing @
  const raw = username.trim().toLowerCase()
  if (raw && raw !== key) current[raw] = normalized
  localStorage.setItem(STORAGE_KEY, JSON.stringify(current))

  // Keep HR / visit directories in sync whenever Admin checkboxes are saved
  void import("./quotation-assignable-directory").then((m) => {
    m.upsertAssignableQuotationUser({ username: key, access: normalized })
  })
  void import("./visitor-assignable-directory").then((m) => {
    m.upsertAssignableVisitor({ username: key, access: normalized })
  })
}

export function getAccessOverride(username?: string | null): UserAccessKey[] {
  if (!username) return []
  const raw = username.trim().toLowerCase()
  const key = raw.replace(/@+$/, "")
  const all = getAccessOverrides()
  return all[key] || all[raw] || []
}

/** Infer access from a legacy single role string. */
export function accessFromRole(role?: string | null): UserAccessKey[] {
  const r = String(role || "")
    .trim()
    .toLowerCase()
  if (!r) return []
  if (r === "admin" || r === "super-admin" || r === "superadmin") return ["admin"]
  if (r === "dealer") return ["quotation"]
  if (r === "account-management" || r === "accountmanager" || r === "account_manager") return ["accounts"]
  if (r === "installer" || r === "installation" || r === "installation-team") return ["installation"]
  if (r === "metering" || r === "meter" || r === "mco") return ["metering"]
  if (r === "baldev" || r === "confirmation") return ["final_confirmation"]
  if (r === "hr" || r === "human-resources") return ["hr"]
  if (r === "visitor") return ["visitor"]
  return []
}

function isPrimaryAdminAccount(role?: string | null, username?: string | null): boolean {
  const r = String(role || "")
    .trim()
    .toLowerCase()
    .replace(/_/g, "-")
  if (r === "admin" || r === "super-admin" || r === "superadmin") return true
  return String(username || "").trim().toLowerCase() === "admin"
}

/**
 * Resolve granted access for a user.
 * Union of local override + API access/permissions (so report keys saved locally are not lost).
 * Primary admin accounts always get Admin Panel only (no Quotation / workspace).
 */
export function resolveUserAccess(input: {
  username?: string | null
  role?: string | null
  access?: unknown
  permissions?: unknown
}): UserAccessKey[] {
  if (isPrimaryAdminAccount(input.role, input.username)) {
    return ["admin"]
  }

  const fromOverride = getAccessOverride(input.username)
  const fromApi = normalizeAccessList(input.access ?? input.permissions)
  const merged = normalizeAccessList([...fromOverride, ...fromApi])
  if (merged.length > 0) return merged

  return accessFromRole(input.role)
}

export function hasAccess(access: UserAccessKey[] | null | undefined, key: UserAccessKey): boolean {
  if (!access || access.length === 0) return false
  return access.includes(key)
}

/**
 * Directory / dropdown eligibility from Admin access checkboxes.
 * Prefer stored access / local override; fall back to legacy role only when access is empty.
 */
export function listedUserHasAccess(
  input: {
    username?: string | null
    role?: string | null
    access?: unknown
    permissions?: unknown
    isActive?: boolean | null
  },
  key: UserAccessKey,
  options?: { allowInactive?: boolean },
): boolean {
  if (!options?.allowInactive && input.isActive === false) return false
  return hasAccess(resolveUserAccess(input), key)
}

/** True if session access grants the section, or legacy single-role still matches. */
export function canOpenSection(
  access: UserAccessKey[] | null | undefined,
  role: string | null | undefined,
  key: UserAccessKey,
): boolean {
  if (hasAccess(access, key)) return true
  const fromRole = accessFromRole(role)
  return fromRole.includes(key)
}

export function getAccessOptions(access: UserAccessKey[]): UserAccessOption[] {
  const set = new Set(access)
  return USER_ACCESS_OPTIONS.filter((o) => set.has(o.key))
}

/**
 * When Admin grants Visitor/Calling Reports via Field access but the API Zod
 * stripped those keys from `access[]`, restore them from moduleFieldPermissions.
 */
export function mergeAccessFromModulePermissions(
  access: UserAccessKey[],
  modulePermissions: Partial<
    Record<"visitor_reports" | "calling_reports", { level?: string } | null | undefined>
  > | null | undefined,
): UserAccessKey[] {
  const next = normalizeAccessList(access)
  if (!modulePermissions) return next
  const add = (key: UserAccessKey) => {
    if (!next.includes(key)) next.push(key)
  }
  const visitorLevel = String(modulePermissions.visitor_reports?.level || "")
    .trim()
    .toLowerCase()
  const callingLevel = String(modulePermissions.calling_reports?.level || "")
    .trim()
    .toLowerCase()
  if (visitorLevel && visitorLevel !== "none") add("visitor_reports")
  if (callingLevel && callingLevel !== "none") add("calling_reports")
  return next
}

/** Session access for nav / workspace: resolve + restore report keys from Field access. */
export function resolveEffectiveAccess(input: {
  username?: string | null
  role?: string | null
  access?: unknown
  permissions?: unknown
  modulePermissions?: Partial<
    Record<"visitor_reports" | "calling_reports", { level?: string } | null | undefined>
  > | null
}): UserAccessKey[] {
  return mergeAccessFromModulePermissions(resolveUserAccess(input), input.modulePermissions)
}

/** Backend single-role field for create API compatibility. */
export function primaryBackendRoleFromAccess(access: UserAccessKey[]): string {
  const normalized = normalizeAccessList(access)
  for (const key of PRIMARY_ROLE_PRIORITY) {
    if (normalized.includes(key) && ACCESS_TO_BACKEND_ROLE[key]) {
      return ACCESS_TO_BACKEND_ROLE[key] as string
    }
  }
  return "account-management"
}

/** App UserRole used in auth-context session. */
export function primaryAppRoleFromAccess(access: UserAccessKey[]): string {
  const backend = primaryBackendRoleFromAccess(access)
  if (backend === "admin") return "admin"
  if (backend === "dealer") return "dealer"
  return backend
}

/**
 * Where to send the user after login.
 * Admin → Admin Panel directly (never workspace).
 * One grant → that section. Multiple → workspace chooser.
 */
export function getPostLoginPath(access: UserAccessKey[]): string {
  const options = getAccessOptions(access)
  if (options.some((o) => o.key === "admin")) return "/dashboard/admin"
  if (options.length === 0) return "/dashboard"
  if (options.length === 1) return options[0].href
  return "/dashboard/workspace"
}

export function readSessionAccess(): UserAccessKey[] {
  if (typeof window === "undefined") return []
  try {
    return normalizeAccessList(JSON.parse(localStorage.getItem("userAccess") || "[]"))
  } catch {
    return []
  }
}

export function writeSessionAccess(access: UserAccessKey[]) {
  if (typeof window === "undefined") return
  localStorage.setItem("userAccess", JSON.stringify(normalizeAccessList(access)))
}

export function clearSessionAccess() {
  if (typeof window === "undefined") return
  localStorage.removeItem("userAccess")
}

export function accessLabels(access: UserAccessKey[]): string[] {
  const map = new Map(USER_ACCESS_OPTIONS.map((o) => [o.key, o.label]))
  return access.map((k) => map.get(k) || k)
}
