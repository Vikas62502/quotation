"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { api, ApiError } from "@/lib/api"
import { getRealtime } from "@/lib/realtime"
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
  assignedDealerId?: string
  assignedDealerName?: string
  assignmentStatus?: string
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

const DEFAULT_ACTIVE_LIMIT = 1

const ACTION_LABEL_MAP: Record<string, string> = {
  called: "Called",
  follow_up: "Follow Up",
  not_interested: "Not Interested",
  interested: "Interested",
}

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

const parseCallRemarkParts = (remark: string) => {
  const text = (remark || "").trim()
  if (!text) return { statusCategory: "", status: "", remark: "" }
  // Supports: [category] Status | free remark
  const m = text.match(/^\[([^\]]+)\]\s*([^|]*?)\s*(?:\|\s*(.*))?$/)
  if (!m) return { statusCategory: "", status: "", remark: text }
  return {
    statusCategory: (m[1] || "").trim(),
    status: (m[2] || "").trim(),
    remark: (m[3] || "").trim(),
  }
}

const parseActionDate = (value?: string) => {
  if (!value) return null
  const raw = String(value).trim()
  if (!raw) return null

  // Epoch support (seconds / milliseconds)
  if (/^\d{10,13}$/.test(raw)) {
    const n = Number(raw)
    const ms = raw.length === 10 ? n * 1000 : n
    const d = new Date(ms)
    return Number.isNaN(d.getTime()) ? null : d
  }

  // Native parse for ISO / common formats
  let d = new Date(raw)
  if (!Number.isNaN(d.getTime())) return d

  // MySQL-like "YYYY-MM-DD HH:mm:ss"
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(raw)) {
    d = new Date(raw.replace(" ", "T"))
    if (!Number.isNaN(d.getTime())) return d
  }

  // Indian UI-like "DD/MM/YYYY, HH:mm:ss"
  const m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:,\s*(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/)
  if (m) {
    const dd = Number(m[1])
    const mm = Number(m[2]) - 1
    const yyyy = Number(m[3])
    const hh = Number(m[4] || 0)
    const mi = Number(m[5] || 0)
    const ss = Number(m[6] || 0)
    d = new Date(yyyy, mm, dd, hh, mi, ss)
    if (!Number.isNaN(d.getTime())) return d
  }

  return null
}

const normalizeName = (value?: string) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")

const prettifyAssignmentStatus = (value?: string) => {
  const status = String(value || "").trim().toLowerCase()
  if (!status) return "Pending"
  if (status === "assigned") return "Assigned"
  if (status === "in_progress") return "In Progress"
  if (status === "rescheduled") return "Rescheduled"
  if (status === "completed") return "Completed"
  if (status === "queued") return "Queued"
  return status.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase())
}

const isCompletedAssignmentStatus = (value?: string) => {
  const status = String(value || "").trim().toLowerCase()
  return status === "completed" || status === "done" || status === "closed"
}

const getDateRangeParams = (range: "daily" | "weekly" | "monthly" | "last_month" | "all") => {
  if (range === "all") return {}
  const now = new Date()
  const toIsoStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0).toISOString()
  const toIsoEnd = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999).toISOString()

  if (range === "daily") {
    return { startDate: toIsoStart(now), endDate: toIsoEnd(now) }
  }

  if (range === "weekly") {
    const start = new Date(now)
    const day = start.getDay()
    const diff = day === 0 ? 6 : day - 1
    start.setDate(start.getDate() - diff)
    const end = new Date(start)
    end.setDate(start.getDate() + 6)
    return { startDate: toIsoStart(start), endDate: toIsoEnd(end) }
  }

  if (range === "monthly") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    return { startDate: toIsoStart(start), endDate: toIsoEnd(end) }
  }

  const prevMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1
  const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()
  const start = new Date(prevYear, prevMonth, 1)
  const end = new Date(prevYear, prevMonth + 1, 0)
  return { startDate: toIsoStart(start), endDate: toIsoEnd(end) }
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
  const [activeTab, setActiveTab] = useState("assignment")
  const [realtimeTick, setRealtimeTick] = useState(0)
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
    return normalizeDealerList(localDealers)
  }

  const getAllDealersFromAdmin = async (): Promise<DealerOption[]> => {
    const pageSize = 200
    let page = 1
    let totalPages = Number.POSITIVE_INFINITY
    const merged: any[] = []
    const seenIds = new Set<string>()

    const pickDealerRows = (response: any): any[] => {
      if (Array.isArray(response)) return response
      if (Array.isArray(response?.dealers)) return response.dealers
      if (Array.isArray(response?.items)) return response.items
      if (Array.isArray(response?.data?.dealers)) return response.data.dealers
      if (Array.isArray(response?.data?.items)) return response.data.items
      if (Array.isArray(response?.data)) return response.data
      return []
    }

    while (page <= totalPages && page <= 100) {
      // Use HR-aware endpoint chain first, then admin dealers as fallback (handled in api.hr.dealers.getAll).
      const response = await api.hr.dealers.getAll({ page, limit: pageSize, includeInactive: true })
      const list = pickDealerRows(response)
      const before = seenIds.size
      list.forEach((dealer: any) => {
        if (!dealer?.id || seenIds.has(dealer.id)) return
        seenIds.add(dealer.id)
        merged.push(dealer)
      })

      const responseTotalPages = Number(
        response?.pagination?.totalPages || response?.meta?.totalPages || response?.data?.pagination?.totalPages || 0,
      )
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
    const rawAddress =
      item?.address ||
      item?.customerAddress ||
      item?.lead?.address ||
      item?.customer?.address ||
      ""
    const compactAddress = String(rawAddress)
      .replace(/\s+/g, " ")
      .replace(/,\s*,+/g, ", ")
      .trim()
    return {
      id: item?.id || `${leadId || "lead"}-${actionAt || "na"}-${index}`,
      leadId,
      dealerId,
      dealerName,
      customerName:
        item?.name ||
        item?.customerName ||
        item?.lead?.name ||
        `${item?.customer?.firstName || ""} ${item?.customer?.lastName || ""}`.trim(),
      customerMobile: item?.mobile || item?.customerMobile || item?.lead?.mobile || item?.customer?.mobile || "",
      customerAddress: compactAddress,
      action: item?.action || item?.status || "unknown",
      callRemark: item?.callRemark || item?.remark || "",
      actionAt,
      nextFollowUpAt: item?.nextFollowUpAt,
    }
  }

  const normalizeBatchRows = (rows: any[]): ParsedCsvRow[] => {
    if (!Array.isArray(rows)) return []
    return rows.map((row: any) => {
      const raw = row?.raw && typeof row.raw === "object" ? row.raw : {}
      const assignedDealerId =
        row?.assignedDealerId ||
        row?.assigned_dealer_id ||
        row?.dealerId ||
        row?.dealer_id ||
        ""
      const assignedDealerNameRaw =
        row?.assignedDealerName ||
        row?.assigned_dealer_name ||
        row?.dealerName ||
        row?.dealer_name ||
        row?.assignedTo ||
        row?.assigned_to ||
        ""
      const assignmentStatusRaw =
        row?.assignmentStatus ||
        row?.assignment_status ||
        row?.status ||
        row?.leadStatus ||
        row?.lead_status ||
        ""
      return {
        name: row?.name || row?.customerName || "",
        mobile: normalizeMobile(String(row?.mobile || row?.customerMobile || "")),
        altMobile: normalizeMobile(String(row?.altMobile || row?.alternateMobile || "")),
        kNumber: row?.kNumber || row?.kno || "",
        address: row?.address || row?.customerAddress || "",
        customerNote: row?.customerNote || row?.note || "",
        city: row?.city || "",
        state: row?.state || "",
        assignedDealerId: assignedDealerId || undefined,
        assignedDealerName: assignedDealerNameRaw || undefined,
        assignmentStatus: assignmentStatusRaw || undefined,
        raw,
      }
    })
  }

  const normalizeUploadedLeadBatch = (item: any, fallbackDealers: DealerOption[], index: number): UploadedLeadBatch => {
    const fallbackRows = item?.rows || item?.leads || item?.items || []
    const rows = normalizeBatchRows(fallbackRows).map((row) => {
      const byId = row.assignedDealerId ? fallbackDealers.find((d) => d.id === row.assignedDealerId) : undefined
      const dealerName = row.assignedDealerName || (byId ? `${byId.firstName} ${byId.lastName}`.trim() : "")
      return {
        ...row,
        assignedDealerName: dealerName || undefined,
      }
    })
    const dealerValues: string[] = Array.isArray(item?.dealers)
      ? item.dealers
      : Array.isArray(item?.dealerIds)
        ? item.dealerIds
        : item?.dealerId
          ? [item.dealerId]
          : []

    const normalizedDealers = dealerValues
      .map((value: any) => {
        if (typeof value === "string") {
          const dealer = fallbackDealers.find((d) => d.id === value)
          return dealer ? `${dealer.firstName} ${dealer.lastName}`.trim() : value
        }
        if (value && typeof value === "object") {
          const fullName = `${value.firstName || ""} ${value.lastName || ""}`.trim()
          return fullName || value.name || value.id || ""
        }
        return ""
      })
      .filter(Boolean)

    const rowCountFromApi = Number(item?.rowCount || item?.totalRows || item?.count || 0)

    return {
      id: item?.id || item?.batchId || item?.uploadId || `batch-${index}`,
      uploadedAt: item?.uploadedAt || item?.createdAt || item?.updatedAt || new Date().toISOString(),
      fileName: item?.fileName || item?.originalFileName || item?.csvFileName || "uploaded.csv",
      rowCount: rowCountFromApi > 0 ? rowCountFromApi : rows.length,
      dealers: normalizedDealers,
      rows,
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
          // Use backend dealer directory as single source of truth (same as Admin).
          const loadedDealers = await getAllDealersFromAdmin()
          setDealers(loadedDealers)
        } else {
          setDealers(getLocalDealers())
        }
      } catch {
        setDealers([])
        toast({
          title: "Failed to load dealers",
          description: "Could not load dealer list from API for assignment.",
          variant: "destructive",
        })
      } finally {
        setIsLoadingDealers(false)
      }
    }
    loadDealers()
  }, [toast, useApi, realtimeTick])

  useEffect(() => {
    // Keep selected IDs valid when dealer directory refreshes.
    setSelectedDealerIds((prev) => prev.filter((id) => dealers.some((d) => d.id === id)))
  }, [dealers])

  useEffect(() => {
    const loadUploadedLeadBatches = async () => {
      if (!useApi) {
        setUploadedLeadBatches([])
        return
      }
      try {
        const response = await api.hr.uploadedLeads.getAll({ limit: 200 })
        const source =
          response?.uploads ||
          response?.batches ||
          response?.items ||
          response?.data ||
          []
        const normalized = Array.isArray(source)
          ? source.map((item: any, index: number) => normalizeUploadedLeadBatch(item, dealers, index))
          : []
        const sorted = normalized.sort(
          (a, b) => new Date(b.uploadedAt || 0).getTime() - new Date(a.uploadedAt || 0).getTime(),
        )
        setUploadedLeadBatches(sorted)
      } catch {
        setUploadedLeadBatches([])
      }
    }
    loadUploadedLeadBatches()
  }, [dealers, useApi, realtimeTick])

  useEffect(() => {
    const loadCallingActions = async () => {
      const localCallingActions = JSON.parse(localStorage.getItem("callingActionHistory") || "[]")
      const normalizedLocal = Array.isArray(localCallingActions)
        ? localCallingActions
            .map((item: any, index: number) => normalizeCallingAction(item, dealers, index))
            .sort(
              (a, b) =>
                (parseActionDate(b.actionAt)?.getTime() || 0) - (parseActionDate(a.actionAt)?.getTime() || 0),
            )
        : []

      if (!useApi) {
        setCallingActions(normalizedLocal)
        setCallingActionsUnavailable(normalizedLocal.length === 0)
        return
      }

      try {
        const dealerIdParam = !callingDealerFilter || callingDealerFilter === "all" || callingDealerFilter.startsWith("name:")
          ? undefined
          : callingDealerFilter
        const dateRangeParams = getDateRangeParams(callingRange)
        const response = await api.hr.callingActions.getAll({
          limit: 2000,
          range: callingRange,
          ...(dealerIdParam ? { dealerId: dealerIdParam } : {}),
          ...dateRangeParams,
        })
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
              .sort(
                (a, b) =>
                  (parseActionDate(b.actionAt)?.getTime() || 0) - (parseActionDate(a.actionAt)?.getTime() || 0),
              )
          : []
        const mergedById = new Map<string, CallingActionRecord>()
        ;[...normalizedFromApi, ...normalizedLocal].forEach((item) => {
          if (!item?.id) return
          if (!mergedById.has(item.id)) mergedById.set(item.id, item)
        })
        const merged = Array.from(mergedById.values()).sort(
          (a, b) => (parseActionDate(b.actionAt)?.getTime() || 0) - (parseActionDate(a.actionAt)?.getTime() || 0),
        )
        setCallingActions(merged)
        setCallingActionsUnavailable(merged.length === 0)
      } catch {
        setCallingActions(normalizedLocal)
        setCallingActionsUnavailable(normalizedLocal.length === 0)
      }
    }
    loadCallingActions()
  }, [dealers, useApi, realtimeTick, callingRange, callingDealerFilter])

  useEffect(() => {
    const socket = getRealtime()
    if (!socket) return

    const triggerRealtimeRefetch = () => {
      setRealtimeTick((prev) => prev + 1)
    }

    const onBackendMutation = (evt: any) => {
      const domain = String(evt?.domain || "").toLowerCase()
      const path = String(evt?.path || "").toLowerCase()
      if (
        domain === "hr" ||
        domain === "admin" ||
        domain === "dealers" ||
        domain === "dealer" ||
        path.includes("calling") ||
        path.includes("leads")
      ) {
        triggerRealtimeRefetch()
      }
    }

    socket.on("dealer:directory-updated", triggerRealtimeRefetch)
    socket.on("calling:actions-updated", triggerRealtimeRefetch)
    socket.on("calling:uploads-updated", triggerRealtimeRefetch)
    socket.on("backend:mutation", onBackendMutation)

    return () => {
      socket.off("dealer:directory-updated", triggerRealtimeRefetch)
      socket.off("calling:actions-updated", triggerRealtimeRefetch)
      socket.off("calling:uploads-updated", triggerRealtimeRefetch)
      socket.off("backend:mutation", onBackendMutation)
    }
  }, [])

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

      const result = await api.hr.uploadLeadsCsv(csvFile, selectedDealerIds, DEFAULT_ACTIVE_LIMIT)
      const parsed = Number(result?.parsed || result?.total || csvRows.length)
      const created = Number(result?.created || result?.inserted || 0)
      const skippedDuplicate = Number(result?.skippedDuplicate || result?.skipped || 0)
      const assigned = Number(result?.assigned || created || 0)
      const queued = Number(result?.queued || 0)

      setCsvRows([])
      setCsvFile(null)
      setCsvFileName("")
      setRealtimeTick((prev) => prev + 1)
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

  const getCallingRangeBounds = () => {
    const now = new Date()
    if (callingRange === "all") return null
    if (callingRange === "daily") {
      const start = new Date(now)
      start.setHours(0, 0, 0, 0)
      const end = new Date(now)
      end.setHours(23, 59, 59, 999)
      return { start, end }
    }
    if (callingRange === "weekly") {
      const startOfWeek = new Date(now)
      const day = startOfWeek.getDay()
      const diff = day === 0 ? 6 : day - 1
      startOfWeek.setDate(now.getDate() - diff)
      startOfWeek.setHours(0, 0, 0, 0)
      const endOfWeek = new Date(startOfWeek)
      endOfWeek.setDate(startOfWeek.getDate() + 6)
      endOfWeek.setHours(23, 59, 59, 999)
      return { start: startOfWeek, end: endOfWeek }
    }
    if (callingRange === "monthly") {
      const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
      return { start, end }
    }
    if (callingRange === "last_month") {
      const prevMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1
      const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()
      const start = new Date(prevYear, prevMonth, 1, 0, 0, 0, 0)
      const end = new Date(prevYear, prevMonth + 1, 0, 23, 59, 59, 999)
      return { start, end }
    }
    return null
  }

  const isWithinCallingRange = (actionAt?: string) => {
    const bounds = getCallingRangeBounds()
    if (!bounds) return true
    if (!actionAt) return false
    const actionDate = parseActionDate(actionAt)
    if (!actionDate) return false
    return actionDate >= bounds.start && actionDate <= bounds.end
  }

  const filteredCallingActions = useMemo(() => {
    return callingActions.filter((item) => {
      const isNameFilter = callingDealerFilter.startsWith("name:")
      const normalizedNameFilter = normalizeName(callingDealerFilter.replace(/^name:/, ""))
      const normalizedItemDealerName = normalizeName(item.dealerName)
      const matchesDealer =
        callingDealerFilter === "all" ||
        item.dealerId === callingDealerFilter ||
        normalizedItemDealerName === normalizeName(callingDealerFilter) ||
        (isNameFilter && normalizedItemDealerName === normalizedNameFilter)
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
          const parsed = parseCallRemarkParts(item.callRemark || "")
          const action = String(item.action || "").toLowerCase()
          const status = String(parsed.status || "").toLowerCase()
          if (action === "not_interested" || status.includes("not interested")) acc.notInterested += 1
          else if (action === "follow_up" || status.includes("follow-up") || status.includes("callback")) acc.followUp += 1
          else if (action === "called" && (status.includes("interested") || status.includes("site visit") || status.includes("quotation"))) acc.interested += 1
          else if (action === "called") acc.interested += 1
          else acc.others += 1
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
                <CardTitle className="text-base">Select Dealers</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoadingDealers ? (
                  <p className="text-sm text-muted-foreground">Loading dealers...</p>
                ) : dealers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No dealers found.</p>
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
                            {batch.dealers.map((name) => (
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
                                <th className="py-1 pr-3">Assigned Dealer</th>
                                <th className="py-1 pr-3">Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {batch.rows.map((row, idx) => (
                                <tr key={`${batch.id}-${row.mobile}-${idx}`} className="border-t border-border/40">
                                  {(() => {
                                    const completed = isCompletedAssignmentStatus(row.assignmentStatus)
                                    const shownDealerName = completed ? row.assignedDealerName || "Unassigned" : "Unassigned"
                                    const shownStatus = completed ? prettifyAssignmentStatus(row.assignmentStatus || "completed") : "Pending"
                                    return (
                                      <>
                                  <td className="py-1 pr-3">{row.name || "N/A"}</td>
                                  <td className="py-1 pr-3">{row.mobile || "N/A"}</td>
                                  <td className="py-1 pr-3">{row.kNumber || "N/A"}</td>
                                  <td className="py-1 pr-3">{row.address || "N/A"}</td>
                                  <td className="py-1 pr-3">{shownDealerName}</td>
                                  <td className="py-1 pr-3">
                                    <Badge variant="outline">
                                      {shownStatus}
                                    </Badge>
                                  </td>
                                      </>
                                    )
                                  })()}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
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
                    {filteredCallingActions.slice(0, 300).map((item) => {
                      const parsedRemark = parseCallRemarkParts(item.callRemark || "")
                      const statusLabel = ACTION_LABEL_MAP[item.action] || item.action || "N/A"
                      return (
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
                              {statusLabel}
                            </Badge>
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {item.actionAt ? new Date(item.actionAt).toLocaleString() : "N/A"}
                            </span>
                          </div>
                        </div>
                        <div className="mt-2 space-y-1 text-sm">
                          {parsedRemark.statusCategory ? (
                            <p className="break-words">
                              <span className="font-medium">Status Category:</span> {parsedRemark.statusCategory}
                            </p>
                          ) : null}
                          <p className="break-words">
                            <span className="font-medium">Status:</span> {parsedRemark.status || statusLabel}
                          </p>
                          {parsedRemark.remark ? (
                            <p className="break-words">
                              <span className="font-medium">Remark:</span> {parsedRemark.remark}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    )})}
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
