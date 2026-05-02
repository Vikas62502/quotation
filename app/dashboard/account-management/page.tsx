"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import {
  ArrowLeft,
  LogOut,
  User,
  Wallet,
  CheckCircle2,
  Clock,
  AlertCircle,
  Download,
  FileText,
  Search,
  Eye,
  IndianRupee,
  Calendar as CalendarIcon,
  Send,
} from "lucide-react"
import { SolarLogo } from "@/components/solar-logo"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { format } from "date-fns"
import type { DateRange } from "react-day-picker"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import type { Quotation } from "@/lib/quotation-context"
import { QuotationDetailsDialog } from "@/components/quotation-details-dialog"
import { api, ApiError } from "@/lib/api"
import { calculateSystemSize } from "@/lib/pricing-tables"
import { formatPersonName } from "@/lib/name-display"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"


// Payment Phase Interface
interface PaymentPhase {
  phaseNumber: number
  phaseName: string
  amount: number
  dueDate?: string
  status: "pending" | "partial" | "completed"
  paidAmount: number
  paymentDate?: string
  paymentMode?: string
  transactionId?: string
  note?: string
}

interface SubsidyChequeRecord {
  id: string
  details: string
  amount: number
  status: "pending" | "cleared"
  clearedAt?: string
}

interface CustomerPayment {
  quotationId: string
  customerName: string
  customerMobile: string
  dealerName?: string
  dealerMobile?: string
  /** Payment cap: quotation subtotal / set price (not installment sum). */
  subtotal: number
  totalAmount: number
  finalAmount: number
  /** When API sends remaining or remainingAmount, prefer for list/export display. */
  remainingFromApi?: number
  paymentType?: string
  paymentMode?: string
  bankName?: string
  bankIfsc?: string
  paymentStatus?: "pending" | "completed" | "partial"
  phases: PaymentPhase[]
  quotation: Quotation
  statusApprovedAt?: string
  fileLoginAt?: string
  fileLoginStatus?: string
  /** Subsidy cheques (cash / cash + loan); cleared amounts are applied into installment paidAmounts. */
  subsidyCheques: SubsidyChequeRecord[]
}

function isInstallerReleaseEnabled(q: Partial<Quotation> & Record<string, any>): boolean {
  return (
    q.installationReadyForInstaller === true ||
    q.installation_ready_for_installer === true ||
    q.readyForInstallation === true ||
    q.ready_for_installation === true ||
    q.releaseToInstaller === true
  )
}

const PAYMENT_PLANS_KEY = "quotationPaymentPlans"
const SUBSIDY_CHEQUES_KEY = "quotationSubsidyCheques"
const INSTALLER_RELEASE_MAP_KEY = "installerReleaseMap"

const PAYMENT_MODE_SELECT_VALUES = [
  "cash",
  "upi",
  "loan",
  "netbanking",
  "bank_transfer",
  "cheque",
  "card",
] as const

type PaymentModeSelectValue = (typeof PAYMENT_MODE_SELECT_VALUES)[number]

/** Map API / human labels to Select values so Radix Select matches and PATCH passes backend validation. */
function normalizePaymentMode(raw?: string | null): PaymentModeSelectValue | undefined {
  if (raw == null) return undefined
  const s = String(raw).trim()
  if (!s) return undefined
  const key = s.toLowerCase().replace(/[\s-]+/g, "_")
  const aliases: Record<string, PaymentModeSelectValue> = {
    cash: "cash",
    upi: "upi",
    loan: "loan",
    netbanking: "netbanking",
    net_banking: "netbanking",
    bank_transfer: "bank_transfer",
    banktransfer: "bank_transfer",
    neft: "bank_transfer",
    rtgs: "bank_transfer",
    imps: "bank_transfer",
    cheque: "cheque",
    check: "cheque",
    card: "card",
    debit_card: "card",
    credit_card: "card",
  }
  if (aliases[key]) return aliases[key]
  const simple = s.toLowerCase()
  if ((PAYMENT_MODE_SELECT_VALUES as readonly string[]).includes(simple)) return simple as PaymentModeSelectValue
  return undefined
}

function pickFirstFiniteNumber(...vals: unknown[]): number {
  for (const v of vals) {
    if (v === undefined || v === null || v === "") continue
    const n = Number(v)
    if (Number.isFinite(n)) return n
  }
  return 0
}

function optionalFiniteNumber(v: unknown): number | undefined {
  if (v === undefined || v === null || v === "") return undefined
  const n = Number(v)
  return Number.isFinite(n) ? n : undefined
}

function pickApiRemainingFromPayload(q: Record<string, unknown>): number | undefined {
  return optionalFiniteNumber(q.remaining) ?? optionalFiniteNumber(q.remainingAmount)
}

function getTotalPaidPhases(phases: PaymentPhase[]): number {
  return phases.reduce((sum, phase) => sum + (Number(phase.paidAmount) || 0), 0)
}

function getComputedRemaining(payment: CustomerPayment): number {
  return Math.max(payment.subtotal - getTotalPaidPhases(payment.phases), 0)
}

/** Prefer server remaining; else subtotal − sum(paidAmount). */
function getDisplayRemaining(payment: CustomerPayment): number {
  const phasePaid = getTotalPaidPhases(payment.phases)
  const computed = Math.max(0, payment.subtotal - phasePaid)
  if ((payment.subsidyCheques?.length ?? 0) > 0) {
    return computed
  }
  if (payment.remainingFromApi != null && Number.isFinite(payment.remainingFromApi)) {
    return Math.max(0, payment.remainingFromApi)
  }
  return computed
}

function getStoredSubsidyChequesMap(): Record<string, SubsidyChequeRecord[]> {
  try {
    const raw = localStorage.getItem(SUBSIDY_CHEQUES_KEY)
    if (!raw) return {}
    const p = JSON.parse(raw)
    return p && typeof p === "object" ? p : {}
  } catch {
    return {}
  }
}

function saveSubsidyChequesMap(map: Record<string, SubsidyChequeRecord[]>) {
  localStorage.setItem(SUBSIDY_CHEQUES_KEY, JSON.stringify(map))
}

function persistSubsidyChequesForQuotation(quotationId: string, cheques: SubsidyChequeRecord[]) {
  const map = getStoredSubsidyChequesMap()
  map[quotationId] = cheques
  saveSubsidyChequesMap(map)
}

/** Apply cleared subsidy amount across installments in order (does not exceed phase caps). */
function applySubsidyAmountToPhases(phases: PaymentPhase[], amountToApply: number): PaymentPhase[] {
  let left = Math.round(Number(amountToApply) || 0)
  if (left <= 0) return phases
  const sorted = [...phases].sort((a, b) => a.phaseNumber - b.phaseNumber)
  return sorted.map((ph) => {
    const amountCap = Math.max(Math.round(Number(ph.amount) || 0), Math.round(Number(ph.paidAmount) || 0))
    const paidNow = Math.round(Number(ph.paidAmount) || 0)
    const room = Math.max(0, amountCap - paidNow)
    const add = Math.min(room, left)
    left -= add
    const paid = paidNow + add
    const amount = Math.max(amountCap, paid)
    const status: PaymentPhase["status"] =
      paid >= amount ? "completed" : paid > 0 ? "partial" : "pending"
    return { ...ph, paidAmount: paid, amount, status }
  })
}

/** Parse API / DB date strings that are not always ISO-8601 (e.g. MySQL `YYYY-MM-DD HH:mm:ss`). */
function parseFlexibleAdminDate(input: string): Date | null {
  const s = input.trim()
  if (!s) return null
  let d = new Date(s)
  if (!Number.isNaN(d.getTime())) return d
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(s)) {
    d = new Date(s.replace(" ", "T"))
    if (!Number.isNaN(d.getTime())) return d
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    d = new Date(`${s}T00:00:00`)
    if (!Number.isNaN(d.getTime())) return d
  }
  return null
}

function formatAdminDate(iso?: string | null) {
  if (!iso) return "—"
  const d = parseFlexibleAdminDate(String(iso))
  return d ? d.toLocaleString("en-IN") : "—"
}

/** Normalize API date / epoch / Date for display pipeline. */
function pickIsoOrString(v: unknown): string | undefined {
  if (v == null) return undefined
  if (typeof v === "object" && v !== null && "$date" in (v as object)) {
    return pickIsoOrString((v as { $date?: unknown }).$date)
  }
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? undefined : v.toISOString()
  if (typeof v === "number" && Number.isFinite(v)) {
    const ms = v < 1e12 ? v * 1000 : v
    const d = new Date(ms)
    return Number.isNaN(d.getTime()) ? undefined : d.toISOString()
  }
  const s = String(v).trim()
  return s || undefined
}

/** Flatten list rows like `{ quotation: {...} }` or Sequelize `{ attributes: {...} }`. */
function quotationListRowToFlatRecord(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object") return {}
  const r = raw as Record<string, unknown>
  let base: Record<string, unknown> = { ...r }
  const nested = r.quotation
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    base = { ...(nested as Record<string, unknown>), ...r }
  }
  const attrs = base.attributes
  if (attrs && typeof attrs === "object" && !Array.isArray(attrs)) {
    base = { ...(attrs as Record<string, unknown>), ...base }
  }
  return base
}

/**
 * Approve date: explicit fields first, then last "approved" entry in status history
 * (statusHistory / status_history / statusChanges), matching admin dashboard shapes.
 */
function pickApprovalTimestampFromQuotation(q: Record<string, unknown>): string | undefined {
  const direct = pickIsoOrString(
    q.statusApprovedAt ?? q.status_approved_at ?? q.approvedAt ?? q.approved_at,
  )
  if (direct) return direct
  const rawHist = q.statusHistory ?? q.status_history ?? q.statusChanges
  if (!Array.isArray(rawHist)) return undefined
  for (let i = rawHist.length - 1; i >= 0; i--) {
    const e = rawHist[i] as Record<string, unknown> | null
    if (!e || typeof e !== "object") continue
    const st = String(e.status ?? e.to ?? e.newStatus ?? "")
      .trim()
      .toLowerCase()
    if (st !== "approved") continue
    const at = pickIsoOrString(e.at ?? e.changedAt ?? e.timestamp ?? e.createdAt)
    if (at) return at
  }
  return undefined
}

function pickFileLoginTimestampFromQuotation(q: Record<string, unknown>): string | undefined {
  const direct = pickIsoOrString(
    q.fileLoginAt ??
      q.file_login_at ??
      q.fileLoggedInAt ??
      q.file_logged_in_at ??
      q.fileLoginDate ??
      q.file_login_date,
  )
  if (direct) return direct

  const nested = q.fileLogin
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    const n = nested as Record<string, unknown>
    const fromNested = pickIsoOrString(n.at ?? n.loggedAt ?? n.logged_at ?? n.date ?? n.timestamp)
    if (fromNested) return fromNested
  }

  const rawHist = q.statusHistory ?? q.status_history ?? q.statusChanges
  if (Array.isArray(rawHist)) {
    for (let i = rawHist.length - 1; i >= 0; i--) {
      const e = rawHist[i] as Record<string, unknown> | null
      if (!e || typeof e !== "object") continue
      const st = String(e.status ?? e.to ?? e.newStatus ?? "")
        .trim()
        .toLowerCase()
        .replace(/[\s-]+/g, "_")
      const isFileLogin =
        st === "file_login" ||
        st === "filelogin" ||
        st === "portal_login" ||
        st === "login_filed" ||
        st.includes("file_login")
      if (!isFileLogin) continue
      const at = pickIsoOrString(e.at ?? e.changedAt ?? e.timestamp ?? e.createdAt)
      if (at) return at
    }
  }

  return undefined
}

function fileLoginStatusLabel(raw?: string | null) {
  if (!raw) return ""
  const s = String(raw).toLowerCase()
  if (s === "already_login") return "Already logged in"
  if (s === "login_now") return "Login now"
  return raw
}

function normalizeSubsidyChequesFromApi(raw: unknown): SubsidyChequeRecord[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter(Boolean)
    .map((c: any) => ({
      id: String(c.id || `sc-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`),
      details: String(c.details || c.chequeDetails || ""),
      amount: Math.max(0, Math.round(Number(c.amount) || 0)),
      status: c.status === "cleared" ? ("cleared" as const) : ("pending" as const),
      clearedAt: c.clearedAt || c.cleared_at,
    }))
}

/**
 * API rule: paidAmount <= amount per phase. Default equal-split "amount" is often < paidAmount
 * after real collections. Rebuild each amount as paid + fair share of (subtotal − sum(paid)),
 * then fix row status from paid vs amount.
 */
function normalizePhaseAmountsForApi(phases: PaymentPhase[], subtotal: number): PaymentPhase[] {
  const n = phases.length
  if (n === 0) return phases
  const S = Math.max(0, Math.round(Number(subtotal) || 0))
  const paidRounded = phases.map((p) => Math.max(0, Math.round(Number(p.paidAmount) || 0)))
  const sumPaid = paidRounded.reduce((a, b) => a + b, 0)

  if (sumPaid > S) {
    return phases.map((p, i) => {
      const paid = paidRounded[i]
      const amount = Math.max(Math.round(Number(p.amount) || 0), paid)
      const status: PaymentPhase["status"] =
        paid >= amount ? "completed" : paid > 0 ? "partial" : "pending"
      return { ...p, paidAmount: paid, amount, status }
    })
  }

  const pool = S - sumPaid
  const base = Math.floor(pool / n)
  const extraOnes = pool - base * n
  return phases.map((p, i) => {
    const paid = paidRounded[i]
    const extra = base + (i < extraOnes ? 1 : 0)
    const amount = paid + extra
    const status: PaymentPhase["status"] =
      paid >= amount ? "completed" : paid > 0 ? "partial" : "pending"
    return { ...p, paidAmount: paid, amount, status }
  })
}

function coercePhasesPaymentModes(phases: PaymentPhase[]): PaymentPhase[] {
  let last: PaymentModeSelectValue | undefined
  return phases.map((phase) => {
    const fromField = normalizePaymentMode(
      phase.paymentMode || (phase as any).mode || (phase as any).payment_method,
    )
    let paymentMode = fromField
    if (paymentMode) last = paymentMode
    const paid = Number(phase.paidAmount) || 0
    const hasPaymentActivity = paid > 0 || phase.status === "partial" || phase.status === "completed"
    if (hasPaymentActivity && !paymentMode) {
      paymentMode = last || "cash"
      last = paymentMode
    }
    return { ...phase, paymentMode }
  })
}

function calendarDateLocalYmd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function paymentDateRangeToFilterStrings(range?: DateRange) {
  return {
    from: range?.from ? calendarDateLocalYmd(range.from) : "",
    to: range?.to ? calendarDateLocalYmd(range.to) : "",
  }
}

function PaymentDateRangeFilter({
  id,
  label,
  value,
  onChange,
  placeholder,
}: {
  id: string
  label: string
  value: DateRange | undefined
  onChange: (next: DateRange | undefined) => void
  placeholder: string
}) {
  const text = (() => {
    if (!value?.from) return placeholder
    const a = format(value.from, "dd/MM/yyyy")
    if (!value.to) return `${a} → …`
    const b = format(value.to, "dd/MM/yyyy")
    return a === b ? a : `${a} → ${b}`
  })()

  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            className="h-9 w-full justify-start gap-2 px-3 text-left text-sm font-normal"
          >
            <CalendarIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate">{text}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="range"
            selected={value}
            onSelect={onChange}
            defaultMonth={value?.from ?? new Date()}
            numberOfMonths={1}
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}

export default function AccountManagementPage() {
  const { isAuthenticated, role, logout, accountManager, dealer } = useAuth()
  const router = useRouter()
  const { toast } = useToast()
  const [quotations, setQuotations] = useState<Quotation[]>([])
  const [customerPayments, setCustomerPayments] = useState<CustomerPayment[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [paymentSearchTerm, setPaymentSearchTerm] = useState("")
  const [paymentTypeFilter, setPaymentTypeFilter] = useState<"all" | "loan" | "cash" | "mix" | "unknown">("all")
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<"all" | "pending" | "partial" | "completed">("all")
  /** Approve / file-login filters as calendar ranges (local YYYY-MM-DD derived for row matching). */
  const [approveDateRange, setApproveDateRange] = useState<DateRange | undefined>()
  const [fileLoginDateRange, setFileLoginDateRange] = useState<DateRange | undefined>()
  const [selectedQuotation, setSelectedQuotation] = useState<Quotation | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  const [activeTab, setActiveTab] = useState("approved")
  const [installmentDialogOpen, setInstallmentDialogOpen] = useState(false)
  const [activePaymentId, setActivePaymentId] = useState<string | null>(null)
  const [isSavingInstallments, setIsSavingInstallments] = useState(false)
  const [releasingInstallationId, setReleasingInstallationId] = useState<string | null>(null)
  const [subsidyDraftDetails, setSubsidyDraftDetails] = useState("")
  const [subsidyDraftAmount, setSubsidyDraftAmount] = useState("")
  const useApi = process.env.NEXT_PUBLIC_USE_API !== "false"
  const accountDisplayName = accountManager
    ? formatPersonName(accountManager.firstName, accountManager.lastName, "") ||
      accountManager.username ||
      accountManager.email ||
      "Account Manager"
    : "Account Manager"

  const getStoredPaymentPlans = (): Record<string, any> => {
    try {
      const stored = localStorage.getItem(PAYMENT_PLANS_KEY)
      if (!stored) return {}
      const parsed = JSON.parse(stored)
      return parsed && typeof parsed === "object" ? parsed : {}
    } catch {
      return {}
    }
  }

  const saveStoredPaymentPlan = (quotationId: string, payload: any) => {
    const current = getStoredPaymentPlans()
    current[quotationId] = payload
    localStorage.setItem(PAYMENT_PLANS_KEY, JSON.stringify(current))
  }

  const buildInstallments = (total: number, count: number, existing?: PaymentPhase[]) => {
    const safeCount = Math.max(1, count)
    const baseAmount = Math.floor(total / safeCount)
    const remainder = Math.round(total - baseAmount * safeCount)
    return Array.from({ length: safeCount }, (_, index) => {
      const existingPhase = existing?.find((phase) => phase.phaseNumber === index + 1)
      const amount = baseAmount + (index === safeCount - 1 ? remainder : 0)
      const paidAmount = existingPhase?.paidAmount ?? 0
      const status: PaymentPhase["status"] =
        paidAmount >= amount ? "completed" : paidAmount > 0 ? "partial" : "pending"
      return {
        phaseNumber: index + 1,
        phaseName: `Installment ${index + 1}`,
        amount,
        status,
        paidAmount,
        dueDate: existingPhase?.dueDate,
        paymentDate: existingPhase?.paymentDate,
        paymentMode: normalizePaymentMode(
          existingPhase?.paymentMode || (existingPhase as any)?.mode || (existingPhase as any)?.payment_method,
        ),
        transactionId: existingPhase?.transactionId,
        note: (existingPhase as any)?.note || (existingPhase as any)?.remarks || "",
      }
    })
  }

  const activePayment = activePaymentId
    ? customerPayments.find((payment) => payment.quotationId === activePaymentId) || null
    : null

  useEffect(() => {
    if (installmentDialogOpen) {
      setSubsidyDraftDetails("")
      setSubsidyDraftAmount("")
    }
  }, [installmentDialogOpen])

  useEffect(() => {
    // Initialize on mount - wait for auth state
    const timer = setTimeout(() => {
      setIsInitialLoad(false)
    }, 100)

    return () => clearTimeout(timer)
  }, [])

  const loadApprovedQuotations = useCallback(async () => {
    const useApi = process.env.NEXT_PUBLIC_USE_API !== "false"
    setIsLoading(true)
    try {
      if (useApi) {
        // Check if we have an auth token
        const token = localStorage.getItem("authToken")
        if (!token) {
          // No token available - user needs to login again
          toast({
            title: "Authentication Required",
            description: "Your session has expired. Please login again.",
            variant: "destructive",
          })
          // Redirect to login after a short delay
          setTimeout(() => {
            router.push("/account-management-login")
          }, 2000)
          setIsLoading(false)
          return
        }

        // Account Management users should use regular quotations endpoint (not admin endpoint)
        // Backend should filter by status=approved on server side for account-management role
        const response = await api.quotations.getAll({
          status: "approved",  // Request only approved quotations from backend - MANDATORY
          page: 1,
          limit: 1000,  // Get all approved quotations (adjust pagination if needed)
        })
        
        // Handle different response structures
        // apiRequest returns data.data, so response might be { quotations: [...] } or just array
        let quotationsList: any[] = []
        if (Array.isArray(response)) {
          quotationsList = response
        } else if (response?.quotations && Array.isArray(response.quotations)) {
          quotationsList = response.quotations
        } else if (response?.data?.quotations && Array.isArray(response.data.quotations)) {
          quotationsList = response.data.quotations
        } else if (response?.items && Array.isArray(response.items)) {
          quotationsList = response.items
        } else if (response?.results && Array.isArray(response.results)) {
          quotationsList = response.results
        }
        
        // Backend should return only approved quotations, but filter again as safety measure
        const approvedQuotations = quotationsList
          .filter((q: any) => {
            const flat = quotationListRowToFlatRecord(q)
            return String(flat.status || "").toLowerCase() === "approved"
          })
          .map((q: any) => {
            const flat = quotationListRowToFlatRecord(q)
            const pricing = flat.pricing as Record<string, unknown> | undefined
            const phasesFromApi =
              flat.installments ||
              flat.paymentPhases ||
              flat.quotationPaymentPhases ||
              flat.payment_phases ||
              flat.quotation_payment_phases ||
              []
            const subtotalVal = pickFirstFiniteNumber(
              flat.subtotal,
              pricing?.subtotal as number | undefined,
              pricing?.totalAmount as number | undefined,
              flat.totalAmount,
              flat.finalAmount,
            )
            const rem = optionalFiniteNumber(flat.remaining)
            const remAmt = optionalFiniteNumber(flat.remainingAmount)
            const fileLoginStatusRaw = flat.fileLoginStatus ?? flat.file_login_status
            return {
              id: String(flat.id ?? ""),
              customer: (flat.customer as Quotation["customer"]) || {},
              products: (flat.products as Quotation["products"]) || {},
              discount: Number(flat.discount) || 0,
              subtotal: subtotalVal,
              totalAmount:
                (pricing?.subtotal as number) ??
                (pricing?.totalAmount as number) ??
                (flat.totalAmount as number) ??
                (flat.finalAmount as number) ??
                0,
              finalAmount:
                (pricing?.finalAmount as number) ??
                (flat.finalAmount as number) ??
                (pricing?.totalAmount as number) ??
                0,
              createdAt: String(flat.createdAt ?? new Date().toISOString()),
              dealerId: String(flat.dealerId ?? ""),
              dealer: (flat.dealer as Quotation["dealer"]) || null,
              status: "approved" as const,
              paymentMode: (flat.paymentMode ?? flat.payment_mode) as string | undefined,
              paymentType: (flat.paymentType ?? flat.payment_type) as string | undefined,
              paymentStatus: flat.paymentStatus as Quotation["paymentStatus"],
              bankName: (flat.bankName ?? flat.bank_name) as string | undefined,
              bankIfsc: (flat.bankIfsc ?? flat.bank_ifsc) as string | undefined,
              ...(rem !== undefined ? { remaining: rem } : {}),
              ...(remAmt !== undefined ? { remainingAmount: remAmt } : {}),
              installments: Array.isArray(phasesFromApi) ? phasesFromApi : [],
              paymentPhases: Array.isArray(phasesFromApi) ? phasesFromApi : [],
              validUntil: flat.validUntil as string | undefined,
              statusApprovedAt: pickApprovalTimestampFromQuotation(flat),
              fileLoginAt: pickFileLoginTimestampFromQuotation(flat),
              installationReadyForInstaller: isInstallerReleaseEnabled(flat),
              installationReleasedAt: (flat.installationReleasedAt ?? flat.installation_released_at) as string | undefined,
              fileLoginStatus:
                fileLoginStatusRaw === "already_login" || fileLoginStatusRaw === "login_now"
                  ? fileLoginStatusRaw
                  : undefined,
            }
          })
        setQuotations(approvedQuotations as Quotation[])
      } else {
        // Fallback to localStorage for development
        try {
          const allQuotations = JSON.parse(localStorage.getItem("quotations") || "[]")
          const approvedQuotations = allQuotations
            .filter((q: Quotation) => String(q.status || "").toLowerCase() === "approved")
            .map((q: Quotation) => ({ 
              ...q, 
              status: "approved" as const,
              id: q.id || `QT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              customer: q.customer || {},
              products: q.products || {},
              discount: q.discount || 0,
              totalAmount: (q as any).pricing?.subtotal ?? (q as any).pricing?.totalAmount ?? q.totalAmount ?? q.finalAmount ?? 0,
              finalAmount: q.finalAmount ?? (q as any).pricing?.finalAmount ?? q.totalAmount ?? 0,
              createdAt: q.createdAt || new Date().toISOString(),
              dealerId: q.dealerId || null,
              installationReadyForInstaller: isInstallerReleaseEnabled(q as Record<string, any>),
              installationReleasedAt:
                ((q as any).installationReleasedAt as string | undefined) ||
                ((q as any).installation_released_at as string | undefined),
            }))
          
          setQuotations(approvedQuotations)
          
          console.log(`Loaded ${approvedQuotations.length} approved quotations from localStorage`)
        } catch (parseError) {
          console.error("Error parsing localStorage quotations:", parseError)
          setQuotations([])
          toast({
            title: "Error Loading Data",
            description: "Failed to load quotations from local storage. Please check the data format.",
            variant: "destructive",
          })
        }
      }
    } catch (error) {
      console.error("Error loading approved quotations:", error)
      setQuotations([])
      
      // Show error toast with specific handling for permission errors
      if (error instanceof ApiError) {
        // Check for authentication errors
        if (error.code === "AUTH_001" || 
            error.code === "AUTH_003" || 
            error.message?.toLowerCase().includes("not authenticated") ||
            error.message?.toLowerCase().includes("unauthorized") ||
            error.message?.toLowerCase().includes("user not authenticated")) {
          toast({
            title: "Authentication Error",
            description: "Your session has expired or you are not authenticated. Please login again.",
            variant: "destructive",
          })
          // Clear any stale auth data
          localStorage.removeItem("authToken")
          localStorage.removeItem("refreshToken")
          // Redirect to login after a short delay
          setTimeout(() => {
            router.push("/account-management-login")
            router.refresh()
          }, 2000)
        } else if (error.code === "AUTH_004" || error.message?.toLowerCase().includes("insufficient permissions") || error.message?.toLowerCase().includes("permission")) {
          toast({
            title: "Permission Error",
            description: "You don't have permission to access this resource. Please contact your administrator.",
            variant: "destructive",
          })
        } else {
          toast({
            title: "Error Loading Data",
            description: error.message || "Failed to load approved quotations. Please check your connection and try again.",
            variant: "destructive",
          })
        }
      } else {
        console.warn("Non-API error loading quotations:", error)
        // Don't show toast for development mode errors - just log
        if (useApi) {
          toast({
            title: "Connection Error",
            description: "Unable to connect to server. Please check your internet connection.",
            variant: "destructive",
          })
        }
      }
    } finally {
      setIsLoading(false)
    }
  }, [toast])

  useEffect(() => {
    // Skip if still initializing
    if (isInitialLoad) return

    // Only account-management role can access this page
    if (!isAuthenticated) {
      router.push("/account-management-login")
      return
    }
    
    // Allow both account-management and admin (admin uses same page when account managers unavailable)
    const canAccess = role === "account-management" || role === "admin" || dealer?.username === "admin"
    if (!canAccess) {
      if (role === "visitor") {
        router.push("/visitor/dashboard")
      } else {
        router.push("/dashboard")
      }
      return
    }
    
    if (isAuthenticated && canAccess) {
      loadApprovedQuotations()
    }
  }, [isAuthenticated, role, dealer, router, isInitialLoad, loadApprovedQuotations])

  // Initialize payment phases for quotations
  useEffect(() => {
    if (quotations.length > 0) {
      const payments: CustomerPayment[] = quotations.map((q) => {
        const qx = q as Quotation & { remaining?: number; remainingAmount?: number }
        const flatQx = quotationListRowToFlatRecord(qx as unknown)
        const subtotal = pickFirstFiniteNumber(
          qx.subtotal,
          qx.pricing?.subtotal,
          qx.pricing?.totalAmount,
          qx.totalAmount,
          qx.finalAmount,
        )
        const totalAmount = q.totalAmount || q.finalAmount || subtotal || 0
        const existingPhases =
          (q as any).installments ||
          (q as any).paymentPhases ||
          (q as any).quotationPaymentPhases ||
          (q as any).payment_phases ||
          (q as any).quotation_payment_phases ||
          []
        // When backend is enabled, treat backend response as source-of-truth.
        // Local storage fallback is only used when API mode is off.
        const storedPlans = useApi ? {} : getStoredPaymentPlans()
        const storedPlan = storedPlans[q.id || ""]
        const storedPhases = storedPlan?.phases || []
        const sourcePhases = useApi
          ? existingPhases
          : Array.isArray(existingPhases) && existingPhases.length > 0
            ? existingPhases
            : storedPhases
        const phases: PaymentPhase[] = Array.isArray(sourcePhases)
          ? coercePhasesPaymentModes(
              sourcePhases.map((phase: any, index: number) => ({
                phaseNumber: Number(phase.phaseNumber || index + 1),
                phaseName: phase.phaseName || `Installment ${index + 1}`,
                amount: Number(phase.amount || 0),
                dueDate: phase.dueDate,
                status: (phase.status || "pending") as PaymentPhase["status"],
                paidAmount: Number(phase.paidAmount || 0),
                paymentDate: phase.paymentDate,
                paymentMode: normalizePaymentMode(
                  phase.paymentMode || phase.mode || phase.payment_method,
                ),
                transactionId: phase.transactionId,
                note: phase.note || phase.remarks || "",
              })),
            )
          : []

        const subsidyMap = getStoredSubsidyChequesMap()
        const fromApiCheques = normalizeSubsidyChequesFromApi((qx as any).subsidyCheques)
        const mergedSubsidy: SubsidyChequeRecord[] =
          fromApiCheques.length > 0 ? fromApiCheques : subsidyMap[q.id || ""] || []

        return {
          quotationId: q.id || "",
          customerName: formatPersonName(q.customer?.firstName, q.customer?.lastName, "Unknown"),
          customerMobile: q.customer?.mobile || "",
          dealerName: q.dealer
            ? formatPersonName(q.dealer.firstName, q.dealer.lastName, "Unassigned")
            : "Unassigned",
          dealerMobile: q.dealer?.mobile || "",
          subtotal,
          totalAmount: q.totalAmount || 0,
          finalAmount: q.finalAmount || q.totalAmount || 0,
          remainingFromApi: pickApiRemainingFromPayload(qx as unknown as Record<string, unknown>),
          paymentType:
            (q as any).paymentType ||
            (useApi ? q.paymentMode : q.paymentMode || storedPlan?.paymentMode) ||
            undefined,
          paymentMode: normalizePaymentMode(q.paymentMode) || (!useApi ? normalizePaymentMode(storedPlan?.paymentMode) : undefined) || undefined,
          bankName: String((qx as any).bankName ?? (qx as any).bank_name ?? "").trim() || undefined,
          bankIfsc: String((qx as any).bankIfsc ?? (qx as any).bank_ifsc ?? "").trim() || undefined,
          paymentStatus:
            q.paymentStatus ??
            (!useApi ? (storedPlan?.paymentStatus as CustomerPayment["paymentStatus"]) : undefined) ??
            "pending",
          phases,
          quotation: q,
          statusApprovedAt: pickApprovalTimestampFromQuotation(flatQx),
          fileLoginAt: pickFileLoginTimestampFromQuotation(flatQx),
          fileLoginStatus: (qx as any).fileLoginStatus ?? (qx as any).file_login_status,
          subsidyCheques: mergedSubsidy,
        }
      })
      setCustomerPayments(payments)
    }
  }, [quotations, useApi])

  // Show loading state while checking authentication
  if (isInitialLoad) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4 animate-pulse">
            <FileText className="w-8 h-8 text-primary opacity-50" />
          </div>
          <p className="text-muted-foreground">Loading Account Management...</p>
        </div>
      </div>
    )
  }

  // Don't render if not authenticated or not allowed (account-management or admin)
  const canAccess = role === "account-management" || role === "admin" || dealer?.username === "admin"
  if (!isAuthenticated || !canAccess) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
            <FileText className="w-8 h-8 opacity-50" />
          </div>
          <p className="text-muted-foreground">Redirecting to login...</p>
        </div>
      </div>
    )
  }

  const filteredQuotations = quotations.filter(
    (q) =>
      (q.customer?.firstName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (q.customer?.lastName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (q.customer?.mobile || "").includes(searchTerm) ||
      (q.id || "").toLowerCase().includes(searchTerm.toLowerCase()),
  )

  const sortedQuotations = [...filteredQuotations].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  )

  const totalApprovedValue = quotations.reduce((sum, q) => sum + Math.abs(q.finalAmount || q.totalAmount || 0), 0)

  const getPaymentTypeValue = (payment: CustomerPayment) => {
    return String(payment.paymentType || payment.paymentMode || "").toLowerCase()
  }

  const getFinancingBankDisplay = (payment: CustomerPayment): string => {
    const t = getPaymentTypeValue(payment)
    if (t !== "loan" && t !== "mix") return "—"
    const bank = String(payment.bankName || "").trim()
    const ifsc = String(payment.bankIfsc || "").trim().toUpperCase()
    if (!bank && !ifsc) return "—"
    if (bank && ifsc) return `${bank} · ${ifsc}`
    return bank || ifsc
  }

  const getPaymentTypeLabel = (paymentType?: string) => {
    const normalized = String(paymentType || "").toLowerCase()
    if (normalized === "loan") return "Loan"
    if (normalized === "cash") return "Cash"
    if (normalized === "mix") return "Cash + loan"
    return "N/A"
  }

  const toLocalCalendarDateString = (iso?: string | null) => {
    if (!iso) return null
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return null
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, "0")
    const day = String(d.getDate()).padStart(2, "0")
    return `${y}-${m}-${day}`
  }

  const calendarDateInRange = (ymd: string | null, from: string, to: string) => {
    if (!from.trim() && !to.trim()) return true
    if (!ymd) return false
    if (from.trim() && ymd < from.trim()) return false
    if (to.trim() && ymd > to.trim()) return false
    return true
  }

  const filteredCustomerPayments = customerPayments.filter((payment) => {
    const matchesSearch =
      payment.customerName.toLowerCase().includes(paymentSearchTerm.toLowerCase()) ||
      payment.customerMobile.includes(paymentSearchTerm) ||
      payment.quotationId.toLowerCase().includes(paymentSearchTerm.toLowerCase())
    const paymentTypeValue = getPaymentTypeValue(payment)
    const matchesPaymentType =
      paymentTypeFilter === "all" ||
      (paymentTypeFilter === "unknown" ? !paymentTypeValue : paymentTypeValue === paymentTypeFilter)
    const paymentStatusValue = payment.paymentStatus || "pending"
    const matchesPaymentStatus = paymentStatusFilter === "all" || paymentStatusValue === paymentStatusFilter
    const approveYmd = toLocalCalendarDateString(payment.statusApprovedAt)
    const fileLoginYmd = toLocalCalendarDateString(payment.fileLoginAt)
    const approveBounds = paymentDateRangeToFilterStrings(approveDateRange)
    const fileLoginBounds = paymentDateRangeToFilterStrings(fileLoginDateRange)
    const matchesApproveDateRange = calendarDateInRange(approveYmd, approveBounds.from, approveBounds.to)
    const matchesFileLoginDateRange = calendarDateInRange(fileLoginYmd, fileLoginBounds.from, fileLoginBounds.to)
    return (
      matchesSearch &&
      matchesPaymentType &&
      matchesPaymentStatus &&
      matchesApproveDateRange &&
      matchesFileLoginDateRange
    )
  })

  const downloadFilteredPaymentsExcel = () => {
    if (filteredCustomerPayments.length === 0) {
      toast({
        title: "No data to export",
        description: "Adjust filters to include at least one payment row.",
        variant: "destructive",
      })
      return
    }

    const escapeCsv = (value: string | number) => {
      const raw = String(value ?? "")
      if (raw.includes(",") || raw.includes("\"") || raw.includes("\n")) {
        return `"${raw.replace(/"/g, "\"\"")}"`
      }
      return raw
    }

    const headers = [
      "Quotation ID",
      "Customer Name",
      "Customer Mobile",
      "Payment Type",
      "Bank & IFSC",
      "Payment Status",
      "Approve date",
      "File login date",
      "File login status",
      "Subtotal",
      "Paid Amount",
      "Remaining Amount",
    ]

    const rows = filteredCustomerPayments.map((payment) => {
      const paidAmount = getTotalPaidPhases(payment.phases)
      const remainingAmount = getDisplayRemaining(payment)
      const bankCell = getFinancingBankDisplay(payment)
      return [
        payment.quotationId,
        payment.customerName,
        payment.customerMobile,
        getPaymentTypeLabel(payment.paymentType || payment.paymentMode),
        bankCell === "—" ? "" : bankCell,
        (payment.paymentStatus || "pending").toUpperCase(),
        payment.statusApprovedAt ? formatAdminDate(payment.statusApprovedAt) : "",
        payment.fileLoginAt ? formatAdminDate(payment.fileLoginAt) : "",
        fileLoginStatusLabel(payment.fileLoginStatus) || "",
        payment.subtotal,
        paidAmount,
        remainingAmount,
      ]
    })

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => escapeCsv(cell)).join(","))
      .join("\n")

    const blob = new Blob([`\uFEFF${csvContent}`], { type: "text/csv;charset=utf-8;" })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement("a")
    const stamp = new Date().toISOString().slice(0, 10)
    link.href = url
    link.download = `payment-management-${stamp}.csv`
    link.click()
    window.URL.revokeObjectURL(url)
  }

  const getSystemSize = (quotation: Quotation): string => {
    const products = quotation.products
    if (!products) return "N/A"

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
      const systemType = products.systemType.toLowerCase()
      if (systemType === "dcr") return "DCR"
      if (systemType === "non-dcr") return "NON DCR"
      if (systemType === "both") return "BOTH"
      if (systemType === "customize") return "CUSTOMIZE"
      return products.systemType.toUpperCase()
    }

    return "N/A"
  }

  const handleAddSubsidyCheque = () => {
    if (!activePayment) return
    const amt = Math.round(Number(subsidyDraftAmount) || 0)
    if (!subsidyDraftDetails.trim() || amt <= 0) {
      toast({
        title: "Cheque details required",
        description: "Enter subsidy cheque details and a positive amount.",
        variant: "destructive",
      })
      return
    }
    const id =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `sc-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    const row: SubsidyChequeRecord = {
      id,
      details: subsidyDraftDetails.trim(),
      amount: amt,
      status: "pending",
    }
    const newCheques = [...(activePayment.subsidyCheques || []), row]
    setCustomerPayments((prev) =>
      prev.map((p) => (p.quotationId === activePayment.quotationId ? { ...p, subsidyCheques: newCheques } : p)),
    )
    persistSubsidyChequesForQuotation(activePayment.quotationId, newCheques)
    setSubsidyDraftDetails("")
    setSubsidyDraftAmount("")
    toast({ title: "Subsidy cheque recorded", description: "Mark as cleared when the cheque is honored." })
  }

  const handleMarkSubsidyChequeCleared = (chequeId: string) => {
    if (!activePayment) return
    const ch = activePayment.subsidyCheques.find((c) => c.id === chequeId)
    if (!ch || ch.status !== "pending") return
    const amt = Math.round(Number(ch.amount) || 0)
    if (amt <= 0) return

    let phases = activePayment.phases
    if (phases.length === 0) {
      phases = buildInstallments(activePayment.subtotal, 1)
    }
    const paidBefore = getTotalPaidPhases(phases)
    const nextPhases = applySubsidyAmountToPhases(phases, amt)
    const paidAfter = getTotalPaidPhases(nextPhases)
    const applied = paidAfter - paidBefore
    if (applied <= 0) {
      toast({
        title: "Could not apply amount",
        description: "Create installments or raise phase caps so the subsidy can be allocated.",
        variant: "destructive",
      })
      return
    }
    if (paidAfter > activePayment.subtotal + 0.5) {
      toast({
        title: "Would exceed subtotal",
        description: "Reduce the cheque amount or adjust installments.",
        variant: "destructive",
      })
      return
    }
    if (applied < amt) {
      toast({
        title: "Partially applied",
        description: `₹${applied.toLocaleString("en-IN")} applied to installments (₹${(amt - applied).toLocaleString("en-IN")} unallocated — add installments or increase amounts).`,
      })
    }
    const newCheques = activePayment.subsidyCheques.map((c) =>
      c.id === chequeId ? { ...c, status: "cleared" as const, clearedAt: new Date().toISOString() } : c,
    )
    const updated = customerPayments.map((p) =>
      p.quotationId === activePayment.quotationId ? { ...p, phases: nextPhases, subsidyCheques: newCheques } : p,
    )
    setCustomerPayments(updated)
    persistSubsidyChequesForQuotation(activePayment.quotationId, newCheques)

    if (!useApi) {
      const p = updated.find((x) => x.quotationId === activePayment.quotationId)
      if (p) {
        const coerced = coercePhasesPaymentModes(p.phases)
        const phasesForStore = normalizePhaseAmountsForApi(coerced, p.subtotal)
        const totalPaid = getTotalPaidPhases(phasesForStore)
        const paymentStatus: CustomerPayment["paymentStatus"] =
          totalPaid <= 0 ? "pending" : totalPaid >= p.subtotal ? "completed" : "partial"
        saveStoredPaymentPlan(activePayment.quotationId, {
          paymentType: p.paymentType,
          paymentMode: p.paymentMode || "cash",
          paymentStatus,
          phases: phasesForStore,
        })
      }
    }

    toast({
      title: "Cheque cleared",
      description: useApi
        ? "Amount added to installments. Click Submit to save to the server."
        : "Amount applied to installments and saved locally.",
    })
  }

  const submitInstallments = async () => {
    if (!activePayment) return

    const totalPaid = getTotalPaidPhases(activePayment.phases)
    const paymentCap = activePayment.subtotal
    if (totalPaid > paymentCap + 0.5) {
      toast({
        title: "Cannot save",
        description: `Total paid (₹${Math.round(totalPaid).toLocaleString()}) cannot exceed subtotal (₹${Math.round(paymentCap).toLocaleString()}).`,
        variant: "destructive",
      })
      return
    }
    const paymentStatus: CustomerPayment["paymentStatus"] =
      totalPaid <= 0
        ? "pending"
        : totalPaid >= paymentCap
          ? "completed"
          : "partial"
    const coercedPhases = coercePhasesPaymentModes(activePayment.phases)
    const phasesForApi = normalizePhaseAmountsForApi(coercedPhases, paymentCap)
    const paymentModeFromPhases =
      phasesForApi.map((p) => normalizePaymentMode(p.paymentMode)).find(Boolean) ||
      normalizePaymentMode(activePayment.paymentMode) ||
      "cash"

    const payload = {
      paymentType: activePayment.paymentType,
      paymentMode: paymentModeFromPhases,
      paymentStatus: paymentStatus || "pending",
      ...(activePayment.subsidyCheques?.length
        ? { subsidyCheques: activePayment.subsidyCheques }
        : {}),
      phases: phasesForApi.map((phase) => {
        const modeNorm = normalizePaymentMode(phase.paymentMode)
        const needsMode =
          (Number(phase.paidAmount) || 0) > 0 ||
          phase.status === "partial" ||
          phase.status === "completed"
        return {
          phaseNumber: phase.phaseNumber,
          phaseName: phase.phaseName,
          amount: Number(phase.amount) || 0,
          paidAmount: Number(phase.paidAmount) || 0,
          status: phase.status,
          dueDate: phase.dueDate || undefined,
          paymentDate: phase.paymentDate || undefined,
          paymentMode: modeNorm || (needsMode ? paymentModeFromPhases : undefined),
          transactionId: phase.transactionId || undefined,
          note: phase.note?.trim() || undefined,
        }
      }),
    }

    setIsSavingInstallments(true)
    try {
      if (!useApi) {
        // Local fallback only when backend API mode is disabled.
        saveStoredPaymentPlan(activePayment.quotationId, payload)
      } else {
        await api.quotations.updatePaymentDetails(activePayment.quotationId, payload)
        // Refresh from backend so paidAmount comes from DB response.
        await loadApprovedQuotations()
      }

      if (!useApi) {
        setCustomerPayments((prev) =>
          prev.map((payment) =>
            payment.quotationId === activePayment.quotationId
              ? {
                  ...payment,
                  paymentType: payload.paymentType,
                  paymentMode: payload.paymentMode,
                  paymentStatus: payload.paymentStatus,
                  phases: payload.phases,
                }
              : payment,
          ),
        )
      }

      persistSubsidyChequesForQuotation(activePayment.quotationId, activePayment.subsidyCheques || [])

      toast({
        title: "Payment details saved",
        description: "Installments updated successfully.",
      })
      setInstallmentDialogOpen(false)
      setActivePaymentId(null)
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Failed to save payment details."
      toast({
        title: "Save failed",
        description: message,
        variant: "destructive",
      })
    } finally {
      setIsSavingInstallments(false)
    }
  }

  const handleLogout = () => {
    // Direct logout without confirmation for better UX
    logout()
    toast({
      title: "Logged Out",
      description: "You have been successfully logged out",
    })
    // Clear any cached data
    setQuotations([])
    setSearchTerm("")
    setSelectedQuotation(null)
    // Navigate to landing page
    router.push("/")
    router.refresh()
  }

  const handleReleaseToInstaller = async (quotation: Quotation) => {
    if (!quotation?.id) return
    if (quotation.installationReadyForInstaller) {
      toast({
        title: "Already sent",
        description: "This quotation is already visible in installer dashboard.",
      })
      return
    }

    const releasedAt = new Date().toISOString()
    setReleasingInstallationId(quotation.id)
    const applyReleaseLocally = () => {
      setQuotations((prev) =>
        prev.map((q) =>
          q.id === quotation.id
            ? {
                ...q,
                installationReadyForInstaller: true,
                installationReleasedAt: releasedAt,
              }
            : q,
        ),
      )
      setCustomerPayments((prev) =>
        prev.map((payment) =>
          payment.quotationId === quotation.id
            ? {
                ...payment,
                quotation: {
                  ...payment.quotation,
                  installationReadyForInstaller: true,
                  installationReleasedAt: releasedAt,
                },
              }
            : payment,
        ),
      )

      // Keep local fallback in sync so installer dashboard reflects immediately when API is disabled.
      try {
        const localAll = JSON.parse(localStorage.getItem("quotations") || "[]")
        const next = Array.isArray(localAll)
          ? localAll.map((q: any) =>
              q?.id === quotation.id
                ? {
                    ...q,
                    installationReadyForInstaller: true,
                    installationReleasedAt: releasedAt,
                  }
                : q,
            )
          : localAll
        localStorage.setItem("quotations", JSON.stringify(next))
      } catch {
        // no-op
      }
      try {
        const current = JSON.parse(localStorage.getItem(INSTALLER_RELEASE_MAP_KEY) || "{}")
        const next = {
          ...(current && typeof current === "object" ? current : {}),
          [quotation.id]: {
            installationReadyForInstaller: true,
            installationReleasedAt: releasedAt,
          },
        }
        localStorage.setItem(INSTALLER_RELEASE_MAP_KEY, JSON.stringify(next))
      } catch {
        // no-op
      }
    }
    try {
      if (useApi) {
        await api.quotations.releaseForInstallation(quotation.id, {
          installationReadyForInstaller: true,
          installationReleasedAt: releasedAt,
        })
      }
      applyReleaseLocally()

      toast({
        title: "Sent to installer",
        description: "Quotation is now visible in Installer dashboard.",
      })
    } catch (error) {
      const errorText = (error instanceof ApiError ? error.message : String(error || "")).toLowerCase()
      const permissionDenied =
        (error instanceof ApiError && (error.code === "AUTH_004" || error.code === "HTTP_403")) ||
        errorText.includes("insufficient permissions") ||
        errorText.includes("forbidden") ||
        errorText.includes("not authorized")

      if (permissionDenied) {
        // In API mode, local-only marking causes false success across users/devices.
        // Keep local fallback only when API is disabled.
        if (!useApi) {
          applyReleaseLocally()
          toast({
            title: "Sent to installer",
            description: "Marked successfully.",
          })
        } else {
          toast({
            title: "Send failed",
            description:
              "Backend denied this action (403). Please grant Account Management permission for installation release endpoint so installer dashboard can see it for all users.",
            variant: "destructive",
          })
        }
        return
      }

      const message = error instanceof ApiError ? error.message : "Could not send quotation to installer."
      toast({
        title: "Send failed",
        description: message,
        variant: "destructive",
      })
    } finally {
      setReleasingInstallationId(null)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Account Management Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 shadow-sm">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-14 sm:h-16 gap-2">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              {(role === "admin" || dealer?.username === "admin") && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => router.push("/dashboard/admin")}
                  className="gap-2 text-muted-foreground hover:text-foreground px-2 sm:px-3 shrink-0"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span className="hidden sm:inline">Back to Admin</span>
                </Button>
              )}
              <button onClick={() => router.push("/dashboard/account-management")} className="flex items-center">
                <SolarLogo size="md" />
              </button>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              {accountManager && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-primary/5 border border-primary/20">
                  <User className="w-4 h-4 text-primary" />
                  <span className="text-sm font-semibold text-foreground hidden sm:inline">
                    {accountDisplayName}
                  </span>
                  <span className="text-sm font-semibold text-foreground sm:hidden">
                    {accountDisplayName
                      .split(" ")
                      .filter(Boolean)
                      .map((part) => part.charAt(0))
                      .slice(0, 2)
                      .join("") || "AM"}
                  </span>
                  {accountManager.username && (
                    <span className="hidden lg:inline text-xs text-muted-foreground">
                      ({accountManager.username})
                    </span>
                  )}
                </div>
              )}
              <span className="text-sm font-medium text-muted-foreground hidden lg:inline">Account Management</span>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleLogout} 
                className="gap-2 border-border hover:bg-destructive hover:text-destructive-foreground hover:border-destructive transition-colors shrink-0 font-medium px-2 sm:px-3"
                title="Logout from Account Management"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Logout</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-5">
        <div className="mb-5">
          <div className="flex items-center gap-2.5 mb-1.5">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <FileText className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-foreground">
                Account Management
                {accountManager && (
                  <span className="text-sm font-normal text-muted-foreground ml-1.5">
                    - Welcome, {accountDisplayName}!
                  </span>
                )}
              </h1>
              <p className="text-sm text-muted-foreground">Approved quotations from admin panel - ready for processing</p>
            </div>
          </div>
        </div>

        {/* Tabbed Interface */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-4 h-auto min-h-9 p-1 w-full justify-start overflow-x-auto whitespace-nowrap">
            <TabsTrigger value="approved" className="gap-1.5 text-xs px-3 py-1.5">
              <FileText className="w-4 h-4" />
              Approved Quotations
            </TabsTrigger>
            <TabsTrigger value="payments" className="gap-1.5 text-xs px-3 py-1.5">
              <Wallet className="w-4 h-4" />
              Payment Management
            </TabsTrigger>
          </TabsList>

          {/* Approved Quotations Tab */}
          <TabsContent value="approved" className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="border-border/50 shadow-sm hover:shadow-md transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Approved Quotations</CardTitle>
                  <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-green-500" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{quotations.length}</div>
                  <p className="text-xs text-muted-foreground mt-1">Total approved</p>
                </CardContent>
              </Card>
              <Card className="border-border/50 shadow-sm hover:shadow-md transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Value</CardTitle>
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                    <IndianRupee className="w-5 h-5 text-amber-500" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">₹{(totalApprovedValue / 100000).toFixed(1)}L</div>
                  <p className="text-xs text-muted-foreground mt-1">Approved quotation value</p>
                </CardContent>
              </Card>
              <Card className="border-border/50 shadow-sm hover:shadow-md transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Last Updated</CardTitle>
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                    <CalendarIcon className="w-5 h-5 text-blue-500" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-sm font-bold">
                    {quotations.length > 0 
                      ? new Date(quotations[0]?.createdAt || Date.now()).toLocaleDateString("en-IN")
                      : "N/A"}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Most recent approval</p>
                </CardContent>
              </Card>
            </div>

            {/* Approved Quotations Table */}
            <Card className="border-border/50 shadow-sm">
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <CardTitle className="text-lg">Approved Quotations</CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">Only quotations approved by admin are visible here</p>
                  </div>
                  <div className="relative w-full sm:w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by name, mobile, ID..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 h-10"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4 animate-pulse">
                      <FileText className="w-8 h-8 text-primary opacity-50" />
                    </div>
                    <p className="font-medium text-foreground">Loading approved quotations...</p>
                    <p className="text-sm mt-1">Fetching only approved quotations from admin panel</p>
                  </div>
                ) : sortedQuotations.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                      <FileText className="w-8 h-8 opacity-50" />
                    </div>
                    <p className="font-medium">No approved quotations</p>
                    <p className="text-sm mt-1">Only quotations approved by admin will appear here</p>
                    <p className="text-xs mt-2 text-muted-foreground/80">Waiting for admin approval...</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left py-3 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            Quotation ID
                          </th>
                          <th className="text-left py-3 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            Customer Information
                          </th>
                          <th className="text-left py-3 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden lg:table-cell">
                            Dealer/Admin
                          </th>
                          <th className="text-left py-3 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden sm:table-cell">
                            System
                          </th>
                          <th className="text-right py-3 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            Amount
                          </th>
                          <th className="text-left py-3 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            Status
                          </th>
                          <th className="text-right py-3 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">
                            Approved Date
                          </th>
                          <th className="text-right py-3 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            Action
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedQuotations.map((quotation) => (
                          <tr
                            key={quotation.id}
                            className="border-b border-border last:border-0 hover:bg-green-50 dark:hover:bg-green-950/20 transition-colors bg-green-50/50 dark:bg-green-950/10"
                          >
                            <td className="py-4 px-3 text-sm font-mono text-muted-foreground font-semibold">{quotation.id || "N/A"}</td>
                            <td className="py-4 px-3">
                              <div>
                                <p className="text-sm font-semibold text-foreground">
                                  {formatPersonName(quotation.customer?.firstName, quotation.customer?.lastName, "Unknown")}
                                </p>
                                <p className="text-xs text-muted-foreground mt-0.5">{quotation.customer?.mobile || "No mobile"}</p>
                                {quotation.customer?.email && (
                                  <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-xs">{quotation.customer.email}</p>
                                )}
                              </div>
                            </td>
                            <td className="py-4 px-3 text-sm hidden lg:table-cell">
                              {quotation.dealer ? (
                                <div>
                                  <p className="text-sm font-medium text-foreground">
                                    {formatPersonName(quotation.dealer.firstName, quotation.dealer.lastName, "Unknown")}
                                  </p>
                                  <Badge 
                                    variant="outline" 
                                    className={`text-xs mt-1 ${
                                      quotation.dealer.role === "admin" 
                                        ? "border-purple-500 text-purple-700 dark:text-purple-400" 
                                        : "border-blue-500 text-blue-700 dark:text-blue-400"
                                    }`}
                                  >
                                    {quotation.dealer.role === "admin" ? "Admin" : "Dealer"}
                                  </Badge>
                                  <p className="text-xs text-muted-foreground mt-1 truncate max-w-xs">
                                    {quotation.dealer.email}
                                  </p>
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">N/A</span>
                              )}
                            </td>
                            <td className="py-4 px-3 text-sm hidden sm:table-cell">
                              <span className="px-2.5 py-1 bg-primary/10 text-primary rounded-full text-xs font-medium uppercase">
                                {getSystemSize(quotation)}
                              </span>
                            </td>
                            <td className="py-4 px-3 text-sm text-right font-semibold text-foreground">
                              ₹{Math.abs(
                                quotation.pricing?.subtotal ??
                                  quotation.subtotal ??
                                  quotation.totalAmount ??
                                  quotation.finalAmount ??
                                  0,
                              ).toLocaleString()}
                            </td>
                            <td className="py-4 px-3 text-sm">
                              <Badge className="text-xs bg-green-600 text-white">
                                Approved
                              </Badge>
                            </td>
                            <td className="py-4 px-3 text-sm text-right text-muted-foreground hidden md:table-cell">
                              {new Date(quotation.createdAt).toLocaleDateString("en-IN")}
                            </td>
                            <td className="py-4 px-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => {
                                    setSelectedQuotation(quotation)
                                    setDialogOpen(true)
                                  }}
                                  className="h-8 w-8 p-0 flex items-center justify-center rounded-md hover:bg-muted transition-colors"
                                  title="View Details"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Payment Management Tab */}
          <TabsContent value="payments" className="space-y-4">
            <Card className="border-border/50 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">Payment Management</CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">
                      Installments, subsidy cheques (cash / cash + loan), and balances
                    </p>
                  </div>
                  <div className="relative w-full sm:w-64">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Search by customer name, mobile..."
                      value={paymentSearchTerm}
                      onChange={(e) => setPaymentSearchTerm(e.target.value)}
                      className="pl-8 h-9 text-sm"
                    />
                  </div>
                </div>
                <div className="mt-3 flex flex-col gap-1.5 lg:flex-row lg:items-center lg:justify-between">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 w-full lg:w-auto">
                    <div className="w-full sm:min-w-30">
                      <Select value={paymentTypeFilter} onValueChange={(value) => setPaymentTypeFilter(value as typeof paymentTypeFilter)}>
                        <SelectTrigger className="h-9 text-sm">
                          <SelectValue placeholder="Filter payment type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Payment Types</SelectItem>
                          <SelectItem value="loan">Loan</SelectItem>
                          <SelectItem value="cash">Cash</SelectItem>
                          <SelectItem value="mix">Cash + loan</SelectItem>
                          <SelectItem value="unknown">Not Set</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="w-full sm:min-w-36">
                      <Select value={paymentStatusFilter} onValueChange={(value) => setPaymentStatusFilter(value as typeof paymentStatusFilter)}>
                        <SelectTrigger className="h-9 text-sm">
                          <SelectValue placeholder="Filter payment status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Statuses</SelectItem>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="partial">Partial</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-2 w-full sm:w-auto"
                    onClick={downloadFilteredPaymentsExcel}
                  >
                    <Download className="w-4 h-4" />
                    Download Excel
                  </Button>
                </div>
                <div className="mt-3 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-medium text-muted-foreground">Date range filters</p>
                    {(approveDateRange?.from ||
                      approveDateRange?.to ||
                      fileLoginDateRange?.from ||
                      fileLoginDateRange?.to) && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => {
                          setApproveDateRange(undefined)
                          setFileLoginDateRange(undefined)
                        }}
                      >
                        Clear dates
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <PaymentDateRangeFilter
                      id="approve-date-range"
                      label="Approve date range"
                      value={approveDateRange}
                      onChange={setApproveDateRange}
                      placeholder="All approve dates"
                    />
                    <PaymentDateRangeFilter
                      id="file-login-date-range"
                      label="File login date range"
                      value={fileLoginDateRange}
                      onChange={setFileLoginDateRange}
                      placeholder="All file login dates"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-2 sm:px-6">
                {isLoading ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4 animate-pulse">
                      <Wallet className="w-8 h-8 text-primary opacity-50" />
                    </div>
                    <p className="font-medium text-foreground">Loading payment data...</p>
                  </div>
                ) : customerPayments.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                      <Wallet className="w-8 h-8 opacity-50" />
                    </div>
                    <p className="font-medium">No payment data available</p>
                    <p className="text-sm mt-1">Approved quotations will appear here for payment management</p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {filteredCustomerPayments.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground text-sm border border-dashed rounded-md">
                        No rows match current filters.
                      </div>
                    ) : (
                      filteredCustomerPayments.map((payment) => {
                        const paidAmount = getTotalPaidPhases(payment.phases)
                        const remainingAmount = getDisplayRemaining(payment)
                        const isCompletedPayment =
                          payment.paymentStatus === "completed" || remainingAmount <= 0

                        return (
                          <Card
                            key={payment.quotationId}
                            className={`shadow-sm px-3 py-3 ${
                              isCompletedPayment
                                ? "border-green-200 bg-green-50/80 dark:border-green-900 dark:bg-green-950/20"
                                : "border-border/60 bg-card/80"
                            }`}
                          >
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-12 gap-x-4 gap-y-3 items-start lg:items-center">
                              <div className="col-span-2 sm:col-span-3 lg:col-span-2 min-w-0">
                                <p className="text-sm font-semibold leading-tight">
                                  Customer: {payment.customerName}
                                </p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  Customer No: {payment.customerMobile || "N/A"}
                                </p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  Dealer: {payment.dealerName || "Unassigned"} • {payment.dealerMobile || "No contact"}
                                </p>
                              </div>

                              <div className="min-w-0">
                                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Subtotal</p>
                                <p className="text-sm font-semibold">₹{payment.subtotal.toLocaleString()}</p>
                              </div>

                              <div className="min-w-0">
                                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Paid</p>
                                <p className="text-sm font-semibold">₹{paidAmount.toLocaleString()}</p>
                              </div>

                              <div className="min-w-0">
                                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Remaining</p>
                                <p
                                  className={`text-sm font-semibold ${
                                    remainingAmount <= 0 ? "text-green-600" : "text-amber-600"
                                  }`}
                                >
                                  ₹{Math.max(remainingAmount, 0).toLocaleString()}
                                </p>
                              </div>

                              <div className="min-w-0">
                                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Approve date</p>
                                <p className="text-xs font-medium leading-snug">
                                  {formatAdminDate(payment.statusApprovedAt)}
                                </p>
                              </div>

                              <div className="min-w-0">
                                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">File login</p>
                                <p className="text-xs font-medium leading-snug">
                                  {formatAdminDate(payment.fileLoginAt)}
                                </p>
                                {payment.fileLoginStatus ? (
                                  <p className="text-[10px] text-muted-foreground mt-0.5">
                                    {fileLoginStatusLabel(payment.fileLoginStatus)}
                                  </p>
                                ) : null}
                              </div>

                              <div className="min-w-0">
                                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Payment Type</p>
                                <p className="text-sm font-semibold">
                                  {getPaymentTypeLabel(payment.paymentType || payment.paymentMode)}
                                </p>
                              </div>

                              <div className="min-w-0 col-span-2 sm:col-span-3 lg:col-span-2">
                                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Bank · IFSC</p>
                                <p className="text-sm font-medium break-words leading-snug">
                                  {getFinancingBankDisplay(payment)}
                                </p>
                              </div>

                              <div className="col-span-2 sm:col-span-3 lg:col-span-2 flex justify-end">
                                <div className="flex flex-wrap items-center justify-end gap-2">
                                  {payment.quotation.installationReadyForInstaller ? (
                                    <Badge
                                      variant="outline"
                                      className="text-[10px] border-emerald-500 text-emerald-700 whitespace-nowrap"
                                    >
                                      Sent to installer
                                    </Badge>
                                  ) : (
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      className="h-8 text-xs"
                                      onClick={() => void handleReleaseToInstaller(payment.quotation)}
                                      disabled={releasingInstallationId === payment.quotationId}
                                      title="Send this quotation to installer dashboard"
                                    >
                                      <Send className="w-3.5 h-3.5 mr-1" />
                                      {releasingInstallationId === payment.quotationId ? "Sending..." : "Send to Installer"}
                                    </Button>
                                  )}
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={async () => {
                                      if (useApi) {
                                        await loadApprovedQuotations()
                                      }
                                      setActivePaymentId(payment.quotationId)
                                      setInstallmentDialogOpen(true)
                                    }}
                                  >
                                    Manage
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </Card>
                        )
                      })
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Quotation Details Dialog */}
      <QuotationDetailsDialog
        quotation={selectedQuotation}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />

      {/* Installments Modal */}
      <Dialog
        open={installmentDialogOpen}
        onOpenChange={(open) => {
          setInstallmentDialogOpen(open)
          if (!open) {
            setActivePaymentId(null)
          }
        }}
      >
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Payment management</DialogTitle>
            <DialogDescription>
              Record installments and, for Cash or Cash + loan, subsidy cheques. When a cheque clears, apply it to
              installments so Remaining decreases. Submit saves to the server (or local storage when API is off).
            </DialogDescription>
          </DialogHeader>
          {activePayment && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-lg border border-border/60 bg-muted/20 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold">Customer: {activePayment.customerName}</p>
                  <p className="text-xs text-muted-foreground">
                    Customer No: {activePayment.customerMobile || "N/A"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Dealer: {activePayment.dealerName || "Unassigned"} • {activePayment.dealerMobile || "No contact"}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                    <span>
                      <span className="font-medium text-foreground/80">Approved: </span>
                      {formatAdminDate(activePayment.statusApprovedAt)}
                    </span>
                    <span>
                      <span className="font-medium text-foreground/80">File login: </span>
                      {formatAdminDate(activePayment.fileLoginAt)}
                      {activePayment.fileLoginStatus
                        ? ` · ${fileLoginStatusLabel(activePayment.fileLoginStatus)}`
                        : ""}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Subtotal</p>
                  <p className="text-base font-semibold">₹{activePayment.subtotal.toLocaleString()}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Remaining: ₹
                    {getDisplayRemaining(activePayment).toLocaleString("en-IN")}
                  </p>
                </div>
              </div>
              {["loan", "mix"].includes(getPaymentTypeValue(activePayment)) && (
                <div className="rounded-md border border-border/50 bg-muted/30 px-4 py-2 text-sm">
                  <span className="text-muted-foreground">Bank · IFSC </span>
                  <span className="font-medium break-words">{getFinancingBankDisplay(activePayment)}</span>
                </div>
              )}

              {["cash", "mix"].includes(getPaymentTypeValue(activePayment)) && (
                <div className="rounded-lg border border-amber-200/80 bg-amber-50/40 dark:bg-amber-950/20 px-4 py-3 space-y-3">
                  <div>
                    <p className="text-sm font-semibold text-amber-950 dark:text-amber-100">Subsidy cheques</p>
                    <p className="text-xs text-amber-900/80 dark:text-amber-200/80">
                      Example: subtotal ₹2,99,000 with loan ₹2,00,000 and subsidy by cheque ₹78,000 — record each
                      cheque here. When it clears, use &quot;Apply to paid&quot; so the amount is spread across
                      installments and Remaining drops. Then Submit to sync.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Cheque details</Label>
                      <Textarea
                        value={subsidyDraftDetails}
                        onChange={(e) => setSubsidyDraftDetails(e.target.value)}
                        placeholder="Cheque no., bank, date, customer note…"
                        rows={2}
                        className="mt-1 resize-y min-h-[52px]"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Amount (₹)</Label>
                      <Input
                        type="number"
                        min={0}
                        value={subsidyDraftAmount}
                        onChange={(e) => setSubsidyDraftAmount(e.target.value)}
                        placeholder="e.g. 78000"
                        className="mt-1"
                      />
                    </div>
                  </div>
                  <Button type="button" size="sm" variant="secondary" onClick={handleAddSubsidyCheque}>
                    Add pending cheque
                  </Button>
                  {(activePayment.subsidyCheques || []).length > 0 ? (
                    <ul className="space-y-2 border-t border-amber-200/60 pt-3">
                      {activePayment.subsidyCheques.map((sc) => (
                        <li
                          key={sc.id}
                          className="rounded-md border border-border/60 bg-background/90 px-3 py-2 text-sm"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-medium">₹{sc.amount.toLocaleString("en-IN")}</p>
                              <p className="text-xs text-muted-foreground whitespace-pre-wrap break-words">
                                {sc.details || "—"}
                              </p>
                              {sc.status === "cleared" && sc.clearedAt ? (
                                <p className="text-[10px] text-muted-foreground mt-1">
                                  Cleared {formatAdminDate(sc.clearedAt)}
                                </p>
                              ) : null}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <Badge variant={sc.status === "cleared" ? "default" : "outline"}>
                                {sc.status === "cleared" ? "Cleared" : "Pending"}
                              </Badge>
                              {sc.status === "pending" ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="default"
                                  onClick={() => handleMarkSubsidyChequeCleared(sc.id)}
                                >
                                  Apply to paid
                                </Button>
                              ) : null}
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-muted-foreground border-t border-amber-200/60 pt-2">
                      No subsidy cheques recorded yet.
                    </p>
                  )}
                </div>
              )}

              {activePayment.phases.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border/70 bg-muted/10 py-8">
                  <p className="text-sm text-muted-foreground">No installments created yet.</p>
                  <Button
                    type="button"
                    onClick={() => {
                                    const updated = customerPayments.map((p) =>
                        p.quotationId === activePayment.quotationId
                          ? { ...p, phases: buildInstallments(p.subtotal, 1) }
                                        : p
                                    )
                                    setCustomerPayments(updated)
                    }}
                  >
                    Create Installment
                  </Button>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">Installments</p>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const updated = customerPayments.map((p) =>
                            p.quotationId === activePayment.quotationId
                              ? { ...p, phases: buildInstallments(p.subtotal, p.phases.length + 1, p.phases) }
                              : p
                          )
                          setCustomerPayments(updated)
                        }}
                      >
                        Add
                      </Button>
                    </div>
                              </div>
                              
                  <div className="space-y-3">
                    {activePayment.phases.map((phase) => {
                                  const isCompleted = phase.status === "completed"
                                  const isPartial = phase.status === "partial"
                                  const isPending = phase.status === "pending"
                      const paidBefore = activePayment.phases
                        .filter((p) => p.phaseNumber < phase.phaseNumber)
                        .reduce((sum, p) => sum + p.paidAmount, 0)
                      const remainingBefore = Math.max(activePayment.subtotal - paidBefore, 0)
                                  
                                  return (
                                    <div
                                      key={phase.phaseNumber}
                          className={`rounded-lg border px-4 py-3 ${
                                        isCompleted
                                          ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800"
                                          : isPartial
                                          ? "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800"
                                          : "bg-gray-50 dark:bg-gray-950/20 border-border"
                                      }`}
                                    >
                                      <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                          <div
                                            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                                              isCompleted
                                                ? "bg-green-500 text-white"
                                                : isPartial
                                                ? "bg-amber-500 text-white"
                                                : "bg-gray-300 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                                            }`}
                                          >
                                            {phase.phaseNumber}
                                          </div>
                                          <div>
                                            <p className="text-sm font-semibold">{phase.phaseName}</p>
                                            <p className="text-xs text-muted-foreground">
                                  Remaining before this installment: ₹{remainingBefore.toLocaleString()}
                                            </p>
                                          </div>
                                        </div>
                                        <Badge
                                          className={
                                            isCompleted
                                              ? "bg-green-600 text-white"
                                              : isPartial
                                              ? "bg-amber-600 text-white"
                                              : "bg-gray-500 text-white"
                                          }
                                        >
                                          {isCompleted ? (
                                <>
                                  <CheckCircle2 className="w-3 h-3 mr-1" /> Completed
                                </>
                                          ) : isPartial ? (
                                <>
                                  <Clock className="w-3 h-3 mr-1" /> Partial
                                </>
                                          ) : (
                                <>
                                  <AlertCircle className="w-3 h-3 mr-1" /> Pending
                                </>
                                          )}
                                        </Badge>
                                      </div>
                                      
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                          <Label className="text-xs text-muted-foreground">Paid Amount</Label>
                                          <Input
                                            type="number"
                                            value={phase.paidAmount}
                                            onChange={(e) => {
                                              const paid = Number.parseFloat(e.target.value) || 0
                                              const updated = customerPayments.map((p) =>
                                                p.quotationId === activePayment.quotationId
                                                  ? {
                                                      ...p,
                                                      phases: coercePhasesPaymentModes(
                                                        p.phases.map((ph) =>
                                                          ph.phaseNumber === phase.phaseNumber
                                                            ? (() => {
                                                                const nextStatus: PaymentPhase["status"] =
                                                                  paid >= ph.amount
                                                                    ? "completed"
                                                                    : paid > 0
                                                                      ? "partial"
                                                                      : "pending"
                                                                return {
                                                                  ...ph,
                                                                  paidAmount: paid,
                                                                  status: nextStatus,
                                                                  paymentDate:
                                                                    paid > 0 ? new Date().toISOString() : undefined,
                                                                }
                                                              })()
                                                            : ph,
                                                        ),
                                                      ),
                                                    }
                                                  : p,
                                              )
                                              setCustomerPayments(updated)
                                            }}
                                            className="mt-1"
                                            placeholder="0"
                                          />
                                        </div>
                                        <div>
                                          <Label className="text-xs text-muted-foreground">Due Date</Label>
                                          <Input
                                            type="date"
                                            value={phase.dueDate ? new Date(phase.dueDate).toISOString().split("T")[0] : ""}
                                            onChange={(e) => {
                                              const updated = customerPayments.map((p) =>
                                    p.quotationId === activePayment.quotationId
                                                  ? {
                                                      ...p,
                                                      phases: p.phases.map((ph) =>
                                                        ph.phaseNumber === phase.phaseNumber
                                                          ? { ...ph, dueDate: e.target.value }
                                                          : ph
                                                      ),
                                                    }
                                                  : p
                                              )
                                              setCustomerPayments(updated)
                                            }}
                                            className="mt-1"
                                          />
                                        </div>
                                      </div>
                                      
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                            <div>
                              <Label className="text-xs text-muted-foreground">Payment Mode</Label>
                              <Select
                                value={phase.paymentMode || ""}
                                onValueChange={(value) => {
                                  const updated = customerPayments.map((p) =>
                                    p.quotationId === activePayment.quotationId
                                      ? {
                                          ...p,
                                          phases: p.phases.map((ph) =>
                                            ph.phaseNumber === phase.phaseNumber ? { ...ph, paymentMode: value } : ph
                                          ),
                                        }
                                      : p
                                  )
                                  setCustomerPayments(updated)
                                }}
                              >
                                <SelectTrigger className="mt-1">
                                  <SelectValue placeholder="Select payment mode" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="cash">Cash</SelectItem>
                                  <SelectItem value="upi">UPI</SelectItem>
                                  <SelectItem value="loan">Loan</SelectItem>
                                  <SelectItem value="cheque">Cheque</SelectItem>
                                </SelectContent>
                              </Select>
                                        </div>
                            <div>
                              <Label className="text-xs text-muted-foreground">Transaction ID</Label>
                              <Input
                                value={phase.transactionId || ""}
                                onChange={(e) => {
                                  const updated = customerPayments.map((p) =>
                                    p.quotationId === activePayment.quotationId
                                      ? {
                                          ...p,
                                          phases: p.phases.map((ph) =>
                                            ph.phaseNumber === phase.phaseNumber
                                              ? { ...ph, transactionId: e.target.value }
                                              : ph
                                          ),
                                        }
                                      : p
                                  )
                                  setCustomerPayments(updated)
                                }}
                                className="mt-1"
                                placeholder="Optional"
                              />
                            </div>
                          </div>

                          <div className="mt-3">
                            <Label className="text-xs text-muted-foreground">Notes</Label>
                            <Textarea
                              value={phase.note || ""}
                              onChange={(e) => {
                                const updated = customerPayments.map((p) =>
                                  p.quotationId === activePayment.quotationId
                                    ? {
                                        ...p,
                                        phases: p.phases.map((ph) =>
                                          ph.phaseNumber === phase.phaseNumber ? { ...ph, note: e.target.value } : ph,
                                        ),
                                      }
                                    : p,
                                )
                                setCustomerPayments(updated)
                              }}
                              className="mt-1 resize-y min-h-[64px]"
                              rows={2}
                              placeholder="Installment notes (optional)"
                            />
                          </div>
                              
                          <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-3">
                            <p className="text-xs text-muted-foreground">
                              Remaining after this installment: ₹{Math.max(remainingBefore - phase.paidAmount, 0).toLocaleString()}
                            </p>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                const updated = customerPayments.map((p) =>
                                  p.quotationId === activePayment.quotationId
                                    ? {
                                        ...p,
                                        phases: buildInstallments(
                                          p.subtotal,
                                          p.phases.length - 1,
                                          p.phases.filter((ph) => ph.phaseNumber !== phase.phaseNumber)
                                        ),
                                      }
                                    : p
                                )
                                setCustomerPayments(updated)
                              }}
                              disabled={activePayment.phases.length <= 1}
                              className="text-destructive"
                            >
                              Remove installment
                            </Button>
                                  </div>
                                  </div>
                      )
                    })}
                                </div>
                </>
              )}
              <div className="flex items-center justify-end gap-2 border-t border-border/60 pt-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setInstallmentDialogOpen(false)
                    setActivePaymentId(null)
                  }}
                  disabled={isSavingInstallments}
                >
                  Cancel
                </Button>
                <Button type="button" onClick={submitInstallments} disabled={isSavingInstallments}>
                  {isSavingInstallments ? "Submitting..." : "Submit"}
                </Button>
              </div>
                  </div>
                )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
