"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"

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
  setCurrentCustomer: (customer: Customer) => void
  setCurrentProducts: (products: ProductSelection) => void
  saveQuotation: (discount: number, totalAmount: number) => Quotation
  getQuotations: (dealerId: string) => Quotation[]
  clearCurrent: () => void
}

const QuotationContext = createContext<QuotationContextType | undefined>(undefined)

export function QuotationProvider({ children }: { children: ReactNode }) {
  // Load from localStorage on mount
  const [currentCustomer, setCurrentCustomerState] = useState<Customer | null>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("currentCustomer")
      return stored ? JSON.parse(stored) : null
    }
    return null
  })
  
  const [currentProducts, setCurrentProductsState] = useState<ProductSelection | null>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("currentProducts")
      return stored ? JSON.parse(stored) : null
    }
    return null
  })
  
  const [quotations, setQuotations] = useState<Quotation[]>([])

  // Persist to localStorage when state changes
  useEffect(() => {
    if (currentCustomer) {
      localStorage.setItem("currentCustomer", JSON.stringify(currentCustomer))
    } else {
      localStorage.removeItem("currentCustomer")
    }
  }, [currentCustomer])

  useEffect(() => {
    if (currentProducts) {
      localStorage.setItem("currentProducts", JSON.stringify(currentProducts))
    } else {
      localStorage.removeItem("currentProducts")
    }
  }, [currentProducts])

  const setCurrentCustomer = (customer: Customer) => {
    setCurrentCustomerState(customer)
  }

  const setCurrentProducts = (products: ProductSelection) => {
    setCurrentProductsState(products)
  }

  const saveQuotation = (discount: number, totalAmount: number): Quotation => {
    const dealerId = JSON.parse(localStorage.getItem("dealer") || "{}").id || "unknown"
    const finalAmount = totalAmount - (totalAmount * discount) / 100

    const quotation: Quotation = {
      id: `QT-${Date.now()}`,
      customer: currentCustomer!,
      products: currentProducts!,
      discount,
      totalAmount,
      finalAmount,
      createdAt: new Date().toISOString(),
      dealerId,
      status: "pending",
    }

    const existing = JSON.parse(localStorage.getItem("quotations") || "[]")
    existing.push(quotation)
    localStorage.setItem("quotations", JSON.stringify(existing))
    setQuotations(existing)

    return quotation
  }

  const getQuotations = (dealerId: string): Quotation[] => {
    const all = JSON.parse(localStorage.getItem("quotations") || "[]")
    return all.filter((q: Quotation) => q.dealerId === dealerId)
  }

  const clearCurrent = () => {
    setCurrentCustomerState(null)
    setCurrentProductsState(null)
    localStorage.removeItem("currentCustomer")
    localStorage.removeItem("currentProducts")
  }

  return (
    <QuotationContext.Provider
      value={{
        currentCustomer,
        currentProducts,
        quotations,
        setCurrentCustomer,
        setCurrentProducts,
        saveQuotation,
        getQuotations,
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
