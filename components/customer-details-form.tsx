"use client"

import type React from "react"

import { useState } from "react"
import type { Customer } from "@/lib/quotation-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowRight } from "lucide-react"
import { indianStates } from "@/lib/quotation-data"

interface Props {
  onSubmit: (customer: Customer) => void
  initialData?: Customer
}

export function CustomerDetailsForm({ onSubmit, initialData }: Props) {
  const [error, setError] = useState("")
  const [formData, setFormData] = useState<Customer>(
    initialData || {
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
    },
  )

  const updateFormData = (field: string, value: string) => {
    if (field.startsWith("address.")) {
      const addressField = field.replace("address.", "")
      setFormData((prev) => ({
        ...prev,
        address: { ...prev.address, [addressField]: value },
      }))
    } else {
      setFormData((prev) => ({ ...prev, [field]: value }))
    }
    setError("")
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.firstName || !formData.lastName || !formData.mobile) {
      setError("Please fill in all required fields")
      return
    }

    if (!/^\d{10}$/.test(formData.mobile)) {
      setError("Please enter a valid 10-digit mobile number")
      return
    }

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setError("Please enter a valid email address")
      return
    }

    if (!formData.address.street || !formData.address.city || !formData.address.state || !formData.address.pincode) {
      setError("Please fill in complete address")
      return
    }

    if (!/^\d{6}$/.test(formData.address.pincode)) {
      setError("Please enter a valid 6-digit pincode")
      return
    }

    onSubmit(formData)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg sm:text-xl">Customer Details</CardTitle>
        <CardDescription className="text-sm">Enter the customer information for the quotation</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="firstName">First Name *</Label>
              <Input
                id="firstName"
                value={formData.firstName}
                onChange={(e) => updateFormData("firstName", e.target.value)}
                placeholder="Enter first name"
              />
            </div>
            <div>
              <Label htmlFor="lastName">Last Name *</Label>
              <Input
                id="lastName"
                value={formData.lastName}
                onChange={(e) => updateFormData("lastName", e.target.value)}
                placeholder="Enter last name"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="mobile">Mobile Number *</Label>
              <Input
                id="mobile"
                type="tel"
                value={formData.mobile}
                onChange={(e) => updateFormData("mobile", e.target.value)}
                placeholder="10-digit mobile number"
                maxLength={10}
              />
            </div>
            <div>
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => updateFormData("email", e.target.value)}
                placeholder="Enter email address (optional)"
              />
            </div>
          </div>

          <div className="border-t border-border pt-4 sm:pt-6">
            <h3 className="text-sm font-medium mb-3 sm:mb-4">Address Details</h3>
            <div className="space-y-4">
              <div>
                <Label htmlFor="street">Street Address *</Label>
                <Input
                  id="street"
                  value={formData.address.street}
                  onChange={(e) => updateFormData("address.street", e.target.value)}
                  placeholder="Enter street address"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="city">City *</Label>
                  <Input
                    id="city"
                    value={formData.address.city}
                    onChange={(e) => updateFormData("address.city", e.target.value)}
                    placeholder="Enter city"
                  />
                </div>
                <div>
                  <Label htmlFor="state">State *</Label>
                  <Select value={formData.address.state} onValueChange={(v) => updateFormData("address.state", v)}>
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
                <div>
                  <Label htmlFor="pincode">Pincode *</Label>
                  <Input
                    id="pincode"
                    value={formData.address.pincode}
                    onChange={(e) => updateFormData("address.pincode", e.target.value)}
                    placeholder="6-digit pincode"
                    maxLength={6}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="submit" className="w-full sm:w-auto h-11">
              Continue to Product Selection
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
