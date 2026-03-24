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
import { useToast } from "@/hooks/use-toast"
import { PhoneCall, CheckCircle2, XCircle, ArrowRightCircle, Pencil, Check, X } from "lucide-react"

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

const OUTCOME_OPTIONS = {
  interested: [
    "Send quotation",
    "Site visit required",
    "Need subsidy details",
    "Need finance details",
    "Will confirm soon",
  ],
  not_interested: [
    "Already installed",
    "Budget issue",
    "Not planning now",
    "Wrong requirement",
    "Already with competitor",
  ],
  follow_up: [
    "Call not picked",
    "Call back later",
    "Busy right now",
    "Call tomorrow",
    "Need family discussion",
  ],
  others: [
    "Switched off",
    "Invalid number",
    "Out of coverage",
    "Duplicate lead",
    "Other",
  ],
} as const

const addOutcomeToRemark = (baseRemark: string, label: string, option: string) => {
  const trimmed = baseRemark.trim()
  return `[${label}] ${option}${trimmed ? ` | ${trimmed}` : ""}`
}

type OutcomeCategory = "interested" | "not_interested" | "follow_up" | "others"
type EditableLeadDetails = {
  name: string
  mobile: string
  kNumber: string
  city: string
  state: string
  address: string
  customerNote: string
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
  const [scheduledEditTimes, setScheduledEditTimes] = useState<Record<string, string>>({})
  const [recentEditRemarks, setRecentEditRemarks] = useState<Record<string, string>>({})
  const [recentEditTimes, setRecentEditTimes] = useState<Record<string, string>>({})
  const [interestedOption, setInterestedOption] = useState<string>(OUTCOME_OPTIONS.interested[0])
  const [notInterestedOption, setNotInterestedOption] = useState<string>(OUTCOME_OPTIONS.not_interested[0])
  const [followUpOption, setFollowUpOption] = useState<string>(OUTCOME_OPTIONS.follow_up[0])
  const [othersOption, setOthersOption] = useState<string>(OUTCOME_OPTIONS.others[0])
  const [activeOutcomeCategory, setActiveOutcomeCategory] = useState<OutcomeCategory | null>(null)
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
    () => recentActions.filter((item) => item.action === "called" && (item.callRemark || "").includes("[Interested]")),
    [recentActions],
  )

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
      const actionLead = dealerAssignedQueue.find((lead) => lead.id === leadId) || currentLead
      if (payload.action !== "start" && actionLead) {
        const localActionHistory = JSON.parse(localStorage.getItem("callingActionHistory") || "[]")
        const nextHistory = [
          {
            id: `${leadId}-${actionAt}`,
            leadId,
            dealerId: dealer?.id || "",
            dealerName: `${dealer?.firstName || ""} ${dealer?.lastName || ""}`.trim() || dealer?.username || "Unknown Employee",
            action: payload.action,
            callRemark: payload.callRemark || "",
            actionAt,
            nextFollowUpAt: payload.nextFollowUpAt,
            name: actionLead.name || "",
            mobile: actionLead.mobile || "",
            kNumber: actionLead.kNumber || "",
            address: actionLead.address || "",
            city: actionLead.city || "",
            state: actionLead.state || "",
            customerNote: actionLead.customerNote || "",
          },
          ...localActionHistory,
        ].slice(0, 5000)
        localStorage.setItem("callingActionHistory", JSON.stringify(nextHistory))
      }
      setCallRemark("")
      setRescheduleAt("")
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
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <PhoneCall className="w-4 h-4 text-primary" />
          </div>
          <h1 className="text-xl font-semibold">Calling Data</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          One lead visible at a time. Submit call result to unlock next queued lead automatically.
        </p>

        <Tabs value={activeSubTab} onValueChange={setActiveSubTab}>
          <TabsList className="w-full justify-start overflow-x-auto whitespace-nowrap">
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
          <Card className="border-border/60 shadow-sm">
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

              <div className="space-y-3 pt-2 border-t border-border/70">
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
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        onClick={() => setActiveOutcomeCategory("interested")}
                        className={`gap-2 border-amber-200 text-amber-800 hover:bg-amber-50 ${
                          activeOutcomeCategory === "interested" ? "bg-amber-100" : "bg-amber-50/60"
                        }`}
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Interested
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setActiveOutcomeCategory("follow_up")}
                        className={`gap-2 border-blue-200 text-blue-800 hover:bg-blue-50 ${
                          activeOutcomeCategory === "follow_up" ? "bg-blue-100" : "bg-blue-50/60"
                        }`}
                      >
                        <ArrowRightCircle className="w-4 h-4" />
                        Follow Up
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setActiveOutcomeCategory("not_interested")}
                        className={`gap-2 border-rose-200 text-rose-800 hover:bg-rose-50 ${
                          activeOutcomeCategory === "not_interested" ? "bg-rose-100" : "bg-rose-50/60"
                        }`}
                      >
                        <XCircle className="w-4 h-4" />
                        Not Interested
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setActiveOutcomeCategory("others")}
                        className={`gap-2 border-slate-200 text-slate-700 hover:bg-slate-50 ${
                          activeOutcomeCategory === "others" ? "bg-slate-100" : "bg-slate-50/60"
                        }`}
                      >
                        Others
                      </Button>
                    </div>
                    {activeOutcomeCategory && (
                      <div className="rounded-md border border-border/70 p-3 space-y-2">
                        {activeOutcomeCategory === "interested" && (
                          <>
                            <p className="text-xs text-muted-foreground">Interested reason</p>
                            <Select value={interestedOption} onValueChange={setInterestedOption}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select interested reason" />
                              </SelectTrigger>
                              <SelectContent>
                                {OUTCOME_OPTIONS.interested.map((option) => (
                                  <SelectItem key={option} value={option}>
                                    {option}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </>
                        )}
                        {activeOutcomeCategory === "not_interested" && (
                          <>
                            <p className="text-xs text-muted-foreground">Not interested reason</p>
                            <Select value={notInterestedOption} onValueChange={setNotInterestedOption}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select not interested reason" />
                              </SelectTrigger>
                              <SelectContent>
                                {OUTCOME_OPTIONS.not_interested.map((option) => (
                                  <SelectItem key={option} value={option}>
                                    {option}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </>
                        )}
                        {activeOutcomeCategory === "follow_up" && (
                          <>
                            <p className="text-xs text-muted-foreground">Follow up reason</p>
                            <Select value={followUpOption} onValueChange={setFollowUpOption}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select follow-up reason" />
                              </SelectTrigger>
                              <SelectContent>
                                {OUTCOME_OPTIONS.follow_up.map((option) => (
                                  <SelectItem key={option} value={option}>
                                    {option}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </>
                        )}
                        {activeOutcomeCategory === "others" && (
                          <>
                            <p className="text-xs text-muted-foreground">Others reason</p>
                            <Select value={othersOption} onValueChange={setOthersOption}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select other reason" />
                              </SelectTrigger>
                              <SelectContent>
                                {OUTCOME_OPTIONS.others.map((option) => (
                                  <SelectItem key={option} value={option}>
                                    {option}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </>
                        )}
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            onClick={() => {
                              const payload =
                                activeOutcomeCategory === "interested"
                                  ? {
                                      action: "called" as const,
                                      callRemark: addOutcomeToRemark(callRemark, "Interested", interestedOption),
                                    }
                                  : activeOutcomeCategory === "not_interested"
                                    ? {
                                        action: "not_interested" as const,
                                        callRemark: addOutcomeToRemark(callRemark, "Not Interested", notInterestedOption),
                                      }
                                    : activeOutcomeCategory === "follow_up"
                                      ? {
                                          action: "follow_up" as const,
                                          callRemark: addOutcomeToRemark(callRemark, "Follow Up", followUpOption),
                                        }
                                      : {
                                          action: "follow_up" as const,
                                          callRemark: addOutcomeToRemark(callRemark, "Others", othersOption),
                                        }
                              submitAction(currentLead.id, {
                                ...payload,
                                actionAt: new Date().toISOString(),
                              })
                              setActiveOutcomeCategory(null)
                            }}
                          >
                            Submit
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setActiveOutcomeCategory(null)}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}
                    <div className="flex flex-wrap items-end gap-2">
                      <div className="w-full md:w-72 space-y-1">
                        <p className="text-xs text-muted-foreground">Reschedule date and time</p>
                        <Input type="datetime-local" value={rescheduleAt} onChange={(e) => setRescheduleAt(e.target.value)} />
                      </div>
                      <Button
                        variant="secondary"
                        onClick={() => {
                          if (!rescheduleAt) {
                            toast({
                              title: "Select reschedule time",
                              description: "Please choose date and time before rescheduling.",
                              variant: "destructive",
                            })
                            return
                          }
                          submitAction(
                            currentLead.id,
                            {
                              action: "rescheduled",
                              nextFollowUpAt: new Date(rescheduleAt).toISOString(),
                              callRemark: callRemark.trim() || undefined,
                              actionAt: new Date().toISOString(),
                            },
                          )
                        }}
                        className="gap-2"
                      >
                        Reschedule
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        )}
        </TabsContent>

        <TabsContent value="scheduled">
        <Card className="border-border/60 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Scheduled Follow Ups (Future)</CardTitle>
          </CardHeader>
          <CardContent>
            {scheduledLeads.length === 0 ? (
              <p className="text-sm text-muted-foreground">No scheduled follow-ups available.</p>
            ) : (
              <div className="space-y-2">
                {scheduledLeads.map((lead) => (
                  <div key={lead.id} className="rounded-md border border-border/70 p-3 text-sm flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                    <div>
                      <p className="font-medium">{lead.name} • {lead.mobile}</p>
                      <p className="text-xs text-muted-foreground">Follow-up: {formatDateTime(lead.nextFollowUpAt)}</p>
                    </div>
                    <div className="flex flex-col md:flex-row gap-2 md:items-end">
                      <div className="space-y-1">
                        <p className="text-[11px] text-muted-foreground">Modify follow-up</p>
                        <Input
                          type="datetime-local"
                          value={scheduledEditTimes[lead.id] ?? formatForDatetimeLocal(lead.nextFollowUpAt)}
                          onChange={(e) =>
                            setScheduledEditTimes((prev) => ({
                              ...prev,
                              [lead.id]: e.target.value,
                            }))
                          }
                          className="h-8"
                        />
                      </div>
                      <Button
                        size="sm"
                        onClick={() => {
                          const editedValue = scheduledEditTimes[lead.id] ?? formatForDatetimeLocal(lead.nextFollowUpAt)
                          if (!editedValue) {
                            toast({
                              title: "Select follow-up time",
                              description: "Please choose date and time before updating.",
                              variant: "destructive",
                            })
                            return
                          }
                          submitAction(lead.id, {
                            action: "rescheduled",
                            nextFollowUpAt: new Date(editedValue).toISOString(),
                            actionAt: new Date().toISOString(),
                          })
                        }}
                      >
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          submitAction(lead.id, {
                            action: "start",
                          })
                        }
                      >
                        Start Call
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          submitAction(lead.id, {
                            action: "called",
                            actionAt: new Date().toISOString(),
                          })
                        }
                      >
                        Called
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          submitAction(lead.id, {
                            action: "follow_up",
                            actionAt: new Date().toISOString(),
                          })
                        }
                      >
                        Follow Up
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() =>
                          submitAction(lead.id, {
                            action: "not_interested",
                            actionAt: new Date().toISOString(),
                          })
                        }
                      >
                        Not Interested
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => openNewQuotationWithPrefill(lead)}>
                        New Quotation
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        </TabsContent>

        <TabsContent value="recent">
        <Card className="border-border/60 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Recent Actions</CardTitle>
          </CardHeader>
          <CardContent>
            {recentActions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No action history available.</p>
            ) : (
              <div className="space-y-2">
                {recentActions.slice(0, 10).map((item) => (
                  <div key={item.id} className="rounded-md border border-border/70 p-3 text-sm">
                    <p className="font-medium">{item.name} • {item.mobile}</p>
                    <p className="text-xs text-muted-foreground">
                      Action: {item.action || "N/A"} • At: {formatDateTime(item.actionAt)}
                    </p>
                    {item.nextFollowUpAt ? (
                      <p className="text-xs text-muted-foreground">Next follow-up: {formatDateTime(item.nextFollowUpAt)}</p>
                    ) : null}
                    {item.callRemark ? <p className="text-xs mt-1">Remark: {item.callRemark}</p> : null}
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
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!item.leadId}
                        onClick={() => submitAction(item.leadId, { action: "start" })}
                      >
                        Start Call
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!item.leadId}
                        onClick={() =>
                          submitAction(item.leadId, {
                            action: "called",
                            callRemark: recentEditRemarks[actionRowKey(item)] ?? item.callRemark ?? undefined,
                            actionAt: new Date().toISOString(),
                          })
                        }
                      >
                        Called
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!item.leadId}
                        onClick={() =>
                          submitAction(item.leadId, {
                            action: "follow_up",
                            callRemark: recentEditRemarks[actionRowKey(item)] ?? item.callRemark ?? undefined,
                            actionAt: new Date().toISOString(),
                          })
                        }
                      >
                        Follow Up
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={!item.leadId}
                        onClick={() =>
                          submitAction(item.leadId, {
                            action: "not_interested",
                            callRemark: recentEditRemarks[actionRowKey(item)] ?? item.callRemark ?? undefined,
                            actionAt: new Date().toISOString(),
                          })
                        }
                      >
                        Not Interested
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={!item.leadId}
                        onClick={() => {
                          const editedTime = recentEditTimes[actionRowKey(item)] ?? formatForDatetimeLocal(item.nextFollowUpAt)
                          if (!editedTime) {
                            toast({
                              title: "Select follow-up time",
                              description: "Please choose date and time before rescheduling.",
                              variant: "destructive",
                            })
                            return
                          }
                          submitAction(item.leadId, {
                            action: "rescheduled",
                            nextFollowUpAt: new Date(editedTime).toISOString(),
                            callRemark: recentEditRemarks[actionRowKey(item)] ?? item.callRemark ?? undefined,
                            actionAt: new Date().toISOString(),
                          })
                        }}
                      >
                        Save Reschedule
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
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        </TabsContent>

        <TabsContent value="interested">
          <Card className="border-border/60 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Interested Data</CardTitle>
            </CardHeader>
            <CardContent>
              {interestedActions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No interested records available.</p>
              ) : (
                <div className="space-y-2">
                  {interestedActions.map((item) => (
                    <div key={item.id} className="rounded-md border border-border/70 p-3 text-sm">
                      <p className="font-medium">{item.name} • {item.mobile}</p>
                      <p className="text-xs text-muted-foreground">Action at: {formatDateTime(item.actionAt)}</p>
                      {item.callRemark ? <p className="text-xs mt-1">Remark: {item.callRemark}</p> : null}
                    </div>
                  ))}
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
