"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { api, ApiError } from "@/lib/api"
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
  "Call Unanswered",
  "Switched Off",
  "Not Reachable",
  "Busy / Line Busy",
  "Call Disconnected",
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
  const [editableLeadDetails, setEditableLeadDetails] = useState<EditableLeadDetails | null>(null)
  const [isEditingLead, setIsEditingLead] = useState(false)
  const useApi = process.env.NEXT_PUBLIC_USE_API !== "false"

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
    return {
      id: lead?.id || `lead-${Date.now()}`,
      name: lead?.name || "Unknown",
      mobile: lead?.mobile || "",
      altMobile: lead?.altMobile || lead?.alternateMobile || "",
      kNumber: lead?.kNumber || lead?.k_number || "",
      address: lead?.address || "",
      customerNote: lead?.customerNote || lead?.note || "",
      city: lead?.city || "",
      state: lead?.state || "",
      assignedDealerId: lead?.assignedDealerId || lead?.dealerId || dealer?.id || "",
      assignedDealerName: lead?.assignedDealerName || lead?.dealerName || "",
      createdAt: lead?.createdAt || lead?.assignedAt || new Date().toISOString(),
      assignedAt: lead?.assignedAt,
      queuedAt: lead?.queuedAt,
      status: lead?.status || "assigned",
      action: lead?.action,
      actionAt: lead?.actionAt,
      nextFollowUpAt: lead?.nextFollowUpAt,
      callRemark: lead?.callRemark || "",
    }
  }

  const normalizeActionLog = (entry: any): ActionLogItem => {
    const lead = entry?.lead || entry
    return {
      id: entry?.id || `${lead?.id || "lead"}-${entry?.actionAt || entry?.updatedAt || Date.now()}`,
      leadId: entry?.leadId || lead?.id || "",
      name: entry?.name || lead?.name || "Unknown",
      mobile: entry?.mobile || lead?.mobile || "",
      action: entry?.action || lead?.action,
      actionAt: entry?.actionAt || lead?.actionAt || entry?.updatedAt,
      callRemark: entry?.callRemark || lead?.callRemark || "",
      nextFollowUpAt: entry?.nextFollowUpAt || lead?.nextFollowUpAt,
      status: entry?.status || lead?.status,
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
    return match?.[1] || ""
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

  const actionRowKey = (item: ActionLogItem) => item.leadId || item.id

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
    const rawLead = response?.lead || response?.nextLead || response?.currentLead || null
    const normalizedLead = rawLead ? normalizeApiLead(rawLead) : null
    setLeads(normalizedLead ? [normalizedLead] : [])
    const scheduledSource = response?.scheduledLeads || response?.upcomingFollowUps || response?.followUps || []
    const normalizedScheduled = Array.isArray(scheduledSource)
      ? scheduledSource
          .map(normalizeApiLead)
          .filter((lead) => !!lead.nextFollowUpAt)
          .sort((a, b) => new Date(a.nextFollowUpAt || 0).getTime() - new Date(b.nextFollowUpAt || 0).getTime())
      : []
    setScheduledLeads(normalizedScheduled)

    const actionSource = response?.recentActions || response?.actionHistory || response?.completedActions || []
    const normalizedActions = Array.isArray(actionSource)
      ? actionSource
          .map(normalizeActionLog)
          .sort((a, b) => new Date(b.actionAt || 0).getTime() - new Date(a.actionAt || 0).getTime())
      : []
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
      const response = await api.dealers.getCallingQueueNext()
      applyQueueResponse(response)
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

  const getLeadSortTime = (lead: CallingLead) => {
    if (lead.status === "rescheduled" && lead.nextFollowUpAt) return new Date(lead.nextFollowUpAt).getTime()
    return new Date(lead.assignedAt || lead.createdAt).getTime()
  }

  const dealerAssignedQueue = useMemo(() => {
    const now = Date.now()
    return leads
      .filter((lead) => {
        if (lead.assignedDealerId !== dealer?.id) return false
        if (lead.status === "completed" || lead.status === "queued") return false
        if (lead.status === "rescheduled" && lead.nextFollowUpAt) {
          return new Date(lead.nextFollowUpAt).getTime() <= now
        }
        return true
      })
      .sort((a, b) => getLeadSortTime(a) - getLeadSortTime(b))
  }, [leads, dealer?.id])

  const queuedCount = useMemo(() => {
    return leads.filter((lead) => lead.assignedDealerId === dealer?.id && lead.status === "queued").length
  }, [leads, dealer?.id])

  const scheduledCount = useMemo(() => {
    const now = Date.now()
    return leads.filter((lead) => {
      if (lead.assignedDealerId !== dealer?.id || lead.status !== "rescheduled") return false
      if (!lead.nextFollowUpAt) return false
      return new Date(lead.nextFollowUpAt).getTime() > now
    }).length
  }, [leads, dealer?.id])

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
    return scheduledLeads.filter((lead) => {
      const nextAt = lead.nextFollowUpAt ? new Date(lead.nextFollowUpAt) : null
      const now = new Date()
      const matchesTime =
        scheduledTimeFilter === "all" ||
        (nextAt &&
          !Number.isNaN(nextAt.getTime()) &&
          (scheduledTimeFilter === "today"
            ? nextAt.toDateString() === now.toDateString()
            : scheduledTimeFilter === "next7"
              ? nextAt.getTime() >= now.getTime() && nextAt.getTime() <= now.getTime() + 7 * 24 * 60 * 60 * 1000
              : nextAt.getTime() >= now.getTime() && nextAt.getTime() <= now.getTime() + 30 * 24 * 60 * 60 * 1000))
      if (!matchesTime) return false
      if (!term) return true
      const haystack = [lead.name, lead.mobile, lead.kNumber, lead.address, lead.city, lead.state, lead.callRemark]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
      return haystack.includes(term)
    })
  }, [scheduledLeads, scheduledSearchTerm, scheduledTimeFilter])

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

  const buildTaggedRemark = (groupLabel: string, status: string, remark: string) => {
    const trimmed = remark.trim()
    return `[${groupLabel}] ${status}${trimmed ? ` | ${trimmed}` : ""}`
  }

  useEffect(() => {
    if (!currentLead) {
      setEditableLeadDetails(null)
      setIsEditingLead(false)
      return
    }
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
      const response = await api.dealers.updateCallingLeadAction(leadId, payload)
      setCallRemark("")
      setRescheduleAt("")
      setManualOtherReason("")
      setIsRescheduleChecked(false)
      setSelectedStatusGroup(STATUS_GROUPS[0].key)
      setSelectedStatus(STATUS_GROUPS[0].options[0])
      if (response?.nextLead || response?.lead || response?.currentLead || response?.counts) {
        applyQueueResponse(response)
      } else {
        await loadLeads()
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
          One lead visible at a time. Submit call result to unlock next queued lead automatically.
        </p>

        <Tabs value={activeSubTab} onValueChange={setActiveSubTab}>
          <TabsList className="w-full justify-start overflow-x-auto whitespace-nowrap rounded-xl border border-orange-200/70 bg-gradient-to-r from-amber-50/70 to-orange-50/70 p-1 [&_[data-slot=tabs-trigger][data-state=active]]:bg-white [&_[data-slot=tabs-trigger][data-state=active]]:text-orange-700 [&_[data-slot=tabs-trigger][data-state=active]]:shadow-sm">
            <TabsTrigger value="current" className="shrink-0 text-xs sm:text-sm">Current Lead</TabsTrigger>
            <TabsTrigger value="scheduled" className="shrink-0 text-xs sm:text-sm">Scheduled</TabsTrigger>
            <TabsTrigger value="recent" className="shrink-0 text-xs sm:text-sm">Recent Actions</TabsTrigger>
            <TabsTrigger value="interested" className="shrink-0 text-xs sm:text-sm">Interested</TabsTrigger>
          </TabsList>

        <TabsContent value="current">
        {!currentLead ? (
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
                {currentLead.status === "assigned" ? (
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
                      placeholder="Call report / remarks"
                      value={callRemark}
                      onChange={(e) => setCallRemark(e.target.value)}
                      rows={3}
                    />
                    <div className="rounded-md border border-amber-200/80 bg-amber-50/40 p-3 space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <p className="text-xs text-muted-foreground">Status category</p>
                          <Select
                            value={selectedStatusGroup}
                            onValueChange={(value) => {
                              const group = STATUS_GROUPS.find((item) => item.key === value)
                              if (!group) return
                              setSelectedStatusGroup(group.key)
                              setSelectedStatus(group.options[0])
                              setManualOtherReason("")
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                            <SelectContent>
                              {STATUS_GROUPS.map((group) => (
                                <SelectItem key={group.key} value={group.key}>
                                  {group.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <p className="text-xs text-muted-foreground">Status</p>
                          <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                            <SelectContent>
                              {selectedStatusGroupConfig.options.map((option) => (
                                <SelectItem key={option} value={option}>
                                  {option}
                                </SelectItem>
                              ))}
                              <SelectItem value={OTHER_STATUS_VALUE}>Others</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {selectedStatus === OTHER_STATUS_VALUE && (
                        <div className="space-y-1.5">
                          <p className="text-xs text-muted-foreground">Other reason</p>
                          <Input
                            value={manualOtherReason}
                            onChange={(e) => setManualOtherReason(e.target.value)}
                            placeholder="Enter custom reason"
                          />
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="reschedule-checkbox"
                          checked={isRescheduleChecked}
                          onCheckedChange={(checked) => {
                            const isChecked = checked === true
                            setIsRescheduleChecked(isChecked)
                            if (!isChecked) {
                              setRescheduleAt("")
                            }
                          }}
                        />
                        <label htmlFor="reschedule-checkbox" className="text-sm cursor-pointer select-none">
                          Reschedule follow-up
                        </label>
                      </div>

                      {isRescheduleChecked && (
                        <div className="w-full md:w-72 space-y-1">
                          <p className="text-xs text-muted-foreground">Reschedule date and time</p>
                          <Input type="datetime-local" value={rescheduleAt} onChange={(e) => setRescheduleAt(e.target.value)} />
                        </div>
                      )}

                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          className="bg-orange-500 hover:bg-orange-600 text-white"
                          onClick={() => {
                            if (!finalSelectedStatus) {
                              toast({
                                title: "Reason required",
                                description: "Please select a status or enter other reason.",
                                variant: "destructive",
                              })
                              return
                            }
                            if (isRescheduleChecked && !rescheduleAt) {
                              toast({
                                title: "Select reschedule time",
                                description: "Please choose date and time before rescheduling.",
                                variant: "destructive",
                              })
                              return
                            }
                            const nextAction: "called" | "follow_up" | "not_interested" | "rescheduled" = isRescheduleChecked
                              ? "rescheduled"
                              : getActionFromStatus(finalSelectedStatus)
                            const trimmedRemark = callRemark.trim()
                            const taggedRemark = `[${selectedStatusGroupConfig.label}] ${finalSelectedStatus}${
                              trimmedRemark ? ` | ${trimmedRemark}` : ""
                            }`
                            submitAction(currentLead.id, {
                              action: nextAction,
                              callRemark: taggedRemark,
                              nextFollowUpAt: isRescheduleChecked ? new Date(rescheduleAt).toISOString() : undefined,
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
                                  const remark = buildTaggedRemark(groupConfig.label, finalStatus, scheduledRemarks[lead.id] ?? "")
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
                    {item.nextFollowUpAt ? (
                      <p className="text-xs text-muted-foreground">Next follow-up: {formatDateTime(item.nextFollowUpAt)}</p>
                    ) : null}
                    {(parsed.category || parsed.status || parsed.remark) ? (
                      <div className="mt-1 space-y-1 text-xs">
                        {parsed.category ? <p><span className="font-medium">Status Category:</span> {parsed.category}</p> : null}
                        {parsed.status ? <p><span className="font-medium">Status:</span> {parsed.status}</p> : null}
                        {parsed.remark ? <p><span className="font-medium">Remark:</span> {parsed.remark}</p> : null}
                      </div>
                    ) : null}
                    <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                      <Textarea
                        rows={2}
                        placeholder="Edit remark"
                        value={recentEditRemarks[actionRowKey(item)] ?? item.callRemark ?? ""}
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
                      const statusGroup = recentStatusGroups[rowKey] ?? STATUS_GROUPS[0].key
                      const groupConfig = STATUS_GROUPS.find((group) => group.key === statusGroup) || STATUS_GROUPS[0]
                      const status = recentStatuses[rowKey] ?? getDefaultStatusByGroup(statusGroup)
                      const otherReason = recentOtherReasons[rowKey] ?? ""
                      const isReschedule = recentRescheduleChecks[rowKey] ?? false
                      const finalStatus = status === OTHER_STATUS_VALUE ? otherReason.trim() : status
                      const remark = recentEditRemarks[rowKey] ?? item.callRemark ?? ""
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
                                  callRemark: buildTaggedRemark(groupConfig.label, finalStatus, remark),
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
                              disabled={!item.leadId}
                              onClick={() => submitAction(item.leadId, { action: "start" })}
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
                          {parsed.category ? <p><span className="font-medium">Status Category:</span> {parsed.category}</p> : null}
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
