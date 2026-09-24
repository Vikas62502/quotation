"use client"

import { useMemo, useState } from "react"
import type { Quotation } from "@/lib/quotation-context"
import { keepCurrentQuotationsOnly } from "@/lib/quotation-current"
import {
  BANKING_SUB_TABS,
  buildBankingRows,
  type BankingPaymentRow,
  type BankingSubTab,
} from "@/lib/admin-banking"
import { statusAccentTextClass, statusBadgeClass, statusLabel, statusRowClass } from "@/lib/dealer-payment-summary"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Landmark, Search } from "lucide-react"
import { cn } from "@/lib/utils"

function formatInr(amount: number): string {
  return `₹${Math.round(amount || 0).toLocaleString("en-IN")}`
}

function formatDate(value?: string): string {
  if (!value) return "—"
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
}

type Props = {
  quotations: Quotation[]
  getDealerName: (dealerId: string, quotation?: Quotation) => string
  getDealerMobile: (dealerId: string, quotation?: Quotation) => string
  getBankDetails: (quotation: Quotation) => string
  onOpenDetails?: (quotation: Quotation) => void
}

const EMPTY_COPY: Record<BankingSubTab, string> = {
  pending_second:
    "No loan or cash + loan files with only the first loan installment paid. Partial Accounts rows with 2nd installment remaining appear here.",
  second_received: "No loan or cash + loan files with a second loan installment paid yet.",
  pending_first: "No loan or cash + loan files waiting for the first loan installment.",
  completed: "No loan or cash + loan files with the loan amount fully paid.",
}

function bankingVisualStatus(row: BankingPaymentRow): "pending" | "partial" | "completed" {
  if (row.stage === "completed" || row.loanRemaining <= 0) return "completed"
  if (row.stage === "pending_second" || row.stage === "second_received") return "partial"
  return "pending"
}

function BankingRowCard({
  row,
  dealerName,
  dealerMobile,
  bankDetails,
  onOpenDetails,
}: {
  row: BankingPaymentRow
  dealerName: string
  dealerMobile: string
  bankDetails: string
  onOpenDetails?: (quotation: Quotation) => void
}) {
  const visual = bankingVisualStatus(row)
  const showSecondPaid = row.stage === "completed" || row.stage === "second_received"
  const secondValue = showSecondPaid ? row.secondPaid : row.secondRemaining
  const secondIsZero = secondValue <= 0
  const secondClass =
    showSecondPaid || secondIsZero || visual === "completed"
      ? "text-emerald-700"
      : "text-amber-700"

  return (
    <div
      className={cn(
        "rounded-lg border px-3 py-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[minmax(13rem,1.4fr)_minmax(6.5rem,0.65fr)_minmax(7rem,0.75fr)_minmax(7.5rem,0.8fr)_minmax(7.5rem,0.75fr)_minmax(6rem,0.6fr)] gap-3 items-center",
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
          {visual === "completed" ? "Completed" : statusLabel(visual)}
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
      </div>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Bank</p>
        <p className="text-xs font-medium truncate" title={bankDetails}>
          {bankDetails}
        </p>
        <p className="text-[11px] text-muted-foreground mt-0.5">{formatDate(row.approvedAt || row.createdAt)}</p>
      </div>
      <div className="min-w-0 flex items-center justify-start lg:justify-end">
        {onOpenDetails ? (
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenDetails(row.quotation)}>
            Details
          </Button>
        ) : null}
      </div>
    </div>
  )
}

export function AdminBankingPanel({
  quotations,
  getDealerName,
  getDealerMobile,
  getBankDetails,
  onOpenDetails,
}: Props) {
  const [subTab, setSubTab] = useState<BankingSubTab>("pending_second")
  const [searchTerm, setSearchTerm] = useState("")

  const uniqueQuotations = useMemo(
    () => keepCurrentQuotationsOnly(quotations, quotations),
    [quotations],
  )

  const allRows = useMemo(() => buildBankingRows(uniqueQuotations), [uniqueQuotations])

  const counts = useMemo(() => {
    const next: Record<BankingSubTab, number> = {
      pending_second: 0,
      second_received: 0,
      pending_first: 0,
      completed: 0,
    }
    for (const row of allRows) next[row.stage] += 1
    return next
  }, [allRows])

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    return allRows.filter((row) => {
      if (row.stage !== subTab) return false
      if (!term) return true
      const dealerName = getDealerName(row.quotation.dealerId, row.quotation).toLowerCase()
      const dealerMobile = getDealerMobile(row.quotation.dealerId, row.quotation).toLowerCase()
      return (
        row.customerName.toLowerCase().includes(term) ||
        row.customerMobile.toLowerCase().includes(term) ||
        row.quotationId.toLowerCase().includes(term) ||
        dealerName.includes(term) ||
        dealerMobile.includes(term)
      )
    })
  }, [allRows, getDealerMobile, getDealerName, searchTerm, subTab])

  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex items-start gap-2">
          <Landmark className="w-5 h-5 text-primary mt-0.5 shrink-0" />
          <div>
            <CardTitle>Banking</CardTitle>
            <CardDescription>
              Loan and Cash + loan files from Accounts — loan amounts only. Pending Second installment is partial files
              with only the first loan installment paid. Loan remaining ₹0 is Completed (green).
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
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by customer, mobile, quotation ID, or dealer..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>

              {filtered.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <Landmark className="w-10 h-10 mx-auto mb-3 opacity-50" />
                  <p className="font-medium text-foreground">No files in {tab.label}</p>
                  <p className="text-sm mt-1 max-w-lg mx-auto">
                    {searchTerm.trim() ? "Try clearing search." : EMPTY_COPY[tab.value]}
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
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  )
}
