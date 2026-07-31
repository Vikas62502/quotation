"use client"

import { Suspense, useEffect, useMemo, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { useQuotation, type Customer, type ProductSelection } from "@/lib/quotation-context"
import {
  customerFromPrefillSearchParams,
  customerHasAnyAddress,
  getPrefillSearchParams,
  mapApiRecordToCustomer,
  mergeCustomerPreferringComplete,
  prefillSignatureFromSearchParams,
} from "@/lib/quotation-prefill"
import { api } from "@/lib/api"
import { DashboardNav } from "@/components/dashboard-nav"
import { CustomerDetailsForm } from "@/components/customer-details-form"
import { ProductSelectionForm } from "@/components/product-selection-form"
import { QuotationConfirmation } from "@/components/quotation-confirmation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Check } from "lucide-react"
import { normalizeMobileForMatch } from "@/lib/quotation-api-payload"

const steps = [
  { id: 1, name: "Customer Details" },
  { id: 2, name: "Product Selection" },
  { id: 3, name: "Confirmation" },
]

const ADMIN_USERNAME = "admin"

async function enrichCustomerAddress(mapped: ReturnType<typeof mapApiRecordToCustomer>, full: unknown) {
  let next = mapped
  if (customerHasAnyAddress(next)) return next

  const root = full && typeof full === "object" ? (full as Record<string, unknown>) : {}
  const nested = root.customer && typeof root.customer === "object" ? (root.customer as Record<string, unknown>) : {}
  const customerId = String(
    root.customerId || root.customer_id || nested.id || "",
  ).trim()

  if (customerId) {
    try {
      const customerRow = await api.customers.getById(customerId)
      next = mergeCustomerPreferringComplete(next, mapApiRecordToCustomer(customerRow))
    } catch {
      // keep quotation-mapped customer
    }
  }

  if (customerHasAnyAddress(next)) return next

  const mobile = normalizeMobileForMatch(next?.mobile || "")
  if (!mobile) return next

  try {
    const customersResponse = await api.customers.getAll({ search: mobile, limit: 20 })
    const list =
      (customersResponse as any)?.customers ||
      (customersResponse as any)?.data?.customers ||
      (Array.isArray(customersResponse) ? customersResponse : [])
    const match = (Array.isArray(list) ? list : []).find((row: any) => {
      const m = normalizeMobileForMatch(String(row?.mobile || row?.phone || ""))
      return m && (m === mobile || m.endsWith(mobile) || mobile.endsWith(m))
    })
    if (match) {
      next = mergeCustomerPreferringComplete(next, mapApiRecordToCustomer(match))
    }
  } catch {
    // keep what we have
  }

  return next
}

function NewQuotationPageContent() {
  const { isAuthenticated, dealer, authReady } = useAuth()
  const { setCurrentCustomer, setCurrentProducts, currentCustomer, currentProducts } =
    useQuotation()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [currentStep, setCurrentStep] = useState(1)
  const appliedPrefillSignatureRef = useRef<string>("")
  const appliedReviseIdRef = useRef<string>("")
  const [reviseLoading, setReviseLoading] = useState(false)
  const [reviseError, setReviseError] = useState<string | null>(null)

  const reviseQuotationId = (searchParams.get("reviseQuotationId") || "").trim()
  const lockCustomer =
    searchParams.get("lockCustomer") === "1" || Boolean(reviseQuotationId)

  const prefillParams = useMemo(
    () => getPrefillSearchParams(searchParams),
    [searchParams],
  )
  const prefillCustomer = useMemo(
    () => customerFromPrefillSearchParams(prefillParams),
    [prefillParams],
  )
  const prefillSignature = useMemo(
    () => prefillSignatureFromSearchParams(prefillParams),
    [prefillParams],
  )
  const customerFormInitial = prefillCustomer ?? currentCustomer ?? undefined

  useEffect(() => {
    if (!authReady) return

    if (!isAuthenticated) {
      router.push("/login")
      return
    }

    if (dealer?.username === ADMIN_USERNAME) {
      router.push("/dashboard/admin")
      return
    }
  }, [authReady, isAuthenticated, router, dealer])

  useEffect(() => {
    if (!prefillCustomer || !prefillSignature) return
    if (reviseQuotationId) return
    if (appliedPrefillSignatureRef.current === prefillSignature) return
    appliedPrefillSignatureRef.current = prefillSignature
    setCurrentCustomer(prefillCustomer)
    setCurrentStep(1)
  }, [prefillCustomer, prefillSignature, setCurrentCustomer, reviseQuotationId])

  // Revise bootstrap: run once per quotation id. Never force step back to 2 after user
  // reaches confirmation (setCurrentCustomer is not stable and would re-trigger this).
  useEffect(() => {
    if (!reviseQuotationId) {
      setReviseLoading(false)
      setReviseError(null)
      return
    }
    if (appliedReviseIdRef.current === reviseQuotationId) return
    appliedReviseIdRef.current = reviseQuotationId

    let cancelled = false
    const fromUrl =
      prefillCustomer ||
      customerFromPrefillSearchParams(getPrefillSearchParams(searchParams))

    const goToProductsWithoutLeavingConfirm = () => {
      setCurrentStep((prev) => (prev >= 3 ? prev : 2))
    }

    setReviseError(null)
    if (fromUrl) {
      setCurrentCustomer(fromUrl)
      goToProductsWithoutLeavingConfirm()
      setReviseLoading(false)
    } else {
      setReviseLoading(true)
    }

    void (async () => {
      try {
        const useApi = process.env.NEXT_PUBLIC_USE_API !== "false"
        let mapped: Customer | null = null
        if (useApi) {
          const full = await api.quotations.getById(reviseQuotationId)
          if (cancelled) return
          mapped = await enrichCustomerAddress(mapApiRecordToCustomer(full), full)
        }
        if (cancelled) return
        const merged = mergeCustomerPreferringComplete(fromUrl, mapped)
        if (merged) setCurrentCustomer(merged)
        goToProductsWithoutLeavingConfirm()
      } catch (err) {
        if (cancelled) return
        if (!fromUrl) {
          setReviseError(
            err instanceof Error ? err.message : "Failed to load quotation customer",
          )
          setCurrentStep((prev) => (prev >= 3 ? prev : 1))
        } else {
          goToProductsWithoutLeavingConfirm()
        }
      } finally {
        if (!cancelled) setReviseLoading(false)
      }
    })()

    return () => {
      cancelled = true
      // Do not clear appliedReviseIdRef — clearing re-runs bootstrap and kicks
      // the user from Confirmation back to Product Selection.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- bootstrap once per revise id only
  }, [reviseQuotationId])

  // Keep context customer in sync for revise confirm / save.
  useEffect(() => {
    if (currentStep !== 3) return
    const merged = mergeCustomerPreferringComplete(prefillCustomer, currentCustomer)
    if (!merged) return
    if (
      !currentCustomer ||
      currentCustomer.address?.street !== merged.address.street ||
      currentCustomer.address?.city !== merged.address.city ||
      currentCustomer.address?.pincode !== merged.address.pincode
    ) {
      setCurrentCustomer(merged)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when entering confirm
  }, [currentStep, prefillSignature])

  // If confirm still has no address, re-fetch quotation/customer once.
  useEffect(() => {
    if (currentStep !== 3 || !reviseQuotationId) return
    if (customerHasAnyAddress(currentCustomer) || customerHasAnyAddress(prefillCustomer)) return
    let cancelled = false
    void (async () => {
      try {
        const full = await api.quotations.getById(reviseQuotationId)
        if (cancelled) return
        const mapped = await enrichCustomerAddress(mapApiRecordToCustomer(full), full)
        if (cancelled || !mapped) return
        setCurrentCustomer(mergeCustomerPreferringComplete(currentCustomer, mapped) || mapped)
      } catch {
        // leave as-is
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep, reviseQuotationId])

  if (!authReady || !isAuthenticated) return null

  const handleCustomerSubmit = (customer: Customer) => {
    setCurrentCustomer(customer)
    setCurrentStep(2)
  }

  const handleProductSubmit = (products: ProductSelection) => {
    // Keep the richest customer we have (API address must not be wiped by URL prefill).
    const merged = mergeCustomerPreferringComplete(
      prefillCustomer ?? customerFormInitial,
      currentCustomer,
    )
    if (merged) setCurrentCustomer(merged)
    setCurrentProducts(products)
    setCurrentStep(3)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const handleBack = () => {
    if (lockCustomer && currentStep === 2) {
      router.push("/dashboard/quotations")
      return
    }
    setCurrentStep((prev) => Math.max(prev - 1, 1))
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardNav />

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {reviseQuotationId ? (
            <div className="mb-4 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-foreground">
              Revising system for existing customer. Saving creates a <strong>new</strong> quotation; the
              previous one stays in your list (e.g. Adani kept when you add Waaree).
            </div>
          ) : null}
          {reviseError ? (
            <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {reviseError}
            </div>
          ) : null}
          {searchParams.get("prefillLeadId") ? (
            <div className="mb-4">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const leadId = searchParams.get("prefillLeadId")
                  router.push(
                    leadId
                      ? `/dashboard/calling-data?leadId=${encodeURIComponent(leadId)}`
                      : "/dashboard/calling-data",
                  )
                }}
              >
                Back to Calling Data
              </Button>
            </div>
          ) : null}
          {/* Progress Steps */}
          <div className="mb-6 sm:mb-8">
            <div className="flex items-center justify-center overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
              <div className="flex items-center min-w-fit">
                {steps.map((step, index) => (
                  <div key={step.id} className="flex items-center">
                    <div className="flex flex-col items-center min-w-[60px] sm:min-w-[90px] md:min-w-[110px]">
                      <div
                        className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-xs sm:text-sm font-medium transition-all ${
                          currentStep > step.id
                            ? "bg-primary text-primary-foreground"
                            : currentStep === step.id
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {currentStep > step.id ? (
                          <Check className="w-4 h-4 sm:w-5 sm:h-5" />
                        ) : (
                          step.id
                        )}
                      </div>
                      <span
                        className={`text-[10px] sm:text-xs mt-1.5 sm:mt-2 text-center px-0.5 sm:px-1 leading-tight ${
                          currentStep >= step.id ? "text-foreground font-medium" : "text-muted-foreground"
                        }`}
                      >
                        <span className="hidden sm:inline">{step.name}</span>
                        <span className="sm:hidden">
                          {step.name === "Customer Details"
                            ? "Customer"
                            : step.name === "Product Selection"
                              ? "Products"
                              : step.name}
                        </span>
                      </span>
                    </div>
                    {index < steps.length - 1 && (
                      <div
                        className={`w-8 sm:w-12 md:w-20 lg:w-28 xl:w-32 h-0.5 mx-1 sm:mx-2 mb-5 sm:mb-6 ${
                          currentStep > step.id ? "bg-primary" : "bg-muted"
                        }`}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {reviseLoading ? (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-muted-foreground py-8">Loading customer…</p>
              </CardContent>
            </Card>
          ) : null}

          {/* Step Content */}
          {!reviseLoading && currentStep === 1 && (
            <CustomerDetailsForm
              key={prefillSignature || "customer-step"}
              onSubmit={handleCustomerSubmit}
              initialData={customerFormInitial}
              locked={lockCustomer}
            />
          )}
          {!reviseLoading && currentStep === 2 && (
            <ProductSelectionForm
              key={reviseQuotationId ? `revise-${reviseQuotationId}` : "products-step"}
              onSubmit={handleProductSubmit}
              onBack={handleBack}
              initialData={reviseQuotationId ? undefined : currentProducts || undefined}
            />
          )}
          {!reviseLoading && currentStep === 3 ? (
            (currentCustomer || prefillCustomer) && currentProducts ? (
              <div className="animate-in fade-in-50 duration-300">
                <QuotationConfirmation
                  customer={
                    mergeCustomerPreferringComplete(prefillCustomer, currentCustomer) ||
                    currentCustomer ||
                    prefillCustomer!
                  }
                  products={currentProducts}
                  onBack={handleBack}
                  onEditCustomer={lockCustomer ? undefined : () => setCurrentStep(1)}
                  onEditProducts={() => setCurrentStep(2)}
                  reviseQuotationId={reviseQuotationId || undefined}
                />
              </div>
            ) : (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center py-12 text-muted-foreground">
                    <p className="mb-4">
                      Missing customer or product data. Please go back and complete the previous steps.
                    </p>
                    <div className="flex gap-2 justify-center">
                      {!lockCustomer ? (
                        <Button variant="outline" onClick={() => setCurrentStep(1)}>
                          Go to Customer Details
                        </Button>
                      ) : null}
                      <Button variant="outline" onClick={() => setCurrentStep(2)}>
                        Go to Product Selection
                      </Button>
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

export default function NewQuotationPage() {
  return (
    <Suspense fallback={null}>
      <NewQuotationPageContent />
    </Suspense>
  )
}
