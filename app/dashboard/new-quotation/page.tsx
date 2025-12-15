"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { useQuotation, type Customer, type ProductSelection } from "@/lib/quotation-context"
import { DashboardNav } from "@/components/dashboard-nav"
import { CustomerDetailsForm } from "@/components/customer-details-form"
import { ProductSelectionForm } from "@/components/product-selection-form"
import { QuotationConfirmation } from "@/components/quotation-confirmation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Check } from "lucide-react"

const steps = [
  { id: 1, name: "Customer Details" },
  { id: 2, name: "Product Selection" },
  { id: 3, name: "Confirmation" },
]

const ADMIN_USERNAME = "admin"

export default function NewQuotationPage() {
  const { isAuthenticated, dealer } = useAuth()
  const { setCurrentCustomer, setCurrentProducts, currentCustomer, currentProducts, clearCurrent } = useQuotation()
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(1)

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/login")
      return
    }
    
    // Redirect admin to admin panel - admins cannot create quotations
    if (dealer?.username === ADMIN_USERNAME) {
      router.push("/dashboard/admin")
      return
    }
    
    // Only clear data if explicitly starting a new quotation (not on every mount)
    // This allows data to persist when navigating between steps
  }, [isAuthenticated, router, dealer])

  if (!isAuthenticated) return null

  const handleCustomerSubmit = (customer: Customer) => {
    setCurrentCustomer(customer)
    setCurrentStep(2)
  }

  const handleProductSubmit = (products: ProductSelection) => {
    setCurrentProducts(products)
    setCurrentStep(3)
    // Scroll to top when moving to confirmation step
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1))
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardNav />

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Progress Steps */}
          <div className="mb-8">
            <div className="flex items-center justify-center">
              {steps.map((step, index) => (
                <div key={step.id} className="flex items-center">
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium ${
                        currentStep > step.id
                          ? "bg-primary text-primary-foreground"
                          : currentStep === step.id
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {currentStep > step.id ? <Check className="w-5 h-5" /> : step.id}
                    </div>
                    <span
                      className={`text-xs mt-2 ${currentStep >= step.id ? "text-foreground" : "text-muted-foreground"}`}
                    >
                      {step.name}
                    </span>
                  </div>
                  {index < steps.length - 1 && (
                    <div
                      className={`w-16 sm:w-24 lg:w-32 h-0.5 mx-2 mb-6 ${
                        currentStep > step.id ? "bg-primary" : "bg-muted"
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Step Content */}
          {currentStep === 1 && (
            <CustomerDetailsForm onSubmit={handleCustomerSubmit} initialData={currentCustomer || undefined} />
          )}
          {currentStep === 2 && (
            <ProductSelectionForm
              onSubmit={handleProductSubmit}
              onBack={handleBack}
              initialData={currentProducts || undefined}
            />
          )}
          {currentStep === 3 ? (
            currentCustomer && currentProducts ? (
              <div className="animate-in fade-in-50 duration-300">
                <QuotationConfirmation 
                  customer={currentCustomer} 
                  products={currentProducts} 
                  onBack={handleBack}
                  onEditCustomer={() => setCurrentStep(1)}
                  onEditProducts={() => setCurrentStep(2)}
                />
              </div>
            ) : (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center py-12 text-muted-foreground">
                    <p className="mb-4">Missing customer or product data. Please go back and complete the previous steps.</p>
                    <div className="flex gap-2 justify-center">
                      <Button variant="outline" onClick={() => setCurrentStep(1)}>Go to Customer Details</Button>
                      <Button variant="outline" onClick={() => setCurrentStep(2)}>Go to Product Selection</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          ) : null}
        </div>
      </main>
    </div>
  )
}
