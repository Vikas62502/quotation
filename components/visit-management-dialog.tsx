"use client"

import { useState, useEffect } from "react"
import { type Quotation } from "@/lib/quotation-context"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { ArrowRightLeft, Calendar, Clock, MapPin, Plus, X, Trash2, Users, Link } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { Visitor } from "@/lib/auth-context"
import { api, ApiError } from "@/lib/api"
import { getAccessOverride, hasAccess, listedUserHasAccess, normalizeAccessList, type UserAccessKey } from "@/lib/user-access"
import { listAssignableVisitorsFromDirectory } from "@/lib/visitor-assignable-directory"

/** Users with Admin Visitor checkbox — not only legacy visitor accounts. */
function isVisitorAccessEligible(raw: any): boolean {
  if (!raw) return false
  const roleHint =
    String(raw.role || "")
      .toLowerCase()
      .replace(/_/g, "-") ||
    (raw.source === "visitors" || raw.employeeId != null ? "visitor" : undefined)
  return listedUserHasAccess(
    {
      username: raw.username,
      role: roleHint,
      access: raw.access,
      permissions: raw.permissions,
      isActive: raw.isActive,
    },
    "visitor",
  )
}

function mapApiVisitor(v: any): Visitor & { access?: UserAccessKey[] } {
  const fromApi = normalizeAccessList(v.access ?? v.permissions)
  const override = getAccessOverride(v.username)
  const access = Array.from(new Set([...fromApi, ...override])) as UserAccessKey[]
  return {
    id: String(v.id || ""),
    username: v.username || "",
    password: "",
    firstName: v.firstName || "",
    lastName: v.lastName || "",
    email: v.email || "",
    mobile: v.mobile || "",
    employeeId: v.employeeId,
    isActive: v.isActive ?? true,
    access,
  } as Visitor & { access?: UserAccessKey[] }
}

function extractUserList(response: any): any[] {
  if (!response) return []
  if (Array.isArray(response)) return response
  if (Array.isArray(response.visitors)) return response.visitors
  if (Array.isArray(response.dealers)) return response.dealers
  if (Array.isArray(response.accountManagers)) return response.accountManagers
  if (Array.isArray(response.users)) return response.users
  if (Array.isArray(response.data)) return response.data
  return []
}

interface VisitVisitor {
  visitorId: string
  visitorName: string
}

interface Visit {
  id: string
  date: string
  time: string
  location: string
  locationLink?: string
  notes?: string
  visitors?: VisitVisitor[]
  createdAt: string
}

const getVisitStartTime = (timeRange: string) => (timeRange || "").split("-")[0]?.trim()
const getVisitEndTime = (timeRange: string) => (timeRange || "").split("-")[1]?.trim()
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

interface VisitManagementDialogProps {
  quotation: Quotation | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function VisitManagementDialog({ quotation, open, onOpenChange }: VisitManagementDialogProps) {
  const useApi = process.env.NEXT_PUBLIC_USE_API !== "false"
  const getSafeLastName = (lastName?: string) => {
    const cleaned = (lastName || "").trim()
    return cleaned.toLowerCase() === "na" ? "" : cleaned
  }
  const customerDisplayName = `${quotation?.customer?.firstName || ""} ${getSafeLastName(quotation?.customer?.lastName)}`.trim()
  const [visits, setVisits] = useState<Visit[]>([])
  const [isAdding, setIsAdding] = useState(false)
  const [availableVisitors, setAvailableVisitors] = useState<Visitor[]>([])
  const [selectedVisitorId, setSelectedVisitorId] = useState("")
  const [isLoadingVisitors, setIsLoadingVisitors] = useState(false)
  const [rescheduleVisit, setRescheduleVisit] = useState<Visit | null>(null)
  const [rescheduleReason, setRescheduleReason] = useState("")
  const [rescheduleDate, setRescheduleDate] = useState("")
  const [rescheduleStartTime, setRescheduleStartTime] = useState("")
  const [rescheduleEndTime, setRescheduleEndTime] = useState("")
  const [transferVisit, setTransferVisit] = useState<Visit | null>(null)
  const [transferVisitorId, setTransferVisitorId] = useState("")
  const [transferReason, setTransferReason] = useState("")
  const [isTransferring, setIsTransferring] = useState(false)
  const [formData, setFormData] = useState({
    date: "",
    startTime: "",
    endTime: "",
    location: "",
    locationLink: "",
    notes: "",
  })

  useEffect(() => {
    if (quotation && open) {
      loadVisits()
      loadAvailableVisitors()
      // Pre-fill location with customer address
      const address = quotation.customer?.address
      const customerAddress = address
        ? `${address.street || ""}, ${address.city || ""}, ${address.state || ""} - ${address.pincode || ""}`.replace(/^,\s*|,\s*$/g, "").replace(/,\s*,/g, ",")
        : ""
      setFormData((prev) => ({ ...prev, location: customerAddress, locationLink: "" }))
      setSelectedVisitorId("")
      setTransferVisit(null)
      setTransferVisitorId("")
      setTransferReason("")
    }
  }, [quotation, open])

  const loadAvailableVisitors = async () => {
    setIsLoadingVisitors(true)
    try {
      const merged: any[] = []
      const pushAll = (rows: any[], source: string) => {
        for (const row of rows) {
          if (!row) continue
          merged.push({ ...row, source: row.source || source })
        }
      }

      if (useApi) {
        // 1) Legacy + (hopefully) access-aware assignable visitors
        try {
          const response = await api.dealers.getVisitors({ isActive: true })
          pushAll(extractUserList(response), "visitors")
        } catch (error) {
          console.warn("[visits] dealers.getVisitors failed:", error)
        }

        // 2) Also pull Admin Users sources — dealers/ops with Visitor checkbox
        //    (soft-fail if current login is not admin)
        const extraLoads: Array<Promise<void>> = [
          (async () => {
            try {
              const res = await api.admin.visitors.getAll({ isActive: true, limit: 1000 } as any)
              pushAll(extractUserList(res), "visitors")
            } catch {
              /* dealer token may 403 */
            }
          })(),
          (async () => {
            try {
              const res = await api.admin.dealers.getAll({
                page: 1,
                limit: 1000,
                includeInactive: false,
              } as any)
              pushAll(extractUserList(res), "dealer")
            } catch {
              /* ignore */
            }
          })(),
          (async () => {
            try {
              const res = await api.admin.accountManagers.getAll({ page: 1, limit: 1000 } as any)
              pushAll(extractUserList(res), "ops")
            } catch {
              /* ignore */
            }
          })(),
        ]
        await Promise.all(extraLoads)
      } else {
        pushAll(JSON.parse(localStorage.getItem("visitors") || "[]"), "visitors")
        pushAll(JSON.parse(localStorage.getItem("dealers") || "[]"), "dealer")
        pushAll(JSON.parse(localStorage.getItem("accountManagers") || "[]"), "ops")
      }

      // 3) Local directory synced from Admin → Users (Visitor checkbox), e.g. Saurav / aman4119
      pushAll(listAssignableVisitorsFromDirectory(), "directory")

      // Keep anyone with Visitor access (API or local Admin override), including dealers like aman4119
      const eligible = merged
        .filter((v: any) => isVisitorAccessEligible(v))
        .map((v: any) => mapApiVisitor(v))
        .filter((v) => v.id)

      const byKey = new Map<string, Visitor>()
      for (const v of eligible) {
        const key = v.id || v.username.toLowerCase()
        if (!key) continue
        const prev = byKey.get(key)
        if (!prev) {
          byKey.set(key, v)
          continue
        }
        // Prefer row that already has visitor in access
        const prevHas = hasAccess((prev as any).access, "visitor")
        const nextHas = hasAccess((v as any).access, "visitor")
        if (!prevHas && nextHas) byKey.set(key, v)
      }

      // Username-level dedupe (same person may appear as dealer + visitor ids)
      const byUsername = new Map<string, Visitor>()
      for (const v of byKey.values()) {
        const uk = (v.username || "").trim().toLowerCase()
        if (!uk) {
          byUsername.set(v.id, v)
          continue
        }
        if (!byUsername.has(uk)) byUsername.set(uk, v)
      }

      setAvailableVisitors(
        [...byUsername.values()].sort((a, b) =>
          `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`),
        ),
      )
    } catch (error) {
      console.error("Error loading visitors:", error)
      setAvailableVisitors([])
    } finally {
      setIsLoadingVisitors(false)
    }
  }

  const loadVisits = async () => {
    if (!quotation) return
    
    try {
      if (useApi) {
        // Use GET /api/quotations/{quotationId}/visits endpoint
        // apiRequest returns data.data, so response is already the data object
        // API response structure: { success: true, data: { visits: [...] } }
        // After apiRequest unwrapping: response = { visits: [...] }
        const response = await api.visits.getByQuotation(quotation.id)
        const visitsList = response.visits || []
        setVisits(visitsList.map((v: any) => ({
          id: v.id,
          date: v.visitDate,
          time: resolveVisitTimeRange(v),
          location: v.location,
          locationLink: v.locationLink,
          notes: v.notes,
          // visitors array now includes full visitor details from API
          visitors: (v.visitors || []).map((visitor: any) => ({
            visitorId: visitor.visitorId || visitor.id,
            visitorName: visitor.fullName || `${visitor.firstName || ""} ${visitor.lastName || ""}`.trim(),
          })),
          createdAt: v.createdAt,
        })))
      } else {
        // Fallback to localStorage
        const stored = localStorage.getItem(`visits_${quotation.id}`)
        if (stored) {
          setVisits(JSON.parse(stored))
        } else {
          setVisits([])
        }
      }
    } catch (error) {
      console.error("Error loading visits:", error)
      setVisits([])
    }
  }

  const saveVisits = async (newVisit: Visit) => {
    if (!quotation) return
    
    try {
      if (useApi) {
        // Filter and validate visitors - ensure at least one valid visitor
        const validVisitors = (newVisit.visitors || [])
          .filter(v => v.visitorId && v.visitorId.trim())
          .map(v => ({ visitorId: v.visitorId.trim() }))
        
        if (validVisitors.length === 0) {
          throw new Error("At least one visitor must be assigned")
        }

        // Ensure date is in YYYY-MM-DD format
        const visitDate = newVisit.date || ""
        if (!visitDate) {
          throw new Error("Visit date is required")
        }

        // Ensure time is in HH:MM format (24-hour)
        const visitTime = newVisit.time || ""
        if (!visitTime) {
          throw new Error("Visit time is required")
        }

        // Ensure location is not empty
        const location = (newVisit.location || "").trim()
        if (!location) {
          throw new Error("Visit location is required")
        }

        // Create visit via API
        const startTime = getVisitStartTime(visitTime)
        const endTime = getVisitEndTime(visitTime)
        const visitData: any = {
          quotationId: quotation.id,
          visitDate: visitDate,
          visitTime: visitTime,
          ...(startTime ? { visitStartTime: startTime } : {}),
          ...(endTime ? { visitEndTime: endTime } : {}),
          visitTimeRange: visitTime,
          location: location,
          visitors: validVisitors,
        }

        // Add optional fields only if they have values
        if (newVisit.locationLink && newVisit.locationLink.trim()) {
          visitData.locationLink = newVisit.locationLink.trim()
        }
        if (newVisit.notes && newVisit.notes.trim()) {
          visitData.notes = newVisit.notes.trim()
        }
        
        // Log the data being sent for debugging
        console.log("Sending visit data to API:", visitData)
        
        await api.visits.create(visitData)
        // Reload visits
        await loadVisits()
      } else {
        // Fallback to localStorage
        const stored = localStorage.getItem(`visits_${quotation.id}`) || "[]"
        const existing = JSON.parse(stored)
        existing.push(newVisit)
        localStorage.setItem(`visits_${quotation.id}`, JSON.stringify(existing))
        setVisits(existing)
      }
    } catch (error) {
      console.error("Error saving visit:", error)
      throw error
    }
  }

  const handleAddVisit = async () => {
    if (!quotation) return

    if (!formData.date || !formData.startTime || !formData.endTime || !formData.location.trim()) {
      alert("Please fill in date, start time, end time, and location")
      return
    }

    const startTime = normalizeTimeForApi(formData.startTime)
    const endTime = normalizeTimeForApi(formData.endTime)
    if (!startTime || !endTime) {
      alert("Please enter valid start and end times")
      return
    }
    if (endTime <= startTime) {
      alert("End time must be after start time")
      return
    }

    if (!selectedVisitorId.trim()) {
      alert("Please select a visitor")
      return
    }

    const selected = availableVisitors.find((v) => v.id === selectedVisitorId)
    const validVisitors: VisitVisitor[] = [
      {
        visitorId: selectedVisitorId,
        visitorName: selected
          ? `${selected.firstName} ${selected.lastName}`.trim()
          : "",
      },
    ]

    const newVisit: Visit = {
      id: `visit_${Date.now()}`,
      date: formData.date,
      time: `${startTime} - ${endTime}`,
      location: formData.location.trim(),
      locationLink: formData.locationLink.trim() || undefined,
      notes: formData.notes.trim() || undefined,
      visitors: validVisitors,
      createdAt: new Date().toISOString(),
    }

    try {
      await saveVisits(newVisit)
      setIsAdding(false)
      // Reset form with customer address
      const address = quotation?.customer?.address
      const customerAddress = address
        ? `${address.street || ""}, ${address.city || ""}, ${address.state || ""} - ${address.pincode || ""}`.replace(/^,\s*|,\s*$/g, "").replace(/,\s*,/g, ",")
        : ""
      setFormData({
        date: "",
        startTime: "",
        endTime: "",
        location: customerAddress,
        locationLink: "",
        notes: "",
      })
      setSelectedVisitorId("")
    } catch (error) {
      console.error("Error adding visit:", error)
      let errorMessage = "Failed to add visit. Please try again."
      if (error instanceof ApiError) {
        // Show detailed validation error if available
        if (error.details && error.details.length > 0) {
          errorMessage = `Validation error:\n${error.details.map(d => `${d.field}: ${d.message}`).join("\n")}`
        } else {
          errorMessage = error.message || errorMessage
        }
      } else if (error instanceof Error) {
        errorMessage = error.message
      }
      alert(errorMessage)
    }
  }

  const handleDeleteVisit = async (visitId: string) => {
    if (!confirm("Are you sure you want to delete this visit?")) return
    
    try {
      if (useApi) {
        await api.visits.delete(visitId)
        await loadVisits()
      } else {
        // Fallback to localStorage
        const updatedVisits = visits.filter((v) => v.id !== visitId)
        if (!quotation) return
        localStorage.setItem(`visits_${quotation.id}`, JSON.stringify(updatedVisits))
        setVisits(updatedVisits)
      }
    } catch (error) {
      console.error("Error deleting visit:", error)
      alert(error instanceof ApiError ? error.message : "Failed to delete visit. Please try again.")
    }
  }

  const openRescheduleDialog = (visit: Visit) => {
    setRescheduleVisit(visit)
    setRescheduleReason("")
    setRescheduleDate(visit.date || "")
    setRescheduleStartTime(getVisitStartTime(visit.time) || visit.time || "")
    setRescheduleEndTime(getVisitEndTime(visit.time) || "")
  }

  const handleRescheduleVisit = async () => {
    if (!quotation || !rescheduleVisit) return
    if (!rescheduleReason.trim() || !rescheduleDate || !rescheduleStartTime || !rescheduleEndTime) {
      alert("Please enter reason, date, start time, and end time")
      return
    }
    const startTime = normalizeTimeForApi(rescheduleStartTime)
    const endTime = normalizeTimeForApi(rescheduleEndTime)
    if (!startTime || !endTime) {
      alert("Please enter valid start and end times")
      return
    }
    if (endTime <= startTime) {
      alert("End time must be after start time")
      return
    }

    const timeRange = `${startTime} - ${endTime}`

    try {
      if (useApi) {
        await api.visits.reschedule(
          rescheduleVisit.id,
          {
            reason: rescheduleReason.trim(),
            visitDate: rescheduleDate,
            visitTime: timeRange,
            visitStartTime: startTime,
            visitEndTime: endTime,
            visitTimeRange: timeRange,
          },
          quotation?.id ? { quotationId: quotation.id } : undefined,
        )
        await loadVisits()
      } else {
        const updatedVisits = visits.map((v) =>
          v.id === rescheduleVisit.id
            ? {
                ...v,
                date: rescheduleDate,
                time: timeRange,
                notes: [v.notes || "", `Reschedule reason: ${rescheduleReason.trim()}`]
                  .map((part) => part.trim())
                  .filter(Boolean)
                  .join(" | "),
              }
            : v,
        )
        localStorage.setItem(`visits_${quotation.id}`, JSON.stringify(updatedVisits))
        setVisits(updatedVisits)
      }

      setRescheduleVisit(null)
      setRescheduleReason("")
      setRescheduleDate("")
      setRescheduleStartTime("")
      setRescheduleEndTime("")
    } catch (error) {
      console.error("Error rescheduling visit:", error)
      alert(error instanceof ApiError ? error.message : "Failed to reschedule visit. Please try again.")
    }
  }

  const openTransferDialog = (visit: Visit, preferVisitorId?: string) => {
    const currentId = visit.visitors?.[0]?.visitorId || ""
    setTransferVisit(visit)
    setTransferReason("")
    const preferred =
      preferVisitorId && preferVisitorId !== currentId
        ? preferVisitorId
        : ""
    if (preferred) {
      setTransferVisitorId(preferred)
      return
    }
    setTransferVisitorId("")
    const others = availableVisitors.filter((v) => v.id !== currentId)
    if (others.length === 1) setTransferVisitorId(others[0].id)
  }

  /** From Assign Visitor form: transfer an existing scheduled visit to the selected visitor. */
  const openTransferFromAssignForm = () => {
    const transferable = visits.filter((v) => !isPastVisit(v))
    if (transferable.length === 0) {
      alert("No upcoming scheduled visits to transfer. Schedule a visit first, then use Transfer.")
      return
    }
    if (!selectedVisitorId.trim()) {
      alert("Select the visitor to transfer the visit to")
      return
    }
    // Prefer visit currently assigned to someone else; otherwise first upcoming
    const targetVisit =
      transferable.find((v) => (v.visitors?.[0]?.visitorId || "") !== selectedVisitorId) ||
      transferable[0]
    if ((targetVisit.visitors?.[0]?.visitorId || "") === selectedVisitorId) {
      alert("This visit is already assigned to the selected visitor. Choose a different visitor.")
      return
    }
    openTransferDialog(targetVisit, selectedVisitorId)
  }

  const handleTransferVisit = async () => {
    if (!quotation || !transferVisit) return
    if (!transferVisitorId.trim()) {
      alert("Please select the visitor to transfer this visit to")
      return
    }
    const currentId = transferVisit.visitors?.[0]?.visitorId || ""
    if (transferVisitorId === currentId) {
      alert("Choose a different visitor to transfer to")
      return
    }
    const selected = availableVisitors.find((v) => v.id === transferVisitorId)
    const visitorName = selected
      ? `${selected.firstName} ${selected.lastName}`.trim()
      : ""
    const visitorsPayload = [{ visitorId: transferVisitorId, visitorName }]

    setIsTransferring(true)
    try {
      if (useApi) {
        await api.visits.transfer(transferVisit.id, {
          visitorId: transferVisitorId,
          visitorName,
          visitors: visitorsPayload,
          reason: transferReason.trim() || undefined,
        })
        await loadVisits()
      } else {
        const updatedVisits = visits.map((v) =>
          v.id === transferVisit.id
            ? {
                ...v,
                visitors: visitorsPayload,
                notes: [
                  v.notes || "",
                  transferReason.trim()
                    ? `Transferred to ${visitorName}: ${transferReason.trim()}`
                    : `Transferred to ${visitorName}`,
                ]
                  .map((p) => p.trim())
                  .filter(Boolean)
                  .join(" | "),
              }
            : v,
        )
        localStorage.setItem(`visits_${quotation.id}`, JSON.stringify(updatedVisits))
        setVisits(updatedVisits)
      }
      setTransferVisit(null)
      setTransferVisitorId("")
      setTransferReason("")
    } catch (error) {
      console.error("Error transferring visit:", error)
      alert(error instanceof ApiError ? error.message : "Failed to transfer visit. Please try again.")
    } finally {
      setIsTransferring(false)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString("en-IN", {
      weekday: "short",
      year: "numeric",
      month: "short",
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
    // Encode the location for Google Maps URL
    const encodedLocation = encodeURIComponent(location)
    // Open Google Maps with directions (current location as source, visit location as destination)
    const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodedLocation}`
    window.open(mapsUrl, "_blank")
  }

  if (!quotation) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <Calendar className="w-4 h-4 sm:w-5 sm:h-5" />
            Visit Management
          </DialogTitle>
          <DialogDescription className="text-sm">
            Schedule and manage visits for {customerDisplayName} (Quotation: {quotation?.id || ""})
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 sm:space-y-6">
          {/* Add Visit Button */}
          {!isAdding && (
            <Button onClick={() => setIsAdding(true)} className="w-full h-11">
              <Plus className="w-4 h-4 mr-2" />
              Schedule New Visit
            </Button>
          )}

          {/* Add Visit Form */}
          {isAdding && (
            <Card className="border-primary/20">
              <CardContent className="pt-4 sm:pt-6 p-3 sm:p-6">
                <div className="space-y-3 sm:space-y-4">
                  <div className="flex items-center justify-between mb-3 sm:mb-4">
                    <h3 className="text-sm sm:text-base font-semibold">New Visit Schedule</h3>
                    <Button variant="ghost" size="icon" onClick={() => setIsAdding(false)}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="visit-date" className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        Date
                      </Label>
                      <Input
                        id="visit-date"
                        type="date"
                        value={formData.date}
                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                        min={new Date().toISOString().split("T")[0]}
                        className="mt-1"
                      />
                    </div>

                    <div>
                      <Label htmlFor="visit-start-time" className="flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        Start Time
                      </Label>
                      <Input
                        id="visit-start-time"
                        type="time"
                        value={formData.startTime}
                        onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="visit-end-time" className="flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        End Time
                      </Label>
                      <Input
                        id="visit-end-time"
                        type="time"
                        value={formData.endTime}
                        onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                        className="mt-1"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="visit-location" className="flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      Location
                    </Label>
                    <Textarea
                      id="visit-location"
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      placeholder="Enter visit location address"
                      className="mt-1 min-h-[80px]"
                      rows={3}
                    />
                  </div>

                  <div>
                    <Label htmlFor="visit-location-link" className="flex items-center gap-2">
                      <Link className="w-4 h-4" />
                      Current Location Link (Optional)
                    </Label>
                    <Input
                      id="visit-location-link"
                      type="url"
                      value={formData.locationLink}
                      onChange={(e) => setFormData({ ...formData, locationLink: e.target.value })}
                      placeholder="https://maps.google.com/... or GPS coordinates"
                      className="mt-1"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Enter Google Maps link or GPS coordinates for the visit location
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="visit-notes">Notes (Optional)</Label>
                    <Textarea
                      id="visit-notes"
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="Add any additional notes or remarks..."
                      className="mt-1"
                      rows={3}
                    />
                  </div>

                  {/* Assign single visitor — dropdown shows Admin-checked Visitor access only */}
                  <div className="border-t pt-4 space-y-3">
                    <Label className="flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      Assign Visitor *
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Only users with the Visitor checkbox in Admin → Users appear here. One visitor per visit.
                      Use Transfer to move an existing scheduled visit to the visitor selected below.
                    </p>
                    <Select
                      value={selectedVisitorId}
                      onValueChange={setSelectedVisitorId}
                      disabled={isLoadingVisitors}
                    >
                      <SelectTrigger>
                        <SelectValue
                          placeholder={isLoadingVisitors ? "Loading visitors..." : "Select visitor"}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {isLoadingVisitors ? (
                          <SelectItem value="loading" disabled>
                            Loading visitors...
                          </SelectItem>
                        ) : availableVisitors.length > 0 ? (
                          availableVisitors.map((v) => (
                            <SelectItem key={v.id} value={v.id}>
                              {v.firstName} {v.lastName}
                              {v.username ? ` (${v.username})` : ""}
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="no-visitors" disabled>
                            No visitors with Visitor access
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button 
                      onClick={handleAddVisit} 
                      className="flex-1 h-11"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Schedule Visit
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1 h-11"
                      onClick={openTransferFromAssignForm}
                      disabled={isLoadingVisitors || visits.filter((v) => !isPastVisit(v)).length === 0}
                    >
                      <ArrowRightLeft className="w-4 h-4 mr-2" />
                      Transfer
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsAdding(false)
                        setSelectedVisitorId("")
                      }}
                      className="flex-1 h-11"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Scheduled Visits List */}
          <div>
            <h3 className="font-semibold mb-4">
              Scheduled Visits ({visits.length})
            </h3>
            {visits.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No visits scheduled yet</p>
                  <p className="text-sm mt-2">Click "Schedule New Visit" to add one</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {visits.map((visit) => (
                  <Card
                    key={visit.id}
                    className={`border-l-4 ${
                      isPastVisit(visit)
                        ? "border-muted-foreground/50 bg-muted/30"
                        : "border-primary"
                    }`}
                  >
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-3 flex-wrap">
                            <Badge
                              variant={isPastVisit(visit) ? "secondary" : "default"}
                              className="flex items-center gap-1"
                            >
                              <Calendar className="w-3 h-3" />
                              {formatDate(visit.date)}
                            </Badge>
                            <Badge
                              variant={isPastVisit(visit) ? "secondary" : "default"}
                              className="flex items-center gap-1"
                            >
                              <Clock className="w-3 h-3" />
                              {formatTime(visit.time)}
                            </Badge>
                            {isPastVisit(visit) && (
                              <Badge variant="outline" className="text-xs">
                                Past Visit
                              </Badge>
                            )}
                          </div>

                          <div className="flex items-start gap-2 group">
                            <MapPin className="w-4 h-4 text-muted-foreground group-hover:text-primary mt-0.5 flex-shrink-0 transition-colors" />
                            <button
                              onClick={() => openLocationInMaps(visit.location)}
                              className="text-sm text-foreground hover:text-primary hover:underline text-left transition-colors cursor-pointer flex-1"
                              title="Click to open in Google Maps with directions"
                            >
                              {visit.location}
                            </button>
                          </div>

                          {visit.locationLink && (
                            <div className="flex items-start gap-2 group">
                              <Link className="w-4 h-4 text-muted-foreground group-hover:text-primary mt-0.5 flex-shrink-0 transition-colors" />
                              <a
                                href={visit.locationLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-primary hover:underline text-left transition-colors cursor-pointer flex-1"
                                title="Open location link"
                              >
                                {visit.locationLink.length > 50 
                                  ? `${visit.locationLink.substring(0, 50)}...` 
                                  : visit.locationLink}
                              </a>
                            </div>
                          )}

                          {visit.visitors && visit.visitors.length > 0 && (
                            <div className="bg-primary/5 rounded-md p-2 mt-2 border border-primary/20">
                              <div className="flex items-center gap-2 mb-2">
                                <Users className="w-3 h-3 text-primary" />
                                <p className="text-xs font-semibold text-primary">Assigned Visitor:</p>
                              </div>
                              <div className="space-y-1">
                                {visit.visitors.map((v, idx) => (
                                  <div key={idx} className="text-xs">
                                    <span className="font-medium">{v.visitorName}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {visit.notes && (
                            <div className="bg-muted/50 rounded-md p-2 mt-2">
                              <p className="text-xs text-muted-foreground mb-1">Notes:</p>
                              <p className="text-sm">{visit.notes}</p>
                            </div>
                          )}
                        </div>

                        <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                          {!isPastVisit(visit) ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openTransferDialog(visit)}
                            >
                              <ArrowRightLeft className="w-4 h-4 mr-1" />
                              Transfer
                            </Button>
                          ) : null}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openRescheduleDialog(visit)}
                          >
                            <Calendar className="w-4 h-4 mr-1" />
                            Reschedule
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteVisit(visit.id)}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>

      <Dialog open={!!rescheduleVisit} onOpenChange={(open) => !open && setRescheduleVisit(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Reschedule Visit</DialogTitle>
              <DialogDescription>Update visit date and time range with reason.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="reschedule-reason">Reason *</Label>
                <Textarea
                  id="reschedule-reason"
                  value={rescheduleReason}
                  onChange={(e) => setRescheduleReason(e.target.value)}
                  placeholder="Please provide reason for rescheduling..."
                  rows={3}
                  className="mt-1"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <Label htmlFor="reschedule-date">Date *</Label>
                  <Input
                    id="reschedule-date"
                    type="date"
                    value={rescheduleDate}
                    onChange={(e) => setRescheduleDate(e.target.value)}
                    min={new Date().toISOString().split("T")[0]}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="reschedule-start-time">Start *</Label>
                  <Input
                    id="reschedule-start-time"
                    type="time"
                    value={rescheduleStartTime}
                    onChange={(e) => setRescheduleStartTime(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="reschedule-end-time">End *</Label>
                  <Input
                    id="reschedule-end-time"
                    type="time"
                    value={rescheduleEndTime}
                    onChange={(e) => setRescheduleEndTime(e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setRescheduleVisit(null)}>
                  Cancel
                </Button>
                <Button onClick={handleRescheduleVisit} className="bg-purple-600 hover:bg-purple-700">
                  <Calendar className="w-4 h-4 mr-2" />
                  Reschedule Visit
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

      <Dialog
        open={!!transferVisit}
        onOpenChange={(open) => {
          if (!open) {
            setTransferVisit(null)
            setTransferVisitorId("")
            setTransferReason("")
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Transfer Visit</DialogTitle>
            <DialogDescription>
              Move this visit to another visitor. Only users with Visitor access in Admin are listed.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {transferVisit ? (
              <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-1">
                <p>
                  <span className="text-muted-foreground">Visit: </span>
                  <span className="font-medium">
                    {formatDate(transferVisit.date)} · {formatTime(transferVisit.time)}
                  </span>
                </p>
                {transferVisit.visitors?.[0]?.visitorName ? (
                  <p>
                    <span className="text-muted-foreground">Current visitor: </span>
                    <span className="font-medium">{transferVisit.visitors[0].visitorName}</span>
                  </p>
                ) : null}
              </div>
            ) : null}
            {visits.filter((v) => !isPastVisit(v)).length > 1 ? (
              <div>
                <Label>Which visit to transfer *</Label>
                <Select
                  value={transferVisit?.id || ""}
                  onValueChange={(id) => {
                    const visit = visits.find((v) => v.id === id)
                    if (visit) openTransferDialog(visit, transferVisitorId || selectedVisitorId || undefined)
                  }}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select scheduled visit" />
                  </SelectTrigger>
                  <SelectContent>
                    {visits
                      .filter((v) => !isPastVisit(v))
                      .map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {formatDate(v.date)} · {formatTime(v.time)}
                          {v.visitors?.[0]?.visitorName ? ` → ${v.visitors[0].visitorName}` : ""}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            <div>
              <Label>Transfer to visitor *</Label>
              <Select
                value={transferVisitorId}
                onValueChange={setTransferVisitorId}
                disabled={isLoadingVisitors}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select visitor" />
                </SelectTrigger>
                <SelectContent>
                  {availableVisitors
                    .filter((v) => v.id !== transferVisit?.visitors?.[0]?.visitorId)
                    .map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.firstName} {v.lastName}
                        {v.username ? ` (${v.username})` : ""}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="transfer-reason">Reason (optional)</Label>
              <Textarea
                id="transfer-reason"
                value={transferReason}
                onChange={(e) => setTransferReason(e.target.value)}
                placeholder="Why is this visit being transferred?"
                rows={2}
                className="mt-1"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setTransferVisit(null)
                  setTransferVisitorId("")
                  setTransferReason("")
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleTransferVisit} disabled={isTransferring}>
                <ArrowRightLeft className="w-4 h-4 mr-2" />
                {isTransferring ? "Transferring..." : "Transfer Visit"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  )
}

