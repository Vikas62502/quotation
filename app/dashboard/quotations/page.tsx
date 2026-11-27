"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { DashboardNav } from "@/components/dashboard-nav"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Search, Eye, FileText, Calendar, Download, FilePlus2, RotateCcw, History, LogIn } from "lucide-react"
import type { Quotation } from "@/lib/quotation-context"
import { QuotationDetailsDialog } from "@/components/quotation-details-dialog"
import { VisitManagementDialog } from "@/components/visit-management-dialog"
import { api, apiErrorToUserMessage, getAuthToken } from "@/lib/api"
import { useQuotationDocumentFileUpload } from "@/hooks/use-quotation-document-file-upload"
import { buildDocumentsMultipartFormData, firstPendingDocumentFileField } from "@/lib/quotation-documents-form"
import { calculateSystemSize } from "@/lib/pricing-tables"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { dealerCanEditFileLogin, getJourneyFileLoginLabel } from "@/lib/customer-journey"
import { downloadQuotationDocumentsZip } from "@/lib/documents-zip-download"
import { openQuotationDocumentPreview } from "@/lib/open-quotation-document-preview"
import { formatPersonName, sanitizeNamePart } from "@/lib/name-display"
import {
  annotateQuotationsWithCurrent,
  getCustomerMobileFromQuotation,
  groupQuotationsByCustomerCurrentFirst,
  setCurrentQuotationForMobile,
} from "@/lib/quotation-current"
import { buildReviseQuotationHref } from "@/lib/quotation-system-history"
import { CityMultiSelectFilter } from "@/components/city-multi-select-filter"
import { matchesCityFilter } from "@/lib/service-cities"
import { DealerPageHero } from "@/components/dealer-page-hero"
import { DEALER_PANEL_TONES, DEALER_PORTAL_PAGE_BG } from "@/lib/dealer-portal-ui"

const ADMIN_USERNAME = "admin"

export default function QuotationsPage() {
  const { isAuthenticated, dealer, authReady } = useAuth()
  const router = useRouter()
  const { toast } = useToast()
  const [quotations, setQuotations] = useState<Quotation[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [filterMonth, setFilterMonth] = useState("all")
  const [filterCities, setFilterCities] = useState<string[]>([])
  const [selectedQuotation, setSelectedQuotation] = useState<Quotation | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [visitQuotation, setVisitQuotation] = useState<Quotation | null>(null)
  const [visitDialogOpen, setVisitDialogOpen] = useState(false)
  const [quotationVisits, setQuotationVisits] = useState<Record<string, any[]>>({})
  const [documentsDialogOpen, setDocumentsDialogOpen] = useState(false)
  const [documentsQuotation, setDocumentsQuotation] = useState<Quotation | null>(null)
  const [documentsFormById, setDocumentsFormById] = useState<Record<string, any>>({})
  const [isSubmittingDocuments, setIsSubmittingDocuments] = useState(false)
  const [documentsZipDownloading, setDocumentsZipDownloading] = useState(false)
  const [restoringQuotationId, setRestoringQuotationId] = useState<string | null>(null)
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false)
  const [historyGroup, setHistoryGroup] = useState<{
    current: Quotation
    history: Quotation[]
    all: Quotation[]
  } | null>(null)
  const [openingReviseId, setOpeningReviseId] = useState<string | null>(null)
  const [filterFileLogin, setFilterFileLogin] = useState("all")
  const [fileLoginDialogOpen, setFileLoginDialogOpen] = useState(false)
  const [fileLoginQuotation, setFileLoginQuotation] = useState<Quotation | null>(null)
  const [fileLoginPaymentType, setFileLoginPaymentType] = useState<"loan" | "cash" | "mix">("cash")
  const [fileLoginBankName, setFileLoginBankName] = useState("")
  const [fileLoginBankIfsc, setFileLoginBankIfsc] = useState("")
  const [isSavingFileLogin, setIsSavingFileLogin] = useState(false)
  const [isRevertingFileLogin, setIsRevertingFileLogin] = useState(false)

  const useApi = process.env.NEXT_PUBLIC_USE_API !== "false"

  const createEmptyDocumentsForm = () => ({
    isCompliantSenior: false,
    aadharNumber: "",
    aadharFront: null as File | string | null,
    aadharBack: null as File | string | null,
    compliantAadharNumber: "",
    compliantAadharFront: null as File | string | null,
    compliantAadharBack: null as File | string | null,
    compliantContactPhone: "",
    compliantPanNumber: "",
    compliantPanImage: null as File | string | null,
    compliantBankAccountNumber: "",
    compliantBankIfsc: "",
    compliantBankName: "",
    compliantBankBranch: "",
    compliantBankPassbookImage: null as File | string | null,
    panNumber: "",
    panImage: null as File | string | null,
    electricityKno: "",
    electricityBillImage: null as File | string | null,
    bankAccountNumber: "",
    bankIfsc: "",
    bankName: "",
    bankBranch: "",
    bankPassbookImage: null as File | string | null,
    geotagRoofPhoto: null as File | string | null,
    customerWithHousePhoto: null as File | string | null,
    propertyDocumentPdf: null as File | string | null,
    contactPhone: "",
    contactEmail: "",
  })

  const pickFirstValue = (sources: any[], aliases: string[]): any => {
    for (const source of sources) {
      if (!source || typeof source !== "object") continue
      for (const key of aliases) {
        const value = (source as any)[key]
        if (value !== undefined && value !== null && value !== "") return value
      }
    }
    return null
  }

  const seedDocumentsFormFromQuotation = (quotation: Quotation) => {
    const q = quotation as any
    const sources = [
      q?.documents,
      q?.documentDetails,
      q?.document_details,
      q?.customerDocuments,
      q?.kycDocuments,
      q?.kyc,
      q?.customer?.documents,
      q,
    ]

    const seeded = createEmptyDocumentsForm()
    seeded.contactPhone = String(
      pickFirstValue(sources, ["phoneNumber", "phone_number", "contactPhone", "contact_phone"]) ||
      q?.customer?.mobile ||
      "",
    )
    seeded.contactEmail = String(
      pickFirstValue(sources, ["emailId", "email_id", "contactEmail", "contact_email", "email"]) ||
      q?.customer?.email ||
      "",
    )
    seeded.electricityKno = String(
      pickFirstValue(sources, ["electricityKno", "electricity_kno", "kno", "kNo", "electricityBillKno"]) || "",
    )
    seeded.aadharNumber = String(pickFirstValue(sources, ["aadharNumber", "aadhar_number"]) || "")
    seeded.panNumber = String(pickFirstValue(sources, ["panNumber", "pan_number"]) || "")

    seeded.aadharFront = pickFirstValue(sources, ["aadharFront", "aadhar_front", "aadharFrontUrl", "aadhar_front_url"])
    seeded.aadharBack = pickFirstValue(sources, ["aadharBack", "aadhar_back", "aadharBackUrl", "aadhar_back_url"])
    seeded.panImage = pickFirstValue(sources, ["panImage", "pan_image", "panImageUrl", "pan_image_url"])
    seeded.electricityBillImage = pickFirstValue(sources, [
      "electricityBillImage",
      "electricity_bill_image",
      "electricityBillImageUrl",
      "electricity_bill_image_url",
    ])
    seeded.bankPassbookImage = pickFirstValue(sources, [
      "bankPassbookImage",
      "bank_passbook_image",
      "bankPassbookImageUrl",
      "bank_passbook_image_url",
    ])
    seeded.propertyDocumentPdf = pickFirstValue(sources, [
      "propertyDocumentPdf",
      "property_document_pdf",
      "propertyDocumentUrl",
      "property_document_url",
      "propertyDocumentPdfUrl",
      "property_document_pdf_url",
    ])
    seeded.geotagRoofPhoto = pickFirstValue(sources, ["geotagRoofPhoto", "geotag_roof_photo", "geotagRoofPhotoUrl"])
    seeded.customerWithHousePhoto = pickFirstValue(sources, [
      "customerWithHousePhoto",
      "customer_with_house_photo",
      "customerWithHousePhotoUrl",
    ])

    return seeded
  }

  const openDocumentPreview = (value: unknown) => {
    openQuotationDocumentPreview(value, documentsQuotation?.id)
  }

  const openDocumentsDialogForQuotation = (quotation: Quotation) => {
    setDocumentsQuotation(quotation)
    setDocumentsFormById((prev) => {
      const existing = prev[quotation.id]
      if (existing) return prev

      return {
        ...prev,
        [quotation.id]: {
          ...seedDocumentsFormFromQuotation(quotation),
        },
      }
    })
    setDocumentsDialogOpen(true)
  }

  useEffect(() => {
    if (!authReady) return

    if (!isAuthenticated) {
      router.push("/login")
      return
    }

    // Redirect admin to admin panel
    if (dealer?.username === ADMIN_USERNAME) {
      router.push("/dashboard/admin")
      return
    }

    loadQuotations()
  }, [authReady, isAuthenticated, router, dealer])

  const loadQuotations = async () => {
    if (!dealer?.id) return

    try {
      if (useApi) {
        if (!getAuthToken()) return
        const response = await api.quotations.getAll()
        const dealerQuotations = (response.quotations || [])
          .map((q: any) => {
            const rawFileLogin = q.fileLoginStatus ?? q.file_login_status
            const fileLoginStatusNorm =
              rawFileLogin === "pending_for_login" ||
              rawFileLogin === "already_login" ||
              rawFileLogin === "login_now"
                ? rawFileLogin
                : undefined
            return {
              ...q,
              id: q.id,
              customer: q.customer || {},
              // Preserve all products data - don't default to { systemType: "N/A" } if products exists
              products: q.products || {},
              discount: q.discount || 0,
              subtotal: q.pricing?.subtotal ?? q.totalAmount ?? 0,
              totalAmount: q.pricing?.totalAmount || 0,
              finalAmount: q.pricing?.finalAmount || q.finalAmount || 0,
              createdAt: q.createdAt,
              dealerId: q.dealerId || dealer.id,
              status: q.status || "pending",
              fileLoginStatus: fileLoginStatusNorm as FileLoginStatus | undefined,
              filePaymentType: q.filePaymentType ?? q.file_payment_type,
              fileBankName: q.fileBankName ?? q.file_bank_name,
              fileBankIfsc: q.fileBankIfsc ?? q.file_bank_ifsc,
              fileSubsidyChequeDetails:
                q.fileSubsidyChequeDetails ?? q.file_subsidy_cheque_details,
              fileLoginAt: q.fileLoginAt ?? q.file_login_at,
              fileLoginDealerEditAccess: Boolean(
                q.fileLoginDealerEditAccess ?? q.file_login_dealer_edit_access,
              ),
            }
          })
        setQuotations(annotateQuotationsWithCurrent(dealerQuotations))
        // Load visits for all quotations
        await loadVisitsForQuotations(dealerQuotations)
      } else {
        // Fallback to localStorage
        const all = JSON.parse(localStorage.getItem("quotations") || "[]")
        const dealerQuotations = all
          .filter((q: Quotation) => q.dealerId === dealer.id)
          .map((q: Quotation) => ({
            ...q,
            status: q.status || "pending",
            subtotal: q.subtotal ?? (q as any).pricing?.subtotal ?? q.totalAmount ?? 0,
          }))
        setQuotations(annotateQuotationsWithCurrent(dealerQuotations))
        // Load visits for all quotations
        await loadVisitsForQuotations(dealerQuotations)
      }
    } catch (error) {
      console.error("Error loading quotations:", error)
    }
  }

  const loadVisitsForQuotations = async (quotationList: Quotation[]) => {
    const visitsMap: Record<string, any[]> = {}
    
    await Promise.all(
      quotationList.map(async (quotation) => {
        try {
          if (useApi) {
            const response = await api.visits.getByQuotation(quotation.id)
            // Handle different response structures
            let visitsList: any[] = []
            if (Array.isArray(response)) {
              visitsList = response
            } else if (response?.visits && Array.isArray(response.visits)) {
              visitsList = response.visits
            } else if (response?.data?.visits && Array.isArray(response.data.visits)) {
              visitsList = response.data.visits
            }
            
            // Debug logging
            if (visitsList.length > 0) {
              console.log(`[Quotations] Loaded ${visitsList.length} visits for quotation ${quotation.id}:`, visitsList.map(v => ({ id: v.id, status: v.status })))
            }
            
            visitsMap[quotation.id] = visitsList.map((v: any) => ({
              id: v.id,
              status: v.status || "pending",
              date: v.visitDate || v.date,
              time: v.visitTime || v.time,
            }))
          } else {
            // Fallback to localStorage
            const stored = localStorage.getItem(`visits_${quotation.id}`)
            if (stored) {
              const visits = JSON.parse(stored)
              visitsMap[quotation.id] = visits.map((v: any) => ({
                id: v.id,
                status: v.status || "pending",
                date: v.date,
                time: v.time,
              }))
            } else {
              visitsMap[quotation.id] = []
            }
          }
        } catch (error) {
          console.error(`Error loading visits for quotation ${quotation.id}:`, error)
          visitsMap[quotation.id] = []
        }
      })
    )
    
    setQuotationVisits(visitsMap)
  }

  const handleVisitDialogClose = (open: boolean) => {
    setVisitDialogOpen(open)
    // Reload visits when dialog closes to update status
    if (!open && quotations.length > 0) {
      loadVisitsForQuotations(quotations)
    }
  }

  const getDocumentsForm = (quotationId: string) => {
    return documentsFormById[quotationId] || createEmptyDocumentsForm()
  }

  const updateDocumentsForm = useCallback((quotationId: string, updates: Record<string, any>) => {
    setDocumentsFormById((prev) => ({
      ...prev,
      [quotationId]: {
        ...(prev[quotationId] || createEmptyDocumentsForm()),
        ...updates,
      },
    }))
  }, [])

  const { uploadingField, onDocumentFileSelected } = useQuotationDocumentFileUpload(useApi, updateDocumentsForm)

  if (!authReady || !isAuthenticated) return null

  const getCustomerDisplayName = (customer?: Quotation["customer"]) => {
    return formatPersonName(customer?.firstName, customer?.lastName, "")
  }

  const filteredQuotations = quotations.filter((q) => {
    const safeLastName = sanitizeNamePart(q.customer?.lastName)
    const matchesSearch =
      (q.customer?.firstName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      safeLastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (q.customer?.mobile || "").includes(searchTerm) ||
      (q.id || "").toLowerCase().includes(searchTerm.toLowerCase())
    if (!matchesSearch) return false
    if (!matchesCityFilter(q, filterCities)) return false

    const normalizedFileLogin = String(q.fileLoginStatus || "unset").toLowerCase()
    if (filterFileLogin !== "all" && normalizedFileLogin !== filterFileLogin) return false

    if (filterMonth === "all") return true

    const date = new Date(q.createdAt)
    const currentDate = new Date()

    if (filterMonth === "current") {
      return date.getMonth() === currentDate.getMonth() && date.getFullYear() === currentDate.getFullYear()
    }

    if (filterMonth === "previous") {
      const prevMonth = currentDate.getMonth() === 0 ? 11 : currentDate.getMonth() - 1
      const prevYear = currentDate.getMonth() === 0 ? currentDate.getFullYear() - 1 : currentDate.getFullYear()
      return date.getMonth() === prevMonth && date.getFullYear() === prevYear
    }

    return true
  })

  const sortedQuotations = [...filteredQuotations].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )

  // One row per customer (current quotation); older versions via History.
  const customerQuotationRows = groupQuotationsByCustomerCurrentFirst(sortedQuotations)

  const openQuotationHistory = (group: {
    current: Quotation
    history: Quotation[]
    all: Quotation[]
  }) => {
    setHistoryGroup(group)
    setHistoryDialogOpen(true)
  }

  const restoreQuotationAsCurrent = async (quotation: Quotation) => {
    if (quotation.isCurrent) {
      toast({
        title: "Already current",
        description: "This quotation is already the current one for this customer.",
      })
      return
    }
    const mobile = getCustomerMobileFromQuotation(quotation)
    const name = getCustomerDisplayName(quotation.customer)
    if (
      !window.confirm(
        `Restore ${quotation.id} as the current quotation for ${name}?\n\nThe list will show this version; older ones stay in History.`,
      )
    ) {
      return
    }
    setRestoringQuotationId(quotation.id)
    try {
      if (useApi) {
        try {
          await api.quotations.restoreAsCurrent(quotation.id)
        } catch (apiErr) {
          console.warn("[quotations] restoreAsCurrent API unavailable:", apiErr)
        }
      }
      if (mobile) setCurrentQuotationForMobile(mobile, quotation.id)
      setQuotations((prev) =>
        annotateQuotationsWithCurrent(
          prev.map((q) => {
            const sameCustomer = getCustomerMobileFromQuotation(q) === mobile
            if (!sameCustomer) return q
            return {
              ...q,
              isCurrent: q.id === quotation.id,
              is_current: q.id === quotation.id,
            }
          }),
        ),
      )
      setHistoryDialogOpen(false)
      setHistoryGroup(null)
      toast({
        title: "Restored as current",
        description: `${quotation.id} is now shown for ${name}.`,
      })
    } catch (error) {
      toast({
        title: "Restore failed",
        description: apiErrorToUserMessage(error) || "Could not restore quotation",
        variant: "destructive",
      })
    } finally {
      setRestoringQuotationId(null)
    }
  }

  const openCreateAnotherQuotation = async (quotation: Quotation) => {
    setOpeningReviseId(quotation.id)
    try {
      let source: Quotation | Record<string, unknown> = quotation
      if (useApi) {
        try {
          const full = await api.quotations.getById(quotation.id)
          if (full && typeof full === "object") {
            source = {
              ...quotation,
              ...full,
              customer: (full as any).customer || quotation.customer,
            }
          }
        } catch {
          // fall back to list row
        }
      }
      router.push(buildReviseQuotationHref({ id: quotation.id, ...(source as Record<string, any>) }))
    } finally {
      setOpeningReviseId(null)
    }
  }

  const openSendForLoginDialog = (quotation: Quotation) => {
    setFileLoginQuotation(quotation)
    setFileLoginPaymentType((quotation.filePaymentType as "loan" | "cash" | "mix") || "cash")
    setFileLoginBankName(quotation.fileBankName || "")
    setFileLoginBankIfsc(quotation.fileBankIfsc || "")
    setFileLoginDialogOpen(true)
  }

  const fileLoginIsEditable = (quotation: Quotation | null | undefined) =>
    quotation ? dealerCanEditFileLogin(quotation) : false

  const clearFileLoginLocal = (quotationId: string) => {
    setQuotations((prev) =>
      prev.map((q) =>
        q.id === quotationId
          ? {
              ...q,
              fileLoginStatus: undefined,
              filePaymentType: undefined,
              fileBankName: undefined,
              fileBankIfsc: undefined,
              fileSubsidyChequeDetails: undefined,
              fileLoginAt: undefined,
              fileLoginDealerEditAccess: false,
            }
          : q,
      ),
    )
  }

  const confirmSendForLogin = async () => {
    if (!fileLoginQuotation) return
    if (!fileLoginIsEditable(fileLoginQuotation)) {
      toast({
        title: "Read only",
        description:
          "File login is locked. Ask admin to set Not set or Pending for login.",
        variant: "destructive",
      })
      return
    }
    const needsBank = fileLoginPaymentType === "loan" || fileLoginPaymentType === "mix"
    if (needsBank) {
      const bankName = fileLoginBankName.trim()
      const ifscRaw = fileLoginBankIfsc.trim().toUpperCase().replace(/\s/g, "")
      if (!bankName) {
        toast({
          title: "Bank name required",
          description: "Enter the customer’s bank for loan or cash + loan.",
          variant: "destructive",
        })
        return
      }
      if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifscRaw)) {
        toast({
          title: "Invalid IFSC",
          description: "Use 11 characters: 4 letters, 0, then 6 letters or digits (e.g. SBIN0001234).",
          variant: "destructive",
        })
        return
      }
    }

    setIsSavingFileLogin(true)
    try {
      const payload = {
        fileLoginStatus: "pending_for_login" as const,
        filePaymentType: fileLoginPaymentType,
        ...(needsBank
          ? {
              bankName: fileLoginBankName.trim(),
              bankIfsc: fileLoginBankIfsc.trim().toUpperCase().replace(/\s/g, ""),
            }
          : {}),
        fileLoginAt: new Date().toISOString(),
      }

      if (useApi) {
        await api.quotations.updateFileLogin(fileLoginQuotation.id, payload)
      }

      setQuotations((prev) =>
        prev.map((q) =>
          q.id === fileLoginQuotation.id
            ? {
                ...q,
                fileLoginStatus: "pending_for_login",
                filePaymentType: fileLoginPaymentType,
                fileBankName: needsBank ? fileLoginBankName.trim() : undefined,
                fileBankIfsc: needsBank
                  ? fileLoginBankIfsc.trim().toUpperCase().replace(/\s/g, "")
                  : undefined,
                fileLoginAt: payload.fileLoginAt,
              }
            : q,
        ),
      )

      toast({
        title: "Sent for login",
        description: `${fileLoginQuotation.id} is now Pending for login.`,
      })
      setFileLoginDialogOpen(false)
      setFileLoginQuotation(null)
    } catch (error) {
      toast({
        title: "Could not send for login",
        description: apiErrorToUserMessage(error) || "Try again.",
        variant: "destructive",
      })
    } finally {
      setIsSavingFileLogin(false)
    }
  }

  const confirmRevertFileLogin = async () => {
    if (!fileLoginQuotation) return
    if (!fileLoginIsEditable(fileLoginQuotation)) {
      toast({
        title: "Read only",
        description:
          "File login is locked. Ask admin to set Not set or Pending for login.",
        variant: "destructive",
      })
      return
    }
    const ok = window.confirm(
      `Revert login for ${fileLoginQuotation.id}? This clears File login back to Not set.`,
    )
    if (!ok) return

    setIsRevertingFileLogin(true)
    try {
      if (useApi) {
        await api.quotations.updateFileLogin(fileLoginQuotation.id, { reset: true })
      }
      clearFileLoginLocal(fileLoginQuotation.id)
      toast({
        title: "Login reverted",
        description: `${fileLoginQuotation.id} is Not set again.`,
      })
      setFileLoginDialogOpen(false)
      setFileLoginQuotation(null)
    } catch (error) {
      toast({
        title: "Could not revert login",
        description: apiErrorToUserMessage(error) || "Try again.",
        variant: "destructive",
      })
    } finally {
      setIsRevertingFileLogin(false)
    }
  }

  const renderQuotationActions = (
    quotation: Quotation,
    history: Quotation[],
    group: { current: Quotation; history: Quotation[]; all: Quotation[] },
  ) => {
    const hasFileLogin =
      quotation.fileLoginStatus === "pending_for_login" ||
      quotation.fileLoginStatus === "already_login" ||
      quotation.fileLoginStatus === "login_now"
    const canEditLogin = dealerCanEditFileLogin(quotation)
    return (
    <div className="flex items-center gap-1 justify-end">
      <Button
        variant="ghost"
        size="icon"
        disabled={openingReviseId === quotation.id}
        onClick={() => void openCreateAnotherQuotation(quotation)}
        title="Create another quotation for this customer"
      >
        <FilePlus2 className={`w-4 h-4 ${openingReviseId === quotation.id ? "animate-pulse" : ""}`} />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className={
          !canEditLogin
            ? "text-muted-foreground"
            : hasFileLogin
              ? "text-teal-700 hover:text-teal-800"
              : undefined
        }
        onClick={() => openSendForLoginDialog(quotation)}
        title={
          !canEditLogin
            ? `Login: ${getJourneyFileLoginLabel(quotation)} (read only — admin must set Not set or Pending)`
            : hasFileLogin
              ? `Login: ${getJourneyFileLoginLabel(quotation)} (edit / revert)`
              : "Send for login"
        }
      >
        <LogIn className="w-4 h-4" />
      </Button>
      {history.length > 0 ? (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => openQuotationHistory(group)}
          title={`History (${history.length} older version${history.length === 1 ? "" : "s"})`}
        >
          <History className="w-4 h-4" />
        </Button>
      ) : null}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => {
          setVisitQuotation(quotation)
          setVisitDialogOpen(true)
        }}
        title="Visit Management"
      >
        <Calendar className="w-4 h-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => {
          openDocumentsDialogForQuotation(quotation)
        }}
        title="Document Submission"
      >
        <FileText className="w-4 h-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => {
          setSelectedQuotation(quotation)
          setDialogOpen(true)
        }}
        title="View Details"
      >
        <Eye className="w-4 h-4" />
      </Button>
    </div>
    )
  }

  const getStatusColor = (status?: string) => {
    switch (status) {
      case "approved":
        return "bg-green-50"
      case "rejected":
        return "bg-red-50"
      case "completed":
        return "bg-blue-50"
      default:
        return "bg-yellow-50"
    }
  }

  const getStatusBadgeColor = (status?: string) => {
    switch (status) {
      case "approved":
        return "bg-green-600 text-white"
      case "rejected":
        return "bg-red-600 text-white"
      case "completed":
        return "bg-blue-600 text-white"
      default:
        return "bg-yellow-600 text-white"
    }
  }

  const getVisitStatus = (quotation: Quotation): string => {
    const visits = quotationVisits[quotation.id] || []
    
    if (visits.length === 0) {
      return "No visits"
    }
    
    // Get the latest visit status (most recent by date/time)
    const sortedVisits = [...visits].sort((a, b) => {
      try {
        const dateA = new Date(`${a.date}T${a.time || "00:00"}`).getTime()
        const dateB = new Date(`${b.date}T${b.time || "00:00"}`).getTime()
        return dateB - dateA
      } catch {
        // If date parsing fails, compare by createdAt or id
        return 0
      }
    })
    
    const latestVisit = sortedVisits[0]
    if (!latestVisit) {
      return "No visits"
    }
    
    const status = latestVisit.status || "pending"
    
    // Capitalize first letter
    return status.charAt(0).toUpperCase() + status.slice(1)
  }

  const getVisitStatusBadgeColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "approved":
        return "bg-green-600 text-white"
      case "completed":
        return "bg-blue-600 text-white"
      case "rejected":
        return "bg-red-600 text-white"
      case "incomplete":
        return "bg-orange-600 text-white"
      case "rescheduled":
        return "bg-purple-600 text-white"
      case "no visits":
        return "bg-gray-500 text-white"
      default:
        return "bg-yellow-600 text-white"
    }
  }

  const getLoginBadgeClass = (quotation: Quotation) =>
    quotation.fileLoginStatus === "pending_for_login"
      ? "border-amber-300 text-amber-900 bg-amber-50"
      : quotation.fileLoginStatus
        ? "border-teal-300 text-teal-800 bg-teal-50"
        : "text-muted-foreground"

  const renderHistoryStatusBadges = (quotation: Quotation) => {
    const visitStatus = getVisitStatus(quotation)
    const statusLabel =
      (quotation.status || "pending").charAt(0).toUpperCase() +
      (quotation.status || "pending").slice(1)
    return (
      <div className="mt-2 flex flex-wrap items-center gap-1">
        <Badge className={`text-[10px] ${getStatusBadgeColor(quotation.status)}`}>
          {statusLabel}
        </Badge>
        <Badge className={`text-[10px] ${getVisitStatusBadgeColor(visitStatus)}`}>
          {visitStatus}
        </Badge>
        <Badge variant="outline" className={`text-[10px] ${getLoginBadgeClass(quotation)}`}>
          {getJourneyFileLoginLabel(quotation)}
        </Badge>
      </div>
    )
  }

  const getSystemSize = (quotation: Quotation): string => {
    const products = quotation.products
    if (!products) {
      return "N/A"
    }

    // For BOTH system type
    if (products.systemType === "both") {
      const dcrSize = products.dcrPanelSize && products.dcrPanelQuantity
        ? calculateSystemSize(products.dcrPanelSize, products.dcrPanelQuantity)
        : null
      const nonDcrSize = products.nonDcrPanelSize && products.nonDcrPanelQuantity
        ? calculateSystemSize(products.nonDcrPanelSize, products.nonDcrPanelQuantity)
        : null
      
      if (dcrSize && nonDcrSize && dcrSize !== "0kW" && nonDcrSize !== "0kW") {
        const dcrKw = Number.parseFloat(dcrSize.replace("kW", ""))
        const nonDcrKw = Number.parseFloat(nonDcrSize.replace("kW", ""))
        if (!Number.isNaN(dcrKw) && !Number.isNaN(nonDcrKw)) {
          return `${dcrKw + nonDcrKw}kW`
        }
      }
      if (dcrSize && dcrSize !== "0kW") return dcrSize
      if (nonDcrSize && nonDcrSize !== "0kW") return nonDcrSize
      // If BOTH type but can't calculate, show system type
      return "BOTH"
    }

    // For CUSTOMIZE system type
    if (products.systemType === "customize" && products.customPanels && products.customPanels.length > 0) {
      const totalKw = products.customPanels.reduce((sum, panel) => {
        if (!panel.size || !panel.quantity) return sum
        try {
          const sizeW = Number.parseInt(panel.size.replace("W", ""))
          if (Number.isNaN(sizeW)) return sum
          return sum + (sizeW * panel.quantity)
        } catch {
          return sum
        }
      }, 0) / 1000
      if (totalKw > 0) return `${totalKw}kW`
      return "CUSTOMIZE"
    }

    // For DCR, NON DCR, or other system types
    if (products.panelSize && products.panelQuantity && products.panelQuantity > 0) {
      const systemSize = calculateSystemSize(products.panelSize, products.panelQuantity)
      if (systemSize !== "0kW") return systemSize
    }

    // Fallback: Show system type if available
    if (products.systemType && products.systemType !== "N/A" && products.systemType.trim() !== "") {
      // Format system type for display
      const systemType = products.systemType.toLowerCase()
      if (systemType === "dcr") return "DCR"
      if (systemType === "non-dcr") return "NON DCR"
      if (systemType === "both") return "BOTH"
      if (systemType === "customize") return "CUSTOMIZE"
      return products.systemType.toUpperCase()
    }

    return "N/A"
  }

  return (
    <div className={DEALER_PORTAL_PAGE_BG}>
      <DashboardNav />

      <main className="container mx-auto px-4 py-5 sm:py-8">
        <DealerPageHero
          tone="sky"
          title="Quotations"
          description="View and manage all your quotations"
          action={
            <Button
              onClick={() => router.push("/dashboard/new-quotation")}
              className="w-full sm:w-auto font-semibold"
            >
              New Quotation
            </Button>
          }
        />

        <Card className={DEALER_PANEL_TONES.sky}>
          <CardHeader>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, mobile, or ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <CityMultiSelectFilter
                value={filterCities}
                onChange={setFilterCities}
                className="w-full sm:w-52"
              />
              <Select value={filterFileLogin} onValueChange={setFilterFileLogin}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Login status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All login status</SelectItem>
                  <SelectItem value="unset">Not set</SelectItem>
                  <SelectItem value="pending_for_login">Pending for login</SelectItem>
                  <SelectItem value="login_now">Login now</SelectItem>
                  <SelectItem value="already_login">Already login</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterMonth} onValueChange={setFilterMonth}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Filter by month" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="current">Current Month</SelectItem>
                  <SelectItem value="previous">Previous Month</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {customerQuotationRows.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No quotations found</p>
                {searchTerm ||
                filterMonth !== "all" ||
                filterCities.length > 0 ||
                filterFileLogin !== "all" ? (
                  <Button
                    variant="link"
                    onClick={() => {
                      setSearchTerm("")
                      setFilterMonth("all")
                      setFilterCities([])
                      setFilterFileLogin("all")
                    }}
                  >
                    Clear filters
                  </Button>
                ) : (
                  <Button variant="link" onClick={() => router.push("/dashboard/new-quotation")}>
                    Create your first quotation
                  </Button>
                )}
              </div>
            ) : (
              <>
                <div className="space-y-3 md:hidden">
                {customerQuotationRows.map((group) => {
                  const quotation = group.current as Quotation
                  return (
                  <div key={group.key} className={`rounded-lg border p-3 ${getStatusColor(quotation.status)}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[11px] font-mono text-muted-foreground break-all">{quotation.id}</p>
                        <p className="text-sm font-semibold">
                          {getCustomerDisplayName(quotation.customer)}
                        </p>
                        <p className="text-xs text-muted-foreground">{quotation.customer?.mobile || ""}</p>
                        {group.history.length > 0 ? (
                          <Badge variant="outline" className="mt-1 text-[10px]">
                            {group.history.length} older version{group.history.length === 1 ? "" : "s"}
                          </Badge>
                        ) : null}
                      </div>
                      <Badge className={`text-[10px] ${getStatusBadgeColor(quotation.status)}`}>
                        {(quotation.status || "pending").charAt(0).toUpperCase() + (quotation.status || "pending").slice(1)}
                      </Badge>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                      <p className="text-muted-foreground">System: <span className="text-foreground">{getSystemSize(quotation)}</span></p>
                      <p className="text-muted-foreground text-right">₹{Math.abs(quotation.subtotal ?? quotation.totalAmount ?? quotation.finalAmount ?? 0).toLocaleString()}</p>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1">
                        <Badge className={`text-[10px] ${getVisitStatusBadgeColor(getVisitStatus(quotation))}`}>
                          {getVisitStatus(quotation)}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${
                            quotation.fileLoginStatus === "pending_for_login"
                              ? "border-amber-300 text-amber-900 bg-amber-50"
                              : quotation.fileLoginStatus
                                ? "border-teal-300 text-teal-800 bg-teal-50"
                                : "text-muted-foreground"
                          }`}
                        >
                          {getJourneyFileLoginLabel(quotation)}
                        </Badge>
                      </div>
                      {renderQuotationActions(
                        quotation,
                        group.history as Quotation[],
                        {
                          current: quotation,
                          history: group.history as Quotation[],
                          all: group.all as Quotation[],
                        },
                      )}
                    </div>
                  </div>
                  )
                })}
              </div>

                <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground">Quotation ID</th>
                      <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground">Customer</th>
                      <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground hidden md:table-cell">
                        System Type
                      </th>
                      <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground">Amount</th>
                      <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground">Status</th>
                      <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground">Visit Status</th>
                      <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground hidden lg:table-cell">
                        Login
                      </th>
                      <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground hidden sm:table-cell">
                        Date
                      </th>
                      <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customerQuotationRows.map((group) => {
                      const quotation = group.current as Quotation
                      return (
                      <tr
                        key={group.key}
                        className={`border-b border-border last:border-0 ${getStatusColor(quotation.status)}`}
                      >
                        <td className="py-3 px-2">
                          <div className="flex flex-col gap-1">
                            <span className="text-sm font-mono">{quotation.id}</span>
                            {group.history.length > 0 ? (
                              <Badge variant="outline" className="w-fit text-[10px]">
                                {group.history.length} older
                              </Badge>
                            ) : null}
                          </div>
                        </td>
                        <td className="py-3 px-2">
                          <div>
                            <p className="text-sm font-medium">
                              {getCustomerDisplayName(quotation.customer)}
                            </p>
                            <p className="text-xs text-muted-foreground">{quotation.customer?.mobile || ""}</p>
                          </div>
                        </td>
                        <td className="py-3 px-2 hidden md:table-cell">
                          <span className="px-2 py-1 bg-primary/10 text-primary rounded text-xs uppercase">
                            {getSystemSize(quotation)}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-right">
                          <div>
                            <p className="text-sm font-medium">₹{Math.abs(quotation.subtotal ?? quotation.totalAmount ?? quotation.finalAmount ?? 0).toLocaleString()}</p>
                            {quotation.discount > 0 && (
                              <p className="text-xs text-muted-foreground">{quotation.discount}% off</p>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-2">
                          <Badge className={`text-xs ${getStatusBadgeColor(quotation.status)}`}>
                            {(quotation.status || "pending").charAt(0).toUpperCase() +
                              (quotation.status || "pending").slice(1)}
                          </Badge>
                        </td>
                        <td className="py-3 px-2">
                          <Badge className={`text-xs ${getVisitStatusBadgeColor(getVisitStatus(quotation))}`}>
                            {getVisitStatus(quotation)}
                          </Badge>
                        </td>
                        <td className="py-3 px-2 hidden lg:table-cell">
                          <Badge
                            variant="outline"
                            className={`text-xs ${
                              quotation.fileLoginStatus === "pending_for_login"
                                ? "border-amber-300 text-amber-900 bg-amber-50"
                                : quotation.fileLoginStatus
                                  ? "border-teal-300 text-teal-800 bg-teal-50"
                                  : "text-muted-foreground"
                            }`}
                          >
                            {getJourneyFileLoginLabel(quotation)}
                          </Badge>
                        </td>
                        <td className="py-3 px-2 text-right text-sm text-muted-foreground hidden sm:table-cell">
                          {new Date(quotation.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-2 text-right">
                          {renderQuotationActions(
                            quotation,
                            group.history as Quotation[],
                            {
                              current: quotation,
                              history: group.history as Quotation[],
                              all: group.all as Quotation[],
                            },
                          )}
                        </td>
                      </tr>
                      )
                    })}
                  </tbody>
                </table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </main>

      <Dialog
        open={fileLoginDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setFileLoginQuotation(null)
            setFileLoginBankName("")
            setFileLoginBankIfsc("")
          }
          setFileLoginDialogOpen(open)
        }}
      >
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {!fileLoginIsEditable(fileLoginQuotation)
                ? "File login (read only)"
                : fileLoginQuotation?.fileLoginStatus
                  ? "Update login"
                  : "Send for login"}
            </DialogTitle>
            <DialogDescription>
              {!fileLoginIsEditable(fileLoginQuotation)
                ? `${fileLoginQuotation?.id || ""} is ${getJourneyFileLoginLabel(fileLoginQuotation || ({} as Quotation))}. Ask admin to set Not set or Pending for login.`
                : fileLoginQuotation
                  ? `Choose payment type for ${fileLoginQuotation.id} (${getCustomerDisplayName(fileLoginQuotation.customer)}), then confirm send.`
                  : "Choose payment type, then confirm send."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {fileLoginIsEditable(fileLoginQuotation) ? (
              <div className="rounded-lg border border-teal-100 bg-teal-50/60 px-3 py-2 text-sm text-teal-950">
                After send, status becomes <span className="font-semibold">Pending for login</span>.
                Admin can find it under File Login → Pending for login.
              </div>
            ) : (
              <div className="rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2 text-sm text-amber-950">
                Status: <span className="font-semibold">{getJourneyFileLoginLabel(fileLoginQuotation || ({} as Quotation))}</span>
                {" · "}
                Payment:{" "}
                <span className="font-semibold">
                  {fileLoginPaymentType === "mix"
                    ? "Cash + loan"
                    : fileLoginPaymentType === "loan"
                      ? "Loan"
                      : "Cash"}
                </span>
              </div>
            )}
            <div className="space-y-2">
              <Label>Payment type</Label>
              <Select
                value={fileLoginPaymentType}
                disabled={!fileLoginIsEditable(fileLoginQuotation)}
                onValueChange={(v) => {
                  const val = v as "loan" | "cash" | "mix"
                  setFileLoginPaymentType(val)
                  if (val === "cash") {
                    setFileLoginBankName("")
                    setFileLoginBankIfsc("")
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select payment type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="loan">Loan</SelectItem>
                  <SelectItem value="mix">Cash + loan</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(fileLoginPaymentType === "loan" || fileLoginPaymentType === "mix") && (
              <div className="space-y-3 rounded-lg border border-border/70 bg-muted/30 p-3">
                <div className="space-y-2">
                  <Label htmlFor="dealer-file-login-bank">Bank name</Label>
                  <Input
                    id="dealer-file-login-bank"
                    value={fileLoginBankName}
                    disabled={!fileLoginIsEditable(fileLoginQuotation)}
                    onChange={(e) => setFileLoginBankName(e.target.value)}
                    placeholder="e.g. State Bank of India"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dealer-file-login-ifsc">IFSC code</Label>
                  <Input
                    id="dealer-file-login-ifsc"
                    value={fileLoginBankIfsc}
                    disabled={!fileLoginIsEditable(fileLoginQuotation)}
                    onChange={(e) => setFileLoginBankIfsc(e.target.value.toUpperCase())}
                    placeholder="e.g. SBIN0001234"
                    maxLength={11}
                    className="font-mono uppercase"
                  />
                </div>
              </div>
            )}
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between pt-2">
            {fileLoginQuotation?.fileLoginStatus && fileLoginIsEditable(fileLoginQuotation) ? (
              <Button
                type="button"
                variant="outline"
                className="text-destructive border-destructive/40 hover:bg-destructive/5"
                onClick={() => void confirmRevertFileLogin()}
                disabled={isSavingFileLogin || isRevertingFileLogin}
              >
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                {isRevertingFileLogin ? "Reverting…" : "Revert to Not set"}
              </Button>
            ) : (
              <span />
            )}
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setFileLoginDialogOpen(false)}
                disabled={isSavingFileLogin || isRevertingFileLogin}
              >
                {fileLoginIsEditable(fileLoginQuotation) ? "Cancel" : "Close"}
              </Button>
              {fileLoginIsEditable(fileLoginQuotation) ? (
                <Button
                  onClick={() => void confirmSendForLogin()}
                  disabled={isSavingFileLogin || isRevertingFileLogin}
                >
                  {isSavingFileLogin
                    ? "Saving…"
                    : fileLoginQuotation?.fileLoginStatus
                      ? "Update login"
                      : "Confirm send"}
                </Button>
              ) : null}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Quotation Details Dialog */}
      <QuotationDetailsDialog
        quotation={selectedQuotation}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />

      <Dialog
        open={historyDialogOpen}
        onOpenChange={(open) => {
          setHistoryDialogOpen(open)
          if (!open) setHistoryGroup(null)
        }}
      >
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Quotation history</DialogTitle>
            <DialogDescription>
              {historyGroup
                ? `${getCustomerDisplayName(historyGroup.current.customer)} — restore an older version as current.`
                : "Older quotations for this customer."}
            </DialogDescription>
          </DialogHeader>
          {historyGroup ? (
            <div className="space-y-3">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-emerald-800">Current</p>
                    <p className="text-sm font-mono">{historyGroup.current.id}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {getSystemSize(historyGroup.current)} · ₹
                      {Math.abs(
                        historyGroup.current.subtotal ??
                          historyGroup.current.totalAmount ??
                          historyGroup.current.finalAmount ??
                          0,
                      ).toLocaleString()}{" "}
                      · {new Date(historyGroup.current.createdAt).toLocaleDateString()}
                    </p>
                    {renderHistoryStatusBadges(historyGroup.current)}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setSelectedQuotation(historyGroup.current)
                      setDialogOpen(true)
                    }}
                    title="View details"
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              {historyGroup.history.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No older versions.</p>
              ) : (
                historyGroup.history.map((older) => (
                  <div key={older.id} className="rounded-lg border p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">Previous</p>
                        <p className="text-sm font-mono">{older.id}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {getSystemSize(older)} · ₹
                          {Math.abs(
                            older.subtotal ?? older.totalAmount ?? older.finalAmount ?? 0,
                          ).toLocaleString()}{" "}
                          · {new Date(older.createdAt).toLocaleDateString()}
                        </p>
                        {renderHistoryStatusBadges(older)}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setSelectedQuotation(older)
                            setDialogOpen(true)
                          }}
                          title="View details"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1"
                          disabled={restoringQuotationId === older.id}
                          onClick={() => void restoreQuotationAsCurrent(older)}
                          title="Restore as current"
                        >
                          <RotateCcw
                            className={`w-3.5 h-3.5 ${
                              restoringQuotationId === older.id ? "animate-spin" : ""
                            }`}
                          />
                          Restore
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Visit Management Dialog */}
      <VisitManagementDialog
        quotation={visitQuotation}
        open={visitDialogOpen}
        onOpenChange={handleVisitDialogClose}
      />

      {/* Document Submission Dialog */}
      <Dialog
        open={documentsDialogOpen}
        onOpenChange={(open) => {
          setDocumentsDialogOpen(open)
          if (!open) {
            setDocumentsQuotation(null)
          }
        }}
      >
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Document Submission</DialogTitle>
            <DialogDescription>
              Upload customer documents and payment details for this quotation.
            </DialogDescription>
          </DialogHeader>
          {documentsQuotation && (
            <div className="space-y-6">
              <div className="rounded-lg border border-border/60 bg-muted/20 px-4 py-3">
                <p className="text-sm font-semibold">
                  {getCustomerDisplayName(documentsQuotation.customer)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {documentsQuotation.customer?.mobile || ""} • {documentsQuotation.id}
                </p>
              </div>

              {(() => {
                const form = getDocumentsForm(documentsQuotation.id)
                const isCompliant = Boolean(form.isCompliantSenior)

                return (
                  <>
                    <div className="rounded-lg border border-border/60 bg-muted/10 p-4 space-y-3">
                      <div className="flex items-start gap-3">
                        <input
                          id="compliant-senior"
                          type="checkbox"
                          checked={isCompliant}
                          onChange={(e) =>
                            updateDocumentsForm(documentsQuotation.id, { isCompliantSenior: e.target.checked })
                          }
                          className="h-4 w-4 mt-1"
                        />
                        <div>
                          <Label htmlFor="compliant-senior" className="text-sm font-medium">
                            Compliant (age &gt; 60)
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            When checked, compliant contact number, Aadhar front/back images, PAN image, and bank passbook image are required.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-lg border border-border/60 bg-background p-4 space-y-4">
                      <p className="text-sm font-semibold">Aadhar Details</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label>Aadhar Number</Label>
                          <Input
                            value={form.aadharNumber}
                            onChange={(e) => updateDocumentsForm(documentsQuotation.id, { aadharNumber: e.target.value })}
                            placeholder="Enter Aadhar number"
                          />
                        </div>
                        <div>
                          <Label>Phone Number *</Label>
                          <Input
                            value={form.contactPhone}
                            onChange={(e) => updateDocumentsForm(documentsQuotation.id, { contactPhone: e.target.value })}
                            placeholder="Enter phone number"
                          />
                        </div>
                        <div>
                          <Label>Aadhar Front Image *</Label>
                          <Input
                            type="file"
                            accept="image/*,.heic,.heif"
                            disabled={!!uploadingField}
                            onChange={(e) =>
                              void onDocumentFileSelected(
                                documentsQuotation.id,
                                "aadharFront",
                                e.target.files?.[0] ?? null,
                              )
                            }
                          />
                          {form.aadharFront ? (
                            <Button type="button" variant="link" className="h-auto p-0 mt-1 text-xs" onClick={() => openDocumentPreview(form.aadharFront)}>
                              View uploaded file
                            </Button>
                          ) : null}
                        </div>
                        <div>
                          <Label>Aadhar Back Image *</Label>
                          <Input
                            type="file"
                            accept="image/*,.heic,.heif"
                            disabled={!!uploadingField}
                            onChange={(e) =>
                              void onDocumentFileSelected(
                                documentsQuotation.id,
                                "aadharBack",
                                e.target.files?.[0] ?? null,
                              )
                            }
                          />
                          {form.aadharBack ? (
                            <Button type="button" variant="link" className="h-auto p-0 mt-1 text-xs" onClick={() => openDocumentPreview(form.aadharBack)}>
                              View uploaded file
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    {isCompliant && (
                      <div className="rounded-lg border border-amber-200 bg-amber-50/40 p-4 md:p-5 space-y-4">
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-amber-900">Compliant Details (Mandatory)</p>
                          <p className="text-xs text-amber-800/80">
                            Only the fields marked with * are required to submit.
                          </p>
                        </div>

                        <div className="rounded-md border border-amber-200/80 bg-background p-4 space-y-4">
                          <p className="text-xs font-semibold uppercase tracking-wide text-amber-900">Compliant Aadhar</p>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <Label className="text-sm font-medium">Compliant Aadhar No</Label>
                              <Input
                                value={form.compliantAadharNumber}
                                onChange={(e) =>
                                  updateDocumentsForm(documentsQuotation.id, { compliantAadharNumber: e.target.value })
                                }
                                placeholder="Enter compliant Aadhar number"
                              />
                            </div>
                            <div>
                              <Label className="text-sm font-medium">Compliant Contact No *</Label>
                              <Input
                                value={form.compliantContactPhone}
                                onChange={(e) =>
                                  updateDocumentsForm(documentsQuotation.id, { compliantContactPhone: e.target.value })
                                }
                                placeholder="Enter compliant contact number"
                              />
                            </div>
                            <div>
                              <Label className="text-sm font-medium">Compliant Aadhar Front Image *</Label>
                              <Input
                                type="file"
                                accept="image/*,.heic,.heif"
                                disabled={!!uploadingField}
                                onChange={(e) =>
                                  void onDocumentFileSelected(
                                    documentsQuotation.id,
                                    "compliantAadharFront",
                                    e.target.files?.[0] ?? null,
                                  )
                                }
                              />
                              {form.compliantAadharFront ? (
                                <Button type="button" variant="link" className="h-auto p-0 mt-1 text-xs" onClick={() => openDocumentPreview(form.compliantAadharFront)}>
                                  View uploaded file
                                </Button>
                              ) : null}
                            </div>
                            <div>
                              <Label className="text-sm font-medium">Compliant Aadhar Back Image *</Label>
                              <Input
                                type="file"
                                accept="image/*,.heic,.heif"
                                disabled={!!uploadingField}
                                onChange={(e) =>
                                  void onDocumentFileSelected(
                                    documentsQuotation.id,
                                    "compliantAadharBack",
                                    e.target.files?.[0] ?? null,
                                  )
                                }
                              />
                              {form.compliantAadharBack ? (
                                <Button type="button" variant="link" className="h-auto p-0 mt-1 text-xs" onClick={() => openDocumentPreview(form.compliantAadharBack)}>
                                  View uploaded file
                                </Button>
                              ) : null}
                            </div>
                          </div>
                        </div>

                        <div className="rounded-md border border-amber-200/80 bg-background p-4 space-y-4">
                          <p className="text-xs font-semibold uppercase tracking-wide text-amber-900">Compliant PAN</p>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <Label className="text-sm font-medium">Compliant PAN Number</Label>
                              <Input
                                value={form.compliantPanNumber}
                                onChange={(e) =>
                                  updateDocumentsForm(documentsQuotation.id, { compliantPanNumber: e.target.value.toUpperCase() })
                                }
                                placeholder="Enter compliant PAN number"
                              />
                            </div>
                            <div>
                              <Label className="text-sm font-medium">Compliant PAN Image *</Label>
                              <Input
                                type="file"
                                accept="image/*,.heic,.heif"
                                disabled={!!uploadingField}
                                onChange={(e) =>
                                  void onDocumentFileSelected(
                                    documentsQuotation.id,
                                    "compliantPanImage",
                                    e.target.files?.[0] ?? null,
                                  )
                                }
                              />
                              {form.compliantPanImage ? (
                                <Button type="button" variant="link" className="h-auto p-0 mt-1 text-xs" onClick={() => openDocumentPreview(form.compliantPanImage)}>
                                  View uploaded file
                                </Button>
                              ) : null}
                            </div>
                          </div>
                        </div>

                        <div className="rounded-md border border-amber-200/80 bg-background p-4 space-y-4">
                          <p className="text-xs font-semibold uppercase tracking-wide text-amber-900">Compliant Bank</p>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <Label className="text-sm font-medium">Compliant Account No</Label>
                              <Input
                                value={form.compliantBankAccountNumber}
                                onChange={(e) =>
                                  updateDocumentsForm(documentsQuotation.id, { compliantBankAccountNumber: e.target.value })
                                }
                                placeholder="Enter compliant bank account number"
                              />
                            </div>
                            <div>
                              <Label className="text-sm font-medium">Compliant IFSC Code</Label>
                              <Input
                                value={form.compliantBankIfsc}
                                onChange={(e) =>
                                  updateDocumentsForm(documentsQuotation.id, { compliantBankIfsc: e.target.value.toUpperCase() })
                                }
                                placeholder="Enter compliant IFSC code"
                              />
                            </div>
                            <div>
                              <Label className="text-sm font-medium">Compliant Bank Name</Label>
                              <Input
                                value={form.compliantBankName}
                                onChange={(e) =>
                                  updateDocumentsForm(documentsQuotation.id, { compliantBankName: e.target.value })
                                }
                                placeholder="Enter compliant bank name"
                              />
                            </div>
                            <div>
                              <Label className="text-sm font-medium">Compliant Branch</Label>
                              <Input
                                value={form.compliantBankBranch}
                                onChange={(e) =>
                                  updateDocumentsForm(documentsQuotation.id, { compliantBankBranch: e.target.value })
                                }
                                placeholder="Enter compliant branch name"
                              />
                            </div>
                            <div className="md:col-span-2">
                              <Label className="text-sm font-medium">Compliant Bank Passbook Image *</Label>
                              <Input
                                type="file"
                                accept="image/*,.heic,.heif"
                                disabled={!!uploadingField}
                                onChange={(e) =>
                                  void onDocumentFileSelected(
                                    documentsQuotation.id,
                                    "compliantBankPassbookImage",
                                    e.target.files?.[0] ?? null,
                                  )
                                }
                              />
                              {form.compliantBankPassbookImage ? (
                                <Button type="button" variant="link" className="h-auto p-0 mt-1 text-xs" onClick={() => openDocumentPreview(form.compliantBankPassbookImage)}>
                                  View uploaded file
                                </Button>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="rounded-lg border border-border/60 bg-background p-4 space-y-4">
                      <p className="text-sm font-semibold">PAN Details</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label>PAN Number</Label>
                          <Input
                            value={form.panNumber}
                            onChange={(e) => updateDocumentsForm(documentsQuotation.id, { panNumber: e.target.value })}
                            placeholder="Enter PAN number"
                          />
                        </div>
                        <div>
                          <Label>PAN Image *</Label>
                          <Input
                            type="file"
                            accept="image/*,.heic,.heif"
                            disabled={!!uploadingField}
                            onChange={(e) =>
                              void onDocumentFileSelected(
                                documentsQuotation.id,
                                "panImage",
                                e.target.files?.[0] ?? null,
                              )
                            }
                          />
                          {form.panImage ? (
                            <Button type="button" variant="link" className="h-auto p-0 mt-1 text-xs" onClick={() => openDocumentPreview(form.panImage)}>
                              View uploaded file
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-lg border border-border/60 bg-background p-4 space-y-4">
                      <p className="text-sm font-semibold">Electricity Bill</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label>Electricity Bill KNO *</Label>
                          <Input
                            value={form.electricityKno}
                            onChange={(e) =>
                              updateDocumentsForm(documentsQuotation.id, { electricityKno: e.target.value })
                            }
                            placeholder="Enter KNO"
                          />
                        </div>
                        <div>
                          <Label>Electricity Bill PDF *</Label>
                          <Input
                            type="file"
                            accept="application/pdf,.pdf"
                            disabled={!!uploadingField}
                            onChange={(e) =>
                              void onDocumentFileSelected(
                                documentsQuotation.id,
                                "electricityBillImage",
                                e.target.files?.[0] ?? null,
                              )
                            }
                          />
                          {form.electricityBillImage ? (
                            <Button type="button" variant="link" className="h-auto p-0 mt-1 text-xs" onClick={() => openDocumentPreview(form.electricityBillImage)}>
                              View uploaded file
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-lg border border-border/60 bg-background p-4 space-y-4">
                      <p className="text-sm font-semibold">Bank Details</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label>Bank Account Number</Label>
                          <Input
                            value={form.bankAccountNumber}
                            onChange={(e) =>
                              updateDocumentsForm(documentsQuotation.id, { bankAccountNumber: e.target.value })
                            }
                            placeholder="Enter account number"
                          />
                        </div>
                        <div>
                          <Label>IFSC Code</Label>
                          <Input
                            value={form.bankIfsc}
                            onChange={(e) => updateDocumentsForm(documentsQuotation.id, { bankIfsc: e.target.value })}
                            placeholder="Enter IFSC code"
                          />
                        </div>
                        <div>
                          <Label>Bank Name</Label>
                          <Input
                            value={form.bankName}
                            onChange={(e) => updateDocumentsForm(documentsQuotation.id, { bankName: e.target.value })}
                            placeholder="Enter bank name"
                          />
                        </div>
                        <div>
                          <Label>Branch</Label>
                          <Input
                            value={form.bankBranch}
                            onChange={(e) => updateDocumentsForm(documentsQuotation.id, { bankBranch: e.target.value })}
                            placeholder="Enter branch name"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <Label>Bank Passbook Image *</Label>
                          <Input
                            type="file"
                            accept="image/*,.heic,.heif"
                            disabled={!!uploadingField}
                            onChange={(e) =>
                              void onDocumentFileSelected(
                                documentsQuotation.id,
                                "bankPassbookImage",
                                e.target.files?.[0] ?? null,
                              )
                            }
                          />
                          {form.bankPassbookImage ? (
                            <Button type="button" variant="link" className="h-auto p-0 mt-1 text-xs" onClick={() => openDocumentPreview(form.bankPassbookImage)}>
                              View uploaded file
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-lg border border-border/60 bg-background p-4 space-y-4">
                      <p className="text-sm font-semibold">Contact Details</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label>Email ID *</Label>
                          <Input
                            type="email"
                            value={form.contactEmail}
                            onChange={(e) => updateDocumentsForm(documentsQuotation.id, { contactEmail: e.target.value })}
                            placeholder="Enter email"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="rounded-lg border border-border/60 bg-background p-4 space-y-4">
                      <p className="text-sm font-semibold">Additional Documents</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label>Geotag Roof Photo</Label>
                          <Input
                            type="file"
                            accept="image/*,.heic,.heif"
                            disabled={!!uploadingField}
                            onChange={(e) =>
                              void onDocumentFileSelected(
                                documentsQuotation.id,
                                "geotagRoofPhoto",
                                e.target.files?.[0] ?? null,
                              )
                            }
                          />
                          {form.geotagRoofPhoto ? (
                            <Button type="button" variant="link" className="h-auto p-0 mt-1 text-xs" onClick={() => openDocumentPreview(form.geotagRoofPhoto)}>
                              View uploaded file
                            </Button>
                          ) : null}
                        </div>
                        <div>
                          <Label>Customer Photo with House</Label>
                          <Input
                            type="file"
                            accept="image/*,.heic,.heif"
                            disabled={!!uploadingField}
                            onChange={(e) =>
                              void onDocumentFileSelected(
                                documentsQuotation.id,
                                "customerWithHousePhoto",
                                e.target.files?.[0] ?? null,
                              )
                            }
                          />
                          {form.customerWithHousePhoto ? (
                            <Button type="button" variant="link" className="h-auto p-0 mt-1 text-xs" onClick={() => openDocumentPreview(form.customerWithHousePhoto)}>
                              View uploaded file
                            </Button>
                          ) : null}
                        </div>
                        <div className="md:col-span-2">
                          <Label>Property Documents (PDF)</Label>
                          <Input
                            type="file"
                            accept="application/pdf,.pdf"
                            disabled={!!uploadingField}
                            onChange={(e) =>
                              void onDocumentFileSelected(
                                documentsQuotation.id,
                                "propertyDocumentPdf",
                                e.target.files?.[0] ?? null,
                              )
                            }
                          />
                          {form.propertyDocumentPdf ? (
                            <Button type="button" variant="link" className="h-auto p-0 mt-1 text-xs" onClick={() => openDocumentPreview(form.propertyDocumentPdf)}>
                              View uploaded file
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </>
                )
              })()}

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDocumentsDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={!documentsQuotation || documentsZipDownloading}
                  onClick={async () => {
                    if (!documentsQuotation) return
                    setDocumentsZipDownloading(true)
                    try {
                      const customerName = getCustomerDisplayName(documentsQuotation.customer) || "Customer"
                      const safeName = customerName.replace(/\s+/g, "-")
                      const fileName = `${safeName}-${documentsQuotation.id}.zip`
                      try {
                        const blob = await api.quotations.downloadDocumentsZip(documentsQuotation.id)
                        const url = window.URL.createObjectURL(blob)
                        const link = document.createElement("a")
                        link.href = url
                        link.download = fileName
                        document.body.appendChild(link)
                        link.click()
                        link.remove()
                        window.URL.revokeObjectURL(url)
                        toast({
                          title: "Download ready",
                          description: "ZIP downloaded from backend.",
                        })
                        return
                      } catch (backendError) {
                        console.warn("Backend ZIP failed, falling back to client ZIP:", backendError)
                      }

                      const form = getDocumentsForm(documentsQuotation.id)
                      const result = await downloadQuotationDocumentsZip({
                        customerName,
                        quotationId: documentsQuotation.id,
                        form,
                      })
                      if (!result.ok) {
                        toast({
                          title: "Download failed",
                          description: result.message,
                          variant: "destructive",
                        })
                      } else {
                        toast({
                          title: "Download ready",
                          description: "ZIP includes uploaded files and document-details.txt.",
                        })
                      }
                    } finally {
                      setDocumentsZipDownloading(false)
                    }
                  }}
                >
                  <Download className="w-4 h-4 mr-2 shrink-0" />
                  {documentsZipDownloading ? "Preparing…" : "Download ZIP"}
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    if (!documentsQuotation) return
                    const form = getDocumentsForm(documentsQuotation.id)
                    const isCompliant = Boolean(form.isCompliantSenior)
                    const aadharPattern = /^\d{12}$/
                    const panPattern = /^[A-Z]{5}\d{4}[A-Z]{1}$/
                    const phonePattern = /^\d{10}$/

                    if (form.aadharNumber && !aadharPattern.test(form.aadharNumber)) {
                      toast({
                        title: "Invalid Aadhar",
                        description: "Aadhar number must be 12 digits.",
                        variant: "destructive",
                      })
                      return
                    }

                    if (form.panNumber && !panPattern.test(form.panNumber.toUpperCase())) {
                      toast({
                        title: "Invalid PAN",
                        description: "PAN must be in format ABCDE1234F.",
                        variant: "destructive",
                      })
                      return
                    }

                    if (!form.contactPhone) {
                      toast({
                        title: "Phone number is required",
                        description: "Please enter a phone number.",
                        variant: "destructive",
                      })
                      return
                    }

                    if (!phonePattern.test(form.contactPhone)) {
                      toast({
                        title: "Invalid phone number",
                        description: "Phone number must be 10 digits.",
                        variant: "destructive",
                      })
                      return
                    }

                    if (!form.electricityKno) {
                      toast({
                        title: "Electricity Bill KNO is required",
                        description: "Please enter Electricity Bill KNO.",
                        variant: "destructive",
                      })
                      return
                    }

                    if (!form.contactEmail) {
                      toast({
                        title: "Email ID is required",
                        description: "Please enter an email address.",
                        variant: "destructive",
                      })
                      return
                    }

                    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
                    if (!emailPattern.test(form.contactEmail)) {
                      toast({
                        title: "Invalid email",
                        description: "Please enter a valid email address.",
                        variant: "destructive",
                      })
                      return
                    }

                    const missingBaseImages =
                      !form.aadharFront ||
                      !form.aadharBack ||
                      !form.panImage ||
                      !form.electricityBillImage ||
                      !form.bankPassbookImage
                    if (missingBaseImages) {
                      toast({
                        title: "Required images missing",
                        description:
                          "Please upload Aadhar front/back, PAN image, Electricity Bill image, and Bank Passbook image.",
                        variant: "destructive",
                      })
                      return
                    }

                    if (isCompliant) {
                      if (form.compliantAadharNumber && !aadharPattern.test(form.compliantAadharNumber)) {
                        toast({
                          title: "Invalid compliant Aadhar",
                          description: "Aadhar number must be 12 digits.",
                          variant: "destructive",
                        })
                        return
                      }

                      if (!form.compliantContactPhone) {
                        toast({
                          title: "Compliant contact number is required",
                          description: "Please enter compliant contact number.",
                          variant: "destructive",
                        })
                        return
                      }

                      if (!phonePattern.test(form.compliantContactPhone)) {
                        toast({
                          title: "Invalid compliant phone",
                          description: "Phone number must be 10 digits.",
                          variant: "destructive",
                        })
                        return
                      }

                      if (form.compliantPanNumber && !panPattern.test(form.compliantPanNumber.toUpperCase())) {
                        toast({
                          title: "Invalid compliant PAN",
                          description: "PAN must be in format ABCDE1234F.",
                          variant: "destructive",
                        })
                        return
                      }

                      if (!form.compliantAadharFront) {
                        toast({
                          title: "Compliant Aadhar front image is required",
                          description: "Please upload compliant Aadhar front image.",
                          variant: "destructive",
                        })
                        return
                      }

                      if (!form.compliantAadharBack) {
                        toast({
                          title: "Compliant Aadhar back image is required",
                          description: "Please upload compliant Aadhar back image.",
                          variant: "destructive",
                        })
                        return
                      }

                      if (!form.compliantPanImage) {
                        toast({
                          title: "Compliant PAN image is required",
                          description: "Please upload compliant PAN image.",
                          variant: "destructive",
                        })
                        return
                      }

                      if (!form.compliantBankPassbookImage) {
                        toast({
                          title: "Compliant Bank Passbook image is required",
                          description: "Please upload compliant Bank Passbook image.",
                          variant: "destructive",
                        })
                        return
                      }
                    }

                    if (useApi) {
                      const pendingFile = firstPendingDocumentFileField(form)
                      if (pendingFile) {
                        toast({
                          title: "Files still uploading",
                          description: "Wait for each file to finish uploading before submitting.",
                          variant: "destructive",
                        })
                        return
                      }
                    }

                    setIsSubmittingDocuments(true)
                    const formData = buildDocumentsMultipartFormData(form)
                    api.quotations
                      .updateDocuments(documentsQuotation.id, formData)
                      .then(async () => {
                        try {
                          const fullQuotation = await api.quotations.getById(documentsQuotation.id)
                          const mergedQuotation = { ...documentsQuotation, ...fullQuotation } as Quotation
                          setDocumentsQuotation(mergedQuotation)
                          setDocumentsFormById((prev) => ({
                            ...prev,
                            [documentsQuotation.id]: {
                              ...seedDocumentsFormFromQuotation(mergedQuotation),
                              ...(prev[documentsQuotation.id] || {}),
                            },
                          }))
                        } catch (refreshError) {
                          console.warn("Could not refresh documents after submit:", refreshError)
                        }
                        toast({
                          title: "Document details saved",
                          description: useApi
                            ? "Details saved to the server."
                            : "Documents saved.",
                        })
                        setDocumentsDialogOpen(false)
                      })
                      .catch((error: unknown) => {
                        toast({
                          title: "Save failed",
                          description: apiErrorToUserMessage(error),
                          variant: "destructive",
                        })
                      })
                      .finally(() => setIsSubmittingDocuments(false))
                  }}
                  disabled={isSubmittingDocuments || !!uploadingField}
                >
                  {isSubmittingDocuments ? "Submitting..." : "Submit"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
