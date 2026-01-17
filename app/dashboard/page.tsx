"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { DashboardNav } from "@/components/dashboard-nav"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Users, FileText, Calendar, Search, Eye, PlusCircle, IndianRupee } from "lucide-react"
import type { Quotation } from "@/lib/quotation-context"
import { Badge } from "@/components/ui/badge"
import { QuotationDetailsDialog } from "@/components/quotation-details-dialog"
import { VisitManagementDialog } from "@/components/visit-management-dialog"
import { api, ApiError } from "@/lib/api"
import { calculateSystemSize } from "@/lib/pricing-tables"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"

const ADMIN_USERNAME = "admin"

export default function DashboardPage() {
  const { isAuthenticated, dealer, role } = useAuth()
  const router = useRouter()
  const { toast } = useToast()
  const [quotations, setQuotations] = useState<Quotation[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedQuotation, setSelectedQuotation] = useState<Quotation | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [visitQuotation, setVisitQuotation] = useState<Quotation | null>(null)
  const [visitDialogOpen, setVisitDialogOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [quotationVisits, setQuotationVisits] = useState<Record<string, any[]>>({})
  const [documentsDialogOpen, setDocumentsDialogOpen] = useState(false)
  const [documentsQuotation, setDocumentsQuotation] = useState<Quotation | null>(null)
  const [documentsFormById, setDocumentsFormById] = useState<Record<string, any>>({})
  const [isSubmittingDocuments, setIsSubmittingDocuments] = useState(false)
  const useApi = process.env.NEXT_PUBLIC_USE_API !== "false"

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/login")
      return
    }

    if (role === "account-management") {
      router.push("/dashboard/account-management")
      return
    }
    
    // Redirect admin to admin panel
    if (dealer?.username === ADMIN_USERNAME) {
      router.push("/dashboard/admin")
      return
    }
    
    loadQuotations()
  }, [isAuthenticated, router, dealer, role])

  const loadQuotations = async () => {
    if (!dealer?.id) return
    
    setIsLoading(true)
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
      if (error instanceof ApiError) {
        alert(`Error: ${error.message}`)
      }
    } finally {
      setIsLoading(false)
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
  if (role === "account-management") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
            <FileText className="w-8 h-8 opacity-50" />
          </div>
          <p className="text-muted-foreground">Redirecting to Account Management...</p>
        </div>
      </div>
    )
  }

  const currentMonth = new Date().getMonth()
  const currentYear = new Date().getFullYear()

  const thisMonthQuotations = quotations.filter((q) => {
    const date = new Date(q.createdAt)
    return date.getMonth() === currentMonth && date.getFullYear() === currentYear
  })

  const lastMonthQuotations = quotations.filter((q) => {
    const date = new Date(q.createdAt)
    const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1
    const year = currentMonth === 0 ? currentYear - 1 : currentYear
    return date.getMonth() === lastMonth && date.getFullYear() === year
  })

  const uniqueCustomers = new Set(quotations.map((q) => q.customer?.mobile || "").filter((m) => m)).size
  const totalRevenue = quotations.reduce((sum, q) => sum + Math.abs(q.finalAmount || 0), 0)

  const filteredQuotations = quotations.filter(
    (q) =>
      (q.customer?.firstName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (q.customer?.lastName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (q.customer?.mobile || "").includes(searchTerm) ||
      (q.id || "").toLowerCase().includes(searchTerm.toLowerCase()),
  )

  const recentQuotations = [...filteredQuotations]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5)

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
        panNumber: "",
        panImage: null,
        electricityKno: "",
        electricityBillImage: null,
        bankAccountNumber: "",
        bankIfsc: "",
        bankName: "",
        bankBranch: "",
        bankPassbookImage: null,
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

    appendIfValue("panNumber", form.panNumber)
    appendFile("panImage", form.panImage)
    appendIfValue("electricityKno", form.electricityKno)
    appendFile("electricityBillImage", form.electricityBillImage)

    appendIfValue("bankAccountNumber", form.bankAccountNumber)
    appendIfValue("bankIfsc", form.bankIfsc)
    appendIfValue("bankName", form.bankName)
    appendIfValue("bankBranch", form.bankBranch)
    appendFile("bankPassbookImage", form.bankPassbookImage)

    appendIfValue("emailId", form.contactEmail)
    return formData
  }

  const getSystemSize = (quotation: Quotation): string => {
    const products = quotation.products
    if (!products) return "N/A"

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
            <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
            <p className="text-muted-foreground">Welcome back, {dealer?.firstName}!</p>
          </div>
          <Button onClick={() => router.push("/dashboard/new-quotation")} className="shadow-lg shadow-primary/25">
            <PlusCircle className="w-4 h-4 mr-2" />
            New Quotation
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card className="border-border/50 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Customers</CardTitle>
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-primary" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{uniqueCustomers}</div>
              <p className="text-xs text-muted-foreground mt-1">Unique customers</p>
            </CardContent>
          </Card>
          <Card className="border-border/50 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Quotations</CardTitle>
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <FileText className="w-5 h-5 text-blue-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{quotations.length}</div>
              <p className="text-xs text-muted-foreground mt-1">All time</p>
            </CardContent>
          </Card>
          <Card className="border-border/50 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">This Month</CardTitle>
              <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-green-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{thisMonthQuotations.length}</div>
              <p className="text-xs text-muted-foreground mt-1">Quotations created</p>
            </CardContent>
          </Card>
          <Card className="border-border/50 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Value</CardTitle>
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <IndianRupee className="w-5 h-5 text-amber-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">₹{(totalRevenue / 100000).toFixed(1)}L</div>
              <p className="text-xs text-muted-foreground mt-1">Quotation value</p>
            </CardContent>
          </Card>
        </div>

        {/* Search and Recent Quotations */}
        <Card className="border-border/50 shadow-sm">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <CardTitle className="text-lg">Recent Quotations</CardTitle>
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, mobile, ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 h-10"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {recentQuotations.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                  <FileText className="w-8 h-8 opacity-50" />
                </div>
                <p className="font-medium">No quotations yet</p>
                <p className="text-sm mt-1">Create your first quotation to get started</p>
                <Button variant="default" onClick={() => router.push("/dashboard/new-quotation")} className="mt-4">
                  <PlusCircle className="w-4 h-4 mr-2" />
                  Create Quotation
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        ID
                      </th>
                      <th className="text-left py-3 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Customer
                      </th>
                      <th className="text-left py-3 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden sm:table-cell">
                        System
                      </th>
                      <th className="text-right py-3 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Amount
                      </th>
                      <th className="text-left py-3 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Status
                      </th>
                      <th className="text-left py-3 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Visit Status
                      </th>
                      <th className="text-right py-3 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">
                        Date
                      </th>
                      <th className="text-right py-3 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentQuotations.map((quotation) => (
                      <tr
                        key={quotation.id}
                        className={`border-b border-border last:border-0 hover:bg-muted/30 transition-colors ${getStatusColor(
                          quotation.status,
                        )}`}
                      >
                        <td className="py-4 px-3 text-sm font-mono text-muted-foreground">{quotation.id}</td>
                        <td className="py-4 px-3">
                          <div>
                            <p className="text-sm font-medium text-foreground">
                              {quotation.customer?.firstName || ""} {quotation.customer?.lastName || ""}
                            </p>
                            <p className="text-xs text-muted-foreground">{quotation.customer?.mobile || ""}</p>
                          </div>
                        </td>
                        <td className="py-4 px-3 text-sm hidden sm:table-cell">
                          <span className="px-2.5 py-1 bg-primary/10 text-primary rounded-full text-xs font-medium uppercase">
                            {getSystemSize(quotation)}
                          </span>
                        </td>
                        <td className="py-4 px-3 text-sm text-right font-semibold text-foreground">
                          ₹{Math.abs(quotation.finalAmount || 0).toLocaleString()}
                        </td>
                        <td className="py-4 px-3 text-sm">
                          <Badge className={`text-xs ${getStatusBadgeColor(quotation.status)}`}>
                            {(quotation.status || "pending").charAt(0).toUpperCase() +
                              (quotation.status || "pending").slice(1)}
                          </Badge>
                        </td>
                        <td className="py-4 px-3 text-sm">
                          <Badge className={`text-xs ${getVisitStatusBadgeColor(getVisitStatus(quotation))}`}>
                            {getVisitStatus(quotation)}
                          </Badge>
                        </td>
                        <td className="py-4 px-3 text-sm text-right text-muted-foreground hidden md:table-cell">
                          {new Date(quotation.createdAt).toLocaleDateString("en-IN")}
                        </td>
                        <td className="py-4 px-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setVisitQuotation(quotation)
                                setVisitDialogOpen(true)
                              }}
                              className="h-8 w-8 p-0"
                              title="Visit Management"
                            >
                              <Calendar className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setDocumentsQuotation(quotation)
                                setDocumentsDialogOpen(true)
                              }}
                              className="h-8 w-8 p-0"
                              title="Document Submission"
                            >
                              <FileText className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedQuotation(quotation)
                                setDialogOpen(true)
                              }}
                              className="h-8 w-8 p-0"
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
                  {documentsQuotation.customer?.firstName || ""} {documentsQuotation.customer?.lastName || ""}
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
                            When checked, compliant Aadhar front/back and contact number are mandatory.
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
                          <Label>Phone Number</Label>
                          <Input
                            value={form.contactPhone}
                            onChange={(e) => updateDocumentsForm(documentsQuotation.id, { contactPhone: e.target.value })}
                            placeholder="Enter phone number"
                          />
                        </div>
                        <div>
                          <Label>Aadhar Front Image</Label>
                          <Input
                            type="file"
                            accept="image/*"
                            onChange={(e) =>
                              updateDocumentsForm(documentsQuotation.id, { aadharFront: e.target.files?.[0] || null })
                            }
                          />
                        </div>
                        <div>
                          <Label>Aadhar Back Image</Label>
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
                      <div className="rounded-lg border border-amber-200 bg-amber-50/40 p-4 space-y-4">
                        <p className="text-sm font-semibold text-amber-900">Compliant Details (Mandatory)</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <Label>Compliant Aadhar Number *</Label>
                            <Input
                              value={form.compliantAadharNumber}
                              onChange={(e) =>
                                updateDocumentsForm(documentsQuotation.id, { compliantAadharNumber: e.target.value })
                              }
                              placeholder="Enter compliant Aadhar number"
                              required
                            />
                          </div>
                          <div>
                            <Label>Compliant Contact No *</Label>
                            <Input
                              value={form.compliantContactPhone}
                              onChange={(e) =>
                                updateDocumentsForm(documentsQuotation.id, { compliantContactPhone: e.target.value })
                              }
                              placeholder="Enter compliant contact number"
                              required
                            />
                          </div>
                          <div>
                            <Label>Compliant Aadhar Front Image *</Label>
                            <Input
                              type="file"
                              accept="image/*"
                              onChange={(e) =>
                                updateDocumentsForm(documentsQuotation.id, {
                                  compliantAadharFront: e.target.files?.[0] || null,
                                })
                              }
                              required
                            />
                          </div>
                          <div>
                            <Label>Compliant Aadhar Back Image *</Label>
                            <Input
                              type="file"
                              accept="image/*"
                              onChange={(e) =>
                                updateDocumentsForm(documentsQuotation.id, {
                                  compliantAadharBack: e.target.files?.[0] || null,
                                })
                              }
                              required
                            />
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
                          <Label>PAN Image</Label>
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
                          <Label>Electricity Bill KNO</Label>
                          <Input
                            value={form.electricityKno}
                            onChange={(e) =>
                              updateDocumentsForm(documentsQuotation.id, { electricityKno: e.target.value })
                            }
                            placeholder="Enter KNO"
                          />
                        </div>
                        <div>
                          <Label>Electricity Bill Image</Label>
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
                          <Label>Bank Passbook Image</Label>
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
                          <Label>Email ID</Label>
                          <Input
                            type="email"
                            value={form.contactEmail}
                            onChange={(e) => updateDocumentsForm(documentsQuotation.id, { contactEmail: e.target.value })}
                            placeholder="Enter email"
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

                    if (form.contactPhone && !phonePattern.test(form.contactPhone)) {
                      toast({
                        title: "Invalid phone number",
                        description: "Phone number must be 10 digits.",
                        variant: "destructive",
                      })
                      return
                    }

                    if (isCompliant) {
                      if (form.compliantAadharNumber && !aadharPattern.test(form.compliantAadharNumber)) {
                        toast({
                          title: "Invalid compliant Aadhar",
                          description: "Aadhar number must be 12 digits.",
                          variant: "destructive",
                        })
                        return
                      }

                      if (form.compliantContactPhone && !phonePattern.test(form.compliantContactPhone)) {
                        toast({
                          title: "Invalid compliant phone",
                          description: "Phone number must be 10 digits.",
                          variant: "destructive",
                        })
                        return
                      }

                      const missing =
                        !form.compliantAadharNumber ||
                        !form.compliantContactPhone ||
                        !form.compliantAadharFront ||
                        !form.compliantAadharBack
                      if (missing) {
                        toast({
                          title: "Missing compliant details",
                          description: "Please fill compliant Aadhar details and contact number.",
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
