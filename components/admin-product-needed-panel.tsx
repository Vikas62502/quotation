"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import type { Quotation } from "@/lib/quotation-context"
import type { Dealer } from "@/lib/auth-context"
import {
  aggregateProductNeededDashboard,
  formatProductNeededDate,
  type ProductNeededDateRange,
  type ProductNeededRow,
  type ProductNeededScope,
} from "@/lib/admin-product-needed"
import { downloadProductNeededExcel, PRODUCT_NEEDED_EXCEL_COLUMN_OPTIONS } from "@/lib/admin-product-needed-excel"
import {
  ExcelColumnPickerDialog,
  readRememberedExcelColumns,
  rememberExcelColumns,
} from "@/components/excel-column-picker-dialog"
import { formatYmdLocal } from "@/lib/calling-report-date-range"
import { loadAdminProductNeededRows } from "@/lib/load-admin-product-needed"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Download, Loader2, Package, RotateCcw, Search, Zap } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

const PRODUCT_NEEDED_CARD =
  "rounded-2xl border-orange-200/80 bg-gradient-to-b from-white via-amber-50/35 to-orange-50/45 shadow-sm overflow-hidden"

const BRAND_CARD_ACCENTS = [
  {
    card: "border-sky-200/70 hover:shadow-[0_8px_24px_-10px_rgba(14,165,233,0.4)]",
    cardBg: "linear-gradient(145deg, #e0f2fe 0%, #ffffff 45%, #ecfeff 100%)",
    edge: "linear-gradient(180deg, #38bdf8, #22d3ee, #818cf8)",
    qty: "text-sky-800",
    chip: "border-sky-200 bg-sky-50 text-sky-800",
  },
  {
    card: "border-violet-200/70 hover:shadow-[0_8px_24px_-10px_rgba(168,85,247,0.35)]",
    cardBg: "linear-gradient(145deg, #f3e8ff 0%, #ffffff 45%, #fdf4ff 100%)",
    edge: "linear-gradient(180deg, #c084fc, #e879f9, #f472b6)",
    qty: "text-violet-800",
    chip: "border-violet-200 bg-violet-50 text-violet-800",
  },
  {
    card: "border-teal-200/70 hover:shadow-[0_8px_24px_-10px_rgba(20,184,166,0.35)]",
    cardBg: "linear-gradient(145deg, #ccfbf1 0%, #ffffff 45%, #ecfdf5 100%)",
    edge: "linear-gradient(180deg, #2dd4bf, #34d399, #38bdf8)",
    qty: "text-teal-800",
    chip: "border-teal-200 bg-teal-50 text-teal-800",
  },
  {
    card: "border-amber-200/70 hover:shadow-[0_8px_24px_-10px_rgba(245,158,11,0.35)]",
    cardBg: "linear-gradient(145deg, #fef3c7 0%, #ffffff 45%, #ffedd5 100%)",
    edge: "linear-gradient(180deg, #fbbf24, #fb923c, #f472b6)",
    qty: "text-amber-900",
    chip: "border-amber-200 bg-amber-50 text-amber-900",
  },
  {
    card: "border-rose-200/70 hover:shadow-[0_8px_24px_-10px_rgba(244,63,94,0.3)]",
    cardBg: "linear-gradient(145deg, #ffe4e6 0%, #ffffff 45%, #fce7f3 100%)",
    edge: "linear-gradient(180deg, #fb7185, #e879f9, #a78bfa)",
    qty: "text-rose-800",
    chip: "border-rose-200 bg-rose-50 text-rose-800",
  },
  {
    card: "border-cyan-200/70 hover:shadow-[0_8px_24px_-10px_rgba(6,182,212,0.35)]",
    cardBg: "linear-gradient(145deg, #cffafe 0%, #ffffff 45%, #e0f2fe 100%)",
    edge: "linear-gradient(180deg, #22d3ee, #38bdf8, #34d399)",
    qty: "text-cyan-800",
    chip: "border-cyan-200 bg-cyan-50 text-cyan-800",
  },
] as const

type Props = {
  quotations: Quotation[]
  dealers: Dealer[]
  getDealerName: (dealerId: string, quotation?: Quotation) => string
  useApi: boolean
  enabled?: boolean
  refreshToken?: number
}

const DATE_RANGE_OPTIONS: { value: ProductNeededDateRange; label: string }[] = [
  { value: "all", label: "All time" },
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "this_week", label: "This week" },
  { value: "this_month", label: "This month" },
  { value: "last_month", label: "Last month" },
  { value: "custom", label: "Custom range" },
]

const SCOPE_OPTIONS: { value: ProductNeededScope; label: string }[] = [
  { value: "installation_pending", label: "Installation pending" },
  { value: "file_login", label: "File login (not approved)" },
]

export function AdminProductNeededPanel({
  quotations,
  dealers,
  getDealerName,
  useApi,
  enabled = true,
  refreshToken = 0,
}: Props) {
  const { toast } = useToast()
  const [search, setSearch] = useState("")
  const [searchDebounced, setSearchDebounced] = useState("")
  const [dealerFilter, setDealerFilter] = useState("all")
  const [dateRange, setDateRange] = useState<ProductNeededDateRange>("all")
  const [scope, setScope] = useState<ProductNeededScope>("installation_pending")
  const [customFrom, setCustomFrom] = useState("")
  const [customTo, setCustomTo] = useState("")
  const [rows, setRows] = useState<ProductNeededRow[]>([])
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [unavailable, setUnavailable] = useState(false)
  const [customRangePending, setCustomRangePending] = useState(false)
  const [loadSource, setLoadSource] = useState<string | null>(null)
  const [showJobs, setShowJobs] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [excelColumnsOpen, setExcelColumnsOpen] = useState(false)
  const [excelRememberedIds, setExcelRememberedIds] = useState<string[] | null>(null)
  const excelColumnsStorageKey = "excel-columns:product-needed"

  useEffect(() => {
    if (dateRange !== "custom") return
    if (customFrom || customTo) return
    const today = formatYmdLocal(new Date())
    setCustomFrom(today)
    setCustomTo(today)
  }, [dateRange, customFrom, customTo])

  useEffect(() => {
    const timer = window.setTimeout(() => setSearchDebounced(search), 350)
    return () => window.clearTimeout(timer)
  }, [search])

  const loadRows = useCallback(
    async (options?: { background?: boolean }) => {
      if (!enabled) return
      if (options?.background) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }
      try {
        const result = await loadAdminProductNeededRows({
          quotations,
          dealers,
          useApi,
          getDealerName,
          dealerId: dealerFilter,
          search: searchDebounced,
          dateRange,
          customFrom,
          customTo,
          scope,
        })
        setRows(result.rows)
        setUnavailable(result.unavailable)
        setCustomRangePending(result.customRangePending)
        setLoadSource(result.source)
      } catch (error) {
        console.error("Error loading product needed rows:", error)
        if (!options?.background) {
          setRows([])
          setLoadSource(null)
        }
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [
      customFrom,
      customTo,
      dateRange,
      dealerFilter,
      dealers,
      scope,
      enabled,
      getDealerName,
      quotations,
      searchDebounced,
      useApi,
    ],
  )

  useEffect(() => {
    if (!enabled) return
    void loadRows()
  }, [enabled, loadRows])

  useEffect(() => {
    if (!enabled || refreshToken === 0) return
    void loadRows({ background: true })
  }, [enabled, loadRows, refreshToken])

  const dashboard = useMemo(() => aggregateProductNeededDashboard(rows), [rows])

  const downloadExcel = async (selectedColumnIds: string[]) => {
    if (dashboard.jobCount === 0) {
      toast({
        title: "No data to export",
        description:
          scope === "file_login"
            ? "Adjust filters to include at least one file-login job that is not approved."
            : "Adjust filters to include at least one installation-pending job.",
        variant: "destructive",
      })
      return
    }
    setExporting(true)
    try {
      rememberExcelColumns(excelColumnsStorageKey, selectedColumnIds)
      await downloadProductNeededExcel(dashboard, { selectedColumnIds })
      toast({
        title: "Excel downloaded",
        description: `Created brand-wise sheets and DCR, Non-DCR, Both customer sheets for ${dashboard.jobCount} job(s) with ${selectedColumnIds.length} selected column(s).`,
      })
    } catch (error) {
      console.error("Error exporting Product Needed Excel:", error)
      toast({
        title: "Could not export Excel",
        description: "Please try again.",
        variant: "destructive",
      })
    } finally {
      setExporting(false)
    }
  }

  const sourceHint = useMemo(() => {
    if (!useApi) return "Local quotations"
    if (loadSource === "admin_product_needed") return "Loaded from API"
    if (loadSource === "quotations") return "Built from quotation list (API fallback)"
    return null
  }, [loadSource, useApi])

  return (
    <Card className={PRODUCT_NEEDED_CARD}>
      <CardHeader className="space-y-3 p-3 sm:p-6 pb-3">
        <div className="flex flex-col gap-3">
          <div className="flex items-start gap-2.5 sm:gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl border border-orange-200 bg-gradient-to-br from-orange-100 via-amber-50 to-rose-100 flex items-center justify-center shrink-0 shadow-[0_0_14px_-4px_rgba(249,115,22,0.5)]">
              <Package className="w-4 h-4 sm:w-5 sm:h-5 text-orange-700" />
            </div>
            <div className="min-w-0 flex-1">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg text-orange-950">
                Product Needed
                {refreshing ? <Loader2 className="w-4 h-4 animate-spin text-orange-500/70" /> : null}
              </CardTitle>
              <CardDescription className="mt-0.5 text-xs sm:text-sm text-orange-900/70">
                <span className="sm:hidden">
                  {scope === "file_login"
                    ? "File-login jobs not yet approved."
                    : "Installation-pending procurement totals."}
                </span>
                <span className="hidden sm:inline">
                  {scope === "file_login"
                    ? "Procurement dashboard for file-login jobs that are not yet approved. Rejected quotations are excluded."
                    : "Procurement dashboard for installation-pending jobs."}{" "}
                  Totals are rolled up by panel brand + wattage and inverter brand + rating.
                </span>
                {sourceHint ? (
                  <span className="block text-[11px] sm:text-xs mt-1 text-orange-800/60">{sourceHint}</span>
                ) : null}
              </CardDescription>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 w-full sm:flex sm:w-auto sm:justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-10 sm:h-9 w-full sm:w-auto border-sky-200 bg-gradient-to-r from-sky-50 to-cyan-50 text-sky-800 hover:from-sky-100 hover:to-cyan-100"
              onClick={() => void loadRows()}
              disabled={loading}
            >
              <RotateCcw className="w-4 h-4 mr-1.5 sm:mr-2" />
              Refresh
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-10 sm:h-9 w-full sm:w-auto border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50 text-emerald-800 hover:from-emerald-100 hover:to-teal-100"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                if (dashboard.jobCount === 0) {
                  toast({
                    title: "No data to export",
                    description:
                      scope === "file_login"
                        ? "Adjust filters to include at least one file-login job that is not approved."
                        : "Adjust filters to include at least one installation-pending job.",
                    variant: "destructive",
                  })
                  return
                }
                setExcelRememberedIds(readRememberedExcelColumns(excelColumnsStorageKey))
                setExcelColumnsOpen(true)
              }}
              disabled={exporting}
            >
              {exporting ? (
                <Loader2 className="w-4 h-4 mr-1.5 sm:mr-2 animate-spin" />
              ) : (
                <Download className="w-4 h-4 mr-1.5 sm:mr-2" />
              )}
              <span className="sm:hidden">Excel</span>
              <span className="hidden sm:inline">Download Excel</span>
            </Button>
          </div>
        </div>
      </CardHeader>
      <ExcelColumnPickerDialog
        open={excelColumnsOpen}
        onOpenChange={setExcelColumnsOpen}
        title="Select Excel columns"
        description="Check only the fields you want to download. Then click Download."
        columns={PRODUCT_NEEDED_EXCEL_COLUMN_OPTIONS}
        initialSelectedIds={excelRememberedIds}
        rowCount={dashboard.jobCount}
        confirmLabel="Download Excel"
        onConfirm={(ids) => void downloadExcel(ids)}
      />
      <CardContent className="space-y-4 sm:space-y-5 p-3 sm:p-6 pt-0 sm:pt-0">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4 sm:gap-3 rounded-xl border border-orange-100 bg-gradient-to-r from-orange-50/80 via-white to-amber-50/60 p-2 sm:p-2.5 shadow-sm">
          <div className="relative sm:col-span-2 lg:col-span-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-orange-500/80" />
            <Input
              className="h-11 sm:h-9 pl-9 border-orange-200 bg-white/90 focus-visible:ring-orange-200 text-base sm:text-sm"
              placeholder="Search ID, customer, mobile, brand…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={dealerFilter} onValueChange={setDealerFilter}>
            <SelectTrigger className="h-11 sm:h-9 border-sky-200 bg-white/90 text-base sm:text-sm">
              <SelectValue placeholder="Dealer" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All dealers</SelectItem>
              {dealers.map((dealer) => (
                <SelectItem key={dealer.id} value={dealer.id}>
                  {dealer.firstName} {dealer.lastName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={dateRange} onValueChange={(v) => setDateRange(v as ProductNeededDateRange)}>
            <SelectTrigger className="h-11 sm:h-9 border-violet-200 bg-white/90 text-base sm:text-sm">
              <SelectValue
                placeholder={
                  scope === "file_login" ? "Filter by file login date" : "Filter by release date"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {DATE_RANGE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2 min-w-0">
            {loading ? <Loader2 className="w-4 h-4 animate-spin text-orange-500/70 shrink-0" /> : null}
            <Select value={scope} onValueChange={(v) => setScope(v as ProductNeededScope)}>
              <SelectTrigger className="h-11 sm:h-9 flex-1 border-teal-200 bg-white/90 text-base sm:text-sm">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {SCOPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {dateRange === "custom" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">From</Label>
              <Input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="border-orange-200 bg-white"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">To</Label>
              <Input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="border-orange-200 bg-white"
              />
            </div>
          </div>
        ) : null}

        {!loading && customRangePending ? (
          <div className="text-center py-12 text-orange-900/60 rounded-2xl border border-dashed border-orange-200 bg-gradient-to-b from-white to-orange-50/50">
            <Package className="w-10 h-10 mx-auto mb-3 text-orange-300" />
            <p>Select a from and to date for the custom range.</p>
          </div>
        ) : loading && rows.length === 0 ? (
          <div className="text-center py-12 text-orange-900/60 rounded-2xl border border-dashed border-orange-200 bg-gradient-to-b from-white to-amber-50/50">
            <Loader2 className="w-8 h-8 mx-auto mb-3 animate-spin text-orange-400" />
            <p>Loading product needed totals…</p>
          </div>
        ) : !loading && dashboard.jobCount === 0 ? (
          <div className="text-center py-12 text-orange-900/60 rounded-2xl border border-dashed border-orange-200 bg-gradient-to-b from-white to-orange-50/50">
            <Package className="w-10 h-10 mx-auto mb-3 text-orange-300" />
            <p>
              {scope === "file_login"
                ? "No file-login (not approved) jobs match these filters."
                : "No installation-pending jobs match these filters."}
            </p>
            <p className="text-xs mt-2 text-orange-800/60">
              {scope === "file_login"
                ? "Only jobs with file login recorded, and quotation status not approved or rejected, are counted."
                : "Only jobs still in Pending Installation (sent to installer, not yet approved) are counted."}
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <div
                className="relative overflow-hidden rounded-xl sm:rounded-2xl border border-amber-200/80 p-2.5 sm:p-4 shadow-sm"
                style={{
                  background: "linear-gradient(145deg, #ffedd5 0%, #ffffff 45%, #fef3c7 100%)",
                }}
              >
                <div
                  className="absolute inset-y-0 left-0 w-1 sm:w-1.5"
                  style={{ background: "linear-gradient(180deg, #fb923c, #fbbf24, #f472b6)" }}
                  aria-hidden
                />
                <p className="pl-1 text-[9px] sm:text-[10px] uppercase tracking-wide text-amber-800/75 leading-tight">
                  Jobs
                </p>
                <p className="pl-1 mt-0.5 sm:mt-1 text-xl sm:text-3xl font-semibold tabular-nums text-amber-950">
                  {dashboard.jobCount}
                </p>
              </div>
              <div
                className="relative overflow-hidden rounded-xl sm:rounded-2xl border border-sky-200/80 p-2.5 sm:p-4 shadow-sm"
                style={{
                  background: "linear-gradient(145deg, #e0f2fe 0%, #ffffff 45%, #ecfeff 100%)",
                }}
              >
                <div
                  className="absolute inset-y-0 left-0 w-1 sm:w-1.5"
                  style={{ background: "linear-gradient(180deg, #38bdf8, #22d3ee, #818cf8)" }}
                  aria-hidden
                />
                <p className="pl-1 text-[9px] sm:text-[10px] uppercase tracking-wide text-sky-800/75 leading-tight">
                  Panels
                </p>
                <p className="pl-1 mt-0.5 sm:mt-1 text-xl sm:text-3xl font-semibold tabular-nums text-sky-950">
                  {dashboard.totalPanels}
                </p>
                <p className="pl-1 text-[10px] sm:text-xs text-sky-800/70 mt-0.5 sm:mt-1 truncate">
                  {dashboard.panels.length} brand{dashboard.panels.length === 1 ? "" : "s"}
                </p>
              </div>
              <div
                className="relative overflow-hidden rounded-xl sm:rounded-2xl border border-violet-200/80 p-2.5 sm:p-4 shadow-sm"
                style={{
                  background: "linear-gradient(145deg, #f3e8ff 0%, #ffffff 45%, #fdf4ff 100%)",
                }}
              >
                <div
                  className="absolute inset-y-0 left-0 w-1 sm:w-1.5"
                  style={{ background: "linear-gradient(180deg, #c084fc, #e879f9, #f472b6)" }}
                  aria-hidden
                />
                <p className="pl-1 text-[9px] sm:text-[10px] uppercase tracking-wide text-violet-800/75 leading-tight">
                  Inverters
                </p>
                <p className="pl-1 mt-0.5 sm:mt-1 text-xl sm:text-3xl font-semibold tabular-nums text-violet-950">
                  {dashboard.totalInverters}
                </p>
                <p className="pl-1 text-[10px] sm:text-xs text-violet-800/70 mt-0.5 sm:mt-1 truncate">
                  {dashboard.inverters.length} brand{dashboard.inverters.length === 1 ? "" : "s"}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg border border-sky-200 bg-gradient-to-br from-sky-100 to-cyan-50 flex items-center justify-center shadow-[0_0_10px_-3px_rgba(14,165,233,0.45)]">
                  <Package className="w-3.5 h-3.5 text-sky-700" />
                </span>
                <h3 className="text-sm font-semibold text-sky-950">Panels by brand</h3>
              </div>
              {dashboard.panels.length === 0 ? (
                <p className="text-sm text-sky-900/60 border border-dashed border-sky-200 rounded-2xl bg-gradient-to-b from-white to-sky-50/40 p-4">
                  No panel lines found on these jobs.
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {dashboard.panels.map((card, index) => {
                    const accent = BRAND_CARD_ACCENTS[index % BRAND_CARD_ACCENTS.length]
                    return (
                      <div
                        key={card.key}
                        className={cn(
                          "relative overflow-hidden rounded-2xl border p-3 sm:p-4 shadow-sm transition-all hover:-translate-y-0.5 active:scale-[0.99]",
                          accent.card,
                        )}
                        style={{ background: accent.cardBg }}
                      >
                        <div
                          className="absolute inset-y-0 left-0 w-1 sm:w-1.5"
                          style={{ background: accent.edge }}
                          aria-hidden
                        />
                        <div className="relative pl-1 sm:pl-1.5">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-base sm:text-lg font-semibold leading-tight text-slate-900 truncate">
                                {card.brand}
                              </p>
                              <p className="text-xs text-slate-500 mt-0.5">
                                {card.jobCount} job{card.jobCount === 1 ? "" : "s"}
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className={cn("text-xl sm:text-2xl font-semibold tabular-nums", accent.qty)}>
                                {card.totalQuantity}
                              </p>
                              <p className="text-[10px] uppercase tracking-wide text-slate-500">total</p>
                            </div>
                          </div>
                          <div className="mt-2.5 sm:mt-3 space-y-1.5 border-t border-white/70 pt-2.5 sm:pt-3">
                            {card.sizes.map((line) => (
                              <div
                                key={`${card.key}-${line.size}`}
                                className="flex items-center justify-between gap-3 text-sm rounded-lg border border-white/80 bg-white/55 px-2 py-1.5 min-h-9"
                              >
                                <span className="text-slate-600 truncate">{line.size}</span>
                                <span
                                  className={cn(
                                    "rounded-md border px-1.5 py-0.5 text-xs font-semibold tabular-nums whitespace-nowrap",
                                    accent.chip,
                                  )}
                                >
                                  {line.quantity}
                                  <span className="ml-1 text-[10px] font-normal uppercase opacity-70">
                                    {line.unit === "sets" ? "sets" : "pcs"}
                                  </span>
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg border border-violet-200 bg-gradient-to-br from-violet-100 to-fuchsia-50 flex items-center justify-center shadow-[0_0_10px_-3px_rgba(168,85,247,0.45)]">
                  <Zap className="w-3.5 h-3.5 text-violet-700" />
                </span>
                <h3 className="text-sm font-semibold text-violet-950">Inverters by brand</h3>
              </div>
              {dashboard.inverters.length === 0 ? (
                <p className="text-sm text-violet-900/60 border border-dashed border-violet-200 rounded-2xl bg-gradient-to-b from-white to-violet-50/40 p-4">
                  No inverter lines found on these jobs.
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {dashboard.inverters.map((card, index) => {
                    const accent = BRAND_CARD_ACCENTS[(index + 2) % BRAND_CARD_ACCENTS.length]
                    return (
                      <div
                        key={card.key}
                        className={cn(
                          "relative overflow-hidden rounded-2xl border p-3 sm:p-4 shadow-sm transition-all hover:-translate-y-0.5 active:scale-[0.99]",
                          accent.card,
                        )}
                        style={{ background: accent.cardBg }}
                      >
                        <div
                          className="absolute inset-y-0 left-0 w-1 sm:w-1.5"
                          style={{ background: accent.edge }}
                          aria-hidden
                        />
                        <div className="relative pl-1 sm:pl-1.5">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-base sm:text-lg font-semibold leading-tight text-slate-900 truncate">
                                {card.brand}
                              </p>
                              <p className="text-xs text-slate-500 mt-0.5">
                                {card.jobCount} job{card.jobCount === 1 ? "" : "s"}
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className={cn("text-xl sm:text-2xl font-semibold tabular-nums", accent.qty)}>
                                {card.totalQuantity}
                              </p>
                              <p className="text-[10px] uppercase tracking-wide text-slate-500">total</p>
                            </div>
                          </div>
                          <div className="mt-2.5 sm:mt-3 space-y-1.5 border-t border-white/70 pt-2.5 sm:pt-3">
                            {card.sizes.map((line) => (
                              <div
                                key={`${card.key}-${line.size}`}
                                className="flex items-center justify-between gap-3 text-sm rounded-lg border border-white/80 bg-white/55 px-2 py-1.5 min-h-9"
                              >
                                <span className="text-slate-600 truncate">{line.size}</span>
                                <span
                                  className={cn(
                                    "rounded-md border px-1.5 py-0.5 text-xs font-semibold tabular-nums whitespace-nowrap",
                                    accent.chip,
                                  )}
                                >
                                  {line.quantity}
                                  <span className="ml-1 text-[10px] font-normal uppercase opacity-70">
                                    {line.unit === "sets" ? "sets" : "pcs"}
                                  </span>
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-orange-950">Jobs included</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 border-orange-200 bg-gradient-to-r from-orange-50 to-amber-50 text-orange-900 hover:from-orange-100 hover:to-amber-100"
                  onClick={() => setShowJobs((v) => !v)}
                >
                  {showJobs ? "Hide list" : `Show ${dashboard.jobCount}`}
                </Button>
              </div>
              {showJobs ? (
                <>
                  {/* Mobile: stacked job cards */}
                  <div className="md:hidden space-y-2.5 max-h-[min(60vh,520px)] overflow-y-auto overscroll-y-contain pr-0.5">
                    {dashboard.rows.map((row) => (
                      <div
                        key={row.quotationId}
                        className="rounded-2xl border border-orange-200/80 border-l-4 border-l-orange-400 bg-gradient-to-r from-orange-50/80 via-white to-amber-50/40 p-3 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-900 truncate">
                              {row.customerName}
                            </p>
                            <p className="text-xs text-slate-500 tabular-nums">{row.customerMobile}</p>
                          </div>
                          <span className="shrink-0 rounded-lg border border-teal-200 bg-teal-50 px-2 py-0.5 text-xs font-semibold tabular-nums text-teal-800">
                            {row.systemKw} kW
                          </span>
                        </div>
                        <p className="mt-1.5 text-[11px] font-mono text-sky-800 break-all">{row.quotationId}</p>
                        <div className="mt-2 grid grid-cols-1 gap-1.5 text-xs">
                          <div className="rounded-lg border border-amber-100 bg-amber-50/70 px-2 py-1.5">
                            <span className="text-[10px] uppercase tracking-wide text-amber-800/70">Dealer</span>
                            <p className="font-medium text-amber-950 truncate">{row.dealerName}</p>
                          </div>
                          <div className="rounded-lg border border-sky-100 bg-sky-50/70 px-2 py-1.5">
                            <span className="text-[10px] uppercase tracking-wide text-sky-800/70">Panels</span>
                            <p className="text-slate-700 break-words">{row.panels || "—"}</p>
                          </div>
                          <div className="rounded-lg border border-violet-100 bg-violet-50/70 px-2 py-1.5">
                            <span className="text-[10px] uppercase tracking-wide text-violet-800/70">Inverter</span>
                            <p className="text-slate-700 break-words">{row.inverter || "—"}</p>
                          </div>
                          <p className="text-[11px] text-slate-500 px-0.5">
                            {scope === "file_login" ? "File login" : "Released"}:{" "}
                            {formatProductNeededDate(
                              scope === "file_login"
                                ? row.fileLoginAt || row.installationReleasedAt
                                : row.installationReleasedAt,
                            )}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop: table */}
                  <div className="hidden md:block rounded-2xl border border-orange-200/80 overflow-auto max-h-[min(50vh,480px)] w-full min-w-0 bg-white/80 shadow-sm">
                    <table className="w-full min-w-[900px] text-sm">
                      <thead className="sticky top-0 z-10 bg-gradient-to-r from-orange-50 via-amber-50 to-sky-50">
                        <tr className="border-b border-orange-100 text-left text-orange-950/80">
                          <th className="p-3 font-medium whitespace-nowrap">Quotation</th>
                          <th className="p-3 font-medium whitespace-nowrap">Customer</th>
                          <th className="p-3 font-medium whitespace-nowrap">Dealer</th>
                          <th className="p-3 font-medium whitespace-nowrap">kW</th>
                          <th className="p-3 font-medium min-w-[200px]">Panels</th>
                          <th className="p-3 font-medium min-w-[140px]">Inverter</th>
                          <th className="p-3 font-medium whitespace-nowrap">
                            {scope === "file_login" ? "File login" : "Released"}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {dashboard.rows.map((row) => (
                          <tr
                            key={row.quotationId}
                            className="border-b border-orange-50 last:border-0 align-top hover:bg-orange-50/40"
                          >
                            <td className="p-3 font-mono text-xs whitespace-nowrap text-sky-800">
                              {row.quotationId}
                            </td>
                            <td className="p-3 whitespace-nowrap">
                              <div className="font-medium text-slate-900">{row.customerName}</div>
                              <div className="text-xs text-slate-500">{row.customerMobile}</div>
                            </td>
                            <td className="p-3 whitespace-nowrap">{row.dealerName}</td>
                            <td className="p-3 whitespace-nowrap font-medium text-teal-800">{row.systemKw}</td>
                            <td className="p-3 text-xs leading-relaxed">{row.panels}</td>
                            <td className="p-3 text-xs whitespace-nowrap">{row.inverter}</td>
                            <td className="p-3 text-xs whitespace-nowrap">
                              {formatProductNeededDate(
                                scope === "file_login"
                                  ? row.fileLoginAt || row.installationReleasedAt
                                  : row.installationReleasedAt,
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : null}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
