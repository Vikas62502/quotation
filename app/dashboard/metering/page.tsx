"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { SolarLogo } from "@/components/solar-logo"
import { LogOut, Gauge, Search, CalendarDays, CheckCircle2, ClipboardList, FileCheck } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { api, ApiError } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { formatPersonName } from "@/lib/name-display"
import {
  extractQuotationListFromApiResponse,
  getInstallationWorkflowStatus,
  isQuotationReleasedToInstaller,
} from "@/lib/operational-install-queue"

type MeteringStage = "processing" | "approved" | "mco"

type MeteringWorkflowItem = {
  discomName?: string
  meterType?: "solar" | "net" | "both"
  meterNo?: string
  solarMeterNo?: string
  netMeterNo?: string
  meterDocumentName?: string
  meterDocumentUrl?: string
}

type MeteringQuotation = {
  id: string
  status?: string
  customer?: { firstName?: string; lastName?: string; mobile?: string; address?: string; location?: string }
  dealer?: { firstName?: string; lastName?: string; mobile?: string; phone?: string }
  visitLocation?: string
  location?: string
  locationLink?: string
  createdAt?: string
  installationStatus?: string
  installation_status?: string
  pricing?: { subtotal?: number; totalAmount?: number; finalAmount?: number }
  subtotal?: number
  totalAmount?: number
  finalAmount?: number
  meteringStage?: string
  metering_status?: string
  mcoStatus?: string
  mco_status?: string
  meteringApprovedAt?: string
  metering_approved_at?: string
  mcoAt?: string
  mco_at?: string
  discomName?: string
  meterType?: "solar" | "net" | "both"
  meterNo?: string
  solarMeterNo?: string
  netMeterNo?: string
  meterDocumentUrl?: string
  meter_document_url?: string
  phase?: string
  products?: { phase?: string }
}

type MeteringModalDraft = {
  discomName: string
  meterType: "" | "solar" | "net" | "both"
  meterNo: string
  solarMeterNo: string
  netMeterNo: string
}

const quotationFromApiRecord = (raw: unknown): MeteringQuotation => {
  if (!raw || typeof raw !== "object") return raw as MeteringQuotation
  const r = raw as Record<string, any>
  const nested = r.quotation
  const flat =
    nested && typeof nested === "object" && !Array.isArray(nested)
      ? ({ ...(nested as Record<string, any>), ...r } as Record<string, any>)
      : { ...r }
  return flat as MeteringQuotation
}

const dedupeByQuotationId = (rows: MeteringQuotation[]) => {
  const map = new Map<string, MeteringQuotation>()
  rows.forEach((row) => {
    if (!row?.id) return
    if (!map.has(row.id)) map.set(row.id, row)
  })
  return Array.from(map.values())
}

function stageFromBackend(q: MeteringQuotation): MeteringStage | null {
  const raw = String(
    q.meteringStage ||
      q.metering_status ||
      q.mcoStatus ||
      q.mco_status ||
      q.installationStatus ||
      q.installation_status ||
      (q as any).meteringWorkflow ||
      "",
  ).toLowerCase()
  if (raw === "mco" || raw.includes("mco")) return "mco"
  if (raw === "metering_approved" || raw === "approved" || (raw.includes("approved") && !raw.includes("pending"))) return "approved"
  if (
    raw === "pending_metering" ||
    raw === "metering_in_progress" ||
    raw === "pending_installer" ||
    raw === "installer_in_progress" ||
    raw === "installer_approved" ||
    raw === "pending_baldev" ||
    raw === "baldev_approved" ||
    raw.includes("processing") ||
    raw.includes("pending")
  ) {
    return "processing"
  }
  return null
}

export default function MeteringDashboardPage() {
  const router = useRouter()
  const { isAuthenticated, role, meteringUser, logout } = useAuth()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<MeteringStage>("processing")
  const [searchByTab, setSearchByTab] = useState<Record<MeteringStage, string>>({
    processing: "",
    approved: "",
    mco: "",
  })
  const [quotations, setQuotations] = useState<MeteringQuotation[]>([])
  const [workflowMap, setWorkflowMap] = useState<Record<string, MeteringWorkflowItem>>({})
  const [meterDocumentByQuotation, setMeterDocumentByQuotation] = useState<Record<string, File | null>>({})
  const [meterDocumentPreviewByQuotation, setMeterDocumentPreviewByQuotation] = useState<Record<string, string>>({})
  const [detailsModalOpen, setDetailsModalOpen] = useState(false)
  const [detailsQuotationId, setDetailsQuotationId] = useState<string | null>(null)
  const [detailsDraft, setDetailsDraft] = useState<MeteringModalDraft>({
    discomName: "",
    meterType: "",
    meterNo: "",
    solarMeterNo: "",
    netMeterNo: "",
  })
  const [savingDetails, setSavingDetails] = useState(false)
  const useApi = process.env.NEXT_PUBLIC_USE_API !== "false"

  useEffect(() => {
    return () => {
      Object.values(meterDocumentPreviewByQuotation).forEach((url) => {
        try {
          URL.revokeObjectURL(url)
        } catch {}
      })
    }
  }, [meterDocumentPreviewByQuotation])

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/metering-login")
      return
    }
    if (role !== "metering") {
      router.push("/login")
    }
  }, [isAuthenticated, role, router])

  useEffect(() => {
    const load = async () => {
      setIsLoading(true)
      try {
        if (useApi) {
          const safeList = async (run: () => Promise<any>) => {
            try {
              return extractQuotationListFromApiResponse(await run())
            } catch {
              return [] as any[]
            }
          }

          const queueRows: any[] = []
          let list = await safeList(() => api.installer.getQueue({ status: "pending_installer", page: 1, limit: 1000 }))
          queueRows.push(...list)
          if (list.length === 0) {
            list = await safeList(() => api.installer.getQueue({ status: "approved", page: 1, limit: 1000 }))
            queueRows.push(...list)
          }

          // Always include admin-approved quotations explicitly for metering Processing tab visibility.
          const approvedRows = await safeList(() => api.quotations.getAll({ status: "approved", page: 1, limit: 1000 }))

          // Generic queue fallback for APIs that ignore status-specific filters.
          const broadQueueRows = await safeList(() => api.installer.getQueue({ page: 1, limit: 1000 }))

          const normalized = dedupeByQuotationId([...queueRows, ...approvedRows, ...broadQueueRows].map((q) => quotationFromApiRecord(q)))
          const released = normalized.filter((q) => isQuotationReleasedToInstaller(q as any) || String(q.status || "").toLowerCase() === "approved")
          // Keep full released/admin-approved queue visible in Processing by default.
          setQuotations(released)
        } else {
          setQuotations([])
        }
      } catch {
        toast({
          title: "Failed to load quotations",
          description: "Could not load quotations for the metering queue.",
          variant: "destructive",
        })
        setQuotations([])
      } finally {
        setIsLoading(false)
      }
    }
    void load()
  }, [toast, useApi])

  const getMeteringStage = (q: MeteringQuotation): MeteringStage => {
    const fromApi = stageFromBackend(q)
    if (fromApi) return fromApi
    return "processing"
  }

  const setStage = async (id: string, stage: MeteringStage) => {
    if (!useApi) return
    const action = stage === "approved" ? "approve" : stage === "mco" ? "send_to_mco" : "move_back"
    const currentRow = quotations.find((q) => q.id === id)
    const currentRawStatus = String(
      currentRow?.meteringStage ||
        currentRow?.metering_status ||
        currentRow?.installationStatus ||
        currentRow?.installation_status ||
        "",
    ).toLowerCase()
    try {
      let response: any
      // If backend reports a non-pending status, force-save approved directly for compatibility.
      if (stage === "approved" && currentRawStatus && !currentRawStatus.includes("pending")) {
        response = await api.metering.forceSetStatus(id, "metering_approved")
      } else
      try {
        response = await api.metering.updateStatus(id, action)
      } catch (error) {
        // Compatibility bridge: some backends require "start" before "approve".
        if (
          stage === "approved" &&
          error instanceof ApiError &&
          (error.code === "WF_003" || error.code === "HTTP_409") &&
          (currentRawStatus.includes("pending") || currentRawStatus.includes("installer"))
        ) {
          try {
            await api.metering.updateStatus(id, "start")
            response = await api.metering.updateStatus(id, "approve")
          } catch {
            response = await api.metering.forceSetStatus(id, "metering_approved")
          }
        } else if (
          stage === "approved" &&
          error instanceof ApiError &&
          (error.code === "WF_003" || error.code === "HTTP_409")
        ) {
          // Final fallback for strict stage validators: direct metering approved status patch.
          response = await api.metering.forceSetStatus(id, "metering_approved")
        } else {
          throw error
        }
      }
      const saved = response?.data || response || {}
      setQuotations((prev) =>
        prev.map((q) =>
          q.id === id
            ? {
                ...q,
                installationStatus:
                  saved.installationStatus ||
                  saved.installation_status ||
                  (stage === "approved" ? "metering_approved" : stage === "mco" ? "mco" : "pending_metering"),
                installation_status:
                  saved.installation_status ||
                  saved.installationStatus ||
                  (stage === "approved" ? "metering_approved" : stage === "mco" ? "mco" : "pending_metering"),
                meteringApprovedAt: saved.meteringApprovedAt || saved.metering_approved_at || (stage === "approved" ? new Date().toISOString() : q.meteringApprovedAt),
                metering_approved_at: saved.metering_approved_at || saved.meteringApprovedAt || (stage === "approved" ? new Date().toISOString() : q.metering_approved_at),
                mcoAt: saved.mcoAt || saved.mco_at || (stage === "mco" ? new Date().toISOString() : q.mcoAt),
                mco_at: saved.mco_at || saved.mcoAt || (stage === "mco" ? new Date().toISOString() : q.mco_at),
              }
            : q,
        ),
      )
    } catch (error) {
      toast({
        title: "Status update failed",
        description:
          error instanceof ApiError && error.code === "WF_003"
            ? "Backend blocked direct approve for current stage. Please ensure workflow reaches metering stage, or enable start->approve transition."
            : error instanceof Error
              ? error.message
              : "Could not update status in backend.",
        variant: "destructive",
      })
      return
    }
    toast({
      title: "Stage updated",
      description: `Quotation moved to ${stage === "mco" ? "MCO" : stage}.`,
    })
  }

  const updateWorkflowMeta = (id: string, patch: Partial<MeteringWorkflowItem>) => {
    setWorkflowMap((prev) => ({
      ...prev,
      [id]: {
        ...(prev[id] || {}),
        ...patch,
      },
    }))
  }

  const openDetailsModal = (quotationId: string) => {
    const saved = workflowMap[quotationId]
    const row = quotations.find((q) => q.id === quotationId) as any
    setDetailsQuotationId(quotationId)
    setDetailsDraft({
      // Prefer backend values so reopening always reflects persisted data.
      discomName: row?.discomName || row?.discom_name || saved?.discomName || "",
      meterType: row?.meterType || row?.meter_type || saved?.meterType || "",
      meterNo: row?.meterNo || row?.meter_no || saved?.meterNo || "",
      solarMeterNo: row?.solarMeterNo || row?.solar_meter_no || saved?.solarMeterNo || "",
      netMeterNo: row?.netMeterNo || row?.net_meter_no || saved?.netMeterNo || "",
    })
    if (!saved?.meterDocumentName || !saved?.meterDocumentUrl) {
      updateWorkflowMeta(quotationId, {
        meterDocumentName:
          saved?.meterDocumentName ||
          row?.meterDocumentName ||
          row?.meter_document_name ||
          "",
        meterDocumentUrl:
          saved?.meterDocumentUrl ||
          row?.meterDocumentUrl ||
          row?.meter_document_url ||
          "",
      })
    }
    setDetailsModalOpen(true)
  }

  const saveMeteringDetails = async () => {
    if (!detailsQuotationId) return

    const patch: Partial<MeteringWorkflowItem> = {
      discomName: detailsDraft.discomName.trim(),
      meterType: detailsDraft.meterType || undefined,
      meterNo: detailsDraft.meterNo.trim(),
      solarMeterNo: detailsDraft.solarMeterNo.trim(),
      netMeterNo: detailsDraft.netMeterNo.trim(),
    }

    updateWorkflowMeta(detailsQuotationId, patch)

    if (!useApi) return

    try {
      setSavingDetails(true)
      const response: any = await api.metering.saveDetails(detailsQuotationId, {
        discomName: patch.discomName,
        meterType: patch.meterType,
        meterNo: patch.meterNo,
        solarMeterNo: patch.solarMeterNo,
        netMeterNo: patch.netMeterNo,
      }, meterDocumentByQuotation[detailsQuotationId] || null)
      const saved = response?.data || response || {}
      const meterDocumentUrl =
        saved.meterDocumentUrl ||
        saved.meter_document_url ||
        saved.documents?.meterDocumentUrl ||
        saved.documents?.meter_document_url
      const meterDocumentName =
        saved.meterDocumentName ||
        saved.meter_document_name ||
        workflowMap[detailsQuotationId]?.meterDocumentName
      if (meterDocumentUrl || meterDocumentName) {
        updateWorkflowMeta(detailsQuotationId, {
          meterDocumentUrl: meterDocumentUrl || undefined,
          meterDocumentName: meterDocumentName || undefined,
        })
      }
      // Keep the modal state aligned with persisted backend data (public URL), not stale local blob/file.
      setMeterDocumentByQuotation((prev) => ({
        ...prev,
        [detailsQuotationId]: null,
      }))
      if (meterDocumentUrl) {
        setMeterDocumentPreviewByQuotation((prev) => ({
          ...prev,
          [detailsQuotationId]: meterDocumentUrl,
        }))
      }
      setQuotations((prev) =>
        prev.map((q) =>
          q.id === detailsQuotationId
            ? {
                ...q,
                discomName: patch.discomName || q.discomName,
                meterType: patch.meterType || q.meterType,
                meterNo: patch.meterNo || q.meterNo,
                solarMeterNo: patch.solarMeterNo || q.solarMeterNo,
                netMeterNo: patch.netMeterNo || q.netMeterNo,
                meterDocumentUrl: meterDocumentUrl || q.meterDocumentUrl,
                meter_document_url: meterDocumentUrl || q.meter_document_url,
              }
            : q,
        ),
      )
      toast({ title: "Saved", description: "Metering details saved to backend." })
      setDetailsModalOpen(false)
    } catch (error) {
      toast({
        title: "Save failed",
        description: error instanceof Error ? error.message : "Could not save metering details to backend.",
        variant: "destructive",
      })
    } finally {
      setSavingDetails(false)
    }
  }

  const getAdminApprovedDate = (q: MeteringQuotation) =>
    (q as any).approvedAt || (q as any).approvedDate || (q as any).statusUpdatedAt || q.createdAt

  const getDisplayedApprovedDate = (q: MeteringQuotation, tab: MeteringStage) =>
    tab === "approved"
      ? (q as any).meteringApprovedAt || (q as any).metering_approved_at || getAdminApprovedDate(q)
      : tab === "mco"
        ? (q as any).mcoAt || (q as any).mco_at || (q as any).meteringApprovedAt || (q as any).metering_approved_at || getAdminApprovedDate(q)
        : getAdminApprovedDate(q)

  const getPhaseLabel = (q: MeteringQuotation) => {
    const raw = String(q.phase || q.products?.phase || (q as any).systemPhase || "").toLowerCase().trim()
    if (!raw) return "N/A"
    if (raw.includes("3") || raw.includes("three")) return "Three Phase"
    if (raw.includes("1") || raw.includes("single")) return "Single Phase"
    return raw
  }

  const hasRequiredMeteringDetails = (quotationId: string) => {
    const details = workflowMap[quotationId]
    const q = quotations.find((row) => row.id === quotationId) as any
    if (!details && !q) return false

    const discomOk = ((details?.discomName || q?.discomName || "").trim().length > 0)
    const meterType = (details?.meterType || q?.meterType || q?.meter_type) as MeteringWorkflowItem["meterType"]
    const meterTypeOk = meterType === "solar" || meterType === "net" || meterType === "both"
    const meterNoOk =
      meterType === "both"
        ? ((details?.solarMeterNo || q?.solarMeterNo || q?.solar_meter_no || "").trim().length > 0 &&
           (details?.netMeterNo || q?.netMeterNo || q?.net_meter_no || "").trim().length > 0)
        : ((details?.meterNo || q?.meterNo || q?.meter_no || "").trim().length > 0)
    const meterDocOk =
      !!meterDocumentByQuotation[quotationId] ||
      ((details?.meterDocumentName || "").trim().length > 0) ||
      ((details?.meterDocumentUrl || "").trim().length > 0) ||
      ((q?.meterDocumentUrl || q?.meter_document_url || "").trim().length > 0)

    return discomOk && meterTypeOk && meterNoOk && meterDocOk
  }

  const toTimestamp = (date?: string) => {
    if (!date) return 0
    const parsed = new Date(date).getTime()
    return Number.isNaN(parsed) ? 0 : parsed
  }

  const filterSearch = (list: MeteringQuotation[], search: string) =>
    list.filter((q) => {
      const normalizedSearch = search.trim().toLowerCase()
      if (!normalizedSearch) return true
      const fullName = formatPersonName(q.customer?.firstName, q.customer?.lastName, "").toLowerCase()
      return (
        fullName.includes(normalizedSearch) ||
        (q.customer?.mobile || "").includes(normalizedSearch) ||
        q.id.toLowerCase().includes(normalizedSearch)
      )
    })

  const processingList = useMemo(
    () =>
      filterSearch(quotations.filter((q) => getMeteringStage(q) === "processing"), searchByTab.processing).sort(
        (a, b) => toTimestamp(getAdminApprovedDate(a)) - toTimestamp(getAdminApprovedDate(b)),
      ),
    [quotations, searchByTab.processing],
  )

  const approvedList = useMemo(
    () =>
      filterSearch(quotations.filter((q) => getMeteringStage(q) === "approved"), searchByTab.approved).sort((a, b) => {
        const aDate = (a as any).meteringApprovedAt || (a as any).metering_approved_at || getAdminApprovedDate(a)
        const bDate = (b as any).meteringApprovedAt || (b as any).metering_approved_at || getAdminApprovedDate(b)
        return toTimestamp(bDate) - toTimestamp(aDate)
      }),
    [quotations, searchByTab.approved],
  )

  const mcoList = useMemo(
    () =>
      filterSearch(quotations.filter((q) => getMeteringStage(q) === "mco"), searchByTab.mco).sort((a, b) => {
        const aDate = (a as any).mcoAt || (a as any).mco_at || getAdminApprovedDate(a)
        const bDate = (b as any).mcoAt || (b as any).mco_at || getAdminApprovedDate(b)
        return toTimestamp(bDate) - toTimestamp(aDate)
      }),
    [quotations, searchByTab.mco],
  )

  const renderRow = (q: MeteringQuotation, tab: MeteringStage) => (
    <Card key={q.id} className="border-border/60 bg-gradient-to-r from-card to-muted/20 shadow-sm">
      <CardContent className="p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-8 gap-1">
          <div className="xl:col-span-2 min-w-0">
            <p className="text-sm font-semibold leading-tight">
              {formatPersonName(q.customer?.firstName, q.customer?.lastName, "Unknown")}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {q.customer?.mobile || "No mobile"} • {q.id}
            </p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              {tab === "mco" ? "MCO Date" : "Approved date"}
            </p>
            <p className="text-xs font-medium flex items-center gap-1">
              <CalendarDays className="w-3 h-3 text-muted-foreground" />
              {getDisplayedApprovedDate(q, tab)
                ? new Date(getDisplayedApprovedDate(q, tab) as string).toLocaleDateString("en-IN")
                : "N/A"}
            </p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Phase</p>
            <p className="text-xs font-medium">{getPhaseLabel(q)}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Dealer</p>
            <p className="text-xs font-medium">
              {formatPersonName(q.dealer?.firstName, q.dealer?.lastName, "N/A")}
            </p>
            <p className="text-[11px] text-muted-foreground">{q.dealer?.mobile || q.dealer?.phone || "No contact"}</p>
          </div>
          <div className="xl:col-span-2 min-w-0">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Customer Address / Visitor Location</p>
            <p className="text-xs font-medium truncate">
              {q.visitLocation || q.location || q.customer?.address || q.customer?.location || "N/A"}
            </p>
          </div>
          <div>
            <Badge variant="outline" className="text-xs capitalize">
              {getInstallationWorkflowStatus(q as any) || "—"}
            </Badge>
          </div>
          <div className="md:col-span-2 xl:col-span-8 w-full flex flex-wrap gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => openDetailsModal(q.id)}>
              Metering Details
            </Button>
            {tab === "processing" && hasRequiredMeteringDetails(q.id) && (
              <Button
                size="sm"
                onClick={() => void setStage(q.id, "approved")}
              >
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                Move to Approved
              </Button>
            )}
            {tab === "approved" && (
              <>
                <Button variant="outline" size="sm" onClick={() => void setStage(q.id, "processing")}>
                  Back to Processing
                </Button>
                <Button size="sm" onClick={() => void setStage(q.id, "mco")}>
                  <FileCheck className="w-3.5 h-3.5 mr-1" />
                  Move to MCO
                </Button>
              </>
            )}
            {tab === "mco" && (
              <Button variant="outline" size="sm" onClick={() => void setStage(q.id, "approved")}>
                Back to Approved
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <button onClick={() => router.push("/")} className="flex items-center">
            <SolarLogo size="md" />
          </button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              logout()
              router.push("/")
            }}
            className="gap-2"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <Gauge className="w-4 h-4 text-primary" />
          </div>
          <h1 className="text-xl font-semibold">Metering Dashboard</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Welcome, {meteringUser?.firstName || "Metering"}. Track jobs across Processing, Approved, and MCO. Metering details and stage
          transitions are persisted via backend metering workflow APIs.
        </p>

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as MeteringStage)}>
            <TabsList className="h-auto flex-wrap justify-start">
              <TabsTrigger value="processing" className="h-10 px-4 text-sm gap-2">
                <ClipboardList className="w-3.5 h-3.5" />
                Processing ({processingList.length})
              </TabsTrigger>
              <TabsTrigger value="approved" className="h-10 px-4 text-sm gap-2">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Approved ({approvedList.length})
              </TabsTrigger>
              <TabsTrigger value="mco" className="h-10 px-4 text-sm gap-2">
                <FileCheck className="w-3.5 h-3.5" />
                MCO ({mcoList.length})
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="relative w-full md:w-80">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              value={searchByTab[activeTab]}
              onChange={(e) =>
                setSearchByTab((prev) => ({
                  ...prev,
                  [activeTab]: e.target.value,
                }))
              }
              placeholder={`Search in ${activeTab} by customer, mobile, quotation id`}
              className="h-9 pl-8 text-sm"
            />
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as MeteringStage)}>
          <TabsList className="hidden">
            <TabsTrigger value="processing">p</TabsTrigger>
            <TabsTrigger value="approved">a</TabsTrigger>
            <TabsTrigger value="mco">m</TabsTrigger>
          </TabsList>
          <TabsContent value="processing" className="space-y-3 pt-2">
            {isLoading ? (
              <Card>
                <CardContent className="py-8 text-sm text-muted-foreground">Loading metering queue…</CardContent>
              </Card>
            ) : processingList.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-sm text-muted-foreground">No items in Processing.</CardContent>
              </Card>
            ) : (
              processingList.map((q) => renderRow(q, "processing"))
            )}
          </TabsContent>
          <TabsContent value="approved" className="space-y-3 pt-2">
            {isLoading ? (
              <Card>
                <CardContent className="py-8 text-sm text-muted-foreground">Loading metering queue…</CardContent>
              </Card>
            ) : approvedList.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-sm text-muted-foreground">No items in Approved.</CardContent>
              </Card>
            ) : (
              approvedList.map((q) => renderRow(q, "approved"))
            )}
          </TabsContent>
          <TabsContent value="mco" className="space-y-3 pt-2">
            {isLoading ? (
              <Card>
                <CardContent className="py-8 text-sm text-muted-foreground">Loading metering queue…</CardContent>
              </Card>
            ) : mcoList.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-sm text-muted-foreground">No items in MCO.</CardContent>
              </Card>
            ) : (
              mcoList.map((q) => renderRow(q, "mco"))
            )}
          </TabsContent>
        </Tabs>

        <Dialog open={detailsModalOpen} onOpenChange={setDetailsModalOpen}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>Metering Details</DialogTitle>
            </DialogHeader>
            <p className="text-xs text-muted-foreground">
              Data is saved to backend database and S3. Local/session storage is not used for persistence.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">DISCOM Name</p>
                <Input
                  value={detailsDraft.discomName}
                  onChange={(e) => setDetailsDraft((prev) => ({ ...prev, discomName: e.target.value }))}
                  placeholder="Enter DISCOM name"
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Meter Type</p>
                <select
                  value={detailsDraft.meterType}
                  onChange={(e) =>
                    setDetailsDraft((prev) => ({
                      ...prev,
                      meterType: (e.target.value || "") as MeteringModalDraft["meterType"],
                    }))
                  }
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">Select meter type</option>
                  <option value="solar">Solar Meter</option>
                  <option value="net">Net Meter</option>
                  <option value="both">Both</option>
                </select>
              </div>
              {detailsDraft.meterType === "both" ? (
                <>
                  <div className="space-y-1">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Solar Meter No</p>
                    <Input
                      value={detailsDraft.solarMeterNo}
                      onChange={(e) => setDetailsDraft((prev) => ({ ...prev, solarMeterNo: e.target.value }))}
                      placeholder="Enter solar meter number"
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Net Meter No</p>
                    <Input
                      value={detailsDraft.netMeterNo}
                      onChange={(e) => setDetailsDraft((prev) => ({ ...prev, netMeterNo: e.target.value }))}
                      placeholder="Enter net meter number"
                      className="h-9 text-sm"
                    />
                  </div>
                </>
              ) : (
                <div className="space-y-1 md:col-span-2">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    {detailsDraft.meterType === "solar"
                      ? "Solar Meter No"
                      : detailsDraft.meterType === "net"
                        ? "Net Meter No"
                        : "Meter No"}
                  </p>
                  <Input
                    value={detailsDraft.meterNo}
                    onChange={(e) => setDetailsDraft((prev) => ({ ...prev, meterNo: e.target.value }))}
                    placeholder="Enter meter number"
                    className="h-9 text-sm"
                  />
                </div>
              )}
              <div className="space-y-1 md:col-span-2">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Meter Document Image</p>
                <Input
                  type="file"
                  accept="image/*"
                  className="h-9 text-sm"
                  onChange={(e) => {
                    if (!detailsQuotationId) return
                    const file = e.target.files?.[0] || null
                    setMeterDocumentByQuotation((prev) => ({ ...prev, [detailsQuotationId]: file }))
                    setMeterDocumentPreviewByQuotation((prev) => {
                      const oldUrl = prev[detailsQuotationId]
                      if (oldUrl) {
                        try {
                          URL.revokeObjectURL(oldUrl)
                        } catch {}
                      }
                      return {
                        ...prev,
                        [detailsQuotationId]: file ? URL.createObjectURL(file) : "",
                      }
                    })
                    updateWorkflowMeta(detailsQuotationId, { meterDocumentName: file?.name || "" })
                  }}
                />
                <p className="text-[11px] text-muted-foreground truncate">
                  {(() => {
                    if (!detailsQuotationId) return "No file selected"
                    const row = quotations.find((q) => q.id === detailsQuotationId) as any
                    return (
                      meterDocumentByQuotation[detailsQuotationId]?.name ||
                      workflowMap[detailsQuotationId]?.meterDocumentName ||
                      row?.meterDocumentName ||
                      row?.meter_document_name ||
                      "No file selected"
                    )
                  })()}
                </p>
                {(() => {
                  if (!detailsQuotationId) return null
                  const row = quotations.find((q) => q.id === detailsQuotationId) as any
                  const previewSrc =
                    meterDocumentPreviewByQuotation[detailsQuotationId] ||
                    workflowMap[detailsQuotationId]?.meterDocumentUrl ||
                    row?.meterDocumentUrl ||
                    row?.meter_document_url
                  const publicUrl =
                    workflowMap[detailsQuotationId]?.meterDocumentUrl ||
                    row?.meterDocumentUrl ||
                    row?.meter_document_url
                  if (!previewSrc) return null
                  return (
                    <div className="space-y-1">
                      <img src={previewSrc} alt="Meter document preview" className="h-24 w-auto rounded border object-cover" />
                      {publicUrl && (
                        <a href={publicUrl} target="_blank" rel="noreferrer" className="text-xs underline text-primary break-all">
                          {publicUrl}
                        </a>
                      )}
                    </div>
                  )
                })()}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDetailsModalOpen(false)} disabled={savingDetails}>
                Cancel
              </Button>
              <Button onClick={saveMeteringDetails} disabled={savingDetails || !detailsQuotationId}>
                {savingDetails ? "Saving..." : "Save Details"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  )
}
