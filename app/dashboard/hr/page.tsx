"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { api, ApiError } from "@/lib/api"
import { SolarLogo } from "@/components/solar-logo"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
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
            const response = await api.admin.dealers.getAll({ limit: 1000 })
            const list = response?.dealers || []
            loadedDealers = normalizeDealerList(list.filter((d: any) => d.isActive !== false))
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
      </main>
    </div>
  )
}
