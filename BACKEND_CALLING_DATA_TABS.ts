// @ts-nocheck
/**
 * =============================================================================
 * BACKEND REFERENCE — Calling Data tabs + 3-outcome PATCH (Oct 2026)
 * =============================================================================
 *
 * Handoff: BACKEND_CHANGES_HANDOFF.md §63
 * Spec:    BACKEND_CHANGES_REQUIRED.md §BQ  (supersedes mutually exclusive §H / §4.4)
 *
 * Frontend (shipped):
 *   app/dashboard/calling-data/page.tsx
 *   lib/calling-action-summary.ts
 *   lib/calling-remark-payload.ts  (enrichCallingActionPayload)
 *
 * Product:
 *   Scheduled  = Connected + Decision Pending (follow-up)
 *   Dialled    = ALL connected + not-connected, INCLUDING scheduled
 *   Connected  = connected outcomes INCLUDING Decision Pending
 *   Not Connected = not-connected only
 *
 *   Dialled first field: Connected | Not Connected
 *     Connected     → Interested | Not Interested | Decision Pending
 *     Not Connected → Call Unanswered | Busy / Line Busy | …
 *   Scheduled / Connected Update: Interested | Not Interested | Decision Pending
 *   Not Connected tab can PATCH-transfer into Connected (tagged remark + "Transfer Reason:").
 *   SPA no longer sends Part 1–4 category pickers.
 *
 * No new routes. Same:
 *   GET  /api/dealers/me/calling-queue/next
 *   GET  /api/dealers/me/calling-queue/current
 *   PATCH /api/dealers/me/calling-queue/{leadId}/action
 *
 * =============================================================================
 */

const NOT_CONNECTED_STATUSES = new Set([
  "Call Unanswered",
  "Switched Off",
  "Not Reachable",
  "Busy / Line Busy",
  "Call Disconnected",
  "Wrong Number",
  "Invalid Number",
  "Number Does Not Exist",
  "Duplicate Lead",
  "Invalid Lead",
  "Out of Service Area",
  "Incoming Not Available",
])

const DECISION_PENDING_STATUSES = new Set([
  "Callback Scheduled",
  "Follow-up Pending",
  "Callback Later",
  "Follow-up Required",
  "Need More Information",
  "Not Picking on Follow-up",
  "Rescheduled",
])

const NOT_INTERESTED_CONNECTED_STATUSES = new Set([
  "Not Interested",
  "Not Interested Currently",
  "Price Too High",
  "Budget Issue",
  "Trust Issue",
  "Location Not Serviceable",
  "Chose Competitor",
  "No Requirement",
  "Already Installed Solar",
  "Low Electricity Bill",
  "Flat Issue",
  "Apartment Issue",
  "Low Space Issue",
])

export function parseTaggedCallRemark(remark) {
  const raw = String(remark || "").trim()
  if (!raw) return { statusCategory: "", status: "", remark: "" }
  const match = raw.match(/^\[([^\]]+)\]\s*([^|]*?)\s*(?:\|\s*(.*))?$/)
  if (!match) return { statusCategory: "", status: "", remark: raw }
  return {
    statusCategory: (match[1] || "").trim(),
    status: (match[2] || "").trim(),
    remark: (match[3] || "").trim(),
  }
}

export function resolveActionFields(item) {
  const parsed = parseTaggedCallRemark(item.callRemark || item.call_remark)
  return {
    statusCategory: String(item.statusCategory || item.status_category || parsed.statusCategory || "").trim(),
    status: String(item.statusText || item.status_text || parsed.status || "").trim(),
    remark: parsed.remark,
    action: String(item.action || "").toLowerCase().trim(),
    nextFollowUpAt: item.nextFollowUpAt || item.next_follow_up_at || null,
  }
}

/** Connected vs Not Connected — matches dealer tabs. */
export function classifyCallingConnection(item) {
  const { status, statusCategory, action } = resolveActionFields(item)
  const categoryKey = statusCategory.toLowerCase().replace(/[\s-]+/g, "_")
  if (status && NOT_CONNECTED_STATUSES.has(status)) return "not_connected"
  if (categoryKey === "call_connectivity" && status) return "not_connected"
  if (action === "start") return "not_connected"
  if (status) return "connected"
  if (["called", "follow_up", "not_interested", "rescheduled"].includes(action)) return "connected"
  return "not_connected"
}

export function getConnectedOutcomeForStatus(status) {
  const s = String(status || "").trim()
  if (NOT_INTERESTED_CONNECTED_STATUSES.has(s)) return "not_interested"
  if (DECISION_PENDING_STATUSES.has(s)) return "decision_pending"
  return "interested"
}

/**
 * Scheduled tab membership: Connected + Decision Pending.
 * Do NOT put Not Connected reschedules here.
 */
export function isScheduledFollowUp(item) {
  if (classifyCallingConnection(item) !== "connected") return false
  const { status, action, nextFollowUpAt } = resolveActionFields(item)
  if (action === "follow_up" || action === "rescheduled") return true
  if (nextFollowUpAt && (!status || getConnectedOutcomeForStatus(status) === "decision_pending")) return true
  if (!status) return false
  return getConnectedOutcomeForStatus(status) === "decision_pending"
}

export function leadKey(item) {
  return String(item.leadId || item.lead_id || item.id || "").trim()
}

/** Latest action wins per lead (for Connected / Scheduled / Not Connected). */
export function latestActionPerLead(items) {
  const map = new Map()
  for (const item of items) {
    const key = leadKey(item)
    if (!key) continue
    const existing = map.get(key)
    const existingAt = new Date(existing?.actionAt || existing?.action_at || 0).getTime()
    const incomingAt = new Date(item.actionAt || item.action_at || 0).getTime()
    if (!existing || incomingAt >= existingAt) map.set(key, item)
  }
  return [...map.values()]
}

/**
 * Build GET /calling-queue/current|/next tab arrays.
 * OVERLAP IS REQUIRED: scheduled rows also belong in connectedActions and dialledActions.
 */
export function buildCallingTabArrays(allActions, scheduledLeadRows = []) {
  const latest = latestActionPerLead(allActions)
  const dialledActions = allActions.filter((item) => {
    const action = String(item.action || "").toLowerCase()
    if (["start", "queued", "assigned", "pending"].includes(action)) return false
    return true
  })
  const connectedActions = latest.filter((item) => classifyCallingConnection(item) === "connected")
  const notConnectedActions = latest.filter((item) => classifyCallingConnection(item) === "not_connected")
  const fromLogs = latest.filter(isScheduledFollowUp)
  const scheduledLeads = dedupeByLeadId([...scheduledLeadRows.filter(isScheduledFollowUp), ...fromLogs])

  return {
    scheduledLeads,
    upcomingFollowUps: scheduledLeads,
    rescheduledLeads: scheduledLeads,
    dialledActions,
    connectedActions,
    notConnectedActions,
    recentActions: allActions,
    actionHistory: allActions,
  }
}

function dedupeByLeadId(items) {
  const map = new Map()
  for (const item of items) {
    const key = leadKey(item)
    if (!key) continue
    map.set(key, item)
  }
  return [...map.values()]
}

/**
 * Compact UI PATCH mapping (Dialled / Scheduled / Connected / Not Connected Move).
 *
 * SPA already sends tagged callRemark + snake_case duplicates via enrichCallingActionPayload.
 * Persist status_category / status_text / remark / call_remark / action / next_follow_up_at.
 *
 * | UI (1st → 2nd)                 | action           | status_category   | status_text                 | nextFollowUpAt      |
 * |--------------------------------|------------------|-------------------|-----------------------------|---------------------|
 * | Connected → interested         | called           | customer_intent   | Interested                  | omit / null         |
 * | Connected → not_interested     | not_interested   | competition       | Not Interested Currently    | omit / null         |
 * | Connected → decision_pending   | follow_up        | schedule          | Follow-up Pending           | ISO when reschedule |
 * | Not Connected → reason         | not_interested   | call_connectivity | Call Unanswered / Busy / …  | omit / null         |
 *
 * After Dialled Update, re-bucket from the NEW tagged status (latest action per lead):
 *   Not Connected reason → notConnectedActions + dialledActions; leave connected/scheduled
 *   Connected outcome    → connectedActions + dialledActions; leave notConnected;
 *                          scheduledLeads only if decision_pending
 *
 * Not Connected "Move to Connected" free remark is the transfer message only:
 *   `Transferred from Not Connected: …` (legacy: `Transfer Reason: …` still accepted).
 * After persist, that lead MUST appear in connectedActions (latest action) and
 * MUST leave notConnectedActions.
 *
 * Sheet write-back (P0, within cron ≤ ~30–60 min): on Connected outcome / transfer,
 * set final_decision from tagged status (Interested / Not Interested / Pending),
 * second_call_response = call_remark, final_decision_reason = free remark, then
 * call writeBackHrLeadToSheet so HR "Leads from sheet" matches dealer outcome.
 *
 * Decision Pending: accept action `follow_up` OR `rescheduled`. Set lead status
 * `rescheduled` when nextFollowUpAt is present. Never 500 — see §E.2.
 *
 * Example bodies:
 *
 * Interested:
 *   { "action": "called", "callRemark": "[customer_intent] Interested | 5kW bill" }
 *
 * Not Interested:
 *   { "action": "not_interested", "callRemark": "[competition] Not Interested Currently | budget" }
 *
 * Decision Pending:
 *   {
 *     "action": "follow_up",
 *     "callRemark": "[schedule] Follow-up Pending | callback",
 *     "nextFollowUpAt": "2026-10-16T05:30:00.000Z"
 *   }
 *
 * Dialled Not Connected:
 *   { "action": "not_interested", "callRemark": "[call_connectivity] Call Unanswered | no pickup" }
 *
 * Transfer Not Connected → Connected:
 *   {
 *     "action": "called",
 *     "callRemark": "[customer_intent] Interested | Transferred from Not Connected: Intrested hai coustomer",
 *     "finalDecision": "Interested",
 *     "secondCallResponse": "[customer_intent] Interested | Transferred from Not Connected: Intrested hai coustomer"
 *   }
 */
export function applyConnectedOutcomePatch(lead, body) {
  const parsed = parseTaggedCallRemark(body.callRemark || body.call_remark)
  const action = String(body.action || "").toLowerCase()
  const nextFollowUpAt = body.nextFollowUpAt || body.next_follow_up_at || null
  const statusText = body.statusText || body.status_text || parsed.status
  const statusCategory = body.statusCategory || body.status_category || parsed.statusCategory
  const remark = body.remark || parsed.remark
  const callRemark = body.callRemark || body.call_remark

  const isHold = action === "follow_up" || action === "rescheduled" || Boolean(nextFollowUpAt)
  lead.status = isHold ? "rescheduled" : "completed"
  lead.action = action
  lead.call_remark = callRemark
  lead.status_category = statusCategory
  lead.status_text = statusText
  lead.remark = remark
  lead.next_follow_up_at = isHold ? nextFollowUpAt : null
  lead.action_at = body.actionAt || body.action_at || new Date().toISOString()

  // Sheet Final Decision + 2nd call — SPA also sends these via enrichCallingActionPayload.
  const st = String(statusText || "").toLowerCase()
  const finalFromBody = body.finalDecision || body.final_decision
  if (finalFromBody) {
    lead.final_decision = finalFromBody
  } else if (st.includes("interested") && !st.includes("not interested") && !st.includes("not intrested")) {
    lead.final_decision = "Interested"
  } else if (st.includes("not interested") || st.includes("not intrested")) {
    lead.final_decision = "Not Interested"
  } else if (st.includes("follow-up") || st.includes("follow up") || st.includes("pending")) {
    lead.final_decision = "Pending"
  }
  lead.final_decision_reason =
    body.finalDecisionReason || body.final_decision_reason || remark || lead.final_decision_reason
  lead.second_call_response =
    body.secondCallResponse || body.second_call_response || callRemark || lead.second_call_response

  return lead
}

/**
 * GET response shape (queue next/current). Include overlapping arrays.
 */
export function exampleQueueTabResponse({ currentLead, allActions }) {
  const tabs = buildCallingTabArrays(allActions)
  return {
    success: true,
    currentLead: currentLead || null,
    lead: currentLead || null,
    ...tabs,
  }
}
