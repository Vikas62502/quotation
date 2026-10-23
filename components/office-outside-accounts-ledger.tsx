"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ClipboardList, Eye, Pencil, RefreshCw } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import {
  amountsFromLedgerDrafts,
  applyOfficeInsideGstToAmounts,
  applyOfficeInsideGstToDrafts,
  draftsFromLedgerAmounts,
  getLedgerAmounts,
  LEDGER_FIELD_LABELS,
  ledgerPatchToApiBody,
  parseLedgerAmountInput,
  pickLedgerMapFromApi,
  readSubvendorLedger,
  writeSubvendorLedger,
  type LedgerAmountField,
  type SubvendorLedgerAmounts,
} from "@/lib/admin-subvendor-ledger"
import {
  fetchOfficeOutsideVendorOutsideRecordsFromApi,
  isOfficeOutsideOnAccounts,
  OFFICE_OUTSIDE_FILE_TYPES,
  officeOutsideFileTypeLabel,
  officeOutsideLoanCashAmounts,
  pickOfficeOutsideRecordFromApi,
  officeOutsideSubtotalAmount,
  upsertOfficeOutsideRecordInList,
  type OfficeOutsideFileType,
  type OfficeOutsideRecord,
} from "@/lib/office-outside-accounts"
import { OfficeOutsideSlipDialog } from "@/components/office-outside-slip-dialog"
import { buildSpecRows } from "@/lib/quotation-proposal-document"
import {
  pickSubvendorListFromApi,
  readAdminSubvendors,
  writeAdminSubvendors,
  type AdminSubvendorRecord,
} from "@/lib/admin-subvendors"
import { api, apiErrorToUserMessage } from "@/lib/api"
import { cn } from "@/lib/utils"

type Props = {
  className?: string
}

const OUTSIDE_LEDGER_FIELDS = [
  "proposal",
  "pi",
  "fileCharges",
  "gstCharges",
  "others",
  "receivedAmount",
  "loanAmount",
  "cashAmount",
] as const satisfies readonly LedgerAmountField[]

function formatInr(value: number | undefined | null) {
  const n = Math.round(Number(value) || 0)
  return `₹${n.toLocaleString("en-IN")}`
}

/**
 * Accounts → Vendor Outside / Office Outside:
 * records sent from Accounts (Send to Outside). Show / edit ledger + requirement slip.
 */
export function OfficeOutsideAccountsLedger({ className }: Props) {
  const { toast } = useToast()
  const [records, setRecords] = useState<OfficeOutsideRecord[]>([])
  const [vendorFilter, setVendorFilter] = useState("all")
  const [search, setSearch] = useState("")
  const [vendors, setVendors] = useState<AdminSubvendorRecord[]>(() =>
    readAdminSubvendors().filter((row) => row.kind === "office_outside"),
  )
  const [ledgerMap, setLedgerMap] = useState<Record<string, SubvendorLedgerAmounts>>(() =>
    readSubvendorLedger(),
  )
  const [editOpen, setEditOpen] = useState(false)
  const [viewOpen, setViewOpen] = useState(false)
  const [slipOpen, setSlipOpen] = useState(false)
  const [active, setActive] = useState<OfficeOutsideRecord | null>(null)
  const [draft, setDraft] = useState<Record<LedgerAmountField, string>>(() =>
    draftsFromLedgerAmounts({}),
  )
  const [slipNotes, setSlipNotes] = useState("")
  const [saving, setSaving] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const [vendorsRes, remoteRecords, ledgerRes] = await Promise.all([
        api.admin.subvendors.getAll({ kind: "office_outside" }).catch(() => null),
        fetchOfficeOutsideVendorOutsideRecordsFromApi().catch(() => [] as OfficeOutsideRecord[]),
        api.admin.officeOutside.ledger.getAll().catch(() => null),
      ])
      setRecords(remoteRecords)
      if (vendorsRes) {
        const remote = pickSubvendorListFromApi(vendorsRes).filter((row) => row.kind === "office_outside")
        if (remote.length > 0) {
          writeAdminSubvendors([
            ...remote,
            ...readAdminSubvendors().filter(
              (row) => row.kind !== "office_outside" || !remote.some((r) => r.id === row.id),
            ),
          ])
          setVendors(remote)
        }
      } else {
        setVendors(readAdminSubvendors().filter((row) => row.kind === "office_outside"))
      }
      if (ledgerRes) {
        const ledger = pickLedgerMapFromApi(ledgerRes)
        const merged = { ...readSubvendorLedger(), ...ledger }
        writeSubvendorLedger(merged)
        setLedgerMap(merged)
      } else {
        setLedgerMap(readSubvendorLedger())
      }
    } catch {
      setRecords([])
      setVendors(readAdminSubvendors().filter((row) => row.kind === "office_outside"))
      setLedgerMap(readSubvendorLedger())
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const vendorsById = useMemo(() => {
    const map = new Map<string, AdminSubvendorRecord>()
    for (const v of vendors) map.set(v.id, v)
    return map
  }, [vendors])

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return records
      .filter((row) => (vendorFilter === "all" ? true : row.outsideVendorId === vendorFilter))
      .map((row) => {
        const vendor = vendorsById.get(row.outsideVendorId)
        const amounts = getLedgerAmounts(ledgerMap, row.id)
        const proposalFallback =
          amounts.proposal && amounts.proposal > 0 ? amounts.proposal : officeOutsideSubtotalAmount(row)
        const loanCash = officeOutsideLoanCashAmounts(row, amounts)
        return {
          row,
          vendor,
          amounts: {
            ...amounts,
            proposal: proposalFallback,
            loanAmount: loanCash.loanAmount,
            cashAmount: loanCash.cashAmount,
          },
        }
      })
      .filter(({ row, vendor }) => {
        if (!q) return true
        return (
          row.customerName.toLowerCase().includes(q) ||
          row.mobile.includes(q) ||
          row.id.toLowerCase().includes(q) ||
          String(vendor?.name || row.outsideVendorName || "")
            .toLowerCase()
            .includes(q)
        )
      })
  }, [ledgerMap, records, search, vendorFilter, vendorsById])

  const openEdit = (row: OfficeOutsideRecord) => {
    setActive(row)
    const amounts = getLedgerAmounts(ledgerMap, row.id)
    const loanCash = officeOutsideLoanCashAmounts(row, amounts)
    setDraft(
      applyOfficeInsideGstToDrafts(
        draftsFromLedgerAmounts({
          ...amounts,
          proposal: amounts.proposal > 0 ? amounts.proposal : officeOutsideSubtotalAmount(row),
          loanAmount: loanCash.loanAmount,
          cashAmount: loanCash.cashAmount,
        }),
      ),
    )
    setEditOpen(true)
  }

  const openView = (row: OfficeOutsideRecord) => {
    setActive(row)
    setViewOpen(true)
  }

  const openSlip = (row: OfficeOutsideRecord) => {
    const current = records.find((item) => item.id === row.id) || row
    setActive(current)
    setSlipNotes(current.requirementSlip?.notes || "")
    setSlipOpen(true)
  }

  const saveLedger = async () => {
    if (!active) return
    setSaving(true)
    try {
      const amounts = applyOfficeInsideGstToAmounts(amountsFromLedgerDrafts(draft))
      await api.admin.officeOutside.ledger.update(active.id, ledgerPatchToApiBody(amounts))
      const nextMap = { ...ledgerMap, [active.id]: { ...getLedgerAmounts(ledgerMap, active.id), ...amounts } }
      writeSubvendorLedger(nextMap)
      setLedgerMap(nextMap)
      setEditOpen(false)
      await refresh()
      toast({ title: "Office Outside ledger updated" })
    } catch (error) {
      toast({
        title: "Could not save ledger",
        description: apiErrorToUserMessage(error),
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const saveSlip = async () => {
    if (!active) return
    const overview = active.products
      ? buildSpecRows(active.products)
          .map((item) => `${item.component}: ${item.brandModel} (${item.qty})`)
          .join("\n")
      : "product-overview"
    try {
      const res = await api.admin.officeOutside.saveSlip(active.id, { items: overview, notes: slipNotes })
      const remote = pickOfficeOutsideRecordFromApi(res)
      if (remote) setRecords((prev) => upsertOfficeOutsideRecordInList(prev, remote))
      await refresh()
      setSlipOpen(false)
      toast({ title: "Requirement slip saved" })
    } catch (error) {
      toast({
        title: "Could not save slip",
        description: apiErrorToUserMessage(error),
        variant: "destructive",
      })
    }
  }

  const persistVendorOrFileType = async (
    row: OfficeOutsideRecord,
    patch: { vendorId?: string; fileType?: string },
  ) => {
    const vendor = patch.vendorId ? vendors.find((item) => item.id === patch.vendorId) : undefined
    try {
      const res = await api.admin.officeOutside.update(row.id, {
        outsideVendorId: patch.vendorId ?? row.outsideVendorId,
        outsideVendorName: vendor?.name ?? row.outsideVendorName,
        fileType: (patch.fileType as OfficeOutsideFileType | undefined) ?? row.fileType,
      })
      const remote = pickOfficeOutsideRecordFromApi(res)
      if (remote) setRecords((prev) => upsertOfficeOutsideRecordInList(prev, remote))
      await refresh()
    } catch (error) {
      toast({
        title: "Could not update",
        description: apiErrorToUserMessage(error),
        variant: "destructive",
      })
    }
  }

  const sentCount = records.length
  const activeAmounts = active ? getLedgerAmounts(ledgerMap, active.id) : null

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Office Outside — Accounts ledger</h3>
          <p className="text-xs text-muted-foreground">
            Data sent from Admin → Quotations → All Outside. Manage amounts (show / edit) and
            requirement slips here.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 shrink-0" onClick={() => void refresh()}>
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </Button>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search customer, mobile, id, vendor…"
          className="h-9 sm:max-w-xs"
        />
        <Select value={vendorFilter} onValueChange={setVendorFilter}>
          <SelectTrigger className="h-9 w-full sm:w-56">
            <SelectValue placeholder="Outside vendor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All outside vendors ({sentCount})</SelectItem>
            {vendors
              .slice()
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((vendor) => (
                <SelectItem key={vendor.id} value={vendor.id}>
                  {vendor.name}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-amber-200 bg-amber-50/40 px-4 py-8 text-center text-sm text-muted-foreground">
          No Office Outside files on Vendor Outside yet. On Accounts, tap Send to Outside.
        </div>
      ) : (
        <div className="space-y-2 max-h-[520px] overflow-auto pr-1">
          {rows.map(({ row, vendor, amounts }) => (
            <div
              key={row.id}
              className="rounded-xl border border-amber-200/70 bg-gradient-to-r from-white to-amber-50/40 p-3 space-y-2"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{row.customerName}</p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {row.id}
                    {row.mobile ? ` · ${row.mobile}` : ""}
                  </p>
                  <p className="text-xs text-amber-900 mt-0.5">
                    Vendor: {vendor?.name || row.outsideVendorName || "—"}
                    {officeOutsideFileTypeLabel(row.fileType)
                      ? ` · ${officeOutsideFileTypeLabel(row.fileType)}`
                      : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  {isOfficeOutsideOnAccounts(row) ? (
                    <Badge variant="outline" className="h-5 text-[10px] border-emerald-200 bg-emerald-50 text-emerald-800">
                      In Accounts
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="h-5 text-[10px] border-violet-200 bg-violet-50 text-violet-800">
                      Vendor Outside
                    </Badge>
                  )}
                  {row.requirementSlip?.items ? (
                    <Badge variant="outline" className="h-5 text-[10px] border-sky-200 bg-sky-50 text-sky-800">
                      Slip
                    </Badge>
                  ) : null}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Select
                  value={row.outsideVendorId || undefined}
                  onValueChange={(value) => void persistVendorOrFileType(row, { vendorId: value })}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Outside vendor" />
                  </SelectTrigger>
                  <SelectContent>
                    {vendors.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name || item.contactName || item.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={row.fileType || undefined}
                  onValueChange={(value) => void persistVendorOrFileType(row, { fileType: value })}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="File type" />
                  </SelectTrigger>
                  <SelectContent>
                    {OFFICE_OUTSIDE_FILE_TYPES.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[11px]">
                <p>
                  <span className="text-muted-foreground">Proposal:</span> {formatInr(amounts.proposal)}
                </p>
                <p>
                  <span className="text-muted-foreground">PI:</span> {formatInr(amounts.pi)}
                </p>
                <p>
                  <span className="text-muted-foreground">File charges:</span> {formatInr(amounts.fileCharges)}
                </p>
                <p>
                  <span className="text-muted-foreground">GST:</span> {formatInr(amounts.gstCharges)}
                </p>
                <p>
                  <span className="text-muted-foreground">Loan:</span> {formatInr(amounts.loanAmount)}
                </p>
                <p>
                  <span className="text-muted-foreground">Cash:</span> {formatInr(amounts.cashAmount)}
                </p>
                <p>
                  <span className="text-muted-foreground">Received:</span> {formatInr(amounts.receivedAmount)}
                </p>
                <p>
                  <span className="text-muted-foreground">Sent:</span>{" "}
                  {row.sentToAccountsAt
                    ? new Date(row.sentToAccountsAt).toLocaleString("en-IN")
                    : "—"}
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Button type="button" variant="outline" size="sm" className="h-7 text-[11px] gap-1" onClick={() => openView(row)}>
                  <Eye className="w-3 h-3" />
                  Show
                </Button>
                <Button type="button" variant="outline" size="sm" className="h-7 text-[11px] gap-1" onClick={() => openEdit(row)}>
                  <Pencil className="w-3 h-3" />
                  Edit
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-[11px] gap-1"
                  onClick={() => openSlip(row)}
                >
                  <ClipboardList className="w-3 h-3" />
                  Requirement slip
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Office Outside — show</DialogTitle>
            <DialogDescription>{active?.id}</DialogDescription>
          </DialogHeader>
          {active ? (
            <div className="space-y-2 text-sm">
              <p>
                <span className="text-muted-foreground">Customer:</span> {active.customerName}
              </p>
              <p>
                <span className="text-muted-foreground">Mobile:</span> {active.mobile || "—"}
              </p>
              <p>
                <span className="text-muted-foreground">Dealer:</span>{" "}
                {vendorsById.get(active.outsideVendorId)?.name || active.outsideVendorName || "—"}
              </p>
              <p>
                <span className="text-muted-foreground">File type:</span>{" "}
                {officeOutsideFileTypeLabel(active.fileType) || "—"}
              </p>
              <p>
                <span className="text-muted-foreground">Subtotal:</span>{" "}
                {formatInr(officeOutsideSubtotalAmount(active))}
              </p>
              {OUTSIDE_LEDGER_FIELDS.map((field) => (
                <p key={field}>
                  <span className="text-muted-foreground">{LEDGER_FIELD_LABELS[field]}:</span>{" "}
                  {formatInr(
                    field === "proposal" && !(activeAmounts?.proposal)
                      ? officeOutsideSubtotalAmount(active)
                      : activeAmounts?.[field],
                  )}
                </p>
              ))}
              {active.requirementSlip?.items ? (
                <div className="rounded-md border bg-muted/30 p-2 text-xs whitespace-pre-wrap">
                  <p className="font-medium mb-1">Requirement slip</p>
                  {active.requirementSlip.items}
                  {active.requirementSlip.notes ? (
                    <p className="mt-2 text-muted-foreground">{active.requirementSlip.notes}</p>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit ledger</DialogTitle>
            <DialogDescription>
              {active?.customerName} · {active?.id}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {OUTSIDE_LEDGER_FIELDS.filter((field) => {
              if (field === "gstCharges") return parseLedgerAmountInput(draft.pi) > 0
              return true
            }).map((field) => {
              const isGst = field === "gstCharges"
              return (
              <div key={field}>
                <Label>{LEDGER_FIELD_LABELS[field]}</Label>
                <Input
                  value={draft[field] || ""}
                  onChange={(e) => {
                    if (isGst) return
                    const raw = e.target.value
                    setDraft((prev) => {
                      const next = { ...prev, [field]: raw }
                      return field === "proposal" || field === "pi"
                        ? applyOfficeInsideGstToDrafts(next)
                        : next
                    })
                  }}
                  inputMode="numeric"
                  placeholder="0"
                  readOnly={isGst}
                  disabled={isGst}
                />
              </div>
              )
            })}
            <Button type="button" className="w-full" disabled={saving} onClick={() => void saveLedger()}>
              {saving ? "Saving…" : "Save ledger"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <OfficeOutsideSlipDialog
        open={slipOpen}
        onOpenChange={setSlipOpen}
        record={active}
        vendor={active ? vendors.find((v) => v.id === active.outsideVendorId) || null : null}
        notes={slipNotes}
        onNotesChange={setSlipNotes}
        onSave={() => void saveSlip()}
      />
    </div>
  )
}
