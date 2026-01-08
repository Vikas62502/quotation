"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import { api, ApiError } from "./api"
import { useAuth } from "./auth-context"

export interface Customer {
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
}

export interface ProductSelection {
  systemType: string
  panelBrand: string
  panelSize: string
  panelQuantity: number
  inverterType: string
  inverterBrand: string
  inverterSize: string
  structureType: string
  structureSize: string
  meterBrand: string
  acCableBrand: string
  acCableSize: string
  dcCableBrand: string
  dcCableSize: string
  acdb: string
  dcdb: string
  // DCR specific
  centralSubsidy?: number
  stateSubsidy?: number
  // System price (for DCR, NON DCR, BOTH - complete set price)
  systemPrice?: number
  // Hybrid specific
  hybridInverter?: string
  batteryCapacity?: string
  batteryPrice?: number
  // Customize
  customPanels?: Array<{ brand: string; size: string; quantity: number; type: string }>
  dcrPanelBrand?: string
  dcrPanelSize?: string
  dcrPanelQuantity?: number
  nonDcrPanelBrand?: string
  nonDcrPanelSize?: string
  nonDcrPanelQuantity?: number
}

export type QuotationStatus = "pending" | "approved" | "rejected" | "completed"

export interface Quotation {
  id: string
  customer: Customer
  products: ProductSelection
  discount: number
  totalAmount: number
  finalAmount: number
  createdAt: string
  dealerId: string
  status?: QuotationStatus
}

interface QuotationContextType {
  currentCustomer: Customer | null
  currentProducts: ProductSelection | null
  quotations: Quotation[]
  isLoading: boolean
  error: string | null
  setCurrentCustomer: (customer: Customer) => void
  setCurrentProducts: (products: ProductSelection) => void
  saveQuotation: (discount: number, subtotalValue: number) => Promise<Quotation>
  loadQuotations: () => Promise<void>
  clearCurrent: () => void
}

const QuotationContext = createContext<QuotationContextType | undefined>(undefined)

export function QuotationProvider({ children }: { children: ReactNode }) {
  const { dealer } = useAuth()
  const useApi = process.env.NEXT_PUBLIC_USE_API !== "false"
  
  // Load from localStorage on mount (for form state only, not data)
  const [currentCustomer, setCurrentCustomerState] = useState<Customer | null>(() => {
    if (typeof window !== "undefined" && !useApi) {
      const stored = localStorage.getItem("currentCustomer")
      return stored ? JSON.parse(stored) : null
    }
    return null
  })
  
  const [currentProducts, setCurrentProductsState] = useState<ProductSelection | null>(() => {
    if (typeof window !== "undefined" && !useApi) {
      const stored = localStorage.getItem("currentProducts")
      return stored ? JSON.parse(stored) : null
    }
    return null
  })
  
  const [quotations, setQuotations] = useState<Quotation[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Persist form state to localStorage when not using API
  useEffect(() => {
    if (!useApi) {
      if (currentCustomer) {
        localStorage.setItem("currentCustomer", JSON.stringify(currentCustomer))
      } else {
        localStorage.removeItem("currentCustomer")
      }
    }
  }, [currentCustomer, useApi])

  useEffect(() => {
    if (!useApi) {
      if (currentProducts) {
        localStorage.setItem("currentProducts", JSON.stringify(currentProducts))
      } else {
        localStorage.removeItem("currentProducts")
      }
    }
  }, [currentProducts, useApi])

  const setCurrentCustomer = (customer: Customer) => {
    setCurrentCustomerState(customer)
  }

  const setCurrentProducts = (products: ProductSelection) => {
    setCurrentProductsState(products)
  }

  const loadQuotations = async () => {
    if (!dealer?.id) return
    
    setIsLoading(true)
    setError(null)
    
    try {
      if (useApi) {
        const response = await api.quotations.getAll()
        const dealerQuotations = (response.quotations || []).map((q: any) => ({
          ...q,
          status: q.status || "pending",
        }))
        setQuotations(dealerQuotations)
      } else {
        // Fallback to localStorage
        const all = JSON.parse(localStorage.getItem("quotations") || "[]")
        const dealerQuotations = all
          .filter((q: Quotation) => q.dealerId === dealer.id)
          .map((q: Quotation) => ({ ...q, status: q.status || "pending" }))
        setQuotations(dealerQuotations)
      }
    } catch (err) {
      console.error("Error loading quotations:", err)
      setError(err instanceof ApiError ? err.message : "Failed to load quotations")
    } finally {
      setIsLoading(false)
    }
  }

  const saveQuotation = async (discount: number, subtotalValue: number): Promise<Quotation> => {
    if (!currentCustomer || !currentProducts || !dealer?.id) {
      throw new Error("Missing customer, products, or dealer information")
    }

    // CRITICAL: Validate subtotalValue before proceeding
    // Note: Parameter is named subtotalValue to avoid conflict with calculated totalAmount
    console.log("[saveQuotation] === RECEIVED VALUES ===")
    console.log("[saveQuotation] Received values:", {
      discount,
      subtotalValue,
      type: typeof subtotalValue,
      isFinite: Number.isFinite(subtotalValue),
      isZero: subtotalValue === 0,
      isNull: subtotalValue === null,
      isUndefined: subtotalValue === undefined,
      currentProductsSystemPrice: currentProducts.systemPrice,
      currentProductsSystemPriceType: typeof currentProducts.systemPrice,
    })
    console.log("[saveQuotation] =======================")

    // STRICT validation - must be > 0, not just truthy
    if (subtotalValue === null || subtotalValue === undefined || !Number.isFinite(subtotalValue) || subtotalValue <= 0) {
      console.error("[saveQuotation] === INVALID SUBTOTAL VALUE ===")
      console.error("[saveQuotation] Invalid subtotalValue received:", {
        subtotalValue,
        type: typeof subtotalValue,
        isFinite: Number.isFinite(subtotalValue),
        isZero: subtotalValue === 0,
        isNull: subtotalValue === null,
        isUndefined: subtotalValue === undefined,
        currentProductsSystemPrice: currentProducts.systemPrice,
        currentProductsData: {
          systemType: currentProducts.systemType,
          panelBrand: currentProducts.panelBrand,
          panelSize: currentProducts.panelSize,
          panelQuantity: currentProducts.panelQuantity,
        }
      })
      console.error("[saveQuotation] ==============================")
      throw new Error(`Invalid subtotal value: ${subtotalValue}. Subtotal must be greater than 0. Please ensure a valid system configuration is selected or enter a valid amount in the Subtotal field.`)
    }
    
    // Double-check after conversion
    const validatedSubtotalValue = Number(subtotalValue)
    if (!Number.isFinite(validatedSubtotalValue) || validatedSubtotalValue <= 0) {
      console.error("[saveQuotation] Subtotal validation failed after Number conversion:", validatedSubtotalValue)
      throw new Error(`Subtotal validation failed: ${validatedSubtotalValue}. Subtotal must be greater than 0.`)
    }

    setIsLoading(true)
    setError(null)

    try {
      if (useApi) {
        // First, create or get customer
        let customerId: string
        try {
          // Try to find existing customer by mobile
          const customersResponse = await api.customers.getAll({ search: currentCustomer.mobile })
          const existingCustomer = customersResponse.customers?.find(
            (c: any) => c.mobile === currentCustomer.mobile
          )
          
          if (existingCustomer) {
            customerId = existingCustomer.id
          } else {
            // Create new customer
            // Prepare customer data - ensure email is only sent if it exists and is valid
            const customerData: any = {
              firstName: currentCustomer.firstName,
              lastName: currentCustomer.lastName,
              mobile: currentCustomer.mobile,
              address: currentCustomer.address,
            }
            
            // Only include email if it's provided and valid
            if (currentCustomer.email && currentCustomer.email.trim() !== "") {
              customerData.email = currentCustomer.email.trim()
            }
            
            const newCustomer = await api.customers.create(customerData)
            customerId = newCustomer.id
          }
        } catch (err: any) {
          console.error("Error creating customer:", err)
          
          // Provide more detailed error message
          let errorMessage = "Failed to create customer"
          if (err instanceof Error) {
            errorMessage = err.message || errorMessage
          } else if (err?.message) {
            errorMessage = err.message
          } else if (typeof err === "string") {
            errorMessage = err
          }
          
          // If it's an API error with details, include them
          if (err?.details && Array.isArray(err.details)) {
            const details = err.details.map((d: any) => `${d.field}: ${d.message}`).join(", ")
            errorMessage += `. Details: ${details}`
          }
          
          throw new Error(errorMessage)
        }

        // Calculate pricing values - matching backend controller logic
        // subtotalValue parameter = Subtotal (set price - complete package price)
        // Backend expects: subtotal, totalAmount, finalAmount at root level
        const subtotal = Number(subtotalValue) // Subtotal is the set price (complete package price)
        
        // Double-check subtotal is still valid after conversion
        if (!subtotal || subtotal <= 0 || !Number.isFinite(subtotal)) {
          console.error("[saveQuotation] Subtotal became invalid after conversion:", {
            originalSubtotalValue: subtotalValue,
            convertedSubtotal: subtotal,
            currentProductsSystemPrice: currentProducts.systemPrice,
          })
          throw new Error(`Subtotal validation failed: ${subtotal}. Cannot proceed with quotation creation.`)
        }
        
        // Calculate subsidy amounts (matching backend variable names)
        const centralSubsidy = Number(currentProducts.centralSubsidy || 0)
        const stateSubsidy = Number(currentProducts.stateSubsidy || 0)
        const totalSubsidy = centralSubsidy + stateSubsidy
        
        // Calculate derived amounts (matching backend calculations)
        const amountAfterSubsidy = subtotal - totalSubsidy
        const discountAmount = amountAfterSubsidy * (discount / 100)
        
        // totalAmount = Amount after discount (Subtotal - Subsidy - Discount)
        // This is what customer pays after all deductions
        const totalAmount = amountAfterSubsidy - discountAmount
        
        // finalAmount = Subtotal - Subsidy (discount is NOT applied to final amount)
        // This is the final amount before discount
        const finalAmount = subtotal - totalSubsidy

        // Clean and validate products data before sending
        // Remove empty strings and ensure required fields are present
        const cleanedProducts: ProductSelection = {
          systemType: currentProducts.systemType,
          panelBrand: currentProducts.panelBrand || "",
          panelSize: currentProducts.panelSize || "",
          panelQuantity: currentProducts.panelQuantity || 0,
          inverterType: currentProducts.inverterType || "",
          inverterBrand: currentProducts.inverterBrand || "",
          inverterSize: currentProducts.inverterSize || "",
          structureType: currentProducts.structureType || "",
          structureSize: currentProducts.structureSize || "",
          meterBrand: currentProducts.meterBrand || "",
          acCableBrand: currentProducts.acCableBrand || "",
          acCableSize: currentProducts.acCableSize || "",
          dcCableBrand: currentProducts.dcCableBrand || "",
          dcCableSize: currentProducts.dcCableSize || "",
          acdb: currentProducts.acdb || "",
          dcdb: currentProducts.dcdb || "",
        }

        // Add optional fields if they exist
        if (currentProducts.centralSubsidy !== undefined) {
          cleanedProducts.centralSubsidy = currentProducts.centralSubsidy
        }
        if (currentProducts.stateSubsidy !== undefined) {
          cleanedProducts.stateSubsidy = currentProducts.stateSubsidy
        }
        if (currentProducts.systemPrice !== undefined) {
          cleanedProducts.systemPrice = currentProducts.systemPrice
        }
        if (currentProducts.dcrPanelBrand) {
          cleanedProducts.dcrPanelBrand = currentProducts.dcrPanelBrand
          cleanedProducts.dcrPanelSize = currentProducts.dcrPanelSize || ""
          cleanedProducts.dcrPanelQuantity = currentProducts.dcrPanelQuantity || 0
        }
        if (currentProducts.nonDcrPanelBrand) {
          cleanedProducts.nonDcrPanelBrand = currentProducts.nonDcrPanelBrand
          cleanedProducts.nonDcrPanelSize = currentProducts.nonDcrPanelSize || ""
          cleanedProducts.nonDcrPanelQuantity = currentProducts.nonDcrPanelQuantity || 0
        }
        if (currentProducts.batteryCapacity) {
          cleanedProducts.batteryCapacity = currentProducts.batteryCapacity
        }
        if (currentProducts.batteryPrice !== undefined) {
          cleanedProducts.batteryPrice = currentProducts.batteryPrice
        }
        if (currentProducts.hybridInverter) {
          cleanedProducts.hybridInverter = currentProducts.hybridInverter
        }

        // Validate required fields based on system type
        if (cleanedProducts.systemType === "both") {
          if (!cleanedProducts.dcrPanelBrand || !cleanedProducts.dcrPanelSize || !cleanedProducts.dcrPanelQuantity) {
            throw new Error("DCR panel information is required for BOTH system type")
          }
          if (!cleanedProducts.nonDcrPanelBrand || !cleanedProducts.nonDcrPanelSize || !cleanedProducts.nonDcrPanelQuantity) {
            throw new Error("Non-DCR panel information is required for BOTH system type")
          }
        } else if (cleanedProducts.systemType !== "customize") {
          if (!cleanedProducts.panelBrand || !cleanedProducts.panelSize || !cleanedProducts.panelQuantity) {
            throw new Error("Panel information is required")
          }
        }

        if (!cleanedProducts.inverterBrand || !cleanedProducts.inverterSize) {
          throw new Error("Inverter information is required")
        }
        if (!cleanedProducts.structureType || !cleanedProducts.structureSize) {
          throw new Error("Structure information is required")
        }
        if (!cleanedProducts.meterBrand) {
          throw new Error("Meter brand is required")
        }
        if (!cleanedProducts.acCableBrand || !cleanedProducts.acCableSize || !cleanedProducts.dcCableBrand || !cleanedProducts.dcCableSize) {
          throw new Error("Cable information is required")
        }
        if (!cleanedProducts.acdb || !cleanedProducts.dcdb) {
          throw new Error("ACDB and DCDB are required")
        }

        // Validate all pricing values (matching backend validation logic)
        // Log the raw values first to debug
        console.log("[saveQuotation] Raw pricing values before validation:", {
          subtotal,
          centralSubsidy,
          stateSubsidy,
          totalSubsidy,
          amountAfterSubsidy,
          discountAmount,
          totalAmount,
          finalAmount,
        })

        // Validate subtotal - must be > 0 (matching backend validation)
        if (!Number.isFinite(subtotal) || subtotal <= 0) {
          console.error("[saveQuotation] Invalid subtotal value:", subtotal, {
            subtotal,
            type: typeof subtotal,
            isNaN: Number.isNaN(subtotal),
            isFinite: Number.isFinite(subtotal),
          })
          throw new Error(`Invalid subtotal: ${subtotal}. Subtotal must be greater than 0. Please ensure the system price is set correctly or enter a valid subtotal amount in the input field.`)
        }
        
        // Ensure all values are valid numbers (matching backend validation)
        const validatedSubtotal = Number(subtotal)
        if (!Number.isFinite(validatedSubtotal) || validatedSubtotal <= 0) {
          console.error("[saveQuotation] Subtotal validation failed:", validatedSubtotal)
          throw new Error(`Invalid subtotal calculation: ${validatedSubtotal}. Please check the system configuration or enter a valid subtotal.`)
        }

        // Validate totalAmount - must be a valid number (can be 0)
        const validatedTotalAmount = Number(totalAmount)
        if (!Number.isFinite(validatedTotalAmount) || validatedTotalAmount < 0) {
          console.error("[saveQuotation] Invalid totalAmount:", validatedTotalAmount)
          throw new Error(`Invalid total amount: ${validatedTotalAmount}. Cannot proceed with quotation creation.`)
        }
        
        // Validate finalAmount - must be a valid number (can be 0 if subsidy equals subtotal)
        const validatedFinalAmount = Number(finalAmount)
        if (!Number.isFinite(validatedFinalAmount) || validatedFinalAmount < 0) {
          console.error("[saveQuotation] Invalid finalAmount:", validatedFinalAmount)
          throw new Error(`Invalid final amount: ${validatedFinalAmount}. Cannot proceed with quotation creation.`)
        }

        // Ensure all numeric values are properly converted
        const validatedCentralSubsidy = Number(centralSubsidy) || 0
        const validatedStateSubsidy = Number(stateSubsidy) || 0
        const validatedTotalSubsidy = Number(totalSubsidy) || 0
        const validatedAmountAfterSubsidy = Number(amountAfterSubsidy) || (validatedSubtotal - validatedTotalSubsidy)
        const validatedDiscountAmount = Number(discountAmount) || 0

        // Log the data being sent for debugging (matching backend log format)
        console.log("[saveQuotation] Sending quotation data with pricing:", {
          customerId,
          discount,
          subtotal: validatedSubtotal, // Set price (complete package price)
          centralSubsidy: validatedCentralSubsidy,
          stateSubsidy: validatedStateSubsidy,
          totalSubsidy: validatedTotalSubsidy,
          amountAfterSubsidy: validatedAmountAfterSubsidy,
          discountAmount: validatedDiscountAmount,
          totalAmount: validatedTotalAmount, // Amount after discount (Subtotal - Subsidy - Discount)
          finalAmount: validatedFinalAmount, // Subtotal - Subsidy (discount not applied)
        })
        
        // Log panel size specifically for debugging
        if (cleanedProducts.panelSize) {
          console.log("Panel Size being sent:", cleanedProducts.panelSize)
        }
        if (cleanedProducts.dcrPanelSize) {
          console.log("DCR Panel Size being sent:", cleanedProducts.dcrPanelSize)
        }
        if (cleanedProducts.nonDcrPanelSize) {
          console.log("Non-DCR Panel Size being sent:", cleanedProducts.nonDcrPanelSize)
        }

        // Create quotation payload - matching backend controller expectations
        // Backend expects these fields at root level: subtotal, totalAmount, finalAmount
        // Variable names must match backend exactly
        const quotationData = {
          customerId,
          customer: currentCustomer,
          products: cleanedProducts,
          discount: Number(discount) || 0,
          // REQUIRED FIELDS (at root level - matching backend destructuring)
          subtotal: validatedSubtotal, // Set price (complete package price) - REQUIRED
          totalAmount: validatedTotalAmount, // Amount after discount (Subtotal - Subsidy - Discount) - REQUIRED
          finalAmount: validatedFinalAmount, // Final amount (Subtotal - Subsidy, discount NOT applied) - REQUIRED
          // Optional but recommended fields (matching backend variable names)
          centralSubsidy: validatedCentralSubsidy, // Individual central subsidy amount
          stateSubsidy: validatedStateSubsidy, // Individual state subsidy amount
          totalSubsidy: validatedTotalSubsidy, // Total subsidy (central + state)
          amountAfterSubsidy: validatedAmountAfterSubsidy, // Amount after subsidy
          discountAmount: validatedDiscountAmount, // Discount amount
        }
        
        // Final validation - ensure all required fields are present and valid
        // Matching backend validation logic exactly
        if (!quotationData.subtotal || quotationData.subtotal <= 0) {
          console.error("[saveQuotation] Final validation failed - subtotal is invalid:", quotationData)
          throw new Error(`Subtotal is missing or invalid: ${quotationData.subtotal}. Cannot create quotation.`)
        }
        
        if (quotationData.totalAmount === undefined || quotationData.totalAmount === null || !Number.isFinite(quotationData.totalAmount)) {
          console.error("[saveQuotation] Final validation failed - totalAmount is invalid:", quotationData)
          throw new Error(`Total amount is missing or invalid: ${quotationData.totalAmount}. Cannot create quotation.`)
        }
        
        if (quotationData.finalAmount === undefined || quotationData.finalAmount === null || !Number.isFinite(quotationData.finalAmount)) {
          console.error("[saveQuotation] Final validation failed - finalAmount is invalid:", quotationData)
          throw new Error(`Final amount is missing or invalid: ${quotationData.finalAmount}. Cannot create quotation.`)
        }

        // Log the complete payload being sent (matching backend log format)
        console.log("[saveQuotation] === FINAL PAYLOAD BEING SENT TO BACKEND ===")
        console.log("[saveQuotation] Complete quotation payload:", JSON.stringify(quotationData, null, 2))
        console.log("[saveQuotation] Required fields validation (matching backend checks):", {
          subtotal: {
            value: quotationData.subtotal,
            type: typeof quotationData.subtotal,
            isFinite: Number.isFinite(quotationData.subtotal),
            isValid: quotationData.subtotal > 0,
            isAtRoot: 'subtotal' in quotationData && !('subtotal' in (quotationData.products || {}))
          },
          totalAmount: {
            value: quotationData.totalAmount,
            type: typeof quotationData.totalAmount,
            isFinite: Number.isFinite(quotationData.totalAmount),
            isValid: Number.isFinite(quotationData.totalAmount),
            isAtRoot: 'totalAmount' in quotationData && !('totalAmount' in (quotationData.products || {}))
          },
          finalAmount: {
            value: quotationData.finalAmount,
            type: typeof quotationData.finalAmount,
            isFinite: Number.isFinite(quotationData.finalAmount),
            isValid: Number.isFinite(quotationData.finalAmount),
            isAtRoot: 'finalAmount' in quotationData && !('finalAmount' in (quotationData.products || {}))
          }
        })
        console.log("[saveQuotation] Payload keys at root level:", Object.keys(quotationData))
        console.log("[saveQuotation] Backend will receive these fields at req.body:", {
          subtotal: quotationData.subtotal,
          totalAmount: quotationData.totalAmount,
          finalAmount: quotationData.finalAmount,
          centralSubsidy: quotationData.centralSubsidy,
          stateSubsidy: quotationData.stateSubsidy,
          totalSubsidy: quotationData.totalSubsidy,
          amountAfterSubsidy: quotationData.amountAfterSubsidy,
          discountAmount: quotationData.discountAmount
        })
        console.log("[saveQuotation] ===========================================")

        const quotation = await api.quotations.create(quotationData)
        
        // Reload quotations
        await loadQuotations()
        
        // Backend returns pricing object with all saved values
        // Use backend pricing values (they are the source of truth)
        const backendPricing = quotation.pricing
        
        // Fallback calculations (should not be needed if backend returns pricing)
        const calculatedSubtotal = subtotalValue // subtotalValue parameter is the subtotal
        const calculatedSubsidy = (currentProducts.centralSubsidy || 0) + (currentProducts.stateSubsidy || 0)
        const calculatedAmountAfterSubsidy = calculatedSubtotal - calculatedSubsidy
        const calculatedDiscountAmount = calculatedAmountAfterSubsidy * (discount / 100)
        const calculatedTotalAmount = calculatedAmountAfterSubsidy - calculatedDiscountAmount
        const calculatedFinalAmount = calculatedSubtotal - calculatedSubsidy
        
        return {
          id: quotation.id,
          customer: currentCustomer,
          products: currentProducts,
          discount: quotation.discount || discount,
          // Use backend pricing values (from database) as source of truth
          totalAmount: backendPricing?.totalAmount ?? calculatedTotalAmount,
          finalAmount: backendPricing?.finalAmount ?? calculatedFinalAmount,
          createdAt: quotation.createdAt,
          dealerId: quotation.dealerId || dealer.id,
          status: quotation.status || "pending",
        }
      } else {
        // Fallback to localStorage
        // totalAmount is now subtotal (total project cost)
        const centralSubsidy = currentProducts.centralSubsidy || 0
        const stateSubsidy = currentProducts.stateSubsidy || 0
        const totalSubsidy = centralSubsidy + stateSubsidy
        const amountAfterSubsidy = totalAmount - totalSubsidy
        const discountAmount = amountAfterSubsidy * (discount / 100)
        // Final Amount: Subtotal - Subsidy (discount is not applied to final amount)
        const finalAmount = totalAmount - totalSubsidy
        
        const quotation: Quotation = {
          id: `QT-${Date.now()}`,
          customer: currentCustomer,
          products: currentProducts,
          discount,
          totalAmount, // This is now subtotal (total project cost)
          finalAmount,
          createdAt: new Date().toISOString(),
          dealerId: dealer.id,
          status: "pending",
        }

        const existing = JSON.parse(localStorage.getItem("quotations") || "[]")
        existing.push(quotation)
        localStorage.setItem("quotations", JSON.stringify(existing))
        setQuotations(existing.filter((q: Quotation) => q.dealerId === dealer.id))
        return quotation
      }
    } catch (err) {
      console.error("Error saving quotation:", err)
      const errorMessage = err instanceof ApiError ? err.message : "Failed to save quotation"
      setError(errorMessage)
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  const clearCurrent = () => {
    setCurrentCustomerState(null)
    setCurrentProductsState(null)
    if (!useApi) {
      localStorage.removeItem("currentCustomer")
      localStorage.removeItem("currentProducts")
    }
  }

  // Load quotations on mount if dealer is available
  useEffect(() => {
    if (dealer?.id) {
      loadQuotations()
    }
  }, [dealer?.id])

  return (
    <QuotationContext.Provider
      value={{
        currentCustomer,
        currentProducts,
        quotations,
        isLoading,
        error,
        setCurrentCustomer,
        setCurrentProducts,
        saveQuotation,
        loadQuotations,
        clearCurrent,
      }}
    >
      {children}
    </QuotationContext.Provider>
  )
}

export function useQuotation() {
  const context = useContext(QuotationContext)
  if (!context) {
    throw new Error("useQuotation must be used within a QuotationProvider")
  }
  return context
}
