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
import { Calendar, Clock, MapPin, Plus, X, Trash2, Users } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { Visitor } from "@/lib/auth-context"

interface VisitVisitor {
  visitorId: string
  visitorName: string
  availableFrom: string
  availableTo: string
}

interface Visit {
  id: string
  date: string
  time: string
  location: string
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
  const [visits, setVisits] = useState<Visit[]>([])
  const [isAdding, setIsAdding] = useState(false)
  const [availableVisitors, setAvailableVisitors] = useState<Visitor[]>([])
  const [assignedVisitors, setAssignedVisitors] = useState<VisitVisitor[]>([])
  const [formData, setFormData] = useState({
    date: "",
    time: "",
    location: "",
    notes: "",
  })

  useEffect(() => {
    if (quotation && open) {
      loadVisits()
      loadAvailableVisitors()
      // Pre-fill location with customer address
      const customerAddress = `${quotation.customer.address.street}, ${quotation.customer.address.city}, ${quotation.customer.address.state} - ${quotation.customer.address.pincode}`
      setFormData((prev) => ({ ...prev, location: customerAddress }))
      setAssignedVisitors([])
    }
  }, [quotation, open])

  const loadAvailableVisitors = () => {
    const visitors = JSON.parse(localStorage.getItem("visitors") || "[]")
    setAvailableVisitors(visitors)
  }

  const loadVisits = () => {
    if (!quotation) return
    const stored = localStorage.getItem(`visits_${quotation.id}`)
    if (stored) {
      setVisits(JSON.parse(stored))
    } else {
      setVisits([])
    }
  }

  const saveVisits = (newVisits: Visit[]) => {
    if (!quotation) return
    localStorage.setItem(`visits_${quotation.id}`, JSON.stringify(newVisits))
    setVisits(newVisits)
  }

  const handleAddVisit = () => {
    if (!quotation) return

    if (!formData.date || !formData.time || !formData.location.trim()) {
      alert("Please fill in date, time, and location")
      return
    }

    const newVisit: Visit = {
      id: `visit_${Date.now()}`,
      date: formData.date,
      time: formData.time,
      location: formData.location.trim(),
      notes: formData.notes.trim() || undefined,
      visitors: assignedVisitors.length > 0 ? assignedVisitors : undefined,
      createdAt: new Date().toISOString(),
    }

    const updatedVisits = [...visits, newVisit].sort((a, b) => {
      const dateA = new Date(`${a.date}T${a.time}`)
      const dateB = new Date(`${b.date}T${b.time}`)
      return dateA.getTime() - dateB.getTime()
    })

    saveVisits(updatedVisits)
    setIsAdding(false)
    // Reset form with customer address
    const customerAddress = `${quotation.customer.address.street}, ${quotation.customer.address.city}, ${quotation.customer.address.state} - ${quotation.customer.address.pincode}`
    setFormData({
      date: "",
      time: "",
      location: customerAddress,
      notes: "",
    })
    setAssignedVisitors([])
  }

  const handleDeleteVisit = (visitId: string) => {
    if (confirm("Are you sure you want to delete this visit?")) {
      const updatedVisits = visits.filter((v) => v.id !== visitId)
      saveVisits(updatedVisits)
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
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Visit Management
          </DialogTitle>
          <DialogDescription>
            Schedule and manage visits for {quotation.customer.firstName} {quotation.customer.lastName} (Quotation: {quotation.id})
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Add Visit Button */}
          {!isAdding && (
            <Button onClick={() => setIsAdding(true)} className="w-full">
              <Plus className="w-4 h-4 mr-2" />
              Schedule New Visit
            </Button>
          )}

          {/* Add Visit Form */}
          {isAdding && (
            <Card className="border-primary/20">
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold">New Visit Schedule</h3>
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
                        Assign Visitors (Optional)
                      </Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setAssignedVisitors([...assignedVisitors, { visitorId: "", visitorName: "", availableFrom: "", availableTo: "" }])
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
                              <span className="text-sm font-medium">Visitor {index + 1}</span>
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
                              >
                                <SelectTrigger className="mt-1">
                                  <SelectValue placeholder="Select visitor" />
                                </SelectTrigger>
                                <SelectContent>
                                  {availableVisitors.map((v) => (
                                    <SelectItem key={v.id} value={v.id}>
                                      {v.firstName} {v.lastName} ({v.username})
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <Label className="text-xs">Available From</Label>
                                <Input
                                  type="time"
                                  value={visitor.availableFrom}
                                  onChange={(e) => {
                                    const updated = [...assignedVisitors]
                                    updated[index] = { ...updated[index], availableFrom: e.target.value }
                                    setAssignedVisitors(updated)
                                  }}
                                  className="mt-1"
                                  placeholder="12:00"
                                />
                              </div>
                              <div>
                                <Label className="text-xs">Available To</Label>
                                <Input
                                  type="time"
                                  value={visitor.availableTo}
                                  onChange={(e) => {
                                    const updated = [...assignedVisitors]
                                    updated[index] = { ...updated[index], availableTo: e.target.value }
                                    setAssignedVisitors(updated)
                                  }}
                                  className="mt-1"
                                  placeholder="14:00"
                                />
                              </div>
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

                  <div className="flex gap-2">
                    <Button onClick={handleAddVisit} className="flex-1">
                      <Plus className="w-4 h-4 mr-2" />
                      Schedule Visit
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsAdding(false)
                        setAssignedVisitors([])
                      }}
                      className="flex-1"
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

                          {visit.visitors && visit.visitors.length > 0 && (
                            <div className="bg-primary/5 rounded-md p-2 mt-2 border border-primary/20">
                              <div className="flex items-center gap-2 mb-2">
                                <Users className="w-3 h-3 text-primary" />
                                <p className="text-xs font-semibold text-primary">Assigned Visitors:</p>
                              </div>
                              <div className="space-y-1">
                                {visit.visitors.map((v, idx) => (
                                  <div key={idx} className="text-xs">
                                    <span className="font-medium">{v.visitorName}</span>
                                    {v.availableFrom && v.availableTo && (
                                      <span className="text-muted-foreground ml-2">
                                        (Available: {formatTime(v.availableFrom)} - {formatTime(v.availableTo)})
                                      </span>
                                    )}
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

