"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
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
import { ClipboardList, Landmark, Loader2, Plus } from "lucide-react"
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
  getOfficeOutsideAccountsLink,
  markQuotationSentToAccounts,
  saveRequirementSlip,
  setOutsideVendorForQuotation,
  type OfficeOutsideAccountsLink,
} from "@/lib/office-outside-accounts"
import { cn } from "@/lib/utils"

const CREATE_NEW_VALUE = "__create_new_outside_vendor__"

type Props = {
  quotationId: string
  customerName?: string
  className?: string
  compact?: boolean
}

export function OfficeOutsideQuotationActions({
  quotationId,
  customerName,
  className,
  compact = true,
}: Props) {
  const { toast } = useToast()
  const [vendors, setVendors] = useState<AdminSubvendorRecord[]>(() =>
    readAdminSubvendors().filter((row) => row.kind === "office_outside"),
  )
  const [link, setLink] = useState<OfficeOutsideAccountsLink | null>(() =>
    getOfficeOutsideAccountsLink(quotationId),
  )
  const [sending, setSending] = useState(false)
  const [slipOpen, setSlipOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [slipItems, setSlipItems] = useState("")
  const [slipNotes, setSlipNotes] = useState("")
  const [newName, setNewName] = useState("")
  const [newMobile, setNewMobile] = useState("")
  const [newContact, setNewContact] = useState("")
  const [savingVendor, setSavingVendor] = useState(false)

  const refreshVendors = useCallback(async () => {
    const local = readAdminSubvendors().filter((row) => row.kind === "office_outside")
    setVendors(local)
    try {
      const res = await api.admin.subvendors.getAll({ kind: "office_outside" })
      const remote = pickSubvendorListFromApi(res).filter((row) => row.kind === "office_outside")
      if (remote.length > 0) {
        const merged = [
          ...remote,
          ...readAdminSubvendors().filter(
            (row) => row.kind !== "office_outside" || !remote.some((r) => r.id === row.id),
          ),
        ]
        writeAdminSubvendors(merged)
        setVendors(remote)
      }
    } catch {
      // keep local
    }
  }, [])

  useEffect(() => {
    void refreshVendors()
  }, [refreshVendors])

  useEffect(() => {
    setLink(getOfficeOutsideAccountsLink(quotationId))
  }, [quotationId])

  const selectedVendorId = link?.outsideVendorId || ""
  const sent = Boolean(link?.sentToAccountsAt)

  const vendorOptions = useMemo(
    () => [...vendors].sort((a, b) => a.name.localeCompare(b.name)),
    [vendors],
  )

  const onVendorChange = (value: string) => {
    if (value === CREATE_NEW_VALUE) {
      setCreateOpen(true)
      return
    }
    const vendor = vendors.find((row) => row.id === value)
    const next = setOutsideVendorForQuotation(quotationId, value, vendor?.name)
    setLink(next)
  }

  const openSlip = () => {
    const current = getOfficeOutsideAccountsLink(quotationId)
    if (!current?.outsideVendorId) {
      toast({
        title: "Select outside vendor",
        description: "Choose an outside vendor before opening the requirement slip.",
        variant: "destructive",
      })
      return
    }
    setSlipItems(current.requirementSlip?.items || "")
    setSlipNotes(current.requirementSlip?.notes || "")
    setSlipOpen(true)
  }

  const saveSlip = () => {
    try {
      const next = saveRequirementSlip(quotationId, { items: slipItems, notes: slipNotes })
      setLink(next)
      setSlipOpen(false)
      toast({ title: "Requirement slip saved" })
    } catch (error) {
      toast({
        title: "Could not save slip",
        description: error instanceof Error ? error.message : "Select an outside vendor first.",
        variant: "destructive",
      })
    }
  }

  const sendToAccounts = async () => {
    setSending(true)
    try {
      const next = markQuotationSentToAccounts(quotationId)
      setLink(next)
      toast({
        title: "Sent to Accounts",
        description: `${customerName || quotationId} is with Accounts for the selected outside vendor.`,
      })
    } catch (error) {
      toast({
        title: "Select outside vendor",
        description: error instanceof Error ? error.message : "Choose an outside vendor first.",
        variant: "destructive",
      })
    } finally {
      setSending(false)
    }
  }

  const createVendor = async () => {
    const name = newName.trim()
    if (!name) {
      toast({ title: "Name required", description: "Enter the outside vendor name.", variant: "destructive" })
      return
    }
    setSavingVendor(true)
    const payload = {
      kind: "office_outside" as const,
      dealerId: "",
      name,
      contactName: newContact.trim(),
      mobile: newMobile.trim(),
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
      const next = setOutsideVendorForQuotation(quotationId, created.id, created.name)
      setLink(next)
      setCreateOpen(false)
      setNewName("")
      setNewMobile("")
      setNewContact("")
      toast({ title: "Outside vendor created", description: created.name })
    } finally {
      setSavingVendor(false)
    }
  }

  return (
    <div className={cn("flex flex-col gap-1 min-w-0", compact ? "max-w-[11rem]" : "", className)}>
      <Select value={selectedVendorId || undefined} onValueChange={onVendorChange}>
        <SelectTrigger className="h-8 text-[10px] w-full">
          <SelectValue placeholder="Outside vendor" />
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
      <div className="flex flex-wrap items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-[10px] px-1.5 border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100"
          onClick={() => void sendToAccounts()}
          disabled={sending || !selectedVendorId}
          title="Send to Accounts (outside vendor)"
        >
          {sending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Landmark className="w-3 h-3 mr-1" />}
          {sent ? "Sent" : "Accounts"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-sky-700 hover:bg-sky-50"
          onClick={openSlip}
          title="Requirement slip"
          disabled={!selectedVendorId}
        >
          <ClipboardList className="w-3.5 h-3.5" />
        </Button>
        {sent ? (
          <Badge variant="outline" className="h-5 px-1 text-[9px] border-emerald-200 bg-emerald-50 text-emerald-800">
            Accounts
          </Badge>
        ) : null}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create outside vendor</DialogTitle>
            <DialogDescription>
              Only outside vendors can be linked here. Register basic details, then select them on the quotation.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Vendor name *</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Outside vendor name" />
            </div>
            <div>
              <Label>Contact</Label>
              <Input value={newContact} onChange={(e) => setNewContact(e.target.value)} placeholder="Contact person" />
            </div>
            <div>
              <Label>Mobile</Label>
              <Input value={newMobile} onChange={(e) => setNewMobile(e.target.value)} placeholder="Mobile" />
            </div>
            <Button type="button" onClick={() => void createVendor()} disabled={savingVendor} className="w-full">
              {savingVendor ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Save & select
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={slipOpen} onOpenChange={setSlipOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Requirement slip</DialogTitle>
            <DialogDescription>
              Materials / requirements for Accounts and the selected outside vendor.
              {customerName ? ` Customer: ${customerName}` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Requirements / materials</Label>
              <Textarea
                rows={5}
                value={slipItems}
                onChange={(e) => setSlipItems(e.target.value)}
                placeholder="Panels, inverter, structure, wiring, meter…"
              />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea rows={3} value={slipNotes} onChange={(e) => setSlipNotes(e.target.value)} placeholder="Extra notes" />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setSlipOpen(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={saveSlip}>
                Save slip
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
