"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { api, ApiError, apiErrorToUserMessage } from "@/lib/api"
import { API_CONFIG } from "@/lib/api-config"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Calendar,
  Clock,
  MapPin,
  LogOut,
  Menu,
  Users,
  User,
  Phone,
  Mail,
  Home,
  IndianRupee,
  Download,
  CheckCircle,
  XCircle,
  MessageSquare,
  UserCircle,
  Search,
  Filter,
  Link,
  Upload,
  X,
  Image as ImageIcon,
} from "lucide-react"
import type { Quotation } from "@/lib/quotation-context"
import type { Dealer } from "@/lib/auth-context"
import { QuotationDetailsDialog } from "@/components/quotation-details-dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

type VisitStatus = "pending" | "approved" | "completed" | "incomplete" | "rejected" | "rescheduled"
type VisitStatusTab = VisitStatus | "all"

const VISIT_STATUS_TAB_OPTIONS: Array<{ value: VisitStatusTab; label: string }> = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "completed", label: "Completed" },
  { value: "incomplete", label: "Incomplete" },
  { value: "rescheduled", label: "Rescheduled" },
  { value: "rejected", label: "Rejected" },
  { value: "all", label: "All" },
]

interface Visit {
  id: string
  date: string
  time: string
  location: string
  locationLink?: string
  notes?: string
  status?: VisitStatus
  feedback?: string
  rejectionReason?: string
  length?: number
  width?: number
  height?: number
  /** Site dimensions in feet (visitor complete visit). */
  backLegFeet?: number
  midLegFeet?: number
  frontLegFeet?: number
  unit?: "feet" | "cm"
  rowDiagramImage?: string
  meterImage?: string
  images?: string[]
  visitors?: Array<{
    visitorId: string
    visitorName: string
  }>
  createdAt: string
}

interface VisitWithQuotation extends Visit {
  quotation: Quotation
  quotationId: string
  dealer?: {
    id: string
    firstName: string
    lastName: string
  }
}

const getVisitStartTime = (timeRange: string) => (timeRange || "").split("-")[0]?.trim()
const getVisitEndTime = (timeRange: string) => (timeRange || "").split("-")[1]?.trim()
const normalizeVisitStatus = (value?: string): VisitStatus => {
  const raw = String(value || "").trim().toLowerCase().replace(/\s+/g, "_")
  if (!raw) return "pending"
  if (raw === "approve" || raw === "approved") return "approved"
  if (raw === "complete" || raw === "completed") return "completed"
  if (raw === "incomplete" || raw === "partially_completed") return "incomplete"
  if (raw === "reschedule" || raw === "rescheduled") return "rescheduled"
  if (raw === "reject" || raw === "rejected") return "rejected"
  if (raw === "pending") return "pending"
  return "pending"
}
const resolveVisitTimeRange = (visit: any) => {
  const start = (visit?.visitStartTime || visit?.startTime || "").trim()
  const end = (visit?.visitEndTime || visit?.endTime || "").trim()
  if (start && end) return `${start} - ${end}`
  const explicitRange = (visit?.visitTimeRange || visit?.timeRange || "").trim()
  if (explicitRange) return explicitRange
  return (visit?.visitTime || visit?.time || "").trim()
}
const normalizeTimeForApi = (value: string) => {
  const raw = (value || "").trim().replace(/\u202f/g, " ").replace(/\./g, "")
  if (!raw) return ""

  const basic = raw.match(/^(\d{1,2}):([0-5]\d)(?::[0-5]\d)?$/)
  if (basic) {
    const hours = Number.parseInt(basic[1], 10)
    if (hours >= 0 && hours <= 23) return `${String(hours).padStart(2, "0")}:${basic[2]}`
    return ""
  }

  const ampm = raw.match(/^(\d{1,2}):([0-5]\d)\s*([AaPp][Mm])$/)
  if (ampm) {
    let hours = Number.parseInt(ampm[1], 10)
    if (hours < 1 || hours > 12) return ""
    const minutes = ampm[2]
    const meridiem = ampm[3].toUpperCase()
    if (meridiem === "PM" && hours < 12) hours += 12
    if (meridiem === "AM" && hours === 12) hours = 0
    return `${String(hours).padStart(2, "0")}:${minutes}`
  }

  return ""
}

const pickFirstNumber = (...values: any[]): number | undefined => {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value
    if (typeof value === "string" && value.trim() !== "") {
      const parsed = Number.parseFloat(value)
      if (Number.isFinite(parsed)) return parsed
    }
  }
  return undefined
}

const normalizeMediaUrl = (raw: any): string | undefined => {
  if (!raw) return undefined
  const value = typeof raw === "string" ? raw.trim() : ""
  if (!value) return undefined

  const normalizeLikelyDoubleEncodedS3Url = (urlStr: string) => {
    try {
      const parsed = new URL(urlStr)
      const host = parsed.hostname.toLowerCase()
      const isAwsHost = host.includes("amazonaws.com")
      if (!isAwsHost) return urlStr

      let nextPath = parsed.pathname
      // Some backends send `%2520` (double-encoded). Decode a couple of passes max.
      for (let i = 0; i < 2; i += 1) {
        if (!nextPath.includes("%25")) break
        nextPath = decodeURIComponent(nextPath)
      }
      if (nextPath !== parsed.pathname) {
        parsed.pathname = nextPath
        return parsed.toString()
      }
      return urlStr
    } catch {
      return urlStr
    }
  }
  if (
    value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("data:") ||
    value.startsWith("blob:")
  ) {
    return normalizeLikelyDoubleEncodedS3Url(value)
  }
  if (value.startsWith("//")) return `https:${value}`
  if (value.startsWith("/")) {
    if (typeof window !== "undefined") return `${window.location.origin}${value}`
    return value
  }
  if (value.startsWith("s3://")) {
    const withoutScheme = value.replace(/^s3:\/\//, "")
    const slashIdx = withoutScheme.indexOf("/")
    if (slashIdx > 0) {
      const bucket = withoutScheme.slice(0, slashIdx)
      const key = withoutScheme.slice(slashIdx + 1)
      return `https://${bucket}.s3.amazonaws.com/${key}`
    }
  }
  const mediaBase = String(process.env.NEXT_PUBLIC_MEDIA_BASE_URL || "").trim().replace(/\/+$/, "")
  if (mediaBase) {
    return `${mediaBase}/${value.replace(/^\/+/, "")}`
  }
  const apiHost = API_CONFIG.baseURL.replace(/\/api\/?$/, "")
  return `${apiHost}/${value.replace(/^\/+/, "")}`
}

const extractImageList = (visit: any): string[] => {
  const sources = [
    visit?.images,
    visit?.siteImages,
    visit?.site_images,
    visit?.completionImages,
    visit?.completion_images,
    visit?.documents?.siteCompletionImages,
    visit?.documents?.site_completion_images,
    visit?.documents?.images,
  ]
  const result: string[] = []
  sources.forEach((source) => {
    if (!Array.isArray(source)) return
    source.forEach((item) => {
      const maybeUrl =
        typeof item === "string"
          ? item
          : item?.url || item?.s3Url || item?.s3_url || item?.location || item?.path || item?.key
      const normalized = normalizeMediaUrl(maybeUrl)
      if (normalized && !result.includes(normalized)) result.push(normalized)
    })
  })
  return result
}

const buildVisitQuotation = (visit: any, quotationOverride?: any): Quotation => {
  const source = quotationOverride || visit?.quotation || {}
  const customer = source.customer || visit?.customer || {}
  return {
    ...source,
    id: String(source.id || visit?.quotation?.id || ""),
    customer,
    products: source.products || {},
    discount: source.discount || 0,
    subtotal:
      source.subtotal ??
      source.pricing?.subtotal ??
      source.totalAmount ??
      visit?.quotation?.finalAmount ??
      0,
    totalAmount:
      source.totalAmount ??
      source.pricing?.totalAmount ??
      visit?.quotation?.finalAmount ??
      0,
    finalAmount:
      source.finalAmount ??
      source.pricing?.finalAmount ??
      visit?.quotation?.finalAmount ??
      0,
    createdAt: source.createdAt || visit?.quotation?.createdAt || "",
    dealerId: source.dealerId || visit?.dealer?.id || "",
    status: source.status || "pending",
  } as Quotation
}

const mapVisitApiRecord = (
  visit: any,
  options?: { includeDetails?: boolean; quotationOverride?: any },
): VisitWithQuotation => {
  const includeDetails = options?.includeDetails === true
  const completion = includeDetails
    ? visit?.completionDetails || visit?.completion_details || {}
    : {}
  const dimensions = includeDetails
    ? visit?.siteDimensions ||
      visit?.site_dimensions ||
      completion.siteDimensions ||
      completion.site_dimensions ||
      {}
    : {}
  const rawVisitors = Array.isArray(visit?.visitors)
    ? visit.visitors
    : Array.isArray(visit?.otherVisitors)
      ? visit.otherVisitors
      : []

  return {
    id: String(visit?.id || ""),
    date: String(visit?.visitDate || visit?.date || ""),
    time: resolveVisitTimeRange(visit),
    location: String(visit?.location || visit?.visitLocation || ""),
    locationLink: visit?.locationLink || visit?.location_link,
    notes: visit?.notes || (includeDetails ? completion.notes : undefined),
    status: normalizeVisitStatus(visit?.status || visit?.visitStatus || visit?.visit_status),
    feedback: visit?.feedback,
    rejectionReason: visit?.rejectionReason || visit?.rejection_reason,
    length: includeDetails
      ? pickFirstNumber(
          visit?.length,
          visit?.lengthFeet,
          visit?.length_feet,
          dimensions.length,
          dimensions.lengthFeet,
          dimensions.length_feet,
        )
      : undefined,
    width: includeDetails
      ? pickFirstNumber(
          visit?.width,
          visit?.widthFeet,
          visit?.width_feet,
          dimensions.width,
          dimensions.widthFeet,
          dimensions.width_feet,
        )
      : undefined,
    height: includeDetails
      ? pickFirstNumber(visit?.height, dimensions.height, dimensions.heightFeet, dimensions.height_feet)
      : undefined,
    backLegFeet: includeDetails
      ? pickFirstNumber(visit?.backLegFeet, visit?.back_leg_feet, dimensions.backLegFeet, dimensions.back_leg_feet)
      : undefined,
    midLegFeet: includeDetails
      ? pickFirstNumber(visit?.midLegFeet, visit?.mid_leg_feet, dimensions.midLegFeet, dimensions.mid_leg_feet)
      : undefined,
    frontLegFeet: includeDetails
      ? pickFirstNumber(visit?.frontLegFeet, visit?.front_leg_feet, dimensions.frontLegFeet, dimensions.front_leg_feet)
      : undefined,
    unit: includeDetails ? ((visit?.unit || dimensions.unit || completion.unit || "feet") as "feet" | "cm") : undefined,
    rowDiagramImage: includeDetails
      ? normalizeMediaUrl(
          visit?.rowDiagramImage ||
            visit?.row_diagram_image ||
            completion.rowDiagramImage ||
            completion.row_diagram_image ||
            visit?.documents?.rowDiagramImage ||
            visit?.documents?.row_diagram_image ||
            visit?.documents?.rowDiagram ||
            visit?.documents?.row_diagram,
        )
      : undefined,
    meterImage: includeDetails
      ? normalizeMediaUrl(
          visit?.meterImage ||
            visit?.meter_image ||
            completion.meterImage ||
            completion.meter_image ||
            visit?.documents?.meterImage ||
            visit?.documents?.meter_image ||
            visit?.documents?.meterPhoto ||
            visit?.documents?.meter_photo,
        )
      : undefined,
    images: includeDetails ? extractImageList(visit) : undefined,
    visitors: rawVisitors
      .map((item: any) => ({
        visitorId: String(item?.visitorId || item?.id || ""),
        visitorName: String(item?.visitorName || item?.name || "").trim(),
      }))
      .filter((item: { visitorId: string; visitorName: string }) => item.visitorId || item.visitorName),
    createdAt: visit?.createdAt || "",
    quotation: buildVisitQuotation(visit, options?.quotationOverride),
    quotationId: String(options?.quotationOverride?.id || visit?.quotation?.id || ""),
    dealer: visit?.dealer
      ? {
          id: String(visit.dealer.id || ""),
          firstName: String(visit.dealer.firstName || ""),
          lastName: String(visit.dealer.lastName || ""),
        }
      : undefined,
  }
}

export default function VisitorDashboardPage() {
  const { visitor, role, isAuthenticated, logout } = useAuth()
  const router = useRouter()
  const { toast } = useToast()
  const [assignedVisits, setAssignedVisits] = useState<VisitWithQuotation[]>([])
  const [selectedQuotation, setSelectedQuotation] = useState<Quotation | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [visitDetailsOpen, setVisitDetailsOpen] = useState(false)
  const [visitDetailsLoading, setVisitDetailsLoading] = useState(false)
  const [visitDetailsError, setVisitDetailsError] = useState<string | null>(null)
  const [visitDetails, setVisitDetails] = useState<VisitWithQuotation | null>(null)
  const [statusDialogOpen, setStatusDialogOpen] = useState(false)
  const [selectedVisit, setSelectedVisit] = useState<VisitWithQuotation | null>(null)
  const [statusAction, setStatusAction] = useState<"approve" | "reject" | null>(null)
  const [feedback, setFeedback] = useState("")
  const [rejectionReason, setRejectionReason] = useState("")
  const [searchTerm, setSearchTerm] = useState("")
  const [agentFilter, setAgentFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState<VisitStatus | "all">("all")
  const [dateFilter, setDateFilter] = useState("all")
  const [activeStatusTab, setActiveStatusTab] = useState<VisitStatusTab>("pending")
  const [currentPage, setCurrentPage] = useState(1)
  const VISITS_PER_PAGE = 10
  const [mobileStatusMenuOpen, setMobileStatusMenuOpen] = useState(false)
  const [approveOutcome, setApproveOutcome] = useState<"completed" | "incomplete" | "rescheduled" | null>(null)
  const [approvedVisits, setApprovedVisits] = useState<Set<string>>(new Set())
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false)
  const [incompleteRescheduleDialogOpen, setIncompleteRescheduleDialogOpen] = useState(false)
  const [lengthFeet, setLengthFeet] = useState("")
  const [widthFeet, setWidthFeet] = useState("")
  const [backLegFeet, setBackLegFeet] = useState("")
  const [midLegFeet, setMidLegFeet] = useState("")
  const [frontLegFeet, setFrontLegFeet] = useState("")
  const [imagePreviews, setImagePreviews] = useState<string[]>([])
  const [rowDiagramPreview, setRowDiagramPreview] = useState<string | null>(null)
  const [meterImagePreview, setMeterImagePreview] = useState<string | null>(null)
  /** Count of site images already on the visit when the complete dialog opens (URL strings). */
  const [persistedSiteImageCount, setPersistedSiteImageCount] = useState(0)
  const [reason, setReason] = useState("")
  const [completeNotes, setCompleteNotes] = useState("")
  const [rescheduleDate, setRescheduleDate] = useState("")
  const [rescheduleStartTime, setRescheduleStartTime] = useState("")
  const [rescheduleEndTime, setRescheduleEndTime] = useState("")
  const [rescheduleDecision, setRescheduleDecision] = useState<"rescheduled" | "completed" | "incomplete" | "rejected">(
    "rescheduled",
  )
  const [isLoadingVisits, setIsLoadingVisits] = useState(false)
  const [isCompletingVisit, setIsCompletingVisit] = useState(false)
  const [isUploadingCompleteAsset, setIsUploadingCompleteAsset] = useState(false)
  const activeStatusTabLabel =
    VISIT_STATUS_TAB_OPTIONS.find((option) => option.value === activeStatusTab)?.label || "Pending"

  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, agentFilter, statusFilter, dateFilter, activeStatusTab])

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/visitor-login")
      return
    }

    if (role !== "visitor") {
      router.push("/dashboard")
      return
    }

    if (visitor) {
      loadAssignedVisits()
    }
  }, [isAuthenticated, role, router, visitor])

  const useApi = process.env.NEXT_PUBLIC_USE_API !== "false"

  const loadAssignedVisits = async () => {
    if (!visitor) return

    setIsLoadingVisits(true)
    try {
      if (useApi) {
        // Some backends default this endpoint to pending-only when status is omitted.
        // Request all statuses explicitly so all tabs (approved/completed/etc) can populate.
        const response = await api.visitors.getAssignedVisits({ status: "all" })
        const visitsList = Array.isArray(response?.visits)
          ? response.visits
          : Array.isArray(response)
            ? response
            : Array.isArray(response?.data?.visits)
              ? response.data.visits
              : []
        const visits: VisitWithQuotation[] = visitsList.map((v: any) => mapVisitApiRecord(v))

        setAssignedVisits(visits)
      } else {
        // Fallback to localStorage
        const allQuotations = JSON.parse(localStorage.getItem("quotations") || "[]")
        const visits: VisitWithQuotation[] = []

        // Iterate through all quotations
        allQuotations.forEach((quotation: Quotation) => {
          const storedVisits = localStorage.getItem(`visits_${quotation.id}`)
          if (storedVisits) {
            const quotationVisits: Visit[] = JSON.parse(storedVisits)
            quotationVisits.forEach((visit) => {
              // Check if this visitor is assigned to this visit
              if (visit.visitors && visit.visitors.some((v) => v.visitorId === visitor.id)) {
                visits.push({
                  ...visit,
                  quotation,
                  quotationId: quotation.id,
                })
              }
            })
          }
        })

        // Sort by date and time
        visits.sort((a, b) => {
          const dateA = new Date(`${a.date}T${getVisitStartTime(a.time) || a.time}`)
          const dateB = new Date(`${b.date}T${getVisitStartTime(b.time) || b.time}`)
          return dateA.getTime() - dateB.getTime()
        })

        setAssignedVisits(visits)
      }
    } catch (error) {
      console.error("Error loading assigned visits:", error)
    } finally {
      setIsLoadingVisits(false)
    }
  }

  const extractVisitRecords = (payload: any): any[] => {
    if (Array.isArray(payload?.visits)) return payload.visits
    if (Array.isArray(payload?.data?.visits)) return payload.data.visits
    if (Array.isArray(payload)) return payload
    if (payload && typeof payload === "object" && payload.id) return [payload]
    return []
  }

  const fetchDetailedVisitRecord = async (visit: VisitWithQuotation): Promise<VisitWithQuotation> => {
    if (!useApi) return visit

    const [visitResult, quotationResult] = await Promise.allSettled([
      api.visits.getByQuotation(visit.quotationId),
      api.quotations.getById(visit.quotationId),
    ])

    const quotationPayload =
      quotationResult.status === "fulfilled" && quotationResult.value && typeof quotationResult.value === "object"
        ? quotationResult.value
        : undefined
    const visitPayload = visitResult.status === "fulfilled" ? visitResult.value : undefined
    const candidates = extractVisitRecords(visitPayload)
    const matched =
      candidates.find((item) => String(item?.id || "") === visit.id) ||
      candidates.find((item) => String(item?.quotation?.id || "") === visit.quotationId) ||
      null

    if (!matched && quotationPayload) {
      return {
        ...visit,
        quotation: buildVisitQuotation({}, quotationPayload),
      }
    }

    if (!matched) return visit
    return mapVisitApiRecord(matched, {
      includeDetails: true,
      quotationOverride: quotationPayload,
    })
  }

  const openVisitDetails = async (visit: VisitWithQuotation) => {
    setVisitDetails(visit)
    setVisitDetailsError(null)
    setSelectedQuotation(visit.quotation)
    setVisitDetailsOpen(true)

    if (!useApi) return

    setVisitDetailsLoading(true)
    try {
      const detailed = await fetchDetailedVisitRecord(visit)
      setVisitDetails(detailed)
      setSelectedQuotation(detailed.quotation)
    } catch (error) {
      setVisitDetailsError(apiErrorToUserMessage(error))
    } finally {
      setVisitDetailsLoading(false)
    }
  }

  const handleLogout = async () => {
    await logout()
    router.push("/")
  }

  const applyVisitUpdateFallback = (
    quotationId: string,
    visitId: string,
    updater: (visit: VisitWithQuotation) => VisitWithQuotation,
  ) => {
    setAssignedVisits((prev) => prev.map((v) => (v.id === visitId ? updater(v) : v)))

    // Best-effort local persistence so page reload preserves fallback update.
    if (!useApi) {
      try {
        const key = `visits_${quotationId}`
        const storedVisits = JSON.parse(localStorage.getItem(key) || "[]")
        if (Array.isArray(storedVisits) && storedVisits.length > 0) {
          const updatedVisits = storedVisits.map((v: Visit) => {
            if (v.id !== visitId) return v
            const merged = updater({
              ...v,
              quotation: selectedVisit?.quotation as Quotation,
              quotationId,
              createdAt: v.createdAt || new Date().toISOString(),
            } as VisitWithQuotation)
            const { quotation, quotationId: _qid, dealer, ...plainVisit } = merged
            return plainVisit as Visit
          })
          localStorage.setItem(key, JSON.stringify(updatedVisits))
        }
      } catch {
        // ignore localStorage fallback errors
      }
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString("en-IN", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  const formatSingleTime = (timeString: string) => {
    const [hours, minutes] = timeString.split(":")
    const hour = Number.parseInt(hours)
    const ampm = hour >= 12 ? "PM" : "AM"
    const displayHour = hour % 12 || 12
    return `${displayHour}:${minutes} ${ampm}`
  }

  const formatTime = (timeString: string) => {
    const startTime = getVisitStartTime(timeString)
    const endTime = getVisitEndTime(timeString)
    if (startTime && endTime) {
      return `${formatSingleTime(startTime)} - ${formatSingleTime(endTime)}`
    }
    return formatSingleTime(timeString)
  }

  const isPastVisit = (visit: Visit) => {
    const visitDateTime = new Date(`${visit.date}T${getVisitStartTime(visit.time) || visit.time}`)
    return visitDateTime < new Date()
  }

  const openLocationInMaps = (location: string) => {
    const encodedLocation = encodeURIComponent(location)
    const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodedLocation}`
    window.open(mapsUrl, "_blank")
  }

  const openLocationLink = (locationLink: string) => {
    // If it's already a full URL, open it directly
    if (locationLink.startsWith("http://") || locationLink.startsWith("https://")) {
      window.open(locationLink, "_blank")
    } else {
      // If it's GPS coordinates or partial URL, try to open as Google Maps
      const mapsUrl = locationLink.includes("maps.google.com") 
        ? locationLink 
        : `https://www.google.com/maps/?q=${encodeURIComponent(locationLink)}`
      window.open(mapsUrl, "_blank")
    }
  }

  const getMyAvailability = (visit: Visit) => {
    if (!visit.visitors || !visitor) return null
    const myVisitor = visit.visitors.find((v) => v.visitorId === visitor.id)
    return myVisitor
  }

  const getDealerName = (dealerId: string, visit?: VisitWithQuotation): string => {
    // First, try to get dealer name from the visit object if available (from API)
    if (visit?.dealer) {
      return `${visit.dealer.firstName} ${visit.dealer.lastName}`.trim() || "Unknown Agent"
    }
    
    // Fallback to localStorage for non-API mode
    if (!useApi) {
      const dealers = JSON.parse(localStorage.getItem("dealers") || "[]")
      const dealer = dealers.find((d: Dealer & { password?: string }) => d.id === dealerId)
      return dealer ? `${dealer.firstName} ${dealer.lastName}` : "Unknown Agent"
    }
    
    // If using API but dealer info not available, return unknown
    return "Unknown Agent"
  }

  const getUniqueAgents = (): Array<{ id: string; name: string }> => {
    const agentMap = new Map<string, string>()
    assignedVisits.forEach((visit) => {
      const dealerId = visit.quotation.dealerId
      // Only add agents with non-empty IDs
      if (dealerId && dealerId.trim() && !agentMap.has(dealerId)) {
        agentMap.set(dealerId, getDealerName(dealerId, visit))
      }
    })
    // Filter out any entries with empty IDs (safety check)
    return Array.from(agentMap.entries())
      .filter(([id]) => id && id.trim())
      .map(([id, name]) => ({ id, name }))
  }

  const handleStatusAction = async (visit: VisitWithQuotation, action: "approve" | "reject") => {
    setSelectedVisit(visit)
    setStatusAction(action)
    if (action === "approve") {
      try {
        if (useApi) {
          await api.visits.approve(visit.id)
          await loadAssignedVisits()
        } else {
          // Fallback to localStorage
          const storedVisits = JSON.parse(localStorage.getItem(`visits_${visit.quotationId}`) || "[]")
          const updatedVisits = storedVisits.map((v: Visit) => {
            if (v.id === visit.id) {
              return {
                ...v,
                status: "approved",
              }
            }
            return v
          })
          localStorage.setItem(`visits_${visit.quotationId}`, JSON.stringify(updatedVisits))
          await loadAssignedVisits()
        }
      } catch (error) {
        console.error("Error approving visit:", error)
        alert(error instanceof ApiError ? error.message : "Failed to approve visit")
      }
    } else {
      // Open reject dialog
      setRejectionReason(visit.rejectionReason || "")
      setStatusDialogOpen(true)
    }
  }

  const handleApproveOutcomeClick = (
    outcome: "completed" | "incomplete" | "rescheduled",
    visit?: VisitWithQuotation,
  ) => {
    const targetVisit = visit ?? selectedVisit
    if (!targetVisit) return
    setSelectedVisit(targetVisit)
    setApproveOutcome(outcome)
    if (outcome === "completed") {
      // Open complete dialog with dimensions and images
      setLengthFeet(targetVisit.length?.toString() || "")
      setWidthFeet(targetVisit.width?.toString() || "")
      const hasLegs =
        targetVisit.backLegFeet != null ||
        targetVisit.midLegFeet != null ||
        targetVisit.frontLegFeet != null
      setBackLegFeet(
        targetVisit.backLegFeet?.toString() ||
          (!hasLegs && targetVisit.height != null ? targetVisit.height.toString() : "") ||
          "",
      )
      setMidLegFeet(targetVisit.midLegFeet?.toString() || "")
      setFrontLegFeet(targetVisit.frontLegFeet?.toString() || "")
      setImagePreviews(targetVisit.images || [])
      setPersistedSiteImageCount(targetVisit.images?.length ?? 0)
      setRowDiagramPreview(targetVisit.rowDiagramImage || null)
      setMeterImagePreview(targetVisit.meterImage || null)
      setCompleteNotes(targetVisit.notes || "")
      setCompleteDialogOpen(true)
    } else {
      // Open incomplete/reschedule dialog with reason
      setReason("")
      if (outcome === "rescheduled") {
        setRescheduleDecision("rescheduled")
        setRescheduleDate(targetVisit.date || "")
        setRescheduleStartTime(getVisitStartTime(targetVisit.time) || targetVisit.time || "")
        setRescheduleEndTime(getVisitEndTime(targetVisit.time) || "")
      } else {
        setRescheduleDate("")
        setRescheduleStartTime("")
        setRescheduleEndTime("")
      }
      setIncompleteRescheduleDialogOpen(true)
    }
  }

  const handleRejectVisit = async () => {
    if (!selectedVisit || !rejectionReason.trim()) return

    try {
      if (useApi) {
        await api.visits.reject(selectedVisit.id, rejectionReason.trim())
        await loadAssignedVisits()
      } else {
        // Fallback to localStorage
        const storedVisits = JSON.parse(localStorage.getItem(`visits_${selectedVisit.quotationId}`) || "[]")
        const updatedVisits = storedVisits.map((v: Visit) => {
          if (v.id === selectedVisit.id) {
            return {
              ...v,
              status: "rejected",
              rejectionReason: rejectionReason.trim(),
            }
          }
          return v
        })
        localStorage.setItem(`visits_${selectedVisit.quotationId}`, JSON.stringify(updatedVisits))
        await loadAssignedVisits()
      }
      
      setStatusDialogOpen(false)
      setSelectedVisit(null)
      setStatusAction(null)
      setRejectionReason("")
    } catch (error) {
      console.error("Error rejecting visit:", error)
      alert(error instanceof ApiError ? error.message : "Failed to reject visit")
    }
  }

  const handleCompleteVisit = async () => {
    if (!selectedVisit || isCompletingVisit) return
    if (isUploadingCompleteAsset) {
      toast({
        title: "Upload in progress",
        description: "Wait for the image uploads to finish before submitting the visit.",
        variant: "destructive",
      })
      return
    }

    setIsCompletingVisit(true)
    try {
      const visitSnapshot = selectedVisit
      const L = parseFloat(lengthFeet) || 0
      const W = parseFloat(widthFeet) || 0
      const back = parseFloat(backLegFeet) || 0
      const midParsed = parseFloat(midLegFeet)
      const mid = Number.isFinite(midParsed) ? midParsed : 0
      const front = parseFloat(frontLegFeet) || 0
      const legacyHeight = Math.max(back, mid, front)

      const allImages = [...imagePreviews]
      const visitPatch: Partial<VisitWithQuotation> = {
        status: "completed" as const,
        length: L || undefined,
        width: W || undefined,
        height: legacyHeight || undefined,
        unit: "feet" as const,
        backLegFeet: back || undefined,
        midLegFeet: midLegFeet.trim() !== "" ? mid : undefined,
        frontLegFeet: front || undefined,
        rowDiagramImage: rowDiagramPreview || undefined,
        meterImage: meterImagePreview || undefined,
        images: allImages.length > 0 ? allImages : undefined,
        notes: completeNotes.trim() || undefined,
      }

      if (useApi) {
        await api.visits.complete(visitSnapshot.id, {
          length: L,
          width: W,
          height: legacyHeight,
          unit: "feet" as const,
          backLegFeet: back,
          ...(midLegFeet.trim() !== "" ? { midLegFeet: mid } : {}),
          frontLegFeet: front,
          images: allImages,
          notes: completeNotes.trim() || undefined,
          ...(rowDiagramPreview ? { rowDiagramImage: rowDiagramPreview } : {}),
          ...(meterImagePreview ? { meterImage: meterImagePreview } : {}),
        })
      } else {
        // Local-only mode fallback
        const storedVisits = JSON.parse(localStorage.getItem(`visits_${visitSnapshot.quotationId}`) || "[]")
        const updatedVisits = storedVisits.map((v: Visit) => {
          if (v.id === visitSnapshot.id) {
            return { ...v, ...visitPatch }
          }
          return v
        })
        localStorage.setItem(`visits_${visitSnapshot.quotationId}`, JSON.stringify(updatedVisits))
      }

      // Success path: update UI quickly, then refresh authoritative server state.
      applyVisitUpdateFallback(visitSnapshot.quotationId, visitSnapshot.id, (v) => ({
        ...v,
        ...visitPatch,
      }))
      if (useApi) void loadAssignedVisits()

      setCompleteDialogOpen(false)
      setSelectedVisit(null)
      setApproveOutcome(null)
      setLengthFeet("")
      setWidthFeet("")
      setBackLegFeet("")
      setMidLegFeet("")
      setFrontLegFeet("")
      setImagePreviews([])
      setPersistedSiteImageCount(0)
      setRowDiagramPreview(null)
      setMeterImagePreview(null)
      setCompleteNotes("")
    } catch (error) {
      console.error("Error completing visit:", error)
      const message = apiErrorToUserMessage(error)
      if (error instanceof ApiError && (error.code === "AUTH_004" || /insufficient permissions/i.test(message))) {
        alert(
          "Submit blocked by backend permissions for visitor complete endpoint. Please allow visitor role on visit complete API.",
        )
      } else {
        alert(message || "Failed to complete visit")
      }
    } finally {
      setIsCompletingVisit(false)
    }
  }

  const handleIncompleteRescheduleVisit = async () => {
    if (!selectedVisit || !reason.trim() || !approveOutcome) return
    const startTime = normalizeTimeForApi(rescheduleStartTime)
    const endTime = normalizeTimeForApi(rescheduleEndTime)
    const effectiveDecision = approveOutcome === "rescheduled" ? rescheduleDecision : approveOutcome

    if (effectiveDecision === "rescheduled") {
      if (!rescheduleDate || !rescheduleStartTime || !rescheduleEndTime) {
        alert("Please select reschedule date, start time, and end time")
        return
      }
      if (!startTime || !endTime) {
        alert("Please enter valid start and end times")
        return
      }
      if (endTime <= startTime) {
        alert("End time must be after start time")
        return
      }
    }

    try {
      let syncedWithApi = false
      if (useApi) {
        try {
          if (effectiveDecision === "incomplete") {
            await api.visits.incomplete(selectedVisit.id, reason.trim())
          } else if (effectiveDecision === "rejected") {
            await api.visits.reject(selectedVisit.id, reason.trim())
          } else if (effectiveDecision === "completed") {
            setIncompleteRescheduleDialogOpen(false)
            handleApproveOutcomeClick("completed", selectedVisit)
            return
          } else if (effectiveDecision === "rescheduled") {
            await api.visits.reschedule(
              selectedVisit.id,
              {
                reason: reason.trim(),
                visitDate: rescheduleDate,
                visitTime: `${startTime} - ${endTime}`,
                visitStartTime: startTime,
                visitEndTime: endTime,
                visitTimeRange: `${startTime} - ${endTime}`,
              },
              selectedVisit.quotationId ? { quotationId: selectedVisit.quotationId } : undefined,
            )
          }
          syncedWithApi = true
          await loadAssignedVisits()
        } catch (error) {
          console.warn("Visitor status update API failed, applying local fallback:", error)
        }
      }

      if (!syncedWithApi) {
        // Fallback to localStorage
        const storedVisits = JSON.parse(localStorage.getItem(`visits_${selectedVisit.quotationId}`) || "[]")
        const updatedVisits = storedVisits.map((v: Visit) => {
          if (v.id === selectedVisit.id) {
            return {
              ...v,
              status: effectiveDecision,
              rejectionReason: effectiveDecision === "rejected" || effectiveDecision === "incomplete" ? reason.trim() : v.rejectionReason,
              ...(effectiveDecision === "rescheduled"
                ? {
                    date: rescheduleDate,
                    time: `${startTime} - ${endTime}`,
                  }
                : {}),
            }
          }
          return v
        })
        localStorage.setItem(`visits_${selectedVisit.quotationId}`, JSON.stringify(updatedVisits))
        if (updatedVisits.length > 0) {
          await loadAssignedVisits()
        } else {
          applyVisitUpdateFallback(selectedVisit.quotationId, selectedVisit.id, (v) => ({
            ...v,
            status: effectiveDecision,
            rejectionReason:
              effectiveDecision === "rejected" || effectiveDecision === "incomplete"
                ? reason.trim()
                : v.rejectionReason,
            ...(effectiveDecision === "rescheduled"
              ? {
                  date: rescheduleDate,
                  time: `${startTime} - ${endTime}`,
                }
              : {}),
          }))
        }
      }

      setIncompleteRescheduleDialogOpen(false)
      setSelectedVisit(null)
      setStatusAction(null)
      setApproveOutcome(null)
      setReason("")
      setRescheduleDate("")
      setRescheduleStartTime("")
      setRescheduleEndTime("")
      setRescheduleDecision("rescheduled")
    } catch (error) {
      console.error("Error updating visit:", error)
      alert(error instanceof ApiError ? error.message : "Failed to update visit")
    }
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    e.target.value = ""
    if (files.length === 0) return

    if (useApi && selectedVisit) {
      setIsUploadingCompleteAsset(true)
      try {
        const uploadedUrls: string[] = []
        for (const file of files) {
          uploadedUrls.push(await api.visits.uploadCompletionAsset(selectedVisit.id, "images", file))
        }
        setImagePreviews((prev) => [...prev, ...uploadedUrls])
      } catch (error) {
        toast({
          title: "Image upload failed",
          description: apiErrorToUserMessage(error),
          variant: "destructive",
        })
      } finally {
        setIsUploadingCompleteAsset(false)
      }
      return
    }

    files.forEach((file) => {
      const reader = new FileReader()
      reader.onload = (loadEvent) => {
        setImagePreviews((prev) => [...prev, loadEvent.target?.result as string])
      }
      reader.readAsDataURL(file)
    })
  }

  const removeImage = (index: number) => {
    setImagePreviews((prev) => prev.filter((_, i) => i !== index))
    if (index < persistedSiteImageCount) {
      setPersistedSiteImageCount((c) => Math.max(0, c - 1))
    }
  }

  const handleRowDiagramUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return

    if (useApi && selectedVisit) {
      setIsUploadingCompleteAsset(true)
      try {
        const uploadedUrl = await api.visits.uploadCompletionAsset(selectedVisit.id, "rowDiagramImage", file)
        setRowDiagramPreview(uploadedUrl)
      } catch (error) {
        toast({
          title: "Row diagram upload failed",
          description: apiErrorToUserMessage(error),
          variant: "destructive",
        })
      } finally {
        setIsUploadingCompleteAsset(false)
      }
      return
    }

    const reader = new FileReader()
    reader.onload = (ev) => setRowDiagramPreview(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  const clearRowDiagram = () => {
    setRowDiagramPreview(null)
  }

  const handleMeterImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return

    if (useApi && selectedVisit) {
      setIsUploadingCompleteAsset(true)
      try {
        const uploadedUrl = await api.visits.uploadCompletionAsset(selectedVisit.id, "meterImage", file)
        setMeterImagePreview(uploadedUrl)
      } catch (error) {
        toast({
          title: "Meter image upload failed",
          description: apiErrorToUserMessage(error),
          variant: "destructive",
        })
      } finally {
        setIsUploadingCompleteAsset(false)
      }
      return
    }

    const reader = new FileReader()
    reader.onload = (ev) => setMeterImagePreview(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  const clearMeterImage = () => {
    setMeterImagePreview(null)
  }


  const getStatusColor = (status?: VisitStatus) => {
    switch (status) {
      case "approved":
        return "bg-green-50 border-green-200"
      case "completed":
        return "bg-blue-50 border-blue-200"
      case "incomplete":
        return "bg-orange-50 border-orange-200"
      case "rescheduled":
        return "bg-purple-50 border-purple-200"
      case "rejected":
        return "bg-red-50 border-red-200"
      default:
        return "bg-yellow-50 border-yellow-200"
    }
  }

  const getStatusBadge = (status?: VisitStatus) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-green-600 text-white">Approved</Badge>
      case "completed":
        return <Badge className="bg-blue-600 text-white">Completed</Badge>
      case "incomplete":
        return <Badge className="bg-orange-600 text-white">Incomplete</Badge>
      case "rescheduled":
        return <Badge className="bg-purple-600 text-white">Rescheduled</Badge>
      case "rejected":
        return <Badge className="bg-red-600 text-white">Rejected</Badge>
      default:
        return <Badge className="bg-yellow-600 text-white">Pending</Badge>
    }
  }

  if (!isAuthenticated || role !== "visitor" || !visitor) return null

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h1 className="text-lg sm:text-xl font-bold truncate">Visitor Dashboard</h1>
              <p className="text-xs sm:text-sm text-muted-foreground truncate">
                Welcome, {visitor.firstName} {visitor.lastName}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={handleLogout} className="flex-shrink-0">
              <LogOut className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-4 sm:py-8">
        <div className="mb-4 sm:mb-6">
          <h2 className="text-xl sm:text-2xl font-bold mb-1 sm:mb-2">My Assigned Visits</h2>
          <p className="text-sm sm:text-base text-muted-foreground">View all visits assigned to you</p>
        </div>

        {/* Search and Filter */}
        {assignedVisits.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between gap-3 sm:hidden">
                  <div>
                    <p className="text-xs text-muted-foreground">Status</p>
                    <p className="text-sm font-medium">{activeStatusTabLabel}</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setMobileStatusMenuOpen(true)}
                  >
                    <Menu className="w-4 h-4 mr-2" />
                    Menu
                  </Button>
                </div>

                <Tabs
                  value={activeStatusTab}
                  onValueChange={(value) => setActiveStatusTab(value as VisitStatusTab)}
                  className="hidden sm:block"
                >
                  <TabsList className="w-full overflow-x-auto justify-start">
                    {VISIT_STATUS_TAB_OPTIONS.map((option) => (
                      <TabsTrigger key={option.value} value={option.value}>
                        {option.label}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by customer name, quotation ID, location, agent..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  {(searchTerm.trim() || agentFilter !== "all" || statusFilter !== "all" || dateFilter !== "all" || activeStatusTab !== "pending") && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSearchTerm("")
                        setAgentFilter("all")
                        setStatusFilter("all")
                        setDateFilter("all")
                        setActiveStatusTab("pending")
                        setCurrentPage(1)
                      }}
                      className="sm:w-auto"
                    >
                      Clear All
                    </Button>
                  )}
                </div>
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground whitespace-nowrap">Filter by:</span>
                  </div>
                  <Select value={agentFilter} onValueChange={setAgentFilter}>
                    <SelectTrigger className="w-full sm:w-48">
                      <SelectValue placeholder="Agent" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Agents</SelectItem>
                      {getUniqueAgents()
                        .filter((agent) => agent.id && agent.id.trim()) // Additional safety filter
                        .map((agent) => (
                          <SelectItem key={agent.id} value={agent.id}>
                            {agent.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as VisitStatus | "all")}>
                    <SelectTrigger className="w-full sm:w-48">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="incomplete">Incomplete</SelectItem>
                      <SelectItem value="rescheduled">Rescheduled</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={dateFilter} onValueChange={setDateFilter}>
                    <SelectTrigger className="w-full sm:w-48">
                      <SelectValue placeholder="Date" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Dates</SelectItem>
                      <SelectItem value="today">Today</SelectItem>
                      <SelectItem value="thisWeek">This Week</SelectItem>
                      <SelectItem value="thisMonth">This Month</SelectItem>
                      <SelectItem value="upcoming">Upcoming</SelectItem>
                      <SelectItem value="past">Past Visits</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
          </Card>
        )}

        {isLoadingVisits ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <Card key={index}>
                <CardContent className="py-4">
                  <div className="animate-pulse grid grid-cols-1 lg:grid-cols-[1.6fr_1fr_1fr_auto] gap-3 items-center">
                    <div className="space-y-2">
                      <div className="h-4 w-40 rounded bg-muted" />
                      <div className="h-3 w-28 rounded bg-muted" />
                    </div>
                    <div className="space-y-2">
                      <div className="h-3 w-24 rounded bg-muted" />
                      <div className="h-3 w-32 rounded bg-muted" />
                    </div>
                    <div className="space-y-2">
                      <div className="h-3 w-24 rounded bg-muted" />
                      <div className="h-3 w-36 rounded bg-muted" />
                    </div>
                    <div className="flex gap-2">
                      <div className="h-8 w-24 rounded bg-muted" />
                      <div className="h-8 w-24 rounded bg-muted" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (() => {
          // Filter visits by search term, agent filter, status, and date
          const filteredVisits = assignedVisits.filter((visit) => {
            // Filter by agent (dropdown)
            if (agentFilter !== "all") {
              if (visit.quotation.dealerId !== agentFilter) return false
            }

            // Search across multiple fields
            if (searchTerm.trim()) {
              const searchLower = searchTerm.toLowerCase()
              const customerName = `${visit.quotation?.customer?.firstName || ""} ${visit.quotation?.customer?.lastName || ""}`.toLowerCase()
              const quotationId = String(visit.quotation?.id || "").toLowerCase()
              const location = String(visit.location || "").toLowerCase()
              const agentName = String(getDealerName(visit.quotation?.dealerId || "", visit) || "").toLowerCase()
              const customerMobile = String(visit.quotation?.customer?.mobile || "").toLowerCase()
              const customerEmail = String((visit.quotation?.customer as any)?.email || "").toLowerCase()

              const matchesSearch =
                customerName.includes(searchLower) ||
                quotationId.includes(searchLower) ||
                location.includes(searchLower) ||
                agentName.includes(searchLower) ||
                customerMobile.includes(searchLower) ||
                customerEmail.includes(searchLower)

              if (!matchesSearch) return false
            }

            // Filter by status
            const currentStatus = normalizeVisitStatus(visit.status)
            if (statusFilter !== "all") {
              if (currentStatus !== statusFilter) return false
            }
            if (activeStatusTab !== "all") {
              if (currentStatus !== activeStatusTab) return false
            }

            // Filter by date
            if (dateFilter !== "all") {
              const visitDate = new Date(`${visit.date || ""}T${getVisitStartTime(visit.time || "") || visit.time || "00:00"}`)
              const now = new Date()
              const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
              const thisWeekStart = new Date(today)
              thisWeekStart.setDate(today.getDate() - today.getDay())
              const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)

              switch (dateFilter) {
                case "today":
                  if (visitDate.toDateString() !== today.toDateString()) return false
                  break
                case "thisWeek":
                  if (visitDate < thisWeekStart) return false
                  break
                case "thisMonth":
                  if (visitDate < thisMonthStart) return false
                  break
                case "upcoming":
                  if (visitDate < now) return false
                  break
                case "past":
                  if (visitDate >= now) return false
                  break
              }
            }

            return true
          })

          const sortedFilteredVisits = [...filteredVisits].sort((a, b) => {
            const aPending = normalizeVisitStatus(a.status) === "pending"
            const bPending = normalizeVisitStatus(b.status) === "pending"

            // Always keep pending visits at the top.
            if (aPending !== bPending) {
              return aPending ? -1 : 1
            }

            const aDateTime = new Date(`${a.date || ""}T${getVisitStartTime(a.time || "") || a.time || "00:00"}`).getTime()
            const bDateTime = new Date(`${b.date || ""}T${getVisitStartTime(b.time || "") || b.time || "00:00"}`).getTime()
            return aDateTime - bDateTime
          })

          if (sortedFilteredVisits.length === 0) {
            return (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>
                    {searchTerm.trim() || agentFilter !== "all" || statusFilter !== "all" || dateFilter !== "all" || activeStatusTab !== "pending"
                      ? "No visits found matching your search/filters"
                      : "No visits assigned to you yet"}
                  </p>
                  {(searchTerm.trim() || agentFilter !== "all" || statusFilter !== "all" || dateFilter !== "all" || activeStatusTab !== "pending") && (
                    <Button
                      variant="link"
                      onClick={() => {
                        setSearchTerm("")
                        setAgentFilter("all")
                        setStatusFilter("all")
                        setDateFilter("all")
                        setActiveStatusTab("pending")
                        setCurrentPage(1)
                      }}
                      className="mt-2"
                    >
                      Clear all filters
                    </Button>
                  )}
                </CardContent>
              </Card>
            )
          }

          const totalPages = Math.max(1, Math.ceil(sortedFilteredVisits.length / VISITS_PER_PAGE))
          const safePage = Math.min(currentPage, totalPages)
          const startIndex = (safePage - 1) * VISITS_PER_PAGE
          const pagedVisits = sortedFilteredVisits.slice(startIndex, startIndex + VISITS_PER_PAGE)

          return (
            <div className="space-y-4">
              {pagedVisits.map((visit) => {
                const isPast = isPastVisit(visit)
                const visitStatus = normalizeVisitStatus(visit.status)

                return (
                  <Card
                    key={visit.id}
                    className={`border-l-4 ${
                      visit.status ? getStatusColor(visit.status) : isPast ? "border-muted-foreground/50 bg-muted/30" : "border-primary"
                    }`}
                  >
                    <CardContent className="py-4">
                      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_auto] gap-4 items-start">
                        <div className="min-w-0 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm sm:text-base font-semibold truncate">
                              {visit.quotation.customer.firstName} {visit.quotation.customer.lastName}
                            </p>
                            {getStatusBadge(visit.status)}
                            {isPast ? <Badge variant="outline" className="text-xs">Past Visit</Badge> : null}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <Badge variant="outline" className="text-[11px]">{visit.quotation.id}</Badge>
                            <span className="truncate max-w-full">Agent: {getDealerName(visit.quotation.dealerId, visit)}</span>
                            {visit.quotation.customer.mobile ? (
                              <a href={`tel:${visit.quotation.customer.mobile}`} className="text-primary hover:underline">
                                {visit.quotation.customer.mobile}
                              </a>
                            ) : null}
                          </div>
                        </div>

                        <div className="space-y-1">
                          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Schedule</p>
                          <p className="text-sm font-medium">{formatDate(visit.date)}</p>
                          <p className="text-xs text-muted-foreground">{formatTime(visit.time)}</p>
                        </div>

                        <div className="space-y-1 min-w-0">
                          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Location</p>
                          <p className="text-sm font-medium truncate">{visit.location || "No location"}</p>
                          {visit.locationLink ? (
                            <button
                              type="button"
                              onClick={() => openLocationLink(visit.locationLink!)}
                              className="text-xs text-primary hover:underline"
                            >
                              Open map
                            </button>
                          ) : visit.location ? (
                            <button
                              type="button"
                              onClick={() => openLocationInMaps(visit.location)}
                              className="text-xs text-primary hover:underline"
                            >
                              Open directions
                            </button>
                          ) : null}
                        </div>

                        <div className="flex flex-col gap-2 xl:min-w-[240px]">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void openVisitDetails(visit)}
                            className="w-full"
                          >
                            <User className="w-4 h-4 mr-2" />
                            View Details
                          </Button>

                          {visitStatus !== "approved" &&
                            visitStatus !== "completed" &&
                            visitStatus !== "incomplete" &&
                            visitStatus !== "rejected" &&
                            visitStatus !== "rescheduled" && (
                            <div className="space-y-2">
                              {!approvedVisits.has(visit.id) ? (
                                <div className="grid grid-cols-2 gap-2">
                                  <Button
                                    size="sm"
                                    onClick={() => handleStatusAction(visit, "approve")}
                                    className="bg-green-600 hover:bg-green-700"
                                  >
                                    Approve
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => handleStatusAction(visit, "reject")}
                                  >
                                    Reject
                                  </Button>
                                </div>
                              ) : (
                                <>
                                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                    <Button size="sm" onClick={() => handleApproveOutcomeClick("completed", visit)} className="bg-blue-600 hover:bg-blue-700">
                                      Complete
                                    </Button>
                                    <Button size="sm" onClick={() => handleApproveOutcomeClick("incomplete", visit)} className="bg-orange-600 hover:bg-orange-700">
                                      Incomplete
                                    </Button>
                                    <Button size="sm" onClick={() => handleApproveOutcomeClick("rescheduled", visit)} className="bg-purple-600 hover:bg-purple-700">
                                      Reschedule
                                    </Button>
                                  </div>
                                  <Button size="sm" variant="destructive" onClick={() => handleStatusAction(visit, "reject")} className="w-full">
                                    Reject
                                  </Button>
                                </>
                              )}
                            </div>
                          )}

                          {(visitStatus === "approved" || visitStatus === "rescheduled") && (
                            <div className="space-y-2">
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                <Button size="sm" onClick={() => handleApproveOutcomeClick("completed", visit)} className="bg-blue-600 hover:bg-blue-700">
                                  Complete
                                </Button>
                                <Button size="sm" onClick={() => handleApproveOutcomeClick("incomplete", visit)} className="bg-orange-600 hover:bg-orange-700">
                                  Incomplete
                                </Button>
                                <Button size="sm" onClick={() => handleApproveOutcomeClick("rescheduled", visit)} className="bg-purple-600 hover:bg-purple-700">
                                  Reschedule
                                </Button>
                              </div>
                              <Button size="sm" variant="destructive" onClick={() => handleStatusAction(visit, "reject")} className="w-full">
                                Reject
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-card px-3 py-2">
                <p className="text-xs text-muted-foreground">
                  Showing {Math.min(startIndex + 1, sortedFilteredVisits.length)}-
                  {Math.min(startIndex + VISITS_PER_PAGE, sortedFilteredVisits.length)} of {sortedFilteredVisits.length}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={safePage <= 1}
                    onClick={() => setCurrentPage(Math.max(safePage - 1, 1))}
                  >
                    Previous
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    Page {safePage} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={safePage >= totalPages}
                    onClick={() => setCurrentPage(Math.min(safePage + 1, totalPages))}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </div>
          )
        })()}
      </main>

      <Sheet open={mobileStatusMenuOpen} onOpenChange={setMobileStatusMenuOpen}>
        <SheetContent side="left" className="w-[280px] sm:hidden">
          <SheetHeader>
            <SheetTitle>Visit Status</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-2">
            {VISIT_STATUS_TAB_OPTIONS.map((option) => (
              <Button
                key={option.value}
                type="button"
                variant={activeStatusTab === option.value ? "default" : "outline"}
                className="w-full justify-start"
                onClick={() => {
                  setActiveStatusTab(option.value)
                  setMobileStatusMenuOpen(false)
                }}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      <Dialog
        open={visitDetailsOpen}
        onOpenChange={(open) => {
          setVisitDetailsOpen(open)
          if (!open) {
            setVisitDetailsLoading(false)
            setVisitDetailsError(null)
          }
        }}
      >
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Visit Details</DialogTitle>
            <DialogDescription>
              View full visit information, completion media, and quotation context on demand.
            </DialogDescription>
          </DialogHeader>

          {visitDetails ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                {getStatusBadge(visitDetails.status)}
                <Badge variant="outline">{visitDetails.quotation.id}</Badge>
                <Badge variant="secondary">{formatDate(visitDetails.date)}</Badge>
                <Badge variant="secondary">{formatTime(visitDetails.time)}</Badge>
              </div>

              {visitDetailsLoading ? (
                <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                  Loading full visit details...
                </div>
              ) : null}

              {visitDetailsError ? (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  {visitDetailsError}
                </div>
              ) : null}

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-lg border p-4 space-y-3">
                  <p className="text-sm font-semibold">Customer & Location</p>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-start gap-2">
                      <User className="w-4 h-4 mt-0.5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">
                          {visitDetails.quotation.customer.firstName} {visitDetails.quotation.customer.lastName}
                        </p>
                        {visitDetails.quotation.customer.mobile ? (
                          <a
                            href={`tel:${visitDetails.quotation.customer.mobile}`}
                            className="text-primary hover:underline"
                          >
                            {visitDetails.quotation.customer.mobile}
                          </a>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <UserCircle className="w-4 h-4 mt-0.5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">Agent</p>
                        <p>{getDealerName(visitDetails.quotation.dealerId, visitDetails)}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 mt-0.5 text-muted-foreground" />
                      <div className="min-w-0">
                        <p className="font-medium">Visit location</p>
                        <p className="break-words">{visitDetails.location || "No location provided"}</p>
                        {visitDetails.locationLink ? (
                          <button
                            type="button"
                            onClick={() => openLocationLink(visitDetails.locationLink!)}
                            className="text-primary hover:underline"
                          >
                            Open map
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border p-4 space-y-3">
                  <p className="text-sm font-semibold">Visit Notes</p>
                  {visitDetails.notes ? (
                    <div className="rounded-md bg-muted/40 p-3 text-sm">{visitDetails.notes}</div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No visit notes available.</p>
                  )}

                  {visitDetails.feedback ? (
                    <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm">
                      <p className="font-medium text-green-800">Customer feedback</p>
                      <p className="mt-1 text-green-700">{visitDetails.feedback}</p>
                    </div>
                  ) : null}

                  {visitDetails.rejectionReason ? (
                    <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm">
                      <p className="font-medium text-red-800">Rejection reason</p>
                      <p className="mt-1 text-red-700">{visitDetails.rejectionReason}</p>
                    </div>
                  ) : null}

                  {visitDetails.visitors && visitDetails.visitors.length > 0 ? (
                    <div className="rounded-md border p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Assigned Visitors</p>
                      <div className="mt-2 space-y-1 text-sm">
                        {visitDetails.visitors.map((item, index) => (
                          <p key={`${item.visitorId}-${index}`}>{item.visitorName || item.visitorId}</p>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              {(visitDetails.length != null ||
                visitDetails.width != null ||
                visitDetails.backLegFeet != null ||
                visitDetails.midLegFeet != null ||
                visitDetails.frontLegFeet != null ||
                visitDetails.rowDiagramImage ||
                visitDetails.meterImage ||
                (visitDetails.images && visitDetails.images.length > 0)) ? (
                <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-4 space-y-4">
                  <div className="flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-blue-700" />
                    <p className="text-sm font-semibold text-blue-900">Completion Details</p>
                  </div>

                  {(visitDetails.length != null ||
                    visitDetails.width != null ||
                    visitDetails.backLegFeet != null ||
                    visitDetails.midLegFeet != null ||
                    visitDetails.frontLegFeet != null) && (
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                      {visitDetails.length != null ? (
                        <div className="rounded-md border bg-white p-3">
                          <p className="text-[11px] text-muted-foreground">Length</p>
                          <p className="text-sm font-semibold">{visitDetails.length}</p>
                        </div>
                      ) : null}
                      {visitDetails.width != null ? (
                        <div className="rounded-md border bg-white p-3">
                          <p className="text-[11px] text-muted-foreground">Width</p>
                          <p className="text-sm font-semibold">{visitDetails.width}</p>
                        </div>
                      ) : null}
                      {visitDetails.backLegFeet != null ? (
                        <div className="rounded-md border bg-white p-3">
                          <p className="text-[11px] text-muted-foreground">Back leg (ft)</p>
                          <p className="text-sm font-semibold">{visitDetails.backLegFeet}</p>
                        </div>
                      ) : null}
                      {visitDetails.midLegFeet != null ? (
                        <div className="rounded-md border bg-white p-3">
                          <p className="text-[11px] text-muted-foreground">Mid leg (ft)</p>
                          <p className="text-sm font-semibold">{visitDetails.midLegFeet}</p>
                        </div>
                      ) : null}
                      {visitDetails.frontLegFeet != null ? (
                        <div className="rounded-md border bg-white p-3">
                          <p className="text-[11px] text-muted-foreground">Front leg (ft)</p>
                          <p className="text-sm font-semibold">{visitDetails.frontLegFeet}</p>
                        </div>
                      ) : null}
                    </div>
                  )}

                  <div className="grid gap-4 md:grid-cols-2">
                    {visitDetails.rowDiagramImage ? (
                      <div>
                        <p className="text-xs text-muted-foreground mb-2">Row diagram</p>
                        <a href={visitDetails.rowDiagramImage} target="_blank" rel="noreferrer">
                          <img
                            src={visitDetails.rowDiagramImage}
                            alt="Row diagram"
                            className="max-h-44 rounded-md border bg-white object-contain"
                          />
                        </a>
                      </div>
                    ) : null}

                    {visitDetails.meterImage ? (
                      <div>
                        <p className="text-xs text-muted-foreground mb-2">Meter image</p>
                        <a href={visitDetails.meterImage} target="_blank" rel="noreferrer">
                          <img
                            src={visitDetails.meterImage}
                            alt="Meter"
                            className="max-h-44 rounded-md border bg-white object-contain"
                          />
                        </a>
                      </div>
                    ) : null}
                  </div>

                  {visitDetails.images && visitDetails.images.length > 0 ? (
                    <div>
                      <p className="text-xs text-muted-foreground mb-2">Uploaded site images ({visitDetails.images.length})</p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {visitDetails.images.map((img, idx) => (
                          <a key={`${visitDetails.id}-${idx}`} href={img} target="_blank" rel="noreferrer">
                            <img
                              src={img}
                              alt={`Site image ${idx + 1}`}
                              className="h-28 w-full rounded-md border bg-white object-cover"
                            />
                          </a>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    if (visitDetails.quotation) {
                      setSelectedQuotation(visitDetails.quotation)
                      setDialogOpen(true)
                    }
                  }}
                >
                  Open Quotation
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Quotation Details Dialog */}
      <QuotationDetailsDialog
        quotation={selectedQuotation}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />

      {/* Reject Dialog */}
      <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Reject Visit</DialogTitle>
            <DialogDescription>Reject this visit and provide a reason</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="rejection-reason">Rejection Reason *</Label>
              <Textarea
                id="rejection-reason"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Please provide a reason for rejecting this visit..."
                className="mt-1 min-h-[120px]"
                rows={5}
              />
              <p className="text-xs text-muted-foreground mt-1">
                This reason will be visible to the agent and customer.
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setStatusDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleRejectVisit}
                disabled={!rejectionReason.trim()}
                className="bg-red-600 hover:bg-red-700"
              >
                <XCircle className="w-4 h-4 mr-2" />
                Reject Visit
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Complete Dialog */}
      <Dialog open={completeDialogOpen} onOpenChange={setCompleteDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Complete Visit</DialogTitle>
            <DialogDescription>Add site dimensions and images</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="length-feet">Length (ft) *</Label>
                <Input
                  id="length-feet"
                  type="number"
                  value={lengthFeet}
                  onChange={(e) => setLengthFeet(e.target.value)}
                  placeholder="0"
                  className="mt-1"
                  min="0"
                  step="0.01"
                />
              </div>
              <div>
                <Label htmlFor="width-feet">Width (ft) *</Label>
                <Input
                  id="width-feet"
                  type="number"
                  value={widthFeet}
                  onChange={(e) => setWidthFeet(e.target.value)}
                  placeholder="0"
                  className="mt-1"
                  min="0"
                  step="0.01"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="back-leg-feet">Back leg (ft) *</Label>
                <Input
                  id="back-leg-feet"
                  type="number"
                  value={backLegFeet}
                  onChange={(e) => setBackLegFeet(e.target.value)}
                  placeholder="0"
                  className="mt-1"
                  min="0"
                  step="0.01"
                />
              </div>
              <div>
                <Label htmlFor="mid-leg-feet">Mid leg (ft) (optional)</Label>
                <Input
                  id="mid-leg-feet"
                  type="number"
                  value={midLegFeet}
                  onChange={(e) => setMidLegFeet(e.target.value)}
                  placeholder="—"
                  className="mt-1"
                  min="0"
                  step="0.01"
                />
              </div>
              <div>
                <Label htmlFor="front-leg-feet">Front leg (ft) *</Label>
                <Input
                  id="front-leg-feet"
                  type="number"
                  value={frontLegFeet}
                  onChange={(e) => setFrontLegFeet(e.target.value)}
                  placeholder="0"
                  className="mt-1"
                  min="0"
                  step="0.01"
                />
              </div>
            </div>

            <div>
              <Label>Site Images *</Label>
              <div className="mt-2 border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
                <Upload className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm font-medium text-foreground mb-1">Click to upload or drag and drop</p>
                <p className="text-xs text-muted-foreground mb-3">PNG, JPG up to 10MB each</p>
                <Input
                  type="file"
                  accept="image/*,.heic,.heif"
                  multiple
                  onChange={handleImageUpload}
                  disabled={isUploadingCompleteAsset}
                  className="hidden"
                  id="image-upload"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isUploadingCompleteAsset}
                  onClick={() => document.getElementById("image-upload")?.click()}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  {isUploadingCompleteAsset ? "Uploading..." : "Select Images"}
                </Button>
              </div>

              {imagePreviews.length > 0 && (
                <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {imagePreviews.map((preview, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={preview}
                        alt={`Preview ${index + 1}`}
                        className="w-full h-32 object-cover rounded-lg border"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        disabled={isUploadingCompleteAsset}
                        onClick={() => removeImage(index)}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="row-diagram-upload">Row diagram image (optional)</Label>
              <div className="mt-2 border-2 border-dashed border-border rounded-lg p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <p className="text-sm text-muted-foreground">Upload a row layout sketch or diagram (PNG, JPG up to 10MB).</p>
                <div className="flex items-center gap-2 shrink-0">
                  <Input
                    id="row-diagram-upload"
                    type="file"
                    accept="image/*,.heic,.heif"
                    onChange={handleRowDiagramUpload}
                    disabled={isUploadingCompleteAsset}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isUploadingCompleteAsset}
                    onClick={() => document.getElementById("row-diagram-upload")?.click()}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    {isUploadingCompleteAsset ? "Uploading..." : "Select"}
                  </Button>
                  {rowDiagramPreview && (
                    <Button type="button" variant="ghost" size="sm" disabled={isUploadingCompleteAsset} onClick={clearRowDiagram}>
                      Remove
                    </Button>
                  )}
                </div>
              </div>
              {rowDiagramPreview && (
                <div className="mt-3 relative inline-block group">
                  <img
                    src={rowDiagramPreview}
                    alt="Row diagram preview"
                    className="max-h-40 rounded-lg border object-contain"
                  />
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="meter-image-upload">Meter image *</Label>
              <div className="mt-2 border-2 border-dashed border-border rounded-lg p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <p className="text-sm text-muted-foreground">Upload clear meter photo (PNG, JPG up to 10MB).</p>
                <div className="flex items-center gap-2 shrink-0">
                  <Input
                    id="meter-image-upload"
                    type="file"
                    accept="image/*,.heic,.heif"
                    onChange={handleMeterImageUpload}
                    disabled={isUploadingCompleteAsset}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isUploadingCompleteAsset}
                    onClick={() => document.getElementById("meter-image-upload")?.click()}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    {isUploadingCompleteAsset ? "Uploading..." : "Select"}
                  </Button>
                  {meterImagePreview && (
                    <Button type="button" variant="ghost" size="sm" disabled={isUploadingCompleteAsset} onClick={clearMeterImage}>
                      Remove
                    </Button>
                  )}
                </div>
              </div>
              {meterImagePreview && (
                <div className="mt-3 relative inline-block group">
                  <img
                    src={meterImagePreview}
                    alt="Meter image preview"
                    className="max-h-40 rounded-lg border object-contain"
                  />
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="complete-notes">Notes (Optional)</Label>
              <Textarea
                id="complete-notes"
                value={completeNotes}
                onChange={(e) => setCompleteNotes(e.target.value)}
                placeholder="Add any additional notes about the visit completion..."
                className="mt-1 min-h-[100px]"
                rows={4}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Add any additional notes or remarks about the completed visit.
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" disabled={isCompletingVisit || isUploadingCompleteAsset} onClick={() => setCompleteDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleCompleteVisit}
                disabled={
                  isCompletingVisit ||
                  isUploadingCompleteAsset ||
                  !lengthFeet ||
                  !widthFeet ||
                  !backLegFeet ||
                  !frontLegFeet ||
                  imagePreviews.length === 0 ||
                  !meterImagePreview
                }
                className="bg-blue-600 hover:bg-blue-700"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                {isCompletingVisit ? "Submitting..." : isUploadingCompleteAsset ? "Uploading..." : "Complete Visit"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Incomplete/Reschedule Dialog */}
      <Dialog open={incompleteRescheduleDialogOpen} onOpenChange={setIncompleteRescheduleDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {approveOutcome === "incomplete" ? "Mark as Incomplete" : "Reschedule Visit"}
            </DialogTitle>
            <DialogDescription>
              {approveOutcome === "incomplete"
                ? "Provide a reason why this visit is incomplete"
                : "Provide a reason for rescheduling this visit"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="reason">Reason *</Label>
              <Textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={
                  approveOutcome === "incomplete"
                    ? "Please provide a reason why this visit is incomplete..."
                    : "Please provide a reason for rescheduling this visit..."
                }
                className="mt-1 min-h-[120px]"
                rows={5}
              />
              <p className="text-xs text-muted-foreground mt-1">
                This reason will be visible to the agent and customer.
              </p>
            </div>
            {approveOutcome === "rescheduled" && (
              <div>
                <Label htmlFor="reschedule-decision">Decision *</Label>
                <Select
                  value={rescheduleDecision}
                  onValueChange={(value: "rescheduled" | "completed" | "incomplete" | "rejected") =>
                    setRescheduleDecision(value)
                  }
                >
                  <SelectTrigger id="reschedule-decision" className="mt-1">
                    <SelectValue placeholder="Select decision" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rescheduled">Reschedule</SelectItem>
                    <SelectItem value="completed">Complete</SelectItem>
                    <SelectItem value="incomplete">Incomplete</SelectItem>
                    <SelectItem value="rejected">Reject</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            {approveOutcome === "rescheduled" && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <Label htmlFor="reschedule-date">Reschedule Date *</Label>
                  <Input
                    id="reschedule-date"
                    type="date"
                    value={rescheduleDate}
                    onChange={(e) => setRescheduleDate(e.target.value)}
                    min={new Date().toISOString().split("T")[0]}
                    className="mt-1"
                    disabled={rescheduleDecision !== "rescheduled"}
                  />
                </div>
                <div>
                  <Label htmlFor="reschedule-start-time">Start Time *</Label>
                  <Input
                    id="reschedule-start-time"
                    type="time"
                    value={rescheduleStartTime}
                    onChange={(e) => setRescheduleStartTime(e.target.value)}
                    className="mt-1"
                    disabled={rescheduleDecision !== "rescheduled"}
                  />
                </div>
                <div>
                  <Label htmlFor="reschedule-end-time">End Time *</Label>
                  <Input
                    id="reschedule-end-time"
                    type="time"
                    value={rescheduleEndTime}
                    onChange={(e) => setRescheduleEndTime(e.target.value)}
                    className="mt-1"
                    disabled={rescheduleDecision !== "rescheduled"}
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIncompleteRescheduleDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleIncompleteRescheduleVisit}
                disabled={!reason.trim()}
                className={
                  approveOutcome === "incomplete"
                    ? "bg-orange-600 hover:bg-orange-700"
                    : "bg-purple-600 hover:bg-purple-700"
                }
              >
                {approveOutcome === "incomplete" ? (
                  <>
                    <XCircle className="w-4 h-4 mr-2" />
                    Mark as Incomplete
                  </>
                ) : (
                  <>
                    <Calendar className="w-4 h-4 mr-2" />
                    {rescheduleDecision === "completed"
                      ? "Mark as Complete"
                      : rescheduleDecision === "incomplete"
                        ? "Mark as Incomplete"
                        : rescheduleDecision === "rejected"
                          ? "Reject Visit"
                          : "Reschedule"}
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

