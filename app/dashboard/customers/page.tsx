"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { DashboardNav } from "@/components/dashboard-nav"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search, Users, FileText } from "lucide-react"
import type { Quotation } from "@/lib/quotation-context"

interface CustomerData {
  firstName: string
  lastName: string
  mobile: string
  email: string
  address: {
    city: string
    state: string
  }
  quotationCount: number
  totalAmount: number
  lastQuotation: string
}

const ADMIN_USERNAME = "admin"

export default function CustomersPage() {
  const { isAuthenticated, dealer } = useAuth()
  const router = useRouter()
  const [customers, setCustomers] = useState<CustomerData[]>([])
  const [searchTerm, setSearchTerm] = useState("")

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

    // Aggregate customer data from quotations
    const all = JSON.parse(localStorage.getItem("quotations") || "[]")
    const dealerQuotations = all.filter((q: Quotation) => q.dealerId === dealer?.id)

    const customerMap = new Map<string, CustomerData>()

    dealerQuotations.forEach((q: Quotation) => {
      const key = q.customer.mobile
      const existing = customerMap.get(key)

      if (existing) {
        customerMap.set(key, {
          ...existing,
          quotationCount: existing.quotationCount + 1,
          totalAmount: existing.totalAmount + q.finalAmount,
          lastQuotation:
            new Date(q.createdAt) > new Date(existing.lastQuotation) ? q.createdAt : existing.lastQuotation,
        })
      } else {
        customerMap.set(key, {
          firstName: q.customer.firstName,
          lastName: q.customer.lastName,
          mobile: q.customer.mobile,
          email: q.customer.email,
          address: {
            city: q.customer.address.city,
            state: q.customer.address.state,
          },
          quotationCount: 1,
          totalAmount: q.finalAmount,
          lastQuotation: q.createdAt,
        })
      }
    })

    setCustomers(Array.from(customerMap.values()))
  }, [isAuthenticated, router, dealer])

  if (!isAuthenticated) return null

  const filteredCustomers = customers.filter(
    (c) =>
      c.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.mobile.includes(searchTerm) ||
      c.email.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  return (
    <div className="min-h-screen bg-background">
      <DashboardNav />

      <main className="container mx-auto px-4 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Customers</h1>
            <p className="text-muted-foreground">{customers.length} total customers</p>
          </div>
          <Button onClick={() => router.push("/dashboard/new-quotation")}>New Quotation</Button>
        </div>

        <Card>
          <CardHeader>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search customers by name, mobile, or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </CardHeader>
          <CardContent>
            {filteredCustomers.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No customers found</p>
                {searchTerm ? (
                  <Button variant="link" onClick={() => setSearchTerm("")}>
                    Clear search
                  </Button>
                ) : (
                  <Button variant="link" onClick={() => router.push("/dashboard/new-quotation")}>
                    Create your first quotation
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredCustomers.map((customer) => (
                  <div
                    key={customer.mobile}
                    className="border border-border rounded-lg p-4 hover:border-primary/50 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
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
                    <p className="text-xs text-muted-foreground mb-3">{customer.email}</p>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        {customer.address.city}, {customer.address.state}
                      </span>
                      <span className="font-medium text-primary">₹{customer.totalAmount.toLocaleString()}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Last: {new Date(customer.lastQuotation).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
