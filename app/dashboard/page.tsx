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

const ADMIN_USERNAME = "admin"

export default function DashboardPage() {
  const { isAuthenticated, dealer } = useAuth()
  const router = useRouter()
  const [quotations, setQuotations] = useState<Quotation[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedQuotation, setSelectedQuotation] = useState<Quotation | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [visitQuotation, setVisitQuotation] = useState<Quotation | null>(null)
  const [visitDialogOpen, setVisitDialogOpen] = useState(false)

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
    // Load quotations
    const all = JSON.parse(localStorage.getItem("quotations") || "[]")
    const dealerQuotations = all
      .filter((q: Quotation) => q.dealerId === dealer?.id)
      .map((q: Quotation) => ({ ...q, status: q.status || "pending" }))
    setQuotations(dealerQuotations)
  }, [isAuthenticated, router, dealer])

  if (!isAuthenticated) return null

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

  const uniqueCustomers = new Set(quotations.map((q) => q.customer.mobile)).size
  const totalRevenue = quotations.reduce((sum, q) => sum + q.finalAmount, 0)

  const filteredQuotations = quotations.filter(
    (q) =>
      q.customer.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      q.customer.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      q.customer.mobile.includes(searchTerm) ||
      q.id.toLowerCase().includes(searchTerm.toLowerCase()),
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
                              {quotation.customer.firstName} {quotation.customer.lastName}
                            </p>
                            <p className="text-xs text-muted-foreground">{quotation.customer.mobile}</p>
                          </div>
                        </td>
                        <td className="py-4 px-3 text-sm hidden sm:table-cell">
                          <span className="px-2.5 py-1 bg-primary/10 text-primary rounded-full text-xs font-medium uppercase">
                            {quotation.products.systemType}
                          </span>
                        </td>
                        <td className="py-4 px-3 text-sm text-right font-semibold text-foreground">
                          ₹{quotation.finalAmount.toLocaleString()}
                        </td>
                        <td className="py-4 px-3 text-sm">
                          <Badge className={`text-xs ${getStatusBadgeColor(quotation.status)}`}>
                            {(quotation.status || "pending").charAt(0).toUpperCase() +
                              (quotation.status || "pending").slice(1)}
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
        onOpenChange={setVisitDialogOpen}
      />
    </div>
  )
}
