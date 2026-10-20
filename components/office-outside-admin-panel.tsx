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
import {
  ClipboardList,
  Landmark,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { api, ApiError, apiErrorToUserMessage } from "@/lib/api"
import {
  createAdminSubvendor,
  pickSubvendorListFromApi,
  pickSubvendorRecordFromApi,
  readAdminSubvendors,
  subvendorToApiBody,
  writeAdminSubvendors,
  type AdminSubvendorRecord,
} from "@/lib/admin-subvendors"
import {
  deleteOfficeOutsideRecord,
  getOfficeOutsideRecord,
  listOfficeOutsidePending,
  listOfficeOutsideSentToAccounts,
  markOfficeOutsideSentToAccounts,
  OFFICE_OUTSIDE_FILE_TYPES,
  officeOutsideFileTypeLabel,
  mergeOfficeOutsideRecordsFromApi,
  officeOutsideSubtotalAmount,
  pickOfficeOutsideListFromApi,
  pickOfficeOutsideRecordFromApi,
  readOfficeOutsideRecords,
  saveOfficeOutsideRequirementSlip,
  setOfficeOutsideFileType,
  setOutsideVendorForRecord,
  type OfficeOutsideFileType,
  type OfficeOutsideRecord,
} from "@/lib/office-outside-accounts"
import { OfficeOutsideQuotationForm } from "@/components/office-outside-quotation-form"
import { OfficeOutsideSlipDialog } from "@/components/office-outside-slip-dialog"
import { buildSpecRows } from "@/lib/quotation-proposal-document"
import { cn } from "@/lib/utils"

const CREATE_NEW_VALUE = "__create_new_outside_vendor__"

function formatInr(value: number) {
  return `₹${Math.round(Number(value) || 0).toLocaleString("en-IN")}`
}

type ListFilter = "all" | "pending" | "sent"

/**
 * Admin → Quotations → All Outside
 * Separate Office Outside data (create / vendor / send to Accounts) — not All quotations.
 */
export function OfficeOutsideAdminPanel({ className }: { className?: string }) {
  const { toast } = useToast()
  const [tick, setTick] = useState(0)
  const [listFilter, setListFilter] = useState<ListFilter>("all")
  const [search, setSearch] = useState("")
  const [vendors, setVendors] = useState<AdminSubvendorRecord[]>(() =>
    readAdminSubvendors().filter((row) => row.kind === "office_outside"),
  )
  const [formOpen, setFormOpen] = useState(false)
  const [editingRecord, setEditingRecord] = useState<OfficeOutsideRecord | null>(null)
  const [slipOpen, setSlipOpen] = useState(false)
  const [vendorCreateOpen, setVendorCreateOpen] = useState(false)
  const [active, setActive] = useState<OfficeOutsideRecord | null>(null)
  const [sendingId, setSendingId] = useState<string | null>(null)

  const [slipNotes, setSlipNotes] = useState("")
  const [newVendorName, setNewVendorName] = useState("")
  const [newVendorMobile, setNewVendorMobile] = useState("")
  const [newVendorContact, setNewVendorContact] = useState("")
  const [saving, setSaving] = useState(false)

  const refreshVendors = useCallback(async () => {
    const local = readAdminSubvendors().filter((row) => row.kind === "office_outside")
    setVendors(local)
    try {
      const res = await api.admin.subvendors.getAll({ kind: "office_outside" })
      const remote = pickSubvendorListFromApi(res).filter((row) => row.kind === "office_outside")
      if (remote.length > 0) {
        writeAdminSubvendors([
          ...remote,
          ...readAdminSubvendors().filter(
            (row) => row.kind !== "office_outside" || !remote.some((r) => r.id === row.id),
          ),
        ])
        setVendors(remote)
      }
    } catch {
      // keep local
    }
  }, [])

  const refreshRecords = useCallback(async () => {
    try {
      const res = await api.admin.officeOutside.getAll()
      const remote = pickOfficeOutsideListFromApi(res)
      if (remote.length > 0) mergeOfficeOutsideRecordsFromApi(remote)
    } catch {
      // keep local
    }
    setTick((n) => n + 1)
  }, [])

  useEffect(() => {
    void refreshVendors()
    void refreshRecords()
  }, [refreshVendors, refreshRecords])

  const records = useMemo(() => {
    void tick
    if (listFilter === "pending") return listOfficeOutsidePending()
    if (listFilter === "sent") return listOfficeOutsideSentToAccounts()
    return readOfficeOutsideRecords()
  }, [tick, listFilter])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return records
    return records.filter((row) =>
      [
        row.id,
        row.customerName,
        row.mobile,
        row.email,
        row.outsideVendorName,
        row.notes,
        officeOutsideFileTypeLabel(row.fileType),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q),
    )
  }, [records, search])

  const counts = useMemo(() => {
    void tick
    const all = readOfficeOutsideRecords()
    return {
      all: all.length,
      pending: all.filter((r) => !r.sentToAccountsAt).length,
      sent: all.filter((r) => Boolean(r.sentToAccountsAt)).length,
    }
  }, [tick])

  const openCreate = () => {
    setEditingRecord(null)
    setFormOpen(true)
  }

  const openEdit = (row: OfficeOutsideRecord) => {
    setEditingRecord(row)
    setFormOpen(true)
  }

  const closeForm = () => {
    setFormOpen(false)
    setEditingRecord(null)
    setTick((n) => n + 1)
  }

  const onVendorChange = (row: OfficeOutsideRecord, value: string) => {
    if (value === CREATE_NEW_VALUE) {
      setActive(row)
      setVendorCreateOpen(true)
      return
    }
    const vendor = vendors.find((v) => v.id === value)
    const next = setOutsideVendorForRecord(row.id, value, vendor?.name)
    setTick((n) => n + 1)
    void api.admin.officeOutside
      .update(next.id, {
        outsideVendorId: next.outsideVendorId,
        outsideVendorName: next.outsideVendorName,
      })
      .then((res) => {
        const remote = pickOfficeOutsideRecordFromApi(res)
        if (remote) mergeOfficeOutsideRecordsFromApi([remote])
      })
      .catch(() => undefined)
  }

  const onFileTypeChange = (row: OfficeOutsideRecord, value: string) => {
    const next = setOfficeOutsideFileType(row.id, value as OfficeOutsideFileType)
    setTick((n) => n + 1)
    void api.admin.officeOutside
      .update(next.id, { fileType: next.fileType })
      .then((res) => {
        const remote = pickOfficeOutsideRecordFromApi(res)
        if (remote) mergeOfficeOutsideRecordsFromApi([remote])
      })
      .catch(() => undefined)
  }

  const createVendor = async () => {
    const name = newVendorName.trim()
    if (!name) {
      toast({ title: "Vendor name required", variant: "destructive" })
      return
    }
    setSaving(true)
    const payload = {
      kind: "office_outside" as const,
      dealerId: "",
      name,
      contactName: newVendorContact.trim(),
      mobile: newVendorMobile.trim(),
      email: "",
      city: "",
      category: "Other",
      notes: "",
      profitRatio: 0,
      fileCostPerKw: 1000,
      leaserPaid: 0,
      leaserRemaining: 0,
    }
    try {
      let created: AdminSubvendorRecord | null = null
      try {
        const res = await api.admin.subvendors.create(subvendorToApiBody(payload))
        created = pickSubvendorRecordFromApi(res)
      } catch (error) {
        created = createAdminSubvendor(payload)
        toast({
          title: "Vendor saved on this device",
          description:
            error instanceof ApiError
              ? apiErrorToUserMessage(error)
              : "Backend subvendor route is not live yet.",
          variant: "destructive",
        })
      }
      if (!created) created = createAdminSubvendor(payload)
      else {
        writeAdminSubvendors([
          created,
          ...readAdminSubvendors().filter((row) => row.id !== created!.id),
        ])
      }
      await refreshVendors()
      if (active) {
        setOutsideVendorForRecord(active.id, created.id, created.name)
      }
      setVendorCreateOpen(false)
      setNewVendorName("")
      setNewVendorMobile("")
      setNewVendorContact("")
      setTick((n) => n + 1)
      toast({ title: "Outside vendor created", description: created.name })
    } finally {
      setSaving(false)
    }
  }

  const sendToAccounts = async (row: OfficeOutsideRecord) => {
    setSendingId(row.id)
    try {
      const next = markOfficeOutsideSentToAccounts(row.id)
      try {
        const res = await api.admin.officeOutside.sendToAccounts(next.id)
        const remote = pickOfficeOutsideRecordFromApi(res)
        if (remote) mergeOfficeOutsideRecordsFromApi([remote])
      } catch {
        // local send already saved
      }
      setTick((n) => n + 1)
      toast({
        title: "Sent to Accounts",
        description: `${row.customerName} is now in Accounts → Office Outside.`,
      })
    } catch (error) {
      toast({
        title: "Select outside vendor",
        description: error instanceof Error ? error.message : "Choose a vendor first.",
        variant: "destructive",
      })
    } finally {
      setSendingId(null)
    }
  }

  const openSlip = (row: OfficeOutsideRecord) => {
    if (!row.outsideVendorId) {
      toast({
        title: "Select outside vendor",
        description: "Choose an outside vendor before the requirement slip.",
        variant: "destructive",
      })
      return
    }
    const current = getOfficeOutsideRecord(row.id) || row
    setActive(current)
    setSlipNotes(current.requirementSlip?.notes || "")
    setSlipOpen(true)
  }

  const saveSlip = () => {
    if (!active) return
    try {
      const overview = active.products
        ? buildSpecRows(active.products)
            .map((item) => `${item.component}: ${item.brandModel} (${item.qty})`)
            .join("\n")
        : "product-overview"
      const saved = saveOfficeOutsideRequirementSlip(active.id, { items: overview, notes: slipNotes })
      void api.admin.officeOutside
        .saveSlip(saved.id, { items: overview, notes: slipNotes })
        .then((res) => {
          const remote = pickOfficeOutsideRecordFromApi(res)
          if (remote) mergeOfficeOutsideRecordsFromApi([remote])
        })
        .catch(() => undefined)
      setSlipOpen(false)
      setTick((n) => n + 1)
      toast({ title: "Requirement slip saved" })
    } catch (error) {
      toast({
        title: "Could not save slip",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "destructive",
      })
    }
  }

  const removeRow = (row: OfficeOutsideRecord) => {
    if (!window.confirm(`Delete Office Outside record ${row.customerName}?`)) return
    deleteOfficeOutsideRecord(row.id)
    void api.admin.officeOutside.delete(row.id).catch(() => undefined)
    setTick((n) => n + 1)
    toast({ title: "Record deleted" })
  }

  const vendorOptions = useMemo(
    () => [...vendors].sort((a, b) => a.name.localeCompare(b.name)),
    [vendors],
  )

  if (formOpen) {
    return (
      <OfficeOutsideQuotationForm
        record={editingRecord}
        onCancel={closeForm}
        onSaved={() => {
          toast({
            title: editingRecord ? "Office Outside updated" : "Office Outside saved",
            description: "This stays in All Outside — not All quotations.",
          })
          closeForm()
        }}
      />
    )
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-violet-950">Office Outside</h3>
          <p className="text-xs text-muted-foreground">
            Separate from All quotations. Create uses the same quotation form, then pick an outside
            vendor and Send to Accounts — Accounts manages the ledger there.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => void refreshRecords()}>
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-8 gap-1.5 bg-violet-600 hover:bg-violet-700 text-white"
            onClick={openCreate}
          >
            <Plus className="w-3.5 h-3.5" />
            Create Outside
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {(
          [
            { key: "all" as const, label: `All (${counts.all})` },
            { key: "pending" as const, label: `Pending Accounts (${counts.pending})` },
            { key: "sent" as const, label: `Sent to Accounts (${counts.sent})` },
          ] as const
        ).map((tab) => (
          <Button
            key={tab.key}
            type="button"
            size="sm"
            variant="ghost"
            className={cn(
              "h-8 border",
              listFilter === tab.key
                ? "bg-violet-100 text-violet-900 border-violet-200"
                : "border-transparent text-violet-800 hover:bg-violet-50",
            )}
            onClick={() => setListFilter(tab.key)}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search name, mobile, id, vendor…"
        className="h-9 max-w-md"
      />

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-violet-200 bg-violet-50/40 px-4 py-10 text-center text-sm text-muted-foreground">
          No Office Outside records yet. Tap <span className="font-medium text-foreground">Create Outside</span>{" "}
          and fill the quotation form (customer + products). It stays here, not in All quotations.
        </div>
      ) : (
        <div className="space-y-2 max-h-[min(70vh,820px)] overflow-auto pr-1">
          {filtered.map((row) => {
            const sent = Boolean(row.sentToAccountsAt)
            return (
              <div
                key={row.id}
                className="rounded-xl border border-violet-200/70 bg-gradient-to-r from-white to-violet-50/40 p-3 space-y-2"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{row.customerName || "—"}</p>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {row.id}
                      {row.mobile ? ` · ${row.mobile}` : ""}
                    </p>
                    <p className="text-xs text-violet-900 mt-0.5">
                      {formatInr(officeOutsideSubtotalAmount(row))}
                      {row.products?.systemType
                        ? ` · ${String(row.products.systemType).toUpperCase()}${
                            row.products.inverterSize ? ` ${row.products.inverterSize}` : ""
                          }`
                        : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {sent ? (
                      <Badge variant="outline" className="h-5 text-[10px] border-emerald-200 bg-emerald-50 text-emerald-800">
                        In Accounts
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="h-5 text-[10px] border-amber-200 bg-amber-50 text-amber-900">
                        Pending Accounts
                      </Badge>
                    )}
                    {officeOutsideFileTypeLabel(row.fileType) ? (
                      <Badge variant="outline" className="h-5 text-[10px] border-violet-200 bg-violet-50 text-violet-800">
                        {officeOutsideFileTypeLabel(row.fileType)}
                      </Badge>
                    ) : null}
                    {row.requirementSlip?.items ? (
                      <Badge variant="outline" className="h-5 text-[10px] border-sky-200 bg-sky-50 text-sky-800">
                        Slip
                      </Badge>
                    ) : null}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(8.5rem,10rem)_auto] gap-2 items-center">
                  <Select
                    value={row.outsideVendorId || undefined}
                    onValueChange={(value) => onVendorChange(row, value)}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Select outside vendor" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={CREATE_NEW_VALUE}>
                        <span className="inline-flex items-center gap-1">
                          <Plus className="w-3 h-3" />
                          Create new outside vendor
                        </span>
                      </SelectItem>
                      {vendorOptions.map((vendor) => (
                        <SelectItem key={vendor.id} value={vendor.id}>
                          {vendor.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={row.fileType || undefined}
                    onValueChange={(value) => onFileTypeChange(row, value)}
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
                  <div className="flex flex-wrap gap-1.5">
                    {!sent ? (
                      <Button
                        type="button"
                        size="sm"
                        className="h-8 text-[11px] gap-1 bg-amber-600 hover:bg-amber-700 text-white"
                        disabled={!row.outsideVendorId || sendingId === row.id}
                        onClick={() => void sendToAccounts(row)}
                      >
                        {sendingId === row.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Landmark className="w-3.5 h-3.5" />
                        )}
                        Send to Accounts
                      </Button>
                    ) : null}
                    <Button type="button" variant="outline" size="sm" className="h-8 text-[11px] gap-1" onClick={() => openSlip(row)}>
                      <ClipboardList className="w-3.5 h-3.5" />
                      Slip
                    </Button>
                    <Button type="button" variant="outline" size="sm" className="h-8 text-[11px] gap-1" onClick={() => openEdit(row)}>
                      <Pencil className="w-3.5 h-3.5" />
                      Edit
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-rose-700"
                      onClick={() => removeRow(row)}
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Dialog open={vendorCreateOpen} onOpenChange={setVendorCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create outside vendor</DialogTitle>
            <DialogDescription>Only outside vendors can be used on Office Outside records.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Vendor name *</Label>
              <Input value={newVendorName} onChange={(e) => setNewVendorName(e.target.value)} />
            </div>
            <div>
              <Label>Contact</Label>
              <Input value={newVendorContact} onChange={(e) => setNewVendorContact(e.target.value)} />
            </div>
            <div>
              <Label>Mobile</Label>
              <Input value={newVendorMobile} onChange={(e) => setNewVendorMobile(e.target.value)} />
            </div>
            <Button type="button" className="w-full" disabled={saving} onClick={() => void createVendor()}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Save & select
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <OfficeOutsideSlipDialog
        open={slipOpen}
        onOpenChange={setSlipOpen}
        record={active}
        vendor={vendors.find((v) => v.id === active?.outsideVendorId) || null}
        notes={slipNotes}
        onNotesChange={setSlipNotes}
        onSave={saveSlip}
      />
    </div>
  )
}
