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
import { Calendar, Clock, MapPin, Plus, X, Trash2, Users, Link } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { Visitor } from "@/lib/auth-context"
import { api, ApiError } from "@/lib/api"

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

interface VisitManagementDialogProps {
  quotation: Quotation | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function VisitManagementDialog({ quotation, open, onOpenChange }: VisitManagementDialogProps) {
  const useApi = process.env.NEXT_PUBLIC_USE_API !== "false"
  const [visits, setVisits] = useState<Visit[]>([])
  const [isAdding, setIsAdding] = useState(false)
  const [availableVisitors, setAvailableVisitors] = useState<Visitor[]>([])
  const [assignedVisitors, setAssignedVisitors] = useState<VisitVisitor[]>([])
  const [isLoadingVisitors, setIsLoadingVisitors] = useState(false)
  const [formData, setFormData] = useState({
    date: "",
    time: "",
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
      setAssignedVisitors([])
    }
  }, [quotation, open])

  const loadAvailableVisitors = async () => {
    setIsLoadingVisitors(true)
    try {
      if (useApi) {
        // Use the dealer visitors endpoint: GET /api/dealers/visitors
        // apiRequest returns data.data, so response is already the data object
        // API response structure: { success: true, data: { visitors: [...] } }
        // After apiRequest unwrapping: response = { visitors: [...] }
        const response = await api.dealers.getVisitors({ isActive: true })
        const visitorsList = response.visitors || []
        
        if (visitorsList.length > 0) {
          setAvailableVisitors(visitorsList.map((v: any) => ({
            id: v.id,
            username: v.username || "",
            password: "",
            firstName: v.firstName || "",
            lastName: v.lastName || "",
            email: v.email || "",
            mobile: v.mobile || "",
            employeeId: v.employeeId,
            isActive: v.isActive ?? true,
          })))
        } else {
          console.warn("No active visitors found in API response")
          setAvailableVisitors([])
        }
      } else {
        // Fallback to localStorage
        const visitors = JSON.parse(localStorage.getItem("visitors") || "[]")
        setAvailableVisitors(visitors.filter((v: any) => v.isActive !== false))
      }
    } catch (error) {
      console.error("Error loading visitors from API:", error)
      // Only fallback to localStorage if API is explicitly disabled
      if (!useApi) {
        const visitors = JSON.parse(localStorage.getItem("visitors") || "[]")
        setAvailableVisitors(visitors.filter((v: any) => v.isActive !== false))
      } else {
        // If API is enabled but call failed, show empty list instead of dummy data
        console.error("Failed to load visitors from API. Please check your connection and try again.")
        setAvailableVisitors([])
      }
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
          time: v.visitTime,
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
        const visitData: any = {
          quotationId: quotation.id,
          visitDate: visitDate,
          visitTime: visitTime,
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

    if (!formData.date || !formData.time || !formData.location.trim()) {
      alert("Please fill in date, time, and location")
      return
    }

    if (assignedVisitors.length === 0) {
      alert("Please assign at least one visitor")
      return
    }

    // Validate that at least one assigned visitor has a valid visitorId
    const hasValidVisitor = assignedVisitors.some(v => v.visitorId && v.visitorId.trim())
    if (!hasValidVisitor) {
      alert("Please select a visitor for at least one assigned visitor slot")
      return
    }

    // Filter out visitors with empty IDs (only send valid visitors)
    const validVisitors = assignedVisitors.filter(v => v.visitorId && v.visitorId.trim())

    const newVisit: Visit = {
      id: `visit_${Date.now()}`,
      date: formData.date,
      time: formData.time,
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
        time: "",
        location: customerAddress,
        locationLink: "",
        notes: "",
      })
      setAssignedVisitors([])
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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString("en-IN", {
      weekday: "short",
      year: "numeric",
      month: "short",
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
            Schedule and manage visits for {quotation?.customer?.firstName || ""} {quotation?.customer?.lastName || ""} (Quotation: {quotation?.id || ""})
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
                      <Label htmlFor="visit-time" className="flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        Time
                      </Label>
                      <Input
                        id="visit-time"
                        type="time"
                        value={formData.time}
                        onChange={(e) => setFormData({ ...formData, time: e.target.value })}
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

                  {/* Assign Visitors */}
                  <div className="border-t pt-4">
                    <div className="flex items-center justify-between mb-3">
                      <Label className="flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        Assign Visitors (Fixed Assignment)
                      </Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setAssignedVisitors([...assignedVisitors, { visitorId: "", visitorName: "" }])
                        }}
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        Add Visitor
                      </Button>
                    </div>

                    {assignedVisitors.map((visitor, index) => (
                      <Card key={index} className="mb-3 border-border">
                        <CardContent className="pt-4">
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium">Assigned Visitor {index + 1}</span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setAssignedVisitors(assignedVisitors.filter((_, i) => i !== index))
                                }}
                                className="h-6 w-6"
                              >
                                <X className="w-3 h-3" />
                              </Button>
                            </div>

                            <div>
                              <Label className="text-xs">Select Visitor</Label>
                              <Select
                                value={visitor.visitorId}
                                onValueChange={(value) => {
                                  const selected = availableVisitors.find((v) => v.id === value)
                                  const updated = [...assignedVisitors]
                                  updated[index] = {
                                    ...updated[index],
                                    visitorId: value,
                                    visitorName: selected ? `${selected.firstName} ${selected.lastName}` : "",
                                  }
                                  setAssignedVisitors(updated)
                                }}
                                disabled={isLoadingVisitors}
                              >
                                <SelectTrigger className="mt-1">
                                  <SelectValue placeholder={isLoadingVisitors ? "Loading visitors..." : "Select visitor"} />
                                </SelectTrigger>
                                <SelectContent>
                                  {isLoadingVisitors ? (
                                    <SelectItem value="loading" disabled>
                                      Loading visitors...
                                    </SelectItem>
                                  ) : availableVisitors.length > 0 ? (
                                    availableVisitors.map((v) => (
                                      <SelectItem key={v.id} value={v.id}>
                                        {v.firstName} {v.lastName} ({v.username})
                                      </SelectItem>
                                    ))
                                  ) : (
                                    <SelectItem value="no-visitors" disabled>
                                      No active visitors available
                                    </SelectItem>
                                  )}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}

                    {assignedVisitors.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-2">
                        No visitors assigned. Click "Add Visitor" to assign one.
                      </p>
                    )}
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
                      variant="outline"
                      onClick={() => {
                        setIsAdding(false)
                        setAssignedVisitors([])
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
                                <p className="text-xs font-semibold text-primary">Assigned Visitors (Fixed):</p>
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

                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteVisit(visit.id)}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

