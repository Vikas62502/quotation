"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Download, Eye, FolderPlus, Loader2, PackagePlus, Save, Trash2, ChevronDown } from "lucide-react"
import { PricingSheetViewDialog } from "@/components/pricing-sheet-view-dialog"
import { api, ApiError } from "@/lib/api"
import {
  DCR_PRICING_EFFECTIVE_FROM,
  DCR_PRICING_VALID_TILL,
  getPricingData,
  type BothSystemPricing,
  type PricingTablesData,
  type SystemPricing,
} from "@/lib/pricing-tables"
import { clearPricingTablesCache, setPricingTablesCache, usePricingTables } from "@/lib/use-pricing-tables"
import {
  downloadPricingPdf,
  PRICING_PDF_SCOPE_OPTIONS,
  type PricingPdfScope,
} from "@/lib/download-dcr-pricing-pdf"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

type TableKey = "dcr" | "nonDcr" | "both"

type PendingConfirm =
  | { kind: "add-category"; table: TableKey }
  | { kind: "add-product"; table: TableKey; category: string }
  | { kind: "delete-product"; table: TableKey; index: number; label: string }
  | { kind: "delete-category"; table: TableKey; category: string; productCount: number }
  | { kind: "save" }

type EmptyCategories = Record<TableKey, string[]>

function clonePricing(data: PricingTablesData): PricingTablesData {
  return JSON.parse(JSON.stringify(data)) as PricingTablesData
}

function tableLabel(table: TableKey): string {
  if (table === "dcr") return "DCR"
  if (table === "nonDcr") return "Non-DCR"
  return "BOTH"
}

function emptySystemProduct(panelType: string): SystemPricing {
  return {
    systemSize: "3kW",
    phase: "1-Phase",
    inverterSize: "3kW",
    panelType,
    price: 0,
  }
}

function emptyBothProduct(panelType: string): BothSystemPricing {
  return {
    systemSize: "5kW",
    phase: "3-Phase",
    inverterSize: "5kW",
    dcrCapacity: "3kW",
    nonDcrCapacity: "2kW",
    panelType,
    price: 0,
  }
}

function rowSummary(table: TableKey, row: SystemPricing | BothSystemPricing | undefined): string {
  if (!row) return "this product"
  if (table === "both") {
    const both = row as BothSystemPricing
    return `${both.panelType} · ${both.systemSize} · ${both.phase} · ${both.price}`
  }
  const sys = row as SystemPricing
  return `${sys.panelType} · ${sys.systemSize} · ${sys.phase} · ${sys.price}`
}

/** Group rows by panelType (category), including empty categories from local state. */
function groupByCategory(
  rows: Array<{ panelType: string }>,
  emptyCategories: string[],
): string[] {
  const seen = new Set<string>()
  const order: string[] = []
  for (const row of rows) {
    const name = String(row.panelType || "").trim()
    if (!name || seen.has(name)) continue
    seen.add(name)
    order.push(name)
  }
  for (const name of emptyCategories) {
    const trimmed = name.trim()
    if (!trimmed || seen.has(trimmed)) continue
    seen.add(trimmed)
    order.push(trimmed)
  }
  return order
}

function parsePriceInput(value: string): number {
  const cleaned = value.replace(/,/g, "").trim()
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : 0
}

export function AdminPricingTablesManagement() {
  const { pricingTables, isLoading } = usePricingTables()
  const [draft, setDraft] = useState<PricingTablesData | null>(null)
  const [emptyCategories, setEmptyCategories] = useState<EmptyCategories>({
    dcr: [],
    nonDcr: [],
    both: [],
  })
  const [isSaving, setIsSaving] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [pricingViewScope, setPricingViewScope] = useState<PricingPdfScope | null>(null)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [pending, setPending] = useState<PendingConfirm | null>(null)
  const [categoryNameInput, setCategoryNameInput] = useState("")
  const useApi = process.env.NEXT_PUBLIC_USE_API !== "false"

  useEffect(() => {
    const source =
      pricingTables &&
      ((pricingTables.dcr?.length ?? 0) > 0 ||
        (pricingTables.nonDcr?.length ?? 0) > 0 ||
        (pricingTables.both?.length ?? 0) > 0)
        ? pricingTables
        : getPricingData()
    setDraft(clonePricing(source))
  }, [pricingTables])

  const dcrCategories = useMemo(
    () => groupByCategory(draft?.dcr ?? [], emptyCategories.dcr),
    [draft?.dcr, emptyCategories.dcr],
  )
  const nonDcrCategories = useMemo(
    () => groupByCategory(draft?.nonDcr ?? [], emptyCategories.nonDcr),
    [draft?.nonDcr, emptyCategories.nonDcr],
  )
  const bothCategories = useMemo(
    () => groupByCategory(draft?.both ?? [], emptyCategories.both),
    [draft?.both, emptyCategories.both],
  )

  const updateSystemRow = (
    table: "dcr" | "nonDcr",
    index: number,
    patch: Partial<SystemPricing>,
  ) => {
    setDraft((prev) => {
      if (!prev?.[table]) return prev
      const next = clonePricing(prev)
      const rows = next[table]
      if (!rows?.[index]) return prev
      rows[index] = { ...rows[index], ...patch }
      return next
    })
  }

  const updateBothRow = (index: number, patch: Partial<BothSystemPricing>) => {
    setDraft((prev) => {
      if (!prev?.both) return prev
      const next = clonePricing(prev)
      if (!next.both?.[index]) return prev
      next.both[index] = { ...next.both[index], ...patch }
      return next
    })
  }

  const applyAddCategory = (table: TableKey, name: string) => {
    const category = name.trim()
    if (!category) return
    setEmptyCategories((prev) => {
      const existing = new Set([
        ...groupByCategory(
          table === "dcr" ? (draft?.dcr ?? []) : table === "nonDcr" ? (draft?.nonDcr ?? []) : (draft?.both ?? []),
          prev[table],
        ),
      ])
      if (existing.has(category)) return prev
      return { ...prev, [table]: [...prev[table], category] }
    })
  }

  const applyAddProduct = (table: TableKey, category: string) => {
    const panelType = category.trim()
    if (!panelType) return
    setDraft((prev) => {
      if (!prev) return prev
      const next = clonePricing(prev)
      if (table === "dcr") next.dcr = [...(next.dcr ?? []), emptySystemProduct(panelType)]
      else if (table === "nonDcr") next.nonDcr = [...(next.nonDcr ?? []), emptySystemProduct(panelType)]
      else next.both = [...(next.both ?? []), emptyBothProduct(panelType)]
      return next
    })
    setEmptyCategories((prev) => ({
      ...prev,
      [table]: prev[table].filter((c) => c.trim() !== panelType),
    }))
  }

  const applyDeleteProduct = (table: TableKey, index: number) => {
    setDraft((prev) => {
      if (!prev) return prev
      const next = clonePricing(prev)
      if (table === "dcr") next.dcr = (next.dcr ?? []).filter((_, i) => i !== index)
      else if (table === "nonDcr") next.nonDcr = (next.nonDcr ?? []).filter((_, i) => i !== index)
      else next.both = (next.both ?? []).filter((_, i) => i !== index)
      return next
    })
  }

  const applyDeleteCategory = (table: TableKey, category: string) => {
    const name = category.trim()
    setDraft((prev) => {
      if (!prev) return prev
      const next = clonePricing(prev)
      if (table === "dcr") next.dcr = (next.dcr ?? []).filter((r) => r.panelType !== name)
      else if (table === "nonDcr") next.nonDcr = (next.nonDcr ?? []).filter((r) => r.panelType !== name)
      else next.both = (next.both ?? []).filter((r) => r.panelType !== name)
      return next
    })
    setEmptyCategories((prev) => ({
      ...prev,
      [table]: prev[table].filter((c) => c.trim() !== name),
    }))
  }

  const requestAddCategory = (table: TableKey) => {
    setCategoryNameInput("")
    setPending({ kind: "add-category", table })
  }

  const requestAddProduct = (table: TableKey, category: string) => {
    setPending({ kind: "add-product", table, category })
  }

  const requestDeleteProduct = (table: TableKey, index: number) => {
    const rows =
      table === "dcr" ? draft?.dcr : table === "nonDcr" ? draft?.nonDcr : draft?.both
    setPending({
      kind: "delete-product",
      table,
      index,
      label: rowSummary(table, rows?.[index]),
    })
  }

  const requestDeleteCategory = (table: TableKey, category: string) => {
    const rows =
      table === "dcr" ? draft?.dcr : table === "nonDcr" ? draft?.nonDcr : draft?.both
    const productCount = (rows ?? []).filter((r) => r.panelType === category).length
    setPending({ kind: "delete-category", table, category, productCount })
  }

  const requestSave = () => setPending({ kind: "save" })

  const handleConfirmedSave = async () => {
    if (!draft) return
    if (!useApi) {
      setMessage({ type: "error", text: "API is not enabled (NEXT_PUBLIC_USE_API=false)." })
      return
    }

    const payload: PricingTablesData = {
      ...getPricingData(),
      ...draft,
      dcr: draft.dcr ?? [],
      nonDcr: draft.nonDcr ?? [],
      both: draft.both ?? [],
    }

    setIsSaving(true)
    setMessage(null)
    try {
      const saved = await api.quotations.updatePricingTables(payload as unknown as Record<string, unknown>)
      const merged: PricingTablesData = {
        ...payload,
        ...(saved && typeof saved === "object" ? (saved as PricingTablesData) : {}),
        dcr: Array.isArray((saved as PricingTablesData)?.dcr)
          ? (saved as PricingTablesData).dcr
          : payload.dcr,
        nonDcr: Array.isArray((saved as PricingTablesData)?.nonDcr)
          ? (saved as PricingTablesData).nonDcr
          : payload.nonDcr,
        both: Array.isArray((saved as PricingTablesData)?.both)
          ? (saved as PricingTablesData).both
          : payload.both,
      }
      setPricingTablesCache(merged)
      setDraft(clonePricing(merged))
      setEmptyCategories({ dcr: [], nonDcr: [], both: [] })
      setMessage({
        type: "success",
        text: `Saved DCR (${merged.dcr?.length ?? 0}), Non-DCR (${merged.nonDcr?.length ?? 0}), and BOTH (${merged.both?.length ?? 0}) to backend.`,
      })
    } catch (error) {
      const apiError = error as ApiError
      if (apiError?.code === "HTTP_404") {
        setMessage({
          type: "error",
          text: "Backend PUT /api/quotations/pricing-tables is not implemented yet. See BACKEND_PRICING_TABLES.md.",
        })
      } else {
        setMessage({
          type: "error",
          text: apiError?.message || (error instanceof Error ? error.message : "Failed to save pricing"),
        })
      }
    } finally {
      setIsSaving(false)
      setTimeout(() => setMessage(null), 8000)
    }
  }

  const onConfirmPending = async () => {
    if (!pending) return
    const action = pending
    if (action.kind === "add-category") {
      const name = categoryNameInput.trim()
      if (!name) {
        setMessage({ type: "error", text: "Enter a category name before confirming." })
        setTimeout(() => setMessage(null), 4000)
        return
      }
      const existing = new Set(
        action.table === "dcr"
          ? dcrCategories
          : action.table === "nonDcr"
            ? nonDcrCategories
            : bothCategories,
      )
      if (existing.has(name)) {
        setMessage({ type: "error", text: `Category “${name}” already exists.` })
        setTimeout(() => setMessage(null), 4000)
        return
      }
      setPending(null)
      applyAddCategory(action.table, name)
      setCategoryNameInput("")
      return
    }

    setPending(null)
    if (action.kind === "add-product") applyAddProduct(action.table, action.category)
    else if (action.kind === "delete-product") applyDeleteProduct(action.table, action.index)
    else if (action.kind === "delete-category") applyDeleteCategory(action.table, action.category)
    else await handleConfirmedSave()
  }

  const handleReload = () => {
    clearPricingTablesCache()
    window.location.reload()
  }

  const confirmTitle = (() => {
    if (!pending) return ""
    if (pending.kind === "add-category") return `Add ${tableLabel(pending.table)} category?`
    if (pending.kind === "add-product") return `Add product under “${pending.category}”?`
    if (pending.kind === "delete-product") return `Delete ${tableLabel(pending.table)} product?`
    if (pending.kind === "delete-category") return `Delete category “${pending.category}”?`
    return "Save pricing to backend?"
  })()

  const confirmDescription = (() => {
    if (!pending) return ""
    if (pending.kind === "add-category") {
      return "Enter the category name (e.g. Waaree Topcon). It appears as a section header; then add products inside it."
    }
    if (pending.kind === "add-product") {
      return `A blank product row will be added under “${pending.category}”. Edit the fields, then click Save to backend.`
    }
    if (pending.kind === "delete-product") {
      return `This removes “${pending.label}” from the draft. Save to backend to persist.`
    }
    if (pending.kind === "delete-category") {
      return pending.productCount > 0
        ? `This removes the category and all ${pending.productCount} product(s) under it from the draft.`
        : "This removes the empty category from the draft."
    }
    return "This writes all three tables (DCR, Non-DCR, BOTH) to PUT /api/quotations/pricing-tables."
  })()

  const confirmActionLabel =
    pending?.kind === "add-category"
      ? "Add category"
      : pending?.kind === "add-product"
        ? "Add product"
        : pending?.kind === "delete-product" || pending?.kind === "delete-category"
          ? "Delete"
          : "Save"

  if (isLoading && !draft) {
    return <div className="text-center py-8 text-sm text-muted-foreground">Loading pricing tables…</div>
  }

  if (!draft) {
    return <div className="text-center py-8 text-sm text-muted-foreground">No pricing data available.</div>
  }

  const renderSystemCategorySection = (
    table: "dcr" | "nonDcr",
    categories: string[],
    rows: SystemPricing[],
  ) => (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => requestAddCategory(table)}>
          <FolderPlus className="w-4 h-4 mr-1" />
          Add category
        </Button>
      </div>
      {categories.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">
          No categories yet. Add a category, then add products inside it.
        </p>
      ) : null}
      {categories.map((category) => (
        <div key={`${table}-${category}`} className="space-y-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Label className="text-sm font-semibold">{category}</Label>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8"
                onClick={() => requestAddProduct(table, category)}
              >
                <PackagePlus className="w-3.5 h-3.5 mr-1" />
                Add product
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 text-destructive"
                onClick={() => requestDeleteCategory(table, category)}
              >
                <Trash2 className="w-3.5 h-3.5 mr-1" />
                Delete category
              </Button>
            </div>
          </div>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>System</TableHead>
                  <TableHead>Phase</TableHead>
                  <TableHead>Inverter</TableHead>
                  <TableHead>Panel type</TableHead>
                  <TableHead className="w-36">Price</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, index) => {
                  if (row.panelType !== category) return null
                  return (
                    <TableRow key={`${table}-${category}-${index}`}>
                      <TableCell>
                        <Input
                          className="h-8 w-24"
                          value={row.systemSize}
                          onChange={(e) => updateSystemRow(table, index, { systemSize: e.target.value })}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          className="h-8 w-28"
                          value={row.phase}
                          onChange={(e) =>
                            updateSystemRow(table, index, {
                              phase: e.target.value as SystemPricing["phase"],
                            })
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          className="h-8 w-28"
                          value={row.inverterSize}
                          onChange={(e) => updateSystemRow(table, index, { inverterSize: e.target.value })}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          className="h-8 w-40"
                          value={row.panelType}
                          onChange={(e) => updateSystemRow(table, index, { panelType: e.target.value })}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          className="h-8"
                          value={String(row.price ?? "")}
                          onChange={(e) =>
                            updateSystemRow(table, index, { price: parsePriceInput(e.target.value) })
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => requestDeleteProduct(table, index)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
                {rows.every((r) => r.panelType !== category) ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-xs text-muted-foreground py-4">
                      No products in this category. Click Add product.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        </div>
      ))}
    </div>
  )

  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1 min-w-0">
            <CardTitle>Pricing tables</CardTitle>
            <CardDescription>
              Add categories (e.g. Adani, Waaree Topcon) and products under each. Add/delete ask for confirmation;
              Save to backend persists DCR, Non-DCR, and BOTH together.
            </CardDescription>
            <p className="text-xs text-muted-foreground">
              Sheet validity (display): {DCR_PRICING_EFFECTIVE_FROM} → {DCR_PRICING_VALID_TILL}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline" size="sm">
                  <Eye className="w-4 h-4 mr-1" />
                  View pricing
                  <ChevronDown className="w-3.5 h-3.5 ml-1 opacity-70" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {PRICING_PDF_SCOPE_OPTIONS.map((opt) => (
                  <DropdownMenuItem
                    key={`view-${opt.value}`}
                    onSelect={() => setPricingViewScope(opt.value as PricingPdfScope)}
                  >
                    {opt.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline" size="sm" disabled={isDownloading}>
                  {isDownloading ? (
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4 mr-1" />
                  )}
                  Preview PDF
                  <ChevronDown className="w-3.5 h-3.5 ml-1 opacity-70" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {PRICING_PDF_SCOPE_OPTIONS.map((opt) => (
                  <DropdownMenuItem
                    key={opt.value}
                    onSelect={() => {
                      void (async () => {
                        setIsDownloading(true)
                        try {
                          await downloadPricingPdf({
                            scope: opt.value as PricingPdfScope,
                            dcrRows: draft.dcr,
                            nonDcrRows: draft.nonDcr,
                            bothRows: draft.both,
                          })
                        } catch (error) {
                          setMessage({
                            type: "error",
                            text:
                              error instanceof Error
                                ? error.message
                                : `Failed to export ${opt.shortLabel} PDF`,
                          })
                          setTimeout(() => setMessage(null), 6000)
                        } finally {
                          setIsDownloading(false)
                        }
                      })()
                    }}
                  >
                    {opt.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button type="button" variant="outline" size="sm" onClick={handleReload}>
              Reload
            </Button>
            <Button type="button" size="sm" onClick={requestSave} disabled={isSaving}>
              {isSaving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
              Save to backend
            </Button>
          </div>
        </div>
        {message ? (
          <p
            className={
              message.type === "success"
                ? "text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-md px-3 py-2"
                : "text-sm text-destructive bg-destructive/5 border border-destructive/20 rounded-md px-3 py-2"
            }
          >
            {message.text}
          </p>
        ) : null}
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="dcr" className="space-y-4">
          <TabsList>
            <TabsTrigger value="dcr">DCR ({draft.dcr?.length ?? 0})</TabsTrigger>
            <TabsTrigger value="non-dcr">Non-DCR ({draft.nonDcr?.length ?? 0})</TabsTrigger>
            <TabsTrigger value="both">BOTH ({draft.both?.length ?? 0})</TabsTrigger>
          </TabsList>

          <TabsContent value="dcr" className="space-y-4">
            {renderSystemCategorySection("dcr", dcrCategories, draft.dcr ?? [])}
          </TabsContent>

          <TabsContent value="non-dcr" className="space-y-4">
            {renderSystemCategorySection("nonDcr", nonDcrCategories, draft.nonDcr ?? [])}
          </TabsContent>

          <TabsContent value="both" className="space-y-4">
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => requestAddCategory("both")}>
                <FolderPlus className="w-4 h-4 mr-1" />
                Add category
              </Button>
            </div>
            {bothCategories.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                No categories yet. Add a category, then add products inside it.
              </p>
            ) : null}
            {bothCategories.map((category) => (
              <div key={`both-${category}`} className="space-y-2">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <Label className="text-sm font-semibold">{category}</Label>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8"
                      onClick={() => requestAddProduct("both", category)}
                    >
                      <PackagePlus className="w-3.5 h-3.5 mr-1" />
                      Add product
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 text-destructive"
                      onClick={() => requestDeleteCategory("both", category)}
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1" />
                      Delete category
                    </Button>
                  </div>
                </div>
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>System</TableHead>
                        <TableHead>Phase</TableHead>
                        <TableHead>Inverter</TableHead>
                        <TableHead>DCR kW</TableHead>
                        <TableHead>Non-DCR kW</TableHead>
                        <TableHead>Panel type</TableHead>
                        <TableHead className="w-36">Price</TableHead>
                        <TableHead className="w-12" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(draft.both ?? []).map((row, index) => {
                        if (row.panelType !== category) return null
                        return (
                          <TableRow key={`both-${category}-${index}`}>
                            <TableCell>
                              <Input
                                className="h-8 w-24"
                                value={row.systemSize}
                                onChange={(e) => updateBothRow(index, { systemSize: e.target.value })}
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                className="h-8 w-28"
                                value={row.phase}
                                onChange={(e) =>
                                  updateBothRow(index, {
                                    phase: e.target.value as BothSystemPricing["phase"],
                                  })
                                }
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                className="h-8 w-28"
                                value={row.inverterSize}
                                onChange={(e) => updateBothRow(index, { inverterSize: e.target.value })}
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                className="h-8 w-24"
                                value={row.dcrCapacity}
                                onChange={(e) => updateBothRow(index, { dcrCapacity: e.target.value })}
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                className="h-8 w-24"
                                value={row.nonDcrCapacity}
                                onChange={(e) => updateBothRow(index, { nonDcrCapacity: e.target.value })}
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                className="h-8 w-36"
                                value={row.panelType}
                                onChange={(e) => updateBothRow(index, { panelType: e.target.value })}
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                className="h-8"
                                value={String(row.price ?? "")}
                                onChange={(e) =>
                                  updateBothRow(index, { price: parsePriceInput(e.target.value) })
                                }
                              />
                            </TableCell>
                            <TableCell>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive"
                                onClick={() => requestDeleteProduct("both", index)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                      {(draft.both ?? []).every((r) => r.panelType !== category) ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center text-xs text-muted-foreground py-4">
                            No products in this category. Click Add product.
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ))}
          </TabsContent>
        </Tabs>
      </CardContent>

      <AlertDialog
        open={Boolean(pending)}
        onOpenChange={(open) => {
          if (!open) {
            setPending(null)
            setCategoryNameInput("")
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>{confirmDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          {pending?.kind === "add-category" ? (
            <div className="space-y-2 py-1">
              <Label htmlFor="new-pricing-category">Category name</Label>
              <Input
                id="new-pricing-category"
                autoFocus
                placeholder="e.g. Waaree Topcon"
                value={categoryNameInput}
                onChange={(e) => setCategoryNameInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    void onConfirmPending()
                  }
                }}
              />
            </div>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={
                pending?.kind === "delete-product" || pending?.kind === "delete-category"
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : undefined
              }
              onClick={(e) => {
                e.preventDefault()
                void onConfirmPending()
              }}
            >
              {confirmActionLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {pricingViewScope && draft ? (
        <PricingSheetViewDialog
          open={Boolean(pricingViewScope)}
          onOpenChange={(open) => {
            if (!open) setPricingViewScope(null)
          }}
          scope={pricingViewScope}
          dcrRows={draft.dcr}
          nonDcrRows={draft.nonDcr}
          bothRows={draft.both}
        />
      ) : null}
    </Card>
  )
}
