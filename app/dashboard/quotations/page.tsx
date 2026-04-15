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
import { Search, Eye, FileText, Calendar, Download } from "lucide-react"
import type { Quotation } from "@/lib/quotation-context"
import { QuotationDetailsDialog } from "@/components/quotation-details-dialog"
import { VisitManagementDialog } from "@/components/visit-management-dialog"
import { api, ApiError } from "@/lib/api"
import { calculateSystemSize } from "@/lib/pricing-tables"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { downloadQuotationDocumentsZip } from "@/lib/documents-zip-download"

const ADMIN_USERNAME = "admin"

export default function QuotationsPage() {
  const { isAuthenticated, dealer } = useAuth()
  const router = useRouter()
  const { toast } = useToast()
  const [quotations, setQuotations] = useState<Quotation[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [filterMonth, setFilterMonth] = useState("all")
  const [selectedQuotation, setSelectedQuotation] = useState<Quotation | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [visitQuotation, setVisitQuotation] = useState<Quotation | null>(null)
  const [visitDialogOpen, setVisitDialogOpen] = useState(false)
  const [quotationVisits, setQuotationVisits] = useState<Record<string, any[]>>({})
  const [documentsDialogOpen, setDocumentsDialogOpen] = useState(false)
  const [documentsQuotation, setDocumentsQuotation] = useState<Quotation | null>(null)
  const [documentsFormById, setDocumentsFormById] = useState<Record<string, any>>({})
  const [isSubmittingDocuments, setIsSubmittingDocuments] = useState(false)
  const [documentsZipDownloading, setDocumentsZipDownloading] = useState(false)

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
            subtotal: q.pricing?.subtotal ?? q.totalAmount ?? 0,
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
          .map((q: Quotation) => ({
            ...q,
            status: q.status || "pending",
            subtotal: q.subtotal ?? (q as any).pricing?.subtotal ?? q.totalAmount ?? 0,
          }))
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

  const getSafeLastName = (lastName?: string) => {
    const cleaned = (lastName || "").trim()
    return cleaned.toLowerCase() === "na" ? "" : cleaned
  }

  const getCustomerDisplayName = (customer?: Quotation["customer"]) => {
    const firstName = (customer?.firstName || "").trim()
    const safeLastName = getSafeLastName(customer?.lastName)
    return `${firstName} ${safeLastName}`.trim()
  }

  const filteredQuotations = quotations.filter((q) => {
    const safeLastName = getSafeLastName(q.customer?.lastName)
    const matchesSearch =
      (q.customer?.firstName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      safeLastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
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

  const getDocumentsForm = (quotationId: string) => {
    return (
      documentsFormById[quotationId] || {
        isCompliantSenior: false,
        aadharNumber: "",
        aadharFront: null,
        aadharBack: null,
        compliantAadharNumber: "",
        compliantAadharFront: null,
        compliantAadharBack: null,
        compliantContactPhone: "",
        compliantPanNumber: "",
        compliantPanImage: null,
        compliantBankAccountNumber: "",
        compliantBankIfsc: "",
        compliantBankName: "",
        compliantBankBranch: "",
        compliantBankPassbookImage: null,
        panNumber: "",
        panImage: null,
        electricityKno: "",
        electricityBillImage: null,
        bankAccountNumber: "",
        bankIfsc: "",
        bankName: "",
        bankBranch: "",
        bankPassbookImage: null,
        geotagRoofPhoto: null,
        customerWithHousePhoto: null,
        propertyDocumentPdf: null,
        contactPhone: "",
        contactEmail: "",
      }
    )
  }

  const updateDocumentsForm = (quotationId: string, updates: Record<string, any>) => {
    setDocumentsFormById((prev) => ({
      ...prev,
      [quotationId]: {
        ...getDocumentsForm(quotationId),
        ...updates,
      },
    }))
  }

  const buildDocumentsFormData = (form: Record<string, any>) => {
    const formData = new FormData()
    const appendIfValue = (key: string, value: any) => {
      if (value === undefined || value === null || value === "") return
      formData.append(key, String(value))
    }
    const appendFile = (key: string, value: File | null) => {
      if (value instanceof File) formData.append(key, value)
    }

    appendIfValue("isCompliantSenior", form.isCompliantSenior ? "true" : "false")
    appendIfValue("aadharNumber", form.aadharNumber)
    appendIfValue("phoneNumber", form.contactPhone)
    appendFile("aadharFront", form.aadharFront)
    appendFile("aadharBack", form.aadharBack)

    appendIfValue("compliantAadharNumber", form.compliantAadharNumber)
    appendIfValue("compliantContactPhone", form.compliantContactPhone)
    appendFile("compliantAadharFront", form.compliantAadharFront)
    appendFile("compliantAadharBack", form.compliantAadharBack)
    appendIfValue("compliantPanNumber", form.compliantPanNumber)
    appendFile("compliantPanImage", form.compliantPanImage)
    appendIfValue("compliantBankAccountNumber", form.compliantBankAccountNumber)
    appendIfValue("compliantBankIfsc", form.compliantBankIfsc)
    appendIfValue("compliantBankName", form.compliantBankName)
    appendIfValue("compliantBankBranch", form.compliantBankBranch)
    appendFile("compliantBankPassbookImage", form.compliantBankPassbookImage)

    appendIfValue("panNumber", form.panNumber)
    appendFile("panImage", form.panImage)
    appendIfValue("electricityKno", form.electricityKno)
    appendFile("electricityBillImage", form.electricityBillImage)

    appendIfValue("bankAccountNumber", form.bankAccountNumber)
    appendIfValue("bankIfsc", form.bankIfsc)
    appendIfValue("bankName", form.bankName)
    appendIfValue("bankBranch", form.bankBranch)
    appendFile("bankPassbookImage", form.bankPassbookImage)
    appendFile("geotagRoofPhoto", form.geotagRoofPhoto)
    appendFile("customerWithHousePhoto", form.customerWithHousePhoto)
    appendFile("propertyDocumentPdf", form.propertyDocumentPdf)

    appendIfValue("emailId", form.contactEmail)
    return formData
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

      <main className="container mx-auto px-4 py-5 sm:py-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 sm:mb-8">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">Quotations</h1>
            <p className="text-sm sm:text-base text-muted-foreground">View and manage all your quotations</p>
          </div>
          <Button onClick={() => router.push("/dashboard/new-quotation")} className="w-full sm:w-auto">New Quotation</Button>
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
              <>
                <div className="space-y-3 md:hidden">
                {sortedQuotations.map((quotation) => (
                  <div key={quotation.id} className={`rounded-lg border p-3 ${getStatusColor(quotation.status)}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[11px] font-mono text-muted-foreground break-all">{quotation.id}</p>
                        <p className="text-sm font-semibold">
                          {getCustomerDisplayName(quotation.customer)}
                        </p>
                        <p className="text-xs text-muted-foreground">{quotation.customer?.mobile || ""}</p>
                      </div>
                      <Badge className={`text-[10px] ${getStatusBadgeColor(quotation.status)}`}>
                        {(quotation.status || "pending").charAt(0).toUpperCase() + (quotation.status || "pending").slice(1)}
                      </Badge>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                      <p className="text-muted-foreground">System: <span className="text-foreground">{getSystemSize(quotation)}</span></p>
                      <p className="text-muted-foreground text-right">₹{Math.abs(quotation.subtotal ?? quotation.totalAmount ?? quotation.finalAmount ?? 0).toLocaleString()}</p>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <Badge className={`text-[10px] ${getVisitStatusBadgeColor(getVisitStatus(quotation))}`}>
                        {getVisitStatus(quotation)}
                      </Badge>
                      <div className="flex items-center gap-1">
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
                            setDocumentsQuotation(quotation)
                            setDocumentsDialogOpen(true)
                          }}
                          title="Document Submission"
                        >
                          <FileText className="w-4 h-4" />
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
                    </div>
                  </div>
                ))}
              </div>

                <div className="hidden md:block overflow-x-auto">
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
                              {getCustomerDisplayName(quotation.customer)}
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
                            <p className="text-sm font-medium">₹{Math.abs(quotation.subtotal ?? quotation.totalAmount ?? quotation.finalAmount ?? 0).toLocaleString()}</p>
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
                                setDocumentsQuotation(quotation)
                                setDocumentsDialogOpen(true)
                              }}
                              title="Document Submission"
                            >
                              <FileText className="w-4 h-4" />
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
              </>
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

      {/* Document Submission Dialog */}
      <Dialog
        open={documentsDialogOpen}
        onOpenChange={(open) => {
          setDocumentsDialogOpen(open)
          if (!open) {
            setDocumentsQuotation(null)
          }
        }}
      >
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Document Submission</DialogTitle>
            <DialogDescription>
              Upload customer documents and payment details for this quotation.
            </DialogDescription>
          </DialogHeader>
          {documentsQuotation && (
            <div className="space-y-6">
              <div className="rounded-lg border border-border/60 bg-muted/20 px-4 py-3">
                <p className="text-sm font-semibold">
                  {getCustomerDisplayName(documentsQuotation.customer)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {documentsQuotation.customer?.mobile || ""} • {documentsQuotation.id}
                </p>
              </div>

              {(() => {
                const form = getDocumentsForm(documentsQuotation.id)
                const isCompliant = Boolean(form.isCompliantSenior)

                return (
                  <>
                    <div className="rounded-lg border border-border/60 bg-muted/10 p-4 space-y-3">
                      <div className="flex items-start gap-3">
                        <input
                          id="compliant-senior"
                          type="checkbox"
                          checked={isCompliant}
                          onChange={(e) =>
                            updateDocumentsForm(documentsQuotation.id, { isCompliantSenior: e.target.checked })
                          }
                          className="h-4 w-4 mt-1"
                        />
                        <div>
                          <Label htmlFor="compliant-senior" className="text-sm font-medium">
                            Compliant (age &gt; 60)
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            When checked, compliant contact number, Aadhar front/back images, PAN image, and bank passbook image are required.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-lg border border-border/60 bg-background p-4 space-y-4">
                      <p className="text-sm font-semibold">Aadhar Details</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label>Aadhar Number</Label>
                          <Input
                            value={form.aadharNumber}
                            onChange={(e) => updateDocumentsForm(documentsQuotation.id, { aadharNumber: e.target.value })}
                            placeholder="Enter Aadhar number"
                          />
                        </div>
                        <div>
                          <Label>Phone Number *</Label>
                          <Input
                            value={form.contactPhone}
                            onChange={(e) => updateDocumentsForm(documentsQuotation.id, { contactPhone: e.target.value })}
                            placeholder="Enter phone number"
                          />
                        </div>
                        <div>
                          <Label>Aadhar Front Image *</Label>
                          <Input
                            type="file"
                            accept="image/*"
                            onChange={(e) =>
                              updateDocumentsForm(documentsQuotation.id, { aadharFront: e.target.files?.[0] || null })
                            }
                          />
                        </div>
                        <div>
                          <Label>Aadhar Back Image *</Label>
                          <Input
                            type="file"
                            accept="image/*"
                            onChange={(e) =>
                              updateDocumentsForm(documentsQuotation.id, { aadharBack: e.target.files?.[0] || null })
                            }
                          />
                        </div>
                      </div>
                    </div>

                    {isCompliant && (
                      <div className="rounded-lg border border-amber-200 bg-amber-50/40 p-4 md:p-5 space-y-4">
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-amber-900">Compliant Details (Mandatory)</p>
                          <p className="text-xs text-amber-800/80">
                            Only the fields marked with * are required to submit.
                          </p>
                        </div>

                        <div className="rounded-md border border-amber-200/80 bg-background p-4 space-y-4">
                          <p className="text-xs font-semibold uppercase tracking-wide text-amber-900">Compliant Aadhar</p>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <Label className="text-sm font-medium">Compliant Aadhar No</Label>
                              <Input
                                value={form.compliantAadharNumber}
                                onChange={(e) =>
                                  updateDocumentsForm(documentsQuotation.id, { compliantAadharNumber: e.target.value })
                                }
                                placeholder="Enter compliant Aadhar number"
                              />
                            </div>
                            <div>
                              <Label className="text-sm font-medium">Compliant Contact No *</Label>
                              <Input
                                value={form.compliantContactPhone}
                                onChange={(e) =>
                                  updateDocumentsForm(documentsQuotation.id, { compliantContactPhone: e.target.value })
                                }
                                placeholder="Enter compliant contact number"
                              />
                            </div>
                            <div>
                              <Label className="text-sm font-medium">Compliant Aadhar Front Image *</Label>
                              <Input
                                type="file"
                                accept="image/*"
                                onChange={(e) =>
                                  updateDocumentsForm(documentsQuotation.id, {
                                    compliantAadharFront: e.target.files?.[0] || null,
                                  })
                                }
                              />
                            </div>
                            <div>
                              <Label className="text-sm font-medium">Compliant Aadhar Back Image *</Label>
                              <Input
                                type="file"
                                accept="image/*"
                                onChange={(e) =>
                                  updateDocumentsForm(documentsQuotation.id, {
                                    compliantAadharBack: e.target.files?.[0] || null,
                                  })
                                }
                              />
                            </div>
                          </div>
                        </div>

                        <div className="rounded-md border border-amber-200/80 bg-background p-4 space-y-4">
                          <p className="text-xs font-semibold uppercase tracking-wide text-amber-900">Compliant PAN</p>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <Label className="text-sm font-medium">Compliant PAN Number</Label>
                              <Input
                                value={form.compliantPanNumber}
                                onChange={(e) =>
                                  updateDocumentsForm(documentsQuotation.id, { compliantPanNumber: e.target.value.toUpperCase() })
                                }
                                placeholder="Enter compliant PAN number"
                              />
                            </div>
                            <div>
                              <Label className="text-sm font-medium">Compliant PAN Image *</Label>
                              <Input
                                type="file"
                                accept="image/*"
                                onChange={(e) =>
                                  updateDocumentsForm(documentsQuotation.id, { compliantPanImage: e.target.files?.[0] || null })
                                }
                              />
                            </div>
                          </div>
                        </div>

                        <div className="rounded-md border border-amber-200/80 bg-background p-4 space-y-4">
                          <p className="text-xs font-semibold uppercase tracking-wide text-amber-900">Compliant Bank</p>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <Label className="text-sm font-medium">Compliant Account No</Label>
                              <Input
                                value={form.compliantBankAccountNumber}
                                onChange={(e) =>
                                  updateDocumentsForm(documentsQuotation.id, { compliantBankAccountNumber: e.target.value })
                                }
                                placeholder="Enter compliant bank account number"
                              />
                            </div>
                            <div>
                              <Label className="text-sm font-medium">Compliant IFSC Code</Label>
                              <Input
                                value={form.compliantBankIfsc}
                                onChange={(e) =>
                                  updateDocumentsForm(documentsQuotation.id, { compliantBankIfsc: e.target.value.toUpperCase() })
                                }
                                placeholder="Enter compliant IFSC code"
                              />
                            </div>
                            <div>
                              <Label className="text-sm font-medium">Compliant Bank Name</Label>
                              <Input
                                value={form.compliantBankName}
                                onChange={(e) =>
                                  updateDocumentsForm(documentsQuotation.id, { compliantBankName: e.target.value })
                                }
                                placeholder="Enter compliant bank name"
                              />
                            </div>
                            <div>
                              <Label className="text-sm font-medium">Compliant Branch</Label>
                              <Input
                                value={form.compliantBankBranch}
                                onChange={(e) =>
                                  updateDocumentsForm(documentsQuotation.id, { compliantBankBranch: e.target.value })
                                }
                                placeholder="Enter compliant branch name"
                              />
                            </div>
                            <div className="md:col-span-2">
                              <Label className="text-sm font-medium">Compliant Bank Passbook Image *</Label>
                              <Input
                                type="file"
                                accept="image/*"
                                onChange={(e) =>
                                  updateDocumentsForm(documentsQuotation.id, {
                                    compliantBankPassbookImage: e.target.files?.[0] || null,
                                  })
                                }
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="rounded-lg border border-border/60 bg-background p-4 space-y-4">
                      <p className="text-sm font-semibold">PAN Details</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label>PAN Number</Label>
                          <Input
                            value={form.panNumber}
                            onChange={(e) => updateDocumentsForm(documentsQuotation.id, { panNumber: e.target.value })}
                            placeholder="Enter PAN number"
                          />
                        </div>
                        <div>
                          <Label>PAN Image *</Label>
                          <Input
                            type="file"
                            accept="image/*"
                            onChange={(e) =>
                              updateDocumentsForm(documentsQuotation.id, { panImage: e.target.files?.[0] || null })
                            }
                          />
                        </div>
                      </div>
                    </div>

                    <div className="rounded-lg border border-border/60 bg-background p-4 space-y-4">
                      <p className="text-sm font-semibold">Electricity Bill</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label>Electricity Bill KNO *</Label>
                          <Input
                            value={form.electricityKno}
                            onChange={(e) =>
                              updateDocumentsForm(documentsQuotation.id, { electricityKno: e.target.value })
                            }
                            placeholder="Enter KNO"
                          />
                        </div>
                        <div>
                          <Label>Electricity Bill Image *</Label>
                          <Input
                            type="file"
                            accept="image/*"
                            onChange={(e) =>
                              updateDocumentsForm(documentsQuotation.id, {
                                electricityBillImage: e.target.files?.[0] || null,
                              })
                            }
                          />
                        </div>
                      </div>
                    </div>

                    <div className="rounded-lg border border-border/60 bg-background p-4 space-y-4">
                      <p className="text-sm font-semibold">Bank Details</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label>Bank Account Number</Label>
                          <Input
                            value={form.bankAccountNumber}
                            onChange={(e) =>
                              updateDocumentsForm(documentsQuotation.id, { bankAccountNumber: e.target.value })
                            }
                            placeholder="Enter account number"
                          />
                        </div>
                        <div>
                          <Label>IFSC Code</Label>
                          <Input
                            value={form.bankIfsc}
                            onChange={(e) => updateDocumentsForm(documentsQuotation.id, { bankIfsc: e.target.value })}
                            placeholder="Enter IFSC code"
                          />
                        </div>
                        <div>
                          <Label>Bank Name</Label>
                          <Input
                            value={form.bankName}
                            onChange={(e) => updateDocumentsForm(documentsQuotation.id, { bankName: e.target.value })}
                            placeholder="Enter bank name"
                          />
                        </div>
                        <div>
                          <Label>Branch</Label>
                          <Input
                            value={form.bankBranch}
                            onChange={(e) => updateDocumentsForm(documentsQuotation.id, { bankBranch: e.target.value })}
                            placeholder="Enter branch name"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <Label>Bank Passbook Image *</Label>
                          <Input
                            type="file"
                            accept="image/*"
                            onChange={(e) =>
                              updateDocumentsForm(documentsQuotation.id, {
                                bankPassbookImage: e.target.files?.[0] || null,
                              })
                            }
                          />
                        </div>
                      </div>
                    </div>

                    <div className="rounded-lg border border-border/60 bg-background p-4 space-y-4">
                      <p className="text-sm font-semibold">Contact Details</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label>Email ID *</Label>
                          <Input
                            type="email"
                            value={form.contactEmail}
                            onChange={(e) => updateDocumentsForm(documentsQuotation.id, { contactEmail: e.target.value })}
                            placeholder="Enter email"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="rounded-lg border border-border/60 bg-background p-4 space-y-4">
                      <p className="text-sm font-semibold">Additional Documents</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label>Geotag Roof Photo</Label>
                          <Input
                            type="file"
                            accept="image/*"
                            onChange={(e) =>
                              updateDocumentsForm(documentsQuotation.id, {
                                geotagRoofPhoto: e.target.files?.[0] || null,
                              })
                            }
                          />
                        </div>
                        <div>
                          <Label>Customer Photo with House</Label>
                          <Input
                            type="file"
                            accept="image/*"
                            onChange={(e) =>
                              updateDocumentsForm(documentsQuotation.id, {
                                customerWithHousePhoto: e.target.files?.[0] || null,
                              })
                            }
                          />
                        </div>
                        <div className="md:col-span-2">
                          <Label>Property Documents (PDF) *</Label>
                          <Input
                            type="file"
                            accept="application/pdf,.pdf"
                            onChange={(e) =>
                              updateDocumentsForm(documentsQuotation.id, {
                                propertyDocumentPdf: e.target.files?.[0] || null,
                              })
                            }
                          />
                        </div>
                      </div>
                    </div>
                  </>
                )
              })()}

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDocumentsDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={!documentsQuotation || documentsZipDownloading}
                  onClick={async () => {
                    if (!documentsQuotation) return
                    setDocumentsZipDownloading(true)
                    try {
                      const form = getDocumentsForm(documentsQuotation.id)
                      const customerName = getCustomerDisplayName(documentsQuotation.customer) || "Customer"
                      const result = await downloadQuotationDocumentsZip({
                        customerName,
                        quotationId: documentsQuotation.id,
                        form,
                      })
                      if (!result.ok) {
                        toast({
                          title: "Download failed",
                          description: result.message,
                          variant: "destructive",
                        })
                      } else {
                        toast({
                          title: "Download ready",
                          description: "ZIP includes uploaded files and document-details.txt.",
                        })
                      }
                    } finally {
                      setDocumentsZipDownloading(false)
                    }
                  }}
                >
                  <Download className="w-4 h-4 mr-2 shrink-0" />
                  {documentsZipDownloading ? "Preparing…" : "Download ZIP"}
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    if (!documentsQuotation) return
                    const form = getDocumentsForm(documentsQuotation.id)
                    const isCompliant = Boolean(form.isCompliantSenior)
                    const aadharPattern = /^\d{12}$/
                    const panPattern = /^[A-Z]{5}\d{4}[A-Z]{1}$/
                    const phonePattern = /^\d{10}$/

                    if (form.aadharNumber && !aadharPattern.test(form.aadharNumber)) {
                      toast({
                        title: "Invalid Aadhar",
                        description: "Aadhar number must be 12 digits.",
                        variant: "destructive",
                      })
                      return
                    }

                    if (form.panNumber && !panPattern.test(form.panNumber.toUpperCase())) {
                      toast({
                        title: "Invalid PAN",
                        description: "PAN must be in format ABCDE1234F.",
                        variant: "destructive",
                      })
                      return
                    }

                    if (!form.contactPhone) {
                      toast({
                        title: "Phone number is required",
                        description: "Please enter a phone number.",
                        variant: "destructive",
                      })
                      return
                    }

                    if (!phonePattern.test(form.contactPhone)) {
                      toast({
                        title: "Invalid phone number",
                        description: "Phone number must be 10 digits.",
                        variant: "destructive",
                      })
                      return
                    }

                    if (!form.electricityKno) {
                      toast({
                        title: "Electricity Bill KNO is required",
                        description: "Please enter Electricity Bill KNO.",
                        variant: "destructive",
                      })
                      return
                    }

                    if (!form.contactEmail) {
                      toast({
                        title: "Email ID is required",
                        description: "Please enter an email address.",
                        variant: "destructive",
                      })
                      return
                    }

                    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
                    if (!emailPattern.test(form.contactEmail)) {
                      toast({
                        title: "Invalid email",
                        description: "Please enter a valid email address.",
                        variant: "destructive",
                      })
                      return
                    }

                    const missingBaseImages =
                      !form.aadharFront ||
                      !form.aadharBack ||
                      !form.panImage ||
                      !form.electricityBillImage ||
                      !form.bankPassbookImage ||
                      !form.propertyDocumentPdf
                    if (missingBaseImages) {
                      toast({
                        title: "Required images missing",
                        description:
                          "Please upload Aadhar front/back, PAN image, Electricity Bill image, Bank Passbook image, and Property documents PDF.",
                        variant: "destructive",
                      })
                      return
                    }

                    if (isCompliant) {
                      if (!form.compliantContactPhone) {
                        toast({
                          title: "Compliant contact number is required",
                          description: "Please enter compliant contact number.",
                          variant: "destructive",
                        })
                        return
                      }

                      if (!phonePattern.test(form.compliantContactPhone)) {
                        toast({
                          title: "Invalid compliant phone",
                          description: "Phone number must be 10 digits.",
                          variant: "destructive",
                        })
                        return
                      }

                      if (!form.compliantAadharFront) {
                        toast({
                          title: "Compliant Aadhar front image is required",
                          description: "Please upload compliant Aadhar front image.",
                          variant: "destructive",
                        })
                        return
                      }

                      if (!form.compliantAadharBack) {
                        toast({
                          title: "Compliant Aadhar back image is required",
                          description: "Please upload compliant Aadhar back image.",
                          variant: "destructive",
                        })
                        return
                      }

                      if (!form.compliantPanImage) {
                        toast({
                          title: "Compliant PAN image is required",
                          description: "Please upload compliant PAN image.",
                          variant: "destructive",
                        })
                        return
                      }

                      if (!form.compliantBankPassbookImage) {
                        toast({
                          title: "Compliant Bank Passbook image is required",
                          description: "Please upload compliant Bank Passbook image.",
                          variant: "destructive",
                        })
                        return
                      }
                    }

                    setIsSubmittingDocuments(true)
                    if (useApi) {
                      const formData = buildDocumentsFormData(form)
                      api.quotations
                        .updateDocuments(documentsQuotation.id, formData)
                        .then(() => {
                          toast({
                            title: "Document details saved",
                            description: "Documents uploaded successfully.",
                          })
                          setDocumentsDialogOpen(false)
                        })
                        .catch((error: unknown) => {
                          const message =
                            error instanceof Error ? error.message : "Failed to upload documents."
                          toast({
                            title: "Upload failed",
                            description: message,
                            variant: "destructive",
                          })
                        })
                        .finally(() => setIsSubmittingDocuments(false))
                    } else {
                      localStorage.setItem(
                        `quotation_documents_${documentsQuotation.id}`,
                        JSON.stringify(form)
                      )
                      toast({
                        title: "Document details saved",
                        description: "Documents saved locally.",
                      })
                      setIsSubmittingDocuments(false)
                      setDocumentsDialogOpen(false)
                    }
                  }}
                  disabled={isSubmittingDocuments}
                >
                  {isSubmittingDocuments ? "Submitting..." : "Submit"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
