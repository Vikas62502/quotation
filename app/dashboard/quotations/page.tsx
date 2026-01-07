"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { DashboardNav } from "@/components/dashboard-nav"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Search, Eye, FileText, Calendar } from "lucide-react"
import type { Quotation } from "@/lib/quotation-context"
import { QuotationDetailsDialog } from "@/components/quotation-details-dialog"
import { VisitManagementDialog } from "@/components/visit-management-dialog"
import { api, ApiError } from "@/lib/api"
import { calculateSystemSize } from "@/lib/pricing-tables"

const ADMIN_USERNAME = "admin"

export default function QuotationsPage() {
  const { isAuthenticated, dealer } = useAuth()
  const router = useRouter()
  const [quotations, setQuotations] = useState<Quotation[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [filterMonth, setFilterMonth] = useState("all")
  const [selectedQuotation, setSelectedQuotation] = useState<Quotation | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [visitQuotation, setVisitQuotation] = useState<Quotation | null>(null)
  const [visitDialogOpen, setVisitDialogOpen] = useState(false)
  const [quotationVisits, setQuotationVisits] = useState<Record<string, any[]>>({})

  const useApi = process.env.NEXT_PUBLIC_USE_API !== "false"

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/login")
      return
    }
    
    // Redirect admin to admin panel
    if (dealer?.username === ADMIN_USERNAME) {
      router.push("/dashboard/admin")
      return
    }
    
    loadQuotations()
  }, [isAuthenticated, router, dealer])

  const loadQuotations = async () => {
    if (!dealer?.id) return
    
    try {
      if (useApi) {
        const response = await api.quotations.getAll()
        const dealerQuotations = (response.quotations || [])
          .map((q: any) => ({
            id: q.id,
            customer: q.customer || {},
            // Preserve all products data - don't default to { systemType: "N/A" } if products exists
            products: q.products || {},
            discount: q.discount || 0,
            totalAmount: q.pricing?.totalAmount || 0,
            finalAmount: q.pricing?.finalAmount || q.finalAmount || 0,
            createdAt: q.createdAt,
            dealerId: q.dealerId || dealer.id,
            status: q.status || "pending",
          }))
        setQuotations(dealerQuotations)
        // Load visits for all quotations
        await loadVisitsForQuotations(dealerQuotations)
      } else {
        // Fallback to localStorage
        const all = JSON.parse(localStorage.getItem("quotations") || "[]")
        const dealerQuotations = all
          .filter((q: Quotation) => q.dealerId === dealer.id)
          .map((q: Quotation) => ({ ...q, status: q.status || "pending" }))
        setQuotations(dealerQuotations)
        // Load visits for all quotations
        await loadVisitsForQuotations(dealerQuotations)
      }
    } catch (error) {
      console.error("Error loading quotations:", error)
    }
  }

  const loadVisitsForQuotations = async (quotationList: Quotation[]) => {
    const visitsMap: Record<string, any[]> = {}
    
    await Promise.all(
      quotationList.map(async (quotation) => {
        try {
          if (useApi) {
            const response = await api.visits.getByQuotation(quotation.id)
            // Handle different response structures
            let visitsList: any[] = []
            if (Array.isArray(response)) {
              visitsList = response
            } else if (response?.visits && Array.isArray(response.visits)) {
              visitsList = response.visits
            } else if (response?.data?.visits && Array.isArray(response.data.visits)) {
              visitsList = response.data.visits
            }
            
            // Debug logging
            if (visitsList.length > 0) {
              console.log(`[Quotations] Loaded ${visitsList.length} visits for quotation ${quotation.id}:`, visitsList.map(v => ({ id: v.id, status: v.status })))
            }
            
            visitsMap[quotation.id] = visitsList.map((v: any) => ({
              id: v.id,
              status: v.status || "pending",
              date: v.visitDate || v.date,
              time: v.visitTime || v.time,
            }))
          } else {
            // Fallback to localStorage
            const stored = localStorage.getItem(`visits_${quotation.id}`)
            if (stored) {
              const visits = JSON.parse(stored)
              visitsMap[quotation.id] = visits.map((v: any) => ({
                id: v.id,
                status: v.status || "pending",
                date: v.date,
                time: v.time,
              }))
            } else {
              visitsMap[quotation.id] = []
            }
          }
        } catch (error) {
          console.error(`Error loading visits for quotation ${quotation.id}:`, error)
          visitsMap[quotation.id] = []
        }
      })
    )
    
    setQuotationVisits(visitsMap)
  }

  const handleVisitDialogClose = (open: boolean) => {
    setVisitDialogOpen(open)
    // Reload visits when dialog closes to update status
    if (!open && quotations.length > 0) {
      loadVisitsForQuotations(quotations)
    }
  }

  if (!isAuthenticated) return null

  const filteredQuotations = quotations.filter((q) => {
    const matchesSearch =
      (q.customer?.firstName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (q.customer?.lastName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (q.customer?.mobile || "").includes(searchTerm) ||
      (q.id || "").toLowerCase().includes(searchTerm.toLowerCase())

    if (filterMonth === "all") return matchesSearch

    const date = new Date(q.createdAt)
    const currentDate = new Date()

    if (filterMonth === "current") {
      return (
        matchesSearch && date.getMonth() === currentDate.getMonth() && date.getFullYear() === currentDate.getFullYear()
      )
    }

    if (filterMonth === "previous") {
      const prevMonth = currentDate.getMonth() === 0 ? 11 : currentDate.getMonth() - 1
      const prevYear = currentDate.getMonth() === 0 ? currentDate.getFullYear() - 1 : currentDate.getFullYear()
      return matchesSearch && date.getMonth() === prevMonth && date.getFullYear() === prevYear
    }

    return matchesSearch
  })

  const sortedQuotations = [...filteredQuotations].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )

  const getStatusColor = (status?: string) => {
    switch (status) {
      case "approved":
        return "bg-green-50"
      case "rejected":
        return "bg-red-50"
      case "completed":
        return "bg-blue-50"
      default:
        return "bg-yellow-50"
    }
  }

  const getStatusBadgeColor = (status?: string) => {
    switch (status) {
      case "approved":
        return "bg-green-600 text-white"
      case "rejected":
        return "bg-red-600 text-white"
      case "completed":
        return "bg-blue-600 text-white"
      default:
        return "bg-yellow-600 text-white"
    }
  }

  const getVisitStatus = (quotation: Quotation): string => {
    const visits = quotationVisits[quotation.id] || []
    
    if (visits.length === 0) {
      return "No visits"
    }
    
    // Get the latest visit status (most recent by date/time)
    const sortedVisits = [...visits].sort((a, b) => {
      try {
        const dateA = new Date(`${a.date}T${a.time || "00:00"}`).getTime()
        const dateB = new Date(`${b.date}T${b.time || "00:00"}`).getTime()
        return dateB - dateA
      } catch {
        // If date parsing fails, compare by createdAt or id
        return 0
      }
    })
    
    const latestVisit = sortedVisits[0]
    if (!latestVisit) {
      return "No visits"
    }
    
    const status = latestVisit.status || "pending"
    
    // Capitalize first letter
    return status.charAt(0).toUpperCase() + status.slice(1)
  }

  const getVisitStatusBadgeColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "approved":
        return "bg-green-600 text-white"
      case "completed":
        return "bg-blue-600 text-white"
      case "rejected":
        return "bg-red-600 text-white"
      case "incomplete":
        return "bg-orange-600 text-white"
      case "rescheduled":
        return "bg-purple-600 text-white"
      case "no visits":
        return "bg-gray-500 text-white"
      default:
        return "bg-yellow-600 text-white"
    }
  }

  const getSystemSize = (quotation: Quotation): string => {
    const products = quotation.products
    if (!products) {
      return "N/A"
    }

    // For BOTH system type
    if (products.systemType === "both") {
      const dcrSize = products.dcrPanelSize && products.dcrPanelQuantity
        ? calculateSystemSize(products.dcrPanelSize, products.dcrPanelQuantity)
        : null
      const nonDcrSize = products.nonDcrPanelSize && products.nonDcrPanelQuantity
        ? calculateSystemSize(products.nonDcrPanelSize, products.nonDcrPanelQuantity)
        : null
      
      if (dcrSize && nonDcrSize && dcrSize !== "0kW" && nonDcrSize !== "0kW") {
        const dcrKw = Number.parseFloat(dcrSize.replace("kW", ""))
        const nonDcrKw = Number.parseFloat(nonDcrSize.replace("kW", ""))
        if (!Number.isNaN(dcrKw) && !Number.isNaN(nonDcrKw)) {
          return `${dcrKw + nonDcrKw}kW`
        }
      }
      if (dcrSize && dcrSize !== "0kW") return dcrSize
      if (nonDcrSize && nonDcrSize !== "0kW") return nonDcrSize
      // If BOTH type but can't calculate, show system type
      return "BOTH"
    }

    // For CUSTOMIZE system type
    if (products.systemType === "customize" && products.customPanels && products.customPanels.length > 0) {
      const totalKw = products.customPanels.reduce((sum, panel) => {
        if (!panel.size || !panel.quantity) return sum
        try {
          const sizeW = Number.parseInt(panel.size.replace("W", ""))
          if (Number.isNaN(sizeW)) return sum
          return sum + (sizeW * panel.quantity)
        } catch {
          return sum
        }
      }, 0) / 1000
      if (totalKw > 0) return `${totalKw}kW`
      return "CUSTOMIZE"
    }

    // For DCR, NON DCR, or other system types
    if (products.panelSize && products.panelQuantity && products.panelQuantity > 0) {
      const systemSize = calculateSystemSize(products.panelSize, products.panelQuantity)
      if (systemSize !== "0kW") return systemSize
    }

    // Fallback: Show system type if available
    if (products.systemType && products.systemType !== "N/A" && products.systemType.trim() !== "") {
      // Format system type for display
      const systemType = products.systemType.toLowerCase()
      if (systemType === "dcr") return "DCR"
      if (systemType === "non-dcr") return "NON DCR"
      if (systemType === "both") return "BOTH"
      if (systemType === "customize") return "CUSTOMIZE"
      return products.systemType.toUpperCase()
    }

    return "N/A"
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardNav />

      <main className="container mx-auto px-4 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Quotations</h1>
            <p className="text-muted-foreground">View and manage all your quotations</p>
          </div>
          <Button onClick={() => router.push("/dashboard/new-quotation")}>New Quotation</Button>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, mobile, or ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={filterMonth} onValueChange={setFilterMonth}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Filter by month" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="current">Current Month</SelectItem>
                  <SelectItem value="previous">Previous Month</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {sortedQuotations.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No quotations found</p>
                {searchTerm || filterMonth !== "all" ? (
                  <Button
                    variant="link"
                    onClick={() => {
                      setSearchTerm("")
                      setFilterMonth("all")
                    }}
                  >
                    Clear filters
                  </Button>
                ) : (
                  <Button variant="link" onClick={() => router.push("/dashboard/new-quotation")}>
                    Create your first quotation
                  </Button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground">Quotation ID</th>
                      <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground">Customer</th>
                      <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground hidden md:table-cell">
                        System Type
                      </th>
                      <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground">Amount</th>
                      <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground">Status</th>
                      <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground">Visit Status</th>
                      <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground hidden sm:table-cell">
                        Date
                      </th>
                      <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedQuotations.map((quotation) => (
                      <tr
                        key={quotation.id}
                        className={`border-b border-border last:border-0 ${getStatusColor(quotation.status)}`}
                      >
                        <td className="py-3 px-2">
                          <span className="text-sm font-mono">{quotation.id}</span>
                        </td>
                        <td className="py-3 px-2">
                          <div>
                            <p className="text-sm font-medium">
                              {quotation.customer?.firstName || ""} {quotation.customer?.lastName || ""}
                            </p>
                            <p className="text-xs text-muted-foreground">{quotation.customer?.mobile || ""}</p>
                          </div>
                        </td>
                        <td className="py-3 px-2 hidden md:table-cell">
                          <span className="px-2 py-1 bg-primary/10 text-primary rounded text-xs uppercase">
                            {getSystemSize(quotation)}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-right">
                          <div>
                            <p className="text-sm font-medium">₹{Math.abs(quotation.finalAmount || 0).toLocaleString()}</p>
                            {quotation.discount > 0 && (
                              <p className="text-xs text-muted-foreground">{quotation.discount}% off</p>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-2">
                          <Badge className={`text-xs ${getStatusBadgeColor(quotation.status)}`}>
                            {(quotation.status || "pending").charAt(0).toUpperCase() +
                              (quotation.status || "pending").slice(1)}
                          </Badge>
                        </td>
                        <td className="py-3 px-2">
                          <Badge className={`text-xs ${getVisitStatusBadgeColor(getVisitStatus(quotation))}`}>
                            {getVisitStatus(quotation)}
                          </Badge>
                        </td>
                        <td className="py-3 px-2 text-right text-sm text-muted-foreground hidden sm:table-cell">
                          {new Date(quotation.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-2 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setVisitQuotation(quotation)
                                setVisitDialogOpen(true)
                              }}
                              title="Visit Management"
                            >
                              <Calendar className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setSelectedQuotation(quotation)
                                setDialogOpen(true)
                              }}
                              title="View Details"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Quotation Details Dialog */}
      <QuotationDetailsDialog
        quotation={selectedQuotation}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />

      {/* Visit Management Dialog */}
      <VisitManagementDialog
        quotation={visitQuotation}
        open={visitDialogOpen}
        onOpenChange={handleVisitDialogClose}
      />
    </div>
  )
}
