"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { DashboardNav } from "@/components/dashboard-nav"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search, Users, FileText, Edit } from "lucide-react"
import type { Quotation } from "@/lib/quotation-context"
import { api, ApiError } from "@/lib/api"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { indianStates } from "@/lib/quotation-data"

interface CustomerData {
  id?: string
  firstName: string
  lastName: string
  mobile: string
  email: string
  address: {
    street: string
    city: string
    state: string
    pincode: string
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
  const [editingCustomer, setEditingCustomer] = useState<CustomerData | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
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

    loadCustomers()
  }, [isAuthenticated, router, dealer])

  const loadCustomers = async () => {
    if (!dealer?.id) return

    try {
      if (useApi) {
        // Get all customers for this dealer
        const response = await api.customers.getAll()
        const customersList = response.customers || []
        
        // Get quotations to aggregate data
        const quotationsResponse = await api.quotations.getAll()
        const dealerQuotations = (quotationsResponse.quotations || [])
          .filter((q: any) => q.dealerId === dealer.id)

        const customerMap = new Map<string, CustomerData>()

        // Map customers
        customersList.forEach((c: any) => {
          // Expect new format: address object with street, city, state, pincode
          const address = c.address || {}
          customerMap.set(c.mobile, {
            id: c.id,
            firstName: c.firstName,
            lastName: c.lastName,
            mobile: c.mobile,
            email: c.email,
            address: {
              street: address.street || "",
              city: address.city || "",
              state: address.state || "",
              pincode: address.pincode || "",
            },
            quotationCount: 0,
            totalAmount: 0,
            lastQuotation: "",
          })
        })

        // Aggregate from quotations
        dealerQuotations.forEach((q: any) => {
          const key = q.customer?.mobile || ""
          const existing = customerMap.get(key)

          if (existing) {
            customerMap.set(key, {
              ...existing,
              quotationCount: existing.quotationCount + 1,
              totalAmount: existing.totalAmount + (q.pricing?.finalAmount || q.finalAmount || 0),
              lastQuotation:
                (existing.lastQuotation && existing.lastQuotation !== "" && new Date(q.createdAt) > new Date(existing.lastQuotation))
                  ? q.createdAt 
                  : (existing.lastQuotation && existing.lastQuotation !== "" ? existing.lastQuotation : q.createdAt),
            })
          } else if (q.customer) {
            customerMap.set(key, {
              id: q.customerId || q.customer?.id,
              firstName: q.customer.firstName,
              lastName: q.customer.lastName,
              mobile: q.customer.mobile,
              email: q.customer.email,
              address: {
                street: q.customer.address?.street || "",
                city: q.customer.address?.city || "",
                state: q.customer.address?.state || "",
                pincode: q.customer.address?.pincode || "",
              },
              quotationCount: 1,
              totalAmount: q.pricing?.finalAmount || q.finalAmount || 0,
              lastQuotation: q.createdAt,
            })
          }
        })

        setCustomers(Array.from(customerMap.values()))
      } else {
        // Fallback to localStorage
        const all = JSON.parse(localStorage.getItem("quotations") || "[]")
        const dealerQuotations = all.filter((q: Quotation) => q.dealerId === dealer.id)

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
                (existing.lastQuotation && existing.lastQuotation !== "" && new Date(q.createdAt) > new Date(existing.lastQuotation))
                  ? q.createdAt 
                  : (existing.lastQuotation && existing.lastQuotation !== "" ? existing.lastQuotation : q.createdAt),
            })
          } else {
            customerMap.set(key, {
              id: undefined, // localStorage doesn't have customer ID
              firstName: q.customer.firstName,
              lastName: q.customer.lastName,
              mobile: q.customer.mobile,
              email: q.customer.email,
              address: {
                street: q.customer.address?.street || "",
                city: q.customer.address?.city || "",
                state: q.customer.address?.state || "",
                pincode: q.customer.address?.pincode || "",
              },
              quotationCount: 1,
              totalAmount: q.finalAmount,
              lastQuotation: q.createdAt,
            })
          }
        })

        setCustomers(Array.from(customerMap.values()))
      }
    } catch (error) {
      console.error("Error loading customers:", error)
    }
  }

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
                        {customer.address?.city || ""}, {customer.address?.state || ""}
                        {customer.address?.street && (
                          <span className="block text-xs mt-1">{customer.address.street}</span>
                        )}
                      </span>
                      <span className="font-medium text-primary">₹{Math.abs(customer.totalAmount || 0).toLocaleString()}</span>
                    </div>
                    {customer.lastQuotation && customer.lastQuotation !== "" && !isNaN(new Date(customer.lastQuotation).getTime()) && (
                      <p className="text-xs text-muted-foreground mt-2">
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
                              const fullCustomer = response.customer || response.data
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
                          setEditDialogOpen(true)
                        }}
                      >
                        <Edit className="w-3 h-3 mr-1" />
                        Edit
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Edit Customer Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
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
                  <Label htmlFor="customer-firstName">First Name *</Label>
                  <Input
                    id="customer-firstName"
                    value={customerEditForm.firstName || ""}
                    onChange={(e) => setCustomerEditForm({ ...customerEditForm, firstName: e.target.value })}
                    placeholder="Enter first name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customer-lastName">Last Name *</Label>
                  <Input
                    id="customer-lastName"
                    value={customerEditForm.lastName || ""}
                    onChange={(e) => setCustomerEditForm({ ...customerEditForm, lastName: e.target.value })}
                    placeholder="Enter last name"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="customer-email">Email *</Label>
                  <Input
                    id="customer-email"
                    type="email"
                    value={customerEditForm.email || ""}
                    onChange={(e) => setCustomerEditForm({ ...customerEditForm, email: e.target.value })}
                    placeholder="Enter email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customer-mobile">Mobile *</Label>
                  <Input
                    id="customer-mobile"
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
                <Label htmlFor="customer-street">Street Address *</Label>
                <Textarea
                  id="customer-street"
                  value={customerEditForm.address.street || ""}
                  onChange={(e) => setCustomerEditForm({
                    ...customerEditForm,
                    address: { ...customerEditForm.address, street: e.target.value }
                  })}
                  placeholder="Enter street address"
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="customer-city">City *</Label>
                  <Input
                    id="customer-city"
                    value={customerEditForm.address.city || ""}
                    onChange={(e) => setCustomerEditForm({
                      ...customerEditForm,
                      address: { ...customerEditForm.address, city: e.target.value }
                    })}
                    placeholder="Enter city"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customer-state">State *</Label>
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
                <Label htmlFor="customer-pincode">Pincode *</Label>
                <Input
                  id="customer-pincode"
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
                <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
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
                        await loadCustomers()
                      } else {
                        alert("Customer editing is only available when using the API")
                      }
                      setEditDialogOpen(false)
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
    </div>
  )
}
