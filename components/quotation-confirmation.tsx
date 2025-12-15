"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { type Customer, type ProductSelection, useQuotation } from "@/lib/quotation-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, Check, FileText, Download, Edit, AlertCircle } from "lucide-react"
import jsPDF from "jspdf"
import html2canvas from "html2canvas"

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

// Price calculation helpers
const getPanelPrice = (brand: string, size: string): number => {
  const basePrices: Record<string, number> = {
    Adani: 25000,
    Tata: 26000,
    Waaree: 24000,
    "Vikram Solar": 24500,
    RenewSys: 23500,
  }
  const sizeMultiplier = Number.parseInt(size) / 440
  return (basePrices[brand] || 24000) * sizeMultiplier
}

const getInverterPrice = (brand: string, size: string): number => {
  const basePrices: Record<string, number> = {
    Growatt: 35000,
    Solis: 32000,
    Fronius: 45000,
    Havells: 38000,
    Polycab: 36000,
    Delta: 40000,
  }
  const sizeKw = Number.parseInt(size)
  return (basePrices[brand] || 35000) * (sizeKw / 3)
}

export function QuotationConfirmation({ customer, products, onBack, onEditCustomer, onEditProducts }: Props) {
  const router = useRouter()
  const { saveQuotation, clearCurrent } = useQuotation()
  const [discount, setDiscount] = useState(0)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generated, setGenerated] = useState(false)
  const [quotationId, setQuotationId] = useState("")

  // Calculate prices
  const panelPrice =
    products.systemType !== "customize"
      ? getPanelPrice(products.panelBrand, products.panelSize) * products.panelQuantity
      : products.customPanels?.reduce(
          (acc, panel) => acc + getPanelPrice(panel.brand, panel.size) * panel.quantity,
          0,
        ) || 0

  const inverterPrice = getInverterPrice(products.inverterBrand, products.inverterSize)

  const structurePrice = products.structureSize ? Number.parseInt(products.structureSize) * 8000 : 0
  const meterPrice = products.meterBrand ? 5000 : 0
  const cablePrice = (products.acCableBrand ? 3000 : 0) + (products.dcCableBrand ? 3000 : 0)
  const acdbDcdbPrice = (products.acdb ? 2500 : 0) + (products.dcdb ? 2500 : 0)
  const batteryPrice = products.batteryPrice || 0

  const subtotal = panelPrice + inverterPrice + structurePrice + meterPrice + cablePrice + acdbDcdbPrice + batteryPrice
  const totalSubsidy = (products.centralSubsidy || 0) + (products.stateSubsidy || 0)
  const totalProjectCost = subtotal
  const totalAmount = subtotal - totalSubsidy
  const discountAmount = totalAmount * (discount / 100)
  const finalAmount = totalAmount - discountAmount

  // Calculate quotation validity (5 days from today)
  const quotationDate = new Date()
  const validityDate = new Date(quotationDate)
  validityDate.setDate(validityDate.getDate() + 5)

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
      // Save quotation
      const quotation = saveQuotation(discount, totalAmount)
      setQuotationId(quotation.id)

      // Simulate processing delay
      await new Promise((resolve) => setTimeout(resolve, 1500))

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
      setIsGenerating(false)
    }
  }

  const generatePDF = async () => {
    const input = document.getElementById("quotation-content")

    if (!input) {
      console.error("Quotation content element not found.")
      return
    }

    input.classList.add("pdf-rendering-styles")

    try {
      const canvas = await html2canvas(input, {
        scale: 2,
        useCORS: true,
        logging: false,
        windowWidth: input.scrollWidth,
        windowHeight: input.scrollHeight,
        backgroundColor: "#ffffff",
        removeContainer: true,
        allowTaint: false,
        foreignObjectRendering: false,
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
      const customerName = `${customer.firstName}_${customer.lastName}`.replace(/\s/g, "_")
      const filename = `Quotation_${customerName}_${formatDate(quotationDate)}.pdf`

      // Save
      pdf.save(filename)
    } catch (error) {
      console.error("Error generating PDF:", error)
    } finally {
      input.classList.remove("pdf-rendering-styles")
    }
  }

  const handleNewQuotation = () => {
    clearCurrent()
    router.push("/dashboard/new-quotation")
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
    if (products.systemType === "customize" && products.customPanels) {
      const sizes = products.customPanels.map((p) => `${p.size}W`).join(", ")
      return sizes || "As per selection"
    }
    return `${products.panelSize}W` || "As per selection"
  }

  return (
    <div className="space-y-6">
      {/* Hidden PDF Content */}
      <div
        id="quotation-content"
        className="bg-white p-4 sm:p-6 rounded-lg shadow-md"
        style={{ position: "absolute", left: "-9999px", top: "-9999px" }}
      >
        <style jsx>{`
          #quotation-content {
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
            <div className="pdf-header">
              <div className="pdf-company-logo">
                <img
                  src={companyInfo.logoUrl || "/placeholder.svg"}
                  alt="ChairBord Solar Logo"
                  style={{ height: "40px", objectFit: "contain" }}
                />
              </div>
              <div className="pdf-quotation-info">
                <div>
                  <strong>Quotation #{quotationId || `QT${Date.now().toString().slice(-6)}`}</strong>
                </div>
                <div>📅 Date: {formatDate(quotationDate)}</div>
                <div>⏰ Valid Until: {formatDate(validityDate)}</div>
              </div>
            </div>

            {/* Title */}
            <div className="pdf-quotation-title">🌞 SOLAR INSTALLATION QUOTATION 🌞</div>

            {/* Info Section - 2 columns */}
            <div className="pdf-info-section">
              <div className="pdf-info-card">
                <h3>👤 Customer Details</h3>
                <div className="pdf-info-item">
                  <strong>Name:</strong> {customer.firstName} {customer.lastName}
                </div>
                <div className="pdf-info-item">
                  <strong>Email:</strong> {customer.email}
                </div>
                <div className="pdf-info-item">
                  <strong>Phone:</strong> {customer.mobile}
                </div>
                <div className="pdf-info-item">
                  <strong>Location:</strong> {customer.address.city}, {customer.address.state}
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

            {/* Validity Notice */}
            <div className="pdf-validity-box">
              ⚠️ IMPORTANT: This quotation is valid for 5 days from issue date (Until {formatDate(validityDate)})
            </div>

            {/* Products Section */}
            <div className="pdf-products-section">
              <div className="pdf-product-category">
                <div className="pdf-category-header">📦 SOLAR SETS</div>
                <div className="pdf-product-item">
                  <div className="pdf-product-name">Solar Panel System</div>
                  <div className="pdf-product-details">
                    <div className="pdf-product-specs">
                      {products.systemType !== "customize"
                        ? `${products.panelBrand} ${products.panelSize}W × ${products.panelQuantity}`
                        : products.customPanels
                            ?.map((p) => `${p.brand} ${p.size}W × ${p.quantity}`)
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
              </div>
            </div>

            {/* Summary Section */}
            <div className="pdf-summary-section">
              <div className="pdf-summary-row">
                <span className="pdf-summary-label">💰 Total Project Cost (including GST and structure):</span>
                <span className="pdf-summary-value">₹{(totalProjectCost - discountAmount).toLocaleString()}</span>
              </div>
              {products.stateSubsidy && products.stateSubsidy > 0 && (
                <div className="pdf-summary-row">
                  <span className="pdf-summary-label">⬇️ State Subsidy:</span>
                  <span className="pdf-summary-value"> ₹{products.stateSubsidy.toLocaleString()}</span>
                </div>
              )}
              {products.centralSubsidy && products.centralSubsidy > 0 && (
                <div className="pdf-summary-row">
                  <span className="pdf-summary-label">⬇️ Central Subsidy:</span>
                  <span className="pdf-summary-value"> ₹{products.centralSubsidy.toLocaleString()}</span>
                </div>
              )}
              {discount > 0 && (
                <div className="pdf-summary-row">
                  <span className="pdf-summary-label">⬇️ Discount ({discount}%):</span>
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
            <div className="pdf-header" style={{ marginTop: "-10px" }}>
              <div className="pdf-company-logo">
                <img
                  src={companyInfo.logoUrl || "/placeholder.svg"}
                  alt="ChairBord Solar Logo"
                  style={{ height: "40px", objectFit: "contain" }}
                />
              </div>
              <div className="pdf-quotation-info">
                <div>
                  <strong>Quotation #{quotationId || `QT${Date.now().toString().slice(-6)}`}</strong>
                </div>
                <div>📅 Date: {formatDate(quotationDate)}</div>
                <div>📋 Page 2 of 2</div>
              </div>
            </div>

            {/* Title for Page 2 */}
            <div className="pdf-quotation-title">📋 TERMS & CONDITIONS</div>

            {/* Terms & Conditions Content */}
            <div
              className="pdf-terms-section"
              style={{
                flex: 1,
                marginBottom: 0,
                maxHeight: "200mm",
                overflow: "hidden",
                marginTop: "-20px",
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

      {/* UI elements for the web page */}
      <div>
        {/* Summary Card */}
        <Card className="shadow-lg border-border/50">
          <CardHeader>
            <CardTitle className="text-xl">Quotation Summary</CardTitle>
            <CardDescription>Review and confirm the quotation details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
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
              <div className="bg-muted/50 rounded-xl p-4 border border-border">
                <p className="font-semibold text-foreground">
                  {customer.firstName} {customer.lastName}
                </p>
                <p className="text-sm text-muted-foreground">{customer.mobile}</p>
                <p className="text-sm text-muted-foreground">{customer.email}</p>
                <p className="text-sm text-muted-foreground mt-2">
                  {customer.address.street}, {customer.address.city}, {customer.address.state} -{" "}
                  {customer.address.pincode}
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
                {products.systemType !== "customize" ? (
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Panels</span>
                    <span className="text-sm font-medium">
                      {products.panelBrand} {products.panelSize} × {products.panelQuantity}
                    </span>
                  </div>
                ) : (
                  <>
                    {products.customPanels?.map((panel, index) => (
                      <div key={index} className="flex justify-between">
                        <span className="text-sm text-muted-foreground">
                          Panel {index + 1} ({panel.type.toUpperCase()})
                        </span>
                        <span className="text-sm font-medium">
                          {panel.brand} {panel.size} × {panel.quantity}
                        </span>
                      </div>
                    ))}
                  </>
                )}
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Inverter</span>
                  <span className="text-sm font-medium">
                    {products.inverterBrand} {products.inverterType} ({products.inverterSize})
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
                {products.systemType === "hybrid" && products.batteryCapacity && (
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Battery</span>
                    <span className="text-sm font-medium">{products.batteryCapacity}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Pricing Breakdown */}
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                Pricing Breakdown
              </h3>
              <div className="space-y-2 border border-border rounded-xl overflow-hidden">
                <div className="flex justify-between py-3 px-4 bg-muted/30">
                  <span className="text-sm text-muted-foreground">Panel Cost</span>
                  <span className="text-sm font-medium">₹{panelPrice.toLocaleString()}</span>
                </div>
                <div className="flex justify-between py-3 px-4">
                  <span className="text-sm text-muted-foreground">Inverter Cost</span>
                  <span className="text-sm font-medium">₹{inverterPrice.toLocaleString()}</span>
                </div>
                {structurePrice > 0 && (
                  <div className="flex justify-between py-3 px-4 bg-muted/30">
                    <span className="text-sm text-muted-foreground">Structure Cost</span>
                    <span className="text-sm font-medium">₹{structurePrice.toLocaleString()}</span>
                  </div>
                )}
                {meterPrice > 0 && (
                  <div className="flex justify-between py-3 px-4">
                    <span className="text-sm text-muted-foreground">Meter Cost</span>
                    <span className="text-sm font-medium">₹{meterPrice.toLocaleString()}</span>
                  </div>
                )}
                {cablePrice > 0 && (
                  <div className="flex justify-between py-3 px-4 bg-muted/30">
                    <span className="text-sm text-muted-foreground">Cable Cost</span>
                    <span className="text-sm font-medium">₹{cablePrice.toLocaleString()}</span>
                  </div>
                )}
                {acdbDcdbPrice > 0 && (
                  <div className="flex justify-between py-3 px-4">
                    <span className="text-sm text-muted-foreground">ACDB/DCDB Cost</span>
                    <span className="text-sm font-medium">₹{acdbDcdbPrice.toLocaleString()}</span>
                  </div>
                )}
                {batteryPrice > 0 && (
                  <div className="flex justify-between py-3 px-4 bg-muted/30">
                    <span className="text-sm text-muted-foreground">Battery Cost</span>
                    <span className="text-sm font-medium">₹{batteryPrice.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between py-3 px-4 bg-muted/50 font-semibold">
                  <span className="text-sm">Subtotal</span>
                  <span className="text-sm">₹{subtotal.toLocaleString()}</span>
                </div>
                {totalSubsidy > 0 && (
                  <>
                    {products.centralSubsidy && products.centralSubsidy > 0 && (
                      <div className="flex justify-between py-3 px-4">
                        <span className="text-sm text-green-600">Central Subsidy</span>
                        <span className="text-sm text-green-600 font-medium">
                          -₹{products.centralSubsidy.toLocaleString()}
                        </span>
                      </div>
                    )}
                    {products.stateSubsidy && products.stateSubsidy > 0 && (
                      <div className="flex justify-between py-3 px-4 bg-muted/30">
                        <span className="text-sm text-green-600">State Subsidy</span>
                        <span className="text-sm text-green-600 font-medium">
                          -₹{products.stateSubsidy.toLocaleString()}
                        </span>
                      </div>
                    )}
                  </>
                )}
                <div className="flex justify-between py-3 px-4 bg-muted/50 font-semibold">
                  <span className="text-sm">Total Amount</span>
                  <span className="text-sm">₹{totalAmount.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Discount Input */}
            {!generated && (
              <div className="bg-muted/30 rounded-xl p-4 border border-border">
                <Label htmlFor="discount" className="text-sm font-semibold">
                  Apply Discount
                </Label>
                <div className="flex items-center gap-3 mt-2">
                  <Input
                    id="discount"
                    type="number"
                    min="0"
                    max="50"
                    value={discount || ""}
                    onChange={(e) => setDiscount(Math.min(50, Number.parseInt(e.target.value) || 0))}
                    className="w-24 h-10"
                    placeholder="0"
                  />
                  <span className="text-sm text-muted-foreground">% (max 50%)</span>
                  {discount > 0 && (
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
                <span className="text-3xl font-bold text-primary">₹{finalAmount.toLocaleString()}</span>
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
