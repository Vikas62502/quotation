"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { SolarLogo } from "@/components/solar-logo"
import { LogOut, Wrench, CheckCircle2, Clock3, Upload, Search, CalendarDays } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { api } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import { formatPersonName } from "@/lib/name-display"

type InstallerQuotation = {
  id: string
  customer?: {
    firstName?: string
    lastName?: string
    mobile?: string
    email?: string
    address?: string
    location?: string
    locationLink?: string
  }
  dealer?: { firstName?: string; lastName?: string; mobile?: string }
  visitors?: Array<{ visitorName?: string; name?: string; mobile?: string }>
  otherVisitors?: Array<{ visitorName?: string; name?: string; mobile?: string }>
  assignedVisitors?: Array<{ visitorName?: string; name?: string; mobile?: string }>
  visitLocation?: string
  location?: string
  locationLink?: string
  products?: Record<string, any>
  createdAt?: string
  pricing?: { subtotal?: number; totalAmount?: number; finalAmount?: number }
  subtotal?: number
  totalAmount?: number
  finalAmount?: number
  installationStatus?: string
  installationReadyForInstaller?: boolean
  installationReleasedAt?: string
  installation_ready_for_installer?: boolean
  installation_released_at?: string
  readyForInstallation?: boolean
  ready_for_installation?: boolean
  releaseToInstaller?: boolean
  length?: number
  width?: number
  height?: number
  siteLength?: number
  siteWidth?: number
  siteHeight?: number
  visitLength?: number
  visitWidth?: number
  visitHeight?: number
}

type InstallerWorkflowItem = {
  status: "pending" | "inprogress" | "approved"
  notes?: string
  imageNames?: string[]
  updatedAt: string
}

const INSTALLATION_IMAGE_FIELDS = [
  { key: "homeFrontPhoto", label: "Front Photo of Home" },
  { key: "homeWithPersonPhoto", label: "Front Photo of Home with person" },
  { key: "inverterWithCustomerPhoto", label: "Inverter Photo with customer" },
  { key: "plantWithCustomerPhoto", label: "Plant photo with Customer" },
  { key: "inverterSerialNumberPhoto", label: "Inverter Photo with Serial No" },
  { key: "panelSerialNumberPhoto", label: "Panels photo with Serial No" },
  { key: "geoTagPlantPhoto", label: "GeoTag photo with plants" },
  { key: "otherImages", label: "Others Images", multiple: true, required: false },
] as const

type InstallationImageFieldKey = (typeof INSTALLATION_IMAGE_FIELDS)[number]["key"]

const INSTALLER_RELEASE_MAP_KEY = "installerReleaseMap"

const isReleasedForInstaller = (q: InstallerQuotation, localReleaseMap?: Record<string, any>) =>
  q.installationReadyForInstaller === true ||
  q.installation_ready_for_installer === true ||
  q.readyForInstallation === true ||
  q.ready_for_installation === true ||
  q.releaseToInstaller === true ||
  localReleaseMap?.[q.id]?.installationReadyForInstaller === true

export default function InstallerDashboardPage() {
  const router = useRouter()
  const { isAuthenticated, role, installer, logout } = useAuth()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("pending")
  const [searchTerm, setSearchTerm] = useState("")
  const [quotations, setQuotations] = useState<InstallerQuotation[]>([])
  const [expandedQuotationId, setExpandedQuotationId] = useState<string | null>(null)
  const [uploadNotes, setUploadNotes] = useState<Record<string, string>>({})
  const [uploadFilesByQuotation, setUploadFilesByQuotation] = useState<Record<string, Partial<Record<InstallationImageFieldKey, File[]>>>>({})
  const [piUploadByQuotation, setPiUploadByQuotation] = useState<Record<string, File | null>>({})
  const [extraExpensesByQuotation, setExtraExpensesByQuotation] = useState<Record<string, string>>({})
  const [dimensionsByQuotation, setDimensionsByQuotation] = useState<
    Record<string, { length: string; width: string; height: string }>
  >({})
  const [savingId, setSavingId] = useState<string | null>(null)
  const [loadingDetailsForId, setLoadingDetailsForId] = useState<string | null>(null)
  const [workflowMap, setWorkflowMap] = useState<Record<string, InstallerWorkflowItem>>({})
  const useApi = process.env.NEXT_PUBLIC_USE_API !== "false"

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/installer-login")
      return
    }
    if (role !== "installer") {
      router.push("/login")
    }
  }, [isAuthenticated, role, router])

  useEffect(() => {
    const stored = localStorage.getItem("installerWorkflowMap")
    if (stored) {
      try {
        setWorkflowMap(JSON.parse(stored))
      } catch {
        setWorkflowMap({})
      }
    }
  }, [])

  useEffect(() => {
    localStorage.setItem("installerWorkflowMap", JSON.stringify(workflowMap))
  }, [workflowMap])

  useEffect(() => {
    const loadApprovedFromAdmin = async () => {
      setIsLoading(true)
      let localReleaseMap: Record<string, any> = {}
      try {
        const stored = localStorage.getItem(INSTALLER_RELEASE_MAP_KEY)
        localReleaseMap = stored ? JSON.parse(stored) : {}
      } catch {
        localReleaseMap = {}
      }
      try {
        if (useApi) {
          const response = await api.quotations.getAll({ status: "approved", page: 1, limit: 1000 })
          let list: any[] = []
          if (Array.isArray(response)) {
            list = response
          } else if (Array.isArray(response?.quotations)) {
            list = response.quotations
          } else if (Array.isArray(response?.data?.quotations)) {
            list = response.data.quotations
          }
          setQuotations(list.filter((q) => isReleasedForInstaller(q, localReleaseMap)))
        } else {
          const localQuotations = JSON.parse(localStorage.getItem("quotations") || "[]")
          const approved = localQuotations.filter(
            (q: InstallerQuotation & { status?: string }) =>
              String(q.status || "").toLowerCase() === "approved" && isReleasedForInstaller(q, localReleaseMap),
          )
          setQuotations(approved)
        }
      } catch {
        toast({
          title: "Failed to load quotations",
          description: "Could not load admin-approved quotations for installer workflow.",
          variant: "destructive",
        })
        setQuotations([])
      } finally {
        setIsLoading(false)
      }
    }
    loadApprovedFromAdmin()
  }, [toast, useApi])

  const getQuotationAmount = (q: InstallerQuotation) =>
    Math.abs(q.pricing?.subtotal ?? q.subtotal ?? q.totalAmount ?? q.finalAmount ?? q.pricing?.totalAmount ?? 0)

  const getAdminApprovedDate = (q: InstallerQuotation) =>
    (q as any).approvedAt || (q as any).approvedDate || (q as any).statusUpdatedAt || q.createdAt

  const toTimestamp = (date?: string) => {
    if (!date) return 0
    const parsed = new Date(date).getTime()
    return Number.isNaN(parsed) ? 0 : parsed
  }

  const getInstallerStatus = (q: InstallerQuotation): "pending" | "inprogress" | "approved" => {
    const backendStatus = String(q.installationStatus || "").toLowerCase()
    if (
      backendStatus === "installer_approved" ||
      backendStatus === "pending_baldev" ||
      backendStatus === "baldev_approved" ||
      backendStatus === "completed"
    ) {
      return "approved"
    }
    if (backendStatus === "installer_in_progress" || backendStatus === "in_progress") {
      return "inprogress"
    }
    return workflowMap[q.id]?.status || "pending"
  }

  const normalizedSearch = searchTerm.trim().toLowerCase()

  const pendingQuotations = useMemo(() => {
    return quotations
      .filter((q) => getInstallerStatus(q) !== "approved")
      .filter((q) => {
        if (!normalizedSearch) return true
        const fullName = formatPersonName(q.customer?.firstName, q.customer?.lastName, "").toLowerCase()
        return (
          fullName.includes(normalizedSearch) ||
          (q.customer?.mobile || "").includes(normalizedSearch) ||
          q.id.toLowerCase().includes(normalizedSearch)
        )
      })
      .sort((a, b) => toTimestamp(getAdminApprovedDate(a)) - toTimestamp(getAdminApprovedDate(b)))
  }, [quotations, workflowMap, normalizedSearch])

  const approvedQuotations = useMemo(() => {
    return quotations
      .filter((q) => getInstallerStatus(q) === "approved")
      .filter((q) => {
        if (!normalizedSearch) return true
        const fullName = formatPersonName(q.customer?.firstName, q.customer?.lastName, "").toLowerCase()
        return (
          fullName.includes(normalizedSearch) ||
          (q.customer?.mobile || "").includes(normalizedSearch) ||
          q.id.toLowerCase().includes(normalizedSearch)
        )
      })
      .sort((a, b) => {
        const aDate = (a as any).installerApprovedAt || workflowMap[a.id]?.updatedAt || getAdminApprovedDate(a)
        const bDate = (b as any).installerApprovedAt || workflowMap[b.id]?.updatedAt || getAdminApprovedDate(b)
        return toTimestamp(aDate) - toTimestamp(bDate)
      })
  }, [quotations, workflowMap, normalizedSearch])

  const pickDimensionValue = (q: InstallerQuotation, keys: Array<keyof InstallerQuotation>) => {
    for (const key of keys) {
      const val = q[key]
      const n = Number(val)
      if (Number.isFinite(n) && n > 0) return String(n)
    }
    return ""
  }

  const getProductSpecRows = (q: InstallerQuotation) => {
    const p = q.products || {}
    const systemType = String(p.systemType || "").toLowerCase()
    const panelConfig = (() => {
      if (systemType === "both") {
        const dcr =
          p.dcrPanelSize && p.dcrPanelQuantity
            ? `DCR: ${p.dcrPanelBrand ? `${p.dcrPanelBrand} ` : ""}${p.dcrPanelSize} x ${p.dcrPanelQuantity}`
            : ""
        const nonDcr =
          p.nonDcrPanelSize && p.nonDcrPanelQuantity
            ? `NON-DCR: ${p.nonDcrPanelBrand ? `${p.nonDcrPanelBrand} ` : ""}${p.nonDcrPanelSize} x ${p.nonDcrPanelQuantity}`
            : ""
        return [dcr, nonDcr].filter(Boolean).join(" | ")
      }
      if (systemType === "customize" && Array.isArray(p.customPanels) && p.customPanels.length > 0) {
        return p.customPanels
          .map((cp: any) => `${cp.brand ? `${cp.brand} ` : ""}${cp.size || ""}W x ${cp.quantity || 0}`)
          .join(" | ")
      }
      if (p.panelSize && p.panelQuantity) {
        return `${p.panelBrand ? `${p.panelBrand} ` : ""}${p.panelSize} x ${p.panelQuantity}`
      }
      return ""
    })()

    const inverterConfig = [p.inverterBrand, p.inverterSize, p.inverterType].filter(Boolean).join(" - ")

    const batteryConfig = (() => {
      const parts = [p.batteryCapacity, p.batteryPrice ? `₹${p.batteryPrice}` : undefined].filter(Boolean)
      return parts.join(" - ")
    })()

    return [
      { label: "System Type", value: p.systemType },
      { label: "Panel Configuration", value: panelConfig },
      { label: "Inverter", value: inverterConfig },
      { label: "Panel Brand", value: p.panelBrand || p.dcrPanelBrand || p.nonDcrPanelBrand },
      { label: "Panel Size", value: p.panelSize || p.dcrPanelSize || p.nonDcrPanelSize },
      { label: "Panel Quantity", value: p.panelQuantity || p.dcrPanelQuantity || p.nonDcrPanelQuantity },
      { label: "Inverter Type", value: p.inverterType },
      { label: "Inverter Brand", value: p.inverterBrand },
      { label: "Inverter Size", value: p.inverterSize },
      { label: "Phase", value: p.phase },
      { label: "Hybrid Inverter", value: p.hybridInverter },
      { label: "Battery", value: batteryConfig },
      { label: "Battery Capacity", value: p.batteryCapacity },
      { label: "Battery Price", value: p.batteryPrice ? `₹${p.batteryPrice}` : undefined },
      { label: "Structure", value: [p.structureType, p.structureSize].filter(Boolean).join(" - ") },
      { label: "Meter", value: p.meterBrand },
      { label: "AC Cable", value: [p.acCableBrand, p.acCableSize].filter(Boolean).join(" - ") },
      { label: "DC Cable", value: [p.dcCableBrand, p.dcCableSize].filter(Boolean).join(" - ") },
      { label: "ACDB", value: p.acdb },
      { label: "DCDB", value: p.dcdb },
    ].filter((row) => row.value !== undefined && row.value !== null && String(row.value).trim() !== "")
  }

  const getCustomerInfoRows = (q: InstallerQuotation) => {
    const customerName = formatPersonName(q.customer?.firstName, q.customer?.lastName, "Unknown")
    return [
      { label: "Customer", value: customerName },
      { label: "Mobile", value: q.customer?.mobile },
      { label: "Email", value: q.customer?.email },
      { label: "Address", value: q.customer?.address || q.customer?.location },
      { label: "Agent", value: q.dealer ? formatPersonName(q.dealer.firstName, q.dealer.lastName, "") : undefined },
      { label: "Agent Mobile", value: q.dealer?.mobile },
    ].filter((row) => row.value !== undefined && row.value !== null && String(row.value).trim() !== "")
  }

  const getVisitorDetailsRows = (q: InstallerQuotation) => {
    const visitors = (q.visitors || q.otherVisitors || q.assignedVisitors || [])
      .map((v) => String(v.visitorName || v.name || "").trim())
      .filter((name) => name.length > 0)
    const location = q.visitLocation || q.location || q.customer?.location || q.customer?.address
    const locationLink = q.locationLink || q.customer?.locationLink
    return [
      { label: "Visit Location", value: location },
      { label: "Location Link", value: locationLink },
      { label: "Visitors", value: visitors.length > 0 ? visitors.join(", ") : undefined },
    ].filter((row) => row.value !== undefined && row.value !== null && String(row.value).trim() !== "")
  }

  const ensureInstallerDraftData = (quotation: InstallerQuotation) => {
    setDimensionsByQuotation((prev) => {
      if (prev[quotation.id]) return prev
      return {
        ...prev,
        [quotation.id]: {
          length: pickDimensionValue(quotation, ["length", "siteLength", "visitLength"]),
          width: pickDimensionValue(quotation, ["width", "siteWidth", "visitWidth"]),
          height: pickDimensionValue(quotation, ["height", "siteHeight", "visitHeight"]),
        },
      }
    })
    setExtraExpensesByQuotation((prev) => (prev[quotation.id] !== undefined ? prev : { ...prev, [quotation.id]: "" }))
    setUploadFilesByQuotation((prev) => (prev[quotation.id] ? prev : { ...prev, [quotation.id]: {} }))
  }

  const hydrateQuotationDetails = async (quotation: InstallerQuotation) => {
    if (!useApi || !quotation?.id) return
    setLoadingDetailsForId(quotation.id)
    try {
      const full = await api.quotations.getById(quotation.id)
      if (!full || typeof full !== "object") return

      let visitDetails: any = null
      try {
        const visitResp = await api.visits.getByQuotation(quotation.id)
        const visitList = Array.isArray((visitResp as any)?.visits)
          ? (visitResp as any).visits
          : Array.isArray(visitResp)
            ? (visitResp as any[])
            : []
        visitDetails = visitList[0] || null
      } catch {
        visitDetails = null
      }

      setQuotations((prev) =>
        prev.map((item) => {
          if (item.id !== quotation.id) return item
          return {
            ...item,
            ...full,
            customer: {
              ...(item.customer || {}),
              ...((full as any).customer || {}),
            },
            dealer: (full as any).dealer || item.dealer,
            products: (full as any).products || item.products,
            visitors:
              (visitDetails?.visitors as any[]) ||
              (visitDetails?.otherVisitors as any[]) ||
              item.visitors ||
              item.otherVisitors,
            otherVisitors: (visitDetails?.otherVisitors as any[]) || item.otherVisitors,
            assignedVisitors: (visitDetails?.assignedVisitors as any[]) || item.assignedVisitors,
            visitLocation: visitDetails?.location || visitDetails?.visitLocation || item.visitLocation,
            location: visitDetails?.location || item.location,
            locationLink: visitDetails?.locationLink || item.locationLink,
            length: visitDetails?.length ?? item.length,
            width: visitDetails?.width ?? item.width,
            height: visitDetails?.height ?? item.height,
            siteLength: visitDetails?.siteLength ?? item.siteLength,
            siteWidth: visitDetails?.siteWidth ?? item.siteWidth,
            siteHeight: visitDetails?.siteHeight ?? item.siteHeight,
          } as InstallerQuotation
        }),
      )
    } catch (error) {
      console.warn("Could not hydrate installer quotation details:", error)
    } finally {
      setLoadingDetailsForId((current) => (current === quotation.id ? null : current))
    }
  }

  const setInProgress = (quotation: InstallerQuotation) => {
    const quotationId = quotation.id
    setWorkflowMap((prev) => ({
      ...prev,
      [quotationId]: {
        ...(prev[quotationId] || {}),
        status: "inprogress",
        updatedAt: new Date().toISOString(),
      },
    }))
    ensureInstallerDraftData(quotation)
    setExpandedQuotationId(quotationId)
    void hydrateQuotationDetails(quotation)
  }

  const handleApproveInstallation = async (quotation: InstallerQuotation) => {
    const filesByField = uploadFilesByQuotation[quotation.id] || {}
    const requiredFields = INSTALLATION_IMAGE_FIELDS.filter((field) => field.required !== false)
    const files = INSTALLATION_IMAGE_FIELDS
      .flatMap((field) => filesByField[field.key] || [])
      .filter((file): file is File => file instanceof File)
    const notes = uploadNotes[quotation.id] || ""
    const dimensions = dimensionsByQuotation[quotation.id] || { length: "", width: "", height: "" }
    const piUpload = piUploadByQuotation[quotation.id]
    const extraExpenses = extraExpensesByQuotation[quotation.id] || ""

    const missingFields = requiredFields.filter((field) => !(filesByField[field.key] && filesByField[field.key]!.length > 0))
    if (missingFields.length > 0) {
      toast({
        title: "Images required",
        description: `Please upload all required images. Missing: ${missingFields.map((f) => f.label).join(", ")}.`,
        variant: "destructive",
      })
      return
    }
    if (!dimensions.length || !dimensions.width || !dimensions.height) {
      toast({
        title: "Dimensions required",
        description: "Please enter length, width and height.",
        variant: "destructive",
      })
      return
    }

    setSavingId(quotation.id)
    let apiSaved = false
    try {
      if (useApi) {
        const formData = new FormData()
        INSTALLATION_IMAGE_FIELDS.forEach((field) => {
          const fieldFiles = filesByField[field.key] || []
          fieldFiles.forEach((file) => {
            if (!(file instanceof File)) return
            formData.append("installerCompletionImages", file)
            formData.append(field.key, file)
          })
        })
        if (piUpload instanceof File) {
          formData.append("piUpload", piUpload)
        }
        if (extraExpenses.trim() !== "") {
          formData.append("extraExpenses", extraExpenses.trim())
        }
        formData.append("siteLength", dimensions.length)
        formData.append("siteWidth", dimensions.width)
        formData.append("siteHeight", dimensions.height)
        formData.append("installerRemarks", notes)
        formData.append("installationStatus", "installer_approved")
        await api.installer.uploadCompletionDocuments(quotation.id, formData)
        apiSaved = true
      }
    } catch {
      apiSaved = false
    } finally {
      setWorkflowMap((prev) => ({
        ...prev,
        [quotation.id]: {
          status: "approved",
          notes,
          imageNames: [
            ...files.map((f) => f.name),
            ...(piUpload instanceof File ? [piUpload.name] : []),
          ],
          updatedAt: new Date().toISOString(),
        },
      }))
      setExpandedQuotationId(null)
      setSavingId(null)
      toast({
        title: apiSaved ? "Marked as approved" : "Saved locally",
        description: apiSaved
          ? "Installation approved and moved to Approved by Installer."
          : "Installation moved to Approved by Installer (backend endpoint not ready).",
      })
    }
  }

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
            <Wrench className="w-4 h-4 text-primary" />
          </div>
          <h1 className="text-xl font-semibold">Installer Dashboard</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Welcome, {installer?.firstName || "Installer"}. Process pending jobs and upload completion proof.
        </p>

        <Card className="border-border/60 bg-card/90 shadow-sm">
          <CardContent className="pt-5 space-y-3">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="h-9">
                  <TabsTrigger value="pending" className="text-xs gap-1.5">
                    <Clock3 className="w-3.5 h-3.5" />
                    Pending Installations ({pendingQuotations.length})
                  </TabsTrigger>
                  <TabsTrigger value="approved" className="text-xs gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Approved by Installer ({approvedQuotations.length})
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              <div className="relative w-full md:w-80">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by customer, mobile, quotation id"
                  className="h-9 pl-8 text-sm"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="hidden">
            <TabsTrigger value="pending" className="text-xs gap-1.5">
              <Clock3 className="w-3.5 h-3.5" />
              Pending Installations ({pendingQuotations.length})
            </TabsTrigger>
            <TabsTrigger value="approved" className="text-xs gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Approved by Installer ({approvedQuotations.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="space-y-3 pt-2">
            {isLoading ? (
              <Card>
                <CardContent className="py-8 text-sm text-muted-foreground">Loading approved quotations from admin...</CardContent>
              </Card>
            ) : pendingQuotations.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-sm text-muted-foreground">No pending installation items.</CardContent>
              </Card>
            ) : (
              pendingQuotations.map((q) => (
                <Card key={q.id} className="border-border/60 bg-gradient-to-r from-card to-muted/20 shadow-sm">
                  <CardContent className="p-4 space-y-3">
                    {(() => {
                      const installerStatus = getInstallerStatus(q)
                      return (
                        <>
                    <div className="flex flex-wrap md:flex-nowrap items-center gap-3">
                      <div className="min-w-[180px] flex-1">
                        <p className="text-sm font-semibold leading-tight">
                          {formatPersonName(q.customer?.firstName, q.customer?.lastName, "Unknown")}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">{q.customer?.mobile || "No mobile"} • {q.id}</p>
                      </div>
                      <div className="min-w-[120px]">
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Approved Date</p>
                        <p className="text-xs font-medium flex items-center gap-1">
                          <CalendarDays className="w-3 h-3 text-muted-foreground" />
                          {getAdminApprovedDate(q) ? new Date(getAdminApprovedDate(q) as string).toLocaleDateString("en-IN") : "N/A"}
                        </p>
                      </div>
                      <div className="min-w-[120px]">
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Subtotal</p>
                        <p className="text-sm font-semibold">₹{getQuotationAmount(q).toLocaleString()}</p>
                      </div>
                      <div className="min-w-[150px]">
                        {installerStatus === "inprogress" ? (
                          <Badge className="text-xs bg-amber-600 text-white">In Progress</Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">Pending Installation</Badge>
                        )}
                      </div>
                      <div className="ml-auto">
                        {installerStatus === "pending" ? (
                          <Button variant="outline" size="sm" onClick={() => setInProgress(q)}>
                            <Clock3 className="w-3.5 h-3.5 mr-1" />
                            Start In Progress
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              ensureInstallerDraftData(q)
                              setExpandedQuotationId(expandedQuotationId === q.id ? null : q.id)
                                  if (expandedQuotationId !== q.id) {
                                    void hydrateQuotationDetails(q)
                                  }
                            }}
                          >
                            <Upload className="w-3.5 h-3.5 mr-1" />
                            In Progress
                          </Button>
                        )}
                      </div>
                    </div>

                    {expandedQuotationId === q.id && (
                      <div className="rounded-md border border-border/70 p-3 space-y-3">
                        {loadingDetailsForId === q.id && (
                          <p className="text-xs text-muted-foreground">Loading full customer/quotation details...</p>
                        )}
                        <div className="grid grid-cols-1 xl:grid-cols-[2fr_1fr] gap-4">
                          <div className="space-y-3">
                            <div className="space-y-1.5">
                              <p className="text-xs font-medium">
                                Installation Completion Images (required as marked *)
                              </p>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {INSTALLATION_IMAGE_FIELDS.map((field) => (
                                  <div key={field.key} className="space-y-1.5">
                                    <p className="text-xs text-muted-foreground">
                                      {field.label}
                                      {field.required === false ? "" : " *"}
                                    </p>
                                    <Input
                                      type="file"
                                      accept="image/*"
                                      multiple={field.multiple === true}
                                      onChange={(e) => {
                                        const files = Array.from(e.target.files || [])
                                        setUploadFilesByQuotation((prev) => ({
                                          ...prev,
                                          [q.id]: {
                                            ...(prev[q.id] || {}),
                                            [field.key]: files,
                                          },
                                        }))
                                      }}
                                    />
                                    <p className="text-[11px] text-muted-foreground truncate">
                                      {(uploadFilesByQuotation[q.id]?.[field.key] || []).length > 0
                                        ? `${(uploadFilesByQuotation[q.id]?.[field.key] || []).length} file(s) selected`
                                        : "No file selected"}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div className="space-y-1.5">
                                <Label className="text-xs">PI Upload</Label>
                                <Input
                                  type="file"
                                  accept="application/pdf,image/*"
                                  onChange={(e) =>
                                    setPiUploadByQuotation((prev) => ({ ...prev, [q.id]: e.target.files?.[0] || null }))
                                  }
                                />
                                <p className="text-[11px] text-muted-foreground truncate">
                                  {piUploadByQuotation[q.id]?.name || "No file selected"}
                                </p>
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-xs">Extra Expenses</Label>
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  placeholder="Enter extra expense amount"
                                  value={extraExpensesByQuotation[q.id] || ""}
                                  onChange={(e) =>
                                    setExtraExpensesByQuotation((prev) => ({ ...prev, [q.id]: e.target.value }))
                                  }
                                />
                              </div>
                            </div>

                            <div className="space-y-1.5">
                              <p className="text-xs font-medium">Site Dimensions (cm) *</p>
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div>
                                  <Label className="text-xs">Length</Label>
                                  <Input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={dimensionsByQuotation[q.id]?.length || ""}
                                    onChange={(e) =>
                                      setDimensionsByQuotation((prev) => ({
                                        ...prev,
                                        [q.id]: {
                                          ...(prev[q.id] || { length: "", width: "", height: "" }),
                                          length: e.target.value,
                                        },
                                      }))
                                    }
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs">Width</Label>
                                  <Input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={dimensionsByQuotation[q.id]?.width || ""}
                                    onChange={(e) =>
                                      setDimensionsByQuotation((prev) => ({
                                        ...prev,
                                        [q.id]: {
                                          ...(prev[q.id] || { length: "", width: "", height: "" }),
                                          width: e.target.value,
                                        },
                                      }))
                                    }
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs">Height</Label>
                                  <Input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={dimensionsByQuotation[q.id]?.height || ""}
                                    onChange={(e) =>
                                      setDimensionsByQuotation((prev) => ({
                                        ...prev,
                                        [q.id]: {
                                          ...(prev[q.id] || { length: "", width: "", height: "" }),
                                          height: e.target.value,
                                        },
                                      }))
                                    }
                                  />
                                </div>
                              </div>
                            </div>

                            <div className="space-y-1.5">
                              <p className="text-xs font-medium">Notes (optional)</p>
                              <Textarea
                                rows={2}
                                placeholder="Installation notes, material used, issues, etc."
                                value={uploadNotes[q.id] || ""}
                                onChange={(e) => setUploadNotes((prev) => ({ ...prev, [q.id]: e.target.value }))}
                              />
                            </div>
                          </div>

                          <div className="rounded-md border border-border/60 bg-muted/20 p-3 space-y-3">
                            <div className="space-y-2">
                              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                Customer Details
                              </p>
                              {getCustomerInfoRows(q).length > 0 ? (
                                <div className="space-y-1.5">
                                  {getCustomerInfoRows(q).map((row) => (
                                    <div key={row.label} className="text-xs flex items-start justify-between gap-2">
                                      <span className="text-muted-foreground">{row.label}</span>
                                      <span className="font-medium text-right">{String(row.value)}</span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-xs text-muted-foreground">No customer details available.</p>
                              )}
                            </div>

                            <div className="space-y-2 border-t border-border/60 pt-2">
                              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                Visitor / Location Details
                              </p>
                              {getVisitorDetailsRows(q).length > 0 ? (
                                <div className="space-y-1.5">
                                  {getVisitorDetailsRows(q).map((row) => (
                                    <div key={row.label} className="text-xs flex items-start justify-between gap-2">
                                      <span className="text-muted-foreground">{row.label}</span>
                                      {row.label === "Location Link" ? (
                                        <a
                                          href={String(row.value)}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="font-medium text-right text-primary hover:underline break-all"
                                        >
                                          {String(row.value)}
                                        </a>
                                      ) : (
                                        <span className="font-medium text-right">{String(row.value)}</span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-xs text-muted-foreground">No visitor/location details available.</p>
                              )}
                            </div>

                            <div className="space-y-2 border-t border-border/60 pt-2">
                              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                Product Specification
                              </p>
                              {getProductSpecRows(q).length > 0 ? (
                                <div className="space-y-1.5">
                                  {getProductSpecRows(q).map((row) => (
                                    <div key={row.label} className="text-xs flex items-start justify-between gap-2">
                                      <span className="text-muted-foreground">{row.label}</span>
                                      <span className="font-medium text-right">{String(row.value)}</span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-xs text-muted-foreground">No product specification available.</p>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => setExpandedQuotationId(null)}>
                            Cancel
                          </Button>
                          <Button size="sm" onClick={() => handleApproveInstallation(q)} disabled={savingId === q.id}>
                            {savingId === q.id ? "Saving..." : "Complete & Mark as Approved"}
                          </Button>
                        </div>
                      </div>
                    )}
                        </>
                      )
                    })()}
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="approved" className="space-y-3 pt-2">
            {isLoading ? (
              <Card>
                <CardContent className="py-8 text-sm text-muted-foreground">Loading approved records...</CardContent>
              </Card>
            ) : approvedQuotations.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-sm text-muted-foreground">No installer-approved installations yet.</CardContent>
              </Card>
            ) : (
              approvedQuotations.map((q) => {
                const wf = workflowMap[q.id]
                const installerApprovedDate =
                  (q as any).installerApprovedAt || wf?.updatedAt || getAdminApprovedDate(q)
                return (
                  <Card key={q.id} className="border-green-200/70 bg-gradient-to-r from-green-50/40 to-card shadow-sm">
                    <CardContent className="p-4 space-y-2">
                      <div className="flex flex-wrap md:flex-nowrap items-center gap-3">
                        <div className="min-w-[180px] flex-1">
                          <p className="text-sm font-semibold leading-tight">
                            {formatPersonName(q.customer?.firstName, q.customer?.lastName, "Unknown")}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {q.customer?.mobile || "No mobile"} • {q.id}
                          </p>
                        </div>
                        <div className="min-w-[120px]">
                          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Approved Date</p>
                          <p className="text-xs font-medium flex items-center gap-1">
                            <CalendarDays className="w-3 h-3 text-muted-foreground" />
                            {installerApprovedDate ? new Date(installerApprovedDate).toLocaleDateString("en-IN") : "N/A"}
                          </p>
                        </div>
                        <div className="min-w-[120px]">
                          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Subtotal</p>
                          <p className="text-sm font-semibold">₹{getQuotationAmount(q).toLocaleString()}</p>
                        </div>
                        <div className="min-w-[180px]">
                          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Images</p>
                          <p className="text-xs text-foreground">
                            {wf?.imageNames?.length ? `${wf.imageNames.length} uploaded` : "Saved in backend records"}
                          </p>
                        </div>
                        <div className="ml-auto">
                          <Badge className="bg-green-600 text-white text-xs">Approved by Installer</Badge>
                        </div>
                      </div>
                      {wf?.notes && <p className="text-xs text-muted-foreground border-t border-border/60 pt-2">Notes: {wf.notes}</p>}
                    </CardContent>
                  </Card>
                )
              })
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
