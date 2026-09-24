"use client"

import { useMemo, useState } from "react"
import type { Quotation } from "@/lib/quotation-context"
import { keepCurrentQuotationsOnly } from "@/lib/quotation-current"
import {
  BANKING_SUB_TABS,
  buildBankingRows,
  markBankingSubmitted,
  type BankingPaymentRow,
  type BankingSubTab,
} from "@/lib/admin-banking"
import { statusAccentTextClass, statusBadgeClass, statusLabel, statusRowClass } from "@/lib/dealer-payment-summary"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Landmark, Search, SlidersHorizontal, Download } from "lucide-react"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  ExcelColumnPickerDialog,
  readRememberedExcelColumns,
  rememberExcelColumns,
} from "@/components/excel-column-picker-dialog"
import { columnOptionsFromHeaders, downloadCsvFile, filterRowsByColumnIds } from "@/lib/excel-column-export"

function formatInr(amount: number): string {
  return `₹${Math.round(amount || 0).toLocaleString("en-IN")}`
}

function formatDate(value?: string): string {
  if (!value) return "—"
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
}

export type BankingSubmitPayload = {
  assignedPersonName: string
  remarks: string
  bankLocation: string
  documentNames: string[]
  files: File[]
}

type DealerOption = {
  id: string
  firstName: string
  lastName: string
}

type Props = {
  quotations: Quotation[]
  dealers?: DealerOption[]
  getDealerName: (dealerId: string, quotation?: Quotation) => string
  getDealerMobile: (dealerId: string, quotation?: Quotation) => string
  getBankDetails: (quotation: Quotation) => string
  onOpenDetails?: (quotation: Quotation) => void
  onSubmitProcess?: (quotation: Quotation, payload: BankingSubmitPayload) => Promise<void> | void
}

const EMPTY_COPY: Record<BankingSubTab, string> = {
  pending_bank:
    "No loan or cash + loan files with the first installment paid and remaining amount still due. Files with 1st installment ₹0 or remaining ₹0 are hidden here.",
  submitted: "No submitted bank files waiting for Accounts to update payment.",
  completed: "No loan or cash + loan files with the loan amount fully paid.",
}

function bankingVisualStatus(row: BankingPaymentRow): "pending" | "partial" | "completed" {
  if (row.stage === "completed" || row.loanRemaining <= 0) return "completed"
  if (row.stage === "submitted") return "partial"
  return "pending"
}

function BankingRowCard({
  row,
  dealerName,
  dealerMobile,
  bankDetails,
  onOpenDetails,
  onSubmit,
}: {
  row: BankingPaymentRow
  dealerName: string
  dealerMobile: string
  bankDetails: string
  onOpenDetails?: (quotation: Quotation) => void
  onSubmit?: (row: BankingPaymentRow) => void
}) {
  const visual = bankingVisualStatus(row)
  const showSecondPaid = row.stage === "completed"
  const secondValue = showSecondPaid ? row.secondPaid : row.secondRemaining
  const secondIsZero = secondValue <= 0
  const secondClass =
    showSecondPaid || secondIsZero || visual === "completed" ? "text-emerald-700" : "text-amber-700"

  return (
    <div
      className={cn(
        "rounded-lg border px-3 py-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[minmax(13rem,1.4fr)_minmax(6.5rem,0.65fr)_minmax(7rem,0.75fr)_minmax(7.5rem,0.8fr)_minmax(7.5rem,0.75fr)_minmax(7.5rem,0.7fr)] gap-3 items-center",
        statusRowClass(visual),
      )}
    >
      <div className="min-w-0">
        <p className="text-sm font-semibold leading-tight break-words">{row.customerName}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{row.customerMobile}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{row.quotationId}</p>
        <p className="text-[11px] text-muted-foreground truncate">{dealerName}</p>
        <p className="text-[11px] text-muted-foreground truncate">{dealerMobile || "—"}</p>
      </div>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Type</p>
        <p className="text-sm font-medium">{row.paymentTypeLabel}</p>
        <Badge variant="outline" className={cn("mt-1 text-[10px]", statusBadgeClass(visual))}>
          {row.stage === "submitted" ? "Submitted" : visual === "completed" ? "Completed" : statusLabel(visual)}
        </Badge>
      </div>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">1st loan paid</p>
        <p className={cn("text-sm font-semibold tabular-nums", statusAccentTextClass(visual))}>
          {formatInr(row.firstLoanPaid)}
        </p>
        <p className="text-[10px] text-muted-foreground mt-0.5">Loan {formatInr(row.loanAmount)}</p>
      </div>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
          {showSecondPaid ? "2nd loan paid" : "2nd remaining"}
        </p>
        <p className={cn("text-sm font-semibold tabular-nums", secondClass)}>{formatInr(secondValue)}</p>
        {row.stage === "submitted" && row.assignedPersonName ? (
          <p className="text-[10px] text-muted-foreground mt-0.5 truncate" title={row.assignedPersonName}>
            Assigned {row.assignedPersonName}
          </p>
        ) : null}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Bank</p>
        <p className="text-xs font-medium truncate" title={bankDetails}>
          {bankDetails}
        </p>
        <p className="text-[11px] text-muted-foreground mt-0.5">{formatDate(row.approvedAt || row.createdAt)}</p>
      </div>
      <div className="min-w-0 flex items-center justify-start lg:justify-end gap-2">
        {row.stage === "pending_bank" && onSubmit ? (
          <Button type="button" size="sm" onClick={() => onSubmit(row)}>
            Submit
          </Button>
        ) : null}
      </div>
    </div>
  )
}

const BANKING_EXCEL_HEADERS = [
  "Customer",
  "Mobile",
  "Quotation ID",
  "Dealer",
  "Dealer Mobile",
  "Type",
  "Stage",
  "1st loan paid",
  "Loan amount",
  "2nd remaining",
  "2nd loan paid",
  "Loan remaining",
  "Bank",
  "Assigned person",
  "Approved date",
] as const

const BANKING_EXCEL_STORAGE_KEY = "excel-columns:admin-banking"

function matchesMonthFilter(dateValue: string | undefined, filterMonth: string): boolean {
  if (filterMonth === "all") return true
  const date = new Date(dateValue || "")
  if (Number.isNaN(date.getTime())) return false
  const now = new Date()
  if (filterMonth === "current") {
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()
  }
  if (filterMonth === "previous") {
    const prevMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1
    const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()
    return date.getMonth() === prevMonth && date.getFullYear() === prevYear
  }
  return true
}

export function AdminBankingPanel({
  quotations,
  dealers = [],
  getDealerName,
  getDealerMobile,
  getBankDetails,
  onOpenDetails,
  onSubmitProcess,
}: Props) {
  const { toast } = useToast()
  const [subTab, setSubTab] = useState<BankingSubTab>("pending_bank")
  const [searchTerm, setSearchTerm] = useState("")
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [filterDealer, setFilterDealer] = useState("all")
  const [filterPaymentType, setFilterPaymentType] = useState("all")
  const [filterMonth, setFilterMonth] = useState("all")
  const [excelOpen, setExcelOpen] = useState(false)
  const [excelRememberedIds, setExcelRememberedIds] = useState<string[] | null>(null)
  const [submitRow, setSubmitRow] = useState<BankingPaymentRow | null>(null)
  const [assignedPersonName, setAssignedPersonName] = useState("")
  const [bankLocation, setBankLocation] = useState("")
  const [remarks, setRemarks] = useState("")
  const [docs, setDocs] = useState<Array<{ file: File; url: string; name: string }>>([])
  const [saving, setSaving] = useState(false)

  const uniqueQuotations = useMemo(
    () => keepCurrentQuotationsOnly(quotations, quotations),
    [quotations],
  )

  const allRows = useMemo(() => buildBankingRows(uniqueQuotations), [uniqueQuotations])

  const scopedRows = useMemo(() => {
    return allRows.filter((row) => {
      if (filterDealer !== "all" && row.quotation.dealerId !== filterDealer) return false
      if (filterPaymentType !== "all" && row.paymentType !== filterPaymentType) return false
      if (!matchesMonthFilter(row.approvedAt || row.createdAt, filterMonth)) return false
      return true
    })
  }, [allRows, filterDealer, filterMonth, filterPaymentType])

  const counts = useMemo(() => {
    const next: Record<BankingSubTab, number> = {
      pending_bank: 0,
      submitted: 0,
      completed: 0,
    }
    for (const row of scopedRows) next[row.stage] += 1
    return next
  }, [scopedRows])

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    return scopedRows.filter((row) => {
      if (row.stage !== subTab) return false
      if (!term) return true
      const dealerName = getDealerName(row.quotation.dealerId, row.quotation).toLowerCase()
      const dealerMobile = getDealerMobile(row.quotation.dealerId, row.quotation).toLowerCase()
      return (
        row.customerName.toLowerCase().includes(term) ||
        row.customerMobile.toLowerCase().includes(term) ||
        row.quotationId.toLowerCase().includes(term) ||
        dealerName.includes(term) ||
        dealerMobile.includes(term) ||
        row.assignedPersonName.toLowerCase().includes(term)
      )
    })
  }, [scopedRows, getDealerMobile, getDealerName, searchTerm, subTab])

  const activeFilterCount =
    (filterDealer !== "all" ? 1 : 0) + (filterPaymentType !== "all" ? 1 : 0) + (filterMonth !== "all" ? 1 : 0)

  const bankingExcelColumns = useMemo(() => columnOptionsFromHeaders([...BANKING_EXCEL_HEADERS]), [])

  const openExcelPicker = () => {
    if (filtered.length === 0) {
      toast({
        title: "No data to download",
        description: "Apply different filters or search to include banking files.",
      })
      return
    }
    setExcelRememberedIds(readRememberedExcelColumns(BANKING_EXCEL_STORAGE_KEY))
    setExcelOpen(true)
  }

  const downloadBankingCsv = (selectedColumnIds: string[]) => {
    const headers = [...BANKING_EXCEL_HEADERS]
    const rows = filtered.map((row) => [
      row.customerName,
      row.customerMobile,
      row.quotationId,
      getDealerName(row.quotation.dealerId, row.quotation),
      getDealerMobile(row.quotation.dealerId, row.quotation),
      row.paymentTypeLabel,
      row.stage === "pending_bank" ? "Pending from the bank" : row.stage === "submitted" ? "Submitted" : "Completed",
      row.firstLoanPaid,
      row.loanAmount,
      row.secondRemaining,
      row.secondPaid,
      row.loanRemaining,
      getBankDetails(row.quotation),
      row.assignedPersonName,
      formatDate(row.approvedAt || row.createdAt),
    ])
    const picked = filterRowsByColumnIds(headers, rows, selectedColumnIds)
    rememberExcelColumns(BANKING_EXCEL_STORAGE_KEY, picked.headers)
    const stamp = new Date().toISOString().slice(0, 10)
    downloadCsvFile({
      filename: `admin-banking-${subTab}-${stamp}.csv`,
      headers: picked.headers,
      rows: picked.rows,
    })
    toast({
      title: "Download started",
      description: `${filtered.length} banking row${filtered.length === 1 ? "" : "s"} exported.`,
    })
  }

  const closeSubmit = () => {
    for (const doc of docs) {
      if (doc.url.startsWith("blob:")) {
        try {
          URL.revokeObjectURL(doc.url)
        } catch {
          // ignore
        }
      }
    }
    setSubmitRow(null)
    setAssignedPersonName("")
    setBankLocation("")
    setRemarks("")
    setDocs([])
  }

  const openSubmit = (row: BankingPaymentRow) => {
    const q = row.quotation as unknown as Record<string, unknown>
    setSubmitRow(row)
    setAssignedPersonName(
      String(q.bankAssignedPersonName || q.bank_assigned_person_name || row.assignedPersonName || ""),
    )
    setBankLocation(String(q.bankLocation || q.bank_location || ""))
    setRemarks(String(q.bankRemarks || q.bank_remarks || ""))
    setDocs([])
  }

  const handleSubmit = async () => {
    if (!submitRow) return
    const person = assignedPersonName.trim()
    if (!person) {
      toast({
        title: "Assigned person required",
        description: "Enter the assigned person before submitting.",
        variant: "destructive",
      })
      return
    }
    setSaving(true)
    const payload: BankingSubmitPayload = {
      assignedPersonName: person,
      remarks: remarks.trim(),
      bankLocation: bankLocation.trim(),
      documentNames: docs.map((d) => d.name),
      files: docs.map((d) => d.file),
    }
    try {
      markBankingSubmitted(submitRow.quotation.id, {
        assignedPersonName: payload.assignedPersonName,
        remarks: payload.remarks,
        bankLocation: payload.bankLocation,
        documentNames: payload.documentNames,
        submittedAt: new Date().toISOString(),
      })
      await onSubmitProcess?.(submitRow.quotation, payload)
      toast({
        title: "Submitted to bank process",
        description: `${submitRow.quotation.id} moved to Submitted. It moves to Completed when Accounts updates payment.`,
      })
      closeSubmit()
      setSubTab("submitted")
    } catch (error) {
      toast({
        title: "Could not submit",
        description: error instanceof Error ? error.message : "Failed to save bank process details.",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex items-start gap-2">
          <Landmark className="w-5 h-5 text-primary mt-0.5 shrink-0" />
          <div>
            <CardTitle>Banking</CardTitle>
            <CardDescription>
              Loan and Cash + loan files from Accounts. Submit assigned person from Pending from the bank to move a
              file to Submitted. Documents are optional. When Accounts updates payment (loan remaining ₹0) it moves
              to Completed.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={subTab} onValueChange={(value) => setSubTab(value as BankingSubTab)}>
          <TabsList className="h-9 w-full justify-start bg-muted/40 p-1 gap-0.5 flex-nowrap overflow-hidden">
            {BANKING_SUB_TABS.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value} className="text-xs px-2 py-1.5 min-w-0 flex-1">
                {tab.label} ({counts[tab.value]})
              </TabsTrigger>
            ))}
          </TabsList>

          {BANKING_SUB_TABS.map((tab) => (
            <TabsContent key={tab.value} value={tab.value} className="mt-4 space-y-3">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by customer, mobile, quotation ID, or dealer..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full sm:w-auto"
                  onClick={() => setFiltersOpen(true)}
                >
                  <SlidersHorizontal className="w-4 h-4 mr-2" />
                  Filters
                  {activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full sm:w-auto"
                  onClick={openExcelPicker}
                  disabled={filtered.length === 0}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download ({filtered.length})
                </Button>
              </div>

              {filtered.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <Landmark className="w-10 h-10 mx-auto mb-3 opacity-50" />
                  <p className="font-medium text-foreground">No files in {tab.label}</p>
                  <p className="text-sm mt-1 max-w-lg mx-auto">
                    {searchTerm.trim() || activeFilterCount > 0
                      ? "Try clearing search or filters."
                      : EMPTY_COPY[tab.value]}
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {filtered.map((row) => (
                    <BankingRowCard
                      key={row.quotationId}
                      row={row}
                      dealerName={getDealerName(row.quotation.dealerId, row.quotation)}
                      dealerMobile={getDealerMobile(row.quotation.dealerId, row.quotation)}
                      bankDetails={getBankDetails(row.quotation)}
                      onOpenDetails={onOpenDetails}
                      onSubmit={tab.value === "pending_bank" ? openSubmit : undefined}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>

      <Dialog open={filtersOpen} onOpenChange={setFiltersOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Banking Filters</DialogTitle>
            <DialogDescription>
              Filter banking files by dealer, payment type, and month. Download uses the current tab after filters and
              search, and lets you choose which columns to include.
            </DialogDescription>
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
            <Select value={filterPaymentType} onValueChange={setFilterPaymentType}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Type</SelectItem>
                <SelectItem value="loan">Loan</SelectItem>
                <SelectItem value="mix">Cash + loan</SelectItem>
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
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setFilterDealer("all")
                setFilterPaymentType("all")
                setFilterMonth("all")
              }}
            >
              Reset
            </Button>
            <Button type="button" onClick={() => setFiltersOpen(false)}>
              Apply
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ExcelColumnPickerDialog
        open={excelOpen}
        onOpenChange={setExcelOpen}
        title="Select Banking Excel columns"
        description="Check only the fields you want to download. Then click Download."
        columns={bankingExcelColumns}
        initialSelectedIds={excelRememberedIds}
        rowCount={filtered.length}
        confirmLabel="Download Excel"
        onConfirm={downloadBankingCsv}
      />

      <Dialog
        open={Boolean(submitRow)}
        onOpenChange={(open) => {
          if (!open && !saving) closeSubmit()
        }}
      >
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Submit bank process</DialogTitle>
            <DialogDescription>
              Assigned person is required. Documents are optional. After submit the file moves to Submitted until
              Accounts updates payment.
            </DialogDescription>
          </DialogHeader>
          {submitRow ? (
            <div className="space-y-4">
              <div className="rounded-md border border-border/70 bg-muted/20 p-3 text-sm">
                <p className="font-semibold">{submitRow.customerName}</p>
                <p className="text-xs text-muted-foreground">
                  {submitRow.customerMobile} · {submitRow.quotationId}
                </p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {submitRow.paymentTypeLabel} · Loan {formatInr(submitRow.loanAmount)} · 2nd remaining{" "}
                  {formatInr(submitRow.secondRemaining)}
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="banking-assigned-person">Assigned person</Label>
                <Input
                  id="banking-assigned-person"
                  value={assignedPersonName}
                  onChange={(e) => setAssignedPersonName(e.target.value)}
                  placeholder="Assigned person name"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="banking-location">Bank location</Label>
                <Input
                  id="banking-location"
                  value={bankLocation}
                  onChange={(e) => setBankLocation(e.target.value)}
                  placeholder="Branch / bank office location"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="banking-remarks">Remarks</Label>
                <Textarea
                  id="banking-remarks"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Enter remarks"
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="banking-documents">Bank documents</Label>
                <Input
                  id="banking-documents"
                  type="file"
                  multiple
                  accept="image/*,.pdf,application/pdf"
                  onChange={(e) => {
                    const list = Array.from(e.target.files || [])
                    if (list.length === 0) return
                    setDocs((prev) => [
                      ...prev,
                      ...list.map((file) => ({ file, url: URL.createObjectURL(file), name: file.name })),
                    ])
                    e.target.value = ""
                  }}
                />
                {docs.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Optional. Upload bank documents if you have them.</p>
                ) : (
                  <ul className="space-y-1.5 rounded-md border border-border/60 p-2">
                    {docs.map((doc, index) => (
                      <li key={`${doc.name}-${index}`} className="flex items-center justify-between gap-2 text-xs">
                        <a
                          href={doc.url}
                          target="_blank"
                          rel="noreferrer"
                          className="truncate text-primary underline-offset-2 hover:underline"
                        >
                          {doc.name}
                        </a>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 shrink-0"
                          onClick={() => {
                            setDocs((prev) => {
                              const next = [...prev]
                              const [removed] = next.splice(index, 1)
                              if (removed?.url.startsWith("blob:")) {
                                try {
                                  URL.revokeObjectURL(removed.url)
                                } catch {
                                  // ignore
                                }
                              }
                              return next
                            })
                          }}
                        >
                          Remove
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="outline" onClick={closeSubmit} disabled={saving}>
                  Cancel
                </Button>
                <Button type="button" onClick={() => void handleSubmit()} disabled={saving}>
                  {saving ? "Submitting..." : "Submit"}
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </Card>
  )
}
