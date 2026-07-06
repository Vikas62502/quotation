"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import type { Quotation } from "@/lib/quotation-context"
import type { Dealer } from "@/lib/auth-context"
import {
  formatProductNeededDate,
  productNeededRowsToCsv,
  type ProductNeededDateRange,
  type ProductNeededRow,
  type ProductNeededTab,
} from "@/lib/admin-product-needed"
import { formatYmdLocal } from "@/lib/calling-report-date-range"
import { loadAdminProductNeededRows } from "@/lib/load-admin-product-needed"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Download, Loader2, Package, RotateCcw, Search } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

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

export function AdminProductNeededPanel({
  quotations,
  dealers,
  getDealerName,
  useApi,
  enabled = true,
  refreshToken = 0,
}: Props) {
  const { toast } = useToast()
  const [tab, setTab] = useState<ProductNeededTab>("file_login")
  const [search, setSearch] = useState("")
  const [searchDebounced, setSearchDebounced] = useState("")
  const [dealerFilter, setDealerFilter] = useState("all")
  const [dateRange, setDateRange] = useState<ProductNeededDateRange>("all")
  const [customFrom, setCustomFrom] = useState("")
  const [customTo, setCustomTo] = useState("")
  const [rows, setRows] = useState<ProductNeededRow[]>([])
  const [tabCounts, setTabCounts] = useState({ fileLogin: 0, loginApproved: 0 })
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [unavailable, setUnavailable] = useState(false)
  const [customRangePending, setCustomRangePending] = useState(false)
  const [loadSource, setLoadSource] = useState<string | null>(null)

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
          tab,
          dealerId: dealerFilter,
          search: searchDebounced,
          dateRange,
          customFrom,
          customTo,
        })
        setRows(result.rows)
        setTabCounts(result.tabCounts)
        setUnavailable(result.unavailable)
        setCustomRangePending(result.customRangePending)
        setLoadSource(result.source)
      } catch (error) {
        console.error("Error loading product needed rows:", error)
        if (!options?.background) {
          setRows([])
          setUnavailable(true)
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
      enabled,
      getDealerName,
      quotations,
      searchDebounced,
      tab,
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

  const downloadCsv = () => {
    if (rows.length === 0) {
      toast({
        title: "No data to export",
        description: "Adjust filters to include at least one row.",
        variant: "destructive",
      })
      return
    }
    const csv = productNeededRowsToCsv(rows, tab)
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    const stamp = new Date().toISOString().slice(0, 10)
    link.href = url
    link.download = `product-needed-${tab}-${stamp}.csv`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
    toast({
      title: "Download started",
      description: `Exported ${rows.length} row(s).`,
    })
  }

  const dateFilterLabel =
    tab === "login_approved" ? "Filter by approve date" : "Filter by file login date"

  const sourceHint = useMemo(() => {
    if (!useApi) return "Local quotations"
    if (loadSource === "admin_product_needed") return "Loaded from API"
    if (loadSource === "quotations") return "Built from quotation list (API fallback)"
    return null
  }, [loadSource, useApi])

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5 text-primary" />
              Product Needed
              {refreshing ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /> : null}
            </CardTitle>
            <CardDescription className="mt-1">
              Procurement view — panels and inverter only. Includes quotations with installation
              approved or completion images uploaded. File login and login + approved in separate
              tabs.
              {sourceHint ? (
                <span className="block text-xs mt-1 text-muted-foreground/80">{sourceHint}</span>
              ) : null}
            </CardDescription>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void loadRows()}
              disabled={loading}
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={downloadCsv}>
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {unavailable ? (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-200">
            Product Needed API is not available yet. Deploy{" "}
            <code className="text-xs">GET /admin/product-needed</code> (see{" "}
            <code className="text-xs">BACKEND_ADMIN_PRODUCT_NEEDED.ts</code>) or load quotations
            first so the panel can build rows client-side.
          </div>
        ) : null}

        <Tabs value={tab} onValueChange={(value) => setTab(value as ProductNeededTab)}>
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="file_login">File login ({tabCounts.fileLogin})</TabsTrigger>
            <TabsTrigger value="login_approved">
              Login + approved ({tabCounts.loginApproved})
            </TabsTrigger>
          </TabsList>

          <TabsContent value={tab} className="mt-4 space-y-4 focus-visible:outline-none">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="relative sm:col-span-2 lg:col-span-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-8"
                  placeholder="Search ID, customer, mobile…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Select value={dealerFilter} onValueChange={setDealerFilter}>
                <SelectTrigger>
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
                <SelectTrigger>
                  <SelectValue placeholder={dateFilterLabel} />
                </SelectTrigger>
                <SelectContent>
                  {DATE_RANGE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  {rows.length} row{rows.length === 1 ? "" : "s"}
                </Badge>
                {loading ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /> : null}
              </div>
            </div>

            {dateRange === "custom" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">From</Label>
                  <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">To</Label>
                  <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
                </div>
              </div>
            ) : null}

            {!loading && customRangePending ? (
              <div className="text-center py-12 text-muted-foreground border rounded-lg border-dashed">
                <Package className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p>Select a from and to date for the custom range.</p>
              </div>
            ) : !loading && rows.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground border rounded-lg border-dashed">
                <Package className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p>No quotations match this tab and filters.</p>
                <p className="text-xs mt-2">
                  Only installation-approved or image-uploaded files are listed.
                </p>
              </div>
            ) : loading && rows.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground border rounded-lg border-dashed">
                <Loader2 className="w-8 h-8 mx-auto mb-3 animate-spin opacity-60" />
                <p>Loading product needed data…</p>
              </div>
            ) : (
              <div className="rounded-lg border overflow-auto max-h-[min(70vh,720px)] w-full min-w-0">
                <table className="w-full min-w-[1100px] text-sm">
                  <thead className="sticky top-0 z-10 bg-muted/95 backdrop-blur-sm">
                    <tr className="border-b text-left">
                      <th className="p-3 font-medium whitespace-nowrap">Quotation</th>
                      <th className="p-3 font-medium whitespace-nowrap">Customer</th>
                      <th className="p-3 font-medium whitespace-nowrap">Dealer</th>
                      <th className="p-3 font-medium whitespace-nowrap">kW</th>
                      <th className="p-3 font-medium whitespace-nowrap">Type</th>
                      <th className="p-3 font-medium min-w-[220px]">Panels</th>
                      <th className="p-3 font-medium min-w-[160px]">Inverter</th>
                      <th className="p-3 font-medium whitespace-nowrap">File login</th>
                      {tab === "login_approved" ? (
                        <th className="p-3 font-medium whitespace-nowrap">Approved</th>
                      ) : null}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.quotationId} className="border-b last:border-0 align-top">
                        <td className="p-3 font-mono text-xs whitespace-nowrap">{row.quotationId}</td>
                        <td className="p-3 whitespace-nowrap">
                          <div className="font-medium">{row.customerName}</div>
                          <div className="text-xs text-muted-foreground">{row.customerMobile}</div>
                        </td>
                        <td className="p-3 whitespace-nowrap">{row.dealerName}</td>
                        <td className="p-3 whitespace-nowrap">{row.systemKw}</td>
                        <td className="p-3 whitespace-nowrap">
                          <Badge variant="outline" className="text-[10px]">
                            {row.systemType}
                          </Badge>
                        </td>
                        <td className="p-3 text-xs leading-relaxed min-w-[220px]">{row.panels}</td>
                        <td className="p-3 text-xs whitespace-nowrap min-w-[160px]">{row.inverter}</td>
                        <td className="p-3 text-xs whitespace-nowrap">
                          <div>{row.fileLoginStatus}</div>
                          <div className="text-muted-foreground">
                            {formatProductNeededDate(row.fileLoginAt)}
                          </div>
                        </td>
                        {tab === "login_approved" ? (
                          <td className="p-3 text-xs whitespace-nowrap">
                            {formatProductNeededDate(row.statusApprovedAt)}
                          </td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
