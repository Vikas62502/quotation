"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { api, ApiError } from "@/lib/api"
import { getRealtime } from "@/lib/realtime"
import { DashboardNav } from "@/components/dashboard-nav"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { useToast } from "@/hooks/use-toast"
import { PhoneCall, ArrowRightCircle, Pencil, Check, X } from "lucide-react"

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
  kNumber?: string
  address?: string
  city?: string
  state?: string
  customerNote?: string
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

/** Backend often sends dealerId / dealerName for uploader — not "assigned for calling". */
const UNASSIGNED_ASSIGNMENT_TOKENS = new Set([
  "",
  "unassigned",
  "null",
  "none",
  "-",
  "na",
  "n/a",
  "pool",
  "open",
])

function normalizeCallingAssigneeToken(raw: unknown): string {
  const s = String(raw ?? "").trim()
  if (UNASSIGNED_ASSIGNMENT_TOKENS.has(s.toLowerCase())) return ""
  return s
}

function leadHasExplicitCallingAssigneeId(lead: Pick<CallingLead, "assignedDealerId">): boolean {
  const id = String(lead.assignedDealerId || "").trim().toLowerCase()
  return Boolean(id && !UNASSIGNED_ASSIGNMENT_TOKENS.has(id))
}

type CallingLeadDealerVisibilityCtx = {
  currentDealerId: string
  currentDealerUsername: string
  currentDealerFullName: string
  dealerCallingBatchIds: string[]
}

/** Explicit assignee match, else pool / HR batch-unassigned (name may be batch label, not empty). */
function callingLeadVisibleToDealer(lead: CallingLead, ctx: CallingLeadDealerVisibilityCtx): boolean {
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

export default function CallingDataPage() {
  const router = useRouter()
  const { isAuthenticated, dealer, role } = useAuth()
  const { toast } = useToast()
  const [leads, setLeads] = useState<CallingLead[]>([])
  const [scheduledLeads, setScheduledLeads] = useState<CallingLead[]>([])
  const [recentActions, setRecentActions] = useState<ActionLogItem[]>([])
  const [activeSubTab, setActiveSubTab] = useState("current")
  const [backendCounts, setBackendCounts] = useState<{ pending?: number; queued?: number; scheduled?: number; completed?: number }>({})
  const [callRemark, setCallRemark] = useState("")
  const [rescheduleAt, setRescheduleAt] = useState("")
  const [scheduledSearchTerm, setScheduledSearchTerm] = useState("")
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
  const [connectedOutcomeFilter, setConnectedOutcomeFilter] = useState<
    "all" | "interested" | "not_interested" | "decision_pending"
  >("all")
  const [dialledSearchTerm, setDialledSearchTerm] = useState("")
  const [dialledActionFilter, setDialledActionFilter] = useState<"all" | "called" | "follow_up" | "not_interested" | "rescheduled">("all")
  const [connectedSearchTerm, setConnectedSearchTerm] = useState("")
  const [notConnectedSearchTerm, setNotConnectedSearchTerm] = useState("")
  const [notConnectedReasonFilter, setNotConnectedReasonFilter] = useState<string>("all")
  const [scheduledPage, setScheduledPage] = useState(1)
  const [dialledPage, setDialledPage] = useState(1)
  const [connectedPage, setConnectedPage] = useState(1)
  const [notConnectedPage, setNotConnectedPage] = useState(1)
  const [flowPageSize, setFlowPageSize] = useState(10)
  const [editableLeadDetails, setEditableLeadDetails] = useState<EditableLeadDetails | null>(null)
  const [isEditingLead, setIsEditingLead] = useState(false)
  const [flowTab, setFlowTab] = useState<"current_lead" | "scheduled" | "dialled" | "connected" | "not_connected">("current_lead")
  const [analyticsRange, setAnalyticsRange] = useState<
    "today" | "yesterday" | "this_week" | "last_week" | "this_month" | "last_month" | "last_year" | "custom"
  >("today")
  const [analyticsFromDate, setAnalyticsFromDate] = useState("")
  const [analyticsToDate, setAnalyticsToDate] = useState("")
  const useApi = process.env.NEXT_PUBLIC_USE_API !== "false"
  const previousCurrentLeadIdRef = useRef<string | null>(null)
  const shownScheduledReminderRef = useRef<Record<string, true>>({})
  const currentDealerId = String(dealer?.id || (dealer as any)?._id || (dealer as any)?.dealerId || "").trim()
  const currentDealerUsername = String(dealer?.username || "").trim().toLowerCase()
  const currentDealerFullName = `${dealer?.firstName || ""} ${dealer?.lastName || ""}`.trim().toLowerCase()
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
    if (!isAuthenticated) {
      router.push("/login")
      return
    }
    if (role !== "dealer" && role !== "admin") {
      router.push("/dashboard")
      return
    }
  }, [isAuthenticated, role, router])

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
      // Only explicit "calling assignee" fields — do not use dealerId/dealerName (often = uploader / account owner).
      // Pool rows: empty assignee id after normalize; name may still be a batch label — visibility uses eligibleDealerIds / uploadBatchId.
      assignedDealerId: normalizeCallingAssigneeToken(
        source?.assignedDealerId ||
          source?.assigned_dealer_id ||
          source?.assignedToDealerId ||
          source?.assigned_to_dealer_id ||
          source?.assignedTo ||
          source?.assigned_to ||
          source?.assignedToUsername ||
          source?.assigned_to_username ||
          "",
      ),
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
      callRemark: source?.callRemark || source?.call_remark || "",
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
      callRemark: entry?.callRemark || entry?.call_remark || lead?.callRemark || lead?.call_remark || "",
      nextFollowUpAt: entry?.nextFollowUpAt || entry?.next_follow_up_at || lead?.nextFollowUpAt || lead?.next_follow_up_at,
      status: entry?.status || lead?.status || lead?.lead_status,
      kNumber: entry?.kNumber || lead?.kNumber || lead?.k_number || "",
      address: entry?.address || lead?.address || "",
      city: entry?.city || lead?.city || "",
      state: entry?.state || lead?.state || "",
      customerNote: entry?.customerNote || lead?.customerNote || "",
    }
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

  const getTaggedCategory = (remark?: string) => {
    const match = (remark || "").match(/^\[([^\]]+)\]/)
    const rawCategory = match?.[1] || ""
    return BACKEND_STATUS_CATEGORY_TO_LABEL[rawCategory] || rawCategory
  }

  const parseTaggedRemark = (remark?: string) => {
    const raw = (remark || "").trim()
    if (!raw) return { category: "", status: "", remark: "" }

    const match = raw.match(/^\[([^\]]+)\]\s*([^|]*?)\s*(?:\|\s*(.*))?$/)
    if (!match) return { category: "", status: "", remark: raw }

    return {
      category: (match[1] || "").trim(),
      status: (match[2] || "").trim(),
      remark: (match[3] || "").trim(),
    }
  }

  const extractTransferReason = (remark?: string) => {
    const text = (remark || "").trim()
    if (!text) return ""
    const match = text.match(/(?:^|\|\s*)Transfer Reason:\s*([^|]+)/i)
    return (match?.[1] || "").trim()
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

  const getDayStart = (d: Date) => {
    const x = new Date(d)
    x.setHours(0, 0, 0, 0)
    return x
  }

  const getDayEnd = (d: Date) => {
    const x = new Date(d)
    x.setHours(23, 59, 59, 999)
    return x
  }

  const getWeekStart = (d: Date) => {
    const x = getDayStart(d)
    const day = x.getDay()
    const diff = day === 0 ? 6 : day - 1
    x.setDate(x.getDate() - diff)
    return x
  }

  const getWeekEnd = (d: Date) => {
    const start = getWeekStart(d)
    const end = new Date(start)
    end.setDate(start.getDate() + 6)
    return getDayEnd(end)
  }

  const analyticsRangeBounds = useMemo(() => {
    const now = new Date()
    if (analyticsRange === "today") return { start: getDayStart(now), end: getDayEnd(now) }
    if (analyticsRange === "yesterday") {
      const y = new Date(now)
      y.setDate(now.getDate() - 1)
      return { start: getDayStart(y), end: getDayEnd(y) }
    }
    if (analyticsRange === "this_week") return { start: getWeekStart(now), end: getWeekEnd(now) }
    if (analyticsRange === "last_week") {
      const prev = new Date(now)
      prev.setDate(now.getDate() - 7)
      return { start: getWeekStart(prev), end: getWeekEnd(prev) }
    }
    if (analyticsRange === "this_month") {
      const start = new Date(now.getFullYear(), now.getMonth(), 1)
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      return { start: getDayStart(start), end: getDayEnd(end) }
    }
    if (analyticsRange === "last_month") {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const end = new Date(now.getFullYear(), now.getMonth(), 0)
      return { start: getDayStart(start), end: getDayEnd(end) }
    }
    if (analyticsRange === "last_year") {
      const y = now.getFullYear() - 1
      return { start: getDayStart(new Date(y, 0, 1)), end: getDayEnd(new Date(y, 11, 31)) }
    }
    if (!analyticsFromDate || !analyticsToDate) return null
    const start = getDayStart(new Date(analyticsFromDate))
    const end = getDayEnd(new Date(analyticsToDate))
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null
    return { start, end }
  }, [analyticsRange, analyticsFromDate, analyticsToDate])

  const rangeFilteredActionsForAnalytics = useMemo(() => {
    if (!analyticsRangeBounds) return []
    return recentActions.filter((item) => {
      if (!item.actionAt) return false
      const at = new Date(item.actionAt)
      if (Number.isNaN(at.getTime())) return false
      return at >= analyticsRangeBounds.start && at <= analyticsRangeBounds.end
    })
  }, [recentActions, analyticsRangeBounds])

  const analyticsSummary = useMemo(() => {
    let connected = 0
    let notConnected = 0
    let interested = 0
    let notInterested = 0
    let decisionPending = 0
    rangeFilteredActionsForAnalytics.forEach((item) => {
      const parsed = parseTaggedRemark(item.callRemark)
      const status = (parsed.status || "").trim()
      if (!status) return
      if (NOT_CONNECTED_REASONS.includes(status)) {
        notConnected += 1
        return
      }
      connected += 1
      const outcome = getConnectedOutcomeForStatus(status)
      if (outcome === "interested") interested += 1
      else if (outcome === "not_interested") notInterested += 1
      else decisionPending += 1
    })
    return {
      totalCalls: rangeFilteredActionsForAnalytics.length,
      connected,
      notConnected,
      interested,
      notInterested,
      decisionPending,
    }
  }, [rangeFilteredActionsForAnalytics])

  // Each "Recent Actions" card must have its own local editing state.
  // Using `leadId` can cause state collisions when multiple recent history rows exist for the same lead/customer.
  const actionRowKey = (item: ActionLogItem) => item.id

  const openNewQuotationWithPrefill = (lead: CallingLead) => {
    const params = new URLSearchParams()
    params.set("prefillName", lead.name || "")
    params.set("prefillMobile", lead.mobile || "")
    params.set("prefillAddress", lead.address || "")
    params.set("prefillCity", lead.city || "")
    params.set("prefillState", lead.state || "")
    router.push(`/dashboard/new-quotation?${params.toString()}`)
  }

  const applyQueueResponse = (response: any) => {
    const readArray = (value: any): any[] => {
      if (Array.isArray(value)) return value
      if (Array.isArray(value?.items)) return value.items
      if (Array.isArray(value?.rows)) return value.rows
      if (Array.isArray(value?.data)) return value.data
      return []
    }

    const queueCandidates = [
      ...readArray(response?.leads),
      ...readArray(response?.queue),
      ...readArray(response?.pendingLeads),
      ...readArray(response?.assignedLeads),
      ...readArray(response?.currentQueue),
    ]
    const rawLead =
      response?.lead ||
      response?.nextLead ||
      response?.currentLead ||
      response?.activeLead ||
      queueCandidates[0] ||
      null
    const mergedLeadMap = new Map<string, CallingLead>()
    ;[rawLead, ...queueCandidates]
      .filter(Boolean)
      .map(normalizeApiLead)
      .forEach((lead) => {
        if (!lead?.id) return
        mergedLeadMap.set(lead.id, lead)
      })
    setLeads(Array.from(mergedLeadMap.values()))

    const scheduledSource = [
      ...readArray(response?.scheduledLeads),
      ...readArray(response?.upcomingFollowUps),
      ...readArray(response?.followUps),
      ...readArray(response?.scheduled),
      ...readArray(response?.scheduledData),
      ...readArray(response?.scheduledItems),
      ...readArray(response?.rescheduledLeads),
    ]
    const normalizedScheduled = scheduledSource
      .map(normalizeApiLead)
      .filter((lead) => !!lead.nextFollowUpAt)
      .sort((a, b) => new Date(a.nextFollowUpAt || 0).getTime() - new Date(b.nextFollowUpAt || 0).getTime())
    setScheduledLeads(normalizedScheduled)

    const actionSource = [
      ...readArray(response?.recentActions),
      ...readArray(response?.actionHistory),
      ...readArray(response?.completedActions),
      ...readArray(response?.dialledActions),
      ...readArray(response?.connectedActions),
      ...readArray(response?.notConnectedActions),
      ...readArray(response?.actions),
      ...readArray(response?.callingActions),
    ]
    const normalizedActionsMap = new Map<string, ActionLogItem>()
    actionSource.map(normalizeActionLog).forEach((action) => {
      if (!action?.id) return
      normalizedActionsMap.set(action.id, action)
    })
    const normalizedActions = Array.from(normalizedActionsMap.values()).sort(
      (a, b) => new Date(b.actionAt || 0).getTime() - new Date(a.actionAt || 0).getTime(),
    )
    setRecentActions(normalizedActions)
    setBackendCounts({
      pending: response?.pendingCount ?? response?.counts?.pending,
      queued: response?.queuedCount ?? response?.counts?.queued,
      scheduled: response?.scheduledCount ?? response?.counts?.scheduled,
      completed: response?.completedCount ?? response?.counts?.completed,
    })
  }

  const loadLeads = async () => {
    if (!useApi) {
      setLeads([])
      toast({
        title: "API mode required",
        description: "Enable backend API mode to load dealer calling queue.",
        variant: "destructive",
      })
      return
    }

    try {
      const [nextResult, currentResult] = await Promise.allSettled([
        api.dealers.getCallingQueueNext(),
        api.dealers.getCallingQueueCurrent(),
      ])

      const nextResponse = nextResult.status === "fulfilled" ? nextResult.value : null
      const currentResponse = currentResult.status === "fulfilled" ? currentResult.value : null
      if (!nextResponse && !currentResponse) {
        const nextError = nextResult.status === "rejected" ? nextResult.reason : null
        const currentError = currentResult.status === "rejected" ? currentResult.reason : null
        throw nextError || currentError || new Error("Queue unavailable")
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

      mergedResponse.lead =
        (nextResponse as any)?.lead ||
        (nextResponse as any)?.nextLead ||
        (nextResponse as any)?.currentLead ||
        (currentResponse as any)?.lead ||
        (currentResponse as any)?.nextLead ||
        (currentResponse as any)?.currentLead ||
        mergedResponse.lead

      applyQueueResponse(mergedResponse)
    } catch (error) {
      const message =
        error instanceof ApiError ? error.details?.[0]?.message || error.message : "Could not load calling queue from backend."
      setLeads([])
      setScheduledLeads([])
      setRecentActions([])
      toast({
        title: "Backend queue unavailable",
        description: message,
        variant: "destructive",
      })
    }
  }

  useEffect(() => {
    loadLeads()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useApi])

  useEffect(() => {
    if (!useApi) return

    const refresh = () => {
      loadLeads()
    }

    // Auto-refresh queue every 5 minutes; tab focus / visibility still refreshes immediately.
    const interval = window.setInterval(refresh, 5 * 60 * 1000)

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") refresh()
    }
    const onWindowFocus = () => refresh()

    document.addEventListener("visibilitychange", onVisibilityChange)
    window.addEventListener("focus", onWindowFocus)

    return () => {
      window.clearInterval(interval)
      document.removeEventListener("visibilitychange", onVisibilityChange)
      window.removeEventListener("focus", onWindowFocus)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useApi])

  useEffect(() => {
    if (!useApi) return
    const socket = getRealtime()
    if (!socket) return

    const refresh = () => {
      loadLeads()
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
  }, [useApi])

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

  const dealerAssignedQueue = useMemo(() => {
    const leadOrder = new Map(leads.map((lead, index) => [lead.id, index]))

    return leads
      .filter((lead) => {
        if (!callingLeadVisibleToDealer(lead, callingVisibilityCtx)) return false
        return isLeadCallableNow(lead)
      })
      .sort((a, b) => {
        const aOrder = leadOrder.get(a.id) ?? Number.MAX_SAFE_INTEGER
        const bOrder = leadOrder.get(b.id) ?? Number.MAX_SAFE_INTEGER
        if (aOrder !== bOrder) return aOrder - bOrder
        return getLeadSortTime(a) - getLeadSortTime(b)
      })
  }, [leads, callingVisibilityCtx])

  const queuedCount = useMemo(() => {
    return leads.filter((lead) => {
      if (!callingLeadVisibleToDealer(lead, callingVisibilityCtx)) return false
      return lead.status === "queued"
    }).length
  }, [leads, callingVisibilityCtx])

  const scheduledCount = useMemo(() => {
    const now = Date.now()
    return leads.filter((lead) => {
      if (!callingLeadVisibleToDealer(lead, callingVisibilityCtx)) return false
      if (lead.status !== "rescheduled") return false
      if (!lead.nextFollowUpAt) return false
      return new Date(lead.nextFollowUpAt).getTime() > now
    }).length
  }, [leads, callingVisibilityCtx])

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
    return scheduledLeads.filter((lead) => {
      if (!callingLeadVisibleToDealer(lead, callingVisibilityCtx)) return false
      const nextAt = lead.nextFollowUpAt ? new Date(lead.nextFollowUpAt) : null
      if (!nextAt || Number.isNaN(nextAt.getTime())) return false
      const nextAtMs = nextAt.getTime()
      if (nextAtMs <= nowMs) return false
      const matchesTime =
        scheduledTimeFilter === "all" ||
        (scheduledTimeFilter === "today"
          ? nextAt >= startOfToday && nextAt < endOfToday
          : scheduledTimeFilter === "next7"
            ? nextAtMs >= nowMs && nextAtMs <= nowMs + 7 * 24 * 60 * 60 * 1000
            : nextAtMs >= nowMs && nextAtMs <= nowMs + 30 * 24 * 60 * 60 * 1000)
      if (!matchesTime) return false
      if (!term) return true
      const haystack = [lead.name, lead.mobile, lead.kNumber, lead.address, lead.city, lead.state, lead.callRemark]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
      return haystack.includes(term)
    })
  }, [scheduledLeads, scheduledSearchTerm, scheduledTimeFilter, callingVisibilityCtx])

  const filteredRecentActions = useMemo(() => {
    const term = recentSearchTerm.trim().toLowerCase()
    return recentActions.filter((item) => {
      if (recentActionFilter !== "all" && item.action !== recentActionFilter) return false
      const category = getTaggedCategory(item.callRemark)
      if (recentCategoryFilter !== "all" && category !== recentCategoryFilter) return false
      if (!matchesDateRange(item.actionAt, recentDateFilter)) return false
      if (!term) return true
      const haystack = [item.name, item.mobile, item.action, item.callRemark, item.kNumber, item.address, item.city, item.state]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
      return haystack.includes(term)
    })
  }, [recentActions, recentSearchTerm, recentActionFilter, recentCategoryFilter, recentDateFilter])

  const filteredInterestedActions = useMemo(() => {
    const term = interestedSearchTerm.trim().toLowerCase()
    return interestedActions.filter((item) => {
      const category = getTaggedCategory(item.callRemark)
      if (interestedCategoryFilter !== "all" && category !== interestedCategoryFilter) return false
      if (!matchesDateRange(item.actionAt, interestedDateFilter)) return false
      if (!term) return true
      const haystack = [item.name, item.mobile, item.callRemark, item.kNumber, item.address, item.city, item.state]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
      return haystack.includes(term)
    })
  }, [interestedActions, interestedSearchTerm, interestedCategoryFilter, interestedDateFilter])

  const currentLead = dealerAssignedQueue[0] || null
  const currentFlowStage: "current_lead" | "dialled" | "connected" | "not_connected" = !currentLead
    ? "current_lead"
    : !callConnection
      ? "current_lead"
      : callConnection === "connected"
        ? "connected"
        : "not_connected"

  const flowDialledActions = useMemo(
    () =>
      recentActions.filter((item) =>
        ["called", "follow_up", "not_interested", "rescheduled"].includes(String(item.action || "").toLowerCase()),
      ),
    [recentActions],
  )

  const filteredFlowDialledActions = useMemo(() => {
    const term = dialledSearchTerm.trim().toLowerCase()
    return flowDialledActions.filter((item) => {
      const action = String(item.action || "").toLowerCase()
      if (dialledActionFilter !== "all" && action !== dialledActionFilter) return false
      if (!term) return true
      const haystack = [item.name, item.mobile, item.kNumber, item.address, item.callRemark]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
      return haystack.includes(term)
    })
  }, [flowDialledActions, dialledSearchTerm, dialledActionFilter])

  const flowConnectedActions = useMemo(
    () =>
      recentActions.filter((item) => {
        const parsed = parseTaggedRemark(item.callRemark)
        return !!parsed.status && !NOT_CONNECTED_REASONS.includes(parsed.status)
      }),
    [recentActions],
  )

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
    const term = connectedSearchTerm.trim().toLowerCase()
    const afterOutcomeFilter =
      connectedOutcomeFilter === "all"
        ? flowConnectedActions
        : flowConnectedActions.filter((item) => {
            const parsed = parseTaggedRemark(item.callRemark)
            const status = (parsed.status || "").trim()
            if (!status) return false
            return getConnectedOutcomeForStatus(status) === connectedOutcomeFilter
          })
    return afterOutcomeFilter.filter((item) => {
      if (!term) return true
      const parsed = parseTaggedRemark(item.callRemark)
      const haystack = [item.name, item.mobile, item.kNumber, item.address, parsed.status, parsed.remark]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
      return haystack.includes(term)
    })
  }, [flowConnectedActions, connectedOutcomeFilter, connectedSearchTerm])

  const flowNotConnectedActions = useMemo(
    () =>
      recentActions.filter((item) => {
      const parsed = parseTaggedRemark(item.callRemark)
        return !!parsed.status && NOT_CONNECTED_REASONS.includes(parsed.status)
      }),
    [recentActions],
  )
  const filteredFlowNotConnectedActions = useMemo(() => {
    const term = notConnectedSearchTerm.trim().toLowerCase()
    return flowNotConnectedActions.filter((item) => {
      const parsed = parseTaggedRemark(item.callRemark)
      const reason = (parsed.status || "").trim()
      if (notConnectedReasonFilter !== "all" && reason !== notConnectedReasonFilter) return false
      if (!term) return true
      const haystack = [item.name, item.mobile, item.kNumber, item.address, reason, parsed.remark]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
      return haystack.includes(term)
    })
  }, [flowNotConnectedActions, notConnectedSearchTerm, notConnectedReasonFilter])

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
    const trimmed = remark.trim()
    return `[${backendCategory}] ${status}${trimmed ? ` | ${trimmed}` : ""}`
  }

  useEffect(() => {
    if (!currentLead) {
      setEditableLeadDetails(null)
      setIsEditingLead(false)
      previousCurrentLeadIdRef.current = null
      return
    }
    const hasLeadChanged = previousCurrentLeadIdRef.current !== currentLead.id
    if (!hasLeadChanged) return

    previousCurrentLeadIdRef.current = currentLead.id
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
    setCallConnection("")
    setConnectedOutcome("")
    setNotConnectedReason(NOT_CONNECTED_REASONS[0])
    setLostReason(LOST_REASONS[0])
    setDecisionReason(DECISION_PENDING_REASONS[0])
    setDecisionOverride("pending")
    setDealClosed(false)
    setCallRemark("")
    setRescheduleAt("")
  }, [currentLead])

  const submitAction = async (
    leadId: string,
    payload: { action: "start" | "called" | "follow_up" | "not_interested" | "rescheduled"; callRemark?: string; nextFollowUpAt?: string; actionAt?: string },
  ) => {
    if (!useApi) {
      toast({
        title: "API mode required",
        description: "Enable backend API mode to submit dealer actions.",
        variant: "destructive",
      })
      return
    }
    try {
      const actionAt = payload.actionAt || new Date().toISOString()
      let response: any
      try {
        response = await api.dealers.updateCallingLeadAction(leadId, payload)
      } catch (innerError) {
        const isInvalidTransition =
          innerError instanceof ApiError &&
          (innerError.code === "LEAD_005" || /invalid lead action transition/i.test(innerError.message || ""))

        // Many backends require `start` (assigned/queued → in_progress) before called / not_interested / etc.
        if (isInvalidTransition && payload.action !== "start" && payload.action !== "rescheduled") {
          try {
            await api.dealers.updateCallingLeadAction(leadId, { action: "start", actionAt })
            response = await api.dealers.updateCallingLeadAction(leadId, payload)
          } catch {
            // fall through to rescheduled fallback below
          }
        }

        // Backend often blocks direct transition for older/recent cards.
        // Fallback to a valid rescheduled transition so status edits still persist.
        if (!response && isInvalidTransition && payload.action !== "rescheduled") {
          const fallbackNextFollowUpAt =
            payload.nextFollowUpAt ||
            new Date(Date.now() + 60 * 60 * 1000).toISOString()
          response = await api.dealers.updateCallingLeadAction(leadId, {
            ...payload,
            action: "rescheduled",
            nextFollowUpAt: fallbackNextFollowUpAt,
            actionAt,
          })
        } else if (!response) {
          throw innerError
        }
      }
      setCallRemark("")
      setRescheduleAt("")
      setManualOtherReason("")
      setIsRescheduleChecked(false)
      setSelectedStatusGroup(STATUS_GROUPS[0].key)
      setSelectedStatus(STATUS_GROUPS[0].options[0])
      const wasCurrentQueueHead = dealerAssignedQueue[0]?.id === leadId
      if (response?.nextLead || response?.lead || response?.currentLead || response?.counts) {
        applyQueueResponse(response)
      }
      // GET is authoritative: always refetch so the next queued lead appears after submit
      // even when PATCH returns a minimal body or field names we do not map.
      await loadLeads()
      if (wasCurrentQueueHead) {
        setFlowTab("current_lead")
      }
    } catch (error) {
      const message =
        error instanceof ApiError ? error.details?.[0]?.message || error.message : "Failed to update lead action."
      toast({
        title: "Action failed",
        description: message,
        variant: "destructive",
      })
    }
  }

  const openDialer = (mobile?: string) => {
    const digits = (mobile || "").replace(/\D/g, "")
    if (!digits) {
      toast({
        title: "Phone number missing",
        description: "This lead does not have a valid mobile number.",
        variant: "destructive",
      })
      return
    }
    if (typeof window !== "undefined") {
      window.location.href = `tel:${digits}`
    }
  }

  const startCallFromRecent = async (item: ActionLogItem) => {
    // Primary behavior in Recent tab: user should be able to call immediately.
    openDialer(item.mobile)

    // Best-effort backend sync (do not block calling flow if transition is invalid).
    if (!item.leadId || !useApi) return
    try {
      await api.dealers.updateCallingLeadAction(item.leadId, { action: "start" })
      await loadLeads()
    } catch {
      // Ignore transition errors here; dialer is already opened.
    }
  }

  if (!isAuthenticated) return null

  return (
    <div className="min-h-screen bg-background">
      <DashboardNav />
      <main className="container mx-auto px-4 py-6 space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-100 to-amber-100 border border-orange-200 flex items-center justify-center">
            <PhoneCall className="w-4 h-4 text-primary" />
          </div>
          <h1 className="text-xl font-semibold">Calling Data</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          One lead visible at a time. Submit call result to unlock next queued lead automatically. The queue
          refreshes in the background every 5 minutes (and when you return to this tab).
        </p>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Dealer Call Analytics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Select
                value={analyticsRange}
                onValueChange={(value: "today" | "yesterday" | "this_week" | "last_week" | "this_month" | "last_month" | "last_year" | "custom") =>
                  setAnalyticsRange(value)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="yesterday">Yesterday</SelectItem>
                  <SelectItem value="this_week">This Week</SelectItem>
                  <SelectItem value="last_week">Last Week</SelectItem>
                  <SelectItem value="this_month">This Month</SelectItem>
                  <SelectItem value="last_month">Last Month</SelectItem>
                  <SelectItem value="last_year">Last Year</SelectItem>
                  <SelectItem value="custom">Custom Date Range</SelectItem>
                </SelectContent>
              </Select>
              {analyticsRange === "custom" ? (
                <>
                  <Input type="date" value={analyticsFromDate} onChange={(e) => setAnalyticsFromDate(e.target.value)} />
                  <Input type="date" value={analyticsToDate} onChange={(e) => setAnalyticsToDate(e.target.value)} />
                </>
              ) : null}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Total Calls</p>
                <p className="text-xl font-semibold">{analyticsSummary.totalCalls}</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Connected</p>
                <p className="text-xl font-semibold">{analyticsSummary.connected}</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Not Connected</p>
                <p className="text-xl font-semibold">{analyticsSummary.notConnected}</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Interested</p>
                <p className="text-xl font-semibold">{analyticsSummary.interested}</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Not Interested</p>
                <p className="text-xl font-semibold">{analyticsSummary.notInterested}</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Decision Pending</p>
                <p className="text-xl font-semibold">{analyticsSummary.decisionPending}</p>
              </div>
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
            onValueChange={(value) =>
              setFlowTab(value as "current_lead" | "scheduled" | "dialled" | "connected" | "not_connected")
            }
          >
            <TabsList className="w-full justify-start overflow-x-auto whitespace-nowrap rounded-xl border border-orange-200/70 bg-gradient-to-r from-amber-50/70 to-orange-50/70 p-1 [&_[data-slot=tabs-trigger][data-state=active]]:bg-white [&_[data-slot=tabs-trigger][data-state=active]]:text-orange-700 [&_[data-slot=tabs-trigger][data-state=active]]:shadow-sm">
              <TabsTrigger value="current_lead" className="shrink-0 text-xs sm:text-sm">Current Lead</TabsTrigger>
              <TabsTrigger value="scheduled" className="shrink-0 text-xs sm:text-sm">Scheduled</TabsTrigger>
              <TabsTrigger value="dialled" className="shrink-0 text-xs sm:text-sm">Dialled</TabsTrigger>
              <TabsTrigger value="connected" className="shrink-0 text-xs sm:text-sm">Connected</TabsTrigger>
              <TabsTrigger value="not_connected" className="shrink-0 text-xs sm:text-sm">Not Connected</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {flowTab === "scheduled" ? (
          <Card className="border-blue-200/70 bg-gradient-to-b from-white to-blue-50/30 shadow-sm">
            <CardHeader>
              <div className="flex flex-col gap-3">
                <CardTitle className="text-base">Scheduled Follow Ups</CardTitle>
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
                  {pagedScheduled.items.map((lead) => (
                    <div key={lead.id} className="rounded-md border border-blue-200/70 bg-blue-50/35 p-3 text-sm flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                      <div>
                        <p className="font-medium">{lead.name} • {lead.mobile}</p>
                        <p className="text-xs text-muted-foreground">Follow-up: {formatDateTime(lead.nextFollowUpAt)}</p>
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
                                value={scheduledRemarks[lead.id] ?? ""}
                                onChange={(e) => setScheduledRemarks((prev) => ({ ...prev, [lead.id]: e.target.value }))}
                              />
                              <div className="flex items-center gap-2">
                                <Checkbox
                                  id={`scheduled-reschedule-flow-${lead.id}`}
                                  checked={isReschedule}
                                  onCheckedChange={(checked) =>
                                    setScheduledRescheduleChecks((prev) => ({ ...prev, [lead.id]: checked === true }))
                                  }
                                />
                                <label htmlFor={`scheduled-reschedule-flow-${lead.id}`} className="text-xs text-muted-foreground cursor-pointer">
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
                                    const remark = buildTaggedRemark(statusGroup, finalStatus, scheduledRemarks[lead.id] ?? "")
                                    submitAction(lead.id, {
                                      action: isReschedule ? "rescheduled" : getActionFromStatus(finalStatus),
                                      nextFollowUpAt: isReschedule ? new Date(nextFollowUpRaw).toISOString() : undefined,
                                      callRemark: remark,
                                      actionAt: new Date().toISOString(),
                                    })
                                  }}
                                >
                                  Submit Status
                                </Button>
                                <Button size="sm" variant="outline" className="border-blue-300 text-blue-700 hover:bg-blue-50" onClick={() => submitAction(lead.id, { action: "start" })}>
                                  Start Call
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => openNewQuotationWithPrefill(lead)}>
                                  New Quotation
                                </Button>
                              </div>
                            </>
                          )
                        })()}
                      </div>
                    </div>
                  ))}
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
        ) : flowTab === "dialled" ? (
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-2">
                <CardTitle className="text-base">Dialled Data</CardTitle>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input
                    value={dialledSearchTerm}
                    onChange={(e) => {
                      setDialledSearchTerm(e.target.value)
                      setDialledPage(1)
                    }}
                    placeholder="Search by name, mobile, K number..."
                    className="w-full sm:w-80"
                  />
                  <Select
                    value={dialledActionFilter}
                    onValueChange={(value: "all" | "called" | "follow_up" | "not_interested" | "rescheduled") => {
                      setDialledActionFilter(value)
                      setDialledPage(1)
                    }}
                  >
                    <SelectTrigger className="w-full sm:w-56">
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
            <CardContent>
              {filteredFlowDialledActions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No dialled data found.</p>
              ) : (
                <div className="space-y-2">
                  {pagedDialled.items.map((item) => {
                    const parsed = parseTaggedRemark(item.callRemark)
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
                    const remark = recentEditRemarks[rowKey] ?? parsed.remark ?? ""
                    const editedTime = recentEditTimes[rowKey] ?? formatForDatetimeLocal(item.nextFollowUpAt)
                    return (
                      <div key={`dialled-${item.id}`} className="rounded-md border p-3 text-sm space-y-2">
                        <p className="font-medium">{item.name} • {item.mobile}</p>
                        <p className="text-xs text-muted-foreground">Action: {item.action || "N/A"} • At: {formatDateTime(item.actionAt)}</p>
                        <p className="text-xs text-muted-foreground">K No: {item.kNumber || "N/A"}</p>
                        <p className="text-xs text-muted-foreground">Address: {item.address || "N/A"}</p>
                        <Textarea
                          rows={2}
                          placeholder="Edit remark"
                          value={remark}
                          onChange={(e) => setRecentEditRemarks((prev) => ({ ...prev, [rowKey]: e.target.value }))}
                        />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          <Select
                            value={statusGroup}
                            onValueChange={(value) => {
                              const nextKey = value as StatusGroupKey
                              setRecentStatusGroups((prev) => ({ ...prev, [rowKey]: nextKey }))
                              setRecentStatuses((prev) => ({ ...prev, [rowKey]: getDefaultStatusByGroup(nextKey) }))
                              setRecentOtherReasons((prev) => ({ ...prev, [rowKey]: "" }))
                            }}
                          >
                            <SelectTrigger className="h-8"><SelectValue placeholder="Status category" /></SelectTrigger>
                            <SelectContent>
                              {STATUS_GROUPS.map((group) => (
                                <SelectItem key={group.key} value={group.key}>{group.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Select value={status} onValueChange={(value) => setRecentStatuses((prev) => ({ ...prev, [rowKey]: value }))}>
                            <SelectTrigger className="h-8"><SelectValue placeholder="Status" /></SelectTrigger>
                            <SelectContent>
                              {groupConfig.options.map((option) => (
                                <SelectItem key={option} value={option}>{option}</SelectItem>
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
                            onChange={(e) => setRecentOtherReasons((prev) => ({ ...prev, [rowKey]: e.target.value }))}
                          />
                        ) : null}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          <div className="flex items-center gap-2">
                            <Checkbox
                              id={`dialled-reschedule-${rowKey}`}
                              checked={isReschedule}
                              onCheckedChange={(checked) =>
                                setRecentRescheduleChecks((prev) => ({ ...prev, [rowKey]: checked === true }))
                              }
                            />
                            <label htmlFor={`dialled-reschedule-${rowKey}`} className="text-xs text-muted-foreground cursor-pointer">
                              Reschedule
                            </label>
                          </div>
                          <Input
                            type="datetime-local"
                            value={editedTime}
                            onChange={(e) => setRecentEditTimes((prev) => ({ ...prev, [rowKey]: e.target.value }))}
                          />
                        </div>
                        <Button
                          size="sm"
                          className="bg-violet-600 hover:bg-violet-700 text-white"
                          disabled={!item.leadId}
                          onClick={() => {
                            if (!finalStatus) return
                            if (isReschedule && !editedTime) return
                            submitAction(item.leadId, {
                              action: isReschedule ? "rescheduled" : getActionFromStatus(finalStatus),
                              callRemark: buildTaggedRemark(statusGroup, finalStatus, remark),
                              nextFollowUpAt: isReschedule ? new Date(editedTime).toISOString() : undefined,
                              actionAt: new Date().toISOString(),
                            })
                          }}
                        >
                          Update
                        </Button>
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
        ) : flowTab === "connected" ? (
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="text-base">Connected Data</CardTitle>
                <div className="w-full sm:w-64">
                  <Select
                    value={connectedOutcomeFilter}
                    onValueChange={(value: "all" | "interested" | "not_interested" | "decision_pending") => {
                      setConnectedOutcomeFilter(value)
                      setConnectedPage(1)
                    }}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue placeholder="Filter connected outcome" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="interested">Interested</SelectItem>
                      <SelectItem value="not_interested">Not Interested</SelectItem>
                      <SelectItem value="decision_pending">Decision Pending</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Input
                  value={connectedSearchTerm}
                  onChange={(e) => {
                    setConnectedSearchTerm(e.target.value)
                    setConnectedPage(1)
                  }}
                  placeholder="Search by name, mobile, reason..."
                  className="w-full sm:w-72"
                />
              </div>
            </CardHeader>
            <CardContent>
              {filteredFlowConnectedActions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No connected data found.</p>
              ) : (
                <div className="space-y-2">
                  {pagedConnected.items.map((item) => {
                    const parsed = parseTaggedRemark(item.callRemark)
                    const transferReasonText = extractTransferReason(parsed.remark)
                    const rowKey = actionRowKey(item)
                    const derivedOutcome = getConnectedOutcomeForStatus((parsed.status || "").trim())
                    const connectedOutcome = connectedCardOutcomes[rowKey] ?? derivedOutcome
                    const isReschedule = recentRescheduleChecks[rowKey] ?? false
                    const remark = recentEditRemarks[rowKey] ?? parsed.remark ?? ""
                    const editedTime = recentEditTimes[rowKey] ?? formatForDatetimeLocal(item.nextFollowUpAt)
                    return (
                      <div key={`connected-${item.id}`} className="rounded-md border p-3 text-sm space-y-2">
                        <p className="font-medium">{item.name} • {item.mobile}</p>
                        <p className="text-xs text-muted-foreground">Status: {parsed.status || "N/A"} • At: {formatDateTime(item.actionAt)}</p>
                        {transferReasonText ? (
                          <p className="text-xs text-emerald-700">
                            <span className="font-medium">Transfer Reason:</span> {transferReasonText}
                          </p>
                        ) : null}
                        <p className="text-xs text-muted-foreground">K No: {item.kNumber || "N/A"}</p>
                        <p className="text-xs text-muted-foreground">Address: {item.address || "N/A"}</p>
                        <Textarea
                          rows={2}
                          placeholder="Edit remark"
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
                            <SelectValue placeholder="Interested / Not Interested / Decision Pending" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="interested">Interested</SelectItem>
                            <SelectItem value="not_interested">Not Interested</SelectItem>
                            <SelectItem value="decision_pending">Decision Pending</SelectItem>
                          </SelectContent>
                        </Select>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          <div className="flex items-center gap-2">
                            <Checkbox
                              id={`connected-reschedule-${rowKey}`}
                              checked={isReschedule}
                              onCheckedChange={(checked) =>
                                setRecentRescheduleChecks((prev) => ({ ...prev, [rowKey]: checked === true }))
                              }
                            />
                            <label htmlFor={`connected-reschedule-${rowKey}`} className="text-xs text-muted-foreground cursor-pointer">
                              Reschedule
                            </label>
                          </div>
                          <Input
                            type="datetime-local"
                            value={editedTime}
                            onChange={(e) => setRecentEditTimes((prev) => ({ ...prev, [rowKey]: e.target.value }))}
                            disabled={!isReschedule}
                          />
                        </div>
                        <Button
                          size="sm"
                          className="bg-violet-600 hover:bg-violet-700 text-white"
                          disabled={!item.leadId}
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
                              nextAction = isReschedule ? "rescheduled" : "follow_up"
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
                          Update
                        </Button>
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
        ) : flowTab === "not_connected" ? (
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-2">
                <CardTitle className="text-base">Not Connected Data</CardTitle>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input
                    value={notConnectedSearchTerm}
                    onChange={(e) => {
                      setNotConnectedSearchTerm(e.target.value)
                      setNotConnectedPage(1)
                    }}
                    placeholder="Search by name, mobile, K number..."
                    className="w-full sm:w-80"
                  />
                  <Select
                    value={notConnectedReasonFilter}
                    onValueChange={(value) => {
                      setNotConnectedReasonFilter(value)
                      setNotConnectedPage(1)
                    }}
                  >
                    <SelectTrigger className="w-full sm:w-56">
                      <SelectValue placeholder="Filter not connected reason" />
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
            <CardContent>
              {filteredFlowNotConnectedActions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No not-connected data found.</p>
              ) : (
                <div className="space-y-2">
                  {pagedNotConnected.items.map((item) => {
                    const parsed = parseTaggedRemark(item.callRemark)
                    const transferReasonText = extractTransferReason(parsed.remark)
                    const rowKey = actionRowKey(item)
                    const derivedReason = NOT_CONNECTED_REASONS.includes(parsed.status) ? parsed.status : NOT_CONNECTED_REASONS[0]
                    const selectedReasonRaw = recentStatuses[rowKey] ?? derivedReason
                    const selectedReason = NOT_CONNECTED_REASONS.includes(selectedReasonRaw) ? selectedReasonRaw : derivedReason
                    const remark = recentEditRemarks[rowKey] ?? parsed.remark ?? ""
                    const transferToConnected = notConnectedTransferChecks[rowKey] ?? false
                    const transferReason = notConnectedTransferReasons[rowKey] ?? ""
                    const transferOutcome = notConnectedTransferOutcomes[rowKey] ?? "interested"
                    const isReschedule = recentRescheduleChecks[rowKey] ?? transferOutcome === "decision_pending"
                    const editedTime = recentEditTimes[rowKey] ?? formatForDatetimeLocal(item.nextFollowUpAt)
                    return (
                      <div key={`not-connected-${item.id}`} className="rounded-md border p-3 text-sm space-y-2">
                        <p className="font-medium">{item.name} • {item.mobile}</p>
                        <p className="text-xs text-muted-foreground">
                          Reason: {selectedReason || "N/A"} • At: {formatDateTime(item.actionAt)}
                        </p>
                        {transferReasonText ? (
                          <p className="text-xs text-emerald-700">
                            <span className="font-medium">Transfer Reason:</span> {transferReasonText}
                          </p>
                        ) : null}
                        <p className="text-xs text-muted-foreground">K No: {item.kNumber || "N/A"}</p>
                        <p className="text-xs text-muted-foreground">Address: {item.address || "N/A"}</p>
                        <Textarea
                          rows={2}
                          placeholder="Edit remark"
                          value={remark}
                          onChange={(e) => setRecentEditRemarks((prev) => ({ ...prev, [rowKey]: e.target.value }))}
                        />
                        <div className="space-y-1.5">
                          <p className="text-xs text-muted-foreground">Reason of not connected</p>
                          <Select value={selectedReason} onValueChange={(value) => setRecentStatuses((prev) => ({ ...prev, [rowKey]: value }))}>
                            <SelectTrigger className="h-8">
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
                        <div className="space-y-2 rounded-md border border-dashed p-2">
                          <div className="flex items-center gap-2">
                            <Checkbox
                              id={`transfer-connected-${rowKey}`}
                              checked={transferToConnected}
                              onCheckedChange={(checked) =>
                                setNotConnectedTransferChecks((prev) => ({ ...prev, [rowKey]: checked === true }))
                              }
                            />
                            <label htmlFor={`transfer-connected-${rowKey}`} className="text-xs text-muted-foreground cursor-pointer">
                              Move this lead to Connected flow
                            </label>
                          </div>
                          {transferToConnected ? (
                            <div className="space-y-2">
                              <Input
                                className="h-8"
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
                                <SelectTrigger className="h-8">
                                  <SelectValue placeholder="Interested / Not Interested / Decision Pending" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="interested">Interested</SelectItem>
                                  <SelectItem value="not_interested">Not Interested</SelectItem>
                                  <SelectItem value="decision_pending">Decision Pending</SelectItem>
                                </SelectContent>
                              </Select>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                <div className="flex items-center gap-2">
                                  <Checkbox
                                    id={`not-connected-reschedule-${rowKey}`}
                                    checked={isReschedule}
                                    onCheckedChange={(checked) =>
                                      setRecentRescheduleChecks((prev) => ({ ...prev, [rowKey]: checked === true }))
                                    }
                                  />
                                  <label
                                    htmlFor={`not-connected-reschedule-${rowKey}`}
                                    className="text-xs text-muted-foreground cursor-pointer"
                                  >
                                    Reschedule
                                  </label>
                                </div>
                                <Input
                                  type="datetime-local"
                                  value={editedTime}
                                  onChange={(e) => setRecentEditTimes((prev) => ({ ...prev, [rowKey]: e.target.value }))}
                                  disabled={!isReschedule}
                                />
                              </div>
                            </div>
                          ) : null}
                        </div>
                        <Button
                          size="sm"
                          className="bg-violet-600 hover:bg-violet-700 text-white"
                          disabled={!item.leadId}
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
                                nextAction = isReschedule ? "rescheduled" : "follow_up"
                                nextFollowUpAt = isReschedule && editedTime ? new Date(editedTime).toISOString() : undefined
                              }
                              if (isReschedule && !editedTime) return
                              const combinedRemark = [remark, `Transfer Reason: ${transferReason.trim()}`]
                                .map((part) => part.trim())
                                .filter(Boolean)
                                .join(" | ")
                              submitAction(item.leadId, {
                                action: nextAction,
                                callRemark: buildTaggedRemark(groupKey, finalConnectedStatus, combinedRemark),
                                nextFollowUpAt,
                                actionAt: new Date().toISOString(),
                              })
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
                          {transferToConnected ? "Move to Connected" : "Update"}
                        </Button>
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
        ) : !currentLead ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              No calling data pending for you.
            </CardContent>
          </Card>
        ) : (
          <Card className="border-orange-200/70 bg-gradient-to-b from-white to-orange-50/30 shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Current Lead</CardTitle>
                {isEditingLead ? (
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => setIsEditingLead(false)} className="gap-1">
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
                      className="gap-1"
                    >
                      <X className="w-3.5 h-3.5" />
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Button size="icon" variant="ghost" onClick={() => setIsEditingLead(true)} aria-label="Edit lead details">
                    <Pencil className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Name</p>
                  {isEditingLead ? (
                    <Input
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
                    <p className="font-semibold">{leadForView.name || "N/A"}</p>
                  )}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Mobile</p>
                  {isEditingLead ? (
                    <Input
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
                    <p className="font-semibold">{leadForView.mobile || "N/A"}</p>
                  )}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">K Number</p>
                  {isEditingLead ? (
                    <Input
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
                    <p className="font-medium">{leadForView.kNumber || "N/A"}</p>
                  )}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Location</p>
                  {isEditingLead ? (
                    <div className="grid grid-cols-2 gap-2">
                      <Input
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
                    <p className="font-medium">{[leadForView.city, leadForView.state].filter(Boolean).join(", ") || "N/A"}</p>
                  )}
                </div>
                <div className="md:col-span-2">
                  <p className="text-xs text-muted-foreground">Address</p>
                  {isEditingLead ? (
                    <Textarea
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
                    <p className="font-medium">{leadForView.address || "N/A"}</p>
                  )}
                </div>
                <div className="md:col-span-2">
                  <p className="text-xs text-muted-foreground">Customer Note</p>
                  {isEditingLead ? (
                    <Textarea
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
                    <p className="font-medium">{leadForView.customerNote || "N/A"}</p>
                  )}
                </div>
                <div className="md:col-span-2 flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      openNewQuotationWithPrefill({
                        ...currentLead,
                        ...leadForView,
                      })
                    }
                  >
                    Create Quotation (Prefill)
                  </Button>
                </div>
              </div>

              <div className="space-y-3 pt-2 border-t border-orange-200/70">
                {currentLead.status === "assigned" || currentLead.status === "queued" ? (
                  <Button
                    variant="outline"
                    onClick={() =>
                      submitAction(
                        currentLead.id,
                        { action: "start" },
                      )
                    }
                    className="gap-2"
                  >
                    <ArrowRightCircle className="w-4 h-4" />
                    Start Call
                  </Button>
                ) : (
                  <>
                    <Textarea
                      placeholder="Remarks"
                      value={callRemark}
                      onChange={(e) => setCallRemark(e.target.value)}
                      rows={3}
                    />
                    <div className="rounded-md border border-amber-200/80 bg-amber-50/40 p-3 space-y-3">
                      <div className="text-xs text-muted-foreground flex flex-wrap gap-3">
                        <span>Current Lead</span>
                        <span>&rarr; Dialled</span>
                        <span>&rarr; {callConnection ? (callConnection === "connected" ? "Connected" : "Not Connected") : "Choose Connection"}</span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <p className="text-xs text-muted-foreground">Connection</p>
                          <Select
                            value={callConnection}
                            onValueChange={(value: "connected" | "not_connected") => {
                              setCallConnection(value)
                              setConnectedOutcome("")
                              setDecisionOverride("pending")
                              setDealClosed(false)
                              if (value === "not_connected") {
                                setIsRescheduleChecked(false)
                                setRescheduleAt("")
                              }
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Connected / Not Connected" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="connected">Connected</SelectItem>
                              <SelectItem value="not_connected">Not Connected</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {callConnection === "connected" ? (
                          <div className="space-y-1.5">
                            <p className="text-xs text-muted-foreground">Connected Outcome</p>
                            <Select
                              value={connectedOutcome}
                              onValueChange={(value: "interested" | "not_interested" | "decision_pending") => {
                                setConnectedOutcome(value)
                                if (value === "decision_pending") {
                                  setIsRescheduleChecked(true)
                                  setRescheduleAt((prev) => prev || formatForDatetimeLocal(new Date(Date.now() + 60 * 60 * 1000).toISOString()))
                                } else {
                                  setIsRescheduleChecked(false)
                                  setRescheduleAt("")
                                }
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Interested / Not Interested / Decision Pending" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="interested">Interested</SelectItem>
                                <SelectItem value="not_interested">Not Interested</SelectItem>
                                <SelectItem value="decision_pending">Decision Pending</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        ) : null}
                      </div>

                      {callConnection === "not_connected" ? (
                        <div className="space-y-1.5">
                          <p className="text-xs text-muted-foreground">Reason of not connected</p>
                          <Select value={notConnectedReason} onValueChange={setNotConnectedReason}>
                            <SelectTrigger>
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
                          <p className="text-xs text-muted-foreground">Lost Reason</p>
                          <Select value={lostReason} onValueChange={setLostReason}>
                            <SelectTrigger>
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
                        <div className="flex items-center gap-2">
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
                        <div className="space-y-3">
                          <div className="space-y-1.5">
                            <p className="text-xs text-muted-foreground">Hold Reason</p>
                            <Select value={decisionReason} onValueChange={setDecisionReason}>
                              <SelectTrigger>
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
                          <div className="w-full md:w-72 space-y-1">
                            <p className="text-xs text-muted-foreground">Reschedule date and time</p>
                            <Input type="datetime-local" value={rescheduleAt} onChange={(e) => setRescheduleAt(e.target.value)} />
                          </div>
                          <div className="space-y-1.5">
                            <p className="text-xs text-muted-foreground">Update final decision now (optional)</p>
                            <Select value={decisionOverride} onValueChange={(value: "pending" | "interested" | "not_interested") => setDecisionOverride(value)}>
                              <SelectTrigger>
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
                          className="bg-orange-500 hover:bg-orange-600 text-white"
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
                                groupKey = "part_3_followup_sales"
                                finalStatus = decisionReason
                                nextAction = "rescheduled"
                                nextFollowUpAt = new Date(rescheduleAt).toISOString()
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
                        >
                          Submit
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        )}
        </TabsContent>

        <TabsContent value="scheduled">
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
                  <div key={lead.id} className="rounded-md border border-blue-200/70 bg-blue-50/35 p-3 text-sm flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                    <div>
                      <p className="font-medium">{lead.name} • {lead.mobile}</p>
                      <p className="text-xs text-muted-foreground">Follow-up: {formatDateTime(lead.nextFollowUpAt)}</p>
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
                              value={scheduledRemarks[lead.id] ?? ""}
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
                                  const remark = buildTaggedRemark(statusGroup, finalStatus, scheduledRemarks[lead.id] ?? "")
                                  submitAction(lead.id, {
                                    action: isReschedule ? "rescheduled" : getActionFromStatus(finalStatus),
                                    nextFollowUpAt: isReschedule ? new Date(nextFollowUpRaw).toISOString() : undefined,
                                    callRemark: remark,
                                    actionAt: new Date().toISOString(),
                                  })
                                }}
                              >
                                Submit Status
                              </Button>
                              <Button size="sm" variant="outline" className="border-blue-300 text-blue-700 hover:bg-blue-50" onClick={() => submitAction(lead.id, { action: "start" })}>
                                Start Call
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => openNewQuotationWithPrefill(lead)}>
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
                        {parsed.remark ? <p><span className="font-medium">Remark:</span> {parsed.remark}</p> : null}
                      </div>
                    ) : null}
                    <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                      <Textarea
                        rows={2}
                        placeholder="Edit remark"
                        value={recentEditRemarks[actionRowKey(item)] ?? parsed.remark ?? ""}
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
                      const remark = recentEditRemarks[rowKey] ?? parsed.remark ?? ""
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
                                  action: isReschedule ? "rescheduled" : getActionFromStatus(finalStatus),
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
                              onClick={() =>
                                openNewQuotationWithPrefill({
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
                          {parsed.remark ? <p><span className="font-medium">Remark:</span> {parsed.remark}</p> : null}
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
    </div>
  )
}
