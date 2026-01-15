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
  address: "Plot No. 10, Ground Floor, Shri Shyam Vihar, Kalwar Road, Jhotwara, Jaipur, Rajasthan, India - 302012",
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
  const [discount, setDiscount] = useState(0)
  const [isEditingDiscount, setIsEditingDiscount] = useState(false)
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
    discount: 0, // Now represents discount amount in INR, not percentage
    finalAmount: 0,
  })
  const [isSavingPricing, setIsSavingPricing] = useState(false)
  const [systemConfigEditDialogOpen, setSystemConfigEditDialogOpen] = useState(false)
  const [isSavingSystemConfig, setIsSavingSystemConfig] = useState(false)
  const [paymentMode, setPaymentMode] = useState<string>("")
  const [isSavingPaymentMode, setIsSavingPaymentMode] = useState(false)

  const useApi = process.env.NEXT_PUBLIC_USE_API !== "false"
  const isDealer = dealer && dealer.username !== "admin"
  const isAccountManagement = role === "account-management"

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
                totalAmount: fullData.pricing?.totalAmount ?? quotation.totalAmount,
                finalAmount: fullData.pricing?.finalAmount ?? fullData.finalAmount ?? quotation.finalAmount,
                paymentMode: fullData.paymentMode || quotation.paymentMode,
                paymentStatus: fullData.paymentStatus || quotation.paymentStatus,
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
      setDiscount(savedDiscountValue)
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
        discount: initialDiscountAmount, // Now stores discount amount in INR
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
  const backendPricing = (displayQuotation as any).pricing

  // Calculate prices - use backend pricing if available, otherwise calculate on frontend
  const products = displayQuotation.products
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
    } else if (discount > 100) {
      // If discount > 100, assume it's already an amount in INR
      discountAmount = discount
    } else {
      // Backward compatibility: if discount <= 100, treat as percentage for old data
      discountAmount = amountAfterSubsidy * (discount / 100)
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
    acdbDcdbPrice = (products.acdb ? getACDBPrice(products.acdb) : 0) + (products.dcdb ? getDCDBPrice(products.dcdb) : 0)
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
    discountAmount = discount > 100 ? discount : 0
    finalAmount = amountAfterSubsidy - discountAmount
  }

  const handleSaveDiscount = () => {
    if (!quotation) return
    
    // Discount is now stored as amount in INR, not percentage
    const updatedDiscountAmount = discount // discount is already an amount
    const updatedAmountAfterSubsidy = subtotal - totalSubsidy
    const updatedFinalAmount = updatedAmountAfterSubsidy - updatedDiscountAmount
    
    // Update quotation in localStorage
    const allQuotations = JSON.parse(localStorage.getItem("quotations") || "[]")
    const updatedQuotations = allQuotations.map((q: Quotation) => {
      if (q.id === displayQuotation.id) {
        return {
          ...q,
          discount: updatedDiscountAmount, // Store discount as amount in INR
          finalAmount: updatedFinalAmount,
        }
      }
      return q
    })
    localStorage.setItem("quotations", JSON.stringify(updatedQuotations))
    
    // Update local state
    setFullQuotation({
      ...displayQuotation,
      discount: updatedDiscountAmount,
      finalAmount: updatedFinalAmount,
    })
    setDiscount(updatedDiscountAmount)
    setIsEditingDiscount(false)
    
    toast({
      title: "Success",
      description: "Discount updated successfully!",
    })
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
    
    // Wait a bit to ensure the hidden content is rendered
    await new Promise((resolve) => setTimeout(resolve, 200))

    let input = document.getElementById(`quotation-content-${displayQuotation.id}`)

    // If element not found, wait a bit more and try again
    if (!input) {
      await new Promise((resolve) => setTimeout(resolve, 300))
      input = document.getElementById(`quotation-content-${quotation.id}`)
    }

    if (!input) {
      console.error("Quotation content element not found.")
      alert("Error: Could not find quotation content. Please try again.")
      setIsGeneratingPDF(false)
      return
    }

    // Create a temporary container to isolate the PDF content
    // This prevents LAB color issues by isolating from parent styles
    const tempContainer = document.createElement("div")
    tempContainer.style.cssText = `
      position: fixed !important;
      left: 0px !important;
      top: 0px !important;
      width: 210mm !important;
      height: auto !important;
      background-color: #ffffff !important;
      z-index: 9999 !important;
      visibility: visible !important;
      opacity: 1 !important;
      overflow: hidden !important;
      margin: 0 !important;
      padding: 0 !important;
      border: none !important;
    `
    
    // Clone the content to avoid affecting the original
    const clonedInput = input.cloneNode(true) as HTMLElement
    clonedInput.id = `quotation-content-temp-${quotation.id}`
    clonedInput.style.cssText = `
      position: relative !important;
      left: 0 !important;
      top: 0 !important;
      visibility: visible !important;
      opacity: 1 !important;
      width: 210mm !important;
      background-color: #ffffff !important;
    `
    
    // Remove any problematic classes and ensure clean styles
    clonedInput.className = ""
    clonedInput.removeAttribute("class")
    
    tempContainer.appendChild(clonedInput)
    document.body.appendChild(tempContainer)

    try {
      // Wait for images to load
      const images = clonedInput.querySelectorAll("img")
      await Promise.all(
        Array.from(images).map(
          (img) =>
            new Promise((resolve, reject) => {
              if (img.complete) {
                resolve(true)
              } else {
                img.onload = () => resolve(true)
                img.onerror = () => reject(new Error("Image failed to load"))
                // Timeout after 5 seconds
                setTimeout(() => reject(new Error("Image load timeout")), 5000)
              }
            }),
        ),
      )

      // Wait a bit for styles to apply
      await new Promise((resolve) => setTimeout(resolve, 100))

      const canvas = await html2canvas(tempContainer, {
        scale: 2,
        useCORS: true,
        logging: true, // Enable logging to see what's happening
        backgroundColor: "#ffffff",
        allowTaint: false,
        foreignObjectRendering: false,
        proxy: undefined, // Don't use proxy
        onclone: (clonedDoc, element) => {
          // Fix any LAB color functions in the cloned document
          try {
            const allElements = clonedDoc.querySelectorAll("*")
            allElements.forEach((el) => {
              const htmlEl = el as HTMLElement
              if (htmlEl && htmlEl.style) {
                // Get computed styles and replace LAB colors
                try {
                  // Force all background colors to hex
                  const bgColor = htmlEl.style.backgroundColor || window.getComputedStyle(el).backgroundColor
                  if (bgColor && (bgColor.includes("lab(") || bgColor.includes("oklab(") || bgColor.includes("color("))) {
                    htmlEl.style.backgroundColor = "#ffffff"
                  }
                  
                  // Force all text colors to hex
                  const textColor = htmlEl.style.color || window.getComputedStyle(el).color
                  if (textColor && (textColor.includes("lab(") || textColor.includes("oklab(") || textColor.includes("color("))) {
                    htmlEl.style.color = "#000000"
                  }
                  
                  // Force all border colors to hex
                  const borderColor = htmlEl.style.borderColor || window.getComputedStyle(el).borderColor
                  if (borderColor && (borderColor.includes("lab(") || borderColor.includes("oklab(") || borderColor.includes("color("))) {
                    htmlEl.style.borderColor = "#000000"
                  }
                } catch (e) {
                  // Ignore errors for individual elements
                }
              }
            })
          } catch (e) {
            console.warn("Error fixing colors in cloned document:", e)
          }
        },
      })

      const imgWidth = 210 // A4 width in mm
      const pageHeight = 297 // A4 height in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width

      const pdf = new jsPDF("p", "mm", "a4")

      let heightLeft = imgHeight
      let position = 0

      // Add first page
      pdf.addImage(canvas.toDataURL("image/jpeg", 0.95), "JPEG", 0, position, imgWidth, imgHeight)
      heightLeft -= pageHeight

      // Add additional pages only if there's significant content left (more than 10mm)
      // This prevents blank pages
      while (heightLeft > 10) {
        position = heightLeft - imgHeight
        pdf.addPage()
        pdf.addImage(canvas.toDataURL("image/jpeg", 0.95), "JPEG", 0, position, imgWidth, imgHeight)
        heightLeft -= pageHeight
      }

      // Generate filename
      const customerName = `${customer?.firstName || ""}_${customer?.lastName || ""}`.replace(/\s/g, "_")
      const filename = `Quotation_${customerName}_${formatDate(quotationDate)}.pdf`
      
      // Use displayQuotation for PDF generation
      const pdfQuotation = displayQuotation

      // Save
      pdf.save(filename)
    } catch (error) {
      console.error("Error generating PDF:", error)
      alert(`Error generating PDF: ${error instanceof Error ? error.message : "Unknown error"}. Please try again.`)
    } finally {
      // Clean up temporary container
      if (tempContainer && tempContainer.parentNode) {
        tempContainer.parentNode.removeChild(tempContainer)
      }
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

  // Generate dynamic PDF title: "{systemSize}kW ({phase}) Solar System - {panelBrand} Panels"
  const getPdfSystemTitle = () => {
    const phase = products.phase // ✅ phase comes from table/selection
  
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
        return `${systemSize} (${products.phase}) Solar System - ${panelBrand} Panels`
      }
    }
  
    return "Solar Panel System"
  }
  

  return (
    <>
      {/* Hidden PDF Content - Always rendered for PDF generation */}
      <div
        id={`quotation-content-${displayQuotation.id}`}
        className="bg-white p-4 sm:p-6 rounded-lg shadow-md"
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
          #quotation-content-${quotation.id} {
            font-family: Arial, sans-serif;
            line-height: 1.4;
            color: #000;
            font-size: 12px;
            width: 210mm;
            min-height: 297mm;
            padding: 0;
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            background-color: #ffffff;
            position: relative;
            margin: 0;
          }

          .pdf-page-content {
            position: relative;
            z-index: 1;
            background-color: #ffffff;
            padding: 15mm;
            box-sizing: border-box;
            width: 210mm;
            min-height: 297mm;
            display: flex;
            flex-direction: column;
            page-break-after: always;
            margin: 0;
          }

          .pdf-page-content:last-of-type {
            page-break-after: avoid;
          }

          .pdf-page-content .pdf-footer {
            margin-top: auto;
            position: relative;
            bottom: 0;
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
            flex: 1;
            display: grid;
            grid-template-columns: 1fr;
            gap: 15px;
            margin-bottom: 15px;
          }

          .pdf-product-category {
            background: #f9fafb;
            border-radius: 8px;
            padding: 12px;
            border: 1px solid #e5e7eb;
            position: relative;
            overflow: hidden;
          }

          .pdf-category-header {
            background: linear-gradient(90deg, #ff8c00, #e67300);
            color: white;
            padding: 8px 12px;
            border-radius: 6px;
            font-weight: bold;
            font-size: 12px;
            margin-bottom: 10px;
            padding-bottom: 15px;
            text-align: center;
          }

          .pdf-product-item {
            background: transparent;
            padding: 8px;
            border-radius: 4px;
            margin-bottom: 8px;
            border-left: 3px solid #10b981;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
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
            align-items: center;
            font-size: 10px;
          }

          .pdf-product-specs {
            color: #6b7280;
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

        {/* Page 1: Main Quotation Content */}
        <div className="pdf-page-content">
          <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            {/* Header */}
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
                <div className="pdf-info-item">
                  <strong>Address:</strong> {companyInfo.address}
                </div>
              </div>
            </div>

            {/* Products Section */}
            <div className="pdf-products-section" style={{ marginTop: "-10px" }}>
              <div className="pdf-product-category">
                <div className="pdf-category-header">📦 SOLAR SETS</div>
                
                {/* For BOTH system type, show separate DCR and NON DCR panels side by side */}
                {products.systemType === "both" ? (
                  <>
                    {/* DCR and NON DCR Panels in same row */}
                    <div style={{ display: "flex", gap: "12px", marginBottom: "8px" }}>
                      {/* DCR Panels - Left side */}
                      {products.dcrPanelBrand && products.dcrPanelSize && products.dcrPanelQuantity && (
                        <div className="pdf-product-item" style={{ flex: "1", marginBottom: "0" }}>
                          <div className="pdf-product-name">DCR Panels (With Subsidy)</div>
                          <div className="pdf-product-details">
                            <div className="pdf-product-specs">
                              {products.dcrPanelBrand} {products.dcrPanelSize} × {products.dcrPanelQuantity}
                              {products.dcrPanelSize && products.dcrPanelQuantity && (
                                <>
                                  <br />
                                  <span style={{ fontSize: "10px", color: "#666" }}>
                                    Total: {((Number.parseFloat(products.dcrPanelSize.replace("W", "")) * products.dcrPanelQuantity) / 1000).toFixed(2)}kW
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {/* NON DCR Panels - Right side */}
                      {products.nonDcrPanelBrand && products.nonDcrPanelSize && products.nonDcrPanelQuantity && (
                        <div className="pdf-product-item" style={{ flex: "1", marginBottom: "0" }}>
                          <div className="pdf-product-name">Non-DCR Panels (Without Subsidy)</div>
                          <div className="pdf-product-details">
                            <div className="pdf-product-specs">
                              {products.nonDcrPanelBrand} {products.nonDcrPanelSize} × {products.nonDcrPanelQuantity}
                              {products.nonDcrPanelSize && products.nonDcrPanelQuantity && (
                                <>
                                  <br />
                                  <span style={{ fontSize: "10px", color: "#666" }}>
                                    Total: {((Number.parseFloat(products.nonDcrPanelSize.replace("W", "")) * products.nonDcrPanelQuantity) / 1000).toFixed(2)}kW
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {/* Common Components */}
                    <div className="pdf-product-item">
                      <div className="pdf-product-name">Common Components</div>
                      <div className="pdf-product-details">
                        <div className="pdf-product-specs">
                          Inverter: {products.inverterBrand} {products.inverterType} ({products.inverterSize})
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
                              ACDB/DCDB: {products.acdb ? "ACDB" : ""} {products.dcdb ? "DCDB" : ""}
                            </>
                          )}
                          {products.batteryCapacity && (
                            <>
                              <br />
                              Battery: {products.batteryCapacity}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </>
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
                        Inverter: {products.inverterBrand} {products.inverterType} ({products.inverterSize})
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
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Summary Section */}
            <div className="pdf-summary-section">
              <div className="pdf-summary-row">
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
              <div className="pdf-summary-row price-after-subsidy">
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
                <strong>OFFICE:</strong> {companyInfo.address}
              </p>
              <p>
                <strong>Mobile:</strong> {companyInfo.phone} | <strong>GSTIN:</strong> {companyInfo.gst}
              </p>
            </div>
          </div>
        </div>

        {/* Page 2: Terms & Conditions */}
        <div className="pdf-page-content" style={{ pageBreakBefore: "always" }}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
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
                flex: 1,
                marginBottom: 0,
                maxHeight: "203mm",
                overflow: "hidden",
                marginTop: "-15px",
              }}
            >
              <div style={{ fontSize: "10px", lineHeight: "1.2", color: "#374151" }}>
                <div className="term-point">
                  <strong
                    style={{
                      fontSize: "13px",
                      color: "#ff8c00",
                      display: "block",
                      marginBottom: "6px",
                    }}
                  >
                    1. Make:
                  </strong>
                  <table className="make-table">
                    <tbody>
                      <tr>
                        <td className="label-cell">• Solar Module</td>
                        <td>{getUniqueBrands()}</td>
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
                        <td>Polycab / KEI (4 sq.mm)</td>
                      </tr>
                      <tr>
                        <td className="label-cell">• AC Cable</td>
                        <td>JMP (6 sq.mm), Polycab (6 sq.mm), etc.</td>
                      </tr>
                      <tr>
                        <td className="label-cell">• Structure</td>
                        <td>Tata / Appollo GI Pipe, etc.</td>
                      </tr>
                      <tr>
                        <td className="label-cell">• Lightning Arrester & Earthing</td>
                        <td>Standard make</td>
                      </tr>
                      <tr>
                        <td className="label-cell">• ACDB & DCDB</td>
                        <td>Havells, Havells + ELMEX, etc.</td>
                      </tr>
                      <tr>
                        <td className="label-cell">• Meter (Solar + Net)</td>
                        <td>HPL, Genus, Secure, L&T, etc.</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div className="term-point">
                  <strong
                    style={{
                      fontSize: "13px",
                      color: "#ff8c00",
                      display: "block",
                      marginBottom: "4px",
                    }}
                  >
                    2. Payment Terms:
                  </strong>
                  <div>
                    <div style={{ fontSize: "11px" }}>Inverter and Other Items</div>
                  </div>
                </div>
                <div className="term-point">
                  <strong
                    style={{
                      fontSize: "13px",
                      color: "#ff8c00",
                      display: "block",
                      marginBottom: "4px",
                    }}
                  >
                    3. Project Completion:
                  </strong>
                  <div>
                    <div style={{ fontSize: "11px" }}>
                      15–20 days from the date of receipt of Solar NOC from DISCOM, commercially clear order, and advance
                      payment.
                    </div>
                  </div>
                </div>
                <div className="term-point">
                  <strong
                    style={{
                      fontSize: "13px",
                      color: "#ff8c00",
                      display: "block",
                      marginBottom: "4px",
                    }}
                  >
                    4. Validity of Offer:
                  </strong>
                  <div>
                    <div style={{ fontSize: "11px" }}>
                      5 days from the date of offer. After this period, confirmation must be obtained.
                    </div>
                  </div>
                </div>
                <div className="term-point">
                  <strong
                    style={{
                      fontSize: "13px",
                      color: "#ff8c00",
                      display: "block",
                      marginBottom: "4px",
                    }}
                  >
                    5. Client Scope:
                  </strong>
                  <div>
                    <div style={{ marginBottom: "2px", fontSize: "11px" }}>
                      • Cleaning of solar modules is under the client&apos;s scope
                    </div>
                    <div style={{ marginBottom: "2px", fontSize: "11px" }}>
                      • Rooftop to be arranged and provided by the client
                    </div>
                    <div style={{ marginBottom: "2px", fontSize: "11px" }}>
                      • Electricity and water must be provided by the client during construction
                    </div>
                    <div style={{ marginBottom: "2px", fontSize: "11px" }}>
                      • Provide safe storage space for materials used in the solar power plant
                    </div>
                    <div style={{ marginBottom: "2px", fontSize: "11px" }}>
                      • Ensure electricity supply is available to synchronize the inverter during and after
                      commissioning
                    </div>
                    <div style={{ marginBottom: "2px", fontSize: "11px" }}>
                      • Provide connection space in the LT panel to connect the inverter output
                    </div>
                    <div style={{ marginBottom: "2px", fontSize: "11px" }}>
                      • Internet connection to be provided by the client for remote monitoring of the system
                    </div>
                  </div>
                </div>
                <div className="term-point">
                  <strong
                    style={{
                      fontSize: "13px",
                      color: "#ff8c00",
                      display: "block",
                      marginBottom: "4px",
                    }}
                  >
                    6. Transportation:
                  </strong>
                  <div>
                    <div style={{ fontSize: "11px" }}>
                      All transportation of the above-mentioned Bill of Materials (BOM) up to the installation site is
                      included.
                    </div>
                  </div>
                </div>
                <div className="term-point">
                  <strong
                    style={{
                      fontSize: "13px",
                      color: "#ff8c00",
                      display: "block",
                      marginBottom: "4px",
                    }}
                  >
                    7. Net-Metering:
                  </strong>
                  <div>
                    <div style={{ fontSize: "11px" }}>
                      All government DISCOM fees (file charges, demand charges, testing for net metering, and
                      arrangement of Electrical Inspector Report) shall be paid directly to DISCOM and will be under
                      the client&apos;s scope.
                    </div>
                  </div>
                </div>
                <div className="term-point">
                  <strong
                    style={{
                      fontSize: "13px",
                      color: "#ff8c00",
                      display: "block",
                      marginBottom: "4px",
                    }}
                  >
                    8. Solar System Warranty:
                  </strong>
                  <div>
                    <div style={{ marginBottom: "2px", fontSize: "11px" }}>• 5-year comprehensive system warranty</div>
                    <div style={{ marginBottom: "2px", fontSize: "11px" }}>
                      • Solar module performance warranty: 25 years
                    </div>
                    <div style={{ marginBottom: "2px", fontSize: "11px" }}>
                      • Solar grid-tie inverter warranty: 10 years (as per manufacturer&apos;s terms & conditions)
                    </div>
                  </div>
                </div>
                <div className="term-point">
                  <strong
                    style={{
                      fontSize: "13px",
                      color: "#ff8c00",
                      display: "block",
                      marginBottom: "4px",
                    }}
                  >
                    9. Subsidy Exclusion Policy:
                  </strong>
                  <div>
                    <div style={{ fontSize: "11px" }}>
                      The quoted price excludes any subsidies, incentives, or rebates. The full package cost will be
                      charged as per the terms outlined, with subsidies to be applied for separately by the customer.
                    </div>
                  </div>
                </div>
                <div className="term-point">
                  <strong
                    style={{
                      fontSize: "13px",
                      color: "#ff8c00",
                      display: "block",
                      marginBottom: "4px",
                    }}
                  >
                    10. Payment Terms:
                  </strong>
                  <div>
                    <div style={{ marginBottom: "2px", fontSize: "11px" }}>
                      • Initial Deposit (Upon Contract Signing): 10-30% of total system cost to secure the contract and
                      cover initial costs (design, permits, equipment ordering).
                    </div>
                    <div style={{ marginBottom: "2px", fontSize: "11px" }}>
                      • Progress Payment (Upon Equipment Delivery/Installation Start): 40-80% of total system cost when
                      equipment arrives on-site or installation begins.
                    </div>
                    <div style={{ marginBottom: "2px", fontSize: "11px" }}>
                      • Final Payment (Upon System Commissioning/Grid Connection): 10-20% of total system cost after
                      system is installed, inspected, and operational with utility approval.
                    </div>
                  </div>
                </div>
              </div>
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
                <strong>OFFICE:</strong> {companyInfo.address}
              </p>
              <p>
                <strong>Mobile:</strong> {companyInfo.phone} | <strong>GSTIN:</strong> {companyInfo.gst}
              </p>
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

            {/* Dealer/Admin Information - Show for account management users */}
            {isAccountManagement && displayQuotation.dealer && (
              <Card className="border-blue-500/20">
                <CardHeader className="bg-blue-500/5 p-3 sm:p-6">
                  <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                    <Users className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500" />
                    Dealer/Admin Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 sm:space-y-3 pt-3 sm:pt-4 p-3 sm:p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-start gap-3">
                      <User className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Full Name</p>
                        <p className="text-sm font-semibold">
                          {displayQuotation.dealer.firstName} {displayQuotation.dealer.lastName}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0 flex items-center justify-center">
                        <Badge 
                          variant="outline" 
                          className={`text-xs ${
                            displayQuotation.dealer.role === "admin" 
                              ? "border-purple-500 text-purple-700 dark:text-purple-400" 
                              : "border-blue-500 text-blue-700 dark:text-blue-400"
                          }`}
                        >
                          {displayQuotation.dealer.role === "admin" ? "Admin" : "Dealer"}
                        </Badge>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Role</p>
                        <p className="text-sm font-semibold capitalize">
                          {displayQuotation.dealer.role}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Phone className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Phone Number</p>
                        <a
                          href={`tel:${displayQuotation.dealer.mobile}`}
                          className="text-sm font-semibold text-primary hover:underline"
                          title="Click to call"
                        >
                          {displayQuotation.dealer.mobile}
                        </a>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Mail className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Email Address</p>
                        <a
                          href={`mailto:${displayQuotation.dealer.email}`}
                          className="text-sm font-semibold text-primary hover:underline"
                          title="Click to send email"
                        >
                          {displayQuotation.dealer.email}
                        </a>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <CreditCard className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Username</p>
                        <p className="text-sm font-semibold">
                          {displayQuotation.dealer.username}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

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
                      <>
                        {products.dcrPanelBrand && products.dcrPanelSize && products.dcrPanelQuantity && (
                          <div>
                            <span className="font-semibold">DCR Panels (With Subsidy): </span>
                            {products.dcrPanelBrand} {products.dcrPanelSize} × {products.dcrPanelQuantity}
                            <span className="text-xs text-muted-foreground ml-1">
                              (Total: {((Number.parseFloat(products.dcrPanelSize.replace("W", "")) * products.dcrPanelQuantity) / 1000).toFixed(2)}kW)
                            </span>
                          </div>
                        )}
                        {products.nonDcrPanelBrand && products.nonDcrPanelSize && products.nonDcrPanelQuantity && (
                          <div>
                            <span className="font-semibold">Non-DCR Panels (Without Subsidy): </span>
                            {products.nonDcrPanelBrand} {products.nonDcrPanelSize} × {products.nonDcrPanelQuantity}
                            <span className="text-xs text-muted-foreground ml-1">
                              (Total: {((Number.parseFloat(products.nonDcrPanelSize.replace("W", "")) * products.nonDcrPanelQuantity) / 1000).toFixed(2)}kW)
                            </span>
                          </div>
                        )}
                      </>
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
                          const discountAmount = pricingEditForm.discount || 0
                          // Ensure discount doesn't exceed amount after subsidy
                          const maxDiscount = Math.max(0, amountAfterSubsidy)
                          const validDiscount = Math.min(discountAmount, maxDiscount)
                          const newFinalAmount = amountAfterSubsidy - validDiscount
                          setPricingEditForm({
                            ...pricingEditForm,
                            subtotal: newSubtotal,
                            discount: validDiscount, // Update discount if it exceeds max
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
                          const discountAmount = pricingEditForm.discount || 0
                          // Ensure discount doesn't exceed amount after subsidy
                          const maxDiscount = Math.max(0, amountAfterSubsidy)
                          const validDiscount = Math.min(discountAmount, maxDiscount)
                          const newFinalAmount = amountAfterSubsidy - validDiscount
                          setPricingEditForm({
                            ...pricingEditForm,
                            stateSubsidy: newStateSubsidy,
                            discount: validDiscount, // Update discount if it exceeds max
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
                          const discountAmount = pricingEditForm.discount || 0
                          // Ensure discount doesn't exceed amount after subsidy
                          const maxDiscount = Math.max(0, amountAfterSubsidy)
                          const validDiscount = Math.min(discountAmount, maxDiscount)
                          const newFinalAmount = amountAfterSubsidy - validDiscount
                          setPricingEditForm({
                            ...pricingEditForm,
                            centralSubsidy: newCentralSubsidy,
                            discount: validDiscount, // Update discount if it exceeds max
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
                        value={pricingEditForm.discount || ""}
                        onChange={(e) => {
                          const value = Number.parseFloat(e.target.value) || 0
                          const totalSubsidy = pricingEditForm.stateSubsidy + pricingEditForm.centralSubsidy
                          const amountAfterSubsidy = pricingEditForm.subtotal - totalSubsidy
                          // Discount is now amount in INR, not percentage
                          // Ensure discount doesn't exceed amount after subsidy
                          const maxDiscount = Math.max(0, amountAfterSubsidy)
                          const newDiscountAmount = Math.min(value, maxDiscount)
                          const newFinalAmount = amountAfterSubsidy - newDiscountAmount
                          setPricingEditForm({
                            ...pricingEditForm,
                            discount: newDiscountAmount,
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
                          // When final amount is manually changed, recalculate discount
                          // Discount = Amount After Subsidy - Final Amount
                          const calculatedDiscount = Math.max(0, amountAfterSubsidy - value)
                          const maxDiscount = Math.max(0, amountAfterSubsidy)
                          const validDiscount = Math.min(calculatedDiscount, maxDiscount)
                          
                          setPricingEditForm({
                            ...pricingEditForm,
                            discount: validDiscount,
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
                              discount: resetDiscountAmount, // Now stores discount amount in INR
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
                              const response = await api.quotations.updatePricing(displayQuotation.id, {
                                subtotal: pricingEditForm.subtotal,
                                stateSubsidy: pricingEditForm.stateSubsidy,
                                centralSubsidy: pricingEditForm.centralSubsidy,
                                discount: pricingEditForm.discount,
                                finalAmount: pricingEditForm.finalAmount,
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
                                  discount: response.discount ?? pricingEditForm.discount,
                                  totalAmount: response.totalAmount ?? response.pricing?.totalAmount ?? pricingEditForm.subtotal,
                                  finalAmount: response.finalAmount ?? response.pricing?.finalAmount ?? pricingEditForm.finalAmount,
                                  pricing: response.pricing,
                                }
                                
                                setFullQuotation(updatedQuotation)
                                setDiscount(response.discount ?? pricingEditForm.discount)
                                setIsEditingPricing(false)
                                setIsEditingDiscount(false)
                                
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
                              
                              const updatedQuotation = {
                                ...displayQuotation,
                                products: updatedProducts,
                                discount: pricingEditForm.discount,
                                totalAmount: pricingEditForm.subtotal,
                                finalAmount: pricingEditForm.finalAmount,
                              }
                              
                              setFullQuotation(updatedQuotation)
                              setDiscount(pricingEditForm.discount)
                              setIsEditingPricing(false)
                              setIsEditingDiscount(false)
                              
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
                      <div className="flex items-center justify-between mb-2">
                        <span>Discount:</span>
                        {isEditingDiscount ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">₹</span>
                            <Input
                              type="number"
                              min="0"
                              value={discount || ""}
                              onChange={(e) => {
                                const value = Number.parseFloat(e.target.value) || 0
                                // Ensure discount doesn't exceed amount after subsidy
                                const amountAfterSubsidy = subtotal - totalSubsidy
                                const maxDiscount = Math.max(0, amountAfterSubsidy)
                                setDiscount(Math.min(value, maxDiscount))
                              }}
                              className="w-28 h-8 text-sm"
                              placeholder="0"
                            />
                            <Button
                              size="sm"
                              onClick={handleSaveDiscount}
                              className="h-8 text-xs"
                            >
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                // Get discount amount (handle both old percentage and new amount formats)
                                const savedDiscountValue = displayQuotation.discount || 0
                                let discountToSet = savedDiscountValue
                                if (savedDiscountValue <= 100) {
                                  // Old percentage format, calculate amount
                                  const amountAfterSubsidy = subtotal - totalSubsidy
                                  discountToSet = amountAfterSubsidy * (savedDiscountValue / 100)
                                }
                                setDiscount(discountToSet)
                                setIsEditingDiscount(false)
                              }}
                              className="h-8 text-xs"
                            >
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className={discountAmount > 0 ? "text-orange-600" : ""}>
                              {discountAmount > 0 ? `₹${discountAmount.toLocaleString()}` : "₹0"}
                            </span>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                // Initialize discount for editing (handle both old percentage and new amount formats)
                                const savedDiscountValue = displayQuotation.discount || 0
                                let discountToEdit = savedDiscountValue
                                if (savedDiscountValue <= 100) {
                                  // Old percentage format, calculate amount for editing
                                  const amountAfterSubsidy = subtotal - totalSubsidy
                                  discountToEdit = amountAfterSubsidy * (savedDiscountValue / 100)
                                }
                                setDiscount(discountToEdit)
                                setIsEditingDiscount(true)
                              }}
                              className="h-6 text-xs"
                            >
                              Edit
                            </Button>
                          </div>
                        )}
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

            {/* Payment Mode Selection - Only for Account Management */}
            {isAccountManagement && (
              <Card className="border-blue-200 dark:border-blue-800">
                <CardHeader className="bg-blue-50 dark:bg-blue-950/20">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    Payment Mode Selection
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="payment-mode">Select Payment Mode *</Label>
                    <Select
                      value={paymentMode}
                      onValueChange={(value) => setPaymentMode(value)}
                      disabled={isSavingPaymentMode}
                    >
                      <SelectTrigger id="payment-mode" className="w-full">
                        <SelectValue placeholder="Select payment mode" />
                      </SelectTrigger>
                      <SelectContent>
                        {paymentModes.map((mode) => (
                          <SelectItem key={mode.value} value={mode.value}>
                            {mode.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {paymentMode && (
                      <div className="flex items-center justify-end gap-2 pt-2">
                        <Button
                          onClick={async () => {
                            if (!paymentMode) {
                              toast({
                                title: "Error",
                                description: "Please select a payment mode",
                                variant: "destructive",
                              })
                              return
                            }
                            
                            setIsSavingPaymentMode(true)
                            try {
                              if (useApi) {
                                // Update payment mode via API
                                // Note: Backend needs to support this endpoint
                                // For now, we'll update locally and show a message
                                const updatedQuotation = {
                                  ...displayQuotation,
                                  paymentMode: paymentMode,
                                }
                                setFullQuotation(updatedQuotation)
                                
                                toast({
                                  title: "Success",
                                  description: `Payment mode set to ${paymentModes.find(m => m.value === paymentMode)?.label}`,
                                })
                              } else {
                                // Fallback to localStorage
                                const allQuotations = JSON.parse(localStorage.getItem("quotations") || "[]")
                                const updatedQuotations = allQuotations.map((q: Quotation) => {
                                  if (q.id === displayQuotation.id) {
                                    return {
                                      ...q,
                                      paymentMode: paymentMode,
                                    }
                                  }
                                  return q
                                })
                                localStorage.setItem("quotations", JSON.stringify(updatedQuotations))
                                
                                const updatedQuotation = {
                                  ...displayQuotation,
                                  paymentMode: paymentMode,
                                }
                                setFullQuotation(updatedQuotation)
                                
                                toast({
                                  title: "Success",
                                  description: `Payment mode set to ${paymentModes.find(m => m.value === paymentMode)?.label}`,
                                })
                              }
                            } catch (error) {
                              console.error("Error updating payment mode:", error)
                              toast({
                                title: "Error",
                                description: error instanceof Error ? error.message : "Failed to update payment mode",
                                variant: "destructive",
                              })
                            } finally {
                              setIsSavingPaymentMode(false)
                            }
                          }}
                          disabled={isSavingPaymentMode || !paymentMode}
                          className="gap-2"
                        >
                          <Save className="w-4 h-4" />
                          {isSavingPaymentMode ? "Saving..." : "Save Payment Mode"}
                        </Button>
                      </div>
                    )}
                  </div>
                  {displayQuotation.paymentMode && (
                    <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                      <p className="text-sm text-muted-foreground mb-1">Current Payment Mode:</p>
                      <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">
                        {paymentModes.find(m => m.value === displayQuotation.paymentMode)?.label || displayQuotation.paymentMode}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

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
                  let currentDiscountAmount = pricingEditForm.discount || 0
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
                    discount: currentDiscountAmount, // Store discount as amount in INR
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
                        discount: currentDiscountAmount, // Now passes discount amount in INR
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
                        setDiscount(pricingResponse.discount ?? currentDiscountAmount) // Store discount amount
                        
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

