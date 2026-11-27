"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
import { FolderPlus, Loader2, PackagePlus, Save, Trash2 } from "lucide-react"
import { api } from "@/lib/api"
import { useProductCatalog } from "@/lib/use-product-catalog"
import {
  CATALOG_COMPONENT_KEYS,
  CATALOG_COMPONENT_LABELS,
  INVERTER_PHASE_OPTIONS,
  INVERTER_STRING_OPTIONS,
  PANEL_CONTENT_TYPES,
  PANEL_CONTENT_TYPE_LABELS,
  PANEL_SPEC_OPTIONS,
  STRUCTURE_MEASUREMENT_OPTIONS,
  STRUCTURE_MEASUREMENT_LABELS,
  clearCatalogComponentPricingCache,
  loadCatalogComponentPricing,
  type StructureMeasurement,
  newBrandRowId,
  loadCustomPanelBrands,
  normalizeCatalogComponentPricing,
  normalizePanelRowsToBrandBuckets,
  panelBrandSelectOptions,
  rememberCustomPanelBrand,
  saveCatalogComponentPricing,
  seedPanelBrandsFromNames,
  emptyCatalogComponentPricing,
  type CatalogBrandRow,
  type CatalogComponentKey,
  type CatalogComponentPricingData,
  type PanelContentType,
} from "@/lib/catalog-component-pricing"
import { cn } from "@/lib/utils"

type PendingConfirm =
  | { kind: "add-brand"; category: CatalogComponentKey }
  | { kind: "delete-brand"; category: CatalogComponentKey; brandIndex: number; name: string }
  | { kind: "delete-row"; category: CatalogComponentKey; brandIndex: number; rowIndex: number }

type FlatPanelRow = CatalogBrandRow & { brandIndex: number; rowIndex: number }
type FlatInverterRow = CatalogBrandRow & { brandIndex: number; rowIndex: number }
type FlatStructureRow = CatalogBrandRow & { brandIndex: number; rowIndex: number }
type FlatCableRow = CatalogBrandRow & { brandIndex: number; rowIndex: number }
type FlatMeterRow = CatalogBrandRow & { brandIndex: number; rowIndex: number }
type FlatAccessoriesRow = CatalogBrandRow & { brandIndex: number; rowIndex: number }

function cloneData(data: CatalogComponentPricingData): CatalogComponentPricingData {
  return JSON.parse(JSON.stringify(data)) as CatalogComponentPricingData
}

function parseNum(value: string): number {
  const n = Number(String(value).replace(/,/g, "").trim())
  return Number.isFinite(n) ? n : 0
}

export function AdminCatalogComponentPricing() {
  const { catalog, isLoading: catalogLoading } = useProductCatalog()
  const [draft, setDraft] = useState<CatalogComponentPricingData | null>(null)
  const [activeCategory, setActiveCategory] = useState<CatalogComponentKey>("panel")
  const [activeBrandByCategory, setActiveBrandByCategory] = useState<
    Partial<Record<CatalogComponentKey, string>>
  >({})
  const [brandNameInput, setBrandNameInput] = useState("")
  const [showNewBrandField, setShowNewBrandField] = useState(false)
  const [customPanelBrands, setCustomPanelBrands] = useState<string[]>([])
  const [pending, setPending] = useState<PendingConfirm | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const useApi = process.env.NEXT_PUBLIC_USE_API !== "false"

  useEffect(() => {
    setCustomPanelBrands(loadCustomPanelBrands())
  }, [])

  useEffect(() => {
    let cancelled = false

    const seedBrandShells = (data: CatalogComponentPricingData): CatalogComponentPricingData => {
      let next = seedPanelBrandsFromNames(data, catalog?.panels?.brands || [])
      next = normalizePanelRowsToBrandBuckets(next)

      const inverterBrands = catalog?.inverters?.brands || []
      if (next.categories.inverter.brands.length === 0 && inverterBrands.length > 0) {
        next = {
          ...next,
          categories: {
            ...next.categories,
            inverter: {
              brands: inverterBrands
                .map((name) => ({ name: String(name).trim(), rows: [] }))
                .filter((b) => b.name),
            },
          },
        }
      }

      const meterBrands = catalog?.meters?.brands || []
      if (next.categories.meter.brands.length === 0 && meterBrands.length > 0) {
        next = {
          ...next,
          categories: {
            ...next.categories,
            meter: {
              brands: meterBrands
                .map((name) => ({ name: String(name).trim(), rows: [] }))
                .filter((b) => b.name),
            },
          },
        }
      }
      return next
    }

    const apply = (raw: CatalogComponentPricingData) => {
      if (cancelled) return
      setDraft(seedBrandShells(raw))
    }

    if (!useApi) {
      apply(loadCatalogComponentPricing())
      return () => {
        cancelled = true
      }
    }

    clearCatalogComponentPricingCache()
    apply(emptyCatalogComponentPricing())
    void api.quotations
      .getCatalogComponentPricing()
      .then((res) => {
        const normalized = normalizeCatalogComponentPricing(res)
        saveCatalogComponentPricing(normalized)
        apply(normalized)
      })
      .catch(() => {
        // API missing / empty — start blank (no dummy seed).
        clearCatalogComponentPricingCache()
        apply(emptyCatalogComponentPricing())
      })

    return () => {
      cancelled = true
    }
  }, [catalog, useApi])

  const panelBrandOptions = useMemo(() => {
    const catalogBrands = catalog?.panels?.brands || []
    const fromDraft = (draft?.categories.panel.brands || [])
      .map((b) => b.name)
      .filter((n) => n && n !== "Unbranded")
    return panelBrandSelectOptions(catalogBrands, [...fromDraft, ...customPanelBrands])
  }, [catalog, draft, customPanelBrands])

  const flatPanelRows: FlatPanelRow[] = useMemo(() => {
    if (!draft) return []
    const out: FlatPanelRow[] = []
    draft.categories.panel.brands.forEach((bucket, brandIndex) => {
      bucket.rows.forEach((row, rowIndex) => {
        out.push({
          ...row,
          brand: row.brand || bucket.name,
          brandIndex,
          rowIndex,
        })
      })
    })
    return out
  }, [draft])

  const inverterBrandOptions = useMemo(() => {
    const catalogBrands = catalog?.inverters?.brands || []
    const fromDraft = (draft?.categories.inverter.brands || [])
      .map((b) => b.name.trim())
      .filter((n) => n && n !== "Unbranded")
    return panelBrandSelectOptions(catalogBrands, fromDraft)
  }, [catalog, draft])

  const flatInverterRows: FlatInverterRow[] = useMemo(() => {
    if (!draft) return []
    const out: FlatInverterRow[] = []
    draft.categories.inverter.brands.forEach((bucket, brandIndex) => {
      bucket.rows.forEach((row, rowIndex) => {
        out.push({
          ...row,
          brand: row.brand || bucket.name,
          brandIndex,
          rowIndex,
        })
      })
    })
    return out
  }, [draft])

  const structureBrandOptions = useMemo(() => {
    const fromDraft = (draft?.categories.structure.brands || [])
      .map((b) => b.name.trim())
      .filter((n) => n && n !== "Unbranded")
    return panelBrandSelectOptions(fromDraft, [])
  }, [draft])

  const flatStructureRows: FlatStructureRow[] = useMemo(() => {
    if (!draft) return []
    const out: FlatStructureRow[] = []
    draft.categories.structure.brands.forEach((bucket, brandIndex) => {
      bucket.rows.forEach((row, rowIndex) => {
        out.push({
          ...row,
          brand: row.brand || bucket.name,
          product: row.product || row.spec,
          brandIndex,
          rowIndex,
        })
      })
    })
    return out
  }, [draft])

  const cableBrandOptions = useMemo(() => {
    const fromDraft = (draft?.categories.cable.brands || [])
      .map((b) => b.name.trim())
      .filter((n) => n && n !== "Unbranded")
    return panelBrandSelectOptions(fromDraft, [])
  }, [draft])

  const flatCableRows: FlatCableRow[] = useMemo(() => {
    if (!draft) return []
    const out: FlatCableRow[] = []
    draft.categories.cable.brands.forEach((bucket, brandIndex) => {
      bucket.rows.forEach((row, rowIndex) => {
        out.push({
          ...row,
          brand: row.brand || bucket.name,
          brandIndex,
          rowIndex,
        })
      })
    })
    return out
  }, [draft])

  const meterBrandOptions = useMemo(() => {
    const catalogBrands = catalog?.meters?.brands || []
    const fromDraft = (draft?.categories.meter.brands || [])
      .map((b) => b.name.trim())
      .filter((n) => n && n !== "Unbranded")
    return panelBrandSelectOptions(catalogBrands, fromDraft)
  }, [catalog, draft])

  const flatMeterRows: FlatMeterRow[] = useMemo(() => {
    if (!draft) return []
    const out: FlatMeterRow[] = []
    draft.categories.meter.brands.forEach((bucket, brandIndex) => {
      bucket.rows.forEach((row, rowIndex) => {
        out.push({
          ...row,
          brand: row.brand || bucket.name,
          brandIndex,
          rowIndex,
        })
      })
    })
    return out
  }, [draft])

  const accessoriesBrandOptions = useMemo(() => {
    const fromDraft = (draft?.categories.accessories.brands || [])
      .map((b) => b.name.trim())
      .filter((n) => n && n !== "Unbranded")
    return panelBrandSelectOptions(fromDraft, [])
  }, [draft])

  const flatAccessoriesRows: FlatAccessoriesRow[] = useMemo(() => {
    if (!draft) return []
    const out: FlatAccessoriesRow[] = []
    draft.categories.accessories.brands.forEach((bucket, brandIndex) => {
      bucket.rows.forEach((row, rowIndex) => {
        out.push({
          ...row,
          brand: row.brand || bucket.name,
          product: row.product || row.spec,
          brandIndex,
          rowIndex,
        })
      })
    })
    return out
  }, [draft])

  const updateBrandRows = (
    category: CatalogComponentKey,
    brandIndex: number,
    updater: (rows: CatalogBrandRow[]) => CatalogBrandRow[],
  ) => {
    setDraft((prev) => {
      if (!prev) return prev
      const next = cloneData(prev)
      const bucket = next.categories[category].brands[brandIndex]
      if (!bucket) return prev
      bucket.rows = updater(bucket.rows)
      return next
    })
  }

  const ensureBrandBucket = (name: string): number => {
    if (!draft) return -1
    const trimmed = name.trim()
    if (!trimmed) return -1
    const idx = draft.categories.panel.brands.findIndex(
      (b) => b.name.toLowerCase() === trimmed.toLowerCase(),
    )
    if (idx >= 0) return idx
    setDraft((prev) => {
      if (!prev) return prev
      const next = cloneData(prev)
      next.categories.panel.brands.push({ name: trimmed, rows: [] })
      return next
    })
    return draft.categories.panel.brands.length
  }

  const movePanelRowToBrand = (
    fromBrandIndex: number,
    fromRowIndex: number,
    toBrandName: string,
  ) => {
    setDraft((prev) => {
      if (!prev) return prev
      const next = cloneData(prev)
      const from = next.categories.panel.brands[fromBrandIndex]
      if (!from) return prev
      const [row] = from.rows.splice(fromRowIndex, 1)
      if (!row) return prev
      const brand = toBrandName.trim()
      const bucketName = brand || "Unbranded"
      let toIdx = next.categories.panel.brands.findIndex(
        (b) => b.name.toLowerCase() === bucketName.toLowerCase(),
      )
      if (toIdx < 0) {
        next.categories.panel.brands.push({ name: bucketName, rows: [] })
        toIdx = next.categories.panel.brands.length - 1
      }
      next.categories.panel.brands[toIdx]!.rows.push({
        ...row,
        brand: brand || undefined,
      })
      return next
    })
  }

  const ensureInverterBrandBucket = (name: string): number => {
    if (!draft) return -1
    const trimmed = name.trim()
    if (!trimmed) return -1
    const idx = draft.categories.inverter.brands.findIndex(
      (b) => b.name.toLowerCase() === trimmed.toLowerCase(),
    )
    if (idx >= 0) return idx
    setDraft((prev) => {
      if (!prev) return prev
      const next = cloneData(prev)
      next.categories.inverter.brands.push({ name: trimmed, rows: [] })
      return next
    })
    return draft.categories.inverter.brands.length
  }

  const moveInverterRowToBrand = (
    fromBrandIndex: number,
    fromRowIndex: number,
    toBrandName: string,
  ) => {
    setDraft((prev) => {
      if (!prev) return prev
      const next = cloneData(prev)
      const from = next.categories.inverter.brands[fromBrandIndex]
      if (!from) return prev
      const [row] = from.rows.splice(fromRowIndex, 1)
      if (!row) return prev
      const brand = toBrandName.trim()
      const bucketName = brand || "Unbranded"
      let toIdx = next.categories.inverter.brands.findIndex(
        (b) => b.name.toLowerCase() === bucketName.toLowerCase(),
      )
      if (toIdx < 0) {
        next.categories.inverter.brands.push({ name: bucketName, rows: [] })
        toIdx = next.categories.inverter.brands.length - 1
      }
      next.categories.inverter.brands[toIdx]!.rows.push({
        ...row,
        brand: brand || undefined,
      })
      return next
    })
  }

  const ensureStructureBrandBucket = (name: string): number => {
    if (!draft) return -1
    const trimmed = name.trim()
    if (!trimmed) return -1
    const idx = draft.categories.structure.brands.findIndex(
      (b) => b.name.toLowerCase() === trimmed.toLowerCase(),
    )
    if (idx >= 0) return idx
    setDraft((prev) => {
      if (!prev) return prev
      const next = cloneData(prev)
      next.categories.structure.brands.push({ name: trimmed, rows: [] })
      return next
    })
    return draft.categories.structure.brands.length
  }

  const moveStructureRowToBrand = (
    fromBrandIndex: number,
    fromRowIndex: number,
    toBrandName: string,
  ) => {
    setDraft((prev) => {
      if (!prev) return prev
      const next = cloneData(prev)
      const from = next.categories.structure.brands[fromBrandIndex]
      if (!from) return prev
      const [row] = from.rows.splice(fromRowIndex, 1)
      if (!row) return prev
      const brand = toBrandName.trim()
      const bucketName = brand || "Unbranded"
      let toIdx = next.categories.structure.brands.findIndex(
        (b) => b.name.toLowerCase() === bucketName.toLowerCase(),
      )
      if (toIdx < 0) {
        next.categories.structure.brands.push({ name: bucketName, rows: [] })
        toIdx = next.categories.structure.brands.length - 1
      }
      next.categories.structure.brands[toIdx]!.rows.push({
        ...row,
        brand: brand || undefined,
      })
      return next
    })
  }

  const ensureCableBrandBucket = (name: string): number => {
    if (!draft) return -1
    const trimmed = name.trim()
    if (!trimmed) return -1
    const idx = draft.categories.cable.brands.findIndex(
      (b) => b.name.toLowerCase() === trimmed.toLowerCase(),
    )
    if (idx >= 0) return idx
    setDraft((prev) => {
      if (!prev) return prev
      const next = cloneData(prev)
      next.categories.cable.brands.push({ name: trimmed, rows: [] })
      return next
    })
    return draft.categories.cable.brands.length
  }

  const moveCableRowToBrand = (
    fromBrandIndex: number,
    fromRowIndex: number,
    toBrandName: string,
  ) => {
    setDraft((prev) => {
      if (!prev) return prev
      const next = cloneData(prev)
      const from = next.categories.cable.brands[fromBrandIndex]
      if (!from) return prev
      const [row] = from.rows.splice(fromRowIndex, 1)
      if (!row) return prev
      const brand = toBrandName.trim()
      const bucketName = brand || "Unbranded"
      let toIdx = next.categories.cable.brands.findIndex(
        (b) => b.name.toLowerCase() === bucketName.toLowerCase(),
      )
      if (toIdx < 0) {
        next.categories.cable.brands.push({ name: bucketName, rows: [] })
        toIdx = next.categories.cable.brands.length - 1
      }
      next.categories.cable.brands[toIdx]!.rows.push({
        ...row,
        brand: brand || undefined,
      })
      return next
    })
  }

  const ensureMeterBrandBucket = (name: string): number => {
    if (!draft) return -1
    const trimmed = name.trim()
    if (!trimmed) return -1
    const idx = draft.categories.meter.brands.findIndex(
      (b) => b.name.toLowerCase() === trimmed.toLowerCase(),
    )
    if (idx >= 0) return idx
    setDraft((prev) => {
      if (!prev) return prev
      const next = cloneData(prev)
      next.categories.meter.brands.push({ name: trimmed, rows: [] })
      return next
    })
    return draft.categories.meter.brands.length
  }

  const moveMeterRowToBrand = (
    fromBrandIndex: number,
    fromRowIndex: number,
    toBrandName: string,
  ) => {
    setDraft((prev) => {
      if (!prev) return prev
      const next = cloneData(prev)
      const from = next.categories.meter.brands[fromBrandIndex]
      if (!from) return prev
      const [row] = from.rows.splice(fromRowIndex, 1)
      if (!row) return prev
      const brand = toBrandName.trim()
      const bucketName = brand || "Unbranded"
      let toIdx = next.categories.meter.brands.findIndex(
        (b) => b.name.toLowerCase() === bucketName.toLowerCase(),
      )
      if (toIdx < 0) {
        next.categories.meter.brands.push({ name: bucketName, rows: [] })
        toIdx = next.categories.meter.brands.length - 1
      }
      next.categories.meter.brands[toIdx]!.rows.push({
        ...row,
        brand: brand || undefined,
      })
      return next
    })
  }

  const ensureAccessoriesBrandBucket = (name: string): number => {
    if (!draft) return -1
    const trimmed = name.trim()
    if (!trimmed) return -1
    const idx = draft.categories.accessories.brands.findIndex(
      (b) => b.name.toLowerCase() === trimmed.toLowerCase(),
    )
    if (idx >= 0) return idx
    setDraft((prev) => {
      if (!prev) return prev
      const next = cloneData(prev)
      next.categories.accessories.brands.push({ name: trimmed, rows: [] })
      return next
    })
    return draft.categories.accessories.brands.length
  }

  const moveAccessoriesRowToBrand = (
    fromBrandIndex: number,
    fromRowIndex: number,
    toBrandName: string,
  ) => {
    setDraft((prev) => {
      if (!prev) return prev
      const next = cloneData(prev)
      const from = next.categories.accessories.brands[fromBrandIndex]
      if (!from) return prev
      const [row] = from.rows.splice(fromRowIndex, 1)
      if (!row) return prev
      const brand = toBrandName.trim()
      const bucketName = brand || "Unbranded"
      let toIdx = next.categories.accessories.brands.findIndex(
        (b) => b.name.toLowerCase() === bucketName.toLowerCase(),
      )
      if (toIdx < 0) {
        next.categories.accessories.brands.push({ name: bucketName, rows: [] })
        toIdx = next.categories.accessories.brands.length - 1
      }
      next.categories.accessories.brands[toIdx]!.rows.push({
        ...row,
        brand: brand || undefined,
      })
      return next
    })
  }

  const requestAddBrand = () => {
    setBrandNameInput("")
    setShowNewBrandField(false)
    setPending({ kind: "add-brand", category: activeCategory })
  }

  const confirmPending = () => {
    if (!pending || !draft) return
    if (pending.kind === "add-brand") {
      const name = brandNameInput.trim()
      if (!name) return
      const exists = draft.categories[pending.category].brands.some(
        (b) => b.name.toLowerCase() === name.toLowerCase(),
      )
      if (exists && !showNewBrandField) {
        // Picked an existing brand from dropdown — just select it for rows
        setActiveBrandByCategory((prev) => ({ ...prev, [pending.category]: name }))
        setPending(null)
        setBrandNameInput("")
        setShowNewBrandField(false)
        setMessage({ type: "success", text: `Brand “${name}” selected.` })
        setTimeout(() => setMessage(null), 3000)
        return
      }
      if (exists) {
        setMessage({
          type: "error",
          text: `Brand “${name}” already exists in ${CATALOG_COMPONENT_LABELS[pending.category]}.`,
        })
        setPending(null)
        setShowNewBrandField(false)
        return
      }
      setDraft((prev) => {
        if (!prev) return prev
        const next = cloneData(prev)
        next.categories[pending.category].brands.push({ name, rows: [] })
        saveCatalogComponentPricing(next)
        return next
      })
      if (pending.category === "panel") {
        rememberCustomPanelBrand(name)
        setCustomPanelBrands(loadCustomPanelBrands())
        // Persist into product catalog so it stays in dropdowns after reload
        if (useApi && catalog) {
          const brands = panelBrandSelectOptions(catalog.panels.brands || [], [name, ...customPanelBrands])
          void api.adminProducts
            .updateProducts({
              ...catalog,
              panels: { ...catalog.panels, brands },
            })
            .catch(() => {
              /* local dropdown still has the brand */
            })
        }
      }
      setActiveBrandByCategory((prev) => ({ ...prev, [pending.category]: name }))
      setPending(null)
      setBrandNameInput("")
      setShowNewBrandField(false)
      setMessage({ type: "success", text: `Brand “${name}” added — it will show in the dropdown next time.` })
      setTimeout(() => setMessage(null), 4000)
      return
    }
    if (pending.kind === "delete-brand") {
      setDraft((prev) => {
        if (!prev) return prev
        const next = cloneData(prev)
        next.categories[pending.category].brands.splice(pending.brandIndex, 1)
        return next
      })
      setPending(null)
      return
    }
    if (pending.kind === "delete-row") {
      updateBrandRows(pending.category, pending.brandIndex, (rows) =>
        rows.filter((_, i) => i !== pending.rowIndex),
      )
      setPending(null)
    }
  }

  const addPanelRow = () => {
    const defaultBrand =
      activeBrandByCategory.panel ||
      panelBrandOptions[0] ||
      ""
    setDraft((prev) => {
      if (!prev) return prev
      const next = cloneData(prev)
      const bucketName = defaultBrand || "Unbranded"
      let idx = next.categories.panel.brands.findIndex(
        (b) => b.name.toLowerCase() === bucketName.toLowerCase(),
      )
      if (idx < 0) {
        next.categories.panel.brands.push({ name: bucketName, rows: [] })
        idx = next.categories.panel.brands.length - 1
      }
      next.categories.panel.brands[idx]!.rows.push({
        id: newBrandRowId(),
        brand: defaultBrand || undefined,
        contentType: "dcr",
        spec: "Topcon",
        perWattPrice: 0,
      })
      return next
    })
    setActiveBrandByCategory((prev) => ({ ...prev, panel: defaultBrand }))
  }

  const addInverterRow = () => {
    const defaultBrand =
      activeBrandByCategory.inverter ||
      inverterBrandOptions[0] ||
      ""
    setDraft((prev) => {
      if (!prev) return prev
      const next = cloneData(prev)
      const bucketName = defaultBrand || "Unbranded"
      let idx = next.categories.inverter.brands.findIndex(
        (b) => b.name.toLowerCase() === bucketName.toLowerCase(),
      )
      if (idx < 0) {
        next.categories.inverter.brands.push({ name: bucketName, rows: [] })
        idx = next.categories.inverter.brands.length - 1
      }
      next.categories.inverter.brands[idx]!.rows.push({
        id: newBrandRowId(),
        brand: defaultBrand || undefined,
        kw: 5,
        phases: "1-Phase",
        singleString: "Single string",
        price: 0,
      })
      return next
    })
    setActiveBrandByCategory((prev) => ({ ...prev, inverter: defaultBrand }))
  }

  const addStructureRow = () => {
    const defaultBrand =
      activeBrandByCategory.structure ||
      structureBrandOptions[0] ||
      ""
    setDraft((prev) => {
      if (!prev) return prev
      const next = cloneData(prev)
      const bucketName = defaultBrand || "Unbranded"
      let idx = next.categories.structure.brands.findIndex(
        (b) => b.name.toLowerCase() === bucketName.toLowerCase(),
      )
      if (idx < 0) {
        next.categories.structure.brands.push({ name: bucketName, rows: [] })
        idx = next.categories.structure.brands.length - 1
      }
      next.categories.structure.brands[idx]!.rows.push({
        id: newBrandRowId(),
        brand: defaultBrand || undefined,
        product: "",
        measurement: "kg",
        quantity: 0,
        perKgPrice: 0,
        perPiecePrice: 0,
      })
      return next
    })
    setActiveBrandByCategory((prev) => ({ ...prev, structure: defaultBrand }))
  }

  const addCableRow = () => {
    const defaultBrand =
      activeBrandByCategory.cable ||
      cableBrandOptions[0] ||
      ""
    setDraft((prev) => {
      if (!prev) return prev
      const next = cloneData(prev)
      const bucketName = defaultBrand || "Unbranded"
      let idx = next.categories.cable.brands.findIndex(
        (b) => b.name.toLowerCase() === bucketName.toLowerCase(),
      )
      if (idx < 0) {
        next.categories.cable.brands.push({ name: bucketName, rows: [] })
        idx = next.categories.cable.brands.length - 1
      }
      next.categories.cable.brands[idx]!.rows.push({
        id: newBrandRowId(),
        brand: defaultBrand || undefined,
        mmThickness: 4,
        perMeterPrice: 0,
        spec: "4 mm",
        unitPrice: 0,
      })
      return next
    })
    setActiveBrandByCategory((prev) => ({ ...prev, cable: defaultBrand }))
  }

  const addMeterRow = () => {
    const defaultBrand =
      activeBrandByCategory.meter ||
      meterBrandOptions[0] ||
      ""
    setDraft((prev) => {
      if (!prev) return prev
      const next = cloneData(prev)
      const bucketName = defaultBrand || "Unbranded"
      let idx = next.categories.meter.brands.findIndex(
        (b) => b.name.toLowerCase() === bucketName.toLowerCase(),
      )
      if (idx < 0) {
        next.categories.meter.brands.push({ name: bucketName, rows: [] })
        idx = next.categories.meter.brands.length - 1
      }
      next.categories.meter.brands[idx]!.rows.push({
        id: newBrandRowId(),
        brand: defaultBrand || undefined,
        phases: "1-Phase",
        perPiecePrice: 0,
      })
      return next
    })
    setActiveBrandByCategory((prev) => ({ ...prev, meter: defaultBrand }))
  }

  const addAccessoriesRow = () => {
    const defaultBrand =
      activeBrandByCategory.accessories ||
      accessoriesBrandOptions[0] ||
      ""
    setDraft((prev) => {
      if (!prev) return prev
      const next = cloneData(prev)
      const bucketName = defaultBrand || "Unbranded"
      let idx = next.categories.accessories.brands.findIndex(
        (b) => b.name.toLowerCase() === bucketName.toLowerCase(),
      )
      if (idx < 0) {
        next.categories.accessories.brands.push({ name: bucketName, rows: [] })
        idx = next.categories.accessories.brands.length - 1
      }
      next.categories.accessories.brands[idx]!.rows.push({
        id: newBrandRowId(),
        brand: defaultBrand || undefined,
        product: "",
        perPiecePrice: 0,
      })
      return next
    })
    setActiveBrandByCategory((prev) => ({ ...prev, accessories: defaultBrand }))
  }

  const addRow = () => {
    if (activeCategory === "panel") {
      addPanelRow()
      return
    }
    if (activeCategory === "inverter") {
      addInverterRow()
      return
    }
    if (activeCategory === "structure") {
      addStructureRow()
      return
    }
    if (activeCategory === "cable") {
      addCableRow()
      return
    }
    if (activeCategory === "meter") {
      addMeterRow()
      return
    }
    if (activeCategory === "accessories") {
      addAccessoriesRow()
    }
  }

  const handleSave = async () => {
    if (!draft) return
    setIsSaving(true)
    setMessage(null)
    try {
      const normalized = normalizePanelRowsToBrandBuckets(draft)

      if (useApi) {
        const saved = await api.quotations.updateCatalogComponentPricing(
          normalized as unknown as Record<string, unknown>,
        )
        const fromApi = normalizeCatalogComponentPricing(saved ?? normalized)
        saveCatalogComponentPricing(fromApi)
        setDraft(fromApi)

        if (catalog) {
          const panelBrandNames = fromApi.categories.panel.brands
            .map((b) => b.name)
            .filter((n) => n && n !== "Unbranded")
          const panelSizes = Array.from(
            new Set(
              fromApi.categories.panel.brands.flatMap((b) =>
                b.rows.map((r) => String(r.spec || "").trim()).filter(Boolean),
              ),
            ),
          )
          const nextCatalog = {
            ...catalog,
            panels: {
              brands: panelBrandNames.length ? panelBrandNames : catalog.panels.brands,
              sizes: panelSizes.length ? panelSizes : catalog.panels.sizes,
            },
            inverters: {
              ...catalog.inverters,
              brands:
                fromApi.categories.inverter.brands.map((b) => b.name).length > 0
                  ? fromApi.categories.inverter.brands.map((b) => b.name)
                  : catalog.inverters.brands,
            },
            meters: {
              ...catalog.meters,
              brands:
                fromApi.categories.meter.brands
                  .map((b) => b.name)
                  .filter((n) => n && n !== "Unbranded").length > 0
                  ? fromApi.categories.meter.brands
                      .map((b) => b.name)
                      .filter((n) => n && n !== "Unbranded")
                  : catalog.meters.brands,
            },
          }
          try {
            await api.adminProducts.updateProducts(nextCatalog)
          } catch {
            /* Price set already persisted */
          }
        }

        setMessage({ type: "success", text: "Price set saved to server." })
      } else {
        saveCatalogComponentPricing(normalized)
        setDraft(normalized)
        setMessage({ type: "success", text: "Price set saved locally." })
      }
    } catch (err) {
      const apiError = err as { code?: string; message?: string }
      setMessage({
        type: "error",
        text:
          apiError?.code === "HTTP_404"
            ? "Backend PUT /api/quotations/catalog-component-pricing is not live yet."
            : apiError?.message || (err instanceof Error ? err.message : "Save failed"),
      })
    } finally {
      setIsSaving(false)
      setTimeout(() => setMessage(null), 8000)
    }
  }

  if (catalogLoading || !draft) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading catalog…
      </div>
    )
  }

  const addBrandQuickPicks =
    pending?.kind === "add-brand"
      ? pending.category === "panel"
        ? panelBrandOptions
        : pending.category === "inverter"
          ? inverterBrandOptions
          : pending.category === "structure"
            ? structureBrandOptions
            : pending.category === "cable"
              ? cableBrandOptions
              : pending.category === "meter"
                ? meterBrandOptions
                : pending.category === "accessories"
                  ? accessoriesBrandOptions
                  : (draft?.categories[pending.category]?.brands || []).map((b) => b.name)
      : []

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-emerald-950 sm:text-2xl">Price set</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Panel: Brand, Type, Spec, per-watt. Inverter: Brand, kW, Phases, string, Price.
            Structure: Kg → Weight × Per kg = Piece price; Piece → Amount only.
            Cable: Brand, mm, per meter. Meter: Brand, Phase, Price per piece. Accessories:
            Brand, Product, Price.
          </p>
        </div>
        <Button onClick={() => void handleSave()} disabled={isSaving} className="shrink-0">
          {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          {isSaving ? "Saving…" : "Save"}
        </Button>
      </div>

      {message ? (
        <div
          className={cn(
            "rounded-lg border px-4 py-3 text-sm",
            message.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-red-200 bg-red-50 text-red-900",
          )}
        >
          {message.text}
        </div>
      ) : null}

      <Tabs
        value={activeCategory}
        onValueChange={(v) => setActiveCategory(v as CatalogComponentKey)}
        className="space-y-4"
      >
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 rounded-xl border border-emerald-100 bg-gradient-to-r from-emerald-50/90 to-teal-50/80 p-1.5">
          {CATALOG_COMPONENT_KEYS.map((key) => (
            <TabsTrigger
              key={key}
              value={key}
              className="rounded-lg px-3 py-1.5 text-xs data-[state=active]:bg-emerald-600 data-[state=active]:text-white sm:text-sm"
            >
              {CATALOG_COMPONENT_LABELS[key]}
            </TabsTrigger>
          ))}
        </TabsList>

        {CATALOG_COMPONENT_KEYS.map((category) => (
          <TabsContent key={category} value={category} className="mt-0 space-y-4">
            {category === "panel" ? (
              <div className="space-y-3 rounded-xl border border-emerald-100 bg-white p-3 shadow-sm sm:p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-emerald-950">Panel pricing</p>
                    <p className="text-[11px] text-muted-foreground">
                      Brand is a manufacturer (Adani, Waaree, …). DCR / Non-DCR is type. Spec is
                      Topcon or Bifacial — not watt.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={requestAddBrand}>
                      <FolderPlus className="mr-1.5 h-3.5 w-3.5" />
                      Add brand
                    </Button>
                    <Button type="button" size="sm" variant="secondary" onClick={addRow}>
                      <PackagePlus className="mr-1.5 h-3.5 w-3.5" />
                      Add row
                    </Button>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-lg border border-border/70">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40">
                        <TableHead className="w-[22%]">Brand</TableHead>
                        <TableHead className="w-[16%]">Type</TableHead>
                        <TableHead className="w-[18%]">Spec</TableHead>
                        <TableHead className="w-[26%]">Per watt pricing (₹)</TableHead>
                        <TableHead className="w-[18%] text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {flatPanelRows.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                            No rows. Click Add row — choose Brand, type, and Spec (Topcon / Bifacial).
                          </TableCell>
                        </TableRow>
                      ) : (
                        flatPanelRows.map((row) => (
                          <TableRow key={row.id}>
                            <TableCell>
                              <Select
                                value={row.brand || ""}
                                onValueChange={(value) => {
                                  ensureBrandBucket(value)
                                  movePanelRowToBrand(row.brandIndex, row.rowIndex, value)
                                }}
                              >
                                <SelectTrigger className="h-9">
                                  <SelectValue placeholder="Select brand" />
                                </SelectTrigger>
                                <SelectContent>
                                  {panelBrandOptions.map((name) => (
                                    <SelectItem key={name} value={name}>
                                      {name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <Select
                                value={row.contentType || "dcr"}
                                onValueChange={(value) => {
                                  const contentType = value as PanelContentType
                                  updateBrandRows("panel", row.brandIndex, (rows) =>
                                    rows.map((r, i) =>
                                      i === row.rowIndex ? { ...r, contentType } : r,
                                    ),
                                  )
                                }}
                              >
                                <SelectTrigger className="h-9">
                                  <SelectValue placeholder="Type" />
                                </SelectTrigger>
                                <SelectContent>
                                  {PANEL_CONTENT_TYPES.map((key) => (
                                    <SelectItem key={key} value={key}>
                                      {PANEL_CONTENT_TYPE_LABELS[key]}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <Select
                                value={row.spec || "Topcon"}
                                onValueChange={(spec) =>
                                  updateBrandRows("panel", row.brandIndex, (rows) =>
                                    rows.map((r, i) =>
                                      i === row.rowIndex ? { ...r, spec } : r,
                                    ),
                                  )
                                }
                              >
                                <SelectTrigger className="h-9">
                                  <SelectValue placeholder="Spec" />
                                </SelectTrigger>
                                <SelectContent>
                                  {PANEL_SPEC_OPTIONS.map((opt) => (
                                    <SelectItem key={opt} value={opt}>
                                      {opt}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min={0}
                                step="0.01"
                                value={row.perWattPrice ?? ""}
                                onChange={(e) => {
                                  const perWatt = parseNum(e.target.value)
                                  updateBrandRows("panel", row.brandIndex, (rows) =>
                                    rows.map((r, i) =>
                                      i === row.rowIndex
                                        ? { ...r, perWattPrice: perWatt }
                                        : r,
                                    ),
                                  )
                                }}
                                placeholder="25"
                              />
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-red-600 hover:bg-red-50"
                                onClick={() =>
                                  setPending({
                                    kind: "delete-row",
                                    category: "panel",
                                    brandIndex: row.brandIndex,
                                    rowIndex: row.rowIndex,
                                  })
                                }
                                title="Delete row"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ) : category === "inverter" ? (
              <div className="space-y-3 rounded-xl border border-emerald-100 bg-white p-3 shadow-sm sm:p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-emerald-950">Inverter pricing</p>
                    <p className="text-[11px] text-muted-foreground">
                      Brand first, then kW, Phases, Single string, and Price — same row layout as Panel.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={requestAddBrand}>
                      <FolderPlus className="mr-1.5 h-3.5 w-3.5" />
                      Add brand
                    </Button>
                    <Button type="button" size="sm" variant="secondary" onClick={addRow}>
                      <PackagePlus className="mr-1.5 h-3.5 w-3.5" />
                      Add row
                    </Button>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-lg border border-border/70">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40">
                        <TableHead className="w-[18%]">Brand</TableHead>
                        <TableHead className="w-[14%]">kW</TableHead>
                        <TableHead className="w-[16%]">Phases</TableHead>
                        <TableHead className="w-[20%]">Single string</TableHead>
                        <TableHead className="w-[18%]">Price (₹)</TableHead>
                        <TableHead className="w-[14%] text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {flatInverterRows.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                            No rows. Click Add row — choose Brand, then kW, phases, single string, and
                            price.
                          </TableCell>
                        </TableRow>
                      ) : (
                        flatInverterRows.map((row) => (
                          <TableRow key={row.id}>
                            <TableCell>
                              <Select
                                value={row.brand || ""}
                                onValueChange={(value) => {
                                  ensureInverterBrandBucket(value)
                                  moveInverterRowToBrand(row.brandIndex, row.rowIndex, value)
                                }}
                              >
                                <SelectTrigger className="h-9">
                                  <SelectValue placeholder="Select brand" />
                                </SelectTrigger>
                                <SelectContent>
                                  {inverterBrandOptions.map((name) => (
                                    <SelectItem key={name} value={name}>
                                      {name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min={0}
                                step="0.1"
                                value={row.kw ?? ""}
                                onChange={(e) => {
                                  const kw = parseNum(e.target.value)
                                  updateBrandRows("inverter", row.brandIndex, (rows) =>
                                    rows.map((r, i) => (i === row.rowIndex ? { ...r, kw } : r)),
                                  )
                                }}
                                placeholder="5"
                              />
                            </TableCell>
                            <TableCell>
                              <Select
                                value={row.phases || "1-Phase"}
                                onValueChange={(phases) =>
                                  updateBrandRows("inverter", row.brandIndex, (rows) =>
                                    rows.map((r, i) =>
                                      i === row.rowIndex ? { ...r, phases } : r,
                                    ),
                                  )
                                }
                              >
                                <SelectTrigger className="h-9">
                                  <SelectValue placeholder="Phases" />
                                </SelectTrigger>
                                <SelectContent>
                                  {INVERTER_PHASE_OPTIONS.map((opt) => (
                                    <SelectItem key={opt} value={opt}>
                                      {opt}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <Select
                                value={row.singleString || "Single string"}
                                onValueChange={(singleString) =>
                                  updateBrandRows("inverter", row.brandIndex, (rows) =>
                                    rows.map((r, i) =>
                                      i === row.rowIndex ? { ...r, singleString } : r,
                                    ),
                                  )
                                }
                              >
                                <SelectTrigger className="h-9">
                                  <SelectValue placeholder="String" />
                                </SelectTrigger>
                                <SelectContent>
                                  {INVERTER_STRING_OPTIONS.map((opt) => (
                                    <SelectItem key={opt} value={opt}>
                                      {opt}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min={0}
                                step="0.01"
                                value={row.price ?? ""}
                                onChange={(e) => {
                                  const price = parseNum(e.target.value)
                                  updateBrandRows("inverter", row.brandIndex, (rows) =>
                                    rows.map((r, i) =>
                                      i === row.rowIndex ? { ...r, price } : r,
                                    ),
                                  )
                                }}
                                placeholder="0"
                              />
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-red-600 hover:bg-red-50"
                                onClick={() =>
                                  setPending({
                                    kind: "delete-row",
                                    category: "inverter",
                                    brandIndex: row.brandIndex,
                                    rowIndex: row.rowIndex,
                                  })
                                }
                                title="Delete row"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ) : category === "structure" ? (
              <div className="space-y-3 rounded-xl border border-emerald-100 bg-white p-3 shadow-sm sm:p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-emerald-950">Structure pricing</p>
                    <p className="text-[11px] text-muted-foreground">
                      Kg → Weight × Per kg = Piece price. Piece → enter Amount only (no weight).
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={requestAddBrand}>
                      <FolderPlus className="mr-1.5 h-3.5 w-3.5" />
                      Add brand
                    </Button>
                    <Button type="button" size="sm" variant="secondary" onClick={addRow}>
                      <PackagePlus className="mr-1.5 h-3.5 w-3.5" />
                      Add row
                    </Button>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-lg border border-border/70">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40">
                        <TableHead className="w-[14%]">Brand</TableHead>
                        <TableHead className="w-[16%]">Product</TableHead>
                        <TableHead className="w-[12%]">Measurement</TableHead>
                        <TableHead className="w-[14%]">Weight (kg)</TableHead>
                        <TableHead className="w-[14%]">Per kg (₹)</TableHead>
                        <TableHead className="w-[16%]">Piece price (₹)</TableHead>
                        <TableHead className="w-[14%] text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {flatStructureRows.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={7}
                            className="py-8 text-center text-sm text-muted-foreground"
                          >
                            No rows. Kg: weight × per kg → piece price. Piece: amount only.
                          </TableCell>
                        </TableRow>
                      ) : (
                        flatStructureRows.map((row) => {
                          const measurement: StructureMeasurement =
                            row.measurement === "piece" ? "piece" : "kg"
                          const isPiece = measurement === "piece"
                          const weight = Number(row.quantity ?? row.weightKg) || 0
                          const perKg = Number(row.perKgPrice) || 0
                          const calcPiecePrice =
                            Math.round(weight * perKg * 100) / 100
                          return (
                            <TableRow key={row.id}>
                              <TableCell>
                                <Select
                                  value={row.brand || ""}
                                  onValueChange={(value) => {
                                    ensureStructureBrandBucket(value)
                                    moveStructureRowToBrand(row.brandIndex, row.rowIndex, value)
                                  }}
                                >
                                  <SelectTrigger className="h-9">
                                    <SelectValue placeholder="Select brand" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {structureBrandOptions.map((name) => (
                                      <SelectItem key={name} value={name}>
                                        {name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell>
                                <Input
                                  value={row.product ?? ""}
                                  onChange={(e) => {
                                    const product = e.target.value
                                    updateBrandRows("structure", row.brandIndex, (rows) =>
                                      rows.map((r, i) =>
                                        i === row.rowIndex ? { ...r, product } : r,
                                      ),
                                    )
                                  }}
                                  placeholder="Rail / Clamp"
                                />
                              </TableCell>
                              <TableCell>
                                <Select
                                  value={measurement}
                                  onValueChange={(value) => {
                                    const next = value as StructureMeasurement
                                    updateBrandRows("structure", row.brandIndex, (rows) =>
                                      rows.map((r, i) => {
                                        if (i !== row.rowIndex) return r
                                        if (next === "piece") {
                                          return {
                                            ...r,
                                            measurement: next,
                                            quantity: undefined,
                                            weightKg: undefined,
                                            perKgPrice: undefined,
                                          }
                                        }
                                        const w = Number(r.quantity ?? r.weightKg) || 0
                                        const pkg = Number(r.perKgPrice) || 0
                                        return {
                                          ...r,
                                          measurement: next,
                                          perPiecePrice:
                                            Math.round(w * pkg * 100) / 100,
                                        }
                                      }),
                                    )
                                  }}
                                >
                                  <SelectTrigger className="h-9">
                                    <SelectValue placeholder="Unit" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {STRUCTURE_MEASUREMENT_OPTIONS.map((opt) => (
                                      <SelectItem key={opt} value={opt}>
                                        {STRUCTURE_MEASUREMENT_LABELS[opt]}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell>
                                {isPiece ? (
                                  <span className="px-1 text-xs text-muted-foreground">
                                    Not needed
                                  </span>
                                ) : (
                                  <Input
                                    type="number"
                                    min={0}
                                    step="0.01"
                                    value={row.quantity ?? row.weightKg ?? ""}
                                    onChange={(e) => {
                                      const quantity = parseNum(e.target.value)
                                      const pkg = Number(row.perKgPrice) || 0
                                      const perPiecePrice =
                                        Math.round(quantity * pkg * 100) / 100
                                      updateBrandRows("structure", row.brandIndex, (rows) =>
                                        rows.map((r, i) =>
                                          i === row.rowIndex
                                            ? {
                                                ...r,
                                                quantity,
                                                weightKg: quantity,
                                                perPiecePrice,
                                              }
                                            : r,
                                        ),
                                      )
                                    }}
                                    placeholder="Weight kg"
                                  />
                                )}
                              </TableCell>
                              <TableCell>
                                {isPiece ? (
                                  <span className="px-1 text-xs text-muted-foreground">
                                    Not needed
                                  </span>
                                ) : (
                                  <Input
                                    type="number"
                                    min={0}
                                    step="0.01"
                                    value={row.perKgPrice ?? ""}
                                    onChange={(e) => {
                                      const perKgPrice = parseNum(e.target.value)
                                      const w =
                                        Number(row.quantity ?? row.weightKg) || 0
                                      const perPiecePrice =
                                        Math.round(w * perKgPrice * 100) / 100
                                      updateBrandRows("structure", row.brandIndex, (rows) =>
                                        rows.map((r, i) =>
                                          i === row.rowIndex
                                            ? { ...r, perKgPrice, perPiecePrice }
                                            : r,
                                        ),
                                      )
                                    }}
                                    placeholder="Per kg"
                                  />
                                )}
                              </TableCell>
                              <TableCell>
                                {isPiece ? (
                                  <Input
                                    type="number"
                                    min={0}
                                    step="0.01"
                                    value={row.perPiecePrice ?? ""}
                                    onChange={(e) => {
                                      const perPiecePrice = parseNum(e.target.value)
                                      updateBrandRows("structure", row.brandIndex, (rows) =>
                                        rows.map((r, i) =>
                                          i === row.rowIndex ? { ...r, perPiecePrice } : r,
                                        ),
                                      )
                                    }}
                                    placeholder="Amount"
                                  />
                                ) : (
                                  <Input
                                    type="number"
                                    min={0}
                                    step="0.01"
                                    value={
                                      row.perPiecePrice != null && row.perPiecePrice > 0
                                        ? row.perPiecePrice
                                        : calcPiecePrice || ""
                                    }
                                    readOnly
                                    className="bg-muted/40"
                                    placeholder="Auto"
                                    title="Weight × Per kg"
                                  />
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-red-600 hover:bg-red-50"
                                  onClick={() =>
                                    setPending({
                                      kind: "delete-row",
                                      category: "structure",
                                      brandIndex: row.brandIndex,
                                      rowIndex: row.rowIndex,
                                    })
                                  }
                                  title="Delete row"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          )
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ) : category === "cable" ? (
              <div className="space-y-3 rounded-xl border border-emerald-100 bg-white p-3 shadow-sm sm:p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-emerald-950">Cable pricing</p>
                    <p className="text-[11px] text-muted-foreground">
                      Brand, mm thickness, and price per meter.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={requestAddBrand}>
                      <FolderPlus className="mr-1.5 h-3.5 w-3.5" />
                      Add brand
                    </Button>
                    <Button type="button" size="sm" variant="secondary" onClick={addRow}>
                      <PackagePlus className="mr-1.5 h-3.5 w-3.5" />
                      Add row
                    </Button>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-lg border border-border/70">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40">
                        <TableHead className="w-[28%]">Brand</TableHead>
                        <TableHead className="w-[28%]">mm thickness</TableHead>
                        <TableHead className="w-[28%]">Per meter (₹)</TableHead>
                        <TableHead className="w-[16%] text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {flatCableRows.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={4}
                            className="py-8 text-center text-sm text-muted-foreground"
                          >
                            No rows. Click Add row — Brand, mm thickness, per meter price.
                          </TableCell>
                        </TableRow>
                      ) : (
                        flatCableRows.map((row) => (
                          <TableRow key={row.id}>
                            <TableCell>
                              <Select
                                value={row.brand || ""}
                                onValueChange={(value) => {
                                  ensureCableBrandBucket(value)
                                  moveCableRowToBrand(row.brandIndex, row.rowIndex, value)
                                }}
                              >
                                <SelectTrigger className="h-9">
                                  <SelectValue placeholder="Select brand" />
                                </SelectTrigger>
                                <SelectContent>
                                  {cableBrandOptions.map((name) => (
                                    <SelectItem key={name} value={name}>
                                      {name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min={0}
                                step="0.1"
                                value={row.mmThickness ?? ""}
                                onChange={(e) => {
                                  const mmThickness = parseNum(e.target.value)
                                  updateBrandRows("cable", row.brandIndex, (rows) =>
                                    rows.map((r, i) =>
                                      i === row.rowIndex
                                        ? {
                                            ...r,
                                            mmThickness,
                                            spec: mmThickness > 0 ? `${mmThickness} mm` : r.spec,
                                          }
                                        : r,
                                    ),
                                  )
                                }}
                                placeholder="4"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min={0}
                                step="0.01"
                                value={row.perMeterPrice ?? ""}
                                onChange={(e) => {
                                  const perMeterPrice = parseNum(e.target.value)
                                  updateBrandRows("cable", row.brandIndex, (rows) =>
                                    rows.map((r, i) =>
                                      i === row.rowIndex
                                        ? {
                                            ...r,
                                            perMeterPrice,
                                            unitPrice: perMeterPrice,
                                            price: perMeterPrice,
                                          }
                                        : r,
                                    ),
                                  )
                                }}
                                placeholder="0"
                              />
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-red-600 hover:bg-red-50"
                                onClick={() =>
                                  setPending({
                                    kind: "delete-row",
                                    category: "cable",
                                    brandIndex: row.brandIndex,
                                    rowIndex: row.rowIndex,
                                  })
                                }
                                title="Delete row"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ) : category === "meter" ? (
              <div className="space-y-3 rounded-xl border border-emerald-100 bg-white p-3 shadow-sm sm:p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-emerald-950">Meter pricing</p>
                    <p className="text-[11px] text-muted-foreground">
                      Brand, Phase (1-Phase / 3-Phase), and Price per piece.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={requestAddBrand}>
                      <FolderPlus className="mr-1.5 h-3.5 w-3.5" />
                      Add brand
                    </Button>
                    <Button type="button" size="sm" variant="secondary" onClick={addRow}>
                      <PackagePlus className="mr-1.5 h-3.5 w-3.5" />
                      Add row
                    </Button>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-lg border border-border/70">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40">
                        <TableHead className="w-[28%]">Brand</TableHead>
                        <TableHead className="w-[24%]">Phase</TableHead>
                        <TableHead className="w-[28%]">Price per piece (₹)</TableHead>
                        <TableHead className="w-[20%] text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {flatMeterRows.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={4}
                            className="py-8 text-center text-sm text-muted-foreground"
                          >
                            No rows. Click Add row — Brand, Phase, Price per piece.
                          </TableCell>
                        </TableRow>
                      ) : (
                        flatMeterRows.map((row) => (
                          <TableRow key={row.id}>
                            <TableCell>
                              <Select
                                value={row.brand || ""}
                                onValueChange={(value) => {
                                  ensureMeterBrandBucket(value)
                                  moveMeterRowToBrand(row.brandIndex, row.rowIndex, value)
                                }}
                              >
                                <SelectTrigger className="h-9">
                                  <SelectValue placeholder="Select brand" />
                                </SelectTrigger>
                                <SelectContent>
                                  {meterBrandOptions.map((name) => (
                                    <SelectItem key={name} value={name}>
                                      {name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <Select
                                value={row.phases || "1-Phase"}
                                onValueChange={(phases) =>
                                  updateBrandRows("meter", row.brandIndex, (rows) =>
                                    rows.map((r, i) =>
                                      i === row.rowIndex ? { ...r, phases } : r,
                                    ),
                                  )
                                }
                              >
                                <SelectTrigger className="h-9">
                                  <SelectValue placeholder="Phase" />
                                </SelectTrigger>
                                <SelectContent>
                                  {INVERTER_PHASE_OPTIONS.map((opt) => (
                                    <SelectItem key={opt} value={opt}>
                                      {opt}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min={0}
                                step="0.01"
                                value={row.perPiecePrice ?? ""}
                                onChange={(e) => {
                                  const perPiecePrice = parseNum(e.target.value)
                                  updateBrandRows("meter", row.brandIndex, (rows) =>
                                    rows.map((r, i) =>
                                      i === row.rowIndex
                                        ? {
                                            ...r,
                                            perPiecePrice,
                                            price: perPiecePrice,
                                          }
                                        : r,
                                    ),
                                  )
                                }}
                                placeholder="0"
                              />
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-red-600 hover:bg-red-50"
                                onClick={() =>
                                  setPending({
                                    kind: "delete-row",
                                    category: "meter",
                                    brandIndex: row.brandIndex,
                                    rowIndex: row.rowIndex,
                                  })
                                }
                                title="Delete row"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ) : category === "accessories" ? (
              <div className="space-y-3 rounded-xl border border-emerald-100 bg-white p-3 shadow-sm sm:p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-emerald-950">Accessories pricing</p>
                    <p className="text-[11px] text-muted-foreground">
                      Brand, Product, and Price per piece.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={requestAddBrand}>
                      <FolderPlus className="mr-1.5 h-3.5 w-3.5" />
                      Add brand
                    </Button>
                    <Button type="button" size="sm" variant="secondary" onClick={addRow}>
                      <PackagePlus className="mr-1.5 h-3.5 w-3.5" />
                      Add row
                    </Button>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-lg border border-border/70">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40">
                        <TableHead className="w-[24%]">Brand</TableHead>
                        <TableHead className="w-[32%]">Product</TableHead>
                        <TableHead className="w-[28%]">Price per piece (₹)</TableHead>
                        <TableHead className="w-[16%] text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {flatAccessoriesRows.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={4}
                            className="py-8 text-center text-sm text-muted-foreground"
                          >
                            No rows. Click Add row — Product and Price per piece.
                          </TableCell>
                        </TableRow>
                      ) : (
                        flatAccessoriesRows.map((row) => (
                          <TableRow key={row.id}>
                            <TableCell>
                              <Select
                                value={row.brand || ""}
                                onValueChange={(value) => {
                                  ensureAccessoriesBrandBucket(value)
                                  moveAccessoriesRowToBrand(row.brandIndex, row.rowIndex, value)
                                }}
                              >
                                <SelectTrigger className="h-9">
                                  <SelectValue placeholder="Select brand" />
                                </SelectTrigger>
                                <SelectContent>
                                  {accessoriesBrandOptions.map((name) => (
                                    <SelectItem key={name} value={name}>
                                      {name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <Input
                                value={row.product ?? ""}
                                onChange={(e) => {
                                  const product = e.target.value
                                  updateBrandRows("accessories", row.brandIndex, (rows) =>
                                    rows.map((r, i) =>
                                      i === row.rowIndex
                                        ? { ...r, product, spec: product }
                                        : r,
                                    ),
                                  )
                                }}
                                placeholder="MC4 / Earthing kit"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min={0}
                                step="0.01"
                                value={row.perPiecePrice ?? ""}
                                onChange={(e) => {
                                  const perPiecePrice = parseNum(e.target.value)
                                  updateBrandRows("accessories", row.brandIndex, (rows) =>
                                    rows.map((r, i) =>
                                      i === row.rowIndex
                                        ? {
                                            ...r,
                                            perPiecePrice,
                                            price: perPiecePrice,
                                            unitPrice: perPiecePrice,
                                          }
                                        : r,
                                    ),
                                  )
                                }}
                                placeholder="0"
                              />
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-red-600 hover:bg-red-50"
                                onClick={() =>
                                  setPending({
                                    kind: "delete-row",
                                    category: "accessories",
                                    brandIndex: row.brandIndex,
                                    rowIndex: row.rowIndex,
                                  })
                                }
                                title="Delete row"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ) : null}
          </TabsContent>
        ))}
      </Tabs>

      <AlertDialog
        open={!!pending}
        onOpenChange={(open) => {
          if (!open) {
            setPending(null)
            setShowNewBrandField(false)
            setBrandNameInput("")
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pending?.kind === "add-brand"
                ? `Add brand — ${CATALOG_COMPONENT_LABELS[pending.category]}`
                : pending?.kind === "delete-brand"
                  ? `Delete brand “${pending.name}”?`
                  : "Delete this row?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pending?.kind === "add-brand"
                ? showNewBrandField
                  ? "Enter the new manufacturer name. After Add, it will appear in the brand dropdown next time."
                  : "Pick an existing brand from the dropdown, or click Add new brand to create one."
                : pending?.kind === "delete-brand"
                  ? "All pricing rows under this brand will be removed."
                  : "This row will be removed from the table."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {pending?.kind === "add-brand" ? (
            <div className="space-y-4 py-1">
              {!showNewBrandField ? (
                <>
                  <div className="space-y-2">
                    <Label>Brand</Label>
                    <Select
                      value={
                        addBrandQuickPicks.some(
                          (n) => n.toLowerCase() === brandNameInput.trim().toLowerCase(),
                        )
                          ? brandNameInput.trim()
                          : undefined
                      }
                      onValueChange={setBrandNameInput}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select brand…" />
                      </SelectTrigger>
                      <SelectContent>
                        {addBrandQuickPicks.length === 0 ? (
                          <SelectItem value="__none" disabled>
                            No brands yet — add a new one
                          </SelectItem>
                        ) : (
                          addBrandQuickPicks.map((name) => (
                            <SelectItem key={name} value={name}>
                              {name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      setShowNewBrandField(true)
                      setBrandNameInput("")
                    }}
                  >
                    <FolderPlus className="mr-1.5 h-3.5 w-3.5" />
                    Add new brand
                  </Button>
                </>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="new-brand-name">New brand name</Label>
                  <Input
                    id="new-brand-name"
                    value={brandNameInput}
                    onChange={(e) => setBrandNameInput(e.target.value)}
                    placeholder="e.g. My Solar Brand"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault()
                        confirmPending()
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="px-0 text-muted-foreground"
                    onClick={() => {
                      setShowNewBrandField(false)
                      setBrandNameInput("")
                    }}
                  >
                    ← Back to brand list
                  </Button>
                </div>
              )}
            </div>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmPending}
              disabled={
                pending?.kind === "add-brand" &&
                (showNewBrandField ? !brandNameInput.trim() : !brandNameInput.trim())
              }
              className={
                pending?.kind === "delete-brand" || pending?.kind === "delete-row"
                  ? "bg-red-600 hover:bg-red-700"
                  : undefined
              }
            >
              {pending?.kind === "add-brand"
                ? showNewBrandField
                  ? "Save new brand"
                  : "Use selected"
                : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
