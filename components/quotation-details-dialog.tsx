"use client"

import { useState, useEffect } from "react"
import { type Quotation } from "@/lib/quotation-context"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Download, X, User, Phone, Mail, Home, Calendar, FileText, IndianRupee, Edit, Save, Users, MapPin, CreditCard } from "lucide-react"
import jsPDF from "jspdf"
import html2canvas from "html2canvas"
import { savePdfForDevice } from "@/lib/mobile-pdf"
import { useQuotation } from "@/lib/quotation-context"
import { api } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { VisitManagementDialog } from "@/components/visit-management-dialog"
import { useToast } from "@/hooks/use-toast"
import { CustomerDetailsForm } from "@/components/customer-details-form"
import { ProductSelectionForm } from "@/components/product-selection-form"
import type { Customer, ProductSelection } from "@/lib/quotation-context"

interface QuotationDetailsDialogProps {
  quotation: Quotation | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

// Company Information
const companyInfo = {
  name: "ChairBord Pvt. Ltd.",
  tagline: "Base of Innovation",
  /** Jaipur — head office */
  address: "Plot No. 10, Ground Floor, Shri Shyam Vihar, Kalwar Road, Jhotwara, Jaipur, Rajasthan, India - 302012",
  branches: [
    {
      label: "Ajmer",
      address:
        "2nd Floor, Miraj Cinema Mall, Gaurav Path, Apna Nagar, Vaishali Nagar, Ajmer, Rajasthan 305001",
    },
    {
      label: "Chomu",
      address: "Radha Swami Bagh, Jaipur Rd, behind MRF Showroom, Chomu, Rajasthan 303702",
    },
  ] as const,
  phone: "+91 9251666646",
  email: "info@chairbord.com",
  website: "www.chairbord.com",
  gst: "08AAJCC8097M1ZT",
  license: "MNRE/2023/CB/001234",
  logoUrl: "https://res.cloudinary.com/du0cxgoic/image/upload/v1753165862/logo_Chairbord_Solar_1_1_1_1_tnsdh8.png",
}

// Bank Details
const bankDetails = {
  icici: {
    bankName: "ICICI Bank",
    accountName: "CHAIRBORD PRIVATE LIMITED",
    accountNumber: "777705926966",
    ifscCode: "ICIC0004181",
  },
  sbi: {
    bankName: "State Bank of India",
    accountName: "CHAIRBORD PRIVATE LIMITED",
    accountNumber: "44487702699",
    ifscCode: "SBIN0032365",
  },
}

import {
  getDcrPrice,
  getNonDcrPrice,
  getBothPrice,
  determinePhase,
  calculateSystemSize,
  getPanelPrice,
  getInverterPrice,
  getStructurePrice,
  getMeterPrice,
  getCablePrice,
  getACDBPrice,
  getDCDBPrice,
  formatQuotationPhaseLabel,
} from "@/lib/pricing-tables"

// Price calculation helpers are now imported from pricing-tables.ts
// Individual component prices are only used for "customize" system type

// Get system price based on system type
const getSystemPrice = (products: any): number => {
  if (!products || !products.systemType) return 0
  
  if (products.systemType === "dcr") {
    if (!products.panelSize || !products.panelQuantity) return 0
    const systemSize = calculateSystemSize(products.panelSize, products.panelQuantity)
    if (systemSize === "0kW") return 0
    const phase = (products.phase as "1-Phase" | "3-Phase") || determinePhase(systemSize, products.inverterSize)
    const price = getDcrPrice(systemSize, phase, products.inverterSize, products.panelBrand)
    if (price !== null) return price
  } else if (products.systemType === "non-dcr") {
    if (!products.panelSize || !products.panelQuantity) return 0
    const systemSize = calculateSystemSize(products.panelSize, products.panelQuantity)
    if (systemSize === "0kW") return 0
    const phase = (products.phase as "1-Phase" | "3-Phase") || determinePhase(systemSize, products.inverterSize)
    const price = getNonDcrPrice(systemSize, phase, products.inverterSize, products.panelBrand)
    if (price !== null) return price
  } else if (products.systemType === "both") {
    const dcrSize = calculateSystemSize(products.dcrPanelSize, products.dcrPanelQuantity)
    const nonDcrSize = calculateSystemSize(products.nonDcrPanelSize, products.nonDcrPanelQuantity)
    
    // Only proceed if both sizes are valid (not "0kW")
    if (dcrSize !== "0kW" && nonDcrSize !== "0kW") {
      const dcrKw = Number.parseFloat(dcrSize.replace("kW", ""))
      const nonDcrKw = Number.parseFloat(nonDcrSize.replace("kW", ""))
      if (!Number.isNaN(dcrKw) && !Number.isNaN(nonDcrKw)) {
        const totalSystemSize = `${dcrKw + nonDcrKw}kW`
        const phase = (products.phase as "1-Phase" | "3-Phase") || determinePhase(totalSystemSize, products.inverterSize)
        const price = getBothPrice(
          totalSystemSize,
          phase,
          products.inverterSize,
          dcrSize,
          nonDcrSize,
          products.dcrPanelBrand || products.panelBrand
        )
        if (price !== null) return price
      }
    }
  }
  
  // Fallback to old calculation method
  return 0
}

// getInverterPrice is now imported from pricing-tables.ts

export function QuotationDetailsDialog({ quotation, open, onOpenChange }: QuotationDetailsDialogProps) {
  const { dealer, role } = useAuth()
  const { toast } = useToast()
  const [quotationId, setQuotationId] = useState("")
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false)
  const [fullQuotation, setFullQuotation] = useState<Quotation | null>(null)
  const [isLoadingDetails, setIsLoadingDetails] = useState(false)
  const [customerEditDialogOpen, setCustomerEditDialogOpen] = useState(false)
  const [isSavingCustomer, setIsSavingCustomer] = useState(false)
  const [visitDialogOpen, setVisitDialogOpen] = useState(false)
  const [visits, setVisits] = useState<any[]>([])
  const [isLoadingVisits, setIsLoadingVisits] = useState(false)
  const [isEditingPricing, setIsEditingPricing] = useState(false)
  const [pricingEditForm, setPricingEditForm] = useState({
    subtotal: 0,
    stateSubsidy: 0,
    centralSubsidy: 0,
    discountAmount: 0,
    finalAmount: 0,
  })
  const [isSavingPricing, setIsSavingPricing] = useState(false)
  const [systemConfigEditDialogOpen, setSystemConfigEditDialogOpen] = useState(false)
  const [isSavingSystemConfig, setIsSavingSystemConfig] = useState(false)
  const [paymentMode, setPaymentMode] = useState<string>("")
  const [isSavingPaymentMode, setIsSavingPaymentMode] = useState(false)

  const useApi = process.env.NEXT_PUBLIC_USE_API !== "false"
  const isDealer = dealer && dealer.username !== "admin"
  const isAdmin = dealer?.username === "admin" || role === "admin"
  const isAccountManagement = role === "account-management"
  // Admin can manage payments when account managers are unavailable (same as account-management)
  const canManagePayments = isAccountManagement || isAdmin

  // Payment mode options
  const paymentModes = [
    { value: "cash", label: "Cash" },
    { value: "bank_transfer", label: "Bank Transfer" },
    { value: "upi", label: "UPI" },
    { value: "cheque", label: "Cheque" },
    { value: "neft", label: "NEFT" },
    { value: "rtgs", label: "RTGS" },
    { value: "credit_card", label: "Credit Card" },
    { value: "debit_card", label: "Debit Card" },
  ]

  // Fetch full quotation details when dialog opens
  // This API call (GET /api/quotations/{quotationId}) is made for both admin and dealer views
  useEffect(() => {
    if (quotation && open) {
      // Immediately set the quotation so data is visible right away
      setFullQuotation(quotation)
      setIsLoadingDetails(true)
      
      // If using API, fetch full quotation details in the background
      if (useApi && quotation.id) {
        // Always fetch full quotation details to ensure complete data (including customer email and address)
        // This ensures admin panel and dealer panel both get complete customer data
        // API endpoint: GET http://localhost:3050/api/quotations/{quotationId}
        api.quotations.getById(quotation.id)
          .then((response) => {
            // apiRequest returns data.data, so response is already the quotation object
            const fullData = response
            if (fullData && fullData.customer) {
              // Ensure customer address is properly structured
              const customerData = fullData.customer
              const address = customerData.address || {}
              
              const updatedQuotation = {
                ...quotation,
                customer: {
                  ...(customerData.id ? { id: customerData.id } : {}),
                  firstName: customerData.firstName || quotation.customer?.firstName || "",
                  lastName: customerData.lastName || quotation.customer?.lastName || "",
                  mobile: customerData.mobile || quotation.customer?.mobile || "",
                  email: customerData.email || quotation.customer?.email || "",
                  address: {
                    street: address.street || "",
                    city: address.city || "",
                    state: address.state || "",
                    pincode: address.pincode || "",
                  },
                },
                customerId: fullData.customerId || (customerData.id ? customerData.id : undefined),
                products: fullData.products || quotation.products,
                discount: fullData.discount ?? quotation.discount,
                subtotal: fullData.subtotal ?? fullData.pricing?.subtotal ?? quotation.subtotal,
                totalAmount: fullData.pricing?.totalAmount ?? quotation.totalAmount,
                finalAmount: fullData.pricing?.finalAmount ?? fullData.finalAmount ?? quotation.finalAmount,
                remaining: fullData.remaining ?? (quotation as Quotation & { remaining?: number }).remaining,
                remainingAmount:
                  fullData.remainingAmount ??
                  (quotation as Quotation & { remainingAmount?: number }).remainingAmount,
                paymentMode: fullData.paymentMode || fullData.payment_mode || quotation.paymentMode,
                paymentStatus: fullData.paymentStatus ?? quotation.paymentStatus,
                bankName: fullData.bankName ?? fullData.bank_name ?? quotation.bankName,
                bankIfsc: fullData.bankIfsc ?? fullData.bank_ifsc ?? quotation.bankIfsc,
                dealer: fullData.dealer || quotation.dealer || null, // NEW: Include dealer information
                validUntil: fullData.validUntil || quotation.validUntil, // NEW: Include validity date
                // Store backend pricing for use in calculations
                pricing: fullData.pricing,
              } as Quotation & { pricing?: any }
              
              setFullQuotation(updatedQuotation)
            } else {
              // If API response doesn't have customer data, keep the quotation passed in
              // (already set above)
            }
          })
          .catch((error) => {
            console.error("Error loading full quotation details:", error)
            // Keep the original quotation (already set above) if API call fails
            // Don't show error toast as the data is already visible
          })
          .finally(() => {
            setIsLoadingDetails(false)
          })
      } else {
        // Not using API or no quotation ID - data already set above
        setIsLoadingDetails(false)
      }
    } else if (!open) {
      // Reset when dialog closes
      setFullQuotation(null)
      setIsLoadingDetails(false)
    }
  }, [quotation, open, useApi])

  useEffect(() => {
    if (fullQuotation) {
      setQuotationId(fullQuotation.id)
      // Initialize discount - handle both old percentage and new amount formats
      const savedDiscountValue = fullQuotation.discount || 0
      // If discount > 100, assume it's already an amount; otherwise it's a percentage (old format)
      // We'll store it as-is and calculate amount when needed
      // Initialize payment mode
      setPaymentMode(fullQuotation.paymentMode || "")
      // Initialize pricing edit form
      const products = fullQuotation.products
      const backendPricing = (fullQuotation as any).pricing
      let initialSubtotal = 0
      // NON-DCR systems should always have 0 subsidies
      let initialStateSubsidy = products.systemType === "non-dcr" ? 0 : (products.stateSubsidy ?? 0)
      let initialCentralSubsidy = products.systemType === "non-dcr" ? 0 : (products.centralSubsidy ?? 0)
      
      if (backendPricing) {
        if (backendPricing.subtotal != null && backendPricing.subtotal > 0) {
          initialSubtotal = backendPricing.subtotal
        } else if (backendPricing.totalAmount != null && backendPricing.totalAmount > 0) {
          initialSubtotal = backendPricing.totalAmount
        }
      } else {
        // Calculate from component prices or use totalAmount
        initialSubtotal = fullQuotation.totalAmount || 0
      }
      
      // Calculate discount amount from existing discount (if it was stored as percentage)
      // If discount is > 100, assume it's already an amount in INR, otherwise calculate from percentage
      let initialDiscountAmount = 0
      const savedDiscount = fullQuotation.discount || 0
      if (savedDiscount > 100) {
        // Likely already an amount in INR
        initialDiscountAmount = savedDiscount
      } else {
        // Likely a percentage, calculate amount
        const amountAfterSubsidy = initialSubtotal - (initialStateSubsidy + initialCentralSubsidy)
        initialDiscountAmount = amountAfterSubsidy * (savedDiscount / 100)
      }
      
      setPricingEditForm({
        subtotal: initialSubtotal,
        stateSubsidy: initialStateSubsidy,
        centralSubsidy: initialCentralSubsidy,
        discountAmount: initialDiscountAmount, // Now stores discount amount in INR
        finalAmount: fullQuotation.finalAmount || 0,
      })
    }
  }, [fullQuotation])

  // Load visits for the quotation
  const loadVisits = async () => {
    if (!fullQuotation) return
    setIsLoadingVisits(true)
    try {
      const response = await api.visits.getByQuotation(fullQuotation.id)
      const visitsList = response.visits || []
      setVisits(visitsList.slice(0, 3)) // Show only first 3 visits
    } catch (error) {
      console.error("Error loading visits:", error)
      setVisits([])
    } finally {
      setIsLoadingVisits(false)
    }
  }

  useEffect(() => {
    if (fullQuotation && open && useApi && isDealer) {
      loadVisits()
    }
  }, [fullQuotation?.id, open, useApi, isDealer])

  if (!quotation) return null

  // Use full quotation if available, otherwise fallback to original
  // Use fullQuotation if available, otherwise fall back to quotation
  // This ensures data is always available even if API call fails
  const displayQuotation = fullQuotation || quotation
  
  // If no quotation data at all, don't render
  if (!displayQuotation && !quotation) {
    return null
  }
  const storedDiscountValue = displayQuotation.discount || 0
  const backendPricing = (displayQuotation as any).pricing

  // Calculate prices - use backend pricing if available, otherwise calculate on frontend
  const products = displayQuotation.products
  const resolveProductPhase = (): "1-Phase" | "3-Phase" => {
    const explicitPhase = products.phase
    if (explicitPhase === "1-Phase" || explicitPhase === "3-Phase") {
      return explicitPhase
    }

    let systemSizeForPhase = ""

    if (products.systemType === "both") {
      const dcrSize = calculateSystemSize(products.dcrPanelSize || "", products.dcrPanelQuantity || 0)
      const nonDcrSize = calculateSystemSize(products.nonDcrPanelSize || "", products.nonDcrPanelQuantity || 0)
      if (dcrSize !== "0kW" && nonDcrSize !== "0kW") {
        const dcrKw = Number.parseFloat(dcrSize.replace("kW", "")) || 0
        const nonDcrKw = Number.parseFloat(nonDcrSize.replace("kW", "")) || 0
        const totalKw = dcrKw + nonDcrKw
        if (!Number.isNaN(totalKw) && totalKw > 0) {
          systemSizeForPhase = `${totalKw}kW`
        }
      }
    } else if (products.panelSize && products.panelQuantity) {
      systemSizeForPhase = calculateSystemSize(products.panelSize, products.panelQuantity)
    } else if (products.dcrPanelSize && products.dcrPanelQuantity) {
      systemSizeForPhase = calculateSystemSize(products.dcrPanelSize, products.dcrPanelQuantity)
    } else if (products.nonDcrPanelSize && products.nonDcrPanelQuantity) {
      systemSizeForPhase = calculateSystemSize(products.nonDcrPanelSize, products.nonDcrPanelQuantity)
    } else if (products.customPanels && products.customPanels.length > 0) {
      const totalKw = products.customPanels.reduce((sum, panel) => {
        const kw = Number.parseFloat(panel.size.replace("W", "")) / 1000
        return sum + (Number.isNaN(kw) ? 0 : kw * (panel.quantity || 0))
      }, 0)
      if (!Number.isNaN(totalKw) && totalKw > 0) {
        systemSizeForPhase = `${totalKw}kW`
      }
    }

    if (
      products.inverterSize &&
      systemSizeForPhase &&
      systemSizeForPhase !== "0kW"
    ) {
      return determinePhase(systemSizeForPhase, products.inverterSize)
    }

    if (products.inverterSize) {
      const inverterKw = Number.parseFloat(products.inverterSize.replace("kW", ""))
      if (!Number.isNaN(inverterKw) && inverterKw >= 7) {
        return "3-Phase"
      }
    }

    return "1-Phase"
  }

  const resolvedPhase = resolveProductPhase()
  const pdfPhaseLabel = formatQuotationPhaseLabel(resolvedPhase)
  const customer = displayQuotation.customer

  // Use backend pricing if available (aligned with backend changes)
  let panelPrice = 0
  let inverterPrice = 0
  let structurePrice = 0
  let meterPrice = 0
  let cablePrice = 0
  let acdbDcdbPrice = 0
  let batteryPrice = 0
  let subtotal = 0
  let totalSubsidy = 0
  let totalProjectCost = 0
  let totalAmount = 0
  let amountAfterSubsidy = 0
  let discountAmount = 0
  let finalAmount = 0

  if (backendPricing) {
    // Use backend pricing breakdown (aligned with backend structure)
    panelPrice = backendPricing.panelPrice ?? 0
    inverterPrice = backendPricing.inverterPrice ?? 0
    structurePrice = backendPricing.structurePrice ?? 0
    meterPrice = backendPricing.meterPrice ?? 0
    cablePrice = backendPricing.cablePrice ?? 0
    acdbDcdbPrice = backendPricing.acdbDcdbPrice ?? 0
    batteryPrice = products.batteryPrice ?? 0
    
    // Calculate subtotal from component prices if not provided, or use totalAmount
    // totalAmount represents the total project cost (subtotal) according to backend structure
    if (backendPricing.subtotal != null && backendPricing.subtotal > 0) {
      subtotal = backendPricing.subtotal
    } else if (backendPricing.totalAmount != null && backendPricing.totalAmount > 0) {
      subtotal = backendPricing.totalAmount
    } else {
      // Calculate subtotal from component prices
      subtotal = panelPrice + inverterPrice + structurePrice + meterPrice + cablePrice + acdbDcdbPrice + batteryPrice
    }
    
    // For non-dcr systems, subsidies should always be 0
    const effectiveCentralSubsidy = products.systemType === "non-dcr" ? 0 : (products.centralSubsidy ?? 0)
    const effectiveStateSubsidy = products.systemType === "non-dcr" ? 0 : (products.stateSubsidy ?? 0)
    totalSubsidy = backendPricing.totalSubsidy ?? (effectiveCentralSubsidy + effectiveStateSubsidy)
    totalProjectCost = backendPricing.totalAmount ?? subtotal
    totalAmount = backendPricing.totalAmount ?? subtotal
    amountAfterSubsidy = backendPricing.amountAfterSubsidy ?? (subtotal - totalSubsidy)
    // Discount is now stored as amount in INR, not percentage
    // Prefer discountAmount from backend, otherwise use discount field as amount (if > 100) or calculate from percentage for backward compatibility
    if (backendPricing.discountAmount != null && backendPricing.discountAmount > 0) {
      discountAmount = backendPricing.discountAmount
    } else if (storedDiscountValue > 100) {
      // If discount > 100, assume it's already an amount in INR
      discountAmount = storedDiscountValue
    } else {
      // Backward compatibility: if discount <= 100, treat as percentage for old data
      discountAmount = amountAfterSubsidy * (storedDiscountValue / 100)
    }
    finalAmount = backendPricing.finalAmount ?? (amountAfterSubsidy - discountAmount)
  } else {
    // Fallback to frontend calculation if backend pricing not available
    const systemPrice = getSystemPrice(products)
    
    // Component prices (only used for customize system type)
    structurePrice = products.structureSize ? getStructurePrice(products.structureType, products.structureSize) : 0
    meterPrice = products.meterBrand ? getMeterPrice(products.meterBrand) : 0
    cablePrice = (products.acCableBrand && products.acCableSize ? getCablePrice(products.acCableBrand, products.acCableSize, "AC") : 0) + 
                 (products.dcCableBrand && products.dcCableSize ? getCablePrice(products.dcCableBrand, products.dcCableSize, "DC") : 0)
    acdbDcdbPrice =
      (products.acdb ? getACDBPrice(products.acdb, resolvedPhase) : 0) +
      (products.dcdb ? getDCDBPrice(products.dcdb, resolvedPhase) : 0)
    batteryPrice = products.batteryPrice || 0

    // For DCR, NON DCR, and BOTH: Use set price (complete package)
    // For CUSTOMIZE: Calculate from individual component prices
    if (systemPrice > 0 && products.systemType !== "customize") {
      // Use complete set price from pricing table (includes all components)
      subtotal = systemPrice
      
      // For display purposes, estimate component prices
      panelPrice = systemPrice * 0.65 // Approximate panel portion
      inverterPrice = systemPrice * 0.20 // Approximate inverter portion
    } else {
      // For CUSTOMIZE: Calculate from individual component prices
      if (products.systemType === "both") {
        panelPrice = (getPanelPrice(products.dcrPanelBrand || "", products.dcrPanelSize || "") * (products.dcrPanelQuantity || 0)) +
          (getPanelPrice(products.nonDcrPanelBrand || "", products.nonDcrPanelSize || "") * (products.nonDcrPanelQuantity || 0))
      } else if (products.systemType === "customize") {
        panelPrice = products.customPanels?.reduce(
          (acc, panel) => acc + getPanelPrice(panel.brand, panel.size) * panel.quantity,
          0,
        ) || 0
      } else {
        panelPrice = getPanelPrice(products.panelBrand, products.panelSize) * products.panelQuantity
      }
      
      inverterPrice = getInverterPrice(products.inverterBrand, products.inverterSize)
      subtotal = panelPrice + inverterPrice + structurePrice + meterPrice + cablePrice + acdbDcdbPrice + batteryPrice
    }
    
    // For non-dcr systems, subsidies should always be 0
    const effectiveCentralSubsidy = products.systemType === "non-dcr" ? 0 : (products.centralSubsidy || 0)
    const effectiveStateSubsidy = products.systemType === "non-dcr" ? 0 : (products.stateSubsidy || 0)
    totalSubsidy = effectiveCentralSubsidy + effectiveStateSubsidy
    totalProjectCost = subtotal
    // totalAmount now represents total project cost (subtotal) - aligned with backend
    totalAmount = subtotal
    amountAfterSubsidy = subtotal - totalSubsidy
    // Discount is now stored as amount in INR, not percentage
    // If discount > 100, assume it's already an amount; otherwise treat as 0 (old percentage values)
    discountAmount = storedDiscountValue > 100 ? storedDiscountValue : 0
    finalAmount = amountAfterSubsidy - discountAmount
  }

  // Calculate quotation validity (5 days from creation)
  const quotationDate = new Date(displayQuotation.createdAt)
  const validityDate = new Date(quotationDate)
  validityDate.setDate(validityDate.getDate() + 5)

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    })
  }

  const generatePDF = async () => {
    setIsGeneratingPDF(true)

    await new Promise((resolve) => setTimeout(resolve, 200))

    const rootId = `quotation-content-${displayQuotation.id}`
    let root = document.getElementById(rootId)
    if (!root) {
      await new Promise((resolve) => setTimeout(resolve, 300))
      root = document.getElementById(`quotation-content-${quotation.id}`)
    }

    if (!root) {
      console.error("Quotation content element not found.")
      alert("Error: Could not find quotation content. Please try again.")
      setIsGeneratingPDF(false)
      return
    }

    const waitImages = (container: HTMLElement) =>
      Promise.all(
        Array.from(container.querySelectorAll("img")).map(
          (img) =>
            new Promise((resolve, reject) => {
              if (img.complete) {
                resolve(true)
              } else {
                img.onload = () => resolve(true)
                img.onerror = () => reject(new Error("Image failed to load"))
                setTimeout(() => reject(new Error("Image load timeout")), 5000)
              }
            }),
        ),
      )

    /** Capture one logical sheet so jsPDF page breaks never slice through mid-content. */
    const capturePdfSheet = async (keepSheet: "1" | "2") => {
      const temp = root!.cloneNode(true) as HTMLElement
      temp.removeAttribute("id")
      temp.style.cssText = [
        "position:fixed!important",
        "left:0!important",
        "top:0!important",
        "width:210mm!important",
        "background:#ffffff!important",
        "visibility:visible!important",
        "z-index:2147483647!important",
        "margin:0!important",
        "padding:0!important",
        "box-shadow:none!important",
        "border-radius:0!important",
      ].join(";")
      const drop = keepSheet === "1" ? "2" : "1"
      temp.querySelector(`[data-pdf-sheet="${drop}"]`)?.remove()
      document.body.appendChild(temp)
      try {
        await new Promise((resolve) => setTimeout(resolve, 80))
        await waitImages(temp)
        await new Promise((resolve) => setTimeout(resolve, 80))
        return await html2canvas(temp, {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: "#ffffff",
          allowTaint: false,
          foreignObjectRendering: false,
          onclone: (clonedDoc) => {
            try {
              clonedDoc.querySelectorAll("*").forEach((el) => {
                const htmlEl = el as HTMLElement
                if (!htmlEl?.style) return
                try {
                  const bg = htmlEl.style.backgroundColor || window.getComputedStyle(el).backgroundColor
                  if (bg && (bg.includes("lab(") || bg.includes("oklab(") || bg.includes("color("))) {
                    htmlEl.style.backgroundColor = "#ffffff"
                  }
                  const col = htmlEl.style.color || window.getComputedStyle(el).color
                  if (col && (col.includes("lab(") || col.includes("oklab(") || col.includes("color("))) {
                    htmlEl.style.color = "#000000"
                  }
                  const b = htmlEl.style.borderColor || window.getComputedStyle(el).borderColor
                  if (b && (b.includes("lab(") || b.includes("oklab(") || b.includes("color("))) {
                    htmlEl.style.borderColor = "#000000"
                  }
                } catch {
                  /* ignore */
                }
              })
            } catch (e) {
              console.warn("PDF onclone color fix:", e)
            }
          },
        })
      } finally {
        temp.remove()
      }
    }

    const addCanvasToPdf = (pdf: InstanceType<typeof jsPDF>, canvas: HTMLCanvasElement, addPageFirst: boolean) => {
      const imgData = canvas.toDataURL("image/jpeg", 0.95)
      const imgWidth = 210
      const pageHeight = 297
      const imgHeight = (canvas.height * imgWidth) / canvas.width
      let heightLeft = imgHeight
      let position = 0
      if (addPageFirst) {
        pdf.addPage()
      }
      pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight)
      heightLeft -= pageHeight
      while (heightLeft > 10) {
        position = heightLeft - imgHeight
        pdf.addPage()
        pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight)
        heightLeft -= pageHeight
      }
    }

    try {
      const canvas1 = await capturePdfSheet("1")
      const canvas2 = await capturePdfSheet("2")
      const pdf = new jsPDF("p", "mm", "a4")
      addCanvasToPdf(pdf, canvas1, false)
      addCanvasToPdf(pdf, canvas2, true)

      const customerName = `${customer?.firstName || ""}_${customer?.lastName || ""}`.replace(/\s/g, "_")
      const filename = `Quotation_${customerName}_${formatDate(quotationDate)}.pdf`
      await savePdfForDevice(pdf, filename)
    } catch (error) {
      console.error("Error generating PDF:", error)
      alert(`Error generating PDF: ${error instanceof Error ? error.message : "Unknown error"}. Please try again.`)
    } finally {
      setIsGeneratingPDF(false)
    }
  }

  // Get unique brands for Make table
  const getUniqueBrands = () => {
    if (products.systemType === "customize" && products.customPanels) {
      return Array.from(new Set(products.customPanels.map((p) => p.brand))).join(", ")
    }
    return products.panelBrand || "N/A"
  }

  const parsePanelWatts = (panelSize?: string): number => {
    if (!panelSize) return 0
    const normalized = panelSize.toLowerCase().replace(/[^0-9.]/g, "")
    const value = Number.parseFloat(normalized)
    return Number.isNaN(value) ? 0 : value
  }

  const panelSizeValues = () => {
    const sizes: number[] = []
    const add = (size?: string) => {
      const watts = parsePanelWatts(size)
      if (watts > 0) sizes.push(watts)
    }

    add(products.panelSize)
    add(products.dcrPanelSize)
    add(products.nonDcrPanelSize)
    if (products.customPanels) {
      products.customPanels.forEach((panel) => add(panel.size))
    }

    return sizes
  }

  const hasPanelBrand = (brandName: string) => {
    const brands = getUniqueBrands()
      .split(",")
      .map((brand) => brand.trim().toLowerCase())
      .filter(Boolean)
    return brands.includes(brandName.toLowerCase())
  }

  const shouldShowTopcon = () => {
    const sizes = panelSizeValues()
    if (hasPanelBrand("Waaree") && sizes.some((value) => value >= 580)) return true
    if (hasPanelBrand("Adani") && sizes.some((value) => value >= 600)) return true
    return false
  }

  const getInverterDetails = () => {
    return `${products.inverterBrand} - ${products.inverterSize}` || "N/A"
  }

  const getSystemSizes = () => {
    if (products.systemType === "both") {
      const dcrSize = products.dcrPanelSize && products.dcrPanelQuantity 
        ? `${products.dcrPanelSize} × ${products.dcrPanelQuantity}` 
        : ""
      const nonDcrSize = products.nonDcrPanelSize && products.nonDcrPanelQuantity 
        ? `${products.nonDcrPanelSize} × ${products.nonDcrPanelQuantity}` 
        : ""
      if (dcrSize && nonDcrSize) {
        return `DCR: ${dcrSize}, Non-DCR: ${nonDcrSize}`
      }
      return dcrSize || nonDcrSize || "As per selection"
    }
    if (products.systemType === "customize" && products.customPanels) {
      const sizes = products.customPanels.map((p) => `${p.size}W`).join(", ")
      return sizes || "As per selection"
    }
    return `${products.panelSize}` || "As per selection"
  }

  const toKwValue = (value?: string) => {
    if (!value) return 0
    const normalized = value.toLowerCase().trim()
    const numeric = Number.parseFloat(normalized.replace(/[^0-9.]/g, ""))
    if (Number.isNaN(numeric)) return 0
    if (normalized.includes("kw")) {
      return numeric
    }
    if (normalized.includes("w")) {
      return numeric / 1000
    }
    return numeric
  }

  const getTotalSystemKw = () => {
    if (products.systemType === "both") {
      const dcrSize = calculateSystemSize(products.dcrPanelSize || "", products.dcrPanelQuantity || 0)
      const nonDcrSize = calculateSystemSize(products.nonDcrPanelSize || "", products.nonDcrPanelQuantity || 0)
      const dcrKw = toKwValue(dcrSize)
      const nonDcrKw = toKwValue(nonDcrSize)
      return dcrKw + nonDcrKw
    }

    if (products.panelSize && products.panelQuantity) {
      const total = toKwValue(products.panelSize) * (products.panelQuantity || 0)
      if (total > 0) {
        return total
      }
    }

    if (products.systemType === "customize" && products.customPanels) {
      return products.customPanels.reduce((sum, panel) => {
        const panelKw = toKwValue(panel.size)
        return sum + panelKw * (panel.quantity || 0)
      }, 0)
    }

    if (products.inverterSize) {
      return toKwValue(products.inverterSize)
    }

    return 0
  }

  const getRoundedSystemSizeLabel = () => {
    const totalKw = getTotalSystemKw()
    if (!totalKw || Number.isNaN(totalKw)) return null
    const rounded = Math.max(1, Math.round(totalKw))
    return `${rounded}kW`
  }

  // Generate dynamic PDF title: "{systemSize}kW ({phase}) Solar System - {panelBrand} Panels"
  const getPdfSystemTitle = () => {
    const phase = resolvedPhase
  
    if (products.systemType === "both") {
      const dcrSize = calculateSystemSize(
        products.dcrPanelSize || "",
        products.dcrPanelQuantity || 0
      )
      const nonDcrSize = calculateSystemSize(
        products.nonDcrPanelSize || "",
        products.nonDcrPanelQuantity || 0
      )
  
      if (dcrSize !== "0kW" && nonDcrSize !== "0kW") {
        const dcrKw = Number.parseFloat(dcrSize.replace("kW", ""))
        const nonDcrKw = Number.parseFloat(nonDcrSize.replace("kW", ""))
  
        if (!Number.isNaN(dcrKw) && !Number.isNaN(nonDcrKw)) {
          const systemSize = `${dcrKw + nonDcrKw}kW`
          const panelBrand =
            products.dcrPanelBrand ||
            products.nonDcrPanelBrand ||
            "Solar"
  
          return `${systemSize} (${phase}) Solar System - ${panelBrand} Panels`
        }
      }
  
      return "Solar Panel System"
    }
  
    if (products.systemType === "customize") {
      return "Solar Panel System"
    }
  
    // ✅ DCR / NON-DCR
    if (products.panelSize && products.panelQuantity) {
      const systemSize = calculateSystemSize(
        products.panelSize,
        products.panelQuantity
      )
  
      if (systemSize !== "0kW") {
        const panelBrand = products.panelBrand || "Solar"
        return `${systemSize} (${phase}) Solar System - ${panelBrand} Panels`
      }
    }
  
    return "Solar Panel System"
  }
  
  const roundedSystemSizeLabel = getRoundedSystemSizeLabel()


  return (
    <>
      {/* Hidden PDF Content - Always rendered for PDF generation */}
      <div
        id={`quotation-content-${displayQuotation.id}`}
        className="quotation-pdf-root bg-white p-4 sm:p-6 rounded-lg shadow-md"
        style={{ 
          position: "fixed", 
          left: "-9999px", 
          top: "0px",
          width: "210mm",
          visibility: "hidden",
          pointerEvents: "none"
        }}
      >
        <style jsx>{`
          div.quotation-pdf-root {
            font-family: Arial, sans-serif;
            line-height: 1.4;
            color: #000;
            font-size: 12px;
            width: 210mm;
            min-height: auto;
            padding: 0;
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            background-color: #ffffff;
            position: relative;
            margin: 0;
          }

          div.quotation-pdf-root .pdf-page-content {
            position: relative;
            z-index: 1;
            background-color: #ffffff;
            padding: 15mm;
            box-sizing: border-box;
            width: 210mm;
            min-height: auto;
            display: flex;
            flex-direction: column;
            margin: 0;
          }

          div.quotation-pdf-root .pdf-page-content .pdf-footer {
            margin-top: auto;
            position: relative;
            bottom: 0;
          }

          div.quotation-pdf-root .pdf-page-inner {
            display: flex;
            flex-direction: column;
            flex: 0 1 auto;
            min-height: min-content;
            width: 100%;
          }

          div.quotation-pdf-root [data-pdf-sheet] {
            width: 100%;
            display: flex;
            flex-direction: column;
            align-items: stretch;
          }

          .pdf-header {
            background: #ebecf0;
            color: black;
            padding: 15px 20px;
            border-radius: 8px;
            margin-bottom: 15px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }

          .pdf-company-logo img {
            height: 40px;
            width: auto;
            object-fit: contain;
          }

          .pdf-quotation-info {
            text-align: right;
            font-size: 11px;
          }

          .pdf-quotation-info div {
            margin-bottom: 3px;
          }

          .pdf-quotation-title {
            text-align: center;
            font-size: 15px;
            font-weight: bold;
            color: #ff8c00;
            margin-bottom: 20px;
            padding: 7px;
            padding-bottom: 15px;
            background: linear-gradient(90deg, #fff8e1, #ffe0b2, #fff8e1);
            border-radius: 6px;
          }

          .pdf-info-section {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
            margin-bottom: 15px;
          }

          .pdf-info-card {
            background: #f8fafc;
            padding: 12px;
            border-radius: 6px;
            border-left: 4px solid #ff8c00;
          }

          .pdf-info-card h3 {
            color: #ff8c00;
            font-size: 15px;
            margin-bottom: 8px;
            font-weight: bold;
          }

          .pdf-info-item {
            font-size: 12px;
            margin-bottom: 4px;
            display: flex;
          }

          .pdf-info-item strong {
            min-width: 65px;
            color: #374151;
          }

          .pdf-products-section {
            flex: 0 1 auto;
            display: grid;
            grid-template-columns: 1fr;
            gap: 10px;
            margin-bottom: 12px;
          }

          .pdf-product-category {
            background: #f9fafb;
            border-radius: 8px;
            padding: 10px;
            border: 1px solid #e5e7eb;
            position: relative;
            overflow: hidden;
          }

          .pdf-category-header {
            background: linear-gradient(90deg, #ff8c00, #e67300);
            color: white;
            padding: 6px 10px;
            border-radius: 6px;
            font-weight: bold;
            font-size: 11px;
            margin-bottom: 8px;
            padding-bottom: 10px;
            text-align: center;
          }

          .pdf-product-item {
            background: transparent;
            padding: 6px;
            border-radius: 4px;
            margin-bottom: 6px;
            border-left: 3px solid #10b981;
            box-shadow: 0 0 0 rgba(0, 0, 0, 0.1);
          }

          .pdf-product-name {
            font-weight: bold;
            font-size: 11px;
            color: #1f2937;
            margin-bottom: 4px;
            line-height: 1.2;
          }

          .pdf-product-details {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            font-size: 10px;
            gap: 4px;
          }

          .pdf-product-specs {
            color: #6b7280;
            line-height: 1.2;
            font-size: 10px;
          }
          .pdf-system-size-label {
            font-size: 12px;
            font-weight: 600;
            color: #111827;
          }

          .pdf-bank-details-section {
            background: #f8fafc;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            padding: 15px;
            margin-bottom: 15px;
          }

          .pdf-bank-details-section h3 {
            font-size: 15px;
            color: #ff8c00;
            margin-bottom: 10px;
            font-weight: bold;
            text-align: center;
          }

          .pdf-bank-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px 20px;
            font-size: 11px;
          }

          .pdf-bank-item strong {
            color: #374151;
            min-width: 70px;
            display: inline-block;
          }

          .pdf-bank-item {
            margin-bottom: 5px;
          }

          .pdf-summary-section {
            background: linear-gradient(135deg, #f3f4f6, #e5e7eb);
            padding: 15px;
            border-radius: 8px;
            border: 2px solid #ff8c00;
          }

          .pdf-summary-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
            font-size: 12px;
            line-height: 1.4;
          }

          .pdf-summary-row.total {
            font-weight: bold;
            font-size: 15px;
            color: #ff8c00;
            border-top: 2px solid #ff8c00;
            padding-top: 10px;
            margin-top: 10px;
          }

          .pdf-summary-row.price-after-subsidy {
            background: #fff3e0;
            padding: 8px 12px;
            border-radius: 6px;
            padding-bottom: 20px;
            font-size: 14px;
            font-weight: bold;
            color: #000;
            margin-top: 10px;
            border: 1px solid #ffcc80;
          }

          .pdf-summary-label {
            flex: 1;
            text-align: left;
          }

          .pdf-summary-value {
            flex: 0 0 auto;
            text-align: right;
            min-width: 80px;
          }

          .pdf-footer {
            text-align: center;
            color: #6b7280;
            background: #f9fafb;
            padding: 10px;
            border-radius: 6px;
            border-top: 2px solid #ff8c00;
            width: 100%;
            box-sizing: border-box;
          }

          .pdf-footer p {
            margin-bottom: 3px;
            line-height: 1.3;
          }

          .pdf-footer .signature {
            margin-top: 5px;
            font-weight: bold;
          }

          .pdf-footer .contact-info {
            margin-top: 8px;
            padding-top: 5px;
            border-top: 1px solid #ff8c00;
            line-height: 1.2;
          }

          .pdf-footer-page1 {
            font-size: 10px;
          }

          .pdf-footer-page1 p {
            margin-bottom: 4px;
            line-height: 1.3;
          }

          .pdf-footer-page1 .signature {
            margin-top: 8px;
            font-weight: bold;
            font-size: 13px;
          }

          .pdf-footer-page1 .contact-info {
            margin-top: 10px;
            padding-top: 8px;
            line-height: 1.3;
          }

          .pdf-footer-page2 {
            font-size: 10px;
          }

          .pdf-footer-page2 p {
            margin-bottom: 3px;
            line-height: 1.2;
          }

          .pdf-footer-page2 .signature {
            margin-top: 8px;
            font-weight: bold;
            font-size: 10px;
          }

          .pdf-footer-page2 .contact-info {
            margin-top: 12px;
            padding-top: 8px;
            line-height: 1.2;
          }

          .pdf-validity-box {
            background: linear-gradient(135deg, #fef3c7, #fde68a);
            border: 2px solid #f59e0b;
            padding: 8px;
            border-radius: 6px;
            text-align: center;
            font-size: 11px;
            font-weight: bold;
            padding-bottom: 13px;
            color: #92400e;
            margin-bottom: 15px;
          }

          .pdf-terms-section {
            background: #f8fafc;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            padding: 10px;
            margin-bottom: 15px;
          }

          .pdf-terms-section .term-point {
            margin-bottom: 1px;
          }

          .pdf-terms-section .term-point strong {
            font-size: 11px;
            color: #ff8c00;
            display: block;
            margin-bottom: 1px;
          }

          .pdf-terms-section .term-point div {
            padding-left: 8px;
          }

          .pdf-terms-section .term-point div div {
            margin-bottom: 0px;
            line-height: 1.2;
          }
          .terms-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 10px;
          }
          .terms-table td {
            border: 1px solid #e5e7eb;
            padding: 6px 8px;
            vertical-align: middle;
            background: #ffffff;
          }
          .terms-label {
            width: 140px;
            background: #f3f4f6;
            color: #1f2933;
            font-weight: 700;
            text-align: center;
            font-size: 11px;
            letter-spacing: 0.05em;
          }
          .terms-content strong {
            font-size: 12px;
            color: #ff8c00;
            display: block;
            margin-bottom: 0;
          }
          .terms-content p {
            margin: 0 0 1px;
            line-height: 1.2;
          }
          .terms-content ul {
            margin: 0;
            padding-left: 14px;
          }
          .terms-content li {
            line-height: 1.2;
          }
          .structure-sizes {
            margin-top: 4px;
            display: flex;
            flex-direction: column;
            gap: 2px;
            line-height: 1.2;
          }

          .make-table {
            width: 100%;
            table-layout: fixed;
            border-collapse: collapse;
            font-size: 10px;
            font-family: Arial, sans-serif;
            font-weight: normal;
            border: 1px solid #6b7280;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
            text-rendering: optimizeLegibility;
          }

          .make-table td,
          .make-table th {
            border: 1px solid #6b7280;
            padding: 2px 6px 14px 6px;
            background: #ffffff;
            text-align: left;
            vertical-align: top;
            font-family: Arial, sans-serif;
            font-weight: normal;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
            text-rendering: optimizeLegibility;
            line-height: 0.4;
            word-break: break-word;
            overflow-wrap: break-word;
            white-space: normal;
          }

          .make-table tr:nth-child(even) {
            background-color: #f9fafb;
          }

          .make-table td:first-child,
          .make-table th:first-child {
            width: 40%;
            text-align: left;
            font-weight: 200;
          }

          .make-table td:nth-child(2),
          .make-table th:nth-child(2) {
            width: 60%;
            text-align: left;
          }

          .make-table .label-cell {
            width: 150px;
            white-space: nowrap;
            font-weight: 300;
          }

          .pdf-rendering-styles .hide-on-pdf {
            display: none !important;
          }
        `}</style>

        {/* Sheet 1 + 2 are captured separately for PDF so page breaks never cut through footer text */}
        <div data-pdf-sheet="1">
        {/* Page 1: Main Quotation Content */}
        <div className="pdf-page-content">
          <div className="pdf-page-inner">
            {/* Header */}
            <div className="pdf-header" style={{ marginTop: "-31px" }}>
              <div className="pdf-company-logo">
                <img
                  src={companyInfo.logoUrl || "/placeholder.svg"}
                  alt="ChairBord Solar Logo"
                  style={{ height: "40px", objectFit: "contain" }}
                />
              </div>
              <div className="pdf-quotation-info" style={{ marginTop: "-12px" }}>
                <div>
                  <strong>Quotation #{displayQuotation.id}</strong>
                </div>
                <div>📅 Date: {formatDate(quotationDate)}</div>
                <div>⏰ Valid Until: {formatDate(validityDate)}</div>
              </div>
            </div>

            {/* Title */}
            <div className="pdf-quotation-title" style={{ marginTop: "-10px" }}>🌞 SOLAR INSTALLATION QUOTATION 🌞</div>

            {/* Info Section - 2 columns */}
            <div className="pdf-info-section" style={{ marginTop: "-10px" }}>
              <div className="pdf-info-card">
                <h3>👤 Customer Details</h3>
                <div className="pdf-info-item">
                  <strong>Name:</strong> {customer?.firstName || ""} {customer?.lastName || ""}
                </div>
                <div className="pdf-info-item">
                  <strong>Email:</strong> {customer?.email || ""}
                </div>
                <div className="pdf-info-item">
                  <strong>Phone:</strong> {customer?.mobile || ""}
                </div>
                <div className="pdf-info-item">
                  <strong>Location:</strong> {customer.address?.city || ""}, {customer.address?.state || ""}
                </div>
              </div>
              <div className="pdf-info-card">
                <h3>🏢 Dealer Details</h3>
                <div className="pdf-info-item">
                  <strong>Company:</strong> {companyInfo.name}
                </div>
                <div className="pdf-info-item">
                  <strong>Contact:</strong> {companyInfo.phone}
                </div>
                <div className="pdf-info-item">
                  <strong>Email:</strong> {companyInfo.email}
                </div>
                <div className="pdf-info-item" style={{ flexDirection: "column", alignItems: "flex-start", gap: "6px" }}>
                  <strong>Offices:</strong>
                  <div style={{ lineHeight: 1.35 }}>
                    <div style={{ marginBottom: "4px" }}>
                      <strong>Jaipur (Head Office):</strong> {companyInfo.address}
                    </div>
                    {companyInfo.branches.map((b) => (
                      <div key={b.label} style={{ marginBottom: "4px" }}>
                        <strong>{b.label}:</strong> {b.address}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Products Section */}
            <div className="pdf-products-section" style={{ marginTop: "-10px" }}>
              <div className="pdf-product-category">
                <div className="pdf-category-header">📦 SOLAR SETS</div>
                
                {/* System size label (BOTH shows size inside the two-column row below) */}
                {products.systemType !== "both" && roundedSystemSizeLabel && (
                  <div className="pdf-system-size-label mb-2">System Size: {roundedSystemSizeLabel}</div>
                )}
                {/* BOTH: left = system size + DCR, then Non-DCR below; right = common components */}
                {products.systemType === "both" ? (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "row",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      gap: "12px",
                      marginBottom: "8px",
                    }}
                  >
                    <div style={{ flex: "1 1 52%", minWidth: 0 }}>
                      <div className="pdf-product-name" style={{ marginBottom: "4px" }}>
                        Solar panels (DCR + Non-DCR)
                      </div>
                      {roundedSystemSizeLabel && (
                        <div className="pdf-system-size-label" style={{ marginBottom: "6px" }}>
                          System Size: {roundedSystemSizeLabel}
                        </div>
                      )}
                      <div className="pdf-product-specs" style={{ lineHeight: 1.45 }}>
                        {products.dcrPanelBrand && products.dcrPanelSize && products.dcrPanelQuantity && (
                          <div>
                            <strong>DCR (with subsidy):</strong> {products.dcrPanelBrand} {products.dcrPanelSize} ×{" "}
                            {products.dcrPanelQuantity}
                            <span style={{ fontSize: "10px", color: "#666" }}>
                              {" "}
                              (
                              {(
                                (Number.parseFloat(products.dcrPanelSize.replace("W", "")) * products.dcrPanelQuantity) /
                                1000
                              ).toFixed(2)}
                              kW)
                            </span>
                          </div>
                        )}
                        {products.nonDcrPanelBrand && products.nonDcrPanelSize && products.nonDcrPanelQuantity && (
                          <div style={{ marginTop: "4px" }}>
                            <strong>Non-DCR (without subsidy):</strong> {products.nonDcrPanelBrand}{" "}
                            {products.nonDcrPanelSize} × {products.nonDcrPanelQuantity}
                            <span style={{ fontSize: "10px", color: "#666" }}>
                              {" "}
                              (
                              {(
                                (Number.parseFloat(products.nonDcrPanelSize.replace("W", "")) *
                                  products.nonDcrPanelQuantity) /
                                1000
                              ).toFixed(2)}
                              kW)
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div
                      style={{
                        flex: "1 1 44%",
                        minWidth: 0,
                        borderLeft: "1px solid #e5e7eb",
                        paddingLeft: "10px",
                      }}
                    >
                      <div className="pdf-product-name" style={{ marginBottom: "4px" }}>
                        Common Components
                      </div>
                      <div className="pdf-product-specs">
                        Inverter: {products.inverterBrand} {products.inverterType} ({products.inverterSize})
                        <br />
                        Phase: {pdfPhaseLabel}
                        {products.structureType && (
                          <>
                            <br />
                            Structure: {products.structureType} ({products.structureSize})
                          </>
                        )}
                        {products.meterBrand && (
                          <>
                            <br />
                            Meter: {products.meterBrand}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  /* For DCR, NON DCR, or CUSTOMIZE system types */
                  <div className="pdf-product-item">
                    <div className="pdf-product-name">{getPdfSystemTitle()}</div>
                    <div className="pdf-product-details">
                    <div className="pdf-product-specs">
                      {products.systemType !== "customize"
                        ? `${products.panelBrand} ${products.panelSize} × ${products.panelQuantity}`
                        : products.customPanels
                            ?.map((p) => `${p.brand} ${p.size} × ${p.quantity}`)
                            .join(", ") || "N/A"}
                      <br />
    
                      <div>
                        Inverter: {products.inverterBrand} {products.inverterType} ({products.inverterSize})
                        <br />
                        Phase: {pdfPhaseLabel}
                        {products.structureType && (
                          <>
                            <br />
                            Structure: {products.structureType} ({products.structureSize})
                          </>
                        )}
                      </div>
                        {/* {products.meterBrand && (
                          <>
                            <br />
                            Meter: {products.meterBrand}
                          </>
                        )}
                        {products.acCableBrand && (
                          <>
                            <br />
                            AC Cable: {products.acCableBrand} {products.acCableSize}, DC Cable: {products.dcCableBrand}{" "}
                            {products.dcCableSize}
                          </>
                        )}
                        {(products.acdb || products.dcdb) && (
                          <>
                            <br />
                            ACDB/DCDB: {products.acdb ? "Havells" : ""} {products.dcdb ? "Havells" : ""}
                          </>
                        )}
                        {products.batteryCapacity && (
                          <>
                            <br />
                            Battery: {products.batteryCapacity}
                          </>
                        )} */}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Summary Section */}
            <div className="pdf-summary-section">
            <div className="pdf-summary-row price-after-subsidy">
                <span className="pdf-summary-label">💰 Total Project Cost (including GST and structure):</span>
                <span className="pdf-summary-value">₹{subtotal.toLocaleString()}</span>
              </div>
              {/* NON-DCR systems should not display subsidies in PDF */}
              {products.systemType !== "non-dcr" && (products.stateSubsidy ?? 0) > 0 && (
                <div className="pdf-summary-row">
                  <span className="pdf-summary-label">⬇️ State Subsidy:</span>
                  <span className="pdf-summary-value"> ₹{(products.stateSubsidy ?? 0).toLocaleString()}</span>
                </div>
              )}
              {/* NON-DCR systems should not display subsidies in PDF */}
              {products.systemType !== "non-dcr" && products.centralSubsidy && products.centralSubsidy > 0 && (
                <div className="pdf-summary-row">
                  <span className="pdf-summary-label">⬇️ Central Subsidy:</span>
                  <span className="pdf-summary-value"> ₹{products.centralSubsidy.toLocaleString()}</span>
                </div>
              )}
              {discountAmount > 0 && (
                <div className="pdf-summary-row">
                  <span className="pdf-summary-label">⬇️ Discount:</span>
                  <span className="pdf-summary-value"> ₹{discountAmount.toLocaleString()}</span>
                </div>
              )}
              <div className="pdf-summary-row">
                <span className="pdf-summary-label">🎯 Final Price:</span>
                <span className="pdf-summary-value">₹{finalAmount.toLocaleString()}</span>
              </div>
            </div>

            {/* Bank Details Section */}
            <div className="pdf-bank-details-section">
              <h3>🏦 Bank Details for Payment</h3>
              <div className="pdf-bank-grid">
                <div>
                  <div className="pdf-bank-item">
                    <strong>Bank:</strong> {bankDetails.icici.bankName}
                  </div>
                  <div className="pdf-bank-item">
                    <strong>A/C Name:</strong> {bankDetails.icici.accountName}
                  </div>
                  <div className="pdf-bank-item">
                    <strong>A/C No:</strong> {bankDetails.icici.accountNumber}
                  </div>
                  <div className="pdf-bank-item">
                    <strong>IFSC:</strong> {bankDetails.icici.ifscCode}
                  </div>
                </div>
                <div>
                  <div className="pdf-bank-item">
                    <strong>Bank:</strong> {bankDetails.sbi.bankName}
                  </div>
                  <div className="pdf-bank-item">
                    <strong>A/C Name:</strong> {bankDetails.sbi.accountName}
                  </div>
                  <div className="pdf-bank-item">
                    <strong>A/C No:</strong> {bankDetails.sbi.accountNumber}
                  </div>
                  <div className="pdf-bank-item">
                    <strong>IFSC:</strong> {bankDetails.sbi.ifscCode}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer for Page 1 */}
          <div className="pdf-footer pdf-footer-page1">
            <p>
              <strong>🙏 Thanking you and assuring you of our best and prompt attention at all times, we remain.</strong>
            </p>
            <div className="signature">
              <p>
                <strong>Yours faithfully,</strong>
              </p>
              <p>
                <strong>For, {companyInfo.name}</strong>
              </p>
            </div>
            <div className="contact-info">
              <p>
                <strong>Jaipur (Head Office):</strong> {companyInfo.address}
              </p>
              {companyInfo.branches.map((b) => (
                <p key={b.label}>
                  <strong>{b.label}:</strong> {b.address}
                </p>
              ))}
              <p>
                <strong>Mobile:</strong> {companyInfo.phone} | <strong>GSTIN:</strong> {companyInfo.gst}
              </p>
            </div>
          </div>
        </div>
        </div>

        <div data-pdf-sheet="2">
        {/* Page 2: Terms & Conditions */}
        <div className="pdf-page-content">
          <div className="pdf-page-inner">
            {/* Header for Page 2 */}
            <div className="pdf-header" style={{ marginTop: "-15px" }}>
              <div className="pdf-company-logo">
                <img
                  src={companyInfo.logoUrl || "/placeholder.svg"}
                  alt="ChairBord Solar Logo"
                  style={{ height: "40px", objectFit: "contain" }}
                />
              </div>
              <div className="pdf-quotation-info" style={{ marginTop: "-12px" }}>
                <div>
                  <strong>Quotation #{displayQuotation.id}</strong>
                </div>
                <div>📅 Date: {formatDate(quotationDate)}</div>
                <div>📋 Page 2 of 2</div>
              </div>
            </div>

            {/* Title for Page 2 */}
            <div className="pdf-quotation-title" style={{ marginTop: "-10px" }}>📋 TERMS & CONDITIONS</div>

            {/* Terms & Conditions Content */}
            <div
              className="pdf-terms-section"
              style={{
                marginBottom: 0,
                maxHeight: "none",
                overflow: "visible",
                marginTop: "-15px",
              }}
            >
              <table className="terms-table terms-table-tight">
                <tbody>
                  <tr>
                    <td className="terms-label">
                      <span>MAKE</span>
                    </td>
                    <td className="terms-content">
                      <table className="make-table">
                        <tbody>
                          <tr>
                            <td className="label-cell">• Solar Module</td>
                            <td>
                              <div>
                                {getUniqueBrands()} Bifacial{shouldShowTopcon() ? " Topcon" : ""} Panels
                              </div>
                            </td>
                          </tr>
                          <tr>
                            <td className="label-cell">• GTI Inverter</td>
                            <td>{getInverterDetails()}</td>
                          </tr>
                          <tr>
                            <td className="label-cell">• Solar Set Size</td>
                            <td>{getSystemSizes()}</td>
                          </tr>
                          <tr>
                            <td className="label-cell">• DC Cable</td>
                            <td>
                              {(products.dcCableBrand || "Polycab") +
                                (products.dcCableSize ? ` (${products.dcCableSize})` : " (4 sq.mm)")}
                            </td>
                          </tr>
                          <tr>
                            <td className="label-cell">• AC Cable</td>
                            <td>
                              {(products.acCableBrand || "Polycab") +
                                (products.acCableSize ? ` (${products.acCableSize})` : " (6 sq.mm)")}
                            </td>
                          </tr>
                          <tr>
                            <td className="label-cell">• Structure</td>
                            <td>
                              <div>Tata GI Structure & Tata GI Pipes(2mm)</div>
                              <div className="structure-sizes">
                                <span>Leg-72*72</span>
                                <span>Rafter-60*40</span>
                                <span>Parlin-40*40</span>
                              </div>
                            </td>
                          </tr>
                          <tr>
                            <td className="label-cell">• Lightning Arrester & Earthing</td>
                            <td>Standard make/ JMP/ Polycab Green Earthing Wire</td>
                          </tr>
                          <tr>
                            <td className="label-cell">• ACDB & DCDB</td>
                            <td>Standard make with Havells MCB</td>
                          </tr>
                          <tr>
                            <td className="label-cell">• Meter (Solar + Net)</td>
                            <td>HPL, Genus, Secure, L&T, etc.</td>
                          </tr>
                        </tbody>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td className="terms-label">
                      <span>PAYMENT</span>
                    </td>
                    <td className="terms-content" style={{ marginTop: "-10px" }}>
                      <p>Inverter and Other Items</p>
                      <p>100% mobilization advance against Work Order</p>
                    </td>
                  </tr>
                  <tr>
                    <td className="terms-label">
                      <span>PROJECT</span>
                    </td>
                    <td className="terms-content">
                      <p>
                        Project installation begins once payment milestones are met, and after installation it takes 15–20 days to complete the metering process.
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td className="terms-label">
                      <span>VALIDITY</span>
                    </td>
                    <td className="terms-content">
                      <p>5 days from the date of offer. After this period, confirmation must be obtained.</p>
                    </td>
                  </tr>
                  <tr>
                    <td className="terms-label">
                      <span>CLIENT</span>
                    </td>
                    <td className="terms-content">
                      <ul>
                        <li>• Cleaning of solar modules is under the client&apos;s scope</li>
                        <li>• Rooftop to be arranged and provided by the client</li>
                        <li>• Electricity and water must be provided by the client during construction</li>
                        <li>• Provide safe storage space for materials used in the solar power plant</li>
                        <li>• Ensure electricity supply is available to synchronize the inverter during and after commissioning</li>
                        <li>• Provide connection space in the LT panel to connect the inverter output</li>
                        <li>• Internet connection to be provided by the client for remote monitoring of the system</li>
                      </ul>
                    </td>
                  </tr>
                  <tr>
                    <td className="terms-label">
                      <span>TRANSPORT</span>
                    </td>
                    <td className="terms-content">
                      <p>All transportation of the above-mentioned Bill of Materials (BOM) up to the installation site is included.</p>
                    </td>
                  </tr>
                  <tr>
                    <td className="terms-label">
                      <span>NET METER</span>
                    </td>
                    <td className="terms-content">
                      <p>
                        All government DISCOM fees (file charges, demand charges, testing for net metering, and arrangement
                        of Electrical Inspector Report) shall be paid directly to DISCOM and will be under the client&apos;s scope.
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td className="terms-label">
                      <span>WARRANTY</span>
                    </td>
                    <td className="terms-content">
                      <ul>
                        <li>• 5-year comprehensive system warranty</li>
                        <li>• Solar module performance warranty: 30 years</li>
                        <li>• Solar grid-tie inverter warranty: 10 years (as per manufacturer&apos;s terms & conditions)</li>
                      </ul>
                    </td>
                  </tr>
                  <tr>
                    <td className="terms-label">
                      <span>SUBSIDY</span>
                    </td>
                    <td className="terms-content">
                      <p>
                        The quoted price excludes any subsidies, incentives, or rebates. The full package cost will be charged
                        as per the terms outlined, with subsidies to be applied for separately by the customer.
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td className="terms-label">
                      <span>PAYMENT TERMS</span>
                    </td>
                    <td className="terms-content">
                      <ul>
                        <li>• Token Money (Cash/UPI/Netbanking): 10-20% of total system cost to secure the contract and cover initial costs (design, permits, equipment ordering).</li>
                        <li>• For Loan : 70% of the system cost must be cleared before installation work starts, with the remaining 30% payable after installation.</li>
                        <li>• Material Delivery: Once 70% is paid, equipment is dispatched to the site and installation must start within 7-10 days.</li>
                        <li>• Metering & Closure: After successful installation, only 10% remains and rest of the amount must be cleared before metering work and commissioning finalize.</li>
                      </ul>
                    </td>
                  </tr>
                  <tr>
                    <td className="terms-label">
                      <span>PANELS</span>
                    </td>
                    <td className="terms-content">
                      <p>
                        Panels will vary depending on stock availability at the time of order confirmation.
                      </p>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Footer for Page 2 */}
          <div className="pdf-footer pdf-footer-page2">
            <p>
              <strong>🙏 Thanking you and assuring you of our best and prompt attention at all times, we remain.</strong>
            </p>
            <div className="signature">
              <p>
                <strong>Yours faithfully,</strong>
              </p>
              <p>
                <strong>For, {companyInfo.name}</strong>
              </p>
            </div>
            <div className="contact-info">
              <p>
                <strong>Jaipur (Head Office):</strong> {companyInfo.address}
              </p>
              {companyInfo.branches.map((b) => (
                <p key={b.label}>
                  <strong>{b.label}:</strong> {b.address}
                </p>
              ))}
              <p>
                <strong>Mobile:</strong> {companyInfo.phone} | <strong>GSTIN:</strong> {companyInfo.gst}
              </p>
            </div>
          </div>
        </div>
        </div>
      </div>

      {/* Dialog for viewing quotation details */}
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl">Quotation Details - {displayQuotation.id}</DialogTitle>
            <DialogDescription className="text-sm">
              View quotation details and download PDF
            </DialogDescription>
          </DialogHeader>

          {isLoadingDetails ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-muted-foreground">Loading quotation details...</p>
            </div>
          ) : (
            <div className="space-y-3 sm:space-y-4">
              {/* Customer Info */}
              <Card className="border-primary/20">
              <CardHeader className="bg-primary/5 p-3 sm:p-6">
                <CardTitle className="text-base sm:text-lg flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                    Customer Information
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCustomerEditDialogOpen(true)}
                    className="h-8"
                  >
                    <Edit className="w-3 h-3 mr-1" />
                    Edit
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 sm:space-y-3 pt-3 sm:pt-4 p-3 sm:p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-start gap-3">
                      <User className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Full Name</p>
                        <p className="text-sm font-semibold">
                          {customer?.firstName || ""} {customer?.lastName || ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Phone className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Phone Number</p>
                        <a
                          href={`tel:${customer?.mobile || ""}`}
                          className="text-sm font-semibold text-primary hover:underline"
                          title="Click to call"
                        >
                          {customer?.mobile || ""}
                        </a>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Mail className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Email Address</p>
                        <a
                          href={`mailto:${customer?.email || ""}`}
                          className="text-sm font-semibold text-primary hover:underline"
                          title="Click to send email"
                        >
                          {customer?.email || ""}
                        </a>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Home className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-xs text-muted-foreground mb-1">Complete Address</p>
                        <p className="text-sm font-medium">
                          {customer.address?.street || ""}
                          <br />
                          {customer.address?.city || ""}, {customer.address?.state || ""}
                          <br />
                          PIN: {customer.address?.pincode || ""}
                        </p>
                      </div>
                    </div>
                  </div>
              </CardContent>
            </Card>


            {/* System Configuration */}
            <Card>
              <CardHeader className="bg-muted/50">
                <CardTitle className="text-lg flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-primary" />
                    System Configuration
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSystemConfigEditDialogOpen(true)}
                    className="h-8"
                  >
                    <Edit className="w-3 h-3 mr-1" />
                    Edit
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 pt-4">
                <>
                  <div>
                    <span className="font-semibold">System Type: </span>
                    <span className="uppercase">{products.systemType}</span>
                  </div>
                    {products.systemType === "both" ? (
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                        <div className="min-w-0 flex-1 space-y-1 text-sm">
                          <span className="font-semibold block">Panels (BOTH)</span>
                          {roundedSystemSizeLabel && (
                            <p className="text-sm text-muted-foreground">System Size: {roundedSystemSizeLabel}</p>
                          )}
                          {products.dcrPanelBrand && products.dcrPanelSize && products.dcrPanelQuantity && (
                            <p className="font-medium">
                              <span className="text-muted-foreground">DCR (subsidy)</span>{" "}
                              {products.dcrPanelBrand} {products.dcrPanelSize} × {products.dcrPanelQuantity}
                              <span className="text-xs text-muted-foreground ml-1">
                                (
                                {(
                                  (Number.parseFloat(products.dcrPanelSize.replace("W", "")) *
                                    products.dcrPanelQuantity) /
                                  1000
                                ).toFixed(2)}
                                kW)
                              </span>
                            </p>
                          )}
                          {products.nonDcrPanelBrand && products.nonDcrPanelSize && products.nonDcrPanelQuantity && (
                            <p className="font-medium">
                              <span className="text-muted-foreground">Non-DCR</span>{" "}
                              {products.nonDcrPanelBrand} {products.nonDcrPanelSize} × {products.nonDcrPanelQuantity}
                              <span className="text-xs text-muted-foreground ml-1">
                                (
                                {(
                                  (Number.parseFloat(products.nonDcrPanelSize.replace("W", "")) *
                                    products.nonDcrPanelQuantity) /
                                  1000
                                ).toFixed(2)}
                                kW)
                              </span>
                            </p>
                          )}
                        </div>
                        <div className="sm:border-l sm:border-border sm:pl-4 min-w-0 sm:max-w-[55%] space-y-1 text-sm">
                          <span className="font-semibold block">Common components</span>
                          <div>
                            <span className="font-semibold">Inverter: </span>
                            {products.inverterBrand} {products.inverterType} ({products.inverterSize})
                          </div>
                          {products.structureType && (
                            <div>
                              <span className="font-semibold">Structure: </span>
                              {products.structureType} ({products.structureSize})
                            </div>
                          )}
                          {products.meterBrand && (
                            <div>
                              <span className="font-semibold">Meter: </span>
                              {products.meterBrand}
                            </div>
                          )}
                        </div>
                      </div>
                    ) : products.systemType !== "customize" ? (
                      <div>
                        <span className="font-semibold">Panels: </span>
                        {products.panelBrand} {products.panelSize} × {products.panelQuantity}
                      </div>
                    ) : (
                      products.customPanels?.map((panel, index) => (
                        <div key={index}>
                          <span className="font-semibold">Panel {index + 1}: </span>
                          {panel.brand} {panel.size} × {panel.quantity}
                        </div>
                      ))
                    )}
                    {products.systemType !== "both" && (
                      <>
                        <div>
                          <span className="font-semibold">Inverter: </span>
                          {products.inverterBrand} {products.inverterType} ({products.inverterSize})
                        </div>
                        {products.structureType && (
                          <div>
                            <span className="font-semibold">Structure: </span>
                            {products.structureType} ({products.structureSize})
                          </div>
                        )}
                        {products.meterBrand && (
                          <div>
                            <span className="font-semibold">Meter: </span>
                            {products.meterBrand}
                          </div>
                        )}
                      </>
                    )}
                    {products.batteryCapacity && (
                      <div>
                        <span className="font-semibold">Battery: </span>
                        {products.batteryCapacity}
                      </div>
                    )}
                </>
              </CardContent>
            </Card>

            {/* Pricing Summary */}
            <Card>
              <CardHeader className="bg-muted/50">
                <CardTitle className="text-lg flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <IndianRupee className="w-5 h-5 text-primary" />
                    Pricing Summary
                  </div>
                  {!isEditingPricing && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsEditingPricing(true)}
                      className="h-8"
                    >
                      <Edit className="w-3 h-3 mr-1" />
                      Edit
                    </Button>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 pt-4">
                {isEditingPricing ? (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Subtotal (₹)</Label>
                      <Input
                        type="number"
                        min="0"
                        value={pricingEditForm.subtotal || ""}
                        onChange={(e) => {
                          const value = Number.parseFloat(e.target.value) || 0
                          const newSubtotal = value
                          const totalSubsidy = pricingEditForm.stateSubsidy + pricingEditForm.centralSubsidy
                          const amountAfterSubsidy = newSubtotal - totalSubsidy
                          // Discount is now stored as amount in INR, not percentage
                          const discountAmount = pricingEditForm.discountAmount || 0
                          // Ensure discount doesn't exceed amount after subsidy
                          const maxDiscount = Math.max(0, amountAfterSubsidy)
                          const validDiscount = Math.min(discountAmount, maxDiscount)
                          const newFinalAmount = amountAfterSubsidy - validDiscount
                          setPricingEditForm({
                            ...pricingEditForm,
                            subtotal: newSubtotal,
                            discountAmount: validDiscount,
                            finalAmount: Math.max(0, newFinalAmount),
                          })
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>State Subsidy (₹)</Label>
                      <Input
                        type="number"
                        min="0"
                        value={pricingEditForm.stateSubsidy || ""}
                        onChange={(e) => {
                          const value = Number.parseFloat(e.target.value) || 0
                          const newStateSubsidy = value
                          const totalSubsidy = newStateSubsidy + pricingEditForm.centralSubsidy
                          const amountAfterSubsidy = pricingEditForm.subtotal - totalSubsidy
                          // Discount is now stored as amount in INR, not percentage
                          const discountAmount = pricingEditForm.discountAmount || 0
                          // Ensure discount doesn't exceed amount after subsidy
                          const maxDiscount = Math.max(0, amountAfterSubsidy)
                          const validDiscount = Math.min(discountAmount, maxDiscount)
                          const newFinalAmount = amountAfterSubsidy - validDiscount
                          setPricingEditForm({
                            ...pricingEditForm,
                            stateSubsidy: newStateSubsidy,
                            discountAmount: validDiscount,
                            finalAmount: Math.max(0, newFinalAmount),
                          })
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Central Subsidy (₹)</Label>
                      <Input
                        type="number"
                        min="0"
                        value={pricingEditForm.centralSubsidy || ""}
                        onChange={(e) => {
                          const value = Number.parseFloat(e.target.value) || 0
                          const newCentralSubsidy = value
                          const totalSubsidy = pricingEditForm.stateSubsidy + newCentralSubsidy
                          const amountAfterSubsidy = pricingEditForm.subtotal - totalSubsidy
                          // Discount is now stored as amount in INR, not percentage
                          const discountAmount = pricingEditForm.discountAmount || 0
                          // Ensure discount doesn't exceed amount after subsidy
                          const maxDiscount = Math.max(0, amountAfterSubsidy)
                          const validDiscount = Math.min(discountAmount, maxDiscount)
                          const newFinalAmount = amountAfterSubsidy - validDiscount
                          setPricingEditForm({
                            ...pricingEditForm,
                            centralSubsidy: newCentralSubsidy,
                            discountAmount: validDiscount,
                            finalAmount: Math.max(0, newFinalAmount),
                          })
                        }}
                      />
                    </div>
                    <div className="space-y-2 border-t pt-2">
                      <Label>Discount (₹)</Label>
                      <Input
                        type="number"
                        min="0"
                        value={pricingEditForm.discountAmount || ""}
                        onChange={(e) => {
                          const value = Number.parseFloat(e.target.value) || 0
                          const totalSubsidy = pricingEditForm.stateSubsidy + pricingEditForm.centralSubsidy
                          const amountAfterSubsidy = pricingEditForm.subtotal - totalSubsidy
                          const maxDiscount = Math.max(0, amountAfterSubsidy)
                          const newDiscountAmount = Math.min(value, maxDiscount)
                          const newFinalAmount = amountAfterSubsidy - newDiscountAmount
                          setPricingEditForm({
                            ...pricingEditForm,
                            discountAmount: newDiscountAmount,
                            finalAmount: Math.max(0, newFinalAmount),
                          })
                        }}
                        placeholder="Enter discount amount in INR"
                      />
                    </div>
                    <div className="space-y-2 border-t pt-2">
                      <Label>Final Amount (₹)</Label>
                      <Input
                        type="number"
                        min="0"
                        value={pricingEditForm.finalAmount || ""}
                        onChange={(e) => {
                          const value = Number.parseFloat(e.target.value) || 0
                          const totalSubsidy = pricingEditForm.stateSubsidy + pricingEditForm.centralSubsidy
                          const amountAfterSubsidy = pricingEditForm.subtotal - totalSubsidy
                          const calculatedDiscount = Math.max(0, amountAfterSubsidy - value)
                          const maxDiscount = Math.max(0, amountAfterSubsidy)
                          const validDiscount = Math.min(calculatedDiscount, maxDiscount)
                          
                          setPricingEditForm({
                            ...pricingEditForm,
                            discountAmount: validDiscount,
                            finalAmount: Math.max(0, value),
                          })
                        }}
                      />
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setIsEditingPricing(false)
                          // Reset form to original values
                          if (fullQuotation) {
                            const products = fullQuotation.products
                            const backendPricing = (fullQuotation as any).pricing
                            let initialSubtotal = 0
                            
                            if (backendPricing) {
                              if (backendPricing.subtotal != null && backendPricing.subtotal > 0) {
                                initialSubtotal = backendPricing.subtotal
                              } else if (backendPricing.totalAmount != null && backendPricing.totalAmount > 0) {
                                initialSubtotal = backendPricing.totalAmount
                              }
                            } else {
                              initialSubtotal = fullQuotation.totalAmount || 0
                            }
                            
                            // Calculate discount amount from existing discount (if it was stored as percentage)
                            // If discount is > 100, assume it's already an amount in INR, otherwise calculate from percentage
                            let resetDiscountAmount = 0
                            const savedDiscountValue = fullQuotation.discount || 0
                            if (savedDiscountValue > 100) {
                              // Likely already an amount in INR
                              resetDiscountAmount = savedDiscountValue
                            } else {
                              // Likely a percentage, calculate amount for backward compatibility
                              const amountAfterSubsidy = initialSubtotal - ((products.stateSubsidy ?? 0) + (products.centralSubsidy ?? 0))
                              resetDiscountAmount = amountAfterSubsidy * (savedDiscountValue / 100)
                            }
                            
                            setPricingEditForm({
                              subtotal: initialSubtotal,
                              stateSubsidy: products.stateSubsidy ?? 0,
                              centralSubsidy: products.centralSubsidy ?? 0,
                            discountAmount: resetDiscountAmount, // Now stores discount amount in INR
                              finalAmount: fullQuotation.finalAmount || 0,
                            })
                          }
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={async () => {
                          setIsSavingPricing(true)
                          try {
                            if (useApi) {
                              // Update pricing via API
                              // apiRequest returns data.data directly, so response is the data object
                              const amountAfterSubsidy =
                                pricingEditForm.subtotal - (pricingEditForm.stateSubsidy + pricingEditForm.centralSubsidy)
                              const calculatedTotalAmount = Math.max(
                                amountAfterSubsidy - (pricingEditForm.discountAmount || 0),
                                0
                              )
                              const response = await api.quotations.updatePricing(displayQuotation.id, {
                                subtotal: pricingEditForm.subtotal,
                                stateSubsidy: pricingEditForm.stateSubsidy,
                                centralSubsidy: pricingEditForm.centralSubsidy,
                                discountAmount: pricingEditForm.discountAmount,
                                totalAmount: calculatedTotalAmount,
                                finalAmount: calculatedTotalAmount,
                              })
                              
                              if (response) {
                                // Update local state with server response
                                const updatedProducts = {
                                  ...displayQuotation.products,
                                  stateSubsidy: response.pricing?.stateSubsidy ?? pricingEditForm.stateSubsidy,
                                  centralSubsidy: response.pricing?.centralSubsidy ?? pricingEditForm.centralSubsidy,
                                }
                                
                                const updatedQuotation = {
                                  ...displayQuotation,
                                  products: updatedProducts,
                                  discount: response.discount ?? pricingEditForm.discountAmount,
                                  totalAmount: response.totalAmount ?? response.pricing?.totalAmount ?? calculatedTotalAmount,
                                  finalAmount: response.finalAmount ?? response.pricing?.finalAmount ?? calculatedTotalAmount,
                                  pricing: response.pricing,
                                }
                                
                                setFullQuotation(updatedQuotation)
                                setIsEditingPricing(false)
                                
                                toast({
                                  title: "Success",
                                  description: "Pricing information updated successfully!",
                                })
                              } else {
                                throw new Error("Failed to update pricing information")
                              }
                            } else {
                              // Fallback to local state update when not using API
                              const updatedProducts = {
                                ...displayQuotation.products,
                                stateSubsidy: pricingEditForm.stateSubsidy,
                                centralSubsidy: pricingEditForm.centralSubsidy,
                              }
                              
                              const amountAfterSubsidy =
                                pricingEditForm.subtotal - (pricingEditForm.stateSubsidy + pricingEditForm.centralSubsidy)
                              const calculatedTotalAmount = Math.max(
                                amountAfterSubsidy - (pricingEditForm.discountAmount || 0),
                                0
                              )
                              const updatedQuotation = {
                                ...displayQuotation,
                                products: updatedProducts,
                                discount: pricingEditForm.discountAmount,
                                totalAmount: calculatedTotalAmount,
                                finalAmount: calculatedTotalAmount,
                              }
                              
                              setFullQuotation(updatedQuotation)
                              setIsEditingPricing(false)
                              
                              toast({
                                title: "Success",
                                description: "Pricing information updated successfully!",
                              })
                            }
                          } catch (error) {
                            console.error("Error updating pricing:", error)
                            const errorMessage = error instanceof Error ? error.message : "Failed to update pricing information"
                            toast({
                              title: "Error",
                              description: errorMessage,
                              variant: "destructive",
                            })
                          } finally {
                            setIsSavingPricing(false)
                          }
                        }}
                        disabled={isSavingPricing}
                      >
                        <Save className="w-3 h-3 mr-1" />
                        {isSavingPricing ? "Saving..." : "Save"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between">
                      <span>Subtotal:</span>
                      <span>₹{subtotal.toLocaleString()}</span>
                    </div>
                    {/* NON-DCR systems should not display subsidies */}
                    {products.systemType !== "non-dcr" && (products.stateSubsidy ?? 0) > 0 && (
                      <div className="flex justify-between text-green-600">
                        <span>State Subsidy:</span>
                        <span>-₹{(products.stateSubsidy ?? 0).toLocaleString()}</span>
                      </div>
                    )}
                    {/* NON-DCR systems should not display subsidies */}
                    {products.systemType !== "non-dcr" && products.centralSubsidy && products.centralSubsidy > 0 && (
                      <div className="flex justify-between text-green-600">
                        <span>Central Subsidy:</span>
                        <span>-₹{products.centralSubsidy.toLocaleString()}</span>
                      </div>
                    )}
                    <div className="border-t pt-2 mt-2">
                          <div className="flex items-center gap-2">
                        <span>Discount:</span>
                        <span
                          className={discountAmount > 0 ? "text-orange-600 font-semibold" : "text-muted-foreground"}
                        >
                              {discountAmount > 0 ? `₹${discountAmount.toLocaleString()}` : "₹0"}
                            </span>
                      </div>
                    </div>
                    <div className="flex justify-between font-bold text-lg border-t pt-2 mt-2">
                      <span>Final Amount:</span>
                      <span>₹{finalAmount.toLocaleString()}</span>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>


            {/* Quotation Info */}
            <Card className="border-primary/20">
              <CardHeader className="bg-primary/5">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-primary" />
                  Quotation Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 pt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-start gap-3">
                    <FileText className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Quotation ID</p>
                      <p className="text-sm font-mono font-semibold">{displayQuotation.id}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Calendar className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Created Date</p>
                      <p className="text-sm font-semibold">{formatDate(quotationDate)}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Calendar className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Valid Until</p>
                      <p className="text-sm font-semibold text-primary">{formatDate(validityDate)}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <FileText className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Status</p>
                      <p className="text-sm font-semibold uppercase">{quotation.status || "Pending"}</p>
                    </div>
                  </div>
                  {String(displayQuotation.status || "").toLowerCase() === "approved" &&
                    displayQuotation.paymentMode && (
                      <div className="flex items-start gap-3 md:col-span-2">
                        <CreditCard className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1">
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Approved payment type</p>
                            <p className="text-sm font-semibold capitalize">{displayQuotation.paymentMode}</p>
                          </div>
                          {["loan", "mix"].includes(String(displayQuotation.paymentMode).toLowerCase()) && (
                            <>
                              <div>
                                <p className="text-xs text-muted-foreground mb-1">Customer bank</p>
                                <p className="text-sm font-medium">{displayQuotation.bankName || "—"}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground mb-1">IFSC</p>
                                <p className="text-sm font-mono font-medium">{displayQuotation.bankIfsc || "—"}</p>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                </div>
              </CardContent>
            </Card>

            {/* Visits Section - Only for Dealers */}
            {isDealer && (
              <Card className="border-primary/20">
                <CardHeader className="bg-primary/5 p-3 sm:p-6">
                  <CardTitle className="text-base sm:text-lg flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                      Scheduled Visits
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setVisitDialogOpen(true)}
                      className="h-8"
                    >
                      <Calendar className="w-3 h-3 mr-1" />
                      Manage Visits
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-3 sm:pt-4 p-3 sm:p-6">
                  {isLoadingVisits ? (
                    <p className="text-sm text-muted-foreground">Loading visits...</p>
                  ) : visits.length > 0 ? (
                    <div className="space-y-3">
                      {visits.map((visit: any) => (
                        <div key={visit.id} className="border rounded-lg p-3">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <Calendar className="w-4 h-4 text-muted-foreground" />
                                <span className="text-sm font-semibold">
                                  {new Date(visit.visitDate).toLocaleDateString("en-IN", {
                                    day: "2-digit",
                                    month: "short",
                                    year: "numeric",
                                  })}
                                </span>
                                <span className="text-sm text-muted-foreground">
                                  at {visit.visitTime}
                                </span>
                              </div>
                              {visit.location && (
                                <div className="flex items-start gap-2 mb-2">
                                  <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
                                  <span className="text-sm">{visit.location}</span>
                                </div>
                              )}
                              {visit.visitors && visit.visitors.length > 0 && (
                                <div className="flex items-start gap-2">
                                  <Users className="w-4 h-4 text-muted-foreground mt-0.5" />
                                  <div className="text-sm">
                                    <span className="font-medium">Visitors: </span>
                                    {visit.visitors.map((v: any, idx: number) => (
                                      <span key={idx}>
                                        {v.fullName || `${v.firstName || ""} ${v.lastName || ""}`.trim()}
                                        {idx < visit.visitors.length - 1 && ", "}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                      {visits.length >= 3 && (
                        <p className="text-xs text-muted-foreground text-center pt-2">
                          Showing first 3 visits. Click "Manage Visits" to see all.
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <Calendar className="w-8 h-8 mx-auto mb-2 text-muted-foreground opacity-50" />
                      <p className="text-sm text-muted-foreground mb-2">No visits scheduled yet</p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setVisitDialogOpen(true)}
                      >
                        <Calendar className="w-3 h-3 mr-1" />
                        Schedule Visit
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            <Card className="border-muted">
              <CardHeader className="py-3 px-4 sm:px-6">
                <CardTitle className="text-base flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-primary shrink-0" />
                  Office locations
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm pt-0 px-4 sm:px-6 pb-4">
                <p className="text-muted-foreground leading-relaxed">
                  <span className="font-semibold text-foreground">Jaipur (Head Office): </span>
                  {companyInfo.address}
                </p>
                {companyInfo.branches.map((b) => (
                  <p key={b.label} className="text-muted-foreground leading-relaxed">
                    <span className="font-semibold text-foreground">{b.label}: </span>
                    {b.address}
                  </p>
                ))}
                <p className="text-xs text-muted-foreground pt-1">
                  <span className="font-medium">Phone: </span>
                  {companyInfo.phone}
                  {" · "}
                  <span className="font-medium">GSTIN: </span>
                  {companyInfo.gst}
                </p>
              </CardContent>
            </Card>

            <div className="flex flex-col sm:flex-row justify-end gap-2 mt-4">
            <Button 
              variant="outline" 
              onClick={() => onOpenChange(false)} 
              disabled={isGeneratingPDF}
              className="w-full sm:w-auto order-2 sm:order-1"
            >
              Close
            </Button>
            <Button 
              onClick={generatePDF} 
              disabled={isGeneratingPDF}
              className="w-full sm:w-auto order-1 sm:order-2"
            >
              <Download className="w-4 h-4 mr-2" />
              {isGeneratingPDF ? "Generating PDF..." : "Download PDF"}
            </Button>
            </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Visit Management Dialog - Only for Dealers */}
      {isDealer && (
        <VisitManagementDialog
          quotation={fullQuotation || quotation}
          open={visitDialogOpen}
          onOpenChange={(open) => {
            setVisitDialogOpen(open)
            if (!open && fullQuotation) {
              // Reload visits when dialog closes
              loadVisits()
            }
          }}
        />
      )}

      {/* Customer Edit Dialog - Full Form with Browse/Select */}
      <Dialog open={customerEditDialogOpen} onOpenChange={setCustomerEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Customer Information</DialogTitle>
            <DialogDescription>Update customer details with browse and select options</DialogDescription>
          </DialogHeader>
          {customer && (
            <CustomerDetailsForm
              initialData={customer}
              onSubmit={async (updatedCustomer: Customer) => {
                setIsSavingCustomer(true)
                try {
                  // Get customer ID from quotation
                  const customerId = (displayQuotation as any).customerId || (displayQuotation.customer as any)?.id || (customer as any)?.id
                  
                  if (useApi && customerId) {
                    // Update via API
                    await api.customers.update(customerId, updatedCustomer)
                    
                    // Update local state
                    setFullQuotation({
                      ...displayQuotation,
                      customer: updatedCustomer,
                    })
                    
                    toast({
                      title: "Success",
                      description: "Customer information updated successfully!",
                    })
                  } else {
                    // Fallback to local state update
                    setFullQuotation({
                      ...displayQuotation,
                      customer: updatedCustomer,
                    })
                    
                    toast({
                      title: "Success",
                      description: "Customer information updated successfully!",
                    })
                  }
                  
                  setCustomerEditDialogOpen(false)
                } catch (error) {
                  console.error("Error updating customer:", error)
                  toast({
                    title: "Error",
                    description: error instanceof Error ? error.message : "Failed to update customer information",
                    variant: "destructive",
                  })
                } finally {
                  setIsSavingCustomer(false)
                }
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* System Configuration Edit Dialog - Full Form with Browse/Select */}
      <Dialog open={systemConfigEditDialogOpen} onOpenChange={setSystemConfigEditDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit System Configuration</DialogTitle>
            <DialogDescription>Update system configuration with browse and select options for products</DialogDescription>
          </DialogHeader>
          {products && (
            <ProductSelectionForm
              initialData={products}
              onBack={() => setSystemConfigEditDialogOpen(false)}
              onSubmit={async (updatedProducts: ProductSelection) => {
                setIsSavingSystemConfig(true)
                try {
                  // Calculate system price from updated products
                  // Priority: 1. systemPrice from products (set by browse config), 2. Calculate using getSystemPrice()
                  let calculatedSubtotal = updatedProducts.systemPrice || 0
                  
                  if (calculatedSubtotal <= 0) {
                    // Calculate system price if not already set
                    calculatedSubtotal = getSystemPrice(updatedProducts)
                  }
                  
                  // If still no price, use existing subtotal as fallback
                  if (calculatedSubtotal <= 0) {
                    calculatedSubtotal = pricingEditForm.subtotal || displayQuotation.totalAmount || 0
                  }
                  
                  // Get subsidies from updated products
                  const updatedStateSubsidy = updatedProducts.stateSubsidy || 0
                  const updatedCentralSubsidy = updatedProducts.centralSubsidy || 0
                  const totalSubsidy = updatedStateSubsidy + updatedCentralSubsidy
                  
                  // Calculate final amount: Subtotal - Subsidies - Discount
                  const amountAfterSubsidy = calculatedSubtotal - totalSubsidy
                  // Discount is now stored as amount in INR, not percentage
                  // Get existing discount amount from pricingEditForm or calculate from old percentage format
                  let currentDiscountAmount = pricingEditForm.discountAmount || 0
                  const savedDiscountValue = displayQuotation.discount || 0
                  
                  // If discount > 100, assume it's already an amount; otherwise calculate from percentage for backward compatibility
                  if (savedDiscountValue > 100) {
                    currentDiscountAmount = savedDiscountValue
                  } else if (savedDiscountValue > 0 && currentDiscountAmount <= 100) {
                    // Backward compatibility: calculate from percentage
                    currentDiscountAmount = amountAfterSubsidy * (savedDiscountValue / 100)
                  }
                  
                  // Ensure discount doesn't exceed amount after subsidy
                  const maxDiscount = Math.max(0, amountAfterSubsidy)
                  currentDiscountAmount = Math.min(currentDiscountAmount, maxDiscount)
                  
                  const calculatedFinalAmount = amountAfterSubsidy - currentDiscountAmount
                  
                  // Update pricing edit form with calculated values
                  setPricingEditForm({
                    subtotal: calculatedSubtotal,
                    stateSubsidy: updatedStateSubsidy,
                    centralSubsidy: updatedCentralSubsidy,
                    discountAmount: currentDiscountAmount, // Store discount as amount in INR
                    finalAmount: Math.max(0, calculatedFinalAmount),
                  })
                  
                  if (useApi) {
                    // Update products via API
                    const productsResponse = await api.quotations.updateProducts(displayQuotation.id, updatedProducts)
                    
                    if (productsResponse) {
                      // Update pricing with calculated subtotal and discount amount (not percentage)
                      const pricingResponse = await api.quotations.updatePricing(displayQuotation.id, {
                        subtotal: calculatedSubtotal,
                        stateSubsidy: updatedStateSubsidy,
                        centralSubsidy: updatedCentralSubsidy,
                        discountAmount: currentDiscountAmount, // Now passes discount amount in INR
                        totalAmount: calculatedFinalAmount,
                        finalAmount: calculatedFinalAmount,
                      })
                      
                      if (pricingResponse) {
                        // Update local state with server response
                        const updatedQuotation = {
                          ...displayQuotation,
                          products: productsResponse.products || updatedProducts,
                          discount: pricingResponse.discount ?? currentDiscountAmount, // Store discount amount
                          totalAmount: pricingResponse.totalAmount ?? pricingResponse.pricing?.totalAmount ?? calculatedSubtotal,
                          finalAmount: pricingResponse.finalAmount ?? pricingResponse.pricing?.finalAmount ?? calculatedFinalAmount,
                          pricing: pricingResponse.pricing,
                        }
                        setFullQuotation(updatedQuotation)
                        
                        toast({
                          title: "Success",
                          description: `System configuration updated! Subtotal automatically set to ₹${calculatedSubtotal.toLocaleString()}`,
                        })
                      } else {
                        // Products updated but pricing failed - still update local state
                        const updatedQuotation = {
                          ...displayQuotation,
                          products: productsResponse.products || updatedProducts,
                          totalAmount: calculatedSubtotal,
                          finalAmount: calculatedFinalAmount,
                        }
                        setFullQuotation(updatedQuotation)
                        
                        toast({
                          title: "Partial Success",
                          description: "System configuration updated, but pricing update failed. Please update pricing manually.",
                          variant: "default",
                        })
                      }
                    } else {
                      throw new Error("Failed to update system configuration")
                    }
                  } else {
                    // Fallback to local state update
                    const updatedQuotation = {
                      ...displayQuotation,
                      products: updatedProducts,
                      totalAmount: calculatedSubtotal,
                      finalAmount: calculatedFinalAmount,
                    }
                    setFullQuotation(updatedQuotation)
                    
                    toast({
                      title: "Success",
                      description: `System configuration updated! Subtotal automatically set to ₹${calculatedSubtotal.toLocaleString()}`,
                    })
                  }
                  
                  setSystemConfigEditDialogOpen(false)
                } catch (error) {
                  console.error("Error updating system configuration:", error)
                  toast({
                    title: "Error",
                    description: error instanceof Error ? error.message : "Failed to update system configuration",
                    variant: "destructive",
                  })
                } finally {
                  setIsSavingSystemConfig(false)
                }
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

