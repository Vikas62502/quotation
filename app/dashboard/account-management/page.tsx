"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { LogOut, User } from "lucide-react"
import { SolarLogo } from "@/components/solar-logo"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { FileText, Search, Eye, IndianRupee, Calendar } from "lucide-react"
import type { Quotation } from "@/lib/quotation-context"
import { QuotationDetailsDialog } from "@/components/quotation-details-dialog"
import { api, ApiError } from "@/lib/api"
import { calculateSystemSize } from "@/lib/pricing-tables"


export default function AccountManagementPage() {
  const { isAuthenticated, role, logout, accountManager } = useAuth()
  const router = useRouter()
  const { toast } = useToast()
  const [quotations, setQuotations] = useState<Quotation[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedQuotation, setSelectedQuotation] = useState<Quotation | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  const useApi = process.env.NEXT_PUBLIC_USE_API !== "false"

  useEffect(() => {
    // Initialize on mount - wait for auth state
    const timer = setTimeout(() => {
      setIsInitialLoad(false)
    }, 100)

    return () => clearTimeout(timer)
  }, [])

  const loadApprovedQuotations = useCallback(async () => {
    const useApi = process.env.NEXT_PUBLIC_USE_API !== "false"
    setIsLoading(true)
    try {
      if (useApi) {
        // Account Management users should use admin endpoint to get ONLY approved quotations
        // Backend should filter by status=approved on server side
        const response = await api.admin.quotations.getAll({
          status: "approved",  // Request only approved quotations from backend - MANDATORY
          page: 1,
          limit: 1000,  // Get all approved quotations (adjust pagination if needed)
        })
        
        // Handle different response structures
        // apiRequest returns data.data, so response might be { quotations: [...] } or just array
        let quotationsList: any[] = []
        if (Array.isArray(response)) {
          quotationsList = response
        } else if (response?.quotations && Array.isArray(response.quotations)) {
          quotationsList = response.quotations
        } else if (response?.data?.quotations && Array.isArray(response.data.quotations)) {
          quotationsList = response.data.quotations
        }
        
        // Backend should return only approved quotations, but filter again as safety measure
        const approvedQuotations = quotationsList
          .filter((q: any) => q.status === "approved")  // Double-check on frontend for security
          .map((q: any) => ({
            id: q.id,
            customer: q.customer || {},
            products: q.products || {},
            discount: q.discount || 0,
            totalAmount: q.pricing?.totalAmount || 0,
            finalAmount: q.pricing?.finalAmount || q.finalAmount || 0,
            createdAt: q.createdAt,
            dealerId: q.dealerId,
            status: "approved",  // Ensure status is always approved
          }))
        setQuotations(approvedQuotations)
      } else {
        // Fallback to localStorage for development
        try {
          const allQuotations = JSON.parse(localStorage.getItem("quotations") || "[]")
          const approvedQuotations = allQuotations
            .filter((q: Quotation) => q.status === "approved" || q.status === "Approved")
            .map((q: Quotation) => ({ 
              ...q, 
              status: "approved" as const,
              id: q.id || `QT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              customer: q.customer || {},
              products: q.products || {},
              discount: q.discount || 0,
              totalAmount: q.totalAmount || 0,
              finalAmount: q.finalAmount || q.totalAmount || 0,
              createdAt: q.createdAt || new Date().toISOString(),
              dealerId: q.dealerId || null,
            }))
          
          setQuotations(approvedQuotations)
          
          console.log(`Loaded ${approvedQuotations.length} approved quotations from localStorage`)
        } catch (parseError) {
          console.error("Error parsing localStorage quotations:", parseError)
          setQuotations([])
          toast({
            title: "Error Loading Data",
            description: "Failed to load quotations from local storage. Please check the data format.",
            variant: "destructive",
          })
        }
      }
    } catch (error) {
      console.error("Error loading approved quotations:", error)
      setQuotations([])
      
      // Show error toast only if not in initial load
      if (error instanceof ApiError) {
        toast({
          title: "Error Loading Data",
          description: error.message || "Failed to load approved quotations. Please check your connection and try again.",
          variant: "destructive",
        })
      } else {
        console.warn("Non-API error loading quotations:", error)
        // Don't show toast for development mode errors - just log
        if (useApi) {
          toast({
            title: "Connection Error",
            description: "Unable to connect to server. Please check your internet connection.",
            variant: "destructive",
          })
        }
      }
    } finally {
      setIsLoading(false)
    }
  }, [toast])

  useEffect(() => {
    // Skip if still initializing
    if (isInitialLoad) return

    // Only account-management role can access this page
    if (!isAuthenticated) {
      router.push("/account-management-login")
      return
    }
    
    if (role !== "account-management") {
      // Redirect to appropriate page based on role
      if (role === "visitor") {
        router.push("/visitor/dashboard")
      } else if (role === "admin") {
        router.push("/dashboard/admin")
      } else {
        router.push("/dashboard")
      }
      return
    }
    
    // Load data only if authenticated as account-management
    if (isAuthenticated && role === "account-management") {
      loadApprovedQuotations()
    }
  }, [isAuthenticated, role, router, isInitialLoad, loadApprovedQuotations])

  // Show loading state while checking authentication
  if (isInitialLoad) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4 animate-pulse">
            <FileText className="w-8 h-8 text-primary opacity-50" />
          </div>
          <p className="text-muted-foreground">Loading Account Management...</p>
        </div>
      </div>
    )
  }

  // Don't render if not authenticated - redirect will happen
  if (!isAuthenticated || role !== "account-management") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
            <FileText className="w-8 h-8 opacity-50" />
          </div>
          <p className="text-muted-foreground">Redirecting to login...</p>
        </div>
      </div>
    )
  }

  const filteredQuotations = quotations.filter(
    (q) =>
      (q.customer?.firstName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (q.customer?.lastName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (q.customer?.mobile || "").includes(searchTerm) ||
      (q.id || "").toLowerCase().includes(searchTerm.toLowerCase()),
  )

  const sortedQuotations = [...filteredQuotations].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )

  const totalApprovedValue = quotations.reduce((sum, q) => sum + Math.abs(q.finalAmount || 0), 0)

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
      const systemType = products.systemType.toLowerCase()
      if (systemType === "dcr") return "DCR"
      if (systemType === "non-dcr") return "NON DCR"
      if (systemType === "both") return "BOTH"
      if (systemType === "customize") return "CUSTOMIZE"
      return products.systemType.toUpperCase()
    }

    return "N/A"
  }

  const handleLogout = () => {
    // Direct logout without confirmation for better UX
    logout()
    toast({
      title: "Logged Out",
      description: "You have been successfully logged out",
    })
    // Clear any cached data
    setQuotations([])
    setSearchTerm("")
    setSelectedQuotation(null)
    // Navigate to login
    router.push("/account-management-login")
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Account Management Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 shadow-sm">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <button onClick={() => router.push("/dashboard/account-management")} className="flex items-center">
              <SolarLogo size="md" />
            </button>
            <div className="flex items-center gap-3">
              {accountManager && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-primary/5 border border-primary/20">
                  <User className="w-4 h-4 text-primary" />
                  <span className="text-sm font-semibold text-foreground hidden sm:inline">
                    {accountManager.firstName} {accountManager.lastName}
                  </span>
                  <span className="text-sm font-semibold text-foreground sm:hidden">
                    {accountManager.firstName.charAt(0)}{accountManager.lastName.charAt(0)}
                  </span>
                </div>
              )}
              <span className="text-sm font-medium text-muted-foreground hidden lg:inline">Account Management</span>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleLogout} 
                className="gap-2 border-border hover:bg-destructive hover:text-destructive-foreground hover:border-destructive transition-colors shrink-0 font-medium"
                title="Logout from Account Management"
              >
                <LogOut className="w-4 h-4" />
                <span>Logout</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <FileText className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                Account Management
                {accountManager && (
                  <span className="text-lg font-normal text-muted-foreground ml-2">
                    - Welcome, {accountManager.firstName}!
                  </span>
                )}
              </h1>
              <p className="text-muted-foreground">Approved quotations from admin panel - ready for processing</p>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card className="border-border/50 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Approved Quotations</CardTitle>
              <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                <FileText className="w-5 h-5 text-green-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{quotations.length}</div>
              <p className="text-xs text-muted-foreground mt-1">Total approved</p>
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
              <div className="text-2xl font-bold">₹{(totalApprovedValue / 100000).toFixed(1)}L</div>
              <p className="text-xs text-muted-foreground mt-1">Approved quotation value</p>
            </CardContent>
          </Card>
          <Card className="border-border/50 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Last Updated</CardTitle>
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-blue-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-sm font-bold">
                {quotations.length > 0 
                  ? new Date(quotations[0]?.createdAt || Date.now()).toLocaleDateString("en-IN")
                  : "N/A"}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Most recent approval</p>
            </CardContent>
          </Card>
        </div>

        {/* Approved Quotations Table */}
        <Card className="border-border/50 shadow-sm">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle className="text-lg">Approved Quotations from Admin</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">Only quotations approved by admin are visible here</p>
              </div>
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
            {isLoading ? (
              <div className="text-center py-12 text-muted-foreground">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4 animate-pulse">
                  <FileText className="w-8 h-8 text-primary opacity-50" />
                </div>
                <p className="font-medium text-foreground">Loading approved quotations...</p>
                <p className="text-sm mt-1">Fetching only approved quotations from admin panel</p>
              </div>
            ) : sortedQuotations.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                  <FileText className="w-8 h-8 opacity-50" />
                </div>
                <p className="font-medium">No approved quotations</p>
                <p className="text-sm mt-1">Only quotations approved by admin will appear here</p>
                <p className="text-xs mt-2 text-muted-foreground/80">Waiting for admin approval...</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Quotation ID
                      </th>
                      <th className="text-left py-3 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Customer Information
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
                      <th className="text-right py-3 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">
                        Approved Date
                      </th>
                      <th className="text-right py-3 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedQuotations.map((quotation) => (
                      <tr
                        key={quotation.id}
                        className="border-b border-border last:border-0 hover:bg-green-50 dark:hover:bg-green-950/20 transition-colors bg-green-50/50 dark:bg-green-950/10"
                      >
                        <td className="py-4 px-3 text-sm font-mono text-muted-foreground font-semibold">{quotation.id || "N/A"}</td>
                        <td className="py-4 px-3">
                          <div>
                            <p className="text-sm font-semibold text-foreground">
                              {quotation.customer?.firstName || "N/A"} {quotation.customer?.lastName || ""}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">{quotation.customer?.mobile || "No mobile"}</p>
                            {quotation.customer?.email && (
                              <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-xs">{quotation.customer.email}</p>
                            )}
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
                          <Badge className="text-xs bg-green-600 text-white">
                            Approved
                          </Badge>
                        </td>
                        <td className="py-4 px-3 text-sm text-right text-muted-foreground hidden md:table-cell">
                          {new Date(quotation.createdAt).toLocaleDateString("en-IN")}
                        </td>
                        <td className="py-4 px-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => {
                                setSelectedQuotation(quotation)
                                setDialogOpen(true)
                              }}
                              className="h-8 w-8 p-0 flex items-center justify-center rounded-md hover:bg-muted transition-colors"
                              title="View Details"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
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
    </div>
  )
}
