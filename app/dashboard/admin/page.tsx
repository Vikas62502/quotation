"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { DashboardNav } from "@/components/dashboard-nav"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import {
  Search,
  FileText,
  Users,
  IndianRupee,
  Calendar,
  TrendingUp,
  Eye,
  Building,
  Edit,
  Save,
  X,
  CheckCircle2,
  Plus,
  UserPlus,
  Trash2,
  UserCheck,
  UserX,
} from "lucide-react"
import type { Quotation, QuotationStatus } from "@/lib/quotation-context"
import type { Dealer, Visitor } from "@/lib/auth-context"
import { QuotationDetailsDialog } from "@/components/quotation-details-dialog"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { api, ApiError } from "@/lib/api"
import { governmentIds, indianStates } from "@/lib/quotation-data"
import { AdminProductManagement } from "@/components/admin-product-management"
import { calculateSystemSize } from "@/lib/pricing-tables"

// Admin username check
const ADMIN_USERNAME = "admin"

export default function AdminPanelPage() {
  const { isAuthenticated, dealer } = useAuth()
  const router = useRouter()
  const [quotations, setQuotations] = useState<Quotation[]>([])
  const [dealers, setDealers] = useState<Dealer[]>([])
  const [visitors, setVisitors] = useState<Visitor[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [customerSearchTerm, setCustomerSearchTerm] = useState("")
  const [searchTerm, setSearchTerm] = useState("")
  const [filterDealer, setFilterDealer] = useState("all")
  const [filterMonth, setFilterMonth] = useState("all")
  const [selectedQuotation, setSelectedQuotation] = useState<Quotation | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [activeTab, setActiveTab] = useState("overview")
  const [editingQuotation, setEditingQuotation] = useState<Quotation | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [isLoadingQuotationDetails, setIsLoadingQuotationDetails] = useState(false)
  const [visitorSearchTerm, setVisitorSearchTerm] = useState("")
  const [visitorDialogOpen, setVisitorDialogOpen] = useState(false)
  const [editingVisitor, setEditingVisitor] = useState<Visitor | null>(null)
  const [dealerSearchTerm, setDealerSearchTerm] = useState("")
  const [editingCustomer, setEditingCustomer] = useState<any | null>(null)
  const [customerEditDialogOpen, setCustomerEditDialogOpen] = useState(false)
  const [customerEditForm, setCustomerEditForm] = useState({
    firstName: "",
    lastName: "",
    mobile: "",
    email: "",
    address: {
      street: "",
      city: "",
      state: "",
      pincode: "",
    },
  })
  const [selectedDealer, setSelectedDealer] = useState<Dealer | null>(null)
  const [dealerDialogOpen, setDealerDialogOpen] = useState(false)
  const [editingDealer, setEditingDealer] = useState<Dealer | null>(null)
  const [dealerEditDialogOpen, setDealerEditDialogOpen] = useState(false)
  const [dealerEditForm, setDealerEditForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    mobile: "",
    gender: "",
    dateOfBirth: "",
    fatherName: "",
    fatherContact: "",
    governmentIdType: "",
    governmentIdNumber: "",
    address: {
      street: "",
      city: "",
      state: "",
      pincode: "",
    },
    isActive: true,
    emailVerified: false,
  })
  const [newVisitor, setNewVisitor] = useState({
    username: "",
    password: "",
    firstName: "",
    lastName: "",
    email: "",
    mobile: "",
    employeeId: "",
  })

  const useApi = process.env.NEXT_PUBLIC_USE_API !== "false"

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/login")
      return
    }

    // Check if user is admin
    if (dealer?.username !== ADMIN_USERNAME) {
      router.push("/dashboard")
      return
    }

    loadData()
  }, [isAuthenticated, router, dealer])

  // Fetch full quotation details when edit dialog opens
  useEffect(() => {
    if (editingQuotation && editDialogOpen && useApi) {
      // Check if customer data is incomplete (missing email or address)
      const hasIncompleteCustomer = !editingQuotation.customer?.email || !editingQuotation.customer?.address?.street
      
      if (hasIncompleteCustomer) {
        setIsLoadingQuotationDetails(true)
        // Fetch full quotation details to get complete customer information
        api.quotations.getById(editingQuotation.id)
          .then((response) => {
            // apiRequest returns data.data, so response is already the quotation object
            const fullData = response
            if (fullData && fullData.customer) {
              // Ensure customer address is properly structured
              const customerData = fullData.customer
              const address = customerData.address || {}
              
              setEditingQuotation({
                ...editingQuotation,
                customer: {
                  firstName: customerData.firstName || editingQuotation.customer?.firstName || "",
                  lastName: customerData.lastName || editingQuotation.customer?.lastName || "",
                  mobile: customerData.mobile || editingQuotation.customer?.mobile || "",
                  email: customerData.email || editingQuotation.customer?.email || "",
                  address: {
                    street: address.street || "",
                    city: address.city || "",
                    state: address.state || "",
                    pincode: address.pincode || "",
                  },
                },
                products: fullData.products || editingQuotation.products,
                discount: fullData.discount ?? editingQuotation.discount,
                totalAmount: fullData.pricing?.totalAmount ?? editingQuotation.totalAmount,
                finalAmount: fullData.pricing?.finalAmount ?? fullData.finalAmount ?? editingQuotation.finalAmount,
              })
            }
          })
          .catch((error) => {
            console.error("Error loading full quotation details:", error)
            // Keep the original quotation data on error
          })
          .finally(() => {
            setIsLoadingQuotationDetails(false)
          })
      }
    }
  }, [editingQuotation, editDialogOpen, useApi])

  const loadData = async () => {
    try {
      if (useApi) {
        // Load quotations
        const quotationsResponse = await api.admin.quotations.getAll()
        const quotationsList = (quotationsResponse.quotations || []).map((q: any) => {
          const customerData = q.customer || {}
          return {
            id: q.id,
            customer: {
              firstName: customerData.firstName || "",
              lastName: customerData.lastName || "",
              mobile: customerData.mobile || "",
              email: customerData.email || "",
              address: customerData.address || {
                street: "",
                city: "",
                state: "",
                pincode: "",
              },
            },
            // Preserve all products data - don't default to { systemType: "N/A" } if products exists
            products: q.products || {},
            discount: q.discount || 0,
            totalAmount: q.pricing?.totalAmount || 0,
            finalAmount: q.pricing?.finalAmount || q.finalAmount || 0,
            createdAt: q.createdAt,
            dealerId: q.dealer?.id || q.dealerId,
            status: (q.status || "pending") as QuotationStatus,
          }
        })
        setQuotations(quotationsList)

        // Load dealers
        const dealersResponse = await api.admin.dealers.getAll()
        const dealersList = (dealersResponse.dealers || []).map((d: any) => ({
          id: d.id,
          username: d.username,
          firstName: d.firstName,
          lastName: d.lastName,
          email: d.email,
          mobile: d.mobile,
          gender: d.gender || "",
          dateOfBirth: d.dateOfBirth || "",
          fatherName: d.fatherName || "",
          fatherContact: d.fatherContact || "",
          governmentIdType: d.governmentIdType || "",
          governmentIdNumber: d.governmentIdNumber || "",
          address: d.address || {
            street: "",
            city: "",
            state: "",
            pincode: "",
          },
          isActive: d.isActive ?? false, // Backend defaults to false for new registrations
          createdAt: d.createdAt,
          emailVerified: d.emailVerified ?? false,
        }))
        setDealers(dealersList)

        // Load visitors
        // apiRequest returns data.data, so response is already the data object
        // API response structure: { success: true, data: { visitors: [...] } }
        // After apiRequest unwrapping: response = { visitors: [...], pagination: {...} }
        const visitorsResponse = await api.admin.visitors.getAll()
        const visitorsList = visitorsResponse.visitors || []
        setVisitors(visitorsList.map((v: any) => ({
          id: v.id,
          username: v.username || "",
          password: "",
          firstName: v.firstName || "",
          lastName: v.lastName || "",
          email: v.email || "",
          mobile: v.mobile || "",
          employeeId: v.employeeId,
          isActive: v.isActive ?? true,
          createdBy: v.createdBy,
          createdAt: v.createdAt,
          updatedAt: v.updatedAt,
          visitCount: v.visitCount || 0, // Include visit count from API
        })))

        // Load customers from quotations data (after dealers are loaded)
        const customerMap = new Map<string, any>()
        quotationsList.forEach((q: any) => {
          const customer = q.customer
          if (customer && customer.mobile) {
            const mobile = customer.mobile
            if (!customerMap.has(mobile)) {
              customerMap.set(mobile, {
                id: customer.id,
                firstName: customer.firstName || "",
                lastName: customer.lastName || "",
                mobile: customer.mobile || "",
                email: customer.email || "",
                address: customer.address || {
                  street: "",
                  city: "",
                  state: "",
                  pincode: "",
                },
                quotationCount: 0,
                totalAmount: 0,
                lastQuotation: "",
                dealerIds: new Set<string>(),
              })
            }
            const customerData = customerMap.get(mobile)
            customerData.quotationCount += 1
            customerData.totalAmount += (q.pricing?.finalAmount || q.finalAmount || 0)
            const dealerId = q.dealer?.id || q.dealerId
            if (dealerId) {
              customerData.dealerIds.add(dealerId)
            }
            const qDate = q.createdAt
            if (!customerData.lastQuotation || (qDate && new Date(qDate) > new Date(customerData.lastQuotation))) {
              customerData.lastQuotation = qDate
            }
          }
        })
        // Convert dealerIds Set to array and get dealer names
        const customersList = Array.from(customerMap.values()).map((c: any) => ({
          ...c,
          dealerIds: Array.from(c.dealerIds) as string[],
          dealers: (Array.from(c.dealerIds) as string[]).map((dealerId) => {
            const dealer = dealersList.find((d: any) => d.id === dealerId)
            return dealer ? `${dealer.firstName} ${dealer.lastName}` : "Unknown"
          }),
        }))
        setCustomers(customersList)
      } else {
        // Fallback to localStorage
        // Load all quotations and ensure they have status
        const allQuotations = JSON.parse(localStorage.getItem("quotations") || "[]")
        const quotationsWithStatus = allQuotations.map((q: Quotation) => ({
          ...q,
          status: q.status || "pending",
        }))
        setQuotations(quotationsWithStatus)
        // Update localStorage with status if needed
        if (allQuotations.some((q: Quotation) => !q.status)) {
          localStorage.setItem("quotations", JSON.stringify(quotationsWithStatus))
        }

        // Load all dealers
        const allDealers = JSON.parse(localStorage.getItem("dealers") || "[]")
        // Remove password field
        const dealersWithoutPassword = allDealers.map((d: Dealer & { password?: string }) => {
          const { password: _, ...dealerData } = d
          return dealerData
        })
        setDealers(dealersWithoutPassword)

        // Load all visitors
        const allVisitors = JSON.parse(localStorage.getItem("visitors") || "[]")
        // Remove password field for display
        const visitorsWithoutPassword = allVisitors.map((v: Visitor & { password?: string }) => {
          const { password: _, ...visitorData } = v
          return visitorData
        })
        setVisitors(visitorsWithoutPassword)

        // Load customers from quotations (localStorage fallback)
        const customerMap = new Map<string, any>()
        quotationsWithStatus.forEach((q: Quotation) => {
          const customer = q.customer
          if (customer && customer.mobile) {
            const mobile = customer.mobile
            if (!customerMap.has(mobile)) {
              customerMap.set(mobile, {
                id: (customer as any).id,
                firstName: customer.firstName || "",
                lastName: customer.lastName || "",
                mobile: customer.mobile || "",
                email: customer.email || "",
                address: customer.address || {
                  street: "",
                  city: "",
                  state: "",
                  pincode: "",
                },
                quotationCount: 0,
                totalAmount: 0,
                lastQuotation: "",
                dealerIds: new Set<string>(),
              })
            }
            const customerData = customerMap.get(mobile)
            customerData.quotationCount += 1
            customerData.totalAmount += q.finalAmount || 0
            if (q.dealerId) {
              customerData.dealerIds.add(q.dealerId)
            }
            const qDate = q.createdAt
            if (!customerData.lastQuotation || (qDate && new Date(qDate) > new Date(customerData.lastQuotation))) {
              customerData.lastQuotation = qDate
            }
          }
        })
        // Get dealer names from localStorage dealers
        const customersList = Array.from(customerMap.values()).map((c: any) => ({
          ...c,
          dealerIds: Array.from(c.dealerIds) as string[],
          dealers: (Array.from(c.dealerIds) as string[]).map((dealerId) => {
            const dealer = dealersWithoutPassword.find((d: Dealer) => d.id === dealerId)
            return dealer ? `${dealer.firstName} ${dealer.lastName}` : "Unknown"
          }),
        }))
        setCustomers(customersList)
      }
    } catch (error) {
      console.error("Error loading admin data:", error)
    }
  }

  if (!isAuthenticated || dealer?.username !== ADMIN_USERNAME) return null

  // Calculate statistics
  const totalQuotations = quotations.length
  const totalRevenue = quotations.reduce((sum, q) => sum + q.finalAmount, 0)
  const uniqueCustomers = customers.length || new Set(quotations.map((q) => q.customer.mobile)).size
  const activeDealers = new Set(quotations.map((q) => q.dealerId)).size
  const totalVisitors = visitors.length
  const activeVisitors = visitors.filter((v) => v.isActive !== false).length

  const currentMonth = new Date().getMonth()
  const currentYear = new Date().getFullYear()
  const thisMonthQuotations = quotations.filter((q) => {
    const date = new Date(q.createdAt)
    return date.getMonth() === currentMonth && date.getFullYear() === currentYear
  })
  const thisMonthRevenue = thisMonthQuotations.reduce((sum, q) => sum + q.finalAmount, 0)

  // Filter quotations
  const filteredQuotations = quotations.filter((q) => {
    const matchesSearch =
      q.customer.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      q.customer.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      q.customer.mobile.includes(searchTerm) ||
      q.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      q.customer.email.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesDealer = filterDealer === "all" || q.dealerId === filterDealer

    if (filterMonth === "all") return matchesSearch && matchesDealer

    const date = new Date(q.createdAt)
    const currentDate = new Date()

    if (filterMonth === "current") {
      return (
        matchesSearch &&
        matchesDealer &&
        date.getMonth() === currentDate.getMonth() &&
        date.getFullYear() === currentDate.getFullYear()
      )
    }

    if (filterMonth === "previous") {
      const prevMonth = currentDate.getMonth() === 0 ? 11 : currentDate.getMonth() - 1
      const prevYear = currentDate.getMonth() === 0 ? currentDate.getFullYear() - 1 : currentDate.getFullYear()
      return matchesSearch && matchesDealer && date.getMonth() === prevMonth && date.getFullYear() === prevYear
    }

    return matchesSearch && matchesDealer
  })

  const sortedQuotations = [...filteredQuotations].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )

  // Get dealer name by ID
  const getDealerName = (dealerId: string) => {
    const dealer = dealers.find((d) => d.id === dealerId)
    return dealer ? `${dealer.firstName} ${dealer.lastName}` : "Unknown Dealer"
  }

  // Update quotation status
  const updateQuotationStatus = async (quotationId: string, status: QuotationStatus) => {
    try {
      if (useApi) {
        await api.admin.quotations.updateStatus(quotationId, status)
        await loadData()
      } else {
        // Fallback to localStorage
        const updated = quotations.map((q) => (q.id === quotationId ? { ...q, status } : q))
        setQuotations(updated)
        localStorage.setItem("quotations", JSON.stringify(updated))
      }
    } catch (error) {
      console.error("Error updating quotation status:", error)
      alert(error instanceof ApiError ? error.message : "Failed to update quotation status")
    }
  }

  // Update quotation data
  const updateQuotation = async (updatedQuotation: Quotation) => {
    try {
      if (useApi) {
        // Note: Full quotation update endpoint may not exist in API spec
        // For now, we'll update discount if changed
        if (updatedQuotation.discount !== undefined) {
          await api.quotations.updateDiscount(updatedQuotation.id, updatedQuotation.discount)
        }
        await loadData()
      } else {
        // Fallback to localStorage
        const updated = quotations.map((q) => (q.id === updatedQuotation.id ? updatedQuotation : q))
        setQuotations(updated)
        localStorage.setItem("quotations", JSON.stringify(updated))
      }
      setEditDialogOpen(false)
      setEditingQuotation(null)
    } catch (error) {
      console.error("Error updating quotation:", error)
      alert(error instanceof ApiError ? error.message : "Failed to update quotation")
    }
  }

  // Get status color
  const getStatusColor = (status: QuotationStatus | undefined) => {
    switch (status) {
      case "approved":
        return "bg-green-50 border-green-200 hover:bg-green-100"
      case "rejected":
        return "bg-red-50 border-red-200 hover:bg-red-100"
      case "completed":
        return "bg-blue-50 border-blue-200 hover:bg-blue-100"
      default:
        return "bg-yellow-50 border-yellow-200 hover:bg-yellow-100"
    }
  }

  // Get status badge color
  const getStatusBadgeColor = (status: QuotationStatus | undefined) => {
    switch (status) {
      case "approved":
        return "bg-green-500 text-white"
      case "rejected":
        return "bg-red-500 text-white"
      case "completed":
        return "bg-blue-500 text-white"
      default:
        return "bg-yellow-500 text-white"
    }
  }

  // Get system size display
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

  // Get dealer stats
  const dealerStats = dealers.map((d) => {
    const dealerQuotations = quotations.filter((q) => q.dealerId === d.id)
    const dealerRevenue = dealerQuotations.reduce((sum, q) => sum + q.finalAmount, 0)
    return {
      dealer: d,
      quotationCount: dealerQuotations.length,
      revenue: dealerRevenue,
    }
  })

  return (
    <div className="min-h-screen bg-background">
      <DashboardNav />

      <main className="container mx-auto px-4 py-4 sm:py-8">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Admin Panel</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1 sm:mt-2">View and manage all system data</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-6">
            <TabsTrigger value="overview" className="text-xs sm:text-sm">Overview</TabsTrigger>
            <TabsTrigger value="quotations" className="text-xs sm:text-sm">Quotations</TabsTrigger>
            <TabsTrigger value="dealers" className="text-xs sm:text-sm">Dealers</TabsTrigger>
            <TabsTrigger value="customers" className="text-xs sm:text-sm">Customers</TabsTrigger>
            <TabsTrigger value="visitors" className="text-xs sm:text-sm">Visitors</TabsTrigger>
            <TabsTrigger value="products" className="text-xs sm:text-sm">Products</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Statistics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Quotations</CardTitle>
                  <FileText className="w-5 h-5 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{totalQuotations}</div>
                  <p className="text-xs text-muted-foreground mt-1">All time</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle>
                  <IndianRupee className="w-5 h-5 text-green-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">₹{(totalRevenue / 100000).toFixed(1)}L</div>
                  <p className="text-xs text-muted-foreground mt-1">All time</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">This Month</CardTitle>
                  <TrendingUp className="w-5 h-5 text-blue-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">₹{(thisMonthRevenue / 100000).toFixed(1)}L</div>
                  <p className="text-xs text-muted-foreground mt-1">{thisMonthQuotations.length} quotations</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Active Dealers</CardTitle>
                  <Users className="w-5 h-5 text-amber-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{activeDealers}</div>
                  <p className="text-xs text-muted-foreground mt-1">Out of {dealers.length} total</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Active Visitors</CardTitle>
                  <UserCheck className="w-5 h-5 text-purple-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{activeVisitors}</div>
                  <p className="text-xs text-muted-foreground mt-1">Out of {totalVisitors} total</p>
                </CardContent>
              </Card>
            </div>

            {/* Top Dealers  */}
            <Card>
              <CardHeader>
                <CardTitle>Top Dealers by Revenue</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {dealerStats
                    .sort((a, b) => b.revenue - a.revenue)
                    .slice(0, 5)
                    .map((stat) => (
                      <div key={stat.dealer.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div>
                          <p className="font-semibold">
                            {stat.dealer.firstName} {stat.dealer.lastName}
                          </p>
                          <p className="text-sm text-muted-foreground">{stat.dealer.email}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">₹{(stat.revenue / 100000).toFixed(1)}L</p>
                          <p className="text-sm text-muted-foreground">{stat.quotationCount} quotations</p>
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* All Quotations Tab */}
          <TabsContent value="quotations" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by name, mobile, email, or ID..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Select value={filterDealer} onValueChange={setFilterDealer}>
                    <SelectTrigger className="w-full sm:w-48">
                      <SelectValue placeholder="Filter by dealer" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Dealers</SelectItem>
                      {dealers.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.firstName} {d.lastName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                  </div>
                ) : (
                  <>
                    {/* Mobile Card View */}
                    <div className="block md:hidden space-y-3">
                      {sortedQuotations.map((quotation) => (
                        <div
                          key={quotation.id}
                          className={`p-4 rounded-lg border-2 ${getStatusColor(quotation.status)}`}
                        >
                          <div className="flex justify-between items-start mb-3">
                            <div className="flex-1">
                              <p className="text-xs font-mono text-muted-foreground mb-1">{quotation.id}</p>
                              <p className="font-semibold text-sm">
                                {quotation.customer.firstName} {quotation.customer.lastName}
                              </p>
                              <p className="text-xs text-muted-foreground">{quotation.customer.mobile}</p>
                            </div>
                            <Badge className={`text-xs ${getStatusBadgeColor(quotation.status)}`}>
                              {(quotation.status || "pending").charAt(0).toUpperCase() +
                                (quotation.status || "pending").slice(1)}
                            </Badge>
                          </div>
                          
                          <div className="space-y-2 mb-3">
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Agent:</span>
                              <span className="font-medium">{getDealerName(quotation.dealerId)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Amount:</span>
                              <span className="font-semibold">₹{Math.abs(quotation.finalAmount || 0).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">System:</span>
                              <Badge variant="outline" className="text-xs">{getSystemSize(quotation)}</Badge>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Date:</span>
                              <span className="text-xs">{new Date(quotation.createdAt).toLocaleDateString()}</span>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Select
                              value={quotation.status || "pending"}
                              onValueChange={(value) => updateQuotationStatus(quotation.id, value as QuotationStatus)}
                            >
                              <SelectTrigger className="w-full h-9 text-xs">
                                <SelectValue placeholder="Change Status" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="pending">Pending</SelectItem>
                                <SelectItem value="approved">Approved</SelectItem>
                                <SelectItem value="rejected">Rejected</SelectItem>
                                <SelectItem value="completed">Completed</SelectItem>
                              </SelectContent>
                            </Select>
                            
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setEditingQuotation(quotation)
                                  setEditDialogOpen(true)
                                }}
                                className="flex-1"
                              >
                                <Edit className="w-3 h-3 mr-1" />
                                Edit
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedQuotation(quotation)
                                  setDialogOpen(true)
                                }}
                                className="flex-1"
                              >
                                <Eye className="w-3 h-3 mr-1" />
                                View
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Desktop Table View */}
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-border">
                            <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground">
                              Quotation ID
                            </th>
                            <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground">Customer</th>
                            <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground">
                              Agent/Dealer
                            </th>
                            <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground">Amount</th>
                            <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground">Status</th>
                            <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground">
                              Date
                            </th>
                            <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sortedQuotations.map((quotation) => (
                            <tr
                              key={quotation.id}
                              className={`border-b border-border last:border-0 transition-colors ${getStatusColor(quotation.status)}`}
                            >
                              <td className="py-3 px-2">
                                <span className="text-sm font-mono">{quotation.id}</span>
                              </td>
                              <td className="py-3 px-2">
                                <div>
                                  <p className="text-sm font-medium">
                                    {quotation.customer.firstName} {quotation.customer.lastName}
                                  </p>
                                  <p className="text-xs text-muted-foreground">{quotation.customer.mobile}</p>
                                  <p className="text-xs text-muted-foreground">{quotation.customer.email}</p>
                                </div>
                              </td>
                              <td className="py-3 px-2">
                                <div className="flex items-center gap-2">
                                  <Building className="w-4 h-4 text-muted-foreground" />
                                  <div>
                                    <span className="text-sm font-medium">{getDealerName(quotation.dealerId)}</span>
                                    <p className="text-xs text-muted-foreground">ID: {quotation.dealerId}</p>
                                  </div>
                                </div>
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
                                <div className="space-y-2">
                                  <Select
                                    value={quotation.status || "pending"}
                                    onValueChange={(value) => updateQuotationStatus(quotation.id, value as QuotationStatus)}
                                  >
                                    <SelectTrigger className="w-32 h-8 text-xs">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="pending">Pending</SelectItem>
                                      <SelectItem value="approved">Approved</SelectItem>
                                      <SelectItem value="rejected">Rejected</SelectItem>
                                      <SelectItem value="completed">Completed</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <Badge
                                    className={`text-xs w-full justify-center ${getStatusBadgeColor(quotation.status)}`}
                                    variant="default"
                                  >
                                    {(quotation.status || "pending").charAt(0).toUpperCase() +
                                      (quotation.status || "pending").slice(1)}
                                  </Badge>
                                </div>
                              </td>
                              <td className="py-3 px-2 text-right text-sm text-muted-foreground">
                                {new Date(quotation.createdAt).toLocaleDateString()}
                              </td>
                              <td className="py-3 px-2 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => {
                                      setEditingQuotation(quotation)
                                      setEditDialogOpen(true)
                                    }}
                                    title="Edit Quotation"
                                  >
                                    <Edit className="w-4 h-4" />
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
          </TabsContent>

          {/* Dealers Tab */}
          <TabsContent value="dealers" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                  <CardTitle>All Dealers ({dealers.length})</CardTitle>
                  <div className="relative w-full sm:w-auto">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by name, email, mobile, username..."
                      value={dealerSearchTerm}
                      onChange={(e) => setDealerSearchTerm(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {(() => {
                    const filteredDealers = dealers.filter((d) => {
                      if (!dealerSearchTerm.trim()) return true
                      const search = dealerSearchTerm.toLowerCase()
                      return (
                        d.firstName.toLowerCase().includes(search) ||
                        d.lastName.toLowerCase().includes(search) ||
                        d.email.toLowerCase().includes(search) ||
                        d.mobile.includes(search) ||
                        d.username.toLowerCase().includes(search)
                      )
                    })

                    if (filteredDealers.length === 0) {
                      return (
                        <div className="text-center py-12 text-muted-foreground">
                          <Building className="w-12 h-12 mx-auto mb-4 opacity-50" />
                          <p>No dealers found</p>
                        </div>
                      )
                    }

                    return filteredDealers.map((d) => {
                      const dealerQuotations = quotations.filter((q) => q.dealerId === d.id)
                      const dealerRevenue = dealerQuotations.reduce((sum, q) => sum + q.finalAmount, 0)
                      const isPending = d.isActive === false
                      return (
                        <div
                          key={d.id}
                          className={`p-4 border rounded-lg ${isPending ? "opacity-75 bg-muted/30 border-orange-200" : ""}`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <h3 className="font-semibold text-lg">
                                  {d.firstName} {d.lastName}
                                </h3>
                                {d.username === ADMIN_USERNAME && (
                                  <Badge variant="default">Admin</Badge>
                                )}
                                {isPending ? (
                                  <Badge variant="secondary" className="bg-orange-500">Pending Approval</Badge>
                                ) : (
                                  <Badge className="bg-green-500">Active</Badge>
                                )}
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-muted-foreground">
                                <div>
                                  <span className="font-medium">Email:</span> {d.email}
                                  {d.emailVerified === false && <Badge variant="outline" className="ml-2 text-xs">Unverified</Badge>}
                                </div>
                                <div>
                                  <span className="font-medium">Mobile:</span> {d.mobile}
                                </div>
                                <div>
                                  <span className="font-medium">Username:</span> {d.username}
                                </div>
                                <div>
                                  <span className="font-medium">Gender:</span> {d.gender}
                                </div>
                                {d.dateOfBirth && (
                                  <div>
                                    <span className="font-medium">Date of Birth:</span> {new Date(d.dateOfBirth).toLocaleDateString()}
                                  </div>
                                )}
                                {d.fatherName && (
                                  <div>
                                    <span className="font-medium">Father&apos;s Name:</span> {d.fatherName}
                                  </div>
                                )}
                                {d.fatherContact && (
                                  <div>
                                    <span className="font-medium">Father&apos;s Contact:</span> {d.fatherContact}
                                  </div>
                                )}
                                {d.governmentIdType && (
                                  <div>
                                    <span className="font-medium">ID Type:</span> {d.governmentIdType}
                                  </div>
                                )}
                                {d.governmentIdNumber && (
                                  <div>
                                    <span className="font-medium">ID Number:</span> {d.governmentIdNumber}
                                  </div>
                                )}
                                <div className="md:col-span-2">
                                  <span className="font-medium">Address:</span> {d.address.street}, {d.address.city}, {d.address.state} - {d.address.pincode}
                                </div>
                                {d.createdAt && (
                                  <div className="md:col-span-2 text-xs">
                                    <span className="font-medium">Registered:</span> {new Date(d.createdAt).toLocaleString()}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="text-right ml-4 space-y-2">
                              <div>
                                <div className="text-lg font-semibold">₹{(dealerRevenue / 100000).toFixed(1)}L</div>
                                <div className="text-sm text-muted-foreground">{dealerQuotations.length} quotations</div>
                              </div>
                              {isPending && (
                                <Button
                                  size="sm"
                                  onClick={async () => {
                                    if (!confirm(`Are you sure you want to approve and activate ${d.firstName} ${d.lastName}?`)) return
                                    
                                    try {
                                      if (useApi) {
                                        // Try activate endpoint first, fallback to update
                                        try {
                                          await api.admin.dealers.activate(d.id)
                                        } catch {
                                          // If activate endpoint doesn't exist, use update
                                          await api.admin.dealers.update(d.id, { isActive: true })
                                        }
                                        await loadData()
                                      } else {
                                        // Fallback to localStorage
                                        const updated = dealers.map((dealer) =>
                                          dealer.id === d.id ? { ...dealer, isActive: true } : dealer
                                        )
                                        setDealers(updated)
                                      }
                                    } catch (error) {
                                      console.error("Error activating dealer:", error)
                                      alert(error instanceof ApiError ? error.message : "Failed to activate dealer")
                                    }
                                  }}
                                  className="bg-green-600 hover:bg-green-700"
                                >
                                  <UserCheck className="w-3 h-3 mr-1" />
                                  Approve
                                </Button>
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedDealer(d)
                                  setDealerDialogOpen(true)
                                }}
                              >
                                <Eye className="w-3 h-3 mr-1" />
                                View Details
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setEditingDealer(d)
                                  setDealerEditForm({
                                    firstName: d.firstName || "",
                                    lastName: d.lastName || "",
                                    email: d.email || "",
                                    mobile: d.mobile || "",
                                    gender: d.gender || "",
                                    dateOfBirth: d.dateOfBirth || "",
                                    fatherName: d.fatherName || "",
                                    fatherContact: d.fatherContact || "",
                                    governmentIdType: d.governmentIdType || "",
                                    governmentIdNumber: d.governmentIdNumber || "",
                                    address: {
                                      street: d.address?.street || "",
                                      city: d.address?.city || "",
                                      state: d.address?.state || "",
                                      pincode: d.address?.pincode || "",
                                    },
                                    isActive: d.isActive ?? true,
                                    emailVerified: d.emailVerified ?? false,
                                  })
                                  setDealerEditDialogOpen(true)
                                }}
                              >
                                <Edit className="w-3 h-3 mr-1" />
                                Edit
                              </Button>
                            </div>
                          </div>
                        </div>
                      )
                    })
                  })()}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Customers Tab */}
          <TabsContent value="customers" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <CardTitle>All Customers ({customers.length})</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">Customers from all dealers</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search customers by name, mobile, email, or dealer..."
                    value={customerSearchTerm}
                    onChange={(e) => setCustomerSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
                {(() => {
                  const filteredCustomers = customers.filter((c) => {
                    if (!customerSearchTerm.trim()) return true
                    const searchLower = customerSearchTerm.toLowerCase()
                    return (
                      c.firstName.toLowerCase().includes(searchLower) ||
                      c.lastName.toLowerCase().includes(searchLower) ||
                      c.mobile.includes(customerSearchTerm) ||
                      c.email.toLowerCase().includes(searchLower) ||
                      c.dealers.some((d: string) => d.toLowerCase().includes(searchLower))
                    )
                  })

                  if (filteredCustomers.length === 0) {
                    return (
                      <div className="text-center py-12 text-muted-foreground">
                        <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>No customers found</p>
                        {customerSearchTerm ? (
                          <Button variant="link" onClick={() => setCustomerSearchTerm("")} className="mt-2">
                            Clear search
                          </Button>
                        ) : null}
                      </div>
                    )
                  }

                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {filteredCustomers.map((customer) => (
                        <div
                          key={customer.mobile}
                          className="border border-border rounded-lg p-4 hover:border-primary/50 transition-colors"
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <h3 className="font-medium">
                                {customer.firstName} {customer.lastName}
                              </h3>
                              <p className="text-sm text-muted-foreground">{customer.mobile}</p>
                            </div>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <FileText className="w-3 h-3" />
                              {customer.quotationCount}
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground mb-2">{customer.email}</p>
                          {customer.dealers && customer.dealers.length > 0 && (
                            <div className="mb-2">
                              <p className="text-xs text-muted-foreground">
                                <span className="font-medium">Dealers:</span> {customer.dealers.join(", ")}
                              </p>
                            </div>
                          )}
                          <div className="mb-2">
                            <div className="text-xs text-muted-foreground mb-1">
                              {customer.address?.street && (
                                <div className="mb-1">{customer.address.street}</div>
                              )}
                              <div>
                                {[
                                  customer.address?.city,
                                  customer.address?.state,
                                  customer.address?.pincode
                                ].filter(Boolean).join(", ")}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center justify-between text-sm mb-2">
                            <span className="text-muted-foreground text-xs">
                              Total Spent
                            </span>
                            <span className="font-medium text-primary">₹{Math.abs(customer.totalAmount || 0).toLocaleString()}</span>
                          </div>
                          {customer.lastQuotation && customer.lastQuotation !== "" && !isNaN(new Date(customer.lastQuotation).getTime()) && (
                            <p className="text-xs text-muted-foreground mb-3">
                              Last: {new Date(customer.lastQuotation).toLocaleDateString()}
                            </p>
                          )}
                          <div className="flex gap-2 mt-3">
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1"
                              onClick={async () => {
                                // Load full customer details if we have an ID
                                if (customer.id && useApi) {
                                  try {
                                    const response = await api.customers.getById(customer.id)
                                    const fullCustomer = response.customer || response.data || response
                                    setEditingCustomer({
                                      ...customer,
                                      ...fullCustomer,
                                      address: {
                                        street: fullCustomer.address?.street || customer.address?.street || "",
                                        city: fullCustomer.address?.city || customer.address?.city || "",
                                        state: fullCustomer.address?.state || customer.address?.state || "",
                                        pincode: fullCustomer.address?.pincode || customer.address?.pincode || "",
                                      },
                                    })
                                  } catch (error) {
                                    console.error("Error loading customer details:", error)
                                    setEditingCustomer(customer)
                                  }
                                } else {
                                  setEditingCustomer(customer)
                                }
                                setCustomerEditForm({
                                  firstName: customer.firstName || "",
                                  lastName: customer.lastName || "",
                                  mobile: customer.mobile || "",
                                  email: customer.email || "",
                                  address: {
                                    street: customer.address?.street || "",
                                    city: customer.address?.city || "",
                                    state: customer.address?.state || "",
                                    pincode: customer.address?.pincode || "",
                                  },
                                })
                                setCustomerEditDialogOpen(true)
                              }}
                            >
                              <Edit className="w-3 h-3 mr-1" />
                              Edit
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                })()}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Visitors Tab */}
          <TabsContent value="visitors" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                  <CardTitle>All Visitors ({visitors.length})</CardTitle>
                  <Button
                    onClick={() => {
                      setNewVisitor({
                        username: "",
                        password: "",
                        firstName: "",
                        lastName: "",
                        email: "",
                        mobile: "",
                        employeeId: "",
                      })
                      setEditingVisitor(null)
                      setVisitorDialogOpen(true)
                    }}
                    className="w-full sm:w-auto"
                  >
                    <UserPlus className="w-4 h-4 mr-2" />
                    Create Visitor
                  </Button>
                </div>
                <div className="mt-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by name, email, mobile, employee ID..."
                      value={visitorSearchTerm}
                      onChange={(e) => setVisitorSearchTerm(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {(() => {
                  const filteredVisitors = visitors.filter((v) => {
                    if (!visitorSearchTerm.trim()) return true
                    const search = visitorSearchTerm.toLowerCase()
                    return (
                      v.firstName.toLowerCase().includes(search) ||
                      v.lastName.toLowerCase().includes(search) ||
                      v.email.toLowerCase().includes(search) ||
                      v.mobile.includes(search) ||
                      (v.employeeId && v.employeeId.toLowerCase().includes(search)) ||
                      v.username.toLowerCase().includes(search)
                    )
                  })

                  if (filteredVisitors.length === 0) {
                    return (
                      <div className="text-center py-12 text-muted-foreground">
                        <UserCheck className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>No visitors found</p>
                      </div>
                    )
                  }

                  return (
                    <div className="space-y-4">
                      {filteredVisitors.map((visitor) => {
                        // Visit count from API response (visitCount field from visitor data)
                        const visitCount = (visitor as any).visitCount || 0

                        return (
                          <div
                            key={visitor.id}
                            className={`p-4 border rounded-lg ${visitor.isActive === false ? "opacity-60 bg-muted/30" : ""}`}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <h3 className="font-semibold text-lg">
                                    {visitor.firstName} {visitor.lastName}
                                  </h3>
                                  {visitor.isActive === false ? (
                                    <Badge variant="secondary">Inactive</Badge>
                                  ) : (
                                    <Badge className="bg-green-500">Active</Badge>
                                  )}
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-muted-foreground">
                                  <div>
                                    <span className="font-medium">Email:</span> {visitor.email}
                                  </div>
                                  <div>
                                    <span className="font-medium">Mobile:</span> {visitor.mobile}
                                  </div>
                                  <div>
                                    <span className="font-medium">Username:</span> {visitor.username}
                                  </div>
                                  {visitor.employeeId && (
                                    <div>
                                      <span className="font-medium">Employee ID:</span> {visitor.employeeId}
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="text-right ml-4">
                                <div className="text-lg font-semibold">{visitCount}</div>
                                <div className="text-sm text-muted-foreground">visits assigned</div>
                                <div className="flex gap-2 mt-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={async () => {
                                      if (useApi) {
                                        // Fetch full visitor details from API
                                        try {
                                          const fullVisitorResponse = await api.admin.visitors.getById(visitor.id)
                                          // apiRequest returns data.data, so response is already the visitor object
                                          const fullVisitor = fullVisitorResponse || visitor
                                          setEditingVisitor(fullVisitor)
                                          setNewVisitor({
                                            username: fullVisitor.username || "",
                                            password: "",
                                            firstName: fullVisitor.firstName || "",
                                            lastName: fullVisitor.lastName || "",
                                            email: fullVisitor.email || "",
                                            mobile: fullVisitor.mobile || "",
                                            employeeId: fullVisitor.employeeId || "",
                                          })
                                          setVisitorDialogOpen(true)
                                        } catch (error) {
                                          console.error("Error loading visitor details:", error)
                                          // Fallback to visitor from list
                                          setEditingVisitor(visitor)
                                          setNewVisitor({
                                            username: visitor.username || "",
                                            password: "",
                                            firstName: visitor.firstName || "",
                                            lastName: visitor.lastName || "",
                                            email: visitor.email || "",
                                            mobile: visitor.mobile || "",
                                            employeeId: visitor.employeeId || "",
                                          })
                                          setVisitorDialogOpen(true)
                                        }
                                      } else {
                                        // Fallback to localStorage
                                        const allVisitors = JSON.parse(localStorage.getItem("visitors") || "[]")
                                        const fullVisitor = allVisitors.find((v: Visitor & { password?: string }) => v.id === visitor.id)
                                        setEditingVisitor(fullVisitor || visitor)
                                        setNewVisitor({
                                          username: fullVisitor?.username || "",
                                          password: "",
                                          firstName: fullVisitor?.firstName || "",
                                          lastName: fullVisitor?.lastName || "",
                                          email: fullVisitor?.email || "",
                                          mobile: fullVisitor?.mobile || "",
                                          employeeId: fullVisitor?.employeeId || "",
                                        })
                                        setVisitorDialogOpen(true)
                                      }
                                    }}
                                  >
                                    <Edit className="w-3 h-3 mr-1" />
                                    Edit
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={async () => {
                                      if (!confirm(`Are you sure you want to ${visitor.isActive === false ? "activate" : "deactivate"} this visitor?`)) return
                                      
                                      try {
                                        if (useApi) {
                                          if (visitor.isActive === false) {
                                            // Activate by updating isActive to true
                                            await api.admin.visitors.update(visitor.id, { isActive: true })
                                          } else {
                                            // Deactivate
                                            await api.admin.visitors.delete(visitor.id)
                                          }
                                          await loadData()
                                        } else {
                                          // Fallback to localStorage
                                          const allVisitors = JSON.parse(localStorage.getItem("visitors") || "[]")
                                          const updated = allVisitors.map((v: Visitor) =>
                                            v.id === visitor.id ? { ...v, isActive: visitor.isActive === false ? true : false } : v
                                          )
                                          localStorage.setItem("visitors", JSON.stringify(updated))
                                          const visitorsWithoutPassword = updated.map((v: Visitor & { password?: string }) => {
                                            const { password: _, ...visitorData } = v
                                            return visitorData
                                          })
                                          setVisitors(visitorsWithoutPassword)
                                        }
                                      } catch (error) {
                                        console.error("Error updating visitor status:", error)
                                        alert(error instanceof ApiError ? error.message : "Failed to update visitor status")
                                      }
                                    }}
                                  >
                                    {visitor.isActive === false ? (
                                      <>
                                        <UserCheck className="w-3 h-3 mr-1" />
                                        Activate
                                      </>
                                    ) : (
                                      <>
                                        <UserX className="w-3 h-3 mr-1" />
                                        Deactivate
                                      </>
                                    )}
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )
                })()}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Products Tab */}
          <TabsContent value="products" className="space-y-6">
            <AdminProductManagement />
          </TabsContent>
        </Tabs>

        {/* Quotation Details Dialog */}
        <QuotationDetailsDialog
          quotation={selectedQuotation}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
        />

        {/* Edit Customer Dialog */}
        <Dialog open={customerEditDialogOpen} onOpenChange={setCustomerEditDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Customer - {editingCustomer?.firstName} {editingCustomer?.lastName}</DialogTitle>
              <DialogDescription>
                Update customer information
              </DialogDescription>
            </DialogHeader>

            {editingCustomer && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="admin-customer-firstName">First Name *</Label>
                    <Input
                      id="admin-customer-firstName"
                      value={customerEditForm.firstName || ""}
                      onChange={(e) => setCustomerEditForm({ ...customerEditForm, firstName: e.target.value })}
                      placeholder="Enter first name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="admin-customer-lastName">Last Name *</Label>
                    <Input
                      id="admin-customer-lastName"
                      value={customerEditForm.lastName || ""}
                      onChange={(e) => setCustomerEditForm({ ...customerEditForm, lastName: e.target.value })}
                      placeholder="Enter last name"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="admin-customer-email">Email *</Label>
                    <Input
                      id="admin-customer-email"
                      type="email"
                      value={customerEditForm.email || ""}
                      onChange={(e) => setCustomerEditForm({ ...customerEditForm, email: e.target.value })}
                      placeholder="Enter email"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="admin-customer-mobile">Mobile *</Label>
                    <Input
                      id="admin-customer-mobile"
                      value={customerEditForm.mobile || ""}
                      onChange={(e) => {
                        const cleaned = e.target.value.replace(/\D/g, "").slice(0, 10)
                        setCustomerEditForm({ ...customerEditForm, mobile: cleaned })
                      }}
                      placeholder="Enter 10-digit mobile number"
                      maxLength={10}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="admin-customer-street">Street Address *</Label>
                  <Textarea
                    id="admin-customer-street"
                    value={customerEditForm.address.street || ""}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setCustomerEditForm({
                      ...customerEditForm,
                      address: { ...customerEditForm.address, street: e.target.value }
                    })}
                    placeholder="Enter street address"
                    rows={2}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="admin-customer-city">City *</Label>
                    <Input
                      id="admin-customer-city"
                      value={customerEditForm.address.city || ""}
                      onChange={(e) => setCustomerEditForm({
                        ...customerEditForm,
                        address: { ...customerEditForm.address, city: e.target.value }
                      })}
                      placeholder="Enter city"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="admin-customer-state">State *</Label>
                    <Select
                      value={customerEditForm.address.state || ""}
                      onValueChange={(value) => setCustomerEditForm({
                        ...customerEditForm,
                        address: { ...customerEditForm.address, state: value }
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select state" />
                      </SelectTrigger>
                      <SelectContent>
                        {indianStates.map((state) => (
                          <SelectItem key={state} value={state}>
                            {state}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="admin-customer-pincode">Pincode *</Label>
                  <Input
                    id="admin-customer-pincode"
                    value={customerEditForm.address.pincode || ""}
                    onChange={(e) => {
                      const cleaned = e.target.value.replace(/\D/g, "").slice(0, 6)
                      setCustomerEditForm({
                        ...customerEditForm,
                        address: { ...customerEditForm.address, pincode: cleaned }
                      })
                    }}
                    placeholder="Enter 6-digit pincode"
                    maxLength={6}
                  />
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button variant="outline" onClick={() => setCustomerEditDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={async () => {
                      // Validation
                      if (!customerEditForm.firstName || !customerEditForm.lastName || !customerEditForm.email ||
                          !customerEditForm.mobile || !customerEditForm.address.street ||
                          !customerEditForm.address.city || !customerEditForm.address.state ||
                          !customerEditForm.address.pincode) {
                        alert("Please fill in all required fields")
                        return
                      }

                      if (customerEditForm.mobile.length !== 10) {
                        alert("Mobile number must be 10 digits")
                        return
                      }

                      if (customerEditForm.address.pincode.length !== 6) {
                        alert("Pincode must be 6 digits")
                        return
                      }

                      if (!editingCustomer.id) {
                        alert("Cannot update customer: Customer ID is missing. This customer may not exist in the database.")
                        return
                      }

                      try {
                        if (useApi) {
                          await api.customers.update(editingCustomer.id, {
                            firstName: customerEditForm.firstName.trim(),
                            lastName: customerEditForm.lastName.trim(),
                            email: customerEditForm.email.trim(),
                            mobile: customerEditForm.mobile,
                            address: {
                              street: customerEditForm.address.street.trim(),
                              city: customerEditForm.address.city.trim(),
                              state: customerEditForm.address.state,
                              pincode: customerEditForm.address.pincode,
                            },
                          })
                          await loadData()
                        } else {
                          alert("Customer editing is only available when using the API")
                        }
                        setCustomerEditDialogOpen(false)
                      } catch (error) {
                        console.error("Error updating customer:", error)
                        alert(error instanceof ApiError ? error.message : "Failed to update customer")
                      }
                    }}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    Save Changes
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Edit Quotation Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Quotation - {editingQuotation?.id}</DialogTitle>
              <DialogDescription>Update quotation details and status</DialogDescription>
            </DialogHeader>

            {isLoadingQuotationDetails ? (
              <div className="flex items-center justify-center py-12">
                <p className="text-muted-foreground">Loading quotation details...</p>
              </div>
            ) : editingQuotation ? (
              <div className="space-y-4">
                {/* Status */}
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={editingQuotation.status || "pending"}
                    onValueChange={(value) =>
                      setEditingQuotation({ ...editingQuotation, status: value as QuotationStatus })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Customer Information */}
                <div className="space-y-4 border-t pt-4">
                  <h3 className="font-semibold">Customer Information</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>First Name</Label>
                      <Input
                        value={editingQuotation.customer.firstName}
                        onChange={(e) =>
                          setEditingQuotation({
                            ...editingQuotation,
                            customer: { ...editingQuotation.customer, firstName: e.target.value },
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Last Name</Label>
                      <Input
                        value={editingQuotation.customer.lastName}
                        onChange={(e) =>
                          setEditingQuotation({
                            ...editingQuotation,
                            customer: { ...editingQuotation.customer, lastName: e.target.value },
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Mobile</Label>
                      <Input
                        value={editingQuotation.customer.mobile}
                        onChange={(e) =>
                          setEditingQuotation({
                            ...editingQuotation,
                            customer: { ...editingQuotation.customer, mobile: e.target.value },
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input
                        type="email"
                        value={editingQuotation.customer.email}
                        onChange={(e) =>
                          setEditingQuotation({
                            ...editingQuotation,
                            customer: { ...editingQuotation.customer, email: e.target.value },
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2 col-span-2">
                      <Label>Street Address</Label>
                      <Input
                        value={editingQuotation.customer?.address?.street || ""}
                        onChange={(e) =>
                          setEditingQuotation({
                            ...editingQuotation,
                            customer: {
                              ...editingQuotation.customer,
                              address: { 
                                ...(editingQuotation.customer?.address || { street: "", city: "", state: "", pincode: "" }), 
                                street: e.target.value 
                              },
                            },
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>City</Label>
                      <Input
                        value={editingQuotation.customer?.address?.city || ""}
                        onChange={(e) =>
                          setEditingQuotation({
                            ...editingQuotation,
                            customer: {
                              ...editingQuotation.customer,
                              address: { 
                                ...(editingQuotation.customer?.address || { street: "", city: "", state: "", pincode: "" }), 
                                city: e.target.value 
                              },
                            },
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>State</Label>
                      <Input
                        value={editingQuotation.customer?.address?.state || ""}
                        onChange={(e) =>
                          setEditingQuotation({
                            ...editingQuotation,
                            customer: {
                              ...editingQuotation.customer,
                              address: { 
                                ...(editingQuotation.customer?.address || { street: "", city: "", state: "", pincode: "" }), 
                                state: e.target.value 
                              },
                            },
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Pincode</Label>
                      <Input
                        value={editingQuotation.customer?.address?.pincode || ""}
                        onChange={(e) => {
                          const cleaned = e.target.value.replace(/\D/g, "").slice(0, 6)
                          setEditingQuotation({
                            ...editingQuotation,
                            customer: {
                              ...editingQuotation.customer,
                              address: { 
                                ...(editingQuotation.customer?.address || { street: "", city: "", state: "", pincode: "" }), 
                                pincode: cleaned 
                              },
                            },
                          })
                        }}
                        maxLength={6}
                      />
                    </div>
                  </div>
                </div>

                {/* Pricing */}
                <div className="space-y-4 border-t pt-4">
                  <h3 className="font-semibold">Pricing</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Total Amount (₹)</Label>
                      <Input
                        type="number"
                        value={editingQuotation.totalAmount}
                        onChange={(e) =>
                          setEditingQuotation({
                            ...editingQuotation,
                            totalAmount: Number.parseFloat(e.target.value) || 0,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Discount (%)</Label>
                      <Input
                        type="number"
                        value={editingQuotation.discount}
                        onChange={(e) => {
                          const discount = Number.parseFloat(e.target.value) || 0
                          const finalAmount =
                            editingQuotation.totalAmount - (editingQuotation.totalAmount * discount) / 100
                          setEditingQuotation({
                            ...editingQuotation,
                            discount,
                            finalAmount,
                          })
                        }}
                      />
                    </div>
                    <div className="space-y-2 col-span-2">
                      <Label>Final Amount (₹)</Label>
                      <Input
                        type="number"
                        value={editingQuotation.finalAmount}
                        onChange={(e) =>
                          setEditingQuotation({
                            ...editingQuotation,
                            finalAmount: Number.parseFloat(e.target.value) || 0,
                          })
                        }
                      />
                    </div>
                  </div>
                </div>

                {/* Agent/Dealer */}
                <div className="space-y-2 border-t pt-4">
                  <Label>Created By (Agent/Dealer)</Label>
                  <Select
                    value={editingQuotation.dealerId}
                    onValueChange={(value) =>
                      setEditingQuotation({ ...editingQuotation, dealerId: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {dealers.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.firstName} {d.lastName} ({d.username})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                    <X className="w-4 h-4 mr-2" />
                    Cancel
                  </Button>
                  <Button
                    onClick={() => updateQuotation(editingQuotation)}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Save Changes
                  </Button>
                </div>
              </div>
            ) : null}
          </DialogContent>
        </Dialog>

        {/* Dealer Details Dialog */}
        <Dialog open={dealerDialogOpen} onOpenChange={setDealerDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Dealer Details</DialogTitle>
              <DialogDescription>
                Complete registration information for {selectedDealer?.firstName} {selectedDealer?.lastName}
              </DialogDescription>
            </DialogHeader>

            {selectedDealer && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-semibold">Personal Information</Label>
                    <div className="mt-2 space-y-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Full Name:</span>{" "}
                        <span className="font-medium">
                          {selectedDealer.firstName} {selectedDealer.lastName}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Username:</span>{" "}
                        <span className="font-medium">{selectedDealer.username}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Email:</span>{" "}
                        <span className="font-medium">{selectedDealer.email}</span>
                        {selectedDealer.emailVerified === false && (
                          <Badge variant="outline" className="ml-2">Unverified</Badge>
                        )}
                      </div>
                      <div>
                        <span className="text-muted-foreground">Mobile:</span>{" "}
                        <span className="font-medium">{selectedDealer.mobile}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Gender:</span>{" "}
                        <span className="font-medium">{selectedDealer.gender}</span>
                      </div>
                      {selectedDealer.dateOfBirth && (
                        <div>
                          <span className="text-muted-foreground">Date of Birth:</span>{" "}
                          <span className="font-medium">
                            {new Date(selectedDealer.dateOfBirth).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm font-semibold">Family Information</Label>
                    <div className="mt-2 space-y-2 text-sm">
                      {selectedDealer.fatherName && (
                        <div>
                          <span className="text-muted-foreground">Father&apos;s Name:</span>{" "}
                          <span className="font-medium">{selectedDealer.fatherName}</span>
                        </div>
                      )}
                      {selectedDealer.fatherContact && (
                        <div>
                          <span className="text-muted-foreground">Father&apos;s Contact:</span>{" "}
                          <span className="font-medium">{selectedDealer.fatherContact}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm font-semibold">Government ID</Label>
                    <div className="mt-2 space-y-2 text-sm">
                      {selectedDealer.governmentIdType && (
                        <div>
                          <span className="text-muted-foreground">ID Type:</span>{" "}
                          <span className="font-medium">{selectedDealer.governmentIdType}</span>
                        </div>
                      )}
                      {selectedDealer.governmentIdNumber && (
                        <div>
                          <span className="text-muted-foreground">ID Number:</span>{" "}
                          <span className="font-medium font-mono">{selectedDealer.governmentIdNumber}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm font-semibold">Address</Label>
                    <div className="mt-2 space-y-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Street:</span>{" "}
                        <span className="font-medium">{selectedDealer.address.street}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">City:</span>{" "}
                        <span className="font-medium">{selectedDealer.address.city}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">State:</span>{" "}
                        <span className="font-medium">{selectedDealer.address.state}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Pincode:</span>{" "}
                        <span className="font-medium">{selectedDealer.address.pincode}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {selectedDealer.createdAt && (
                  <div className="pt-4 border-t">
                    <div className="text-sm text-muted-foreground">
                      <span className="font-medium">Registered:</span>{" "}
                      {new Date(selectedDealer.createdAt).toLocaleString()}
                    </div>
                  </div>
                )}

                <div className="pt-4 border-t flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setDealerDialogOpen(false)
                      setEditingDealer(selectedDealer)
                      setDealerEditForm({
                        firstName: selectedDealer.firstName || "",
                        lastName: selectedDealer.lastName || "",
                        email: selectedDealer.email || "",
                        mobile: selectedDealer.mobile || "",
                        gender: selectedDealer.gender || "",
                        dateOfBirth: selectedDealer.dateOfBirth || "",
                        fatherName: selectedDealer.fatherName || "",
                        fatherContact: selectedDealer.fatherContact || "",
                        governmentIdType: selectedDealer.governmentIdType || "",
                        governmentIdNumber: selectedDealer.governmentIdNumber || "",
                        address: {
                          street: selectedDealer.address?.street || "",
                          city: selectedDealer.address?.city || "",
                          state: selectedDealer.address?.state || "",
                          pincode: selectedDealer.address?.pincode || "",
                        },
                        isActive: selectedDealer.isActive ?? true,
                        emailVerified: selectedDealer.emailVerified ?? false,
                      })
                      setDealerEditDialogOpen(true)
                    }}
                    className="flex-1"
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Edit Dealer
                  </Button>
                  {selectedDealer.isActive === false && (
                    <Button
                      onClick={async () => {
                        if (!confirm(`Are you sure you want to approve and activate ${selectedDealer.firstName} ${selectedDealer.lastName}?`)) return
                        
                        try {
                          if (useApi) {
                            try {
                              await api.admin.dealers.activate(selectedDealer.id)
                            } catch {
                              await api.admin.dealers.update(selectedDealer.id, { isActive: true })
                            }
                            await loadData()
                            setDealerDialogOpen(false)
                          } else {
                            const updated = dealers.map((dealer) =>
                              dealer.id === selectedDealer.id ? { ...dealer, isActive: true } : dealer
                            )
                            setDealers(updated)
                            setDealerDialogOpen(false)
                          }
                        } catch (error) {
                          console.error("Error activating dealer:", error)
                          alert(error instanceof ApiError ? error.message : "Failed to activate dealer")
                        }
                      }}
                      className="flex-1 bg-green-600 hover:bg-green-700"
                    >
                      <UserCheck className="w-4 h-4 mr-2" />
                      Approve & Activate
                    </Button>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Edit Dealer Dialog */}
        <Dialog open={dealerEditDialogOpen} onOpenChange={setDealerEditDialogOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Dealer - {editingDealer?.firstName} {editingDealer?.lastName}</DialogTitle>
              <DialogDescription>
                Update dealer information. Username cannot be changed.
              </DialogDescription>
            </DialogHeader>

            {editingDealer && (
              <div className="space-y-4">
                {/* Personal Information */}
                <div className="space-y-4">
                  <Label className="text-base font-semibold">Personal Information</Label>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="dealer-firstName">First Name *</Label>
                      <Input
                        id="dealer-firstName"
                        value={dealerEditForm.firstName || ""}
                        onChange={(e) => setDealerEditForm({ ...dealerEditForm, firstName: e.target.value })}
                        placeholder="Enter first name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="dealer-lastName">Last Name *</Label>
                      <Input
                        id="dealer-lastName"
                        value={dealerEditForm.lastName || ""}
                        onChange={(e) => setDealerEditForm({ ...dealerEditForm, lastName: e.target.value })}
                        placeholder="Enter last name"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="dealer-email">Email *</Label>
                    <Input
                      id="dealer-email"
                      type="email"
                      value={dealerEditForm.email || ""}
                      onChange={(e) => setDealerEditForm({ ...dealerEditForm, email: e.target.value })}
                      placeholder="Enter email"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="dealer-mobile">Mobile *</Label>
                    <Input
                      id="dealer-mobile"
                      value={dealerEditForm.mobile || ""}
                      onChange={(e) => {
                        const cleaned = e.target.value.replace(/\D/g, "").slice(0, 10)
                        setDealerEditForm({ ...dealerEditForm, mobile: cleaned })
                      }}
                      placeholder="Enter 10-digit mobile number"
                      maxLength={10}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="dealer-gender">Gender *</Label>
                      <Select
                        value={dealerEditForm.gender || ""}
                        onValueChange={(value) => setDealerEditForm({ ...dealerEditForm, gender: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select gender" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Male">Male</SelectItem>
                          <SelectItem value="Female">Female</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="dealer-dateOfBirth">Date of Birth *</Label>
                      <Input
                        id="dealer-dateOfBirth"
                        type="date"
                        value={dealerEditForm.dateOfBirth || ""}
                        onChange={(e) => setDealerEditForm({ ...dealerEditForm, dateOfBirth: e.target.value })}
                        max={new Date(new Date().setFullYear(new Date().getFullYear() - 18)).toISOString().split('T')[0]}
                      />
                    </div>
                  </div>
                </div>

                {/* Family Information */}
                <div className="space-y-4 pt-4 border-t">
                  <Label className="text-base font-semibold">Family Information</Label>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="dealer-fatherName">Father&apos;s Name *</Label>
                      <Input
                        id="dealer-fatherName"
                        value={dealerEditForm.fatherName || ""}
                        onChange={(e) => setDealerEditForm({ ...dealerEditForm, fatherName: e.target.value })}
                        placeholder="Enter father's name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="dealer-fatherContact">Father&apos;s Contact *</Label>
                      <Input
                        id="dealer-fatherContact"
                        value={dealerEditForm.fatherContact || ""}
                        onChange={(e) => {
                          const cleaned = e.target.value.replace(/\D/g, "").slice(0, 10)
                          setDealerEditForm({ ...dealerEditForm, fatherContact: cleaned })
                        }}
                        placeholder="Enter 10-digit contact"
                        maxLength={10}
                      />
                    </div>
                  </div>
                </div>

                {/* Government ID */}
                <div className="space-y-4 pt-4 border-t">
                  <Label className="text-base font-semibold">Government ID</Label>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="dealer-governmentIdType">ID Type *</Label>
                      <Select
                        value={dealerEditForm.governmentIdType || ""}
                        onValueChange={(value) => setDealerEditForm({ ...dealerEditForm, governmentIdType: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select ID type" />
                        </SelectTrigger>
                        <SelectContent>
                          {governmentIds.map((id) => (
                            <SelectItem key={id} value={id}>
                              {id}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="dealer-governmentIdNumber">ID Number *</Label>
                      <Input
                        id="dealer-governmentIdNumber"
                        value={dealerEditForm.governmentIdNumber || ""}
                        onChange={(e) => setDealerEditForm({ ...dealerEditForm, governmentIdNumber: e.target.value })}
                        placeholder="Enter ID number"
                      />
                    </div>
                  </div>
                </div>

                {/* Address */}
                <div className="space-y-4 pt-4 border-t">
                  <Label className="text-base font-semibold">Address</Label>
                  <div className="space-y-2">
                    <Label htmlFor="dealer-street">Street *</Label>
                    <Input
                      id="dealer-street"
                      value={dealerEditForm.address.street}
                      onChange={(e) => setDealerEditForm({
                        ...dealerEditForm,
                        address: { ...dealerEditForm.address, street: e.target.value }
                      })}
                      placeholder="Enter street address"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="dealer-city">City *</Label>
                      <Input
                        id="dealer-city"
                        value={dealerEditForm.address?.city || ""}
                        onChange={(e) => setDealerEditForm({
                          ...dealerEditForm,
                          address: { ...dealerEditForm.address, city: e.target.value }
                        })}
                        placeholder="Enter city"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="dealer-state">State *</Label>
                      <Select
                        value={dealerEditForm.address.state}
                        onValueChange={(value) => setDealerEditForm({
                          ...dealerEditForm,
                          address: { ...dealerEditForm.address, state: value }
                        })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select state" />
                        </SelectTrigger>
                        <SelectContent>
                          {indianStates.map((state) => (
                            <SelectItem key={state} value={state}>
                              {state}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dealer-pincode">Pincode *</Label>
                    <Input
                      id="dealer-pincode"
                      value={dealerEditForm.address?.pincode || ""}
                      onChange={(e) => {
                        const cleaned = e.target.value.replace(/\D/g, "").slice(0, 6)
                        setDealerEditForm({
                          ...dealerEditForm,
                          address: { ...dealerEditForm.address, pincode: cleaned }
                        })
                      }}
                      placeholder="Enter 6-digit pincode"
                      maxLength={6}
                    />
                  </div>
                </div>

                {/* Status */}
                <div className="space-y-4 pt-4 border-t">
                  <Label className="text-base font-semibold">Account Status</Label>
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="dealer-isActive"
                        checked={dealerEditForm.isActive}
                        onChange={(e) => setDealerEditForm({ ...dealerEditForm, isActive: e.target.checked })}
                        className="w-4 h-4 rounded border-gray-300"
                      />
                      <Label htmlFor="dealer-isActive" className="font-normal cursor-pointer">
                        Active Account
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="dealer-emailVerified"
                        checked={dealerEditForm.emailVerified}
                        onChange={(e) => setDealerEditForm({ ...dealerEditForm, emailVerified: e.target.checked })}
                        className="w-4 h-4 rounded border-gray-300"
                      />
                      <Label htmlFor="dealer-emailVerified" className="font-normal cursor-pointer">
                        Email Verified
                      </Label>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button variant="outline" onClick={() => setDealerEditDialogOpen(false)}>
                    <X className="w-4 h-4 mr-2" />
                    Cancel
                  </Button>
                  <Button
                    onClick={async () => {
                      // Validation
                      if (!dealerEditForm.firstName || !dealerEditForm.lastName || !dealerEditForm.email ||
                          !dealerEditForm.mobile || !dealerEditForm.gender || !dealerEditForm.dateOfBirth ||
                          !dealerEditForm.fatherName || !dealerEditForm.fatherContact ||
                          !dealerEditForm.governmentIdType || !dealerEditForm.governmentIdNumber ||
                          !dealerEditForm.address.street || !dealerEditForm.address.city ||
                          !dealerEditForm.address.state || !dealerEditForm.address.pincode) {
                        alert("Please fill in all required fields")
                        return
                      }

                      if (dealerEditForm.mobile.length !== 10) {
                        alert("Mobile number must be 10 digits")
                        return
                      }

                      if (dealerEditForm.fatherContact.length !== 10) {
                        alert("Father's contact must be 10 digits")
                        return
                      }

                      if (dealerEditForm.address.pincode.length !== 6) {
                        alert("Pincode must be 6 digits")
                        return
                      }

                      try {
                        if (useApi) {
                          await api.admin.dealers.update(editingDealer.id, {
                            firstName: dealerEditForm.firstName.trim(),
                            lastName: dealerEditForm.lastName.trim(),
                            email: dealerEditForm.email.trim(),
                            mobile: dealerEditForm.mobile,
                            gender: dealerEditForm.gender,
                            dateOfBirth: dealerEditForm.dateOfBirth,
                            fatherName: dealerEditForm.fatherName.trim(),
                            fatherContact: dealerEditForm.fatherContact,
                            governmentIdType: dealerEditForm.governmentIdType,
                            governmentIdNumber: dealerEditForm.governmentIdNumber.trim(),
                            address: {
                              street: dealerEditForm.address.street.trim(),
                              city: dealerEditForm.address.city.trim(),
                              state: dealerEditForm.address.state,
                              pincode: dealerEditForm.address.pincode,
                            },
                            isActive: dealerEditForm.isActive,
                            emailVerified: dealerEditForm.emailVerified,
                          })
                          await loadData()
                        } else {
                          // Fallback to localStorage
                          const allDealers = JSON.parse(localStorage.getItem("dealers") || "[]")
                          const updated = allDealers.map((d: Dealer & { password?: string }) => {
                            if (d.id === editingDealer.id) {
                              return {
                                ...d,
                                firstName: dealerEditForm.firstName.trim(),
                                lastName: dealerEditForm.lastName.trim(),
                                email: dealerEditForm.email.trim(),
                                mobile: dealerEditForm.mobile,
                                gender: dealerEditForm.gender,
                                dateOfBirth: dealerEditForm.dateOfBirth,
                                fatherName: dealerEditForm.fatherName.trim(),
                                fatherContact: dealerEditForm.fatherContact,
                                governmentIdType: dealerEditForm.governmentIdType,
                                governmentIdNumber: dealerEditForm.governmentIdNumber.trim(),
                                address: {
                                  street: dealerEditForm.address.street.trim(),
                                  city: dealerEditForm.address.city.trim(),
                                  state: dealerEditForm.address.state,
                                  pincode: dealerEditForm.address.pincode,
                                },
                                isActive: dealerEditForm.isActive,
                                emailVerified: dealerEditForm.emailVerified,
                              }
                            }
                            return d
                          })
                          localStorage.setItem("dealers", JSON.stringify(updated))
                          setDealers(updated.filter((d: Dealer) => !(d as any).password))
                        }
                        setDealerEditDialogOpen(false)
                        setSelectedDealer(null)
                        setDealerDialogOpen(false)
                      } catch (error) {
                        console.error("Error updating dealer:", error)
                        alert(error instanceof ApiError ? error.message : "Failed to update dealer")
                      }
                    }}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Save Changes
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Visitor Create/Edit Dialog */}
        <Dialog open={visitorDialogOpen} onOpenChange={setVisitorDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingVisitor ? "Edit Visitor" : "Create New Visitor"}</DialogTitle>
              <DialogDescription>
                {editingVisitor ? "Update visitor information" : "Add a new visitor to the system"}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="visitor-firstName">First Name *</Label>
                  <Input
                    id="visitor-firstName"
                    value={newVisitor.firstName}
                    onChange={(e) => setNewVisitor({ ...newVisitor, firstName: e.target.value })}
                    placeholder="Enter first name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="visitor-lastName">Last Name *</Label>
                  <Input
                    id="visitor-lastName"
                    value={newVisitor.lastName}
                    onChange={(e) => setNewVisitor({ ...newVisitor, lastName: e.target.value })}
                    placeholder="Enter last name"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="visitor-username">Username *</Label>
                <Input
                  id="visitor-username"
                  value={newVisitor.username}
                  onChange={(e) => setNewVisitor({ ...newVisitor, username: e.target.value })}
                  placeholder="Enter username"
                  disabled={!!editingVisitor}
                />
                {editingVisitor && (
                  <p className="text-xs text-muted-foreground">Username cannot be changed</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="visitor-password">
                  {editingVisitor ? "New Password (leave blank to keep current)" : "Password *"}
                </Label>
                <Input
                  id="visitor-password"
                  type="password"
                  value={newVisitor.password}
                  onChange={(e) => setNewVisitor({ ...newVisitor, password: e.target.value })}
                  placeholder={editingVisitor ? "Enter new password" : "Enter password"}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="visitor-email">Email *</Label>
                  <Input
                    id="visitor-email"
                    type="email"
                    value={newVisitor.email}
                    onChange={(e) => setNewVisitor({ ...newVisitor, email: e.target.value })}
                    placeholder="Enter email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="visitor-mobile">Mobile *</Label>
                  <Input
                    id="visitor-mobile"
                    value={newVisitor.mobile}
                    onChange={(e) => setNewVisitor({ ...newVisitor, mobile: e.target.value })}
                    placeholder="Enter mobile number"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="visitor-employeeId">Employee ID (Optional)</Label>
                <Input
                  id="visitor-employeeId"
                  value={newVisitor.employeeId}
                  onChange={(e) => setNewVisitor({ ...newVisitor, employeeId: e.target.value })}
                  placeholder="Enter employee ID"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="outline" onClick={() => setVisitorDialogOpen(false)}>
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
                <Button
                  onClick={async () => {
                    if (!newVisitor.firstName || !newVisitor.lastName || !newVisitor.username || !newVisitor.email || !newVisitor.mobile) {
                      alert("Please fill in all required fields")
                      return
                    }

                    if (!editingVisitor && !newVisitor.password) {
                      alert("Password is required for new visitors")
                      return
                    }

                    try {
                      if (useApi) {
                        if (editingVisitor) {
                          // Update existing visitor
                          const updateData: any = {
                            firstName: newVisitor.firstName,
                            lastName: newVisitor.lastName,
                            email: newVisitor.email,
                            mobile: newVisitor.mobile,
                            employeeId: newVisitor.employeeId || undefined,
                            isActive: editingVisitor.isActive !== false,
                          }
                          await api.admin.visitors.update(editingVisitor.id, updateData)
                          
                          // Update password if provided
                          if (newVisitor.password) {
                            await api.admin.visitors.updatePassword(editingVisitor.id, newVisitor.password)
                          }
                        } else {
                          // Create new visitor
                          await api.admin.visitors.create({
                            username: newVisitor.username,
                            password: newVisitor.password,
                            firstName: newVisitor.firstName,
                            lastName: newVisitor.lastName,
                            email: newVisitor.email,
                            mobile: newVisitor.mobile,
                            employeeId: newVisitor.employeeId || undefined,
                          })
                        }
                        await loadData()
                      } else {
                        // Fallback to localStorage
                        const allVisitors = JSON.parse(localStorage.getItem("visitors") || "[]")

                        if (editingVisitor) {
                          // Update existing visitor
                          const updated = allVisitors.map((v: Visitor & { password?: string }) => {
                            if (v.id === editingVisitor.id) {
                              return {
                                ...v,
                                firstName: newVisitor.firstName,
                                lastName: newVisitor.lastName,
                                email: newVisitor.email,
                                mobile: newVisitor.mobile,
                                employeeId: newVisitor.employeeId || undefined,
                                password: newVisitor.password || v.password,
                                updatedAt: new Date().toISOString(),
                              }
                            }
                            return v
                          })
                          localStorage.setItem("visitors", JSON.stringify(updated))
                        } else {
                          // Create new visitor
                          const newVisitorData: Visitor & { password: string } = {
                            id: `visitor_${Date.now()}`,
                            username: newVisitor.username,
                            password: newVisitor.password,
                            firstName: newVisitor.firstName,
                            lastName: newVisitor.lastName,
                            email: newVisitor.email,
                            mobile: newVisitor.mobile,
                            employeeId: newVisitor.employeeId || undefined,
                            isActive: true,
                            createdAt: new Date().toISOString(),
                            createdBy: dealer?.id,
                          }

                          // Check if username or email already exists
                          const usernameExists = allVisitors.some((v: Visitor) => v.username === newVisitor.username)
                          const emailExists = allVisitors.some((v: Visitor) => v.email === newVisitor.email)

                          if (usernameExists) {
                            alert("Username already exists")
                            return
                          }

                          if (emailExists) {
                            alert("Email already exists")
                            return
                          }

                          allVisitors.push(newVisitorData)
                          localStorage.setItem("visitors", JSON.stringify(allVisitors))
                        }

                        // Reload visitors
                        const updatedVisitors = JSON.parse(localStorage.getItem("visitors") || "[]")
                        const visitorsWithoutPassword = updatedVisitors.map((v: Visitor & { password?: string }) => {
                          const { password: _, ...visitorData } = v
                          return visitorData
                        })
                        setVisitors(visitorsWithoutPassword)
                      }

                      setVisitorDialogOpen(false)
                      setEditingVisitor(null)
                      setNewVisitor({
                        username: "",
                        password: "",
                        firstName: "",
                        lastName: "",
                        email: "",
                        mobile: "",
                        employeeId: "",
                      })
                    } catch (error) {
                      console.error("Error saving visitor:", error)
                      alert(error instanceof ApiError ? error.message : "Failed to save visitor")
                    }
                  }}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {editingVisitor ? "Update Visitor" : "Create Visitor"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  )
}

