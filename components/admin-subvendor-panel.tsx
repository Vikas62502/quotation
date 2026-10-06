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
  formatFileCostPerKwInput,
  formatProfitRatioInput,
  formatProfitRatioLabel,
  parseFileCostPerKw,
  parseInrAmount,
  parseProfitRatio,
  fileChargesFromVendorRate,
  formatInrAmountInput,
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
import { cn } from "@/lib/utils"
import {
  getLedgerAmounts,
  isApprovedQuotation,
  LEDGER_FIELD_LABELS,
  OFFICE_INSIDE_AMOUNT_FIELDS,
  amountsFromLedgerDrafts,
  applyOfficeInsideGstToAmounts,
  applyOfficeInsideGstToDrafts,
  draftsFromLedgerAmounts,
  ledgerPatchToApiBody,
  officeInsideGstCharges,
  officeInsideDeductedTotal,
  officeInsideProfitFromAmounts,
  parseLedgerAmountInput,
  paymentTypeLabelForLedger,
  pickLedgerMapFromApi,
  quotationLoanCashAmountsForLedger,
  quotationPaymentTypeForLedger,
  readSubvendorLedger,
  upsertLedgerAmounts,
  writeSubvendorLedger,
  type LedgerAmountField,
  type LedgerPaymentType,
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

type InsideLedgerRow = {
  quotationId: string
  dealerId: string
  customerName: string
  customerMobile: string
  vendorName: string
  vendorMobile: string
  systemSize: string
  paymentType: LedgerPaymentType
  paymentTypeLabel: string
  subtotal: number
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

function ledgerStatus(row: Pick<InsideLedgerRow, "receivedAmount" | "remaining">) {
  if (row.remaining <= 0) return { label: "Completed", tone: "completed" as const }
  if (row.receivedAmount > 0) return { label: "Partial", tone: "partial" as const }
  return { label: "Pending", tone: "pending" as const }
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
  profitRatio: "",
  fileCostPerKw: "1000",
  leaserPaid: "",
  leaserRemaining: "",
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

  const vendorProfitById = useMemo(() => {
    const approved = quotations.filter(isApprovedQuotation)
    const current = keepCurrentQuotationsOnly(approved, approved)
    const out: Record<string, number> = {}
    for (const quotation of current) {
      const dealerId = String(quotation.dealerId || quotation.dealer?.id || "")
      const vendor = vendorsByDealerId.get(dealerId)
      if (!vendor) continue
      const stored = getLedgerAmounts(ledgerMap, quotation.id)
      const payment = summarizeQuotationPayment(quotation)
      const proposal = stored.proposal ?? payment.subtotal
      const amount = Math.round((Math.max(0, proposal) * parseProfitRatio(vendor.profitRatio)) / 100)
      out[vendor.id] = (out[vendor.id] || 0) + amount
    }
    return out
  }, [ledgerMap, quotations, vendorsByDealerId])

  const ledgerRows = useMemo(() => {
    const approved = quotations.filter(isApprovedQuotation)
    const current = keepCurrentQuotationsOnly(approved, approved)
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
        const proposal = stored.proposal ?? 0
        const pi = stored.pi ?? 0
        const paymentType = quotationPaymentTypeForLedger(quotation)
        const loanCash = quotationLoanCashAmountsForLedger(
          quotation,
          proposal > 0 ? proposal : payment.subtotal,
        )
        const autoFileCharges = fileChargesFromVendorRate(
          getQuotationSystemKw(quotation),
          vendor?.fileCostPerKw ?? 0,
        )
        const fileCharges =
          stored.fileCharges != null && stored.fileCharges > 0 ? stored.fileCharges : autoFileCharges
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
          paymentType,
          paymentTypeLabel: paymentTypeLabelForLedger(paymentType),
          subtotal: payment.subtotal,
          loanAmount: stored.loanAmount ?? loanCash.loanAmount,
          cashAmount: stored.cashAmount ?? loanCash.cashAmount,
          receivedAmount: stored.receivedAmount ?? payment.paidAmount,
          remaining: stored.remaining ?? payment.remainingAmount,
          proposal,
          costOfSite: officeInsideDeductedTotal({
            proposal,
            pi,
            fileCharges,
            gstCharges: officeInsideGstCharges(proposal, pi),
            others: stored.others ?? 0,
          }),
          fileCharges,
          pi,
          gstCharges: officeInsideGstCharges(proposal, pi),
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

  const commitLedgerAmounts = async (quotationId: string, patch: SubvendorLedgerAmounts) => {
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
      profitRatio: formatProfitRatioInput(row.profitRatio),
      fileCostPerKw: formatFileCostPerKwInput(row.fileCostPerKw),
      leaserPaid: formatInrAmountInput(row.leaserPaid),
      leaserRemaining: formatInrAmountInput(row.leaserRemaining),
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
        profitRatio: parseProfitRatio(form.profitRatio),
        fileCostPerKw: parseFileCostPerKw(form.fileCostPerKw),
        leaserPaid: parseInrAmount(form.leaserPaid),
        leaserRemaining: parseInrAmount(form.leaserRemaining),
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
        profitRatio: parseProfitRatio(form.profitRatio),
        fileCostPerKw: parseFileCostPerKw(form.fileCostPerKw),
        leaserPaid: parseInrAmount(form.leaserPaid),
        leaserRemaining: parseInrAmount(form.leaserRemaining),
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
              profitById={vendorProfitById}
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
                onSaveAmounts={commitLedgerAmounts}
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
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
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
              <Label>File cost (₹ / kW)</Label>
              <Input
                inputMode="numeric"
                className="tabular-nums"
                placeholder="1000"
                value={form.fileCostPerKw}
                onChange={(e) => setForm((p) => ({ ...p, fileCostPerKw: e.target.value }))}
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                File charges = rounded kW × this rate. 4.4 kW → 4, 4.6 kW → 5.
              </p>
            </div>
            <div>
              <Label>Profit ratio (%)</Label>
              <Input
                inputMode="decimal"
                className="tabular-nums"
                placeholder="0"
                value={form.profitRatio}
                onChange={(e) => setForm((p) => ({ ...p, profitRatio: e.target.value }))}
              />
              <p className="text-[11px] text-muted-foreground mt-1">Percent of this vendor's profit, 0–100.</p>
              {editingId ? (
                <p className="text-sm font-semibold tabular-nums text-emerald-800 dark:text-emerald-300 mt-1.5">
                  Profit {formatLedgerInr(vendorProfitById[editingId] ?? 0)}
                </p>
              ) : null}
            </div>
            <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-3 space-y-3">
              <p className="text-sm font-medium">Leaser</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Paid</Label>
                  <Input
                    inputMode="numeric"
                    className="tabular-nums"
                    placeholder="0"
                    value={form.leaserPaid}
                    onChange={(e) => setForm((p) => ({ ...p, leaserPaid: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>Remaining</Label>
                  <Input
                    inputMode="numeric"
                    className="tabular-nums"
                    placeholder="0"
                    value={form.leaserRemaining}
                    onChange={(e) => setForm((p) => ({ ...p, leaserRemaining: e.target.value }))}
                  />
                </div>
              </div>
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
  profitById,
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
  profitById?: Record<string, number>
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
      {rows.map((row) => {
        const profitAmount = profitById?.[row.id] ?? 0
        return (
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
          <div className="mt-3 space-y-2">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Profit</p>
              <p className="text-sm font-semibold tabular-nums text-emerald-800 dark:text-emerald-300">
                {formatLedgerInr(profitAmount)}
              </p>
              <p className="text-[11px] text-muted-foreground tabular-nums mt-0.5">
                {formatProfitRatioLabel(row.profitRatio)}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">File cost</p>
                <p className="text-sm font-semibold tabular-nums">
                  ₹{parseFileCostPerKw(row.fileCostPerKw).toLocaleString("en-IN")}/kW
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Leaser</p>
                <p className="text-sm font-semibold tabular-nums">{formatLedgerInr(row.leaserPaid)}</p>
                <p className="text-[11px] text-muted-foreground tabular-nums mt-0.5">
                  Remaining {formatLedgerInr(row.leaserRemaining)}
                </p>
              </div>
            </div>
          </div>
        </div>
        )
      })}
    </div>
  )
}

function InsideVendorLedger({
  rows,
  totals,
  search,
  onSearch,
  vendorId,
  onVendorId,
  vendors,
  onSaveAmounts,
}: {
  rows: InsideLedgerRow[]
  totals: Record<LedgerAmountField, number>
  search: string
  onSearch: (value: string) => void
  vendorId: string
  onVendorId: (value: string) => void
  vendors: AdminSubvendorRecord[]
  onSaveAmounts: (quotationId: string, patch: SubvendorLedgerAmounts) => Promise<void> | void
}) {
  const [manageRowId, setManageRowId] = useState<string | null>(null)
  const [manageDrafts, setManageDrafts] = useState<Record<LedgerAmountField, string> | null>(null)
  const [saving, setSaving] = useState(false)
  const manageRow = rows.find((row) => row.quotationId === manageRowId) ?? null

  const openManage = (row: InsideLedgerRow) => {
    setManageRowId(row.quotationId)
    setManageDrafts(applyOfficeInsideGstToDrafts(draftsFromLedgerAmounts(row)))
  }

  const closeManage = () => {
    setManageRowId(null)
    setManageDrafts(null)
  }

  const saveManage = async () => {
    if (!manageRowId || !manageDrafts) return
    const patch = applyOfficeInsideGstToAmounts(amountsFromLedgerDrafts(manageDrafts))
    setSaving(true)
    try {
      await onSaveAmounts(manageRowId, patch)
      closeManage()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-xl border border-border/70 bg-card shadow-sm">
      <div className="flex flex-col gap-3 border-b border-border/70 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold">Office inside ledger</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Same card layout as Accounts. Edit amounts from Manage.
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
        <div className="p-3 space-y-2">
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2">
            {(
              [
                ["Proposal", totals.proposal],
                ["Received", totals.receivedAmount],
                ["Remaining", totals.remaining],
                ["Loan", totals.loanAmount],
                ["Cash", totals.cashAmount],
                ["Cost of site", totals.costOfSite],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="min-w-0">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
                <p className="text-sm font-semibold tabular-nums">{formatLedgerInr(value)}</p>
              </div>
            ))}
          </div>

          {rows.map((row) => {
            const status = ledgerStatus(row)
            return (
              <Card
                key={row.quotationId}
                className={cn(
                  "shadow-none px-3 py-2.5 border border-border/70 border-l-4 overflow-hidden",
                  status.tone === "completed"
                    ? "border-l-emerald-500 bg-card"
                    : status.tone === "partial"
                      ? "border-l-amber-500 bg-card"
                      : "border-l-rose-500 bg-card",
                )}
              >
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-2 gap-y-2 items-center w-full xl:grid-cols-[minmax(11rem,1.35fr)_minmax(4.5rem,0.5fr)_minmax(5rem,0.6fr)_minmax(5rem,0.6fr)_minmax(5rem,0.6fr)_minmax(6.25rem,0.75fr)_minmax(5rem,0.55fr)_minmax(7rem,0.9fr)_minmax(5.5rem,0.4fr)]">
                  <div className="col-span-2 sm:col-span-3 xl:col-span-1 min-w-0">
                    <p className="text-sm font-semibold leading-tight break-words">
                      {row.customerName}
                      <span className="font-normal text-muted-foreground">
                        {" "}
                        ({row.customerMobile || "N/A"})
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 break-words">
                      Vendor: {row.vendorName || "Unassigned"} • {row.vendorMobile || "No contact"}
                    </p>
                  </div>

                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">System size</p>
                    <p className="text-sm font-semibold leading-tight">{row.systemSize}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{row.paymentTypeLabel}</p>
                  </div>

                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Proposal</p>
                    <p className="text-sm font-semibold tabular-nums">{formatLedgerInr(row.proposal)}</p>
                  </div>

                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Received</p>
                    <p
                      className={cn(
                        "text-sm font-semibold tabular-nums",
                        row.receivedAmount <= 0 ? "text-rose-700" : "text-foreground",
                      )}
                    >
                      {formatLedgerInr(row.receivedAmount)}
                    </p>
                  </div>

                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Remaining</p>
                    <p
                      className={cn(
                        "text-sm font-semibold tabular-nums",
                        row.remaining <= 0 ? "text-emerald-700" : "text-amber-700",
                      )}
                    >
                      {formatLedgerInr(Math.max(row.remaining, 0))}
                    </p>
                  </div>

                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Payment</p>
                    <p className="text-sm font-semibold leading-tight">{row.paymentTypeLabel}</p>
                    {row.paymentType === "mix" ? (
                      <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">
                        L {formatLedgerInr(row.loanAmount)} · C {formatLedgerInr(row.cashAmount)}
                      </p>
                    ) : row.paymentType === "loan" ? (
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Loan {formatLedgerInr(row.loanAmount)}
                      </p>
                    ) : row.paymentType === "cash" ? (
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Cash {formatLedgerInr(row.cashAmount)}
                      </p>
                    ) : null}
                    <p
                      className={cn(
                        "text-[11px] mt-0.5 font-medium",
                        status.tone === "completed"
                          ? "text-emerald-700"
                          : status.tone === "partial"
                            ? "text-amber-700"
                            : "text-rose-700",
                      )}
                    >
                      {status.label}
                    </p>
                  </div>

                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Cost of site</p>
                    <p className="text-sm font-semibold tabular-nums">{formatLedgerInr(row.costOfSite)}</p>
                  </div>

                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Charges</p>
                    <div className="mt-0.5 space-y-0.5">
                      {(
                        [
                          ["File", row.fileCharges],
                          ["PI", row.pi],
                          ["GST", row.gstCharges],
                          ["Others", row.others],
                        ] as const
                      )
                        .filter(([label]) => label !== "GST" || row.pi > 0)
                        .map(([label, value]) => (
                        <p key={label} className="text-[10px] leading-tight tabular-nums">
                          <span className="text-muted-foreground">{label}</span> {formatLedgerInr(value)}
                        </p>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button
                      type="button"
                      size="sm"
                      className="h-6 px-3 text-[10px] leading-none font-medium w-full max-w-[7.25rem]"
                      onClick={() => openManage(row)}
                    >
                      Manage
                    </Button>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <Dialog
        open={Boolean(manageRowId)}
        onOpenChange={(open) => {
          if (!open) closeManage()
        }}
      >
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pr-8">
            <div>
              <DialogTitle>Ledger management</DialogTitle>
              <DialogDescription>Update amounts for this office inside customer file.</DialogDescription>
            </div>
            <Button type="button" size="sm" className="shrink-0" onClick={() => void saveManage()} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </DialogHeader>
          {manageRow && manageDrafts ? (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-lg border border-border/60 bg-muted/20 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold">{manageRow.customerName}</p>
                  <p className="text-xs text-muted-foreground">
                    Customer No: {manageRow.customerMobile || "N/A"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Vendor: {manageRow.vendorName || "Unassigned"} • {manageRow.vendorMobile || "No contact"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {manageRow.systemSize} · {manageRow.paymentTypeLabel}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Subtotal</p>
                  <p className="text-base font-semibold tabular-nums">{formatLedgerInr(manageRow.subtotal)}</p>
                  <p
                    className={cn(
                      "text-[11px] mt-1",
                      manageRow.remaining <= 0 ? "font-semibold text-emerald-700" : "text-muted-foreground",
                    )}
                  >
                    Remaining: {formatLedgerInr(manageRow.remaining)}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {OFFICE_INSIDE_AMOUNT_FIELDS.filter(
                  (field) =>
                    field !== "gstCharges" || parseLedgerAmountInput(manageDrafts.pi) > 0,
                ).map((field) => {
                  const isGst = field === "gstCharges"
                  return (
                  <div key={field} className="space-y-1.5">
                    <Label htmlFor={`ledger-${field}`}>{LEDGER_FIELD_LABELS[field]}</Label>
                    <Input
                      id={`ledger-${field}`}
                      inputMode="numeric"
                      className="tabular-nums"
                      placeholder="0"
                      readOnly={isGst}
                      disabled={isGst}
                      value={manageDrafts[field]}
                      onChange={(e) => {
                        if (isGst) return
                        const raw = e.target.value
                        setManageDrafts((prev) => {
                          if (!prev) return prev
                          const next = { ...prev, [field]: raw }
                          return field === "proposal" || field === "pi"
                            ? applyOfficeInsideGstToDrafts(next)
                            : next
                        })
                      }}
                    />
                    {isGst ? (
                      <p className="text-[11px] text-muted-foreground">(Proposal − PI) × 8.9%</p>
                    ) : null}
                  </div>
                  )
                })}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Cost of site</p>
                  {(() => {
                    const liveSiteCost = officeInsideDeductedTotal(
                      amountsFromLedgerDrafts(manageDrafts),
                    )
                    return (
                      <>
                        <p className="text-lg font-semibold tabular-nums">
                          {formatLedgerInr(liveSiteCost)}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          PI + file charges + others + GST
                        </p>
                      </>
                    )
                  })()}
                </div>
                <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Profit</p>
                {(() => {
                  const liveProfit = officeInsideProfitFromAmounts(
                    manageRow.subtotal,
                    amountsFromLedgerDrafts(manageDrafts),
                  )
                  return (
                    <>
                      <p
                        className={cn(
                          "text-lg font-semibold tabular-nums",
                          liveProfit >= 0 ? "text-emerald-700" : "text-rose-700",
                        )}
                      >
                        {formatLedgerInr(liveProfit)}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Subtotal − cost of site
                      </p>
                    </>
                  )
                })()}
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
