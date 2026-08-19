"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { DashboardNav } from "@/components/dashboard-nav"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { IndianRupee, Loader2, Search, Wallet } from "lucide-react"
import type { Quotation } from "@/lib/quotation-context"
import { api, apiErrorToUserMessage } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import {
  formatInstallmentHoverLine,
  summarizeQuotationPayment,
  statusAccentTextClass,
  statusBadgeClass,
  statusLabel,
  statusRowClass,
  type DealerPaymentRow,
  type DealerPaymentStatus,
} from "@/lib/dealer-payment-summary"
import {
  extractQuotationListFromApiResponse,
  flattenWrappedQuotationRow,
} from "@/lib/operational-install-queue"
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

export default function DealerPaymentsPage() {
  const { isAuthenticated, dealer, authReady } = useAuth()
  const router = useRouter()
  const { toast } = useToast()
  const [quotations, setQuotations] = useState<Quotation[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | DealerPaymentStatus>("all")
  const useApi = process.env.NEXT_PUBLIC_USE_API !== "false"

  useEffect(() => {
    if (!authReady) return
    if (!isAuthenticated) {
      router.push("/login")
    }
  }, [authReady, isAuthenticated, router])

  const loadQuotations = useCallback(async () => {
    setIsLoading(true)
    try {
      if (!useApi) {
        setQuotations([])
        return
      }
      // Prefer approved-only list (same source Account Management uses for payments).
      let response: unknown
      try {
        response = await api.quotations.getAll({ page: 1, limit: 1000, status: "approved" })
      } catch {
        response = await api.quotations.getAll({ page: 1, limit: 1000 })
      }
      const rawList = extractQuotationListFromApiResponse(response)
      const list = rawList.map((row) => flattenWrappedQuotationRow(row) as Quotation)

      const dealerId = String(dealer?.id || "").trim()
      const scoped = list.filter((q) => {
        const status = String(q.status || "").toLowerCase()
        if (status !== "approved") return false
        if (!dealerId) return true
        const qDealerId = String(q.dealerId || (q.dealer as { id?: string } | null)?.id || "").trim()
        return !qDealerId || qDealerId === dealerId
      })

      setQuotations(scoped)
    } catch (error) {
      setQuotations([])
      toast({
        title: "Could not load payments",
        description: apiErrorToUserMessage(error),
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }, [dealer?.id, toast, useApi])

  useEffect(() => {
    if (!authReady || !isAuthenticated) return
    void loadQuotations()
  }, [authReady, isAuthenticated, loadQuotations])

  const rows: DealerPaymentRow[] = useMemo(
    () =>
      quotations
        .map(summarizeQuotationPayment)
        .sort((a, b) => {
          const aTime = new Date(a.approvedAt || a.createdAt).getTime()
          const bTime = new Date(b.approvedAt || b.createdAt).getTime()
          return (Number.isFinite(bTime) ? bTime : 0) - (Number.isFinite(aTime) ? aTime : 0)
        }),
    [quotations],
  )

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    return rows.filter((row) => {
      if (statusFilter !== "all" && row.paymentStatus !== statusFilter) return false
      if (!term) return true
      return (
        row.customerName.toLowerCase().includes(term) ||
        row.customerMobile.toLowerCase().includes(term) ||
        row.quotationId.toLowerCase().includes(term)
      )
    })
  }, [rows, searchTerm, statusFilter])

  const stats = useMemo(() => {
    const totalPaid = filtered.reduce((sum, r) => sum + r.paidAmount, 0)
    const totalRemaining = filtered.reduce((sum, r) => sum + r.remainingAmount, 0)
    const totalSubtotal = filtered.reduce((sum, r) => sum + r.subtotal, 0)
    return {
      count: filtered.length,
      totalPaid,
      totalRemaining,
      totalSubtotal,
    }
  }, [filtered])

  if (!authReady || !isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardNav />

      <main className="container mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Payments</h1>
          <p className="text-muted-foreground text-sm">
            Approved quotations only — paid amounts, remaining balance, and Cash + loan split.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          <Card className="border-border/60 shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-sky-100 flex items-center justify-center shrink-0">
                <Wallet className="w-5 h-5 text-sky-700" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Approved quotations</p>
                <p className="text-xl font-bold tabular-nums">{stats.count}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/60 shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                <IndianRupee className="w-5 h-5 text-slate-700" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Total amount</p>
                <p className="text-xl font-bold tabular-nums truncate">{formatInr(stats.totalSubtotal)}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/60 shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                <IndianRupee className="w-5 h-5 text-emerald-700" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Total paid</p>
                <p className="text-xl font-bold tabular-nums text-emerald-700 truncate">
                  {formatInr(stats.totalPaid)}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/60 shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                <IndianRupee className="w-5 h-5 text-amber-700" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Total remaining</p>
                <p className="text-xl font-bold tabular-nums text-amber-700 truncate">
                  {formatInr(stats.totalRemaining)}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="space-y-3">
            <CardTitle className="text-base">Customer payments</CardTitle>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by customer, mobile, or quotation ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select
                value={statusFilter}
                onValueChange={(value) => setStatusFilter(value as "all" | DealerPaymentStatus)}
              >
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Payment status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All payment statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="partial">Partial</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
              <Button type="button" variant="outline" onClick={() => void loadQuotations()} disabled={isLoading}>
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Refresh"}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="py-12 flex flex-col items-center justify-center text-muted-foreground gap-2">
                <Loader2 className="w-6 h-6 animate-spin" />
                <p className="text-sm">Loading payment data...</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                <Wallet className="w-10 h-10 mx-auto mb-3 opacity-50" />
                <p className="font-medium text-foreground">No approved payments found</p>
                <p className="text-sm mt-1">
                  {searchTerm || statusFilter !== "all"
                    ? "Try clearing search or filters."
                    : "Only approved quotations appear here once Account Management records payments."}
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {filtered.map((row) => (
                  <div
                    key={row.quotationId}
                    className={cn(
                      "rounded-lg border px-3 py-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[minmax(12rem,1.4fr)_minmax(6rem,0.7fr)_minmax(6rem,0.7fr)_minmax(6.5rem,0.75fr)_minmax(6.5rem,0.75fr)_minmax(6rem,0.7fr)] gap-3 items-center transition-colors",
                      statusRowClass(row.paymentStatus),
                    )}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold leading-tight break-words">{row.customerName}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{row.customerMobile}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                        {row.quotationId}
                      </p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Amount</p>
                      <p className="text-sm font-semibold tabular-nums">{formatInr(row.subtotal)}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Paid</p>
                      {row.installments.length > 0 ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <p
                            className={cn(
                              "text-sm font-semibold tabular-nums cursor-help underline decoration-dotted underline-offset-2 inline-block",
                              statusAccentTextClass(row.paymentStatus),
                            )}
                          >
                            {formatInr(row.paidAmount)}
                          </p>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-[300px]">
                          <div className="space-y-1.5">
                            <p className="font-semibold">Installments</p>
                            {row.installments.map((phase) => (
                              <p key={`${row.quotationId}-paid-${phase.phaseNumber}`}>
                                {formatInstallmentHoverLine(phase)}
                              </p>
                            ))}
                            {row.paymentType === "mix" ? (
                              <div className="border-t border-border/40 pt-1.5 mt-1 space-y-0.5">
                                <p>Loan paid: {formatInr(row.loanPaid)}</p>
                                <p>Cash paid: {formatInr(row.cashPaid)}</p>
                              </div>
                            ) : null}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                      ) : (
                        <p
                          className={cn(
                            "text-sm font-semibold tabular-nums inline-block",
                            statusAccentTextClass(row.paymentStatus),
                          )}
                        >
                          {formatInr(row.paidAmount)}
                        </p>
                      )}
                      {row.paymentType === "mix" ? (
                        <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">
                          L {formatInr(row.loanPaid)} · C {formatInr(row.cashPaid)}
                        </p>
                      ) : null}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Remaining</p>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <p
                            className={cn(
                              "text-sm font-semibold tabular-nums cursor-help underline decoration-dotted underline-offset-2 inline-block",
                              statusAccentTextClass(row.paymentStatus),
                            )}
                          >
                            {formatInr(row.remainingAmount)}
                          </p>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-[300px]">
                          <div className="space-y-1.5">
                            <p className="font-semibold">Breakdown</p>
                            {row.paymentType === "mix" ? (
                              <>
                                <p>Loan remaining: {formatInr(row.loanRemaining)}</p>
                                <p>Cash remaining: {formatInr(row.cashRemaining)}</p>
                              </>
                            ) : (
                              <p>Remaining: {formatInr(row.remainingAmount)}</p>
                            )}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                      {row.paymentType === "mix" ? (
                        <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">
                          L {formatInr(row.loanRemaining)} · C {formatInr(row.cashRemaining)}
                        </p>
                      ) : null}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Type</p>
                      <p className="text-sm font-medium">{row.paymentTypeLabel}</p>
                      {row.paymentType === "mix" ? (
                        <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">
                          L {formatInr(row.loanAmount)} · C {formatInr(row.cashAmount)}
                        </p>
                      ) : row.paymentType === "loan" && row.loanAmount > 0 ? (
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          Loan {formatInr(row.loanAmount)}
                        </p>
                      ) : null}
                      <Badge variant="outline" className={cn("mt-1 text-[10px]", statusBadgeClass(row.paymentStatus))}>
                        {statusLabel(row.paymentStatus)}
                      </Badge>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Date</p>
                      <p className="text-xs font-medium">{formatDate(row.approvedAt || row.createdAt)}</p>
                      <p
                        className={cn(
                          "text-[11px] mt-0.5 font-medium capitalize",
                          statusAccentTextClass(row.paymentStatus),
                        )}
                      >
                        {statusLabel(row.paymentStatus)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
