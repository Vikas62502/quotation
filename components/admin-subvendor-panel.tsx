"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Search, Plus, Pencil, Trash2, Building2, UserPlus, Truck } from "lucide-react"
import type { Quotation } from "@/lib/quotation-context"
import { keepCurrentQuotationsOnly } from "@/lib/quotation-current"
import { summarizeQuotationPayment } from "@/lib/dealer-payment-summary"
import { getQuotationSystemKw } from "@/lib/quotation-system-kw"
import { api, ApiError, apiErrorToUserMessage } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import {
  SUBVENDOR_CATEGORIES,
  createAdminSubvendor,
  dealerDisplayName,
  deleteAdminSubvendor,
  pickSubvendorListFromApi,
  pickSubvendorRecordFromApi,
  readAdminSubvendors,
  snapshotFromDealer,
  subvendorToApiBody,
  updateAdminSubvendor,
  writeAdminSubvendors,
  type AdminSubvendorRecord,
  type SubvendorDealerOption,
  type SubvendorKind,
} from "@/lib/admin-subvendors"
import {
  getLedgerAmounts,
  isApprovedQuotation,
  ledgerPatchToApiBody,
  paymentTypeLabelForLedger,
  pickLedgerMapFromApi,
  pickSiteCostFromQuotation,
  quotationLoanCashAmountsForLedger,
  quotationPaymentTypeForLedger,
  readAccountSiteCostMap,
  readSubvendorLedger,
  upsertLedgerAmounts,
  writeSubvendorLedger,
  type LedgerAmountField,
  type SubvendorLedgerAmounts,
} from "@/lib/admin-subvendor-ledger"

function formatLedgerInr(amount: number) {
  return `₹${Math.round(amount || 0).toLocaleString("en-IN")}`
}

function formatLedgerSystemSize(kw: number) {
  if (!Number.isFinite(kw) || kw <= 0) return "—"
  const rounded = Math.round(kw * 100) / 100
  const label =
    Math.abs(rounded - Math.round(rounded)) < 1e-9
      ? String(Math.round(rounded))
      : String(rounded).replace(/\.?0+$/, "")
  return `${label}kW`
}

function parseAmountInput(raw: string) {
  const cleaned = String(raw ?? "").replace(/[₹,\s]/g, "").trim()
  if (cleaned === "") return 0
  const n = Number(cleaned)
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : 0
}

const emptyForm = {
  dealerId: "",
  name: "",
  contactName: "",
  mobile: "",
  email: "",
  city: "",
  category: "Other",
  notes: "",
}

function matchesSearch(row: AdminSubvendorRecord, q: string) {
  if (!q) return true
  return [row.name, row.contactName, row.mobile, row.email, row.city, row.category, row.dealerId]
    .join(" ")
    .toLowerCase()
    .includes(q)
}

export function AdminSubvendorPanel({
  dealers = [],
  quotations = [],
}: {
  dealers?: SubvendorDealerOption[]
  quotations?: Quotation[]
}) {
  const { toast } = useToast()
  const useApi = process.env.NEXT_PUBLIC_USE_API !== "false"
  const [rows, setRows] = useState<AdminSubvendorRecord[]>(() => readAdminSubvendors())
  const [kind, setKind] = useState<SubvendorKind>("office_inside")
  const [search, setSearch] = useState("")
  const [ledgerSearch, setLedgerSearch] = useState("")
  const [ledgerVendorId, setLedgerVendorId] = useState("all")
  const [ledgerMap, setLedgerMap] = useState<Record<string, SubvendorLedgerAmounts>>(() =>
    readSubvendorLedger(),
  )
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [savingVendor, setSavingVendor] = useState(false)

  useEffect(() => {
    let cancelled = false
    const loadRemote = async () => {
      if (!useApi) return
      try {
        const [vendorsRes, ledgerRes] = await Promise.all([
          api.admin.subvendors.getAll(),
          api.admin.subvendors.ledger.getAll(),
        ])
        if (cancelled) return
        const vendors = pickSubvendorListFromApi(vendorsRes)
        writeAdminSubvendors(vendors)
        setRows(vendors)
        const ledger = pickLedgerMapFromApi(ledgerRes)
        writeSubvendorLedger(ledger)
        setLedgerMap(ledger)
      } catch {
        // Keep local cache when the subvendor API is not live yet.
      }
    }
    void loadRemote()
    return () => {
      cancelled = true
    }
  }, [useApi])

  const dealersById = useMemo(() => new Map(dealers.map((d) => [d.id, d])), [dealers])

  const displayRows = useMemo(
    () =>
      rows.map((row) => {
        if (row.kind !== "office_inside" || !row.dealerId) return row
        const dealer = dealersById.get(row.dealerId)
        if (!dealer) return row
        return { ...row, ...snapshotFromDealer(dealer) }
      }),
    [dealersById, rows],
  )

  const insideRows = useMemo(
    () => displayRows.filter((row) => row.kind === "office_inside"),
    [displayRows],
  )
  const outsideRows = useMemo(
    () => displayRows.filter((row) => row.kind === "office_outside"),
    [displayRows],
  )
  const visibleRows = kind === "office_inside" ? insideRows : outsideRows
  const filtered = useMemo(
    () => visibleRows.filter((row) => matchesSearch(row, search.trim().toLowerCase())),
    [search, visibleRows],
  )

  const insideDealerIds = useMemo(
    () => new Set(insideRows.map((row) => row.dealerId).filter(Boolean)),
    [insideRows],
  )
  const vendorsByDealerId = useMemo(
    () => new Map(insideRows.map((row) => [row.dealerId, row])),
    [insideRows],
  )

  const ledgerRows = useMemo(() => {
    const approved = quotations.filter(isApprovedQuotation)
    const current = keepCurrentQuotationsOnly(approved, approved)
    const siteCosts = readAccountSiteCostMap()
    const q = ledgerSearch.trim().toLowerCase()
    return current
      .filter((quotation) => {
        const dealerId = String(quotation.dealerId || quotation.dealer?.id || "")
        if (!insideDealerIds.has(dealerId)) return false
        if (ledgerVendorId !== "all" && dealerId !== ledgerVendorId) return false
        const vendor = vendorsByDealerId.get(dealerId)
        const payment = summarizeQuotationPayment(quotation)
        const paymentType = quotationPaymentTypeForLedger(quotation)
        if (!q) return true
        return [
          payment.customerName,
          payment.customerMobile,
          vendor?.name,
          vendor?.mobile,
          quotation.dealer?.firstName,
          quotation.dealer?.lastName,
          paymentTypeLabelForLedger(paymentType),
          formatLedgerSystemSize(getQuotationSystemKw(quotation)),
        ]
          .join(" ")
          .toLowerCase()
          .includes(q)
      })
      .map((quotation) => {
        const dealerId = String(quotation.dealerId || quotation.dealer?.id || "")
        const vendor = vendorsByDealerId.get(dealerId)
        const payment = summarizeQuotationPayment(quotation)
        const stored = getLedgerAmounts(ledgerMap, quotation.id)
        const proposal = stored.proposal ?? payment.subtotal
        const paymentType = quotationPaymentTypeForLedger(quotation)
        const loanCash = quotationLoanCashAmountsForLedger(quotation, proposal)
        return {
          quotationId: quotation.id,
          dealerId,
          customerName: payment.customerName,
          customerMobile: payment.customerMobile,
          vendorName:
            vendor?.name ||
            dealerDisplayName({
              id: dealerId,
              username: quotation.dealer?.username || "",
              firstName: quotation.dealer?.firstName || "",
              lastName: quotation.dealer?.lastName || "",
              mobile: quotation.dealer?.mobile || "",
              email: quotation.dealer?.email || "",
            }),
          vendorMobile: vendor?.mobile || quotation.dealer?.mobile || "",
          systemSize: formatLedgerSystemSize(getQuotationSystemKw(quotation)),
          paymentTypeLabel: paymentTypeLabelForLedger(paymentType),
          loanAmount: stored.loanAmount ?? loanCash.loanAmount,
          cashAmount: stored.cashAmount ?? loanCash.cashAmount,
          receivedAmount: stored.receivedAmount ?? payment.paidAmount,
          remaining: stored.remaining ?? payment.remainingAmount,
          proposal,
          costOfSite: stored.costOfSite ?? pickSiteCostFromQuotation(quotation, siteCosts),
          fileCharges: stored.fileCharges ?? 0,
          pi: stored.pi ?? 0,
          gstCharges: stored.gstCharges ?? 0,
          others: stored.others ?? 0,
        }
      })
      .sort((a, b) => a.customerName.localeCompare(b.customerName))
  }, [insideDealerIds, ledgerMap, ledgerSearch, ledgerVendorId, quotations, vendorsByDealerId])

  const ledgerTotals = useMemo(
    () =>
      ledgerRows.reduce(
        (sum, row) => ({
          loanAmount: sum.loanAmount + row.loanAmount,
          cashAmount: sum.cashAmount + row.cashAmount,
          receivedAmount: sum.receivedAmount + row.receivedAmount,
          remaining: sum.remaining + row.remaining,
          proposal: sum.proposal + row.proposal,
          costOfSite: sum.costOfSite + row.costOfSite,
          fileCharges: sum.fileCharges + row.fileCharges,
          pi: sum.pi + row.pi,
          gstCharges: sum.gstCharges + row.gstCharges,
          others: sum.others + row.others,
        }),
        {
          loanAmount: 0,
          cashAmount: 0,
          receivedAmount: 0,
          remaining: 0,
          proposal: 0,
          costOfSite: 0,
          fileCharges: 0,
          pi: 0,
          gstCharges: 0,
          others: 0,
        },
      ),
    [ledgerRows],
  )

  useEffect(() => {
    if (ledgerVendorId !== "all" && !insideDealerIds.has(ledgerVendorId)) {
      setLedgerVendorId("all")
    }
  }, [insideDealerIds, ledgerVendorId])

  const commitLedgerAmount = async (quotationId: string, field: LedgerAmountField, raw: string) => {
    const patch = { [field]: parseAmountInput(raw) } as SubvendorLedgerAmounts
    const next = upsertLedgerAmounts(quotationId, patch)
    setLedgerMap(next)
    if (!useApi) return
    try {
      await api.admin.subvendors.ledger.update(quotationId, ledgerPatchToApiBody(patch))
    } catch (error) {
      toast({
        title: "Ledger saved on this device",
        description:
          error instanceof ApiError
            ? apiErrorToUserMessage(error)
            : "Backend subvendor ledger route is not live yet.",
        variant: "destructive",
      })
    }
  }

  const usedDealerIds = useMemo(
    () => new Set(insideRows.map((row) => row.dealerId).filter(Boolean)),
    [insideRows],
  )
  const availableDealers = useMemo(
    () =>
      dealers.filter((dealer) => {
        if (editingId) {
          const editing = rows.find((row) => row.id === editingId)
          if (editing?.dealerId === dealer.id) return true
        }
        return !usedDealerIds.has(dealer.id)
      }),
    [dealers, editingId, rows, usedDealerIds],
  )

  const openCreate = () => {
    setEditingId(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }

  const openEdit = (row: AdminSubvendorRecord) => {
    setEditingId(row.id)
    setForm({
      dealerId: row.dealerId,
      name: row.name,
      contactName: row.contactName,
      mobile: row.mobile,
      email: row.email,
      city: row.city,
      category: row.category || "Other",
      notes: row.notes,
    })
    setDialogOpen(true)
  }

  const save = async () => {
    let payload: Omit<AdminSubvendorRecord, "id" | "createdAt">
    if (kind === "office_inside") {
      const dealer = dealersById.get(form.dealerId)
      if (!dealer) return
      payload = {
        kind: "office_inside",
        ...snapshotFromDealer(dealer),
        category: form.category.trim() || "Other",
        notes: form.notes.trim(),
      }
    } else {
      const name = form.name.trim()
      if (!name) return
      payload = {
        kind: "office_outside",
        dealerId: "",
        name,
        contactName: form.contactName.trim(),
        mobile: form.mobile.trim(),
        email: form.email.trim(),
        city: form.city.trim(),
        category: form.category.trim() || "Other",
        notes: form.notes.trim(),
      }
    }

    setSavingVendor(true)
    try {
      if (useApi) {
        try {
          const response = editingId
            ? await api.admin.subvendors.update(editingId, subvendorToApiBody(payload))
            : await api.admin.subvendors.create(subvendorToApiBody(payload))
          const remote = pickSubvendorRecordFromApi(response)
          if (remote) {
            if (editingId) updateAdminSubvendor(editingId, remote)
            else {
              writeAdminSubvendors([remote, ...readAdminSubvendors().filter((row) => row.id !== remote.id)])
            }
          } else if (editingId) {
            updateAdminSubvendor(editingId, payload)
          } else {
            createAdminSubvendor(payload)
          }
        } catch (error) {
          if (editingId) updateAdminSubvendor(editingId, payload)
          else createAdminSubvendor(payload)
          toast({
            title: "Vendor saved on this device",
            description:
              error instanceof ApiError
                ? apiErrorToUserMessage(error)
                : "Backend subvendor route is not live yet.",
            variant: "destructive",
          })
        }
      } else if (editingId) {
        updateAdminSubvendor(editingId, payload)
      } else {
        createAdminSubvendor(payload)
      }
      setRows(readAdminSubvendors())
      setDialogOpen(false)
    } finally {
      setSavingVendor(false)
    }
  }

  const remove = async (id: string) => {
    if (!window.confirm("Remove this vendor?")) return
    if (useApi) {
      try {
        await api.admin.subvendors.delete(id)
      } catch (error) {
        toast({
          title: "Vendor removed on this device",
          description:
            error instanceof ApiError
              ? apiErrorToUserMessage(error)
              : "Backend subvendor route is not live yet.",
          variant: "destructive",
        })
      }
    }
    deleteAdminSubvendor(id)
    setRows(readAdminSubvendors())
  }

  const canSave =
    kind === "office_inside" ? Boolean(form.dealerId) : Boolean(form.name.trim())

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Subvendors</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Office inside vendors are selected from dealers, then maintained in the customer ledger.
              Office outside vendors use basic registration.
            </p>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs
          value={kind}
          onValueChange={(value) => {
            setKind(value === "office_outside" ? "office_outside" : "office_inside")
            setSearch("")
          }}
          className="space-y-4"
        >
          <TabsList className="grid h-auto w-full grid-cols-1 sm:grid-cols-2 gap-2 bg-transparent p-0">
            <TabsTrigger
              value="office_inside"
              className="h-auto items-start justify-start gap-3 rounded-xl border border-border/70 bg-muted/20 px-4 py-3 text-left whitespace-normal data-[state=active]:border-primary data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              <Building2 className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-foreground">
                  Office inside vendors ({insideRows.length})
                </span>
                <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                  Select dealers, then maintain the customer ledger
                </span>
              </span>
            </TabsTrigger>
            <TabsTrigger
              value="office_outside"
              className="h-auto items-start justify-start gap-3 rounded-xl border border-border/70 bg-muted/20 px-4 py-3 text-left whitespace-normal data-[state=active]:border-primary data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              <UserPlus className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-foreground">
                  Office outside vendors ({outsideRows.length})
                </span>
                <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                  Basic registration for external vendors
                </span>
              </span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="office_inside" className="space-y-4">
            <VendorToolbar
              search={search}
              onSearch={setSearch}
              searchPlaceholder="Search office inside vendors..."
              addLabel="Select dealer"
              onAdd={openCreate}
              addDisabled={availableDealers.length === 0 && !editingId}
            />
            <VendorGrid
              rows={filtered}
              emptyLabel={insideRows.length === 0 ? "No office inside vendors yet" : "No matching vendors"}
              emptyHint={
                insideRows.length === 0
                  ? dealers.length === 0
                    ? "Add dealers in Users first, then select them here."
                    : "Select a dealer to add them as an office inside vendor."
                  : undefined
              }
              kindLabel="Office inside"
              onEdit={openEdit}
              onRemove={remove}
              onAdd={openCreate}
              addLabel="Select dealer"
              showAdd={insideRows.length === 0 && availableDealers.length > 0}
              compact
            />
            {insideRows.length > 0 ? (
              <InsideVendorLedger
                rows={ledgerRows}
                totals={ledgerTotals}
                search={ledgerSearch}
                onSearch={setLedgerSearch}
                vendorId={ledgerVendorId}
                onVendorId={setLedgerVendorId}
                vendors={insideRows}
                onCommitAmount={commitLedgerAmount}
              />
            ) : null}
          </TabsContent>

          <TabsContent value="office_outside" className="space-y-4">
            <VendorToolbar
              search={search}
              onSearch={setSearch}
              searchPlaceholder="Search office outside vendors..."
              addLabel="Register vendor"
              onAdd={openCreate}
            />
            <VendorGrid
              rows={filtered}
              emptyLabel={outsideRows.length === 0 ? "No office outside vendors yet" : "No matching vendors"}
              emptyHint={
                outsideRows.length === 0
                  ? "Register an external vendor with basic details."
                  : undefined
              }
              kindLabel="Office outside"
              onEdit={openEdit}
              onRemove={remove}
              onAdd={openCreate}
              addLabel="Register vendor"
              showAdd={outsideRows.length === 0}
            />
          </TabsContent>
        </Tabs>
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {kind === "office_inside"
                ? editingId
                  ? "Edit office inside vendor"
                  : "Select dealer"
                : editingId
                  ? "Edit office outside vendor"
                  : "Register vendor"}
            </DialogTitle>
            <DialogDescription>
              {kind === "office_inside"
                ? "Choose a dealer from Users. Their name and contact details come from the dealer profile."
                : "Enter basic registration details for a vendor who works outside the office."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {kind === "office_inside" ? (
              <div>
                <Label>Dealer *</Label>
                <Select
                  value={form.dealerId}
                  onValueChange={(v) => setForm((p) => ({ ...p, dealerId: v }))}
                  disabled={Boolean(editingId)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a dealer" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableDealers.length === 0 ? (
                      <SelectItem value="__none" disabled>
                        No dealers available
                      </SelectItem>
                    ) : (
                      availableDealers.map((dealer) => (
                        <SelectItem key={dealer.id} value={dealer.id}>
                          {dealerDisplayName(dealer)} ({dealer.username})
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <>
                <div>
                  <Label>Company / vendor name *</Label>
                  <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
                </div>
                <div>
                  <Label>Contact person</Label>
                  <Input
                    value={form.contactName}
                    onChange={(e) => setForm((p) => ({ ...p, contactName: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Mobile</Label>
                    <Input value={form.mobile} onChange={(e) => setForm((p) => ({ ...p, mobile: e.target.value }))} />
                  </div>
                  <div>
                    <Label>City</Label>
                    <Input value={form.city} onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <Label>Email</Label>
                  <Input value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
                </div>
              </>
            )}
            <div>
              <Label>Category</Label>
              <Select value={form.category} onValueChange={(v) => setForm((p) => ({ ...p, category: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUBVENDOR_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                rows={3}
                value={form.notes}
                onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              />
            </div>
            <Button className="w-full" onClick={() => void save()} disabled={!canSave || savingVendor}>
              {savingVendor
                ? "Saving..."
                : kind === "office_inside"
                  ? editingId
                    ? "Save changes"
                    : "Add dealer as vendor"
                  : editingId
                    ? "Save changes"
                    : "Register vendor"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

function VendorToolbar({
  search,
  onSearch,
  searchPlaceholder,
  addLabel,
  onAdd,
  addDisabled,
}: {
  search: string
  onSearch: (value: string) => void
  searchPlaceholder: string
  addLabel: string
  onAdd: () => void
  addDisabled?: boolean
}) {
  return (
    <div className="flex flex-col sm:flex-row gap-3">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder={searchPlaceholder}
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          className="pl-9"
        />
      </div>
      <Button size="sm" className="shrink-0 h-10" onClick={onAdd} disabled={addDisabled}>
        <Plus className="w-4 h-4 mr-1" />
        {addLabel}
      </Button>
    </div>
  )
}

function VendorGrid({
  rows,
  emptyLabel,
  emptyHint,
  kindLabel,
  onEdit,
  onRemove,
  onAdd,
  addLabel,
  showAdd,
  compact,
}: {
  rows: AdminSubvendorRecord[]
  emptyLabel: string
  emptyHint?: string
  kindLabel: string
  onEdit: (row: AdminSubvendorRecord) => void
  onRemove: (id: string) => void
  onAdd: () => void
  addLabel: string
  showAdd: boolean
  compact?: boolean
}) {
  if (rows.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Truck className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>{emptyLabel}</p>
        {emptyHint ? <p className="text-xs mt-1">{emptyHint}</p> : null}
        {showAdd ? (
          <Button variant="link" className="mt-2" onClick={onAdd}>
            {addLabel}
          </Button>
        ) : null}
      </div>
    )
  }

  return (
    <div className={compact ? "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3" : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"}>
      {rows.map((row) => (
        <div key={row.id} className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-medium truncate">{row.name}</p>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <Badge variant="outline" className="text-[10px] font-medium">
                  {kindLabel}
                </Badge>
                <span className="text-xs text-muted-foreground">{row.category || "Other"}</span>
              </div>
            </div>
            <div className="flex shrink-0 gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(row)}>
                <Pencil className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive"
                onClick={() => onRemove(row.id)}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
          <div className="mt-3 space-y-1 text-sm">
            {row.contactName && row.contactName !== row.name ? <p>{row.contactName}</p> : null}
            {row.mobile ? <p className="text-muted-foreground">{row.mobile}</p> : null}
            {row.email ? <p className="text-muted-foreground truncate">{row.email}</p> : null}
            {row.city ? <p className="text-muted-foreground">{row.city}</p> : null}
            {row.notes ? <p className="text-xs text-muted-foreground pt-1">{row.notes}</p> : null}
          </div>
        </div>
      ))}
    </div>
  )
}

type InsideLedgerRow = {
  quotationId: string
  dealerId: string
  customerName: string
  customerMobile: string
  vendorName: string
  vendorMobile: string
  systemSize: string
  paymentTypeLabel: string
  loanAmount: number
  cashAmount: number
  receivedAmount: number
  remaining: number
  proposal: number
  costOfSite: number
  fileCharges: number
  pi: number
  gstCharges: number
  others: number
}

function InsideVendorLedger({
  rows,
  totals,
  search,
  onSearch,
  vendorId,
  onVendorId,
  vendors,
  onCommitAmount,
}: {
  rows: InsideLedgerRow[]
  totals: Omit<
    InsideLedgerRow,
    "quotationId" | "dealerId" | "customerName" | "customerMobile" | "vendorName" | "vendorMobile" | "systemSize" | "paymentTypeLabel"
  >
  search: string
  onSearch: (value: string) => void
  vendorId: string
  onVendorId: (value: string) => void
  vendors: AdminSubvendorRecord[]
  onCommitAmount: (quotationId: string, field: LedgerAmountField, raw: string) => void
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-card shadow-sm">
      <div className="flex flex-col gap-3 border-b border-border/70 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold">Office inside ledger</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Full loan → cash ₹0. Full cash → loan ₹0. Cash + loan → both amounts.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <Select value={vendorId} onValueChange={onVendorId}>
            <SelectTrigger className="h-9 w-full sm:w-52">
              <SelectValue placeholder="All vendors" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All vendors</SelectItem>
              {vendors.map((vendor) => (
                <SelectItem key={vendor.id} value={vendor.dealerId}>
                  {vendor.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="relative sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search customer or vendor..."
              value={search}
              onChange={(e) => onSearch(e.target.value)}
              className="h-9 pl-9"
            />
          </div>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">
          <p>No approved customer files for these office inside vendors yet</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[108rem] border-collapse text-left">
            <thead className="bg-muted/70">
              <tr className="border-b border-border/70 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="px-3 py-2.5 whitespace-nowrap">Customer</th>
                <th className="px-3 py-2.5 whitespace-nowrap">Vendor name</th>
                <th className="px-3 py-2.5 whitespace-nowrap">System size</th>
                <th className="px-3 py-2.5 whitespace-nowrap text-right">Loan amount</th>
                <th className="px-3 py-2.5 whitespace-nowrap text-right">Cash amount</th>
                <th className="px-3 py-2.5 whitespace-nowrap text-right">Received amount</th>
                <th className="px-3 py-2.5 whitespace-nowrap text-right">Remaining</th>
                <th className="px-3 py-2.5 whitespace-nowrap text-right">Proposal</th>
                <th className="px-3 py-2.5 whitespace-nowrap text-right">Cost of site</th>
                <th className="px-3 py-2.5 whitespace-nowrap text-right">File charges</th>
                <th className="px-3 py-2.5 whitespace-nowrap text-right">PI</th>
                <th className="px-3 py-2.5 whitespace-nowrap text-right">GST charges</th>
                <th className="px-3 py-2.5 whitespace-nowrap text-right">Others</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.quotationId} className="border-b border-border/60">
                  <td className="px-3 py-2 whitespace-nowrap">
                    <p className="text-sm font-medium">{row.customerName}</p>
                    <p className="text-xs text-muted-foreground">{row.customerMobile}</p>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <p className="text-sm">{row.vendorName}</p>
                    <p className="text-xs text-muted-foreground">{row.vendorMobile || "—"}</p>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <p className="text-sm">{row.systemSize}</p>
                    <p className="text-xs text-muted-foreground">{row.paymentTypeLabel}</p>
                  </td>
                  {(
                    [
                      "loanAmount",
                      "cashAmount",
                      "receivedAmount",
                      "remaining",
                      "proposal",
                      "costOfSite",
                      "fileCharges",
                      "pi",
                      "gstCharges",
                      "others",
                    ] as const
                  ).map((field) => (
                    <td key={field} className="px-2 py-1.5">
                      <LedgerAmountInput
                        value={row[field]}
                        onCommit={(raw) => onCommitAmount(row.quotationId, field, raw)}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-muted/50 text-sm font-semibold">
                <td className="px-3 py-2.5" colSpan={3}>
                  Total ({rows.length})
                </td>
                <td className="px-3 py-2.5 tabular-nums text-right whitespace-nowrap">{formatLedgerInr(totals.loanAmount)}</td>
                <td className="px-3 py-2.5 tabular-nums text-right whitespace-nowrap">{formatLedgerInr(totals.cashAmount)}</td>
                <td className="px-3 py-2.5 tabular-nums text-right whitespace-nowrap">{formatLedgerInr(totals.receivedAmount)}</td>
                <td className="px-3 py-2.5 tabular-nums text-right whitespace-nowrap">{formatLedgerInr(totals.remaining)}</td>
                <td className="px-3 py-2.5 tabular-nums text-right whitespace-nowrap">{formatLedgerInr(totals.proposal)}</td>
                <td className="px-3 py-2.5 tabular-nums text-right whitespace-nowrap">{formatLedgerInr(totals.costOfSite)}</td>
                <td className="px-3 py-2.5 tabular-nums text-right whitespace-nowrap">{formatLedgerInr(totals.fileCharges)}</td>
                <td className="px-3 py-2.5 tabular-nums text-right whitespace-nowrap">{formatLedgerInr(totals.pi)}</td>
                <td className="px-3 py-2.5 tabular-nums text-right whitespace-nowrap">{formatLedgerInr(totals.gstCharges)}</td>
                <td className="px-3 py-2.5 tabular-nums text-right whitespace-nowrap">{formatLedgerInr(totals.others)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}

function LedgerAmountInput({ value, onCommit }: { value: number; onCommit: (raw: string) => void }) {
  const [draft, setDraft] = useState(value > 0 ? String(value) : "")
  useEffect(() => {
    setDraft(value > 0 ? String(value) : "")
  }, [value])
  const dirty = parseAmountInput(draft) !== value
  const save = () => onCommit(draft)
  return (
    <div className="flex items-center justify-end gap-1 min-w-[9.5rem]">
      <Input
        inputMode="numeric"
        className="h-8 w-[6.75rem] text-right tabular-nums text-xs"
        placeholder="0"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && dirty) save()
        }}
      />
      {dirty ? (
        <Button type="button" size="sm" className="h-8 px-2 text-xs shrink-0" onClick={save}>
          Save
        </Button>
      ) : null}
    </div>
  )
}
