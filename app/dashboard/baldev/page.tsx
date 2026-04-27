"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { SolarLogo } from "@/components/solar-logo"
import { LogOut, BadgeCheck, FileCheck2, ShieldCheck, Search, CalendarDays, ChevronDown } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { api } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"

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
  const [activeTab, setActiveTab] = useState("queue")
  const [searchTerm, setSearchTerm] = useState("")
  const [quotations, setQuotations] = useState<BaldevQuotation[]>([])
  const [installerWorkflowMap, setInstallerWorkflowMap] = useState<Record<string, InstallerWorkflowItem>>({})
  const [baldevWorkflowMap, setBaldevWorkflowMap] = useState<Record<string, BaldevWorkflowItem>>({})
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
  }, [])

  useEffect(() => {
    localStorage.setItem("baldevWorkflowMap", JSON.stringify(baldevWorkflowMap))
  }, [baldevWorkflowMap])

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
        description: "Moved to Final Closure.",
      })
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
        const formData = new FormData()
        if (finalBillFile) formData.append("customerFinalBillFile", finalBillFile)
        if (panelFile) formData.append("panelWarrantyFile", panelFile)
        if (inverterFile) formData.append("inverterWarrantyFile", inverterFile)
        if (workFile) formData.append("workCompletionWarrantyFile", workFile)
        await api.quotations.updateDocuments(quotationId, formData)
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
            <BadgeCheck className="w-4 h-4 text-primary" />
          </div>
          <h1 className="text-xl font-semibold">Baldev Confirmation Dashboard</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Welcome, {baldev?.firstName || "Baldev"}. Verify warranty/meter documents and finalize plant completion.
        </p>

        <Card className="border-border/60 bg-card/90 shadow-sm">
          <CardContent className="pt-5 space-y-3">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="h-9">
                  <TabsTrigger value="queue" className="text-xs gap-1.5">
                    <FileCheck2 className="w-3.5 h-3.5" />
                    Confirmation Queue ({queueQuotations.length})
                  </TabsTrigger>
                  <TabsTrigger value="final" className="text-xs gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Final Closure ({finalClosedQuotations.length})
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              <div className="relative w-full md:w-80">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by customer, mobile, quotation id"
                  className="h-9 pl-8 text-sm"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="hidden">
            <TabsTrigger value="queue">Queue</TabsTrigger>
            <TabsTrigger value="final">Final</TabsTrigger>
          </TabsList>

          <TabsContent value="queue" className="space-y-3 pt-2">
            {isLoading ? (
              <Card><CardContent className="py-8 text-sm text-muted-foreground">Loading installer-approved records...</CardContent></Card>
            ) : queueQuotations.length === 0 ? (
              <Card><CardContent className="py-8 text-sm text-muted-foreground">No installer-approved records in confirmation queue.</CardContent></Card>
            ) : (
              queueQuotations.map((q) => (
                <Card key={q.id} className="border-border/60 bg-gradient-to-r from-card to-muted/20 shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex flex-wrap md:flex-nowrap items-center gap-3">
                      <div className="min-w-[180px] flex-1">
                        <p className="text-sm font-semibold leading-tight">{q.customer?.firstName || "N/A"} {q.customer?.lastName || ""}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{q.customer?.mobile || "No mobile"} • {q.id}</p>
                      </div>
                      <div className="min-w-[120px]">
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Installer Approved</p>
                        <p className="text-xs font-medium flex items-center gap-1">
                          <CalendarDays className="w-3 h-3 text-muted-foreground" />
                          {getInstallerApprovedDate(q) ? new Date(getInstallerApprovedDate(q) as string).toLocaleDateString("en-IN") : "N/A"}
                        </p>
                      </div>
                      <div className="min-w-[120px]">
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Subtotal</p>
                        <p className="text-sm font-semibold">₹{getAmount(q).toLocaleString()}</p>
                      </div>
                      <div className="min-w-[130px]">
                        <Badge variant="outline" className="text-xs">Pending Baldev</Badge>
                      </div>
                      <div className="ml-auto flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => toggleFinalDocuments(q.id)}>
                          <ChevronDown className="w-3.5 h-3.5 mr-1" />
                          Update Final Details
                        </Button>
                        <Button size="sm" onClick={() => markFinalApproved(q.id)} disabled={savingId === q.id}>
                          {savingId === q.id ? "Saving..." : "Mark Final Approved"}
                        </Button>
                      </div>
                    </div>
                    {finalDocsExpandedId === q.id ? (
                      <div className="mt-4 rounded-md border border-border/70 p-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <p className="text-xs">Customer Final Bill (PDF/JPG)</p>
                            <Input
                              type="file"
                              accept="image/*,.pdf"
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
                              accept="image/*,.pdf"
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
                              accept="image/*,.pdf"
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
                              accept="image/*,.pdf"
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
              ))
            )}
          </TabsContent>

          <TabsContent value="final" className="space-y-3 pt-2">
            {isLoading ? (
              <Card><CardContent className="py-8 text-sm text-muted-foreground">Loading final closure records...</CardContent></Card>
            ) : finalClosedQuotations.length === 0 ? (
              <Card><CardContent className="py-8 text-sm text-muted-foreground">No final closures yet.</CardContent></Card>
            ) : (
              finalClosedQuotations.map((q) => (
                <Card key={q.id} className="border-green-200/70 bg-gradient-to-r from-green-50/40 to-card shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex flex-wrap md:flex-nowrap items-center gap-3">
                      <div className="min-w-[180px] flex-1">
                        <p className="text-sm font-semibold leading-tight">{q.customer?.firstName || "N/A"} {q.customer?.lastName || ""}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{q.customer?.mobile || "No mobile"} • {q.id}</p>
                      </div>
                      <div className="min-w-[120px]">
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Closed On</p>
                        <p className="text-xs font-medium flex items-center gap-1">
                          <CalendarDays className="w-3 h-3 text-muted-foreground" />
                          {baldevWorkflowMap[q.id]?.updatedAt ? new Date(baldevWorkflowMap[q.id].updatedAt).toLocaleDateString("en-IN") : "N/A"}
                        </p>
                      </div>
                      <div className="min-w-[120px]">
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Subtotal</p>
                        <p className="text-sm font-semibold">₹{getAmount(q).toLocaleString()}</p>
                      </div>
                      <div className="ml-auto flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => toggleFinalDocuments(q.id)}>
                          <ChevronDown className="w-3.5 h-3.5 mr-1" />
                          Update Final Details
                        </Button>
                        <Badge className="bg-green-600 text-white text-xs">Final Closure</Badge>
                      </div>
                    </div>
                    {finalDocsExpandedId === q.id ? (
                      <div className="mt-4 rounded-md border border-border/70 p-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <p className="text-xs">Customer Final Bill (PDF/JPG)</p>
                            <Input
                              type="file"
                              accept="image/*,.pdf"
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
                              accept="image/*,.pdf"
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
                              accept="image/*,.pdf"
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
                              accept="image/*,.pdf"
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
              ))
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
