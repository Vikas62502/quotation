"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { SolarLogo } from "@/components/solar-logo"
import { LogOut, BadgeCheck, FileCheck2, ShieldCheck, Search, CalendarDays, ChevronDown } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { api } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

type BaldevQuotation = {
  id: string
  customer?: { firstName?: string; lastName?: string; mobile?: string }
  createdAt?: string
  pricing?: { subtotal?: number; totalAmount?: number; finalAmount?: number }
  subtotal?: number
  totalAmount?: number
  finalAmount?: number
  installationStatus?: string
  installerApprovedAt?: string
}

type InstallerWorkflowItem = {
  status: "pending" | "inprogress" | "approved"
  updatedAt: string
}

type BaldevWorkflowItem = {
  status: "queue" | "completed"
  updatedAt: string
}

export default function BaldevDashboardPage() {
  const router = useRouter()
  const { isAuthenticated, role, baldev, logout } = useAuth()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<"all" | "dcr" | "pending" | "done">("dcr")
  const [searchTerm, setSearchTerm] = useState("")
  const [quotations, setQuotations] = useState<BaldevQuotation[]>([])
  const [installerWorkflowMap, setInstallerWorkflowMap] = useState<Record<string, InstallerWorkflowItem>>({})
  const [baldevWorkflowMap, setBaldevWorkflowMap] = useState<Record<string, BaldevWorkflowItem>>({})
  const [dcrGeneratedIds, setDcrGeneratedIds] = useState<Record<string, boolean>>({})
  const [savingId, setSavingId] = useState<string | null>(null)
  const [finalDocsExpandedId, setFinalDocsExpandedId] = useState<string | null>(null)
  const [finalDocsSavingId, setFinalDocsSavingId] = useState<string | null>(null)
  const [finalBillFileByQuotation, setFinalBillFileByQuotation] = useState<Record<string, File | null>>({})
  const [panelWarrantyFileByQuotation, setPanelWarrantyFileByQuotation] = useState<Record<string, File | null>>({})
  const [inverterWarrantyFileByQuotation, setInverterWarrantyFileByQuotation] = useState<Record<string, File | null>>({})
  const [workCompletionWarrantyFileByQuotation, setWorkCompletionWarrantyFileByQuotation] = useState<Record<string, File | null>>({})
  const useApi = process.env.NEXT_PUBLIC_USE_API !== "false"

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/baldev-login")
      return
    }
    if (role !== "baldev") {
      router.push("/login")
    }
  }, [isAuthenticated, role, router])

  useEffect(() => {
    try {
      setInstallerWorkflowMap(JSON.parse(localStorage.getItem("installerWorkflowMap") || "{}"))
    } catch {
      setInstallerWorkflowMap({})
    }
    try {
      setBaldevWorkflowMap(JSON.parse(localStorage.getItem("baldevWorkflowMap") || "{}"))
    } catch {
      setBaldevWorkflowMap({})
    }
    try {
      const raw = JSON.parse(localStorage.getItem("baldevDcrGenerated") || "[]")
      const ids = Array.isArray(raw) ? raw : []
      const map: Record<string, boolean> = {}
      for (const id of ids) {
        if (typeof id === "string" && id.trim()) map[id.trim()] = true
      }
      setDcrGeneratedIds(map)
    } catch {
      setDcrGeneratedIds({})
    }
  }, [])

  useEffect(() => {
    localStorage.setItem("baldevWorkflowMap", JSON.stringify(baldevWorkflowMap))
  }, [baldevWorkflowMap])

  useEffect(() => {
    try {
      localStorage.setItem(
        "baldevDcrGenerated",
        JSON.stringify(Object.keys(dcrGeneratedIds).filter((id) => dcrGeneratedIds[id])),
      )
    } catch {
      /* ignore */
    }
  }, [dcrGeneratedIds])

  useEffect(() => {
    const loadInstallerApprovedData = async () => {
      setIsLoading(true)
      try {
        if (useApi) {
          const response = await api.quotations.getAll({ status: "approved", page: 1, limit: 1000 })
          let list: any[] = []
          if (Array.isArray(response)) {
            list = response
          } else if (Array.isArray(response?.quotations)) {
            list = response.quotations
          } else if (Array.isArray(response?.data?.quotations)) {
            list = response.data.quotations
          }
          setQuotations(list)
        } else {
          const localQuotations = JSON.parse(localStorage.getItem("quotations") || "[]")
          const approved = localQuotations.filter((q: any) => String(q.status || "").toLowerCase() === "approved")
          setQuotations(approved)
        }
      } catch {
        toast({
          title: "Failed to load queue",
          description: "Could not load installer-approved records for Baldev confirmation.",
          variant: "destructive",
        })
        setQuotations([])
      } finally {
        setIsLoading(false)
      }
    }
    loadInstallerApprovedData()
  }, [toast, useApi])

  const normalizedSearch = searchTerm.trim().toLowerCase()

  const getAmount = (q: BaldevQuotation) =>
    Math.abs(q.pricing?.subtotal ?? q.subtotal ?? q.totalAmount ?? q.finalAmount ?? q.pricing?.totalAmount ?? 0)

  const toTimestamp = (date?: string) => {
    if (!date) return 0
    const parsed = new Date(date).getTime()
    return Number.isNaN(parsed) ? 0 : parsed
  }

  const getInstallerApprovedDate = (q: BaldevQuotation) =>
    q.installerApprovedAt || (q as any).installer_approved_at || (q as any).updatedAt || q.createdAt

  const isInBaldevQueue = (q: BaldevQuotation) => {
    const backendStatus = String(q.installationStatus || "").toLowerCase()
    const fromBackend =
      backendStatus === "installer_approved" ||
      backendStatus === "pending_baldev" ||
      backendStatus === "installer_in_progress"
    const fromInstallerLocal = installerWorkflowMap[q.id]?.status === "approved"
    const baldevCompleted = baldevWorkflowMap[q.id]?.status === "completed"
    return (fromBackend || fromInstallerLocal) && !baldevCompleted
  }

  const isFinalClosed = (q: BaldevQuotation) => {
    const backendStatus = String(q.installationStatus || "").toLowerCase()
    const fromBackend = backendStatus === "baldev_approved" || backendStatus === "completed"
    const fromLocal = baldevWorkflowMap[q.id]?.status === "completed"
    return fromBackend || fromLocal
  }

  const queueQuotations = useMemo(() => {
    return quotations
      .filter((q) => isInBaldevQueue(q))
      .filter((q) => {
        if (!normalizedSearch) return true
        const name = `${q.customer?.firstName || ""} ${q.customer?.lastName || ""}`.toLowerCase()
        return name.includes(normalizedSearch) || (q.customer?.mobile || "").includes(normalizedSearch) || q.id.toLowerCase().includes(normalizedSearch)
      })
      .sort((a, b) => toTimestamp(getInstallerApprovedDate(a)) - toTimestamp(getInstallerApprovedDate(b)))
  }, [quotations, installerWorkflowMap, baldevWorkflowMap, normalizedSearch])

  /** Same split as Admin → Final confirmation: DCR Generation → Final process → Done. */
  const dcrQuotations = useMemo(
    () => queueQuotations.filter((q) => !dcrGeneratedIds[q.id]),
    [queueQuotations, dcrGeneratedIds],
  )
  const finalProcessQuotations = useMemo(
    () => queueQuotations.filter((q) => Boolean(dcrGeneratedIds[q.id])),
    [queueQuotations, dcrGeneratedIds],
  )

  const finalClosedQuotations = useMemo(() => {
    return quotations
      .filter((q) => isFinalClosed(q))
      .filter((q) => {
        if (!normalizedSearch) return true
        const name = `${q.customer?.firstName || ""} ${q.customer?.lastName || ""}`.toLowerCase()
        return name.includes(normalizedSearch) || (q.customer?.mobile || "").includes(normalizedSearch) || q.id.toLowerCase().includes(normalizedSearch)
      })
      .sort((a, b) => {
        const aDate = baldevWorkflowMap[a.id]?.updatedAt || getInstallerApprovedDate(a)
        const bDate = baldevWorkflowMap[b.id]?.updatedAt || getInstallerApprovedDate(b)
        return toTimestamp(aDate) - toTimestamp(bDate)
      })
  }, [quotations, baldevWorkflowMap, normalizedSearch])

  const activeList = useMemo(() => {
    if (activeTab === "dcr") return dcrQuotations
    if (activeTab === "pending") return finalProcessQuotations
    if (activeTab === "done") return finalClosedQuotations
    return [...queueQuotations, ...finalClosedQuotations]
  }, [activeTab, dcrQuotations, finalProcessQuotations, finalClosedQuotations, queueQuotations])

  const markDcrGenerated = (quotationId: string) => {
    setDcrGeneratedIds((prev) => ({ ...prev, [quotationId]: true }))
    setActiveTab("pending")
    toast({
      title: "DCR generated",
      description: "Moved to Final process.",
    })
  }

  const markFinalApproved = async (quotationId: string) => {
    setSavingId(quotationId)
    try {
      setBaldevWorkflowMap((prev) => ({
        ...prev,
        [quotationId]: {
          status: "completed",
          updatedAt: new Date().toISOString(),
        },
      }))
      toast({
        title: "Final approval done",
        description: "Moved to Done (Final confirmation).",
      })
      setActiveTab("done")
    } finally {
      setSavingId(null)
    }
  }

  const toggleFinalDocuments = (quotationId: string) => {
    setFinalDocsExpandedId((prev) => (prev === quotationId ? null : quotationId))
  }

  const saveFinalDocuments = async (quotationId: string) => {
    const finalBillFile = finalBillFileByQuotation[quotationId] || null
    const panelFile = panelWarrantyFileByQuotation[quotationId] || null
    const inverterFile = inverterWarrantyFileByQuotation[quotationId] || null
    const workFile = workCompletionWarrantyFileByQuotation[quotationId] || null
    if (!finalBillFile && !panelFile && !inverterFile && !workFile) {
      toast({
        title: "Upload required",
        description: "Please upload at least one final confirmation document (PDF/JPG).",
        variant: "destructive",
      })
      return
    }
    try {
      setFinalDocsSavingId(quotationId)
      if (useApi) {
        await api.quotations.uploadFinalConfirmationDocuments(quotationId, {
          customerFinalBillFile: finalBillFile,
          panelWarrantyFile: panelFile,
          inverterWarrantyFile: inverterFile,
          workCompletionWarrantyFile: workFile,
        })
      }
      toast({
        title: "Saved",
        description: "Final confirmation documents updated.",
      })
      setFinalDocsExpandedId(null)
    } catch (error) {
      toast({
        title: "Save failed",
        description: error instanceof Error ? error.message : "Could not save final confirmation documents.",
        variant: "destructive",
      })
    } finally {
      setFinalDocsSavingId(null)
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
            onClick={async () => {
              await logout()
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
            <BadgeCheck className="w-4 h-4 text-primary" />
          </div>
          <h1 className="text-xl font-semibold">Final confirmation</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Welcome, {baldev?.firstName || "Baldev"}. Same stages as Admin → Final confirmation: DCR Generation → Final
          process → Done.
        </p>

        <Card className="border-border/60 bg-card/90 shadow-sm">
          <CardContent className="pt-5 space-y-3">
            <div className="w-full rounded-lg border-2 border-violet-300/80 bg-violet-50/40 p-1.5">
              <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-violet-900/80">
                Final confirmation (same as Admin)
              </p>
              <div className="flex flex-wrap gap-1">
                {(
                  [
                    { key: "all" as const, label: `All (${queueQuotations.length + finalClosedQuotations.length})` },
                    { key: "dcr" as const, label: `DCR Generation (${dcrQuotations.length})` },
                    { key: "pending" as const, label: `Final process (${finalProcessQuotations.length})` },
                    { key: "done" as const, label: `Done (${finalClosedQuotations.length})` },
                  ] as const
                ).map((item) => (
                  <Button
                    key={item.key}
                    type="button"
                    size="sm"
                    variant={activeTab === item.key ? "default" : "ghost"}
                    className={cn("h-8 text-xs", activeTab === item.key && "shadow-sm")}
                    onClick={() => setActiveTab(item.key)}
                  >
                    {item.key === "dcr" ? <FileCheck2 className="w-3.5 h-3.5 mr-1" /> : null}
                    {item.key === "pending" ? <ShieldCheck className="w-3.5 h-3.5 mr-1" /> : null}
                    {item.key === "done" ? <BadgeCheck className="w-3.5 h-3.5 mr-1" /> : null}
                    {item.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="relative w-full md:w-80 md:ml-auto">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by customer, mobile, quotation id"
                className="h-9 pl-8 text-sm"
              />
            </div>
          </CardContent>
        </Card>

        <div className="space-y-3 pt-1">
            {isLoading ? (
              <Card><CardContent className="py-8 text-sm text-muted-foreground">Loading final confirmation records...</CardContent></Card>
            ) : activeList.length === 0 ? (
              <Card><CardContent className="py-8 text-sm text-muted-foreground">No records in this stage.</CardContent></Card>
            ) : (
              activeList.map((q) => {
                const isDone = isFinalClosed(q)
                const needsDcr = !isDone && !dcrGeneratedIds[q.id]
                return (
                <Card
                  key={q.id}
                  className={
                    isDone
                      ? "border-green-200/70 bg-gradient-to-r from-green-50/40 to-card shadow-sm"
                      : "border-border/60 bg-gradient-to-r from-card to-muted/20 shadow-sm"
                  }
                >
                  <CardContent className="p-4">
                    <div className="flex flex-wrap md:flex-nowrap items-center gap-3">
                      <div className="min-w-[180px] flex-1">
                        <p className="text-sm font-semibold leading-tight">{q.customer?.firstName || "N/A"} {q.customer?.lastName || ""}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{q.customer?.mobile || "No mobile"} • {q.id}</p>
                      </div>
                      <div className="min-w-[120px]">
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                          {isDone ? "Closed On" : "Installer Approved"}
                        </p>
                        <p className="text-xs font-medium flex items-center gap-1">
                          <CalendarDays className="w-3 h-3 text-muted-foreground" />
                          {isDone
                            ? baldevWorkflowMap[q.id]?.updatedAt
                              ? new Date(baldevWorkflowMap[q.id].updatedAt).toLocaleDateString("en-IN")
                              : "N/A"
                            : getInstallerApprovedDate(q)
                              ? new Date(getInstallerApprovedDate(q) as string).toLocaleDateString("en-IN")
                              : "N/A"}
                        </p>
                      </div>
                      <div className="min-w-[120px]">
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Subtotal</p>
                        <p className="text-sm font-semibold">₹{getAmount(q).toLocaleString()}</p>
                      </div>
                      <div className="min-w-[130px]">
                        <Badge
                          variant="outline"
                          className={
                            isDone
                              ? "text-xs border-green-300 bg-green-50 text-green-800"
                              : needsDcr
                                ? "text-xs border-amber-300 bg-amber-50 text-amber-900"
                                : "text-xs border-sky-300 bg-sky-50 text-sky-800"
                          }
                        >
                          {isDone ? "Done" : needsDcr ? "DCR Generation" : "Final process"}
                        </Badge>
                      </div>
                      <div className="ml-auto flex flex-wrap gap-2 justify-end">
                        <Button variant="outline" size="sm" onClick={() => toggleFinalDocuments(q.id)}>
                          <ChevronDown className="w-3.5 h-3.5 mr-1" />
                          Update Final Details
                        </Button>
                        {needsDcr ? (
                          <Button size="sm" onClick={() => markDcrGenerated(q.id)}>
                            Generate DCR
                          </Button>
                        ) : null}
                        {!isDone && !needsDcr ? (
                          <Button size="sm" onClick={() => markFinalApproved(q.id)} disabled={savingId === q.id}>
                            {savingId === q.id ? "Saving..." : "Mark Final Approved"}
                          </Button>
                        ) : null}
                      </div>
                    </div>
                    {finalDocsExpandedId === q.id ? (
                      <div className="mt-4 rounded-md border border-border/70 p-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <p className="text-xs">Customer Final Bill (PDF/JPG)</p>
                            <Input
                              type="file"
                              accept="image/*,.heic,.heif,.pdf"
                              className="h-9 text-sm"
                              onChange={(e) =>
                                setFinalBillFileByQuotation((prev) => ({ ...prev, [q.id]: e.target.files?.[0] || null }))
                              }
                            />
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs">Panel Warranty (PDF/JPG)</p>
                            <Input
                              type="file"
                              accept="image/*,.heic,.heif,.pdf"
                              className="h-9 text-sm"
                              onChange={(e) =>
                                setPanelWarrantyFileByQuotation((prev) => ({ ...prev, [q.id]: e.target.files?.[0] || null }))
                              }
                            />
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs">Inverter Warranty (PDF/JPG)</p>
                            <Input
                              type="file"
                              accept="image/*,.heic,.heif,.pdf"
                              className="h-9 text-sm"
                              onChange={(e) =>
                                setInverterWarrantyFileByQuotation((prev) => ({ ...prev, [q.id]: e.target.files?.[0] || null }))
                              }
                            />
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs">Work Completion Warranty (PDF/JPG)</p>
                            <Input
                              type="file"
                              accept="image/*,.heic,.heif,.pdf"
                              className="h-9 text-sm"
                              onChange={(e) =>
                                setWorkCompletionWarrantyFileByQuotation((prev) => ({ ...prev, [q.id]: e.target.files?.[0] || null }))
                              }
                            />
                          </div>
                        </div>
                        <div className="mt-3 flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => setFinalDocsExpandedId(null)}>
                            Cancel
                          </Button>
                          <Button size="sm" onClick={() => void saveFinalDocuments(q.id)} disabled={finalDocsSavingId === q.id}>
                            {finalDocsSavingId === q.id ? "Saving..." : "Save Details"}
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              )})
            )}
        </div>
      </main>
    </div>
  )
}
