// @ts-nocheck
/**
 * =============================================================================
 * BACKEND REFERENCE — Admin Users tab + checkbox dashboard access
 * =============================================================================
 *
 * Handoff: BACKEND_USER_ACCESS.md
 * Frontend: Admin → Users (dealers + ops), Edit + access checkboxes, /login
 *
 * Must ship:
 *   A) access JSONB on dealers + account_managers (or shared users)
 *   B) GET  /admin/dealers returns access
 *   C) PUT  /admin/dealers/:id accepts access / permissions
 *   D) GET/POST/PUT /admin/account-managers include access (+ role)
 *   E) POST /auth/login returns user.access (+ JWT)
 *   F) Middleware: allow if role OR access includes section
 *
 * FE Users tab merges:
 *   GET /admin/dealers + GET /admin/account-managers
 *
 * Dealer edit body includes profile fields + access/permissions.
 * Ops create/edit body:
 *   {
 *     username, password, firstName, lastName, email, mobile,
 *     role: "metering",
 *     access: ["quotation", "metering", "accounts"],
 *     permissions: ["quotation", "metering", "accounts"]
 *   }
 *
 * =============================================================================
 */

/**
 * P0 — Zod / Joi for PUT body `access` / `permissions` MUST allow every key below.
 * Live error if missing: `Invalid option: expected one of "admin"|"quotation"|…`
 * (Admin → Users → Update User with Visitor Reports / Calling Reports checked.)
 *
 *   access: z.array(z.enum(ACCESS_KEYS)).min(1)
 *   // or: z.array(z.enum(["admin","quotation",…,"visitor_reports","calling_reports"]))
 */
export const ACCESS_KEYS = [
  "admin",
  "quotation",
  "accounts",
  "installation",
  "metering",
  "final_confirmation",
  "hr",
  "visitor",
  "visitor_reports",
  "calling_reports",
] as const

export type AccessKey = (typeof ACCESS_KEYS)[number]

const ACCESS_SET = new Set(ACCESS_KEYS)

const ACCESS_TO_ROLE: Record<AccessKey, string> = {
  admin: "admin",
  quotation: "dealer",
  accounts: "account-management",
  installation: "installer",
  metering: "metering",
  final_confirmation: "baldev",
  hr: "hr",
  visitor: "visitor",
  // Reports are dashboard grants, not primary roles — keep dealer/ops role intact
  visitor_reports: "dealer",
  calling_reports: "dealer",
}

const PRIMARY_PRIORITY: AccessKey[] = [
  "admin",
  "accounts",
  "installation",
  "metering",
  "final_confirmation",
  "hr",
  "visitor",
  "quotation",
  // visitor_reports / calling_reports last — never preferred as primary role
  "visitor_reports",
  "calling_reports",
]

/** Normalize FE / DB values into canonical access keys. */
export function normalizeAccess(raw: unknown): AccessKey[] {
  if (!Array.isArray(raw)) return []
  const out: AccessKey[] = []
  const seen = new Set<string>()
  for (const item of raw) {
    let key = String(item || "")
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, "_")
    if (key === "account_management" || key === "account" || key === "payments") key = "accounts"
    if (key === "installer" || key === "install") key = "installation"
    if (key === "baldev" || key === "final" || key === "confirmation") key = "final_confirmation"
    if (key === "dealer" || key === "quotations") key = "quotation"
    if (key === "visitor_report" || key === "visitorreports") key = "visitor_reports"
    if (key === "calling_report" || key === "callingreports") key = "calling_reports"
    if (!ACCESS_SET.has(key as AccessKey) || seen.has(key)) continue
    seen.add(key)
    out.push(key as AccessKey)
  }
  return out
}

/** Infer access from legacy single role. */
export function accessFromRole(role?: string | null): AccessKey[] {
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

export function primaryRoleFromAccess(access: AccessKey[]): string {
  const list = normalizeAccess(access)
  for (const key of PRIMARY_PRIORITY) {
    if (list.includes(key)) return ACCESS_TO_ROLE[key]
  }
  return "account-management"
}

export function resolveAccess(userLike: {
  role?: string | null
  access?: unknown
  permissions?: unknown
}): AccessKey[] {
  const fromBody = normalizeAccess(userLike.access ?? userLike.permissions)
  if (fromBody.length > 0) return fromBody
  return accessFromRole(userLike.role)
}

export function canAccessSection(
  user: { role?: string | null; access?: unknown; permissions?: unknown },
  key: AccessKey,
): boolean {
  const access = resolveAccess(user)
  return access.includes(key)
}

/**
 * =============================================================================
 * CREATE — POST /api/admin/account-managers
 * =============================================================================
 */
export async function createAccountManager(req, res) {
  // Auth: admin only (existing middleware)
  const body = req.body || {}
  const access = normalizeAccess(body.access ?? body.permissions)
  const role =
    body.role && String(body.role).trim()
      ? String(body.role).trim()
      : access.length
        ? primaryRoleFromAccess(access)
        : "account-management"

  const finalAccess = access.length ? access : accessFromRole(role)
  if (!finalAccess.length) {
    return res.status(400).json({
      success: false,
      error: { code: "VAL_001", message: "Select at least one dashboard access." },
    })
  }

  // Validate username/email unique, hash password — existing logic
  const user = await User.create({
    username: body.username,
    passwordHash: await hash(body.password),
    firstName: body.firstName,
    lastName: body.lastName,
    email: body.email,
    mobile: body.mobile,
    role,
    access: finalAccess,
    isActive: true,
  })

  return res.status(201).json({
    success: true,
    data: publicUser(user),
    message: "User created successfully",
  })
}

/**
 * =============================================================================
 * UPDATE — PUT /api/admin/account-managers/:id
 * =============================================================================
 */
export async function updateAccountManager(req, res) {
  const user = await User.findById(req.params.id)
  if (!user) {
    return res.status(404).json({
      success: false,
      error: { code: "NOT_001", message: "User not found" },
    })
  }

  const body = req.body || {}
  if (body.firstName != null) user.firstName = body.firstName
  if (body.lastName != null) user.lastName = body.lastName
  if (body.email != null) user.email = body.email
  if (body.mobile != null) user.mobile = body.mobile

  const nextAccess = normalizeAccess(body.access ?? body.permissions)
  if (nextAccess.length > 0) {
    user.access = nextAccess
    if (body.role) user.role = body.role
    else user.role = primaryRoleFromAccess(nextAccess)
  } else if (body.role) {
    user.role = body.role
    if (!user.access?.length) user.access = accessFromRole(body.role)
  }

  await user.save()
  return res.json({ success: true, data: publicUser(user) })
}

/**
 * =============================================================================
 * LIST / GET — always echo access (derive if empty)
 * =============================================================================
 */
export function publicUser(user) {
  const access = resolveAccess(user)
  return {
    id: user.id,
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    mobile: user.mobile,
    role: user.role,
    access,
    permissions: access,
    isActive: user.isActive !== false,
    emailVerified: !!user.emailVerified,
    createdAt: user.createdAt,
    loginCount: user.loginCount || 0,
    lastLogin: user.lastLogin || null,
  }
}

/**
 * =============================================================================
 * LOGIN — POST /api/auth/login
 * =============================================================================
 */
export async function login(req, res) {
  const { username, password } = req.body || {}
  const user = await User.findByUsername(username)
  if (!user || user.isActive === false || !(await verify(password, user.passwordHash))) {
    return res.status(401).json({
      success: false,
      error: { code: "AUTH_001", message: "Invalid username or password" },
    })
  }

  const access = resolveAccess(user)
  // Persist derived access for old rows (optional one-time fill)
  if ((!user.access || !user.access.length) && access.length) {
    user.access = access
    await user.save()
  }

  const token = signJwt({
    sub: user.id,
    role: user.role,
    access,
    username: user.username,
  })

  return res.json({
    token,
    refreshToken: signRefresh(user.id),
    user: publicUser({ ...user.toObject?.() ?? user, access }),
  })
}

/**
 * =============================================================================
 * MIDDLEWARE — replace pure role checks
 * =============================================================================
 *
 * Old:  if (req.user.role !== "metering") return 403 AUTH_004
 * New:  if (!canAccessSection(req.user, "metering")) return 403 AUTH_004
 *
 * Map routes → access key:
 *   /admin/** (quotation admin)     → "admin"
 *   /dealers/**, quotations create  → "quotation"
 *   account-management payments     → "accounts"
 *   installer routes                → "installation"
 *   metering routes                 → "metering"
 *   baldev / final confirmation     → "final_confirmation"
 *   /hr/**                          → "hr"
 *   visitor routes                  → "visitor"
 */
export function requireAccess(key: AccessKey) {
  return (req, res, next) => {
    const jwtUser = req.user // from JWT: { role, access, … }
    if (!jwtUser) {
      return res.status(401).json({
        success: false,
        error: { code: "AUTH_003", message: "Unauthorized" },
      })
    }
    if (!canAccessSection(jwtUser, key)) {
      return res.status(403).json({
        success: false,
        error: {
          code: "AUTH_004",
          message: `Insufficient permissions: requires access "${key}"`,
        },
      })
    }
    next()
  }
}

/**
 * P0 — Admin Users tab (Update User) failing with:
 *   "Insufficient permissions. Admin access required."
 *
 * Cause: routes like PUT /admin/dealers/:id use strict `role === "admin"` only.
 *
 * Fix: use requireAccess("admin") OR canAccessSection(user, "admin") so JWT with
 *   role=admin OR access includes "admin" can update users.
 *
 * Also apply on:
 *   GET/PUT/POST /admin/dealers*
 *   GET/PUT/POST /admin/account-managers*
 *   GET/PUT/POST /admin/visitors*
 *
 * Default list filter: isActive=true (Active only). `?includeInactive=true` for admin toggle.
 *
 * Read vs write (moduleFieldPermissions.level):
 *   read  → GET/list/view only (403 on PATCH/POST mutations)
 *   write → GET + mutations for that module
 *   none  → no module access
 * Scope (everyone / selected_users / office_only) filters WHICH rows are returned.
 *
 * Report dashboards (P0 — REQUIRED §AX):
 *   GET /admin/calling-actions  → requireAnyAccess(["admin","calling_reports","hr"])
 *   GET admin visits / visitor reports → requireAnyAccess(["admin","visitor_reports"])
 *   Do not use role==="admin" only — Calling Reports users get AUTH_004 otherwise.
 *
 * See BACKEND_USER_FIELD_PERMISSIONS.ts + REQUIRED §AR / §AX.
 */
export function requireAdminAccess() {
  return requireAccess("admin")
}


/** Allow several sections (OR). */
export function requireAnyAccess(keys: AccessKey[]) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: { code: "AUTH_003", message: "Unauthorized" },
      })
    }
    if (!keys.some((k) => canAccessSection(req.user, k))) {
      return res.status(403).json({
        success: false,
        error: { code: "AUTH_004", message: "Insufficient permissions" },
      })
    }
    next()
  }
}

/**
 * Example wiring:
 *
 *   router.post("/metering/quotations/:id/details",
 *     auth, requireAccess("metering"), meteringDetails)
 *
 *   router.get("/account-management/quotations",
 *     auth, requireAnyAccess(["accounts", "admin"]), listApproved)
 *
 * Keep accepting legacy role-only JWTs via accessFromRole inside canAccessSection.
 */

/**
 * =============================================================================
 * DEALERS — Users tab (list + edit with access checkboxes)
 * =============================================================================
 *
 * GET /api/admin/dealers
 * PUT /api/admin/dealers/:id
 */

export function publicDealer(dealer) {
  const access = resolveAccess({
    role: dealer.role || "dealer",
    access: dealer.access,
    permissions: dealer.permissions,
  })
  // Username "admin" often used as quotation admin
  const finalAccess =
    access.length > 0
      ? access
      : String(dealer.username || "").toLowerCase() === "admin"
        ? (["admin"] as AccessKey[])
        : (["quotation"] as AccessKey[])

  return {
    id: dealer.id,
    username: dealer.username,
    firstName: dealer.firstName,
    lastName: dealer.lastName,
    email: dealer.email,
    mobile: dealer.mobile,
    gender: dealer.gender,
    dateOfBirth: dealer.dateOfBirth,
    fatherName: dealer.fatherName,
    fatherContact: dealer.fatherContact,
    governmentIdType: dealer.governmentIdType,
    governmentIdNumber: dealer.governmentIdNumber,
    address: dealer.address,
    role: dealer.role || "dealer",
    access: finalAccess,
    permissions: finalAccess,
    officeLocation: dealer.officeLocation || dealer.office_location || null,
    office_location: dealer.officeLocation || dealer.office_location || null,
    // MUST echo — SPA reopens Update User from this (Field access Write/Read only).
    moduleFieldPermissions: dealer.moduleFieldPermissions || dealer.modulePermissions || {},
    modulePermissions: dealer.moduleFieldPermissions || dealer.modulePermissions || {},
    isActive: dealer.isActive !== false,
    emailVerified: !!dealer.emailVerified,
    createdAt: dealer.createdAt,
  }
}

export async function listDealers(req, res) {
  // Auth: requireAccess("admin") — NOT role===admin only
  // Default: Active only. Pass includeInactive=true to include pending/inactive.
  const includeInactive =
    String(req.query.includeInactive || req.query.include_inactive || "").toLowerCase() === "true"
  const where = includeInactive ? {} : { isActive: true }
  const dealers = await Dealer.findAll({ where /* + pagination */ })
  return res.json({
    success: true,
    dealers: dealers.map(publicDealer),
    pagination: { /* existing */ },
  })
}

export async function updateDealer(req, res) {
  // Auth: requireAccess("admin") — allow access[] containing "admin"
  const dealer = await Dealer.findById(req.params.id)
  if (!dealer) {
    return res.status(404).json({
      success: false,
      error: { code: "NOT_001", message: "Dealer not found" },
    })
  }

  const body = req.body || {}

  // Existing profile fields…
  if (body.firstName != null) dealer.firstName = String(body.firstName).trim()
  if (body.lastName != null) dealer.lastName = String(body.lastName).trim()
  if (body.email != null) dealer.email = String(body.email).trim()
  if (body.mobile != null) dealer.mobile = String(body.mobile).trim()
  if (body.gender != null) dealer.gender = body.gender
  if (body.dateOfBirth != null) dealer.dateOfBirth = body.dateOfBirth
  if (body.fatherName != null) dealer.fatherName = String(body.fatherName).trim()
  if (body.fatherContact != null) dealer.fatherContact = body.fatherContact
  if (body.governmentIdType != null) dealer.governmentIdType = body.governmentIdType
  if (body.governmentIdNumber != null) dealer.governmentIdNumber = String(body.governmentIdNumber).trim()
  if (body.address != null) dealer.address = body.address
  if (body.isActive != null) dealer.isActive = !!body.isActive
  if (body.emailVerified != null) dealer.emailVerified = !!body.emailVerified
  if (body.officeLocation != null || body.office_location != null) {
    dealer.officeLocation = body.officeLocation || body.office_location
  }
  if (body.moduleFieldPermissions != null || body.modulePermissions != null) {
    dealer.moduleFieldPermissions = body.moduleFieldPermissions || body.modulePermissions
  }

  // Access checkboxes from Admin → Users → Edit
  const nextAccess = normalizeAccess(body.access ?? body.permissions)
  if (nextAccess.length > 0) {
    dealer.access = nextAccess
  } else if (body.access != null || body.permissions != null) {
    return res.status(400).json({
      success: false,
      error: { code: "VAL_001", message: "access must be a non-empty array of known keys" },
    })
  }

  await dealer.save()
  return res.json({
    success: true,
    data: publicDealer(dealer),
    message: "Dealer updated successfully",
  })
}

/**
 * Dealer self-register — set default access:
 *   dealer.access = ["quotation"]
 */

/**
 * =============================================================================
 * MULTI-ACCESS — Quotation + Visitor while primary role is HR (etc.)
 * =============================================================================
 *
 * FE opens /dashboard and /visitor/dashboard from AccessSwitchBar when
 * access includes "quotation" / "visitor". APIs must allow the same.
 *
 * Example JWT:
 *   { sub, role: "hr", access: ["hr", "quotation", "visitor"] }
 *
 * Wire:
 *   dealerRoutes.use(auth, requireAccess("quotation"))
 *   visitorRoutes.use(auth, requireAccess("visitor"))
 *   hrRoutes.use(auth, requireAccess("hr"))
 *
 * Actor id = req.user.sub (same user creates quotations / receives visits).
 */

export function mountMultiAccessGuards(app) {
  // Pseudocode — adapt to your router
  app.use("/api/dealers/me", auth, requireAccess("quotation"))
  app.use("/api/quotations", auth, requireAnyAccess(["quotation", "admin"]))
  app.use("/api/visitors/me", auth, requireAccess("visitor"))
  app.use("/api/visitors/visits", auth, requireAccess("visitor"))
  app.use("/api/hr", auth, requireAccess("hr"))
}
