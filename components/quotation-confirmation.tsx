"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { type Customer, type ProductSelection, useQuotation } from "@/lib/quotation-context"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, Check, FileText, Download, Edit, AlertCircle } from "lucide-react"
import { savePdfForDevice } from "@/lib/mobile-pdf"
import { QuotationProposalPdf } from "@/components/quotation-proposal-pdf"
import { formatPersonName } from "@/lib/name-display"
import { buildQuotationProposalDocumentData } from "@/lib/quotation-proposal-document"
import { exportProposalPagesToPdf } from "@/lib/quotation-pdf-export"
import {
  formatPanelBrandLineForPdf,
  formatPanelSizeWithQuantityForPdf,
  getPdfInverterLine,
  getPdfPanelSpecLine,
  resolvePdfPanelRangeKey,
  shouldHidePanelQuantityOnPdf,
} from "@/lib/quotation-pdf-display"

interface Props {
  customer: Customer
  products: ProductSelection
  onBack: () => void
  onEditCustomer?: () => void
  onEditProducts?: () => void
}

// Company Information
const companyInfo = {
  name: "ChairBord Pvt. Ltd.",
  tagline: "Base of Innovation",
  address: "Plot No. 10, Ground Floor, Shri Shyam Vihar, Kalwar Road, Jhotwara, Jaipur, Rajasthan, India - 302012",
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
  resolveQuotationPhase,
  formatQuotationPhaseLabel,
} from "@/lib/pricing-tables"

// Get system price based on system type
const getSystemPrice = (products: ProductSelection): number => {
  if (!products || !products.systemType) {
    return products?.systemPrice || 0
  }
  
  if (products.systemType === "dcr") {
    if (!products.panelSize || !products.panelQuantity) {
      // Fallback to stored systemPrice if available
      return products.systemPrice || 0
    }
    const systemSize = calculateSystemSize(products.panelSize, products.panelQuantity)
    if (systemSize === "0kW") {
      return products.systemPrice || 0
    }
    const phase = (products.phase as "1-Phase" | "3-Phase") || determinePhase(systemSize, products.inverterSize)
    const price = getDcrPrice(systemSize, phase, products.inverterSize, products.panelBrand)
    if (price !== null) return price
    // Fallback to stored systemPrice if price lookup fails
    return products.systemPrice || 0
  } else if (products.systemType === "non-dcr") {
    if (!products.panelSize || !products.panelQuantity) {
      return products.systemPrice || 0
    }
    const systemSize = calculateSystemSize(products.panelSize, products.panelQuantity)
    if (systemSize === "0kW") {
      return products.systemPrice || 0
    }
    const phase = (products.phase as "1-Phase" | "3-Phase") || determinePhase(systemSize, products.inverterSize)
    const price = getNonDcrPrice(systemSize, phase, products.inverterSize, products.panelBrand)
    if (price !== null) return price
    // Fallback to stored systemPrice if price lookup fails
    return products.systemPrice || 0
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
    // Fallback to stored systemPrice if price lookup fails
    return products.systemPrice || 0
  }
  
  // Final fallback: use stored systemPrice if available
  return products.systemPrice || 0
}

export function QuotationConfirmation({ customer, products, onBack, onEditCustomer, onEditProducts }: Props) {
  const router = useRouter()
  const { saveQuotation, clearCurrent } = useQuotation()
  const { dealer: authDealer } = useAuth()
  const [discountAmount, setDiscountAmount] = useState(0)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generated, setGenerated] = useState(false)
  const [quotationId, setQuotationId] = useState("")
  
  // Editable subtotal state (for DCR, NON DCR, BOTH system types)
  const [editableSubtotal, setEditableSubtotal] = useState<number | null>(null)
  
  // Calculate prices first (needed for fallback initialization)
  // For DCR, NON DCR, and BOTH: Use SET PRICE (complete package price)
  const systemPrice = getSystemPrice(products)
  const defaultSubtotal = products.systemPrice && products.systemPrice > 0 ? products.systemPrice : systemPrice > 0 ? systemPrice : 0
  
  // For DCR, NON DCR, and BOTH: Use set price (complete package)
  // Set price includes: panels, inverter, structure, meter, cables, ACDB, DCDB
  // Priority: 1. Editable subtotal (user modified), 2. Stored system price from config selection, 3. Calculated system price
  const subtotal = editableSubtotal !== null && editableSubtotal > 0
    ? editableSubtotal 
    : defaultSubtotal
  
  // Initialize editable subtotal with system price when component mounts or system changes
  useEffect(() => {
    if (products.systemType !== "customize") {
      // Priority: Use stored system price from config selection, otherwise calculate
      // Always prioritize products.systemPrice first (from config selection)
      const priceToUse = products.systemPrice && products.systemPrice > 0 
        ? products.systemPrice 
        : (systemPrice > 0 ? systemPrice : 0)
      
      console.log("Initializing editableSubtotal:", {
        productsSystemPrice: products.systemPrice,
        calculatedPrice: systemPrice,
        priceToUse,
        currentEditableSubtotal: editableSubtotal,
        systemType: products.systemType,
      })
      
      if (priceToUse > 0 && Number.isFinite(priceToUse)) {
        // Always update if we have a valid price (even if editableSubtotal is already set)
        // This ensures it's always in sync with the system price
        if (editableSubtotal === null || editableSubtotal !== priceToUse) {
          console.log("Setting editableSubtotal to:", priceToUse)
          setEditableSubtotal(priceToUse)
        }
      } else {
        console.warn("Cannot initialize editableSubtotal - priceToUse is invalid:", priceToUse, {
          productsSystemPrice: products.systemPrice,
          calculatedSystemPrice: systemPrice,
        })
        // If we have products.systemPrice but it's 0 or invalid, still set it to ensure the field is initialized
        // This will help catch the issue earlier
        if (products.systemPrice !== undefined && editableSubtotal === null) {
          console.warn("Setting editableSubtotal to products.systemPrice even though it's invalid:", products.systemPrice)
          setEditableSubtotal(products.systemPrice)
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products.systemType, products.systemPrice, products.panelSize, products.panelQuantity, products.inverterSize, products.panelBrand, systemPrice])
  
  // Additional check: If editableSubtotal is null but we have a valid subtotal, initialize it
  useEffect(() => {
    if (products.systemType !== "customize" && editableSubtotal === null && subtotal > 0) {
      console.log("Fallback initialization of editableSubtotal from subtotal:", subtotal)
      setEditableSubtotal(subtotal)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtotal])
  
  // Calculate pricing values (matching backend controller logic)
  const totalSubsidy = (products.centralSubsidy || 0) + (products.stateSubsidy || 0)
  // Subtotal = System Price (set price - complete package price)
  const totalProjectCost = subtotal // Alias for clarity (Subtotal = System Price)
  
  // Calculate amount after subsidy: Subtotal - Total Subsidy
  const amountAfterSubsidy = subtotal - totalSubsidy
  
  const sanitizedDiscountAmount = Math.max(0, discountAmount)
  
  // totalAmount = Amount after discount (Subtotal - Subsidy - Discount)
  const totalAmount = Math.max(amountAfterSubsidy - sanitizedDiscountAmount, 0)
  
  // finalAmount = Subtotal - Subsidy (discount is NOT applied to final amount)
  // This is the final amount before discount
  const finalAmount = subtotal - totalSubsidy

  // Calculate quotation validity (7 days from today)
  const quotationDate = new Date()
  const validityDate = new Date(quotationDate)
  validityDate.setDate(validityDate.getDate() + 7)

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    })
  }

  const handleGenerate = async () => {
    setIsGenerating(true)

    try {
      // Priority order for subtotal:
      // 1. editableSubtotal state (most reliable - synced with input) - but only if > 0
      // 2. Input field value (what user sees)
      // 3. products.systemPrice (stored from config selection) - HIGHEST PRIORITY if editableSubtotal is 0/null
      // 4. Calculated systemPrice (fallback)
      
      let currentSubtotal = 0
      
      // First priority: editableSubtotal state (this is synced with the input field)
      // BUT: Only use it if it's > 0. If it's 0 or null, we should check other sources first
      if (editableSubtotal !== null && editableSubtotal > 0 && Number.isFinite(editableSubtotal)) {
        currentSubtotal = editableSubtotal
        console.log("Using editableSubtotal state value:", currentSubtotal)
      } else {
        // If editableSubtotal is 0 or null, prioritize products.systemPrice (from config selection)
        // This is the most reliable source as it comes directly from the selected configuration
        if (products.systemPrice && products.systemPrice > 0 && Number.isFinite(products.systemPrice)) {
          currentSubtotal = products.systemPrice
          // Sync state with system price
          setEditableSubtotal(products.systemPrice)
          console.log("Using products.systemPrice (editableSubtotal was invalid):", currentSubtotal)
        } else {
          // Second priority: Try to read from input field directly
          const subtotalInput = document.getElementById("subtotal-input") as HTMLInputElement
          if (subtotalInput && subtotalInput.value) {
            const rawValue = subtotalInput.value.trim()
            const inputValue = Number.parseFloat(rawValue)
            if (inputValue > 0 && Number.isFinite(inputValue)) {
              currentSubtotal = inputValue
              // Sync state with input field value
              setEditableSubtotal(inputValue)
              console.log("Using input field value and syncing state:", currentSubtotal)
            }
          }
        }
      }
      
      // Third priority: stored system price from config selection (if not already used)
      if (currentSubtotal <= 0 && products.systemPrice && products.systemPrice > 0 && Number.isFinite(products.systemPrice)) {
        currentSubtotal = products.systemPrice
        // Sync state with system price
        setEditableSubtotal(products.systemPrice)
        console.log("Using products.systemPrice and syncing state:", currentSubtotal)
      }
      
      // Last resort: calculate from pricing tables
      if (currentSubtotal <= 0 && systemPrice > 0 && Number.isFinite(systemPrice)) {
        currentSubtotal = systemPrice
        // Sync state with calculated price
        setEditableSubtotal(systemPrice)
        console.log("Using calculated systemPrice and syncing state:", currentSubtotal)
      }
      
      // Final fallback: use the component-level subtotal calculation
      if (currentSubtotal <= 0 && subtotal > 0 && Number.isFinite(subtotal)) {
        currentSubtotal = subtotal
        // Sync state with component-level subtotal
        setEditableSubtotal(subtotal)
        console.log("Using component-level subtotal and syncing state:", currentSubtotal)
      }
      
      // Log all available values for debugging
      console.log("[QuotationConfirmation] === SUBTOTAL RESOLUTION ===")
      console.log("[QuotationConfirmation] All available values:", {
        editableSubtotal,
        productsSystemPrice: products.systemPrice,
        productsSystemPriceType: typeof products.systemPrice,
        calculatedSystemPrice: systemPrice,
        calculatedSystemPriceType: typeof systemPrice,
        componentSubtotal: subtotal,
        componentSubtotalType: typeof subtotal,
        inputFieldValue: (document.getElementById("subtotal-input") as HTMLInputElement)?.value,
        resolvedSubtotal: currentSubtotal,
        resolvedSubtotalType: typeof currentSubtotal,
        productsData: {
          systemType: products.systemType,
          panelBrand: products.panelBrand,
          panelSize: products.panelSize,
          panelQuantity: products.panelQuantity,
          inverterSize: products.inverterSize,
        }
      })
      console.log("[QuotationConfirmation] ============================")

      // CRITICAL: Final validation - subtotal must be > 0
      // This check MUST prevent sending 0 to backend
      if (!currentSubtotal || currentSubtotal <= 0 || !Number.isFinite(currentSubtotal)) {
        console.error("[QuotationConfirmation] === SUBTOTAL VALIDATION FAILED ===")
        console.error("[QuotationConfirmation] Validation failed:", {
          currentSubtotal,
          type: typeof currentSubtotal,
          isFinite: Number.isFinite(currentSubtotal),
          isNull: currentSubtotal === null,
          isUndefined: currentSubtotal === undefined,
          isZero: currentSubtotal === 0,
          editableSubtotal,
          productsSystemPrice: products.systemPrice,
          calculatedSystemPrice: systemPrice,
          componentSubtotal: subtotal,
          inputFieldValue: (document.getElementById("subtotal-input") as HTMLInputElement)?.value,
          productsData: products,
        })
        console.error("[QuotationConfirmation] ==================================")
        
        // Provide helpful error message
        let errorMsg = `Subtotal is required and must be greater than 0.\n\n`
        errorMsg += `Current value: ${currentSubtotal}\n\n`
        errorMsg += `Available values:\n`
        errorMsg += `- Input field: ${(document.getElementById("subtotal-input") as HTMLInputElement)?.value || "empty"}\n`
        errorMsg += `- Stored system price: ${products.systemPrice || "not set"}\n`
        errorMsg += `- Calculated price: ${systemPrice || "0"}\n\n`
        errorMsg += `Please ensure:\n`
        errorMsg += `1. A system configuration is selected (Browse DCR/NON DCR/BOTH Configurations)\n`
        errorMsg += `2. The system price is displayed in the Subtotal field\n`
        errorMsg += `3. If the Subtotal field is empty, enter a valid amount (e.g., 300000)\n\n`
        errorMsg += `If this error persists, please go back to Product Selection and select a configuration again.`
        
        alert(errorMsg)
        setIsGenerating(false)
        return
      }
      
      // Ensure currentSubtotal is a valid number (double-check)
      const finalSubtotal = Number(currentSubtotal)
      if (!Number.isFinite(finalSubtotal) || finalSubtotal <= 0) {
        console.error("[QuotationConfirmation] Final subtotal validation failed after conversion:", {
          original: currentSubtotal,
          converted: finalSubtotal,
          isFinite: Number.isFinite(finalSubtotal),
          isZero: finalSubtotal === 0,
        })
        alert(`Invalid subtotal value: ${finalSubtotal}. Cannot proceed. Please enter a valid amount in the Subtotal field.`)
        setIsGenerating(false)
        return
      }
      
      // TRIPLE-CHECK: Ensure finalSubtotal is still valid
      if (finalSubtotal <= 0 || !Number.isFinite(finalSubtotal)) {
        console.error("[QuotationConfirmation] CRITICAL: finalSubtotal is invalid:", finalSubtotal)
        alert(`Cannot proceed: Subtotal is invalid (${finalSubtotal}). Please ensure a valid system configuration is selected.`)
        setIsGenerating(false)
        return
      }

      // Recalculate all pricing values with the correct subtotal (matching backend logic)
      const finalTotalSubsidy = (products.centralSubsidy || 0) + (products.stateSubsidy || 0)
      const finalAmountAfterSubsidy = finalSubtotal - finalTotalSubsidy
      const finalDiscountAmount = sanitizedDiscountAmount
      
      // totalAmount = Amount after discount (Subtotal - Subsidy - Discount)
      const finalTotalAmount = finalAmountAfterSubsidy - finalDiscountAmount
      
      // finalAmount now matches totalAmount (after discount)
      const finalFinalAmount = finalTotalAmount

      // Log values before sending - CRITICAL for debugging (matching backend log format)
      console.log("[QuotationConfirmation] === FINAL VALUES BEING SENT ===")
      console.log("[QuotationConfirmation] Pricing calculations:", {
        subtotal: finalSubtotal,
        centralSubsidy: products.centralSubsidy || 0,
        stateSubsidy: products.stateSubsidy || 0,
        totalSubsidy: finalTotalSubsidy,
        amountAfterSubsidy: finalAmountAfterSubsidy,
        discount: sanitizedDiscountAmount,
        discountAmount: finalDiscountAmount,
        totalAmount: finalTotalAmount, // Amount after discount
        finalAmount: finalFinalAmount, // Amount after discount (matches totalAmount)
      })
      console.log("[QuotationConfirmation] Source values:", {
        editableSubtotal,
        inputFieldValue: (document.getElementById("subtotal-input") as HTMLInputElement)?.value,
        productsSystemPrice: products.systemPrice,
        calculatedSystemPrice: systemPrice,
      })
      console.log("[QuotationConfirmation] ==============================")

      // CRITICAL: Final check right before sending - ensure subtotal is still valid
      if (!finalSubtotal || finalSubtotal <= 0 || !Number.isFinite(finalSubtotal)) {
        console.error("CRITICAL: Subtotal is invalid right before API call:", {
          finalSubtotal,
          type: typeof finalSubtotal,
          isFinite: Number.isFinite(finalSubtotal),
          currentSubtotal,
          editableSubtotal,
          productsSystemPrice: products.systemPrice,
          calculatedSystemPrice: systemPrice,
          componentSubtotal: subtotal,
        })
        alert(`Cannot create quotation: Subtotal is invalid (${finalSubtotal}). Please ensure a valid system configuration is selected and the subtotal field has a value greater than 0.`)
        setIsGenerating(false)
        return
      }

      // CRITICAL: Final check right before API call - ensure subtotal is still valid
      // This is the last line of defense before sending to backend
      if (!finalSubtotal || finalSubtotal <= 0 || !Number.isFinite(finalSubtotal)) {
        console.error("[QuotationConfirmation] CRITICAL ERROR: finalSubtotal is invalid right before API call:", {
          finalSubtotal,
          type: typeof finalSubtotal,
          isFinite: Number.isFinite(finalSubtotal),
          currentSubtotal,
          editableSubtotal,
          productsSystemPrice: products.systemPrice,
          calculatedSystemPrice: systemPrice,
          componentSubtotal: subtotal,
        })
        alert(`Cannot create quotation: Subtotal is invalid (${finalSubtotal}). Please ensure a valid system configuration is selected and the subtotal field has a value greater than 0.`)
        setIsGenerating(false)
        return
      }

      // Save quotation via API
      // finalSubtotal is now the total project cost (subtotal) - aligned with backend
      // This MUST be > 0, otherwise backend will reject it
      console.log("[QuotationConfirmation] Calling saveQuotation with:", { 
        discount: sanitizedDiscountAmount, 
        subtotal: finalSubtotal,
        subtotalType: typeof finalSubtotal,
        isFinite: Number.isFinite(finalSubtotal),
        isValid: finalSubtotal > 0
      })
      const quotation = await saveQuotation(sanitizedDiscountAmount, finalSubtotal)
      setQuotationId(quotation.id)

      setIsGenerating(false)
      setGenerated(true)
      
      // Clear current data after successful generation
      clearCurrent()
      
      // Redirect to quotations page after a short delay
      setTimeout(() => {
        router.push("/dashboard/quotations")
      }, 2000)
    } catch (error) {
      console.error("Error generating quotation:", error)
      console.error("Products data:", products)
      setIsGenerating(false)
      
      // Show error to user with more details
      let errorMessage = "Failed to generate quotation. Please try again."
      
      if (error instanceof Error) {
        errorMessage = error.message
        
        // Handle ApiError with specific error codes
        if (error.name === "ApiError") {
          const apiError = error as any
          const errorCode = apiError.code
          const errorDetails = apiError.details
          
          // Handle specific validation errors
          if (errorCode === "VAL_001") {
            errorMessage = "Subtotal Validation Error\n\n"
            errorMessage += "Subtotal is required and must be greater than 0.\n\n"
            if (errorDetails && Array.isArray(errorDetails)) {
              errorMessage += "Details:\n"
              errorDetails.forEach((d: any) => {
                errorMessage += `- ${d.field}: ${d.message}\n`
              })
            }
            errorMessage += "\nPlease ensure:\n"
            errorMessage += "1. A system configuration is selected (Browse DCR/NON DCR/BOTH Configurations)\n"
            errorMessage += "2. The system price is displayed in the Subtotal field\n"
            errorMessage += "3. If the Subtotal field is empty, enter a valid amount (e.g., 300000)"
          } else if (errorCode === "VAL_002") {
            errorMessage = "Total Amount Validation Error\n\n"
            errorMessage += "Total amount is required.\n\n"
            if (errorDetails && Array.isArray(errorDetails)) {
              errorMessage += "Details:\n"
              errorDetails.forEach((d: any) => {
                errorMessage += `- ${d.field}: ${d.message}\n`
              })
            }
            errorMessage += "\nThis error should not occur. Please contact support if you see this message."
          } else if (errorCode === "VAL_003") {
            errorMessage = "Final Amount Validation Error\n\n"
            errorMessage += "Final amount is required.\n\n"
            if (errorDetails && Array.isArray(errorDetails)) {
              errorMessage += "Details:\n"
              errorDetails.forEach((d: any) => {
                errorMessage += `- ${d.field}: ${d.message}\n`
              })
            }
            errorMessage += "\nThis error should not occur. Please contact support if you see this message."
          } else if (errorCode === "SYS_001" || errorMessage === "Internal server error") {
            errorMessage =
              "The server failed while saving the quotation (internal error).\n\n" +
              "Common causes:\n" +
              "• Product catalog mismatch (panel/inverter size not in backend catalog)\n" +
              "• Server database or deployment issue\n\n" +
              "Please try again. If it persists, contact support with the browser console logs (F12 → Console)."
          } else if (errorDetails && Array.isArray(errorDetails) && errorDetails.length > 0) {
            // Generic ApiError with details
            errorMessage = `${error.message}\n\nDetails:\n${errorDetails.map((d: any) => `- ${d.field || "unknown field"}: ${d.message}`).join("\n")}`
          }
        }
        
        // If error mentions panel size, provide helpful context
        if (errorMessage.includes("panel size") || errorMessage.includes("Invalid product")) {
          errorMessage += "\n\nNote: The panel size must match the backend product catalog. Please ensure the panel size is valid or contact support to add it to the catalog."
        }
        
        // If error mentions inverter size, provide helpful context
        if (errorMessage.includes("inverter size") || errorMessage.includes("Invalid inverter")) {
          errorMessage += "\n\nNote: The inverter size must match the backend product catalog. Common sizes are: 3kW, 5kW, 6kW, 8kW, 10kW, 12kW, 15kW, 20kW, 25kW, 30kW, 50kW, 100kW. Please ensure the inverter size is valid or contact support to add it to the catalog."
        }
      }
      
      alert(errorMessage)
    }
  }

  const proposalPdfData = useMemo(
    () =>
      buildQuotationProposalDocumentData({
        quotationId: quotationId || `QT${Date.now().toString().slice(-6)}`,
        customer,
        products,
        company: companyInfo,
        banks: bankDetails,
        subtotal,
        totalAmount,
        quotationDate,
        validityDate,
      }),
    [quotationId, customer, products, authDealer, subtotal, totalAmount, quotationDate, validityDate],
  )

  const generatePDF = async () => {
      const sanitizeSegment = (value: string) =>
        value
          .trim()
          .replace(/\s+/g, "_")
          .replace(/[^a-zA-Z0-9_-]/g, "")
          .replace(/_+/g, "_")
      const customerName =
        sanitizeSegment(formatPersonName(customer.firstName, customer.lastName, "Customer")) || "Customer"
      const safeQuotationId = sanitizeSegment(quotationId) || "Quotation"
    const filename = `Solar_Proposal_${customerName}_${safeQuotationId}.pdf`

    try {
      await exportProposalPagesToPdf("quotation-content", filename, savePdfForDevice)
    } catch (error) {
      console.error("Error generating PDF:", error)
      alert("Could not generate PDF. Please try again.")
    }
  }

  const handleNewQuotation = () => {
    clearCurrent()
    router.push("/dashboard/new-quotation")
  }

  // Get unique brands for Make table
  const getUniqueBrands = () => {
    return products.panelBrand || "N/A"
  }

  const getInverterDetails = () => getPdfInverterLine(products)

  const getSystemSizes = () => {
    if (products.systemType === "both") {
      const dcrRange = resolvePdfPanelRangeKey(products, "dcr")
      const nonDcrRange = resolvePdfPanelRangeKey(products, "nonDcr")
      const dcrSize =
        products.dcrPanelSize
          ? formatPanelSizeWithQuantityForPdf(
              products.dcrPanelSize,
              products.dcrPanelQuantity,
              dcrRange,
            )
          : ""
      const nonDcrSize =
        products.nonDcrPanelSize
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
    const primaryRange = resolvePdfPanelRangeKey(products, "primary")
    return (
      formatPanelSizeWithQuantityForPdf(products.panelSize, products.panelQuantity, primaryRange) ||
      "As per selection"
    )
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

  const roundedSystemSizeLabel = getRoundedSystemSizeLabel()
  const pdfResolvedPhase = resolveQuotationPhase(products)
  const pdfPhaseLabel = formatQuotationPhaseLabel(pdfResolvedPhase)

  // Generate dynamic PDF title: "{systemSize}kW ({phase}) Solar System - {panelBrand} Panels"
  const getPdfSystemTitle = () => {
  const phase = pdfResolvedPhase

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

const getStructureDetails = (products: ProductSelection) => {
  const type = products.structureType || ""
  const size = products.structureSize || ""
  if (!type && !size) {
    return "Tata / Appollo GI Pipe, etc."
  }
  if (type && size) {
    return `${type} (${size})`
  }
  return type || size
}


  return (
    <div className="space-y-6">
      {/* Hidden PDF — 3-page Solar Installation Proposal */}
      <QuotationProposalPdf data={proposalPdfData} />

      {/* UI elements for the web page */}
      <div>
        {/* Summary Card */}
        <Card className="shadow-lg border-border/50">
          <CardHeader>
            <CardTitle className="text-lg sm:text-xl">Quotation Summary</CardTitle>
            <CardDescription className="text-sm">Review and confirm the quotation details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 sm:space-y-6">
            {/* Customer Info */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                  Customer Information
                </h3>
                {!generated && onEditCustomer && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onEditCustomer}
                    className="h-8 text-xs"
                  >
                    <Edit className="w-3 h-3 mr-1" />
                    Edit
                  </Button>
                )}
              </div>
              <div className="bg-muted/50 rounded-xl p-3 sm:p-4 border border-border">
                <p className="font-semibold text-sm sm:text-base text-foreground">
                  {formatPersonName(customer.firstName, customer.lastName, "—")}
                </p>
                <p className="text-xs sm:text-sm text-muted-foreground">{customer.mobile}</p>
                <p className="text-xs sm:text-sm text-muted-foreground">{customer.email}</p>
                <p className="text-xs sm:text-sm text-muted-foreground mt-2">
                  {customer.address?.street || ""}, {customer.address?.city || ""}, {customer.address?.state || ""} -{" "}
                  {customer.address?.pincode || ""}
                </p>
              </div>
            </div>

            {/* System Config */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                  System Configuration
                </h3>
                {!generated && onEditProducts && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onEditProducts}
                    className="h-8 text-xs"
                  >
                    <Edit className="w-3 h-3 mr-1" />
                    Edit
                  </Button>
                )}
              </div>
              <div className="bg-muted/50 rounded-xl p-4 space-y-3 border border-border">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">System Type</span>
                  <span className="text-sm font-semibold uppercase px-3 py-1 bg-primary/10 text-primary rounded-full">
                    {products.systemType}
                  </span>
                </div>
                {products.systemType === "both" ? (
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                    <div className="min-w-0 flex-1 space-y-1 text-sm">
                      <span className="text-sm font-semibold text-foreground block">Panels (BOTH)</span>
                      {roundedSystemSizeLabel && (
                        <p className="text-xs text-muted-foreground">System Size: {roundedSystemSizeLabel}</p>
                      )}
                      {products.dcrPanelBrand &&
                        products.dcrPanelSize &&
                        (products.dcrPanelQuantity > 0 || shouldHidePanelQuantityOnPdf(products, "dcr")) && (
                        <p className="text-sm font-medium text-foreground">
                          <span className="text-muted-foreground">DCR (subsidy)</span>{" "}
                          {formatPanelBrandLineForPdf(
                            products.dcrPanelBrand,
                            products.dcrPanelSize,
                            products.dcrPanelQuantity,
                            resolvePdfPanelRangeKey(products, "dcr"),
                          )}
                          {!shouldHidePanelQuantityOnPdf(products, "dcr") && (
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
                      {products.nonDcrPanelBrand &&
                        products.nonDcrPanelSize &&
                        (products.nonDcrPanelQuantity > 0 ||
                          shouldHidePanelQuantityOnPdf(products, "nonDcr")) && (
                        <p className="text-sm font-medium text-foreground">
                          <span className="text-muted-foreground">Non-DCR</span>{" "}
                          {formatPanelBrandLineForPdf(
                            products.nonDcrPanelBrand,
                              products.nonDcrPanelSize,
                            products.nonDcrPanelQuantity,
                            resolvePdfPanelRangeKey(products, "nonDcr"),
                          )}
                          {!shouldHidePanelQuantityOnPdf(products, "nonDcr") && (
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
                    <div className="sm:border-l sm:border-border sm:pl-4 min-w-0 sm:max-w-[55%] space-y-2 text-sm">
                      <span className="text-sm font-semibold text-foreground block">Common components</span>
                      <div className="flex justify-between gap-2">
                        <span className="text-muted-foreground shrink-0">Inverter</span>
                        <span className="text-sm font-medium text-right">
                          {getPdfInverterLine(products)}
                        </span>
                      </div>
                      {products.structureType && (
                        <div className="flex justify-between gap-2">
                          <span className="text-muted-foreground shrink-0">Structure</span>
                          <span className="text-sm font-medium text-right">
                            {products.structureType} ({products.structureSize})
                          </span>
                        </div>
                      )}
                      {products.meterBrand && (
                        <div className="flex justify-between gap-2">
                          <span className="text-muted-foreground shrink-0">Meter</span>
                          <span className="text-sm font-medium text-right">{products.meterBrand}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Panels</span>
                    <span className="text-sm font-medium">
                      {getPdfPanelSpecLine(products)}
                    </span>
                  </div>
                )}
                {products.systemType !== "both" && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Inverter</span>
                      <span className="text-sm font-medium">
                        {getPdfInverterLine(products)}
                      </span>
                    </div>
                    {products.structureType && (
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Structure</span>
                        <span className="text-sm font-medium">
                          {products.structureType} ({products.structureSize})
                        </span>
                      </div>
                    )}
                    {products.meterBrand && (
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Meter</span>
                        <span className="text-sm font-medium">{products.meterBrand}</span>
                      </div>
                    )}
                  </>
                )}
                {products.systemType === "hybrid" && products.batteryCapacity && (
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Battery</span>
                    <span className="text-sm font-medium">{products.batteryCapacity}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Subtotal - Only show system set price */}
            {products.systemType !== "customize" && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                    Subtotal
                  </h3>
                  <div className="border border-border rounded-xl p-4 bg-muted/30">
                    <div className="flex items-center gap-3">
                      <Label htmlFor="subtotal-input" className="text-sm font-medium min-w-[80px]">
                        Subtotal:
                      </Label>
                      <div className="flex items-center gap-2 flex-1">
                        <span className="text-sm text-muted-foreground">₹</span>
                        <Input
                          id="subtotal-input"
                          type="text"
                          inputMode="decimal"
                          value={editableSubtotal !== null && editableSubtotal > 0 ? editableSubtotal : (defaultSubtotal > 0 ? defaultSubtotal : "")}
                          onChange={(e) => {
                            const inputValue = e.target.value
                            const sanitizedValue = inputValue.replace(/[^0-9.]/g, "")
                            const newSubtotal = sanitizedValue ? Number.parseFloat(sanitizedValue) : null
                            if (newSubtotal !== null && !Number.isNaN(newSubtotal)) {
                              setEditableSubtotal(newSubtotal)
                            } else if (sanitizedValue === "") {
                              setEditableSubtotal(null)
                            }
                          }}
                          onBlur={(e) => {
                            // Ensure value is set on blur if it's valid
                            const inputValue = e.target.value
                            const sanitizedValue = inputValue.replace(/[^0-9.]/g, "")
                            const parsedValue = sanitizedValue ? Number.parseFloat(sanitizedValue) : null
                            if (parsedValue !== null && !Number.isNaN(parsedValue) && parsedValue > 0) {
                              setEditableSubtotal(parsedValue)
                            } else if (defaultSubtotal > 0) {
                              // Restore configured system price when user clears the field.
                              setEditableSubtotal(defaultSubtotal)
                            }
                          }}
                          className="flex-1"
                          placeholder="Enter subtotal"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Complete set price for the system
                    </p>
                  </div>
                </div>

                {/* Subsidy Display */}
                {totalSubsidy > 0 && (
                  <div className="border border-border rounded-xl overflow-hidden">
                    <div className="bg-muted/30 px-4 py-2 border-b border-border">
                      <h3 className="text-sm font-semibold text-foreground">Subsidy</h3>
                    </div>
                    <div className="space-y-0">
                      {products.centralSubsidy && products.centralSubsidy > 0 && (
                        <div className="flex justify-between py-3 px-4">
                          <span className="text-sm text-muted-foreground">Central Subsidy</span>
                          <span className="text-sm text-green-600 font-medium">
                            ₹{products.centralSubsidy.toLocaleString()}
                          </span>
                        </div>
                      )}
                      {(products.stateSubsidy ?? 0) > 0 && (
                        <div className="flex justify-between py-3 px-4 bg-muted/30">
                          <span className="text-sm text-muted-foreground">State Subsidy</span>
                          <span className="text-sm text-green-600 font-medium">
                            ₹{(products.stateSubsidy ?? 0).toLocaleString()}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between py-3 px-4 bg-muted/50 font-semibold border-t border-border">
                        <span className="text-sm">Total Subsidy</span>
                        <span className="text-sm text-green-600">
                          ₹{totalSubsidy.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

              </div>
            )}

            {/* Discount Input */}
            {!generated && (
              <div className="bg-muted/30 rounded-xl p-4 border border-border">
                <Label htmlFor="discount" className="text-sm font-semibold">
                  Discount Amount
                </Label>
                <div className="flex items-center gap-3 mt-2">
                  <Input
                    id="discount"
                    type="number"
                    min="0"
                    value={discountAmount || ""}
                    onChange={(e) => setDiscountAmount(Number.parseFloat(e.target.value) || 0)}
                    className="w-32 h-10"
                    placeholder="₹0"
                  />
                  {discountAmount > 0 && (
                    <span className="text-sm text-primary font-medium ml-auto">
                      -₹{discountAmount.toLocaleString()}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Final Amount */}
            <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent rounded-xl p-6 border border-primary/20">
              <div className="flex justify-between items-center">
                <span className="text-lg font-semibold text-foreground">Final Amount</span>
                <span className="text-3xl font-bold text-primary">₹{totalAmount.toLocaleString()}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Confirmation Message */}
        {!generated && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
              <AlertCircle className="w-5 h-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-blue-800 mb-1">Review Before Confirming</p>
              <p className="text-sm text-blue-700">
                Please review all the details above. You can edit customer information or product selection using the Edit buttons. 
                Once you confirm and generate the quotation, it will be saved to your quotations list.
              </p>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          {!generated ? (
            <>
              <Button variant="outline" onClick={onBack} className="sm:flex-1 h-12 bg-transparent">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Products
              </Button>
              <Button
                onClick={handleGenerate}
                disabled={isGenerating}
                className="sm:flex-1 h-12 shadow-lg shadow-primary/25 bg-primary hover:bg-primary/90"
              >
                {isGenerating ? (
                  <>
                    <div className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Confirm & Generate Quotation
                  </>
                )}
              </Button>
            </>
          ) : (
            <div className="w-full">
              <Button 
                onClick={() => router.push("/dashboard/quotations")} 
                className="w-full h-12 shadow-lg shadow-primary/25 bg-primary hover:bg-primary/90"
              >
                <FileText className="w-4 h-4 mr-2" />
                Go to Quotations
              </Button>
            </div>
          )}
        </div>

        {generated && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
              <Check className="w-6 h-6 text-green-600" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-green-800">Quotation Generated Successfully!</p>
              <p className="text-sm text-green-600">Quotation ID: {quotationId}</p>
              <p className="text-sm text-green-700 mt-1">Redirecting to quotations page... You can download the PDF from there.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
