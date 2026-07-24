// @ts-nocheck
/**
 * =============================================================================
 * BACKEND REFERENCE — Calling queue /current 500 + FCFS next lead (Jul 2026)
 * =============================================================================
 *
 * Handoff: BACKEND_CHANGES_HANDOFF.md §15 (+ §3 LEAD_004)
 *
 * Frontend:
 *   - Dealer → Calling Data (`app/dashboard/calling-data/page.tsx`)
 *   - `lib/api.ts` → `getCallingQueueNext` / `getCallingQueueCurrent`
 *     (falls back across calling-queue | lead-queue and next | current on 404/500)
 *
 * Live bug:
 *   GET /api/dealers/me/calling-queue/current → 500 SYS_001 "Internal server error"
 *   → UI shows "No calling data pending for you." even when Unassigned > 0.
 *
 * Product goal (Jul 2026):
 *   HR Uploaded Data Unassigned badges must go to **0** first by assigning remaining
 *   rows to the batch dealer pool (round-robin). Then dealers work Assigned → Completed.
 *   See POST /hr/leads/uploads/:id/assign-unassigned in BACKEND_ADMIN_QUOTATION_STATUS.ts
 *   and upload assignmentMode=round_robin_all.
 *
 * =============================================================================
 * REQUIRED ENDPOINTS
 * =============================================================================
 *
 * Auth: dealer JWT (dealers.id = req.user.id / req.dealer.id)
 *
 * GET /api/dealers/me/calling-queue/next
 * GET /api/dealers/me/calling-queue/current
 *
 * Optional aliases (SPA also tries):
 *   /api/dealers/me/lead-queue/next
 *   /api/dealers/me/lead-queue/current
 *
 * =============================================================================
 * MUST NOT 500
 * =============================================================================
 *
 * `/current` and `/next` must always return **200** JSON (or **404** if route missing).
 * Never wrap null lead / missing join as uncaught exception → SYS_001.
 *
 * Empty queue is success:
 *   { success: true, lead: null, queue: [], pendingCount: 0, ... }
 *
 * Common crash causes to fix:
 *   - .map() on undefined queue
 *   - join dealers/uploads when assigned_dealer_id or upload_id is null
 *   - assuming lead always exists
 *   - reading lead.customer.name when customer is null
 */

const OPEN_STATUSES = new Set(["assigned", "in_progress", "queued", "pending", "open"])
const DONE_STATUSES = new Set(["completed", "done", "closed", "complete"])

function isUnassignedAssignee(value) {
  const s = String(value ?? "").trim().toLowerCase()
  return !s || ["unassigned", "null", "none", "-", "na", "n/a", "pool", "open"].includes(s)
}

function serializeLead(row) {
  if (!row) return null
  return {
    id: row.id,
    name: row.name || row.customer_name || "Unknown",
    mobile: row.mobile || row.phone || "",
    altMobile: row.alt_mobile || row.altMobile || "",
    kNumber: row.k_number || row.kNumber || "",
    address: row.address || "",
    city: row.city || "",
    state: row.state || "",
    status: row.status || "queued",
    assignedDealerId: isUnassignedAssignee(row.assigned_dealer_id) ? null : row.assigned_dealer_id,
    assignedDealerName: row.assigned_dealer_name || null,
    uploadBatchId: row.upload_id || row.uploadBatchId || null,
    eligibleDealerIds: row.eligible_dealer_ids || row.eligibleDealerIds || [],
    queuedAt: row.queued_at || row.created_at || null,
    assignedAt: row.assigned_at || null,
    createdAt: row.created_at || null,
    nextFollowUpAt: row.next_follow_up_at || null,
    callRemark: row.call_remark || null,
  }
}

/**
 * FCFS: oldest open unassigned lead in uploads where dealer is in pool.
 * Adapt table/column names to your schema.
 */
async function findOldestUnassignedForDealer(db, dealerId) {
  // Pseudocode SQL — implement with your ORM:
  //
  // SELECT l.*
  // FROM hr_leads l
  // JOIN hr_lead_uploads u ON u.id = l.upload_id
  // WHERE LOWER(l.status) NOT IN ('completed','done','closed','complete')
  //   AND (l.assigned_dealer_id IS NULL OR TRIM(l.assigned_dealer_id) = ''
  //        OR LOWER(TRIM(l.assigned_dealer_id)) IN ('unassigned','null','none','-','na','n/a','pool','open'))
  //   AND (
  //     u.dealer_ids @> ARRAY[dealerId]::uuid[]   -- or JSON contains
  //     OR l.eligible_dealer_ids @> ARRAY[dealerId]
  //   )
  // ORDER BY COALESCE(l.queued_at, l.created_at) ASC
  // LIMIT 1
  // FOR UPDATE SKIP LOCKED;
  void db
  void dealerId
  return null
}

async function findOpenAssignedToDealer(db, dealerId) {
  // CRITICAL: this is why Harshita sees empty Current Lead while Assigned=37.
  // Must return rows already assigned to THIS dealer — not only pool unassigned.
  //
  // SELECT * FROM hr_leads
  // WHERE assigned_dealer_id = dealerId
  //   AND LOWER(status) IN ('assigned','in_progress','queued','pending')
  // ORDER BY COALESCE(assigned_at, queued_at, created_at) ASC
  // LIMIT 1;
  void db
  void dealerId
  return null
}

/**
 * Allocate lead to dealer (persist assignee) — required so PATCH action does not LEAD_004.
 */
async function claimLeadForDealer(db, lead, dealerId, dealerName) {
  if (!lead) return null
  // UPDATE hr_leads SET
  //   assigned_dealer_id = dealerId,
  //   assigned_dealer_name = dealerName,
  //   assigned_at = NOW(),
  //   status = CASE WHEN status IN ('queued','pending') THEN 'assigned' ELSE status END
  // WHERE id = lead.id
  //   AND (assigned_dealer_id IS NULL OR unassigned OR assigned_dealer_id = dealerId)
  // RETURNING *;
  void db
  void dealerName
  return { ...lead, assigned_dealer_id: dealerId, status: lead.status === "in_progress" ? "in_progress" : "assigned" }
}

function emptyQueuePayload() {
  return {
    success: true,
    lead: null,
    currentLead: null,
    nextLead: null,
    queue: [],
    pendingLeads: [],
    leads: [],
    scheduledLeads: [],
    recentActions: [],
    pendingCount: 0,
    queuedCount: 0,
    scheduledCount: 0,
    completedCount: 0,
    counts: { pending: 0, queued: 0, scheduled: 0, completed: 0 },
  }
}

/**
 * GET /dealers/me/calling-queue/current
 * Thin: return dealer's open in_progress/assigned lead only. Never throw SYS_001.
 */
export async function getCallingQueueCurrent(req, res, { db, getDealerFromJwt }) {
  try {
    const dealer = getDealerFromJwt(req)
    if (!dealer?.id) {
      return res.status(401).json({ success: false, code: "AUTH_001", error: "Unauthorized" })
    }

    const open = await findOpenAssignedToDealer(db, dealer.id)
    const lead = serializeLead(open)
    const payload = emptyQueuePayload()
    payload.lead = lead
    payload.currentLead = lead
    if (lead) {
      payload.queue = [lead]
      payload.leads = [lead]
      payload.pendingLeads = [lead]
      payload.pendingCount = 1
    }
    return res.status(200).json(payload)
  } catch (error) {
    console.error("[calling-queue/current]", error)
    // Still 200 empty rather than SYS_001 — SPA can use /next
    return res.status(200).json(emptyQueuePayload())
  }
}

/**
 * GET /dealers/me/calling-queue/next
 * Source of truth for Calling Data Current Lead + FCFS allocation.
 */
export async function getCallingQueueNext(req, res, { db, getDealerFromJwt }) {
  try {
    const dealer = getDealerFromJwt(req)
    if (!dealer?.id) {
      return res.status(401).json({ success: false, code: "AUTH_001", error: "Unauthorized" })
    }

    // 1) Keep working the open lead
    let row = await findOpenAssignedToDealer(db, dealer.id)

    // 2) Else pull oldest unassigned in pool (FCFS) and claim
    if (!row) {
      const pooled = await findOldestUnassignedForDealer(db, dealer.id)
      if (pooled) {
        row = await claimLeadForDealer(
          db,
          pooled,
          dealer.id,
          [dealer.firstName, dealer.lastName].filter(Boolean).join(" ") || dealer.username,
        )
      }
    }

    const lead = serializeLead(row)
    const payload = emptyQueuePayload()
    payload.lead = lead
    payload.nextLead = lead
    payload.currentLead = lead
    if (lead) {
      payload.queue = [lead]
      payload.leads = [lead]
      payload.pendingLeads = [lead]
      payload.pendingCount = 1
      payload.queuedCount = 1
    }
    // Attach scheduledLeads / recentActions / counts from your existing queries (must not throw)
    return res.status(200).json(payload)
  } catch (error) {
    console.error("[calling-queue/next]", error)
    return res.status(200).json(emptyQueuePayload())
  }
}

/**
 * After PATCH .../action completes a lead — allocate next in same response:
 *   { success: true, lead: completedLead, nextLead: serializeLead(nextRow) }
 *
 * Reclaim stuck assigned (cron or on /next):
 *   UPDATE hr_leads SET assigned_dealer_id = NULL, status = 'queued'
 *   WHERE status IN ('assigned','in_progress')
 *     AND COALESCE(action_at, assigned_at, updated_at) < NOW() - INTERVAL '12 hours';
 */

/**
 * QA
 * 1. GET /calling-queue/current with no open lead → 200 { lead: null } — NOT 500
 * 2. GET /calling-queue/next with Unassigned > 0 and dealer in pool → 200 { lead: {...}, assignedDealerId set }
 * 3. Two concurrent /next for same lead → only one wins (SKIP LOCKED / claim WHERE)
 * 4. Dealer Calling Data shows Current Lead after refresh
 * 5. Complete call → nextLead returned until pool drains (Unassigned/Assigned → 0)
 * 6. POST /hr/leads/uploads/:id/assign-unassigned → Unassigned badge 0 for that upload
 * 7. Upload with assignmentMode=round_robin_all → queuedAtUpload 0
 */

export default {
  getCallingQueueCurrent,
  getCallingQueueNext,
  serializeLead,
  emptyQueuePayload,
}
