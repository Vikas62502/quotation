"use client"

import { useEffect, useMemo, useState } from "react"
import type { Quotation } from "@/lib/quotation-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Route, Search } from "lucide-react"
import { formatYmdLocal } from "@/lib/calling-report-date-range"
import { formatPersonName } from "@/lib/name-display"
import { cn } from "@/lib/utils"
import {
  formatJourneyStageStatusLabel,
  getJourneyFileLoginLabel,
  getJourneyFilterDate,
  getJourneyHoldInfo,
  getJourneyStageProgress,
  hasJourneyFileLoginStatus,
  matchesCustomerJourneySearch,
  matchesJourneyDateRangeFilter,
  type JourneyDateRangeFilter,
  type JourneyStageStatus,
} from "@/lib/customer-journey"

const HOLD_CARD_DEFAULT =
  "rounded-2xl border-teal-200/80 bg-gradient-to-b from-white via-cyan-50/25 to-teal-50/45 shadow-sm overflow-hidden"

function statusBadgeClass(status: JourneyStageStatus) {
  if (status === "completed") {
    return "border border-emerald-300/80 bg-gradient-to-r from-emerald-100 to-teal-50 text-emerald-800"
  }
  if (status === "in_progress") {
    return "border border-amber-300/80 bg-gradient-to-r from-amber-100 to-orange-50 text-amber-900"
  }
  return "border border-slate-200 bg-slate-50 text-slate-500"
}

function stageShellClass(status: JourneyStageStatus) {
  if (status === "completed") {
    return "border-emerald-200/80 bg-gradient-to-b from-white to-emerald-50/70 shadow-[0_0_12px_-4px_rgba(16,185,129,0.35)]"
  }
  if (status === "in_progress") {
    return "border-amber-200/80 bg-gradient-to-b from-white to-amber-50/70 shadow-[0_0_12px_-4px_rgba(245,158,11,0.3)]"
  }
  return "border-slate-200/70 bg-white/80"
}

type CustomerJourneyPanelProps = {
  quotations: Quotation[]
  title?: string
  description?: string
  emptyMessage?: string
  maxHeightClassName?: string
  showDealerDetails?: boolean
  className?: string
  resolveDealerDetails?: (quotation: Quotation) => { name: string; mobile?: string } | null
}

export function CustomerJourneyPanel({
  quotations,
  title = "Customer Journey",
  description = "Track where each customer file is in the workflow.",
  emptyMessage = "No quotations found.",
  maxHeightClassName = "max-h-[520px]",
  showDealerDetails = false,
  className,
  resolveDealerDetails,
}: CustomerJourneyPanelProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [dateFilter, setDateFilter] = useState<JourneyDateRangeFilter>("this_month")
  const [customFromDate, setCustomFromDate] = useState("")
  const [customToDate, setCustomToDate] = useState("")

  useEffect(() => {
    if (dateFilter !== "custom") return
    if (customFromDate && customToDate) return
    const today = formatYmdLocal(new Date())
    setCustomFromDate(today)
    setCustomToDate(today)
  }, [dateFilter, customFromDate, customToDate])

  const rows = useMemo(() => {
    const sorted = [...quotations].sort(
      (a, b) =>
        new Date(getJourneyFilterDate(b)?.getTime() || b.createdAt || 0).getTime() -
        new Date(getJourneyFilterDate(a)?.getTime() || a.createdAt || 0).getTime(),
    )
    return sorted
      .filter((quotation) => hasJourneyFileLoginStatus(quotation))
      .filter((quotation) => matchesJourneyDateRangeFilter(quotation, dateFilter, customFromDate, customToDate))
      .filter((quotation) => matchesCustomerJourneySearch(quotation, searchTerm))
  }, [quotations, searchTerm, dateFilter, customFromDate, customToDate])

  const hasActiveFilters =
    Boolean(searchTerm.trim()) || dateFilter !== "all" || (dateFilter === "custom" && (customFromDate || customToDate))

  return (
    <Card className={cn(HOLD_CARD_DEFAULT, className)}>
      <CardHeader>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl border border-teal-200 bg-gradient-to-br from-teal-100 via-cyan-50 to-sky-100 flex items-center justify-center shrink-0 shadow-[0_0_14px_-4px_rgba(20,184,166,0.55)]">
            <Route className="w-5 h-5 text-teal-700" />
          </div>
          <div className="min-w-0">
            <CardTitle className="text-teal-950">{title}</CardTitle>
            <CardDescription className="text-teal-900/70">{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 mb-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-teal-500/80" />
              <Input
                placeholder="Search by name, mobile, quotation id, stage..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 border-teal-200 bg-gradient-to-r from-white to-teal-50/50 focus-visible:ring-teal-200"
              />
            </div>
            <Select value={dateFilter} onValueChange={(v) => setDateFilter(v as JourneyDateRangeFilter)}>
              <SelectTrigger className="w-full sm:w-52 border-cyan-200 bg-white/90">
                <SelectValue placeholder="Date range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All time</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="yesterday">Yesterday</SelectItem>
                <SelectItem value="week">This week</SelectItem>
                <SelectItem value="this_month">This month</SelectItem>
                <SelectItem value="last_month">Last month</SelectItem>
                <SelectItem value="year">This year</SelectItem>
                <SelectItem value="custom">Custom date range</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {dateFilter === "custom" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">From</Label>
                <Input type="date" value={customFromDate} onChange={(e) => setCustomFromDate(e.target.value)} className="border-teal-200 bg-white" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">To</Label>
                <Input type="date" value={customToDate} onChange={(e) => setCustomToDate(e.target.value)} className="border-teal-200 bg-white" />
              </div>
            </div>
          ) : null}
        </div>
        {rows.length === 0 ? (
          <div className="text-sm text-teal-900/70 space-y-2 rounded-2xl border border-dashed border-teal-200 bg-gradient-to-b from-white to-teal-50/40 px-4 py-8 text-center">
            <p>{emptyMessage}</p>
            {hasActiveFilters ? (
              <Button
                type="button"
                variant="link"
                className="h-auto p-0 text-teal-700"
                onClick={() => {
                  setSearchTerm("")
                  setDateFilter("this_month")
                  setCustomFromDate("")
                  setCustomToDate("")
                }}
              >
                Clear filters
              </Button>
            ) : null}
          </div>
        ) : (
          <div className={`${maxHeightClassName} overflow-y-auto space-y-2.5 pr-1`}>
            {rows.map((quotation) => {
              const hold = getJourneyHoldInfo(quotation)
              const progress = getJourneyStageProgress(quotation)
              const fileLoginLabel = getJourneyFileLoginLabel(quotation)
              const qAny = quotation as unknown as Record<string, unknown>
              const nestedDealer = qAny.dealer as Record<string, unknown> | undefined
              const fallbackDealerName = formatPersonName(
                nestedDealer?.firstName as string | undefined,
                nestedDealer?.lastName as string | undefined,
                "",
              )
              const fallbackDealerMobile =
                typeof nestedDealer?.mobile === "string" && nestedDealer.mobile.trim()
                  ? nestedDealer.mobile.trim()
                  : undefined
              const resolvedDealer = resolveDealerDetails?.(quotation)
              const dealerName = resolvedDealer?.name || fallbackDealerName || "Unknown Dealer"
              const dealerMobile = resolvedDealer?.mobile || fallbackDealerMobile || "—"
              return (
                <div
                  key={quotation.id}
                  className="rounded-2xl border border-teal-200/80 border-l-4 border-l-teal-400 bg-gradient-to-r from-teal-50/70 via-white to-cyan-50/40 px-3 py-2.5 space-y-2.5 shadow-sm"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {formatPersonName(
                          quotation.customer?.firstName,
                          quotation.customer?.lastName,
                          "Unknown",
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {quotation.customer?.mobile || "No mobile"} • {quotation.id}
                      </p>
                      {showDealerDetails ? (
                        <p className="text-xs text-muted-foreground">
                          Dealer: {dealerName} • {dealerMobile}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="text-xs border-amber-200 bg-amber-50 text-amber-900">
                        File login: {fileLoginLabel}
                      </Badge>
                      <Badge variant="outline" className="text-xs border-violet-200 bg-violet-50 text-violet-800">
                        {hold.holder}
                      </Badge>
                      <Badge
                        variant="outline"
                        className="text-xs border-emerald-300 bg-gradient-to-r from-emerald-100 to-teal-50 text-emerald-800"
                      >
                        {hold.stageLabel}
                      </Badge>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
                    {[
                      { label: "Admin Approval", status: progress.adminApproval, stage: "adminApproval" as const },
                      { label: "Installation", status: progress.installation, stage: "installation" as const },
                      { label: "Metering", status: progress.metering, stage: "metering" as const },
                      { label: "Final Confirmation", status: progress.finalConfirmation, stage: "finalConfirmation" as const },
                    ].map((item) => (
                      <div
                        key={item.label}
                        className={cn(
                          "rounded-xl border px-2 py-1.5 flex items-center justify-between gap-2",
                          stageShellClass(item.status),
                        )}
                      >
                        <span className="text-[11px] text-muted-foreground">{item.label}</span>
                        <Badge className={cn("text-[10px]", statusBadgeClass(item.status))}>
                          {formatJourneyStageStatusLabel(item.status, item.stage)}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
