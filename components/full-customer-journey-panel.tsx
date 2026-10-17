"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import type { Quotation } from "@/lib/quotation-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ChevronDown, ChevronRight, Filter, Phone, Route, Search, Share2 } from "lucide-react"
import { formatYmdLocal } from "@/lib/calling-report-date-range"
import { formatPersonName } from "@/lib/name-display"
import { cn } from "@/lib/utils"
import {
  getJourneyDateRangeBounds,
  matchesJourneyDateRangeFilter,
  type JourneyDateRangeFilter,
  type JourneyStageStatus,
} from "@/lib/customer-journey"
import {
  buildFullCustomerJourneyRows,
  formatFullJourneyStageLabel,
  formatJourneyStageDateTime,
  FULL_JOURNEY_STAGE_LABELS,
  matchesFullJourneyDateRange,
  matchesFullJourneySearch,
  matchesJourneyCallingSourceFilter,
  matchesJourneyConnectionFilter,
  matchesJourneyDealerFilter,
  matchesJourneyOutcomeFilter,
  rowHasCallingData,
  rowHasSocialMediaCalling,
  type FullCustomerJourneyRow,
  type FullJourneyStageKey,
  type JourneyCallingAction,
  type JourneyCallingSourceFilter,
  type JourneyConnectionFilter,
  type JourneyOutcomeFilter,
} from "@/lib/full-customer-journey"
import {
  CALLING_CONNECTION_LABELS,
  CALLING_SUMMARY_BUCKET_LABELS,
} from "@/lib/calling-action-summary"
import { useIncrementalList } from "@/hooks/use-incremental-list"
import { IncrementalListSentinel } from "@/components/incremental-list-sentinel"

const JOURNEY_LIST_BATCH_SIZE = 20

const JOURNEY_CARD_DEFAULT =
  "rounded-2xl border-teal-200/80 bg-gradient-to-b from-white via-cyan-50/30 to-teal-50/50 shadow-sm overflow-hidden"

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

function sourceBadgeForRow(row: FullCustomerJourneyRow) {
  if (!rowHasCallingData(row)) {
    return {
      label: "Quotation",
      className: "border-sky-300/80 bg-gradient-to-r from-sky-100 to-cyan-50 text-sky-800",
      Icon: Route,
    }
  }
  if (rowHasSocialMediaCalling(row)) {
    return {
      label: "Social Media",
      className:
        "border-fuchsia-300/80 bg-gradient-to-r from-fuchsia-100 to-violet-50 text-fuchsia-800 shadow-[0_0_10px_-3px_rgba(217,70,239,0.45)]",
      Icon: Share2,
    }
  }
  return {
    label: "Calling data",
    className:
      "border-cyan-300/80 bg-gradient-to-r from-cyan-100 to-sky-50 text-cyan-800 shadow-[0_0_10px_-3px_rgba(6,182,212,0.4)]",
    Icon: Phone,
  }
}

const STAGE_ORDER: FullJourneyStageKey[] = [
  "callingData",
  "callingAction",
  "quotation",
  "adminApproval",
  "installation",
  "metering",
  "finalConfirmation",
]

type JourneyDealerOption = {
  id: string
  label: string
}

export type JourneyDateRangeChange = {
  dateFilter: JourneyDateRangeFilter
  customFromDate: string
  customToDate: string
}

type FullCustomerJourneyPanelProps = {
  quotations: Quotation[]
  callingActions: JourneyCallingAction[]
  title?: string
  description?: string
  emptyMessage?: string
  maxHeightClassName?: string
  showDealerDetails?: boolean
  /** When provided, shows an All dealers / dealer dropdown filter (admin). */
  dealers?: JourneyDealerOption[]
  resolveDealerDetails?: (quotation: Quotation | undefined, rowDealerId?: string) => {
    name: string
    mobile?: string
  } | null
  isLoading?: boolean
  /** Parent can fetch extra calling-actions for this search (e.g. by mobile). */
  onSearchChange?: (term: string) => void
  /** Notify parent when date filter changes so it can load a scoped API range. */
  onDateRangeChange?: (range: JourneyDateRangeChange) => void
  /** Initial date filter (defaults to Today for fast first paint). */
  initialDateFilter?: JourneyDateRangeFilter
  className?: string
}

export function FullCustomerJourneyPanel({
  quotations,
  callingActions,
  title = "Customer Journey",
  description = "Full path from Calling Data → Calling Action → Quotation → Final Confirmation.",
  emptyMessage = "No customer journey records found.",
  maxHeightClassName = "max-h-[640px]",
  showDealerDetails = false,
  dealers,
  resolveDealerDetails,
  isLoading = false,
  onSearchChange,
  onDateRangeChange,
  initialDateFilter = "today",
  className,
}: FullCustomerJourneyPanelProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [dateFilter, setDateFilter] = useState<JourneyDateRangeFilter>(initialDateFilter)
  const [customFromDate, setCustomFromDate] = useState("")
  const [customToDate, setCustomToDate] = useState("")
  const [callingSourceFilter, setCallingSourceFilter] = useState<JourneyCallingSourceFilter>("all")
  const [connectionFilter, setConnectionFilter] = useState<JourneyConnectionFilter>("all")
  const [outcomeFilter, setOutcomeFilter] = useState<JourneyOutcomeFilter>("all")
  const [dealerFilter, setDealerFilter] = useState("all")
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const scrollRootRef = useRef<HTMLDivElement | null>(null)
  const lastNotifiedRangeRef = useRef("")

  const showDealerFilter = Array.isArray(dealers) && dealers.length > 0

  useEffect(() => {
    onSearchChange?.(searchTerm)
  }, [searchTerm, onSearchChange])

  useEffect(() => {
    if (!showDealerFilter) return
    if (dealerFilter === "all") return
    if (dealers.some((d) => d.id === dealerFilter)) return
    setDealerFilter("all")
  }, [dealers, dealerFilter, showDealerFilter])

  useEffect(() => {
    if (dateFilter !== "custom") return
    if (customFromDate && customToDate) return
    const today = formatYmdLocal(new Date())
    setCustomFromDate(today)
    setCustomToDate(today)
  }, [dateFilter, customFromDate, customToDate])

  useEffect(() => {
    if (!onDateRangeChange) return
    if (dateFilter === "custom" && (!customFromDate || !customToDate)) return
    const key = `${dateFilter}|${customFromDate}|${customToDate}`
    if (lastNotifiedRangeRef.current === key) return
    lastNotifiedRangeRef.current = key
    onDateRangeChange({ dateFilter, customFromDate, customToDate })
  }, [dateFilter, customFromDate, customToDate, onDateRangeChange])

  // Scope inputs before the expensive merge so Today (and other ranges) stay fast.
  const scopedQuotations = useMemo(() => {
    if (dateFilter === "all") return quotations
    return quotations.filter((q) => matchesJourneyDateRangeFilter(q, dateFilter, customFromDate, customToDate))
  }, [quotations, dateFilter, customFromDate, customToDate])

  const scopedCallingActions = useMemo(() => {
    if (dateFilter === "all") return callingActions
    const bounds = getJourneyDateRangeBounds(dateFilter, customFromDate, customToDate)
    if (!bounds) return callingActions
    return callingActions.filter((action) => {
      const d = action.actionAt ? new Date(action.actionAt) : null
      if (!d || Number.isNaN(d.getTime())) return false
      return d.getTime() >= bounds.start.getTime() && d.getTime() <= bounds.end.getTime()
    })
  }, [callingActions, dateFilter, customFromDate, customToDate])

  const baseRows = useMemo(() => {
    return buildFullCustomerJourneyRows({
      quotations: scopedQuotations,
      callingActions: scopedCallingActions,
    })
      .filter((row) => matchesFullJourneyDateRange(row, dateFilter, customFromDate, customToDate))
      .filter((row) => matchesJourneyConnectionFilter(row, connectionFilter))
      .filter((row) => matchesJourneyOutcomeFilter(row, outcomeFilter))
      .filter((row) => matchesJourneyDealerFilter(row, dealerFilter))
      .filter((row) => matchesFullJourneySearch(row, searchTerm))
  }, [
    scopedQuotations,
    scopedCallingActions,
    searchTerm,
    dateFilter,
    customFromDate,
    customToDate,
    connectionFilter,
    outcomeFilter,
    dealerFilter,
  ])

  const sourceCounts = useMemo(() => {
    let social = 0
    let calling = 0
    let quotationOnly = 0
    for (const row of baseRows) {
      if (!rowHasCallingData(row)) {
        quotationOnly += 1
      } else if (rowHasSocialMediaCalling(row)) {
        social += 1
      } else {
        calling += 1
      }
    }
    return {
      all: baseRows.length,
      social,
      calling,
      quotationOnly,
    }
  }, [baseRows])

  const rows = useMemo(() => {
    return baseRows.filter((row) => matchesJourneyCallingSourceFilter(row, callingSourceFilter))
  }, [baseRows, callingSourceFilter])

  const listResetKey = [
    searchTerm,
    dateFilter,
    customFromDate,
    customToDate,
    callingSourceFilter,
    connectionFilter,
    outcomeFilter,
    dealerFilter,
    rows.length,
    rows[0]?.id ?? "",
  ].join("|")

  const {
    visibleItems,
    visibleCount,
    totalCount,
    hasMore,
    loadMore,
    sentinelRef,
  } = useIncrementalList(rows, {
    batchSize: JOURNEY_LIST_BATCH_SIZE,
    resetKey: listResetKey,
    rootRef: scrollRootRef,
    enabled: !isLoading && rows.length > 0,
  })

  const hasActiveFilters =
    dateFilter !== "all" ||
    callingSourceFilter !== "all" ||
    connectionFilter !== "all" ||
    outcomeFilter !== "all" ||
    dealerFilter !== "all" ||
    Boolean(searchTerm.trim())

  const hasModalFilters =
    dateFilter !== "all" ||
    callingSourceFilter !== "all" ||
    connectionFilter !== "all" ||
    outcomeFilter !== "all" ||
    dealerFilter !== "all"

  const activeModalFilterCount = [
    dateFilter !== "all",
    callingSourceFilter !== "all",
    connectionFilter !== "all",
    outcomeFilter !== "all",
    dealerFilter !== "all",
  ].filter(Boolean).length

  const clearFilters = () => {
    setSearchTerm("")
    setDateFilter("today")
    setCustomFromDate("")
    setCustomToDate("")
    setCallingSourceFilter("all")
    setConnectionFilter("all")
    setOutcomeFilter("all")
    setDealerFilter("all")
  }

  const clearModalFilters = () => {
    setDateFilter("today")
    setCustomFromDate("")
    setCustomToDate("")
    setCallingSourceFilter("all")
    setConnectionFilter("all")
    setOutcomeFilter("all")
    setDealerFilter("all")
  }

  const selectedDealerLabel =
    dealerFilter === "all"
      ? "All dealers"
      : dealers?.find((d) => d.id === dealerFilter)?.label || "Dealer"

  const dateFilterLabel =
    dateFilter === "all"
      ? "All time"
      : dateFilter === "custom"
        ? "Custom"
        : dateFilter === "today"
          ? "Today"
          : dateFilter.replace(/_/g, " ")

  return (
    <Card className={cn(JOURNEY_CARD_DEFAULT, className)}>
      <CardHeader className="space-y-3 p-3 sm:p-6 pb-3">
        <div className="flex items-start gap-2.5 sm:gap-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl border border-teal-200 bg-gradient-to-br from-teal-100 via-cyan-50 to-sky-100 flex items-center justify-center shrink-0 shadow-[0_0_14px_-4px_rgba(20,184,166,0.55)]">
            <Route className="w-4 h-4 sm:w-5 sm:h-5 text-teal-700" />
          </div>
          <div className="min-w-0">
            <CardTitle className="text-base sm:text-lg text-teal-950">{title}</CardTitle>
            <CardDescription className="mt-0.5 text-xs sm:text-sm text-teal-900/70 line-clamp-2 sm:line-clamp-none">
              {description}
            </CardDescription>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-2">
          <div className="rounded-xl border border-teal-200/80 bg-gradient-to-b from-white to-teal-50/70 px-2.5 sm:px-3 py-2 shadow-sm">
            <p className="text-[10px] uppercase tracking-wide text-teal-800/70">All</p>
            <p className="text-base sm:text-lg font-semibold tabular-nums text-teal-950">{sourceCounts.all}</p>
          </div>
          <div className="rounded-xl border border-fuchsia-200/80 bg-gradient-to-b from-white to-fuchsia-50/70 px-2.5 sm:px-3 py-2 shadow-[0_0_14px_-6px_rgba(217,70,239,0.45)]">
            <p className="text-[10px] uppercase tracking-wide text-fuchsia-800/70 flex items-center gap-1">
              <Share2 className="w-3 h-3 shrink-0" />
              <span className="truncate">Social</span>
            </p>
            <p className="text-base sm:text-lg font-semibold tabular-nums text-fuchsia-950">{sourceCounts.social}</p>
          </div>
          <div className="rounded-xl border border-cyan-200/80 bg-gradient-to-b from-white to-cyan-50/70 px-2.5 sm:px-3 py-2 shadow-[0_0_14px_-6px_rgba(6,182,212,0.4)]">
            <p className="text-[10px] uppercase tracking-wide text-cyan-800/70 flex items-center gap-1">
              <Phone className="w-3 h-3 shrink-0" />
              <span className="truncate">Calling</span>
            </p>
            <p className="text-base sm:text-lg font-semibold tabular-nums text-cyan-950">{sourceCounts.calling}</p>
          </div>
          <div className="rounded-xl border border-sky-200/80 bg-gradient-to-b from-white to-sky-50/70 px-2.5 sm:px-3 py-2 shadow-sm">
            <p className="text-[10px] uppercase tracking-wide text-sky-800/70 truncate">Quotation</p>
            <p className="text-base sm:text-lg font-semibold tabular-nums text-sky-950">{sourceCounts.quotationOnly}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-3 sm:p-6 pt-0">
        <div className="space-y-3 mb-3">
          <div className="grid grid-cols-3 gap-1 sm:flex sm:flex-wrap sm:gap-1.5 rounded-xl border border-teal-100 bg-gradient-to-r from-teal-50/70 via-white to-fuchsia-50/60 p-1 shadow-sm">
            {(
              [
                {
                  key: "all" as const,
                  label: `All (${sourceCounts.all})`,
                  shortLabel: `All (${sourceCounts.all})`,
                  activeClass: "border-teal-200 bg-gradient-to-r from-teal-100 to-cyan-50 text-teal-900",
                },
                {
                  key: "social" as const,
                  label: `Social Media (${sourceCounts.social})`,
                  shortLabel: `Social (${sourceCounts.social})`,
                  activeClass:
                    "border-fuchsia-300 bg-gradient-to-r from-fuchsia-100 to-violet-50 text-fuchsia-900 shadow-[0_0_12px_-4px_rgba(217,70,239,0.5)]",
                },
                {
                  key: "normal" as const,
                  label: `Calling data (${sourceCounts.calling})`,
                  shortLabel: `Calling (${sourceCounts.calling})`,
                  activeClass:
                    "border-cyan-300 bg-gradient-to-r from-cyan-100 to-sky-50 text-cyan-900 shadow-[0_0_12px_-4px_rgba(6,182,212,0.45)]",
                },
              ] as const
            ).map((item) => (
              <Button
                key={item.key}
                type="button"
                size="sm"
                variant="ghost"
                className={cn(
                  "h-10 sm:h-8 px-1.5 sm:px-3 text-[11px] sm:text-xs text-slate-600 hover:bg-white/80 justify-center",
                  callingSourceFilter === item.key && `border shadow-sm hover:opacity-95 ${item.activeClass}`,
                )}
                onClick={() => setCallingSourceFilter(item.key)}
              >
                {item.key === "social" ? <Share2 className="w-3.5 h-3.5 mr-0.5 sm:mr-1 shrink-0" /> : null}
                {item.key === "normal" ? <Phone className="w-3.5 h-3.5 mr-0.5 sm:mr-1 shrink-0" /> : null}
                <span className="sm:hidden truncate">{item.shortLabel}</span>
                <span className="hidden sm:inline">{item.label}</span>
              </Button>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-teal-500/80" />
              <Input
                placeholder="Search name, mobile, ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-11 sm:h-9 pl-9 border-teal-200 bg-gradient-to-r from-white to-teal-50/50 focus-visible:ring-teal-200 text-base sm:text-sm"
              />
            </div>
            <Select value={dateFilter} onValueChange={(v) => setDateFilter(v as JourneyDateRangeFilter)}>
              <SelectTrigger className="h-11 sm:h-9 w-full sm:w-[11rem] shrink-0 border-cyan-200 bg-white/90 text-base sm:text-sm">
                <SelectValue placeholder="Date" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="yesterday">Yesterday</SelectItem>
                <SelectItem value="week">This week</SelectItem>
                <SelectItem value="this_month">This month</SelectItem>
                <SelectItem value="last_month">Last month</SelectItem>
                <SelectItem value="year">This year</SelectItem>
                <SelectItem value="custom">Custom date range</SelectItem>
                <SelectItem value="all">All time</SelectItem>
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              className="h-11 sm:h-9 w-full sm:w-auto shrink-0 border-violet-200 bg-gradient-to-r from-violet-50 to-fuchsia-50 text-violet-800 hover:from-violet-100 hover:to-fuchsia-100"
              onClick={() => setFiltersOpen(true)}
            >
              <Filter className="w-4 h-4 mr-2" />
              Filters
              {activeModalFilterCount > 0 ? (
                <Badge className="ml-2 h-5 min-w-5 justify-center px-1.5 text-[10px] border border-violet-300 bg-violet-100 text-violet-800">
                  {activeModalFilterCount}
                </Badge>
              ) : null}
            </Button>
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
          {hasModalFilters || dateFilter !== "all" ? (
            <div className="flex flex-wrap items-center gap-2">
              {dateFilter !== "all" ? (
                <Badge variant="outline" className="text-xs font-normal border-cyan-200 bg-cyan-50 text-cyan-800">
                  Date: {dateFilterLabel}
                </Badge>
              ) : null}
              {showDealerFilter && dealerFilter !== "all" ? (
                <Badge variant="outline" className="text-xs font-normal border-amber-200 bg-amber-50 text-amber-900">
                  Dealer: {selectedDealerLabel}
                </Badge>
              ) : null}
              {callingSourceFilter !== "all" ? (
                <Badge
                  variant="outline"
                  className={cn(
                    "text-xs font-normal",
                    callingSourceFilter === "social"
                      ? "border-fuchsia-300 bg-fuchsia-50 text-fuchsia-800"
                      : "border-cyan-300 bg-cyan-50 text-cyan-800",
                  )}
                >
                  {callingSourceFilter === "social"
                    ? "Social Media"
                    : callingSourceFilter === "normal"
                      ? "Calling data"
                      : callingSourceFilter === "calling_data"
                        ? "Calling Data"
                        : "Not Calling Data"}
                </Badge>
              ) : null}
              {connectionFilter !== "all" ? (
                <Badge variant="outline" className="text-xs font-normal border-emerald-200 bg-emerald-50 text-emerald-800">
                  {CALLING_CONNECTION_LABELS[connectionFilter]}
                </Badge>
              ) : null}
              {outcomeFilter !== "all" ? (
                <Badge variant="outline" className="text-xs font-normal border-violet-200 bg-violet-50 text-violet-800">
                  {CALLING_SUMMARY_BUCKET_LABELS[outcomeFilter]}
                </Badge>
              ) : null}
              <Button type="button" variant="link" className="h-auto p-0 text-xs text-teal-700" onClick={clearModalFilters}>
                Reset to Today
              </Button>
            </div>
          ) : null}
        </div>

        <Dialog open={filtersOpen} onOpenChange={setFiltersOpen}>
          <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Customer Journey Filters</DialogTitle>
              <DialogDescription>
                Filter by date, dealer, calling source, connection, and calling action. Lists load 20 rows at a
                time — scroll for more.
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs text-muted-foreground">Date range</Label>
                <Select value={dateFilter} onValueChange={(v) => setDateFilter(v as JourneyDateRangeFilter)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Date range" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="yesterday">Yesterday</SelectItem>
                    <SelectItem value="week">This week</SelectItem>
                    <SelectItem value="this_month">This month</SelectItem>
                    <SelectItem value="last_month">Last month</SelectItem>
                    <SelectItem value="year">This year</SelectItem>
                    <SelectItem value="custom">Custom date range</SelectItem>
                    <SelectItem value="all">All time</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {dateFilter === "custom" ? (
                <>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">From</Label>
                    <Input type="date" value={customFromDate} onChange={(e) => setCustomFromDate(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">To</Label>
                    <Input type="date" value={customToDate} onChange={(e) => setCustomToDate(e.target.value)} />
                  </div>
                </>
              ) : null}
              {showDealerFilter ? (
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs text-muted-foreground">Dealer</Label>
                  <Select value={dealerFilter} onValueChange={setDealerFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Dealer" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All dealers</SelectItem>
                      {dealers.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Source</Label>
                <Select
                  value={
                    callingSourceFilter === "calling_data" || callingSourceFilter === "not_calling_data"
                      ? "all"
                      : callingSourceFilter
                  }
                  onValueChange={(v) => setCallingSourceFilter(v as JourneyCallingSourceFilter)}
                >
                  <SelectTrigger className="border-teal-200 bg-white">
                    <SelectValue placeholder="Source" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All sources</SelectItem>
                    <SelectItem value="social">Social Media</SelectItem>
                    <SelectItem value="normal">Calling data</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Connection</Label>
                <Select
                  value={connectionFilter}
                  onValueChange={(v) => setConnectionFilter(v as JourneyConnectionFilter)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Connection" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All connections</SelectItem>
                    <SelectItem value="connected">{CALLING_CONNECTION_LABELS.connected}</SelectItem>
                    <SelectItem value="not_connected">{CALLING_CONNECTION_LABELS.not_connected}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs text-muted-foreground">Calling action</Label>
                <Select
                  value={outcomeFilter}
                  onValueChange={(v) => setOutcomeFilter(v as JourneyOutcomeFilter)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Calling action" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All calling actions</SelectItem>
                    <SelectItem value="interested">{CALLING_SUMMARY_BUCKET_LABELS.interested}</SelectItem>
                    <SelectItem value="followUp">{CALLING_SUMMARY_BUCKET_LABELS.followUp}</SelectItem>
                    <SelectItem value="notInterested">{CALLING_SUMMARY_BUCKET_LABELS.notInterested}</SelectItem>
                    <SelectItem value="others">{CALLING_SUMMARY_BUCKET_LABELS.others}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={clearModalFilters}>
                Reset to Today
              </Button>
              <Button type="button" onClick={() => setFiltersOpen(false)}>
                Done
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {isLoading && rows.length === 0 ? (
          <p className="text-sm text-teal-900/70">Loading customer journey…</p>
        ) : rows.length === 0 ? (
          <div className="text-sm text-teal-900/70 space-y-2 rounded-2xl border border-dashed border-teal-200 bg-gradient-to-b from-white to-teal-50/40 px-4 py-8 text-center">
            <p>{emptyMessage}</p>
            {hasActiveFilters ? (
              <Button type="button" variant="link" className="h-auto p-0 text-teal-700" onClick={clearFilters}>
                Reset to Today
              </Button>
            ) : null}
          </div>
        ) : (
          <div ref={scrollRootRef} className={`${maxHeightClassName} overflow-y-auto space-y-2.5 pr-1`}>
            {isLoading ? (
              <p className="text-xs text-teal-800/70">Updating journey data…</p>
            ) : null}
            {visibleItems.map((row) => {
              const expanded = expandedId === row.id
              const resolved = resolveDealerDetails?.(row.quotation, row.dealerId)
              const dealerName =
                resolved?.name ||
                row.dealerName ||
                (row.quotation
                  ? formatPersonName(
                      (row.quotation as any).dealer?.firstName,
                      (row.quotation as any).dealer?.lastName,
                      "",
                    )
                  : "") ||
                "—"
              const dealerMobile = resolved?.mobile || "—"
              const source = sourceBadgeForRow(row)
              const SourceIcon = source.Icon
              const isSocial = source.label === "Social Media"
              const isCalling = source.label === "Calling data"

              return (
                <div
                  key={row.id}
                  className={cn(
                    "rounded-2xl border px-2.5 sm:px-3 py-2.5 space-y-2.5 shadow-sm transition-colors",
                    isSocial
                      ? "border-fuchsia-200/80 border-l-4 border-l-fuchsia-400 bg-gradient-to-r from-fuchsia-50/80 via-white to-violet-50/40"
                      : isCalling
                        ? "border-cyan-200/80 border-l-4 border-l-cyan-400 bg-gradient-to-r from-cyan-50/80 via-white to-sky-50/40"
                        : "border-sky-200/80 border-l-4 border-l-sky-400 bg-gradient-to-r from-sky-50/70 via-white to-teal-50/30",
                  )}
                >
                  <button
                    type="button"
                    className="w-full text-left flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
                    onClick={() => setExpandedId(expanded ? null : row.id)}
                  >
                    <div className="flex items-start gap-2 min-w-0">
                      {expanded ? (
                        <ChevronDown className="w-4 h-4 mt-0.5 shrink-0 text-teal-600" />
                      ) : (
                        <ChevronRight className="w-4 h-4 mt-0.5 shrink-0 text-teal-600/70" />
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate text-slate-900">{row.customerName}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {row.customerMobile || "No mobile"}
                          {row.quotationId ? ` • ${row.quotationId}` : ""}
                          {row.leadId ? ` • Lead ${row.leadId}` : ""}
                        </p>
                        {showDealerDetails ? (
                          <p className="text-xs text-muted-foreground">
                            Dealer: {dealerName} • {dealerMobile}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                      <Badge variant="outline" className={cn("text-xs gap-1", source.className)}>
                        <SourceIcon className="w-3 h-3" />
                        {source.label}
                      </Badge>
                      {row.fileLoginLabel ? (
                        <Badge variant="outline" className="text-xs border-amber-200 bg-amber-50 text-amber-900">
                          File login: {row.fileLoginLabel}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs border-slate-200 bg-slate-50 text-slate-600">
                          Calling
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-xs border-violet-200 bg-violet-50 text-violet-800">
                        {row.holdHolder}
                      </Badge>
                      <Badge
                        variant="outline"
                        className="text-xs border-emerald-300 bg-gradient-to-r from-emerald-100 to-teal-50 text-emerald-800"
                      >
                        {row.holdLabel}
                      </Badge>
                    </div>
                  </button>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-1.5 sm:gap-2">
                    {STAGE_ORDER.map((key) => (
                      <div
                        key={key}
                        className={cn(
                          "rounded-xl border px-1.5 sm:px-2 py-1.5 flex flex-col gap-1 min-w-0",
                          stageShellClass(row.stages[key]),
                        )}
                      >
                        <span className="text-[10px] text-muted-foreground leading-tight">
                          {FULL_JOURNEY_STAGE_LABELS[key]}
                        </span>
                        <Badge className={cn("text-[10px] w-fit", statusBadgeClass(row.stages[key]))}>
                          {formatFullJourneyStageLabel(row.stages[key], key)}
                        </Badge>
                        <span
                          className="text-[10px] text-muted-foreground leading-snug break-words"
                          title={row.stageDates[key] ? new Date(row.stageDates[key]!).toLocaleString() : undefined}
                        >
                          {formatJourneyStageDateTime(row.stageDates[key])}
                        </span>
                      </div>
                    ))}
                  </div>

                  {expanded ? (
                    <div className="rounded-xl border border-dashed border-teal-200 bg-gradient-to-b from-white to-teal-50/50 px-3 py-2 space-y-2">
                      <p className="text-xs font-medium text-teal-900/80">Stored journey timeline</p>
                      {row.timeline.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No timeline events yet.</p>
                      ) : (
                        <ol className="space-y-2">
                          {row.timeline.map((event) => (
                            <li key={event.id} className="flex gap-2 text-xs">
                              <span className="shrink-0 w-36 text-teal-700/70">
                                {new Date(event.at).toLocaleString()}
                              </span>
                              <div className="min-w-0">
                                <p className="font-medium text-slate-900">{event.label}</p>
                                {event.detail ? (
                                  <p className="text-muted-foreground break-words">{event.detail}</p>
                                ) : null}
                              </div>
                            </li>
                          ))}
                        </ol>
                      )}
                    </div>
                  ) : null}
                </div>
              )
            })}
            <IncrementalListSentinel
              sentinelRef={sentinelRef}
              visibleCount={visibleCount}
              totalCount={totalCount}
              hasMore={hasMore}
              onLoadMore={loadMore}
            />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
