"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { ArrowLeft, LogOut, User, Wallet, CheckCircle2, Clock, AlertCircle, Download } from "lucide-react"
import { SolarLogo } from "@/components/solar-logo"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FileText, Search, Eye, IndianRupee, Calendar } from "lucide-react"
import type { Quotation } from "@/lib/quotation-context"
import { QuotationDetailsDialog } from "@/components/quotation-details-dialog"
import { api, ApiError } from "@/lib/api"
import { calculateSystemSize } from "@/lib/pricing-tables"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"


// Payment Phase Interface
interface PaymentPhase {
  phaseNumber: number
  phaseName: string
  amount: number
  dueDate?: string
  status: "pending" | "partial" | "completed"
  paidAmount: number
  paymentDate?: string
  paymentMode?: string
  transactionId?: string
}

interface CustomerPayment {
  quotationId: string
  customerName: string
  customerMobile: string
  totalAmount: number
  finalAmount: number
  paymentType?: string
  paymentMode?: string
  paymentStatus?: "pending" | "completed" | "partial"
  phases: PaymentPhase[]
  quotation: Quotation
}

const PAYMENT_PLANS_KEY = "quotationPaymentPlans"

export default function AccountManagementPage() {
  const { isAuthenticated, role, logout, accountManager, dealer } = useAuth()
  const router = useRouter()
  const { toast } = useToast()
  const [quotations, setQuotations] = useState<Quotation[]>([])
  const [customerPayments, setCustomerPayments] = useState<CustomerPayment[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [paymentSearchTerm, setPaymentSearchTerm] = useState("")
  const [paymentTypeFilter, setPaymentTypeFilter] = useState<"all" | "loan" | "cash" | "mix" | "unknown">("all")
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<"all" | "pending" | "partial" | "completed">("all")
  const [selectedQuotation, setSelectedQuotation] = useState<Quotation | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  const [activeTab, setActiveTab] = useState("approved")
  const [installmentDialogOpen, setInstallmentDialogOpen] = useState(false)
  const [activePaymentId, setActivePaymentId] = useState<string | null>(null)
  const [isSavingInstallments, setIsSavingInstallments] = useState(false)
  const useApi = process.env.NEXT_PUBLIC_USE_API !== "false"
  const accountDisplayName = accountManager
    ? `${accountManager.firstName || ""} ${accountManager.lastName || ""}`.trim() ||
      accountManager.username ||
      accountManager.email ||
      "Account Manager"
    : "Account Manager"

  const getStoredPaymentPlans = (): Record<string, any> => {
    try {
      const stored = localStorage.getItem(PAYMENT_PLANS_KEY)
      if (!stored) return {}
      const parsed = JSON.parse(stored)
      return parsed && typeof parsed === "object" ? parsed : {}
    } catch {
      return {}
    }
  }

  const saveStoredPaymentPlan = (quotationId: string, payload: any) => {
    const current = getStoredPaymentPlans()
    current[quotationId] = payload
    localStorage.setItem(PAYMENT_PLANS_KEY, JSON.stringify(current))
  }

  const buildInstallments = (total: number, count: number, existing?: PaymentPhase[]) => {
    const safeCount = Math.max(1, count)
    const baseAmount = Math.floor(total / safeCount)
    const remainder = Math.round(total - baseAmount * safeCount)
    return Array.from({ length: safeCount }, (_, index) => {
      const existingPhase = existing?.find((phase) => phase.phaseNumber === index + 1)
      const amount = baseAmount + (index === safeCount - 1 ? remainder : 0)
      const paidAmount = existingPhase?.paidAmount ?? 0
      const status: PaymentPhase["status"] =
        paidAmount >= amount ? "completed" : paidAmount > 0 ? "partial" : "pending"
      return {
        phaseNumber: index + 1,
        phaseName: `Installment ${index + 1}`,
        amount,
        status,
        paidAmount,
        dueDate: existingPhase?.dueDate,
        paymentDate: existingPhase?.paymentDate,
        paymentMode: existingPhase?.paymentMode,
        transactionId: existingPhase?.transactionId,
      }
    })
  }

  const activePayment = activePaymentId
    ? customerPayments.find((payment) => payment.quotationId === activePaymentId) || null
    : null

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
        // Check if we have an auth token
        const token = localStorage.getItem("authToken")
        if (!token) {
          // No token available - user needs to login again
          toast({
            title: "Authentication Required",
            description: "Your session has expired. Please login again.",
            variant: "destructive",
          })
          // Redirect to login after a short delay
          setTimeout(() => {
            router.push("/account-management-login")
          }, 2000)
          setIsLoading(false)
          return
        }

        // Account Management users should use regular quotations endpoint (not admin endpoint)
        // Backend should filter by status=approved on server side for account-management role
        const response = await api.quotations.getAll({
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
          .filter((q: any) => String(q.status || "").toLowerCase() === "approved")  // Double-check on frontend for security
          .map((q: any) => ({
            id: q.id,
            customer: q.customer || {},
            products: q.products || {},
            discount: q.discount || 0,
            totalAmount: q.pricing?.subtotal ?? q.pricing?.totalAmount ?? q.totalAmount ?? q.finalAmount ?? 0,
            finalAmount: q.pricing?.finalAmount ?? q.finalAmount ?? q.pricing?.totalAmount ?? 0,
            createdAt: q.createdAt,
            dealerId: q.dealerId,
            dealer: q.dealer || null, // NEW: Include dealer/admin information
            status: "approved" as const,  // Ensure status is always approved
            paymentMode: q.paymentMode,
            paymentStatus: q.paymentStatus,
            validUntil: q.validUntil,
          }))
        setQuotations(approvedQuotations)
      } else {
        // Fallback to localStorage for development
        try {
          const allQuotations = JSON.parse(localStorage.getItem("quotations") || "[]")
          const approvedQuotations = allQuotations
            .filter((q: Quotation) => String(q.status || "").toLowerCase() === "approved")
            .map((q: Quotation) => ({ 
              ...q, 
              status: "approved" as const,
              id: q.id || `QT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              customer: q.customer || {},
              products: q.products || {},
              discount: q.discount || 0,
              totalAmount: (q as any).pricing?.subtotal ?? (q as any).pricing?.totalAmount ?? q.totalAmount ?? q.finalAmount ?? 0,
              finalAmount: q.finalAmount ?? (q as any).pricing?.finalAmount ?? q.totalAmount ?? 0,
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
      
      // Show error toast with specific handling for permission errors
      if (error instanceof ApiError) {
        // Check for authentication errors
        if (error.code === "AUTH_001" || 
            error.code === "AUTH_003" || 
            error.message?.toLowerCase().includes("not authenticated") ||
            error.message?.toLowerCase().includes("unauthorized") ||
            error.message?.toLowerCase().includes("user not authenticated")) {
          toast({
            title: "Authentication Error",
            description: "Your session has expired or you are not authenticated. Please login again.",
            variant: "destructive",
          })
          // Clear any stale auth data
          localStorage.removeItem("authToken")
          localStorage.removeItem("refreshToken")
          // Redirect to login after a short delay
          setTimeout(() => {
            router.push("/account-management-login")
            router.refresh()
          }, 2000)
        } else if (error.code === "AUTH_004" || error.message?.toLowerCase().includes("insufficient permissions") || error.message?.toLowerCase().includes("permission")) {
          toast({
            title: "Permission Error",
            description: "You don't have permission to access this resource. Please contact your administrator.",
            variant: "destructive",
          })
        } else {
          toast({
            title: "Error Loading Data",
            description: error.message || "Failed to load approved quotations. Please check your connection and try again.",
            variant: "destructive",
          })
        }
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
    
    // Allow both account-management and admin (admin uses same page when account managers unavailable)
    const canAccess = role === "account-management" || role === "admin" || dealer?.username === "admin"
    if (!canAccess) {
      if (role === "visitor") {
        router.push("/visitor/dashboard")
      } else {
        router.push("/dashboard")
      }
      return
    }
    
    if (isAuthenticated && canAccess) {
      loadApprovedQuotations()
    }
  }, [isAuthenticated, role, dealer, router, isInitialLoad, loadApprovedQuotations])

  // Initialize payment phases for quotations
  useEffect(() => {
    if (quotations.length > 0) {
      const storedPlans = getStoredPaymentPlans()
      const payments: CustomerPayment[] = quotations.map((q) => {
        const totalAmount = q.totalAmount || q.finalAmount || 0
        const existingPhases = (q as any).installments || (q as any).paymentPhases || []
        const storedPlan = storedPlans[q.id || ""]
        const storedPhases = storedPlan?.phases || []
        const sourcePhases = Array.isArray(existingPhases) && existingPhases.length > 0 ? existingPhases : storedPhases
        const phases: PaymentPhase[] = Array.isArray(existingPhases)
          ? sourcePhases.map((phase: any, index: number) => ({
              phaseNumber: Number(phase.phaseNumber || index + 1),
              phaseName: phase.phaseName || `Installment ${index + 1}`,
              amount: Number(phase.amount || 0),
              dueDate: phase.dueDate,
              status: (phase.status || "pending") as PaymentPhase["status"],
              paidAmount: Number(phase.paidAmount || 0),
              paymentDate: phase.paymentDate,
              paymentMode: phase.paymentMode,
              transactionId: phase.transactionId,
            }))
          : []

        return {
          quotationId: q.id || "",
          customerName: `${q.customer?.firstName || ""} ${q.customer?.lastName || ""}`.trim() || "Unknown",
          customerMobile: q.customer?.mobile || "",
          totalAmount: q.totalAmount || 0,
          finalAmount: q.finalAmount || q.totalAmount || 0,
          paymentType: (q as any).paymentType || q.paymentMode || storedPlan?.paymentType || storedPlan?.paymentMode || undefined,
          paymentMode: q.paymentMode || storedPlan?.paymentMode || undefined,
          paymentStatus: q.paymentStatus || storedPlan?.paymentStatus || "pending",
          phases,
          quotation: q,
        }
      })
      setCustomerPayments(payments)
    }
  }, [quotations])

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

  // Don't render if not authenticated or not allowed (account-management or admin)
  const canAccess = role === "account-management" || role === "admin" || dealer?.username === "admin"
  if (!isAuthenticated || !canAccess) {
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
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  )

  const totalApprovedValue = quotations.reduce((sum, q) => sum + Math.abs(q.finalAmount || q.totalAmount || 0), 0)

  const getPaymentTypeValue = (payment: CustomerPayment) => {
    return String(payment.paymentType || "").toLowerCase()
  }

  const getPaymentTypeLabel = (paymentType?: string) => {
    const normalized = String(paymentType || "").toLowerCase()
    if (normalized === "loan") return "Loan"
    if (normalized === "cash") return "Cash"
    if (normalized === "mix") return "Mix"
    return "N/A"
  }

  const filteredCustomerPayments = customerPayments.filter((payment) => {
    const matchesSearch =
      payment.customerName.toLowerCase().includes(paymentSearchTerm.toLowerCase()) ||
      payment.customerMobile.includes(paymentSearchTerm) ||
      payment.quotationId.toLowerCase().includes(paymentSearchTerm.toLowerCase())
    const paymentTypeValue = getPaymentTypeValue(payment)
    const matchesPaymentType =
      paymentTypeFilter === "all" ||
      (paymentTypeFilter === "unknown" ? !paymentTypeValue : paymentTypeValue === paymentTypeFilter)
    const paymentStatusValue = payment.paymentStatus || "pending"
    const matchesPaymentStatus = paymentStatusFilter === "all" || paymentStatusValue === paymentStatusFilter
    return matchesSearch && matchesPaymentType && matchesPaymentStatus
  })

  const downloadFilteredPaymentsExcel = () => {
    if (filteredCustomerPayments.length === 0) {
      toast({
        title: "No data to export",
        description: "Adjust filters to include at least one payment row.",
        variant: "destructive",
      })
      return
    }

    const escapeCsv = (value: string | number) => {
      const raw = String(value ?? "")
      if (raw.includes(",") || raw.includes("\"") || raw.includes("\n")) {
        return `"${raw.replace(/"/g, "\"\"")}"`
      }
      return raw
    }

    const headers = [
      "Quotation ID",
      "Customer Name",
      "Customer Mobile",
      "Payment Type",
      "Payment Status",
      "Installments",
      "Subtotal",
      "Paid Amount",
      "Remaining Amount",
    ]

    const rows = filteredCustomerPayments.map((payment) => {
      const paidAmount = payment.phases.reduce((sum, phase) => sum + (Number(phase.paidAmount) || 0), 0)
      const remainingAmount = Math.max(payment.totalAmount - paidAmount, 0)
      return [
        payment.quotationId,
        payment.customerName,
        payment.customerMobile,
        getPaymentTypeLabel(payment.paymentType),
        (payment.paymentStatus || "pending").toUpperCase(),
        payment.phases.length,
        payment.totalAmount,
        paidAmount,
        remainingAmount,
      ]
    })

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => escapeCsv(cell)).join(","))
      .join("\n")

    const blob = new Blob([`\uFEFF${csvContent}`], { type: "text/csv;charset=utf-8;" })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement("a")
    const stamp = new Date().toISOString().slice(0, 10)
    link.href = url
    link.download = `payment-management-${stamp}.csv`
    link.click()
    window.URL.revokeObjectURL(url)
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

  const submitInstallments = async () => {
    if (!activePayment) return

    const totalPaid = activePayment.phases.reduce((sum, phase) => sum + (Number(phase.paidAmount) || 0), 0)
    const paymentStatus: CustomerPayment["paymentStatus"] =
      totalPaid <= 0
        ? "pending"
        : totalPaid >= activePayment.totalAmount
          ? "completed"
          : "partial"
    const paymentModeFromPhases =
      activePayment.phases.find((phase) => Boolean(phase.paymentMode))?.paymentMode || activePayment.paymentMode

    const payload = {
      paymentType: activePayment.paymentType,
      paymentMode: paymentModeFromPhases,
      paymentStatus: paymentStatus || "pending",
      phases: activePayment.phases.map((phase) => ({
        phaseNumber: phase.phaseNumber,
        phaseName: phase.phaseName,
        amount: Number(phase.amount) || 0,
        paidAmount: Number(phase.paidAmount) || 0,
        status: phase.status,
        dueDate: phase.dueDate || undefined,
        paymentDate: phase.paymentDate || undefined,
        paymentMode: phase.paymentMode || undefined,
        transactionId: phase.transactionId || undefined,
      })),
    }

    setIsSavingInstallments(true)
    try {
      // Persist locally as source-of-truth fallback when backend does not
      // return installment details in quotation list yet.
      saveStoredPaymentPlan(activePayment.quotationId, payload)

      if (useApi) {
        await api.quotations.updatePaymentDetails(activePayment.quotationId, payload)
      }

      setCustomerPayments((prev) =>
        prev.map((payment) =>
          payment.quotationId === activePayment.quotationId
            ? {
                ...payment,
                paymentType: payload.paymentType,
                paymentMode: payload.paymentMode,
                paymentStatus: payload.paymentStatus,
                phases: payload.phases,
              }
            : payment,
        ),
      )

      toast({
        title: "Payment details saved",
        description: "Installments updated successfully.",
      })
      setInstallmentDialogOpen(false)
      setActivePaymentId(null)
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Failed to save payment details."
      toast({
        title: "Save failed",
        description: message,
        variant: "destructive",
      })
    } finally {
      setIsSavingInstallments(false)
    }
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
    // Navigate to landing page
    router.push("/")
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Account Management Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 shadow-sm">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-14 sm:h-16 gap-2">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              {(role === "admin" || dealer?.username === "admin") && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => router.push("/dashboard/admin")}
                  className="gap-2 text-muted-foreground hover:text-foreground px-2 sm:px-3 shrink-0"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span className="hidden sm:inline">Back to Admin</span>
                </Button>
              )}
              <button onClick={() => router.push("/dashboard/account-management")} className="flex items-center">
                <SolarLogo size="md" />
              </button>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              {accountManager && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-primary/5 border border-primary/20">
                  <User className="w-4 h-4 text-primary" />
                  <span className="text-sm font-semibold text-foreground hidden sm:inline">
                    {accountDisplayName}
                  </span>
                  <span className="text-sm font-semibold text-foreground sm:hidden">
                    {accountDisplayName
                      .split(" ")
                      .filter(Boolean)
                      .map((part) => part.charAt(0))
                      .slice(0, 2)
                      .join("") || "AM"}
                  </span>
                  {accountManager.username && (
                    <span className="hidden lg:inline text-xs text-muted-foreground">
                      ({accountManager.username})
                    </span>
                  )}
                </div>
              )}
              <span className="text-sm font-medium text-muted-foreground hidden lg:inline">Account Management</span>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleLogout} 
                className="gap-2 border-border hover:bg-destructive hover:text-destructive-foreground hover:border-destructive transition-colors shrink-0 font-medium px-2 sm:px-3"
                title="Logout from Account Management"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Logout</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-5">
        <div className="mb-5">
          <div className="flex items-center gap-2.5 mb-1.5">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <FileText className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-foreground">
                Account Management
                {accountManager && (
                  <span className="text-sm font-normal text-muted-foreground ml-1.5">
                    - Welcome, {accountDisplayName}!
                  </span>
                )}
              </h1>
              <p className="text-sm text-muted-foreground">Approved quotations from admin panel - ready for processing</p>
            </div>
          </div>
        </div>

        {/* Tabbed Interface */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-4 h-auto min-h-9 p-1 w-full justify-start overflow-x-auto whitespace-nowrap">
            <TabsTrigger value="approved" className="gap-1.5 text-xs px-3 py-1.5">
              <FileText className="w-4 h-4" />
              Approved Quotations
            </TabsTrigger>
            <TabsTrigger value="payments" className="gap-1.5 text-xs px-3 py-1.5">
              <Wallet className="w-4 h-4" />
              Payment Management
            </TabsTrigger>
          </TabsList>

          {/* Approved Quotations Tab */}
          <TabsContent value="approved" className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                    <CardTitle className="text-lg">Approved Quotations</CardTitle>
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
                          <th className="text-left py-3 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden lg:table-cell">
                            Dealer/Admin
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
                            <td className="py-4 px-3 text-sm hidden lg:table-cell">
                              {quotation.dealer ? (
                                <div>
                                  <p className="text-sm font-medium text-foreground">
                                    {quotation.dealer.firstName} {quotation.dealer.lastName}
                                  </p>
                                  <Badge 
                                    variant="outline" 
                                    className={`text-xs mt-1 ${
                                      quotation.dealer.role === "admin" 
                                        ? "border-purple-500 text-purple-700 dark:text-purple-400" 
                                        : "border-blue-500 text-blue-700 dark:text-blue-400"
                                    }`}
                                  >
                                    {quotation.dealer.role === "admin" ? "Admin" : "Dealer"}
                                  </Badge>
                                  <p className="text-xs text-muted-foreground mt-1 truncate max-w-xs">
                                    {quotation.dealer.email}
                                  </p>
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">N/A</span>
                              )}
                            </td>
                            <td className="py-4 px-3 text-sm hidden sm:table-cell">
                              <span className="px-2.5 py-1 bg-primary/10 text-primary rounded-full text-xs font-medium uppercase">
                                {getSystemSize(quotation)}
                              </span>
                            </td>
                            <td className="py-4 px-3 text-sm text-right font-semibold text-foreground">
                              ₹{Math.abs(
                                quotation.pricing?.subtotal ??
                                  quotation.subtotal ??
                                  quotation.totalAmount ??
                                  quotation.finalAmount ??
                                  0,
                              ).toLocaleString()}
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
          </TabsContent>

          {/* Payment Management Tab */}
          <TabsContent value="payments" className="space-y-4">
            <Card className="border-border/50 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">Payment Management</CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">Manage customer payments phase by phase</p>
                  </div>
                  <div className="relative w-full sm:w-64">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Search by customer name, mobile..."
                      value={paymentSearchTerm}
                      onChange={(e) => setPaymentSearchTerm(e.target.value)}
                      className="pl-8 h-9 text-sm"
                    />
                  </div>
                </div>
                <div className="mt-3 flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full lg:w-auto">
                    <div className="w-full sm:min-w-44">
                      <Select value={paymentTypeFilter} onValueChange={(value) => setPaymentTypeFilter(value as typeof paymentTypeFilter)}>
                        <SelectTrigger className="h-9 text-sm">
                          <SelectValue placeholder="Filter payment type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Payment Types</SelectItem>
                          <SelectItem value="loan">Loan</SelectItem>
                          <SelectItem value="cash">Cash</SelectItem>
                          <SelectItem value="mix">Mix</SelectItem>
                          <SelectItem value="unknown">Not Set</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="w-full sm:min-w-44">
                      <Select value={paymentStatusFilter} onValueChange={(value) => setPaymentStatusFilter(value as typeof paymentStatusFilter)}>
                        <SelectTrigger className="h-9 text-sm">
                          <SelectValue placeholder="Filter payment status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Statuses</SelectItem>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="partial">Partial</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-2 w-full sm:w-auto"
                    onClick={downloadFilteredPaymentsExcel}
                  >
                    <Download className="w-4 h-4" />
                    Download Excel
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-2 sm:px-6">
                {isLoading ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4 animate-pulse">
                      <Wallet className="w-8 h-8 text-primary opacity-50" />
                    </div>
                    <p className="font-medium text-foreground">Loading payment data...</p>
                  </div>
                ) : customerPayments.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                      <Wallet className="w-8 h-8 opacity-50" />
                    </div>
                    <p className="font-medium">No payment data available</p>
                    <p className="text-sm mt-1">Approved quotations will appear here for payment management</p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {filteredCustomerPayments.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground text-sm border border-dashed rounded-md">
                        No rows match current filters.
                      </div>
                    ) : (
                      filteredCustomerPayments.map((payment) => {
                        const paidAmount = payment.phases.reduce((sum, p) => sum + p.paidAmount, 0)
                        const remainingAmount = payment.totalAmount - paidAmount
                        const isCompletedPayment = remainingAmount <= 0 || payment.paymentStatus === "completed"

                        return (
                          <Card
                            key={payment.quotationId}
                            className={`shadow-sm px-3 py-3 ${
                              isCompletedPayment
                                ? "border-green-200 bg-green-50/80 dark:border-green-900 dark:bg-green-950/20"
                                : "border-border/60 bg-card/80"
                            }`}
                          >
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-8 gap-x-4 gap-y-3 items-start lg:items-center">
                              <div className="col-span-2 sm:col-span-3 lg:col-span-2 min-w-0">
                                <p className="text-sm font-semibold leading-tight">{payment.customerName}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {payment.customerMobile} • {payment.quotationId}
                                </p>
                              </div>

                              <div className="min-w-0">
                                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Installments</p>
                                <p className="text-sm font-medium">
                                  {payment.phases.length === 0
                                    ? "None"
                                    : `${payment.phases.length} installment${payment.phases.length > 1 ? "s" : ""}`}
                                </p>
                              </div>

                              <div className="min-w-0">
                                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Payment Type</p>
                                <p className="text-sm font-semibold">{getPaymentTypeLabel(payment.paymentType)}</p>
                              </div>

                              <div className="min-w-0">
                                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Subtotal</p>
                                <p className="text-sm font-semibold">₹{payment.totalAmount.toLocaleString()}</p>
                              </div>

                              <div className="min-w-0">
                                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Paid</p>
                                <p className="text-sm font-semibold">₹{paidAmount.toLocaleString()}</p>
                              </div>

                              <div className="min-w-0">
                                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Remaining</p>
                                <p
                                  className={`text-sm font-semibold ${
                                    remainingAmount <= 0 ? "text-green-600" : "text-amber-600"
                                  }`}
                                >
                                  ₹{Math.max(remainingAmount, 0).toLocaleString()}
                                </p>
                              </div>

                              <div className="col-span-2 sm:col-span-3 lg:col-span-1 flex justify-end">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setActivePaymentId(payment.quotationId)
                                    setInstallmentDialogOpen(true)
                                  }}
                                >
                                  Manage
                                </Button>
                              </div>
                            </div>
                          </Card>
                        )
                      })
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Quotation Details Dialog */}
      <QuotationDetailsDialog
        quotation={selectedQuotation}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />

      {/* Installments Modal */}
      <Dialog
        open={installmentDialogOpen}
        onOpenChange={(open) => {
          setInstallmentDialogOpen(open)
          if (!open) {
            setActivePaymentId(null)
          }
        }}
      >
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Installments</DialogTitle>
            <DialogDescription>Manage installments, payment modes, and transaction IDs.</DialogDescription>
          </DialogHeader>
          {activePayment && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4 rounded-lg border border-border/60 bg-muted/20 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold">{activePayment.customerName}</p>
                  <p className="text-xs text-muted-foreground">
                    {activePayment.customerMobile} • {activePayment.quotationId}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Subtotal</p>
                  <p className="text-base font-semibold">₹{activePayment.totalAmount.toLocaleString()}</p>
                </div>
              </div>

              {activePayment.phases.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border/70 bg-muted/10 py-8">
                  <p className="text-sm text-muted-foreground">No installments created yet.</p>
                  <Button
                    type="button"
                    onClick={() => {
                                    const updated = customerPayments.map((p) =>
                        p.quotationId === activePayment.quotationId
                          ? { ...p, phases: buildInstallments(p.totalAmount, 1) }
                                        : p
                                    )
                                    setCustomerPayments(updated)
                    }}
                  >
                    Create Installment
                  </Button>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">Installments</p>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const updated = customerPayments.map((p) =>
                            p.quotationId === activePayment.quotationId
                              ? { ...p, phases: buildInstallments(p.totalAmount, p.phases.length + 1, p.phases) }
                              : p
                          )
                          setCustomerPayments(updated)
                        }}
                      >
                        Add
                      </Button>
                    </div>
                              </div>
                              
                  <div className="space-y-3">
                    {activePayment.phases.map((phase) => {
                                  const isCompleted = phase.status === "completed"
                                  const isPartial = phase.status === "partial"
                                  const isPending = phase.status === "pending"
                      const paidBefore = activePayment.phases
                        .filter((p) => p.phaseNumber < phase.phaseNumber)
                        .reduce((sum, p) => sum + p.paidAmount, 0)
                      const remainingBefore = Math.max(activePayment.totalAmount - paidBefore, 0)
                                  
                                  return (
                                    <div
                                      key={phase.phaseNumber}
                          className={`rounded-lg border px-4 py-3 ${
                                        isCompleted
                                          ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800"
                                          : isPartial
                                          ? "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800"
                                          : "bg-gray-50 dark:bg-gray-950/20 border-border"
                                      }`}
                                    >
                                      <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                          <div
                                            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                                              isCompleted
                                                ? "bg-green-500 text-white"
                                                : isPartial
                                                ? "bg-amber-500 text-white"
                                                : "bg-gray-300 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                                            }`}
                                          >
                                            {phase.phaseNumber}
                                          </div>
                                          <div>
                                            <p className="text-sm font-semibold">{phase.phaseName}</p>
                                            <p className="text-xs text-muted-foreground">
                                  Remaining before this installment: ₹{remainingBefore.toLocaleString()}
                                            </p>
                                          </div>
                                        </div>
                                        <Badge
                                          className={
                                            isCompleted
                                              ? "bg-green-600 text-white"
                                              : isPartial
                                              ? "bg-amber-600 text-white"
                                              : "bg-gray-500 text-white"
                                          }
                                        >
                                          {isCompleted ? (
                                <>
                                  <CheckCircle2 className="w-3 h-3 mr-1" /> Completed
                                </>
                                          ) : isPartial ? (
                                <>
                                  <Clock className="w-3 h-3 mr-1" /> Partial
                                </>
                                          ) : (
                                <>
                                  <AlertCircle className="w-3 h-3 mr-1" /> Pending
                                </>
                                          )}
                                        </Badge>
                                      </div>
                                      
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                          <Label className="text-xs text-muted-foreground">Paid Amount</Label>
                                          <Input
                                            type="number"
                                            value={phase.paidAmount}
                                            onChange={(e) => {
                                              const paid = Number.parseFloat(e.target.value) || 0
                                              const updated = customerPayments.map((p) =>
                                    p.quotationId === activePayment.quotationId
                                                  ? {
                                                      ...p,
                                                      phases: p.phases.map((ph) =>
                                                        ph.phaseNumber === phase.phaseNumber
                                              ? (() => {
                                                  const nextStatus: PaymentPhase["status"] =
                                                    paid >= ph.amount ? "completed" : paid > 0 ? "partial" : "pending"
                                                  return {
                                                              ...ph,
                                                              paidAmount: paid,
                                                    status: nextStatus,
                                                              paymentDate: paid > 0 ? new Date().toISOString() : undefined,
                                                            }
                                                })()
                                                          : ph
                                                      ),
                                                    }
                                                  : p
                                              )
                                              setCustomerPayments(updated)
                                            }}
                                            className="mt-1"
                                            placeholder="0"
                                          />
                                        </div>
                                        <div>
                                          <Label className="text-xs text-muted-foreground">Due Date</Label>
                                          <Input
                                            type="date"
                                            value={phase.dueDate ? new Date(phase.dueDate).toISOString().split("T")[0] : ""}
                                            onChange={(e) => {
                                              const updated = customerPayments.map((p) =>
                                    p.quotationId === activePayment.quotationId
                                                  ? {
                                                      ...p,
                                                      phases: p.phases.map((ph) =>
                                                        ph.phaseNumber === phase.phaseNumber
                                                          ? { ...ph, dueDate: e.target.value }
                                                          : ph
                                                      ),
                                                    }
                                                  : p
                                              )
                                              setCustomerPayments(updated)
                                            }}
                                            className="mt-1"
                                          />
                                        </div>
                                      </div>
                                      
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                            <div>
                              <Label className="text-xs text-muted-foreground">Payment Mode</Label>
                              <Select
                                value={phase.paymentMode || ""}
                                onValueChange={(value) => {
                                  const updated = customerPayments.map((p) =>
                                    p.quotationId === activePayment.quotationId
                                      ? {
                                          ...p,
                                          phases: p.phases.map((ph) =>
                                            ph.phaseNumber === phase.phaseNumber ? { ...ph, paymentMode: value } : ph
                                          ),
                                        }
                                      : p
                                  )
                                  setCustomerPayments(updated)
                                }}
                              >
                                <SelectTrigger className="mt-1">
                                  <SelectValue placeholder="Select payment mode" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="cash">Cash</SelectItem>
                                  <SelectItem value="upi">UPI</SelectItem>
                                  <SelectItem value="loan">Loan</SelectItem>
                                  <SelectItem value="netbanking">Net Banking</SelectItem>
                                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                                  <SelectItem value="cheque">Cheque</SelectItem>
                                  <SelectItem value="card">Card</SelectItem>
                                </SelectContent>
                              </Select>
                                        </div>
                            <div>
                              <Label className="text-xs text-muted-foreground">Transaction ID</Label>
                              <Input
                                value={phase.transactionId || ""}
                                onChange={(e) => {
                                  const updated = customerPayments.map((p) =>
                                    p.quotationId === activePayment.quotationId
                                      ? {
                                          ...p,
                                          phases: p.phases.map((ph) =>
                                            ph.phaseNumber === phase.phaseNumber
                                              ? { ...ph, transactionId: e.target.value }
                                              : ph
                                          ),
                                        }
                                      : p
                                  )
                                  setCustomerPayments(updated)
                                }}
                                className="mt-1"
                                placeholder="Optional"
                              />
                            </div>
                              </div>
                              
                          <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-3">
                            <p className="text-xs text-muted-foreground">
                              Remaining after this installment: ₹{Math.max(remainingBefore - phase.paidAmount, 0).toLocaleString()}
                            </p>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                const updated = customerPayments.map((p) =>
                                  p.quotationId === activePayment.quotationId
                                    ? {
                                        ...p,
                                        phases: buildInstallments(
                                          p.totalAmount,
                                          p.phases.length - 1,
                                          p.phases.filter((ph) => ph.phaseNumber !== phase.phaseNumber)
                                        ),
                                      }
                                    : p
                                )
                                setCustomerPayments(updated)
                              }}
                              disabled={activePayment.phases.length <= 1}
                              className="text-destructive"
                            >
                              Remove installment
                            </Button>
                                  </div>
                                  </div>
                      )
                    })}
                                </div>
                </>
              )}
              <div className="flex items-center justify-end gap-2 border-t border-border/60 pt-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setInstallmentDialogOpen(false)
                    setActivePaymentId(null)
                  }}
                  disabled={isSavingInstallments}
                >
                  Cancel
                </Button>
                <Button type="button" onClick={submitInstallments} disabled={isSavingInstallments}>
                  {isSavingInstallments ? "Submitting..." : "Submit"}
                </Button>
              </div>
                  </div>
                )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
