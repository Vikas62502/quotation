/**
 * Installation / Metering / Final confirmation / report field permissions (read vs write + scope).
 * Separate from dashboard `access[]` checkboxes in Admin → Users.
 */

export const OFFICE_LOCATIONS = ["Jaipur", "Ajmer", "Chomu"] as const
export type OfficeLocation = (typeof OFFICE_LOCATIONS)[number]

export type WorkflowModuleKey =
  | "accounts"
  | "installation"
  | "metering"
  | "final_confirmation"
  | "visitor_reports"
  | "calling_reports"

export type ModulePermissionScope =
  | "everyone"
  | "selected_users"
  | "office_only"

export type ModulePermissionLevel = "none" | "read" | "write"

export type ModulePermissionRule = {
  level: ModulePermissionLevel
  scope: ModulePermissionScope
  selectedUserIds: string[]
}

export type ModuleFieldPermissions = Partial<Record<WorkflowModuleKey, ModulePermissionRule>>

export const MODULE_PERMISSION_STORAGE_KEY = "userModulePermissionOverrides"
export const OFFICE_LOCATION_STORAGE_KEY = "userOfficeLocationOverrides"

/** Visitor / Calling reports are view-only in Admin → Users (no write level). */
export const ALWAYS_READ_ONLY_WORKFLOW_MODULES: ReadonlySet<WorkflowModuleKey> = new Set([
  "visitor_reports",
  "calling_reports",
])

export function isAlwaysReadOnlyWorkflowModule(module: WorkflowModuleKey): boolean {
  return ALWAYS_READ_ONLY_WORKFLOW_MODULES.has(module)
}

export const MODULE_PERMISSION_SCOPE_OPTIONS: {
  value: ModulePermissionScope
  label: string
  description: string
}[] = [
  {
    value: "everyone",
    label: "Everyone",
    description: "All users with access — dealers included by default",
  },
  {
    value: "selected_users",
    label: "Selected one",
    description: "Only the person(s) you pick below",
  },
  {
    value: "office_only",
    label: "Only there",
    description: "Only the employee’s office (Jaipur, Ajmer, or Chomu)",
  },
]

export function getScopeOptionsForModule(_module: WorkflowModuleKey) {
  return MODULE_PERMISSION_SCOPE_OPTIONS
}

export const WORKFLOW_MODULE_LABELS: Record<WorkflowModuleKey, string> = {
  accounts: "Accounts",
  installation: "Installation",
  metering: "Metering",
  final_confirmation: "Final confirmation",
  visitor_reports: "Visitor Reports",
  calling_reports: "Calling Reports",
}

export const DEFAULT_MODULE_PERMISSION: ModulePermissionRule = {
  level: "write",
  scope: "everyone",
  selectedUserIds: [],
}

function emptyRule(): ModulePermissionRule {
  return { level: "none", scope: "everyone", selectedUserIds: [] }
}

export function normalizeModulePermissionLevel(raw: unknown): ModulePermissionLevel {
  const key = String(raw || "")
    .trim()
    .toLowerCase()
  if (key === "read" || key === "readonly" || key === "read_only") return "read"
  if (key === "write" || key === "edit" || key === "read_write") return "write"
  return "none"
}

export function normalizeModulePermissionScope(raw: unknown): ModulePermissionScope {
  const key = String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
  if (key === "selected_users" || key === "selected" || key === "selected_person" || key === "selected_persons") {
    return "selected_users"
  }
  if (key === "office_only" || key === "office" || key === "only_office" || key === "only_there" || key === "only_thre") {
    return "office_only"
  }
  if (key === "everyone" || key === "all" || key === "everyone_except_dealer") {
    return "everyone"
  }
  return "everyone"
}

export function normalizeModulePermissionRule(raw: unknown): ModulePermissionRule {
  if (!raw || typeof raw !== "object") return { ...emptyRule() }
  const o = raw as Record<string, unknown>
  const selectedRaw = o.selectedUserIds ?? o.selected_user_ids ?? o.userIds ?? o.user_ids
  const selectedUserIds = Array.isArray(selectedRaw)
    ? selectedRaw.map((id) => String(id || "").trim()).filter(Boolean)
    : []
  return {
    level: normalizeModulePermissionLevel(o.level ?? o.access ?? o.permission),
    scope: normalizeModulePermissionScope(o.scope),
    selectedUserIds,
  }
}

export function normalizeModuleFieldPermissions(raw: unknown): ModuleFieldPermissions {
  if (!raw || typeof raw !== "object") return {}
  const o = raw as Record<string, unknown>
  const out: ModuleFieldPermissions = {}
  if (o.accounts != null) out.accounts = normalizeModulePermissionRule(o.accounts)
  if (o.installation != null) out.installation = normalizeModulePermissionRule(o.installation)
  if (o.metering != null) out.metering = normalizeModulePermissionRule(o.metering)
  if (o.final_confirmation != null) out.final_confirmation = normalizeModulePermissionRule(o.final_confirmation)
  if (o.finalConfirmation != null) out.final_confirmation = normalizeModulePermissionRule(o.finalConfirmation)
  if (o.visitor_reports != null) out.visitor_reports = normalizeModulePermissionRule(o.visitor_reports)
  if (o.visitorReports != null) out.visitor_reports = normalizeModulePermissionRule(o.visitorReports)
  if (o.calling_reports != null) out.calling_reports = normalizeModulePermissionRule(o.calling_reports)
  if (o.callingReports != null) out.calling_reports = normalizeModulePermissionRule(o.callingReports)

  // Reports are always view-only — never persist write.
  for (const key of ALWAYS_READ_ONLY_WORKFLOW_MODULES) {
    const rule = out[key]
    if (rule && rule.level === "write") {
      out[key] = { ...rule, level: "read" }
    }
  }
  return out
}

export function normalizeOfficeLocation(raw: unknown): OfficeLocation | "" {
  const s = String(raw || "").trim()
  if (OFFICE_LOCATIONS.includes(s as OfficeLocation)) return s as OfficeLocation
  return ""
}

export function getModulePermissionOverrides(): Record<string, ModuleFieldPermissions> {
  try {
    const raw = localStorage.getItem(MODULE_PERMISSION_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== "object") return {}
    const out: Record<string, ModuleFieldPermissions> = {}
    for (const [username, value] of Object.entries(parsed as Record<string, unknown>)) {
      const key = String(username || "")
        .trim()
        .toLowerCase()
      if (!key) continue
      out[key] = normalizeModuleFieldPermissions(value)
    }
    return out
  } catch {
    return {}
  }
}

export function saveModulePermissionOverride(username: string, permissions: ModuleFieldPermissions) {
  const key = String(username || "")
    .trim()
    .toLowerCase()
  if (!key) return
  const map = getModulePermissionOverrides()
  map[key] = normalizeModuleFieldPermissions(permissions)
  localStorage.setItem(MODULE_PERMISSION_STORAGE_KEY, JSON.stringify(map))
}

export function getModulePermissionOverride(username: string): ModuleFieldPermissions | undefined {
  const key = String(username || "")
    .trim()
    .toLowerCase()
  if (!key) return undefined
  return getModulePermissionOverrides()[key]
}

export function getOfficeLocationOverrides(): Record<string, OfficeLocation> {
  try {
    const raw = localStorage.getItem(OFFICE_LOCATION_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== "object") return {}
    const out: Record<string, OfficeLocation> = {}
    for (const [username, value] of Object.entries(parsed as Record<string, unknown>)) {
      const key = String(username || "")
        .trim()
        .toLowerCase()
      const loc = normalizeOfficeLocation(value)
      if (key && loc) out[key] = loc
    }
    return out
  } catch {
    return {}
  }
}

export function saveOfficeLocationOverride(username: string, officeLocation: OfficeLocation | "") {
  const key = String(username || "")
    .trim()
    .toLowerCase()
  if (!key) return
  const map = getOfficeLocationOverrides()
  if (officeLocation) map[key] = officeLocation
  else delete map[key]
  localStorage.setItem(OFFICE_LOCATION_STORAGE_KEY, JSON.stringify(map))
}

export function resolveUserModulePermissions(
  username: string,
  apiPermissions?: unknown,
): ModuleFieldPermissions {
  const key = String(username || "")
    .trim()
    .toLowerCase()
  const override = key ? getModulePermissionOverride(key) : undefined
  const fromApi = normalizeModuleFieldPermissions(apiPermissions)
  // Per-module: local override wins; otherwise API.
  const merged: ModuleFieldPermissions = { ...fromApi }
  if (override) {
    for (const [mod, rule] of Object.entries(override)) {
      if (rule) (merged as any)[mod] = rule
    }
  }
  return normalizeModuleFieldPermissions(merged)
}

/**
 * Keep Field access in sync with Dashboard access checkboxes.
 * Checked module + missing/none level → write (or read for report-only modules).
 * Unchecked module → level none (preserves scope / selected users).
 */
export function syncModuleFieldPermissionsWithAccess(
  access: readonly string[],
  permissions: ModuleFieldPermissions | null | undefined,
): ModuleFieldPermissions {
  const accessSet = new Set(
    access.map((k) =>
      String(k || "")
        .trim()
        .toLowerCase()
        .replace(/[\s-]+/g, "_"),
    ),
  )
  const modules: WorkflowModuleKey[] = [
    "accounts",
    "installation",
    "metering",
    "final_confirmation",
    "visitor_reports",
    "calling_reports",
  ]
  const next: ModuleFieldPermissions = { ...(permissions || {}) }
  for (const mod of modules) {
    const hasAccess = accessSet.has(mod)
    const current = next[mod]
    if (hasAccess) {
      if (!current || current.level === "none") {
        next[mod] = {
          level: isAlwaysReadOnlyWorkflowModule(mod) ? "read" : "write",
          scope: current?.scope || "everyone",
          selectedUserIds: current?.selectedUserIds || [],
        }
      } else if (isAlwaysReadOnlyWorkflowModule(mod) && current.level === "write") {
        next[mod] = { ...current, level: "read" }
      }
    } else if (current && current.level !== "none") {
      next[mod] = { ...current, level: "none" }
    }
  }
  return next
}

export function resolveUserOfficeLocation(username: string, apiValue?: unknown): OfficeLocation | "" {
  const key = String(username || "")
    .trim()
    .toLowerCase()
  const override = key ? getOfficeLocationOverrides()[key] : undefined
  if (override) return override
  return normalizeOfficeLocation(apiValue)
}

export type ModulePermissionContext = {
  userId?: string
  username?: string
  officeLocation?: OfficeLocation | ""
  recordOfficeLocation?: OfficeLocation | ""
  recordUserId?: string
  viewerIsDealer?: boolean
  viewerIsAdmin?: boolean
}

export function getQuotationWorkflowRecordContext(
  q: Record<string, unknown> | null | undefined,
): Pick<ModulePermissionContext, "recordOfficeLocation" | "recordUserId"> {
  if (!q || typeof q !== "object") return {}
  const dealer = q.dealer as Record<string, unknown> | undefined
  const customer = q.customer as Record<string, unknown> | undefined
  const recordOfficeLocation = normalizeOfficeLocation(
    q.officeLocation ??
      q.office_location ??
      customer?.officeLocation ??
      customer?.office_location,
  )
  const recordUserId = String(
    q.dealerId ??
      q.dealer_id ??
      dealer?.id ??
      q.assignedUserId ??
      q.assigned_user_id ??
      q.createdBy ??
      q.created_by ??
      "",
  ).trim()
  return {
    recordOfficeLocation: recordOfficeLocation || undefined,
    recordUserId: recordUserId || undefined,
  }
}

function scopeAllows(rule: ModulePermissionRule, ctx: ModulePermissionContext): boolean {
  if (ctx.viewerIsAdmin) return true
  if (rule.scope === "everyone") return true
  if (rule.scope === "office_only") return true
  if (rule.scope === "selected_users") return rule.selectedUserIds.length > 0
  return true
}

function recordScopeAllows(rule: ModulePermissionRule, ctx: ModulePermissionContext): boolean {
  if (ctx.viewerIsAdmin) return true

  if (rule.scope === "everyone") {
    return true
  }

  if (rule.scope === "selected_users") {
    if (rule.selectedUserIds.length === 0) return false
    const recordUserId = String(ctx.recordUserId || "").trim()
    if (!recordUserId) return false
    return rule.selectedUserIds.includes(recordUserId)
  }

  if (rule.scope === "office_only") {
    const recordUserId = String(ctx.recordUserId || "").trim()
    const viewerId = String(ctx.userId || "").trim()
    if (ctx.officeLocation && ctx.recordOfficeLocation) {
      return ctx.officeLocation === ctx.recordOfficeLocation
    }
    // "Only there" with no office on record → only the viewer's own dealer rows
    if (viewerId && recordUserId) return recordUserId === viewerId
    return false
  }

  return true
}

/** Everyone scope (or admin) → fetch full approved list (admin / account-management API). */
export function shouldLoadAllAccountsQuotations(
  permissions: ModuleFieldPermissions | undefined,
  ctx: ModulePermissionContext,
): boolean {
  return shouldLoadAllWorkflowQuotations(permissions, "accounts", ctx)
}

/** Everyone scope (or admin) → fetch full quotation list for workflow modules (installation, metering, etc.). */
export function shouldLoadAllWorkflowQuotations(
  permissions: ModuleFieldPermissions | undefined,
  module: WorkflowModuleKey,
  ctx: ModulePermissionContext,
): boolean {
  if (ctx.viewerIsAdmin) return true
  const rule = getModulePermissionRule(permissions, module)
  if (rule.level === "none") return false
  return rule.scope === "everyone"
}

export function canViewWorkflowRecord(
  permissions: ModuleFieldPermissions | undefined,
  module: WorkflowModuleKey,
  ctx: ModulePermissionContext,
): boolean {
  if (ctx.viewerIsAdmin) return true
  const rule = getModulePermissionRule(permissions, module)
  if (rule.level === "none") return false
  if (!scopeAllows(rule, ctx)) return false
  return recordScopeAllows(rule, ctx)
}

export function filterQuotationsByWorkflowPermission<T extends Record<string, unknown>>(
  rows: T[],
  permissions: ModuleFieldPermissions | undefined,
  module: WorkflowModuleKey,
  ctx: ModulePermissionContext,
): T[] {
  return rows.filter((row) =>
    canViewWorkflowRecord(permissions, module, { ...ctx, ...getQuotationWorkflowRecordContext(row) }),
  )
}

export function getModulePermissionRule(
  permissions: ModuleFieldPermissions | undefined,
  module: WorkflowModuleKey,
): ModulePermissionRule {
  return permissions?.[module] ?? { ...DEFAULT_MODULE_PERMISSION }
}

/**
 * Limit dealer / visitor pickers + report rows to Field access scope
 * (Everyone / Selected one / Only there). Full admin → no filter.
 */
export function filterEntitiesByModuleScope<T extends { id: string }>(
  entities: T[],
  permissions: ModuleFieldPermissions | undefined,
  module: WorkflowModuleKey,
  ctx: ModulePermissionContext,
): T[] {
  if (ctx.viewerIsAdmin) return entities
  const rule = getModulePermissionRule(permissions, module)
  if (rule.level === "none") return []
  if (rule.scope === "everyone") return entities
  if (rule.scope === "selected_users") {
    const ids = new Set(rule.selectedUserIds.map((id) => String(id)))
    return entities.filter((e) => ids.has(String(e.id)))
  }
  if (rule.scope === "office_only") {
    const viewerOffice = normalizeOfficeLocation(ctx.officeLocation)
    const viewerId = String(ctx.userId || "").trim()
    if (!viewerOffice) {
      return viewerId ? entities.filter((e) => String(e.id) === viewerId) : []
    }
    return entities.filter((e) => {
      const row = e as T & { officeLocation?: unknown; office_location?: unknown }
      const loc = normalizeOfficeLocation(row.officeLocation ?? row.office_location)
      return loc === viewerOffice
    })
  }
  return entities
}

/** True when a calling-action / visit row’s dealer|visitor id is in the viewer’s Field access scope. */
export function isEntityIdAllowedByModuleScope(
  entityId: string | undefined | null,
  permissions: ModuleFieldPermissions | undefined,
  module: WorkflowModuleKey,
  ctx: ModulePermissionContext,
  /** Precomputed allowed ids when scope is selected_users or office-filtered list. */
  allowedIds?: ReadonlySet<string> | null,
): boolean {
  if (ctx.viewerIsAdmin) return true
  const rule = getModulePermissionRule(permissions, module)
  if (rule.level === "none") return false
  if (rule.scope === "everyone") return true
  const id = String(entityId || "").trim()
  if (!id) return false
  if (allowedIds) return allowedIds.has(id)
  if (rule.scope === "selected_users") return rule.selectedUserIds.includes(id)
  return true
}

export function canViewWorkflowModule(
  permissions: ModuleFieldPermissions | undefined,
  module: WorkflowModuleKey,
  ctx: ModulePermissionContext,
): boolean {
  if (ctx.viewerIsAdmin) return true
  const rule = getModulePermissionRule(permissions, module)
  if (rule.level === "none") return false
  return scopeAllows(rule, ctx)
}

export function canWriteWorkflowModule(
  permissions: ModuleFieldPermissions | undefined,
  module: WorkflowModuleKey,
  ctx: ModulePermissionContext,
): boolean {
  if (ctx.viewerIsAdmin) return true
  const rule = getModulePermissionRule(permissions, module)
  if (rule.level !== "write") return false
  return scopeAllows(rule, ctx)
}

export function isWorkflowModuleReadOnly(
  permissions: ModuleFieldPermissions | undefined,
  module: WorkflowModuleKey,
  ctx: ModulePermissionContext,
): boolean {
  if (ctx.viewerIsAdmin) return false
  const rule = getModulePermissionRule(permissions, module)
  if (rule.level === "read") return scopeAllows(rule, ctx)
  return false
}
