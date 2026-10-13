// @ts-nocheck
/**
 * =============================================================================
 * BACKEND — Calling actions must echo Social Media vs Calling data source
 * =============================================================================
 *
 * Handoff: BACKEND_CHANGES_HANDOFF.md §64
 * Spec:    BACKEND_CHANGES_REQUIRED.md §BR
 *
 * Frontend (shipped Oct 2026):
 *   app/dashboard/calling-data/page.tsx     (Dealer Call Analytics + tabs)
 *   app/dashboard/admin/page.tsx            (Admin → Calling Reports)
 *   lib/google-sheets-social-leads.ts       (isSocialMediaCallingLead)
 *   lib/calling-action-summary.ts
 *
 * Symptom (live):
 *   Dealer Not Connected / Connected shows Social rows (ig / fb badge),
 *   but Dealer Call Analytics and Admin Calling Reports show
 *   "Social 0 · Normal N". Assigned Google Sheet / Meta leads are counted
 *   as Calling data because GET calling-actions omits lead source fields.
 *
 * Cause:
 *   Action rows are serialized without JOIN to hr_leads.source_type /
 *   platform / sheet_source_id / campaign_name / upload.file_name.
 *   SPA can only classify Social when those fields (or a client-side
 *   sheet-leads match) are present.
 *
 * No new routes required. Echo source on existing GETs. Optional query
 * `source=social|normal|all` and summary split are recommended.
 *
 * =============================================================================
 */

const SOCIAL_SOURCE_TYPES = new Set([
  "google_sheet",
  "social_media",
  "social",
  "meta",
])

const SOCIAL_PLATFORMS = new Set(["ig", "fb", "facebook", "instagram", "meta"])

/** Match SPA `isSocialMediaCallingLead` (lib/google-sheets-social-leads.ts). */
export function isSocialMediaLeadRow(lead) {
  if (!lead) return false
  const sourceType = String(lead.sourceType || lead.source_type || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
  if (
    SOCIAL_SOURCE_TYPES.has(sourceType) ||
    sourceType.includes("sheet") ||
    sourceType.includes("social") ||
    sourceType.includes("meta")
  ) {
    return true
  }
  const fileName = String(
    lead.uploadFileName || lead.upload_file_name || lead.fileName || lead.file_name || "",
  ).toLowerCase()
  if (
    fileName.includes("google sheet") ||
    fileName.includes("google_sheet") ||
    fileName.includes("social") ||
    fileName.includes("meta") ||
    fileName.includes("facebook") ||
    fileName.includes("instagram")
  ) {
    return true
  }
  if (lead.sheetSourceId || lead.sheet_source_id) return true
  const externalId = String(lead.externalId || lead.external_id || "")
  if (externalId.startsWith("l:") || externalId.startsWith("ag:")) return true
  const platform = String(lead.platform || "").toLowerCase()
  if (SOCIAL_PLATFORMS.has(platform)) return true
  if (String(lead.campaignName || lead.campaign_name || "").trim()) return true
  return false
}

/**
 * JOIN hr_leads (+ upload batch) when mapping a calling-action or queue row.
 *
 * Required on every action / queue lead JSON:
 *   sourceType / source_type
 *   platform
 *   campaignName / campaign_name
 *   sheetSourceId / sheet_source_id
 *   uploadFileName / fileName
 *   externalId / external_id
 *   customerNote   (Meta notes often contain ad_ / adset / form_name)
 *
 * Endpoints (same shape):
 *   GET  /api/dealers/me/calling-queue/next
 *   GET  /api/dealers/me/calling-queue/current
 *   GET  /api/dealers/me/calling-actions
 *   GET  /api/dealers/calling-actions
 *   GET  /api/admin/calling-actions
 *   GET  /api/hr/calling-actions
 *   PATCH /api/dealers/me/calling-queue/{leadId}/action  (echo on response)
 *
 * Queue arrays that must include the same fields on each item:
 *   currentLead, nextLead, scheduledLeads,
 *   dialledActions, connectedActions, notConnectedActions, recentActions
 */
export function mapCallingActionWithSource(actionRow, leadRow, uploadRow) {
  const sourceType =
    leadRow?.source_type ||
    leadRow?.sourceType ||
    uploadRow?.source_type ||
    (leadRow?.sheet_source_id ? "google_sheet" : "csv")
  return {
    id: actionRow.id,
    leadId: actionRow.lead_id || leadRow?.id,
    dealerId: actionRow.dealer_id,
    dealerName: actionRow.dealer_name,
    customerName: leadRow?.name || actionRow.name,
    customerMobile: leadRow?.mobile || actionRow.mobile,
    mobile: leadRow?.mobile || actionRow.mobile,
    action: actionRow.action,
    actionAt: actionRow.action_at,
    callRemark: actionRow.call_remark,
    statusText: actionRow.status_text,
    statusCategory: actionRow.status_category,
    nextFollowUpAt: actionRow.next_follow_up_at,
    sourceType,
    source_type: sourceType,
    platform: leadRow?.platform || null,
    campaignName: leadRow?.campaign_name || leadRow?.campaignName || null,
    campaign_name: leadRow?.campaign_name || null,
    sheetSourceId: leadRow?.sheet_source_id || null,
    sheet_source_id: leadRow?.sheet_source_id || null,
    uploadFileName: uploadRow?.file_name || leadRow?.file_name || null,
    fileName: uploadRow?.file_name || null,
    externalId: leadRow?.external_id || null,
    external_id: leadRow?.external_id || null,
    customerNote: leadRow?.customer_note || leadRow?.customerNote || null,
  }
}

/**
 * Optional snapshot at PATCH time so history stays Social even if the lead
 * is later re-tagged. Columns on calling_actions (or equivalent):
 *
 *   ALTER TABLE calling_actions
 *     ADD COLUMN IF NOT EXISTS source_type VARCHAR(32),
 *     ADD COLUMN IF NOT EXISTS platform VARCHAR(64),
 *     ADD COLUMN IF NOT EXISTS campaign_name VARCHAR(256),
 *     ADD COLUMN IF NOT EXISTS sheet_source_id UUID,
 *     ADD COLUMN IF NOT EXISTS upload_file_name VARCHAR(256);
 *
 * On PATCH completion, copy from the lead / upload batch into the action row.
 * GET prefers action snapshot, else JOIN lead.
 */

/**
 * Optional list filter (Admin Calling Reports + dealer analytics):
 *
 *   GET .../calling-actions?source=all|social|normal
 *
 *   social  = isSocialMediaLeadRow(lead)
 *   normal  = not social (CSV calling data)
 *   all     = default
 *
 * Optional summary split on GET .../calling-actions/summary (extends §AI):
 *
 * {
 *   "totalCalls": 871,
 *   "connected": 374,
 *   "notConnected": 497,
 *   "social": { "totalCalls": 12, "connected": 4, "notConnected": 8,
 *               "connectedInterested": 1, "connectedNotInterested": 2,
 *               "connectedFollowUp": 1 },
 *   "normal": { "totalCalls": 859, "connected": 370, "notConnected": 489,
 *               "connectedInterested": 6, "connectedNotInterested": 295,
 *               "connectedFollowUp": 69 }
 * }
 */

/** Example SQL — list actions with lead source (adjust table names). */
export const CALLING_ACTIONS_SOURCE_SQL = `
SELECT
  a.id,
  a.lead_id,
  a.dealer_id,
  a.action,
  a.action_at,
  a.call_remark,
  a.status_text,
  a.status_category,
  a.next_follow_up_at,
  l.name AS customer_name,
  l.mobile,
  COALESCE(a.source_type, l.source_type, u.source_type, 'csv') AS source_type,
  COALESCE(a.platform, l.platform) AS platform,
  COALESCE(a.campaign_name, l.campaign_name) AS campaign_name,
  COALESCE(a.sheet_source_id, l.sheet_source_id) AS sheet_source_id,
  COALESCE(a.upload_file_name, u.file_name) AS upload_file_name,
  l.external_id,
  l.customer_note
FROM calling_actions a
JOIN hr_leads l ON l.id = a.lead_id
LEFT JOIN hr_lead_uploads u ON u.id = l.upload_id
WHERE LOWER(COALESCE(a.action, '')) <> 'start'
  AND a.action_at >= :startDate
  AND a.action_at <= :endDate
`
