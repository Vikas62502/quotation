"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { DashboardNav } from "@/components/dashboard-nav"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import {
  Search,
  FileText,
  Users,
  IndianRupee,
  Calendar,
  TrendingUp,
  Eye,
  Building,
  Edit,
  Save,
  X,
  CheckCircle2,
  Plus,
  UserPlus,
  Trash2,
  UserCheck,
  UserX,
  Wallet,
  History,
  SlidersHorizontal,
  Download,
} from "lucide-react"
import type { FileLoginStatus, Quotation, QuotationStatus, StatusHistoryEntry } from "@/lib/quotation-context"
import type { Dealer, Visitor, AccountManager } from "@/lib/auth-context"
import { QuotationDetailsDialog } from "@/components/quotation-details-dialog"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { api, ApiError } from "@/lib/api"
import { getRealtime } from "@/lib/realtime"
import { governmentIds, indianStates } from "@/lib/quotation-data"
import { AdminProductManagement } from "@/components/admin-product-management"
import { calculateSystemSize } from "@/lib/pricing-tables"
import { useToast } from "@/hooks/use-toast"
import { formatPersonName } from "@/lib/name-display"
import { downloadQuotationDocumentsZip } from "@/lib/documents-zip-download"

// Admin username check
const ADMIN_USERNAME = "admin"

type CallingActionRecord = {
  id: string
  leadId: string
  dealerId: string
  dealerName: string
  action: string
  callRemark: string
  actionAt: string
  nextFollowUpAt?: string
}

type ApprovalPaymentType = "loan" | "cash" | "mix"

const GOVERNMENT_BANK_OPTIONS = [
  "State Bank of India",
  "Punjab National Bank",
  "Bank of Baroda",
  "Canara Bank",
  "Union Bank of India",
  "Bank of India",
  "Indian Bank",
  "Central Bank of India",
  "UCO Bank",
  "Bank of Maharashtra",
  "Indian Overseas Bank",
  "Punjab & Sind Bank",
] as const

export default function AdminPanelPage() {
  const { isAuthenticated, dealer } = useAuth()
  const router = useRouter()
  const { toast } = useToast()
  const [quotations, setQuotations] = useState<Quotation[]>([])
  const [dealers, setDealers] = useState<Dealer[]>([])
  const [visitors, setVisitors] = useState<Visitor[]>([])
  const [accountManagers, setAccountManagers] = useState<AccountManager[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [customerSearchTerm, setCustomerSearchTerm] = useState("")
  const [searchTerm, setSearchTerm] = useState("")
  const [filterDealer, setFilterDealer] = useState("all")
  const [filterMonth, setFilterMonth] = useState("all")
  const [filterStatus, setFilterStatus] = useState("all")
  const [filterFileLogin, setFilterFileLogin] = useState("all")
  const [filterPaymentType, setFilterPaymentType] = useState("all")
  const [filterBankDetails, setFilterBankDetails] = useState("all")
  const [quotationFiltersOpen, setQuotationFiltersOpen] = useState(false)
  const QUOTATIONS_PAGE_SIZE = 10
  const [currentQuotationPage, setCurrentQuotationPage] = useState(1)
  const [selectedQuotation, setSelectedQuotation] = useState<Quotation | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [documentsDialogOpen, setDocumentsDialogOpen] = useState(false)
  const [documentsQuotation, setDocumentsQuotation] = useState<Quotation | null>(null)
  const [documentsFormById, setDocumentsFormById] = useState<Record<string, any>>({})
  const [isSubmittingDocuments, setIsSubmittingDocuments] = useState(false)
  const [documentsZipDownloading, setDocumentsZipDownloading] = useState(false)
  const [activeTab, setActiveTab] = useState("overview")
  const [callingActions, setCallingActions] = useState<CallingActionRecord[]>([])
  const [callingRange, setCallingRange] = useState<"daily" | "weekly" | "monthly" | "last_month" | "all">("daily")
  const [callingActionDealerFilter, setCallingActionDealerFilter] = useState("all")
  const [callingActionsUnavailable, setCallingActionsUnavailable] = useState(false)
  const [editingQuotation, setEditingQuotation] = useState<Quotation | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false)
  const [approvingQuotationId, setApprovingQuotationId] = useState<string | null>(null)
  const [approvalPaymentType, setApprovalPaymentType] = useState<ApprovalPaymentType>("cash")
  const [approvalBankName, setApprovalBankName] = useState("")
  const [approvalBankIfsc, setApprovalBankIfsc] = useState("")
  const [approvalSubsidyCheque, setApprovalSubsidyCheque] = useState("")
  const [fileLoginDialogOpen, setFileLoginDialogOpen] = useState(false)
  const [fileLoginQuotationId, setFileLoginQuotationId] = useState<string | null>(null)
  const [fileLoginStatusChoice, setFileLoginStatusChoice] = useState<FileLoginStatus>("login_now")
  const [fileLoginPaymentType, setFileLoginPaymentType] = useState<ApprovalPaymentType>("cash")
  const [fileLoginBankName, setFileLoginBankName] = useState("")
  const [fileLoginBankIfsc, setFileLoginBankIfsc] = useState("")
  const [fileLoginSubsidyCheque, setFileLoginSubsidyCheque] = useState("")
  const [optimisticFileLoginSelect, setOptimisticFileLoginSelect] = useState<Record<string, string>>({})
  const [isSavingFileLogin, setIsSavingFileLogin] = useState(false)
  const [statusHistoryQuotation, setStatusHistoryQuotation] = useState<Quotation | null>(null)
  const [isLoadingQuotationDetails, setIsLoadingQuotationDetails] = useState(false)
  const [visitorSearchTerm, setVisitorSearchTerm] = useState("")
  const [visitorDialogOpen, setVisitorDialogOpen] = useState(false)
  const [editingVisitor, setEditingVisitor] = useState<Visitor | null>(null)
  const [accountManagerSearchTerm, setAccountManagerSearchTerm] = useState("")
  const [accountManagerDialogOpen, setAccountManagerDialogOpen] = useState(false)
  const [editingAccountManager, setEditingAccountManager] = useState<AccountManager | null>(null)
  const [accountManagerHistoryDialogOpen, setAccountManagerHistoryDialogOpen] = useState(false)
  const [selectedAccountManagerForHistory, setSelectedAccountManagerForHistory] = useState<AccountManager | null>(null)
  const [accountManagerHistory, setAccountManagerHistory] = useState<any[]>([])
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [newAccountManager, setNewAccountManager] = useState({
    role: "",
    username: "",
    password: "",
    firstName: "",
    lastName: "",
    email: "",
    mobile: "",
  })
  const [dealerSearchTerm, setDealerSearchTerm] = useState("")
  const [editingCustomer, setEditingCustomer] = useState<any | null>(null)
  const [customerEditDialogOpen, setCustomerEditDialogOpen] = useState(false)
  const [customerEditForm, setCustomerEditForm] = useState({
    firstName: "",
    lastName: "",
    mobile: "",
    email: "",
    address: {
      street: "",
      city: "",
      state: "",
      pincode: "",
    },
  })
  const [selectedDealer, setSelectedDealer] = useState<Dealer | null>(null)
  const [dealerDialogOpen, setDealerDialogOpen] = useState(false)
  const [editingDealer, setEditingDealer] = useState<Dealer | null>(null)
  const [dealerEditDialogOpen, setDealerEditDialogOpen] = useState(false)
  const [dealerEditForm, setDealerEditForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    mobile: "",
    gender: "",
    dateOfBirth: "",
    fatherName: "",
    fatherContact: "",
    governmentIdType: "",
    governmentIdNumber: "",
    address: {
      street: "",
      city: "",
      state: "",
      pincode: "",
    },
    isActive: true,
    emailVerified: false,
  })
  const [newVisitor, setNewVisitor] = useState({
    username: "",
    password: "",
    firstName: "",
    lastName: "",
    email: "",
    mobile: "",
    employeeId: "",
  })

  const useApi = process.env.NEXT_PUBLIC_USE_API !== "false"
  const getOperationsRoleOverrides = (): Record<string, string> => {
    try {
      return JSON.parse(localStorage.getItem("operationsRoleOverrides") || "{}")
    } catch {
      return {}
    }
  }
  const saveOperationsRoleOverride = (username: string, roleValue: string) => {
    const key = username.trim().toLowerCase()
    if (!key) return
    const current = getOperationsRoleOverrides()
    current[key] = roleValue
    localStorage.setItem("operationsRoleOverrides", JSON.stringify(current))
  }

  const normalizeCallingAction = (item: any, fallbackDealers: Dealer[], index: number): CallingActionRecord => {
    const dealerId = item?.dealerId || item?.assignedDealerId || item?.dealer?.id || ""
    const fallbackDealer = fallbackDealers.find((d) => d.id === dealerId)
    const dealerNameFromObject =
      item?.dealerName ||
      item?.assignedDealerName ||
      (item?.dealer ? `${item.dealer.firstName || ""} ${item.dealer.lastName || ""}`.trim() : "")
    const dealerName =
      dealerNameFromObject || (fallbackDealer ? `${fallbackDealer.firstName} ${fallbackDealer.lastName}` : "Unknown Employee")
    const actionAt = item?.actionAt || item?.updatedAt || item?.createdAt || ""
    const leadId = item?.leadId || item?.lead?.id || item?.id || ""
    return {
      id: item?.id || `${leadId || "lead"}-${actionAt || "na"}-${index}`,
      leadId,
      dealerId,
      dealerName,
      action: item?.action || item?.status || "unknown",
      callRemark: item?.callRemark || item?.remark || "",
      actionAt,
      nextFollowUpAt: item?.nextFollowUpAt,
    }
  }

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/login")
      return
    }

    // Check if user is admin
    if (dealer?.username !== ADMIN_USERNAME) {
      router.push("/dashboard")
      return
    }

    loadData()
  }, [isAuthenticated, router, dealer])

  useEffect(() => {
    setCurrentQuotationPage(1)
  }, [searchTerm, filterDealer, filterMonth, filterStatus, filterFileLogin, filterPaymentType, filterBankDetails])

  // Fetch full quotation details when edit dialog opens
  useEffect(() => {
    if (editingQuotation && editDialogOpen && useApi) {
      // Check if customer data is incomplete (missing email or address)
      const hasIncompleteCustomer = !editingQuotation.customer?.email || !editingQuotation.customer?.address?.street
      
      if (hasIncompleteCustomer) {
        setIsLoadingQuotationDetails(true)
        // Fetch full quotation details to get complete customer information
        api.quotations.getById(editingQuotation.id)
          .then((response) => {
            // apiRequest returns data.data, so response is already the quotation object
            const fullData = response
            if (fullData && fullData.customer) {
              // Ensure customer address is properly structured
              const customerData = fullData.customer
              const address = customerData.address || {}
              
              setEditingQuotation({
                ...editingQuotation,
                customer: {
                  firstName: customerData.firstName || editingQuotation.customer?.firstName || "",
                  lastName: customerData.lastName || editingQuotation.customer?.lastName || "",
                  mobile: customerData.mobile || editingQuotation.customer?.mobile || "",
                  email: customerData.email || editingQuotation.customer?.email || "",
                  address: {
                    street: address.street || "",
                    city: address.city || "",
                    state: address.state || "",
                    pincode: address.pincode || "",
                  },
                },
                products: fullData.products || editingQuotation.products,
                discount: fullData.discount ?? editingQuotation.discount,
                totalAmount: fullData.pricing?.totalAmount ?? editingQuotation.totalAmount,
                finalAmount: fullData.pricing?.finalAmount ?? fullData.finalAmount ?? editingQuotation.finalAmount,
              })
            }
          })
          .catch((error) => {
            console.error("Error loading full quotation details:", error)
            // Keep the original quotation data on error
          })
          .finally(() => {
            setIsLoadingQuotationDetails(false)
          })
      }
    }
  }, [editingQuotation, editDialogOpen, useApi])

  const normalizeStatusHistoryFromApi = (raw: unknown): StatusHistoryEntry[] => {
    if (!Array.isArray(raw)) return []
    return raw
      .map((e: any) => ({
        status: String(e.status ?? e.to ?? e.newStatus ?? "").trim(),
        at: String(e.at ?? e.changedAt ?? e.timestamp ?? e.createdAt ?? "").trim(),
      }))
      .filter((e) => e.status && e.at)
  }

  const paymentTypeUiLabel = (t: string | undefined) => {
    const x = String(t || "").toLowerCase()
    if (x === "loan") return "Loan"
    if (x === "cash") return "Cash"
    if (x === "mix") return "Cash + loan"
    return t ? String(t) : "—"
  }

  const fileLoginRowSummary = (q: Quotation) => {
    if (!q.fileLoginStatus) return "Not set"
    const pt = paymentTypeUiLabel(q.filePaymentType)
    return q.fileLoginStatus === "already_login" ? `Already logged in · ${pt}` : `Login now · ${pt}`
  }

  const loadData = async () => {
    try {
      if (useApi) {
        // Load quotations
        const quotationsResponse = await api.admin.quotations.getAll()
        setOptimisticFileLoginSelect({})
        const quotationsList = (quotationsResponse.quotations || []).map((q: any) => {
          const customerData = q.customer || {}
          const rawFileLogin = q.fileLoginStatus ?? q.file_login_status
          const fileLoginStatusNorm =
            rawFileLogin === "already_login" || rawFileLogin === "login_now" ? rawFileLogin : undefined
          return {
            id: q.id,
            customer: {
              firstName: customerData.firstName || "",
              lastName: customerData.lastName || "",
              mobile: customerData.mobile || "",
              email: customerData.email || "",
              address: customerData.address || {
                street: "",
                city: "",
                state: "",
                pincode: "",
              },
            },
            // Preserve all products data - don't default to { systemType: "N/A" } if products exists
            products: q.products || {},
            discount: q.discount || 0,
            subtotal: q.pricing?.subtotal ?? q.totalAmount ?? 0,
            totalAmount: q.pricing?.totalAmount || 0,
            finalAmount: q.pricing?.finalAmount || q.finalAmount || 0,
            createdAt: q.createdAt,
            dealerId: q.dealer?.id || q.dealerId,
            dealer: q.dealer || null,
            status: (q.status || "pending") as QuotationStatus,
            paymentMode: q.paymentMode ?? q.payment_mode,
            bankName: q.bankName ?? q.bank_name,
            bankIfsc: q.bankIfsc ?? q.bank_ifsc,
            subsidyChequeDetails: q.subsidyChequeDetails ?? q.subsidy_cheque_details,
            fileLoginStatus: fileLoginStatusNorm as FileLoginStatus | undefined,
            filePaymentType: (q.filePaymentType ?? q.file_payment_type) as ApprovalPaymentType | undefined,
            fileBankName: q.fileBankName ?? q.file_bank_name,
            fileBankIfsc: q.fileBankIfsc ?? q.file_bank_ifsc,
            fileSubsidyChequeDetails: q.fileSubsidyChequeDetails ?? q.file_subsidy_cheque_details,
            fileLoginAt: q.fileLoginAt ?? q.file_login_at,
            statusApprovedAt: q.statusApprovedAt ?? q.status_approved_at ?? q.approvedAt,
            statusHistory: normalizeStatusHistoryFromApi(q.statusHistory ?? q.status_history ?? q.statusChanges),
          }
        })
        setQuotations(quotationsList)

        // Load dealers
        const dealersResponse = await api.admin.dealers.getAll()
        const dealersList = (dealersResponse.dealers || []).map((d: any) => ({
          id: d.id,
          username: d.username,
          firstName: d.firstName,
          lastName: d.lastName,
          email: d.email,
          mobile: d.mobile,
          gender: d.gender || "",
          dateOfBirth: d.dateOfBirth || "",
          fatherName: d.fatherName || "",
          fatherContact: d.fatherContact || "",
          governmentIdType: d.governmentIdType || "",
          governmentIdNumber: d.governmentIdNumber || "",
          address: d.address || {
            street: "",
            city: "",
            state: "",
            pincode: "",
          },
          isActive: d.isActive ?? false, // Backend defaults to false for new registrations
          createdAt: d.createdAt,
          emailVerified: d.emailVerified ?? false,
        }))
        setDealers(dealersList)

        // Load visitors
        // apiRequest returns data.data, so response is already the data object
        // API response structure: { success: true, data: { visitors: [...] } }
        // After apiRequest unwrapping: response = { visitors: [...], pagination: {...} }
        const visitorsResponse = await api.admin.visitors.getAll()
        const visitorsList = visitorsResponse.visitors || []
        setVisitors(visitorsList.map((v: any) => ({
          id: v.id,
          username: v.username || "",
          password: "",
          firstName: v.firstName || "",
          lastName: v.lastName || "",
          email: v.email || "",
          mobile: v.mobile || "",
          employeeId: v.employeeId,
          isActive: v.isActive ?? true,
          createdBy: v.createdBy,
          createdAt: v.createdAt,
          updatedAt: v.updatedAt,
          visitCount: v.visitCount || 0, // Include visit count from API
        })))

        // Load account managers
        try {
          const accountManagersResponse = await api.admin.accountManagers.getAll()
          const accountManagersList = accountManagersResponse.accountManagers || accountManagersResponse || []
          const roleOverrides = getOperationsRoleOverrides()
          setAccountManagers(accountManagersList.map((am: any) => ({
            id: am.id,
            username: am.username || "",
            firstName: am.firstName || "",
            lastName: am.lastName || "",
            email: am.email || "",
            mobile: am.mobile || "",
            role: am.role || roleOverrides[String(am.username || "").toLowerCase()] || "account-management",
            isActive: am.isActive ?? true,
            emailVerified: am.emailVerified ?? false,
            createdAt: am.createdAt,
            loginCount: am.loginCount || 0,
            lastLogin: am.lastLogin,
          })))
        } catch (error) {
          console.error("Error loading account managers:", error)
          // If endpoint doesn't exist yet, use empty array
          setAccountManagers([])
        }

        // Load customers from quotations data (after dealers are loaded)
        const customerMap = new Map<string, any>()
        quotationsList.forEach((q: any) => {
          const customer = q.customer
          if (customer && customer.mobile) {
            const mobile = customer.mobile
            if (!customerMap.has(mobile)) {
              customerMap.set(mobile, {
                id: customer.id,
                firstName: customer.firstName || "",
                lastName: customer.lastName || "",
                mobile: customer.mobile || "",
                email: customer.email || "",
                address: customer.address || {
                  street: "",
                  city: "",
                  state: "",
                  pincode: "",
                },
                quotationCount: 0,
                totalAmount: 0,
                lastQuotation: "",
                dealerIds: new Set<string>(),
              })
            }
            const customerData = customerMap.get(mobile)
            customerData.quotationCount += 1
            customerData.totalAmount += (q.pricing?.finalAmount || q.finalAmount || 0)
            const dealerId = q.dealer?.id || q.dealerId
            if (dealerId) {
              customerData.dealerIds.add(dealerId)
            }
            const qDate = q.createdAt
            if (!customerData.lastQuotation || (qDate && new Date(qDate) > new Date(customerData.lastQuotation))) {
              customerData.lastQuotation = qDate
            }
          }
        })
        // Convert dealerIds Set to array and get dealer names
        const customersList = Array.from(customerMap.values()).map((c: any) => ({
          ...c,
          dealerIds: Array.from(c.dealerIds) as string[],
          dealers: (Array.from(c.dealerIds) as string[]).map((dealerId) => {
            const dealer = dealersList.find((d: any) => d.id === dealerId)
            return dealer ? `${dealer.firstName} ${dealer.lastName}` : "Unknown"
          }),
        }))
        setCustomers(customersList)

        try {
          const callingActionsResponse = await api.admin.callingActions.getAll({ limit: 2000 })
          const source =
            callingActionsResponse?.actions ||
            callingActionsResponse?.callingActions ||
            callingActionsResponse?.items ||
            callingActionsResponse?.logs ||
            callingActionsResponse?.data ||
            []
          const normalizedFromApi = Array.isArray(source)
            ? source
                .map((item: any, index: number) => normalizeCallingAction(item, dealersList as Dealer[], index))
                .sort((a, b) => new Date(b.actionAt || 0).getTime() - new Date(a.actionAt || 0).getTime())
            : []
          const localCallingActions = JSON.parse(localStorage.getItem("callingActionHistory") || "[]")
          const normalizedLocal = Array.isArray(localCallingActions)
            ? localCallingActions.map((item: any, index: number) =>
                normalizeCallingAction(item, dealersList as Dealer[], index + normalizedFromApi.length),
              )
            : []
          const mergedById = new Map<string, CallingActionRecord>()
          ;[...normalizedFromApi, ...normalizedLocal].forEach((item) => {
            if (!item?.id) return
            if (!mergedById.has(item.id)) mergedById.set(item.id, item)
          })
          const merged = Array.from(mergedById.values()).sort(
            (a, b) => new Date(b.actionAt || 0).getTime() - new Date(a.actionAt || 0).getTime(),
          )
          setCallingActions(merged)
          setCallingActionsUnavailable(false)
        } catch (error) {
          console.error("Calling actions endpoint unavailable:", error)
          const localCallingActions = JSON.parse(localStorage.getItem("callingActionHistory") || "[]")
          const normalizedLocal = Array.isArray(localCallingActions)
            ? localCallingActions
                .map((item: any, index: number) => normalizeCallingAction(item, dealersList as Dealer[], index))
                .sort((a, b) => new Date(b.actionAt || 0).getTime() - new Date(a.actionAt || 0).getTime())
            : []
          setCallingActions(normalizedLocal)
          setCallingActionsUnavailable(normalizedLocal.length === 0)
        }
      } else {
        // Fallback to localStorage
        // Load all quotations and ensure they have status
        const allQuotations = JSON.parse(localStorage.getItem("quotations") || "[]")
        const quotationsWithStatus = allQuotations.map((q: Quotation) => ({
          ...q,
          status: q.status || "pending",
          subtotal: (q as any).subtotal ?? q.totalAmount ?? 0,
        }))
        setQuotations(quotationsWithStatus)
        // Update localStorage with status if needed
        if (allQuotations.some((q: Quotation) => !q.status)) {
          localStorage.setItem("quotations", JSON.stringify(quotationsWithStatus))
        }

        // Load all dealers
        const allDealers = JSON.parse(localStorage.getItem("dealers") || "[]")
        // Remove password field
        const dealersWithoutPassword = allDealers.map((d: Dealer & { password?: string }) => {
          const { password: _, ...dealerData } = d
          return dealerData
        })
        setDealers(dealersWithoutPassword)

        // Load account managers from localStorage
        try {
          const allAccountManagers = JSON.parse(localStorage.getItem("accountManagers") || "[]")
          const allInstallers = JSON.parse(localStorage.getItem("installers") || "[]")
          const allBaldevUsers = JSON.parse(localStorage.getItem("baldevUsers") || "[]")
          const allHrUsers = JSON.parse(localStorage.getItem("hrUsers") || "[]")
          const mergedOperationUsers = [
            ...allAccountManagers.map((u: any) => ({ ...u, role: "account-management" })),
            ...allInstallers.map((u: any) => ({ ...u, role: "installer" })),
            ...allBaldevUsers.map((u: any) => ({ ...u, role: "baldev" })),
            ...allHrUsers.map((u: any) => ({ ...u, role: "hr" })),
          ]
          const accountManagersWithoutPassword = mergedOperationUsers.map((am: AccountManager & { password?: string }) => {
            const { password: _, ...accountManagerData } = am
            return accountManagerData
          })
          setAccountManagers(accountManagersWithoutPassword)
        } catch (error) {
          console.error("Error loading account managers from localStorage:", error)
          setAccountManagers([])
        }

        // Load all visitors
        const allVisitors = JSON.parse(localStorage.getItem("visitors") || "[]")
        // Remove password field for display
        const visitorsWithoutPassword = allVisitors.map((v: Visitor & { password?: string }) => {
          const { password: _, ...visitorData } = v
          return visitorData
        })
        setVisitors(visitorsWithoutPassword)

        // Load customers from quotations (localStorage fallback)
        const customerMap = new Map<string, any>()
        quotationsWithStatus.forEach((q: Quotation) => {
          const customer = q.customer
          if (customer && customer.mobile) {
            const mobile = customer.mobile
            if (!customerMap.has(mobile)) {
              customerMap.set(mobile, {
                id: (customer as any).id,
                firstName: customer.firstName || "",
                lastName: customer.lastName || "",
                mobile: customer.mobile || "",
                email: customer.email || "",
                address: customer.address || {
                  street: "",
                  city: "",
                  state: "",
                  pincode: "",
                },
                quotationCount: 0,
                totalAmount: 0,
                lastQuotation: "",
                dealerIds: new Set<string>(),
              })
            }
            const customerData = customerMap.get(mobile)
            customerData.quotationCount += 1
            customerData.totalAmount += q.finalAmount || 0
            if (q.dealerId) {
              customerData.dealerIds.add(q.dealerId)
            }
            const qDate = q.createdAt
            if (!customerData.lastQuotation || (qDate && new Date(qDate) > new Date(customerData.lastQuotation))) {
              customerData.lastQuotation = qDate
            }
          }
        })
        // Get dealer names from localStorage dealers
        const customersList = Array.from(customerMap.values()).map((c: any) => ({
          ...c,
          dealerIds: Array.from(c.dealerIds) as string[],
          dealers: (Array.from(c.dealerIds) as string[]).map((dealerId) => {
            const dealer = dealersWithoutPassword.find((d: Dealer) => d.id === dealerId)
            return dealer ? `${dealer.firstName} ${dealer.lastName}` : "Unknown"
          }),
        }))
        setCustomers(customersList)

        const localCallingActions = JSON.parse(localStorage.getItem("callingActionHistory") || "[]")
        const normalizedLocal = Array.isArray(localCallingActions)
          ? localCallingActions
              .map((item: any, index: number) => normalizeCallingAction(item, dealersWithoutPassword as Dealer[], index))
              .sort((a, b) => new Date(b.actionAt || 0).getTime() - new Date(a.actionAt || 0).getTime())
          : []
        setCallingActions(normalizedLocal)
        setCallingActionsUnavailable(false)
      }
    } catch (error) {
      console.error("Error loading admin data:", error)
    }
  }

  useEffect(() => {
    const socket = getRealtime()
    if (!socket) return

    const refetchAdminData = () => {
      loadData()
    }

    const onBackendMutation = (evt: any) => {
      const domain = String(evt?.domain || "").toLowerCase()
      const path = String(evt?.path || "").toLowerCase()
      if (domain === "admin" || domain === "hr" || domain === "dealers" || path.includes("calling")) {
        refetchAdminData()
      }
    }

    socket.on("calling:actions-updated", refetchAdminData)
    socket.on("dealer:directory-updated", refetchAdminData)
    socket.on("backend:mutation", onBackendMutation)

    return () => {
      socket.off("calling:actions-updated", refetchAdminData)
      socket.off("dealer:directory-updated", refetchAdminData)
      socket.off("backend:mutation", onBackendMutation)
    }
  }, [activeTab])

  if (!isAuthenticated || dealer?.username !== ADMIN_USERNAME) return null

  // Calculate statistics
  const totalQuotations = quotations.length
  const approvedQuotations = quotations.filter((q) => q.status === "approved")
  const totalRevenue = approvedQuotations.reduce((sum, q) => sum + q.finalAmount, 0)
  const uniqueCustomers = customers.length || new Set(quotations.map((q) => q.customer.mobile)).size
  const activeDealers = new Set(quotations.map((q) => q.dealerId)).size
  const totalVisitors = visitors.length
  const activeVisitors = visitors.filter((v) => v.isActive !== false).length

  const currentMonth = new Date().getMonth()
  const currentYear = new Date().getFullYear()
  const thisMonthQuotations = approvedQuotations.filter((q) => {
    const date = new Date(q.createdAt)
    return date.getMonth() === currentMonth && date.getFullYear() === currentYear
  })
  const thisMonthRevenue = thisMonthQuotations.reduce((sum, q) => sum + q.finalAmount, 0)

  // Filter quotations by all active conditions together.
  const normalizedSearchTerm = searchTerm.trim().toLowerCase()
  const filteredQuotations = quotations.filter((q) => {
    const dealerName = getDealerName(q.dealerId)
    const dealerMobile = getDealerMobile(q.dealerId)
    const paymentTypeLabel = getQuotationPaymentTypeLabel(q).toLowerCase()
    const bankDetails = getQuotationBankDetails(q).toLowerCase()
    const fileLoginText = fileLoginRowSummary(q).toLowerCase()
    const statusText = String(q.status || "").toLowerCase()
    const amountText = String(Math.abs(q.finalAmount || 0))
    const createdAtText = new Date(q.createdAt).toLocaleString().toLowerCase()

    const matchesSearch =
      normalizedSearchTerm.length === 0 ||
      q.customer.firstName.toLowerCase().includes(normalizedSearchTerm) ||
      q.customer.lastName.toLowerCase().includes(normalizedSearchTerm) ||
      q.customer.mobile.includes(searchTerm) ||
      q.id.toLowerCase().includes(normalizedSearchTerm) ||
      q.customer.email.toLowerCase().includes(normalizedSearchTerm) ||
      dealerName.toLowerCase().includes(normalizedSearchTerm) ||
      dealerMobile.includes(searchTerm) ||
      paymentTypeLabel.includes(normalizedSearchTerm) ||
      bankDetails.includes(normalizedSearchTerm) ||
      fileLoginText.includes(normalizedSearchTerm) ||
      statusText.includes(normalizedSearchTerm) ||
      amountText.includes(searchTerm) ||
      createdAtText.includes(normalizedSearchTerm)

    const matchesDealer = filterDealer === "all" || q.dealerId === filterDealer
    const normalizedStatus = String(q.status || "pending").toLowerCase()
    const normalizedFileLogin = String(q.fileLoginStatus || "unset").toLowerCase()
    const normalizedPaymentType = String((q as any).paymentType || q.paymentMode || "").toLowerCase()
    const hasBankDetails = Boolean(String(q.bankName || "").trim() || String(q.bankIfsc || "").trim())
    const matchesStatus = filterStatus === "all" || normalizedStatus === filterStatus
    const matchesFileLogin = filterFileLogin === "all" || normalizedFileLogin === filterFileLogin
    const matchesPaymentType =
      filterPaymentType === "all" ||
      (filterPaymentType === "unknown" ? !normalizedPaymentType : normalizedPaymentType === filterPaymentType)
    const matchesBankDetails =
      filterBankDetails === "all" ||
      (filterBankDetails === "with_bank" ? hasBankDetails : !hasBankDetails)

    const date = new Date(q.createdAt)
    const currentDate = new Date()
    let matchesMonth = true

    if (filterMonth === "current") {
      matchesMonth = date.getMonth() === currentDate.getMonth() && date.getFullYear() === currentDate.getFullYear()
    } else if (filterMonth === "previous") {
      const prevMonth = currentDate.getMonth() === 0 ? 11 : currentDate.getMonth() - 1
      const prevYear = currentDate.getMonth() === 0 ? currentDate.getFullYear() - 1 : currentDate.getFullYear()
      matchesMonth = date.getMonth() === prevMonth && date.getFullYear() === prevYear
    }

    return (
      matchesSearch &&
      matchesDealer &&
      matchesMonth &&
      matchesStatus &&
      matchesFileLogin &&
      matchesPaymentType &&
      matchesBankDetails
    )
  })

  const sortedQuotations = [...filteredQuotations].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )

  const quotationTotalPages = Math.max(1, Math.ceil(sortedQuotations.length / QUOTATIONS_PAGE_SIZE))
  const currentPage = Math.min(Math.max(currentQuotationPage, 1), quotationTotalPages)
  const paginatedQuotations = sortedQuotations.slice(
    (currentPage - 1) * QUOTATIONS_PAGE_SIZE,
    currentPage * QUOTATIONS_PAGE_SIZE,
  )
  const showingFrom =
    sortedQuotations.length === 0 ? 0 : (currentPage - 1) * QUOTATIONS_PAGE_SIZE + 1
  const showingTo = Math.min(sortedQuotations.length, currentPage * QUOTATIONS_PAGE_SIZE)
  const activeQuotationFilterCount = [
    filterDealer,
    filterMonth,
    filterStatus,
    filterFileLogin,
    filterPaymentType,
    filterBankDetails,
  ].filter((v) => v !== "all").length

  // Get dealer name by ID
  function getDealerName(dealerId: string) {
    const dealer = dealers.find((d) => d.id === dealerId)
    return dealer ? `${dealer.firstName} ${dealer.lastName}` : "Unknown Dealer"
  }

  function getDealerMobile(dealerId: string) {
    const dealer = dealers.find((d) => d.id === dealerId)
    return dealer?.mobile || "—"
  }

  function getQuotationPaymentTypeLabel(quotation: Quotation) {
    // Prefer file-login payment type; approval-time type is now fallback only.
    const raw = String(
      (quotation as any).filePaymentType || (quotation as any).paymentType || quotation.paymentMode || "",
    ).toLowerCase()
    if (raw === "loan") return "Loan"
    if (raw === "cash") return "Cash"
    if (raw === "mix") return "Cash + loan"
    return "—"
  }

  function getQuotationBankDetails(quotation: Quotation) {
    // Prefer file-login banking (latest filing step). Fallback to approval-time banking.
    const bank = String((quotation.fileBankName as string | undefined) || quotation.bankName || "").trim()
    const ifsc = String((quotation.fileBankIfsc as string | undefined) || quotation.bankIfsc || "")
      .trim()
      .toUpperCase()
    if (!bank && !ifsc) return "—"
    if (bank && ifsc) return `${bank} · ${ifsc}`
    return bank || ifsc
  }

  const csvEscape = (value: unknown) => {
    const raw = String(value ?? "")
    const escaped = raw.replace(/"/g, '""')
    return `"${escaped}"`
  }

  const downloadFilteredQuotationsCsv = () => {
    if (sortedQuotations.length === 0) {
      toast({
        title: "No data to download",
        description: "Apply different filters or search to include quotations.",
      })
      return
    }

    const headers = [
      "Quotation ID",
      "Customer Name",
      "Customer Mobile",
      "Customer Email",
      "Dealer Name",
      "Dealer Contact",
      "Amount",
      "Status",
      "File Login",
      "Payment Type",
      "Bank Details",
      "Created At",
      "File Login At",
      "Approved At",
    ]

    const rows = sortedQuotations.map((quotation) => {
      const customerName = formatPersonName(quotation.customer.firstName, quotation.customer.lastName, "Unknown")
      return [
        quotation.id,
        customerName,
        quotation.customer.mobile || "",
        quotation.customer.email || "",
        getDealerName(quotation.dealerId),
        getDealerMobile(quotation.dealerId),
        Math.abs(quotation.finalAmount || 0),
        quotation.status || "pending",
        fileLoginRowSummary(quotation),
        getQuotationPaymentTypeLabel(quotation),
        getQuotationBankDetails(quotation),
        quotation.createdAt ? new Date(quotation.createdAt).toLocaleString() : "",
        quotation.fileLoginAt ? new Date(quotation.fileLoginAt).toLocaleString() : "",
        quotation.statusApprovedAt ? new Date(quotation.statusApprovedAt).toLocaleString() : "",
      ]
    })

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => csvEscape(cell)).join(","))
      .join("\n")

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    const dateStamp = new Date().toISOString().slice(0, 10)
    link.href = url
    link.download = `quotations-filtered-${dateStamp}.csv`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)

    toast({
      title: "Download started",
      description: `Exported ${sortedQuotations.length} filtered quotations.`,
    })
  }

  const isWithinCallingRange = (actionAt?: string) => {
    if (callingRange === "all") return true
    if (!actionAt) return false
    const actionDate = new Date(actionAt)
    if (Number.isNaN(actionDate.getTime())) return false
    const now = new Date()

    if (callingRange === "daily") {
      return actionDate.toDateString() === now.toDateString()
    }

    if (callingRange === "weekly") {
      const startOfWeek = new Date(now)
      startOfWeek.setDate(now.getDate() - now.getDay())
      startOfWeek.setHours(0, 0, 0, 0)
      return actionDate >= startOfWeek && actionDate <= now
    }

    if (callingRange === "monthly") {
      return actionDate.getMonth() === now.getMonth() && actionDate.getFullYear() === now.getFullYear()
    }

    if (callingRange === "last_month") {
      const prevMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1
      const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()
      return actionDate.getMonth() === prevMonth && actionDate.getFullYear() === prevYear
    }

    return true
  }

  const filteredCallingActions = callingActions.filter((item) => {
    const matchesEmployee =
      callingActionDealerFilter === "all" ||
      item.dealerId === callingActionDealerFilter ||
      item.dealerName === callingActionDealerFilter
    return matchesEmployee && isWithinCallingRange(item.actionAt)
  })

  const callingSummary = filteredCallingActions.reduce(
    (acc, item) => {
      const remark = item.callRemark || ""
      if (item.action === "not_interested") acc.notInterested += 1
      else if (item.action === "follow_up" && remark.includes("[Others]")) acc.others += 1
      else if (item.action === "follow_up") acc.followUp += 1
      else if (item.action === "called" && remark.includes("[Interested]")) acc.interested += 1
      else acc.otherActions += 1
      return acc
    },
    { interested: 0, followUp: 0, notInterested: 0, others: 0, otherActions: 0 },
  )

  // Update quotation status
  const updateQuotationStatus = async (
    quotationId: string,
    status: QuotationStatus,
    approval?: {
      paymentType: ApprovalPaymentType
      bankName?: string
      bankIfsc?: string
      subsidyChequeDetails?: string
    },
  ) => {
    try {
      if (useApi) {
        if (status === "approved" && approval) {
          await api.admin.quotations.updateStatus(quotationId, status, approval)
        } else {
          await api.admin.quotations.updateStatus(quotationId, status)
        }
        await loadData()
      } else {
        // Fallback to localStorage
        const at = new Date().toISOString()
        const updated = quotations.map((q) => {
          if (q.id !== quotationId) return q
          const nextHistory: StatusHistoryEntry[] = [
            ...(q.statusHistory || []),
            { status, at },
          ]
          return {
            ...q,
            status,
            statusHistory: nextHistory,
            ...(status === "approved" ? { statusApprovedAt: at } : {}),
            ...(approval
              ? {
                  paymentMode: approval.paymentType,
                  bankName: approval.bankName,
                  bankIfsc: approval.bankIfsc,
                  ...(approval.subsidyChequeDetails?.trim()
                    ? { subsidyChequeDetails: approval.subsidyChequeDetails.trim() }
                    : {}),
                }
              : {}),
          }
        })
        setQuotations(updated)
        localStorage.setItem("quotations", JSON.stringify(updated))
      }
      
      // Note: Account Management has separate login, so we don't redirect automatically
      // Approved quotations will be visible when account management users log in
    } catch (error) {
      console.error("Error updating quotation status:", error)
      alert(error instanceof ApiError ? error.message : "Failed to update quotation status")
    }
  }

  const handleQuotationStatusChange = (quotationId: string, status: QuotationStatus) => {
    if (status === "approved") {
      // Approve uses payment type already captured in file-login flow.
      const q = quotations.find((x) => x.id === quotationId)
      const paymentTypeRaw = String(
        q?.filePaymentType || (q as any)?.paymentType || q?.paymentMode || "",
      ).toLowerCase()
      const paymentType =
        paymentTypeRaw === "loan" || paymentTypeRaw === "cash" || paymentTypeRaw === "mix"
          ? (paymentTypeRaw as ApprovalPaymentType)
          : undefined

      if (!paymentType) {
        toast({
          title: "File login payment type required",
          description: "Set payment type in File Login first, then approve the quotation.",
          variant: "destructive",
        })
        return
      }

      void updateQuotationStatus(quotationId, status, {
        paymentType,
        bankName: q?.fileBankName || q?.bankName,
        bankIfsc: q?.fileBankIfsc || q?.bankIfsc,
        subsidyChequeDetails: q?.fileSubsidyChequeDetails || q?.subsidyChequeDetails,
      })
      return
    }
    void updateQuotationStatus(quotationId, status)
  }

  const confirmApprovalWithPaymentType = async () => {
    if (!approvingQuotationId) return
    const needsBank = approvalPaymentType === "loan" || approvalPaymentType === "mix"
    const subsidyTrim = approvalSubsidyCheque.trim()
    const subsidyPayload =
      (approvalPaymentType === "cash" || approvalPaymentType === "mix") && subsidyTrim
        ? { subsidyChequeDetails: subsidyTrim }
        : {}
    if (needsBank) {
      const bankName = approvalBankName.trim()
      const ifscRaw = approvalBankIfsc.trim().toUpperCase().replace(/\s/g, "")
      if (!bankName) {
        toast({
          title: "Bank name required",
          description: "Enter the customer’s bank for loan or cash + loan approval.",
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
      await updateQuotationStatus(approvingQuotationId, "approved", {
        paymentType: approvalPaymentType,
        bankName,
        bankIfsc: ifscRaw,
        ...subsidyPayload,
      })
    } else {
      await updateQuotationStatus(approvingQuotationId, "approved", {
        paymentType: approvalPaymentType,
        ...subsidyPayload,
      })
    }
    setApprovalDialogOpen(false)
    setApprovingQuotationId(null)
    setApprovalBankName("")
    setApprovalBankIfsc("")
    setApprovalSubsidyCheque("")
  }

  const resetFileLoginFormFields = () => {
    setFileLoginBankName("")
    setFileLoginBankIfsc("")
    setFileLoginSubsidyCheque("")
  }

  const openFileLoginDialog = (q: Quotation, status: FileLoginStatus) => {
    setFileLoginQuotationId(q.id)
    setFileLoginStatusChoice(status)
    setFileLoginPaymentType((q.filePaymentType as ApprovalPaymentType) || "cash")
    setFileLoginBankName(q.fileBankName || "")
    setFileLoginBankIfsc(q.fileBankIfsc || "")
    setFileLoginSubsidyCheque(q.fileSubsidyChequeDetails || "")
    setFileLoginDialogOpen(true)
  }

  const handleFileLoginSelectChange = async (quotation: Quotation, value: string) => {
    if (value === "unset") {
      setOptimisticFileLoginSelect((prev) => {
        const next = { ...prev }
        delete next[quotation.id]
        return next
      })
      try {
        if (useApi) {
          await api.admin.quotations.updateFileLogin(quotation.id, { reset: true })
          await loadData()
        } else {
          const updated = quotations.map((q) =>
            q.id === quotation.id
              ? {
                  ...q,
                  fileLoginStatus: undefined,
                  filePaymentType: undefined,
                  fileBankName: undefined,
                  fileBankIfsc: undefined,
                  fileSubsidyChequeDetails: undefined,
                  fileLoginAt: undefined,
                }
              : q,
          )
          setQuotations(updated)
          localStorage.setItem("quotations", JSON.stringify(updated))
        }
      } catch (error) {
        console.error(error)
        toast({
          title: "Could not clear file login",
          description: error instanceof ApiError ? error.message : "Try again or update the backend endpoint.",
          variant: "destructive",
        })
      }
      return
    }
    if (value === "already_login" || value === "login_now") {
      setOptimisticFileLoginSelect((prev) => ({ ...prev, [quotation.id]: value }))
      openFileLoginDialog(quotation, value as FileLoginStatus)
    }
  }

  const confirmSaveFileLogin = async () => {
    if (!fileLoginQuotationId) return
    const needsBank = fileLoginPaymentType === "loan" || fileLoginPaymentType === "mix"
    const subsidyTrim = fileLoginSubsidyCheque.trim()
    if (needsBank) {
      const bankName = fileLoginBankName.trim()
      const ifscRaw = fileLoginBankIfsc.trim().toUpperCase().replace(/\s/g, "")
      if (!bankName) {
        toast({
          title: "Bank name required",
          description: "Enter the customer’s bank for loan or cash + loan file login.",
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
      const at = new Date().toISOString()
      if (useApi) {
        const bankName = fileLoginBankName.trim()
        const ifscRaw = fileLoginBankIfsc.trim().toUpperCase().replace(/\s/g, "")
        await api.admin.quotations.updateFileLogin(fileLoginQuotationId, {
          fileLoginStatus: fileLoginStatusChoice,
          filePaymentType: fileLoginPaymentType,
          ...(needsBank ? { bankName, bankIfsc: ifscRaw } : {}),
          ...(subsidyTrim ? { fileSubsidyChequeDetails: subsidyTrim } : {}),
        })
        await loadData()
      } else {
        const bankName = fileLoginBankName.trim()
        const ifscRaw = fileLoginBankIfsc.trim().toUpperCase().replace(/\s/g, "")
        const updated = quotations.map((q) =>
          q.id === fileLoginQuotationId
            ? {
                ...q,
                fileLoginStatus: fileLoginStatusChoice,
                filePaymentType: fileLoginPaymentType,
                fileBankName: needsBank ? bankName : undefined,
                fileBankIfsc: needsBank ? ifscRaw : undefined,
                fileSubsidyChequeDetails: subsidyTrim || undefined,
                fileLoginAt: at,
              }
            : q,
        )
        setQuotations(updated)
        localStorage.setItem("quotations", JSON.stringify(updated))
      }
      setOptimisticFileLoginSelect((prev) => {
        const next = { ...prev }
        delete next[fileLoginQuotationId]
        return next
      })
      setFileLoginDialogOpen(false)
      setFileLoginQuotationId(null)
      resetFileLoginFormFields()
      toast({ title: "File login saved" })
    } catch (error) {
      console.error(error)
      toast({
        title: "Save failed",
        description: error instanceof ApiError ? error.message : "Could not save file login.",
        variant: "destructive",
      })
    } finally {
      setIsSavingFileLogin(false)
    }
  }

  // Update quotation data
  const updateQuotation = async (updatedQuotation: Quotation) => {
    try {
      if (useApi) {
        // Note: Full quotation update endpoint may not exist in API spec
        // For now, we'll update discount if changed
        if (updatedQuotation.discount !== undefined) {
          await api.quotations.updateDiscount(updatedQuotation.id, updatedQuotation.discount)
        }
        await loadData()
      } else {
        // Fallback to localStorage
        const updated = quotations.map((q) => (q.id === updatedQuotation.id ? updatedQuotation : q))
        setQuotations(updated)
        localStorage.setItem("quotations", JSON.stringify(updated))
      }
      setEditDialogOpen(false)
      setEditingQuotation(null)
    } catch (error) {
      console.error("Error updating quotation:", error)
      alert(error instanceof ApiError ? error.message : "Failed to update quotation")
    }
  }

  // Get status color
  const getStatusColor = (status: QuotationStatus | undefined) => {
    switch (status) {
      case "approved":
        return "bg-green-50 border-green-200 hover:bg-green-100"
      case "rejected":
        return "bg-red-50 border-red-200 hover:bg-red-100"
      case "completed":
        return "bg-blue-50 border-blue-200 hover:bg-blue-100"
      default:
        return "bg-yellow-50 border-yellow-200 hover:bg-yellow-100"
    }
  }

  // Get status badge color
  const getStatusBadgeColor = (status: QuotationStatus | undefined) => {
    switch (status) {
      case "approved":
        return "bg-green-500 text-white"
      case "rejected":
        return "bg-red-500 text-white"
      case "completed":
        return "bg-blue-500 text-white"
      default:
        return "bg-yellow-500 text-white"
    }
  }

  // Get system size display
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

  const getDocumentsForm = (quotationId: string) => {
    return (
      documentsFormById[quotationId] || {
        isCompliantSenior: false,
        aadharNumber: "",
        aadharFront: null,
        aadharBack: null,
        compliantAadharNumber: "",
        compliantAadharFront: null,
        compliantAadharBack: null,
        compliantContactPhone: "",
        compliantPanNumber: "",
        compliantPanImage: null,
        compliantBankAccountNumber: "",
        compliantBankIfsc: "",
        compliantBankName: "",
        compliantBankBranch: "",
        compliantBankPassbookImage: null,
        panNumber: "",
        panImage: null,
        electricityKno: "",
        electricityBillImage: null,
        bankAccountNumber: "",
        bankIfsc: "",
        bankName: "",
        bankBranch: "",
        bankPassbookImage: null,
        geotagRoofPhoto: null,
        customerWithHousePhoto: null,
        propertyDocumentPdf: null,
        contactPhone: "",
        contactEmail: "",
      }
    )
  }

  const updateDocumentsForm = (quotationId: string, updates: Record<string, any>) => {
    setDocumentsFormById((prev) => ({
      ...prev,
      [quotationId]: {
        ...getDocumentsForm(quotationId),
        ...updates,
      },
    }))
  }

  const buildDocumentsFormData = (form: Record<string, any>) => {
    const formData = new FormData()
    const appendIfValue = (key: string, value: any) => {
      if (value === undefined || value === null || value === "") return
      formData.append(key, String(value))
    }
    const appendFile = (key: string, value: File | null) => {
      if (value instanceof File) formData.append(key, value)
    }

    appendIfValue("isCompliantSenior", form.isCompliantSenior ? "true" : "false")
    appendIfValue("aadharNumber", form.aadharNumber)
    appendIfValue("phoneNumber", form.contactPhone)
    appendFile("aadharFront", form.aadharFront)
    appendFile("aadharBack", form.aadharBack)

    appendIfValue("compliantAadharNumber", form.compliantAadharNumber)
    appendIfValue("compliantContactPhone", form.compliantContactPhone)
    appendFile("compliantAadharFront", form.compliantAadharFront)
    appendFile("compliantAadharBack", form.compliantAadharBack)
    appendIfValue("compliantPanNumber", form.compliantPanNumber)
    appendFile("compliantPanImage", form.compliantPanImage)
    appendIfValue("compliantBankAccountNumber", form.compliantBankAccountNumber)
    appendIfValue("compliantBankIfsc", form.compliantBankIfsc)
    appendIfValue("compliantBankName", form.compliantBankName)
    appendIfValue("compliantBankBranch", form.compliantBankBranch)
    appendFile("compliantBankPassbookImage", form.compliantBankPassbookImage)

    appendIfValue("panNumber", form.panNumber)
    appendFile("panImage", form.panImage)
    appendIfValue("electricityKno", form.electricityKno)
    appendFile("electricityBillImage", form.electricityBillImage)

    appendIfValue("bankAccountNumber", form.bankAccountNumber)
    appendIfValue("bankIfsc", form.bankIfsc)
    appendIfValue("bankName", form.bankName)
    appendIfValue("bankBranch", form.bankBranch)
    appendFile("bankPassbookImage", form.bankPassbookImage)
    appendFile("geotagRoofPhoto", form.geotagRoofPhoto)
    appendFile("customerWithHousePhoto", form.customerWithHousePhoto)
    appendFile("propertyDocumentPdf", form.propertyDocumentPdf)

    appendIfValue("emailId", form.contactEmail)
    return formData
  }

  const getExistingFileRef = (documents: Record<string, any>, key: string) => {
    const candidates = [
      documents[key],
      documents[`${key}Url`],
      documents[`${key}_url`],
      documents[`${key}Path`],
      documents[`${key}_path`],
    ]
    const fileRef = candidates.find((value) => typeof value === "string" && value.trim() !== "")
    return fileRef || null
  }

  const mapDocumentsToForm = (documents: Record<string, any>) => ({
    isCompliantSenior: documents.isCompliantSenior === true || documents.isCompliantSenior === "true",
    aadharNumber: documents.aadharNumber || "",
    aadharFront: getExistingFileRef(documents, "aadharFront"),
    aadharBack: getExistingFileRef(documents, "aadharBack"),
    compliantAadharNumber: documents.compliantAadharNumber || "",
    compliantAadharFront: getExistingFileRef(documents, "compliantAadharFront"),
    compliantAadharBack: getExistingFileRef(documents, "compliantAadharBack"),
    compliantContactPhone: documents.compliantContactPhone || "",
    compliantPanNumber: documents.compliantPanNumber || "",
    compliantPanImage: getExistingFileRef(documents, "compliantPanImage"),
    compliantBankAccountNumber: documents.compliantBankAccountNumber || "",
    compliantBankIfsc: documents.compliantBankIfsc || "",
    compliantBankName: documents.compliantBankName || "",
    compliantBankBranch: documents.compliantBankBranch || "",
    compliantBankPassbookImage: getExistingFileRef(documents, "compliantBankPassbookImage"),
    panNumber: documents.panNumber || "",
    panImage: getExistingFileRef(documents, "panImage"),
    electricityKno: documents.electricityKno || "",
    electricityBillImage: getExistingFileRef(documents, "electricityBillImage"),
    bankAccountNumber: documents.bankAccountNumber || "",
    bankIfsc: documents.bankIfsc || "",
    bankName: documents.bankName || "",
    bankBranch: documents.bankBranch || "",
    bankPassbookImage: getExistingFileRef(documents, "bankPassbookImage"),
    geotagRoofPhoto: getExistingFileRef(documents, "geotagRoofPhoto"),
    customerWithHousePhoto: getExistingFileRef(documents, "customerWithHousePhoto"),
    propertyDocumentPdf: getExistingFileRef(documents, "propertyDocumentPdf"),
    contactPhone: documents.phoneNumber || documents.contactPhone || "",
    contactEmail: documents.emailId || documents.contactEmail || "",
  })

  const getUploadedImagePreviews = (form: Record<string, any>) => {
    const previews = [
      { label: "Aadhar Front", value: form.aadharFront },
      { label: "Aadhar Back", value: form.aadharBack },
      { label: "Compliant Aadhar Front", value: form.compliantAadharFront },
      { label: "Compliant Aadhar Back", value: form.compliantAadharBack },
      { label: "PAN Image", value: form.panImage },
      { label: "Compliant PAN Image", value: form.compliantPanImage },
      { label: "Electricity Bill Image", value: form.electricityBillImage },
      { label: "Bank Passbook Image", value: form.bankPassbookImage },
      { label: "Geotag Roof Photo", value: form.geotagRoofPhoto },
      { label: "Customer Photo with House", value: form.customerWithHousePhoto },
      { label: "Property Documents (PDF)", value: form.propertyDocumentPdf },
      { label: "Compliant Bank Passbook", value: form.compliantBankPassbookImage },
    ]

    return previews.filter((item) => typeof item.value === "string" && item.value.trim() !== "")
  }

  const openDocumentsDialog = async (quotation: Quotation) => {
    try {
      let quotationWithDocuments: any = quotation
      if (useApi) {
        const fullQuotation = await api.quotations.getById(quotation.id)
        quotationWithDocuments = { ...quotation, ...fullQuotation }
      }

      const documents =
        quotationWithDocuments?.documents ||
        quotationWithDocuments?.documentDetails ||
        quotationWithDocuments?.quotationDocuments ||
        {}

      setDocumentsFormById((prev) => ({
        ...prev,
        [quotation.id]: {
          ...getDocumentsForm(quotation.id),
          ...mapDocumentsToForm(documents),
          ...(prev[quotation.id] || {}),
        },
      }))
      setDocumentsQuotation(quotationWithDocuments)
      setDocumentsDialogOpen(true)
    } catch (error) {
      console.error("Error loading documents:", error)
      toast({
        title: "Could not load existing documents",
        description: "You can still upload new files.",
        variant: "destructive",
      })
      setDocumentsQuotation(quotation)
      setDocumentsDialogOpen(true)
    }
  }

  // Get dealer stats
  const dealerStats = dealers.map((d) => {
    const dealerQuotations = quotations.filter((q) => q.dealerId === d.id)
    const dealerRevenue = dealerQuotations.reduce((sum, q) => sum + q.finalAmount, 0)
    return {
      dealer: d,
      quotationCount: dealerQuotations.length,
      revenue: dealerRevenue,
    }
  })

  return (
    <div className="min-h-screen bg-background">
      <DashboardNav />

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-8">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Admin Panel</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1 sm:mt-2">View and manage all system data</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <div className="md:hidden">
            <div className="text-xs font-medium text-muted-foreground mb-2">Select Section</div>
            <Select value={activeTab} onValueChange={setActiveTab}>
              <SelectTrigger className="w-full h-10 rounded-xl border-border/70 bg-card shadow-sm">
                <SelectValue placeholder="Select section" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="overview">Overview</SelectItem>
                <SelectItem value="calling-reports">Calling Reports</SelectItem>
                <SelectItem value="quotations">Quotations</SelectItem>
                <SelectItem value="dealers">Dealers</SelectItem>
                <SelectItem value="customers">Customers</SelectItem>
                <SelectItem value="visitors">Visitors</SelectItem>
                <SelectItem value="payments">Payments</SelectItem>
                <SelectItem value="products">Products</SelectItem>
                <SelectItem value="account-management">Others</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="hidden md:block w-full pb-1">
            <TabsList className="grid w-full grid-cols-9 h-11 rounded-xl border border-border/70 bg-muted/30 p-1 shadow-sm [&_[data-slot=tabs-trigger]]:h-9 [&_[data-slot=tabs-trigger]]:px-2 [&_[data-slot=tabs-trigger]]:text-sm [&_[data-slot=tabs-trigger]]:font-medium [&_[data-slot=tabs-trigger]]:text-muted-foreground [&_[data-slot=tabs-trigger][data-state=active]]:bg-background [&_[data-slot=tabs-trigger][data-state=active]]:text-foreground [&_[data-slot=tabs-trigger][data-state=active]]:border-border/80">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="calling-reports">Calling Reports</TabsTrigger>
            <TabsTrigger value="quotations">Quotations</TabsTrigger>
            <TabsTrigger value="dealers">Dealers</TabsTrigger>
            <TabsTrigger value="customers">Customers</TabsTrigger>
            <TabsTrigger value="visitors">Visitors</TabsTrigger>
            <TabsTrigger value="payments">Payments</TabsTrigger>
            <TabsTrigger value="products">Products</TabsTrigger>
            <TabsTrigger value="account-management">Others</TabsTrigger>
            </TabsList>
          </div>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Statistics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Quotations</CardTitle>
                  <FileText className="w-5 h-5 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{totalQuotations}</div>
                  <p className="text-xs text-muted-foreground mt-1">All time</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle>
                  <IndianRupee className="w-5 h-5 text-green-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">₹{(totalRevenue / 100000).toFixed(1)}L</div>
                  <p className="text-xs text-muted-foreground mt-1">All time</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">This Month</CardTitle>
                  <TrendingUp className="w-5 h-5 text-blue-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">₹{(thisMonthRevenue / 100000).toFixed(1)}L</div>
                  <p className="text-xs text-muted-foreground mt-1">{thisMonthQuotations.length} quotations</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Active Dealers</CardTitle>
                  <Users className="w-5 h-5 text-amber-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{activeDealers}</div>
                  <p className="text-xs text-muted-foreground mt-1">Out of {dealers.length} total</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Active Visitors</CardTitle>
                  <UserCheck className="w-5 h-5 text-purple-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{activeVisitors}</div>
                  <p className="text-xs text-muted-foreground mt-1">Out of {totalVisitors} total</p>
                </CardContent>
              </Card>
            </div>

            {/* Top Dealers  */}
            <Card>
              <CardHeader>
                <CardTitle>Top Dealers by Revenue</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {dealerStats
                    .sort((a, b) => b.revenue - a.revenue)
                    .slice(0, 5)
                    .map((stat) => (
                      <div key={stat.dealer.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div>
                          <p className="font-semibold">
                            {stat.dealer.firstName} {stat.dealer.lastName}
                          </p>
                          <p className="text-sm text-muted-foreground">{stat.dealer.email}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">₹{(stat.revenue / 100000).toFixed(1)}L</p>
                          <p className="text-sm text-muted-foreground">{stat.quotationCount} quotations</p>
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="calling-reports" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Employee Calling Actions</CardTitle>
                <CardDescription>
                  Track which sales employee performed each action with daily, weekly, monthly, and last-month filters.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Select value={callingRange} onValueChange={(value: "daily" | "weekly" | "monthly" | "last_month" | "all") => setCallingRange(value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select report range" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="last_month">Last Month</SelectItem>
                      <SelectItem value="all">All Time</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={callingActionDealerFilter} onValueChange={setCallingActionDealerFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Filter by employee" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Employees</SelectItem>
                      {dealers.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.firstName} {d.lastName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                  <Card className="border-border/60">
                    <CardContent className="pt-4">
                      <p className="text-xs text-muted-foreground">Interested</p>
                      <p className="text-xl font-semibold">{callingSummary.interested}</p>
                    </CardContent>
                  </Card>
                  <Card className="border-border/60">
                    <CardContent className="pt-4">
                      <p className="text-xs text-muted-foreground">Follow Up</p>
                      <p className="text-xl font-semibold">{callingSummary.followUp}</p>
                    </CardContent>
                  </Card>
                  <Card className="border-border/60">
                    <CardContent className="pt-4">
                      <p className="text-xs text-muted-foreground">Not Interested</p>
                      <p className="text-xl font-semibold">{callingSummary.notInterested}</p>
                    </CardContent>
                  </Card>
                  <Card className="border-border/60">
                    <CardContent className="pt-4">
                      <p className="text-xs text-muted-foreground">Others</p>
                      <p className="text-xl font-semibold">{callingSummary.others}</p>
                    </CardContent>
                  </Card>
                  <Card className="border-border/60">
                    <CardContent className="pt-4">
                      <p className="text-xs text-muted-foreground">Total</p>
                      <p className="text-xl font-semibold">{filteredCallingActions.length}</p>
                    </CardContent>
                  </Card>
                </div>

                {callingActionsUnavailable ? (
                  <p className="text-sm text-muted-foreground">
                    Calling actions endpoint is not available on backend yet. Once enabled, all employee actions will appear here.
                  </p>
                ) : filteredCallingActions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No calling actions found for selected filters.</p>
                ) : (
                  <div className="space-y-2">
                    {filteredCallingActions.slice(0, 300).map((item) => (
                      <div key={item.id} className="rounded-md border border-border/70 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-medium text-sm break-words">{item.dealerName || "Unknown Employee"}</p>
                            <p className="text-xs text-muted-foreground break-all">Lead: {item.leadId || "N/A"}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{item.action || "N/A"}</Badge>
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {item.actionAt ? new Date(item.actionAt).toLocaleString() : "N/A"}
                            </span>
                          </div>
                        </div>
                        {item.callRemark ? <p className="text-sm mt-2 break-words">Remark: {item.callRemark}</p> : null}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* All Quotations Tab */}
          <TabsContent value="quotations" className="space-y-4">
            <Card>
              <Dialog open={quotationFiltersOpen} onOpenChange={setQuotationFiltersOpen}>
                <DialogContent className="sm:max-w-xl">
                  <DialogHeader>
                    <DialogTitle>Quotation Filters</DialogTitle>
                    <DialogDescription>Filter by dealer, time, status, file login, payment type, and bank details.</DialogDescription>
                  </DialogHeader>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <Select value={filterDealer} onValueChange={setFilterDealer}>
                      <SelectTrigger>
                        <SelectValue placeholder="Filter by dealer" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Dealers</SelectItem>
                        {dealers.map((d) => (
                          <SelectItem key={d.id} value={d.id}>
                            {d.firstName} {d.lastName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={filterMonth} onValueChange={setFilterMonth}>
                      <SelectTrigger>
                        <SelectValue placeholder="Filter by month" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Time</SelectItem>
                        <SelectItem value="current">Current Month</SelectItem>
                        <SelectItem value="previous">Previous Month</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                      <SelectTrigger>
                        <SelectValue placeholder="Filter by status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="approved">Approved</SelectItem>
                        <SelectItem value="rejected">Rejected</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={filterFileLogin} onValueChange={setFilterFileLogin}>
                      <SelectTrigger>
                        <SelectValue placeholder="Filter by file login" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All File Login</SelectItem>
                        <SelectItem value="unset">Not set</SelectItem>
                        <SelectItem value="already_login">Already logged in</SelectItem>
                        <SelectItem value="login_now">Login now</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={filterPaymentType} onValueChange={setFilterPaymentType}>
                      <SelectTrigger>
                        <SelectValue placeholder="Filter by payment type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Payment Type</SelectItem>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="loan">Loan</SelectItem>
                        <SelectItem value="mix">Cash + loan</SelectItem>
                        <SelectItem value="unknown">Not set</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={filterBankDetails} onValueChange={setFilterBankDetails}>
                      <SelectTrigger>
                        <SelectValue placeholder="Filter by bank details" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Bank Details</SelectItem>
                        <SelectItem value="with_bank">With Bank</SelectItem>
                        <SelectItem value="without_bank">Without Bank</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setFilterDealer("all")
                        setFilterMonth("all")
                        setFilterStatus("all")
                        setFilterFileLogin("all")
                        setFilterPaymentType("all")
                        setFilterBankDetails("all")
                      }}
                    >
                      Reset
                    </Button>
                    <Button type="button" onClick={() => setQuotationFiltersOpen(false)}>
                      Apply
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
              <CardHeader>
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by name, mobile, email, or ID..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full sm:w-auto"
                    onClick={() => setQuotationFiltersOpen(true)}
                  >
                    <SlidersHorizontal className="w-4 h-4 mr-2" />
                    Filters
                    {activeQuotationFilterCount > 0 ? ` (${activeQuotationFilterCount})` : ""}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full sm:w-auto"
                    onClick={downloadFilteredQuotationsCsv}
                    disabled={sortedQuotations.length === 0}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download ({sortedQuotations.length})
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {sortedQuotations.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No quotations found</p>
                  </div>
                ) : (
                  <>
                    {/* Mobile Card View */}
                    <div className="block md:hidden space-y-3">
                      {paginatedQuotations.map((quotation) => (
                        <div
                          key={quotation.id}
                          className={`p-4 rounded-lg border-2 ${getStatusColor(quotation.status)}`}
                        >
                          <div className="flex justify-between items-start mb-3">
                            <div className="flex-1">
                              <p className="text-xs font-mono text-muted-foreground mb-1">{quotation.id}</p>
                              <p className="font-semibold text-sm">
                                {formatPersonName(quotation.customer.firstName, quotation.customer.lastName, "Unknown")}
                              </p>
                              <p className="text-xs text-muted-foreground">{quotation.customer.mobile}</p>
                            </div>
                            <Badge className={`text-xs ${getStatusBadgeColor(quotation.status)}`}>
                              {(quotation.status || "pending").charAt(0).toUpperCase() +
                                (quotation.status || "pending").slice(1)}
                            </Badge>
                          </div>
                          
                          <div className="space-y-2 mb-3">
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Agent:</span>
                              <span className="font-medium">{getDealerName(quotation.dealerId)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Amount:</span>
                              <span className="font-semibold">₹{Math.abs(quotation.finalAmount || 0).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">System:</span>
                              <Badge variant="outline" className="text-xs">{getSystemSize(quotation)}</Badge>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Created:</span>
                              <span className="text-xs">{new Date(quotation.createdAt).toLocaleString()}</span>
                            </div>
                            {quotation.fileLoginAt ? (
                              <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">File login:</span>
                                <span className="text-xs">{new Date(quotation.fileLoginAt).toLocaleString()}</span>
                              </div>
                            ) : null}
                            {quotation.statusApprovedAt ? (
                              <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Approved:</span>
                                <span className="text-xs">{new Date(quotation.statusApprovedAt).toLocaleString()}</span>
                              </div>
                            ) : null}
                          </div>

                          <div className="space-y-2">
                            <p className="text-xs font-medium text-muted-foreground">File login</p>
                            <Select
                              value={
                                optimisticFileLoginSelect[quotation.id] ??
                                quotation.fileLoginStatus ??
                                "unset"
                              }
                              onValueChange={(value) => void handleFileLoginSelectChange(quotation, value)}
                            >
                              <SelectTrigger className="w-full h-9 text-xs">
                                <SelectValue placeholder="File login" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="unset">Not set</SelectItem>
                                <SelectItem value="already_login">Already logged in</SelectItem>
                                <SelectItem value="login_now">Login now</SelectItem>
                              </SelectContent>
                            </Select>
                            <p className="text-[10px] text-muted-foreground leading-snug">{fileLoginRowSummary(quotation)}</p>
                          </div>

                          <div className="space-y-2">
                            <Select
                              value={quotation.status || "pending"}
                              onValueChange={(value) => handleQuotationStatusChange(quotation.id, value as QuotationStatus)}
                            >
                              <SelectTrigger className="w-full h-9 text-xs">
                                <SelectValue placeholder="Change Status" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="pending">Pending</SelectItem>
                                <SelectItem value="approved">Approved</SelectItem>
                                <SelectItem value="rejected">Rejected</SelectItem>
                                <SelectItem value="completed">Completed</SelectItem>
                              </SelectContent>
                            </Select>
                            
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setEditingQuotation(quotation)
                                  setEditDialogOpen(true)
                                }}
                                className="flex-1"
                              >
                                <Edit className="w-3 h-3 mr-1" />
                                Edit
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  openDocumentsDialog(quotation)
                                }}
                                className="flex-1"
                              >
                                <FileText className="w-3 h-3 mr-1" />
                                Docs
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedQuotation(quotation)
                                  setDialogOpen(true)
                                }}
                                className="flex-1"
                              >
                                <Eye className="w-3 h-3 mr-1" />
                                View
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setStatusHistoryQuotation(quotation)}
                                className="flex-1"
                                title="Status timeline"
                              >
                                <History className="w-3 h-3 mr-1" />
                                Timeline
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Desktop Table View */}
                    <div className="hidden md:block overflow-x-hidden">
                      <table className="w-full table-fixed">
                        <thead>
                          <tr className="border-b border-border">
                            <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground w-[6rem]">
                              Quotation ID
                            </th>
                            <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground w-[8rem]">Customer</th>
                            <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground w-[9rem]">
                              Agent/Dealer
                            </th>
                            <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground w-[7rem]">Amount</th>
                            <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground w-[7rem]">
                              Status
                            </th>
                            <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground w-[7rem]">
                              File login
                            </th>
                            <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground w-[7rem]">
                              Payment Type
                            </th>
                            <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground w-[8rem]">
                              Bank details
                            </th>
                            <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground w-[9rem]">
                              Dates
                            </th>
                            <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground w-[7rem]">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedQuotations.map((quotation) => (
                            <tr
                              key={quotation.id}
                              className={`border-b border-border last:border-0 transition-colors ${getStatusColor(quotation.status)}`}
                            >
                              <td className="py-3 px-2 align-top break-words">
                                <span className="text-sm font-mono">{quotation.id}</span>
                              </td>
                              <td className="py-3 px-2 align-top break-words">
                                <div>
                                  <p className="text-sm font-medium">
                                    {formatPersonName(quotation.customer.firstName, quotation.customer.lastName, "Unknown")}
                                  </p>
                                  <p className="text-xs text-muted-foreground">{quotation.customer.mobile}</p>
                                  <p className="text-xs text-muted-foreground">{quotation.customer.email}</p>
                                </div>
                              </td>
                              <td className="py-3 px-2 align-top break-words">
                                <div className="flex items-center gap-2">
                                  <Building className="w-4 h-4 text-muted-foreground" />
                                  <div>
                                    <span className="text-sm font-medium">{getDealerName(quotation.dealerId)}</span>
                                    <p className="text-xs text-muted-foreground">
                                      Contact: {getDealerMobile(quotation.dealerId)}
                                    </p>
                                  </div>
                                </div>
                              </td>
                              <td className="py-3 px-2 text-right align-top break-words">
                                <div>
                                  <p className="text-sm font-medium">₹{Math.abs(quotation.finalAmount || 0).toLocaleString()}</p>
                                  {quotation.discount > 0 && (
                                    <p className="text-xs text-muted-foreground">{quotation.discount}% off</p>
                                  )}
                                </div>
                              </td>
                              <td className="py-3 px-2 align-top">
                                <div className="space-y-2 min-w-0">
                                  <Select
                                    value={quotation.status || "pending"}
                                    onValueChange={(value) => handleQuotationStatusChange(quotation.id, value as QuotationStatus)}
                                  >
                                    <SelectTrigger className="w-full min-w-0 h-8 text-xs">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="pending">Pending</SelectItem>
                                      <SelectItem value="approved">Approved</SelectItem>
                                      <SelectItem value="rejected">Rejected</SelectItem>
                                      <SelectItem value="completed">Completed</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <Badge
                                    className={`text-xs w-full justify-center ${getStatusBadgeColor(quotation.status)}`}
                                    variant="default"
                                  >
                                    {(quotation.status || "pending").charAt(0).toUpperCase() +
                                      (quotation.status || "pending").slice(1)}
                                  </Badge>
                                </div>
                              </td>
                              <td className="py-3 px-2 align-top break-words">
                                <div className="space-y-1 w-full min-w-0">
                                  <Select
                                    value={
                                      optimisticFileLoginSelect[quotation.id] ??
                                      quotation.fileLoginStatus ??
                                      "unset"
                                    }
                                    onValueChange={(value) => void handleFileLoginSelectChange(quotation, value)}
                                  >
                                    <SelectTrigger className="w-full min-w-0 h-8 text-xs">
                                      <SelectValue placeholder="File login" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="unset">Not set</SelectItem>
                                      <SelectItem value="already_login">Already logged in</SelectItem>
                                      <SelectItem value="login_now">Login now</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <p className="text-[10px] text-muted-foreground leading-snug">
                                    {fileLoginRowSummary(quotation)}
                                  </p>
                                </div>
                              </td>
                              <td className="py-3 px-2 align-top break-words">
                                <p className="text-sm font-medium leading-snug">{getQuotationPaymentTypeLabel(quotation)}</p>
                              </td>
                              <td className="py-3 px-2 align-top break-words">
                                <p className="text-sm leading-snug break-words">{getQuotationBankDetails(quotation)}</p>
                              </td>
                              <td className="py-3 px-2 text-right text-xs text-muted-foreground align-top break-words">
                                <div className="space-y-1">
                                  <div>
                                    <span className="font-medium text-foreground/80">Created </span>
                                    {new Date(quotation.createdAt).toLocaleString()}
                                  </div>
                                  {quotation.fileLoginAt ? (
                                    <div>
                                      <span className="font-medium text-foreground/80">File login </span>
                                      {new Date(quotation.fileLoginAt).toLocaleString()}
                                    </div>
                                  ) : null}
                                  {quotation.statusApprovedAt ? (
                                    <div>
                                      <span className="font-medium text-foreground/80">Approved </span>
                                      {new Date(quotation.statusApprovedAt).toLocaleString()}
                                    </div>
                                  ) : null}
                                </div>
                              </td>
                              <td className="py-3 px-2 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setStatusHistoryQuotation(quotation)}
                                    title="Status timeline"
                                  >
                                    <History className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => {
                                      openDocumentsDialog(quotation)
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
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="flex flex-col gap-1 mt-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        Showing {showingFrom}–{showingTo} of {sortedQuotations.length} quotations
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={currentPage <= 1}
                          onClick={() => setCurrentQuotationPage((prev) => Math.max(prev - 1, 1))}
                        >
                          Previous
                        </Button>
                        <span className="text-xs">
                          Page {currentPage} of {quotationTotalPages}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={currentPage >= quotationTotalPages}
                          onClick={() => setCurrentQuotationPage((prev) => Math.min(prev + 1, quotationTotalPages))}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Dealers Tab */}
          <TabsContent value="dealers" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                  <CardTitle>All Dealers ({dealers.length})</CardTitle>
                  <div className="relative w-full sm:w-auto">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by name, email, mobile, username..."
                      value={dealerSearchTerm}
                      onChange={(e) => setDealerSearchTerm(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {(() => {
                    const filteredDealers = dealers.filter((d) => {
                      if (!dealerSearchTerm.trim()) return true
                      const search = dealerSearchTerm.toLowerCase()
                      return (
                        d.firstName.toLowerCase().includes(search) ||
                        d.lastName.toLowerCase().includes(search) ||
                        d.email.toLowerCase().includes(search) ||
                        d.mobile.includes(search) ||
                        d.username.toLowerCase().includes(search)
                      )
                    })

                    if (filteredDealers.length === 0) {
                      return (
                        <div className="text-center py-12 text-muted-foreground">
                          <Building className="w-12 h-12 mx-auto mb-4 opacity-50" />
                          <p>No dealers found</p>
                        </div>
                      )
                    }

                    return filteredDealers.map((d) => {
                      const dealerQuotations = quotations.filter((q) => q.dealerId === d.id)
                      const dealerRevenue = dealerQuotations.reduce((sum, q) => sum + q.finalAmount, 0)
                      const isPending = d.isActive === false
                      return (
                        <div
                          key={d.id}
                          className={`p-4 border rounded-lg ${isPending ? "opacity-75 bg-muted/30 border-orange-200" : ""}`}
                        >
                          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2 flex-wrap">
                                <h3 className="font-semibold text-lg">
                                  {d.firstName} {d.lastName}
                                </h3>
                                {d.username === ADMIN_USERNAME && (
                                  <Badge variant="default">Admin</Badge>
                                )}
                                {isPending ? (
                                  <Badge variant="secondary" className="bg-orange-500">Pending Approval</Badge>
                                ) : (
                                  <Badge className="bg-green-500">Active</Badge>
                                )}
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-muted-foreground break-words">
                                <div>
                                  <span className="font-medium">Email:</span> <span className="break-all">{d.email}</span>
                                  {d.emailVerified === false && <Badge variant="outline" className="ml-2 text-xs">Unverified</Badge>}
                                </div>
                                <div>
                                  <span className="font-medium">Mobile:</span> {d.mobile}
                                </div>
                                <div>
                                  <span className="font-medium">Username:</span> {d.username}
                                </div>
                                <div>
                                  <span className="font-medium">Gender:</span> {d.gender}
                                </div>
                                {d.dateOfBirth && (
                                  <div>
                                    <span className="font-medium">Date of Birth:</span> {new Date(d.dateOfBirth).toLocaleDateString()}
                                  </div>
                                )}
                                {d.fatherName && (
                                  <div>
                                    <span className="font-medium">Father&apos;s Name:</span> {d.fatherName}
                                  </div>
                                )}
                                {d.fatherContact && (
                                  <div>
                                    <span className="font-medium">Father&apos;s Contact:</span> {d.fatherContact}
                                  </div>
                                )}
                                {d.governmentIdType && (
                                  <div>
                                    <span className="font-medium">ID Type:</span> {d.governmentIdType}
                                  </div>
                                )}
                                {d.governmentIdNumber && (
                                  <div>
                                    <span className="font-medium">ID Number:</span> {d.governmentIdNumber}
                                  </div>
                                )}
                                <div className="md:col-span-2">
                                  <span className="font-medium">Address:</span>{" "}
                                  <span className="break-words">{d.address.street}, {d.address.city}, {d.address.state} - {d.address.pincode}</span>
                                </div>
                                {d.createdAt && (
                                  <div className="md:col-span-2 text-xs">
                                    <span className="font-medium">Registered:</span> {new Date(d.createdAt).toLocaleString()}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="w-full lg:w-auto lg:ml-4 space-y-2 text-left lg:text-right">
                              <div>
                                <div className="text-lg font-semibold">₹{(dealerRevenue / 100000).toFixed(1)}L</div>
                                <div className="text-sm text-muted-foreground">{dealerQuotations.length} quotations</div>
                              </div>
                              {isPending && (
                                <Button
                                  size="sm"
                                  className="w-full sm:w-auto bg-green-600 hover:bg-green-700"
                                  onClick={async () => {
                                    if (!confirm(`Are you sure you want to approve and activate ${d.firstName} ${d.lastName}?`)) return
                                    
                                    try {
                                      if (useApi) {
                                        // Try activate endpoint first, fallback to update
                                        try {
                                          await api.admin.dealers.activate(d.id)
                                        } catch {
                                          // If activate endpoint doesn't exist, use update
                                          await api.admin.dealers.update(d.id, { isActive: true })
                                        }
                                        await loadData()
                                      } else {
                                        // Fallback to localStorage
                                        const updated = dealers.map((dealer) =>
                                          dealer.id === d.id ? { ...dealer, isActive: true } : dealer
                                        )
                                        setDealers(updated)
                                      }
                                    } catch (error) {
                                      console.error("Error activating dealer:", error)
                                      alert(error instanceof ApiError ? error.message : "Failed to activate dealer")
                                    }
                                  }}
                                >
                                  <UserCheck className="w-3 h-3 mr-1" />
                                  Approve
                                </Button>
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                className="w-full sm:w-auto"
                                onClick={() => {
                                  setSelectedDealer(d)
                                  setDealerDialogOpen(true)
                                }}
                              >
                                <Eye className="w-3 h-3 mr-1" />
                                View Details
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="w-full sm:w-auto"
                                onClick={() => {
                                  setEditingDealer(d)
                                  setDealerEditForm({
                                    firstName: d.firstName || "",
                                    lastName: d.lastName || "",
                                    email: d.email || "",
                                    mobile: d.mobile || "",
                                    gender: d.gender || "",
                                    dateOfBirth: d.dateOfBirth || "",
                                    fatherName: d.fatherName || "",
                                    fatherContact: d.fatherContact || "",
                                    governmentIdType: d.governmentIdType || "",
                                    governmentIdNumber: d.governmentIdNumber || "",
                                    address: {
                                      street: d.address?.street || "",
                                      city: d.address?.city || "",
                                      state: d.address?.state || "",
                                      pincode: d.address?.pincode || "",
                                    },
                                    isActive: d.isActive ?? true,
                                    emailVerified: d.emailVerified ?? false,
                                  })
                                  setDealerEditDialogOpen(true)
                                }}
                              >
                                <Edit className="w-3 h-3 mr-1" />
                                Edit
                              </Button>
                            </div>
                          </div>
                        </div>
                      )
                    })
                  })()}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Customers Tab */}
          <TabsContent value="customers" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <CardTitle>All Customers ({customers.length})</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">Customers from all dealers</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search customers by name, mobile, email, or dealer..."
                    value={customerSearchTerm}
                    onChange={(e) => setCustomerSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
                {(() => {
                  const filteredCustomers = customers.filter((c) => {
                    if (!customerSearchTerm.trim()) return true
                    const searchLower = customerSearchTerm.toLowerCase()
                    return (
                      c.firstName.toLowerCase().includes(searchLower) ||
                      c.lastName.toLowerCase().includes(searchLower) ||
                      c.mobile.includes(customerSearchTerm) ||
                      c.email.toLowerCase().includes(searchLower) ||
                      c.dealers.some((d: string) => d.toLowerCase().includes(searchLower))
                    )
                  })

                  if (filteredCustomers.length === 0) {
                    return (
                      <div className="text-center py-12 text-muted-foreground">
                        <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>No customers found</p>
                        {customerSearchTerm ? (
                          <Button variant="link" onClick={() => setCustomerSearchTerm("")} className="mt-2">
                            Clear search
                          </Button>
                        ) : null}
                      </div>
                    )
                  }

                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {filteredCustomers.map((customer) => (
                        <div
                          key={customer.mobile}
                          className="border border-border rounded-lg p-4 hover:border-primary/50 transition-colors"
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <h3 className="font-medium">
                                {customer.firstName} {customer.lastName}
                              </h3>
                              <p className="text-sm text-muted-foreground">{customer.mobile}</p>
                            </div>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <FileText className="w-3 h-3" />
                              {customer.quotationCount}
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground mb-2">{customer.email}</p>
                          {customer.dealers && customer.dealers.length > 0 && (
                            <div className="mb-2">
                              <p className="text-xs text-muted-foreground">
                                <span className="font-medium">Dealers:</span> {customer.dealers.join(", ")}
                              </p>
                            </div>
                          )}
                          <div className="mb-2">
                            <div className="text-xs text-muted-foreground mb-1">
                              {customer.address?.street && (
                                <div className="mb-1">{customer.address.street}</div>
                              )}
                              <div>
                                {[
                                  customer.address?.city,
                                  customer.address?.state,
                                  customer.address?.pincode
                                ].filter(Boolean).join(", ")}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center justify-between text-sm mb-2">
                            <span className="text-muted-foreground text-xs">
                              Total Spent
                            </span>
                            <span className="font-medium text-primary">₹{Math.abs(customer.totalAmount || 0).toLocaleString()}</span>
                          </div>
                          {customer.lastQuotation && customer.lastQuotation !== "" && !isNaN(new Date(customer.lastQuotation).getTime()) && (
                            <p className="text-xs text-muted-foreground mb-3">
                              Last: {new Date(customer.lastQuotation).toLocaleDateString()}
                            </p>
                          )}
                          <div className="flex gap-2 mt-3">
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1"
                              onClick={async () => {
                                // Load full customer details if we have an ID
                                if (customer.id && useApi) {
                                  try {
                                    const response = await api.customers.getById(customer.id)
                                    const fullCustomer = response.customer || response.data || response
                                    setEditingCustomer({
                                      ...customer,
                                      ...fullCustomer,
                                      address: {
                                        street: fullCustomer.address?.street || customer.address?.street || "",
                                        city: fullCustomer.address?.city || customer.address?.city || "",
                                        state: fullCustomer.address?.state || customer.address?.state || "",
                                        pincode: fullCustomer.address?.pincode || customer.address?.pincode || "",
                                      },
                                    })
                                  } catch (error) {
                                    console.error("Error loading customer details:", error)
                                    setEditingCustomer(customer)
                                  }
                                } else {
                                  setEditingCustomer(customer)
                                }
                                setCustomerEditForm({
                                  firstName: customer.firstName || "",
                                  lastName: customer.lastName || "",
                                  mobile: customer.mobile || "",
                                  email: customer.email || "",
                                  address: {
                                    street: customer.address?.street || "",
                                    city: customer.address?.city || "",
                                    state: customer.address?.state || "",
                                    pincode: customer.address?.pincode || "",
                                  },
                                })
                                setCustomerEditDialogOpen(true)
                              }}
                            >
                              <Edit className="w-3 h-3 mr-1" />
                              Edit
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                })()}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Visitors Tab */}
          <TabsContent value="visitors" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                  <CardTitle>All Visitors ({visitors.length})</CardTitle>
                  <Button
                    onClick={() => {
                      setNewVisitor({
                        username: "",
                        password: "",
                        firstName: "",
                        lastName: "",
                        email: "",
                        mobile: "",
                        employeeId: "",
                      })
                      setEditingVisitor(null)
                      setVisitorDialogOpen(true)
                    }}
                    className="w-full sm:w-auto"
                  >
                    <UserPlus className="w-4 h-4 mr-2" />
                    Create Visitor
                  </Button>
                </div>
                <div className="mt-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by name, email, mobile, employee ID..."
                      value={visitorSearchTerm}
                      onChange={(e) => setVisitorSearchTerm(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {(() => {
                  const filteredVisitors = visitors.filter((v) => {
                    if (!visitorSearchTerm.trim()) return true
                    const search = visitorSearchTerm.toLowerCase()
                    return (
                      v.firstName.toLowerCase().includes(search) ||
                      v.lastName.toLowerCase().includes(search) ||
                      v.email.toLowerCase().includes(search) ||
                      v.mobile.includes(search) ||
                      (v.employeeId && v.employeeId.toLowerCase().includes(search)) ||
                      v.username.toLowerCase().includes(search)
                    )
                  })

                  if (filteredVisitors.length === 0) {
                    return (
                      <div className="text-center py-12 text-muted-foreground">
                        <UserCheck className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>No visitors found</p>
                      </div>
                    )
                  }

                  return (
                    <div className="space-y-4">
                      {filteredVisitors.map((visitor) => {
                        // Visit count from API response (visitCount field from visitor data)
                        const visitCount = (visitor as any).visitCount || 0

                        return (
                          <div
                            key={visitor.id}
                            className={`p-4 border rounded-lg ${visitor.isActive === false ? "opacity-60 bg-muted/30" : ""}`}
                          >
                            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-2 flex-wrap">
                                  <h3 className="font-semibold text-lg">
                                    {visitor.firstName} {visitor.lastName}
                                  </h3>
                                  {visitor.isActive === false ? (
                                    <Badge variant="secondary">Inactive</Badge>
                                  ) : (
                                    <Badge className="bg-green-500">Active</Badge>
                                  )}
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-muted-foreground break-words">
                                  <div>
                                    <span className="font-medium">Email:</span> <span className="break-all">{visitor.email}</span>
                                  </div>
                                  <div>
                                    <span className="font-medium">Mobile:</span> {visitor.mobile}
                                  </div>
                                  <div>
                                    <span className="font-medium">Username:</span> {visitor.username}
                                  </div>
                                  {visitor.employeeId && (
                                    <div>
                                      <span className="font-medium">Employee ID:</span> {visitor.employeeId}
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="w-full lg:w-auto lg:ml-4 text-left lg:text-right">
                                <div className="text-lg font-semibold">{visitCount}</div>
                                <div className="text-sm text-muted-foreground">visits assigned</div>
                                <div className="flex flex-wrap gap-2 mt-2 lg:justify-end">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="w-full sm:w-auto"
                                    onClick={async () => {
                                      if (useApi) {
                                        // Fetch full visitor details from API
                                        try {
                                          const fullVisitorResponse = await api.admin.visitors.getById(visitor.id)
                                          // apiRequest returns data.data, so response is already the visitor object
                                          const fullVisitor = fullVisitorResponse || visitor
                                          setEditingVisitor(fullVisitor)
                                          setNewVisitor({
                                            username: fullVisitor.username || "",
                                            password: "",
                                            firstName: fullVisitor.firstName || "",
                                            lastName: fullVisitor.lastName || "",
                                            email: fullVisitor.email || "",
                                            mobile: fullVisitor.mobile || "",
                                            employeeId: fullVisitor.employeeId || "",
                                          })
                                          setVisitorDialogOpen(true)
                                        } catch (error) {
                                          console.error("Error loading visitor details:", error)
                                          // Fallback to visitor from list
                                          setEditingVisitor(visitor)
                                          setNewVisitor({
                                            username: visitor.username || "",
                                            password: "",
                                            firstName: visitor.firstName || "",
                                            lastName: visitor.lastName || "",
                                            email: visitor.email || "",
                                            mobile: visitor.mobile || "",
                                            employeeId: visitor.employeeId || "",
                                          })
                                          setVisitorDialogOpen(true)
                                        }
                                      } else {
                                        // Fallback to localStorage
                                        const allVisitors = JSON.parse(localStorage.getItem("visitors") || "[]")
                                        const fullVisitor = allVisitors.find((v: Visitor & { password?: string }) => v.id === visitor.id)
                                        setEditingVisitor(fullVisitor || visitor)
                                        setNewVisitor({
                                          username: fullVisitor?.username || "",
                                          password: "",
                                          firstName: fullVisitor?.firstName || "",
                                          lastName: fullVisitor?.lastName || "",
                                          email: fullVisitor?.email || "",
                                          mobile: fullVisitor?.mobile || "",
                                          employeeId: fullVisitor?.employeeId || "",
                                        })
                                        setVisitorDialogOpen(true)
                                      }
                                    }}
                                  >
                                    <Edit className="w-3 h-3 mr-1" />
                                    Edit
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="w-full sm:w-auto"
                                    onClick={async () => {
                                      if (!confirm(`Are you sure you want to ${visitor.isActive === false ? "activate" : "deactivate"} this visitor?`)) return
                                      
                                      try {
                                        if (useApi) {
                                          if (visitor.isActive === false) {
                                            // Activate by updating isActive to true
                                            await api.admin.visitors.update(visitor.id, { isActive: true })
                                          } else {
                                            // Deactivate
                                            await api.admin.visitors.delete(visitor.id)
                                          }
                                          await loadData()
                                        } else {
                                          // Fallback to localStorage
                                          const allVisitors = JSON.parse(localStorage.getItem("visitors") || "[]")
                                          const updated = allVisitors.map((v: Visitor) =>
                                            v.id === visitor.id ? { ...v, isActive: visitor.isActive === false ? true : false } : v
                                          )
                                          localStorage.setItem("visitors", JSON.stringify(updated))
                                          const visitorsWithoutPassword = updated.map((v: Visitor & { password?: string }) => {
                                            const { password: _, ...visitorData } = v
                                            return visitorData
                                          })
                                          setVisitors(visitorsWithoutPassword)
                                        }
                                      } catch (error) {
                                        console.error("Error updating visitor status:", error)
                                        alert(error instanceof ApiError ? error.message : "Failed to update visitor status")
                                      }
                                    }}
                                  >
                                    {visitor.isActive === false ? (
                                      <>
                                        <UserCheck className="w-3 h-3 mr-1" />
                                        Activate
                                      </>
                                    ) : (
                                      <>
                                        <UserX className="w-3 h-3 mr-1" />
                                        Deactivate
                                      </>
                                    )}
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )
                })()}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Account Management Tab */}
          <TabsContent value="account-management" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                  <CardTitle>Operations User IDs ({accountManagers.length})</CardTitle>
                  <Button
                    onClick={() => {
                      setNewAccountManager({
                        role: "",
                        username: "",
                        password: "",
                        firstName: "",
                        lastName: "",
                        email: "",
                        mobile: "",
                      })
                      setEditingAccountManager(null)
                      setAccountManagerDialogOpen(true)
                    }}
                    className="w-full sm:w-auto"
                  >
                    <UserPlus className="w-4 h-4 mr-2" />
                    Create User ID
                  </Button>
                </div>
                <div className="mt-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by name, email, mobile, username..."
                      value={accountManagerSearchTerm}
                      onChange={(e) => setAccountManagerSearchTerm(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {(() => {
                  const filteredAccountManagers = accountManagers.filter((am) => {
                    if (!accountManagerSearchTerm.trim()) return true
                    const search = accountManagerSearchTerm.toLowerCase()
                    return (
                      am.firstName.toLowerCase().includes(search) ||
                      am.lastName.toLowerCase().includes(search) ||
                      am.email.toLowerCase().includes(search) ||
                      am.mobile.includes(search) ||
                      am.username.toLowerCase().includes(search)
                    )
                  })

                  if (filteredAccountManagers.length === 0) {
                    return (
                      <div className="text-center py-12 text-muted-foreground">
                        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                          <Wallet className="w-8 h-8 opacity-50" />
                        </div>
                        <p className="font-medium mb-1">
                          {accountManagerSearchTerm ? "No matching account managers found" : "No account management users found"}
                        </p>
                        {!accountManagerSearchTerm && (
                          <p className="text-sm mt-1">Click "Create User ID" to add account manager, installer, baldev, or HR user</p>
                        )}
                      </div>
                    )
                  }

                  return (
                    <div className="space-y-4">
                      {filteredAccountManagers.map((am) => {
                        const loginCount = (am as any).loginCount || 0
                        const lastLogin = (am as any).lastLogin
                        return (
                          <div
                            key={am.id}
                            className={`p-4 border rounded-lg transition-colors hover:bg-muted/50 ${am.isActive === false ? "opacity-60 bg-muted/30" : "bg-card"}`}
                          >
                            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-3 flex-wrap">
                                  <h3 className="font-semibold text-lg text-foreground">
                                    {am.firstName} {am.lastName}
                                  </h3>
                                  {am.isActive === false ? (
                                    <Badge variant="secondary" className="text-xs">Inactive</Badge>
                                  ) : (
                                    <Badge className="bg-green-500 text-white text-xs">Active</Badge>
                                  )}
                                  {am.emailVerified && (
                                    <Badge variant="outline" className="text-xs border-blue-500 text-blue-700 dark:text-blue-400">Verified</Badge>
                                  )}
                                  <Badge variant="outline" className="text-xs capitalize">
                                    {((am as any).role || "account-management").replace("-", " ")}
                                  </Badge>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-muted-foreground">Email:</span>
                                    <span className="text-foreground break-all">{am.email}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-muted-foreground">Mobile:</span>
                                    <span className="text-foreground">{am.mobile}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-muted-foreground">Username:</span>
                                    <span className="text-foreground font-mono text-xs">{am.username}</span>
                                  </div>
                                  {am.createdAt && (
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium text-muted-foreground">Created:</span>
                                      <span className="text-foreground">{new Date(am.createdAt).toLocaleDateString()}</span>
                                    </div>
                                  )}
                                  {lastLogin && (
                                    <div className="md:col-span-2 flex items-center gap-2">
                                      <span className="font-medium text-muted-foreground">Last Login:</span>
                                      <span className="text-foreground">{new Date(lastLogin).toLocaleString()}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="flex flex-col lg:items-end gap-3 w-full lg:w-auto shrink-0">
                                <div className="text-center p-2 bg-primary/10 rounded-lg min-w-[60px] w-fit">
                                  <div className="text-xl font-bold text-primary">{loginCount}</div>
                                  <div className="text-xs text-muted-foreground mt-1">logins</div>
                                </div>
                                <div className="flex gap-2 flex-wrap justify-start lg:justify-end">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={async () => {
                                      setIsLoadingHistory(true)
                                      setSelectedAccountManagerForHistory(am)
                                      setAccountManagerHistoryDialogOpen(true)
                                      
                                      try {
                                        if (useApi) {
                                          const historyResponse = await api.admin.accountManagers.getHistory(am.id)
                                          setAccountManagerHistory(historyResponse.history || historyResponse || [])
                                        } else {
                                          // Fallback to localStorage - create mock history
                                          setAccountManagerHistory([
                                            {
                                              id: "hist-1",
                                              action: "login",
                                              timestamp: new Date().toISOString(),
                                              details: "User logged in successfully",
                                              ipAddress: "192.168.1.100",
                                            },
                                            {
                                              id: "hist-2",
                                              action: "view_quotations",
                                              timestamp: new Date(Date.now() - 86400000).toISOString(),
                                              details: "Viewed approved quotations list",
                                              ipAddress: "192.168.1.100",
                                            },
                                          ])
                                        }
                                      } catch (error) {
                                        console.error("Error loading account manager history:", error)
                                        toast({
                                          title: "Error",
                                          description: error instanceof ApiError ? error.message : "Failed to load history. Please try again.",
                                          variant: "destructive",
                                        })
                                        setAccountManagerHistory([])
                                      } finally {
                                        setIsLoadingHistory(false)
                                      }
                                    }}
                                  >
                                    <History className="w-3 h-3 mr-1" />
                                    History
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={async () => {
                                      if (useApi) {
                                        try {
                                          const fullAccountManager = await api.admin.accountManagers.getById(am.id)
                                          setEditingAccountManager(fullAccountManager || am)
                                          setNewAccountManager({
                                            role: fullAccountManager?.role || (am as any).role || "account-management",
                                            username: fullAccountManager?.username || am.username,
                                            password: "",
                                            firstName: fullAccountManager?.firstName || am.firstName,
                                            lastName: fullAccountManager?.lastName || am.lastName,
                                            email: fullAccountManager?.email || am.email,
                                            mobile: fullAccountManager?.mobile || am.mobile,
                                          })
                                          setAccountManagerDialogOpen(true)
                                        } catch (error) {
                                          console.error("Error loading account manager details:", error)
                                          setEditingAccountManager(am)
                                          setNewAccountManager({
                                            role: (am as any).role || "account-management",
                                            username: am.username,
                                            password: "",
                                            firstName: am.firstName,
                                            lastName: am.lastName,
                                            email: am.email,
                                            mobile: am.mobile,
                                          })
                                          setAccountManagerDialogOpen(true)
                                        }
                                      } else {
                                        setEditingAccountManager(am)
                                        setNewAccountManager({
                                          role: (am as any).role || "account-management",
                                          username: am.username,
                                          password: "",
                                          firstName: am.firstName,
                                          lastName: am.lastName,
                                          email: am.email,
                                          mobile: am.mobile,
                                        })
                                        setAccountManagerDialogOpen(true)
                                      }
                                    }}
                                  >
                                    <Edit className="w-3 h-3 mr-1" />
                                    Edit
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={async () => {
                                      if (!confirm(`Are you sure you want to ${am.isActive === false ? "activate" : "deactivate"} this account manager?`)) return
                                      
                                      try {
                                        if (useApi) {
                                          if (am.isActive === false) {
                                            await api.admin.accountManagers.activate(am.id)
                                          } else {
                                            await api.admin.accountManagers.deactivate(am.id)
                                          }
                                          await loadData()
                                          toast({
                                            title: "Success",
                                            description: `User ${am.isActive === false ? "activated" : "deactivated"} successfully!`,
                                          })
                                        } else {
                                          // Fallback to localStorage
                                          const roleKey = (am as any).role || "account-management"
                                          const key =
                                            roleKey === "installer"
                                              ? "installers"
                                              : roleKey === "baldev"
                                                ? "baldevUsers"
                                                : roleKey === "hr"
                                                  ? "hrUsers"
                                                  : "accountManagers"
                                          const roleUsers = JSON.parse(localStorage.getItem(key) || "[]")
                                          const updated = roleUsers.map((accountManager: AccountManager & { password?: string }) =>
                                            accountManager.id === am.id ? { ...accountManager, isActive: am.isActive === false ? true : false } : accountManager
                                          )
                                          localStorage.setItem(key, JSON.stringify(updated))
                                          const allAccountManagers = JSON.parse(localStorage.getItem("accountManagers") || "[]")
                                          const allInstallers = JSON.parse(localStorage.getItem("installers") || "[]")
                                          const allBaldevUsers = JSON.parse(localStorage.getItem("baldevUsers") || "[]")
                                          const allHrUsers = JSON.parse(localStorage.getItem("hrUsers") || "[]")
                                          const mergedUsers = [
                                            ...allAccountManagers.map((u: any) => ({ ...u, role: "account-management" })),
                                            ...allInstallers.map((u: any) => ({ ...u, role: "installer" })),
                                            ...allBaldevUsers.map((u: any) => ({ ...u, role: "baldev" })),
                                            ...allHrUsers.map((u: any) => ({ ...u, role: "hr" })),
                                          ]
                                          const accountManagersWithoutPassword = mergedUsers.map((am: AccountManager & { password?: string }) => {
                                            const { password: _, ...accountManagerData } = am
                                            return accountManagerData
                                          })
                                          setAccountManagers(accountManagersWithoutPassword)
                                          toast({
                                            title: "Success",
                                            description: `User ${am.isActive === false ? "activated" : "deactivated"} successfully!`,
                                          })
                                        }
                                      } catch (error) {
                                        console.error("Error updating account manager status:", error)
                                        toast({
                                          title: "Error",
                                          description: error instanceof ApiError ? error.message : "Failed to update account manager status",
                                          variant: "destructive",
                                        })
                                      }
                                    }}
                                  >
                                    {am.isActive === false ? (
                                      <>
                                        <UserCheck className="w-3 h-3 mr-1" />
                                        Activate
                                      </>
                                    ) : (
                                      <>
                                        <UserX className="w-3 h-3 mr-1" />
                                        Deactivate
                                      </>
                                    )}
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )
                })()}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Payments Tab - Same as Account Management; links to account-management page */}
          <TabsContent value="payments" className="space-y-6">
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-primary" />
                  Payment Management
                </CardTitle>
                <CardDescription>
                  Payment management uses the same Account Management page. Use it when account managers are unavailable.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={() => router.push("/dashboard/account-management")}>
                  Open Account Management
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Products Tab */}
          <TabsContent value="products" className="space-y-6">
            <AdminProductManagement />
          </TabsContent>
        </Tabs>

        {/* Quotation Details Dialog */}
        <QuotationDetailsDialog
          quotation={selectedQuotation}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
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
                    {formatPersonName(documentsQuotation.customer?.firstName, documentsQuotation.customer?.lastName, "Customer")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {documentsQuotation.customer?.mobile || ""} • {documentsQuotation.id}
                  </p>
                </div>

                {(() => {
                  const form = getDocumentsForm(documentsQuotation.id)
                  const isCompliant = Boolean(form.isCompliantSenior)
                  const uploadedImagePreviews = getUploadedImagePreviews(form)

                  return (
                    <>
                      {uploadedImagePreviews.length > 0 && (
                        <div className="rounded-lg border border-border/60 bg-background p-4 space-y-3">
                          <p className="text-sm font-semibold">Uploaded Images</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {uploadedImagePreviews.map((item) => (
                              <a
                                key={item.label}
                                href={String(item.value)}
                                target="_blank"
                                rel="noreferrer"
                                className="rounded-md border border-border/60 p-3 hover:bg-muted/30 transition-colors"
                              >
                                <p className="text-xs text-muted-foreground mb-2">{item.label}</p>
                                <img
                                  src={String(item.value)}
                                  alt={item.label}
                                  className="w-full h-24 object-cover rounded-md border border-border/60"
                                />
                              </a>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="rounded-lg border border-border/60 bg-muted/10 p-4 space-y-3">
                        <div className="flex items-start gap-3">
                          <input
                            id="admin-compliant-senior"
                            type="checkbox"
                            checked={isCompliant}
                            onChange={(e) =>
                              updateDocumentsForm(documentsQuotation.id, { isCompliantSenior: e.target.checked })
                            }
                            className="h-4 w-4 mt-1"
                          />
                          <div>
                            <Label htmlFor="admin-compliant-senior" className="text-sm font-medium">
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
                              accept="image/*"
                              onChange={(e) =>
                                updateDocumentsForm(documentsQuotation.id, { aadharFront: e.target.files?.[0] || null })
                              }
                            />
                          </div>
                          <div>
                            <Label>Aadhar Back Image *</Label>
                            <Input
                              type="file"
                              accept="image/*"
                              onChange={(e) =>
                                updateDocumentsForm(documentsQuotation.id, { aadharBack: e.target.files?.[0] || null })
                              }
                            />
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
                                  accept="image/*"
                                  onChange={(e) =>
                                    updateDocumentsForm(documentsQuotation.id, {
                                      compliantAadharFront: e.target.files?.[0] || null,
                                    })
                                  }
                                />
                              </div>
                              <div>
                                <Label className="text-sm font-medium">Compliant Aadhar Back Image *</Label>
                                <Input
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) =>
                                    updateDocumentsForm(documentsQuotation.id, {
                                      compliantAadharBack: e.target.files?.[0] || null,
                                    })
                                  }
                                />
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
                                  accept="image/*"
                                  onChange={(e) =>
                                    updateDocumentsForm(documentsQuotation.id, { compliantPanImage: e.target.files?.[0] || null })
                                  }
                                />
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
                                  accept="image/*"
                                  onChange={(e) =>
                                    updateDocumentsForm(documentsQuotation.id, {
                                      compliantBankPassbookImage: e.target.files?.[0] || null,
                                    })
                                  }
                                />
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
                              accept="image/*"
                              onChange={(e) =>
                                updateDocumentsForm(documentsQuotation.id, { panImage: e.target.files?.[0] || null })
                              }
                            />
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
                            <Label>Electricity Bill Image *</Label>
                            <Input
                              type="file"
                              accept="image/*"
                              onChange={(e) =>
                                updateDocumentsForm(documentsQuotation.id, {
                                  electricityBillImage: e.target.files?.[0] || null,
                                })
                              }
                            />
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
                              accept="image/*"
                              onChange={(e) =>
                                updateDocumentsForm(documentsQuotation.id, {
                                  bankPassbookImage: e.target.files?.[0] || null,
                                })
                              }
                            />
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
                              accept="image/*"
                              onChange={(e) =>
                                updateDocumentsForm(documentsQuotation.id, {
                                  geotagRoofPhoto: e.target.files?.[0] || null,
                                })
                              }
                            />
                          </div>
                          <div>
                            <Label>Customer Photo with House</Label>
                            <Input
                              type="file"
                              accept="image/*"
                              onChange={(e) =>
                                updateDocumentsForm(documentsQuotation.id, {
                                  customerWithHousePhoto: e.target.files?.[0] || null,
                                })
                              }
                            />
                          </div>
                          <div className="md:col-span-2">
                            <Label>Property Documents (PDF) *</Label>
                            <Input
                              type="file"
                              accept="application/pdf,.pdf"
                              onChange={(e) =>
                                updateDocumentsForm(documentsQuotation.id, {
                                  propertyDocumentPdf: e.target.files?.[0] || null,
                                })
                              }
                            />
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
                        const form = getDocumentsForm(documentsQuotation.id)
                        const customerName = formatPersonName(
                          documentsQuotation.customer?.firstName,
                          documentsQuotation.customer?.lastName,
                          "Customer",
                        )
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

                      if (form.contactPhone && !phonePattern.test(form.contactPhone)) {
                        toast({
                          title: "Invalid phone number",
                          description: "Phone number must be 10 digits.",
                          variant: "destructive",
                        })
                        return
                      }

                      const missingRequiredDocuments = !form.propertyDocumentPdf
                      if (missingRequiredDocuments) {
                        toast({
                          title: "Required documents missing",
                          description: "Please upload Property documents PDF.",
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

                        if (form.compliantContactPhone && !phonePattern.test(form.compliantContactPhone)) {
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

                        const missing =
                          !form.compliantAadharNumber ||
                          !form.compliantContactPhone ||
                          !form.compliantAadharFront ||
                          !form.compliantAadharBack ||
                          !form.compliantPanNumber ||
                          !form.compliantPanImage ||
                          !form.compliantBankAccountNumber ||
                          !form.compliantBankIfsc ||
                          !form.compliantBankName ||
                          !form.compliantBankBranch ||
                          !form.compliantBankPassbookImage
                        if (missing) {
                          toast({
                            title: "Missing compliant details",
                            description: "Please fill compliant Aadhar, PAN, and bank details.",
                            variant: "destructive",
                          })
                          return
                        }
                      }

                      setIsSubmittingDocuments(true)
                      if (useApi) {
                        const formData = buildDocumentsFormData(form)
                        api.quotations
                          .updateDocuments(documentsQuotation.id, formData)
                          .then(() => {
                            toast({
                              title: "Document details saved",
                              description: "Documents uploaded successfully.",
                            })
                            setDocumentsDialogOpen(false)
                          })
                          .catch((error: unknown) => {
                            const message =
                              error instanceof Error ? error.message : "Failed to upload documents."
                            toast({
                              title: "Upload failed",
                              description: message,
                              variant: "destructive",
                            })
                          })
                          .finally(() => setIsSubmittingDocuments(false))
                      } else {
                        localStorage.setItem(
                          `quotation_documents_${documentsQuotation.id}`,
                          JSON.stringify(form)
                        )
                        toast({
                          title: "Document details saved",
                          description: "Documents saved locally.",
                        })
                        setIsSubmittingDocuments(false)
                        setDocumentsDialogOpen(false)
                      }
                    }}
                    disabled={isSubmittingDocuments}
                  >
                    {isSubmittingDocuments ? "Submitting..." : "Submit"}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Edit Customer Dialog */}
        <Dialog open={customerEditDialogOpen} onOpenChange={setCustomerEditDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Customer - {editingCustomer?.firstName} {editingCustomer?.lastName}</DialogTitle>
              <DialogDescription>
                Update customer information
              </DialogDescription>
            </DialogHeader>

            {editingCustomer && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="admin-customer-firstName">First Name *</Label>
                    <Input
                      id="admin-customer-firstName"
                      value={customerEditForm.firstName || ""}
                      onChange={(e) => setCustomerEditForm({ ...customerEditForm, firstName: e.target.value })}
                      placeholder="Enter first name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="admin-customer-lastName">Last Name *</Label>
                    <Input
                      id="admin-customer-lastName"
                      value={customerEditForm.lastName || ""}
                      onChange={(e) => setCustomerEditForm({ ...customerEditForm, lastName: e.target.value })}
                      placeholder="Enter last name"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="admin-customer-email">Email *</Label>
                    <Input
                      id="admin-customer-email"
                      type="email"
                      value={customerEditForm.email || ""}
                      onChange={(e) => setCustomerEditForm({ ...customerEditForm, email: e.target.value })}
                      placeholder="Enter email"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="admin-customer-mobile">Mobile *</Label>
                    <Input
                      id="admin-customer-mobile"
                      value={customerEditForm.mobile || ""}
                      onChange={(e) => {
                        const cleaned = e.target.value.replace(/\D/g, "").slice(0, 10)
                        setCustomerEditForm({ ...customerEditForm, mobile: cleaned })
                      }}
                      placeholder="Enter 10-digit mobile number"
                      maxLength={10}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="admin-customer-street">Street Address *</Label>
                  <Textarea
                    id="admin-customer-street"
                    value={customerEditForm.address.street || ""}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setCustomerEditForm({
                      ...customerEditForm,
                      address: { ...customerEditForm.address, street: e.target.value }
                    })}
                    placeholder="Enter street address"
                    rows={2}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="admin-customer-city">City *</Label>
                    <Input
                      id="admin-customer-city"
                      value={customerEditForm.address.city || ""}
                      onChange={(e) => setCustomerEditForm({
                        ...customerEditForm,
                        address: { ...customerEditForm.address, city: e.target.value }
                      })}
                      placeholder="Enter city"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="admin-customer-state">State *</Label>
                    <Select
                      value={customerEditForm.address.state || ""}
                      onValueChange={(value) => setCustomerEditForm({
                        ...customerEditForm,
                        address: { ...customerEditForm.address, state: value }
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select state" />
                      </SelectTrigger>
                      <SelectContent>
                        {indianStates.map((state) => (
                          <SelectItem key={state} value={state}>
                            {state}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="admin-customer-pincode">Pincode *</Label>
                  <Input
                    id="admin-customer-pincode"
                    value={customerEditForm.address.pincode || ""}
                    onChange={(e) => {
                      const cleaned = e.target.value.replace(/\D/g, "").slice(0, 6)
                      setCustomerEditForm({
                        ...customerEditForm,
                        address: { ...customerEditForm.address, pincode: cleaned }
                      })
                    }}
                    placeholder="Enter 6-digit pincode"
                    maxLength={6}
                  />
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button variant="outline" onClick={() => setCustomerEditDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={async () => {
                      // Validation
                      if (!customerEditForm.firstName || !customerEditForm.lastName || !customerEditForm.email ||
                          !customerEditForm.mobile || !customerEditForm.address.street ||
                          !customerEditForm.address.city || !customerEditForm.address.state ||
                          !customerEditForm.address.pincode) {
                        alert("Please fill in all required fields")
                        return
                      }

                      if (customerEditForm.mobile.length !== 10) {
                        alert("Mobile number must be 10 digits")
                        return
                      }

                      if (customerEditForm.address.pincode.length !== 6) {
                        alert("Pincode must be 6 digits")
                        return
                      }

                      if (!editingCustomer.id) {
                        alert("Cannot update customer: Customer ID is missing. This customer may not exist in the database.")
                        return
                      }

                      try {
                        if (useApi) {
                          await api.customers.update(editingCustomer.id, {
                            firstName: customerEditForm.firstName.trim(),
                            lastName: customerEditForm.lastName.trim(),
                            email: customerEditForm.email.trim(),
                            mobile: customerEditForm.mobile,
                            address: {
                              street: customerEditForm.address.street.trim(),
                              city: customerEditForm.address.city.trim(),
                              state: customerEditForm.address.state,
                              pincode: customerEditForm.address.pincode,
                            },
                          })
                          await loadData()
                        } else {
                          alert("Customer editing is only available when using the API")
                        }
                        setCustomerEditDialogOpen(false)
                      } catch (error) {
                        console.error("Error updating customer:", error)
                        alert(error instanceof ApiError ? error.message : "Failed to update customer")
                      }
                    }}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    Save Changes
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Edit Quotation Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Quotation - {editingQuotation?.id}</DialogTitle>
              <DialogDescription>Update quotation details and status</DialogDescription>
            </DialogHeader>

            {isLoadingQuotationDetails ? (
              <div className="flex items-center justify-center py-12">
                <p className="text-muted-foreground">Loading quotation details...</p>
              </div>
            ) : editingQuotation ? (
              <div className="space-y-4">
                {/* Status */}
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={editingQuotation.status || "pending"}
                    onValueChange={(value) =>
                      setEditingQuotation({ ...editingQuotation, status: value as QuotationStatus })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Customer Information */}
                <div className="space-y-4 border-t pt-4">
                  <h3 className="font-semibold">Customer Information</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>First Name</Label>
                      <Input
                        value={editingQuotation.customer.firstName}
                        onChange={(e) =>
                          setEditingQuotation({
                            ...editingQuotation,
                            customer: { ...editingQuotation.customer, firstName: e.target.value },
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Last Name</Label>
                      <Input
                        value={editingQuotation.customer.lastName}
                        onChange={(e) =>
                          setEditingQuotation({
                            ...editingQuotation,
                            customer: { ...editingQuotation.customer, lastName: e.target.value },
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Mobile</Label>
                      <Input
                        value={editingQuotation.customer.mobile}
                        onChange={(e) =>
                          setEditingQuotation({
                            ...editingQuotation,
                            customer: { ...editingQuotation.customer, mobile: e.target.value },
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input
                        type="email"
                        value={editingQuotation.customer.email}
                        onChange={(e) =>
                          setEditingQuotation({
                            ...editingQuotation,
                            customer: { ...editingQuotation.customer, email: e.target.value },
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2 col-span-2">
                      <Label>Street Address</Label>
                      <Input
                        value={editingQuotation.customer?.address?.street || ""}
                        onChange={(e) =>
                          setEditingQuotation({
                            ...editingQuotation,
                            customer: {
                              ...editingQuotation.customer,
                              address: { 
                                ...(editingQuotation.customer?.address || { street: "", city: "", state: "", pincode: "" }), 
                                street: e.target.value 
                              },
                            },
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>City</Label>
                      <Input
                        value={editingQuotation.customer?.address?.city || ""}
                        onChange={(e) =>
                          setEditingQuotation({
                            ...editingQuotation,
                            customer: {
                              ...editingQuotation.customer,
                              address: { 
                                ...(editingQuotation.customer?.address || { street: "", city: "", state: "", pincode: "" }), 
                                city: e.target.value 
                              },
                            },
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>State</Label>
                      <Input
                        value={editingQuotation.customer?.address?.state || ""}
                        onChange={(e) =>
                          setEditingQuotation({
                            ...editingQuotation,
                            customer: {
                              ...editingQuotation.customer,
                              address: { 
                                ...(editingQuotation.customer?.address || { street: "", city: "", state: "", pincode: "" }), 
                                state: e.target.value 
                              },
                            },
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Pincode</Label>
                      <Input
                        value={editingQuotation.customer?.address?.pincode || ""}
                        onChange={(e) => {
                          const cleaned = e.target.value.replace(/\D/g, "").slice(0, 6)
                          setEditingQuotation({
                            ...editingQuotation,
                            customer: {
                              ...editingQuotation.customer,
                              address: { 
                                ...(editingQuotation.customer?.address || { street: "", city: "", state: "", pincode: "" }), 
                                pincode: cleaned 
                              },
                            },
                          })
                        }}
                        maxLength={6}
                      />
                    </div>
                  </div>
                </div>

                {/* Pricing */}
                <div className="space-y-4 border-t pt-4">
                  <h3 className="font-semibold">Pricing</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Total Amount (₹)</Label>
                      <Input
                        type="number"
                        value={editingQuotation.totalAmount}
                        onChange={(e) =>
                          setEditingQuotation({
                            ...editingQuotation,
                            totalAmount: Number.parseFloat(e.target.value) || 0,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Discount (%)</Label>
                      <Input
                        type="number"
                        value={editingQuotation.discount}
                        onChange={(e) => {
                          const discount = Number.parseFloat(e.target.value) || 0
                          const finalAmount =
                            editingQuotation.totalAmount - (editingQuotation.totalAmount * discount) / 100
                          setEditingQuotation({
                            ...editingQuotation,
                            discount,
                            finalAmount,
                          })
                        }}
                      />
                    </div>
                    <div className="space-y-2 col-span-2">
                      <Label>Final Amount (₹)</Label>
                      <Input
                        type="number"
                        value={editingQuotation.finalAmount}
                        onChange={(e) =>
                          setEditingQuotation({
                            ...editingQuotation,
                            finalAmount: Number.parseFloat(e.target.value) || 0,
                          })
                        }
                      />
                    </div>
                  </div>
                </div>

                {/* Agent/Dealer */}
                <div className="space-y-2 border-t pt-4">
                  <Label>Created By (Agent/Dealer)</Label>
                  <Select
                    value={editingQuotation.dealerId}
                    onValueChange={(value) =>
                      setEditingQuotation({ ...editingQuotation, dealerId: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {dealers.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.firstName} {d.lastName} ({d.username})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                    <X className="w-4 h-4 mr-2" />
                    Cancel
                  </Button>
                  <Button
                    onClick={() => updateQuotation(editingQuotation)}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Save Changes
                  </Button>
                </div>
              </div>
            ) : null}
          </DialogContent>
        </Dialog>

        {/* Dealer Details Dialog */}
        <Dialog open={dealerDialogOpen} onOpenChange={setDealerDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Dealer Details</DialogTitle>
              <DialogDescription>
                Complete registration information for {selectedDealer?.firstName} {selectedDealer?.lastName}
              </DialogDescription>
            </DialogHeader>

            {selectedDealer && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-semibold">Personal Information</Label>
                    <div className="mt-2 space-y-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Full Name:</span>{" "}
                        <span className="font-medium">
                          {selectedDealer.firstName} {selectedDealer.lastName}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Username:</span>{" "}
                        <span className="font-medium">{selectedDealer.username}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Email:</span>{" "}
                        <span className="font-medium">{selectedDealer.email}</span>
                        {selectedDealer.emailVerified === false && (
                          <Badge variant="outline" className="ml-2">Unverified</Badge>
                        )}
                      </div>
                      <div>
                        <span className="text-muted-foreground">Mobile:</span>{" "}
                        <span className="font-medium">{selectedDealer.mobile}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Gender:</span>{" "}
                        <span className="font-medium">{selectedDealer.gender}</span>
                      </div>
                      {selectedDealer.dateOfBirth && (
                        <div>
                          <span className="text-muted-foreground">Date of Birth:</span>{" "}
                          <span className="font-medium">
                            {new Date(selectedDealer.dateOfBirth).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm font-semibold">Family Information</Label>
                    <div className="mt-2 space-y-2 text-sm">
                      {selectedDealer.fatherName && (
                        <div>
                          <span className="text-muted-foreground">Father&apos;s Name:</span>{" "}
                          <span className="font-medium">{selectedDealer.fatherName}</span>
                        </div>
                      )}
                      {selectedDealer.fatherContact && (
                        <div>
                          <span className="text-muted-foreground">Father&apos;s Contact:</span>{" "}
                          <span className="font-medium">{selectedDealer.fatherContact}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm font-semibold">Government ID</Label>
                    <div className="mt-2 space-y-2 text-sm">
                      {selectedDealer.governmentIdType && (
                        <div>
                          <span className="text-muted-foreground">ID Type:</span>{" "}
                          <span className="font-medium">{selectedDealer.governmentIdType}</span>
                        </div>
                      )}
                      {selectedDealer.governmentIdNumber && (
                        <div>
                          <span className="text-muted-foreground">ID Number:</span>{" "}
                          <span className="font-medium font-mono">{selectedDealer.governmentIdNumber}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm font-semibold">Address</Label>
                    <div className="mt-2 space-y-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Street:</span>{" "}
                        <span className="font-medium">{selectedDealer.address.street}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">City:</span>{" "}
                        <span className="font-medium">{selectedDealer.address.city}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">State:</span>{" "}
                        <span className="font-medium">{selectedDealer.address.state}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Pincode:</span>{" "}
                        <span className="font-medium">{selectedDealer.address.pincode}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {selectedDealer.createdAt && (
                  <div className="pt-4 border-t">
                    <div className="text-sm text-muted-foreground">
                      <span className="font-medium">Registered:</span>{" "}
                      {new Date(selectedDealer.createdAt).toLocaleString()}
                    </div>
                  </div>
                )}

                <div className="pt-4 border-t flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setDealerDialogOpen(false)
                      setEditingDealer(selectedDealer)
                      setDealerEditForm({
                        firstName: selectedDealer.firstName || "",
                        lastName: selectedDealer.lastName || "",
                        email: selectedDealer.email || "",
                        mobile: selectedDealer.mobile || "",
                        gender: selectedDealer.gender || "",
                        dateOfBirth: selectedDealer.dateOfBirth || "",
                        fatherName: selectedDealer.fatherName || "",
                        fatherContact: selectedDealer.fatherContact || "",
                        governmentIdType: selectedDealer.governmentIdType || "",
                        governmentIdNumber: selectedDealer.governmentIdNumber || "",
                        address: {
                          street: selectedDealer.address?.street || "",
                          city: selectedDealer.address?.city || "",
                          state: selectedDealer.address?.state || "",
                          pincode: selectedDealer.address?.pincode || "",
                        },
                        isActive: selectedDealer.isActive ?? true,
                        emailVerified: selectedDealer.emailVerified ?? false,
                      })
                      setDealerEditDialogOpen(true)
                    }}
                    className="flex-1"
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Edit Dealer
                  </Button>
                  {selectedDealer.isActive === false && (
                    <Button
                      onClick={async () => {
                        if (!confirm(`Are you sure you want to approve and activate ${selectedDealer.firstName} ${selectedDealer.lastName}?`)) return
                        
                        try {
                          if (useApi) {
                            try {
                              await api.admin.dealers.activate(selectedDealer.id)
                            } catch {
                              await api.admin.dealers.update(selectedDealer.id, { isActive: true })
                            }
                            await loadData()
                            setDealerDialogOpen(false)
                          } else {
                            const updated = dealers.map((dealer) =>
                              dealer.id === selectedDealer.id ? { ...dealer, isActive: true } : dealer
                            )
                            setDealers(updated)
                            setDealerDialogOpen(false)
                          }
                        } catch (error) {
                          console.error("Error activating dealer:", error)
                          alert(error instanceof ApiError ? error.message : "Failed to activate dealer")
                        }
                      }}
                      className="flex-1 bg-green-600 hover:bg-green-700"
                    >
                      <UserCheck className="w-4 h-4 mr-2" />
                      Approve & Activate
                    </Button>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Edit Dealer Dialog */}
        <Dialog open={dealerEditDialogOpen} onOpenChange={setDealerEditDialogOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Dealer - {editingDealer?.firstName} {editingDealer?.lastName}</DialogTitle>
              <DialogDescription>
                Update dealer information. Username cannot be changed.
              </DialogDescription>
            </DialogHeader>

            {editingDealer && (
              <div className="space-y-4">
                {/* Personal Information */}
                <div className="space-y-4">
                  <Label className="text-base font-semibold">Personal Information</Label>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="dealer-firstName">First Name *</Label>
                      <Input
                        id="dealer-firstName"
                        value={dealerEditForm.firstName || ""}
                        onChange={(e) => setDealerEditForm({ ...dealerEditForm, firstName: e.target.value })}
                        placeholder="Enter first name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="dealer-lastName">Last Name *</Label>
                      <Input
                        id="dealer-lastName"
                        value={dealerEditForm.lastName || ""}
                        onChange={(e) => setDealerEditForm({ ...dealerEditForm, lastName: e.target.value })}
                        placeholder="Enter last name"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="dealer-email">Email *</Label>
                    <Input
                      id="dealer-email"
                      type="email"
                      value={dealerEditForm.email || ""}
                      onChange={(e) => setDealerEditForm({ ...dealerEditForm, email: e.target.value })}
                      placeholder="Enter email"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="dealer-mobile">Mobile *</Label>
                    <Input
                      id="dealer-mobile"
                      value={dealerEditForm.mobile || ""}
                      onChange={(e) => {
                        const cleaned = e.target.value.replace(/\D/g, "").slice(0, 10)
                        setDealerEditForm({ ...dealerEditForm, mobile: cleaned })
                      }}
                      placeholder="Enter 10-digit mobile number"
                      maxLength={10}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="dealer-gender">Gender *</Label>
                      <Select
                        value={dealerEditForm.gender || ""}
                        onValueChange={(value) => setDealerEditForm({ ...dealerEditForm, gender: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select gender" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Male">Male</SelectItem>
                          <SelectItem value="Female">Female</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="dealer-dateOfBirth">Date of Birth *</Label>
                      <Input
                        id="dealer-dateOfBirth"
                        type="date"
                        value={dealerEditForm.dateOfBirth || ""}
                        onChange={(e) => setDealerEditForm({ ...dealerEditForm, dateOfBirth: e.target.value })}
                        max={new Date(new Date().setFullYear(new Date().getFullYear() - 18)).toISOString().split('T')[0]}
                      />
                    </div>
                  </div>
                </div>

                {/* Family Information */}
                <div className="space-y-4 pt-4 border-t">
                  <Label className="text-base font-semibold">Family Information</Label>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="dealer-fatherName">Father&apos;s Name *</Label>
                      <Input
                        id="dealer-fatherName"
                        value={dealerEditForm.fatherName || ""}
                        onChange={(e) => setDealerEditForm({ ...dealerEditForm, fatherName: e.target.value })}
                        placeholder="Enter father's name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="dealer-fatherContact">Father&apos;s Contact *</Label>
                      <Input
                        id="dealer-fatherContact"
                        value={dealerEditForm.fatherContact || ""}
                        onChange={(e) => {
                          const cleaned = e.target.value.replace(/\D/g, "").slice(0, 10)
                          setDealerEditForm({ ...dealerEditForm, fatherContact: cleaned })
                        }}
                        placeholder="Enter 10-digit contact"
                        maxLength={10}
                      />
                    </div>
                  </div>
                </div>

                {/* Government ID */}
                <div className="space-y-4 pt-4 border-t">
                  <Label className="text-base font-semibold">Government ID</Label>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="dealer-governmentIdType">ID Type *</Label>
                      <Select
                        value={dealerEditForm.governmentIdType || ""}
                        onValueChange={(value) => setDealerEditForm({ ...dealerEditForm, governmentIdType: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select ID type" />
                        </SelectTrigger>
                        <SelectContent>
                          {governmentIds.map((id) => (
                            <SelectItem key={id} value={id}>
                              {id}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="dealer-governmentIdNumber">ID Number *</Label>
                      <Input
                        id="dealer-governmentIdNumber"
                        value={dealerEditForm.governmentIdNumber || ""}
                        onChange={(e) => setDealerEditForm({ ...dealerEditForm, governmentIdNumber: e.target.value })}
                        placeholder="Enter ID number"
                      />
                    </div>
                  </div>
                </div>

                {/* Address */}
                <div className="space-y-4 pt-4 border-t">
                  <Label className="text-base font-semibold">Address</Label>
                  <div className="space-y-2">
                    <Label htmlFor="dealer-street">Street *</Label>
                    <Input
                      id="dealer-street"
                      value={dealerEditForm.address.street}
                      onChange={(e) => setDealerEditForm({
                        ...dealerEditForm,
                        address: { ...dealerEditForm.address, street: e.target.value }
                      })}
                      placeholder="Enter street address"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="dealer-city">City *</Label>
                      <Input
                        id="dealer-city"
                        value={dealerEditForm.address?.city || ""}
                        onChange={(e) => setDealerEditForm({
                          ...dealerEditForm,
                          address: { ...dealerEditForm.address, city: e.target.value }
                        })}
                        placeholder="Enter city"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="dealer-state">State *</Label>
                      <Select
                        value={dealerEditForm.address.state}
                        onValueChange={(value) => setDealerEditForm({
                          ...dealerEditForm,
                          address: { ...dealerEditForm.address, state: value }
                        })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select state" />
                        </SelectTrigger>
                        <SelectContent>
                          {indianStates.map((state) => (
                            <SelectItem key={state} value={state}>
                              {state}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dealer-pincode">Pincode *</Label>
                    <Input
                      id="dealer-pincode"
                      value={dealerEditForm.address?.pincode || ""}
                      onChange={(e) => {
                        const cleaned = e.target.value.replace(/\D/g, "").slice(0, 6)
                        setDealerEditForm({
                          ...dealerEditForm,
                          address: { ...dealerEditForm.address, pincode: cleaned }
                        })
                      }}
                      placeholder="Enter 6-digit pincode"
                      maxLength={6}
                    />
                  </div>
                </div>

                {/* Status */}
                <div className="space-y-4 pt-4 border-t">
                  <Label className="text-base font-semibold">Account Status</Label>
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="dealer-isActive"
                        checked={dealerEditForm.isActive}
                        onChange={(e) => setDealerEditForm({ ...dealerEditForm, isActive: e.target.checked })}
                        className="w-4 h-4 rounded border-gray-300"
                      />
                      <Label htmlFor="dealer-isActive" className="font-normal cursor-pointer">
                        Active Account
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="dealer-emailVerified"
                        checked={dealerEditForm.emailVerified}
                        onChange={(e) => setDealerEditForm({ ...dealerEditForm, emailVerified: e.target.checked })}
                        className="w-4 h-4 rounded border-gray-300"
                      />
                      <Label htmlFor="dealer-emailVerified" className="font-normal cursor-pointer">
                        Email Verified
                      </Label>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button variant="outline" onClick={() => setDealerEditDialogOpen(false)}>
                    <X className="w-4 h-4 mr-2" />
                    Cancel
                  </Button>
                  <Button
                    onClick={async () => {
                      // Validation
                      if (!dealerEditForm.firstName || !dealerEditForm.lastName || !dealerEditForm.email ||
                          !dealerEditForm.mobile || !dealerEditForm.gender || !dealerEditForm.dateOfBirth ||
                          !dealerEditForm.fatherName || !dealerEditForm.fatherContact ||
                          !dealerEditForm.governmentIdType || !dealerEditForm.governmentIdNumber ||
                          !dealerEditForm.address.street || !dealerEditForm.address.city ||
                          !dealerEditForm.address.state || !dealerEditForm.address.pincode) {
                        alert("Please fill in all required fields")
                        return
                      }

                      if (dealerEditForm.mobile.length !== 10) {
                        alert("Mobile number must be 10 digits")
                        return
                      }

                      if (dealerEditForm.fatherContact.length !== 10) {
                        alert("Father's contact must be 10 digits")
                        return
                      }

                      if (dealerEditForm.address.pincode.length !== 6) {
                        alert("Pincode must be 6 digits")
                        return
                      }

                      try {
                        if (useApi) {
                          await api.admin.dealers.update(editingDealer.id, {
                            firstName: dealerEditForm.firstName.trim(),
                            lastName: dealerEditForm.lastName.trim(),
                            email: dealerEditForm.email.trim(),
                            mobile: dealerEditForm.mobile,
                            gender: dealerEditForm.gender,
                            dateOfBirth: dealerEditForm.dateOfBirth,
                            fatherName: dealerEditForm.fatherName.trim(),
                            fatherContact: dealerEditForm.fatherContact,
                            governmentIdType: dealerEditForm.governmentIdType,
                            governmentIdNumber: dealerEditForm.governmentIdNumber.trim(),
                            address: {
                              street: dealerEditForm.address.street.trim(),
                              city: dealerEditForm.address.city.trim(),
                              state: dealerEditForm.address.state,
                              pincode: dealerEditForm.address.pincode,
                            },
                            isActive: dealerEditForm.isActive,
                            emailVerified: dealerEditForm.emailVerified,
                          })
                          await loadData()
                        } else {
                          // Fallback to localStorage
                          const allDealers = JSON.parse(localStorage.getItem("dealers") || "[]")
                          const updated = allDealers.map((d: Dealer & { password?: string }) => {
                            if (d.id === editingDealer.id) {
                              return {
                                ...d,
                                firstName: dealerEditForm.firstName.trim(),
                                lastName: dealerEditForm.lastName.trim(),
                                email: dealerEditForm.email.trim(),
                                mobile: dealerEditForm.mobile,
                                gender: dealerEditForm.gender,
                                dateOfBirth: dealerEditForm.dateOfBirth,
                                fatherName: dealerEditForm.fatherName.trim(),
                                fatherContact: dealerEditForm.fatherContact,
                                governmentIdType: dealerEditForm.governmentIdType,
                                governmentIdNumber: dealerEditForm.governmentIdNumber.trim(),
                                address: {
                                  street: dealerEditForm.address.street.trim(),
                                  city: dealerEditForm.address.city.trim(),
                                  state: dealerEditForm.address.state,
                                  pincode: dealerEditForm.address.pincode,
                                },
                                isActive: dealerEditForm.isActive,
                                emailVerified: dealerEditForm.emailVerified,
                              }
                            }
                            return d
                          })
                          localStorage.setItem("dealers", JSON.stringify(updated))
                          setDealers(updated.filter((d: Dealer) => !(d as any).password))
                        }
                        setDealerEditDialogOpen(false)
                        setSelectedDealer(null)
                        setDealerDialogOpen(false)
                      } catch (error) {
                        console.error("Error updating dealer:", error)
                        alert(error instanceof ApiError ? error.message : "Failed to update dealer")
                      }
                    }}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Save Changes
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Visitor Create/Edit Dialog */}
        <Dialog open={visitorDialogOpen} onOpenChange={setVisitorDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingVisitor ? "Edit Visitor" : "Create New Visitor"}</DialogTitle>
              <DialogDescription>
                {editingVisitor ? "Update visitor information" : "Add a new visitor to the system"}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="visitor-firstName">First Name *</Label>
                  <Input
                    id="visitor-firstName"
                    value={newVisitor.firstName}
                    onChange={(e) => setNewVisitor({ ...newVisitor, firstName: e.target.value })}
                    placeholder="Enter first name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="visitor-lastName">Last Name *</Label>
                  <Input
                    id="visitor-lastName"
                    value={newVisitor.lastName}
                    onChange={(e) => setNewVisitor({ ...newVisitor, lastName: e.target.value })}
                    placeholder="Enter last name"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="visitor-username">Username *</Label>
                <Input
                  id="visitor-username"
                  value={newVisitor.username}
                  onChange={(e) => setNewVisitor({ ...newVisitor, username: e.target.value })}
                  placeholder="Enter username"
                  disabled={!!editingVisitor}
                />
                {editingVisitor && (
                  <p className="text-xs text-muted-foreground">Username cannot be changed</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="visitor-password">
                  {editingVisitor ? "New Password (leave blank to keep current)" : "Password *"}
                </Label>
                <Input
                  id="visitor-password"
                  type="password"
                  value={newVisitor.password}
                  onChange={(e) => setNewVisitor({ ...newVisitor, password: e.target.value })}
                  placeholder={editingVisitor ? "Enter new password" : "Enter password"}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="visitor-email">Email *</Label>
                  <Input
                    id="visitor-email"
                    type="email"
                    value={newVisitor.email}
                    onChange={(e) => setNewVisitor({ ...newVisitor, email: e.target.value })}
                    placeholder="Enter email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="visitor-mobile">Mobile *</Label>
                  <Input
                    id="visitor-mobile"
                    value={newVisitor.mobile}
                    onChange={(e) => setNewVisitor({ ...newVisitor, mobile: e.target.value })}
                    placeholder="Enter mobile number"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="visitor-employeeId">Employee ID (Optional)</Label>
                <Input
                  id="visitor-employeeId"
                  value={newVisitor.employeeId}
                  onChange={(e) => setNewVisitor({ ...newVisitor, employeeId: e.target.value })}
                  placeholder="Enter employee ID"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="outline" onClick={() => setVisitorDialogOpen(false)}>
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
                <Button
                  onClick={async () => {
                    if (!newVisitor.firstName || !newVisitor.lastName || !newVisitor.username || !newVisitor.email || !newVisitor.mobile) {
                      alert("Please fill in all required fields")
                      return
                    }

                    if (!editingVisitor && !newVisitor.password) {
                      alert("Password is required for new visitors")
                      return
                    }

                    try {
                      if (useApi) {
                        if (editingVisitor) {
                          // Update existing visitor
                          const updateData: any = {
                            firstName: newVisitor.firstName,
                            lastName: newVisitor.lastName,
                            email: newVisitor.email,
                            mobile: newVisitor.mobile,
                            employeeId: newVisitor.employeeId || undefined,
                            isActive: editingVisitor.isActive !== false,
                          }
                          await api.admin.visitors.update(editingVisitor.id, updateData)
                          
                          // Update password if provided
                          if (newVisitor.password) {
                            await api.admin.visitors.updatePassword(editingVisitor.id, newVisitor.password)
                          }
                        } else {
                          // Create new visitor
                          await api.admin.visitors.create({
                            username: newVisitor.username,
                            password: newVisitor.password,
                            firstName: newVisitor.firstName,
                            lastName: newVisitor.lastName,
                            email: newVisitor.email,
                            mobile: newVisitor.mobile,
                            employeeId: newVisitor.employeeId || undefined,
                          })
                        }
                        await loadData()
                      } else {
                        // Fallback to localStorage
                        const allVisitors = JSON.parse(localStorage.getItem("visitors") || "[]")

                        if (editingVisitor) {
                          // Update existing visitor
                          const updated = allVisitors.map((v: Visitor & { password?: string }) => {
                            if (v.id === editingVisitor.id) {
                              return {
                                ...v,
                                firstName: newVisitor.firstName,
                                lastName: newVisitor.lastName,
                                email: newVisitor.email,
                                mobile: newVisitor.mobile,
                                employeeId: newVisitor.employeeId || undefined,
                                password: newVisitor.password || v.password,
                                updatedAt: new Date().toISOString(),
                              }
                            }
                            return v
                          })
                          localStorage.setItem("visitors", JSON.stringify(updated))
                        } else {
                          // Create new visitor
                          const newVisitorData: Visitor & { password: string } = {
                            id: `visitor_${Date.now()}`,
                            username: newVisitor.username,
                            password: newVisitor.password,
                            firstName: newVisitor.firstName,
                            lastName: newVisitor.lastName,
                            email: newVisitor.email,
                            mobile: newVisitor.mobile,
                            employeeId: newVisitor.employeeId || undefined,
                            isActive: true,
                            createdAt: new Date().toISOString(),
                            createdBy: dealer?.id,
                          }

                          // Check if username or email already exists
                          const usernameExists = allVisitors.some((v: Visitor) => v.username === newVisitor.username)
                          const emailExists = allVisitors.some((v: Visitor) => v.email === newVisitor.email)

                          if (usernameExists) {
                            alert("Username already exists")
                            return
                          }

                          if (emailExists) {
                            alert("Email already exists")
                            return
                          }

                          allVisitors.push(newVisitorData)
                          localStorage.setItem("visitors", JSON.stringify(allVisitors))
                        }

                        // Reload visitors
                        const updatedVisitors = JSON.parse(localStorage.getItem("visitors") || "[]")
                        const visitorsWithoutPassword = updatedVisitors.map((v: Visitor & { password?: string }) => {
                          const { password: _, ...visitorData } = v
                          return visitorData
                        })
                        setVisitors(visitorsWithoutPassword)
                      }

                      setVisitorDialogOpen(false)
                      setEditingVisitor(null)
                      setNewVisitor({
                        username: "",
                        password: "",
                        firstName: "",
                        lastName: "",
                        email: "",
                        mobile: "",
                        employeeId: "",
                      })
                    } catch (error) {
                      console.error("Error saving visitor:", error)
                      alert(error instanceof ApiError ? error.message : "Failed to save visitor")
                    }
                  }}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {editingVisitor ? "Update Visitor" : "Create Visitor"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Account Manager Create/Edit Dialog */}
        <Dialog open={accountManagerDialogOpen} onOpenChange={setAccountManagerDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingAccountManager ? "Edit User ID" : "Create New User ID"}</DialogTitle>
              <DialogDescription>
                {editingAccountManager ? "Update user information" : "Add a new account manager, installer, baldev, or HR user"}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="am-role">Role *</Label>
                <Select
                  value={newAccountManager.role || undefined}
                  onValueChange={(value) => setNewAccountManager({ ...newAccountManager, role: value })}
                  disabled={!!editingAccountManager}
                >
                  <SelectTrigger id="am-role">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="account-management">Account Manager</SelectItem>
                    <SelectItem value="installer">Installer</SelectItem>
                    <SelectItem value="baldev">Baldev Confirmation</SelectItem>
                    <SelectItem value="hr">HR</SelectItem>
                  </SelectContent>
                </Select>
                {editingAccountManager && (
                  <p className="text-xs text-muted-foreground">Role cannot be changed during edit</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="am-firstName">First Name *</Label>
                  <Input
                    id="am-firstName"
                    value={newAccountManager.firstName}
                    onChange={(e) => setNewAccountManager({ ...newAccountManager, firstName: e.target.value })}
                    placeholder="Enter first name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="am-lastName">Last Name *</Label>
                  <Input
                    id="am-lastName"
                    value={newAccountManager.lastName}
                    onChange={(e) => setNewAccountManager({ ...newAccountManager, lastName: e.target.value })}
                    placeholder="Enter last name"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="am-username">Username *</Label>
                <Input
                  id="am-username"
                  value={newAccountManager.username}
                  onChange={(e) => setNewAccountManager({ ...newAccountManager, username: e.target.value })}
                  placeholder="Enter username"
                  disabled={!!editingAccountManager}
                />
                {editingAccountManager && (
                  <p className="text-xs text-muted-foreground">Username cannot be changed</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="am-password">
                  {editingAccountManager ? "New Password (leave blank to keep current)" : "Password *"}
                </Label>
                <Input
                  id="am-password"
                  type="password"
                  value={newAccountManager.password}
                  onChange={(e) => setNewAccountManager({ ...newAccountManager, password: e.target.value })}
                  placeholder={editingAccountManager ? "Enter new password" : "Enter password"}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="am-email">Email *</Label>
                  <Input
                    id="am-email"
                    type="email"
                    value={newAccountManager.email}
                    onChange={(e) => setNewAccountManager({ ...newAccountManager, email: e.target.value })}
                    placeholder="Enter email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="am-mobile">Mobile *</Label>
                  <Input
                    id="am-mobile"
                    type="tel"
                    value={newAccountManager.mobile}
                    onChange={(e) => setNewAccountManager({ ...newAccountManager, mobile: e.target.value })}
                    placeholder="Enter 10-digit mobile number"
                    maxLength={10}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setAccountManagerDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={async () => {
                    if (!newAccountManager.role) {
                      toast({
                        title: "Validation Error",
                        description: "Please select a role (Account Manager, Installer, Baldev, or HR).",
                        variant: "destructive",
                      })
                      return
                    }

                    if (!newAccountManager.firstName || !newAccountManager.lastName || !newAccountManager.username || !newAccountManager.email || !newAccountManager.mobile) {
                      toast({
                        title: "Validation Error",
                        description: "Please fill in all required fields",
                        variant: "destructive",
                      })
                      return
                    }

                    if (!editingAccountManager && !newAccountManager.password) {
                      toast({
                        title: "Validation Error",
                        description: "Password is required for new account managers",
                        variant: "destructive",
                      })
                      return
                    }

                    try {
                      if (useApi) {
                        if (editingAccountManager) {
                          // Update existing account manager
                          await api.admin.accountManagers.update(editingAccountManager.id, {
                            firstName: newAccountManager.firstName.trim(),
                            lastName: newAccountManager.lastName.trim(),
                            email: newAccountManager.email.trim(),
                            mobile: newAccountManager.mobile,
                          })
                          if (newAccountManager.password) {
                            await api.admin.accountManagers.updatePassword(editingAccountManager.id, newAccountManager.password)
                          }
                        } else {
                          // Create new operational user (with role). Retry without role for older backend compatibility.
                          const createPayload = {
                            role: newAccountManager.role,
                            username: newAccountManager.username,
                            password: newAccountManager.password,
                            firstName: newAccountManager.firstName,
                            lastName: newAccountManager.lastName,
                            email: newAccountManager.email,
                            mobile: newAccountManager.mobile,
                          }
                          try {
                            await api.admin.accountManagers.create(createPayload)
                          } catch (createError) {
                            if (
                              createError instanceof ApiError &&
                              (createError.code === "VAL_001" || createError.code === "HTTP_400")
                            ) {
                              await api.admin.accountManagers.create({
                                username: newAccountManager.username,
                                password: newAccountManager.password,
                                firstName: newAccountManager.firstName,
                                lastName: newAccountManager.lastName,
                                email: newAccountManager.email,
                                mobile: newAccountManager.mobile,
                              })
                              if (newAccountManager.role !== "account-management") {
                                saveOperationsRoleOverride(newAccountManager.username, newAccountManager.role)
                                toast({
                                  title: "Created with compatibility mode",
                                  description:
                                    "Backend role validation is not updated yet. User created and role is tracked locally until backend update.",
                                })
                              }
                            } else {
                              throw createError
                            }
                          }
                        }
                        await loadData()
                      } else {
                        // Fallback to localStorage
                        const allAccountManagers = JSON.parse(localStorage.getItem("accountManagers") || "[]")
                        const allInstallers = JSON.parse(localStorage.getItem("installers") || "[]")
                        const allBaldevUsers = JSON.parse(localStorage.getItem("baldevUsers") || "[]")
                        const allHrUsers = JSON.parse(localStorage.getItem("hrUsers") || "[]")

                        if (editingAccountManager) {
                          // Update existing account manager
                          const roleKey = (editingAccountManager as any).role || "account-management"
                          const sourceList =
                            roleKey === "installer"
                              ? allInstallers
                              : roleKey === "baldev"
                                ? allBaldevUsers
                                : roleKey === "hr"
                                  ? allHrUsers
                                  : allAccountManagers
                          const updated = sourceList.map((am: AccountManager & { password?: string }) => {
                            if (am.id === editingAccountManager.id) {
                              return {
                                ...am,
                                firstName: newAccountManager.firstName,
                                lastName: newAccountManager.lastName,
                                email: newAccountManager.email,
                                mobile: newAccountManager.mobile,
                                password: newAccountManager.password || am.password,
                              }
                            }
                            return am
                          })
                          if (roleKey === "installer") {
                            localStorage.setItem("installers", JSON.stringify(updated))
                          } else if (roleKey === "baldev") {
                            localStorage.setItem("baldevUsers", JSON.stringify(updated))
                          } else if (roleKey === "hr") {
                            localStorage.setItem("hrUsers", JSON.stringify(updated))
                          } else {
                            localStorage.setItem("accountManagers", JSON.stringify(updated))
                          }
                        } else {
                          // Create new account manager
                          const newAccountManagerData: (AccountManager & { password: string }) & { role: string } = {
                            id: `account-mgr-${Date.now()}`,
                            username: newAccountManager.username,
                            password: newAccountManager.password,
                            firstName: newAccountManager.firstName,
                            lastName: newAccountManager.lastName,
                            email: newAccountManager.email,
                            mobile: newAccountManager.mobile,
                            role: newAccountManager.role,
                            isActive: true,
                            emailVerified: false,
                            createdAt: new Date().toISOString(),
                          }

                          // Check if username or email already exists (for localStorage fallback only)
                          const allUsers = [...allAccountManagers, ...allInstallers, ...allBaldevUsers, ...allHrUsers]
                          const usernameExists = allUsers.some((am: AccountManager) => am.username === newAccountManager.username)
                          const emailExists = allUsers.some((am: AccountManager) => am.email === newAccountManager.email)

                          if (usernameExists) {
                            toast({
                              title: "Validation Error",
                              description: "Username already exists. Please choose a different username.",
                              variant: "destructive",
                            })
                            return
                          }

                          if (emailExists) {
                            toast({
                              title: "Validation Error",
                              description: "Email already exists. Please use a different email address.",
                              variant: "destructive",
                            })
                            return
                          }

                          if (newAccountManager.role === "installer") {
                            allInstallers.push(newAccountManagerData)
                            localStorage.setItem("installers", JSON.stringify(allInstallers))
                          } else if (newAccountManager.role === "baldev") {
                            allBaldevUsers.push(newAccountManagerData)
                            localStorage.setItem("baldevUsers", JSON.stringify(allBaldevUsers))
                          } else if (newAccountManager.role === "hr") {
                            allHrUsers.push(newAccountManagerData)
                            localStorage.setItem("hrUsers", JSON.stringify(allHrUsers))
                          } else {
                            allAccountManagers.push(newAccountManagerData)
                            localStorage.setItem("accountManagers", JSON.stringify(allAccountManagers))
                          }
                        }

                        // Reload account managers
                        const updatedAccountManagers = JSON.parse(localStorage.getItem("accountManagers") || "[]")
                        const updatedInstallers = JSON.parse(localStorage.getItem("installers") || "[]")
                        const updatedBaldevUsers = JSON.parse(localStorage.getItem("baldevUsers") || "[]")
                        const updatedHrUsers = JSON.parse(localStorage.getItem("hrUsers") || "[]")
                        const mergedUpdatedUsers = [
                          ...updatedAccountManagers.map((u: any) => ({ ...u, role: "account-management" })),
                          ...updatedInstallers.map((u: any) => ({ ...u, role: "installer" })),
                          ...updatedBaldevUsers.map((u: any) => ({ ...u, role: "baldev" })),
                          ...updatedHrUsers.map((u: any) => ({ ...u, role: "hr" })),
                        ]
                        const accountManagersWithoutPassword = mergedUpdatedUsers.map((am: AccountManager & { password?: string }) => {
                          const { password: _, ...accountManagerData } = am
                          return accountManagerData
                        })
                        setAccountManagers(accountManagersWithoutPassword)
                      }

                      setAccountManagerDialogOpen(false)
                      setEditingAccountManager(null)
                      setNewAccountManager({
                        role: "",
                        username: "",
                        password: "",
                        firstName: "",
                        lastName: "",
                        email: "",
                        mobile: "",
                      })
                      
                      toast({
                        title: "Success",
                        description: editingAccountManager ? "User ID updated successfully!" : "User ID created successfully!",
                      })
                    } catch (error) {
                      console.error("Error saving account manager:", error)
                      let detailedMessage = "Failed to save user ID"
                      if (error instanceof ApiError) {
                        const firstDetail = error.details?.[0]
                        detailedMessage = firstDetail?.message || error.message || detailedMessage
                      }
                      toast({
                        title: "Error",
                        description: detailedMessage,
                        variant: "destructive",
                      })
                    }
                  }}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {editingAccountManager ? "Update User ID" : "Create User ID"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Account Manager History Dialog */}
        <Dialog open={accountManagerHistoryDialogOpen} onOpenChange={setAccountManagerHistoryDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Wallet className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <DialogTitle className="text-xl">
                    {selectedAccountManagerForHistory?.firstName} {selectedAccountManagerForHistory?.lastName}
                  </DialogTitle>
                  <DialogDescription className="mt-1">
                    Activity and login history for this account manager
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-4 mt-4">
              {isLoadingHistory ? (
                <div className="text-center py-12 text-muted-foreground">
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4 animate-pulse">
                    <History className="w-8 h-8 opacity-50" />
                  </div>
                  <p className="font-medium">Loading history...</p>
                </div>
              ) : accountManagerHistory.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                    <History className="w-8 h-8 opacity-50" />
                  </div>
                  <p className="font-medium">No history available</p>
                  <p className="text-sm mt-1">Activity history will appear here once the account manager logs in</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {accountManagerHistory.map((historyItem: any, index: number) => {
                    const getActionColor = (action: string) => {
                      switch (action) {
                        case "login":
                          return "bg-green-500/10 text-green-700 border-green-500/20 dark:text-green-400 dark:bg-green-500/20"
                        case "logout":
                          return "bg-orange-500/10 text-orange-700 border-orange-500/20 dark:text-orange-400 dark:bg-orange-500/20"
                        case "view_quotations":
                        case "view_quotation_details":
                          return "bg-blue-500/10 text-blue-700 border-blue-500/20 dark:text-blue-400 dark:bg-blue-500/20"
                        case "password_change":
                          return "bg-purple-500/10 text-purple-700 border-purple-500/20 dark:text-purple-400 dark:bg-purple-500/20"
                        case "profile_update":
                          return "bg-amber-500/10 text-amber-700 border-amber-500/20 dark:text-amber-400 dark:bg-amber-500/20"
                        default:
                          return "bg-gray-500/10 text-gray-700 border-gray-500/20 dark:text-gray-400 dark:bg-gray-500/20"
                      }
                    }
                    
                    const actionColor = getActionColor(historyItem.action || "")
                    
                    return (
                      <div key={historyItem.id || historyItem.timestamp || index} className="p-4 border rounded-lg bg-card hover:bg-muted/50 transition-colors shadow-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <Badge variant="outline" className={`${actionColor} font-medium capitalize text-xs`}>
                                {historyItem.action?.replace(/_/g, " ") || "activity"}
                              </Badge>
                              <span className="text-xs text-muted-foreground font-medium">
                                {historyItem.timestamp ? new Date(historyItem.timestamp).toLocaleString("en-IN", {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  second: "2-digit",
                                }) : "N/A"}
                              </span>
                            </div>
                            <p className="text-sm text-foreground mb-2 font-medium">
                              {historyItem.details || historyItem.description || "No details available"}
                            </p>
                            {(historyItem.ipAddress || historyItem.userAgent) && (
                              <div className="flex flex-wrap gap-4 text-xs text-muted-foreground mt-3 pt-3 border-t border-border">
                                {historyItem.ipAddress && (
                                  <div className="flex items-center gap-2">
                                    <span className="font-semibold text-muted-foreground">IP Address:</span>
                                    <span className="font-mono bg-muted px-2 py-0.5 rounded">{historyItem.ipAddress}</span>
                                  </div>
                                )}
                                {historyItem.userAgent && (
                                  <div className="flex items-center gap-2 max-w-md">
                                    <span className="font-semibold text-muted-foreground">Device:</span>
                                    <span className="truncate bg-muted px-2 py-0.5 rounded">{historyItem.userAgent}</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="flex justify-between items-center pt-4 border-t border-border mt-4">
              <div className="text-sm text-muted-foreground flex items-center gap-2">
                <History className="w-4 h-4" />
                <span>Total activities: <span className="font-semibold text-foreground">{accountManagerHistory.length}</span></span>
              </div>
              <Button variant="outline" onClick={() => {
                setAccountManagerHistoryDialogOpen(false)
                setAccountManagerHistory([])
                setSelectedAccountManagerForHistory(null)
                setIsLoadingHistory(false)
              }}>
                Close
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog
          open={approvalDialogOpen}
          onOpenChange={(open) => {
            setApprovalDialogOpen(open)
            if (!open) {
              setApprovingQuotationId(null)
              setApprovalBankName("")
              setApprovalBankIfsc("")
              setApprovalSubsidyCheque("")
            }
          }}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Select Payment Type</DialogTitle>
              <DialogDescription>
                For Loan or Cash + loan, enter the customer&apos;s bank and IFSC. For Cash or Cash + loan, you can record subsidy cheque details. The same details appear in Payment Management after approval.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="approval-payment-type">Payment Type</Label>
                <Select
                  value={approvalPaymentType}
                  onValueChange={(value) => {
                    const v = value as ApprovalPaymentType
                    setApprovalPaymentType(v)
                    if (v === "cash") {
                      setApprovalBankName("")
                      setApprovalBankIfsc("")
                    }
                  }}
                >
                  <SelectTrigger id="approval-payment-type">
                    <SelectValue placeholder="Select payment type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="loan">Loan</SelectItem>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="mix">Cash + loan</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {(approvalPaymentType === "loan" || approvalPaymentType === "mix") && (
                <div className="space-y-3 rounded-lg border border-border/70 bg-muted/30 p-3">
                  <p className="text-xs font-medium text-muted-foreground">Customer financing bank (required)</p>
                  <div className="space-y-2">
                    <Label htmlFor="approval-bank-name">Bank name</Label>
                    <Input
                      id="approval-bank-name"
                      list="government-bank-options"
                      value={approvalBankName}
                      onChange={(e) => setApprovalBankName(e.target.value)}
                      placeholder="e.g. State Bank of India"
                      autoComplete="organization"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Search/select a government bank, or type a new bank name.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="approval-bank-ifsc">IFSC code</Label>
                    <Input
                      id="approval-bank-ifsc"
                      value={approvalBankIfsc}
                      onChange={(e) => setApprovalBankIfsc(e.target.value.toUpperCase())}
                      placeholder="e.g. SBIN0001234"
                      maxLength={11}
                      className="font-mono uppercase"
                      autoComplete="off"
                    />
                  </div>
                </div>
              )}

              {(approvalPaymentType === "cash" || approvalPaymentType === "mix") && (
                <div className="space-y-2">
                  <Label htmlFor="approval-subsidy-cheque">Subsidy cheque details</Label>
                  <Textarea
                    id="approval-subsidy-cheque"
                    value={approvalSubsidyCheque}
                    onChange={(e) => setApprovalSubsidyCheque(e.target.value)}
                    placeholder="Cheque number, bank, amount, date (if provided by customer)"
                    rows={3}
                    className="resize-y min-h-[72px]"
                  />
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setApprovalDialogOpen(false)
                  setApprovingQuotationId(null)
                  setApprovalBankName("")
                  setApprovalBankIfsc("")
                  setApprovalSubsidyCheque("")
                }}
              >
                Cancel
              </Button>
              <Button onClick={confirmApprovalWithPaymentType}>Approve Quotation</Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog
          open={fileLoginDialogOpen}
          onOpenChange={(open) => {
            if (!open) {
              const qid = fileLoginQuotationId
              if (qid) {
                setOptimisticFileLoginSelect((prev) => {
                  const next = { ...prev }
                  delete next[qid]
                  return next
                })
              }
              setFileLoginQuotationId(null)
              resetFileLoginFormFields()
            }
            setFileLoginDialogOpen(open)
          }}
        >
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>File login</DialogTitle>
              <DialogDescription>
                Choose how the file is logged on the subsidy portal. Payment type matches the Approve flow. Cash + loan uses the same rules as Loan for bank details.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>File login status</Label>
                <Select
                  value={fileLoginStatusChoice}
                  onValueChange={(v) => setFileLoginStatusChoice(v as FileLoginStatus)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="already_login">Already logged in</SelectItem>
                    <SelectItem value="login_now">Login now</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="file-login-payment-type">File payment type</Label>
                <Select
                  value={fileLoginPaymentType}
                  onValueChange={(v) => {
                    const val = v as ApprovalPaymentType
                    setFileLoginPaymentType(val)
                    if (val === "cash") {
                      setFileLoginBankName("")
                      setFileLoginBankIfsc("")
                    }
                  }}
                >
                  <SelectTrigger id="file-login-payment-type">
                    <SelectValue placeholder="Select payment type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="loan">Loan</SelectItem>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="mix">Cash + loan</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {(fileLoginPaymentType === "loan" || fileLoginPaymentType === "mix") && (
                <div className="space-y-3 rounded-lg border border-border/70 bg-muted/30 p-3">
                  <p className="text-xs font-medium text-muted-foreground">Customer financing bank (required)</p>
                  <div className="space-y-2">
                    <Label htmlFor="file-login-bank-name">Bank name</Label>
                    <Input
                      id="file-login-bank-name"
                      list="government-bank-options"
                      value={fileLoginBankName}
                      onChange={(e) => setFileLoginBankName(e.target.value)}
                      placeholder="e.g. State Bank of India"
                      autoComplete="organization"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Search/select a government bank, or type a new bank name.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="file-login-bank-ifsc">IFSC code</Label>
                    <Input
                      id="file-login-bank-ifsc"
                      value={fileLoginBankIfsc}
                      onChange={(e) => setFileLoginBankIfsc(e.target.value.toUpperCase())}
                      placeholder="e.g. SBIN0001234"
                      maxLength={11}
                      className="font-mono uppercase"
                    />
                  </div>
                </div>
              )}
              {(fileLoginPaymentType === "cash" || fileLoginPaymentType === "mix") && (
                <div className="space-y-2">
                  <Label htmlFor="file-login-subsidy-cheque">Subsidy cheque details</Label>
                  <Textarea
                    id="file-login-subsidy-cheque"
                    value={fileLoginSubsidyCheque}
                    onChange={(e) => setFileLoginSubsidyCheque(e.target.value)}
                    placeholder="Cheque number, bank, amount, date (if provided by customer)"
                    rows={3}
                    className="resize-y min-h-[72px]"
                  />
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setFileLoginDialogOpen(false)}
                disabled={isSavingFileLogin}
              >
                Cancel
              </Button>
              <Button onClick={() => void confirmSaveFileLogin()} disabled={isSavingFileLogin}>
                {isSavingFileLogin ? "Saving…" : "Save"}
              </Button>
            </div>
            <datalist id="government-bank-options">
              {GOVERNMENT_BANK_OPTIONS.map((bank) => (
                <option key={bank} value={bank} />
              ))}
            </datalist>
          </DialogContent>
        </Dialog>

        <Dialog open={!!statusHistoryQuotation} onOpenChange={(open) => !open && setStatusHistoryQuotation(null)}>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Status timeline</DialogTitle>
              <DialogDescription>
                {statusHistoryQuotation ? (
                  <>
                    Quotation <span className="font-mono">{statusHistoryQuotation.id}</span> — each status change with
                    date and time (from server when available).
                  </>
                ) : null}
              </DialogDescription>
            </DialogHeader>
            {statusHistoryQuotation ? (
              <div className="space-y-3 text-sm">
                <div className="rounded-md border border-border/70 bg-muted/20 p-3 space-y-1 text-xs">
                  <p>
                    <span className="font-medium text-foreground">Created: </span>
                    {statusHistoryQuotation.createdAt
                      ? new Date(statusHistoryQuotation.createdAt).toLocaleString()
                      : "—"}
                  </p>
                  {statusHistoryQuotation.fileLoginAt ? (
                    <p>
                      <span className="font-medium text-foreground">File login: </span>
                      {new Date(statusHistoryQuotation.fileLoginAt).toLocaleString()}
                    </p>
                  ) : null}
                  {statusHistoryQuotation.statusApprovedAt ? (
                    <p>
                      <span className="font-medium text-foreground">Last approved: </span>
                      {new Date(statusHistoryQuotation.statusApprovedAt).toLocaleString()}
                    </p>
                  ) : null}
                </div>
                {statusHistoryQuotation.statusHistory && statusHistoryQuotation.statusHistory.length > 0 ? (
                  <ul className="space-y-2">
                    {statusHistoryQuotation.statusHistory.map((entry, idx) => (
                      <li
                        key={`${entry.at}-${entry.status}-${idx}`}
                        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 rounded-md border border-border/60 px-3 py-2"
                      >
                        <Badge variant="outline" className="w-fit capitalize">
                          {entry.status}
                        </Badge>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {entry.at ? new Date(entry.at).toLocaleString() : "—"}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted-foreground text-sm">
                    No status history from the server yet. After backend stores transitions on each status change,
                    they will appear here. Current status:{" "}
                    <span className="font-medium capitalize">{statusHistoryQuotation.status || "pending"}</span>.
                  </p>
                )}
              </div>
            ) : null}
            <div className="flex justify-end pt-2">
              <Button variant="outline" onClick={() => setStatusHistoryQuotation(null)}>
                Close
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  )
}

