"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { SolarLogo } from "@/components/solar-logo"
import { LogOut, Wrench, CheckCircle2, Clock3, Search, CalendarDays, Gauge, Edit, ChevronDown, Users } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { InstallationTeamsDialog } from "@/components/installation-teams-dialog"
import { api, apiErrorToUserMessage, sendQuotationToMetering, ApiError } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import { formatPersonName } from "@/lib/name-display"
import {
  InstallationCompletionPanel,
  type InstallationUploadedFile,
} from "@/components/installation-completion-panel"
import { InstallationPublicPhoto } from "@/components/installation-public-photo"
import {
  gatherInstallationPublicImageUrls,
  INSTALLATION_APPROVED_MEDIA_STATUSES,
  isInstallationUploadCompleteWithMedia,
} from "@/lib/installation-public-images"
import { loadOperationalInstallationRows } from "@/lib/load-operational-installation-rows"
import {
  addCalendarDaysFromDateString,
  getInstallationWorkflowStatus,
  getSendToMeteringMenuState,
  mergeInstallationMediaSources,
  mergeInstallerReleaseOntoQuotation,
  readInstallerReleaseMap,
  shouldShowInAdminInstallationTab,
  toYmdFromStored,
} from "@/lib/operational-install-queue"
import {
  loadInstallationTeamsList,
  persistInstallationTeamAssignment,
} from "@/lib/installation-team-management"
import { getInstallationTeamIdForQuotation, type InstallationTeamRecord } from "@/lib/installation-teams"

type InstallerQuotation = {
  id: string
  status?: string
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
  installation_status?: string
  installationReadyForInstaller?: boolean
  installationReleasedAt?: string
  installation_ready_for_installer?: boolean
  installation_released_at?: string
  installationScheduledAt?: string
  installation_scheduled_at?: string
  installationTeamId?: string
  installation_team_id?: string
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
  visitId?: string
  backLegFeet?: number
  midLegFeet?: number
  frontLegFeet?: number
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
  { key: "panelSerialNumberPhoto", label: "Panels photo with Serial No", multiple: true },
  { key: "geoTagPlantPhoto", label: "GeoTag photo with plants" },
  { key: "otherImages", label: "Others Images", multiple: true, required: false },
] as const

type InstallationImageFieldKey = (typeof INSTALLATION_IMAGE_FIELDS)[number]["key"]

type ImageFieldConfig = (typeof INSTALLATION_IMAGE_FIELDS)[number] & { required?: boolean; multiple?: boolean }

const isImageFieldRequired = (field: (typeof INSTALLATION_IMAGE_FIELDS)[number]) =>
  (field as ImageFieldConfig).required !== false

const isImageFieldMultiple = (field: (typeof INSTALLATION_IMAGE_FIELDS)[number]) =>
  (field as ImageFieldConfig).multiple === true

const CM_PER_FT = 30.48

const newExpenseLineId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `exp-${Date.now()}-${Math.random().toString(16).slice(2)}`

type ExtraExpenseLine = { id: string; description: string; amount: string }

/** Product-shaped fields sometimes returned on the quotation root or QuotationProduct row instead of `products`. */
const INSTALLER_PRODUCT_ROOT_KEYS = [
  "systemType",
  "phase",
  "panelBrand",
  "panelSize",
  "panelQuantity",
  "panelPrice",
  "dcrPanelBrand",
  "dcrPanelSize",
  "dcrPanelQuantity",
  "nonDcrPanelBrand",
  "nonDcrPanelSize",
  "nonDcrPanelQuantity",
  "inverterType",
  "inverterBrand",
  "inverterSize",
  "inverterPrice",
  "structureType",
  "structureSize",
  "structurePrice",
  "hybridInverter",
  "batteryCapacity",
  "batteryPrice",
  "customPanels",
] as const

const isNonEmptyPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v) && Object.keys(v).length > 0

const pickProductFieldsFromRecord = (record?: Record<string, any> | null): Record<string, any> => {
  if (!record) return {}
  const out: Record<string, any> = {}
  for (const k of INSTALLER_PRODUCT_ROOT_KEYS) {
    const val = record[k]
    if (val === undefined || val === null) continue
    if (typeof val === "string" && val.trim() === "") continue
    out[k] = val
  }
  return out
}

/**
 * Merge `products` JSON with nested quotation rows and Sequelize-style product rows so installer UI always sees one object.
 */
const mergeInstallerProductSources = (record: Record<string, any>): Record<string, any> => {
  const nested = record.quotation && typeof record.quotation === "object" ? (record.quotation as Record<string, any>) : null
  const qp = record.quotationProduct
  const qps = record.quotationProducts
  const firstArrayRow =
    Array.isArray(qps) && qps[0] && typeof qps[0] === "object" && !Array.isArray(qps[0]) ? (qps[0] as Record<string, any>) : null
  const productRow =
    qp && typeof qp === "object" && !Array.isArray(qp) ? (qp as Record<string, any>) : firstArrayRow

  let merged: Record<string, any> = {}
  if (nested) {
    merged = { ...merged, ...pickProductFieldsFromRecord(nested) }
    if (isNonEmptyPlainObject(nested.products)) merged = { ...merged, ...nested.products }
  }
  merged = { ...merged, ...pickProductFieldsFromRecord(record) }
  if (isNonEmptyPlainObject(record.products)) merged = { ...merged, ...record.products }
  if (productRow && Object.keys(productRow).length > 0) merged = { ...merged, ...productRow }
  return merged
}

/** Flatten `{ quotation: {...} }` list/detail shapes and attach merged `products` for display. */
const installerQuotationFromApiRecord = (raw: unknown): InstallerQuotation => {
  if (!raw || typeof raw !== "object") return raw as InstallerQuotation
  const r = raw as Record<string, any>
  const nested = r.quotation
  const flat =
    nested && typeof nested === "object" && !Array.isArray(nested)
      ? ({ ...(nested as Record<string, any>), ...r } as Record<string, any>)
      : { ...r }
  const mergedProducts = mergeInstallerProductSources(flat)
  const products = isNonEmptyPlainObject(mergedProducts)
    ? mergedProducts
    : isNonEmptyPlainObject(flat.products)
      ? (flat.products as Record<string, any>)
      : flat.products || {}
  return { ...flat, products } as InstallerQuotation
}

export default function InstallerDashboardPage() {
  const router = useRouter()
  const { isAuthenticated, role, installer, installationTeamUser, logout } = useAuth()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<"all" | "pending" | "approved">("pending")
  const [searchTerm, setSearchTerm] = useState("")
  const [quotations, setQuotations] = useState<InstallerQuotation[]>([])
  const [expandedQuotationId, setExpandedQuotationId] = useState<string | null>(null)
  const [uploadNotes, setUploadNotes] = useState<Record<string, string>>({})
  const [uploadFilesByQuotation, setUploadFilesByQuotation] = useState<
    Record<string, Partial<Record<InstallationImageFieldKey, InstallationUploadedFile[]>>>
  >({})
  const [piUploadByQuotation, setPiUploadByQuotation] = useState<Record<string, InstallationUploadedFile | null>>({})
  const [extraExpenseLinesByQuotation, setExtraExpenseLinesByQuotation] = useState<Record<string, ExtraExpenseLine[]>>({})
  const [dimensionsByQuotation, setDimensionsByQuotation] = useState<
    Record<string, { length: string; width: string; height: string }>
  >({})
  const [savingId, setSavingId] = useState<string | null>(null)
  const [sendingToMeteringId, setSendingToMeteringId] = useState<string | null>(null)
  const [loadingDetailsForId, setLoadingDetailsForId] = useState<string | null>(null)
  const [workflowMap, setWorkflowMap] = useState<Record<string, InstallerWorkflowItem>>({})
  const [installerQueueApprovedIds, setInstallerQueueApprovedIds] = useState<Set<string>>(() => new Set())
  const [uploadingAssetKey, setUploadingAssetKey] = useState<string | null>(null)
  const [installationTeams, setInstallationTeams] = useState<InstallationTeamRecord[]>([])
  const [installationTeamsDialogOpen, setInstallationTeamsDialogOpen] = useState(false)
  const [installationTeamsRefresh, setInstallationTeamsRefresh] = useState(0)
  const useApi = process.env.NEXT_PUBLIC_USE_API !== "false"
  const canManageInstallationTeams = role === "installer"

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/installer-login")
      return
    }
    if (role !== "installer" && role !== "installation-team") {
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
    if (!canManageInstallationTeams) return
    void loadInstallationTeamsList(useApi).then(setInstallationTeams)
  }, [useApi, canManageInstallationTeams, installationTeamsRefresh])

  const handlePersistInstallationTeamAssignment = async (quotationId: string, teamId: string) => {
    const normalized = teamId.trim() || undefined
    setQuotations((prev) =>
      prev.map((q) =>
        q.id === quotationId
          ? ({
              ...q,
              installationTeamId: normalized,
              installation_team_id: normalized,
            } as InstallerQuotation)
          : q,
      ),
    )
    const result = await persistInstallationTeamAssignment(useApi, quotationId, teamId)
    if (result.ok) {
      toast({
        title: "Team assignment updated",
        description: normalized ? "This installation is linked to a team." : "Team unassigned for this row.",
      })
      return
    }
    toast({
      title: "Not saved on server",
      description: result.message,
      variant: "destructive",
    })
  }

  const installDocEnrichAttemptedRef = useRef(new Set<string>())
  const installDocEnrichInFlightRef = useRef(new Set<string>())

  useEffect(() => {
    const loadInstallationQuotations = async () => {
      setIsLoading(true)
      try {
        if (useApi) {
          const { rows, installerQueueApprovedIds: approvedIds } = await loadOperationalInstallationRows({
            fetchAdminQuotationList: true,
            filterTeamId:
              role === "installation-team" && installationTeamUser?.teamId
                ? String(installationTeamUser.teamId)
                : undefined,
            getQuotationById: (id) => api.quotations.getById(id),
          })
          setInstallerQueueApprovedIds(approvedIds)
          setQuotations(rows.map((row) => installerQuotationFromApiRecord(row)) as InstallerQuotation[])
        } else {
          let localQuotations: InstallerQuotation[] = []
          try {
            localQuotations = JSON.parse(localStorage.getItem("quotations") || "[]")
          } catch {
            localQuotations = []
          }
          const releaseLocal = readInstallerReleaseMap()
          let list = localQuotations
            .map((q: unknown) => installerQuotationFromApiRecord(q))
            .map((q) =>
              mergeInstallerReleaseOntoQuotation(q as Record<string, unknown>, releaseLocal) as InstallerQuotation,
            )
            .filter((q) => shouldShowInAdminInstallationTab(q as Record<string, unknown>, releaseLocal))
          if (role === "installation-team" && installationTeamUser?.teamId) {
            const want = String(installationTeamUser.teamId).trim()
            list = list.filter((q: InstallerQuotation) => {
              const got = String(getInstallationTeamIdForQuotation(q.id, q as Record<string, unknown>) || "").trim()
              return got === want
            })
          }
          setInstallerQueueApprovedIds(new Set())
          setQuotations(list)
        }
      } catch {
        toast({
          title: "Failed to load quotations",
          description: "Could not load installation queue quotations.",
          variant: "destructive",
        })
        setQuotations([])
      } finally {
        setIsLoading(false)
      }
    }
    void loadInstallationQuotations()
  }, [toast, useApi, role, installationTeamUser?.teamId])

  useEffect(() => {
    if (!useApi) return

    const candidates = quotations
      .filter((q) => {
        if (!shouldShowInAdminInstallationTab(q as Record<string, unknown>, readInstallerReleaseMap())) return false
        const ws = getInstallationWorkflowStatus(q as Record<string, unknown>)
        const likelyApproved =
          INSTALLATION_APPROVED_MEDIA_STATUSES.has(ws) || installerQueueApprovedIds.has(q.id)
        if (!likelyApproved) return false
        const id = String(q.id || "").trim()
        if (!id || installDocEnrichAttemptedRef.current.has(id) || installDocEnrichInFlightRef.current.has(id)) {
          return false
        }
        return gatherInstallationPublicImageUrls(q as Record<string, unknown>).length === 0
      })
      .slice(0, 20)

    if (candidates.length === 0) return

    let cancelled = false
    void (async () => {
      for (const q of candidates) {
        if (cancelled) break
        const id = q.id
        installDocEnrichAttemptedRef.current.add(id)
        installDocEnrichInFlightRef.current.add(id)
        try {
          const full = await api.quotations.getById(id)
          if (cancelled) break
          setQuotations((prev) =>
            prev.map((row) =>
              row.id === id
                ? (installerQuotationFromApiRecord(
                    mergeInstallationMediaSources(row as Record<string, unknown>, full as Record<string, unknown>),
                  ) as InstallerQuotation)
                : row,
            ),
          )
        } catch {
          // list may still lack documents until backend returns URLs on GET by id
        } finally {
          installDocEnrichInFlightRef.current.delete(id)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [useApi, quotations, installerQueueApprovedIds])

  const getAdminApprovedDate = (q: InstallerQuotation) =>
    (q as any).approvedAt || (q as any).approvedDate || (q as any).statusUpdatedAt || q.createdAt

  const getTeamDisplayName = (q: InstallerQuotation) => {
    const anyQ = q as any
    const directName = String(anyQ.installationTeamName || anyQ.installation_team_name || "").trim()
    if (directName) return directName
    const teamId = String(getInstallationTeamIdForQuotation(q.id, anyQ) || "").trim()
    if (!teamId) return "Unassigned"
    if (role === "installation-team") {
      const loggedInTeamName = String(installationTeamUser?.teamName || installationTeamUser?.username || "").trim()
      if (loggedInTeamName) return loggedInTeamName
    }
    return teamId
  }

  const toTimestamp = (date?: string) => {
    if (!date) return 0
    const parsed = new Date(date).getTime()
    return Number.isNaN(parsed) ? 0 : parsed
  }

  const isInstallationUploadComplete = (q: InstallerQuotation) =>
    isInstallationUploadCompleteWithMedia(q as Record<string, unknown>, {
      approvedQueueIds: installerQueueApprovedIds,
    })

  const getInstallerStatus = (q: InstallerQuotation): "pending" | "inprogress" | "approved" => {
    if (isInstallationUploadComplete(q)) return "approved"
    const backendStatus = getInstallationWorkflowStatus(q as Record<string, unknown>)
    if (backendStatus === "installer_in_progress" || backendStatus === "in_progress") {
      return "inprogress"
    }
    return workflowMap[q.id]?.status === "inprogress" ? "inprogress" : "pending"
  }

  const getDealerDisplay = (q: InstallerQuotation) => {
    const nested = q.dealer
    if (nested) {
      return {
        name: formatPersonName(nested.firstName, nested.lastName, "Dealer"),
        mobile: nested.mobile || "—",
      }
    }
    return { name: "—", mobile: "—" }
  }

  const getInstallationDateLabel = (q: InstallerQuotation) => {
    const qAny = q as Record<string, unknown>
    const sentToInstallationAt = qAny.installationReleasedAt || qAny.installation_released_at || getAdminApprovedDate(q)
    const sentBaseStr = sentToInstallationAt ? String(sentToInstallationAt) : ""
    const sentParsedOk = sentBaseStr ? !Number.isNaN(new Date(sentBaseStr).getTime()) : false
    const defaultInstallYmd = sentParsedOk ? addCalendarDaysFromDateString(sentBaseStr, 7) : ""
    const storedInstallYmd = toYmdFromStored(
      (qAny.installationScheduledAt || qAny.installation_scheduled_at) as string | undefined,
    )
    const ymd = storedInstallYmd || defaultInstallYmd
    if (!ymd) return "N/A"
    const parsed = new Date(`${ymd}T12:00:00`)
    return Number.isNaN(parsed.getTime()) ? ymd : parsed.toLocaleDateString("en-IN")
  }

  const normalizedSearch = searchTerm.trim().toLowerCase()

  const sortedQuotations = useMemo(() => {
    return [...quotations]
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
  }, [quotations, normalizedSearch])

  const pendingQuotations = useMemo(
    () => sortedQuotations.filter((q) => getInstallerStatus(q) !== "approved"),
    [sortedQuotations, workflowMap, installerQueueApprovedIds],
  )

  const approvedQuotations = useMemo(
    () => sortedQuotations.filter((q) => getInstallerStatus(q) === "approved"),
    [sortedQuotations, workflowMap, installerQueueApprovedIds],
  )

  const activeInstallationList = useMemo(() => {
    if (activeTab === "pending") return pendingQuotations
    if (activeTab === "approved") return approvedQuotations
    return sortedQuotations
  }, [activeTab, pendingQuotations, approvedQuotations, sortedQuotations])

  const openUploadPanel = (q: InstallerQuotation) => {
    ensureInstallerDraftData(q)
    setExpandedQuotationId(expandedQuotationId === q.id ? null : q.id)
    if (expandedQuotationId !== q.id) {
      void hydrateQuotationDetails(q)
    }
  }

  const pickDimensionValue = (q: InstallerQuotation, keys: Array<keyof InstallerQuotation>) => {
    for (const key of keys) {
      const val = q[key]
      const n = Number(val)
      if (Number.isFinite(n) && n > 0) return String(n)
    }
    return ""
  }

  const pickFirstFiniteNumber = (...vals: unknown[]): number | undefined => {
    for (const v of vals) {
      if (v === undefined || v === null) continue
      const n = typeof v === "string" && String(v).trim() !== "" ? Number(v) : Number(v)
      if (Number.isFinite(n) && n > 0) return n
    }
    return undefined
  }

  const feetToCmString = (feet: unknown): string => {
    const n = typeof feet === "string" && feet.trim() !== "" ? Number(feet) : Number(feet)
    if (!Number.isFinite(n) || n <= 0) return ""
    const cm = Math.round(n * CM_PER_FT * 100) / 100
    return String(cm)
  }

  /** Site legs (cm): prefer visitor leg fields / siteDimensions, then legacy L×W×H on quotation. */
  const pickSiteLegCmString = (q: InstallerQuotation, leg: "back" | "mid" | "front") => {
    const r = q as Record<string, any>
    if (leg === "back") {
      const cm = pickFirstFiniteNumber(r.backLegCm, r.back_leg_cm)
      if (cm != null) return String(cm)
      const fromFeet = feetToCmString(pickFirstFiniteNumber(r.backLegFeet, r.back_leg_feet))
      if (fromFeet) return fromFeet
      return pickDimensionValue(q, ["length", "siteLength", "visitLength"])
    }
    if (leg === "mid") {
      const cm = pickFirstFiniteNumber(r.midLegCm, r.mid_leg_cm)
      if (cm != null) return String(cm)
      const fromFeet = feetToCmString(pickFirstFiniteNumber(r.midLegFeet, r.mid_leg_feet))
      if (fromFeet) return fromFeet
      return pickDimensionValue(q, ["width", "siteWidth", "visitWidth"])
    }
    const cm = pickFirstFiniteNumber(r.frontLegCm, r.front_leg_cm)
    if (cm != null) return String(cm)
    const fromFeet = feetToCmString(pickFirstFiniteNumber(r.frontLegFeet, r.front_leg_feet))
    if (fromFeet) return fromFeet
    return pickDimensionValue(q, ["height", "siteHeight", "visitHeight"])
  }

  const getVisitorLegRows = (
    q: InstallerQuotation,
    draft?: { length: string; width: string; height: string },
  ): { label: string; value: string }[] => {
    const useDraft = (d: string | undefined, fallback: string) => {
      const t = (d || "").trim()
      return t !== "" ? t : fallback
    }
    const back = useDraft(draft?.length, pickSiteLegCmString(q, "back"))
    const mid = useDraft(draft?.width, pickSiteLegCmString(q, "mid"))
    const front = useDraft(draft?.height, pickSiteLegCmString(q, "front"))
    return [
      { label: "Back leg (cm)", value: back },
      { label: "Mid leg (cm)", value: mid },
      { label: "Front leg (cm)", value: front },
    ].filter((row) => row.value.trim() !== "")
  }

  const getProductSpecRows = (q: InstallerQuotation) => {
    const p = mergeInstallerProductSources(q as unknown as Record<string, any>)
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
      { label: "Phase", value: p.phase },
      { label: "Hybrid Inverter", value: p.hybridInverter },
      { label: "Battery", value: batteryConfig },
      { label: "Battery Capacity", value: p.batteryCapacity },
      { label: "Battery Price", value: p.batteryPrice ? `₹${p.batteryPrice}` : undefined },
      { label: "Structure", value: [p.structureType, p.structureSize].filter(Boolean).join(" - ") },
    ].filter((row) => row.value !== undefined && row.value !== null && String(row.value).trim() !== "")
  }

  const getCustomerInfoRows = (q: InstallerQuotation) => {
    const customerName = formatPersonName(q.customer?.firstName, q.customer?.lastName, "Unknown")
    return [
      { label: "Customer", value: customerName },
      { label: "Mobile", value: q.customer?.mobile },
      { label: "Email", value: q.customer?.email },
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
          length: pickSiteLegCmString(quotation, "back"),
          width: pickSiteLegCmString(quotation, "mid"),
          height: pickSiteLegCmString(quotation, "front"),
        },
      }
    })
    setExtraExpenseLinesByQuotation((prev) =>
      prev[quotation.id] !== undefined ? prev : { ...prev, [quotation.id]: [] },
    )
    setUploadFilesByQuotation((prev) => (prev[quotation.id] ? prev : { ...prev, [quotation.id]: {} }))
  }

  const hydrateQuotationDetails = async (quotation: InstallerQuotation) => {
    if (!useApi || !quotation?.id) return
    setLoadingDetailsForId(quotation.id)
    try {
      const full = await api.quotations.getById(quotation.id)
      if (!full || typeof full !== "object") return
      const normalized = installerQuotationFromApiRecord(full)

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

      const vd = visitDetails as Record<string, any> | null
      const completion = vd?.completionDetails || vd?.completion_details || {}
      const sd = vd?.siteDimensions || vd?.site_dimensions || completion?.siteDimensions || completion?.site_dimensions || {}
      const backLegFeet = pickFirstFiniteNumber(
        vd?.backLegFeet,
        vd?.back_leg_feet,
        sd.backLegFeet,
        sd.back_leg_feet,
      )
      const midLegFeet = pickFirstFiniteNumber(
        vd?.midLegFeet,
        vd?.mid_leg_feet,
        sd.midLegFeet,
        sd.mid_leg_feet,
      )
      const frontLegFeet = pickFirstFiniteNumber(
        vd?.frontLegFeet,
        vd?.front_leg_feet,
        sd.frontLegFeet,
        sd.front_leg_feet,
      )

      setQuotations((prev) =>
        prev.map((item) => {
          if (item.id !== quotation.id) return item
          return {
            ...item,
            ...normalized,
            customer: {
              ...(item.customer || {}),
              ...((normalized as any).customer || {}),
            },
            dealer: (normalized as any).dealer || item.dealer,
            products: isNonEmptyPlainObject(normalized.products) ? normalized.products : item.products,
            visitId: (vd?.id as string | undefined) || item.visitId,
            backLegFeet: backLegFeet ?? (item as any).backLegFeet,
            midLegFeet: midLegFeet ?? (item as any).midLegFeet,
            frontLegFeet: frontLegFeet ?? (item as any).frontLegFeet,
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

  const toLocalUploadedFile = (file: File): InstallationUploadedFile => ({
    name: file.name,
    url: URL.createObjectURL(file),
  })

  const uploadInstallerFieldFiles = async (
    quotationId: string,
    fieldKey: InstallationImageFieldKey,
    files: File[],
  ) => {
    if (files.length === 0) {
      setUploadFilesByQuotation((prev) => ({
        ...prev,
        [quotationId]: {
          ...(prev[quotationId] || {}),
          [fieldKey]: [],
        },
      }))
      return
    }

    const targetKey = `${quotationId}:${fieldKey}`
    setUploadingAssetKey(targetKey)
    try {
      const uploadedFiles: InstallationUploadedFile[] = []
      for (const file of files) {
        const url = useApi
          ? await api.installer.uploadCompletionAsset(quotationId, fieldKey, file)
          : toLocalUploadedFile(file).url
        uploadedFiles.push({ name: file.name, url })
      }
      setUploadFilesByQuotation((prev) => ({
        ...prev,
        [quotationId]: {
          ...(prev[quotationId] || {}),
          [fieldKey]: uploadedFiles,
        },
      }))
    } catch (error) {
      toast({
        title: "Upload failed",
        description: apiErrorToUserMessage(error),
        variant: "destructive",
      })
    } finally {
      setUploadingAssetKey((current) => (current === targetKey ? null : current))
    }
  }

  const uploadInstallerPiFile = async (quotationId: string, file: File | null) => {
    if (!file) {
      setPiUploadByQuotation((prev) => ({ ...prev, [quotationId]: null }))
      return
    }

    const targetKey = `${quotationId}:piUpload`
    setUploadingAssetKey(targetKey)
    try {
      const url = useApi
        ? await api.installer.uploadCompletionAsset(quotationId, "piUpload", file)
        : toLocalUploadedFile(file).url
      setPiUploadByQuotation((prev) => ({ ...prev, [quotationId]: { name: file.name, url } }))
    } catch (error) {
      toast({
        title: "PI upload failed",
        description: apiErrorToUserMessage(error),
        variant: "destructive",
      })
    } finally {
      setUploadingAssetKey((current) => (current === targetKey ? null : current))
    }
  }

  const handleApproveInstallation = async (quotation: InstallerQuotation) => {
    const filesByField = uploadFilesByQuotation[quotation.id] || {}
    const requiredFields = INSTALLATION_IMAGE_FIELDS.filter((field) => isImageFieldRequired(field))
    const uploadedFiles = INSTALLATION_IMAGE_FIELDS.flatMap((field) => filesByField[field.key] || [])
    const notes = uploadNotes[quotation.id] || ""
    const dimensions = dimensionsByQuotation[quotation.id] || { length: "", width: "", height: "" }
    const piUpload = piUploadByQuotation[quotation.id]
    const rawExpenseLines = extraExpenseLinesByQuotation[quotation.id] || []
    const expenseLines = rawExpenseLines.filter((l) => l.description.trim() !== "" || l.amount.trim() !== "")

    if (uploadingAssetKey?.startsWith(`${quotation.id}:`)) {
      toast({
        title: "Upload in progress",
        description: "Wait for all completion files to finish uploading before saving.",
        variant: "destructive",
      })
      return
    }

    const missingFields = requiredFields.filter((field) => !(filesByField[field.key] && filesByField[field.key]!.length > 0))
    if (missingFields.length > 0) {
      toast({
        title: "Images required",
        description: `Please upload all required images. Missing: ${missingFields.map((f) => f.label).join(", ")}.`,
        variant: "destructive",
      })
      return
    }
    const backCm = dimensions.length.trim()
    const frontCm = dimensions.height.trim()
    const midCmRaw = dimensions.width.trim()
    const backN = backCm === "" ? undefined : parseFloat(backCm)
    const frontN = frontCm === "" ? undefined : parseFloat(frontCm)
    if (backCm !== "" && (!Number.isFinite(backN) || (backN as number) <= 0)) {
      toast({
        title: "Invalid back leg",
        description: "Back leg must be a valid number greater than zero, or leave it empty.",
        variant: "destructive",
      })
      return
    }
    if (frontCm !== "" && (!Number.isFinite(frontN) || (frontN as number) <= 0)) {
      toast({
        title: "Invalid front leg",
        description: "Front leg must be a valid number greater than zero, or leave it empty.",
        variant: "destructive",
      })
      return
    }
    let midN: number | undefined
    if (midCmRaw !== "") {
      midN = parseFloat(midCmRaw)
      if (!Number.isFinite(midN) || midN <= 0) {
        toast({
          title: "Invalid mid leg",
          description: "Mid leg must be a valid number greater than zero, or leave it empty.",
          variant: "destructive",
        })
        return
      }
    }
    if (
      expenseLines.some(
        (l) =>
          !l.amount.trim() ||
          Number.isNaN(parseFloat(l.amount)) ||
          parseFloat(l.amount) < 0,
      )
    ) {
      toast({
        title: "Extra expenses",
        description: "Each expense line with a description must have a valid amount (≥ 0).",
        variant: "destructive",
      })
      return
    }

    const cmToFeet = (cm: number) => Number((cm / CM_PER_FT).toFixed(4))

    setSavingId(quotation.id)
    let apiSaved = false
    let uploadErrorMessage: string | undefined
    try {
      if (useApi) {
        const formData = new FormData()
        INSTALLATION_IMAGE_FIELDS.forEach((field) => {
          const fieldFiles = filesByField[field.key] || []
          fieldFiles.forEach((file) => {
            formData.append("installerCompletionImages", file.url)
            formData.append(field.key, file.url)
          })
        })
        if (piUpload?.url) {
          formData.append("piUpload", piUpload.url)
        }
        if (expenseLines.length > 0) {
          const payload = expenseLines.map(({ description, amount }) => ({
            description: description.trim(),
            amount: parseFloat(amount),
          }))
          formData.append("extraExpensesJson", JSON.stringify(payload))
          formData.append(
            "extraExpensesTotal",
            String(payload.reduce((s, row) => s + (Number.isFinite(row.amount) ? row.amount : 0), 0)),
          )
        }
        formData.append("siteLength", backCm)
        formData.append("siteWidth", midCmRaw === "" ? "" : midCmRaw)
        formData.append("siteHeight", frontCm)
        if (backCm !== "") formData.append("backLegCm", backCm)
        if (midCmRaw !== "") formData.append("midLegCm", midCmRaw)
        if (frontCm !== "") formData.append("frontLegCm", frontCm)
        if (backN != null) formData.append("backLegFeet", String(cmToFeet(backN)))
        if (midN != null) formData.append("midLegFeet", String(cmToFeet(midN)))
        if (frontN != null) formData.append("frontLegFeet", String(cmToFeet(frontN)))
        formData.append("installerRemarks", notes)
        formData.append("installationStatus", "installer_approved")
        await api.installer.uploadCompletionDocuments(quotation.id, formData)
        apiSaved = true

        let visitIdToPatch = (quotation as InstallerQuotation & { visitId?: string }).visitId
        if (!visitIdToPatch) {
          try {
            const visitResp = await api.visits.getByQuotation(quotation.id)
            const visitList = Array.isArray((visitResp as any)?.visits)
              ? (visitResp as any).visits
              : Array.isArray(visitResp)
                ? (visitResp as any[])
                : []
            visitIdToPatch = visitList[0]?.id
          } catch {
            visitIdToPatch = undefined
          }
        }
        if (visitIdToPatch) {
          const patchBody: Record<string, unknown> = { unit: "cm" }
          if (backN != null) {
            patchBody.length = backN
            patchBody.siteLength = backN
            patchBody.backLegFeet = cmToFeet(backN)
          }
          if (frontN != null) {
            patchBody.height = frontN
            patchBody.siteHeight = frontN
            patchBody.frontLegFeet = cmToFeet(frontN)
          }
          if (midN != null) {
            patchBody.width = midN
            patchBody.siteWidth = midN
            patchBody.midLegFeet = cmToFeet(midN)
          }
          try {
            await api.visits.patch(visitIdToPatch, patchBody)
            setQuotations((prev) =>
              prev.map((it) => (it.id === quotation.id ? { ...it, visitId: visitIdToPatch } : it)),
            )
          } catch {
            /* optional backend support */
          }
        }
      } else {
        apiSaved = true
      }
    } catch (err) {
      apiSaved = false
      uploadErrorMessage = apiErrorToUserMessage(err)
    } finally {
      setSavingId(null)
      const backNum = dimensions.length.trim() === "" ? undefined : parseFloat(dimensions.length)
      const frontNum = dimensions.height.trim() === "" ? undefined : parseFloat(dimensions.height)
      const midStr = dimensions.width.trim()
      const midNum = midStr === "" ? undefined : parseFloat(midStr)

      if (apiSaved) {
        setQuotations((prev) =>
          prev.map((it) => {
            if (it.id !== quotation.id) return it
            return {
              ...it,
              installationStatus: "installer_approved",
              installation_status: "installer_approved",
              ...(backNum != null && Number.isFinite(backNum)
                ? { length: backNum, siteLength: backNum, backLegFeet: cmToFeet(backNum) }
                : {}),
              ...(frontNum != null && Number.isFinite(frontNum)
                ? { height: frontNum, siteHeight: frontNum, frontLegFeet: cmToFeet(frontNum) }
                : {}),
              ...(midNum != null && Number.isFinite(midNum)
                ? { width: midNum, siteWidth: midNum, midLegFeet: cmToFeet(midNum) }
                : {}),
            }
          }),
        )
        setInstallerQueueApprovedIds((prev) => new Set([...prev, quotation.id]))
        setWorkflowMap((prev) => ({
          ...prev,
          [quotation.id]: {
            status: "approved",
            notes,
            imageNames: [
              ...uploadedFiles.map((f) => f.name),
              ...(piUpload ? [piUpload.name] : []),
            ],
            updatedAt: new Date().toISOString(),
          },
        }))
        setExpandedQuotationId(null)
        setActiveTab("approved")
        toast({
          title: "Installation complete",
          description: useApi
            ? "Moved to Approved Installation — use Send to Metering when ready to hand off."
            : "Moved to Approved Installation (saved locally). Use Send to Metering when ready.",
        })
      } else if (useApi) {
        toast({
          title: "Upload failed",
          description:
            uploadErrorMessage ||
            "Could not save installation completion. Check the network response or ask the backend team to deploy POST /api/installer/quotations/{id}/documents.",
          variant: "destructive",
        })
      }
    }
  }

  const handleSendToMetering = async (quotation: InstallerQuotation) => {
    const menuState = getSendToMeteringMenuState(quotation as any)
    if (sendingToMeteringId === quotation.id) return
    if (!menuState.enabled) {
      toast({
        title: "Cannot send to metering",
        description: menuState.hint || "Complete installation and ensure the quotation is approved first.",
        variant: "destructive",
      })
      return
    }

    setSendingToMeteringId(quotation.id)
    try {
      let ok = false
      if (useApi) {
        ok = await sendQuotationToMetering(quotation.id)
        if (!ok) {
          toast({
            title: "Send to metering failed",
            description: "The server did not accept the metering handoff. Ask admin to verify API permissions.",
            variant: "destructive",
          })
          return
        }
      } else {
        ok = true
      }

      if (ok) {
        setQuotations((prev) =>
          prev.map((row) =>
            row.id === quotation.id
              ? ({
                  ...row,
                  installationStatus: "pending_metering",
                  installation_status: "pending_metering",
                  meteringStatus: "pending_metering",
                  metering_status: "pending_metering",
                } as InstallerQuotation)
              : row,
          ),
        )
        try {
          const localAll = JSON.parse(localStorage.getItem("quotations") || "[]")
          if (Array.isArray(localAll)) {
            const next = localAll.map((row: any) =>
              row?.id === quotation.id
                ? {
                    ...row,
                    installationStatus: "pending_metering",
                    installation_status: "pending_metering",
                    meteringStatus: "pending_metering",
                    metering_status: "pending_metering",
                  }
                : row,
            )
            localStorage.setItem("quotations", JSON.stringify(next))
          }
        } catch {
          // no-op
        }
        toast({
          title: "Sent to Metering",
          description: `${quotation.id} is now in the metering queue.`,
        })
      }
    } catch (error) {
      toast({
        title: "Send to metering failed",
        description: error instanceof ApiError ? error.message : apiErrorToUserMessage(error),
        variant: "destructive",
      })
    } finally {
      setSendingToMeteringId(null)
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
            onClick={async () => {
              await logout()
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
          <h1 className="text-xl font-semibold">
            {role === "installation-team" ? "Installation team" : "Installer Dashboard"}
          </h1>
        </div>
        <p className="text-sm text-muted-foreground">
          {role === "installation-team" ? (
            <>
              Signed in as <span className="font-medium text-foreground">{installationTeamUser?.teamName || installationTeamUser?.username}</span>
              . You only see jobs assigned to your team by admin.
            </>
          ) : (
            <>
              Welcome, {installer?.firstName || "Installer"}. Process pending jobs, assign teams, and upload completion proof.
            </>
          )}
        </p>

        <Card className="border-border/60 bg-card/90 shadow-sm">
          <CardContent className="pt-5 space-y-3">
            <div className="w-full rounded-lg border border-border/70 bg-muted/30 p-1 flex flex-wrap gap-1">
              {(
                [
                  { key: "all" as const, label: "All", count: sortedQuotations.length },
                  { key: "pending" as const, label: "Pending Installation", count: pendingQuotations.length },
                  { key: "approved" as const, label: "Approved Installation", count: approvedQuotations.length },
                ] as const
              ).map((item) => (
                <Button
                  key={item.key}
                  type="button"
                  size="sm"
                  variant={activeTab === item.key ? "default" : "ghost"}
                  className={`h-8 text-xs gap-1.5 ${activeTab === item.key ? "shadow-sm" : ""}`}
                  onClick={() => setActiveTab(item.key)}
                >
                  {item.key === "pending" ? <Clock3 className="w-3.5 h-3.5" /> : null}
                  {item.key === "approved" ? <CheckCircle2 className="w-3.5 h-3.5" /> : null}
                  {item.label} ({item.count})
                </Button>
              ))}
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by name, mobile, email, or ID..."
                  className="h-9 pl-8 text-sm"
                />
              </div>
              {canManageInstallationTeams ? (
                <Button
                  type="button"
                  variant="secondary"
                  className="h-9 shrink-0"
                  onClick={() => setInstallationTeamsDialogOpen(true)}
                >
                  <Users className="w-4 h-4 mr-2" />
                  Installation teams
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>

        {canManageInstallationTeams ? (
          <InstallationTeamsDialog
            open={installationTeamsDialogOpen}
            onOpenChange={setInstallationTeamsDialogOpen}
            useApi={useApi}
            createdBy={installer?.username || installer?.firstName}
            onTeamsChanged={() => {
              setInstallationTeamsRefresh((n) => n + 1)
              void (async () => {
                const teams = await loadInstallationTeamsList(useApi)
                setInstallationTeams(teams)
                const teamIds = new Set(teams.map((t) => t.id))
                setQuotations((prev) =>
                  prev.map((q) => {
                    const tid = getInstallationTeamIdForQuotation(q.id, q as Record<string, unknown>)
                    if (tid && !teamIds.has(tid)) {
                      const next = { ...q } as InstallerQuotation
                      delete (next as Record<string, unknown>).installationTeamId
                      delete (next as Record<string, unknown>).installation_team_id
                      return next
                    }
                    return q
                  }),
                )
              })()
            }}
          />
        ) : null}

        <div className="space-y-3 pt-2">
          {isLoading ? (
            <Card>
              <CardContent className="py-8 text-sm text-muted-foreground">Loading installation queue...</CardContent>
            </Card>
          ) : activeInstallationList.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-sm text-muted-foreground text-center">
                No installer records found
              </CardContent>
            </Card>
          ) : (
            activeInstallationList.map((q) => {
              const installerStatus = getInstallerStatus(q)
              const qAny = q as Record<string, unknown>
              const dealer = getDealerDisplay(q)
              const sentToInstallationAt =
                qAny.installationReleasedAt || qAny.installation_released_at || getAdminApprovedDate(q)
              const sendToMetering = getSendToMeteringMenuState(q as Record<string, unknown>)
              const photoThumbs = gatherInstallationPublicImageUrls(qAny, 24)

              return (
                <Card key={q.id} className="border-border/60 bg-gradient-to-r from-card to-muted/20 shadow-sm">
                  <CardContent className="p-4">
                    <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(200px,1fr)_130px_170px_150px_150px_auto] lg:items-center">
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Customer</p>
                        <p className="text-sm font-semibold leading-tight">
                          {formatPersonName(q.customer?.firstName, q.customer?.lastName, "Unknown")}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {q.customer?.mobile || "No mobile"} • {q.id}
                        </p>
                        <div className="mt-2 border-t border-dashed border-border/60 pt-2">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-primary/90">Dealer</p>
                          <p className="text-xs font-medium leading-snug text-foreground">{dealer.name}</p>
                          <p className="text-[11px] text-muted-foreground">{dealer.mobile}</p>
                        </div>
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Sent to installation</p>
                        <p className="text-xs font-medium flex items-center gap-1">
                          <CalendarDays className="w-3 h-3 text-muted-foreground" />
                          {sentToInstallationAt
                            ? new Date(String(sentToInstallationAt)).toLocaleDateString("en-IN")
                            : "N/A"}
                        </p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Installation date</p>
                        <p className="text-xs font-medium flex items-center gap-1 mt-0.5">
                          <CalendarDays className="w-3 h-3 text-muted-foreground" />
                          {getInstallationDateLabel(q)}
                        </p>
                      </div>
                      <div className="min-w-0">
                        {canManageInstallationTeams ? (
                          <>
                            <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Team</Label>
                            <Select
                              key={`inst-team-${q.id}-${installationTeamsRefresh}`}
                              value={getInstallationTeamIdForQuotation(q.id, q as Record<string, unknown>) || "__none__"}
                              onValueChange={(v) =>
                                void handlePersistInstallationTeamAssignment(q.id, v === "__none__" ? "" : v)
                              }
                            >
                              <SelectTrigger className="h-8 text-xs mt-0.5">
                                <SelectValue placeholder="Unassigned" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">Unassigned</SelectItem>
                                {installationTeams.map((t) => (
                                  <SelectItem key={t.id} value={t.id}>
                                    {t.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </>
                        ) : (
                          <>
                            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Team</p>
                            <p className="text-xs font-medium mt-0.5">{getTeamDisplayName(q)}</p>
                          </>
                        )}
                      </div>
                      <div className="min-w-0">
                        <Badge variant="outline" className="text-xs capitalize">
                          {installerStatus === "approved"
                            ? "Approved Installation"
                            : installerStatus === "inprogress"
                              ? "Installer In Progress"
                              : "Pending Installation"}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap items-center justify-start gap-2 lg:ml-auto lg:justify-end">
                        {installerStatus === "pending" ? (
                          <>
                            <Button variant="outline" size="sm" onClick={() => setInProgress(q)}>
                              <Clock3 className="w-3.5 h-3.5 mr-1" />
                              Start In Progress
                            </Button>
                            <Button size="sm" onClick={() => openUploadPanel(q)}>
                              <ChevronDown className="w-3.5 h-3.5 mr-1" />
                              Upload
                            </Button>
                          </>
                        ) : null}
                        {installerStatus === "inprogress" ? (
                          <Button size="sm" onClick={() => openUploadPanel(q)}>
                            <ChevronDown className="w-3.5 h-3.5 mr-1" />
                            Upload
                          </Button>
                        ) : null}
                        {installerStatus === "approved" ? (
                          <>
                            {sendToMetering.visible ? (
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => void handleSendToMetering(q)}
                                disabled={sendingToMeteringId === q.id}
                                className={!sendToMetering.enabled ? "opacity-60" : ""}
                                title={sendToMetering.hint || "Send to metering team"}
                              >
                                <Gauge className="w-3.5 h-3.5 mr-1" />
                                {sendingToMeteringId === q.id ? "Sending..." : "Send to Metering"}
                              </Button>
                            ) : null}
                            <Button type="button" size="sm" variant="secondary" onClick={() => openUploadPanel(q)}>
                              <Edit className="w-3.5 h-3.5 mr-1" />
                              Edit photos
                            </Button>
                          </>
                        ) : null}
                      </div>
                    </div>

                    {installerStatus === "approved" ? (
                      <div className="mt-3 space-y-2 border-t border-border/60 pt-3">
                        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                          Uploaded installation photos
                        </p>
                        {photoThumbs.length === 0 ? (
                          <p className="text-[11px] text-muted-foreground">
                            No photos on file yet. Use <span className="font-medium">Edit photos</span> to add or replace
                            images.
                          </p>
                        ) : (
                          <div className="flex max-w-full gap-3 overflow-x-auto pb-1">
                            {photoThumbs.map((url, idx) => (
                              <InstallationPublicPhoto key={`${q.id}-inst-${idx}`} rawUrl={url} quotationId={q.id} />
                            ))}
                          </div>
                        )}
                      </div>
                    ) : null}

                    {expandedQuotationId === q.id ? (
                      <div className="mt-4">
                        <InstallationCompletionPanel
                          loadingText={loadingDetailsForId === q.id ? "Loading full customer/quotation details..." : undefined}
                          imageFields={INSTALLATION_IMAGE_FIELDS}
                          filesByField={uploadFilesByQuotation[q.id] || {}}
                          onFilesChange={(fieldKey, files) =>
                            uploadInstallerFieldFiles(q.id, fieldKey as InstallationImageFieldKey, files)
                          }
                          piFile={piUploadByQuotation[q.id] || null}
                          onPiFileChange={(file) => uploadInstallerPiFile(q.id, file)}
                          uploadingKey={
                            uploadingAssetKey?.startsWith(`${q.id}:`)
                              ? uploadingAssetKey.slice(`${q.id}:`.length)
                              : null
                          }
                          extraExpenses={extraExpenseLinesByQuotation[q.id] || []}
                          onAddExpense={() =>
                            setExtraExpenseLinesByQuotation((prev) => ({
                              ...prev,
                              [q.id]: [...(prev[q.id] || []), { id: newExpenseLineId(), description: "", amount: "" }],
                            }))
                          }
                          onExpenseChange={(id, patch) =>
                            setExtraExpenseLinesByQuotation((prev) => ({
                              ...prev,
                              [q.id]: (prev[q.id] || []).map((line) => (line.id === id ? { ...line, ...patch } : line)),
                            }))
                          }
                          onRemoveExpense={(id) =>
                            setExtraExpenseLinesByQuotation((prev) => ({
                              ...prev,
                              [q.id]: (prev[q.id] || []).filter((line) => line.id !== id),
                            }))
                          }
                          dimensions={dimensionsByQuotation[q.id] || { length: "", width: "", height: "" }}
                          onDimensionsChange={(next) =>
                            setDimensionsByQuotation((prev) => ({
                              ...prev,
                              [q.id]: {
                                ...(prev[q.id] || { length: "", width: "", height: "" }),
                                ...(next.length !== undefined ? { length: next.length } : {}),
                                ...(next.width !== undefined ? { width: next.width } : {}),
                                ...(next.height !== undefined ? { height: next.height } : {}),
                              },
                            }))
                          }
                          notes={uploadNotes[q.id] || ""}
                          onNotesChange={(value) => setUploadNotes((prev) => ({ ...prev, [q.id]: value }))}
                          infoSections={[
                            {
                              title: "Customer Details",
                              rows: getCustomerInfoRows(q).map((row) => ({ label: row.label, value: String(row.value) })),
                              emptyText: "No customer details available.",
                            },
                            {
                              title: "Visitor / Location Details",
                              rows: [...getVisitorDetailsRows(q), ...getVisitorLegRows(q, dimensionsByQuotation[q.id])].map(
                                (row) => ({
                                  label: row.label,
                                  value:
                                    row.label === "Location Link" ? (
                                      <a
                                        href={String(row.value)}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="font-medium text-right text-primary hover:underline break-all"
                                      >
                                        {String(row.value)}
                                      </a>
                                    ) : (
                                      String(row.value)
                                    ),
                                }),
                              ),
                              emptyText: "No visitor/location details available.",
                            },
                            {
                              title: "Product Specification",
                              rows: getProductSpecRows(q).map((row) => ({ label: row.label, value: String(row.value) })),
                              emptyText: "No product specification available.",
                            },
                          ]}
                          saveLabel={installerStatus === "approved" ? "Save changes" : "Complete & Mark as Approved"}
                          saving={savingId === q.id}
                          onCancel={() => setExpandedQuotationId(null)}
                          onSave={() => void handleApproveInstallation(q)}
                        />
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              )
            })
          )}
        </div>
      </main>
    </div>
  )
}
