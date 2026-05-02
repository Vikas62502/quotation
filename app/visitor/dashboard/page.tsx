"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { api, ApiError } from "@/lib/api"
import { API_CONFIG } from "@/lib/api-config"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Calendar,
  Clock,
  MapPin,
  LogOut,
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
  if (
    value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("data:") ||
    value.startsWith("blob:")
  ) {
    return value
  }
  if (value.startsWith("//")) return `https:${value}`
  if (value.startsWith("/")) {
    if (typeof window !== "undefined") return `${window.location.origin}${value}`
    return value
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

export default function VisitorDashboardPage() {
  const { visitor, role, isAuthenticated, logout } = useAuth()
  const router = useRouter()
  const [assignedVisits, setAssignedVisits] = useState<VisitWithQuotation[]>([])
  const [selectedQuotation, setSelectedQuotation] = useState<Quotation | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
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
  const [approveOutcome, setApproveOutcome] = useState<"completed" | "incomplete" | "rescheduled" | null>(null)
  const [approvedVisits, setApprovedVisits] = useState<Set<string>>(new Set())
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false)
  const [incompleteRescheduleDialogOpen, setIncompleteRescheduleDialogOpen] = useState(false)
  const [lengthFeet, setLengthFeet] = useState("")
  const [widthFeet, setWidthFeet] = useState("")
  const [backLegFeet, setBackLegFeet] = useState("")
  const [midLegFeet, setMidLegFeet] = useState("")
  const [frontLegFeet, setFrontLegFeet] = useState("")
  const [images, setImages] = useState<File[]>([])
  const [imagePreviews, setImagePreviews] = useState<string[]>([])
  const [rowDiagramFile, setRowDiagramFile] = useState<File | null>(null)
  const [rowDiagramPreview, setRowDiagramPreview] = useState<string | null>(null)
  const [meterImageFile, setMeterImageFile] = useState<File | null>(null)
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
        
        const visits: VisitWithQuotation[] = visitsList.map((v: any) => {
          const completion = v.completionDetails || v.completion_details || {}
          const dimensions = v.siteDimensions || v.site_dimensions || completion.siteDimensions || completion.site_dimensions || {}
          const rowDiagram = normalizeMediaUrl(
            v.rowDiagramImage ||
              v.row_diagram_image ||
              completion.rowDiagramImage ||
              completion.row_diagram_image ||
              v.documents?.rowDiagramImage ||
              v.documents?.row_diagram_image ||
              v.documents?.rowDiagram ||
              v.documents?.row_diagram,
          )
          const meterImage = normalizeMediaUrl(
            v.meterImage ||
              v.meter_image ||
              completion.meterImage ||
              completion.meter_image ||
              v.documents?.meterImage ||
              v.documents?.meter_image ||
              v.documents?.meterPhoto ||
              v.documents?.meter_photo,
          )
          const normalizedImages = extractImageList(v)
          return {
            id: v.id,
            date: v.visitDate || v.date || "",
            time: resolveVisitTimeRange(v),
            location: v.location || v.visitLocation || "",
            locationLink: v.locationLink || v.location_link,
            notes: v.notes || completion.notes,
            status: normalizeVisitStatus(v.status || v.visitStatus || v.visit_status),
            feedback: v.feedback,
            rejectionReason: v.rejectionReason || v.rejection_reason,
            length: pickFirstNumber(v.length, v.lengthFeet, v.length_feet, dimensions.length, dimensions.lengthFeet, dimensions.length_feet),
            width: pickFirstNumber(v.width, v.widthFeet, v.width_feet, dimensions.width, dimensions.widthFeet, dimensions.width_feet),
            height: pickFirstNumber(v.height, dimensions.height, dimensions.heightFeet, dimensions.height_feet),
            backLegFeet: pickFirstNumber(v.backLegFeet, v.back_leg_feet, dimensions.backLegFeet, dimensions.back_leg_feet),
            midLegFeet: pickFirstNumber(v.midLegFeet, v.mid_leg_feet, dimensions.midLegFeet, dimensions.mid_leg_feet),
            frontLegFeet: pickFirstNumber(v.frontLegFeet, v.front_leg_feet, dimensions.frontLegFeet, dimensions.front_leg_feet),
            unit: (v.unit || dimensions.unit || completion.unit || "feet") as "feet" | "cm",
            rowDiagramImage: rowDiagram,
            meterImage,
            images: normalizedImages,
            visitors: v.otherVisitors?.map((ov: any) => ({
              visitorId: ov.visitorId,
              visitorName: ov.visitorName,
            })),
            createdAt: v.createdAt,
            quotation: {
              id: v.quotation.id,
              customer: v.customer,
              products: {} as any,
              discount: 0,
              totalAmount: v.quotation.finalAmount || 0,
              finalAmount: v.quotation.finalAmount || 0,
              createdAt: v.quotation.createdAt,
              dealerId: v.dealer?.id || "",
              status: "pending",
            },
            quotationId: v.quotation.id,
            dealer: v.dealer
              ? {
                  id: v.dealer.id || "",
                  firstName: v.dealer.firstName || "",
                  lastName: v.dealer.lastName || "",
                }
              : undefined,
          }
        })
        
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

  const handleLogout = () => {
    logout()
    router.push("/")
  }

  const applyVisitUpdateFallback = (
    quotationId: string,
    visitId: string,
    updater: (visit: VisitWithQuotation) => VisitWithQuotation,
  ) => {
    setAssignedVisits((prev) => prev.map((v) => (v.id === visitId ? updater(v) : v)))

    // Best-effort local persistence so page reload preserves fallback update.
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
      setImages([])
      setImagePreviews(targetVisit.images || [])
      setPersistedSiteImageCount(targetVisit.images?.length ?? 0)
      setRowDiagramFile(null)
      setRowDiagramPreview(targetVisit.rowDiagramImage || null)
      setMeterImageFile(null)
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
    if (!selectedVisit) return

    try {
      const L = parseFloat(lengthFeet) || 0
      const W = parseFloat(widthFeet) || 0
      const back = parseFloat(backLegFeet) || 0
      const midParsed = parseFloat(midLegFeet)
      const mid = Number.isFinite(midParsed) ? midParsed : 0
      const front = parseFloat(frontLegFeet) || 0
      const legacyHeight = Math.max(back, mid, front)

      // Previews already include persisted URLs and data URLs for newly selected files.
      const allImages = [...imagePreviews]

      let rowDiagramImage: string | undefined
      if (rowDiagramFile) {
        rowDiagramImage = await new Promise<string>((resolve) => {
          const reader = new FileReader()
          reader.onload = (e) => resolve(e.target?.result as string)
          reader.readAsDataURL(rowDiagramFile)
        })
      } else if (rowDiagramPreview) {
        rowDiagramImage = rowDiagramPreview
      }

      let meterImage: string | undefined
      if (meterImageFile) {
        meterImage = await new Promise<string>((resolve) => {
          const reader = new FileReader()
          reader.onload = (e) => resolve(e.target?.result as string)
          reader.readAsDataURL(meterImageFile)
        })
      } else if (meterImagePreview) {
        meterImage = meterImagePreview
      }

      const completePayload = {
        length: L,
        width: W,
        height: legacyHeight,
        unit: "feet" as const,
        backLegFeet: back,
        ...(midLegFeet.trim() !== "" ? { midLegFeet: mid } : {}),
        frontLegFeet: front,
        images: allImages,
        notes: completeNotes.trim() || undefined,
        ...(rowDiagramImage ? { rowDiagramImage } : {}),
        ...(meterImage ? { meterImage } : {}),
      }

      let syncedWithApi = false
      if (useApi) {
        try {
          const persistedImages = imagePreviews.slice(0, persistedSiteImageCount)
          await api.visits.completeWithFiles(
            selectedVisit.id,
            {
              length: L,
              width: W,
              height: legacyHeight,
              unit: "feet",
              backLegFeet: back,
              ...(midLegFeet.trim() !== "" ? { midLegFeet: mid } : {}),
              frontLegFeet: front,
              notes: completeNotes.trim() || undefined,
              existingImages: persistedImages,
              existingRowDiagramImage: rowDiagramFile ? undefined : rowDiagramPreview || undefined,
              existingMeterImage: meterImageFile ? undefined : meterImagePreview || undefined,
            },
            images,
            rowDiagramFile,
            meterImageFile,
          )
          syncedWithApi = true
          await loadAssignedVisits()
        } catch (error) {
          console.warn("Visitor complete multipart API failed, trying JSON fallback:", error)
          try {
            await api.visits.complete(selectedVisit.id, completePayload)
            syncedWithApi = true
            await loadAssignedVisits()
          } catch (jsonError) {
            console.warn("Visitor complete JSON API failed, applying local fallback:", jsonError)
          }
        }
      }

      const visitPatch = {
        status: "completed" as const,
        length: L || undefined,
        width: W || undefined,
        height: legacyHeight || undefined,
        unit: "feet" as const,
        backLegFeet: back || undefined,
        midLegFeet: midLegFeet.trim() !== "" ? mid : undefined,
        frontLegFeet: front || undefined,
        rowDiagramImage: rowDiagramImage || undefined,
        meterImage: meterImage || undefined,
        images: allImages.length > 0 ? allImages : undefined,
        notes: completeNotes.trim() || undefined,
      }

      if (!syncedWithApi) {
        // Fallback to localStorage
        const storedVisits = JSON.parse(localStorage.getItem(`visits_${selectedVisit.quotationId}`) || "[]")
        const updatedVisits = storedVisits.map((v: Visit) => {
          if (v.id === selectedVisit.id) {
            return {
              ...v,
              ...visitPatch,
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
            ...visitPatch,
          }))
        }
      } else {
        // Ensure Completed tab immediately reflects submitted details even if
        // list API response is delayed/partial for completion fields.
        applyVisitUpdateFallback(selectedVisit.quotationId, selectedVisit.id, (v) => ({
          ...v,
          ...visitPatch,
        }))
      }

      setCompleteDialogOpen(false)
      setSelectedVisit(null)
      setApproveOutcome(null)
      setLengthFeet("")
      setWidthFeet("")
      setBackLegFeet("")
      setMidLegFeet("")
      setFrontLegFeet("")
      setImages([])
      setImagePreviews([])
      setPersistedSiteImageCount(0)
      setRowDiagramFile(null)
      setRowDiagramPreview(null)
      setMeterImageFile(null)
      setMeterImagePreview(null)
      setCompleteNotes("")
    } catch (error) {
      console.error("Error completing visit:", error)
      alert(error instanceof ApiError ? error.message : "Failed to complete visit")
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
            await api.visits.reschedule(selectedVisit.id, {
              reason: reason.trim(),
              visitDate: rescheduleDate,
              visitTime: `${startTime} - ${endTime}`,
              visitStartTime: startTime,
              visitEndTime: endTime,
              visitTimeRange: `${startTime} - ${endTime}`,
            })
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

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length > 0) {
      setImages((prev) => [...prev, ...files])
      // Create previews
      files.forEach((file) => {
        const reader = new FileReader()
        reader.onload = (e) => {
          setImagePreviews((prev) => [...prev, e.target?.result as string])
        }
        reader.readAsDataURL(file)
      })
    }
  }

  const removeImage = (index: number) => {
    setImagePreviews((prev) => prev.filter((_, i) => i !== index))
    if (index < persistedSiteImageCount) {
      setPersistedSiteImageCount((c) => Math.max(0, c - 1))
    } else {
      const fileIndex = index - persistedSiteImageCount
      setImages((prev) => prev.filter((_, i) => i !== fileIndex))
    }
  }

  const handleRowDiagramUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    setRowDiagramFile(file)
    const reader = new FileReader()
    reader.onload = (ev) => setRowDiagramPreview(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  const clearRowDiagram = () => {
    setRowDiagramFile(null)
    setRowDiagramPreview(null)
  }

  const handleMeterImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    setMeterImageFile(file)
    const reader = new FileReader()
    reader.onload = (ev) => setMeterImagePreview(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  const clearMeterImage = () => {
    setMeterImageFile(null)
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
                <Tabs value={activeStatusTab} onValueChange={(value) => setActiveStatusTab(value as VisitStatusTab)}>
                  <TabsList className="w-full overflow-x-auto justify-start">
                    <TabsTrigger value="pending">Pending</TabsTrigger>
                    <TabsTrigger value="approved">Approved</TabsTrigger>
                    <TabsTrigger value="completed">Completed</TabsTrigger>
                    <TabsTrigger value="incomplete">Incomplete</TabsTrigger>
                    <TabsTrigger value="rescheduled">Rescheduled</TabsTrigger>
                    <TabsTrigger value="rejected">Rejected</TabsTrigger>
                    <TabsTrigger value="all">All</TabsTrigger>
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
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Loading assigned visits...
            </CardContent>
          </Card>
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
              const myAvailability = getMyAvailability(visit)
              const isPast = isPastVisit(visit)

              return (
                <Card
                  key={visit.id}
                  className={`border-l-4 ${
                    visit.status ? getStatusColor(visit.status) : isPast ? "border-muted-foreground/50 bg-muted/30" : "border-primary"
                  }`}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <CardTitle className="text-lg">
                            Visit for {visit.quotation.customer.firstName} {visit.quotation.customer.lastName}
                          </CardTitle>
                          {getStatusBadge(visit.status)}
                        </div>
                        <div className="flex items-center gap-2 flex-wrap mb-2">
                          <Badge
                            variant={isPast ? "secondary" : "default"}
                            className="flex items-center gap-1"
                          >
                            <Calendar className="w-3 h-3" />
                            {formatDate(visit.date)}
                          </Badge>
                          <Badge
                            variant={isPast ? "secondary" : "default"}
                            className="flex items-center gap-1"
                          >
                            <Clock className="w-3 h-3" />
                            {formatTime(visit.time)}
                          </Badge>
                          {isPast && (
                            <Badge variant="outline" className="text-xs">
                              Past Visit
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <UserCircle className="w-4 h-4" />
                          <span>Agent: {getDealerName(visit.quotation.dealerId, visit)}</span>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {visit.quotation.id}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Location with Contact Info */}
                    <div className="bg-primary/5 rounded-lg p-4 border border-primary/20">
                      {/* Show locationLink if available, otherwise show location */}
                      {visit.locationLink && visit.locationLink.trim() ? (
                        <div className="flex items-start gap-2 group">
                          <Link className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                          <div className="flex-1">
                            <p className="text-xs text-muted-foreground mb-1">Current Location Link</p>
                            <a
                              href={visit.locationLink}
                              onClick={(e) => {
                                e.preventDefault()
                                openLocationLink(visit.locationLink!)
                              }}
                              className="text-sm font-medium text-primary hover:underline text-left transition-colors cursor-pointer break-all"
                              title="Click to open location in map"
                            >
                              {visit.locationLink.length > 60 
                                ? `${visit.locationLink.substring(0, 60)}...` 
                                : visit.locationLink}
                            </a>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start gap-2 group">
                          <MapPin className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                          <div className="flex-1">
                            <p className="text-xs text-muted-foreground mb-1">Visit Location</p>
                            <button
                              onClick={() => openLocationInMaps(visit.location)}
                              className="text-sm font-medium text-foreground hover:text-primary hover:underline text-left transition-colors cursor-pointer"
                              title="Click to open in Google Maps with directions"
                            >
                              {visit.location}
                            </button>
                          </div>
                        </div>
                      )}
                      <div className="mt-3 pt-3 border-t border-primary/20 flex items-center gap-4 flex-wrap">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-muted-foreground" />
                          <div>
                            <p className="text-xs text-muted-foreground">Customer</p>
                            <p className="text-sm font-medium">
                              {visit.quotation.customer.firstName} {visit.quotation.customer.lastName}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Phone className="w-4 h-4 text-muted-foreground" />
                          <div>
                            <p className="text-xs text-muted-foreground">Contact</p>
                            <a
                              href={`tel:${visit.quotation.customer.mobile}`}
                              className="text-sm font-medium text-primary hover:underline"
                              title="Click to call"
                            >
                              {visit.quotation.customer.mobile}
                            </a>
                          </div>
                        </div>
                      </div>
                    </div>

                    {myAvailability && (
                      <div className="bg-primary/10 rounded-md p-3 border border-primary/20">
                        <div className="flex items-center gap-2 mb-2">
                          <Users className="w-4 h-4 text-primary" />
                          <p className="text-sm font-semibold text-primary">Assigned Visitor:</p>
                        </div>
                        <p className="text-sm font-medium">{myAvailability.visitorName}</p>
                      </div>
                    )}

                    {visit.visitors && visit.visitors.length > 1 && (
                      <div className="bg-muted/50 rounded-md p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <Users className="w-3 h-3 text-muted-foreground" />
                          <p className="text-xs font-semibold text-muted-foreground">Other Visitors:</p>
                        </div>
                        <div className="space-y-1">
                          {visit.visitors
                            .filter((v) => v.visitorId !== visitor.id)
                            .map((v, idx) => (
                              <div key={idx} className="text-xs">
                                <span className="font-medium">{v.visitorName}</span>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}

                    {visit.notes && (
                      <div className="bg-muted/50 rounded-md p-3">
                        <p className="text-xs text-muted-foreground mb-1">Notes:</p>
                        <p className="text-sm">{visit.notes}</p>
                      </div>
                    )}

                    {(visit.length != null ||
                      visit.width != null ||
                      visit.backLegFeet != null ||
                      visit.midLegFeet != null ||
                      visit.frontLegFeet != null ||
                      visit.meterImage ||
                      (visit.images && visit.images.length > 0) ||
                      visit.rowDiagramImage) && (
                      <div className="bg-blue-50 rounded-md p-3 border border-blue-200 space-y-3">
                        <div className="flex items-center gap-2">
                          <ImageIcon className="w-4 h-4 text-blue-700" />
                          <p className="text-xs font-semibold text-blue-800">Completion Details</p>
                        </div>

                        {(visit.length != null ||
                          visit.width != null ||
                          visit.backLegFeet != null ||
                          visit.midLegFeet != null ||
                          visit.frontLegFeet != null) && (
                          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                            {visit.length != null && (
                              <div className="rounded-md bg-white/80 border border-blue-100 p-2">
                                <p className="text-[11px] text-muted-foreground">Length ({visit.unit === "cm" ? "cm" : "ft"})</p>
                                <p className="text-sm font-semibold">{visit.length}</p>
                              </div>
                            )}
                            {visit.width != null && (
                              <div className="rounded-md bg-white/80 border border-blue-100 p-2">
                                <p className="text-[11px] text-muted-foreground">Width ({visit.unit === "cm" ? "cm" : "ft"})</p>
                                <p className="text-sm font-semibold">{visit.width}</p>
                              </div>
                            )}
                            {visit.backLegFeet != null && (
                              <div className="rounded-md bg-white/80 border border-blue-100 p-2">
                                <p className="text-[11px] text-muted-foreground">Back leg (ft)</p>
                                <p className="text-sm font-semibold">{visit.backLegFeet}</p>
                              </div>
                            )}
                            {visit.midLegFeet != null && (
                              <div className="rounded-md bg-white/80 border border-blue-100 p-2">
                                <p className="text-[11px] text-muted-foreground">Mid leg (ft)</p>
                                <p className="text-sm font-semibold">{visit.midLegFeet}</p>
                              </div>
                            )}
                            {visit.frontLegFeet != null && (
                              <div className="rounded-md bg-white/80 border border-blue-100 p-2">
                                <p className="text-[11px] text-muted-foreground">Front leg (ft)</p>
                                <p className="text-sm font-semibold">{visit.frontLegFeet}</p>
                              </div>
                            )}
                          </div>
                        )}

                        {visit.rowDiagramImage && (
                          <div>
                            <p className="text-xs text-muted-foreground mb-2">Row diagram document</p>
                            <a
                              href={visit.rowDiagramImage}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-block"
                              title="Open row diagram"
                            >
                              <img
                                src={visit.rowDiagramImage}
                                alt="Row diagram"
                                className="h-28 w-auto rounded-md border object-contain bg-white"
                                onError={(e) => {
                                  e.currentTarget.style.display = "none"
                                  const fallback = e.currentTarget.nextElementSibling as HTMLElement | null
                                  if (fallback) fallback.style.display = "inline-flex"
                                }}
                              />
                              <span
                                style={{ display: "none" }}
                                className="px-3 py-2 text-xs rounded-md border bg-white text-blue-700"
                              >
                                Open row diagram document
                              </span>
                            </a>
                          </div>
                        )}

                        {visit.meterImage && (
                          <div>
                            <p className="text-xs text-muted-foreground mb-2">Meter image</p>
                            <a
                              href={visit.meterImage}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-block"
                              title="Open meter image"
                            >
                              <img
                                src={visit.meterImage}
                                alt="Meter"
                                className="h-28 w-auto rounded-md border object-contain bg-white"
                                onError={(e) => {
                                  e.currentTarget.style.display = "none"
                                  const fallback = e.currentTarget.nextElementSibling as HTMLElement | null
                                  if (fallback) fallback.style.display = "inline-flex"
                                }}
                              />
                              <span
                                style={{ display: "none" }}
                                className="px-3 py-2 text-xs rounded-md border bg-white text-blue-700"
                              >
                                Open meter image
                              </span>
                            </a>
                          </div>
                        )}

                        {visit.images && visit.images.length > 0 && (
                          <div>
                            <p className="text-xs text-muted-foreground mb-2">Uploaded site images ({visit.images.length})</p>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                              {visit.images.map((img, idx) => (
                                <a
                                  key={`${visit.id}_site_img_${idx}`}
                                  href={img}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="block"
                                  title="Open uploaded image"
                                >
                                  <img
                                    src={img}
                                    alt={`Site image ${idx + 1}`}
                                    className="w-full h-24 rounded-md border object-cover bg-white"
                                    onError={(e) => {
                                      e.currentTarget.style.display = "none"
                                      const fallback = e.currentTarget.nextElementSibling as HTMLElement | null
                                      if (fallback) fallback.style.display = "inline-flex"
                                    }}
                                  />
                                  <span
                                    style={{ display: "none" }}
                                    className="w-full h-24 rounded-md border bg-white text-xs text-blue-700 items-center justify-center p-2 text-center"
                                  >
                                    Open uploaded file
                                  </span>
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Feedback Display */}
                    {visit.feedback && (
                      <div className="bg-green-50 rounded-md p-3 border border-green-200">
                        <div className="flex items-center gap-2 mb-2">
                          <MessageSquare className="w-4 h-4 text-green-600" />
                          <p className="text-xs font-semibold text-green-800">Customer Feedback:</p>
                        </div>
                        <p className="text-sm text-green-700">{visit.feedback}</p>
                      </div>
                    )}

                    {/* Rejection Reason Display */}
                    {visit.rejectionReason && (
                      <div className="bg-red-50 rounded-md p-3 border border-red-200">
                        <div className="flex items-center gap-2 mb-2">
                          <XCircle className="w-4 h-4 text-red-600" />
                          <p className="text-xs font-semibold text-red-800">Rejection Reason:</p>
                        </div>
                        <p className="text-sm text-red-700">{visit.rejectionReason}</p>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex flex-col gap-2 pt-2 border-t">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedQuotation(visit.quotation)
                          setDialogOpen(true)
                        }}
                        className="w-full"
                      >
                        <User className="w-4 h-4 mr-2" />
                        View Details
                      </Button>
                      {/* Show buttons for pending visits */}
                      {visit.status !== "approved" &&
                        visit.status !== "completed" &&
                        visit.status !== "incomplete" &&
                        visit.status !== "rejected" &&
                        visit.status !== "rescheduled" && (
                        <div className="space-y-2">
                          {!approvedVisits.has(visit.id) ? (
                            <div className="flex flex-col sm:flex-row gap-2">
                              <Button
                                size="sm"
                                onClick={() => handleStatusAction(visit, "approve")}
                                className="flex-1 bg-green-600 hover:bg-green-700"
                              >
                                <CheckCircle className="w-4 h-4 mr-2" />
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleStatusAction(visit, "reject")}
                                className="flex-1"
                              >
                                <XCircle className="w-4 h-4 mr-2" />
                                Reject
                              </Button>
                            </div>
                          ) : (
                            <>
                              <div className="flex flex-col sm:flex-row gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    handleApproveOutcomeClick("completed", visit)
                                  }}
                                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                                >
                                  <CheckCircle className="w-4 h-4 mr-2" />
                                  Complete
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    handleApproveOutcomeClick("incomplete", visit)
                                  }}
                                  className="flex-1 bg-orange-600 hover:bg-orange-700"
                                >
                                  <XCircle className="w-4 h-4 mr-2" />
                                  Incomplete
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    handleApproveOutcomeClick("rescheduled", visit)
                                  }}
                                  className="flex-1 bg-purple-600 hover:bg-purple-700"
                                >
                                  <Calendar className="w-4 h-4 mr-2" />
                                  Reschedule
                                </Button>
                              </div>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleStatusAction(visit, "reject")}
                                className="w-full"
                              >
                                <XCircle className="w-4 h-4 mr-2" />
                                Reject
                              </Button>
                            </>
                          )}
                        </div>
                      )}
                      {/* Show action buttons for approved/rescheduled visits */}
                      {(visit.status === "approved" || visit.status === "rescheduled") && (
                        <div className="space-y-2">
                          <div className="flex flex-col sm:flex-row gap-2">
                            <Button
                              size="sm"
                              onClick={() => {
                                handleApproveOutcomeClick("completed", visit)
                              }}
                              className="flex-1 bg-blue-600 hover:bg-blue-700"
                            >
                              <CheckCircle className="w-4 h-4 mr-2" />
                              Complete
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => {
                                handleApproveOutcomeClick("incomplete", visit)
                              }}
                              className="flex-1 bg-orange-600 hover:bg-orange-700"
                            >
                              <XCircle className="w-4 h-4 mr-2" />
                              Incomplete
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => {
                                handleApproveOutcomeClick("rescheduled", visit)
                              }}
                              className="flex-1 bg-purple-600 hover:bg-purple-700"
                            >
                              <Calendar className="w-4 h-4 mr-2" />
                              Reschedule
                            </Button>
                          </div>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleStatusAction(visit, "reject")}
                            className="w-full"
                          >
                            <XCircle className="w-4 h-4 mr-2" />
                            Reject
                          </Button>
                        </div>
                      )}
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
                  accept="image/*"
                  multiple
                  onChange={handleImageUpload}
                  className="hidden"
                  id="image-upload"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => document.getElementById("image-upload")?.click()}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Select Images
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
                    accept="image/*"
                    onChange={handleRowDiagramUpload}
                    className="hidden"
                  />
                  <Button type="button" variant="outline" size="sm" onClick={() => document.getElementById("row-diagram-upload")?.click()}>
                    <Upload className="w-4 h-4 mr-2" />
                    Select
                  </Button>
                  {rowDiagramPreview && (
                    <Button type="button" variant="ghost" size="sm" onClick={clearRowDiagram}>
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
                    accept="image/*"
                    onChange={handleMeterImageUpload}
                    className="hidden"
                  />
                  <Button type="button" variant="outline" size="sm" onClick={() => document.getElementById("meter-image-upload")?.click()}>
                    <Upload className="w-4 h-4 mr-2" />
                    Select
                  </Button>
                  {meterImagePreview && (
                    <Button type="button" variant="ghost" size="sm" onClick={clearMeterImage}>
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
              <Button variant="outline" onClick={() => setCompleteDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleCompleteVisit}
                disabled={
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
                Complete Visit
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

