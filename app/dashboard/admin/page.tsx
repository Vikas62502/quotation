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
} from "lucide-react"
import type { Quotation, QuotationStatus } from "@/lib/quotation-context"
import type { Dealer } from "@/lib/auth-context"
import { QuotationDetailsDialog } from "@/components/quotation-details-dialog"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"

// Admin username check
const ADMIN_USERNAME = "admin"

export default function AdminPanelPage() {
  const { isAuthenticated, dealer } = useAuth()
  const router = useRouter()
  const [quotations, setQuotations] = useState<Quotation[]>([])
  const [dealers, setDealers] = useState<Dealer[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [filterDealer, setFilterDealer] = useState("all")
  const [filterMonth, setFilterMonth] = useState("all")
  const [selectedQuotation, setSelectedQuotation] = useState<Quotation | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [activeTab, setActiveTab] = useState("overview")
  const [editingQuotation, setEditingQuotation] = useState<Quotation | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)

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
  }, [isAuthenticated, router, dealer])

  if (!isAuthenticated || dealer?.username !== ADMIN_USERNAME) return null

  // Calculate statistics
  const totalQuotations = quotations.length
  const totalRevenue = quotations.reduce((sum, q) => sum + q.finalAmount, 0)
  const uniqueCustomers = new Set(quotations.map((q) => q.customer.mobile)).size
  const activeDealers = new Set(quotations.map((q) => q.dealerId)).size

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
  const updateQuotationStatus = (quotationId: string, status: QuotationStatus) => {
    const updated = quotations.map((q) => (q.id === quotationId ? { ...q, status } : q))
    setQuotations(updated)
    localStorage.setItem("quotations", JSON.stringify(updated))
  }

  // Update quotation data
  const updateQuotation = (updatedQuotation: Quotation) => {
    const updated = quotations.map((q) => (q.id === updatedQuotation.id ? updatedQuotation : q))
    setQuotations(updated)
    localStorage.setItem("quotations", JSON.stringify(updated))
    setEditDialogOpen(false)
    setEditingQuotation(null)
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

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">Admin Panel</h1>
          <p className="text-muted-foreground mt-2">View and manage all system data</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="quotations">All Quotations</TabsTrigger>
            <TabsTrigger value="dealers">Dealers</TabsTrigger>
            <TabsTrigger value="customers">Customers</TabsTrigger>
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
            </div>

            {/* Top Dealers */}
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
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground">
                            Quotation ID
                          </th>
                          <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground">Customer</th>
                          <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground hidden md:table-cell">
                            Agent/Dealer
                          </th>
                          <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground hidden lg:table-cell">
                            System Type
                          </th>
                          <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground">Amount</th>
                          <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground">Status</th>
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
                            <td className="py-3 px-2 hidden md:table-cell">
                              <div className="flex items-center gap-2">
                                <Building className="w-4 h-4 text-muted-foreground" />
                                <div>
                                  <span className="text-sm font-medium">{getDealerName(quotation.dealerId)}</span>
                                  <p className="text-xs text-muted-foreground">ID: {quotation.dealerId}</p>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-2 hidden lg:table-cell">
                              <Badge variant="outline" className="text-xs uppercase">
                                {quotation.products.systemType}
                              </Badge>
                            </td>
                            <td className="py-3 px-2 text-right">
                              <div>
                                <p className="text-sm font-medium">₹{quotation.finalAmount.toLocaleString()}</p>
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
                            <td className="py-3 px-2 text-right text-sm text-muted-foreground hidden sm:table-cell">
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
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Dealers Tab */}
          <TabsContent value="dealers" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>All Dealers ({dealers.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {dealers.map((d) => {
                    const dealerQuotations = quotations.filter((q) => q.dealerId === d.id)
                    const dealerRevenue = dealerQuotations.reduce((sum, q) => sum + q.finalAmount, 0)
                    return (
                      <div key={d.id} className="p-4 border rounded-lg">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="font-semibold text-lg">
                                {d.firstName} {d.lastName}
                              </h3>
                              {d.username === ADMIN_USERNAME && (
                                <Badge variant="default">Admin</Badge>
                              )}
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-muted-foreground">
                              <div>
                                <span className="font-medium">Email:</span> {d.email}
                              </div>
                              <div>
                                <span className="font-medium">Mobile:</span> {d.mobile}
                              </div>
                              <div>
                                <span className="font-medium">Username:</span> {d.username}
                              </div>
                              <div>
                                <span className="font-medium">Location:</span> {d.address.city}, {d.address.state}
                              </div>
                            </div>
                          </div>
                          <div className="text-right ml-4">
                            <div className="text-lg font-semibold">₹{(dealerRevenue / 100000).toFixed(1)}L</div>
                            <div className="text-sm text-muted-foreground">{dealerQuotations.length} quotations</div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Customers Tab */}
          <TabsContent value="customers" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>All Customers ({uniqueCustomers})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Array.from(new Set(quotations.map((q) => q.customer.mobile)))
                    .map((mobile) => {
                      const customerQuotations = quotations.filter((q) => q.customer.mobile === mobile)
                      const customer = customerQuotations[0].customer
                      const totalSpent = customerQuotations.reduce((sum, q) => sum + q.finalAmount, 0)
                      return { mobile, customer, customerQuotations, totalSpent }
                    })
                    .sort((a, b) => b.totalSpent - a.totalSpent)
                    .map(({ mobile, customer, customerQuotations, totalSpent }) => (
                      <div key={mobile} className="p-4 border rounded-lg">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="font-semibold text-lg mb-2">
                              {customer.firstName} {customer.lastName}
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-muted-foreground">
                              <div>
                                <span className="font-medium">Email:</span> {customer.email}
                              </div>
                              <div>
                                <span className="font-medium">Mobile:</span> {customer.mobile}
                              </div>
                              <div className="md:col-span-2">
                                <span className="font-medium">Address:</span> {customer.address.street},{" "}
                                {customer.address.city}, {customer.address.state} - {customer.address.pincode}
                              </div>
                            </div>
                          </div>
                          <div className="text-right ml-4">
                            <div className="text-lg font-semibold">₹{(totalSpent / 100000).toFixed(1)}L</div>
                            <div className="text-sm text-muted-foreground">{customerQuotations.length} quotations</div>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Quotation Details Dialog */}
        <QuotationDetailsDialog
          quotation={selectedQuotation}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
        />

        {/* Edit Quotation Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Quotation - {editingQuotation?.id}</DialogTitle>
              <DialogDescription>Update quotation details and status</DialogDescription>
            </DialogHeader>

            {editingQuotation && (
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
                        value={editingQuotation.customer.address.street}
                        onChange={(e) =>
                          setEditingQuotation({
                            ...editingQuotation,
                            customer: {
                              ...editingQuotation.customer,
                              address: { ...editingQuotation.customer.address, street: e.target.value },
                            },
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>City</Label>
                      <Input
                        value={editingQuotation.customer.address.city}
                        onChange={(e) =>
                          setEditingQuotation({
                            ...editingQuotation,
                            customer: {
                              ...editingQuotation.customer,
                              address: { ...editingQuotation.customer.address, city: e.target.value },
                            },
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>State</Label>
                      <Input
                        value={editingQuotation.customer.address.state}
                        onChange={(e) =>
                          setEditingQuotation({
                            ...editingQuotation,
                            customer: {
                              ...editingQuotation.customer,
                              address: { ...editingQuotation.customer.address, state: e.target.value },
                            },
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Pincode</Label>
                      <Input
                        value={editingQuotation.customer.address.pincode}
                        onChange={(e) =>
                          setEditingQuotation({
                            ...editingQuotation,
                            customer: {
                              ...editingQuotation.customer,
                              address: { ...editingQuotation.customer.address, pincode: e.target.value },
                            },
                          })
                        }
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
            )}
          </DialogContent>
        </Dialog>
      </main>
    </div>
  )
}

