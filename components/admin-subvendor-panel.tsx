"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { downloadCsvFile } from "@/lib/excel-column-export"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Search, Plus, Pencil, Trash2, Building2, UserPlus, Truck, Check, ChevronsUpDown, Download, Landmark, Loader2, Upload, FileText, X } from "lucide-react"
import type { Quotation } from "@/lib/quotation-context"
import { keepCurrentQuotationsOnly } from "@/lib/quotation-current"
import { summarizeQuotationPayment } from "@/lib/dealer-payment-summary"
import { getQuotationSystemKw } from "@/lib/quotation-system-kw"
import { api, ApiError, apiErrorToUserMessage } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import {
  createAdminSubvendor,
  dealerDisplayName,
  deleteAdminSubvendor,
  formatFileCostPerKwInput,
  formatProfitRatioInput,
  formatProfitRatioLabel,
  parseFileCostPerKw,
  parseInrAmount,
  parseProfitRatio,
  vendorProfitShare,
  fileChargesFromVendorRate,
  formatInrAmountInput,
  pickSubvendorListFromApi,
  pickSubvendorRecordFromApi,
  readAdminSubvendors,
  readLeaserPayments,
  writeLeaserPayments,
  pickLeaserPaymentList,
  leaserPaymentsToApiBody,
  newLeaserPaymentId,
  LEASER_PAYMENT_TYPES,
  readVendorBills,
  writeVendorBills,
  pickVendorBillList,
  vendorBillsToApiBody,
  newVendorBillId,
  vendorBillSum,
  type SubvendorVendorBill,
  snapshotFromDealer,
  subvendorToApiBody,
  updateAdminSubvendor,
  writeAdminSubvendors,
  type AdminSubvendorRecord,
  type SubvendorDealerOption,
  type SubvendorKind,
  type SubvendorLeaserPayment,
} from "@/lib/admin-subvendors"
import { cn } from "@/lib/utils"
import {
  customerFromOfficeOutsideRecord,
  fetchOfficeOutsideVendorOutsideRecordsFromApi,
  isOfficeOutsideOnAccounts,
  officeOutsideFileTypeLabel,
  officeOutsideLoanCashAmounts,
  officeOutsideSubtotalAmount,
  quotationFromOfficeOutsideRecord,
  sendOfficeOutsideToAccountsFromVendorApi,
  type OfficeOutsideRecord,
} from "@/lib/office-outside-accounts"
import { formatPersonName } from "@/lib/name-display"
import {
  getLedgerAmounts,
  isApprovedQuotation,
  LEDGER_FIELD_LABELS,
  OFFICE_INSIDE_AMOUNT_FIELDS,
  amountsFromLedgerDrafts,
  applyOfficeInsideGstToAmounts,
  applyOfficeInsideGstToDrafts,
  draftsFromLedgerAmounts,
  ledgerPatchToApiBody,
  officeInsideGstCharges,
  officeInsideDeductedTotal,
  officeInsideProfitFromAmounts,
  officeOutsideLeaserCharges,
  officeOutsideLeaserGst,
  officeOutsideLeaserProfit,
  parseLedgerAmountInput,
  paymentTypeLabelForLedger,
  pickLedgerMapFromApi,
  quotationLoanCashAmountsForLedger,
  quotationPaymentTypeForLedger,
  readSubvendorLedger,
  upsertLedgerAmounts,
  writeSubvendorLedger,
  type LedgerAmountField,
  type LedgerPaymentType,
  type SubvendorLedgerAmounts,
} from "@/lib/admin-subvendor-ledger"

function formatLedgerInr(amount: number) {
  return `₹${Math.round(amount || 0).toLocaleString("en-IN")}`
}

function formatLedgerSystemSize(kw: number) {
  if (!Number.isFinite(kw) || kw <= 0) return "—"
  const rounded = Math.round(kw * 100) / 100
  const label =
    Math.abs(rounded - Math.round(rounded)) < 1e-9
      ? String(Math.round(rounded))
      : String(rounded).replace(/\.?0+$/, "")
  return `${label}kW`
}

function slugForFilename(name: string) {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^\w]+/g, "-")
      .replace(/^-+|-+$/g, "") || "dealer"
  )
}

function downloadCsvTable(
  filename: string,
  table: Array<Array<string | number | boolean | null | undefined>>,
) {
  if (!table.length) return
  downloadCsvFile({
    filename,
    headers: table[0].map((cell) => (cell == null ? "" : String(cell))),
    rows: table.slice(1),
  })
}

type InsideLedgerRow = {
  quotationId: string
  dealerId: string
  customerName: string
  customerMobile: string
  vendorName: string
  vendorMobile: string
  systemSize: string
  systemKw: number
  paymentType: LedgerPaymentType
  paymentTypeLabel: string
  subtotal: number
  loanAmount: number
  cashAmount: number
  receivedAmount: number
  remaining: number
  proposal: number
  costOfSite: number
  profitVendor: number
  fileCharges: number
  pi: number
  gstCharges: number
  others: number
}

function officeOutsideToLedgerRow(
  row: OfficeOutsideRecord,
  vendor: AdminSubvendorRecord,
  ledgerMap: Record<string, SubvendorLedgerAmounts>,
): InsideLedgerRow {
  const stored = getLedgerAmounts(ledgerMap, row.id)
  const subtotal = officeOutsideSubtotalAmount(row)
  const quotation = quotationFromOfficeOutsideRecord(row)
  const customer = customerFromOfficeOutsideRecord(row)
  const proposal = stored.proposal && stored.proposal > 0 ? stored.proposal : subtotal
  const pi = stored.pi ?? 0
  const autoFileCharges = fileChargesFromVendorRate(
    getQuotationSystemKw(quotation),
    vendor.fileCostPerKw ?? 0,
  )
  const fileCharges =
    stored.fileCharges != null && stored.fileCharges > 0 ? stored.fileCharges : autoFileCharges
  const gstCharges = officeInsideGstCharges(proposal, pi)
  const others = stored.others ?? 0
  const vendorAmounts = { proposal, pi, fileCharges, gstCharges, others }
  const receivedAmount = stored.receivedAmount ?? 0
  const paymentType = (row.fileType === "loan" || row.fileType === "mix" || row.fileType === "cash"
    ? row.fileType
    : "cash") as LedgerPaymentType
  const loanCash = officeOutsideLoanCashAmounts(row, stored)
  return {
    quotationId: row.id,
    dealerId: row.outsideVendorId,
    customerName:
      row.customerName ||
      formatPersonName(customer?.firstName, customer?.lastName, "Unknown"),
    customerMobile: row.mobile || customer?.mobile || "",
    vendorName: vendor.name,
    vendorMobile: vendor.mobile,
    systemSize: formatLedgerSystemSize(getQuotationSystemKw(quotation)),
    systemKw: getQuotationSystemKw(quotation),
    paymentType,
    paymentTypeLabel: paymentTypeLabelForLedger(paymentType),
    subtotal,
    loanAmount: loanCash.loanAmount,
    cashAmount: loanCash.cashAmount,
    receivedAmount,
    remaining: stored.remaining ?? Math.max(0, subtotal - receivedAmount),
    proposal,
    costOfSite: officeInsideDeductedTotal(vendorAmounts),
    profitVendor: officeInsideProfitFromAmounts(subtotal, vendorAmounts),
    fileCharges,
    pi,
    gstCharges,
    others,
  }
}

function officeInsideProfitShare(
  subtotal: number,
  amounts: Parameters<typeof officeInsideProfitFromAmounts>[1],
  profitRatio: number,
) {
  return vendorProfitShare(officeInsideProfitFromAmounts(subtotal, amounts), profitRatio)
}

function ledgerStatus(row: Pick<InsideLedgerRow, "receivedAmount" | "remaining">) {
  if (row.remaining <= 0) return { label: "Completed", tone: "completed" as const }
  if (row.receivedAmount > 0) return { label: "Partial", tone: "partial" as const }
  return { label: "Pending", tone: "pending" as const }
}

const emptyForm = {
  dealerId: "",
  name: "",
  contactName: "",
  mobile: "",
  email: "",
  city: "",
  category: "Other",
  notes: "",
  profitRatio: "",
  fileCostPerKw: "1000",
  leaserPaid: "",
  leaserRemaining: "",
}

function matchesSearch(row: AdminSubvendorRecord, q: string) {
  if (!q) return true
  return [row.name, row.contactName, row.mobile, row.email, row.city, row.category, row.dealerId]
    .join(" ")
    .toLowerCase()
    .includes(q)
}

export function AdminSubvendorPanel({
  dealers = [],
  quotations = [],
  lockKind,
  embedded = false,
  search: searchProp,
  onSearchChange,
  hideSearch = false,
  onOfficeOutsideSentToAccounts,
}: {
  dealers?: SubvendorDealerOption[]
  quotations?: Quotation[]
  lockKind?: SubvendorKind
  embedded?: boolean
  search?: string
  onSearchChange?: (value: string) => void
  hideSearch?: boolean
  onOfficeOutsideSentToAccounts?: (row: OfficeOutsideRecord) => void
}) {
  const { toast } = useToast()
  const useApi = process.env.NEXT_PUBLIC_USE_API !== "false"
  const [rows, setRows] = useState<AdminSubvendorRecord[]>(() => readAdminSubvendors())
  const [kindState, setKind] = useState<SubvendorKind>(lockKind ?? "office_inside")
  const kind = lockKind ?? kindState
  const [internalSearch, setInternalSearch] = useState("")
  const search = searchProp ?? internalSearch
  const setSearch = (value: string) => {
    if (onSearchChange) onSearchChange(value)
    else setInternalSearch(value)
  }
  const [ledgerSearch, setLedgerSearch] = useState("")
  const [ledgerVendorId, setLedgerVendorId] = useState("all")
  const [ledgerMap, setLedgerMap] = useState<Record<string, SubvendorLedgerAmounts>>(() =>
    readSubvendorLedger(),
  )
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [savingVendor, setSavingVendor] = useState(false)
  const [leaserPayments, setLeaserPayments] = useState<SubvendorLeaserPayment[]>(() => readLeaserPayments())
  const [vendorBills, setVendorBills] = useState<SubvendorVendorBill[]>(() => readVendorBills())
  const [outsideRecords, setOutsideRecords] = useState<OfficeOutsideRecord[]>([])
  const [sendingToAccountsId, setSendingToAccountsId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const loadRemote = async () => {
      if (!useApi) {
        setOutsideRecords([])
        return
      }
      try {
        const [vendorsRes, ledgerRes, leaserRes, billsRes, remoteOutside, outsideLedgerRes] = await Promise.all([
          api.admin.subvendors.getAll(),
          api.admin.subvendors.ledger.getAll(),
          api.admin.subvendors.leaser.getAll().catch(() => null),
          api.admin.subvendors.bills.getAll().catch(() => null),
          fetchOfficeOutsideVendorOutsideRecordsFromApi().catch(() => [] as OfficeOutsideRecord[]),
          api.admin.officeOutside.ledger.getAll().catch(() => null),
        ])
        if (cancelled) return
        const vendors = pickSubvendorListFromApi(vendorsRes)
        writeAdminSubvendors(vendors)
        setRows(vendors)
        const insideLedger = pickLedgerMapFromApi(ledgerRes)
        const outsideLedger = outsideLedgerRes ? pickLedgerMapFromApi(outsideLedgerRes) : {}
        const mergedLedger = { ...readSubvendorLedger(), ...insideLedger, ...outsideLedger }
        writeSubvendorLedger(mergedLedger)
        setLedgerMap(mergedLedger)
        if (leaserRes) {
          const payments = pickLeaserPaymentList(leaserRes)
          writeLeaserPayments(payments)
          setLeaserPayments(payments)
        }
        if (billsRes) {
          const bills = pickVendorBillList(billsRes)
          writeVendorBills(bills)
          setVendorBills(bills)
        }
        setOutsideRecords(remoteOutside)
      } catch {
        if (!cancelled) setOutsideRecords([])
      }
    }
    void loadRemote()
    return () => {
      cancelled = true
    }
  }, [useApi])

  const dealersById = useMemo(() => new Map(dealers.map((d) => [d.id, d])), [dealers])

  const displayRows = useMemo(
    () =>
      rows.map((row) => {
        if (row.kind !== "office_inside" || !row.dealerId) return row
        const dealer = dealersById.get(row.dealerId)
        if (!dealer) return row
        return { ...row, ...snapshotFromDealer(dealer) }
      }),
    [dealersById, rows],
  )

  const insideRows = useMemo(
    () => displayRows.filter((row) => row.kind === "office_inside"),
    [displayRows],
  )
  const outsideRows = useMemo(
    () => displayRows.filter((row) => row.kind === "office_outside"),
    [displayRows],
  )
  const visibleRows = kind === "office_inside" ? insideRows : outsideRows
  const filtered = useMemo(
    () => visibleRows.filter((row) => matchesSearch(row, search.trim().toLowerCase())),
    [search, visibleRows],
  )

  const insideDealerIds = useMemo(
    () => new Set(insideRows.map((row) => row.dealerId).filter(Boolean)),
    [insideRows],
  )
  const vendorsByDealerId = useMemo(
    () => new Map(insideRows.map((row) => [row.dealerId, row])),
    [insideRows],
  )

  const vendorProfitById = useMemo(() => {
    const approved = quotations.filter(isApprovedQuotation)
    const current = keepCurrentQuotationsOnly(approved, approved)
    const out: Record<string, number> = {}
    for (const quotation of current) {
      const dealerId = String(quotation.dealerId || quotation.dealer?.id || "")
      const vendor = vendorsByDealerId.get(dealerId)
      if (!vendor) continue
      const stored = getLedgerAmounts(ledgerMap, quotation.id)
      const payment = summarizeQuotationPayment(quotation)
      const proposal = stored.proposal ?? 0
      const pi = stored.pi ?? 0
      const autoFileCharges = fileChargesFromVendorRate(
        getQuotationSystemKw(quotation),
        vendor.fileCostPerKw ?? 0,
      )
      const fileCharges =
        stored.fileCharges != null && stored.fileCharges > 0 ? stored.fileCharges : autoFileCharges
      const vendorAmounts = {
        proposal,
        pi,
        fileCharges,
        gstCharges: officeInsideGstCharges(proposal, pi),
        others: stored.others ?? 0,
      }
      out[vendor.id] =
        (out[vendor.id] || 0) + officeInsideProfitShare(payment.subtotal, vendorAmounts, vendor.profitRatio)
    }
    for (const record of outsideRecords) {
      const vendor = outsideRows.find((row) => row.id === record.outsideVendorId)
      if (!vendor) continue
      const ledgerRow = officeOutsideToLedgerRow(record, vendor, ledgerMap)
      out[vendor.id] = (out[vendor.id] || 0) + ledgerRow.profitVendor
    }
    return out
  }, [ledgerMap, outsideRecords, outsideRows, quotations, vendorsByDealerId])

  const ledgerRows = useMemo(() => {
    const approved = quotations.filter(isApprovedQuotation)
    const current = keepCurrentQuotationsOnly(approved, approved)
    const q = ledgerSearch.trim().toLowerCase()
    return current
      .filter((quotation) => {
        const dealerId = String(quotation.dealerId || quotation.dealer?.id || "")
        if (!insideDealerIds.has(dealerId)) return false
        if (ledgerVendorId !== "all" && dealerId !== ledgerVendorId) return false
        const vendor = vendorsByDealerId.get(dealerId)
        const payment = summarizeQuotationPayment(quotation)
        const paymentType = quotationPaymentTypeForLedger(quotation)
        if (!q) return true
        return [
          payment.customerName,
          payment.customerMobile,
          vendor?.name,
          vendor?.mobile,
          quotation.dealer?.firstName,
          quotation.dealer?.lastName,
          paymentTypeLabelForLedger(paymentType),
          formatLedgerSystemSize(getQuotationSystemKw(quotation)),
        ]
          .join(" ")
          .toLowerCase()
          .includes(q)
      })
      .map((quotation) => {
        const dealerId = String(quotation.dealerId || quotation.dealer?.id || "")
        const vendor = vendorsByDealerId.get(dealerId)
        const payment = summarizeQuotationPayment(quotation)
        const stored = getLedgerAmounts(ledgerMap, quotation.id)
        const proposal = stored.proposal ?? 0
        const pi = stored.pi ?? 0
        const paymentType = quotationPaymentTypeForLedger(quotation)
        const loanCash = quotationLoanCashAmountsForLedger(
          quotation,
          proposal > 0 ? proposal : payment.subtotal,
        )
        const autoFileCharges = fileChargesFromVendorRate(
          getQuotationSystemKw(quotation),
          vendor?.fileCostPerKw ?? 0,
        )
        const fileCharges =
          stored.fileCharges != null && stored.fileCharges > 0 ? stored.fileCharges : autoFileCharges
        return {
          quotationId: quotation.id,
          dealerId,
          customerName: payment.customerName,
          customerMobile: payment.customerMobile,
          vendorName:
            vendor?.name ||
            dealerDisplayName({
              id: dealerId,
              username: quotation.dealer?.username || "",
              firstName: quotation.dealer?.firstName || "",
              lastName: quotation.dealer?.lastName || "",
              mobile: quotation.dealer?.mobile || "",
              email: quotation.dealer?.email || "",
            }),
          vendorMobile: vendor?.mobile || quotation.dealer?.mobile || "",
          systemSize: formatLedgerSystemSize(getQuotationSystemKw(quotation)),
          systemKw: getQuotationSystemKw(quotation),
          paymentType,
          paymentTypeLabel: paymentTypeLabelForLedger(paymentType),
          subtotal: payment.subtotal,
          loanAmount: stored.loanAmount ?? loanCash.loanAmount,
          cashAmount: stored.cashAmount ?? loanCash.cashAmount,
          receivedAmount: stored.receivedAmount ?? payment.paidAmount,
          remaining: stored.remaining ?? payment.remainingAmount,
          proposal,
          costOfSite: officeInsideDeductedTotal({
            proposal,
            pi,
            fileCharges,
            gstCharges: officeInsideGstCharges(proposal, pi),
            others: stored.others ?? 0,
          }),
          profitVendor: officeInsideProfitShare(
            payment.subtotal,
            {
              proposal,
              pi,
              fileCharges,
              gstCharges: officeInsideGstCharges(proposal, pi),
              others: stored.others ?? 0,
            },
            vendor?.profitRatio ?? 0,
          ),
          fileCharges,
          pi,
          gstCharges: officeInsideGstCharges(proposal, pi),
          others: stored.others ?? 0,
        }
      })
      .sort((a, b) => a.customerName.localeCompare(b.customerName))
  }, [insideDealerIds, ledgerMap, ledgerSearch, ledgerVendorId, quotations, vendorsByDealerId])

  const ledgerTotals = useMemo(
    () =>
      ledgerRows.reduce(
        (sum, row) => ({
          loanAmount: sum.loanAmount + row.loanAmount,
          cashAmount: sum.cashAmount + row.cashAmount,
          receivedAmount: sum.receivedAmount + row.receivedAmount,
          remaining: sum.remaining + row.remaining,
          proposal: sum.proposal + row.proposal,
          costOfSite: sum.costOfSite + row.costOfSite,
          profitVendor: sum.profitVendor + row.profitVendor,
          fileCharges: sum.fileCharges + row.fileCharges,
          pi: sum.pi + row.pi,
          gstCharges: sum.gstCharges + row.gstCharges,
          others: sum.others + row.others,
        }),
        {
          loanAmount: 0,
          cashAmount: 0,
          receivedAmount: 0,
          remaining: 0,
          proposal: 0,
          costOfSite: 0,
          profitVendor: 0,
          fileCharges: 0,
          pi: 0,
          gstCharges: 0,
          others: 0,
        },
      ),
    [ledgerRows],
  )

  const vendorLeaserStats = useMemo(() => {
    const paidByVendor: Record<string, number> = {}
    for (const payment of leaserPayments) {
      paidByVendor[payment.vendorId] = (paidByVendor[payment.vendorId] || 0) + payment.amount
    }
    const stats: Record<string, VendorLeaserStats> = {}
    for (const vendor of insideRows) {
      stats[vendor.id] = {
        totalFile: 0,
        fileAmount: 0,
        totalKw: 0,
        subtotal: 0,
        totalAmount: 0,
        loanAmount: 0,
        cashAmount: 0,
        billSum: 0,
        charges: 0,
        gstAmount: 0,
        costOfSite: 0,
        profitVendor: 0,
        paid: paidByVendor[vendor.id] ?? 0,
        currentBalance: 0,
        totalRemaining: 0,
      }
    }
    const approved = quotations.filter(isApprovedQuotation)
    const current = keepCurrentQuotationsOnly(approved, approved)
    for (const quotation of current) {
      const dealerId = String(quotation.dealerId || quotation.dealer?.id || "")
      const vendor = vendorsByDealerId.get(dealerId)
      if (!vendor || !stats[vendor.id]) continue
      const stored = getLedgerAmounts(ledgerMap, quotation.id)
      const payment = summarizeQuotationPayment(quotation)
      const autoFileCharges = fileChargesFromVendorRate(
        getQuotationSystemKw(quotation),
        vendor.fileCostPerKw ?? 0,
      )
      const fileCharges =
        stored.fileCharges != null && stored.fileCharges > 0 ? stored.fileCharges : autoFileCharges
      const proposal = stored.proposal ?? 0
      const pi = stored.pi ?? 0
      const vendorAmounts = {
        proposal,
        pi,
        fileCharges,
        gstCharges: officeInsideGstCharges(proposal, pi),
        others: stored.others ?? 0,
      }
      const costOfSite = officeInsideDeductedTotal(vendorAmounts)
      stats[vendor.id].totalFile += 1
      stats[vendor.id].fileAmount += fileCharges
      stats[vendor.id].totalKw += getQuotationSystemKw(quotation) || 0
      stats[vendor.id].subtotal += Math.max(0, Math.round(payment.subtotal || 0))
      stats[vendor.id].costOfSite += costOfSite
      stats[vendor.id].profitVendor += officeInsideProfitShare(
        payment.subtotal,
        vendorAmounts,
        vendor.profitRatio,
      )
    }
    for (const vendor of insideRows) {
      const item = stats[vendor.id]
      item.currentBalance = item.paid
      item.totalRemaining = Math.round(item.profitVendor - item.paid)
    }
    for (const vendor of outsideRows) {
      stats[vendor.id] = {
        totalFile: 0,
        fileAmount: 0,
        totalKw: 0,
        subtotal: 0,
        totalAmount: 0,
        loanAmount: 0,
        cashAmount: 0,
        billSum: 0,
        charges: 0,
        gstAmount: 0,
        costOfSite: 0,
        profitVendor: 0,
        paid: paidByVendor[vendor.id] ?? 0,
        currentBalance: 0,
        totalRemaining: 0,
      }
    }
    for (const record of outsideRecords) {
      const vendor = outsideRows.find((row) => row.id === record.outsideVendorId)
      if (!vendor || !stats[vendor.id]) continue
      const ledgerRow = officeOutsideToLedgerRow(record, vendor, ledgerMap)
      const totalAmount = ledgerRow.loanAmount + ledgerRow.cashAmount
      const charges = officeOutsideLeaserCharges(ledgerRow.fileCharges, ledgerRow.others)
      stats[vendor.id].totalFile += 1
      stats[vendor.id].fileAmount += ledgerRow.fileCharges
      stats[vendor.id].totalKw += ledgerRow.systemKw || 0
      stats[vendor.id].subtotal += ledgerRow.subtotal
      stats[vendor.id].totalAmount += totalAmount
      stats[vendor.id].loanAmount += ledgerRow.loanAmount
      stats[vendor.id].cashAmount += ledgerRow.cashAmount
      stats[vendor.id].charges += charges
      stats[vendor.id].costOfSite += ledgerRow.costOfSite
    }
    for (const vendor of outsideRows) {
      const item = stats[vendor.id]
      item.billSum = vendorBillSum(vendorBills, vendor.id)
      item.gstAmount = officeOutsideLeaserGst(item.subtotal, item.billSum)
      item.profitVendor = officeOutsideLeaserProfit({
        loanAmount: item.loanAmount,
        totalAmount: item.totalAmount,
        billAmount: item.billSum,
        charges: item.charges,
        gst: item.gstAmount,
      })
      item.currentBalance = item.paid
      item.totalRemaining = Math.round(item.profitVendor - item.paid)
    }
    return stats
  }, [insideRows, ledgerMap, leaserPayments, outsideRecords, outsideRows, quotations, vendorBills, vendorsByDealerId])

  const customersByVendorId = useMemo(() => {
    const out: Record<string, { quotationId: string; name: string; mobile: string; kw: string }[]> = {}
    for (const quotation of quotations) {
      const dealerId = String(quotation.dealerId || quotation.dealer?.id || "")
      const vendor = vendorsByDealerId.get(dealerId)
      if (!vendor) continue
      const payment = summarizeQuotationPayment(quotation)
      const name = String(payment.customerName || "").trim()
      if (!name || name === "—" || name.toLowerCase() === "unknown") continue
      const mobile = String(payment.customerMobile || "").trim()
      const list = (out[vendor.id] ||= [])
      const duplicate = list.find((row) => {
        if (row.quotationId === quotation.id) return true
        const rowMobile = String(row.mobile || "").trim()
        if (mobile && rowMobile && mobile !== "—" && rowMobile === mobile) return true
        return false
      })
      if (duplicate) continue
      list.push({
        quotationId: quotation.id,
        name,
        mobile: mobile === "—" ? "" : mobile,
        kw: formatLedgerSystemSize(getQuotationSystemKw(quotation)),
      })
    }
    for (const record of outsideRecords) {
      const assigned = outsideRows.find((row) => row.id === record.outsideVendorId)
      const targets = assigned ? [assigned] : outsideRows
      for (const vendor of targets) {
        const ledgerRow = officeOutsideToLedgerRow(record, vendor, ledgerMap)
        const name = String(ledgerRow.customerName || "").trim()
        if (!name || name === "—" || name.toLowerCase() === "unknown") continue
        const mobile = String(ledgerRow.customerMobile || "").trim()
        const list = (out[vendor.id] ||= [])
        const duplicate = list.find((item) => {
          if (item.quotationId === record.id) return true
          const rowMobile = String(item.mobile || "").trim()
          if (mobile && rowMobile && mobile !== "—" && rowMobile === mobile) return true
          return false
        })
        if (duplicate) continue
        list.push({
          quotationId: record.id,
          name,
          mobile: mobile === "—" ? "" : mobile,
          kw: ledgerRow.systemSize,
        })
      }
    }
    for (const vendorId of Object.keys(out)) {
      out[vendorId].sort((a, b) => a.name.localeCompare(b.name, "en-IN"))
    }
    return out
  }, [ledgerMap, outsideRecords, outsideRows, quotations, vendorsByDealerId])

  const filesByVendorId = useMemo(() => {
    const out: Record<string, InsideLedgerRow[]> = {}
    const approved = quotations.filter(isApprovedQuotation)
    const current = keepCurrentQuotationsOnly(approved, approved)
    for (const quotation of current) {
      const dealerId = String(quotation.dealerId || quotation.dealer?.id || "")
      const vendor = vendorsByDealerId.get(dealerId)
      if (!vendor) continue
      const payment = summarizeQuotationPayment(quotation)
      const stored = getLedgerAmounts(ledgerMap, quotation.id)
      const proposal = stored.proposal ?? 0
      const pi = stored.pi ?? 0
      const paymentType = quotationPaymentTypeForLedger(quotation)
      const loanCash = quotationLoanCashAmountsForLedger(
        quotation,
        proposal > 0 ? proposal : payment.subtotal,
      )
      const autoFileCharges = fileChargesFromVendorRate(
        getQuotationSystemKw(quotation),
        vendor.fileCostPerKw ?? 0,
      )
      const fileCharges =
        stored.fileCharges != null && stored.fileCharges > 0 ? stored.fileCharges : autoFileCharges
      ;(out[vendor.id] ||= []).push({
        quotationId: quotation.id,
        dealerId,
        customerName: payment.customerName,
        customerMobile: payment.customerMobile,
        vendorName: vendor.name,
        vendorMobile: vendor.mobile,
        systemSize: formatLedgerSystemSize(getQuotationSystemKw(quotation)),
        systemKw: getQuotationSystemKw(quotation),
        paymentType,
        paymentTypeLabel: paymentTypeLabelForLedger(paymentType),
        subtotal: payment.subtotal,
        loanAmount: stored.loanAmount ?? loanCash.loanAmount,
        cashAmount: stored.cashAmount ?? loanCash.cashAmount,
        receivedAmount: stored.receivedAmount ?? payment.paidAmount,
        remaining: stored.remaining ?? payment.remainingAmount,
        proposal,
        costOfSite: officeInsideDeductedTotal({
          proposal,
          pi,
          fileCharges,
          gstCharges: officeInsideGstCharges(proposal, pi),
          others: stored.others ?? 0,
        }),
        profitVendor: officeInsideProfitShare(
          payment.subtotal,
          {
            proposal,
            pi,
            fileCharges,
            gstCharges: officeInsideGstCharges(proposal, pi),
            others: stored.others ?? 0,
          },
          vendor.profitRatio,
        ),
        fileCharges,
        pi,
        gstCharges: officeInsideGstCharges(proposal, pi),
        others: stored.others ?? 0,
      })
    }
    for (const record of outsideRecords) {
      const vendor = outsideRows.find((row) => row.id === record.outsideVendorId)
      if (!vendor) continue
      ;(out[vendor.id] ||= []).push(officeOutsideToLedgerRow(record, vendor, ledgerMap))
    }
    return out
  }, [ledgerMap, outsideRecords, outsideRows, quotations, vendorsByDealerId])

  useEffect(() => {
    if (ledgerVendorId !== "all" && !insideDealerIds.has(ledgerVendorId)) {
      setLedgerVendorId("all")
    }
  }, [insideDealerIds, ledgerVendorId])

  const commitLedgerAmounts = async (quotationId: string, patch: SubvendorLedgerAmounts) => {
    const next = upsertLedgerAmounts(quotationId, patch)
    setLedgerMap(next)
    if (!useApi) return
    try {
      await api.admin.subvendors.ledger.update(quotationId, ledgerPatchToApiBody(patch))
    } catch (error) {
      toast({
        title: "Ledger saved on this device",
        description:
          error instanceof ApiError
            ? apiErrorToUserMessage(error)
            : "Backend subvendor ledger route is not live yet.",
        variant: "destructive",
      })
    }
  }

  const usedDealerIds = useMemo(
    () => new Set(insideRows.map((row) => row.dealerId).filter(Boolean)),
    [insideRows],
  )
  const availableDealers = useMemo(
    () =>
      dealers.filter((dealer) => {
        if (editingId) {
          const editing = rows.find((row) => row.id === editingId)
          if (editing?.dealerId === dealer.id) return true
        }
        return !usedDealerIds.has(dealer.id)
      }),
    [dealers, editingId, rows, usedDealerIds],
  )

  const openCreate = () => {
    setEditingId(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }

  const openEdit = (row: AdminSubvendorRecord) => {
    setEditingId(row.id)
    setForm({
      dealerId: row.dealerId,
      name: row.name,
      contactName: row.contactName,
      mobile: row.mobile,
      email: row.email,
      city: row.city,
      category: row.category || "Other",
      notes: row.notes,
      profitRatio: formatProfitRatioInput(row.profitRatio),
      fileCostPerKw: formatFileCostPerKwInput(row.fileCostPerKw),
      leaserPaid: formatInrAmountInput(row.leaserPaid),
      leaserRemaining: formatInrAmountInput(row.leaserRemaining),
    })
    setDialogOpen(true)
  }

  const save = async () => {
    let payload: Omit<AdminSubvendorRecord, "id" | "createdAt">
    if (kind === "office_inside") {
      const dealer = dealersById.get(form.dealerId)
      if (!dealer) return
      payload = {
        kind: "office_inside",
        ...snapshotFromDealer(dealer),
        category: form.category.trim() || "Other",
        notes: form.notes.trim(),
        profitRatio: parseProfitRatio(form.profitRatio),
        fileCostPerKw: parseFileCostPerKw(form.fileCostPerKw),
        leaserPaid: parseInrAmount(form.leaserPaid),
        leaserRemaining: parseInrAmount(form.leaserRemaining),
      }
    } else {
      const name = form.name.trim()
      if (!name) return
      payload = {
        kind: "office_outside",
        dealerId: "",
        name,
        contactName: form.contactName.trim(),
        mobile: form.mobile.trim(),
        email: form.email.trim(),
        city: form.city.trim(),
        category: form.category.trim() || "Other",
        notes: form.notes.trim(),
        profitRatio: parseProfitRatio(form.profitRatio),
        fileCostPerKw: parseFileCostPerKw(form.fileCostPerKw),
        leaserPaid: parseInrAmount(form.leaserPaid),
        leaserRemaining: parseInrAmount(form.leaserRemaining),
      }
    }

    setSavingVendor(true)
    try {
      if (useApi) {
        try {
          const response = editingId
            ? await api.admin.subvendors.update(editingId, subvendorToApiBody(payload))
            : await api.admin.subvendors.create(subvendorToApiBody(payload))
          const remote = pickSubvendorRecordFromApi(response)
          if (remote) {
            if (editingId) updateAdminSubvendor(editingId, remote)
            else {
              writeAdminSubvendors([remote, ...readAdminSubvendors().filter((row) => row.id !== remote.id)])
            }
          } else if (editingId) {
            updateAdminSubvendor(editingId, payload)
          } else {
            createAdminSubvendor(payload)
          }
        } catch (error) {
          if (editingId) updateAdminSubvendor(editingId, payload)
          else createAdminSubvendor(payload)
          toast({
            title: "Vendor saved on this device",
            description:
              error instanceof ApiError
                ? apiErrorToUserMessage(error)
                : "Backend subvendor route is not live yet.",
            variant: "destructive",
          })
        }
      } else if (editingId) {
        updateAdminSubvendor(editingId, payload)
      } else {
        createAdminSubvendor(payload)
      }
      setRows(readAdminSubvendors())
      setDialogOpen(false)
    } finally {
      setSavingVendor(false)
    }
  }

  const remove = async (id: string) => {
    if (!window.confirm("Remove this vendor?")) return
    if (useApi) {
      try {
        await api.admin.subvendors.delete(id)
      } catch (error) {
        toast({
          title: "Vendor removed on this device",
          description:
            error instanceof ApiError
              ? apiErrorToUserMessage(error)
              : "Backend subvendor route is not live yet.",
          variant: "destructive",
        })
      }
    }
    deleteAdminSubvendor(id)
    setRows(readAdminSubvendors())
  }

  const saveLeaser = async (id: string, paidRaw: string, remainingRaw: string) => {
    const row = rows.find((item) => item.id === id)
    if (!row) return
    const payload: Omit<AdminSubvendorRecord, "id" | "createdAt"> = {
      kind: row.kind,
      dealerId: row.dealerId,
      name: row.name,
      contactName: row.contactName,
      mobile: row.mobile,
      email: row.email,
      city: row.city,
      category: row.category || "Other",
      notes: row.notes,
      profitRatio: row.profitRatio,
      fileCostPerKw: row.fileCostPerKw,
      leaserPaid: parseInrAmount(paidRaw),
      leaserRemaining: parseInrAmount(remainingRaw),
    }
    if (useApi) {
      try {
        const response = await api.admin.subvendors.update(id, subvendorToApiBody(payload))
        const remote = pickSubvendorRecordFromApi(response)
        updateAdminSubvendor(id, remote ?? payload)
      } catch {
        updateAdminSubvendor(id, payload)
      }
    } else {
      updateAdminSubvendor(id, payload)
    }
    setRows(readAdminSubvendors())
  }

  const saveLeaserPayments = async (vendorId: string, nextPayments: SubvendorLeaserPayment[]) => {
    const all = [
      ...leaserPayments.filter((row) => row.vendorId !== vendorId),
      ...nextPayments.filter((row) => row.vendorId === vendorId),
    ]
    writeLeaserPayments(all)
    setLeaserPayments(all)
    const paid = nextPayments.reduce((sum, row) => sum + row.amount, 0)
    const stats = vendorLeaserStats[vendorId]
    const vendor = rows.find((row) => row.id === vendorId)
    const remainingBase =
      vendor?.kind === "office_outside"
        ? officeOutsideLeaserProfit({
            loanAmount: stats?.loanAmount ?? 0,
            totalAmount: stats?.totalAmount ?? 0,
            billAmount: vendorBillSum(readVendorBills(), vendorId),
            charges: stats?.charges ?? 0,
            gst: officeOutsideLeaserGst(stats?.subtotal ?? 0, vendorBillSum(readVendorBills(), vendorId)),
          })
        : stats?.profitVendor ?? 0
    const remaining = Math.max(0, remainingBase - paid)
    await saveLeaser(vendorId, String(paid), String(remaining))
    if (!useApi) return
    try {
      await api.admin.subvendors.leaser.replace(
        vendorId,
        leaserPaymentsToApiBody(vendorId, nextPayments, {
          leaserPaid: paid,
          leaserRemaining: remaining,
        }),
      )
    } catch (error) {
      toast({
        title: "Leaser saved on this device",
        description:
          error instanceof ApiError
            ? apiErrorToUserMessage(error)
            : "Backend dealer leaser route is not live yet.",
        variant: "destructive",
      })
    }
  }

  const saveVendorBillsForVendor = async (vendorId: string, nextBills: SubvendorVendorBill[]) => {
    const all = [
      ...vendorBills.filter((row) => row.vendorId !== vendorId),
      ...nextBills.filter((row) => row.vendorId === vendorId),
    ]
    const saved = writeVendorBills(all)
    if (!saved) {
      toast({
        title: "Bill file too large to save",
        description: "Keep the bill PDF or image under 2.5 MB and try Save payments again.",
        variant: "destructive",
      })
      return
    }
    setVendorBills(all)
    if (!useApi) return
    try {
      await api.admin.subvendors.bills.replace(vendorId, vendorBillsToApiBody(vendorId, nextBills))
    } catch (error) {
      toast({
        title: "Bills saved on this device",
        description:
          error instanceof ApiError
            ? apiErrorToUserMessage(error)
            : "Backend vendor bills route is not live yet.",
        variant: "destructive",
      })
    }
  }

  const canSave =
    kind === "office_inside" ? Boolean(form.dealerId) : Boolean(form.name.trim())

  const sendOutsideFileToAccounts = async (record: OfficeOutsideRecord) => {
    setSendingToAccountsId(record.id)
    try {
      const remote = await sendOfficeOutsideToAccountsFromVendorApi(record)
      setOutsideRecords((prev) => prev.filter((row) => row.id !== record.id))
      onOfficeOutsideSentToAccounts?.(remote)
      toast({
        title: "Sent to Accounts",
        description: `${record.customerName} now appears on the Accounts list as Office Outside.`,
      })
    } catch (error) {
      toast({
        title: "Could not send to Accounts",
        description: apiErrorToUserMessage(error),
        variant: "destructive",
      })
    } finally {
      setSendingToAccountsId(null)
    }
  }

  const outsideVendorBody = (
    <>
      <VendorToolbar
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Search Vendor Outside..."
        addLabel="Register vendor"
        onAdd={openCreate}
        hideSearch={hideSearch}
      />
      <VendorGrid
        rows={filtered}
        emptyLabel={outsideRows.length === 0 ? "No Vendor Outside records yet" : "No matching vendors"}
        emptyHint={
          outsideRows.length === 0
            ? "Register an external vendor with basic details."
            : undefined
        }
        kindLabel="Vendor Outside"
        onEdit={openEdit}
        onRemove={remove}
        onAdd={openCreate}
        addLabel="Register vendor"
        showAdd={outsideRows.length === 0}
        compact={embedded}
        profitById={vendorProfitById}
        profitHint="complete"
      />
      {outsideRecords.length > 0 ? (
        <div className="space-y-2 rounded-xl border border-amber-200/80 bg-gradient-to-b from-white to-amber-50/50 p-3">
          <div>
            <h4 className="text-sm font-semibold text-amber-950">Office Outside files</h4>
            <p className="text-xs text-muted-foreground">
              Sent from Accounts. These files stay on the Accounts list.
            </p>
          </div>
          <div className="space-y-2 max-h-[min(50vh,420px)] overflow-auto pr-1">
            {outsideRecords
              .slice()
              .sort((a, b) => a.customerName.localeCompare(b.customerName, "en-IN"))
              .map((record) => {
                const onAccounts = isOfficeOutsideOnAccounts(record)
                const loanCash = officeOutsideLoanCashAmounts(record)
                return (
                  <div
                    key={record.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200/70 bg-white/80 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{record.customerName}</p>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {record.mobile || record.id}
                        {record.outsideVendorName ? ` · ${record.outsideVendorName}` : ""}
                        {` · ${formatLedgerInr(officeOutsideSubtotalAmount(record))}`}
                        {loanCash.loanAmount > 0 ? ` · Loan ${formatLedgerInr(loanCash.loanAmount)}` : ""}
                        {officeOutsideFileTypeLabel(record.fileType)
                          ? ` · ${officeOutsideFileTypeLabel(record.fileType)}`
                          : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {onAccounts ? (
                        <Badge
                          variant="outline"
                          className="h-6 text-[10px] border-emerald-200 bg-emerald-50 text-emerald-800"
                        >
                          In Accounts
                        </Badge>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          className="h-8 text-[11px] gap-1 bg-amber-600 hover:bg-amber-700 text-white"
                          disabled={sendingToAccountsId === record.id}
                          onClick={() => void sendOutsideFileToAccounts(record)}
                        >
                          {sendingToAccountsId === record.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Landmark className="w-3.5 h-3.5" />
                          )}
                          Send to Accounts
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-amber-200 bg-amber-50/40 px-4 py-6 text-center text-sm text-muted-foreground">
          No Office Outside files yet. On Accounts, tap Send to Outside.
        </div>
      )}
      {filtered.length > 0 ? (
        <DealerLeaserManager
          vendors={filtered}
          statsById={vendorLeaserStats}
          customersByVendorId={customersByVendorId}
          filesByVendorId={filesByVendorId}
          payments={leaserPayments}
          bills={vendorBills}
          quotations={outsideRecords.map(quotationFromOfficeOutsideRecord)}
          onSave={saveLeaserPayments}
          onSaveBills={saveVendorBillsForVendor}
          heading="Vendor leaser"
          variant="office_outside"
        />
      ) : null}
    </>
  )

  const insideVendorBody = (
    <>
      <VendorToolbar
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Search Vendor Office..."
        addLabel="Select dealer"
        onAdd={openCreate}
        addDisabled={availableDealers.length === 0 && !editingId}
        hideSearch={hideSearch}
      />
      <VendorGrid
        rows={filtered}
        emptyLabel={insideRows.length === 0 ? "No Vendor Office records yet" : "No matching vendors"}
        emptyHint={
          insideRows.length === 0
            ? dealers.length === 0
              ? "Add dealers in Users first, then select them here."
              : "Select a dealer to add them to Vendor Office."
            : undefined
        }
        kindLabel="Vendor Office"
        onEdit={openEdit}
        onRemove={remove}
        onAdd={openCreate}
        addLabel="Select dealer"
        showAdd={insideRows.length === 0 && availableDealers.length > 0}
        compact
        showStats={false}
        profitById={vendorProfitById}
      />
      {filtered.length > 0 ? (
        <DealerLeaserManager
          vendors={filtered}
          statsById={vendorLeaserStats}
          customersByVendorId={customersByVendorId}
          filesByVendorId={filesByVendorId}
          payments={leaserPayments}
          quotations={quotations}
          onSave={saveLeaserPayments}
        />
      ) : null}
    </>
  )

  return (
    <>
      {embedded && lockKind === "office_outside" ? (
        <div className="space-y-3">{outsideVendorBody}</div>
      ) : embedded && lockKind === "office_inside" ? (
        <div className="space-y-3">{insideVendorBody}</div>
      ) : (
    <Card className={embedded ? "border-0 shadow-none py-0" : "rounded-2xl border-orange-200/80 bg-gradient-to-b from-white to-orange-50/45 shadow-sm overflow-hidden"}>
              {embedded ? null : (
      <CardHeader>
        <div>
          <CardTitle>Subvendors</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Vendor Office records are selected from dealers, then maintained in the customer ledger.
              Vendor Outside records use basic registration.
            </p>
        </div>
      </CardHeader>
              )}
      <CardContent className={embedded ? "p-0" : undefined}>
        <Tabs
          value={kind}
          onValueChange={(value) => {
            if (lockKind) return
            setKind(value === "office_outside" ? "office_outside" : "office_inside")
            if (!onSearchChange) setSearch("")
          }}
          className="space-y-4"
        >
          <TabsList className="grid h-auto w-full grid-cols-1 sm:grid-cols-2 gap-2 bg-transparent p-0">
            <TabsTrigger
              value="office_inside"
              className="h-auto items-start justify-start gap-3 rounded-xl border border-border/70 bg-muted/20 px-4 py-3 text-left whitespace-normal data-[state=active]:border-primary data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              <Building2 className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-foreground">
                  Vendor Office ({insideRows.length})
                </span>
                <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                  Select dealers, then maintain the customer ledger
                </span>
              </span>
            </TabsTrigger>
            <TabsTrigger
              value="office_outside"
              className="h-auto items-start justify-start gap-3 rounded-xl border border-border/70 bg-muted/20 px-4 py-3 text-left whitespace-normal data-[state=active]:border-primary data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              <UserPlus className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-foreground">
                  Vendor Outside ({outsideRows.length})
                </span>
                <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                  Basic registration for external vendors
                </span>
              </span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="office_inside" className="space-y-4">
            <VendorToolbar
              search={search}
              onSearch={setSearch}
              searchPlaceholder="Search Vendor Office..."
              addLabel="Select dealer"
              onAdd={openCreate}
              addDisabled={availableDealers.length === 0 && !editingId}
            />
            <VendorGrid
              rows={filtered}
              emptyLabel={insideRows.length === 0 ? "No Vendor Office records yet" : "No matching vendors"}
              emptyHint={
                insideRows.length === 0
                  ? dealers.length === 0
                    ? "Add dealers in Users first, then select them here."
                    : "Select a dealer to add them to Vendor Office."
                  : undefined
              }
              kindLabel="Vendor Office"
              onEdit={openEdit}
              onRemove={remove}
              onAdd={openCreate}
              addLabel="Select dealer"
              showAdd={insideRows.length === 0 && availableDealers.length > 0}
              compact
              profitById={vendorProfitById}
            />
            {insideRows.length > 0 ? (
              <InsideVendorLedger
                rows={ledgerRows}
                totals={ledgerTotals}
                search={ledgerSearch}
                onSearch={setLedgerSearch}
                vendorId={ledgerVendorId}
                onVendorId={setLedgerVendorId}
                vendors={insideRows}
                onSaveAmounts={commitLedgerAmounts}
              />
            ) : null}
          </TabsContent>

          <TabsContent value="office_outside" className="space-y-4">
            {outsideVendorBody}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {kind === "office_inside"
                ? editingId
                  ? "Edit Vendor Office"
                  : "Select dealer"
                : editingId
                  ? "Edit Vendor Outside"
                  : "Register vendor"}
            </DialogTitle>
            <DialogDescription>
              {kind === "office_inside"
                ? "Choose a dealer from Users. Their name and contact details come from the dealer profile."
                : "Enter basic registration details for a vendor who works outside the office."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {kind === "office_inside" ? (
              <div>
                <Label>Dealer *</Label>
                <Select
                  value={form.dealerId}
                  onValueChange={(v) => setForm((p) => ({ ...p, dealerId: v }))}
                  disabled={Boolean(editingId)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a dealer" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableDealers.length === 0 ? (
                      <SelectItem value="__none" disabled>
                        No dealers available
                      </SelectItem>
                    ) : (
                      availableDealers.map((dealer) => (
                        <SelectItem key={dealer.id} value={dealer.id}>
                          {dealerDisplayName(dealer)} ({dealer.username})
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <>
                <div>
                  <Label>Company / vendor name *</Label>
                  <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
                </div>
                <div>
                  <Label>Contact person</Label>
                  <Input
                    value={form.contactName}
                    onChange={(e) => setForm((p) => ({ ...p, contactName: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Mobile</Label>
                    <Input value={form.mobile} onChange={(e) => setForm((p) => ({ ...p, mobile: e.target.value }))} />
                  </div>
                  <div>
                    <Label>City</Label>
                    <Input value={form.city} onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <Label>Email</Label>
                  <Input value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
                </div>
              </>
            )}
            <div>
              <Label>File cost (₹ / kW)</Label>
              <Input
                inputMode="numeric"
                className="tabular-nums"
                placeholder="1000"
                value={form.fileCostPerKw}
                onChange={(e) => setForm((p) => ({ ...p, fileCostPerKw: e.target.value }))}
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                File charges = rounded kW × this rate. 4.4 kW → 4, 4.6 kW → 5.
              </p>
            </div>
            <div>
              <Label>Profit ratio (%)</Label>
              <Input
                inputMode="decimal"
                className="tabular-nums"
                placeholder="0"
                value={form.profitRatio}
                onChange={(e) => setForm((p) => ({ ...p, profitRatio: e.target.value }))}
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Percent of complete profit (subtotal − cost of site). 50 means Profit vendor is 50% of that amount.
              </p>
              {editingId ? (
                <p className="text-sm font-semibold tabular-nums text-emerald-800 dark:text-emerald-300 mt-1.5">
                  Profit {formatLedgerInr(vendorProfitById[editingId] ?? 0)}
                </p>
              ) : null}
            </div>
            <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-3 space-y-3">
              <p className="text-sm font-medium">Leaser</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Paid</Label>
                  <Input
                    inputMode="numeric"
                    className="tabular-nums"
                    placeholder="0"
                    value={form.leaserPaid}
                    onChange={(e) => setForm((p) => ({ ...p, leaserPaid: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>Remaining</Label>
                  <Input
                    inputMode="numeric"
                    className="tabular-nums"
                    placeholder="0"
                    value={form.leaserRemaining}
                    onChange={(e) => setForm((p) => ({ ...p, leaserRemaining: e.target.value }))}
                  />
                </div>
              </div>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                rows={3}
                value={form.notes}
                onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              />
            </div>
            <Button className="w-full" onClick={() => void save()} disabled={!canSave || savingVendor}>
              {savingVendor
                ? "Saving..."
                : kind === "office_inside"
                  ? editingId
                    ? "Save changes"
                    : "Add dealer as vendor"
                  : editingId
                    ? "Save changes"
                    : "Register vendor"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

type VendorLeaserStats = {
  totalFile: number
  fileAmount: number
  totalKw: number
  subtotal: number
  totalAmount: number
  loanAmount: number
  cashAmount: number
  billSum: number
  charges: number
  gstAmount: number
  costOfSite: number
  profitVendor: number
  paid: number
  currentBalance: number
  totalRemaining: number
}

const emptyVendorLeaserStats: VendorLeaserStats = {
  totalFile: 0,
  fileAmount: 0,
  totalKw: 0,
  subtotal: 0,
  totalAmount: 0,
  loanAmount: 0,
  cashAmount: 0,
  billSum: 0,
  charges: 0,
  gstAmount: 0,
  costOfSite: 0,
  profitVendor: 0,
  paid: 0,
  currentBalance: 0,
  totalRemaining: 0,
}

type LeaserCustomerOption = {
  quotationId: string
  name: string
  mobile: string
  kw: string
}

type LeaserPaymentDraft = {
  key: string
  paymentNumber: number
  date: string
  amount: string
  paymentType: string
  remark: string
  customerIds: string[]
}

type VendorBillDraft = {
  key: string
  date: string
  basicAmount: string
  remark: string
  paymentMode: string
  customerIds: string[]
  billFileName: string
  billFileDataUrl: string
  editing: boolean
}

function todayInputDate() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

/** Same YYYY-MM-DD the Office Inside Due Date input shows. */
function accountsDueDateInputValue(raw?: string | null): string | null {
  if (!raw) return null
  const text = String(raw).trim()
  if (!text) return null
  const parsed = new Date(text)
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().split("T")[0]
  return /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : null
}

function quotationInstallmentDueDateYmd(
  quotations: Quotation[],
  quotationId: string,
  phaseNumber: number,
): string | null {
  const quotation = quotations.find((row) => row.id === quotationId) as
    | (Quotation & { payment_phases?: unknown; quotationPaymentPhases?: unknown })
    | undefined
  if (!quotation) return null
  const phases =
    quotation.installments ||
    quotation.paymentPhases ||
    quotation.payment_phases ||
    quotation.quotationPaymentPhases ||
    []
  if (!Array.isArray(phases) || phases.length === 0) return null
  const phase =
    phases.find((row: { phaseNumber?: number }) => Number(row.phaseNumber) === phaseNumber) ||
    phases[phaseNumber - 1]
  const raw = (phase as { dueDate?: string; due_date?: string } | undefined)?.dueDate
    || (phase as { due_date?: string } | undefined)?.due_date
  return accountsDueDateInputValue(raw)
}

function leaserDraftDateFromAccounts(
  paymentId: string,
  storedDate: string | undefined,
  quotations: Quotation[],
): string {
  const selfRow = /^lp-self-(.+)-(\d+)$/.exec(paymentId)
  if (selfRow) {
    const due = quotationInstallmentDueDateYmd(quotations, selfRow[1], Number(selfRow[2]))
    if (due) return due
  }
  return accountsDueDateInputValue(storedDate) || todayInputDate()
}

function phaseTransactionIdFromQuotation(
  quotations: Quotation[],
  quotationId: string,
  phaseNumber: number,
): string {
  const quotation = quotations.find((row) => row.id === quotationId) as
    | (Quotation & { payment_phases?: unknown; quotationPaymentPhases?: unknown })
    | undefined
  if (!quotation) return ""
  const phases =
    quotation.installments ||
    quotation.paymentPhases ||
    quotation.payment_phases ||
    quotation.quotationPaymentPhases ||
    []
  if (!Array.isArray(phases) || phases.length === 0) return ""
  const phase =
    phases.find((row: { phaseNumber?: number }) => Number(row.phaseNumber) === phaseNumber) ||
    phases[phaseNumber - 1]
  return String(
    (phase as { transactionId?: string; transaction_id?: string } | undefined)?.transactionId ||
      (phase as { transaction_id?: string } | undefined)?.transaction_id ||
      "",
  ).trim()
}

function leaserRemarkFromAccounts(
  paymentId: string,
  storedRemark: string,
  quotations: Quotation[],
): string {
  const collectRow = /^lp-collect-(.+)-(\d+)$/.exec(paymentId)
  const selfRow = /^lp-self-(.+)-(\d+)$/.exec(paymentId)
  const match = collectRow || selfRow
  if (!match) return storedRemark
  const txn = phaseTransactionIdFromQuotation(quotations, match[1], Number(match[2]))
  if (!txn) return storedRemark
  if (storedRemark.includes(txn)) return storedRemark
  return storedRemark.trim() ? `${storedRemark.trim()} · Txn ${txn}` : `Txn ${txn}`
}

function emptyLeaserDraft(paymentNumber = 1, customerId?: string): LeaserPaymentDraft {
  return {
    key: newLeaserPaymentId(),
    paymentNumber,
    date: todayInputDate(),
    amount: "",
    paymentType: "Cash",
    remark: "",
    customerIds: customerId ? [customerId] : [],
  }
}

function emptyBillDraft(customerId?: string): VendorBillDraft {
  return {
    key: newVendorBillId(),
    date: todayInputDate(),
    basicAmount: "",
    remark: "",
    paymentMode: "Cash",
    customerIds: customerId ? [customerId] : [],
    billFileName: "",
    billFileDataUrl: "",
    editing: true,
  }
}

function readVendorBillFile(file: File): Promise<{ name: string; dataUrl: string }> {
  return new Promise((resolve, reject) => {
    if (file.size > 2.5 * 1024 * 1024) {
      reject(new Error("Bill file must be under 2.5 MB"))
      return
    }
    const reader = new FileReader()
    reader.onload = () => resolve({ name: file.name, dataUrl: String(reader.result || "") })
    reader.onerror = () => reject(new Error("Could not read bill file"))
    reader.readAsDataURL(file)
  })
}

function looksLikeRecordId(value: string) {
  const text = value.trim()
  return /^OO-/i.test(text) || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(text)
}

function soleVendorCustomerId(files: InsideLedgerRow[], customers: LeaserCustomerOption[]) {
  if (files.length === 1) return files[0].quotationId
  if (customers.length === 1) return customers[0].quotationId
  return undefined
}

function remapLeaserCustomerIds(ids: string[], files: InsideLedgerRow[], fallbackId?: string) {
  if (!ids.length) return fallbackId ? [fallbackId] : []
  return ids.map((id) => {
    if (files.some((file) => file.quotationId === id)) return id
    if (fallbackId && looksLikeRecordId(id)) return fallbackId
    return id
  })
}

function formatLeaserCustomerName(row: Pick<LeaserCustomerOption, "name" | "mobile">) {
  return row.mobile ? `${row.name} (${row.mobile})` : row.name
}

function LeaserCustomerPicker({
  customers,
  selectedIds,
  onChange,
  label = "Customers",
  emptyLabel = "All customers",
  searchPlaceholder = "Search all customers...",
  singleSelect = false,
}: {
  customers: LeaserCustomerOption[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
  label?: string
  emptyLabel?: string
  searchPlaceholder?: string
  singleSelect?: boolean
}) {
  const [open, setOpen] = useState(false)
  const selected = customers.filter((row) => selectedIds.includes(row.quotationId))
  const unresolved = selectedIds.filter((id) => !selected.some((row) => row.quotationId === id))
  const names = [
    ...selected.map((row) => formatLeaserCustomerName(row)),
    ...unresolved,
  ]
  const triggerLabel =
    names.length === 0 ? emptyLabel : names.length === 1 ? names[0] : `${names[0]} +${names.length - 1}`

  const toggleCustomer = (quotationId: string) => {
    if (singleSelect) {
      onChange(selectedIds.includes(quotationId) ? [] : [quotationId])
      setOpen(false)
      return
    }
    onChange(
      selectedIds.includes(quotationId)
        ? selectedIds.filter((id) => id !== quotationId)
        : [...selectedIds, quotationId],
    )
  }

  return (
    <div className="min-w-0">
      <Label>{label}</Label>
      {customers.length === 0 ? (
        <p className="text-xs text-muted-foreground mt-1">No customers yet.</p>
      ) : (
        <Popover modal={false} open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className="mt-1 h-9 w-full justify-between px-3 font-normal"
            >
              <span className={cn("truncate text-left", names.length === 0 && "text-muted-foreground")}>
                {triggerLabel}
              </span>
              <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[min(22rem,calc(100vw-2rem))] p-0" align="start">
            <Command>
              <CommandInput placeholder={searchPlaceholder} />
              <CommandList className="max-h-80">
                <CommandEmpty>No customer found.</CommandEmpty>
                <CommandGroup heading={`${customers.length} customer${customers.length === 1 ? "" : "s"}`}>
                  {customers.map((customer) => {
                    const checked = selectedIds.includes(customer.quotationId)
                    return (
                      <CommandItem
                        key={customer.quotationId}
                        value={`${customer.name} ${customer.mobile} ${customer.kw} ${customer.quotationId}`}
                        onSelect={() => toggleCustomer(customer.quotationId)}
                      >
                        <Check className={cn("h-4 w-4", checked ? "opacity-100" : "opacity-0")} />
                        <span className="min-w-0">
                          <span className="block truncate leading-tight">{customer.name}</span>
                          <span className="block text-[11px] text-muted-foreground">
                            {customer.mobile || "No mobile"} · {customer.kw}
                          </span>
                        </span>
                      </CommandItem>
                    )
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      )}
    </div>
  )
}

function DealerLeaserManager({
  vendors,
  statsById,
  customersByVendorId,
  filesByVendorId,
  payments,
  bills = [],
  quotations,
  onSave,
  onSaveBills,
  heading = "Dealer leaser",
  variant = "office_inside",
}: {
  vendors: AdminSubvendorRecord[]
  statsById: Record<string, VendorLeaserStats>
  customersByVendorId: Record<string, LeaserCustomerOption[]>
  filesByVendorId: Record<string, InsideLedgerRow[]>
  payments: SubvendorLeaserPayment[]
  bills?: SubvendorVendorBill[]
  quotations: Quotation[]
  onSave: (vendorId: string, nextPayments: SubvendorLeaserPayment[]) => Promise<void> | void
  onSaveBills?: (vendorId: string, nextBills: SubvendorVendorBill[]) => Promise<void> | void
  heading?: string
  variant?: "office_inside" | "office_outside"
}) {
  const { toast } = useToast()
  const [manageVendorId, setManageVendorId] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<LeaserPaymentDraft[]>([])
  const [billDrafts, setBillDrafts] = useState<VendorBillDraft[]>([])
  const [saving, setSaving] = useState(false)
  const isOutside = variant === "office_outside"
  const manageVendor = vendors.find((row) => row.id === manageVendorId) ?? null
  const customers = useMemo(() => {
    const base = manageVendorId ? customersByVendorId[manageVendorId] || [] : []
    if (!manageVendorId) return base
    const byId = new Map(base.map((row) => [row.quotationId, row]))
    const files = filesByVendorId[manageVendorId] || []
    for (const file of files) {
      if (byId.has(file.quotationId)) continue
      byId.set(file.quotationId, {
        quotationId: file.quotationId,
        name: file.customerName,
        mobile: file.customerMobile === "—" ? "" : file.customerMobile || "",
        kw: file.systemSize,
      })
    }
    const extraIds = [
      ...drafts.flatMap((row) => row.customerIds),
      ...billDrafts.flatMap((row) => row.customerIds),
    ]
    for (const quotationId of extraIds) {
      if (byId.has(quotationId)) continue
      const quotation = quotations.find((row) => row.id === quotationId)
      const payment = quotation ? summarizeQuotationPayment(quotation) : null
      const file =
        files.find((row) => row.quotationId === quotationId) ||
        (files.length === 1 && looksLikeRecordId(quotationId) ? files[0] : undefined)
      const quotedName = payment?.customerName && payment.customerName !== "—" ? payment.customerName : ""
      byId.set(quotationId, {
        quotationId,
        name: quotedName || file?.customerName || quotationId,
        mobile:
          payment?.customerMobile && payment.customerMobile !== "—"
            ? payment.customerMobile
            : file?.customerMobile === "—"
              ? ""
              : file?.customerMobile || "",
        kw: quotation
          ? formatLedgerSystemSize(getQuotationSystemKw(quotation))
          : file?.systemSize || "",
      })
    }
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, "en-IN"))
  }, [billDrafts, customersByVendorId, drafts, filesByVendorId, manageVendorId, quotations])
  const fileRows = manageVendorId ? filesByVendorId[manageVendorId] || [] : []
  const soleCustomerId = soleVendorCustomerId(fileRows, customers)
  const manageStats = manageVendorId ? statsById[manageVendorId] ?? emptyVendorLeaserStats : null

  const enteredTransactions = () =>
    drafts
      .filter((row) => parseInrAmount(row.amount) > 0 || row.remark.trim() || row.customerIds.length > 0)
      .slice()
      .sort((a, b) => a.paymentNumber - b.paymentNumber)

  const customerLabel = (ids: string[]) =>
    ids
      .map((id) => {
        const match = customers.find((row) => row.quotationId === id)
        return match ? `${match.name}${match.mobile ? ` (${match.mobile})` : ""}` : id
      })
      .filter(Boolean)
      .join("; ")

  const downloadMiniStatement = () => {
    if (!manageVendor) return
    const rows = enteredTransactions()
    if (rows.length === 0) {
      toast({
        title: "No transactions to download",
        description: "Add at least one leaser payment first.",
        variant: "destructive",
      })
      return
    }
    const stamp = new Date().toISOString().slice(0, 10)
    downloadCsvTable(`leaser-mini-${slugForFilename(manageVendor.name)}-${stamp}.csv`, [
      ["Payment", "Date", "Amount", "Payment type", "Remark", "Customers"],
      ...rows.map((row) => [
        `Payment ${row.paymentNumber}`,
        row.date,
        parseInrAmount(row.amount),
        row.paymentType,
        row.remark,
        customerLabel(row.customerIds),
      ]),
    ])
  }

  const downloadFullStatement = () => {
    if (!manageVendor || !manageStats) return
    const txns = enteredTransactions()
    const stamp = new Date().toISOString().slice(0, 10)
    const table: Array<Array<string | number>> = [
      ["Dealer leaser full statement"],
      ["Dealer", manageVendor.name],
      ["Mobile", manageVendor.mobile || manageVendor.contactName || ""],
      [],
      ["Total file", manageStats.totalFile],
      ["kW", formatLedgerSystemSize(manageStats.totalKw)],
      ["Subtotal", manageStats.subtotal],
      ...(isOutside
        ? [
            ["Total amount", manageStats.totalAmount],
            ["Loan amount", manageStats.loanAmount],
            ["Cash amount", manageStats.cashAmount],
            ["Bill", manageStats.billSum],
            ["Charges", manageStats.charges],
            ["GST", manageStats.gstAmount],
          ]
        : [["Cost of site vendor", manageStats.costOfSite]]),
      ["Profit vendor", manageStats.profitVendor],
      ["Total payment", manageStats.currentBalance],
      ["Total remaining", manageStats.totalRemaining],
      [],
      ["Files"],
      [
        "Customer",
        "Mobile",
        "kW",
        "Payment type",
        "Subtotal",
        "Cost of site vendor",
        "Profit vendor",
        "Proposal",
        "PI",
        "File charges",
        "GST",
        "Others",
        "Received",
        "Remaining",
        "Quotation ID",
      ],
      ...fileRows.map((row) => [
        row.customerName,
        row.customerMobile,
        row.systemSize,
        row.paymentTypeLabel,
        row.subtotal,
        row.costOfSite,
        row.profitVendor,
        row.proposal,
        row.pi,
        row.fileCharges,
        row.gstCharges,
        row.others,
        row.receivedAmount,
        row.remaining,
        row.quotationId,
      ]),
      [],
      ["Transactions"],
      ["Payment", "Date", "Amount", "Payment type", "Remark", "Customers"],
      ...(txns.length
        ? txns.map((row) => [
            `Payment ${row.paymentNumber}`,
            row.date,
            parseInrAmount(row.amount),
            row.paymentType,
            row.remark,
            customerLabel(row.customerIds),
          ])
        : [["No transactions entered"]]),
    ]
    downloadCsvTable(`leaser-full-${slugForFilename(manageVendor.name)}-${stamp}.csv`, table)
  }

  const openManage = (vendorId: string) => {
    const vendorFiles = filesByVendorId[vendorId] || []
    const vendorCustomers = customersByVendorId[vendorId] || []
    const fallbackCustomerId = soleVendorCustomerId(vendorFiles, vendorCustomers)
    const existing = payments
      .filter((row) => row.vendorId === vendorId)
      .slice()
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
      .map((row, index) => ({
        key: row.id,
        paymentNumber: row.sortOrder > 0 ? row.sortOrder : index + 1,
        date: leaserDraftDateFromAccounts(row.id, row.date, quotations),
        amount: row.amount ? formatInrAmountInput(row.amount) : "",
        paymentType: row.paymentType || "Cash",
        remark: leaserRemarkFromAccounts(row.id, row.remark, quotations),
        customerIds: remapLeaserCustomerIds(row.customerIds.slice(), vendorFiles, fallbackCustomerId),
      }))
    setManageVendorId(vendorId)
    setDrafts(existing.length ? [...existing].reverse() : [emptyLeaserDraft(1, fallbackCustomerId)])
    const existingBills = bills
      .filter((row) => row.vendorId === vendorId)
      .slice()
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
      .map((row) => ({
        key: row.id,
        date: row.date || todayInputDate(),
        basicAmount: row.basicAmount ? formatInrAmountInput(row.basicAmount) : "",
        remark: row.remark || "",
        paymentMode: row.paymentMode || "Cash",
        customerIds: remapLeaserCustomerIds(row.customerIds.slice(), vendorFiles, fallbackCustomerId),
        billFileName: row.billFileName || "",
        billFileDataUrl: row.billFileDataUrl || "",
        editing: !(row.basicAmount > 0 || row.billFileName),
      }))
    setBillDrafts(existingBills.length ? existingBills : [emptyBillDraft(fallbackCustomerId)])
  }

  const closeManage = () => {
    setManageVendorId(null)
    setDrafts([])
    setBillDrafts([])
  }

  const addPayment = () => {
    setDrafts((prev) => {
      const nextNumber = prev.reduce((max, row) => Math.max(max, row.paymentNumber), 0) + 1
      return [emptyLeaserDraft(nextNumber, soleCustomerId), ...prev]
    })
  }

  const removePayment = (key: string) => {
    setDrafts((prev) => {
      const next = prev.filter((row) => row.key !== key)
      return next.length ? next : [emptyLeaserDraft(1, soleCustomerId)]
    })
  }

  const patchDraft = (key: string, patch: Partial<LeaserPaymentDraft>) => {
    setDrafts((prev) => prev.map((row) => (row.key === key ? { ...row, ...patch } : row)))
  }

  const patchBillDraft = (key: string, patch: Partial<VendorBillDraft>) => {
    setBillDrafts((prev) => prev.map((row) => (row.key === key ? { ...row, ...patch } : row)))
  }

  const addBillDraft = () => {
    setBillDrafts((prev) => [emptyBillDraft(soleCustomerId), ...prev])
  }

  const removeBillDraft = (key: string) => {
    setBillDrafts((prev) => {
      const next = prev.filter((row) => row.key !== key)
      return next.length ? next : [emptyBillDraft(soleCustomerId)]
    })
  }

  const attachBillFile = async (key: string, file: File | undefined) => {
    if (!file) return
    try {
      const next = await readVendorBillFile(file)
      patchBillDraft(key, { billFileName: next.name, billFileDataUrl: next.dataUrl })
    } catch (error) {
      toast({
        title: "Could not attach bill",
        description: error instanceof Error ? error.message : "Try a smaller PDF or image.",
        variant: "destructive",
      })
    }
  }

  const saveManage = async () => {
    if (!manageVendorId) return
    const next = drafts
      .slice()
      .sort((a, b) => a.paymentNumber - b.paymentNumber)
      .map((draft) => ({
        id: draft.key,
        vendorId: manageVendorId,
        date: draft.date.trim(),
        amount: parseInrAmount(draft.amount),
        paymentType: draft.paymentType || "Cash",
        remark: draft.remark.trim(),
        customerIds: draft.customerIds,
        sortOrder: draft.paymentNumber,
      }))
      .filter((row) => row.amount > 0 || row.remark || row.customerIds.length > 0)
    const nextBills = billDrafts
      .map((draft, index) => ({
        id: draft.key,
        vendorId: manageVendorId,
        date: draft.date.trim(),
        basicAmount: parseInrAmount(draft.basicAmount),
        remark: draft.remark.trim(),
        paymentMode: draft.paymentMode || "Cash",
        customerIds: draft.customerIds,
        billFileName: draft.billFileName.trim(),
        billFileDataUrl: draft.billFileDataUrl.trim(),
        sortOrder: index + 1,
      }))
      .filter(
        (row) =>
          row.basicAmount > 0 ||
          row.remark ||
          row.customerIds.length > 0 ||
          row.billFileName,
      )
    setSaving(true)
    try {
      if (isOutside) await onSaveBills?.(manageVendorId, nextBills)
      await onSave(manageVendorId, next)
      closeManage()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-xl border border-border/70 bg-card p-3 sm:p-4 space-y-3">
      <div>
        <p className="text-sm font-semibold">Dealer leaser</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {isOutside
            ? "Subtotal and total amount from Accounts. Add bills (basic). Charges = file + others. GST = (subtotal − bill) × 9.8%. Profit vendor = loan − bill − charges − GST."
            : "Total file, kW, subtotal, cost of site vendor, profit vendor, payment, and remaining for each office vendor."}
        </p>
      </div>
      <div className="space-y-2">
        {vendors.map((vendor) => {
          const stats = statsById[vendor.id] ?? emptyVendorLeaserStats
          return (
            <div
              key={vendor.id}
              className={cn(
                "grid grid-cols-2 gap-2 items-center rounded-lg border border-border/50 px-3 py-2.5",
                isOutside
                  ? "lg:grid-cols-[minmax(0,1.05fr)_repeat(10,minmax(3.6rem,0.46fr))_auto]"
                  : "lg:grid-cols-[minmax(0,1.15fr)_repeat(7,minmax(4.5rem,0.55fr))_auto]",
              )}
            >
              <div className="col-span-2 lg:col-span-1 min-w-0">
                <p className="text-sm font-medium truncate">{vendor.name}</p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {vendor.mobile || vendor.contactName || vendor.dealerId}
                </p>
              </div>
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Total file</p>
                <p className="text-sm font-semibold tabular-nums">{stats.totalFile}</p>
              </div>
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">kW</p>
                <p className="text-sm font-semibold tabular-nums">{formatLedgerSystemSize(stats.totalKw)}</p>
              </div>
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Subtotal</p>
                <p className="text-sm font-semibold tabular-nums">{formatLedgerInr(stats.subtotal)}</p>
              </div>
              {isOutside ? (
                <>
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Total amount</p>
                    <p className="text-sm font-semibold tabular-nums">{formatLedgerInr(stats.totalAmount)}</p>
                    <p className="text-[10px] text-muted-foreground tabular-nums leading-snug">
                      L {formatLedgerInr(stats.loanAmount)} · C {formatLedgerInr(stats.cashAmount)}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Bill</p>
                    <p className="text-sm font-semibold tabular-nums">{formatLedgerInr(stats.billSum)}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Charges</p>
                    <p className="text-sm font-semibold tabular-nums">{formatLedgerInr(stats.charges)}</p>
                    <p className="text-[10px] text-muted-foreground">File + others</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">GST</p>
                    <p className="text-sm font-semibold tabular-nums">{formatLedgerInr(stats.gstAmount)}</p>
                    <p className="text-[10px] text-muted-foreground">(Subtotal − bill) × 9.8%</p>
                  </div>
                </>
              ) : (
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Cost of site vendor</p>
                <p className="text-sm font-semibold tabular-nums">{formatLedgerInr(stats.costOfSite)}</p>
              </div>
              )}
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Profit vendor</p>
                <p className="text-sm font-semibold tabular-nums text-emerald-800 dark:text-emerald-300">
                  {formatLedgerInr(stats.profitVendor)}
                </p>
                {vendor.kind === "office_inside" ? (
                  <p className="text-[10px] text-muted-foreground tabular-nums mt-0.5">
                    {formatProfitRatioLabel(vendor.profitRatio)} of profit
                  </p>
                ) : (
                  <p className="text-[10px] text-muted-foreground mt-0.5">Loan − bill − charges − GST</p>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Total payment</p>
                <p className="text-sm font-semibold tabular-nums">
                  {formatLedgerInr(stats.currentBalance)}
                </p>
              </div>
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Total remaining</p>
                <p
                  className={cn(
                    "text-sm font-semibold tabular-nums",
                    stats.totalRemaining < 0 ? "text-rose-700" : undefined,
                  )}
                >
                  {formatLedgerInr(stats.totalRemaining)}
                </p>
              </div>
              <div className="col-span-2 lg:col-span-1 flex justify-end">
                <Button size="sm" className="h-8" onClick={() => openManage(vendor.id)}>
                  Manage
                </Button>
              </div>
            </div>
          )
        })}
      </div>

      <Dialog
        open={Boolean(manageVendorId)}
        onOpenChange={(open) => {
          if (!open) closeManage()
        }}
      >
        <DialogContent className="max-w-[calc(100%-1rem)] sm:max-w-6xl w-full max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex flex-col gap-3 pr-8 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1">
                <DialogTitle>{heading}</DialogTitle>
                <DialogDescription>
                  Add date, amount, payment type, remark, and customers. Each payment stays in one row.
                </DialogDescription>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button type="button" variant="outline" size="sm" className="h-9">
                      <Download className="w-3.5 h-3.5 mr-1" />
                      Download
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="z-[200]">
                    <DropdownMenuItem onClick={downloadMiniStatement}>
                      Mini statement
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={downloadFullStatement}>
                      Full statement
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                {isOutside ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9"
                    onClick={addBillDraft}
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Add bill
                  </Button>
                ) : null}
                <Button type="button" variant="outline" size="sm" className="h-9" onClick={addPayment}>
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Add payment
                </Button>
                <Button size="sm" className="h-9" onClick={() => void saveManage()} disabled={saving}>
                  {saving ? "Saving..." : "Save payments"}
                </Button>
              </div>
            </div>
          </DialogHeader>
          {manageVendor ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5 space-y-2">
                <div>
                  <p className="text-sm font-semibold">{manageVendor.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {manageVendor.mobile || manageVendor.contactName || manageVendor.dealerId}
                  </p>
                </div>
                {manageStats ? (
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Total file</p>
                      <p className="text-sm font-semibold tabular-nums">{manageStats.totalFile}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">kW</p>
                      <p className="text-sm font-semibold tabular-nums">
                        {formatLedgerSystemSize(manageStats.totalKw)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Subtotal</p>
                      <p className="text-sm font-semibold tabular-nums">
                        {formatLedgerInr(manageStats.subtotal)}
                      </p>
                    </div>
                    {isOutside ? (
                      <>
                        <div>
                          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Total amount</p>
                          <p className="text-sm font-semibold tabular-nums">
                            {formatLedgerInr(manageStats.totalAmount)}
                          </p>
                          <p className="text-[10px] text-muted-foreground tabular-nums leading-snug">
                            L {formatLedgerInr(manageStats.loanAmount)} · C {formatLedgerInr(manageStats.cashAmount)}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Bill</p>
                          <p className="text-sm font-semibold tabular-nums">
                            {formatLedgerInr(manageStats.billSum)}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Charges</p>
                          <p className="text-sm font-semibold tabular-nums">
                            {formatLedgerInr(manageStats.charges)}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">GST</p>
                          <p className="text-sm font-semibold tabular-nums">
                            {formatLedgerInr(manageStats.gstAmount)}
                          </p>
                        </div>
                      </>
                    ) : (
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Cost of site vendor</p>
                      <p className="text-sm font-semibold tabular-nums">
                        {formatLedgerInr(manageStats.costOfSite)}
                      </p>
                    </div>
                    )}
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Profit vendor</p>
                      <p className="text-sm font-semibold tabular-nums text-emerald-800 dark:text-emerald-300">
                        {formatLedgerInr(manageStats.profitVendor)}
                      </p>
                      {manageVendor.kind === "office_inside" ? (
                        <p className="text-[10px] text-muted-foreground tabular-nums mt-0.5">
                          {formatProfitRatioLabel(manageVendor.profitRatio)} of profit
                        </p>
                      ) : (
                        <p className="text-[10px] text-muted-foreground mt-0.5">Loan − bill − charges − GST</p>
                      )}
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Total payment</p>
                      <p className="text-sm font-semibold tabular-nums">
                        {formatLedgerInr(manageStats.currentBalance)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Total remaining</p>
                      <p
                        className={cn(
                          "text-sm font-semibold tabular-nums",
                          manageStats.totalRemaining < 0 ? "text-rose-700" : undefined,
                        )}
                      >
                        {formatLedgerInr(manageStats.totalRemaining)}
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>
              {isOutside ? (
                <div className="space-y-2 rounded-lg border border-sky-200/80 bg-sky-50/40 p-3">
                  <div>
                    <p className="text-sm font-semibold">Bills</p>
                    <p className="text-xs text-muted-foreground">
                      Add date, basic, payment mode, customer, remark, and bill upload. Use edit and delete on each row.
                    </p>
                  </div>
                  {billDrafts.map((draft) => {
                    const namedCustomer = customerLabel(draft.customerIds)
                    return (
                    <div
                      key={draft.key}
                      className="rounded-lg border border-sky-200/70 bg-white/80 px-3 py-2.5 space-y-2"
                    >
                      {draft.editing ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[8.5rem_7.5rem_8.5rem_minmax(8rem,1fr)_minmax(12rem,1.3fr)_minmax(10rem,1fr)_auto] gap-2 items-end">
                          <div>
                            <Label>Date</Label>
                            <Input
                              type="date"
                              className="h-9"
                              value={draft.date}
                              onChange={(e) => patchBillDraft(draft.key, { date: e.target.value })}
                            />
                          </div>
                          <div>
                            <Label>Basic</Label>
                            <Input
                              inputMode="numeric"
                              className="h-9 tabular-nums"
                              placeholder="0"
                              value={draft.basicAmount}
                              onChange={(e) => patchBillDraft(draft.key, { basicAmount: e.target.value })}
                            />
                          </div>
                          <div>
                            <Label>Payment mode</Label>
                            <Select
                              value={draft.paymentMode}
                              onValueChange={(value) => patchBillDraft(draft.key, { paymentMode: value })}
                            >
                              <SelectTrigger className="h-9">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {LEASER_PAYMENT_TYPES.map((type) => (
                                  <SelectItem key={type} value={type}>
                                    {type}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label>Remark</Label>
                            <Input
                              className="h-9"
                              value={draft.remark}
                              onChange={(e) => patchBillDraft(draft.key, { remark: e.target.value })}
                            />
                          </div>
                          <LeaserCustomerPicker
                            customers={customers}
                            selectedIds={draft.customerIds}
                            onChange={(customerIds) => patchBillDraft(draft.key, { customerIds })}
                            label="Customer"
                            emptyLabel="Select customer"
                            searchPlaceholder="Search customer..."
                            singleSelect
                          />
                          <div className="min-w-0">
                            <Label>Bill upload</Label>
                            {draft.billFileName ? (
                              <div className="mt-1 flex h-9 items-center gap-1 rounded-md border border-input bg-background px-2">
                                {draft.billFileDataUrl ? (
                                  <a
                                    href={draft.billFileDataUrl}
                                    download={draft.billFileName}
                                    className="flex min-w-0 flex-1 items-center gap-1 text-xs text-sky-800 hover:underline"
                                  >
                                    <FileText className="h-3.5 w-3.5 shrink-0" />
                                    <span className="truncate">{draft.billFileName}</span>
                                  </a>
                                ) : (
                                  <span className="flex min-w-0 flex-1 items-center gap-1 text-xs">
                                    <FileText className="h-3.5 w-3.5 shrink-0" />
                                    <span className="truncate">{draft.billFileName}</span>
                                  </span>
                                )}
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 shrink-0"
                                  onClick={() =>
                                    patchBillDraft(draft.key, { billFileName: "", billFileDataUrl: "" })
                                  }
                                >
                                  <X className="h-3.5 w-3.5" />
                                  <span className="sr-only">Remove bill file</span>
                                </Button>
                              </div>
                            ) : (
                              <label
                                htmlFor={`bill-upload-${draft.key}`}
                                className="mt-1 flex h-9 cursor-pointer items-center justify-center gap-1 rounded-md border border-dashed border-input bg-background px-2 text-xs text-muted-foreground hover:bg-muted/40"
                              >
                                <Upload className="h-3.5 w-3.5" />
                                Upload bill
                                <input
                                  id={`bill-upload-${draft.key}`}
                                  type="file"
                                  accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/*"
                                  className="sr-only"
                                  onChange={(event) => {
                                    const file = event.target.files?.[0]
                                    event.target.value = ""
                                    void attachBillFile(draft.key, file)
                                  }}
                                />
                              </label>
                            )}
                          </div>
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9"
                              onClick={() => patchBillDraft(draft.key, { editing: false })}
                            >
                              <Check className="h-4 w-4" />
                              <span className="sr-only">Done editing bill</span>
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9 text-destructive"
                              onClick={() => removeBillDraft(draft.key)}
                            >
                              <Trash2 className="h-4 w-4" />
                              <span className="sr-only">Delete bill</span>
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-[7.5rem_7rem_minmax(11rem,1.4fr)_7rem_minmax(8rem,1fr)_auto] items-center">
                          <div className="min-w-0">
                            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Date</p>
                            <p className="text-sm tabular-nums">{draft.date || "—"}</p>
                          </div>
                          <div className="min-w-0">
                            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Basic</p>
                            <p className="text-sm font-semibold tabular-nums">
                              {draft.basicAmount ? formatLedgerInr(parseInrAmount(draft.basicAmount)) : "—"}
                            </p>
                          </div>
                          <div className="min-w-0">
                            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Customer</p>
                            <p className="text-sm truncate">{namedCustomer || "Select customer"}</p>
                          </div>
                          <div className="min-w-0">
                            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Payment mode</p>
                            <p className="text-sm">{draft.paymentMode || "Cash"}</p>
                          </div>
                          <div className="min-w-0">
                            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Bill</p>
                            {draft.billFileDataUrl ? (
                              <a
                                href={draft.billFileDataUrl}
                                download={draft.billFileName}
                                className="flex items-center gap-1 text-sm text-sky-800 hover:underline"
                              >
                                <FileText className="h-3.5 w-3.5 shrink-0" />
                                <span className="truncate">{draft.billFileName}</span>
                              </a>
                            ) : (
                              <p className="text-sm text-muted-foreground truncate">
                                {draft.billFileName || "No file"}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9"
                              onClick={() => patchBillDraft(draft.key, { editing: true })}
                            >
                              <Pencil className="h-4 w-4" />
                              <span className="sr-only">Edit bill</span>
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9 text-destructive"
                              onClick={() => removeBillDraft(draft.key)}
                            >
                              <Trash2 className="h-4 w-4" />
                              <span className="sr-only">Delete bill</span>
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                    )
                  })}
                </div>
              ) : null}
              <div className="space-y-2">
                {drafts.map((draft) => (
                  <div
                    key={draft.key}
                    className="rounded-lg border border-border/60 px-3 py-2.5 grid grid-cols-1 md:grid-cols-[auto_8.5rem_7.5rem_8.5rem_minmax(8rem,1fr)_minmax(14rem,1.5fr)_auto] gap-2 items-end"
                  >
                    <div>
                      <Label className="opacity-0 select-none">Payment</Label>
                      <p className="h-9 flex items-center text-xs font-semibold text-muted-foreground whitespace-nowrap">
                        Payment {draft.paymentNumber}
                      </p>
                    </div>
                    <div>
                      <Label>Date</Label>
                      <Input
                        type="date"
                        className="h-9"
                        value={draft.date}
                        onChange={(e) => patchDraft(draft.key, { date: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Amount</Label>
                      <Input
                        inputMode="numeric"
                        className="h-9 tabular-nums"
                        placeholder="0"
                        value={draft.amount}
                        onChange={(e) => patchDraft(draft.key, { amount: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Payment type</Label>
                      <Select
                        value={draft.paymentType}
                        onValueChange={(value) => patchDraft(draft.key, { paymentType: value })}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {LEASER_PAYMENT_TYPES.map((type) => (
                            <SelectItem key={type} value={type}>
                              {type}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Remark</Label>
                      <Input
                        className="h-9"
                        value={draft.remark}
                        onChange={(e) => patchDraft(draft.key, { remark: e.target.value })}
                      />
                    </div>
                    <LeaserCustomerPicker
                      customers={customers}
                      selectedIds={draft.customerIds}
                      onChange={(customerIds) => patchDraft(draft.key, { customerIds })}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-destructive"
                      onClick={() => removePayment(draft.key)}
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">Delete payment</span>
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function VendorToolbar({
  search,
  onSearch,
  searchPlaceholder,
  addLabel,
  onAdd,
  addDisabled,
  hideSearch = false,
}: {
  search: string
  onSearch: (value: string) => void
  searchPlaceholder: string
  addLabel: string
  onAdd: () => void
  addDisabled?: boolean
  hideSearch?: boolean
}) {
  return (
    <div className={hideSearch ? "flex justify-end" : "flex flex-col sm:flex-row gap-3"}>
      {hideSearch ? null : (
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      )}
      <Button size="sm" className="shrink-0 h-9" onClick={onAdd} disabled={addDisabled}>
        <Plus className="w-4 h-4 mr-1" />
        {addLabel}
      </Button>
    </div>
  )
}

function VendorGrid({
  rows,
  emptyLabel,
  emptyHint,
  kindLabel,
  onEdit,
  onRemove,
  onAdd,
  addLabel,
  showAdd,
  compact,
  profitById,
  profitHint = "ratio",
  showStats = true,
}: {
  rows: AdminSubvendorRecord[]
  emptyLabel: string
  emptyHint?: string
  kindLabel: string
  onEdit: (row: AdminSubvendorRecord) => void
  onRemove: (id: string) => void
  onAdd: () => void
  addLabel: string
  showAdd: boolean
  compact?: boolean
  profitById?: Record<string, number>
  profitHint?: "ratio" | "complete"
  showStats?: boolean
}) {
  if (rows.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Truck className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>{emptyLabel}</p>
        {emptyHint ? <p className="text-xs mt-1">{emptyHint}</p> : null}
        {showAdd ? (
          <Button variant="link" className="mt-2" onClick={onAdd}>
            {addLabel}
          </Button>
        ) : null}
      </div>
    )
  }

  return (
    <div className={compact ? "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3" : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"}>
      {rows.map((row) => {
        const profitAmount = profitById?.[row.id] ?? 0
        return (
        <div key={row.id} className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-medium truncate">{row.name}</p>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <Badge variant="outline" className="text-[10px] font-medium">
                  {kindLabel}
                </Badge>
              </div>
            </div>
            <div className="flex shrink-0 gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(row)}>
                <Pencil className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive"
                onClick={() => onRemove(row.id)}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
          {showStats ? (
          <div className="mt-3 space-y-2">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Profit</p>
              <p className="text-sm font-semibold tabular-nums text-emerald-800 dark:text-emerald-300">
                {formatLedgerInr(profitAmount)}
              </p>
              <p className="text-[11px] text-muted-foreground tabular-nums mt-0.5">
                {profitHint === "complete" ? "Complete" : formatProfitRatioLabel(row.profitRatio)}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">File cost</p>
                <p className="text-sm font-semibold tabular-nums">
                  ₹{parseFileCostPerKw(row.fileCostPerKw).toLocaleString("en-IN")}/kW
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Leaser</p>
                <p className="text-sm font-semibold tabular-nums">{formatLedgerInr(row.leaserPaid)}</p>
                <p className="text-[11px] text-muted-foreground tabular-nums mt-0.5">
                  Remaining {formatLedgerInr(row.leaserRemaining)}
                </p>
              </div>
            </div>
          </div>
          ) : null}
        </div>
        )
      })}
    </div>
  )
}

function InsideVendorLedger({
  rows,
  totals,
  search,
  onSearch,
  vendorId,
  onVendorId,
  vendors,
  onSaveAmounts,
}: {
  rows: InsideLedgerRow[]
  totals: Record<LedgerAmountField, number>
  search: string
  onSearch: (value: string) => void
  vendorId: string
  onVendorId: (value: string) => void
  vendors: AdminSubvendorRecord[]
  onSaveAmounts: (quotationId: string, patch: SubvendorLedgerAmounts) => Promise<void> | void
}) {
  const [manageRowId, setManageRowId] = useState<string | null>(null)
  const [manageDrafts, setManageDrafts] = useState<Record<LedgerAmountField, string> | null>(null)
  const [saving, setSaving] = useState(false)
  const manageRow = rows.find((row) => row.quotationId === manageRowId) ?? null

  const openManage = (row: InsideLedgerRow) => {
    setManageRowId(row.quotationId)
    setManageDrafts(applyOfficeInsideGstToDrafts(draftsFromLedgerAmounts(row)))
  }

  const closeManage = () => {
    setManageRowId(null)
    setManageDrafts(null)
  }

  const saveManage = async () => {
    if (!manageRowId || !manageDrafts) return
    const patch = applyOfficeInsideGstToAmounts(amountsFromLedgerDrafts(manageDrafts))
    setSaving(true)
    try {
      await onSaveAmounts(manageRowId, patch)
      closeManage()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-xl border border-border/70 bg-card shadow-sm">
      <div className="flex flex-col gap-3 border-b border-border/70 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold">Vendor Office ledger</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Same card layout as Accounts. Edit amounts from Manage.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <Select value={vendorId} onValueChange={onVendorId}>
            <SelectTrigger className="h-9 w-full sm:w-52">
              <SelectValue placeholder="All vendors" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All vendors</SelectItem>
              {vendors.map((vendor) => (
                <SelectItem key={vendor.id} value={vendor.dealerId}>
                  {vendor.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="relative sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search customer or vendor..."
              value={search}
              onChange={(e) => onSearch(e.target.value)}
              className="h-9 pl-9"
            />
          </div>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">
          <p>No approved customer files for these Vendor Office records yet</p>
        </div>
      ) : (
        <div className="p-3 space-y-2">
          <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2">
            {(
              [
                ["Proposal", totals.proposal],
                ["Received", totals.receivedAmount],
                ["Remaining", totals.remaining],
                ["Loan", totals.loanAmount],
                ["Cash", totals.cashAmount],
                ["Cost of site vendor", totals.costOfSite],
                ["Profit vendor", totals.profitVendor],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="min-w-0">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
                <p className="text-sm font-semibold tabular-nums">{formatLedgerInr(value)}</p>
              </div>
            ))}
          </div>

          {rows.map((row) => {
            const status = ledgerStatus(row)
            return (
              <Card
                key={row.quotationId}
                className={cn(
                  "shadow-none px-3 py-2.5 border border-border/70 border-l-4 overflow-hidden",
                  status.tone === "completed"
                    ? "border-l-emerald-500 bg-card"
                    : status.tone === "partial"
                      ? "border-l-amber-500 bg-card"
                      : "border-l-rose-500 bg-card",
                )}
              >
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-2 gap-y-2 items-center w-full xl:grid-cols-[minmax(11rem,1.3fr)_minmax(4.5rem,0.5fr)_minmax(5rem,0.55fr)_minmax(5rem,0.55fr)_minmax(5rem,0.55fr)_minmax(6.25rem,0.7fr)_minmax(5.5rem,0.6fr)_minmax(5rem,0.55fr)_minmax(7rem,0.85fr)_minmax(5.5rem,0.4fr)]">
                  <div className="col-span-2 sm:col-span-3 xl:col-span-1 min-w-0">
                    <p className="text-sm font-semibold leading-tight break-words">
                      {row.customerName}
                      <span className="font-normal text-muted-foreground">
                        {" "}
                        ({row.customerMobile || "N/A"})
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 break-words">
                      Vendor: {row.vendorName || "Unassigned"} • {row.vendorMobile || "No contact"}
                    </p>
                  </div>

                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">System size</p>
                    <p className="text-sm font-semibold leading-tight">{row.systemSize}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{row.paymentTypeLabel}</p>
                  </div>

                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Proposal</p>
                    <p className="text-sm font-semibold tabular-nums">{formatLedgerInr(row.proposal)}</p>
                  </div>

                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Received</p>
                    <p
                      className={cn(
                        "text-sm font-semibold tabular-nums",
                        row.receivedAmount <= 0 ? "text-rose-700" : "text-foreground",
                      )}
                    >
                      {formatLedgerInr(row.receivedAmount)}
                    </p>
                  </div>

                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Remaining</p>
                    <p
                      className={cn(
                        "text-sm font-semibold tabular-nums",
                        row.remaining <= 0 ? "text-emerald-700" : "text-amber-700",
                      )}
                    >
                      {formatLedgerInr(Math.max(row.remaining, 0))}
                    </p>
                  </div>

                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Payment</p>
                    <p className="text-sm font-semibold leading-tight">{row.paymentTypeLabel}</p>
                    {row.paymentType === "mix" ? (
                      <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">
                        L {formatLedgerInr(row.loanAmount)} · C {formatLedgerInr(row.cashAmount)}
                      </p>
                    ) : row.paymentType === "loan" ? (
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Loan {formatLedgerInr(row.loanAmount)}
                      </p>
                    ) : row.paymentType === "cash" ? (
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Cash {formatLedgerInr(row.cashAmount)}
                      </p>
                    ) : null}
                    <p
                      className={cn(
                        "text-[11px] mt-0.5 font-medium",
                        status.tone === "completed"
                          ? "text-emerald-700"
                          : status.tone === "partial"
                            ? "text-amber-700"
                            : "text-rose-700",
                      )}
                    >
                      {status.label}
                    </p>
                  </div>

                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Cost of site vendor</p>
                    <p className="text-sm font-semibold tabular-nums">{formatLedgerInr(row.costOfSite)}</p>
                  </div>

                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Profit vendor</p>
                    <p
                      className={cn(
                        "text-sm font-semibold tabular-nums",
                        row.profitVendor >= 0 ? "text-emerald-700" : "text-rose-700",
                      )}
                    >
                      {formatLedgerInr(row.profitVendor)}
                    </p>
                  </div>

                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Charges</p>
                    <div className="mt-0.5 space-y-0.5">
                      {(
                        [
                          ["File", row.fileCharges],
                          ["PI", row.pi],
                          ["GST", row.gstCharges],
                          ["Others", row.others],
                        ] as const
                      )
                        .filter(([label]) => label !== "GST" || row.pi > 0)
                        .map(([label, value]) => (
                        <p key={label} className="text-[10px] leading-tight tabular-nums">
                          <span className="text-muted-foreground">{label}</span> {formatLedgerInr(value)}
                        </p>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button
                      type="button"
                      size="sm"
                      className="h-6 px-3 text-[10px] leading-none font-medium w-full max-w-[7.25rem]"
                      onClick={() => openManage(row)}
                    >
                      Manage
                    </Button>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <Dialog
        open={Boolean(manageRowId)}
        onOpenChange={(open) => {
          if (!open) closeManage()
        }}
      >
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pr-8">
            <div>
              <DialogTitle>Ledger management</DialogTitle>
              <DialogDescription>Update amounts for this Vendor Office customer file.</DialogDescription>
            </div>
            <Button type="button" size="sm" className="shrink-0" onClick={() => void saveManage()} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </DialogHeader>
          {manageRow && manageDrafts ? (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-lg border border-border/60 bg-muted/20 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold">{manageRow.customerName}</p>
                  <p className="text-xs text-muted-foreground">
                    Customer No: {manageRow.customerMobile || "N/A"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Vendor: {manageRow.vendorName || "Unassigned"} • {manageRow.vendorMobile || "No contact"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {manageRow.systemSize} · {manageRow.paymentTypeLabel}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Subtotal</p>
                  <p className="text-base font-semibold tabular-nums">{formatLedgerInr(manageRow.subtotal)}</p>
                  <p
                    className={cn(
                      "text-[11px] mt-1",
                      manageRow.remaining <= 0 ? "font-semibold text-emerald-700" : "text-muted-foreground",
                    )}
                  >
                    Remaining: {formatLedgerInr(manageRow.remaining)}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {OFFICE_INSIDE_AMOUNT_FIELDS.filter(
                  (field) =>
                    field !== "gstCharges" || parseLedgerAmountInput(manageDrafts.pi) > 0,
                ).map((field) => {
                  const isGst = field === "gstCharges"
                  return (
                  <div key={field} className="space-y-1.5">
                    <Label htmlFor={`ledger-${field}`}>{LEDGER_FIELD_LABELS[field]}</Label>
                    <Input
                      id={`ledger-${field}`}
                      inputMode="numeric"
                      className="tabular-nums"
                      placeholder="0"
                      readOnly={isGst}
                      disabled={isGst}
                      value={manageDrafts[field]}
                      onChange={(e) => {
                        if (isGst) return
                        const raw = e.target.value
                        setManageDrafts((prev) => {
                          if (!prev) return prev
                          const next = { ...prev, [field]: raw }
                          return field === "proposal" || field === "pi"
                            ? applyOfficeInsideGstToDrafts(next)
                            : next
                        })
                      }}
                    />
                    {isGst ? (
                      <p className="text-[11px] text-muted-foreground">(Proposal − PI) × 8.9%</p>
                    ) : null}
                  </div>
                  )
                })}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {(() => {
                  const liveAmounts = amountsFromLedgerDrafts(manageDrafts)
                  const vendorCost = officeInsideDeductedTotal(liveAmounts)
                  const vendorProfit = officeInsideProfitFromAmounts(manageRow.subtotal, liveAmounts)
                  return (
                    <>
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">Cost of site vendor</p>
                        <p className="text-lg font-semibold tabular-nums">
                          {formatLedgerInr(vendorCost)}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          PI + file + GST + others · 0 if PI is 0
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">Profit vendor</p>
                        <p
                          className={cn(
                            "text-lg font-semibold tabular-nums",
                            vendorProfit >= 0 ? "text-emerald-700" : "text-rose-700",
                          )}
                        >
                          {formatLedgerInr(vendorProfit)}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Subtotal − cost of site vendor · 0 if PI is 0
                        </p>
                      </div>
                    </>
                  )
                })()}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
