"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { canOpenSection, getPostLoginPath } from "@/lib/user-access"
import { useAuth } from "@/lib/auth-context"
import { api, ApiError } from "@/lib/api"
import {
  callingLeadAssignedToDealer,
  callingLeadAssignedToOtherDealer,
  callingLeadIsPoolUnassigned,
  isLeadNotAssignedToDealerError,
  leadHasExplicitCallingAssigneeId,
  normalizeCallingAssigneeToken,
  resolveCallingAssigneeId,
} from "@/lib/calling-lead-assignee"
import {
  pickRicherCallRemark,
  readDealerCallingActions,
  resolveCallingActionRemark,
  resolveLeadPriorCallReview,
  type PriorCallReviewSource,
  type StoredDealerCallingAction,
} from "@/lib/dealer-calling-action-history"
import { extractCallingActionList, journeyMobilesMatch } from "@/lib/journey-calling-actions"
import { getRealtime } from "@/lib/realtime"
import { DashboardNav } from "@/components/dashboard-nav"
import { CityMultiSelectFilter } from "@/components/city-multi-select-filter"
import { matchesCityFilter } from "@/lib/service-cities"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { useToast } from "@/hooks/use-toast"
import {
  getCallingActiveLeadId,
  loadCallingLeadSession,
  saveCallingLeadSession,
  setCallingActiveLeadId,
} from "@/lib/calling-lead-session"
import {
  cleanFreeCallRemark,
  enrichCallingActionPayload,
  getRescheduleSubmitAction,
  isCallingActionServerError,
  parseTaggedCallRemark,
} from "@/lib/calling-remark-payload"
import { copyPhoneForDial, formatPhoneForDisplay, normalizePhoneDigits } from "@/lib/phone-dialer"
import { formatYmdLocal, getCustomBoundsFromYmd, getPresetBounds, parseCallingActionAt } from "@/lib/calling-report-date-range"
import {
  buildCallingActionSummary,
  buildCallingConnectionSummary,
  classifyCallingConnection,
  getConnectedOutcomeForStatus,
} from "@/lib/calling-action-summary"
import { downloadPricingPdf, PRICING_PDF_SCOPE_OPTIONS, type PricingPdfScope } from "@/lib/download-dcr-pricing-pdf"
import { downloadCsvFile } from "@/lib/excel-column-export"
import { PricingSheetViewDialog } from "@/components/pricing-sheet-view-dialog"
import { usePricingTables } from "@/lib/use-pricing-tables"
import { PhoneCall, Pencil, Check, X, Loader2, Download, ChevronDown, Eye, Sheet, Sparkles, PhoneOff, PhoneIncoming, CalendarDays, User, Phone, MapPin, Hash, StickyNote, Copy, Inbox } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  callingLeadToSocialDisplayRow,
  getSocialLeadCardSurfaceClass,
  getSocialLeadStatusDisplay,
  isSocialMediaCallingLead,
} from "@/lib/google-sheets-social-leads"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

type CallingLead = {
  id: string
  name: string
  mobile: string
  altMobile?: string
  kNumber?: string
  address?: string
  customerNote?: string
  city?: string
  state?: string
  assignedDealerId: string
  assignedDealerName: string
  createdAt: string
  assignedAt?: string
  queuedAt?: string
  status: "queued" | "assigned" | "in_progress" | "rescheduled" | "completed"
  action?: "called" | "not_interested" | "follow_up" | "rescheduled"
  actionAt?: string
  nextFollowUpAt?: string
  callRemark?: string
  /** HR / calling upload batch — used with eligibleDealerIds or dealer profile batch ids for pool visibility. */
  uploadBatchId?: string
  uploadFileName?: string
  sourceType?: string
  sheetSourceId?: string
  platform?: string
  campaignName?: string
  adName?: string
  /** Meta sheet `lead_status` (e.g. CREATED) — distinct from workflow `status`. */
  sheetLeadStatus?: string
  remarks?: string
  remarks2?: string
  kw?: string
  finalDecision?: string
  finalDecisionReason?: string
  firstCallResponse?: string
  secondCallResponse?: string
  externalId?: string
  eligibleDealerIds?: string[]
}

type ActionLogItem = {
  id: string
  leadId: string
  name: string
  mobile: string
  action?: string
  actionAt?: string
  callRemark?: string
  nextFollowUpAt?: string
  status?: string
  statusText?: string
  statusCategory?: string
  status_text?: string
  status_category?: string
  kNumber?: string
  address?: string
  city?: string
  state?: string
  customerNote?: string
  sourceType?: string
  source_type?: string
  sheetSourceId?: string
  uploadFileName?: string
  upload_file_name?: string
  fileName?: string
  platform?: string
  campaignName?: string
  sheetLeadStatus?: string
  leadStatus?: string
  lead_status?: string
  externalId?: string
}

/** Four consolidated sections; every original status point is listed under one part. */
const STATUS_GROUPS = [
  {
    key: "part_1_call_and_lead",
    label: "Part 1 — Call & lead quality",
    options: [
      // Call connectivity
      "Call Unanswered",
      "Switched Off",
      "Not Reachable",
      "Busy / Line Busy",
      "Call Disconnected",
      "Wrong Number",
      "Invalid Number",
      "Number Does Not Exist",
      // Lead validity
      "Valid Lead",
      "Invalid Lead",
      "Duplicate Lead",
      "Out of Service Area",
      "Not Eligible for Solar",
      "Tenant (No Ownership)",
      "Commercial / Residential Mismatch",
    ],
  },
  {
    key: "part_2_interest_qualification",
    label: "Part 2 — Interest & qualification",
    options: [
      // Interest level
      "Interested",
      "Highly Interested",
      "Need More Information",
      "Callback Later",
      "Follow-up Required",
      "Not Interested",
      "Already Installed Solar",
      "Already in Discussion with Another Vendor",
      // Solar qualification
      "Own House",
      "Rented Property",
      "Suitable Roof Available",
      "No Roof / Space Issue",
      "High Electricity Bill (>₹2000)",
      "Low Electricity Bill",
      "3 Phase Connection Available",
      "Single Phase Only",
    ],
  },
  {
    key: "part_3_followup_sales",
    label: "Part 3 — Follow-up & sales",
    options: [
      // Follow-up
      "Callback Scheduled",
      "Follow-up Done",
      "Follow-up Pending",
      "Not Picking on Follow-up",
      "Rescheduled",
      // Conversion / sales
      "Site Visit Scheduled",
      "Site Visit Done",
      "Quotation Shared",
      "Negotiation Ongoing",
      "Converted (Deal Closed)",
      "Payment Received",
      "Installation Pending",
      "Installation Completed",
      "Lost Lead",
    ],
  },
  {
    key: "part_4_rejection",
    label: "Part 4 — Rejection / lost",
    options: [
      "Price Too High",
      "Not Interested Currently",
      "Budget Issue",
      "Trust Issue",
      "Location Not Serviceable",
      "Chose Competitor",
      "No Requirement",
    ],
  },
] as const

const OTHER_STATUS_VALUE = "__other_manual__"

type StatusGroupKey = (typeof STATUS_GROUPS)[number]["key"]
type EditableLeadDetails = {
  name: string
  mobile: string
  kNumber: string
  city: string
  state: string
  address: string
  customerNote: string
}

const NOT_INTERESTED_STATUSES = new Set([
  "Not Interested",
  "Not Interested Currently",
  "Already Installed Solar",
  "Already in Discussion with Another Vendor",
  // Diagram "Not Connected" reasons -> close the lead
  "Call Unanswered",
  "Switched Off",
  "Not Reachable",
  "Busy / Line Busy",
  "Call Disconnected",
  "Wrong Number",
  "Invalid Number",
  "Number Does Not Exist",
  "Invalid Lead",
  "Duplicate Lead",
  "Out of Service Area",
  "Not Eligible for Solar",
  "Tenant (No Ownership)",
  "Commercial / Residential Mismatch",
  "No Roof / Space Issue",
  "Low Electricity Bill",
  "Single Phase Only",
  "Lost Lead",
  "Price Too High",
  "Budget Issue",
  "Trust Issue",
  "Location Not Serviceable",
  "Chose Competitor",
  "No Requirement",
])

const FOLLOW_UP_STATUSES = new Set([
  // Diagram "Decision Pending" -> hold & reschedule/follow-up
  "Callback Later",
  "Follow-up Required",
  "Callback Scheduled",
  "Follow-up Pending",
  "Not Picking on Follow-up",
  "Rescheduled",
])

const INTEREST_TAB_MATCHES = [
  "Interested",
  "Highly Interested",
  "Need More Information",
  "Quotation Shared",
  "Negotiation Ongoing",
  "Converted (Deal Closed)",
  "Payment Received",
  "Installation Pending",
  "Installation Completed",
  "Site Visit Scheduled",
  "Site Visit Done",
]

const BACKEND_STATUS_CATEGORY_TO_GROUP_KEY: Record<string, StatusGroupKey> = {
  call_connectivity: "part_1_call_and_lead",
  lead_validity: "part_1_call_and_lead",
  customer_intent: "part_2_interest_qualification",
  financial: "part_2_interest_qualification",
  schedule: "part_3_followup_sales",
  competition: "part_4_rejection",
  other: "part_4_rejection",
}

const BACKEND_STATUS_CATEGORY_TO_LABEL: Record<string, string> = {
  call_connectivity: "Part 1 — Call & lead quality",
  lead_validity: "Part 1 — Call & lead quality",
  customer_intent: "Part 2 — Interest & qualification",
  financial: "Part 2 — Interest & qualification",
  schedule: "Part 3 — Follow-up & sales",
  competition: "Part 4 — Rejection / lost",
  other: "Part 4 — Rejection / lost",
}

const CALL_CONNECTIVITY_STATUSES = new Set([
  "Call Unanswered",
  "Switched Off",
  "Not Reachable",
  "Busy / Line Busy",
  "Call Disconnected",
  "Wrong Number",
  "Invalid Number",
  "Number Does Not Exist",
])

const CUSTOMER_INTENT_STATUSES = new Set([
  "Interested",
  "Highly Interested",
  "Need More Information",
  "Callback Later",
  "Follow-up Required",
  "Not Interested",
  "Already Installed Solar",
  "Already in Discussion with Another Vendor",
])

const NOT_CONNECTED_REASONS = [
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
]


const LOST_REASONS = [
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
]

const DECISION_PENDING_REASONS = [
  "Callback Scheduled",
  "Follow-up Pending",
  "Callback Later",
  "Follow-up Required",
  "Need More Information",
  "Not Picking on Follow-up",
]

type CallingLeadDealerVisibilityCtx = {
  currentDealerId: string
  currentDealerUsername: string
  currentDealerFullName: string
  dealerCallingBatchIds: string[]
}

function CurrentLeadField({
  label,
  icon,
  className,
  children,
}: {
  label: string
  icon: ReactNode
  className?: string
  children: ReactNode
}) {
  return (
    <div className={cn("rounded-lg border px-3 py-2 min-w-0", className)}>
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-1">
        {icon}
        {label}
      </p>
      <div className="mt-0.5 text-sm font-semibold text-foreground break-words">{children}</div>
    </div>
  )
}

function AnalyticsStat({
  label,
  value,
  hint,
  className,
}: {
  label: string
  value: number
  hint?: string
  className?: string
}) {
  return (
    <div className={cn("rounded-lg border px-3 py-2 min-h-[4.25rem]", className)}>
      <p className="text-[11px] text-muted-foreground leading-tight">{label}</p>
      <p className="mt-0.5 text-xl font-semibold tabular-nums tracking-tight">{value}</p>
      {hint ? <p className="mt-0.5 text-[10px] text-muted-foreground leading-tight">{hint}</p> : null}
    </div>
  )
}

type HistorySourceFilter = "all" | "social" | "normal"

function matchesHistorySourceFilter(
  item: Parameters<typeof isSocialMediaCallingLead>[0],
  filter: HistorySourceFilter,
) {
  if (filter === "all") return true
  const social = isSocialMediaCallingLead(item)
  return filter === "social" ? social : !social
}

function HistorySourceFilterSelect({
  value,
  onChange,
}: {
  value: HistorySourceFilter
  onChange: (value: HistorySourceFilter) => void
}) {
  return (
    <Select value={value} onValueChange={(next) => onChange(next as HistorySourceFilter)}>
      <SelectTrigger className="h-8 w-full sm:w-40">
        <SelectValue placeholder="Source" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All sources</SelectItem>
        <SelectItem value="social">Social Media</SelectItem>
        <SelectItem value="normal">Calling data</SelectItem>
      </SelectContent>
    </Select>
  )
}

function sourceSplitHint(socialCount: number, normalCount: number) {
  return `Social ${socialCount} · Normal ${normalCount}`
}

function callingSourceLabel(item: Parameters<typeof isSocialMediaCallingLead>[0]) {
  return isSocialMediaCallingLead(item) ? "Social Media" : "Calling data"
}

function formatReportDateTime(value?: string) {
  const at = parseCallingActionAt(value)
  if (!at) return ""
  return at.toLocaleString("en-IN")
}

function connectedOutcomeReportLabel(status: string) {
  const bucket = getConnectedOutcomeForStatus(status)
  if (bucket === "not_interested") return "Not Interested"
  if (bucket === "decision_pending") return "Decision Pending"
  return "Interested"
}

const CALLING_DATA_REPORT_HEADERS = [
  "Source",
  "Name",
  "Mobile",
  "K Number",
  "Address",
  "City",
  "State",
  "Connection",
  "Outcome",
  "Status",
  "Remark",
  "Action",
  "Call at",
  "Follow-up at",
  "Platform",
  "Campaign",
] as const

function actionLogReportRow(item: ActionLogItem): Array<string | number> {
  const parsed = parseTaggedCallRemark(item.callRemark)
  const connection = classifyCallingConnection(item) === "not_connected" ? "Not Connected" : "Connected"
  const status = (parsed.status || item.statusText || "").trim()
  return [
    callingSourceLabel(item),
    item.name || "",
    item.mobile || "",
    item.kNumber || "",
    item.address || "",
    item.city || "",
    item.state || "",
    connection,
    connection === "Connected" && status ? connectedOutcomeReportLabel(status) : "",
    status,
    parsed.remark || "",
    item.action || "",
    formatReportDateTime(item.actionAt),
    formatReportDateTime(item.nextFollowUpAt),
    item.platform || "",
    item.campaignName || "",
  ]
}

function scheduledLeadReportRow(lead: CallingLead): Array<string | number> {
  const parsed = parseTaggedCallRemark(lead.callRemark || "")
  const status = (parsed.status || "").trim()
  return [
    callingSourceLabel(lead),
    lead.name || "",
    lead.mobile || "",
    lead.kNumber || "",
    lead.address || "",
    lead.city || "",
    lead.state || "",
    "Scheduled",
    status ? connectedOutcomeReportLabel(status) : "Decision Pending",
    status,
    parsed.remark || "",
    lead.action || "follow_up",
    formatReportDateTime(lead.actionAt),
    formatReportDateTime(lead.nextFollowUpAt),
    lead.platform || "",
    lead.campaignName || "",
  ]
}

type SocialSourceFields = Pick<
  ActionLogItem,
  | "sourceType"
  | "source_type"
  | "sheetSourceId"
  | "uploadFileName"
  | "fileName"
  | "platform"
  | "campaignName"
  | "sheetLeadStatus"
  | "leadStatus"
  | "lead_status"
  | "externalId"
  | "customerNote"
>

function socialSourceFieldsFrom(
  row: Parameters<typeof isSocialMediaCallingLead>[0] & {
    id?: string
    leadId?: string
    mobile?: string
    sheet_source_id?: string
    upload_file_name?: string
    file_name?: string
    campaign_name?: string
  },
): SocialSourceFields {
  return {
    sourceType: row.sourceType || row.source_type,
    source_type: row.source_type || row.sourceType,
    sheetSourceId: row.sheetSourceId || row.sheet_source_id,
    uploadFileName: row.uploadFileName || row.upload_file_name,
    fileName: row.fileName || row.file_name,
    platform: row.platform,
    campaignName: row.campaignName || row.campaign_name,
    sheetLeadStatus: row.sheetLeadStatus,
    leadStatus: row.leadStatus,
    lead_status: row.lead_status,
    externalId: row.externalId || row.external_id,
    customerNote: row.customerNote,
  }
}

function applyKnownSocialSource(
  item: ActionLogItem,
  byLeadId: Map<string, SocialSourceFields>,
  byMobile: Map<string, SocialSourceFields>,
): ActionLogItem {
  if (isSocialMediaCallingLead(item)) return item
  const mobileKey = normalizePhoneDigits(item.mobile || "").slice(-10)
  const src =
    (item.leadId ? byLeadId.get(String(item.leadId).trim()) : undefined) ||
    (mobileKey.length >= 8 ? byMobile.get(mobileKey) : undefined)
  if (!src) return item
  return {
    ...item,
    sourceType: item.sourceType || src.sourceType || src.source_type || "social_media",
    source_type: item.source_type || src.source_type || src.sourceType || "social_media",
    sheetSourceId: item.sheetSourceId || src.sheetSourceId,
    uploadFileName: item.uploadFileName || src.uploadFileName,
    fileName: item.fileName || src.fileName,
    platform: item.platform || src.platform,
    campaignName: item.campaignName || src.campaignName,
    sheetLeadStatus: item.sheetLeadStatus || src.sheetLeadStatus,
    leadStatus: item.leadStatus || src.leadStatus,
    lead_status: item.lead_status || src.lead_status,
    externalId: item.externalId || src.externalId,
    customerNote: item.customerNote || src.customerNote,
  }
}

function applyKnownSocialSourceToLead(
  lead: CallingLead,
  byLeadId: Map<string, SocialSourceFields>,
  byMobile: Map<string, SocialSourceFields>,
): CallingLead {
  if (isSocialMediaCallingLead(lead)) return lead
  const mobileKey = normalizePhoneDigits(lead.mobile || "").slice(-10)
  const src =
    (lead.id ? byLeadId.get(String(lead.id).trim()) : undefined) ||
    (mobileKey.length >= 8 ? byMobile.get(mobileKey) : undefined)
  if (!src) return lead
  return {
    ...lead,
    sourceType: lead.sourceType || src.sourceType || src.source_type || "social_media",
    sheetSourceId: lead.sheetSourceId || src.sheetSourceId,
    uploadFileName: lead.uploadFileName || src.uploadFileName,
    platform: lead.platform || src.platform,
    campaignName: lead.campaignName || src.campaignName,
    sheetLeadStatus: lead.sheetLeadStatus || src.sheetLeadStatus,
    externalId: lead.externalId || src.externalId,
    customerNote: lead.customerNote || src.customerNote,
  }
}

/** Explicit assignee match, else pool / HR batch-unassigned (name may be batch label, not empty). */
function callingLeadVisibleToDealer(lead: CallingLead, ctx: CallingLeadDealerVisibilityCtx): boolean {
  const dealerIdentity = {
    id: ctx.currentDealerId,
    username: ctx.currentDealerUsername,
    fullName: ctx.currentDealerFullName,
  }
  if (callingLeadAssignedToOtherDealer(lead, dealerIdentity)) return false
  // FCFS / HR-assigned rows: always visible to the assignee (do not fail-closed on batch id).
  if (callingLeadAssignedToDealer(lead, dealerIdentity)) return true

  const assignedId = String(lead.assignedDealerId || "").trim().toLowerCase()
  const assignedName = String(lead.assignedDealerName || "").trim().toLowerCase()

  if (leadHasExplicitCallingAssigneeId(lead)) {
    if (ctx.currentDealerId && assignedId === ctx.currentDealerId.toLowerCase()) return true
    if (ctx.currentDealerUsername) {
      if (assignedId === ctx.currentDealerUsername) return true
      if (assignedName.includes(ctx.currentDealerUsername)) return true
    }
    if (ctx.currentDealerFullName && assignedName.includes(ctx.currentDealerFullName)) return true
    return false
  }

  if (ctx.currentDealerUsername && assignedName.includes(ctx.currentDealerUsername)) return true
  if (ctx.currentDealerFullName && assignedName.includes(ctx.currentDealerFullName)) return true

  const eligible = lead.eligibleDealerIds
  if (Array.isArray(eligible) && eligible.length > 0) {
    if (!ctx.currentDealerId) return false
    const cur = ctx.currentDealerId.toLowerCase()
    return eligible.some((id) => String(id).trim().toLowerCase() === cur)
  }

  const bid = String(lead.uploadBatchId || "").trim()
  if (bid) {
    if (ctx.dealerCallingBatchIds.length > 0) {
      return ctx.dealerCallingBatchIds.includes(bid)
    }
    // Fail closed for batch-tagged unassigned leads when explicit eligibility is missing:
    // prevents dealers outside that batch from seeing those rows.
    return false
  }

  return true
}

const SCHEDULED_QUEUE_RESPONSE_KEYS = [
  "scheduledLeads",
  "upcomingFollowUps",
  "followUps",
  "scheduled",
  "scheduledData",
  "scheduledItems",
  "rescheduledLeads",
] as const

function readCallingQueueArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>
    if (Array.isArray(obj.items)) return obj.items
    if (Array.isArray(obj.rows)) return obj.rows
    if (Array.isArray(obj.data)) return obj.data
  }
  return []
}

function getScheduledLeadDedupeKey(lead: CallingLead): string {
  // Prefer mobile so the same person from API + action-log (different IDs) counts as 1 lead.
  const mobile = normalizePhoneDigits(lead.mobile || "")
  if (mobile.length >= 8) return `mobile:${mobile}`
  const id = String(lead.id || "").trim()
  if (id && !/^lead-\d+$/i.test(id)) return `id:${id.toLowerCase()}`
  return `row:${(lead.name || "").trim().toLowerCase()}|${mobile}`
}

function mergeScheduledLeadRows(existing: CallingLead, incoming: CallingLead): CallingLead {
  const existingAt = existing.nextFollowUpAt ? new Date(existing.nextFollowUpAt).getTime() : 0
  const incomingAt = incoming.nextFollowUpAt ? new Date(incoming.nextFollowUpAt).getTime() : 0
  const preferIncoming = incomingAt >= existingAt
  const base = preferIncoming ? { ...existing, ...incoming } : { ...incoming, ...existing }
  return {
    ...base,
    id: existing.id || incoming.id,
    callRemark: pickRicherCallRemark(existing.callRemark, incoming.callRemark),
    nextFollowUpAt: preferIncoming
      ? incoming.nextFollowUpAt || existing.nextFollowUpAt
      : existing.nextFollowUpAt || incoming.nextFollowUpAt,
    customerNote: incoming.customerNote || existing.customerNote,
    sourceType: incoming.sourceType || existing.sourceType,
    sheetSourceId: incoming.sheetSourceId || existing.sheetSourceId,
    uploadFileName: incoming.uploadFileName || existing.uploadFileName,
    platform: incoming.platform || existing.platform,
    campaignName: incoming.campaignName || existing.campaignName,
    sheetLeadStatus: incoming.sheetLeadStatus || existing.sheetLeadStatus,
    externalId: incoming.externalId || existing.externalId,
    status:
      existing.status === "rescheduled" || incoming.status === "rescheduled"
        ? "rescheduled"
        : base.status,
  }
}

function dedupeScheduledLeads(leads: CallingLead[]): CallingLead[] {
  const map = new Map<string, CallingLead>()
  for (const lead of leads) {
    const key = getScheduledLeadDedupeKey(lead)
    const existing = map.get(key)
    map.set(key, existing ? mergeScheduledLeadRows(existing, lead) : lead)
  }
  return Array.from(map.values())
}

function findStatusGroupKeyForStatus(status: string): StatusGroupKey {
  const clean = status.trim()
  if (!clean) return STATUS_GROUPS[0].key
  const group = STATUS_GROUPS.find((entry) => entry.options.some((option) => option === clean))
  return group?.key ?? STATUS_GROUPS[0].key
}

function isFollowUpCallingLead(lead: CallingLead): boolean {
  return (
    Boolean(lead.nextFollowUpAt) ||
    lead.status === "rescheduled" ||
    lead.action === "follow_up" ||
    lead.action === "rescheduled"
  )
}

/** Scheduled tab: Connected + Decision Pending (same rule as Connected outcome filter). */
function isConnectedFollowUpAction(item: ActionLogItem): boolean {
  if (classifyCallingConnection(item) !== "connected") return false
  const parsed = parseTaggedCallRemark(item.callRemark)
  const status = (parsed.status || item.statusText || "").trim()
  const action = String(item.action || "").toLowerCase()
  if (action === "follow_up" || action === "rescheduled") return true
  if (item.nextFollowUpAt && (!status || getConnectedOutcomeForStatus(status) === "decision_pending")) return true
  if (!status) return false
  return getConnectedOutcomeForStatus(status) === "decision_pending"
}

function inferCallFormDefaultsFromStatus(status: string): {
  callConnection: "connected" | "not_connected"
  connectedOutcome: "interested" | "not_interested" | "decision_pending"
  decisionReason?: string
  notConnectedReason?: string
  lostReason?: string
} {
  const clean = status.trim()
  if (!clean) {
    return { callConnection: "connected", connectedOutcome: "decision_pending" }
  }

  if (NOT_CONNECTED_REASONS.includes(clean) || CALL_CONNECTIVITY_STATUSES.has(clean)) {
    return {
      callConnection: "not_connected",
      connectedOutcome: "not_interested",
      notConnectedReason: NOT_CONNECTED_REASONS.includes(clean) ? clean : NOT_CONNECTED_REASONS[0],
    }
  }

  if (LOST_REASONS.includes(clean) || clean === "Not Interested" || clean === "Not Interested Currently") {
    return {
      callConnection: "connected",
      connectedOutcome: "not_interested",
      lostReason: LOST_REASONS.includes(clean) ? clean : LOST_REASONS[0],
    }
  }

  if (FOLLOW_UP_STATUSES.has(clean) || DECISION_PENDING_REASONS.includes(clean)) {
    return {
      callConnection: "connected",
      connectedOutcome: "decision_pending",
      decisionReason: DECISION_PENDING_REASONS.includes(clean) ? clean : DECISION_PENDING_REASONS[0],
    }
  }

  if (INTEREST_TAB_MATCHES.includes(clean) || CUSTOMER_INTENT_STATUSES.has(clean)) {
    return { callConnection: "connected", connectedOutcome: "interested" }
  }

  return { callConnection: "connected", connectedOutcome: "decision_pending", decisionReason: clean }
}

function scheduledLeadFromActionLog(item: ActionLogItem): CallingLead | null {
  if (!isConnectedFollowUpAction(item)) return null
  const leadId =
    String(item.leadId || "").trim() ||
    `sched-${normalizePhoneDigits(item.mobile).slice(-10) || item.id}`
  if (!leadId) return null
  return {
    id: leadId,
    name: item.name || "Unknown",
    mobile: item.mobile || "",
    kNumber: item.kNumber,
    address: item.address,
    city: item.city,
    state: item.state,
    customerNote: item.customerNote,
    assignedDealerId: "",
    assignedDealerName: "",
    createdAt: item.actionAt || new Date().toISOString(),
    status: "rescheduled",
    action: item.action === "follow_up" || item.action === "rescheduled" ? item.action : "follow_up",
    actionAt: item.actionAt,
    nextFollowUpAt: item.nextFollowUpAt || item.actionAt,
    callRemark: item.callRemark,
    sourceType: item.sourceType,
    sheetSourceId: item.sheetSourceId,
    uploadFileName: item.uploadFileName,
    platform: item.platform,
    campaignName: item.campaignName,
    sheetLeadStatus: item.sheetLeadStatus,
    externalId: item.externalId,
  }
}

function actionLogFromScheduledLead(lead: CallingLead): ActionLogItem {
  return {
    id: `dialled-sched-${lead.id}-${lead.nextFollowUpAt || lead.actionAt || ""}`,
    leadId: lead.id,
    name: lead.name,
    mobile: lead.mobile,
    action: lead.action === "rescheduled" ? "rescheduled" : "follow_up",
    actionAt: lead.actionAt || lead.nextFollowUpAt,
    callRemark: lead.callRemark,
    nextFollowUpAt: lead.nextFollowUpAt,
    statusText: parseTaggedCallRemark(lead.callRemark || "").status,
    kNumber: lead.kNumber,
    address: lead.address,
    city: lead.city,
    state: lead.state,
    customerNote: lead.customerNote,
    sourceType: lead.sourceType,
    sheetSourceId: lead.sheetSourceId,
    uploadFileName: lead.uploadFileName,
    platform: lead.platform,
    campaignName: lead.campaignName,
    sheetLeadStatus: lead.sheetLeadStatus,
    externalId: lead.externalId,
  }
}

function enrichScheduledLeadFromLocalHistory(
  lead: CallingLead,
  localActions: StoredDealerCallingAction[],
): CallingLead {
  const leadMobile = normalizePhoneDigits(lead.mobile || "")
  const matches = localActions
    .filter((entry) => {
      if (entry.leadId && entry.leadId === lead.id) return true
      if (leadMobile && normalizePhoneDigits(entry.mobile || "") === leadMobile) return true
      return false
    })
    .sort((a, b) => new Date(b.actionAt || 0).getTime() - new Date(a.actionAt || 0).getTime())

  const followUpMatch =
    matches.find((entry) => entry.nextFollowUpAt && entry.nextFollowUpAt === lead.nextFollowUpAt) || matches[0]
  if (!followUpMatch) return lead

  return {
    ...lead,
    callRemark: pickRicherCallRemark(lead.callRemark, followUpMatch.callRemark),
    nextFollowUpAt: lead.nextFollowUpAt || followUpMatch.nextFollowUpAt,
    customerNote: lead.customerNote || followUpMatch.customerNote,
    kNumber: lead.kNumber || followUpMatch.kNumber,
    address: lead.address || followUpMatch.address,
    city: lead.city || followUpMatch.city,
    state: lead.state || followUpMatch.state,
  }
}

function collectScheduledLeads(
  response: unknown,
  normalizeApiLead: (raw: unknown) => CallingLead,
  actionLogs: ActionLogItem[],
  mainLeads: CallingLead[] = [],
): CallingLead[] {
  const rows: CallingLead[] = []
  const payload = (response || {}) as Record<string, unknown>

  for (const key of SCHEDULED_QUEUE_RESPONSE_KEYS) {
    for (const raw of readCallingQueueArray(payload[key])) {
      const lead = normalizeApiLead(raw)
      if (lead.nextFollowUpAt) rows.push(lead)
    }
  }

  for (const lead of mainLeads) {
    if (!lead.nextFollowUpAt) continue
    rows.push({
      ...lead,
      status: lead.status === "rescheduled" ? lead.status : "rescheduled",
    })
  }

  for (const item of actionLogs) {
    const fromAction = scheduledLeadFromActionLog(item)
    if (fromAction) rows.push(fromAction)
  }

  return dedupeScheduledLeads(rows).sort(
    (a, b) => new Date(a.nextFollowUpAt || 0).getTime() - new Date(b.nextFollowUpAt || 0).getTime(),
  )
}

function getScheduledLeadFreeRemark(lead: CallingLead): string {
  return cleanFreeCallRemark(parseTaggedCallRemark(lead.callRemark || "").remark || "")
}

export default function CallingDataPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { isAuthenticated, authReady, dealer, role, access, accountManager, visitor, hrUser } = useAuth()
  const { toast } = useToast()
  usePricingTables()
  const [downloadingPricingPdf, setDownloadingPricingPdf] = useState(false)
  const [pricingViewScope, setPricingViewScope] = useState<PricingPdfScope | null>(null)
  const [leads, setLeads] = useState<CallingLead[]>([])
  const [scheduledLeads, setScheduledLeads] = useState<CallingLead[]>([])
  const [recentActions, setRecentActions] = useState<ActionLogItem[]>([])
  const [dialledActions, setDialledActions] = useState<ActionLogItem[]>([])
  const [connectedActionItems, setConnectedActionItems] = useState<ActionLogItem[]>([])
  const [notConnectedActionItems, setNotConnectedActionItems] = useState<ActionLogItem[]>([])
  const [activeSubTab, setActiveSubTab] = useState("current")
  const [backendCounts, setBackendCounts] = useState<{ pending?: number; queued?: number; scheduled?: number; completed?: number }>({})
  const [callRemark, setCallRemark] = useState("")
  const [rescheduleAt, setRescheduleAt] = useState("")
  const [scheduledSearchTerm, setScheduledSearchTerm] = useState("")
  const [filterCities, setFilterCities] = useState<string[]>([])
  const [recentSearchTerm, setRecentSearchTerm] = useState("")
  const [interestedSearchTerm, setInterestedSearchTerm] = useState("")
  const [scheduledTimeFilter, setScheduledTimeFilter] = useState<"all" | "today" | "next7" | "next30">("all")
  const [recentActionFilter, setRecentActionFilter] = useState<"all" | "called" | "follow_up" | "not_interested" | "rescheduled">("all")
  const [recentCategoryFilter, setRecentCategoryFilter] = useState<string>("all")
  const [recentDateFilter, setRecentDateFilter] = useState<"all" | "today" | "week" | "month">("all")
  const [interestedCategoryFilter, setInterestedCategoryFilter] = useState<string>("all")
  const [interestedDateFilter, setInterestedDateFilter] = useState<"all" | "today" | "week" | "month">("all")
  const [selectedStatusGroup, setSelectedStatusGroup] = useState<StatusGroupKey>(STATUS_GROUPS[0].key)
  const [selectedStatus, setSelectedStatus] = useState<string>(STATUS_GROUPS[0].options[0])
  const [manualOtherReason, setManualOtherReason] = useState("")
  const [isRescheduleChecked, setIsRescheduleChecked] = useState(false)
  const [callConnection, setCallConnection] = useState<"" | "connected" | "not_connected">("")
  const [connectedOutcome, setConnectedOutcome] = useState<"" | "interested" | "not_interested" | "decision_pending">("")
  const [notConnectedReason, setNotConnectedReason] = useState<string>(NOT_CONNECTED_REASONS[0])
  const [lostReason, setLostReason] = useState<string>(LOST_REASONS[0])
  const [decisionReason, setDecisionReason] = useState<string>(DECISION_PENDING_REASONS[0])
  const [decisionOverride, setDecisionOverride] = useState<"pending" | "interested" | "not_interested">("pending")
  const [dealClosed, setDealClosed] = useState(false)
  const [scheduledEditTimes, setScheduledEditTimes] = useState<Record<string, string>>({})
  const [scheduledStatusGroups, setScheduledStatusGroups] = useState<Record<string, StatusGroupKey>>({})
  const [scheduledStatuses, setScheduledStatuses] = useState<Record<string, string>>({})
  const [scheduledOtherReasons, setScheduledOtherReasons] = useState<Record<string, string>>({})
  const [scheduledRescheduleChecks, setScheduledRescheduleChecks] = useState<Record<string, boolean>>({})
  const [scheduledRemarks, setScheduledRemarks] = useState<Record<string, string>>({})
  const [recentEditRemarks, setRecentEditRemarks] = useState<Record<string, string>>({})
  const [recentEditTimes, setRecentEditTimes] = useState<Record<string, string>>({})
  const [recentStatusGroups, setRecentStatusGroups] = useState<Record<string, StatusGroupKey>>({})
  const [recentStatuses, setRecentStatuses] = useState<Record<string, string>>({})
  const [recentOtherReasons, setRecentOtherReasons] = useState<Record<string, string>>({})
  const [recentRescheduleChecks, setRecentRescheduleChecks] = useState<Record<string, boolean>>({})
  const [notConnectedTransferChecks, setNotConnectedTransferChecks] = useState<Record<string, boolean>>({})
  const [notConnectedTransferReasons, setNotConnectedTransferReasons] = useState<Record<string, string>>({})
  const [notConnectedTransferOutcomes, setNotConnectedTransferOutcomes] = useState<
    Record<string, "interested" | "not_interested" | "decision_pending">
  >({})
  const [connectedCardOutcomes, setConnectedCardOutcomes] = useState<
    Record<string, "interested" | "not_interested" | "decision_pending">
  >({})
  const [scheduledCardOutcomes, setScheduledCardOutcomes] = useState<
    Record<string, "interested" | "not_interested" | "decision_pending">
  >({})
  const [dialledCardConnections, setDialledCardConnections] = useState<
    Record<string, "connected" | "not_connected">
  >({})
  const [dialledCardOutcomes, setDialledCardOutcomes] = useState<
    Record<string, "interested" | "not_interested" | "decision_pending">
  >({})
  const [dialledNotConnectedReasons, setDialledNotConnectedReasons] = useState<Record<string, string>>({})
  const [connectedOutcomeFilter, setConnectedOutcomeFilter] = useState<
    "all" | "interested" | "not_interested" | "decision_pending"
  >("all")
  const [dialledSearchTerm, setDialledSearchTerm] = useState("")
  const [dialledActionFilter, setDialledActionFilter] = useState<"all" | "called" | "follow_up" | "not_interested" | "rescheduled">("all")
  const [connectedSearchTerm, setConnectedSearchTerm] = useState("")
  const [notConnectedSearchTerm, setNotConnectedSearchTerm] = useState("")
  const [notConnectedReasonFilter, setNotConnectedReasonFilter] = useState<string>("all")
  const [historySourceFilter, setHistorySourceFilter] = useState<HistorySourceFilter>("all")
  const [scheduledPage, setScheduledPage] = useState(1)
  const [dialledPage, setDialledPage] = useState(1)
  const [connectedPage, setConnectedPage] = useState(1)
  const [notConnectedPage, setNotConnectedPage] = useState(1)
  const [flowPageSize, setFlowPageSize] = useState(10)
  const [editableLeadDetails, setEditableLeadDetails] = useState<EditableLeadDetails | null>(null)
  const [isEditingLead, setIsEditingLead] = useState(false)
  const [flowTab, setFlowTab] = useState<"current_lead" | "scheduled" | "dialled" | "connected" | "not_connected">("current_lead")
  const [analyticsRange, setAnalyticsRange] = useState<
    "daily" | "weekly" | "monthly" | "last_month" | "custom" | "all"
  >("daily")
  const [analyticsFromDate, setAnalyticsFromDate] = useState("")
  const [analyticsToDate, setAnalyticsToDate] = useState("")
  const [analyticsActions, setAnalyticsActions] = useState<ActionLogItem[]>([])
  const [submittingLeadMap, setSubmittingLeadMap] = useState<Record<string, boolean>>({})
  /** Locks Current Lead until Submit — prevents Start from skipping through the queue. */
  const [pinnedCurrentLead, setPinnedCurrentLead] = useState<CallingLead | null>(null)
  const pinnedCurrentLeadRef = useRef<CallingLead | null>(null)
  const useApi = process.env.NEXT_PUBLIC_USE_API !== "false"
  const previousCurrentLeadIdRef = useRef<string | null>(null)
  const shownScheduledReminderRef = useRef<Record<string, true>>({})
  const submittingLeadIdsRef = useRef<Set<string>>(new Set())
  const [queueSanctionedLeadIds, setQueueSanctionedLeadIds] = useState<Set<string>>(() => new Set())
  const isLeadSubmitting = (leadId?: string) => !!(leadId && submittingLeadMap[leadId])

  useEffect(() => {
    pinnedCurrentLeadRef.current = pinnedCurrentLead
  }, [pinnedCurrentLead])

  useEffect(() => {
    if (analyticsRange !== "custom") return
    if (analyticsFromDate || analyticsToDate) return
    const t = formatYmdLocal(new Date())
    setAnalyticsFromDate(t)
    setAnalyticsToDate(t)
  }, [analyticsRange, analyticsFromDate, analyticsToDate])

  const pinCurrentLeadForActiveCall = (lead: CallingLead) => {
    const pinned: CallingLead = { ...lead, status: "in_progress" }
    pinnedCurrentLeadRef.current = pinned
    setPinnedCurrentLead(pinned)
    setLeads((prev) => {
      const rest = prev.filter((l) => l.id !== lead.id)
      return [pinned, ...rest]
    })
  }

  const clearPinnedCurrentLead = () => {
    pinnedCurrentLeadRef.current = null
    setPinnedCurrentLead(null)
  }

  const restorePinnedLeadInQueue = () => {
    const pin = pinnedCurrentLeadRef.current
    if (!pin) return
    setLeads((prev) => {
      const merged = prev.find((l) => l.id === pin.id)
      const nextPin: CallingLead = { ...(merged || pin), status: "in_progress" }
      pinnedCurrentLeadRef.current = nextPin
      return [nextPin, ...prev.filter((l) => l.id !== pin.id)]
    })
    setPinnedCurrentLead(pinnedCurrentLeadRef.current)
  }
  const callingUser = dealer || accountManager || visitor || hrUser
  const currentDealerId = String(
    callingUser?.id || (dealer as any)?._id || (dealer as any)?.dealerId || "",
  ).trim()
  const currentDealerUsername = String(callingUser?.username || dealer?.username || "").trim().toLowerCase()
  const currentDealerFullName = `${callingUser?.firstName || dealer?.firstName || ""} ${callingUser?.lastName || dealer?.lastName || ""}`.trim().toLowerCase()
  const dealerCallingBatchIds = useMemo(() => {
    const d = dealer as Record<string, unknown> | null | undefined
    if (!d) return [] as string[]
    const raw =
      d.callingBatchIds ??
      d.calling_batch_ids ??
      d.uploadBatchIds ??
      d.upload_batch_ids ??
      d.hrUploadBatchIds ??
      d.hr_upload_batch_ids
    if (!Array.isArray(raw)) return [] as string[]
    return raw.map((x) => String(x).trim()).filter(Boolean)
  }, [dealer])

  const callingVisibilityCtx = useMemo<CallingLeadDealerVisibilityCtx>(
    () => ({
      currentDealerId,
      currentDealerUsername,
      currentDealerFullName,
      dealerCallingBatchIds,
    }),
    [currentDealerId, currentDealerUsername, currentDealerFullName, dealerCallingBatchIds],
  )

  const currentDealerIdentity = useMemo(
    () => ({
      id: currentDealerId,
      username: currentDealerUsername,
      fullName: currentDealerFullName,
    }),
    [currentDealerId, currentDealerUsername, currentDealerFullName],
  )

  const syncRescheduleForStatus = (nextStatus: string) => {
    const shouldReschedule = FOLLOW_UP_STATUSES.has(nextStatus)
    if (shouldReschedule) {
      setIsRescheduleChecked(true)
      setRescheduleAt((prev) => {
        if (prev) return prev
        // Default follow-up 1 hour from now for decision-pending flow
        const defaultIso = new Date(Date.now() + 60 * 60 * 1000).toISOString()
        return formatForDatetimeLocal(defaultIso)
      })
    } else {
      setIsRescheduleChecked(false)
      setRescheduleAt("")
    }
  }

  useEffect(() => {
    if (!authReady) return
    if (!isAuthenticated) {
      router.push("/login")
      return
    }
    if (
      !canOpenSection(access, role, "quotation") &&
      role !== "dealer" &&
      role !== "admin"
    ) {
      router.push(access?.length ? getPostLoginPath(access) : "/dashboard")
      return
    }
  }, [authReady, isAuthenticated, role, access, router])

  const normalizeApiLead = (lead: any): CallingLead => {
    const source = lead?.lead || lead?.customerLead || lead
    return {
      id: source?.id || source?._id || source?.leadId || source?.lead_id || `lead-${Date.now()}`,
      name: source?.name || source?.customerName || "Unknown",
      mobile: source?.mobile || source?.phone || "",
      altMobile: source?.altMobile || source?.alternateMobile || source?.alt_mobile || "",
      kNumber: source?.kNumber || source?.k_number || "",
      address: source?.address || "",
      customerNote: source?.customerNote || source?.customer_note || source?.note || "",
      city: source?.city || "",
      state: source?.state || "",
      // Calling assignee (includes legacy dealerId when assignee fields are empty).
      assignedDealerId: resolveCallingAssigneeId(source),
      assignedDealerName: normalizeCallingAssigneeToken(
        source?.assignedDealerName ||
          source?.assigned_dealer_name ||
          source?.assignedToName ||
          source?.assigned_to_name ||
          source?.assignedToUsername ||
          source?.assigned_to_username ||
          "",
      ),
      createdAt: source?.createdAt || source?.created_at || source?.assignedAt || source?.assigned_at || new Date().toISOString(),
      assignedAt: source?.assignedAt || source?.assigned_at,
      queuedAt: source?.queuedAt || source?.queued_at,
      status: source?.status || source?.leadStatus || source?.lead_status || "assigned",
      action: source?.action,
      actionAt: source?.actionAt || source?.action_at,
      nextFollowUpAt: source?.nextFollowUpAt || source?.next_follow_up_at,
      callRemark: resolveCallingActionRemark(source),
      uploadBatchId: (() => {
        const v = String(
          source?.uploadBatchId ||
            source?.upload_batch_id ||
            source?.batchId ||
            source?.batch_id ||
            source?.hrUploadBatchId ||
            source?.hr_upload_batch_id ||
            source?.callingUploadId ||
            source?.calling_upload_id ||
            "",
        ).trim()
        return v || undefined
      })(),
      uploadFileName: String(
        source?.uploadFileName ||
          source?.upload_file_name ||
          source?.batchFileName ||
          source?.batch_file_name ||
          source?.fileName ||
          source?.file_name ||
          source?.upload?.fileName ||
          source?.upload?.file_name ||
          "",
      ).trim() || undefined,
      sourceType: String(source?.sourceType || source?.source_type || source?.upload?.sourceType || source?.upload?.source_type || "").trim() || undefined,
      sheetSourceId: String(source?.sheetSourceId || source?.sheet_source_id || "").trim() || undefined,
      platform: String(source?.platform || "").trim() || undefined,
      campaignName: String(source?.campaignName || source?.campaign_name || "").trim() || undefined,
      adName: String(source?.adName || source?.ad_name || "").trim() || undefined,
      sheetLeadStatus: (() => {
        const explicit = String(
          source?.sheetLeadStatus || source?.sheet_lead_status || source?.metaLeadStatus || "",
        ).trim()
        if (explicit) return explicit
        const platform = String(source?.platform || "").trim()
        const leadStatusRaw = String(source?.lead_status || source?.leadStatus || "").trim()
        if (platform && leadStatusRaw) return leadStatusRaw
        return undefined
      })(),
      remarks: String(source?.remarks || "").trim() || undefined,
      remarks2: String(source?.remarks2 || source?.remarks_2 || "").trim() || undefined,
      kw: String(source?.kw || source?.kNumber || source?.k_number || "").trim() || undefined,
      finalDecision: String(source?.finalDecision || source?.final_decision || "").trim() || undefined,
      finalDecisionReason: String(source?.finalDecisionReason || source?.final_decision_reason || "").trim() || undefined,
      firstCallResponse: String(source?.firstCallResponse || source?.first_call_response || "").trim() || undefined,
      secondCallResponse: String(source?.secondCallResponse || source?.second_call_response || "").trim() || undefined,
      externalId: String(source?.externalId || source?.external_id || "").trim() || undefined,
      eligibleDealerIds: (() => {
        const raw =
          source?.eligibleDealerIds ||
          source?.eligible_dealer_ids ||
          source?.dealerIds ||
          source?.dealer_ids ||
          source?.batchDealerIds ||
          source?.batch_dealer_ids ||
          source?.dealerIdsInBatch ||
          source?.dealer_ids_in_batch
        if (!Array.isArray(raw)) return undefined
        const ids = raw.map((x: unknown) => String(x).trim()).filter(Boolean)
        return ids.length ? ids : undefined
      })(),
    }
  }

  const normalizeActionLog = (entry: any): ActionLogItem => {
    const lead = entry?.lead || entry
    const callRemark = resolveCallingActionRemark(entry) || resolveCallingActionRemark(lead)
    const leadId = String(entry?.leadId || entry?.lead_id || lead?.id || lead?._id || "").trim()
    const mobile = String(entry?.mobile || lead?.mobile || lead?.phone || "").trim()
    const queueLead =
      (leadId && leads.find((row) => row.id === leadId)) ||
      (mobile && leads.find((row) => journeyMobilesMatch(row.mobile, mobile))) ||
      undefined
    const tagged = parseTaggedCallRemark(callRemark)
    return {
      id:
        entry?.id ||
        entry?._id ||
        `${lead?.id || lead?._id || lead?.leadId || "lead"}-${entry?.actionAt || entry?.action_at || entry?.updatedAt || Date.now()}`,
      leadId: entry?.leadId || entry?.lead_id || lead?.id || lead?._id || "",
      name: entry?.name || lead?.name || "Unknown",
      mobile: entry?.mobile || lead?.mobile || lead?.phone || "",
      action: entry?.action || lead?.action,
      actionAt: entry?.actionAt || entry?.action_at || lead?.actionAt || lead?.action_at || entry?.updatedAt,
      callRemark,
      nextFollowUpAt: entry?.nextFollowUpAt || entry?.next_follow_up_at || lead?.nextFollowUpAt || lead?.next_follow_up_at,
      status: entry?.status || lead?.status || lead?.lead_status,
      statusText:
        entry?.statusText ||
        entry?.status_text ||
        lead?.statusText ||
        lead?.status_text ||
        entry?.status ||
        lead?.status ||
        tagged.status ||
        "",
      statusCategory:
        entry?.statusCategory ||
        entry?.status_category ||
        lead?.statusCategory ||
        lead?.status_category ||
        tagged.statusCategory ||
        "",
      status_text: entry?.status_text || lead?.status_text || tagged.status || "",
      status_category: entry?.status_category || lead?.status_category || tagged.statusCategory || "",
      kNumber: entry?.kNumber || lead?.kNumber || lead?.k_number || "",
      address: entry?.address || lead?.address || "",
      city: entry?.city || lead?.city || "",
      state: entry?.state || lead?.state || "",
      customerNote: entry?.customerNote || lead?.customerNote || "",
      sourceType: String(
        entry?.sourceType ||
          entry?.source_type ||
          lead?.sourceType ||
          lead?.source_type ||
          lead?.upload?.sourceType ||
          lead?.upload?.source_type ||
          queueLead?.sourceType ||
          "",
      ).trim() || undefined,
      source_type: String(entry?.source_type || lead?.source_type || queueLead?.sourceType || "").trim() || undefined,
      sheetSourceId: String(entry?.sheetSourceId || entry?.sheet_source_id || lead?.sheetSourceId || lead?.sheet_source_id || queueLead?.sheetSourceId || "").trim() || undefined,
      uploadFileName: String(
        entry?.uploadFileName ||
          entry?.upload_file_name ||
          lead?.uploadFileName ||
          lead?.upload_file_name ||
          lead?.fileName ||
          queueLead?.uploadFileName ||
          "",
      ).trim() || undefined,
      platform: String(entry?.platform || lead?.platform || queueLead?.platform || "").trim() || undefined,
      campaignName: String(entry?.campaignName || entry?.campaign_name || lead?.campaignName || lead?.campaign_name || queueLead?.campaignName || "").trim() || undefined,
      sheetLeadStatus: String(
        entry?.sheetLeadStatus ||
          entry?.sheet_lead_status ||
          lead?.sheetLeadStatus ||
          lead?.lead_status ||
          "",
      ).trim() || undefined,
      leadStatus: String(entry?.leadStatus || lead?.leadStatus || "").trim() || undefined,
      lead_status: String(entry?.lead_status || lead?.lead_status || "").trim() || undefined,
      externalId: String(entry?.externalId || entry?.external_id || lead?.externalId || lead?.external_id || "").trim() || undefined,
    }
  }

  const getSavedActionRemarkText = (item: ActionLogItem) => {
    const parsed = parseTaggedRemark(item.callRemark)
    if (parsed.remark?.trim()) return parsed.remark
    if (parsed.status?.trim()) return parsed.status
    return item.statusText || item.callRemark || ""
  }


  const getStoredDealerActionBuckets = () => {
    const stored: ActionLogItem[] = currentDealerId
      ? readDealerCallingActions(currentDealerId).map((row) => normalizeActionLog(row))
      : []
    const dialled = stored.filter((item) =>
      ["called", "follow_up", "not_interested", "rescheduled", "completed", "dialled"].includes(
        String(item.action || "").toLowerCase(),
      ) || Boolean(String(item.callRemark || item.statusText || "").trim()),
    )
    const connected = stored.filter((item) => {
      const parsed = parseTaggedCallRemark(item.callRemark)
      return Boolean(parsed.status) && !NOT_CONNECTED_REASONS.includes(parsed.status)
    })
    const notConnected = stored.filter((item) => {
      const parsed = parseTaggedCallRemark(item.callRemark)
      return Boolean(parsed.status) && NOT_CONNECTED_REASONS.includes(parsed.status)
    })
    return { all: stored, dialled, connected, notConnected }
  }

  const mergeActionLogEntries = (sources: any[]): ActionLogItem[] => {
    const map = new Map<string, ActionLogItem>()
    const fingerprintMap = new Map<string, string>()
    sources.forEach((entry) => {
      const normalized = normalizeActionLog(entry)
      if (!normalized?.id) return
      const mobile = normalizePhoneDigits(normalized.mobile || "")
      const actionAtMs = normalized.actionAt ? new Date(normalized.actionAt).getTime() : 0
      const actionMinute = Number.isFinite(actionAtMs) && actionAtMs > 0 ? Math.floor(actionAtMs / 60000) : ""
      const followUpDay = normalized.nextFollowUpAt
        ? new Date(normalized.nextFollowUpAt).toISOString().slice(0, 10)
        : ""
      // Collapse API + local duplicates of the same schedule/call for one lead.
      const fingerprints = [
        [normalized.leadId || "", normalized.actionAt || "", normalized.action || ""].join("|"),
        mobile.length >= 8
          ? ["m", mobile, normalized.action || "", actionMinute, followUpDay].join("|")
          : "",
        mobile.length >= 8 && (normalized.action === "follow_up" || normalized.action === "rescheduled")
          ? ["sched", mobile, followUpDay || actionMinute].join("|")
          : "",
      ].filter(Boolean)

      let existingId: string | undefined
      for (const fingerprint of fingerprints) {
        existingId = fingerprintMap.get(fingerprint)
        if (existingId) break
      }
      if (existingId) {
        const existing = map.get(existingId)!
        const normalizedIsNewer =
          new Date(normalized.actionAt || 0).getTime() >= new Date(existing.actionAt || 0).getTime()
        const newer = normalizedIsNewer ? normalized : existing
        const older = normalizedIsNewer ? existing : normalized
        const merged: ActionLogItem = {
          ...existing,
          ...normalized,
          id: existing.id,
          leadId: existing.leadId || normalized.leadId,
          action: newer.action || older.action,
          callRemark: newer.callRemark?.trim() || pickRicherCallRemark(existing.callRemark, normalized.callRemark),
          statusText: newer.statusText || older.statusText,
          statusCategory: newer.statusCategory || older.statusCategory,
          nextFollowUpAt: newer.nextFollowUpAt || older.nextFollowUpAt,
          actionAt: newer.actionAt || older.actionAt,
          sourceType: newer.sourceType || older.sourceType,
          source_type: newer.source_type || older.source_type,
          sheetSourceId: newer.sheetSourceId || older.sheetSourceId,
          uploadFileName: newer.uploadFileName || older.uploadFileName,
          platform: newer.platform || older.platform,
          campaignName: newer.campaignName || older.campaignName,
          sheetLeadStatus: newer.sheetLeadStatus || older.sheetLeadStatus,
          externalId: newer.externalId || older.externalId,
        }
        map.set(existingId, merged)
        for (const fingerprint of fingerprints) fingerprintMap.set(fingerprint, existingId)
        return
      }
      map.set(normalized.id, normalized)
      for (const fingerprint of fingerprints) fingerprintMap.set(fingerprint, normalized.id)
    })
    return Array.from(map.values()).sort(
      (a, b) => new Date(b.actionAt || 0).getTime() - new Date(a.actionAt || 0).getTime(),
    )
  }

  const latestActionPerLead = (items: ActionLogItem[]): ActionLogItem[] => {
    const map = new Map<string, ActionLogItem>()
    for (const item of items) {
      const key = item.leadId || (normalizePhoneDigits(item.mobile).slice(-10) || item.id)
      if (!key) continue
      const existing = map.get(key)
      if (!existing) {
        map.set(key, item)
        continue
      }
      const nextMs = new Date(item.actionAt || 0).getTime()
      const existingMs = new Date(existing.actionAt || 0).getTime()
      if (nextMs >= existingMs) map.set(key, item)
    }
    return Array.from(map.values()).sort(
      (a, b) => new Date(b.actionAt || 0).getTime() - new Date(a.actionAt || 0).getTime(),
    )
  }

  const extractCallingActionsFromResponse = (response: any): any[] => {
    const fromShared = extractCallingActionList(response)
    if (fromShared.length > 0) return fromShared
    const source =
      response?.actions ||
      response?.callingActions ||
      response?.items ||
      response?.logs ||
      response?.data ||
      response?.recentActions ||
      response?.actionHistory ||
      []
    return Array.isArray(source) ? source : []
  }

  const isDialledHistoryAction = (item: ActionLogItem) => {
    const action = String(item.action || "").toLowerCase()
    if (["start", "queued", "assigned", "pending"].includes(action)) return false
    if (["called", "follow_up", "not_interested", "rescheduled", "completed", "dialled", "connected"].includes(action)) {
      return true
    }
    // Backend rows sometimes omit `action` but still carry outcome remark/status.
    return Boolean(String(item.callRemark || item.statusText || item.status_text || "").trim())
  }

  const matchesActionLogSearch = (item: ActionLogItem, term: string, extraFields: string[] = []) => {
    const raw = term.trim().toLowerCase()
    if (!raw) return true
    const termDigits = normalizePhoneDigits(raw)
    if (termDigits.length >= 7 && journeyMobilesMatch(item.mobile, termDigits)) return true
    const haystack = [item.name, item.mobile, item.kNumber, item.address, item.callRemark, ...extraFields]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
    return haystack.includes(raw)
  }

  const formatDateTime = (value?: string) => {
    if (!value) return "N/A"
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return "N/A"
    return date.toLocaleString("en-IN")
  }

  const formatForDatetimeLocal = (value?: string) => {
    if (!value) return ""
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return ""
    const offset = date.getTimezoneOffset()
    const localDate = new Date(date.getTime() - offset * 60 * 1000)
    return localDate.toISOString().slice(0, 16)
  }

  const buildPriorCallReviewSources = useCallback((): PriorCallReviewSource[] => {
    return [
      ...recentActions,
      ...dialledActions,
      ...connectedActionItems,
      ...notConnectedActionItems,
      // Backend source of truth: do not mix in local cache rows.
    ]
  }, [recentActions, dialledActions, connectedActionItems, notConnectedActionItems, currentDealerId])

  const applyPriorCallReviewToForm = useCallback(
    (lead: CallingLead) => {
      const session = loadCallingLeadSession(lead.id)
      const prior = resolveLeadPriorCallReview(lead, buildPriorCallReviewSources())
      const sessionRemark = cleanFreeCallRemark(session?.callRemark || "")

      setCallRemark(sessionRemark || prior.freeRemark || getScheduledLeadFreeRemark(lead) || "")

      const hasSessionConnection =
        session?.callConnection === "connected" || session?.callConnection === "not_connected"
      const hasSessionOutcome =
        session?.connectedOutcome === "interested" ||
        session?.connectedOutcome === "not_interested" ||
        session?.connectedOutcome === "decision_pending"

      if (hasSessionConnection) {
        setCallConnection(session!.callConnection as "connected" | "not_connected")
      } else if (isFollowUpCallingLead(lead) && prior.statusText) {
        const inferred = inferCallFormDefaultsFromStatus(prior.statusText)
        setCallConnection(inferred.callConnection)
        setConnectedOutcome(inferred.connectedOutcome)
        if (inferred.decisionReason) setDecisionReason(inferred.decisionReason)
        if (inferred.notConnectedReason) setNotConnectedReason(inferred.notConnectedReason)
        if (inferred.lostReason) setLostReason(inferred.lostReason)
        if (inferred.connectedOutcome === "decision_pending") {
          setIsRescheduleChecked(true)
          setDecisionOverride("pending")
        }
      } else {
        setCallConnection("")
        setConnectedOutcome("")
        setNotConnectedReason(NOT_CONNECTED_REASONS[0])
        setLostReason(LOST_REASONS[0])
        setDecisionReason(DECISION_PENDING_REASONS[0])
        setDecisionOverride("pending")
        setDealClosed(false)
      }

      if (hasSessionOutcome) {
        setConnectedOutcome(session!.connectedOutcome as "interested" | "not_interested" | "decision_pending")
      } else if (!hasSessionConnection && isFollowUpCallingLead(lead) && prior.statusText) {
        const inferred = inferCallFormDefaultsFromStatus(prior.statusText)
        setConnectedOutcome(inferred.connectedOutcome)
      } else if (!hasSessionConnection) {
        setConnectedOutcome("")
      }

      const followUpAt = lead.nextFollowUpAt || prior.nextFollowUpAt
      if (followUpAt) {
        setRescheduleAt(formatForDatetimeLocal(followUpAt))
        if (isFollowUpCallingLead(lead)) setIsRescheduleChecked(true)
      } else if (!hasSessionConnection) {
        setRescheduleAt("")
      }

      setCallingActiveLeadId(lead.id)
    },
    [buildPriorCallReviewSources],
  )

  const getTaggedCategory = (remark?: string) => {
    const match = (remark || "").match(/^\[([^\]]+)\]/)
    const rawCategory = match?.[1] || ""
    return BACKEND_STATUS_CATEGORY_TO_LABEL[rawCategory] || rawCategory
  }

  const parseTaggedRemark = (remark?: string) => {
    const parsed = parseTaggedCallRemark(remark)
    return {
      category: parsed.statusCategory,
      status: parsed.status,
      remark: parsed.remark,
    }
  }

  const extractTransferReason = (remark?: string) => {
    const text = (remark || "").trim()
    if (!text) return ""
    const match = text.match(/(?:^|\|\s*)Transfer Reason:\s*([^|]+)/i)
    return (match?.[1] || "").trim()
  }

  const historyCardClass = (item: ActionLogItem, kind: "connected" | "not_connected") => {
    if (isSocialMediaCallingLead(item)) {
      return "border-sky-300 bg-gradient-to-b from-sky-50 to-indigo-50/70 shadow-sm border-l-4 border-l-sky-500"
    }
    return kind === "connected"
      ? "border-emerald-200/80 bg-gradient-to-b from-white to-emerald-50/40 shadow-sm border-l-4 border-l-emerald-500"
      : "border-rose-200/80 bg-gradient-to-b from-white to-rose-50/40 shadow-sm border-l-4 border-l-rose-400"
  }

  const getStatusGroupKeyByLabel = (label?: string | null) => {
    const clean = (label || "").trim()
    if (!clean) return null
    if (BACKEND_STATUS_CATEGORY_TO_GROUP_KEY[clean]) return BACKEND_STATUS_CATEGORY_TO_GROUP_KEY[clean]
    const group = STATUS_GROUPS.find((g) => g.label === clean)
    return group?.key ?? null
  }

  const getDisplayCategoryLabel = (rawCategory?: string | null) => {
    const clean = (rawCategory || "").trim()
    if (!clean) return ""
    return BACKEND_STATUS_CATEGORY_TO_LABEL[clean] || clean
  }

  const getBackendStatusCategory = (groupKey: StatusGroupKey, status: string) => {
    if (!status || status === OTHER_STATUS_VALUE) return "other"
    if (groupKey === "part_1_call_and_lead") {
      return CALL_CONNECTIVITY_STATUSES.has(status) ? "call_connectivity" : "lead_validity"
    }
    if (groupKey === "part_2_interest_qualification") {
      return CUSTOMER_INTENT_STATUSES.has(status) ? "customer_intent" : "financial"
    }
    if (groupKey === "part_3_followup_sales") return "schedule"
    if (groupKey === "part_4_rejection") return "competition"
    return "other"
  }

  const matchesDateRange = (value: string | undefined, range: "all" | "today" | "week" | "month") => {
    if (range === "all") return true
    if (!value) return false
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return false
    const now = new Date()
    if (range === "today") {
      return date.toDateString() === now.toDateString()
    }
    const diffMs = now.getTime() - date.getTime()
    if (range === "week") return diffMs >= 0 && diffMs <= 7 * 24 * 60 * 60 * 1000
    return diffMs >= 0 && diffMs <= 30 * 24 * 60 * 60 * 1000
  }

  const analyticsRangeBounds = useMemo(() => {
    if (analyticsRange === "all") return null
    if (analyticsRange === "custom") {
      return getCustomBoundsFromYmd(analyticsFromDate, analyticsToDate)
    }
    return getPresetBounds(analyticsRange)
  }, [analyticsRange, analyticsFromDate, analyticsToDate])

  const socialSourceIndex = useMemo(() => {
    const byLeadId = new Map<string, SocialSourceFields>()
    const byMobile = new Map<string, SocialSourceFields>()
    const indexSocialRow = (
      row: Parameters<typeof applyKnownSocialSource>[0] | CallingLead | null | undefined,
    ) => {
      if (!row || !isSocialMediaCallingLead(row)) return
      const fields = socialSourceFieldsFrom(row)
      const id = String((row as ActionLogItem).leadId || (row as CallingLead).id || "").trim()
      const mobile = normalizePhoneDigits(row.mobile || "").slice(-10)
      if (id) byLeadId.set(id, { ...byLeadId.get(id), ...fields })
      if (mobile.length >= 8) byMobile.set(mobile, { ...byMobile.get(mobile), ...fields })
    }
    leads.forEach(indexSocialRow)
    scheduledLeads.forEach(indexSocialRow)
    recentActions.forEach(indexSocialRow)
    dialledActions.forEach(indexSocialRow)
    connectedActionItems.forEach(indexSocialRow)
    notConnectedActionItems.forEach(indexSocialRow)
    analyticsActions.forEach(indexSocialRow)
    return { byLeadId, byMobile }
  }, [
    leads,
    scheduledLeads,
    recentActions,
    dialledActions,
    connectedActionItems,
    notConnectedActionItems,
    analyticsActions,
  ])

  const analyticsActionsForCards = useMemo(() => {
    const merged = mergeActionLogEntries([
      ...analyticsActions,
      ...recentActions,
      ...dialledActions,
      ...connectedActionItems,
      ...notConnectedActionItems,
    ])
    return merged.map((item) =>
      applyKnownSocialSource(item, socialSourceIndex.byLeadId, socialSourceIndex.byMobile),
    )
  }, [
    analyticsActions,
    recentActions,
    dialledActions,
    connectedActionItems,
    notConnectedActionItems,
    socialSourceIndex,
  ])

  const rangeFilteredActionsForAnalytics = useMemo(() => {
    if (analyticsRange === "all") return analyticsActionsForCards
    if (!analyticsRangeBounds) return []
    return analyticsActionsForCards.filter((item) => {
      const at = parseCallingActionAt(item.actionAt)
      if (!at) return false
      return at >= analyticsRangeBounds.start && at <= analyticsRangeBounds.end
    })
  }, [analyticsActionsForCards, analyticsRange, analyticsRangeBounds])

  const analyticsConnectionSummary = useMemo(
    () => buildCallingConnectionSummary(rangeFilteredActionsForAnalytics),
    [rangeFilteredActionsForAnalytics],
  )
  const analyticsOutcomeSummary = useMemo(
    () =>
      buildCallingActionSummary(
        rangeFilteredActionsForAnalytics.filter((item) => classifyCallingConnection(item) === "connected"),
      ),
    [rangeFilteredActionsForAnalytics],
  )

  const analyticsSourceSplit = useMemo(() => {
    const socialItems = rangeFilteredActionsForAnalytics.filter((item) => isSocialMediaCallingLead(item))
    const normalItems = rangeFilteredActionsForAnalytics.filter((item) => !isSocialMediaCallingLead(item))
    const socialConnected = socialItems.filter((item) => classifyCallingConnection(item) === "connected")
    const normalConnected = normalItems.filter((item) => classifyCallingConnection(item) === "connected")
    return {
      socialTotal: socialItems.length,
      normalTotal: normalItems.length,
      socialConnection: buildCallingConnectionSummary(socialItems),
      normalConnection: buildCallingConnectionSummary(normalItems),
      socialOutcome: buildCallingActionSummary(socialConnected),
      normalOutcome: buildCallingActionSummary(normalConnected),
    }
  }, [rangeFilteredActionsForAnalytics])

  // Each "Recent Actions" card must have its own local editing state.
  // Using `leadId` can cause state collisions when multiple recent history rows exist for the same lead/customer.
  const actionRowKey = (item: ActionLogItem) => item.id

  const openNewQuotationWithPrefill = (
    lead: CallingLead,
    overrides?: { callRemark?: string; customerNote?: string },
  ) => {
    const isActiveLead =
      currentLead?.id === lead.id || pinnedCurrentLeadRef.current?.id === lead.id || pinnedCurrentLead?.id === lead.id
    const customerNote =
      overrides?.customerNote ??
      (isActiveLead ? editableLeadDetails?.customerNote : undefined) ??
      lead.customerNote ??
      ""
    const callRemarkText =
      overrides?.callRemark ??
      (isActiveLead ? callRemark : "") ??
      parseTaggedCallRemark(lead.callRemark).remark ??
      ""

    saveCallingLeadSession(lead.id, {
      callRemark: callRemarkText,
      customerNote,
      callConnection: isActiveLead ? callConnection : undefined,
      connectedOutcome: isActiveLead ? connectedOutcome : undefined,
    })
    setCallingActiveLeadId(lead.id)

    const params = new URLSearchParams()
    params.set("prefillName", lead.name || "")
    params.set("prefillMobile", lead.mobile || "")
    params.set("prefillAddress", lead.address || "")
    params.set("prefillCity", lead.city || "")
    params.set("prefillState", lead.state || "")
    params.set("prefillLeadId", lead.id)
    params.set("returnTo", "/dashboard/calling-data")
    if (lead.kNumber?.trim()) params.set("prefillKNumber", lead.kNumber.trim())
    if (customerNote.trim()) params.set("prefillCustomerNote", customerNote.trim())
    if (callRemarkText.trim()) params.set("prefillCallRemark", callRemarkText.trim())
    const combinedRemarks = [customerNote.trim(), callRemarkText.trim()].filter(Boolean).join("\n\n")
    if (combinedRemarks) params.set("prefillRemarks", combinedRemarks)
    router.push(`/dashboard/new-quotation?${params.toString()}`)
  }

  const applyQueueResponse = (response: any, options?: { preservePinnedLead?: boolean }) => {
    const readArray = (value: any): any[] => {
      if (Array.isArray(value)) return value
      if (Array.isArray(value?.items)) return value.items
      if (Array.isArray(value?.rows)) return value.rows
      if (Array.isArray(value?.data)) return value.data
      return []
    }

    const pinned = options?.preservePinnedLead ? pinnedCurrentLeadRef.current : null

    const queueCandidates = [
      ...readArray(response?.leads),
      ...readArray(response?.queue),
      ...readArray(response?.pendingLeads),
      ...readArray(response?.assignedLeads),
      ...readArray(response?.currentQueue),
    ]
    let rawLead =
      response?.lead ||
      response?.currentLead ||
      response?.activeLead ||
      response?.nextLead ||
      queueCandidates[0] ||
      null

    // Before Start Call: if API head is raw CSV but queue lists include Google Sheet / Social, prefer social.
    if (!pinned) {
      const normalizedHead = rawLead ? normalizeApiLead(rawLead) : null
      const headIsInProgress =
        String(normalizedHead?.status || "").trim().toLowerCase() === "in_progress"
      if (!headIsInProgress) {
        const socialFromLists = queueCandidates
          .map((row) => {
            try {
              return normalizeApiLead(row)
            } catch {
              return null
            }
          })
          .find((lead) => lead && isSocialMediaCallingLead(lead))
        if (socialFromLists && (!normalizedHead || !isSocialMediaCallingLead(normalizedHead))) {
          rawLead = socialFromLists
        }
      }
    }

    // While a call is in progress, never swap the current lead for API `nextLead`.
    if (pinned) {
      const rawId = String(
        rawLead?.id || rawLead?._id || rawLead?.leadId || rawLead?.lead_id || "",
      ).trim()
      if (!rawId || rawId !== pinned.id) {
        rawLead = pinned
      }
    }
    const sanctionedIds = new Set<string>()
    const addSanctioned = (item: unknown) => {
      if (!item || typeof item !== "object") return
      const row = item as Record<string, unknown>
      const nested = (row.lead || row.customerLead || row) as Record<string, unknown>
      const id = String(nested?.id || nested?._id || nested?.leadId || nested?.lead_id || "").trim()
      if (id) sanctionedIds.add(id)
    }
    for (const item of [
      response?.lead,
      response?.nextLead,
      response?.currentLead,
      response?.activeLead,
      rawLead,
      pinned,
      ...queueCandidates,
    ]) {
      addSanctioned(item)
    }
    if (pinned?.id) sanctionedIds.add(pinned.id)
    setQueueSanctionedLeadIds((prev) => new Set([...prev, ...sanctionedIds]))

    const localScheduledHistory: StoredDealerCallingAction[] = []
    const enrichLeadFromHistory = (lead: CallingLead) =>
      enrichScheduledLeadFromLocalHistory(lead, localScheduledHistory)

    const mergedLeadMap = new Map<string, CallingLead>()
    ;[rawLead, ...queueCandidates]
      .filter(Boolean)
      .map(normalizeApiLead)
      .map(enrichLeadFromHistory)
      .forEach((lead) => {
        if (!lead?.id) return
        mergedLeadMap.set(lead.id, lead)
      })

    if (pinned?.id) {
      const fromApi = mergedLeadMap.get(pinned.id)
      const mergedPin: CallingLead = {
        ...(fromApi || pinned),
        ...pinned,
        ...(fromApi || {}),
        status: "in_progress",
      }
      mergedLeadMap.set(pinned.id, mergedPin)
      pinnedCurrentLeadRef.current = mergedPin
      setPinnedCurrentLead(mergedPin)
    }

    setLeads((prev) => {
      const fromResponse = Array.from(mergedLeadMap.values())
      if (!pinned?.id) return fromResponse

      const pinLead = mergedLeadMap.get(pinned.id)!
      const merged = new Map<string, CallingLead>()
      prev.forEach((lead) => merged.set(lead.id, lead))
      fromResponse.forEach((lead) => {
        const existing = merged.get(lead.id)
        merged.set(lead.id, existing ? { ...existing, ...lead } : lead)
      })
      merged.set(pinned.id, pinLead)
      return [pinLead, ...Array.from(merged.values()).filter((lead) => lead.id !== pinned.id)]
    })

    const storedBuckets = getStoredDealerActionBuckets()

    const dialledOnly = mergeActionLogEntries([
      ...storedBuckets.dialled,
      ...readArray(response?.dialledActions),
    ])
    const connectedOnly = mergeActionLogEntries([
      ...storedBuckets.connected,
      ...readArray(response?.connectedActions),
    ])
    const notConnectedOnly = mergeActionLogEntries([
      ...storedBuckets.notConnected,
      ...readArray(response?.notConnectedActions),
    ])
    const allActions = mergeActionLogEntries([
      ...storedBuckets.all,
      ...readArray(response?.recentActions),
      ...readArray(response?.actionHistory),
      ...readArray(response?.completedActions),
      ...readArray(response?.dialledActions),
      ...readArray(response?.connectedActions),
      ...readArray(response?.notConnectedActions),
      ...readArray(response?.actions),
      ...readArray(response?.callingActions),
    ])

    const normalizedScheduled = collectScheduledLeads(
      response,
      normalizeApiLead,
      allActions,
      Array.from(mergedLeadMap.values()),
    ).map((lead) => enrichScheduledLeadFromLocalHistory(lead, localScheduledHistory))
    setScheduledLeads(normalizedScheduled)

    setDialledActions(dialledOnly)
    setConnectedActionItems(connectedOnly)
    setNotConnectedActionItems(notConnectedOnly)
    setRecentActions(allActions)
    setAnalyticsActions((prev) =>
      mergeActionLogEntries([...prev, ...allActions, ...notConnectedOnly, ...connectedOnly, ...dialledOnly]),
    )
    setBackendCounts({
      pending: response?.pendingCount ?? response?.counts?.pending,
      queued: response?.queuedCount ?? response?.counts?.queued,
      scheduled: response?.scheduledCount ?? response?.counts?.scheduled,
      completed: response?.completedCount ?? response?.counts?.completed,
    })
  }

  /** Updates analytics/history tabs without replacing the active current lead from API `nextLead`. */
  const applyQueueMetadataFromResponse = (response: any) => {
    if (!response) return
    const readArray = (value: any): any[] => {
      if (Array.isArray(value)) return value
      if (Array.isArray(value?.items)) return value.items
      if (Array.isArray(value?.rows)) return value.rows
      if (Array.isArray(value?.data)) return value.data
      return []
    }

    const storedBuckets = getStoredDealerActionBuckets()

    const dialledOnly = mergeActionLogEntries([
      ...storedBuckets.dialled,
      ...readArray(response?.dialledActions),
    ])
    const connectedOnly = mergeActionLogEntries([
      ...storedBuckets.connected,
      ...readArray(response?.connectedActions),
    ])
    const notConnectedOnly = mergeActionLogEntries([
      ...storedBuckets.notConnected,
      ...readArray(response?.notConnectedActions),
    ])
    const allActions = mergeActionLogEntries([
      ...storedBuckets.all,
      ...readArray(response?.recentActions),
      ...readArray(response?.actionHistory),
      ...readArray(response?.completedActions),
      ...readArray(response?.dialledActions),
      ...readArray(response?.connectedActions),
      ...readArray(response?.notConnectedActions),
      ...readArray(response?.actions),
      ...readArray(response?.callingActions),
    ])

    const localScheduledHistory: StoredDealerCallingAction[] = []
    const mergedScheduled = collectScheduledLeads(response, normalizeApiLead, allActions).map((lead) =>
      enrichScheduledLeadFromLocalHistory(lead, localScheduledHistory),
    )
    if (mergedScheduled.length > 0) setScheduledLeads(mergedScheduled)

    if (dialledOnly.length > 0) setDialledActions(dialledOnly)
    if (connectedOnly.length > 0) setConnectedActionItems(connectedOnly)
    if (notConnectedOnly.length > 0) setNotConnectedActionItems(notConnectedOnly)
    if (allActions.length > 0) setRecentActions(allActions)
    if (allActions.length > 0 || notConnectedOnly.length > 0 || connectedOnly.length > 0 || dialledOnly.length > 0) {
      setAnalyticsActions((prev) =>
        mergeActionLogEntries([...prev, ...allActions, ...notConnectedOnly, ...connectedOnly, ...dialledOnly]),
      )
    }

    if (
      response?.pendingCount != null ||
      response?.queuedCount != null ||
      response?.scheduledCount != null ||
      response?.completedCount != null ||
      response?.counts
    ) {
      setBackendCounts({
        pending: response?.pendingCount ?? response?.counts?.pending,
        queued: response?.queuedCount ?? response?.counts?.queued,
        scheduled: response?.scheduledCount ?? response?.counts?.scheduled,
        completed: response?.completedCount ?? response?.counts?.completed,
      })
    }
  }

  const refreshCallingQueue = () => {
    if (submittingLeadIdsRef.current.size > 0) return
    const preservePinned = !!pinnedCurrentLeadRef.current
    void loadLeads({ preservePinnedLead: preservePinned })
    void loadDealerAnalyticsActions()
  }

  const loadLeads = async (options?: { preservePinnedLead?: boolean }) => {
    if (!authReady || !isAuthenticated) return
    if (!useApi) {
      setLeads([])
      toast({
        title: "API mode required",
        description: "Enable backend API mode to load dealer calling queue.",
        variant: "destructive",
      })
      return
    }

    const preservePinnedLead = options?.preservePinnedLead ?? !!pinnedCurrentLeadRef.current

    try {
      // Prefer /next (allocator). Treat /current as optional — it often 500s (SYS_001)
      // while /next still returns the lead.
      const nextResult = await Promise.allSettled([api.dealers.getCallingQueueNext()])
      const currentResult = await Promise.allSettled([api.dealers.getCallingQueueCurrent()])
      const nextResponse = nextResult[0].status === "fulfilled" ? nextResult[0].value : null
      const currentResponse = currentResult[0].status === "fulfilled" ? currentResult[0].value : null

      if (!nextResponse && !currentResponse) {
        const failed =
          nextResult[0].status === "rejected"
            ? nextResult[0].reason
            : currentResult[0].status === "rejected"
              ? currentResult[0].reason
              : new Error("Calling queue unavailable")
        throw failed
      }

      if (!nextResponse && currentResponse) {
        console.warn(
          "[calling-data] /calling-queue/next failed; using /current (or fallback) response only.",
        )
      } else if (nextResponse && !currentResponse) {
        console.warn(
          "[calling-data] /calling-queue/current failed (often SYS_001); using /next only.",
        )
      }
      const toArray = (value: any): any[] => {
        if (Array.isArray(value)) return value
        if (Array.isArray(value?.items)) return value.items
        if (Array.isArray(value?.rows)) return value.rows
        if (Array.isArray(value?.data)) return value.data
        return []
      }
      const mergeList = (key: string) => [...toArray((currentResponse as any)?.[key]), ...toArray((nextResponse as any)?.[key])]

      const mergedResponse: any = {
        ...(currentResponse || {}),
        ...(nextResponse || {}),
      }

      ;[
        "leads",
        "queue",
        "pendingLeads",
        "assignedLeads",
        "currentQueue",
        "scheduledLeads",
        "upcomingFollowUps",
        "followUps",
        "scheduled",
        "scheduledData",
        "scheduledItems",
        "rescheduledLeads",
        "recentActions",
        "actionHistory",
        "completedActions",
        "dialledActions",
        "connectedActions",
        "notConnectedActions",
        "actions",
        "callingActions",
      ].forEach((key) => {
        const merged = mergeList(key)
        if (merged.length > 0) mergedResponse[key] = merged
      })

      // Before Start Call: prefer Google Sheet / Social Media over raw CSV from /next|/current.
      // Only keep a non-social head when a call is already in_progress (Start done).
      const collectLeadCandidates = (): any[] => {
        const out: any[] = []
        const push = (v: any) => {
          if (!v) return
          if (Array.isArray(v)) {
            v.forEach(push)
            return
          }
          out.push(v)
        }
        push((currentResponse as any)?.lead)
        push((currentResponse as any)?.currentLead)
        push((currentResponse as any)?.activeLead)
        push((currentResponse as any)?.nextLead)
        push((nextResponse as any)?.lead)
        push((nextResponse as any)?.currentLead)
        push((nextResponse as any)?.activeLead)
        push((nextResponse as any)?.nextLead)
        ;["leads", "queue", "pendingLeads", "assignedLeads", "currentQueue"].forEach((key) => {
          push((currentResponse as any)?.[key])
          push((nextResponse as any)?.[key])
          push(mergedResponse[key])
        })
        return out
      }

      const normalizedCandidates = collectLeadCandidates()
        .map((row) => {
          try {
            return normalizeApiLead(row)
          } catch {
            return null
          }
        })
        .filter((lead): lead is CallingLead => Boolean(lead?.id))

      const inProgressLead = normalizedCandidates.find(
        (lead) => String(lead.status || "").trim().toLowerCase() === "in_progress",
      )
      const socialLead = normalizedCandidates.find((lead) => isSocialMediaCallingLead(lead))

      const preferredHead =
        preservePinnedLead && pinnedCurrentLeadRef.current
          ? pinnedCurrentLeadRef.current
          : inProgressLead || socialLead || normalizedCandidates[0] || null

      mergedResponse.lead = preferredHead
        ? preferredHead
        : (nextResponse as any)?.lead ||
          (nextResponse as any)?.nextLead ||
          (nextResponse as any)?.currentLead ||
          (currentResponse as any)?.lead ||
          (currentResponse as any)?.nextLead ||
          (currentResponse as any)?.currentLead ||
          mergedResponse.lead
      if (preferredHead) {
        mergedResponse.currentLead = preferredHead
        mergedResponse.nextLead = preferredHead
      }

      if (preservePinnedLead && pinnedCurrentLeadRef.current) {
        applyQueueMetadataFromResponse(mergedResponse)
        applyQueueResponse(mergedResponse, { preservePinnedLead: true })
        restorePinnedLeadInQueue()
      } else {
        applyQueueResponse(mergedResponse)
      }
    } catch (error) {
      const message =
        error instanceof ApiError ? error.details?.[0]?.message || error.message : "Could not load calling queue from backend."
      setLeads([])
      setScheduledLeads([])
      if (currentDealerId) {
        const storedBuckets = getStoredDealerActionBuckets()
        setRecentActions(mergeActionLogEntries(storedBuckets.all))
        setDialledActions(mergeActionLogEntries(storedBuckets.dialled))
        setConnectedActionItems(mergeActionLogEntries(storedBuckets.connected))
        setNotConnectedActionItems(mergeActionLogEntries(storedBuckets.notConnected))
      } else {
        setRecentActions([])
      }
      toast({
        title: "Backend queue unavailable",
        description: message,
        variant: "destructive",
      })
    }
  }

  const loadDealerAnalyticsActions = async () => {
    if (!authReady || !isAuthenticated) return

    const storedBuckets = getStoredDealerActionBuckets()
    const localActions = mergeActionLogEntries(storedBuckets.all)

    if (!useApi || !currentDealerId) {
      setAnalyticsActions(localActions)
      if (localActions.length > 0) {
        setRecentActions((prev) => mergeActionLogEntries([...prev, ...localActions]))
        setDialledActions((prev) =>
          mergeActionLogEntries([...prev, ...localActions.filter(isDialledHistoryAction)]),
        )
        setConnectedActionItems((prev) => mergeActionLogEntries([...prev, ...storedBuckets.connected]))
        setNotConnectedActionItems((prev) =>
          mergeActionLogEntries([...prev, ...storedBuckets.notConnected]),
        )
      }
      return
    }

    const queryParams = {
      limit: 2000,
      dealerId: currentDealerId,
      range: "all" as const,
    }

    let apiRows: any[] = []

    try {
      const response = await api.dealers.callingActions.getAll(queryParams)
      apiRows = extractCallingActionsFromResponse(response)
    } catch {
      apiRows = []
    }

    if (apiRows.length === 0) {
      try {
        const response = await api.hr.callingActions.getAll(queryParams)
        apiRows = extractCallingActionsFromResponse(response)
      } catch {
        // HR endpoint may return 403 for dealer logins — fall back to local history.
      }
    }

    const fromApi = apiRows.map((entry) => normalizeActionLog(entry))
    // Prefer API rows; keep local cache + in-memory optimistic submits so dashboard
    // counts do not drop while the backend catches up.
    setAnalyticsActions((prev) => {
      const merged = mergeActionLogEntries([...fromApi, ...localActions, ...prev])
      return merged.length > 0 ? merged : prev.length > 0 ? prev : localActions
    })

    const mergedForTabs = mergeActionLogEntries([...fromApi, ...localActions])
    if (mergedForTabs.length > 0) {
      const dialledFromHistory = mergedForTabs.filter(isDialledHistoryAction)
      const connectedFromHistory = mergedForTabs.filter((item) => {
        const parsed = parseTaggedCallRemark(item.callRemark)
        return Boolean(parsed.status) && !NOT_CONNECTED_REASONS.includes(parsed.status)
      })
      const notConnectedFromHistory = mergedForTabs.filter((item) => {
        const parsed = parseTaggedCallRemark(item.callRemark)
        return Boolean(parsed.status) && NOT_CONNECTED_REASONS.includes(parsed.status)
      })
      setRecentActions((prev) => mergeActionLogEntries([...prev, ...mergedForTabs]))
      setDialledActions((prev) => mergeActionLogEntries([...prev, ...dialledFromHistory]))
      setConnectedActionItems((prev) => mergeActionLogEntries([...prev, ...connectedFromHistory]))
      setNotConnectedActionItems((prev) => mergeActionLogEntries([...prev, ...notConnectedFromHistory]))
    }
  }

  useEffect(() => {
    if (!authReady || !isAuthenticated) return
    loadLeads()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authReady, isAuthenticated, useApi])

  useEffect(() => {
    if (!authReady || !isAuthenticated) return
    void loadDealerAnalyticsActions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authReady, isAuthenticated, useApi, currentDealerId])

  // When Dialled/Connected/Not Connected search looks like a mobile, ask backend for that number
  // (queue history is often truncated; analytics limit can also miss older rows).
  useEffect(() => {
    if (!authReady || !isAuthenticated || !useApi || !currentDealerId) return
    const term = (dialledSearchTerm || connectedSearchTerm || notConnectedSearchTerm).trim()
    const digits = normalizePhoneDigits(term)
    if (digits.length < 8) return

    let cancelled = false
    const timer = window.setTimeout(async () => {
      const queryParams = {
        limit: 200,
        dealerId: currentDealerId,
        search: digits.slice(-10),
        range: "all" as const,
      }
      let apiRows: any[] = []
      try {
        const response = await api.dealers.callingActions.getAll(queryParams)
        apiRows = extractCallingActionsFromResponse(response)
      } catch {
        apiRows = []
      }
      if (apiRows.length === 0) {
        try {
          const response = await api.hr.callingActions.getAll(queryParams)
          apiRows = extractCallingActionsFromResponse(response)
        } catch {
          apiRows = []
        }
      }
      if (cancelled || apiRows.length === 0) return

      const normalized = apiRows.map((entry) => normalizeActionLog(entry))
      const dialledFromHistory = normalized.filter(isDialledHistoryAction)
      const connectedFromHistory = normalized.filter((item) => {
        const parsed = parseTaggedCallRemark(item.callRemark)
        return Boolean(parsed.status) && !NOT_CONNECTED_REASONS.includes(parsed.status)
      })
      const notConnectedFromHistory = normalized.filter((item) => {
        const parsed = parseTaggedCallRemark(item.callRemark)
        return Boolean(parsed.status) && NOT_CONNECTED_REASONS.includes(parsed.status)
      })

      setAnalyticsActions((prev) => mergeActionLogEntries([...prev, ...normalized]))
      setRecentActions((prev) => mergeActionLogEntries([...prev, ...normalized]))
      setDialledActions((prev) => mergeActionLogEntries([...prev, ...dialledFromHistory]))
      setConnectedActionItems((prev) => mergeActionLogEntries([...prev, ...connectedFromHistory]))
      setNotConnectedActionItems((prev) => mergeActionLogEntries([...prev, ...notConnectedFromHistory]))
    }, 350)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    authReady,
    isAuthenticated,
    useApi,
    currentDealerId,
    dialledSearchTerm,
    connectedSearchTerm,
    notConnectedSearchTerm,
  ])

  useEffect(() => {
    if (!authReady || !isAuthenticated || !useApi) return

    const refresh = () => {
      refreshCallingQueue()
    }

    // Auto-refresh queue every 5 minutes; tab focus / visibility still refreshes immediately.
    const interval = window.setInterval(refresh, 5 * 60 * 1000)

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") refreshCallingQueue()
    }
    const onWindowFocus = () => refreshCallingQueue()

    document.addEventListener("visibilitychange", onVisibilityChange)
    window.addEventListener("focus", onWindowFocus)

    return () => {
      window.clearInterval(interval)
      document.removeEventListener("visibilitychange", onVisibilityChange)
      window.removeEventListener("focus", onWindowFocus)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authReady, isAuthenticated, useApi])

  useEffect(() => {
    if (!authReady || !isAuthenticated || !useApi) return
    const socket = getRealtime()
    if (!socket) return

    const refresh = () => {
      refreshCallingQueue()
    }

    const onBackendMutation = (evt: any) => {
      const domain = String(evt?.domain || "").toLowerCase()
      const path = String(evt?.path || "").toLowerCase()
      if (
        domain === "hr" ||
        domain === "dealer" ||
        domain === "dealers" ||
        path.includes("leads") ||
        path.includes("calling")
      ) {
        refresh()
      }
    }

    socket.on("calling:uploads-updated", refresh)
    socket.on("calling:actions-updated", refresh)
    socket.on("dealer:directory-updated", refresh)
    socket.on("backend:mutation", onBackendMutation)

    return () => {
      socket.off("calling:uploads-updated", refresh)
      socket.off("calling:actions-updated", refresh)
      socket.off("dealer:directory-updated", refresh)
      socket.off("backend:mutation", onBackendMutation)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authReady, isAuthenticated, useApi])

  useEffect(() => {
    const checkScheduledReminders = () => {
      const now = Date.now()
      for (const lead of scheduledLeads) {
        if (!callingLeadVisibleToDealer(lead, callingVisibilityCtx)) continue
        if (!lead.nextFollowUpAt) continue
        const followUpTimeMs = new Date(lead.nextFollowUpAt).getTime()
        if (Number.isNaN(followUpTimeMs) || followUpTimeMs > now) continue
        const reminderKey = `${lead.id}-${lead.nextFollowUpAt}`
        if (shownScheduledReminderRef.current[reminderKey]) continue
        shownScheduledReminderRef.current[reminderKey] = true
        toast({
          title: "Scheduled call reminder",
          description: `${lead.name || "Lead"} (${lead.mobile || "No mobile"}) is due for call now.`,
        })
      }
    }

    checkScheduledReminders()
    const intervalId = window.setInterval(checkScheduledReminders, 30000)
    return () => window.clearInterval(intervalId)
  }, [scheduledLeads, callingVisibilityCtx, toast])

  const getNormalizedStatus = (lead: CallingLead) => String(lead.status || "").trim().toLowerCase()
  const isLeadCallableNow = (lead: CallingLead) => {
    const status = getNormalizedStatus(lead)
    const nextMs = lead.nextFollowUpAt ? new Date(lead.nextFollowUpAt).getTime() : NaN
    const isDueReschedule = status === "rescheduled" && Number.isFinite(nextMs) && nextMs <= Date.now()
    if (isDueReschedule) return true
    if (["completed", "closed"].includes(status)) return false
    if (status === "rescheduled") return false
    return true
  }
  const getLeadSortTime = (lead: CallingLead) => {
    if (getNormalizedStatus(lead) === "rescheduled" && lead.nextFollowUpAt) return new Date(lead.nextFollowUpAt).getTime()
    return new Date(lead.assignedAt || lead.createdAt).getTime()
  }

  const hasUpcomingFollowUp = (item: { nextFollowUpAt?: string }) => {
    if (!item.nextFollowUpAt) return false
    const at = new Date(item.nextFollowUpAt).getTime()
    return Number.isFinite(at) && at > Date.now()
  }

  const dealerAssignedQueue = useMemo(() => {
    const leadOrder = new Map(leads.map((lead, index) => [lead.id, index]))

    return leads
      // FCFS work queue: assignee match, or pool/unassigned rows returned by /next|/current.
      .filter((lead) => {
        if (callingLeadAssignedToOtherDealer(lead, currentDealerIdentity)) return false
        if (!callingLeadVisibleToDealer(lead, callingVisibilityCtx)) return false
        if (!isLeadCallableNow(lead)) return false
        if (callingLeadAssignedToDealer(lead, currentDealerIdentity)) return true
        if (callingLeadIsPoolUnassigned(lead)) {
          // Prefer API-sanctioned ids (full queue/pending lists), else allow one pull from
          // dealer-eligible batches so free dealers are not stuck while Unassigned > 0.
          if (queueSanctionedLeadIds.has(lead.id)) return true
          const bid = String(lead.uploadBatchId || "").trim()
          if (bid && callingVisibilityCtx.dealerCallingBatchIds.includes(bid)) return true
          const eligible = lead.eligibleDealerIds
          if (Array.isArray(eligible) && eligible.length > 0 && currentDealerIdentity.id) {
            const cur = currentDealerIdentity.id.toLowerCase()
            return eligible.some((id) => String(id).trim().toLowerCase() === cur)
          }
          return false
        }
        return false
      })
      .sort((a, b) => {
        // Priority (product): Social Media before raw CSV — after finishing in_progress.
        // 1) in_progress (finish started call first)
        // 2) social / Google Sheet (assigned to me)
        // 3) social / Google Sheet (pool / claimable)
        // 4) other assigned (raw CSV)
        // 5) other pool unassigned
        // then FIFO by queuedAt / assignedAt
        const queueRank = (lead: CallingLead) => {
          const st = getNormalizedStatus(lead)
          if (st === "in_progress") return 0
          const social = isSocialMediaCallingLead(lead)
          const assignedToMe = callingLeadAssignedToDealer(lead, currentDealerIdentity)
          if (social && assignedToMe) return 1
          if (social) return 2
          if (assignedToMe) return 3
          return 4
        }
        const rankDiff = queueRank(a) - queueRank(b)
        if (rankDiff !== 0) return rankDiff

        const aQueued = a.queuedAt ? new Date(a.queuedAt).getTime() : NaN
        const bQueued = b.queuedAt ? new Date(b.queuedAt).getTime() : NaN
        const aTime = Number.isFinite(aQueued) ? aQueued : getLeadSortTime(a)
        const bTime = Number.isFinite(bQueued) ? bQueued : getLeadSortTime(b)
        if (aTime !== bTime) return aTime - bTime
        const aOrder = leadOrder.get(a.id) ?? Number.MAX_SAFE_INTEGER
        const bOrder = leadOrder.get(b.id) ?? Number.MAX_SAFE_INTEGER
        return aOrder - bOrder
      })
  }, [leads, callingVisibilityCtx, currentDealerIdentity, queueSanctionedLeadIds])

  const queuedCount = useMemo(() => {
    return leads.filter((lead) => {
      if (!callingLeadVisibleToDealer(lead, callingVisibilityCtx)) return false
      return lead.status === "queued"
    }).length
  }, [leads, callingVisibilityCtx])

  const derivedScheduledLeads = useMemo(() => {
    const fromLogs = latestActionPerLead(
      mergeActionLogEntries([
        ...analyticsActions,
        ...connectedActionItems,
        ...recentActions,
        ...dialledActions,
      ]),
    )
      .map((item) => applyKnownSocialSource(item, socialSourceIndex.byLeadId, socialSourceIndex.byMobile))
      .map(scheduledLeadFromActionLog)
      .filter((lead): lead is CallingLead => Boolean(lead))
    const fromQueue = scheduledLeads.filter((lead) =>
      isConnectedFollowUpAction({
        id: lead.id,
        leadId: lead.id,
        name: lead.name,
        mobile: lead.mobile,
        action: lead.action,
        actionAt: lead.actionAt,
        callRemark: lead.callRemark,
        nextFollowUpAt: lead.nextFollowUpAt,
        statusText: parseTaggedCallRemark(lead.callRemark || "").status,
      }),
    )
    return dedupeScheduledLeads([...fromQueue, ...fromLogs])
      .map((lead) => applyKnownSocialSourceToLead(lead, socialSourceIndex.byLeadId, socialSourceIndex.byMobile))
      .sort((a, b) => new Date(a.nextFollowUpAt || 0).getTime() - new Date(b.nextFollowUpAt || 0).getTime())
  }, [scheduledLeads, analyticsActions, connectedActionItems, recentActions, dialledActions, socialSourceIndex])

  const scheduledCount = useMemo(() => derivedScheduledLeads.length, [derivedScheduledLeads])

  const interestedActions = useMemo(
    () =>
      recentActions.filter((item) => {
        const remark = item.callRemark || ""
        return item.action === "called" && INTEREST_TAB_MATCHES.some((term) => remark.includes(term))
      }),
    [recentActions],
  )

  const filteredScheduledLeads = useMemo(() => {
    const term = scheduledSearchTerm.trim().toLowerCase()
    const now = new Date()
    const startOfToday = new Date(now)
    startOfToday.setHours(0, 0, 0, 0)
    const endOfToday = new Date(startOfToday)
    endOfToday.setDate(endOfToday.getDate() + 1)
    const nowMs = now.getTime()
    return derivedScheduledLeads.filter((lead) => {
      const nextAt = lead.nextFollowUpAt ? new Date(lead.nextFollowUpAt) : null
      const nextAtMs = nextAt && !Number.isNaN(nextAt.getTime()) ? nextAt.getTime() : NaN
      const matchesTime =
        scheduledTimeFilter === "all" ||
        !Number.isFinite(nextAtMs) ||
        (scheduledTimeFilter === "today"
          ? Number.isFinite(nextAtMs) && nextAtMs >= startOfToday.getTime() && nextAtMs < endOfToday.getTime()
          : scheduledTimeFilter === "next7"
            ? nextAtMs >= nowMs && nextAtMs <= nowMs + 7 * 24 * 60 * 60 * 1000
            : nextAtMs >= nowMs && nextAtMs <= nowMs + 30 * 24 * 60 * 60 * 1000)
      if (!matchesTime) return false
      if (!matchesCityFilter(lead, filterCities)) return false
      if (!matchesHistorySourceFilter(lead, historySourceFilter)) return false
      if (!term) return true
      const remarkText = getScheduledLeadFreeRemark(lead)
      const haystack = [lead.name, lead.mobile, lead.kNumber, lead.address, lead.city, lead.state, lead.callRemark, remarkText]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
      return haystack.includes(term)
    })
  }, [derivedScheduledLeads, scheduledSearchTerm, scheduledTimeFilter, filterCities, historySourceFilter])

  const filteredRecentActions = useMemo(() => {
    const term = recentSearchTerm.trim().toLowerCase()
    return recentActions.filter((item) => {
      if (recentActionFilter !== "all" && item.action !== recentActionFilter) return false
      const category = getTaggedCategory(item.callRemark)
      if (recentCategoryFilter !== "all" && category !== recentCategoryFilter) return false
      if (!matchesDateRange(item.actionAt, recentDateFilter)) return false
      if (!matchesCityFilter(item, filterCities)) return false
      if (!term) return true
      const haystack = [item.name, item.mobile, item.action, item.callRemark, item.kNumber, item.address, item.city, item.state]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
      return haystack.includes(term)
    })
  }, [recentActions, recentSearchTerm, recentActionFilter, recentCategoryFilter, recentDateFilter, filterCities])

  const filteredInterestedActions = useMemo(() => {
    const term = interestedSearchTerm.trim().toLowerCase()
    return interestedActions.filter((item) => {
      const category = getTaggedCategory(item.callRemark)
      if (interestedCategoryFilter !== "all" && category !== interestedCategoryFilter) return false
      if (!matchesDateRange(item.actionAt, interestedDateFilter)) return false
      if (!matchesCityFilter(item, filterCities)) return false
      if (!term) return true
      const haystack = [item.name, item.mobile, item.callRemark, item.kNumber, item.address, item.city, item.state]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
      return haystack.includes(term)
    })
  }, [interestedActions, interestedSearchTerm, interestedCategoryFilter, interestedDateFilter, filterCities])

  const currentLead = useMemo(() => {
    // Start Call done → keep pinned / in_progress lead until Submit.
    if (pinnedCurrentLead && getNormalizedStatus(pinnedCurrentLead) === "in_progress") {
      return pinnedCurrentLead
    }
    const inProgress = dealerAssignedQueue.find((lead) => getNormalizedStatus(lead) === "in_progress")
    if (inProgress) return inProgress

    // Start Call not done → Google Sheet / Social Media before raw CSV.
    const socialHead = dealerAssignedQueue.find((lead) => isSocialMediaCallingLead(lead))
    if (socialHead) return socialHead

    return dealerAssignedQueue[0] || null
  }, [pinnedCurrentLead, dealerAssignedQueue])

  const isSocialMediaCurrentLead = useMemo(
    () => isSocialMediaCallingLead(currentLead),
    [currentLead],
  )

  const socialLeadStatusDisplay = useMemo(() => {
    if (!currentLead || !isSocialMediaCurrentLead) return null
    return getSocialLeadStatusDisplay(callingLeadToSocialDisplayRow(currentLead))
  }, [currentLead, isSocialMediaCurrentLead])

  const socialLeadCardClass = useMemo(() => {
    if (!socialLeadStatusDisplay) {
      return "border-orange-200/70 bg-gradient-to-b from-white to-orange-50/30 shadow-sm"
    }
    return getSocialLeadCardSurfaceClass(socialLeadStatusDisplay)
  }, [socialLeadStatusDisplay])

  const currentLeadFieldSurface = isSocialMediaCurrentLead
    ? "border-sky-200/80 bg-white/90"
    : "border-orange-200/70 bg-white/90"

  useEffect(() => {
    if (pinnedCurrentLeadRef.current) return
    const head = dealerAssignedQueue[0]
    if (!head || getNormalizedStatus(head) !== "in_progress") return
    pinCurrentLeadForActiveCall(head)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealerAssignedQueue])

  const currentFlowStage: "current_lead" | "dialled" | "connected" | "not_connected" = !currentLead
    ? "current_lead"
    : !callConnection
      ? "current_lead"
      : callConnection === "connected"
        ? "connected"
        : "not_connected"

  const flowDialledActions = useMemo(() => {
    const merged = mergeActionLogEntries([
      ...dialledActions,
      ...connectedActionItems,
      ...notConnectedActionItems,
      ...recentActions,
      ...analyticsActions,
      ...derivedScheduledLeads.map(actionLogFromScheduledLead),
    ])
    return merged
      .filter((item) => {
        const action = String(item.action || "").toLowerCase()
        if (["start", "queued", "assigned", "pending"].includes(action)) return false
        if (isDialledHistoryAction(item) || isConnectedFollowUpAction(item)) return true
        const parsed = parseTaggedCallRemark(item.callRemark)
        return Boolean(parsed.status)
      })
      .map((item) => applyKnownSocialSource(item, socialSourceIndex.byLeadId, socialSourceIndex.byMobile))
  }, [
    dialledActions,
    connectedActionItems,
    notConnectedActionItems,
    recentActions,
    analyticsActions,
    derivedScheduledLeads,
    socialSourceIndex,
  ])

  const filteredFlowDialledActions = useMemo(() => {
    const term = dialledSearchTerm.trim()
    return flowDialledActions.filter((item) => {
      const action = String(item.action || "").toLowerCase()
      if (dialledActionFilter !== "all" && action !== dialledActionFilter) return false
      if (!matchesHistorySourceFilter(item, historySourceFilter)) return false
      return matchesActionLogSearch(item, term)
    })
  }, [flowDialledActions, dialledSearchTerm, dialledActionFilter, historySourceFilter])

  const flowConnectedActions = useMemo(() => {
    const merged = latestActionPerLead(
      mergeActionLogEntries([
        ...connectedActionItems,
        ...recentActions,
        ...analyticsActions,
        ...notConnectedActionItems,
        ...derivedScheduledLeads.map(actionLogFromScheduledLead),
      ]),
    )
    return merged
      .filter((item) => {
        if (classifyCallingConnection(item) === "not_connected") return false
        const parsed = parseTaggedRemark(item.callRemark)
        if (parsed.status && NOT_CONNECTED_REASONS.includes(parsed.status)) return false
        if (isConnectedFollowUpAction(item)) return true
        return !!parsed.status || ["called", "follow_up", "rescheduled", "not_interested"].includes(String(item.action || "").toLowerCase())
      })
      .map((item) => applyKnownSocialSource(item, socialSourceIndex.byLeadId, socialSourceIndex.byMobile))
  }, [connectedActionItems, recentActions, analyticsActions, notConnectedActionItems, derivedScheduledLeads, socialSourceIndex])

  function getConnectedOutcomeForStatus(status: string): "interested" | "not_interested" | "decision_pending" {
    if (LOST_REASONS.includes(status) || status === "Not Interested" || status === "Not Interested Currently") {
      return "not_interested"
    }
    if (DECISION_PENDING_REASONS.includes(status) || FOLLOW_UP_STATUSES.has(status) || status === "Rescheduled") {
      return "decision_pending"
    }
    return "interested"
  }

  const filteredFlowConnectedActions = useMemo(() => {
    const term = connectedSearchTerm.trim()
    const afterOutcomeFilter =
      connectedOutcomeFilter === "all"
        ? flowConnectedActions
        : flowConnectedActions.filter((item) => {
            const parsed = parseTaggedRemark(item.callRemark)
            const status = (parsed.status || "").trim()
            if (status) return getConnectedOutcomeForStatus(status) === connectedOutcomeFilter
            if (connectedOutcomeFilter === "decision_pending") return isConnectedFollowUpAction(item)
            const action = String(item.action || "").toLowerCase()
            if (connectedOutcomeFilter === "not_interested") return action === "not_interested"
            if (connectedOutcomeFilter === "interested") return action === "called" && !isConnectedFollowUpAction(item)
            return false
          })
    return afterOutcomeFilter.filter((item) => {
      if (!matchesHistorySourceFilter(item, historySourceFilter)) return false
      const parsed = parseTaggedRemark(item.callRemark)
      return matchesActionLogSearch(item, term, [parsed.status, parsed.remark])
    })
  }, [flowConnectedActions, connectedOutcomeFilter, connectedSearchTerm, historySourceFilter])

  const flowNotConnectedActions = useMemo(() => {
    const merged = latestActionPerLead(
      mergeActionLogEntries([
        ...notConnectedActionItems,
        ...recentActions,
        ...analyticsActions,
        ...connectedActionItems,
      ]),
    )
    return merged
      .filter((item) => {
        if (hasUpcomingFollowUp(item)) return false
        const parsed = parseTaggedRemark(item.callRemark)
        return !!parsed.status && NOT_CONNECTED_REASONS.includes(parsed.status)
      })
      .map((item) => applyKnownSocialSource(item, socialSourceIndex.byLeadId, socialSourceIndex.byMobile))
  }, [notConnectedActionItems, recentActions, analyticsActions, connectedActionItems, socialSourceIndex])
  const filteredFlowNotConnectedActions = useMemo(() => {
    const term = notConnectedSearchTerm.trim()
    return flowNotConnectedActions.filter((item) => {
      if (!matchesHistorySourceFilter(item, historySourceFilter)) return false
      const parsed = parseTaggedRemark(item.callRemark)
      const reason = (parsed.status || "").trim()
      if (notConnectedReasonFilter !== "all" && reason !== notConnectedReasonFilter) return false
      return matchesActionLogSearch(item, term, [reason, parsed.remark])
    })
  }, [flowNotConnectedActions, notConnectedSearchTerm, notConnectedReasonFilter, historySourceFilter])

  const paginateItems = <T,>(items: T[], page: number, pageSize: number) => {
    const totalPages = Math.max(1, Math.ceil(items.length / pageSize))
    const safePage = Math.min(Math.max(1, page), totalPages)
    const start = (safePage - 1) * pageSize
    return {
      totalPages,
      safePage,
      items: items.slice(start, start + pageSize),
    }
  }

  const pagedScheduled = useMemo(
    () => paginateItems(filteredScheduledLeads, scheduledPage, flowPageSize),
    [filteredScheduledLeads, scheduledPage, flowPageSize],
  )
  const pagedDialled = useMemo(
    () => paginateItems(filteredFlowDialledActions, dialledPage, flowPageSize),
    [filteredFlowDialledActions, dialledPage, flowPageSize],
  )
  const pagedConnected = useMemo(
    () => paginateItems(filteredFlowConnectedActions, connectedPage, flowPageSize),
    [filteredFlowConnectedActions, connectedPage, flowPageSize],
  )
  const pagedNotConnected = useMemo(
    () => paginateItems(filteredFlowNotConnectedActions, notConnectedPage, flowPageSize),
    [filteredFlowNotConnectedActions, notConnectedPage, flowPageSize],
  )
  useEffect(() => {
    if (scheduledPage !== pagedScheduled.safePage) setScheduledPage(pagedScheduled.safePage)
  }, [scheduledPage, pagedScheduled.safePage])
  useEffect(() => {
    if (dialledPage !== pagedDialled.safePage) setDialledPage(pagedDialled.safePage)
  }, [dialledPage, pagedDialled.safePage])
  useEffect(() => {
    if (connectedPage !== pagedConnected.safePage) setConnectedPage(pagedConnected.safePage)
  }, [connectedPage, pagedConnected.safePage])
  useEffect(() => {
    if (notConnectedPage !== pagedNotConnected.safePage) setNotConnectedPage(pagedNotConnected.safePage)
  }, [notConnectedPage, pagedNotConnected.safePage])

  const renderFlowPagination = (
    page: number,
    totalPages: number,
    totalItems: number,
    setPage: (next: number) => void,
  ) => (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
      <p className="text-xs text-muted-foreground">
        Showing page {page} of {totalPages} • Total {totalItems}
      </p>
      <div className="flex items-center gap-2">
        <Select
          value={String(flowPageSize)}
          onValueChange={(value) => {
            setFlowPageSize(Number(value))
            setPage(1)
          }}
        >
          <SelectTrigger className="h-8 w-20">
            <SelectValue placeholder="Rows" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="10">10</SelectItem>
            <SelectItem value="20">20</SelectItem>
            <SelectItem value="50">50</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>
          Previous
        </Button>
        <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
          Next
        </Button>
      </div>
    </div>
  )
  const leadForView = editableLeadDetails || {
    name: currentLead?.name || "",
    mobile: currentLead?.mobile || "",
    kNumber: currentLead?.kNumber || "",
    city: currentLead?.city || "",
    state: currentLead?.state || "",
    address: currentLead?.address || "",
    customerNote: currentLead?.customerNote || "",
  }

  const selectedStatusGroupConfig = STATUS_GROUPS.find((group) => group.key === selectedStatusGroup) || STATUS_GROUPS[0]
  const finalSelectedStatus = selectedStatus === OTHER_STATUS_VALUE ? manualOtherReason.trim() : selectedStatus

  const getActionFromStatus = (status: string): "called" | "follow_up" | "not_interested" => {
    if (NOT_INTERESTED_STATUSES.has(status)) return "not_interested"
    if (FOLLOW_UP_STATUSES.has(status)) return "follow_up"
    return "called"
  }

  const getDefaultStatusByGroup = (groupKey: StatusGroupKey) =>
    STATUS_GROUPS.find((group) => group.key === groupKey)?.options[0] || STATUS_GROUPS[0].options[0]

  const buildTaggedRemark = (groupKey: StatusGroupKey, status: string, remark: string) => {
    const backendCategory = getBackendStatusCategory(groupKey, status)
    const trimmed = cleanFreeCallRemark(remark)
    return `[${backendCategory}] ${status}${trimmed ? ` | ${trimmed}` : ""}`
  }

  const resolveScheduledRemarkForLead = (lead: CallingLead) =>
    scheduledRemarks[lead.id] ?? getScheduledLeadFreeRemark(lead)

  useEffect(() => {
    if (derivedScheduledLeads.length === 0) return

    setScheduledRemarks((prev) => {
      const next = { ...prev }
      for (const lead of derivedScheduledLeads) {
        if (next[lead.id] !== undefined) continue
        const freeRemark = getScheduledLeadFreeRemark(lead)
        if (freeRemark) next[lead.id] = freeRemark
      }
      return next
    })

    setScheduledStatuses((prev) => {
      const next = { ...prev }
      for (const lead of derivedScheduledLeads) {
        if (next[lead.id] !== undefined) continue
        const parsed = parseTaggedCallRemark(lead.callRemark || "")
        if (parsed.status) next[lead.id] = parsed.status
      }
      return next
    })

    setScheduledStatusGroups((prev) => {
      const next = { ...prev }
      for (const lead of derivedScheduledLeads) {
        if (next[lead.id] !== undefined) continue
        const parsed = parseTaggedCallRemark(lead.callRemark || "")
        if (parsed.status) next[lead.id] = findStatusGroupKeyForStatus(parsed.status)
      }
      return next
    })
  }, [derivedScheduledLeads])

  useEffect(() => {
    if (!currentLead) {
      if (pinnedCurrentLeadRef.current || submittingLeadIdsRef.current.size > 0) return
      setEditableLeadDetails(null)
      setIsEditingLead(false)
      previousCurrentLeadIdRef.current = null
      return
    }
    const hasLeadChanged = previousCurrentLeadIdRef.current !== currentLead.id
    if (!hasLeadChanged) return
    if (submittingLeadIdsRef.current.has(currentLead.id)) return

    previousCurrentLeadIdRef.current = currentLead.id
    const session = loadCallingLeadSession(currentLead.id)

    setEditableLeadDetails({
      name: currentLead.name || "",
      mobile: currentLead.mobile || "",
      kNumber: currentLead.kNumber || "",
      city: currentLead.city || "",
      state: currentLead.state || "",
      address: currentLead.address || "",
      customerNote: session?.customerNote ?? currentLead.customerNote ?? "",
    })
    setIsEditingLead(false)
    applyPriorCallReviewToForm(currentLead)
  }, [currentLead, applyPriorCallReviewToForm])

  useEffect(() => {
    const leadId = pinnedCurrentLead?.id || currentLead?.id
    if (!leadId) return
    saveCallingLeadSession(leadId, {
      callRemark,
      customerNote: editableLeadDetails?.customerNote ?? currentLead?.customerNote,
      callConnection,
      connectedOutcome,
    })
    setCallingActiveLeadId(leadId)
  }, [
    callRemark,
    editableLeadDetails?.customerNote,
    callConnection,
    connectedOutcome,
    pinnedCurrentLead?.id,
    currentLead?.id,
  ])

  useEffect(() => {
    const leadIdFromUrl = searchParams.get("leadId")?.trim()
    const leadId = leadIdFromUrl || getCallingActiveLeadId()
    if (!leadId) return

    const session = loadCallingLeadSession(leadId)
    if (!session) return

    if (session.callRemark) setCallRemark(cleanFreeCallRemark(session.callRemark))
    if (session.callConnection === "connected" || session.callConnection === "not_connected") {
      setCallConnection(session.callConnection as "connected" | "not_connected")
    }
    if (
      session.connectedOutcome === "interested" ||
      session.connectedOutcome === "not_interested" ||
      session.connectedOutcome === "decision_pending"
    ) {
      setConnectedOutcome(session.connectedOutcome as "interested" | "not_interested" | "decision_pending")
    }
    if (session.customerNote) {
      setEditableLeadDetails((prev) => {
        const base: EditableLeadDetails = prev || {
          name: "",
          mobile: "",
          kNumber: "",
          city: "",
          state: "",
          address: "",
          customerNote: "",
        }
        return { ...base, customerNote: session.customerNote || "" }
      })
    }
    setFlowTab("current_lead")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  const applyOptimisticCallStart = (leadId: string) => {
    const dealerName = `${dealer?.firstName || ""} ${dealer?.lastName || ""}`.trim()
    setLeads((prev) =>
      prev.map((l) =>
        l.id === leadId
          ? {
              ...l,
              status: "in_progress",
              assignedDealerId: currentDealerId || l.assignedDealerId,
              assignedDealerName: dealerName || l.assignedDealerName,
            }
          : l,
      ),
    )
  }

  const tryAssignLeadToCurrentDealer = async (leadId: string) => {
    if (!currentDealerId) return false
    try {
      const result = await api.dealers.assignCallingLeadToMe(leadId, currentDealerId)
      return result != null
    } catch {
      return false
    }
  }

  const applyOptimisticAssigneeAndStatus = (leadId: string, action: string) => {
    const dealerName = `${dealer?.firstName || ""} ${dealer?.lastName || ""}`.trim()
    const nextStatus: CallingLead["status"] =
      action === "rescheduled" || action === "follow_up" ? "rescheduled" : "completed"
    setLeads((prev) =>
      prev.map((l) =>
        l.id === leadId
          ? {
              ...l,
              status: nextStatus,
              assignedDealerId: currentDealerId || l.assignedDealerId,
              assignedDealerName: dealerName || l.assignedDealerName,
            }
          : l,
      ),
    )
  }

  const finalizeSubmittedLeadAction = (
    leadId: string,
    apiPayload: {
      action: string
      callRemark?: string
      actionAt?: string
      nextFollowUpAt?: string
    },
    response?: any,
  ) => {
    persistSubmittedCallRemark(leadId, apiPayload)
    saveCallingLeadSession(leadId, {
      callRemark: apiPayload.callRemark,
      customerNote: editableLeadDetails?.customerNote ?? currentLead?.customerNote,
    })
    setCallRemark("")
    setRescheduleAt("")
    setManualOtherReason("")
    setIsRescheduleChecked(false)
    setSelectedStatusGroup(STATUS_GROUPS[0].key)
    setSelectedStatus(STATUS_GROUPS[0].options[0])
    const wasCurrentQueueHead =
      pinnedCurrentLeadRef.current?.id === leadId || dealerAssignedQueue[0]?.id === leadId
    clearPinnedCurrentLead()
    if (response?.nextLead || response?.lead || response?.currentLead || response?.counts) {
      applyQueueResponse(response)
    }
    void loadLeads()
    // Keep Call Analytics cards in sync with the action just submitted (no manual reload).
    void loadDealerAnalyticsActions()
    if (wasCurrentQueueHead) {
      setFlowTab("current_lead")
    }
  }

  /** Copy number and mark in progress — next lead only after Submit (not on repeated Start). */
  const handleStartCall = async (lead: CallingLead) => {
    if (pinnedCurrentLead && pinnedCurrentLead.id !== lead.id) {
      toast({
        title: "Submit current lead first",
        description: "Finish and submit the open lead before starting another call.",
        variant: "destructive",
      })
      return
    }
    if (
      pinnedCurrentLead?.id === lead.id ||
      lead.status === "in_progress" ||
      submittingLeadIdsRef.current.has(lead.id)
    ) {
      void copyLeadPhone(lead.mobile)
      return
    }

    void copyLeadPhone(lead.mobile)
    pinCurrentLeadForActiveCall(lead)
    applyPriorCallReviewToForm(lead)
    await submitAction(lead.id, { action: "start" }, { optimisticOnNotAssigned: true })
  }

  const persistSubmittedCallRemark = (
    leadId: string,
    payload: { action: string; callRemark?: string; actionAt?: string; nextFollowUpAt?: string },
  ) => {
    if (!payload.callRemark?.trim()) return
    const fromHistory =
      notConnectedActionItems.find((row) => row.leadId === leadId) ||
      connectedActionItems.find((row) => row.leadId === leadId) ||
      dialledActions.find((row) => row.leadId === leadId) ||
      recentActions.find((row) => row.leadId === leadId) ||
      analyticsActions.find((row) => row.leadId === leadId)
    const lead = leads.find((l) => l.id === leadId) || pinnedCurrentLeadRef.current
    const parsed = parseTaggedRemark(payload.callRemark)
    setLeads((prev) =>
      prev.map((l) =>
        l.id === leadId
          ? {
              ...l,
              callRemark: payload.callRemark,
              action: payload.action as CallingLead["action"],
              actionAt: payload.actionAt,
              ...(payload.nextFollowUpAt ? { nextFollowUpAt: payload.nextFollowUpAt } : {}),
            }
          : l,
      ),
    )
    const actionItem: ActionLogItem = {
      id: `local-${leadId}-${payload.actionAt || Date.now()}`,
      leadId,
      name: lead?.name || fromHistory?.name || "Lead",
      mobile: lead?.mobile || fromHistory?.mobile || "",
      action: payload.action,
      callRemark: payload.callRemark,
      actionAt: payload.actionAt || new Date().toISOString(),
      nextFollowUpAt: payload.nextFollowUpAt,
      statusCategory: parsed.category,
      statusText: parsed.status,
      kNumber: lead?.kNumber || fromHistory?.kNumber,
      address: lead?.address || fromHistory?.address,
      city: lead?.city || fromHistory?.city,
      state: lead?.state || fromHistory?.state,
      customerNote: lead?.customerNote || fromHistory?.customerNote,
      sourceType:
        lead?.sourceType ||
        fromHistory?.sourceType ||
        (lead && isSocialMediaCallingLead(lead) ? "social_media" : undefined),
      source_type: fromHistory?.source_type || lead?.sourceType,
      sheetSourceId: lead?.sheetSourceId || fromHistory?.sheetSourceId,
      uploadFileName: lead?.uploadFileName || fromHistory?.uploadFileName,
      platform: lead?.platform || fromHistory?.platform,
      campaignName: lead?.campaignName || fromHistory?.campaignName,
      sheetLeadStatus: lead?.sheetLeadStatus || fromHistory?.sheetLeadStatus,
      externalId: lead?.externalId || fromHistory?.externalId,
    }
    // Backend source of truth: avoid writing call history into local cache.
    setRecentActions((prev) => {
      const withoutDup = prev.filter((a) => a.leadId !== leadId)
      return [actionItem, ...withoutDup]
    })
    // Optimistic analytics update so dashboard numbers move immediately on Submit.
    if (isDialledHistoryAction(actionItem)) {
      setAnalyticsActions((prev) => mergeActionLogEntries([actionItem, ...prev.filter((a) => a.leadId !== leadId)]))
    }
    const dialAction = String(payload.action || "").toLowerCase()
    if (["called", "follow_up", "not_interested", "rescheduled"].includes(dialAction)) {
      setDialledActions((prev) => {
        const withoutDup = prev.filter((a) => !(a.leadId === leadId && a.actionAt === actionItem.actionAt))
        return [actionItem, ...withoutDup]
      })
    }
    if (parsed.status && NOT_CONNECTED_REASONS.includes(parsed.status)) {
      setConnectedActionItems((prev) => prev.filter((a) => a.leadId !== leadId))
      setNotConnectedActionItems((prev) => [actionItem, ...prev.filter((a) => a.leadId !== leadId)])
      setScheduledLeads((prev) => prev.filter((row) => row.id !== leadId))
    } else if (parsed.status) {
      setNotConnectedActionItems((prev) => prev.filter((a) => a.leadId !== leadId))
      setConnectedActionItems((prev) => [actionItem, ...prev.filter((a) => a.leadId !== leadId)])
      const scheduled = scheduledLeadFromActionLog(actionItem)
      if (scheduled) {
        setScheduledLeads((prev) => dedupeScheduledLeads([scheduled, ...prev.filter((row) => row.id !== leadId)]))
      } else {
        setScheduledLeads((prev) => prev.filter((row) => row.id !== leadId))
      }
    }
  }

  const submitAction = async (
    leadId: string,
    payload: { action: "start" | "called" | "follow_up" | "not_interested" | "rescheduled"; callRemark?: string; nextFollowUpAt?: string; actionAt?: string },
    options?: { optimisticOnNotAssigned?: boolean; skipRescheduleFallback?: boolean; afterSuccess?: () => void },
  ) => {
    if (submittingLeadIdsRef.current.has(leadId)) return
    if (!useApi) {
      toast({
        title: "API mode required",
        description: "Enable backend API mode to submit dealer actions.",
        variant: "destructive",
      })
      return
    }
    submittingLeadIdsRef.current.add(leadId)
    setSubmittingLeadMap((prev) => ({ ...prev, [leadId]: true }))
    const actionAt = payload.actionAt || new Date().toISOString()
    const apiPayload = enrichCallingActionPayload({ ...payload, actionAt })
    try {
      let response: any
      try {
        response = await api.dealers.updateCallingLeadAction(leadId, apiPayload)
      } catch (innerError) {
        const isInvalidTransition =
          innerError instanceof ApiError &&
          (innerError.code === "LEAD_005" || /invalid lead action transition/i.test(innerError.message || ""))

        // Pool / unassigned lead: claim to current dealer then retry (fixes LEAD_004).
        if (!response && isLeadNotAssignedToDealerError(innerError) && currentDealerId) {
          const assigned = await tryAssignLeadToCurrentDealer(leadId)
          if (assigned) {
            try {
              response = await api.dealers.updateCallingLeadAction(leadId, enrichCallingActionPayload({ ...payload, actionAt }))
            } catch {
              // fall through
            }
          }
          if (!response) {
            try {
              await api.dealers.updateCallingLeadAction(leadId, {
                action: "start",
                actionAt,
                claim: true,
                autoAssign: true,
                assignedDealerId: currentDealerId,
              })
              response = await api.dealers.updateCallingLeadAction(leadId, enrichCallingActionPayload({ ...payload, actionAt }))
            } catch {
              try {
                await api.dealers.claimCallingLead(leadId)
                response = await api.dealers.updateCallingLeadAction(leadId, enrichCallingActionPayload({ ...payload, actionAt }))
              } catch {
                // fall through
              }
            }
          }
        }

        // Many backends require `start` (assigned/queued → in_progress) before completion actions.
        if (!response && isInvalidTransition && payload.action !== "start") {
          try {
            await api.dealers.updateCallingLeadAction(leadId, { action: "start", actionAt })
            response = await api.dealers.updateCallingLeadAction(leadId, enrichCallingActionPayload({ ...payload, actionAt }))
          } catch {
            // fall through to alternate action fallbacks below
          }
        }

        // Reschedule / follow-up: many backends 500 on `rescheduled` or require `start` first.
        if (
          !response &&
          payload.nextFollowUpAt &&
          (isInvalidTransition || isCallingActionServerError(innerError) || payload.action === "rescheduled")
        ) {
          try {
            await api.dealers.updateCallingLeadAction(leadId, { action: "start", actionAt })
          } catch {
            // ignore — may already be in_progress
          }
          for (const retryAction of ["follow_up", "rescheduled"] as const) {
            if (response) break
            try {
              response = await api.dealers.updateCallingLeadAction(
                leadId,
                enrichCallingActionPayload({ ...payload, action: retryAction, actionAt }),
              )
            } catch {
              // try next action
            }
          }
        }

        // Backend often blocks direct transition for older/recent cards.
        // Fallback to a valid rescheduled transition so status edits still persist.
        if (
          !response &&
          !options?.skipRescheduleFallback &&
          isInvalidTransition &&
          payload.action !== "rescheduled"
        ) {
          const fallbackNextFollowUpAt =
            payload.nextFollowUpAt ||
            new Date(Date.now() + 60 * 60 * 1000).toISOString()
          response = await api.dealers.updateCallingLeadAction(
            leadId,
            enrichCallingActionPayload({
              ...payload,
              action: "rescheduled",
              nextFollowUpAt: fallbackNextFollowUpAt,
              actionAt,
            }),
          )
        }

        if (!response) {
          if (
            options?.optimisticOnNotAssigned &&
            payload.action === "start" &&
            isLeadNotAssignedToDealerError(innerError)
          ) {
            applyOptimisticCallStart(leadId)
            return
          }
          if (payload.action !== "start" && isLeadNotAssignedToDealerError(innerError)) {
            applyOptimisticAssigneeAndStatus(leadId, payload.action)
            finalizeSubmittedLeadAction(leadId, apiPayload)
            options?.afterSuccess?.()
            return
          }
          throw innerError
        }
      }

      if (payload.action === "start") {
        applyOptimisticCallStart(leadId)
        const updatedLead = response?.lead || response?.currentLead || response?.activeLead
        if (updatedLead && pinnedCurrentLeadRef.current?.id === leadId) {
          pinCurrentLeadForActiveCall(
            normalizeApiLead({ ...pinnedCurrentLeadRef.current, ...updatedLead, status: "in_progress" }),
          )
        }
        applyQueueMetadataFromResponse(response)
        // Start does not change outcome counts, but keep history/analytics in sync if API echoed actions.
        void loadDealerAnalyticsActions()
        return
      }

      finalizeSubmittedLeadAction(leadId, apiPayload, response)
      options?.afterSuccess?.()
    } catch (error) {
      if (
        options?.optimisticOnNotAssigned &&
        payload.action === "start" &&
        (isLeadNotAssignedToDealerError(error) ||
          (error instanceof ApiError && error.code === "HTTP_403"))
      ) {
        applyOptimisticCallStart(leadId)
        return
      }
      if (payload.action !== "start" && isLeadNotAssignedToDealerError(error)) {
        applyOptimisticAssigneeAndStatus(leadId, payload.action)
        finalizeSubmittedLeadAction(leadId, apiPayload)
        options?.afterSuccess?.()
        return
      }
      if (payload.action === "start" && pinnedCurrentLeadRef.current?.id === leadId) {
        restorePinnedLeadInQueue()
      }
      const message =
        error instanceof ApiError ? error.details?.[0]?.message || error.message : "Failed to update lead action."
      toast({
        title: "Action failed",
        description: isCallingActionServerError(error)
          ? "Server could not save this reschedule. Please try again in a moment or contact support if it continues."
          : message,
        variant: "destructive",
      })
    } finally {
      submittingLeadIdsRef.current.delete(leadId)
      setSubmittingLeadMap((prev) => {
        if (!prev[leadId]) return prev
        const next = { ...prev }
        delete next[leadId]
        return next
      })
    }
  }

  const copyLeadPhone = async (mobile?: string) => {
    const result = await copyPhoneForDial(mobile)
    const digits = normalizePhoneDigits(mobile)
    if (result === "missing") {
      toast({
        title: "Phone number missing",
        description: "This lead does not have a valid mobile number.",
        variant: "destructive",
      })
      return
    }
    const display = formatPhoneForDisplay(digits)
    if (result === "dialer_opened_copied") {
      toast({
        title: "Number copied · Opening dialer",
        description: `${display} — return here after the call to submit the outcome.`,
      })
      return
    }
    if (result === "dialer_opened") {
      toast({
        title: "Opening dialer",
        description: `${display} — return here after the call to submit the outcome.`,
      })
      return
    }
    if (result === "copied") {
      toast({
        title: "Number copied",
        description: `${display} — dial from your phone; this page stays open.`,
      })
      return
    }
    toast({
      title: "Dial this number",
      description: display,
    })
  }

  const startCallFromRecent = async (item: ActionLogItem) => {
    if (pinnedCurrentLead) {
      toast({
        title: "Submit current lead first",
        description: "Finish the open lead on Current Lead before calling from history.",
        variant: "destructive",
      })
      return
    }
    void copyLeadPhone(item.mobile)

    if (!item.leadId || !useApi) return
    try {
      await api.dealers.updateCallingLeadAction(item.leadId, { action: "start" })
    } catch {
      // Ignore transition errors here; number is already copied.
    }
  }

  const handleHistorySourceFilterChange = (value: HistorySourceFilter) => {
    setHistorySourceFilter(value)
    setScheduledPage(1)
    setDialledPage(1)
    setConnectedPage(1)
    setNotConnectedPage(1)
  }

  const analyticsRangeFileLabel =
    analyticsRange === "custom"
      ? `${analyticsFromDate || "from"}_to_${analyticsToDate || "to"}`
      : analyticsRange

  const downloadCallingReport = (
    kind: "summary" | "analytics_log" | "scheduled" | "dialled" | "connected" | "not_connected",
  ) => {
    const stamp = formatYmdLocal(new Date())
    const dealerSlug = String(callingUser?.username || dealer?.username || "dealer")
      .trim()
      .toLowerCase()
      .replace(/[^\w.-]+/g, "-") || "dealer"

    if (kind === "summary") {
      const scheduledSocial = filteredScheduledLeads.filter((lead) => isSocialMediaCallingLead(lead)).length
      const dialledSocial = filteredFlowDialledActions.filter((item) => isSocialMediaCallingLead(item)).length
      const connectedSocial = filteredFlowConnectedActions.filter((item) => isSocialMediaCallingLead(item)).length
      const notConnectedSocial = filteredFlowNotConnectedActions.filter((item) => isSocialMediaCallingLead(item)).length
      downloadCsvFile({
        filename: `calling-report-summary-${dealerSlug}-${analyticsRangeFileLabel}-${stamp}.csv`,
        headers: ["Section", "Metric", "Total", "Social Media", "Calling data"],
        rows: [
          [
            "Analytics",
            "Total Calls",
            rangeFilteredActionsForAnalytics.length,
            analyticsSourceSplit.socialTotal,
            analyticsSourceSplit.normalTotal,
          ],
          [
            "Analytics",
            "Not Connected",
            analyticsConnectionSummary.notConnected,
            analyticsSourceSplit.socialConnection.notConnected,
            analyticsSourceSplit.normalConnection.notConnected,
          ],
          [
            "Analytics",
            "Connected",
            analyticsConnectionSummary.connected,
            analyticsSourceSplit.socialConnection.connected,
            analyticsSourceSplit.normalConnection.connected,
          ],
          [
            "Analytics",
            "Not Interested",
            analyticsOutcomeSummary.notInterested,
            analyticsSourceSplit.socialOutcome.notInterested,
            analyticsSourceSplit.normalOutcome.notInterested,
          ],
          [
            "Analytics",
            "Interested",
            analyticsOutcomeSummary.interested,
            analyticsSourceSplit.socialOutcome.interested,
            analyticsSourceSplit.normalOutcome.interested,
          ],
          [
            "Analytics",
            "Follow Up",
            analyticsOutcomeSummary.followUp,
            analyticsSourceSplit.socialOutcome.followUp,
            analyticsSourceSplit.normalOutcome.followUp,
          ],
          [
            "Scheduled",
            "Follow ups",
            filteredScheduledLeads.length,
            scheduledSocial,
            filteredScheduledLeads.length - scheduledSocial,
          ],
          [
            "Dialled",
            "Rows",
            filteredFlowDialledActions.length,
            dialledSocial,
            filteredFlowDialledActions.length - dialledSocial,
          ],
          [
            "Connected",
            "Rows",
            filteredFlowConnectedActions.length,
            connectedSocial,
            filteredFlowConnectedActions.length - connectedSocial,
          ],
          [
            "Not Connected",
            "Rows",
            filteredFlowNotConnectedActions.length,
            notConnectedSocial,
            filteredFlowNotConnectedActions.length - notConnectedSocial,
          ],
        ],
      })
      toast({
        title: "Report downloaded",
        description: `Summary for ${analyticsRangeFileLabel.replace(/_/g, " ")} saved as CSV.`,
      })
      return
    }

    const packs: Record<
      "analytics_log" | "scheduled" | "dialled" | "connected" | "not_connected",
      { filename: string; rows: Array<Array<string | number>>; empty: string; label: string }
    > = {
      analytics_log: {
        filename: `calling-report-log-${dealerSlug}-${analyticsRangeFileLabel}-${stamp}.csv`,
        rows: rangeFilteredActionsForAnalytics.map(actionLogReportRow),
        empty: "No calls in this analytics range.",
        label: "call log",
      },
      scheduled: {
        filename: `calling-report-scheduled-${dealerSlug}-${stamp}.csv`,
        rows: filteredScheduledLeads.map(scheduledLeadReportRow),
        empty: "No scheduled follow-ups to download.",
        label: "scheduled",
      },
      dialled: {
        filename: `calling-report-dialled-${dealerSlug}-${stamp}.csv`,
        rows: filteredFlowDialledActions.map(actionLogReportRow),
        empty: "No dialled rows to download.",
        label: "dialled",
      },
      connected: {
        filename: `calling-report-connected-${dealerSlug}-${stamp}.csv`,
        rows: filteredFlowConnectedActions.map(actionLogReportRow),
        empty: "No connected rows to download.",
        label: "connected",
      },
      not_connected: {
        filename: `calling-report-not-connected-${dealerSlug}-${stamp}.csv`,
        rows: filteredFlowNotConnectedActions.map(actionLogReportRow),
        empty: "No not-connected rows to download.",
        label: "not connected",
      },
    }
    const pack = packs[kind]
    if (pack.rows.length === 0) {
      toast({
        title: "No data to download",
        description: pack.empty,
      })
      return
    }
    downloadCsvFile({
      filename: pack.filename,
      headers: [...CALLING_DATA_REPORT_HEADERS],
      rows: pack.rows,
    })
    toast({
      title: "Report downloaded",
      description: `Exported ${pack.rows.length} ${pack.label} row${pack.rows.length === 1 ? "" : "s"}.`,
    })
  }

  if (!authReady || !isAuthenticated) return null

  return (
    <div className="min-h-screen bg-background">
      <DashboardNav />
      <main className="container mx-auto px-4 py-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full flex items-center justify-center border bg-gradient-to-br from-orange-100 to-amber-100 border-orange-200">
              <PhoneCall className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">Calling Data</h1>
              <p className="text-xs text-muted-foreground">Social Media and calling data together</p>
            </div>
          </div>
          <CityMultiSelectFilter
            value={filterCities}
            onChange={setFilterCities}
            className="w-full sm:w-56"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          One lead at a time. Submit the outcome before the next lead appears. Analytics update on submit; the queue
          also refreshes every 5 minutes.
        </p>

        <Card className="border-orange-200/70 bg-gradient-to-b from-white to-orange-50/20 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 flex items-center gap-2">
                <div className="w-7 h-7 rounded-full flex items-center justify-center border shrink-0 bg-orange-100 border-orange-200">
                  <PhoneCall className="w-3.5 h-3.5 text-orange-700" />
                </div>
                <div className="min-w-0">
                  <CardTitle className="text-sm sm:text-base">Dealer Call Analytics</CardTitle>
                  <p className="text-[11px] text-muted-foreground">
                    Social Media and calling data together. Same counts as Admin → Calling Reports.
                  </p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 shrink-0 w-full sm:w-auto">
                <Select
                  value={analyticsRange}
                  onValueChange={(value: "daily" | "weekly" | "monthly" | "last_month" | "custom" | "all") =>
                    setAnalyticsRange(value)
                  }
                >
                  <SelectTrigger className="h-8 w-full sm:w-36">
                    <SelectValue placeholder="Select range" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="last_month">Last month</SelectItem>
                    <SelectItem value="custom">Custom date range</SelectItem>
                    <SelectItem value="all">All time</SelectItem>
                  </SelectContent>
                </Select>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5 w-full sm:w-auto"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download report
                      <ChevronDown className="w-3.5 h-3.5 opacity-70" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => downloadCallingReport("summary")}>
                      Analytics summary
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => downloadCallingReport("analytics_log")}>
                      Call log (this range)
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => downloadCallingReport("scheduled")}>
                      Scheduled
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => downloadCallingReport("dialled")}>
                      Dialled
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => downloadCallingReport("connected")}>
                      Connected
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => downloadCallingReport("not_connected")}>
                      Not Connected
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5 w-full sm:w-auto"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      View pricing
                      <ChevronDown className="w-3.5 h-3.5 opacity-70" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {PRICING_PDF_SCOPE_OPTIONS.map((opt) => (
                      <DropdownMenuItem
                        key={`view-${opt.value}`}
                        onSelect={() => setPricingViewScope(opt.value as PricingPdfScope)}
                      >
                        {opt.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5 w-full sm:w-auto"
                      disabled={downloadingPricingPdf}
                    >
                      {downloadingPricingPdf ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Download className="w-3.5 h-3.5" />
                      )}
                      Download pricing PDF
                      <ChevronDown className="w-3.5 h-3.5 opacity-70" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {PRICING_PDF_SCOPE_OPTIONS.map((opt) => (
                      <DropdownMenuItem
                        key={opt.value}
                        onSelect={() => {
                          void (async () => {
                            setDownloadingPricingPdf(true)
                            try {
                              await downloadPricingPdf({ scope: opt.value as PricingPdfScope })
                              toast({
                                title: "Pricing PDF downloaded",
                                description: `${opt.shortLabel} package prices exported successfully.`,
                              })
                            } catch (error) {
                              toast({
                                title: "Download failed",
                                description:
                                  error instanceof Error
                                    ? error.message
                                    : "Could not generate the pricing PDF.",
                                variant: "destructive",
                              })
                            } finally {
                              setDownloadingPricingPdf(false)
                            }
                          })()
                        }}
                      >
                        {opt.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            {analyticsRange === "custom" ? (
              <div className="grid grid-cols-2 gap-2">
                <Input type="date" className="h-8" value={analyticsFromDate} onChange={(e) => setAnalyticsFromDate(e.target.value)} />
                <Input type="date" className="h-8" value={analyticsToDate} onChange={(e) => setAnalyticsToDate(e.target.value)} />
              </div>
            ) : null}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              <AnalyticsStat
                label="Total Calls"
                value={rangeFilteredActionsForAnalytics.length}
                hint={sourceSplitHint(analyticsSourceSplit.socialTotal, analyticsSourceSplit.normalTotal)}
                className="border-orange-200/80 bg-white"
              />
              <AnalyticsStat
                label="Not Connected"
                value={analyticsConnectionSummary.notConnected}
                hint={sourceSplitHint(
                  analyticsSourceSplit.socialConnection.notConnected,
                  analyticsSourceSplit.normalConnection.notConnected,
                )}
                className="border-slate-200 bg-slate-50/80"
              />
              <AnalyticsStat
                label="Connected"
                value={analyticsConnectionSummary.connected}
                hint={sourceSplitHint(
                  analyticsSourceSplit.socialConnection.connected,
                  analyticsSourceSplit.normalConnection.connected,
                )}
                className="border-emerald-200 bg-emerald-50/50"
              />
              <AnalyticsStat
                label="Not Interested"
                value={analyticsOutcomeSummary.notInterested}
                hint={sourceSplitHint(
                  analyticsSourceSplit.socialOutcome.notInterested,
                  analyticsSourceSplit.normalOutcome.notInterested,
                )}
                className="border-rose-200 bg-rose-50/40"
              />
              <AnalyticsStat
                label="Interested"
                value={analyticsOutcomeSummary.interested}
                hint={sourceSplitHint(
                  analyticsSourceSplit.socialOutcome.interested,
                  analyticsSourceSplit.normalOutcome.interested,
                )}
                className="border-emerald-200 bg-emerald-50/30"
              />
              <AnalyticsStat
                label="Follow Up"
                value={analyticsOutcomeSummary.followUp}
                hint={sourceSplitHint(
                  analyticsSourceSplit.socialOutcome.followUp,
                  analyticsSourceSplit.normalOutcome.followUp,
                )}
                className="border-blue-200 bg-blue-50/40"
              />
            </div>
          </CardContent>
        </Card>

        <Tabs value={activeSubTab} onValueChange={setActiveSubTab}>
          <TabsList className="hidden">
            <TabsTrigger value="current" className="shrink-0 text-xs sm:text-sm">Current Lead</TabsTrigger>
            <TabsTrigger value="scheduled" className="shrink-0 text-xs sm:text-sm">Scheduled</TabsTrigger>
            <TabsTrigger value="recent" className="shrink-0 text-xs sm:text-sm">Recent Actions</TabsTrigger>
            <TabsTrigger value="interested" className="shrink-0 text-xs sm:text-sm">Interested</TabsTrigger>
          </TabsList>

        <TabsContent value="current">
        <div className="mb-3">
          <Tabs
            value={flowTab}
            onValueChange={(value) => {
              setFlowTab(value as "current_lead" | "scheduled" | "dialled" | "connected" | "not_connected")
              setScheduledPage(1)
              setDialledPage(1)
              setConnectedPage(1)
              setNotConnectedPage(1)
            }}
          >
            <TabsList className="w-full justify-start overflow-x-auto whitespace-nowrap rounded-xl border border-orange-200/70 bg-gradient-to-r from-amber-50/70 to-orange-50/70 p-1 [&_[data-slot=tabs-trigger][data-state=active]]:bg-white [&_[data-slot=tabs-trigger][data-state=active]]:text-orange-700 [&_[data-slot=tabs-trigger][data-state=active]]:shadow-sm">
              <TabsTrigger value="current_lead" className="shrink-0 text-xs sm:text-sm">Current Lead</TabsTrigger>
              <TabsTrigger value="scheduled" className="shrink-0 text-xs sm:text-sm">Scheduled</TabsTrigger>
              <TabsTrigger value="dialled" className="shrink-0 text-xs sm:text-sm">Dialled</TabsTrigger>
              <TabsTrigger value="connected" className="shrink-0 text-xs sm:text-sm">Connected</TabsTrigger>
              <TabsTrigger value="not_connected" className="shrink-0 text-xs sm:text-sm">Not Connected</TabsTrigger>
            </TabsList>

            <TabsContent value="scheduled" className="mt-3 focus-visible:outline-none">
          <Card className="border-blue-200/70 bg-gradient-to-b from-white to-blue-50/25 shadow-sm">
            <CardHeader className="py-3">
              <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-2 shrink-0">
                  <div className="w-7 h-7 rounded-full bg-blue-100 border border-blue-200 flex items-center justify-center">
                    <CalendarDays className="w-3.5 h-3.5 text-blue-700" />
                  </div>
                  <div>
                    <CardTitle className="text-sm sm:text-base">Scheduled Follow Ups</CardTitle>
                    <p className="text-[11px] text-muted-foreground">
                      Change to Interested, Not Interested, or Decision Pending.{" "}
                      {sourceSplitHint(
                        filteredScheduledLeads.filter((lead) => isSocialMediaCallingLead(lead)).length,
                        filteredScheduledLeads.filter((lead) => !isSocialMediaCallingLead(lead)).length,
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto lg:max-w-3xl">
                  <Input
                    value={scheduledSearchTerm}
                    onChange={(e) => setScheduledSearchTerm(e.target.value)}
                    placeholder="Search name, mobile, K number..."
                    className="h-8 w-full sm:flex-1"
                  />
                  <HistorySourceFilterSelect value={historySourceFilter} onChange={handleHistorySourceFilterChange} />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 shrink-0"
                    onClick={() => downloadCallingReport("scheduled")}
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download
                  </Button>
                  <Select value={scheduledTimeFilter} onValueChange={(value) => setScheduledTimeFilter(value as typeof scheduledTimeFilter)}>
                    <SelectTrigger className="h-8 w-full sm:w-40">
                      <SelectValue placeholder="Filter time" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Time</SelectItem>
                      <SelectItem value="today">Today</SelectItem>
                      <SelectItem value="next7">Next 7 Days</SelectItem>
                      <SelectItem value="next30">Next 30 Days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {filteredScheduledLeads.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">No scheduled follow-ups available.</p>
              ) : (
                <div className="space-y-1.5">
                  {pagedScheduled.items.map((lead) => {
                    const parsed = parseTaggedCallRemark(lead.callRemark || "")
                    const outcome =
                      scheduledCardOutcomes[lead.id] ??
                      (parsed.status ? getConnectedOutcomeForStatus(parsed.status) : "decision_pending")
                    const isReschedule = scheduledRescheduleChecks[lead.id] ?? outcome === "decision_pending"
                    const remark = resolveScheduledRemarkForLead(lead)
                    const editedTime = scheduledEditTimes[lead.id] ?? formatForDatetimeLocal(lead.nextFollowUpAt)
                    const socialLead = isSocialMediaCallingLead(lead)
                    return (
                      <div
                        key={getScheduledLeadDedupeKey(lead)}
                        className={cn(
                          "rounded-lg px-3 py-2 text-sm space-y-1.5",
                          socialLead
                            ? "border-sky-300 bg-gradient-to-b from-sky-50 to-indigo-50/70 shadow-sm border-l-4 border-l-sky-500"
                            : "border-blue-200/80 bg-gradient-to-b from-white to-blue-50/40 shadow-sm border-l-4 border-l-blue-500",
                        )}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <p className="font-semibold truncate">{lead.name} • {lead.mobile}</p>
                          <Badge variant="outline" className="shrink-0 h-5 px-1.5 text-[10px] border-blue-200 bg-blue-50 text-blue-800">
                            Decision Pending
                          </Badge>
                          {socialLead ? (
                            <Badge variant="outline" className="shrink-0 h-5 px-1.5 text-[10px] border-sky-200 bg-sky-50 text-sky-900 gap-0.5">
                              <Sparkles className="w-2.5 h-2.5" />
                              Social
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="shrink-0 h-5 px-1.5 text-[10px] border-orange-200 bg-orange-50 text-orange-800">
                              Calling data
                            </Badge>
                          )}
                          <span className="ml-auto text-[11px] text-muted-foreground whitespace-nowrap">
                            {formatDateTime(lead.nextFollowUpAt)}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {[
                            lead.kNumber ? `K ${lead.kNumber}` : null,
                            lead.address || null,
                            lead.platform,
                            lead.campaignName,
                          ]
                            .filter(Boolean)
                            .join(" · ") || "K No / Address —"}
                        </p>
                        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.2fr)_11rem_auto_12rem_auto_auto_auto] gap-1.5 items-center">
                          <Input
                            className="h-8"
                            placeholder="Remark"
                            value={remark}
                            onChange={(e) => setScheduledRemarks((prev) => ({ ...prev, [lead.id]: e.target.value }))}
                          />
                          <Select
                            value={outcome}
                            onValueChange={(value: "interested" | "not_interested" | "decision_pending") => {
                              setScheduledCardOutcomes((prev) => ({ ...prev, [lead.id]: value }))
                              if (value === "decision_pending") {
                                setScheduledRescheduleChecks((prev) => ({ ...prev, [lead.id]: true }))
                              } else {
                                setScheduledRescheduleChecks((prev) => ({ ...prev, [lead.id]: false }))
                              }
                            }}
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue placeholder="Outcome" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="interested">Interested</SelectItem>
                              <SelectItem value="not_interested">Not Interested</SelectItem>
                              <SelectItem value="decision_pending">Decision Pending</SelectItem>
                            </SelectContent>
                          </Select>
                          <label
                            htmlFor={`scheduled-reschedule-flow-${lead.id}`}
                            className="flex items-center gap-1.5 text-[11px] text-muted-foreground whitespace-nowrap cursor-pointer"
                          >
                            <Checkbox
                              id={`scheduled-reschedule-flow-${lead.id}`}
                              checked={isReschedule}
                              disabled={outcome !== "decision_pending"}
                              onCheckedChange={(checked) =>
                                setScheduledRescheduleChecks((prev) => ({ ...prev, [lead.id]: checked === true }))
                              }
                            />
                            Reschedule
                          </label>
                          <Input
                            type="datetime-local"
                            className="h-8"
                            value={editedTime}
                            onChange={(e) => setScheduledEditTimes((prev) => ({ ...prev, [lead.id]: e.target.value }))}
                            disabled={outcome !== "decision_pending" || !isReschedule}
                          />
                          <Button
                            size="sm"
                            className="h-8 bg-blue-600 hover:bg-blue-700 text-white"
                            disabled={isLeadSubmitting(lead.id)}
                            onClick={() => {
                              let groupKey: StatusGroupKey = "part_2_interest_qualification"
                              let finalStatus = "Interested"
                              let nextAction: "called" | "follow_up" | "not_interested" | "rescheduled" = "called"
                              let nextFollowUpAt: string | undefined
                              if (outcome === "not_interested") {
                                groupKey = "part_4_rejection"
                                finalStatus = "Not Interested Currently"
                                nextAction = "not_interested"
                              } else if (outcome === "decision_pending") {
                                groupKey = "part_3_followup_sales"
                                finalStatus = "Follow-up Pending"
                                nextAction = isReschedule ? getRescheduleSubmitAction() : "follow_up"
                                const nextFollowUpRaw = editedTime || formatForDatetimeLocal(lead.nextFollowUpAt)
                                if (isReschedule && !nextFollowUpRaw) {
                                  toast({
                                    title: "Select follow-up time",
                                    description: "Please choose date and time before rescheduling.",
                                    variant: "destructive",
                                  })
                                  return
                                }
                                nextFollowUpAt = nextFollowUpRaw ? new Date(nextFollowUpRaw).toISOString() : lead.nextFollowUpAt
                              }
                              submitAction(lead.id, {
                                action: nextAction,
                                callRemark: buildTaggedRemark(groupKey, finalStatus, remark),
                                nextFollowUpAt,
                                actionAt: new Date().toISOString(),
                              })
                            }}
                          >
                            {isLeadSubmitting(lead.id) ? (
                              <span className="inline-flex items-center gap-1.5">
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                Saving...
                              </span>
                            ) : (
                              "Update"
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 border-blue-300 text-blue-700 hover:bg-blue-50"
                            disabled={isLeadSubmitting(lead.id)}
                            onClick={() => handleStartCall(lead)}
                          >
                            Start Call
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8"
                            onClick={() =>
                              openNewQuotationWithPrefill(lead, {
                                customerNote: remark,
                                callRemark: remark,
                              })
                            }
                          >
                            Quotation
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                  {renderFlowPagination(
                    pagedScheduled.safePage,
                    pagedScheduled.totalPages,
                    filteredScheduledLeads.length,
                    setScheduledPage,
                  )}
                </div>
              )}
            </CardContent>
          </Card>
            </TabsContent>

            <TabsContent value="dialled" className="mt-3 focus-visible:outline-none">
          <Card className="border-amber-200/70 bg-gradient-to-b from-white to-amber-50/25 shadow-sm">
            <CardHeader className="py-3">
              <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-2 shrink-0">
                  <div className="w-7 h-7 rounded-full bg-amber-100 border border-amber-200 flex items-center justify-center">
                    <PhoneCall className="w-3.5 h-3.5 text-amber-700" />
                  </div>
                  <CardTitle className="text-sm sm:text-base">Dialled Data</CardTitle>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto lg:max-w-3xl">
                  <Input
                    value={dialledSearchTerm}
                    onChange={(e) => {
                      setDialledSearchTerm(e.target.value)
                      setDialledPage(1)
                    }}
                    placeholder="Search name, mobile, K number..."
                    className="h-8 w-full sm:flex-1"
                  />
                  <HistorySourceFilterSelect value={historySourceFilter} onChange={handleHistorySourceFilterChange} />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 shrink-0"
                    onClick={() => downloadCallingReport("dialled")}
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download
                  </Button>
                  <Select
                    value={dialledActionFilter}
                    onValueChange={(value: "all" | "called" | "follow_up" | "not_interested" | "rescheduled") => {
                      setDialledActionFilter(value)
                      setDialledPage(1)
                    }}
                  >
                    <SelectTrigger className="h-8 w-full sm:w-44">
                      <SelectValue placeholder="Filter action" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Actions</SelectItem>
                      <SelectItem value="called">Called</SelectItem>
                      <SelectItem value="follow_up">Follow Up</SelectItem>
                      <SelectItem value="not_interested">Not Interested</SelectItem>
                      <SelectItem value="rescheduled">Rescheduled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {filteredFlowDialledActions.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">No dialled data found.</p>
              ) : (
                <div className="space-y-1.5">
                  {pagedDialled.items.map((item) => {
                    const parsed = parseTaggedRemark(item.callRemark)
                    const rowKey = actionRowKey(item)
                    const derivedStatus = (parsed.status || "").trim()
                    const inferred = inferCallFormDefaultsFromStatus(derivedStatus)
                    const connection =
                      dialledCardConnections[rowKey] ??
                      (classifyCallingConnection(item) === "not_connected" ? "not_connected" : "connected")
                    const outcome = dialledCardOutcomes[rowKey] ?? inferred.connectedOutcome
                    const ncReason =
                      dialledNotConnectedReasons[rowKey] ??
                      inferred.notConnectedReason ??
                      (NOT_CONNECTED_REASONS.includes(derivedStatus) ? derivedStatus : NOT_CONNECTED_REASONS[0])
                    const isReschedule =
                      recentRescheduleChecks[rowKey] ?? (connection === "connected" && outcome === "decision_pending")
                    const remark = recentEditRemarks[rowKey] ?? getSavedActionRemarkText(item)
                    const editedTime = recentEditTimes[rowKey] ?? formatForDatetimeLocal(item.nextFollowUpAt)
                    const socialLead = isSocialMediaCallingLead(item)
                    const notConnected = connection === "not_connected"
                    return (
                      <div
                        key={`dialled-${item.id}`}
                        className={cn(
                          "rounded-lg px-3 py-2 text-sm space-y-1.5 min-w-0",
                          socialLead
                            ? "border-sky-300 bg-gradient-to-b from-sky-50 to-indigo-50/70 shadow-sm border-l-4 border-l-sky-500"
                            : notConnected
                              ? "border-rose-200/80 bg-gradient-to-b from-white to-rose-50/35 shadow-sm border-l-4 border-l-rose-400"
                              : "border-amber-200/80 bg-gradient-to-b from-white to-amber-50/35 shadow-sm border-l-4 border-l-amber-400",
                        )}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <p className="font-semibold truncate">{item.name} • {item.mobile}</p>
                          <Badge
                            variant="outline"
                            className={cn(
                              "shrink-0 h-5 px-1.5 text-[10px]",
                              notConnected
                                ? "border-rose-200 bg-rose-50 text-rose-800"
                                : "border-emerald-200 bg-emerald-50 text-emerald-800",
                            )}
                          >
                            {notConnected ? "Not Connected" : "Connected"}
                          </Badge>
                          {socialLead ? (
                            <Badge variant="outline" className="shrink-0 h-5 px-1.5 text-[10px] border-sky-200 bg-sky-50 text-sky-900 gap-0.5">
                              <Sparkles className="w-2.5 h-2.5" />
                              Social
                            </Badge>
                          ) : null}
                          <span className="ml-auto text-[11px] text-muted-foreground whitespace-nowrap">
                            {item.action || parsed.status || "N/A"} · {formatDateTime(item.actionAt)}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {[
                            item.kNumber ? `K ${item.kNumber}` : null,
                            item.address || null,
                            parsed.status && parsed.status !== item.action ? parsed.status : null,
                            item.platform,
                            item.campaignName,
                          ]
                            .filter(Boolean)
                            .join(" · ") || "K No / Address —"}
                        </p>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Input
                            className="h-8 min-w-[12rem] flex-1 basis-48"
                            placeholder="Remark"
                            value={remark}
                            onChange={(e) => setRecentEditRemarks((prev) => ({ ...prev, [rowKey]: e.target.value }))}
                          />
                          <Select
                            value={connection}
                            onValueChange={(value: "connected" | "not_connected") => {
                              setDialledCardConnections((prev) => ({ ...prev, [rowKey]: value }))
                              if (value === "not_connected") {
                                setDialledCardOutcomes((prev) => ({ ...prev, [rowKey]: "not_interested" }))
                                setRecentRescheduleChecks((prev) => ({ ...prev, [rowKey]: false }))
                                if (!dialledNotConnectedReasons[rowKey]) {
                                  setDialledNotConnectedReasons((prev) => ({
                                    ...prev,
                                    [rowKey]: ncReason || NOT_CONNECTED_REASONS[0],
                                  }))
                                }
                              } else {
                                setDialledCardOutcomes((prev) => ({
                                  ...prev,
                                  [rowKey]: prev[rowKey] && prev[rowKey] !== "not_interested" ? prev[rowKey] : "interested",
                                }))
                              }
                            }}
                          >
                            <SelectTrigger className="h-8 w-[10.5rem] shrink-0">
                              <SelectValue placeholder="Connection" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="connected">Connected</SelectItem>
                              <SelectItem value="not_connected">Not Connected</SelectItem>
                            </SelectContent>
                          </Select>
                          {notConnected ? (
                            <Select
                              value={ncReason}
                              onValueChange={(value) =>
                                setDialledNotConnectedReasons((prev) => ({ ...prev, [rowKey]: value }))
                              }
                            >
                              <SelectTrigger className="h-8 w-[13.5rem] shrink-0">
                                <SelectValue placeholder="Reason" />
                              </SelectTrigger>
                              <SelectContent>
                                {NOT_CONNECTED_REASONS.map((option) => (
                                  <SelectItem key={`dialled-nc-${rowKey}-${option}`} value={option}>
                                    {option}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Select
                              value={outcome}
                              onValueChange={(value: "interested" | "not_interested" | "decision_pending") => {
                                setDialledCardOutcomes((prev) => ({ ...prev, [rowKey]: value }))
                                if (value === "decision_pending") {
                                  setRecentRescheduleChecks((prev) => ({ ...prev, [rowKey]: true }))
                                  setRecentEditTimes((prev) => ({
                                    ...prev,
                                    [rowKey]:
                                      prev[rowKey] ||
                                      formatForDatetimeLocal(new Date(Date.now() + 60 * 60 * 1000).toISOString()),
                                  }))
                                } else {
                                  setRecentRescheduleChecks((prev) => ({ ...prev, [rowKey]: false }))
                                }
                              }}
                            >
                              <SelectTrigger className="h-8 w-[13.5rem] shrink-0">
                                <SelectValue placeholder="Outcome" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="interested">Interested</SelectItem>
                                <SelectItem value="not_interested">Not Interested</SelectItem>
                                <SelectItem value="decision_pending">Decision Pending</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                          {connection === "connected" && outcome === "decision_pending" ? (
                            <>
                              <label
                                htmlFor={`dialled-reschedule-${rowKey}`}
                                className="flex items-center gap-1.5 text-[11px] text-muted-foreground whitespace-nowrap cursor-pointer shrink-0"
                              >
                                <Checkbox
                                  id={`dialled-reschedule-${rowKey}`}
                                  checked={isReschedule}
                                  onCheckedChange={(checked) =>
                                    setRecentRescheduleChecks((prev) => ({ ...prev, [rowKey]: checked === true }))
                                  }
                                />
                                Reschedule
                              </label>
                              <Input
                                type="datetime-local"
                                className="h-8 w-[13.5rem] shrink-0"
                                value={editedTime}
                                onChange={(e) => setRecentEditTimes((prev) => ({ ...prev, [rowKey]: e.target.value }))}
                                disabled={!isReschedule}
                              />
                            </>
                          ) : null}
                          <Button
                            size="sm"
                            className="h-8 shrink-0 bg-violet-600 hover:bg-violet-700 text-white"
                            disabled={!item.leadId || isLeadSubmitting(item.leadId)}
                            onClick={() => {
                              let groupKey: StatusGroupKey = "part_2_interest_qualification"
                              let finalStatus = "Interested"
                              let nextAction: "called" | "follow_up" | "not_interested" | "rescheduled" = "called"
                              let nextFollowUpAt: string | undefined
                              if (connection === "not_connected") {
                                groupKey = "part_1_call_and_lead"
                                finalStatus = ncReason
                                nextAction = "not_interested"
                              } else if (outcome === "not_interested") {
                                groupKey = "part_4_rejection"
                                finalStatus = "Not Interested Currently"
                                nextAction = "not_interested"
                              } else if (outcome === "decision_pending") {
                                groupKey = "part_3_followup_sales"
                                finalStatus = "Follow-up Pending"
                                nextAction = isReschedule ? getRescheduleSubmitAction() : "follow_up"
                                if (isReschedule && !editedTime) {
                                  toast({
                                    title: "Select follow-up time",
                                    description: "Please choose date and time before rescheduling.",
                                    variant: "destructive",
                                  })
                                  return
                                }
                                nextFollowUpAt = isReschedule && editedTime ? new Date(editedTime).toISOString() : undefined
                              }
                              submitAction(item.leadId, {
                                action: nextAction,
                                callRemark: buildTaggedRemark(groupKey, finalStatus, remark),
                                nextFollowUpAt,
                                actionAt: new Date().toISOString(),
                              })
                            }}
                          >
                            {isLeadSubmitting(item.leadId) ? (
                              <span className="inline-flex items-center gap-1.5">
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                Updating...
                              </span>
                            ) : (
                              "Update"
                            )}
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                  {renderFlowPagination(
                    pagedDialled.safePage,
                    pagedDialled.totalPages,
                    filteredFlowDialledActions.length,
                    setDialledPage,
                  )}
                </div>
              )}
            </CardContent>
          </Card>
            </TabsContent>

            <TabsContent value="connected" className="mt-3 focus-visible:outline-none">
          <Card className="border-emerald-200/70 bg-gradient-to-b from-white to-emerald-50/25 shadow-sm">
            <CardHeader className="py-3">
              <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-2 shrink-0">
                  <div className="w-7 h-7 rounded-full bg-emerald-100 border border-emerald-200 flex items-center justify-center">
                    <PhoneIncoming className="w-3.5 h-3.5 text-emerald-700" />
                  </div>
                  <CardTitle className="text-sm sm:text-base">Connected Data</CardTitle>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto lg:max-w-3xl">
                  <Input
                    value={connectedSearchTerm}
                    onChange={(e) => {
                      setConnectedSearchTerm(e.target.value)
                      setConnectedPage(1)
                    }}
                    placeholder="Search name, mobile, reason..."
                    className="h-8 w-full sm:flex-1"
                  />
                  <HistorySourceFilterSelect value={historySourceFilter} onChange={handleHistorySourceFilterChange} />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 shrink-0"
                    onClick={() => downloadCallingReport("connected")}
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download
                  </Button>
                  <Select
                    value={connectedOutcomeFilter}
                    onValueChange={(value: "all" | "interested" | "not_interested" | "decision_pending") => {
                      setConnectedOutcomeFilter(value)
                      setConnectedPage(1)
                    }}
                  >
                    <SelectTrigger className="h-8 w-full sm:w-44">
                      <SelectValue placeholder="Filter outcome" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="interested">Interested</SelectItem>
                      <SelectItem value="not_interested">Not Interested</SelectItem>
                      <SelectItem value="decision_pending">Decision Pending</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {filteredFlowConnectedActions.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">No connected data found.</p>
              ) : (
                <div className="space-y-1.5">
                  {pagedConnected.items.map((item) => {
                    const parsed = parseTaggedRemark(item.callRemark)
                    const transferReasonText = extractTransferReason(parsed.remark)
                    const rowKey = actionRowKey(item)
                    const derivedOutcome = getConnectedOutcomeForStatus((parsed.status || "").trim())
                    const connectedOutcome = connectedCardOutcomes[rowKey] ?? derivedOutcome
                    const isReschedule = recentRescheduleChecks[rowKey] ?? false
                    const remark = recentEditRemarks[rowKey] ?? getSavedActionRemarkText(item)
                    const editedTime = recentEditTimes[rowKey] ?? formatForDatetimeLocal(item.nextFollowUpAt)
                    const socialLead = isSocialMediaCallingLead(item)
                    return (
                      <div key={`connected-${item.id}`} className={cn("rounded-lg px-3 py-2 text-sm space-y-1.5", historyCardClass(item, "connected"))}>
                        <div className="flex items-center gap-2 min-w-0">
                          <p className="font-semibold truncate">{item.name} • {item.mobile}</p>
                          {socialLead ? (
                            <Badge variant="outline" className="shrink-0 h-5 px-1.5 text-[10px] border-sky-200 bg-sky-50 text-sky-900 gap-0.5">
                              <Sparkles className="w-2.5 h-2.5" />
                              Social
                            </Badge>
                          ) : null}
                          <span className="ml-auto text-[11px] text-muted-foreground whitespace-nowrap">
                            {parsed.status || "N/A"} · {formatDateTime(item.actionAt)}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {[
                            item.kNumber ? `K ${item.kNumber}` : null,
                            item.address || null,
                            item.platform,
                            item.campaignName,
                            transferReasonText ? `Transfer: ${transferReasonText}` : null,
                          ]
                            .filter(Boolean)
                            .join(" · ") || "K No / Address —"}
                        </p>
                        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.4fr)_11rem_auto_12rem_auto] gap-1.5 items-center">
                          <Input
                            className="h-8"
                            placeholder="Remark"
                            value={remark}
                            onChange={(e) => setRecentEditRemarks((prev) => ({ ...prev, [rowKey]: e.target.value }))}
                          />
                          <Select
                            value={connectedOutcome}
                            onValueChange={(value: "interested" | "not_interested" | "decision_pending") =>
                              setConnectedCardOutcomes((prev) => ({ ...prev, [rowKey]: value }))
                            }
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue placeholder="Outcome" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="interested">Interested</SelectItem>
                              <SelectItem value="not_interested">Not Interested</SelectItem>
                              <SelectItem value="decision_pending">Decision Pending</SelectItem>
                            </SelectContent>
                          </Select>
                          <label htmlFor={`connected-reschedule-${rowKey}`} className="flex items-center gap-1.5 text-[11px] text-muted-foreground whitespace-nowrap cursor-pointer">
                            <Checkbox
                              id={`connected-reschedule-${rowKey}`}
                              checked={isReschedule}
                              onCheckedChange={(checked) =>
                                setRecentRescheduleChecks((prev) => ({ ...prev, [rowKey]: checked === true }))
                              }
                            />
                            Reschedule
                          </label>
                          <Input
                            type="datetime-local"
                            className="h-8"
                            value={editedTime}
                            onChange={(e) => setRecentEditTimes((prev) => ({ ...prev, [rowKey]: e.target.value }))}
                            disabled={!isReschedule}
                          />
                          <Button
                            size="sm"
                            className="h-8 bg-violet-600 hover:bg-violet-700 text-white"
                            disabled={!item.leadId || isLeadSubmitting(item.leadId)}
                            onClick={() => {
                              let groupKey: StatusGroupKey = "part_2_interest_qualification"
                              let finalStatus = "Interested"
                              let nextAction: "called" | "follow_up" | "not_interested" | "rescheduled" = "called"
                              let nextFollowUpAt: string | undefined
                              if (connectedOutcome === "not_interested") {
                                groupKey = "part_4_rejection"
                                finalStatus = "Not Interested Currently"
                                nextAction = "not_interested"
                              } else if (connectedOutcome === "decision_pending") {
                                groupKey = "part_3_followup_sales"
                                finalStatus = "Follow-up Pending"
                                nextAction = isReschedule ? getRescheduleSubmitAction() : "follow_up"
                                nextFollowUpAt = isReschedule && editedTime ? new Date(editedTime).toISOString() : undefined
                              }
                              if (isReschedule && !editedTime) return
                              submitAction(item.leadId, {
                                action: nextAction,
                                callRemark: buildTaggedRemark(groupKey, finalStatus, remark),
                                nextFollowUpAt,
                                actionAt: new Date().toISOString(),
                              })
                            }}
                          >
                            {isLeadSubmitting(item.leadId) ? (
                              <span className="inline-flex items-center gap-1.5">
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                Updating...
                              </span>
                            ) : (
                              "Update"
                            )}
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                  {renderFlowPagination(
                    pagedConnected.safePage,
                    pagedConnected.totalPages,
                    filteredFlowConnectedActions.length,
                    setConnectedPage,
                  )}
                </div>
              )}
            </CardContent>
          </Card>
            </TabsContent>

            <TabsContent value="not_connected" className="mt-3 focus-visible:outline-none">
          <Card className="border-rose-200/70 bg-gradient-to-b from-white to-rose-50/25 shadow-sm">
            <CardHeader className="py-3">
              <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-2 shrink-0">
                  <div className="w-7 h-7 rounded-full bg-rose-100 border border-rose-200 flex items-center justify-center">
                    <PhoneOff className="w-3.5 h-3.5 text-rose-700" />
                  </div>
                  <CardTitle className="text-sm sm:text-base">Not Connected Data</CardTitle>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto lg:max-w-3xl">
                  <Input
                    value={notConnectedSearchTerm}
                    onChange={(e) => {
                      setNotConnectedSearchTerm(e.target.value)
                      setNotConnectedPage(1)
                    }}
                    placeholder="Search name, mobile, K number..."
                    className="h-8 w-full sm:flex-1"
                  />
                  <HistorySourceFilterSelect value={historySourceFilter} onChange={handleHistorySourceFilterChange} />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 shrink-0"
                    onClick={() => downloadCallingReport("not_connected")}
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download
                  </Button>
                  <Select
                    value={notConnectedReasonFilter}
                    onValueChange={(value) => {
                      setNotConnectedReasonFilter(value)
                      setNotConnectedPage(1)
                    }}
                  >
                    <SelectTrigger className="h-8 w-full sm:w-44">
                      <SelectValue placeholder="All Reasons" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Reasons</SelectItem>
                      {NOT_CONNECTED_REASONS.map((option) => (
                        <SelectItem key={`filter-${option}`} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {filteredFlowNotConnectedActions.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">No not-connected data found.</p>
              ) : (
                <div className="space-y-1.5">
                  {pagedNotConnected.items.map((item) => {
                    const parsed = parseTaggedRemark(item.callRemark)
                    const transferReasonText = extractTransferReason(parsed.remark)
                    const rowKey = actionRowKey(item)
                    const derivedReason = NOT_CONNECTED_REASONS.includes(parsed.status) ? parsed.status : NOT_CONNECTED_REASONS[0]
                    const selectedReasonRaw = recentStatuses[rowKey] ?? derivedReason
                    const selectedReason = NOT_CONNECTED_REASONS.includes(selectedReasonRaw) ? selectedReasonRaw : derivedReason
                    const remark = recentEditRemarks[rowKey] ?? getSavedActionRemarkText(item)
                    const transferToConnected = notConnectedTransferChecks[rowKey] ?? false
                    const transferReason = notConnectedTransferReasons[rowKey] ?? ""
                    const transferOutcome = notConnectedTransferOutcomes[rowKey] ?? "interested"
                    const isReschedule = recentRescheduleChecks[rowKey] ?? transferOutcome === "decision_pending"
                    const editedTime = recentEditTimes[rowKey] ?? formatForDatetimeLocal(item.nextFollowUpAt)
                    const socialLead = isSocialMediaCallingLead(item)
                    return (
                      <div key={`not-connected-${item.id}`} className={cn("rounded-lg px-3 py-2 text-sm space-y-1.5", historyCardClass(item, "not_connected"))}>
                        <div className="flex items-center gap-2 min-w-0">
                          <p className="font-semibold truncate">{item.name} • {item.mobile}</p>
                          {socialLead ? (
                            <Badge variant="outline" className="shrink-0 h-5 px-1.5 text-[10px] border-sky-200 bg-sky-50 text-sky-900 gap-0.5">
                              <Sparkles className="w-2.5 h-2.5" />
                              Social
                            </Badge>
                          ) : null}
                          <span className="ml-auto text-[11px] text-muted-foreground whitespace-nowrap">
                            {selectedReason || "N/A"} · {formatDateTime(item.actionAt)}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {[
                            item.kNumber ? `K ${item.kNumber}` : null,
                            item.address || null,
                            item.platform,
                            item.campaignName,
                            transferReasonText ? `Transfer: ${transferReasonText}` : null,
                          ]
                            .filter(Boolean)
                            .join(" · ") || "K No / Address —"}
                        </p>
                        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.3fr)_12rem_auto_auto] gap-1.5 items-center">
                          <Input
                            className="h-8"
                            placeholder="Remark"
                            value={remark}
                            onChange={(e) => setRecentEditRemarks((prev) => ({ ...prev, [rowKey]: e.target.value }))}
                          />
                          <Select value={selectedReason} onValueChange={(value) => setRecentStatuses((prev) => ({ ...prev, [rowKey]: value }))}>
                            <SelectTrigger className="h-8">
                              <SelectValue placeholder="Reason" />
                            </SelectTrigger>
                            <SelectContent>
                              {NOT_CONNECTED_REASONS.map((option) => (
                                <SelectItem key={option} value={option}>
                                  {option}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <label
                            htmlFor={`transfer-connected-${rowKey}`}
                            className="flex items-center gap-1.5 text-[11px] font-medium whitespace-nowrap cursor-pointer"
                          >
                            <Checkbox
                              id={`transfer-connected-${rowKey}`}
                              checked={transferToConnected}
                              onCheckedChange={(checked) =>
                                setNotConnectedTransferChecks((prev) => ({ ...prev, [rowKey]: checked === true }))
                              }
                            />
                            Move to Connected
                          </label>
                          <Button
                            size="sm"
                            className={cn(
                              "h-8",
                              transferToConnected
                                ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                                : "bg-violet-600 hover:bg-violet-700 text-white",
                            )}
                            disabled={!item.leadId || isLeadSubmitting(item.leadId)}
                            onClick={() => {
                              if (transferToConnected) {
                                if (!transferReason.trim()) {
                                  toast({
                                    title: "Transfer reason required",
                                    description: "Please enter reason of transfer before moving to Connected.",
                                    variant: "destructive",
                                  })
                                  return
                                }
                                let groupKey: StatusGroupKey = "part_2_interest_qualification"
                                let finalConnectedStatus = "Interested"
                                let nextAction: "called" | "follow_up" | "not_interested" | "rescheduled" = "called"
                                let nextFollowUpAt: string | undefined
                                if (transferOutcome === "not_interested") {
                                  groupKey = "part_4_rejection"
                                  finalConnectedStatus = "Not Interested Currently"
                                  nextAction = "not_interested"
                                } else if (transferOutcome === "decision_pending") {
                                  if (isReschedule && !editedTime) return
                                  groupKey = "part_3_followup_sales"
                                  finalConnectedStatus = "Follow-up Pending"
                                  nextAction = isReschedule ? getRescheduleSubmitAction() : "follow_up"
                                  nextFollowUpAt = isReschedule && editedTime ? new Date(editedTime).toISOString() : undefined
                                }
                                if (isReschedule && !editedTime) return
                                const combinedRemark = [remark, `Transfer Reason: ${transferReason.trim()}`]
                                  .map((part) => part.trim())
                                  .filter(Boolean)
                                  .join(" | ")
                                submitAction(
                                  item.leadId,
                                  {
                                    action: nextAction,
                                    callRemark: buildTaggedRemark(groupKey, finalConnectedStatus, combinedRemark),
                                    nextFollowUpAt,
                                    actionAt: new Date().toISOString(),
                                  },
                                  {
                                    skipRescheduleFallback: transferOutcome !== "decision_pending",
                                    afterSuccess: () => {
                                      setNotConnectedTransferChecks((prev) => ({ ...prev, [rowKey]: false }))
                                      setFlowTab("connected")
                                      setConnectedPage(1)
                                      toast({
                                        title: "Moved to Connected",
                                        description: `${item.name} is now in Connected Data.`,
                                      })
                                    },
                                  },
                                )
                                return
                              }
                              if (!selectedReason) return
                              submitAction(item.leadId, {
                                action: "not_interested",
                                callRemark: buildTaggedRemark("part_1_call_and_lead", selectedReason, remark),
                                actionAt: new Date().toISOString(),
                              })
                            }}
                          >
                            {isLeadSubmitting(item.leadId) ? (
                              <span className="inline-flex items-center gap-1.5">
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                Updating...
                              </span>
                            ) : transferToConnected ? (
                              "Move"
                            ) : (
                              "Update"
                            )}
                          </Button>
                        </div>
                        {transferToConnected ? (
                          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.2fr)_11rem_auto_12rem] gap-1.5 items-center rounded-md border border-emerald-200 bg-emerald-50/60 px-2 py-1.5">
                            <Input
                              className="h-8 bg-white"
                              placeholder="Reason of transfer (required)"
                              value={transferReason}
                              onChange={(e) =>
                                setNotConnectedTransferReasons((prev) => ({ ...prev, [rowKey]: e.target.value }))
                              }
                            />
                            <Select
                              value={transferOutcome}
                              onValueChange={(value: "interested" | "not_interested" | "decision_pending") => {
                                setNotConnectedTransferOutcomes((prev) => ({ ...prev, [rowKey]: value }))
                                if (value === "decision_pending") {
                                  setRecentRescheduleChecks((prev) => ({ ...prev, [rowKey]: true }))
                                  setRecentEditTimes((prev) => ({
                                    ...prev,
                                    [rowKey]:
                                      prev[rowKey] || formatForDatetimeLocal(new Date(Date.now() + 60 * 60 * 1000).toISOString()),
                                  }))
                                } else {
                                  setRecentRescheduleChecks((prev) => ({ ...prev, [rowKey]: false }))
                                }
                              }}
                            >
                              <SelectTrigger className="h-8 bg-white">
                                <SelectValue placeholder="Outcome" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="interested">Interested</SelectItem>
                                <SelectItem value="not_interested">Not Interested</SelectItem>
                                <SelectItem value="decision_pending">Decision Pending</SelectItem>
                              </SelectContent>
                            </Select>
                            <label
                              htmlFor={`not-connected-reschedule-${rowKey}`}
                              className="flex items-center gap-1.5 text-[11px] text-muted-foreground whitespace-nowrap cursor-pointer"
                            >
                              <Checkbox
                                id={`not-connected-reschedule-${rowKey}`}
                                checked={isReschedule}
                                onCheckedChange={(checked) =>
                                  setRecentRescheduleChecks((prev) => ({ ...prev, [rowKey]: checked === true }))
                                }
                              />
                              Reschedule
                            </label>
                            <Input
                              type="datetime-local"
                              className="h-8 bg-white"
                              value={editedTime}
                              onChange={(e) => setRecentEditTimes((prev) => ({ ...prev, [rowKey]: e.target.value }))}
                              disabled={!isReschedule}
                            />
                          </div>
                        ) : null}
                      </div>
                    )
                  })}
                  {renderFlowPagination(
                    pagedNotConnected.safePage,
                    pagedNotConnected.totalPages,
                    filteredFlowNotConnectedActions.length,
                    setNotConnectedPage,
                  )}
                </div>
              )}
            </CardContent>
          </Card>
            </TabsContent>

            <TabsContent value="current_lead" className="mt-3 focus-visible:outline-none">
        {!currentLead ? (
          <Card className="border-orange-200/70 bg-gradient-to-b from-white to-orange-50/25 shadow-sm">
            <CardContent className="py-12 text-center text-muted-foreground space-y-2">
              <div className="mx-auto w-11 h-11 rounded-full bg-orange-100 border border-orange-200 flex items-center justify-center">
                <Inbox className="w-5 h-5 text-orange-700" />
              </div>
              <p className="font-medium text-foreground">No calling data pending for you.</p>
              <p className="text-sm max-w-lg mx-auto">
                If HR Uploaded Data still shows Unassigned / Assigned above 0 for your batches, the backend is not
                returning your next lead. It must fix{" "}
                <span className="font-medium text-foreground">GET /dealers/me/calling-queue/next</span> (and stop
                500 on <span className="font-medium text-foreground">/current</span>) so your Assigned rows appear
                here first, then claim remaining Unassigned until both badges are 0 — see HANDOFF §15 /
                BACKEND_ASSIGN_UNASSIGNED.ts.
              </p>
              {backendCounts?.queued != null && Number(backendCounts.queued) > 0 ? (
                <span className="block text-sm text-muted-foreground">
                  Queue still reports {backendCounts.queued} queued lead(s). Refresh this tab after backend deploy.
                </span>
              ) : null}
            </CardContent>
          </Card>
        ) : (
          <Card className={socialLeadCardClass}>
            <CardHeader className="py-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 min-w-0">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center border shrink-0 ${
                    isSocialMediaCurrentLead
                      ? "bg-sky-100 border-sky-200"
                      : "bg-orange-100 border-orange-200"
                  }`}>
                    {isSocialMediaCurrentLead ? (
                      <Sparkles className="w-4 h-4 text-sky-700" />
                    ) : (
                      <User className="w-4 h-4 text-orange-700" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <CardTitle className="text-sm sm:text-base">
                        {isSocialMediaCurrentLead ? "Social Media Lead" : "Current Lead"}
                      </CardTitle>
                      {socialLeadStatusDisplay ? (
                        <Badge variant="outline" className={socialLeadStatusDisplay.badgeClassName}>
                          {socialLeadStatusDisplay.label}
                        </Badge>
                      ) : currentLead.status === "in_progress" ? (
                        <Badge variant="outline" className="h-5 px-1.5 text-[10px] border-amber-200 bg-amber-50 text-amber-800">
                          In call
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="h-5 px-1.5 text-[10px] border-orange-200 bg-orange-50 text-orange-800">
                          Ready
                        </Badge>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      One lead at a time — start the call, then submit the outcome.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {isEditingLead ? (
                    <>
                      <Button size="sm" variant="outline" onClick={() => setIsEditingLead(false)} className="h-8 gap-1">
                        <Check className="w-3.5 h-3.5" />
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (!currentLead) return
                          setEditableLeadDetails({
                            name: currentLead.name || "",
                            mobile: currentLead.mobile || "",
                            kNumber: currentLead.kNumber || "",
                            city: currentLead.city || "",
                            state: currentLead.state || "",
                            address: currentLead.address || "",
                            customerNote: currentLead.customerNote || "",
                          })
                          setIsEditingLead(false)
                        }}
                        className="h-8 gap-1"
                      >
                        <X className="w-3.5 h-3.5" />
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setIsEditingLead(true)} aria-label="Edit lead details">
                      <Pencil className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              {isSocialMediaCurrentLead ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs rounded-lg border border-sky-200/70 bg-sky-50/40 px-3 py-2">
                  {currentLead.platform ? (
                    <p><span className="text-muted-foreground">Platform:</span> {currentLead.platform}</p>
                  ) : null}
                  {currentLead.campaignName ? (
                    <p><span className="text-muted-foreground">Campaign:</span> {currentLead.campaignName}</p>
                  ) : null}
                  {currentLead.kw ? (
                    <p><span className="text-muted-foreground">KW:</span> {currentLead.kw}</p>
                  ) : null}
                  {currentLead.firstCallResponse ? (
                    <p><span className="text-muted-foreground">1st call:</span> {currentLead.firstCallResponse}</p>
                  ) : null}
                  {currentLead.secondCallResponse ? (
                    <p><span className="text-muted-foreground">2nd call:</span> {currentLead.secondCallResponse}</p>
                  ) : null}
                  {currentLead.remarks ? (
                    <p className="sm:col-span-2"><span className="text-muted-foreground">Remarks:</span> {currentLead.remarks}</p>
                  ) : null}
                </div>
              ) : null}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                <CurrentLeadField
                  label="Name"
                  icon={<User className="w-3 h-3" />}
                  className={currentLeadFieldSurface}
                >
                  {isEditingLead ? (
                    <Input
                      className="h-8 mt-1"
                      value={leadForView.name}
                      onChange={(e) =>
                        setEditableLeadDetails((prev) => ({
                          ...(prev || leadForView),
                          name: e.target.value,
                        }))
                      }
                      placeholder="Enter name"
                    />
                  ) : (
                    leadForView.name || "N/A"
                  )}
                </CurrentLeadField>
                <CurrentLeadField
                  label="Mobile"
                  icon={<Phone className="w-3 h-3" />}
                  className={currentLeadFieldSurface}
                >
                  {isEditingLead ? (
                    <Input
                      className="h-8 mt-1"
                      value={leadForView.mobile}
                      onChange={(e) =>
                        setEditableLeadDetails((prev) => ({
                          ...(prev || leadForView),
                          mobile: e.target.value,
                        }))
                      }
                      placeholder="Enter mobile"
                    />
                  ) : (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 hover:text-orange-700"
                      onClick={() => void copyLeadPhone(leadForView.mobile)}
                    >
                      {leadForView.mobile || "N/A"}
                      {leadForView.mobile ? <Copy className="w-3 h-3 text-muted-foreground" /> : null}
                    </button>
                  )}
                </CurrentLeadField>
                <CurrentLeadField
                  label="K Number"
                  icon={<Hash className="w-3 h-3" />}
                  className={currentLeadFieldSurface}
                >
                  {isEditingLead ? (
                    <Input
                      className="h-8 mt-1"
                      value={leadForView.kNumber}
                      onChange={(e) =>
                        setEditableLeadDetails((prev) => ({
                          ...(prev || leadForView),
                          kNumber: e.target.value,
                        }))
                      }
                      placeholder="Enter K number"
                    />
                  ) : (
                    leadForView.kNumber || "N/A"
                  )}
                </CurrentLeadField>
                <CurrentLeadField
                  label="Location"
                  icon={<MapPin className="w-3 h-3" />}
                  className={currentLeadFieldSurface}
                >
                  {isEditingLead ? (
                    <div className="grid grid-cols-2 gap-1.5 mt-1">
                      <Input
                        className="h-8"
                        value={leadForView.city}
                        onChange={(e) =>
                          setEditableLeadDetails((prev) => ({
                            ...(prev || leadForView),
                            city: e.target.value,
                          }))
                        }
                        placeholder="City"
                      />
                      <Input
                        className="h-8"
                        value={leadForView.state}
                        onChange={(e) =>
                          setEditableLeadDetails((prev) => ({
                            ...(prev || leadForView),
                            state: e.target.value,
                          }))
                        }
                        placeholder="State"
                      />
                    </div>
                  ) : (
                    [leadForView.city, leadForView.state].filter(Boolean).join(", ") || "N/A"
                  )}
                </CurrentLeadField>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                <CurrentLeadField
                  label="Address"
                  icon={<MapPin className="w-3 h-3" />}
                  className={currentLeadFieldSurface}
                >
                  {isEditingLead ? (
                    <Textarea
                      className="mt-1"
                      value={leadForView.address}
                      onChange={(e) =>
                        setEditableLeadDetails((prev) => ({
                          ...(prev || leadForView),
                          address: e.target.value,
                        }))
                      }
                      rows={2}
                      placeholder="Enter address"
                    />
                  ) : (
                    <p className="font-medium text-sm leading-snug">{leadForView.address || "N/A"}</p>
                  )}
                </CurrentLeadField>
                <CurrentLeadField
                  label="Customer Note"
                  icon={<StickyNote className="w-3 h-3" />}
                  className={currentLeadFieldSurface}
                >
                  {isEditingLead ? (
                    <Textarea
                      className="mt-1"
                      value={leadForView.customerNote}
                      onChange={(e) =>
                        setEditableLeadDetails((prev) => ({
                          ...(prev || leadForView),
                          customerNote: e.target.value,
                        }))
                      }
                      rows={2}
                      placeholder="Enter customer note"
                    />
                  ) : (
                    <p className="font-medium text-sm leading-snug">{leadForView.customerNote || "N/A"}</p>
                  )}
                </CurrentLeadField>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {currentLead.status === "assigned" || currentLead.status === "queued" ? (
                  <Button
                    onClick={() => handleStartCall(currentLead)}
                    className="h-8 gap-1.5 bg-orange-500 hover:bg-orange-600 text-white"
                    disabled={isLeadSubmitting(currentLead.id)}
                  >
                    {isLeadSubmitting(currentLead.id) ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <PhoneCall className="w-3.5 h-3.5" />
                    )}
                    {isLeadSubmitting(currentLead.id) ? "Starting..." : "Start Call"}
                  </Button>
                ) : null}
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8"
                  onClick={() =>
                    openNewQuotationWithPrefill(
                      { ...currentLead, ...leadForView },
                      { callRemark, customerNote: leadForView.customerNote },
                    )
                  }
                >
                  Create Quotation
                </Button>
              </div>

              {currentLead.status === "assigned" || currentLead.status === "queued" ? null : (
                  <div className="rounded-xl border border-amber-200/80 bg-gradient-to-b from-amber-50/70 to-white p-3 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium text-amber-950">Log this call</p>
                      <p className="text-[11px] text-muted-foreground">
                        Dialled → {callConnection ? (callConnection === "connected" ? "Connected" : "Not Connected") : "choose connection"}
                      </p>
                    </div>
                    <Textarea
                      placeholder="Remarks — previous review is prefilled; edit before Submit"
                      value={callRemark}
                      onChange={(e) => setCallRemark(e.target.value)}
                      rows={2}
                      className="bg-white"
                    />
                    <div className="space-y-1.5">
                      <p className="text-[11px] font-medium text-muted-foreground">Connection</p>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setCallConnection("connected")
                            setConnectedOutcome("")
                            setDecisionOverride("pending")
                            setDealClosed(false)
                          }}
                          className={cn(
                            "h-10 rounded-lg border text-sm font-medium inline-flex items-center justify-center gap-1.5 transition-colors",
                            callConnection === "connected"
                              ? "border-emerald-400 bg-emerald-50 text-emerald-800 shadow-sm"
                              : "border-border/80 bg-white text-muted-foreground hover:bg-muted/40",
                          )}
                        >
                          <PhoneIncoming className="w-4 h-4" />
                          Connected
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setCallConnection("not_connected")
                            setConnectedOutcome("")
                            setDecisionOverride("pending")
                            setDealClosed(false)
                            setIsRescheduleChecked(false)
                            setRescheduleAt("")
                          }}
                          className={cn(
                            "h-10 rounded-lg border text-sm font-medium inline-flex items-center justify-center gap-1.5 transition-colors",
                            callConnection === "not_connected"
                              ? "border-rose-400 bg-rose-50 text-rose-800 shadow-sm"
                              : "border-border/80 bg-white text-muted-foreground hover:bg-muted/40",
                          )}
                        >
                          <PhoneOff className="w-4 h-4" />
                          Not Connected
                        </button>
                      </div>
                    </div>

                    {callConnection === "connected" ? (
                      <div className="space-y-1.5">
                        <p className="text-[11px] font-medium text-muted-foreground">Outcome</p>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          {([
                            { value: "interested", label: "Interested", active: "border-emerald-400 bg-emerald-50 text-emerald-800 shadow-sm" },
                            { value: "not_interested", label: "Not Interested", active: "border-rose-400 bg-rose-50 text-rose-800 shadow-sm" },
                            { value: "decision_pending", label: "Decision Pending", active: "border-blue-400 bg-blue-50 text-blue-800 shadow-sm" },
                          ] as const).map((option) => (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => {
                                setConnectedOutcome(option.value)
                                if (option.value === "decision_pending") {
                                  setIsRescheduleChecked(true)
                                  setRescheduleAt((prev) => prev || formatForDatetimeLocal(new Date(Date.now() + 60 * 60 * 1000).toISOString()))
                                } else {
                                  setIsRescheduleChecked(false)
                                  setRescheduleAt("")
                                }
                              }}
                              className={cn(
                                "h-9 rounded-lg border text-sm font-medium transition-colors",
                                connectedOutcome === option.value
                                  ? option.active
                                  : "border-border/80 bg-white text-muted-foreground hover:bg-muted/40",
                              )}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}

                      {callConnection === "not_connected" ? (
                        <div className="space-y-1.5">
                          <p className="text-[11px] font-medium text-muted-foreground">Reason of not connected</p>
                          <Select value={notConnectedReason} onValueChange={setNotConnectedReason}>
                            <SelectTrigger className="h-8 bg-white">
                              <SelectValue placeholder="Select reason" />
                            </SelectTrigger>
                            <SelectContent>
                              {NOT_CONNECTED_REASONS.map((option) => (
                                <SelectItem key={option} value={option}>
                                  {option}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ) : null}

                      {callConnection === "connected" && connectedOutcome === "not_interested" ? (
                        <div className="space-y-1.5">
                          <p className="text-[11px] font-medium text-muted-foreground">Lost Reason</p>
                          <Select value={lostReason} onValueChange={setLostReason}>
                            <SelectTrigger className="h-8 bg-white">
                              <SelectValue placeholder="Select lost reason" />
                            </SelectTrigger>
                            <SelectContent>
                              {LOST_REASONS.map((option) => (
                                <SelectItem key={option} value={option}>
                                  {option}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ) : null}

                      {callConnection === "connected" && connectedOutcome === "interested" ? (
                        <div className="flex items-center gap-2 rounded-lg border border-emerald-200/80 bg-emerald-50/40 px-3 py-2">
                          <Checkbox
                            id="deal-closed-checkbox"
                            checked={dealClosed}
                            onCheckedChange={(checked) => setDealClosed(checked === true)}
                          />
                          <label htmlFor="deal-closed-checkbox" className="text-sm cursor-pointer select-none">
                            Quotation shared and deal closed
                          </label>
                        </div>
                      ) : null}

                      {callConnection === "connected" && connectedOutcome === "decision_pending" ? (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                          <div className="space-y-1">
                            <p className="text-[11px] font-medium text-muted-foreground">Hold Reason</p>
                            <Select value={decisionReason} onValueChange={setDecisionReason}>
                              <SelectTrigger className="h-8 bg-white">
                                <SelectValue placeholder="Select hold reason" />
                              </SelectTrigger>
                              <SelectContent>
                                {DECISION_PENDING_REASONS.map((option) => (
                                  <SelectItem key={option} value={option}>
                                    {option}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <p className="text-[11px] font-medium text-muted-foreground">Follow-up time</p>
                            <Input className="h-8 bg-white" type="datetime-local" value={rescheduleAt} onChange={(e) => setRescheduleAt(e.target.value)} />
                          </div>
                          <div className="space-y-1">
                            <p className="text-[11px] font-medium text-muted-foreground">Final decision (optional)</p>
                            <Select value={decisionOverride} onValueChange={(value: "pending" | "interested" | "not_interested") => setDecisionOverride(value)}>
                              <SelectTrigger className="h-8 bg-white">
                                <SelectValue placeholder="Keep pending / Interested / Not Interested" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="pending">Keep Pending</SelectItem>
                                <SelectItem value="interested">Interested</SelectItem>
                                <SelectItem value="not_interested">Not Interested</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      ) : null}

                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          className="h-8 bg-orange-500 hover:bg-orange-600 text-white"
                          onClick={() => {
                            if (!callConnection) {
                              toast({
                                title: "Select connection",
                                description: "Choose Connected or Not Connected.",
                                variant: "destructive",
                              })
                              return
                            }

                            let groupKey: StatusGroupKey = "part_1_call_and_lead"
                            let finalStatus = ""
                            let nextAction: "called" | "follow_up" | "not_interested" | "rescheduled" = "called"
                            let nextFollowUpAt: string | undefined

                            if (callConnection === "not_connected") {
                              groupKey = "part_1_call_and_lead"
                              finalStatus = notConnectedReason
                              nextAction = "not_interested"
                            } else if (connectedOutcome === "interested") {
                              groupKey = "part_2_interest_qualification"
                              finalStatus = dealClosed ? "Converted (Deal Closed)" : "Interested"
                              nextAction = "called"
                            } else if (connectedOutcome === "not_interested") {
                              groupKey = "part_4_rejection"
                              finalStatus = lostReason
                              nextAction = "not_interested"
                            } else if (connectedOutcome === "decision_pending") {
                              if (decisionOverride === "interested") {
                                groupKey = "part_2_interest_qualification"
                                finalStatus = dealClosed ? "Converted (Deal Closed)" : "Interested"
                                nextAction = "called"
                              } else if (decisionOverride === "not_interested") {
                                groupKey = "part_4_rejection"
                                finalStatus = lostReason
                                nextAction = "not_interested"
                              } else {
                                if (!rescheduleAt) {
                                  toast({
                                    title: "Select reschedule time",
                                    description: "Please choose date and time for decision pending.",
                                    variant: "destructive",
                                  })
                                  return
                                }
                                const followUpDate = new Date(rescheduleAt)
                                if (Number.isNaN(followUpDate.getTime())) {
                                  toast({
                                    title: "Invalid reschedule time",
                                    description: "Please choose a valid date and time.",
                                    variant: "destructive",
                                  })
                                  return
                                }
                                groupKey = "part_3_followup_sales"
                                finalStatus = decisionReason
                                nextAction = getRescheduleSubmitAction()
                                nextFollowUpAt = followUpDate.toISOString()
                              }
                            } else {
                              toast({
                                title: "Select connected outcome",
                                description: "Choose Interested, Not Interested, or Decision Pending.",
                                variant: "destructive",
                              })
                              return
                            }

                            const taggedRemark = buildTaggedRemark(groupKey, finalStatus, callRemark)
                            submitAction(currentLead.id, {
                              action: nextAction,
                              callRemark: taggedRemark,
                              nextFollowUpAt,
                              actionAt: new Date().toISOString(),
                            })
                          }}
                          disabled={isLeadSubmitting(currentLead.id)}
                        >
                          {isLeadSubmitting(currentLead.id) ? (
                            <span className="inline-flex items-center gap-1.5">
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              Submitting...
                            </span>
                          ) : (
                            "Submit"
                          )}
                        </Button>
                      </div>
                    </div>
                )}
            </CardContent>
          </Card>
        )}
            </TabsContent>
          </Tabs>
        </div>
        </TabsContent>

        <TabsContent value="scheduled" className="hidden">
        <Card className="border-blue-200/70 bg-gradient-to-b from-white to-blue-50/30 shadow-sm">
          <CardHeader>
            <div className="flex flex-col gap-3">
              <CardTitle className="text-base">Scheduled Follow Ups (Future)</CardTitle>
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  value={scheduledSearchTerm}
                  onChange={(e) => setScheduledSearchTerm(e.target.value)}
                  placeholder="Search by name, mobile, K number..."
                  className="w-full sm:w-80"
                />
                <Select value={scheduledTimeFilter} onValueChange={(value) => setScheduledTimeFilter(value as typeof scheduledTimeFilter)}>
                  <SelectTrigger className="w-full sm:w-48">
                    <SelectValue placeholder="Filter by follow-up time" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Time</SelectItem>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="next7">Next 7 Days</SelectItem>
                    <SelectItem value="next30">Next 30 Days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {filteredScheduledLeads.length === 0 ? (
              <p className="text-sm text-muted-foreground">No scheduled follow-ups available.</p>
            ) : (
              <div className="space-y-2">
                {filteredScheduledLeads.map((lead) => (
                  <div key={getScheduledLeadDedupeKey(lead)} className="rounded-md border border-blue-200/70 bg-blue-50/35 p-3 text-sm flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                    <div>
                      <p className="font-medium">{lead.name} • {lead.mobile}</p>
                      <p className="text-xs text-muted-foreground">Follow-up: {formatDateTime(lead.nextFollowUpAt)}</p>
                      {(() => {
                        const parsed = parseTaggedCallRemark(lead.callRemark || "")
                        if (!parsed.status && !resolveScheduledRemarkForLead(lead)) return null
                        return (
                          <p className="text-xs text-muted-foreground mt-1">
                            {parsed.status ? `Status: ${parsed.status}` : null}
                            {parsed.status && resolveScheduledRemarkForLead(lead) ? " • " : null}
                            {resolveScheduledRemarkForLead(lead) ? `Remark: ${resolveScheduledRemarkForLead(lead)}` : null}
                          </p>
                        )
                      })()}
                    </div>
                    <div className="w-full space-y-2 md:max-w-3xl">
                      {(() => {
                        const statusGroup = scheduledStatusGroups[lead.id] ?? STATUS_GROUPS[0].key
                        const groupConfig = STATUS_GROUPS.find((group) => group.key === statusGroup) || STATUS_GROUPS[0]
                        const status = scheduledStatuses[lead.id] ?? getDefaultStatusByGroup(statusGroup)
                        const otherReason = scheduledOtherReasons[lead.id] ?? ""
                        const isReschedule = scheduledRescheduleChecks[lead.id] ?? false
                        const finalStatus = status === OTHER_STATUS_VALUE ? otherReason.trim() : status
                        return (
                          <>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              <Select
                                value={statusGroup}
                                onValueChange={(value) => {
                                  const nextKey = value as StatusGroupKey
                                  setScheduledStatusGroups((prev) => ({ ...prev, [lead.id]: nextKey }))
                                  setScheduledStatuses((prev) => ({ ...prev, [lead.id]: getDefaultStatusByGroup(nextKey) }))
                                  setScheduledOtherReasons((prev) => ({ ...prev, [lead.id]: "" }))
                                }}
                              >
                                <SelectTrigger className="h-8">
                                  <SelectValue placeholder="Status category" />
                                </SelectTrigger>
                                <SelectContent>
                                  {STATUS_GROUPS.map((group) => (
                                    <SelectItem key={group.key} value={group.key}>
                                      {group.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Select value={status} onValueChange={(value) => setScheduledStatuses((prev) => ({ ...prev, [lead.id]: value }))}>
                                <SelectTrigger className="h-8">
                                  <SelectValue placeholder="Status" />
                                </SelectTrigger>
                                <SelectContent>
                                  {groupConfig.options.map((option) => (
                                    <SelectItem key={option} value={option}>
                                      {option}
                                    </SelectItem>
                                  ))}
                                  <SelectItem value={OTHER_STATUS_VALUE}>Others</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            {status === OTHER_STATUS_VALUE ? (
                              <Input
                                className="h-8"
                                placeholder="Enter other reason"
                                value={otherReason}
                                onChange={(e) => setScheduledOtherReasons((prev) => ({ ...prev, [lead.id]: e.target.value }))}
                              />
                            ) : null}
                            <Input
                              className="h-8"
                              placeholder="Remark (optional)"
                              value={resolveScheduledRemarkForLead(lead)}
                              onChange={(e) => setScheduledRemarks((prev) => ({ ...prev, [lead.id]: e.target.value }))}
                            />
                            <div className="flex items-center gap-2">
                              <Checkbox
                                id={`scheduled-reschedule-${lead.id}`}
                                checked={isReschedule}
                                onCheckedChange={(checked) =>
                                  setScheduledRescheduleChecks((prev) => ({ ...prev, [lead.id]: checked === true }))
                                }
                              />
                              <label htmlFor={`scheduled-reschedule-${lead.id}`} className="text-xs text-muted-foreground cursor-pointer">
                                Reschedule
                              </label>
                            </div>
                            {isReschedule ? (
                              <Input
                                type="datetime-local"
                                value={scheduledEditTimes[lead.id] ?? formatForDatetimeLocal(lead.nextFollowUpAt)}
                                onChange={(e) => setScheduledEditTimes((prev) => ({ ...prev, [lead.id]: e.target.value }))}
                                className="h-8"
                              />
                            ) : null}
                            <div className="flex flex-wrap gap-2">
                              <Button
                                size="sm"
                                className="bg-blue-600 hover:bg-blue-700 text-white"
                                disabled={isLeadSubmitting(lead.id)}
                                onClick={() => {
                                  if (!finalStatus) {
                                    toast({
                                      title: "Reason required",
                                      description: "Please select status or add other reason.",
                                      variant: "destructive",
                                    })
                                    return
                                  }
                                  const nextFollowUpRaw = scheduledEditTimes[lead.id] ?? formatForDatetimeLocal(lead.nextFollowUpAt)
                                  if (isReschedule && !nextFollowUpRaw) {
                                    toast({
                                      title: "Select follow-up time",
                                      description: "Please choose date and time before rescheduling.",
                                      variant: "destructive",
                                    })
                                    return
                                  }
                                  const remark = buildTaggedRemark(statusGroup, finalStatus, resolveScheduledRemarkForLead(lead))
                                  submitAction(lead.id, {
                                    action: isReschedule ? getRescheduleSubmitAction() : getActionFromStatus(finalStatus),
                                    nextFollowUpAt: isReschedule ? new Date(nextFollowUpRaw).toISOString() : undefined,
                                    callRemark: remark,
                                    actionAt: new Date().toISOString(),
                                  })
                                }}
                              >
                                {isLeadSubmitting(lead.id) ? (
                                  <span className="inline-flex items-center gap-1.5">
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    Submitting...
                                  </span>
                                ) : (
                                  "Submit Status"
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-blue-300 text-blue-700 hover:bg-blue-50"
                                disabled={isLeadSubmitting(lead.id)}
                                onClick={() => handleStartCall(lead)}
                              >
                                {isLeadSubmitting(lead.id) ? (
                                  <span className="inline-flex items-center gap-1.5">
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    Starting...
                                  </span>
                                ) : (
                                  "Start Call"
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  openNewQuotationWithPrefill(lead, {
                                    customerNote: resolveScheduledRemarkForLead(lead),
                                    callRemark: resolveScheduledRemarkForLead(lead),
                                  })
                                }
                              >
                                New Quotation
                              </Button>
                            </div>
                          </>
                        )
                      })()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        </TabsContent>

        <TabsContent value="recent">
        <Card className="border-violet-200/70 bg-gradient-to-b from-white to-violet-50/30 shadow-sm">
          <CardHeader>
            <div className="flex flex-col gap-3">
              <CardTitle className="text-base">Recent Actions</CardTitle>
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  value={recentSearchTerm}
                  onChange={(e) => setRecentSearchTerm(e.target.value)}
                  placeholder="Search by name, mobile, remark..."
                  className="w-full sm:w-80"
                />
                <Select value={recentActionFilter} onValueChange={(value) => setRecentActionFilter(value as typeof recentActionFilter)}>
                  <SelectTrigger className="w-full sm:w-44">
                    <SelectValue placeholder="Action" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Actions</SelectItem>
                    <SelectItem value="called">Called</SelectItem>
                    <SelectItem value="follow_up">Follow Up</SelectItem>
                    <SelectItem value="not_interested">Not Interested</SelectItem>
                    <SelectItem value="rescheduled">Rescheduled</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={recentCategoryFilter} onValueChange={setRecentCategoryFilter}>
                  <SelectTrigger className="w-full sm:w-60">
                    <SelectValue placeholder="Status category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {STATUS_GROUPS.map((group) => (
                      <SelectItem key={group.key} value={group.label}>
                        {group.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={recentDateFilter} onValueChange={(value) => setRecentDateFilter(value as typeof recentDateFilter)}>
                  <SelectTrigger className="w-full sm:w-40">
                    <SelectValue placeholder="Date range" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Dates</SelectItem>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="week">Last 7 Days</SelectItem>
                    <SelectItem value="month">Last 30 Days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {filteredRecentActions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No action history available.</p>
            ) : (
              <div className="space-y-2">
                {filteredRecentActions.map((item) => {
                  const parsed = parseTaggedRemark(item.callRemark)
                  return (
                  <div key={item.id} className="rounded-md border border-violet-200/70 bg-violet-50/30 p-3 text-sm">
                    <p className="font-medium">{item.name} • {item.mobile}</p>
                    <p className="text-xs text-muted-foreground">
                      Action: {item.action || "N/A"} • At: {formatDateTime(item.actionAt)}
                    </p>
                    <p className="text-xs text-muted-foreground">K No: {item.kNumber || "N/A"}</p>
                    <p className="text-xs text-muted-foreground">Address: {item.address || "N/A"}</p>
                    {item.nextFollowUpAt ? (
                      <p className="text-xs text-muted-foreground">Next follow-up: {formatDateTime(item.nextFollowUpAt)}</p>
                    ) : null}
                    {(parsed.category || parsed.status || parsed.remark) ? (
                      <div className="mt-1 space-y-1 text-xs">
                        {parsed.category ? <p><span className="font-medium">Status Category:</span> {getDisplayCategoryLabel(parsed.category)}</p> : null}
                        {parsed.status ? <p><span className="font-medium">Status:</span> {parsed.status}</p> : null}
                        {getSavedActionRemarkText(item) ? (
                          <p><span className="font-medium">Remark:</span> {getSavedActionRemarkText(item)}</p>
                        ) : null}
                      </div>
                    ) : null}
                    <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                      <Textarea
                        rows={2}
                        placeholder="Edit remark"
                        value={recentEditRemarks[actionRowKey(item)] ?? getSavedActionRemarkText(item)}
                        onChange={(e) =>
                          setRecentEditRemarks((prev) => ({
                            ...prev,
                            [actionRowKey(item)]: e.target.value,
                          }))
                        }
                      />
                      <div className="space-y-1">
                        <p className="text-[11px] text-muted-foreground">Edit follow-up date/time</p>
                        <Input
                          type="datetime-local"
                          value={recentEditTimes[actionRowKey(item)] ?? formatForDatetimeLocal(item.nextFollowUpAt)}
                          onChange={(e) =>
                            setRecentEditTimes((prev) => ({
                              ...prev,
                              [actionRowKey(item)]: e.target.value,
                            }))
                          }
                        />
                      </div>
                    </div>
                    {(() => {
                      const rowKey = actionRowKey(item)
                      const derivedStatusGroup = getStatusGroupKeyByLabel(parsed.category)
                      const statusGroup = recentStatusGroups[rowKey] ?? derivedStatusGroup ?? STATUS_GROUPS[0].key
                      const groupConfig = STATUS_GROUPS.find((group) => group.key === statusGroup) || STATUS_GROUPS[0]
                      const derivedStatus = (parsed.status || "").trim()
                      const status =
                        recentStatuses[rowKey] ??
                        (derivedStatus && (groupConfig.options as readonly string[]).includes(derivedStatus)
                          ? derivedStatus
                          : getDefaultStatusByGroup(statusGroup))
                      const otherReason = recentOtherReasons[rowKey] ?? ""
                      const isReschedule = recentRescheduleChecks[rowKey] ?? false
                      const finalStatus = status === OTHER_STATUS_VALUE ? otherReason.trim() : status
                      const remark = recentEditRemarks[rowKey] ?? getSavedActionRemarkText(item)
                      const editedTime = recentEditTimes[rowKey] ?? formatForDatetimeLocal(item.nextFollowUpAt)
                      return (
                        <>
                          <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                            <Select
                              value={statusGroup}
                              onValueChange={(value) => {
                                const nextKey = value as StatusGroupKey
                                setRecentStatusGroups((prev) => ({ ...prev, [rowKey]: nextKey }))
                                setRecentStatuses((prev) => ({ ...prev, [rowKey]: getDefaultStatusByGroup(nextKey) }))
                                setRecentOtherReasons((prev) => ({ ...prev, [rowKey]: "" }))
                              }}
                            >
                              <SelectTrigger className="h-8">
                                <SelectValue placeholder="Status category" />
                              </SelectTrigger>
                              <SelectContent>
                                {STATUS_GROUPS.map((group) => (
                                  <SelectItem key={group.key} value={group.key}>
                                    {group.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Select value={status} onValueChange={(value) => setRecentStatuses((prev) => ({ ...prev, [rowKey]: value }))}>
                              <SelectTrigger className="h-8">
                                <SelectValue placeholder="Status" />
                              </SelectTrigger>
                              <SelectContent>
                                {groupConfig.options.map((option) => (
                                  <SelectItem key={option} value={option}>
                                    {option}
                                  </SelectItem>
                                ))}
                                <SelectItem value={OTHER_STATUS_VALUE}>Others</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          {status === OTHER_STATUS_VALUE ? (
                            <Input
                              className="mt-2 h-8"
                              placeholder="Enter other reason"
                              value={otherReason}
                              onChange={(e) => setRecentOtherReasons((prev) => ({ ...prev, [rowKey]: e.target.value }))}
                            />
                          ) : null}
                          <div className="mt-2 flex items-center gap-2">
                            <Checkbox
                              id={`recent-reschedule-${rowKey}`}
                              checked={isReschedule}
                              onCheckedChange={(checked) =>
                                setRecentRescheduleChecks((prev) => ({ ...prev, [rowKey]: checked === true }))
                              }
                            />
                            <label htmlFor={`recent-reschedule-${rowKey}`} className="text-xs text-muted-foreground cursor-pointer">
                              Reschedule
                            </label>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              className="bg-violet-600 hover:bg-violet-700 text-white"
                              disabled={!item.leadId}
                              onClick={() => {
                                if (!finalStatus) {
                                  toast({
                                    title: "Reason required",
                                    description: "Please select status or add other reason.",
                                    variant: "destructive",
                                  })
                                  return
                                }
                                if (isReschedule && !editedTime) {
                                  toast({
                                    title: "Select follow-up time",
                                    description: "Please choose date and time before rescheduling.",
                                    variant: "destructive",
                                  })
                                  return
                                }
                                submitAction(item.leadId, {
                                  action: isReschedule ? getRescheduleSubmitAction() : getActionFromStatus(finalStatus),
                                  callRemark: buildTaggedRemark(statusGroup, finalStatus, remark),
                                  nextFollowUpAt: isReschedule ? new Date(editedTime).toISOString() : undefined,
                                  actionAt: new Date().toISOString(),
                                })
                              }}
                            >
                              Submit Status
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-violet-300 text-violet-700 hover:bg-violet-50"
                              onClick={() => startCallFromRecent(item)}
                            >
                              Start Call
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                const parsed = parseTaggedRemark(item.callRemark)
                                const rowRemark = recentEditRemarks[actionRowKey(item)] ?? getSavedActionRemarkText(item)
                                openNewQuotationWithPrefill(
                                  {
                                    id: item.leadId || item.id,
                                    name: item.name,
                                    mobile: item.mobile,
                                    altMobile: "",
                                    kNumber: item.kNumber,
                                    address: item.address,
                                    customerNote: item.customerNote,
                                    city: item.city,
                                    state: item.state,
                                    assignedDealerId: dealer?.id || "",
                                    assignedDealerName: "",
                                    createdAt: new Date().toISOString(),
                                    status: "assigned",
                                  },
                                  { callRemark: rowRemark, customerNote: item.customerNote },
                                )
                              }}
                            >
                              New Quotation
                            </Button>
                          </div>
                        </>
                      )
                    })()}
                  </div>
                )})}
              </div>
            )}
          </CardContent>
        </Card>
        </TabsContent>

        <TabsContent value="interested">
          <Card className="border-emerald-200/70 bg-gradient-to-b from-white to-emerald-50/30 shadow-sm">
            <CardHeader>
              <div className="flex flex-col gap-3">
                <CardTitle className="text-base">Interested Data</CardTitle>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input
                    value={interestedSearchTerm}
                    onChange={(e) => setInterestedSearchTerm(e.target.value)}
                    placeholder="Search by name, mobile, remark..."
                    className="w-full sm:w-80"
                  />
                  <Select value={interestedCategoryFilter} onValueChange={setInterestedCategoryFilter}>
                    <SelectTrigger className="w-full sm:w-60">
                      <SelectValue placeholder="Status category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {STATUS_GROUPS.map((group) => (
                        <SelectItem key={group.key} value={group.label}>
                          {group.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={interestedDateFilter} onValueChange={(value) => setInterestedDateFilter(value as typeof interestedDateFilter)}>
                    <SelectTrigger className="w-full sm:w-40">
                      <SelectValue placeholder="Date range" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Dates</SelectItem>
                      <SelectItem value="today">Today</SelectItem>
                      <SelectItem value="week">Last 7 Days</SelectItem>
                      <SelectItem value="month">Last 30 Days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {filteredInterestedActions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No interested records available.</p>
              ) : (
                <div className="space-y-2">
                  {filteredInterestedActions.map((item) => {
                    const parsed = parseTaggedRemark(item.callRemark)
                    return (
                    <div key={item.id} className="rounded-md border border-emerald-200/70 bg-emerald-50/30 p-3 text-sm">
                      <p className="font-medium">{item.name} • {item.mobile}</p>
                      <p className="text-xs text-muted-foreground">Action at: {formatDateTime(item.actionAt)}</p>
                      {(parsed.category || parsed.status || parsed.remark) ? (
                        <div className="mt-1 space-y-1 text-xs">
                          {parsed.category ? <p><span className="font-medium">Status Category:</span> {getDisplayCategoryLabel(parsed.category)}</p> : null}
                          {parsed.status ? <p><span className="font-medium">Status:</span> {parsed.status}</p> : null}
                          {getSavedActionRemarkText(item) ? (
                            <p><span className="font-medium">Remark:</span> {getSavedActionRemarkText(item)}</p>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  )})}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>
      </main>

      {pricingViewScope ? (
        <PricingSheetViewDialog
          open={Boolean(pricingViewScope)}
          onOpenChange={(open) => {
            if (!open) setPricingViewScope(null)
          }}
          scope={pricingViewScope}
        />
      ) : null}
    </div>
  )
}
