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
    const all = JSON.parse(localStorage.getItem("quotations") || "[]")
    const dealerQuotations = all
      .filter((q: Quotation) => q.dealerId === dealer?.id)
      .map((q: Quotation) => ({ ...q, status: q.status || "pending" }))
    setQuotations(dealerQuotations)
  }, [isAuthenticated, router, dealer])

  if (!isAuthenticated) return null

  const filteredQuotations = quotations.filter((q) => {
    const matchesSearch =
      q.customer.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      q.customer.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      q.customer.mobile.includes(searchTerm) ||
      q.id.toLowerCase().includes(searchTerm.toLowerCase())

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
                              {quotation.customer.firstName} {quotation.customer.lastName}
                            </p>
                            <p className="text-xs text-muted-foreground">{quotation.customer.mobile}</p>
                          </div>
                        </td>
                        <td className="py-3 px-2 hidden md:table-cell">
                          <span className="px-2 py-1 bg-primary/10 text-primary rounded text-xs uppercase">
                            {quotation.products.systemType}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-right">
                          <div>
                            <p className="text-sm font-medium">₹{quotation.finalAmount?.toLocaleString()}</p>
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
        onOpenChange={setVisitDialogOpen}
      />
    </div>
  )
}
