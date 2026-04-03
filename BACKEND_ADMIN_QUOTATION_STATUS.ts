// @ts-nocheck
/* global Quotation */
// In your server: import { Quotation } from './models/Quotation'

/**
 * =============================================================================
 * BACKEND REFERENCE
 * 1) Admin quotation approval + bank fields + Account Management
 * 2) HR lead upload + DB-backed uploaded-data list + one-by-one assignment
 * =============================================================================
 *
 * Frontend calls (see lib/api.ts):
 *
 *   PATCH /admin/quotations/:quotationId/status
 *   Body when approving:
 *     { status: "approved", paymentType, paymentMode, bankName?, bankIfsc? }
 *   - paymentType and paymentMode are the same value: "loan" | "cash" | "mix"
 *   - For "loan" or "mix", frontend requires bankName + bankIfsc (11-char IFSC)
 *
 *   GET /quotations?status=approved&limit=1000   (Account Management list)
 *   GET /quotations/:id                          (Quotation details dialog)
 *
 *   HR upload/assignment flow:
 *   POST /hr/leads/upload-csv
 *     multipart: file, dealerIds[], activeLimitPerDealer
 *     - frontend now sends activeLimitPerDealer = 1 (single active lead per dealer)
 *   GET /hr/leads/uploads?limit=200
 *     - used by HR "Uploaded Data" tab, must come from DB (not local cache)
 *
 * Each quotation in JSON should expose (camelCase preferred; frontend also reads snake_case):
 *   paymentMode, paymentType (optional), bankName, bankIfsc
 */

const PAYMENT_TYPES = ["loan", "cash", "mix"]
const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/

function normalizePaymentType(raw) {
  if (typeof raw !== "string") return null
  const v = raw.trim().toLowerCase()
  return PAYMENT_TYPES.includes(v) ? v : null
}

function normalizeIfsc(raw) {
  if (typeof raw !== "string") return null
  const v = raw.trim().toUpperCase().replace(/\s/g, "")
  return IFSC_REGEX.test(v) ? v : null
}

/**
 * --- DATABASE: quotations table ---
 *
 * PostgreSQL:
 *   ALTER TABLE quotations ADD COLUMN IF NOT EXISTS bank_name VARCHAR(255);
 *   ALTER TABLE quotations ADD COLUMN IF NOT EXISTS bank_ifsc VARCHAR(11);
 *   -- payment_mode often already exists; ensure it can store loan|cash|mix
 *
 * MySQL:
 *   ALTER TABLE quotations ADD COLUMN bank_name VARCHAR(255) NULL;
 *   ALTER TABLE quotations ADD COLUMN bank_ifsc VARCHAR(11) NULL;
 *
 * Sequelize model (example):
 *   bankName: { type: DataTypes.STRING(255), allowNull: true, field: 'bank_name' },
 *   bankIfsc: { type: DataTypes.STRING(11), allowNull: true, field: 'bank_ifsc' },
 *   paymentMode: { type: DataTypes.STRING(20), allowNull: true, field: 'payment_mode' },
 */

/**
 * PATCH /admin/quotations/:quotationId/status
 */
export async function patchAdminQuotationStatus(req, res) {
  try {
    const user = req.admin ?? req.user
    if (!user || user.role !== "admin") {
      res.status(401).json({ success: false, error: { code: "AUTH_003", message: "Admin required" } })
      return
    }

    const quotationId = req.params.quotationId || req.params.id
    if (!quotationId) {
      res.status(400).json({ success: false, error: { code: "VAL_001", message: "Quotation ID required" } })
      return
    }

    const body = req.body || {}
    const statusRaw = typeof body.status === "string" ? body.status.trim().toLowerCase() : ""
    const allowed = ["pending", "approved", "rejected", "completed"]
    if (!allowed.includes(statusRaw)) {
      res.status(400).json({
        success: false,
        error: { code: "VAL_002", message: `status must be one of: ${allowed.join(", ")}` },
      })
      return
    }

    const quotation = await Quotation.findByPk(quotationId)
    if (!quotation) {
      res.status(404).json({ success: false, error: { code: "RES_001", message: "Quotation not found" } })
      return
    }

    const updates = { status: statusRaw }

    if (statusRaw === "approved") {
      const paymentType =
        normalizePaymentType(body.paymentType) ?? normalizePaymentType(body.paymentMode)
      if (!paymentType) {
        res.status(400).json({
          success: false,
          error: {
            code: "VAL_003",
            message: "paymentType or paymentMode required (loan, cash, mix)",
          },
        })
        return
      }
      updates.paymentMode = paymentType

      if (paymentType === "loan" || paymentType === "mix") {
        const bankName = typeof body.bankName === "string" ? body.bankName.trim() : ""
        const ifsc = normalizeIfsc(body.bankIfsc ?? body.bank_ifsc)
        if (!bankName) {
          res.status(400).json({
            success: false,
            error: { code: "VAL_004", message: "bankName required for loan/mix" },
          })
          return
        }
        if (!ifsc) {
          res.status(400).json({
            success: false,
            error: { code: "VAL_005", message: "Valid 11-char bankIfsc required for loan/mix" },
          })
          return
        }
        updates.bankName = bankName
        updates.bankIfsc = ifsc
      } else {
        updates.bankName = null
        updates.bankIfsc = null
      }
    } else if (statusRaw === "rejected") {
      updates.bankName = null
      updates.bankIfsc = null
      updates.paymentMode = null
    }

    await quotation.update(updates)
    await quotation.reload()

    res.json({
      success: true,
      data: {
        id: quotationId,
        status: quotation.status,
        paymentMode: quotation.paymentMode,
        bankName: quotation.bankName,
        bankIfsc: quotation.bankIfsc,
      },
    })
  } catch (e) {
    console.error(e)
    res.status(500).json({ success: false, error: { code: "SYS_001", message: "Internal error" } })
  }
}

/**
 * --- GET serializers (list + by id) ---
 *
 * Include in every quotation JSON object:
 *   paymentMode  (string | null)
 *   bankName     (string | null)
 *   bankIfsc     (string | null)
 *   paymentType  (optional; frontend falls back to paymentMode)
 *
 * If you use Sequelize `attributes: [...]` whitelist on findAll/findByPk, add:
 *   'bank_name', 'bank_ifsc', 'payment_mode'
 *
 * Example mapper:
 */
export function quotationToApiJson(row) {
  const q = row.get ? row.get({ plain: true }) : row
  return {
    ...q,
    paymentMode: q.paymentMode ?? q.payment_mode ?? null,
    paymentType: q.paymentType ?? q.payment_type ?? q.paymentMode ?? q.payment_mode ?? null,
    bankName: q.bankName ?? q.bank_name ?? null,
    bankIfsc: q.bankIfsc ?? q.bank_ifsc ?? null,
  }
}

/**
 * Route registration (Express example):
 *   router.patch('/admin/quotations/:quotationId/status', adminAuth, patchAdminQuotationStatus)
 */

/**
 * -----------------------------------------------------------------------------
 * HR BACKEND CHANGES (Database-first uploaded data + assignment queue)
 * -----------------------------------------------------------------------------
 *
 * Suggested tables:
 *
 * hr_lead_uploads
 *   id (uuid/pk)
 *   file_name
 *   uploaded_by (hr user id)
 *   uploaded_at
 *   row_count
 *   dealer_ids (json/array)   -- selected dealers at upload time
 *
 * hr_leads
 *   id (uuid/pk)
 *   upload_id (fk -> hr_lead_uploads.id)
 *   name
 *   mobile
 *   alt_mobile
 *   k_number
 *   address
 *   city
 *   state
 *   customer_note
 *   assigned_dealer_id (nullable)
 *   status (queued|assigned|in_progress|rescheduled|completed)
 *   created_at / updated_at
 *
 * Assignment rule required by frontend:
 *   activeLimitPerDealer = 1
 *   -> every selected dealer can hold only one lead in visible state at a time.
 *   -> When you set `assigned_dealer_id`, you MUST also set `status` to:
 *        - `assigned` (dealer sees it in Current Lead tab)
 *        - (or `in_progress` if you want it immediately started)
 *      NEVER leave it as `queued` if the dealer should see it as "Current Lead".
 */

function asArray(value) {
  if (Array.isArray(value)) return value
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? parsed : [value]
    } catch {
      return [value]
    }
  }
  return []
}

/**
 * POST /hr/leads/upload-csv
 * - Store upload metadata in hr_lead_uploads
 * - Store parsed rows in hr_leads
 * - Enforce per-dealer active cap (default 1) when assigning initial rows
 */
export async function postHrLeadsUploadCsv(req, res, db) {
  try {
    const user = req.hr ?? req.user
    if (!user || user.role !== "hr") {
      res.status(401).json({ success: false, error: { code: "AUTH_003", message: "HR required" } })
      return
    }

    const file = req.file
    if (!file) {
      res.status(400).json({ success: false, error: { code: "VAL_001", message: "CSV file required" } })
      return
    }

    const dealerIds = asArray(req.body.dealerIds ?? req.body["dealerIds[]"]).filter(Boolean)
    if (dealerIds.length === 0) {
      res.status(400).json({ success: false, error: { code: "VAL_002", message: "At least one dealerId required" } })
      return
    }

    // Frontend sends 1. Keep safe default to 1 for backend correctness.
    const requestedLimit = Number(req.body.activeLimitPerDealer ?? req.body.activeLeadsLimit)
    const activeLimitPerDealer = Number.isFinite(requestedLimit) && requestedLimit > 0 ? Math.floor(requestedLimit) : 1

    // parseCsvRowsFromFile is backend-specific parser you already use
    const parsedRows = await db.parseCsvRowsFromFile(file.path)
    const parsed = parsedRows.length

    const upload = await db.hrLeadUploads.create({
      fileName: file.originalname || "uploaded.csv",
      uploadedBy: user.id,
      uploadedAt: new Date(),
      rowCount: parsed,
      dealerIds,
    })

    let created = 0
    let skippedDuplicate = 0
    const leadIds = []

    for (const row of parsedRows) {
      const mobile = String(row.mobile || "").replace(/\D/g, "").slice(-10)
      if (!mobile) continue

      const exists = await db.hrLeads.exists({ mobile, uploadId: upload.id })
      if (exists) {
        skippedDuplicate += 1
        continue
      }

      const lead = await db.hrLeads.create({
        uploadId: upload.id,
        name: row.name || "",
        mobile,
        altMobile: row.altMobile || "",
        kNumber: row.kNumber || "",
        address: row.address || "",
        city: row.city || "",
        state: row.state || "",
        customerNote: row.customerNote || "",
        status: "queued",
      })
      leadIds.push(lead.id)
      created += 1
    }

    // Queue allocator (DB-transaction recommended in real impl)
    let assigned = 0
    const activeCountByDealer = new Map()
    for (const dealerId of dealerIds) {
      // Count only leads that are visible/claimable by dealer right now.
      const activeCount = await db.hrLeads.count({ assignedDealerId: dealerId, status: "assigned" })
      activeCountByDealer.set(dealerId, activeCount)
    }

    let dealerCursor = 0
    for (const leadId of leadIds) {
      let allocated = false
      for (let i = 0; i < dealerIds.length; i += 1) {
        const idx = (dealerCursor + i) % dealerIds.length
        const dealerId = dealerIds[idx]
        const currentActive = activeCountByDealer.get(dealerId) || 0
        if (currentActive < activeLimitPerDealer) {
          // Important: frontend "Current Lead" hides status=queued/completed.
          // So assigned leads must be marked `assigned` (or `in_progress`).
          await db.hrLeads.updateById(leadId, { assignedDealerId: dealerId, status: "assigned" })
          activeCountByDealer.set(dealerId, currentActive + 1)
          dealerCursor = (idx + 1) % dealerIds.length
          assigned += 1
          allocated = true
          break
        }
      }
      if (!allocated) {
        // stays queued
      }
    }

    const queued = Math.max(0, created - assigned)

    res.json({
      success: true,
      parsed,
      created,
      assigned,
      queued,
      skippedDuplicate,
      uploadId: upload.id,
    })
  } catch (e) {
    console.error(e)
    res.status(500).json({ success: false, error: { code: "SYS_001", message: "Internal error" } })
  }
}

/**
 * GET /hr/leads/uploads?limit=200
 * Return DB-backed upload history for HR Uploaded Data tab.
 */
export async function getHrLeadsUploads(req, res, db) {
  try {
    const user = req.hr ?? req.user
    if (!user || user.role !== "hr") {
      res.status(401).json({ success: false, error: { code: "AUTH_003", message: "HR required" } })
      return
    }

    const limitRaw = Number(req.query.limit || 50)
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(500, Math.floor(limitRaw))) : 50

    const uploads = await db.hrLeadUploads.findManyWithRows({ limit, orderBy: "uploadedAt_DESC" })

    res.json({
      success: true,
      uploads: uploads.map((u) => ({
        id: u.id,
        uploadedAt: u.uploadedAt,
        fileName: u.fileName,
        rowCount: u.rowCount,
        dealerIds: u.dealerIds || [],
        rows: (u.rows || []).map((r) => ({
          id: r.id,
          name: r.name,
          mobile: r.mobile,
          altMobile: r.altMobile,
          kNumber: r.kNumber,
          address: r.address,
          city: r.city,
          state: r.state,
          customerNote: r.customerNote,
          assignedDealerId: r.assignedDealerId,
          status: r.status,
        })),
      })),
    })
  } catch (e) {
    console.error(e)
    res.status(500).json({ success: false, error: { code: "SYS_001", message: "Internal error" } })
  }
}

/**
 * Additional routes (Express example):
 *   router.post('/hr/leads/upload-csv', hrAuth, upload.single('file'), postHrLeadsUploadCsv)
 *   router.get('/hr/leads/uploads', hrAuth, getHrLeadsUploads)
 */

/**
 * -----------------------------------------------------------------------------
 * CALLING ACTIONS RESPONSE CONTRACT (for Calling Data page)
 * -----------------------------------------------------------------------------
 *
 * Frontend requirement:
 * 1) Status Category, Status, and Remark must come as separate fields from API.
 * 2) Recent Actions must return ALL rows (no fixed slice like 10).
 *
 * Frontend screens using this:
 *   - Dealer Calling Data > Recent Actions
 *   - Dealer Calling Data > Interested
 *
 * Expected response source keys (any one works):
 *   recentActions | actionHistory | completedActions
 */

export function parseTaggedCallRemark(rawRemark) {
  const raw = String(rawRemark || "").trim()
  if (!raw) return { statusCategory: null, status: null, remark: null }

  // Format saved by frontend: [Category] Status | optional free remark
  const match = raw.match(/^\[([^\]]+)\]\s*([^|]*?)\s*(?:\|\s*(.*))?$/)
  if (!match) {
    return { statusCategory: null, status: null, remark: raw }
  }

  const statusCategory = (match[1] || "").trim() || null
  const status = (match[2] || "").trim() || null
  const remark = (match[3] || "").trim() || null
  return { statusCategory, status, remark }
}

/**
 * Allowed backend statusCategory enum values.
 */
export const ALLOWED_STATUS_CATEGORIES = [
  "call_connectivity",
  "lead_validity",
  "customer_intent",
  "financial",
  "competition",
  "schedule",
  "other",
]

const STATUS_CATEGORY_ALIASES = {
  // UI labels (legacy/frontend display labels) -> backend enum keys
  "Part 1 — Call & lead quality": "call_connectivity",
  "Part 2 — Interest & qualification": "customer_intent",
  "Part 3 — Follow-up & sales": "schedule",
  "Part 4 — Rejection / lost": "competition",
  // keep raw keys idempotent
  call_connectivity: "call_connectivity",
  lead_validity: "lead_validity",
  customer_intent: "customer_intent",
  financial: "financial",
  competition: "competition",
  schedule: "schedule",
  other: "other",
}

export function normalizeStatusCategory(rawCategory) {
  const clean = String(rawCategory || "").trim()
  if (!clean) return null
  const mapped = STATUS_CATEGORY_ALIASES[clean] || clean
  return ALLOWED_STATUS_CATEGORIES.includes(mapped) ? mapped : null
}

/**
 * Action serializer (use this in /dealers/me/calling-queue/next and related APIs)
 */
export function callingActionToApiJson(row) {
  const a = row.get ? row.get({ plain: true }) : row
  const parsed = parseTaggedCallRemark(a.callRemark ?? a.call_remark)
  return {
    ...a,
    // Keep legacy combined field for compatibility
    callRemark: a.callRemark ?? a.call_remark ?? null,

    // New explicit fields required by frontend
    statusCategory: a.statusCategory ?? a.status_category ?? parsed.statusCategory,
    status: a.statusText ?? a.status_text ?? parsed.status ?? a.status ?? null,
    remark: a.remark ?? parsed.remark ?? null,

    // Required in Calling Data > Recent Actions card
    kNumber: a.kNumber ?? a.k_number ?? a.lead?.kNumber ?? a.lead?.k_number ?? null,
    address: a.address ?? a.leadAddress ?? a.lead_address ?? a.lead?.address ?? null,
  }
}

/**
 * GET /dealers/me/calling-queue/next
 * IMPORTANT backend behavior:
 * - Do not hard-cap action history to 10.
 * - Return full action history by default OR support client-controlled pagination.
 *
 * Recommended:
 *   const limit = req.query.limit ? clamp(Number(req.query.limit), 1, 5000) : 1000
 *   // If you must paginate, also return pagination metadata and let frontend request more.
 *
 * Response shape example:
 * {
 *   success: true,
 *   currentLead: {...},
 *   scheduledLeads: [...],
 *   recentActions: actionRows.map(callingActionToApiJson),  // no fixed 10-row slice
 *   counts: { pending, queued, scheduled, completed }
 * }
 */
/**
 * IMPORTANT UI requirement ("Submit Status should update same card"):
 * - The UI expects `recentActions` to contain at most ONE item per `leadId`.
 * - When dealer clicks "Submit Status" again for the same lead, backend must update
 *   the latest action state, not append another history item that would create
 *   a second card for the same customer/lead.
 *
 * Implementation options:
 * 1) If you store "latest state" in `dealerCallingLeads` (recommended),
 *    then GET should derive `recentActions` from that single-row-per-lead state.
 * 2) If you store full history in a separate table, then GET `/calling-queue/next`
 *    must return only the latest history row per `leadId` (e.g. DISTINCT ON or
 *    group-by leadId order by updatedAt/actionAt desc).
 *
 * Also set a stable identifier:
 * - Prefer `recentActions[i].id = leadId` (or `${dealerId}-${leadId}`) so React
 *   doesn't treat updates as new cards.
 *
 * IMPORTANT data mapping:
 * - Ensure each action row has lead details available for serializer:
 *   - k_number / kNumber
 *   - address
 * - If these are stored in leads table (not action table), include join in query:
 *     action JOIN lead ON action.lead_id = lead.id
 * - If you use Sequelize attributes whitelist, include:
 *     action attrs: ['id','lead_id','action','action_at','call_remark','status_category','status_text','remark','next_follow_up_at']
 *     lead attrs:   ['id','name','mobile','k_number','address','city','state']
 */

/**
 * PATCH /dealers/me/calling-queue/:leadId/action
 *
 * Frontend behavior (Calling Data page):
 * - "Submit Status" sends:
 *     {
 *       action: "called" | "follow_up" | "not_interested" | "rescheduled",
 *       callRemark: "[Status Category] Status | optional free remark",
 *       nextFollowUpAt?: ISO string,
 *       actionAt?: ISO string
 *     }
 *
 * Backend MUST:
 * - Parse payload.callRemark using parseTaggedCallRemark()
 * - Persist values separately:
 *     status_category   (or statusCategory)
 *     status_text       (or status)
 *     remark            (free text only, without tags)
 * - Keep legacy callRemark column updated (optional but recommended):
 *     call_remark = `[${status_category}] ${status_text}${remark ? " | "+remark : ""}`
 *
 * If you currently store only callRemark text, you can still pass these
 * values through by parsing during GET responses (parse on the fly).
 */
export async function patchDealerCallingQueueAction(req, res, db) {
  try {
    const dealer = req.dealer ?? req.user
    if (!dealer) {
      res.status(401).json({ success: false, error: { code: "AUTH_003", message: "Dealer required" } })
      return
    }

    const leadId = req.params.leadId || req.params.id
    if (!leadId) {
      res.status(400).json({ success: false, error: { code: "VAL_001", message: "Lead id required" } })
      return
    }

    const body = req.body || {}
    const action = body.action

    // For "start" actions, callRemark may be missing.
    const parsed = parseTaggedCallRemark(body.callRemark ?? body.call_remark)
    const normalizedCategory = normalizeStatusCategory(parsed.statusCategory)

    // Suggested DB fields on hr/dealer calling leads table:
    //   status_category, status_text, remark
    const updates = {
      action,
      nextFollowUpAt: body.nextFollowUpAt ?? null,
      actionAt: body.actionAt ?? new Date(),
    }

    if (body.callRemark || body.call_remark) {
      if (!normalizedCategory) {
        res.status(400).json({
          success: false,
          error: {
            code: "VAL_001",
            message: `Invalid statusCategory. Allowed values: ${ALLOWED_STATUS_CATEGORIES.join(",")}`,
          },
        })
        return
      }

      updates.status_category = normalizedCategory
      updates.status_text = parsed.status
      updates.remark = parsed.remark

      // Maintain legacy combined string if you have the column.
      updates.call_remark = `[${normalizedCategory}] ${parsed.status}${parsed.remark ? ` | ${parsed.remark}` : ""}`
    }

    // Persist:
    // - MUST update the "latest action state" for this leadId (so GET de-duplicates by leadId)
    // - If you keep a separate history table, upsert the "latest" record (unique by leadId)
    //   rather than always inserting new rows for the same lead.
    await db.dealerCallingLeads.updateById(leadId, updates)

    const updatedRow = await db.dealerCallingLeads.findById(leadId)
    res.json({
      success: true,
      lead: callingActionToApiJson(updatedRow),
    })
  } catch (e) {
    console.error(e)
    res.status(500).json({ success: false, error: { code: "SYS_001", message: "Internal error" } })
  }
}

/**
 * Suggested DB columns (recommended):
 * - status_category   VARCHAR(...)
 * - status_text       VARCHAR(...)
 * - remark             TEXT / VARCHAR(...)
 *
 * Legacy fallback:
 * - If you only have call_remark, you may still return statusCategory/status/remark
 *   in GET responses by parsing call_remark on the server (parseTaggedCallRemark()).
 */

/**
 * -----------------------------------------------------------------------------
 * TRANSITION RULE UPDATE (fix "Invalid lead action transition" in Recent Actions)
 * -----------------------------------------------------------------------------
 *
 * Problem:
 * - Existing transition validator often allows only queue flow:
 *     assigned/in_progress -> called/follow_up/not_interested/rescheduled
 * - But Recent Actions cards are already completed/history rows, so editing status there
 *   can trigger LEAD_005 "Invalid lead action transition".
 *
 * Required backend behavior:
 * - Support an EDIT path for already-acted leads from Recent Actions.
 * - If lead belongs to current dealer and exists, allow updating:
 *     status_category, status_text, remark, call_remark, next_follow_up_at, action, action_at
 *   even when current status is completed/rescheduled.
 *
 * Recommended validation:
 * 1) Keep strict transition for current queue actions (`start` / first completion).
 * 2) Add "edit mode" for recent action updates:
 *    - Trigger when payload contains callRemark or status fields for an already-acted lead
 *    - Validate dealer ownership
 *    - Perform UPDATE (not INSERT) on latest row for that lead
 *    - Return updated row via callingActionToApiJson
 *
 * Pseudo-code:
 *   const lead = findLeadById(leadId)
 *   if (!lead || lead.dealerId !== dealer.id) -> LEAD_004
 *   const isEditMode = lead.status in ["completed","rescheduled"] || body.editMode === true
 *   if (isEditMode) {
 *     update latest action fields and return success
 *   } else {
 *     apply existing strict transition matrix
 *   }
 *
 * This removes false LEAD_005 failures from Recent Actions status edits.
 */

/**
 * -----------------------------------------------------------------------------
 * DEALER QUEUE REFRESH RULES (fix: HR uploaded leads not appearing for dealer)
 * -----------------------------------------------------------------------------
 *
 * Symptom:
 * - HR uploads new leads and assigns dealer pool.
 * - Dealer has completed previous leads.
 * - Dealer page still shows no new lead until hard refresh.
 *
 * Backend requirements:
 * 1) `/api/dealers/me/calling-queue/next` must always compute latest assignable lead
 *    from DB state (do not rely on stale in-memory cache).
 *
 * 2) Allocation on HR upload:
 *    - If dealer has active count < activeLimitPerDealer, assign immediately.
 *    - Newly assigned lead must have deterministic status visible to dealer:
 *        status in ('assigned','in_progress') for immediate pickup.
 *      Do NOT leave it as status='queued', because dealer "Current Lead"
 *      UI hides queued/completed items and depends on assigned/in_progress/rescheduled.
 *
 * 3) Completion flow:
 *    - On dealer action completion, allocator should attempt to attach next queued lead
 *      to same dealer (work-queue model) in same transaction if possible.
 *
 * 4) Socket events after assignment changes (recommended):
 *    Emit at least one of:
 *      - `calling:uploads-updated`
 *      - `calling:actions-updated`
 *      - `backend:mutation` with domain/path containing leads/calling
 *    so clients can refresh without manual reload.
 *
 * 5) Query consistency:
 *    - Ensure `/next` query filters by authenticated dealer id and valid statuses.
 *    - Recommended ordering: assignedAt ASC, createdAt ASC.
 *    - Recommended indexes:
 *        (assigned_dealer_id, status, assigned_at)
 *        (status, created_at)
 *
 * Example selection logic:
 *   SELECT * FROM calling_leads
 *   WHERE assigned_dealer_id = :dealerId
 *     AND status IN ('assigned','in_progress','rescheduled')
 *     AND (next_follow_up_at IS NULL OR next_follow_up_at <= NOW())
 *   ORDER BY COALESCE(assigned_at, created_at) ASC
 *   LIMIT 1;
 */

/**
 * -----------------------------------------------------------------------------
 * DEALER CALLING FLOW CONTRACT (Current Lead -> Dialled -> Connected/Not Connected)
 * -----------------------------------------------------------------------------
 *
 * Frontend UI flow now expects these stages and editable data tabs:
 *   1) Current Lead
 *   2) Dialled
 *   3) Connected
 *   4) Not Connected
 *
 * Backend MUST support:
 * - One active current lead per dealer from `/dealers/me/calling-queue/next`.
 * - Full editable history rows in dialled/connected/not-connected tabs.
 * - Update of existing rows from any tab (not only current queue step).
 *
 * -----------------------------------------------------------------------------
 * A) Canonical stage classification
 * -----------------------------------------------------------------------------
 *
 * Derive stage primarily from `status_text` (or parsed call_remark):
 *
 * NOT_CONNECTED:
 *   "Call Unanswered", "Switched Off", "Not Reachable", "Busy / Line Busy",
 *   "Call Disconnected", "Wrong Number", "Invalid Number", "Number Does Not Exist"
 *
 * CONNECTED:
 *   all other valid status_text values
 *
 * DIALLED:
 *   any row with action in ('called','follow_up','not_interested','rescheduled')
 *
 * CURRENT_LEAD:
 *   row from queue selector (assigned/in_progress/rescheduled due)
 *
 * -----------------------------------------------------------------------------
 * B) Required fields in action/list payload
 * -----------------------------------------------------------------------------
 *
 * For every action row returned in recentActions/actionHistory/completedActions:
 *   id, leadId, action, actionAt, nextFollowUpAt,
 *   statusCategory, status, remark, callRemark,
 *   name, mobile, kNumber, address, city, state
 *
 * Note:
 * - `statusCategory` must be backend enum key (normalized):
 *     call_connectivity | lead_validity | customer_intent | financial |
 *     competition | schedule | other
 * - `status` maps to displayed status text (e.g. "Interested", "Call Unanswered")
 * - `remark` is free text only
 *
 * -----------------------------------------------------------------------------
 * C) PATCH update behavior from all tabs
 * -----------------------------------------------------------------------------
 *
 * Endpoint:
 *   PATCH /api/dealers/me/calling-queue/:leadId/action
 *
 * Must allow updates from:
 * - Current lead step
 * - Dialled tab edit
 * - Connected tab edit
 * - Not Connected tab edit
 *
 * Implementation rule:
 * - If lead belongs to dealer, UPDATE latest row/state for that lead.
 * - Do not reject valid tab edits with transition-only guard.
 * - Preserve strict transition only for first-time queue movement if needed.
 *
 * -----------------------------------------------------------------------------
 * D) Flow action mapping (recommended)
 * -----------------------------------------------------------------------------
 *
 * Not Connected path:
 * - statusCategory: call_connectivity
 * - action: not_interested
 * - outcome: closed
 *
 * Connected -> Interested:
 * - statusCategory: customer_intent (or schedule when moved to visit/sales step)
 * - action: called
 *
 * Connected -> Not Interested:
 * - statusCategory: competition
 * - action: not_interested
 *
 * Connected -> Decision Pending (hold + reschedule):
 * - statusCategory: schedule
 * - action: rescheduled (preferred) OR follow_up
 * - nextFollowUpAt required
 *
 * -----------------------------------------------------------------------------
 * E) Optional grouped response helper
 * -----------------------------------------------------------------------------
 *
 * To reduce frontend filtering, backend may return:
 * {
 *   currentLead: {...},
 *   dialledActions: [...],
 *   connectedActions: [...],
 *   notConnectedActions: [...],
 *   recentActions: [...]
 * }
 *
 * If not provided, frontend can still derive from recentActions.
 */
