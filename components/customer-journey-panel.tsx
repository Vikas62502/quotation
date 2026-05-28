"use client"

import { useEffect, useMemo, useState } from "react"
import type { Quotation } from "@/lib/quotation-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Search } from "lucide-react"
import { formatYmdLocal } from "@/lib/calling-report-date-range"
import { formatPersonName } from "@/lib/name-display"
import {
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

function statusBadgeClass(status: JourneyStageStatus) {
  if (status === "completed") return "bg-green-600 text-white"
  if (status === "in_progress") return "bg-amber-500 text-white"
  return "bg-muted text-muted-foreground"
}

function statusLabel(status: JourneyStageStatus) {
  if (status === "completed") return "Completed"
  if (status === "in_progress") return "In Progress"
  return "Pending"
}

type CustomerJourneyPanelProps = {
  quotations: Quotation[]
  title?: string
  description?: string
  emptyMessage?: string
  maxHeightClassName?: string
  showDealerDetails?: boolean
  resolveDealerDetails?: (quotation: Quotation) => { name: string; mobile?: string } | null
}

export function CustomerJourneyPanel({
  quotations,
  title = "Customer Journey",
  description = "Track where each customer file is in the workflow.",
  emptyMessage = "No quotations found.",
  maxHeightClassName = "max-h-[520px]",
  showDealerDetails = false,
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
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 mb-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, mobile, quotation id, stage..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={dateFilter} onValueChange={(v) => setDateFilter(v as JourneyDateRangeFilter)}>
              <SelectTrigger className="w-full sm:w-52">
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
                <Input type="date" value={customFromDate} onChange={(e) => setCustomFromDate(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">To</Label>
                <Input type="date" value={customToDate} onChange={(e) => setCustomToDate(e.target.value)} />
              </div>
            </div>
          ) : null}
        </div>
        {rows.length === 0 ? (
          <div className="text-sm text-muted-foreground space-y-2">
            <p>{emptyMessage}</p>
            {hasActiveFilters ? (
              <Button
                type="button"
                variant="link"
                className="h-auto p-0"
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
          <div className={`${maxHeightClassName} overflow-y-auto space-y-2 pr-1`}>
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
                <div key={quotation.id} className="rounded-md border border-border/60 px-3 py-2 space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">
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
                      <Badge variant="secondary" className="text-xs">
                        File login: {fileLoginLabel}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {hold.holder}
                      </Badge>
                      <Badge className="text-xs">{hold.stageLabel}</Badge>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
                    {[
                      { label: "Admin Approval", status: progress.adminApproval },
                      { label: "Installation", status: progress.installation },
                      { label: "Metering", status: progress.metering },
                      { label: "Final Confirmation", status: progress.finalConfirmation },
                    ].map((item) => (
                      <div
                        key={item.label}
                        className="rounded border border-border/60 px-2 py-1.5 flex items-center justify-between gap-2"
                      >
                        <span className="text-[11px] text-muted-foreground">{item.label}</span>
                        <Badge className={`text-[10px] ${statusBadgeClass(item.status)}`}>
                          {statusLabel(item.status)}
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
