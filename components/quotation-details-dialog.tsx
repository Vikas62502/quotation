"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
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
import { savePdfForDevice } from "@/lib/mobile-pdf"
import { QuotationProposalPdf } from "@/components/quotation-proposal-pdf"
import { formatPersonName } from "@/lib/name-display"
import {
  buildQuotationProposalDocumentData,
  mergeQuotationTimestampsFromApi,
  resolveProposalQuotationDates,
  type QuotationProposalDocumentData,
} from "@/lib/quotation-proposal-document"
import { exportProposalPagesToPdf } from "@/lib/quotation-pdf-export"
import {
  formatPanelBrandLineForPdf,
  formatPanelSizeForPdf,
  formatPanelSizeWithQuantityForPdf,
  getPdfInverterLine,
  getPdfPanelSpecLine,
  resolvePdfPanelRangeKey,
  shouldHidePanelQuantityOnPdf,
} from "@/lib/quotation-pdf-display"
import { useQuotation } from "@/lib/quotation-context"
import { api } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { VisitManagementDialog } from "@/components/visit-management-dialog"
import { useToast } from "@/hooks/use-toast"
import { CustomerDetailsForm } from "@/components/customer-details-form"
import { ProductSelectionForm } from "@/components/product-selection-form"
import type { Customer, ProductSelection } from "@/lib/quotation-context"
import { applyQuotationDetailToRow } from "@/lib/apply-quotation-detail-to-row"
import { restoreDcrPackageDisplayForForm, persistQuotationProducts, mergeQuotationProductsForDisplay } from "@/lib/quotation-api-payload"
import { getQuotationSystemKwFromProducts } from "@/lib/quotation-system-kw"

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
  email: "support@chairbord.com",
  supportFormUrl: "https://www.chairbord.com/support",
  website: "www.chairbord.com",
  gst: "08AAJCC8097M1ZT",
  license: "MNRE/2023/CB/001234",
  logoUrl: "/chairbord-solar-logo.png",
}

// Bank Details
const bankDetails = {
  sbi: {
    bankName: "State Bank of India",
    accountName: "CHAIRBORD PRIVATE LIMITED",
    accountNumber: "44487702699",
    ifscCode: "SBIN0032365",
  },
  icici: {
    bankName: "ICICI Bank",
    accountName: "CHAIRBORD PRIVATE LIMITED",
    accountNumber: "777705926966",
    ifscCode: "ICIC0004181",
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
  const [pdfExportData, setPdfExportData] = useState<QuotationProposalDocumentData | null>(null)
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
              
              const mergedQuotation = applyQuotationDetailToRow(
                {
                  ...quotation,
                  products: mergeQuotationProductsForDisplay(quotation),
                },
                fullData,
              )
              const updatedQuotation = {
                ...mergedQuotation,
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
                createdAt: mergedQuotation.createdAt,
                updatedAt: mergedQuotation.updatedAt,
                validUntil: mergedQuotation.validUntil,
                remaining: fullData.remaining ?? (quotation as Quotation & { remaining?: number }).remaining,
                remainingAmount:
                  fullData.remainingAmount ??
                  (quotation as Quotation & { remainingAmount?: number }).remainingAmount,
                paymentMode: fullData.paymentMode || fullData.payment_mode || quotation.paymentMode,
                paymentStatus: fullData.paymentStatus ?? quotation.paymentStatus,
                bankName: fullData.bankName ?? fullData.bank_name ?? quotation.bankName,
                bankIfsc: fullData.bankIfsc ?? fullData.bank_ifsc ?? quotation.bankIfsc,
                dealer: fullData.dealer || quotation.dealer || null,
                pricing: fullData.pricing ?? mergedQuotation.pricing,
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
      setPdfExportData(null)
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

  const buildProposalPdfData = useCallback(
    (displayQuotation: Quotation): QuotationProposalDocumentData | null => {
      if (!displayQuotation?.customer || !displayQuotation?.products) return null

      const customer = displayQuotation.customer
      const products = mergeQuotationProductsForDisplay(displayQuotation)
      const backendPricing = (displayQuotation as Quotation & { pricing?: { subtotal?: number; totalAmount?: number } })
        .pricing
      const subtotal =
        backendPricing?.subtotal ??
        backendPricing?.totalAmount ??
        displayQuotation.subtotal ??
        displayQuotation.totalAmount ??
        getSystemPrice(products) ??
        0
      const totalAmount = backendPricing?.totalAmount ?? displayQuotation.totalAmount ?? subtotal
      const { quotationDate, validityDate } = resolveProposalQuotationDates(displayQuotation)

      const dealerForPdf =
        displayQuotation.dealer ||
        (!isAdmin && dealer
          ? {
              firstName: dealer.firstName,
              lastName: dealer.lastName,
              email: dealer.email,
              mobile: dealer.mobile,
            }
          : null)

      return buildQuotationProposalDocumentData({
        quotationId: displayQuotation.id,
        customer,
        products,
        company: {
          name: companyInfo.name,
          address: companyInfo.address,
          phone: companyInfo.phone,
          email: companyInfo.email,
          gst: companyInfo.gst,
          logoUrl: companyInfo.logoUrl,
          supportFormUrl: companyInfo.supportFormUrl,
          offices: [
            { label: "Jaipur (Head Office)", address: companyInfo.address },
            ...companyInfo.branches.map((b) => ({ label: b.label, address: b.address })),
          ],
        },
        dealer: dealerForPdf,
        banks: bankDetails,
        subtotal,
        totalAmount,
        quotationDate,
        validityDate,
      })
    },
    [dealer, isAdmin],
  )

  const proposalPdfData = useMemo(() => {
    const displayQuotation = quotation ? fullQuotation || quotation : null
    if (!displayQuotation) return null
    return buildProposalPdfData(displayQuotation)
  }, [quotation, fullQuotation, buildProposalPdfData])

  const activePdfData = pdfExportData ?? proposalPdfData

  if (!quotation) return null

  const displayQuotation = fullQuotation || quotation
  if (!displayQuotation) return null
  
  const storedDiscountValue = displayQuotation.discount || 0
  const backendPricing = (displayQuotation as any).pricing

  const products = mergeQuotationProductsForDisplay(displayQuotation)
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
  const displayLastName = (customer?.lastName || "").trim()
  const normalizedLastName = displayLastName.toLowerCase()
  const safeLastName = normalizedLastName === "na" ? "" : displayLastName
  const displayEmail = (customer?.email || "").trim()
  const normalizedEmail = displayEmail.toLowerCase()
  const safeEmail = normalizedEmail === "na@chairbord.com" ? "" : displayEmail
  const safeFullName = `${customer?.firstName || ""} ${safeLastName}`.trim()

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

  const { quotationDate, validityDate } = resolveProposalQuotationDates(displayQuotation)

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    })
  }

  const generatePDF = async () => {
    setIsGeneratingPDF(true)

    const displayPrior = fullQuotation || quotation
    const priorRow = displayPrior
      ? {
          ...displayPrior,
          products: mergeQuotationProductsForDisplay(displayPrior),
        }
      : null

    let quotationForPdf = priorRow || quotation
    if (useApi && quotationForPdf?.id) {
      try {
        const fresh = await api.quotations.getById(quotationForPdf.id)
        if (fresh && priorRow) {
          quotationForPdf = applyQuotationDetailToRow(priorRow, fresh)
          setFullQuotation(quotationForPdf)
        } else if (fresh) {
          quotationForPdf = applyQuotationDetailToRow(quotationForPdf, fresh)
        }
      } catch (error) {
        console.warn("[generatePDF] Could not refresh quotation from API; using cached row:", error)
      }
    }

    const exportData = quotationForPdf ? buildProposalPdfData(quotationForPdf) : null
    if (!exportData) {
      setIsGeneratingPDF(false)
      alert("Customer details are missing. Cannot generate PDF.")
      return
    }

    setPdfExportData(exportData)
    await new Promise((resolve) => setTimeout(resolve, 200))

    const rootId = `quotation-content-${displayQuotation.id}`
      const sanitizeSegment = (value: string) =>
        value
          .trim()
          .replace(/\s+/g, "_")
          .replace(/[^a-zA-Z0-9_-]/g, "")
          .replace(/_+/g, "_")
      const customerName =
        sanitizeSegment(formatPersonName(customer?.firstName, customer?.lastName, "Customer")) || "Customer"
    const safeQuotationId = sanitizeSegment(displayQuotation.id) || "Quotation"
    const filename = `Solar_Proposal_${customerName}_${safeQuotationId}.pdf`

    try {
      await exportProposalPagesToPdf(rootId, filename, savePdfForDevice)
    } catch (error) {
      console.error("Error generating PDF:", error)
      alert(`Error generating PDF: ${error instanceof Error ? error.message : "Unknown error"}. Please try again.`)
    } finally {
      setPdfExportData(null)
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

  const getInverterDetails = () => getPdfInverterLine(products)

  const getSystemSizes = () => {
    if (products.systemType === "both") {
      const dcrRange = resolvePdfPanelRangeKey(products as any, "dcr")
      const nonDcrRange = resolvePdfPanelRangeKey(products as any, "nonDcr")
      const dcrSize = products.dcrPanelSize
        ? formatPanelSizeWithQuantityForPdf(products.dcrPanelSize, products.dcrPanelQuantity, dcrRange)
        : ""
      const nonDcrSize = products.nonDcrPanelSize
        ? formatPanelSizeWithQuantityForPdf(
            products.nonDcrPanelSize,
            products.nonDcrPanelQuantity,
            nonDcrRange,
          )
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
    const primaryRange = resolvePdfPanelRangeKey(products as any, "primary")
    return formatPanelSizeForPdf(products.panelSize, primaryRange) || "As per selection"
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

  const getTotalSystemKw = () => getQuotationSystemKwFromProducts(products)

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
      {/* Hidden PDF — 3-page Solar Installation Proposal */}
      {open && activePdfData && (
        <QuotationProposalPdf
          data={activePdfData}
          rootId={`quotation-content-${displayQuotation.id}`}
        />
      )}

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
                          {safeFullName}
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
                        {safeEmail ? (
                          <a
                            href={`mailto:${safeEmail}`}
                            className="text-sm font-semibold text-primary hover:underline"
                            title="Click to send email"
                          >
                            {safeEmail}
                          </a>
                        ) : (
                          <p className="text-sm font-semibold text-muted-foreground">-</p>
                        )}
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
                              {formatPanelBrandLineForPdf(
                                products.dcrPanelBrand,
                              products.dcrPanelSize,
                                products.dcrPanelQuantity,
                                resolvePdfPanelRangeKey(products as any, "dcr"),
                              )}
                              {!shouldHidePanelQuantityOnPdf(products as any, "dcr") && (
                              <span className="text-xs text-muted-foreground ml-1">
                                (
                                {(
                                  (Number.parseFloat(products.dcrPanelSize.replace("W", "")) *
                                    products.dcrPanelQuantity) /
                                  1000
                                ).toFixed(2)}
                                kW)
                              </span>
                              )}
                            </p>
                          )}
                          {products.nonDcrPanelBrand && products.nonDcrPanelSize && products.nonDcrPanelQuantity && (
                            <p className="font-medium">
                              <span className="text-muted-foreground">Non-DCR</span>{" "}
                              {formatPanelBrandLineForPdf(
                                products.nonDcrPanelBrand,
                              products.nonDcrPanelSize,
                                products.nonDcrPanelQuantity,
                                resolvePdfPanelRangeKey(products as any, "dcr"),
                              )}
                              {!shouldHidePanelQuantityOnPdf(products as any, "dcr") && (
                              <span className="text-xs text-muted-foreground ml-1">
                                (
                                {(
                                  (Number.parseFloat(products.nonDcrPanelSize.replace("W", "")) *
                                    products.nonDcrPanelQuantity) /
                                  1000
                                ).toFixed(2)}
                                kW)
                              </span>
                              )}
                            </p>
                          )}
                        </div>
                        <div className="sm:border-l sm:border-border sm:pl-4 min-w-0 sm:max-w-[55%] space-y-1 text-sm">
                          <span className="font-semibold block">Common components</span>
                          <div>
                            <span className="font-semibold">Inverter: </span>
                            {getPdfInverterLine(products)}
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
                        {getPdfPanelSpecLine(products)}
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
                          {getPdfInverterLine(products)}
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
                                  ...mergeQuotationTimestampsFromApi(displayQuotation, response),
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
                                ...mergeQuotationTimestampsFromApi(displayQuotation),
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
                      <p className="text-xs text-muted-foreground mb-1">Last Updated</p>
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
                  const normalizedCustomer: Customer = {
                    ...updatedCustomer,
                    firstName: (updatedCustomer.firstName || "").trim(),
                    // Backend currently validates non-empty strings for these fields.
                    lastName: (updatedCustomer.lastName || "").trim(),
                    email: (updatedCustomer.email || "").trim() || "na@chairbord.com",
                    mobile: (updatedCustomer.mobile || "").trim(),
                    address: {
                      street: (updatedCustomer.address?.street || "").trim(),
                      city: (updatedCustomer.address?.city || "").trim(),
                      state: (updatedCustomer.address?.state || "").trim(),
                      pincode: (updatedCustomer.address?.pincode || "").trim(),
                    },
                  }
                  // Get customer ID from quotation
                  const customerId = (displayQuotation as any).customerId || (displayQuotation.customer as any)?.id || (customer as any)?.id
                  
                  if (useApi && customerId) {
                    // Update via API
                    await api.customers.update(customerId, normalizedCustomer)
                    
                    // Update local state
                    setFullQuotation({
                      ...displayQuotation,
                      customer: normalizedCustomer,
                      ...mergeQuotationTimestampsFromApi(displayQuotation),
                    })
                    
                    toast({
                      title: "Success",
                      description: "Customer information updated successfully!",
                    })
                  } else {
                    // Fallback to local state update
                    setFullQuotation({
                      ...displayQuotation,
                      customer: normalizedCustomer,
                      ...mergeQuotationTimestampsFromApi(displayQuotation),
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
                    const displayProducts = restoreDcrPackageDisplayForForm(updatedProducts)
                    const productsResponse = await persistQuotationProducts(
                      (payload) => api.quotations.updateProducts(displayQuotation.id, payload),
                      updatedProducts,
                    )
                    
                    if (productsResponse) {
                      const savedProducts = displayProducts
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
                          products: savedProducts,
                          discount: pricingResponse.discount ?? currentDiscountAmount, // Store discount amount
                          totalAmount: pricingResponse.totalAmount ?? pricingResponse.pricing?.totalAmount ?? calculatedSubtotal,
                          finalAmount: pricingResponse.finalAmount ?? pricingResponse.pricing?.finalAmount ?? calculatedFinalAmount,
                          pricing: pricingResponse.pricing,
                          ...mergeQuotationTimestampsFromApi(
                            displayQuotation,
                            pricingResponse ?? productsResponse,
                          ),
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
                          products: savedProducts,
                          totalAmount: calculatedSubtotal,
                          finalAmount: calculatedFinalAmount,
                          ...mergeQuotationTimestampsFromApi(displayQuotation, productsResponse),
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
                      ...mergeQuotationTimestampsFromApi(displayQuotation),
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
                    description:
                      error instanceof Error ? error.message : "Failed to update system configuration",
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

