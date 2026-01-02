"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { api, ApiError } from "@/lib/api"
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

type VisitStatus = "pending" | "approved" | "completed" | "incomplete" | "rejected" | "rescheduled"

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
  const [approveOutcome, setApproveOutcome] = useState<"completed" | "incomplete" | "rescheduled" | null>(null)
  const [approvedVisits, setApprovedVisits] = useState<Set<string>>(new Set())
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false)
  const [incompleteRescheduleDialogOpen, setIncompleteRescheduleDialogOpen] = useState(false)
  const [length, setLength] = useState("")
  const [width, setWidth] = useState("")
  const [height, setHeight] = useState("")
  const [images, setImages] = useState<File[]>([])
  const [imagePreviews, setImagePreviews] = useState<string[]>([])
  const [reason, setReason] = useState("")
  const [completeNotes, setCompleteNotes] = useState("")

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

    try {
      if (useApi) {
        const response = await api.visitors.getAssignedVisits()
        const visitsList = response.visits || []
        
        const visits: VisitWithQuotation[] = visitsList.map((v: any) => ({
          id: v.id,
          date: v.visitDate,
          time: v.visitTime,
          location: v.location,
          locationLink: v.locationLink,
          notes: v.notes,
          status: v.status,
          feedback: v.feedback,
          rejectionReason: v.rejectionReason,
          length: v.length,
          width: v.width,
          height: v.height,
          images: v.images,
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
          dealer: v.dealer ? {
            id: v.dealer.id || "",
            firstName: v.dealer.firstName || "",
            lastName: v.dealer.lastName || "",
          } : undefined,
        }))
        
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
          const dateA = new Date(`${a.date}T${a.time}`)
          const dateB = new Date(`${b.date}T${b.time}`)
          return dateA.getTime() - dateB.getTime()
        })

        setAssignedVisits(visits)
      }
    } catch (error) {
      console.error("Error loading assigned visits:", error)
    }
  }

  const handleLogout = () => {
    logout()
    router.push("/visitor-login")
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

  const formatTime = (timeString: string) => {
    const [hours, minutes] = timeString.split(":")
    const hour = Number.parseInt(hours)
    const ampm = hour >= 12 ? "PM" : "AM"
    const displayHour = hour % 12 || 12
    return `${displayHour}:${minutes} ${ampm}`
  }

  const isPastVisit = (visit: Visit) => {
    const visitDateTime = new Date(`${visit.date}T${visit.time}`)
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

  const handleApproveOutcomeClick = (outcome: "completed" | "incomplete" | "rescheduled") => {
    if (!selectedVisit) return
    setApproveOutcome(outcome)
    if (outcome === "completed") {
      // Open complete dialog with dimensions and images
      setLength(selectedVisit.length?.toString() || "")
      setWidth(selectedVisit.width?.toString() || "")
      setHeight(selectedVisit.height?.toString() || "")
      setImages([])
      setImagePreviews(selectedVisit.images || [])
      setCompleteNotes(selectedVisit.notes || "")
      setCompleteDialogOpen(true)
    } else {
      // Open incomplete/reschedule dialog with reason
      setReason("")
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
      // Convert images to base64 for storage
      const imagePromises = images.map((file) => {
        return new Promise<string>((resolve) => {
          const reader = new FileReader()
          reader.onload = (e) => resolve(e.target?.result as string)
          reader.readAsDataURL(file)
        })
      })

      const base64Images = await Promise.all(imagePromises)
      const allImages = [...imagePreviews, ...base64Images]

      if (useApi) {
        await api.visits.complete(selectedVisit.id, {
          length: parseFloat(length) || 0,
          width: parseFloat(width) || 0,
          height: parseFloat(height) || 0,
          images: allImages,
          notes: completeNotes.trim() || undefined,
        })
        await loadAssignedVisits()
      } else {
        // Fallback to localStorage
        const storedVisits = JSON.parse(localStorage.getItem(`visits_${selectedVisit.quotationId}`) || "[]")
        const updatedVisits = storedVisits.map((v: Visit) => {
          if (v.id === selectedVisit.id) {
            return {
              ...v,
              status: "completed",
              length: length ? parseFloat(length) : undefined,
              width: width ? parseFloat(width) : undefined,
              height: height ? parseFloat(height) : undefined,
              images: allImages.length > 0 ? allImages : undefined,
              notes: completeNotes.trim() || undefined,
            }
          }
          return v
        })
        localStorage.setItem(`visits_${selectedVisit.quotationId}`, JSON.stringify(updatedVisits))
        await loadAssignedVisits()
      }

      setCompleteDialogOpen(false)
      setSelectedVisit(null)
      setApproveOutcome(null)
      setLength("")
      setWidth("")
      setHeight("")
      setImages([])
      setImagePreviews([])
      setCompleteNotes("")
    } catch (error) {
      console.error("Error completing visit:", error)
      alert(error instanceof ApiError ? error.message : "Failed to complete visit")
    }
  }

  const handleIncompleteRescheduleVisit = async () => {
    if (!selectedVisit || !reason.trim() || !approveOutcome) return

    try {
      if (useApi) {
        if (approveOutcome === "incomplete") {
          await api.visits.incomplete(selectedVisit.id, reason.trim())
        } else if (approveOutcome === "rescheduled") {
          await api.visits.reschedule(selectedVisit.id, reason.trim())
        }
        await loadAssignedVisits()
      } else {
        // Fallback to localStorage
        const storedVisits = JSON.parse(localStorage.getItem(`visits_${selectedVisit.quotationId}`) || "[]")
        const updatedVisits = storedVisits.map((v: Visit) => {
          if (v.id === selectedVisit.id) {
            return {
              ...v,
              status: approveOutcome,
              rejectionReason: reason.trim(),
            }
          }
          return v
        })
        localStorage.setItem(`visits_${selectedVisit.quotationId}`, JSON.stringify(updatedVisits))
        await loadAssignedVisits()
      }

      setIncompleteRescheduleDialogOpen(false)
      setSelectedVisit(null)
      setStatusAction(null)
      setApproveOutcome(null)
      setReason("")
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
    setImages((prev) => prev.filter((_, i) => i !== index))
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
                  {(searchTerm.trim() || agentFilter !== "all" || statusFilter !== "all" || dateFilter !== "all") && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSearchTerm("")
                        setAgentFilter("all")
                        setStatusFilter("all")
                        setDateFilter("all")
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

        {(() => {
          // Filter visits by search term, agent filter, status, and date
          const filteredVisits = assignedVisits.filter((visit) => {
            // Filter by agent (dropdown)
            if (agentFilter !== "all") {
              if (visit.quotation.dealerId !== agentFilter) return false
            }

            // Search across multiple fields
            if (searchTerm.trim()) {
              const searchLower = searchTerm.toLowerCase()
              const customerName = `${visit.quotation.customer.firstName} ${visit.quotation.customer.lastName}`.toLowerCase()
              const quotationId = visit.quotation.id.toLowerCase()
              const location = visit.location.toLowerCase()
              const agentName = getDealerName(visit.quotation.dealerId, visit).toLowerCase()
              const customerMobile = visit.quotation.customer.mobile.toLowerCase()
              const customerEmail = visit.quotation.customer.email.toLowerCase()

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
            if (statusFilter !== "all") {
              if (visit.status !== statusFilter) return false
            }

            // Filter by date
            if (dateFilter !== "all") {
              const visitDate = new Date(`${visit.date}T${visit.time}`)
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

          if (filteredVisits.length === 0) {
            return (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>
                    {searchTerm.trim() || agentFilter !== "all" || statusFilter !== "all" || dateFilter !== "all"
                      ? "No visits found matching your search/filters"
                      : "No visits assigned to you yet"}
                  </p>
                  {(searchTerm.trim() || agentFilter !== "all" || statusFilter !== "all" || dateFilter !== "all") && (
                    <Button
                      variant="link"
                      onClick={() => {
                        setSearchTerm("")
                        setAgentFilter("all")
                        setStatusFilter("all")
                        setDateFilter("all")
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

          return (
            <div className="space-y-4">
              {filteredVisits.map((visit) => {
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
                                    setSelectedVisit(visit)
                                    handleApproveOutcomeClick("completed")
                                  }}
                                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                                >
                                  <CheckCircle className="w-4 h-4 mr-2" />
                                  Complete
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    setSelectedVisit(visit)
                                    handleApproveOutcomeClick("incomplete")
                                  }}
                                  className="flex-1 bg-orange-600 hover:bg-orange-700"
                                >
                                  <XCircle className="w-4 h-4 mr-2" />
                                  Incomplete
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    setSelectedVisit(visit)
                                    handleApproveOutcomeClick("rescheduled")
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
                      {/* Show buttons for approved visits */}
                      {visit.status === "approved" && (
                        <div className="space-y-2">
                          <div className="flex flex-col sm:flex-row gap-2">
                            <Button
                              size="sm"
                              onClick={() => {
                                setSelectedVisit(visit)
                                handleApproveOutcomeClick("completed")
                              }}
                              className="flex-1 bg-blue-600 hover:bg-blue-700"
                            >
                              <CheckCircle className="w-4 h-4 mr-2" />
                              Complete
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => {
                                setSelectedVisit(visit)
                                handleApproveOutcomeClick("incomplete")
                              }}
                              className="flex-1 bg-orange-600 hover:bg-orange-700"
                            >
                              <XCircle className="w-4 h-4 mr-2" />
                              Incomplete
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => {
                                setSelectedVisit(visit)
                                handleApproveOutcomeClick("rescheduled")
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
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="length">Length (cm) *</Label>
                <Input
                  id="length"
                  type="number"
                  value={length}
                  onChange={(e) => setLength(e.target.value)}
                  placeholder="0"
                  className="mt-1"
                  min="0"
                  step="0.01"
                />
              </div>
              <div>
                <Label htmlFor="width">Width (cm) *</Label>
                <Input
                  id="width"
                  type="number"
                  value={width}
                  onChange={(e) => setWidth(e.target.value)}
                  placeholder="0"
                  className="mt-1"
                  min="0"
                  step="0.01"
                />
              </div>
              <div>
                <Label htmlFor="height">Height (cm) *</Label>
                <Input
                  id="height"
                  type="number"
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
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
                disabled={!length || !width || !height || imagePreviews.length === 0}
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
                    Reschedule
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

