"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { api, ApiError } from "@/lib/api"
import { SolarLogo } from "@/components/solar-logo"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Upload, LogOut, Users, FileSpreadsheet } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

type DealerOption = {
  id: string
  firstName: string
  lastName: string
  mobile: string
  email: string
}

type ParsedCsvRow = {
  name: string
  mobile: string
  altMobile?: string
  kNumber?: string
  address?: string
  customerNote?: string
  city?: string
  state?: string
  raw: Record<string, string>
}

type CallingActionRecord = {
  id: string
  leadId: string
  dealerId: string
  dealerName: string
  customerName: string
  customerMobile: string
  customerAddress: string
  action: string
  callRemark: string
  actionAt: string
  nextFollowUpAt?: string
}

type UploadedLeadBatch = {
  id: string
  uploadedAt: string
  fileName: string
  rowCount: number
  dealers: string[]
  rows: ParsedCsvRow[]
}

const DEFAULT_ACTIVE_LIMIT = 8

const normalizeHeaderKey = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "")

const parseDelimitedLine = (line: string, delimiter: string): string[] => {
  const cols: string[] = []
  let current = ""
  let inQuotes = false

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }
    if (ch === delimiter && !inQuotes) {
      cols.push(current.trim())
      current = ""
      continue
    }
    current += ch
  }
  cols.push(current.trim())
  return cols
}

const getFromRaw = (raw: Record<string, string>, aliases: string[]) => {
  for (const alias of aliases) {
    const value = raw[normalizeHeaderKey(alias)]
    if (value) return value
  }
  return ""
}

const normalizeMobile = (value: string) => {
  const digits = value.replace(/\D/g, "")
  return digits.length > 10 ? digits.slice(-10) : digits
}

const splitCityState = (value: string) => {
  if (!value) return { city: "", state: "" }
  const parts = value
    .split("/")
    .join(",")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
  if (parts.length === 0) return { city: "", state: "" }
  if (parts.length === 1) return { city: parts[0], state: "" }
  return { city: parts[0], state: parts[parts.length - 1] }
}

export default function HrDashboardPage() {
  const router = useRouter()
  const { isAuthenticated, role, logout } = useAuth()
  const { toast } = useToast()
  const [dealers, setDealers] = useState<DealerOption[]>([])
  const [selectedDealerIds, setSelectedDealerIds] = useState<string[]>([])
  const [csvRows, setCsvRows] = useState<ParsedCsvRow[]>([])
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [csvFileName, setCsvFileName] = useState("")
  const [isLoadingDealers, setIsLoadingDealers] = useState(false)
  const [isAssigning, setIsAssigning] = useState(false)
  const [activeLeadsLimit, setActiveLeadsLimit] = useState(DEFAULT_ACTIVE_LIMIT)
  const [activeTab, setActiveTab] = useState("assignment")
  const [uploadedLeadBatches, setUploadedLeadBatches] = useState<UploadedLeadBatch[]>([])
  const [callingActions, setCallingActions] = useState<CallingActionRecord[]>([])
  const [callingRange, setCallingRange] = useState<"daily" | "weekly" | "monthly" | "last_month" | "all">("daily")
  const [callingDealerFilter, setCallingDealerFilter] = useState("all")
  const [callingActionsUnavailable, setCallingActionsUnavailable] = useState(false)
  const useApi = process.env.NEXT_PUBLIC_USE_API !== "false"

  const normalizeDealerList = (list: any[]): DealerOption[] => {
    const uniqueMap = new Map<string, DealerOption>()
    list
      .filter((d: any) => d && d.id)
      .forEach((d: any) => {
        if (uniqueMap.has(d.id)) return
        uniqueMap.set(d.id, {
          id: d.id,
          firstName: d.firstName || "",
          lastName: d.lastName || "",
          mobile: d.mobile || "",
          email: d.email || "",
        })
      })
    return Array.from(uniqueMap.values())
  }

  const getLocalDealers = (): DealerOption[] => {
    const localDealers = JSON.parse(localStorage.getItem("dealers") || "[]")
    return normalizeDealerList(localDealers.filter((d: any) => d.isActive !== false))
  }

  const getDealersFromQuotations = async (): Promise<DealerOption[]> => {
    try {
      const response = await api.quotations.getAll({ limit: 1000 })
      const quotations = response?.quotations || []
      const fromQuotations = quotations
        .map((q: any) => q?.dealer)
        .filter((dealer: any) => dealer && dealer.id)
      return normalizeDealerList(fromQuotations)
    } catch {
      return []
    }
  }

  const getAllApprovedDealersFromAdmin = async (): Promise<DealerOption[]> => {
    const pageSize = 200
    let page = 1
    let totalPages = Number.POSITIVE_INFINITY
    const merged: any[] = []
    const seenIds = new Set<string>()

    while (page <= totalPages && page <= 100) {
      const response = await api.admin.dealers.getAll({ page, limit: pageSize, isActive: true })
      const list = Array.isArray(response?.dealers) ? response.dealers : []
      const before = seenIds.size
      list.forEach((dealer: any) => {
        if (!dealer?.id || seenIds.has(dealer.id)) return
        seenIds.add(dealer.id)
        merged.push(dealer)
      })

      const responseTotalPages = Number(response?.pagination?.totalPages || response?.meta?.totalPages || 0)
      if (responseTotalPages > 0) {
        totalPages = responseTotalPages
      }

      if (list.length < pageSize && !Number.isFinite(totalPages)) break
      if (list.length === 0) break
      if (seenIds.size === before && page > 1) break
      page += 1
    }

    return normalizeDealerList(merged)
  }

  const normalizeCallingAction = (item: any, fallbackDealers: DealerOption[], index: number): CallingActionRecord => {
    const dealerId = item?.dealerId || item?.assignedDealerId || item?.dealer?.id || ""
    const fallbackDealer = fallbackDealers.find((d) => d.id === dealerId)
    const dealerNameFromObject =
      item?.dealerName ||
      item?.assignedDealerName ||
      (item?.dealer ? `${item.dealer.firstName || ""} ${item.dealer.lastName || ""}`.trim() : "")
    const dealerName =
      dealerNameFromObject || (fallbackDealer ? `${fallbackDealer.firstName} ${fallbackDealer.lastName}` : "Unknown Employee")
    const actionAt = item?.actionAt || item?.updatedAt || item?.createdAt || ""
    const leadId = item?.leadId || item?.lead?.id || item?.id || ""
    return {
      id: item?.id || `${leadId || "lead"}-${actionAt || "na"}-${index}`,
      leadId,
      dealerId,
      dealerName,
      customerName: item?.name || item?.customerName || item?.lead?.name || "",
      customerMobile: item?.mobile || item?.customerMobile || item?.lead?.mobile || "",
      customerAddress: item?.address || item?.customerAddress || item?.lead?.address || "",
      action: item?.action || item?.status || "unknown",
      callRemark: item?.callRemark || item?.remark || "",
      actionAt,
      nextFollowUpAt: item?.nextFollowUpAt,
    }
  }

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/hr-login")
      return
    }
    if (role !== "hr") {
      router.push("/login")
    }
  }, [isAuthenticated, role, router])

  useEffect(() => {
    const loadDealers = async () => {
      setIsLoadingDealers(true)
      try {
        if (useApi) {
          let loadedDealers: DealerOption[] = []

          // Primary source: admin dealers endpoint
          try {
            loadedDealers = await getAllApprovedDealersFromAdmin()
          } catch {
            // HR may not have access to admin endpoints on some backends
          }

          // Fallback source: derive dealer list from quotations response
          if (loadedDealers.length === 0) {
            loadedDealers = await getDealersFromQuotations()
          }

          // Final fallback: localStorage cache
          if (loadedDealers.length === 0) {
            loadedDealers = getLocalDealers()
          }

          setDealers(loadedDealers)
        } else {
          setDealers(getLocalDealers())
        }
      } catch {
        setDealers(getLocalDealers())
        toast({
          title: "Failed to load dealers",
          description: "Could not load dealer list for assignment.",
          variant: "destructive",
        })
      } finally {
        setIsLoadingDealers(false)
      }
    }
    loadDealers()
  }, [toast, useApi])

  useEffect(() => {
    const savedBatches = JSON.parse(localStorage.getItem("hrUploadedLeadBatches") || "[]")
    setUploadedLeadBatches(Array.isArray(savedBatches) ? savedBatches : [])
  }, [])

  useEffect(() => {
    const loadCallingActions = async () => {
      const localCallingActions = JSON.parse(localStorage.getItem("callingActionHistory") || "[]")
      const normalizedLocal = Array.isArray(localCallingActions)
        ? localCallingActions
            .map((item: any, index: number) => normalizeCallingAction(item, dealers, index))
            .sort((a, b) => new Date(b.actionAt || 0).getTime() - new Date(a.actionAt || 0).getTime())
        : []

      if (!useApi) {
        setCallingActions(normalizedLocal)
        setCallingActionsUnavailable(normalizedLocal.length === 0)
        return
      }

      try {
        const response = await api.hr.callingActions.getAll({ limit: 2000 })
        const source =
          response?.actions ||
          response?.callingActions ||
          response?.items ||
          response?.logs ||
          response?.data ||
          []
        const normalizedFromApi = Array.isArray(source)
          ? source
              .map((item: any, index: number) => normalizeCallingAction(item, dealers, index))
              .sort((a, b) => new Date(b.actionAt || 0).getTime() - new Date(a.actionAt || 0).getTime())
          : []
        const mergedById = new Map<string, CallingActionRecord>()
        ;[...normalizedFromApi, ...normalizedLocal].forEach((item) => {
          if (!item?.id) return
          if (!mergedById.has(item.id)) mergedById.set(item.id, item)
        })
        const merged = Array.from(mergedById.values()).sort(
          (a, b) => new Date(b.actionAt || 0).getTime() - new Date(a.actionAt || 0).getTime(),
        )
        setCallingActions(merged)
        setCallingActionsUnavailable(merged.length === 0)
      } catch {
        setCallingActions(normalizedLocal)
        setCallingActionsUnavailable(normalizedLocal.length === 0)
      }
    }
    loadCallingActions()
  }, [dealers, useApi])

  const toggleDealer = (dealerId: string) => {
    setSelectedDealerIds((prev) => (prev.includes(dealerId) ? prev.filter((id) => id !== dealerId) : [...prev, dealerId]))
  }

  const parseCsvText = (text: string): ParsedCsvRow[] => {
    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
    if (lines.length <= 1) return []

    const delimiter = lines[0].includes("\t") ? "\t" : ","
    const headerCols = parseDelimitedLine(lines[0], delimiter)
    const headers = headerCols.map((h) => normalizeHeaderKey(h))
    const rows: ParsedCsvRow[] = []
    for (let i = 1; i < lines.length; i += 1) {
      const cols = parseDelimitedLine(lines[i], delimiter)
      const raw: Record<string, string> = {}
      headers.forEach((header, idx) => {
        raw[header] = cols[idx] || ""
      })

      const name = getFromRaw(raw, ["name", "customer", "customer name", "customername", "full name", "fullname"])
      const mobile = normalizeMobile(getFromRaw(raw, ["mobile", "phone", "contact", "contact no", "contact number", "contactno", "contactnumber"]))
      if (!mobile) continue

      const altMobile = normalizeMobile(getFromRaw(raw, ["alt mobile", "altmobile", "alternate", "alternate phone", "alternatephone"]))
      const kNumber = getFromRaw(raw, ["k number", "knumber", "k no", "kno"])
      const address = getFromRaw(raw, ["address", "full address"])
      const customerNote = getFromRaw(raw, ["note", "notes", "remark", "remarks", "comment", "comments"])
      const dataRefState = getFromRaw(raw, ["data ref", "data ref state", "data ref / state", "dataref", "datarefstate"])
      const cityValue = getFromRaw(raw, ["city"])
      const stateValue = getFromRaw(raw, ["state"])
      const inferredFromDataRef = splitCityState(dataRefState)

      rows.push({
        name,
        mobile,
        altMobile: altMobile || "",
        kNumber,
        address,
        customerNote,
        city: cityValue || inferredFromDataRef.city,
        state: stateValue || inferredFromDataRef.state,
        raw,
      })
    }
    return rows
  }

  const handleCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setCsvFile(file)
    setCsvFileName(file.name)
    const text = await file.text()
    const parsedRows = parseCsvText(text)
    setCsvRows(parsedRows)
    toast({
      title: "CSV parsed",
      description: `${parsedRows.length} valid rows detected.`,
    })
  }

  const assignLeads = async () => {
    if (selectedDealerIds.length === 0) {
      toast({
        title: "Select dealers",
        description: "Please select at least one dealer checkbox.",
        variant: "destructive",
      })
      return
    }
    if (csvRows.length === 0) {
      toast({
        title: "Upload CSV",
        description: "Please upload a valid CSV with lead rows.",
        variant: "destructive",
      })
      return
    }

    setIsAssigning(true)
    try {
      if (!useApi) {
        toast({
          title: "API mode required",
          description: "Enable backend API mode to assign leads to database.",
          variant: "destructive",
        })
        return
      }

      if (!csvFile) {
        toast({
          title: "Re-upload CSV file",
          description: "Please choose the CSV file again before assigning to database.",
          variant: "destructive",
        })
        return
      }

      const result = await api.hr.uploadLeadsCsv(csvFile, selectedDealerIds, activeLeadsLimit)
      const parsed = Number(result?.parsed || result?.total || csvRows.length)
      const created = Number(result?.created || result?.inserted || 0)
      const skippedDuplicate = Number(result?.skippedDuplicate || result?.skipped || 0)
      const assigned = Number(result?.assigned || created || 0)
      const queued = Number(result?.queued || 0)

      const selectedDealerNames = selectedDealerIds
        .map((id) => {
          const dealer = dealers.find((d) => d.id === id)
          return dealer ? `${dealer.firstName} ${dealer.lastName}`.trim() : id
        })
        .filter(Boolean)
      const savedBatches = JSON.parse(localStorage.getItem("hrUploadedLeadBatches") || "[]")
      const nextBatch: UploadedLeadBatch = {
        id: `batch-${Date.now()}`,
        uploadedAt: new Date().toISOString(),
        fileName: csvFileName || csvFile.name || "uploaded.csv",
        rowCount: csvRows.length,
        dealers: selectedDealerNames,
        rows: csvRows.slice(0, 1000),
      }
      const nextBatches = [nextBatch, ...(Array.isArray(savedBatches) ? savedBatches : [])].slice(0, 20)
      localStorage.setItem("hrUploadedLeadBatches", JSON.stringify(nextBatches))
      setUploadedLeadBatches(nextBatches)

      setCsvRows([])
      setCsvFile(null)
      setCsvFileName("")
      toast({
        title: "Saved to database",
        description: `Parsed ${parsed}, created ${created}, assigned ${assigned}, queued ${queued}, duplicates ${skippedDuplicate}.`,
      })
    } catch (error) {
      let message = "Failed to assign leads in database."
      if (error instanceof ApiError) {
        message = error.details?.[0]?.message || error.message || message
      } else if (error instanceof Error && error.message) {
        message = error.message
      }
      toast({
        title: "Assignment failed",
        description: message,
        variant: "destructive",
      })
    } finally {
      setIsAssigning(false)
    }
  }

  const isWithinCallingRange = (actionAt?: string) => {
    if (callingRange === "all") return true
    if (!actionAt) return false
    const actionDate = new Date(actionAt)
    if (Number.isNaN(actionDate.getTime())) return false
    const now = new Date()

    if (callingRange === "daily") return actionDate.toDateString() === now.toDateString()
    if (callingRange === "weekly") {
      const startOfWeek = new Date(now)
      startOfWeek.setDate(now.getDate() - now.getDay())
      startOfWeek.setHours(0, 0, 0, 0)
      return actionDate >= startOfWeek && actionDate <= now
    }
    if (callingRange === "monthly") {
      return actionDate.getMonth() === now.getMonth() && actionDate.getFullYear() === now.getFullYear()
    }
    if (callingRange === "last_month") {
      const prevMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1
      const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()
      return actionDate.getMonth() === prevMonth && actionDate.getFullYear() === prevYear
    }
    return true
  }

  const filteredCallingActions = useMemo(() => {
    return callingActions.filter((item) => {
      const isNameFilter = callingDealerFilter.startsWith("name:")
      const normalizedNameFilter = callingDealerFilter.replace(/^name:/, "")
      const matchesDealer =
        callingDealerFilter === "all" ||
        item.dealerId === callingDealerFilter ||
        item.dealerName === callingDealerFilter ||
        (isNameFilter && (item.dealerName || "").trim().toLowerCase() === normalizedNameFilter)
      return matchesDealer && isWithinCallingRange(item.actionAt)
    })
  }, [callingActions, callingDealerFilter, callingRange])

  const dealerFilterOptions = useMemo(() => {
    const byValue = new Map<string, { value: string; label: string }>()

    dealers.forEach((d) => {
      const label = `${d.firstName} ${d.lastName}`.trim() || d.email || d.mobile || d.id
      byValue.set(d.id, { value: d.id, label })
    })

    callingActions.forEach((item) => {
      if (item.dealerId) {
        if (!byValue.has(item.dealerId)) {
          byValue.set(item.dealerId, {
            value: item.dealerId,
            label: item.dealerName || item.dealerId,
          })
        }
        return
      }
      const normalizedName = (item.dealerName || "").trim()
      if (!normalizedName) return
      const value = `name:${normalizedName.toLowerCase()}`
      if (!byValue.has(value)) {
        byValue.set(value, { value, label: normalizedName })
      }
    })

    return Array.from(byValue.values()).sort((a, b) => a.label.localeCompare(b.label))
  }, [dealers, callingActions])

  const callingSummary = useMemo(
    () =>
      filteredCallingActions.reduce(
        (acc, item) => {
          const remark = item.callRemark || ""
          if (item.action === "not_interested") acc.notInterested += 1
          else if (item.action === "follow_up" && remark.includes("[Others]")) acc.others += 1
          else if (item.action === "follow_up") acc.followUp += 1
          else if (item.action === "called" && remark.includes("[Interested]")) acc.interested += 1
          else acc.otherActions += 1
          return acc
        },
        { interested: 0, followUp: 0, notInterested: 0, others: 0, otherActions: 0 },
      ),
    [filteredCallingActions],
  )

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <button onClick={() => router.push("/")} className="flex items-center">
            <SolarLogo size="md" />
          </button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              logout()
              router.push("/")
            }}
            className="gap-2"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <Users className="w-4 h-4 text-primary" />
          </div>
          <h1 className="text-xl font-semibold">HR Calling Assignment</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Upload CSV leads and choose dealer pool. Leads are distributed using dynamic work queue (next free dealer gets next lead).
        </p>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="flex w-full justify-start overflow-x-auto whitespace-nowrap">
            <TabsTrigger value="assignment" className="shrink-0 text-xs sm:text-sm">Assignment</TabsTrigger>
            <TabsTrigger value="uploaded-data" className="shrink-0 text-xs sm:text-sm">Uploaded Data</TabsTrigger>
            <TabsTrigger value="dealer-actions" className="shrink-0 text-xs sm:text-sm">Dealer Actions</TabsTrigger>
          </TabsList>

          <TabsContent value="assignment" className="space-y-4">
            <Card className="border-border/60">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-primary" />
                  CSV Upload
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Input type="file" accept=".csv,text/csv" onChange={handleCsvUpload} />
                <div className="text-xs text-muted-foreground">
                  {csvFileName
                    ? `File: ${csvFileName} (${csvRows.length} valid rows)`
                    : "Upload CSV. Supported headers include Name, Contact No., K Number, Address, Data Ref. / State."}
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/60">
              <CardHeader>
                <CardTitle className="text-base">Assignment Controls</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="max-w-xs space-y-2">
                  <label className="text-sm font-medium">Active leads per dealer</label>
                  <Input
                    type="number"
                    min={1}
                    max={20}
                    value={activeLeadsLimit}
                    onChange={(e) => {
                      const value = Number(e.target.value)
                      if (Number.isNaN(value)) return
                      setActiveLeadsLimit(Math.min(20, Math.max(1, value)))
                    }}
                  />
                  <p className="text-xs text-muted-foreground">Use 7 or 8 for controlled daily calling queue.</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/60">
              <CardHeader>
                <CardTitle className="text-base">Select Dealers</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoadingDealers ? (
                  <p className="text-sm text-muted-foreground">Loading dealers...</p>
                ) : dealers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No active dealers found.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {dealers.map((dealer) => (
                      <label key={dealer.id} className="flex items-center gap-2 rounded-md border border-border/60 px-3 py-2 cursor-pointer hover:bg-muted/40">
                        <Checkbox checked={selectedDealerIds.includes(dealer.id)} onCheckedChange={() => toggleDealer(dealer.id)} />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{dealer.firstName} {dealer.lastName}</p>
                          <p className="text-xs text-muted-foreground truncate">{dealer.mobile} • {dealer.email}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                )}

                {selectedDealerIds.length > 0 && csvRows.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <div className="flex flex-wrap gap-2">
                      {selectedDealerIds.map((id) => {
                        const dealer = dealers.find((d) => d.id === id)
                        if (!dealer) return null
                        return (
                          <Badge key={id} variant="outline">
                            {dealer.firstName} {dealer.lastName}
                          </Badge>
                        )
                      })}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Work queue mode: no fixed dealer-wise split. Next available lead is assigned to the next free dealer.
                    </p>
                  </div>
                )}

                <div className="mt-4 flex justify-end">
                  <Button onClick={assignLeads} disabled={isAssigning || selectedDealerIds.length === 0 || csvRows.length === 0} className="gap-2">
                    <Upload className="w-4 h-4" />
                    {isAssigning ? "Assigning..." : "Assign Leads"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="uploaded-data">
            <Card className="border-border/60">
              <CardHeader>
                <CardTitle className="text-base">Uploaded Lead Data</CardTitle>
              </CardHeader>
              <CardContent>
                {uploadedLeadBatches.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No uploaded lead data found yet.</p>
                ) : (
                  <div className="space-y-4">
                    {uploadedLeadBatches.map((batch) => (
                      <div key={batch.id} className="rounded-md border border-border/70 p-3 space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="font-medium text-sm">{batch.fileName}</p>
                            <p className="text-xs text-muted-foreground">
                              Uploaded: {new Date(batch.uploadedAt).toLocaleString()} • Rows: {batch.rowCount}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {batch.dealers.slice(0, 4).map((name) => (
                              <Badge key={`${batch.id}-${name}`} variant="outline">
                                {name}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full min-w-[640px] text-sm">
                            <thead>
                              <tr className="text-left text-muted-foreground">
                                <th className="py-1 pr-3">Name</th>
                                <th className="py-1 pr-3">Mobile</th>
                                <th className="py-1 pr-3">K Number</th>
                                <th className="py-1 pr-3">Address</th>
                              </tr>
                            </thead>
                            <tbody>
                              {batch.rows.slice(0, 10).map((row, idx) => (
                                <tr key={`${batch.id}-${row.mobile}-${idx}`} className="border-t border-border/40">
                                  <td className="py-1 pr-3">{row.name || "N/A"}</td>
                                  <td className="py-1 pr-3">{row.mobile || "N/A"}</td>
                                  <td className="py-1 pr-3">{row.kNumber || "N/A"}</td>
                                  <td className="py-1 pr-3">{row.address || "N/A"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        {batch.rows.length > 10 ? (
                          <p className="text-xs text-muted-foreground">Showing first 10 rows of this upload.</p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="dealer-actions" className="space-y-4">
            <Card className="border-border/60">
              <CardHeader>
                <CardTitle className="text-base">Dealer Calling Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 rounded-lg border border-border/60 bg-muted/20 p-3">
                  <Select value={callingRange} onValueChange={(value: "daily" | "weekly" | "monthly" | "last_month" | "all") => setCallingRange(value)}>
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder="Select report range" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="last_month">Last Month</SelectItem>
                      <SelectItem value="all">All Time</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={callingDealerFilter} onValueChange={setCallingDealerFilter}>
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder="Filter by dealer" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Dealers</SelectItem>
                      {dealerFilterOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                  <Card className="border-emerald-200 bg-emerald-50/40"><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Interested</p><p className="text-xl font-semibold">{callingSummary.interested}</p></CardContent></Card>
                  <Card className="border-blue-200 bg-blue-50/40"><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Follow Up</p><p className="text-xl font-semibold">{callingSummary.followUp}</p></CardContent></Card>
                  <Card className="border-rose-200 bg-rose-50/40"><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Not Interested</p><p className="text-xl font-semibold">{callingSummary.notInterested}</p></CardContent></Card>
                  <Card className="border-amber-200 bg-amber-50/40"><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Others</p><p className="text-xl font-semibold">{callingSummary.others}</p></CardContent></Card>
                  <Card className="border-border/60 bg-muted/20"><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Total</p><p className="text-xl font-semibold">{filteredCallingActions.length}</p></CardContent></Card>
                </div>

                {callingActionsUnavailable ? (
                  <p className="text-sm text-muted-foreground">No dealer actions found yet.</p>
                ) : filteredCallingActions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No calling actions found for selected filters.</p>
                ) : (
                  <div className="space-y-2">
                    {filteredCallingActions.slice(0, 300).map((item) => (
                      <div key={item.id} className="rounded-lg border border-border/70 bg-card p-3 shadow-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-medium text-sm break-words">{item.dealerName || "Unknown Employee"}</p>
                            <p className="text-xs text-muted-foreground break-all">Lead: {item.leadId || "N/A"}</p>
                            <p className="text-xs text-muted-foreground break-words">Customer: {item.customerName || "N/A"}</p>
                            <p className="text-xs text-muted-foreground break-all">Phone: {item.customerMobile || "N/A"}</p>
                            <p className="text-xs text-muted-foreground break-words">Address: {item.customerAddress || "N/A"}</p>
                          </div>
                          <div className="flex items-center gap-2 max-w-full">
                            <Badge
                              variant="outline"
                              className={
                                item.action === "not_interested"
                                  ? "border-rose-200 text-rose-700 bg-rose-50"
                                  : item.action === "follow_up"
                                    ? "border-blue-200 text-blue-700 bg-blue-50"
                                    : item.action === "called"
                                      ? "border-emerald-200 text-emerald-700 bg-emerald-50"
                                      : "border-border text-foreground"
                              }
                            >
                              {item.action || "N/A"}
                            </Badge>
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {item.actionAt ? new Date(item.actionAt).toLocaleString() : "N/A"}
                            </span>
                          </div>
                        </div>
                        {item.callRemark ? <p className="text-sm mt-2 break-words">Remark: {item.callRemark}</p> : null}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
