"use client"

import type React from "react"

import { useState, useEffect, useMemo } from "react"
import type { ProductSelection } from "@/lib/quotation-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { ArrowLeft, ArrowRight, Plus, Trash2, Sun, Zap, Cable, Gauge, Box, List } from "lucide-react"
import { DcrConfigDialog } from "@/components/dcr-config-dialog"
import { NonDcrConfigDialog } from "@/components/non-dcr-config-dialog"
import { BothConfigDialog } from "@/components/both-config-dialog"
import { 
  type SystemPricing, 
  type BothSystemPricing,
  getSystemConfigOptionsByType,
  getSystemConfigById,
  configToProductSelection,
  getSystemConfiguration,
  getAvailablePanelSizes,
  getAvailableStructureSizes,
  formatACDBOption,
  formatDCDBOption,
  acdbDcdbLabelsForPhase,
  defaultAcdbDcdbForPhase,
  listAcdbDcdbOptionsForPhase,
  determinePhase,
  resolveQuotationPhase,
  calculateSystemSize,
  dcrPanelSizeForPricingType,
  dcrFormPanelBrandForPricingType,
  dcrPanelPackageForPricingRow,
  DCR_AS_PER_THE_SET,
  panelQuantityForNominalSystemKw,
  bestPanelConfigWithinSystemKw,
  COMMON_PANEL_SIZES_WATTS,
  clampPanelQuantityToNominalSystemKw,
  maxAllowedWattsForNominalSystemKw,
  parsePanelSizeWatts,
} from "@/lib/pricing-tables"
import { usePricingTables } from "@/lib/use-pricing-tables"
import { useProductCatalog } from "@/lib/use-product-catalog"
import {
  buildInverterBrandDropdownOptions,
  QUOTATION_AS_PER_THE_SET_LABEL,
  isAsPerTheSetLabel,
  isPanelRowComplete,
  isInverterInfoComplete,
  buildMeterBrandDropdownOptions,
  getPanelPdfRangeOptionsForBrand,
  defaultPdfPanelRangeKeyForDcrPricingType,
  defaultPdfPanelRangeKeyForPanelBrand,
  applyDefaultPdfPanelRanges,
  getPanelPdfRangeLabel,
  TATA_DCR_PANEL_RANGE_KEY,
  type PdfPanelRangeKey,
} from "@/lib/quotation-pdf-display"
import { restoreDcrPackageDisplayForForm, backfillPanelQuantityForPdfRange } from "@/lib/quotation-api-payload"
import { cn } from "@/lib/utils"

const DEFAULT_QUOTATION_SYSTEM_TYPE = "dcr" as const

type QuotationSystemTypeOption = "dcr" | "non-dcr" | "both"

const SYSTEM_TYPE_OPTIONS: Array<{
  value: QuotationSystemTypeOption
  label: string
  description: string
}> = [
  {
    value: "dcr",
    label: "DCR",
    description: "Subsidy-eligible domestic content panels. Select a DCR package.",
  },
  {
    value: "non-dcr",
    label: "NON DCR",
    description: "Commercial / non-subsidy on-grid systems. Select a NON DCR package.",
  },
  {
    value: "both",
    label: "BOTH",
    description: "Split DCR + Non-DCR configuration with subsidy on the DCR portion.",
  },
]

function PanelPdfRangeOptions({
  panelBrand,
  selectedKey,
  onChange,
}: {
  panelBrand: string
  selectedKey?: string
  onChange: (key: PdfPanelRangeKey | "") => void
}) {
  const options = getPanelPdfRangeOptionsForBrand(panelBrand)
  if (options.length === 0) return null

  return (
    <div className="mt-3 rounded-lg border border-dashed border-border/80 bg-muted/30 p-3 space-y-2">
      <p className="text-xs font-medium text-muted-foreground">Quotation PDF — panel size range (optional)</p>
      <p className="text-xs text-muted-foreground">
        Leave unchecked to show the exact panel size you entered (e.g. 625W) and system kW from panel × quantity.
        Check a range to show that range on the PDF instead (panel quantity is then omitted).
      </p>
      {options.map((option) => (
        <label key={option.key} className="flex items-start gap-2 text-sm cursor-pointer">
          <Checkbox
            checked={selectedKey === option.key}
            onCheckedChange={(checked) => onChange(checked === true ? option.key : "")}
            className="mt-0.5"
          />
          <span>
            Show <strong>{option.label}</strong> on PDF
          </span>
        </label>
      ))}
    </div>
  )
}

function CommercialPdfOptions({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <div className="mt-3 rounded-lg border border-dashed border-border/80 bg-muted/30 p-3 space-y-2">
      <p className="text-xs font-medium text-muted-foreground">Quotation PDF — commercial set</p>
      <label className="flex items-start gap-2 text-sm cursor-pointer">
        <Checkbox
          checked={checked}
          onCheckedChange={(value) => onChange(value === true)}
          className="mt-0.5"
        />
        <span>
          <strong>Commercial project</strong> — do not show subsidy on the proposal PDF
        </span>
      </label>
      <p className="text-xs text-muted-foreground">
        Use for commercial installations. Central subsidy and state subsidy fields are hidden, and subsidy terms
        are omitted from page 3 of the PDF.
      </p>
    </div>
  )
}

interface Props {
  onSubmit: (products: ProductSelection) => void
  onBack: () => void
  initialData?: ProductSelection
}

export function ProductSelectionForm({ onSubmit, onBack, initialData }: Props) {
  const { catalog } = useProductCatalog()
  const { pricingTables, isLoading: isLoadingPricing, error: pricingError } = usePricingTables()
  const [error, setError] = useState("")
  const [dcrConfigDialogOpen, setDcrConfigDialogOpen] = useState(false)
  const [nonDcrConfigDialogOpen, setNonDcrConfigDialogOpen] = useState(false)
  const [bothConfigDialogOpen, setBothConfigDialogOpen] = useState(false)
  const [hasSelectedDcrConfig, setHasSelectedDcrConfig] = useState(false)
  const [hasSelectedNonDcrConfig, setHasSelectedNonDcrConfig] = useState(false)
  const [hasSelectedBothConfig, setHasSelectedBothConfig] = useState(false)
  
  // Use catalog data from API only (no dummy data fallback)
  const panelBrandsList = catalog?.panels?.brands || []
  // Get panel sizes from pricing tables instead of catalog
  const panelSizesList = getAvailablePanelSizes(pricingTables || undefined)
  const inverterTypesList = catalog?.inverters?.types || []
  const inverterSizesList = catalog?.inverters?.sizes || []
  const inverterBrandsList = buildInverterBrandDropdownOptions(catalog?.inverters?.brands)
  const structureTypesList = catalog?.structures?.types || []
  // Get structure sizes from pricing tables instead of catalog
  const structureSizesList = getAvailableStructureSizes(pricingTables || undefined)
  const meterBrandsList = buildMeterBrandDropdownOptions(catalog?.meters?.brands)
  const cableBrandsList = catalog?.cables?.brands || []
  const cableSizesList = catalog?.cables?.sizes || []
  const emptyProductDefaults: ProductSelection = {
      phase: "",
      systemType: DEFAULT_QUOTATION_SYSTEM_TYPE,
      panelBrand: "",
      panelSize: "",
      panelQuantity: 0,
      inverterType: "",
      inverterBrand: "",
      inverterSize: "",
      structureType: "",
      structureSize: "",
      meterBrand: "",
      acCableBrand: "",
      acCableSize: "",
      dcCableBrand: "",
      dcCableSize: "",
      acdb: "",
      dcdb: "",
      centralSubsidy: 0,
      stateSubsidy: 0,
      hybridInverter: "",
      batteryCapacity: "",
      batteryPrice: 0,
      customPanels: [],
      dcrPanelBrand: "",
      dcrPanelSize: "",
      dcrPanelQuantity: 0,
      nonDcrPanelBrand: "",
      nonDcrPanelSize: "",
      nonDcrPanelQuantity: 0,
      pdfPanelRangeKey: "",
      pdfDcrPanelRangeKey: "",
      pdfNonDcrPanelRangeKey: "",
      pdfCommercialSet: false,
    }

  const [formData, setFormData] = useState<ProductSelection>(() =>
    initialData ? restoreDcrPackageDisplayForForm(initialData) : emptyProductDefaults,
  )

  /** Stable key so parent re-creating `initialData` each render does not wipe in-progress edits. */
  const initialDataSyncKey = useMemo(() => {
    if (!initialData) return ""
    return [
      initialData.systemType,
      initialData.panelBrand,
      initialData.panelSize,
      initialData.panelQuantity,
      initialData.dcrPanelBrand,
      initialData.dcrPanelSize,
      initialData.dcrPanelQuantity,
      initialData.structureSize,
      initialData.inverterSize,
      initialData.systemPrice,
      initialData.pdfPanelRangeKey,
      initialData.pdfCommercialSet,
    ].join("|")
  }, [initialData])

  useEffect(() => {
    if (!initialData) return
    let restored = restoreDcrPackageDisplayForForm(initialData)
    const phase = resolveQuotationPhase(restored)
    if (!restored.acdb?.trim() || !restored.dcdb?.trim()) {
      const defaults = defaultAcdbDcdbForPhase(phase)
      restored = {
        ...restored,
        phase: restored.phase || phase,
        acdb: restored.acdb?.trim() || defaults.acdb,
        dcdb: restored.dcdb?.trim() || defaults.dcdb,
      }
    }
    setFormData(restored)
    if (
      restored.systemType === "dcr" &&
      (restored.panelBrand?.trim() || restored.systemPrice)
    ) {
      setHasSelectedDcrConfig(true)
    }
  }, [initialDataSyncKey])

  // Auto-select default PDF panel range when brand supports it (INA, Premier, Adani, etc.)
  useEffect(() => {
    setFormData((prev) => {
      const next = applyDefaultPdfPanelRanges(prev)
      if (
        next.pdfPanelRangeKey === prev.pdfPanelRangeKey &&
        next.pdfDcrPanelRangeKey === prev.pdfDcrPanelRangeKey &&
        next.pdfNonDcrPanelRangeKey === prev.pdfNonDcrPanelRangeKey &&
        next.pdfUsePanelSizeRange === prev.pdfUsePanelSizeRange
      ) {
        return prev
      }
      return next
    })
  }, [formData.panelBrand, formData.dcrPanelBrand, formData.nonDcrPanelBrand])

  // Keep panel quantity in sync when PDF range hides the quantity field
  useEffect(() => {
    setFormData((prev) => {
      const next = backfillPanelQuantityForPdfRange(prev)
      if (
        next.panelQuantity === prev.panelQuantity &&
        next.dcrPanelQuantity === prev.dcrPanelQuantity &&
        next.nonDcrPanelQuantity === prev.nonDcrPanelQuantity
      ) {
        return prev
      }
      return next
    })
  }, [
    formData.pdfPanelRangeKey,
    formData.pdfDcrPanelRangeKey,
    formData.pdfNonDcrPanelRangeKey,
    formData.structureSize,
    formData.panelSize,
    formData.dcrPanelSize,
    formData.nonDcrPanelSize,
  ])

  const effectiveSystemType = (formData.systemType || DEFAULT_QUOTATION_SYSTEM_TYPE) as QuotationSystemTypeOption

  const handleSystemTypeChange = (nextType: QuotationSystemTypeOption) => {
    if (nextType === effectiveSystemType) return
    setHasSelectedDcrConfig(false)
    setHasSelectedNonDcrConfig(false)
    setHasSelectedBothConfig(false)
    setError("")
    setFormData((prev) => {
      const commercial = Boolean(prev.pdfCommercialSet)
      return {
        ...emptyProductDefaults,
        systemType: nextType,
        // Commercial DCR/BOTH: subsidy stays 0 (hidden on form + PDF).
        pdfCommercialSet: commercial,
        centralSubsidy: nextType === "non-dcr" || commercial ? 0 : 78000,
        stateSubsidy: 0,
      }
    })
  }

  // Reset browse flags when system type changes (user switched type mid-form)
  useEffect(() => {
    if (!initialData) return
    if (initialData.systemType === formData.systemType) return
    setHasSelectedDcrConfig(false)
    setHasSelectedNonDcrConfig(false)
    setHasSelectedBothConfig(false)
  }, [formData.systemType, initialData?.systemType])

  // When loading initialData (editing), show fields if config is already populated
  useEffect(() => {
    if (initialData?.systemType === "non-dcr" && (initialData.panelBrand || initialData.panelSize || initialData.inverterSize)) {
      setHasSelectedNonDcrConfig(true)
    }
    if (initialData?.systemType === "dcr" && (initialData.panelBrand || initialData.panelSize || initialData.inverterSize)) {
      setHasSelectedDcrConfig(true)
    }
    if (initialData?.systemType === "both" && (initialData.dcrPanelBrand || initialData.nonDcrPanelBrand || initialData.inverterSize)) {
      setHasSelectedBothConfig(true)
    }
  }, [initialData?.systemType, initialData?.panelBrand, initialData?.panelSize, initialData?.inverterSize, initialData?.dcrPanelBrand, initialData?.nonDcrPanelBrand])

  // Determine phase based on system size and inverter size (BOTH: user-selectable, default 3-Phase)
  let systemSizeForPhase = ""
  if (formData.systemType === "both") {
    const dcrKw = formData.dcrPanelSize && formData.dcrPanelQuantity 
      ? (Number.parseFloat(formData.dcrPanelSize.replace("W", "")) * formData.dcrPanelQuantity) / 1000
      : 0
    const nonDcrKw = formData.nonDcrPanelSize && formData.nonDcrPanelQuantity
      ? (Number.parseFloat(formData.nonDcrPanelSize.replace("W", "")) * formData.nonDcrPanelQuantity) / 1000
      : 0
    systemSizeForPhase = `${dcrKw + nonDcrKw}kW`
  } else if (formData.panelSize && formData.panelQuantity) {
    systemSizeForPhase = calculateSystemSize(formData.panelSize, formData.panelQuantity)
  } else if (formData.dcrPanelSize && formData.dcrPanelQuantity) {
    systemSizeForPhase = calculateSystemSize(formData.dcrPanelSize, formData.dcrPanelQuantity)
  }
  
  const currentPhase = formData.phase
    ? (formData.phase as "1-Phase" | "3-Phase")
    : formData.systemType === "both"
    ? ("3-Phase" as "1-Phase" | "3-Phase")
    : formData.inverterSize && systemSizeForPhase
    ? determinePhase(systemSizeForPhase, formData.inverterSize, pricingTables || undefined)
    : formData.inverterSize
    ? (() => {
        const inverterKw = Number.parseFloat(formData.inverterSize.replace("kW", ""))
        if (inverterKw >= 7 || (inverterKw === 5 && !systemSizeForPhase)) {
          return "3-Phase" as "1-Phase" | "3-Phase"
        }
        return "1-Phase" as "1-Phase" | "3-Phase"
      })()
    : "1-Phase" as "1-Phase" | "3-Phase"
  
  const acdbDcdbOptionLists = useMemo(
    () => listAcdbDcdbOptionsForPhase(currentPhase, pricingTables || undefined),
    [currentPhase, pricingTables],
  )
  const acdbOptionsList = useMemo(() => {
    const merged = [...new Set([...acdbDcdbOptionLists.acdb, formData.acdb].filter(Boolean))]
    return merged.length > 0 ? merged : [formatACDBOption("Havells", currentPhase)]
  }, [acdbDcdbOptionLists.acdb, formData.acdb, currentPhase])
  const dcdbOptionsList = useMemo(() => {
    const merged = [...new Set([...acdbDcdbOptionLists.dcdb, formData.dcdb].filter(Boolean))]
    return merged.length > 0 ? merged : [formatDCDBOption("Havells", currentPhase)]
  }, [acdbDcdbOptionLists.dcdb, formData.dcdb, currentPhase])

  // Ensure non-dcr systems always have 0 subsidies
  useEffect(() => {
    if (formData.systemType === "non-dcr" && (formData.centralSubsidy !== 0 || formData.stateSubsidy !== 0)) {
      setFormData((prev) => ({
        ...prev,
        centralSubsidy: 0,
        stateSubsidy: 0,
      }))
    }
  }, [formData.systemType, formData.centralSubsidy, formData.stateSubsidy])

  // Commercial set (DCR/BOTH): subsidy always 0 — not shown on form or proposal PDF
  useEffect(() => {
    if (!formData.pdfCommercialSet) return
    if (formData.centralSubsidy === 0 && formData.stateSubsidy === 0) return
    setFormData((prev) => ({
      ...prev,
      centralSubsidy: 0,
      stateSubsidy: 0,
    }))
  }, [formData.pdfCommercialSet, formData.centralSubsidy, formData.stateSubsidy])

  const normalizeSizeValue = (value: string) => value.trim().toLowerCase()
  const isValueInList = (value: string, list: string[]) => {
    if (!value || list.length === 0) return true
    const normalized = normalizeSizeValue(value)
    const withUnit = normalized.endsWith("w") ? normalized : `${normalized}w`
    return list.some((item) => {
      const normalizedItem = normalizeSizeValue(item)
      return normalizedItem === normalized || normalizedItem === withUnit
    })
  }
  const toPanelSizeNumber = (value: string): number | null => {
    const cleaned = value.replace(/[^0-9]/g, "")
    const parsed = Number.parseInt(cleaned, 10)
    return Number.isNaN(parsed) ? null : parsed
  }
  const getClosestPanelSizeFromList = (value: string) => {
    if (!value || panelSizesList.length === 0) return value
    if (isValueInList(value, panelSizesList)) {
      const parsed = toPanelSizeNumber(value)
      return parsed ? `${parsed}W` : value
    }
    const target = toPanelSizeNumber(value)
    if (!target) return value
    const numericSizes = panelSizesList
      .map((size) => ({ num: toPanelSizeNumber(size) }))
      .filter((item): item is { num: number } => item.num !== null)
    if (numericSizes.length === 0) return value
    const closest = numericSizes.reduce((best, current) =>
      Math.abs(current.num - target) < Math.abs(best.num - target) ? current : best
    )
    return `${closest.num}W`
  }
  const updateFormData = <K extends keyof ProductSelection>(field: K, value: ProductSelection[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    setError("")
  }

  const parseNominalKwFromContext = (products: ProductSelection): number => {
    const source = String(products.structureSize || products.inverterSize || "").trim()
    const kw = Number.parseFloat(source.replace(/kW/i, ""))
    return Number.isFinite(kw) && kw > 0 ? kw : 0
  }

  const updatePanelSizeWithAutoQuantity = (
    field: "panelSize" | "dcrPanelSize" | "nonDcrPanelSize",
    rawSize: string,
  ) => {
    setFormData((prev) => {
      const next = { ...prev, [field]: rawSize }
      const nominalKw = parseNominalKwFromContext(next)
      if (nominalKw <= 0) return next

      const parsedPanelW = parsePanelSizeWatts(rawSize)
      if (parsedPanelW <= 0) return next

      const suggestedQty = panelQuantityForNominalSystemKw(nominalKw, rawSize)
      if (suggestedQty <= 0) return next

      // Keep dealer-entered quantity when already set; only auto-fill when empty.
      if (field === "panelSize") {
        const keepQty = Number(prev.panelQuantity) > 0 ? Number(prev.panelQuantity) : suggestedQty
        const capped =
          nominalKw > 0
            ? clampPanelQuantityToNominalSystemKw(nominalKw, rawSize, keepQty)
            : keepQty
        next.panelQuantity = capped
        if (next.systemType === "dcr") next.dcrPanelQuantity = capped
      } else if (field === "dcrPanelSize") {
        const keepQty = Number(prev.dcrPanelQuantity) > 0 ? Number(prev.dcrPanelQuantity) : suggestedQty
        next.dcrPanelQuantity =
          nominalKw > 0
            ? clampPanelQuantityToNominalSystemKw(nominalKw, rawSize, keepQty)
            : keepQty
      } else {
        const keepQty =
          Number(prev.nonDcrPanelQuantity) > 0 ? Number(prev.nonDcrPanelQuantity) : suggestedQty
        next.nonDcrPanelQuantity =
          nominalKw > 0
            ? clampPanelQuantityToNominalSystemKw(nominalKw, rawSize, keepQty)
            : keepQty
      }
      return next
    })
    setError("")
  }

  const updatePdfPanelRangeKey = (
    field: "pdfPanelRangeKey" | "pdfDcrPanelRangeKey" | "pdfNonDcrPanelRangeKey",
    key: PdfPanelRangeKey | "",
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: key,
      ...(field === "pdfPanelRangeKey"
        ? { pdfUsePanelSizeRange: Boolean(key) }
        : {}),
    }))
    setError("")
  }

  const updatePanelBrand = (field: "panelBrand" | "dcrPanelBrand" | "nonDcrPanelBrand", brand: string) => {
    const defaultRange = defaultPdfPanelRangeKeyForPanelBrand(brand)
    const isIna = brand.trim().toLowerCase() === "ina"
    const inaMarkers = isIna
      ? { panelType: "INA" as const, inaDcrPackage: true as const }
      : { panelType: undefined, inaDcrPackage: undefined }
    setFormData((prev) => ({
      ...prev,
      [field]: brand,
      ...inaMarkers,
      ...(field === "panelBrand"
        ? {
            pdfPanelRangeKey: defaultRange,
            pdfUsePanelSizeRange: Boolean(defaultRange),
          }
        : {}),
      ...(field === "dcrPanelBrand"
        ? {
            pdfDcrPanelRangeKey: defaultRange,
            panelBrand: brand,
            pdfPanelRangeKey: defaultRange,
            pdfUsePanelSizeRange: Boolean(defaultRange),
          }
        : {}),
      ...(field === "nonDcrPanelBrand" ? { pdfNonDcrPanelRangeKey: defaultRange } : {}),
    }))
    setError("")
  }

  const hidePrimaryPanelQty = Boolean(formData.pdfPanelRangeKey)
  const hideDcrPanelQty = Boolean(formData.pdfDcrPanelRangeKey)
  const hideNonDcrPanelQty = Boolean(formData.pdfNonDcrPanelRangeKey)

  const isTataDcrPackage =
    effectiveSystemType === "dcr" && formData.panelBrand?.trim().toLowerCase() === "tata"
  const isTataRangeSelected =
    isTataDcrPackage && formData.pdfPanelRangeKey === TATA_DCR_PANEL_RANGE_KEY

  /** DCR package set defines panel/inverter — not entered per SKU (e.g. Tata Jun 2026 sheet). */
  const dcrPackageAsPerSet =
    isTataRangeSelected ||
    (formData.systemType === "dcr" &&
      (isAsPerTheSetLabel(formData.panelSize) ||
        isAsPerTheSetLabel(formData.inverterSize) ||
        isAsPerTheSetLabel(formData.inverterBrand)))
  const hidePanelQtyForSet = hidePrimaryPanelQty || dcrPackageAsPerSet
  const tataDcrPanelRangeLabel =
    isTataDcrPackage && formData.pdfPanelRangeKey
      ? getPanelPdfRangeLabel(formData.pdfPanelRangeKey)
      : isTataDcrPackage
        ? getPanelPdfRangeLabel(TATA_DCR_PANEL_RANGE_KEY)
        : null

  // Quick Select dropdown removed - configurations are now selected via Browse dialogs
  // The handlers below (handleDcrConfigSelect, handleNonDcrConfigSelect, handleBothConfigSelect)
  // are used when selecting from the Browse dialogs

  const addCustomPanel = () => {
    setFormData((prev) => ({
      ...prev,
      customPanels: [...(prev.customPanels || []), { brand: "", size: "", quantity: 0, type: "dcr" }],
    }))
  }

  const updateCustomPanel = (index: number, field: string, value: string | number) => {
    setFormData((prev) => ({
      ...prev,
      customPanels: prev.customPanels?.map((panel, i) => (i === index ? { ...panel, [field]: value } : panel)),
    }))
  }

  const removeCustomPanel = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      customPanels: prev.customPanels?.filter((_, i) => i !== index),
    }))
  }

  // Handle BOTH (DCR + NON DCR) configuration selection from Browse dialog
  const handleBothConfigSelect = (config: BothSystemPricing) => {
    // Find matching system configuration preset that includes all component details
    const systemConfig = getSystemConfiguration(
      "both",
      config.systemSize,
      config.panelType,
      pricingTables || undefined,
      config.phase === "1-Phase" || config.phase === "3-Phase" ? config.phase : undefined,
    )
    
    if (systemConfig) {
      // Use the full system configuration preset to fill all fields
      const preFilledData = configToProductSelection(systemConfig)
      
      // For BOTH systems, we need to calculate DCR and NON DCR panel quantities separately
      const dcrKw = Number.parseFloat(config.dcrCapacity.replace("kW", ""))
      const nonDcrKw = Number.parseFloat(config.nonDcrCapacity.replace("kW", ""))
      const dcrW = dcrKw * 1000
      const nonDcrW = nonDcrKw * 1000
      const panelSize = Number.parseFloat(systemConfig.panelSize.replace("W", ""))
      
      const dcrQuantity = panelQuantityForNominalSystemKw(dcrKw, `${panelSize}W`)
      const nonDcrQuantity = panelQuantityForNominalSystemKw(nonDcrKw, `${panelSize}W`)

      const effPhase: "1-Phase" | "3-Phase" =
        config.phase === "1-Phase" || config.phase === "3-Phase"
          ? config.phase
          : systemConfig.phase === "1-Phase" || systemConfig.phase === "3-Phase"
            ? (systemConfig.phase as "1-Phase" | "3-Phase")
            : "3-Phase"
      const baseAcdb = systemConfig.acdb || preFilledData.acdb || formatACDBOption("Havells", effPhase)
      const baseDcdb = systemConfig.dcdb || preFilledData.dcdb || formatDCDBOption("Havells", effPhase)
      const acdbForPhase = baseAcdb.replace(/\((1-Phase|3-Phase)\)/, `(${effPhase})`)
      const dcdbForPhase = baseDcdb.replace(/\((1-Phase|3-Phase)\)/, `(${effPhase})`)
      
      setFormData((prev) => {
        const updated = {
          ...prev,
          ...preFilledData,
          phase: effPhase,
          // Override panel quantities for BOTH system
          dcrPanelBrand: systemConfig.panelBrand,
          dcrPanelSize: getClosestPanelSizeFromList(systemConfig.panelSize),
          dcrPanelQuantity: dcrQuantity,
          nonDcrPanelBrand: systemConfig.panelBrand,
          nonDcrPanelSize: getClosestPanelSizeFromList(systemConfig.panelSize),
          nonDcrPanelQuantity: nonDcrQuantity,
          acdb: acdbForPhase,
          dcdb: dcdbForPhase,
          // BOTH systems require central subsidy (default: 78000) — except commercial (always 0)
          centralSubsidy: prev.pdfCommercialSet
            ? 0
            : (systemConfig.centralSubsidy ?? preFilledData.centralSubsidy ?? (prev.centralSubsidy && prev.centralSubsidy > 0 ? prev.centralSubsidy : 78000)),
          // State subsidy can be set or preserved if it exists
          stateSubsidy: prev.pdfCommercialSet
            ? 0
            : (systemConfig.stateSubsidy ?? preFilledData.stateSubsidy ?? (prev.stateSubsidy || 0)),
          // Store the system price from the selected configuration
          systemPrice: config.price,
        }
        console.log("[ProductSelectionForm] BOTH config selected from dialog - filled all fields:", updated)
        console.log("[ProductSelectionForm] ACDB from config:", systemConfig.acdb, "DCDB from config:", systemConfig.dcdb)
        console.log("[ProductSelectionForm] System price from config:", config.price)
        return updated
      })
      setHasSelectedBothConfig(true)
    } else {
      // Fallback to basic calculation if no preset found
      const dcrKw = Number.parseFloat(config.dcrCapacity.replace("kW", ""))
      const dcrW = dcrKw * 1000
      const nonDcrKw = Number.parseFloat(config.nonDcrCapacity.replace("kW", ""))
      const nonDcrW = nonDcrKw * 1000
      // Include all common panel sizes available in the market
      const dcrBest = bestPanelConfigWithinSystemKw(dcrKw, { panelSizesToTry: COMMON_PANEL_SIZES_WATTS })
      const nonDcrBest = bestPanelConfigWithinSystemKw(nonDcrKw, { panelSizesToTry: COMMON_PANEL_SIZES_WATTS })
      const bestDcrPanelSize = dcrBest.panelSizeW
      const bestDcrQuantity = dcrBest.quantity
      const bestNonDcrPanelSize = nonDcrBest.panelSizeW
      const bestNonDcrQuantity = nonDcrBest.quantity
      
      let panelBrand = "Adani"
      if (config.panelType === "Tata") panelBrand = "Tata"
      else if (config.panelType === "Waaree") panelBrand = "Waaree"
      
      const bothPhase: "1-Phase" | "3-Phase" =
        config.phase === "1-Phase" || config.phase === "3-Phase" ? config.phase : "3-Phase"
      const defaultAcdb = formatACDBOption("Havells", bothPhase)
      const defaultDcdb = formatDCDBOption("Havells", bothPhase)
      
      setFormData((prev) => ({
        ...prev,
        phase: bothPhase,
        dcrPanelBrand: panelBrand,
        dcrPanelSize: `${bestDcrPanelSize}W`,
        dcrPanelQuantity: bestDcrQuantity,
        nonDcrPanelBrand: panelBrand,
        nonDcrPanelSize: `${bestNonDcrPanelSize}W`,
        nonDcrPanelQuantity: bestNonDcrQuantity,
        inverterType: "String Inverter",
        inverterBrand: "Polycab",
        inverterSize: config.inverterSize,
        acdb: defaultAcdb,
        dcdb: defaultDcdb,
        // DCR systems require central subsidy (mandatory: 78000) — except commercial (always 0)
        centralSubsidy: prev.pdfCommercialSet
          ? 0
          : (prev.centralSubsidy && prev.centralSubsidy > 0 ? prev.centralSubsidy : 78000),
        stateSubsidy: prev.pdfCommercialSet ? 0 : (prev.stateSubsidy || 0),
      }))
      setHasSelectedBothConfig(true)
    }
  }

  // Handle NON DCR configuration selection from Browse dialog
  const handleNonDcrConfigSelect = (config: SystemPricing) => {
    // Find matching system configuration preset that includes all component details
    const systemConfig = getSystemConfiguration(
      "non-dcr",
      config.systemSize,
      config.panelType,
      pricingTables || undefined,
      config.phase === "1-Phase" || config.phase === "3-Phase" ? config.phase : undefined,
    )
    
    if (systemConfig) {
      // Use the full system configuration preset to fill all fields
      const preFilledData = configToProductSelection(systemConfig)
      const panelSizeToSet = getClosestPanelSizeFromList(systemConfig.panelSize || preFilledData.panelSize || "")
      const effPhase: "1-Phase" | "3-Phase" =
        config.phase === "1-Phase" || config.phase === "3-Phase"
          ? config.phase
          : systemConfig.phase === "1-Phase" || systemConfig.phase === "3-Phase"
            ? systemConfig.phase
            : "1-Phase"
      const { acdb: acdbForPhase, dcdb: dcdbForPhase } = acdbDcdbLabelsForPhase(
        effPhase,
        systemConfig.acdb || preFilledData.acdb,
        systemConfig.dcdb || preFilledData.dcdb,
      )

      setFormData((prev) => {
        const updated = {
          ...prev,
          ...preFilledData,
          phase: effPhase,
          panelSize: panelSizeToSet,
          acdb: acdbForPhase,
          dcdb: dcdbForPhase,
          // NON-DCR systems should always have 0 subsidies
          centralSubsidy: 0,
          stateSubsidy: 0,
          // Store the system price from the selected configuration
          systemPrice: config.price,
        }
        console.log("[ProductSelectionForm] NON DCR config selected from dialog - filled all fields:", updated)
        console.log("[ProductSelectionForm] ACDB from config:", systemConfig.acdb, "DCDB from config:", systemConfig.dcdb)
        console.log("[ProductSelectionForm] System price from config:", config.price)
        return updated
      })
      setHasSelectedNonDcrConfig(true)
    } else {
      // Fallback to basic calculation if no preset found
      const systemKw = Number.parseFloat(config.systemSize.replace("kW", ""))
      const panelBrand = config.panelType === "Tata" ? "Tata" : config.panelType === "Waaree" ? "Waaree" : "Adani"
      const nonDcrBest = bestPanelConfigWithinSystemKw(systemKw, {
        panelSizesToTry: COMMON_PANEL_SIZES_WATTS,
        preferredPanelSize: config.panelType,
      })

      const systemSizeForPhase = `${systemKw}kW`
      const fallbackPhase = determinePhase(systemSizeForPhase, config.inverterSize, pricingTables || undefined)
      const defaultAcdb = formatACDBOption("Havells", fallbackPhase)
      const defaultDcdb = formatDCDBOption("Havells", fallbackPhase)
      
      setFormData((prev) => ({
        ...prev,
        phase: fallbackPhase,
        panelBrand,
        panelSize: `${nonDcrBest.panelSizeW}W`,
        panelQuantity: nonDcrBest.quantity,
        inverterType: "String Inverter",
        inverterBrand: "Polycab",
        inverterSize: config.inverterSize,
        acdb: defaultAcdb,
        dcdb: defaultDcdb,
        // NON-DCR systems should always have 0 subsidies
        centralSubsidy: 0,
        stateSubsidy: 0,
      }))
      setHasSelectedNonDcrConfig(true)
    }
  }

  // Handle DCR configuration selection from Browse dialog
  const handleDcrConfigSelect = (config: SystemPricing) => {
    // Validate config price before proceeding
    if (!config.price || config.price <= 0) {
      console.error("[ProductSelectionForm] Invalid config price:", config.price)
      setError(`Invalid configuration price: ${config.price}. Please select a valid configuration.`)
      return
    }

    // Find matching system configuration preset that includes all component details
    const packagePhase =
      config.phase === "1-Phase" || config.phase === "3-Phase" ? config.phase : undefined

    const panelPackage = dcrPanelPackageForPricingRow(config)
    const { pricingPanelType, panelBrand: selectedPanelBrand, panelSize: panelSizeToSet, panelQuantity: panelQuantityToSet } =
      panelPackage
    const isTataPackage = pricingPanelType === "Tata"
    const isInaPackage = pricingPanelType === "INA"
    const inaMarkers = isInaPackage ? { panelType: "INA" as const, inaDcrPackage: true as const } : {}

    const systemConfig = getSystemConfiguration(
      "dcr",
      config.systemSize,
      config.panelType,
      pricingTables || undefined,
      packagePhase,
    )

    if (systemConfig) {
      // Use the full system configuration preset to fill all fields
      const preFilledData = configToProductSelection(systemConfig)
      const inverterBrandToSet = isTataPackage
        ? DCR_AS_PER_THE_SET
        : systemConfig.inverterBrand || preFilledData.inverterBrand || "Vsole/Xwatt"
      const inverterSizeToSet = isTataPackage
        ? DCR_AS_PER_THE_SET
        : config.inverterSize || systemConfig.inverterSize || preFilledData.inverterSize || ""

      const effPhase: "1-Phase" | "3-Phase" =
        packagePhase ||
        (systemConfig.phase === "1-Phase" || systemConfig.phase === "3-Phase"
          ? systemConfig.phase
          : "1-Phase")
      const { acdb: acdbForPhase, dcdb: dcdbForPhase } = acdbDcdbLabelsForPhase(
        effPhase,
        systemConfig.acdb || preFilledData.acdb,
        systemConfig.dcdb || preFilledData.dcdb,
      )
      const pdfRangeKey = isTataPackage
        ? TATA_DCR_PANEL_RANGE_KEY
        : (defaultPdfPanelRangeKeyForDcrPricingType(pricingPanelType) ??
          defaultPdfPanelRangeKeyForPanelBrand(selectedPanelBrand) ??
          "")

      setFormData((prev) => {
        const updated = {
          ...prev,
          ...preFilledData,
          ...inaMarkers,
          phase: effPhase,
          inverterBrand: inverterBrandToSet,
          inverterSize: inverterSizeToSet,
          // Keep DCR-specific fields in sync with selected configuration brand/size
          dcrPanelBrand: selectedPanelBrand,
          dcrPanelSize: panelSizeToSet,
          dcrPanelQuantity: panelQuantityToSet,
          // Preserve legacy panel fields for downstream calculations that still reference them
          panelBrand: selectedPanelBrand,
          panelSize: panelSizeToSet,
          panelQuantity: panelQuantityToSet,
          acdb: acdbForPhase,
          dcdb: dcdbForPhase,
          // Set subsidies from config (DCR default 78000) — commercial set always 0
          centralSubsidy: prev.pdfCommercialSet
            ? 0
            : (systemConfig.centralSubsidy ?? preFilledData.centralSubsidy ?? (systemConfig.systemType === "dcr" ? 78000 : (prev.centralSubsidy || 0))),
          stateSubsidy: prev.pdfCommercialSet
            ? 0
            : (systemConfig.stateSubsidy ?? preFilledData.stateSubsidy ?? (prev.stateSubsidy || 0)),
          // Store the system price from the selected configuration - CRITICAL: must be > 0
          systemPrice: config.price,
          pdfPanelRangeKey: pdfRangeKey,
          pdfUsePanelSizeRange: Boolean(pdfRangeKey),
        } satisfies ProductSelection
        console.log("[ProductSelectionForm] DCR config selected from dialog - filled all fields:", updated)
        console.log("[ProductSelectionForm] ACDB from config:", systemConfig.acdb, "DCDB from config:", systemConfig.dcdb)
        console.log("[ProductSelectionForm] System price from config:", config.price)
        
        // Validate systemPrice was set correctly
        if (!updated.systemPrice || updated.systemPrice <= 0) {
          console.error("[ProductSelectionForm] ERROR: systemPrice is invalid after setting:", updated.systemPrice)
          setError(`Failed to set system price. Please try selecting the configuration again.`)
        }
        return updated
      })
      setHasSelectedDcrConfig(true)
    } else {
      const fallbackPhase: "1-Phase" | "3-Phase" =
        config.phase === "1-Phase" || config.phase === "3-Phase"
          ? config.phase
          : determinePhase(config.systemSize, config.inverterSize, pricingTables || undefined)
      const { acdb: defaultAcdb, dcdb: defaultDcdb } = acdbDcdbLabelsForPhase(fallbackPhase)
      const pdfRangeKey = isTataPackage
        ? TATA_DCR_PANEL_RANGE_KEY
        : (defaultPdfPanelRangeKeyForDcrPricingType(pricingPanelType) ??
          defaultPdfPanelRangeKeyForPanelBrand(selectedPanelBrand) ??
          "")

      setFormData((prev) => ({
        ...prev,
        ...inaMarkers,
        phase: fallbackPhase,
        dcrPanelBrand: selectedPanelBrand,
        dcrPanelSize: panelSizeToSet,
        dcrPanelQuantity: panelQuantityToSet,
        panelBrand: selectedPanelBrand,
        panelSize: panelSizeToSet,
        panelQuantity: panelQuantityToSet,
        inverterType: "String Inverter",
        inverterBrand: isTataPackage ? DCR_AS_PER_THE_SET : "Vsole/Xwatt",
        inverterSize: isTataPackage ? DCR_AS_PER_THE_SET : config.inverterSize,
        structureType: "GI Structure",
        structureSize: config.systemSize,
        acdb: defaultAcdb,
        dcdb: defaultDcdb,
        systemPrice: config.price,
        centralSubsidy: prev.pdfCommercialSet
          ? 0
          : (prev.centralSubsidy && prev.centralSubsidy > 0 ? prev.centralSubsidy : 78000),
        stateSubsidy: prev.pdfCommercialSet ? 0 : (prev.stateSubsidy || 0),
        pdfPanelRangeKey: pdfRangeKey,
        pdfUsePanelSizeRange: Boolean(pdfRangeKey),
      }))
      setHasSelectedDcrConfig(true)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!effectiveSystemType) {
      setError("Please select a system type")
      return
    }

    if (effectiveSystemType === "both") {
      if (
        !isPanelRowComplete(
          formData.dcrPanelBrand || "",
          formData.dcrPanelSize || "",
          formData.dcrPanelQuantity || 0,
          formData.pdfDcrPanelRangeKey,
        )
      ) {
        setError("Please complete DCR panel selection")
        return
      }
      if (
        !isPanelRowComplete(
          formData.nonDcrPanelBrand || "",
          formData.nonDcrPanelSize || "",
          formData.nonDcrPanelQuantity || 0,
          formData.pdfNonDcrPanelRangeKey,
        )
      ) {
        setError("Please complete Non-DCR panel selection")
        return
      }
      if (!formData.inverterType || !isInverterInfoComplete(formData.inverterBrand, formData.inverterSize)) {
        setError("Please complete inverter selection")
        return
      }
      // Validate other required fields for BOTH system
      if (!formData.structureType || !formData.structureSize) {
        setError("Please complete structure selection")
        return
      }
      if (!formData.meterBrand) {
        setError("Please select a meter brand")
        return
      }
      if (!formData.acCableBrand || !formData.acCableSize || !formData.dcCableBrand || !formData.dcCableSize) {
        setError("Please complete cable selection")
        return
      }
      if (!formData.acdb || !formData.dcdb) {
        setError("Please select ACDB and DCDB")
        return
      }
    } else if (effectiveSystemType !== "customize") {
      if (
        !isPanelRowComplete(
          formData.panelBrand || "",
          formData.panelSize || "",
          formData.panelQuantity || 0,
          formData.pdfPanelRangeKey,
        )
      ) {
        setError("Please complete panel selection")
        return
      }
      if (!formData.inverterType || !isInverterInfoComplete(formData.inverterBrand, formData.inverterSize)) {
        setError("Please complete inverter selection")
        return
      }
      // Validate other required fields for DCR/NON DCR systems
      if (!formData.structureType || !formData.structureSize) {
        setError("Please complete structure selection")
        return
      }
      if (!formData.meterBrand) {
        setError("Please select a meter brand")
        return
      }
      if (!formData.acCableBrand || !formData.acCableSize || !formData.dcCableBrand || !formData.dcCableSize) {
        setError("Please complete cable selection")
        return
      }
      if (!formData.acdb || !formData.dcdb) {
        setError("Please select ACDB and DCDB")
        return
      }
    }

    // CUSTOMIZE option commented out - validation removed
    // if (formData.systemType === "customize" && (!formData.customPanels || formData.customPanels.length === 0)) {
    //   setError("Please add at least one panel configuration for custom setup")
    //   return
    // }
    
    // Ensure system type is not customize (should not be possible, but double-check)
    if (effectiveSystemType === "customize") {
      setError("Customize option is not available. Please select a pre-configured system.")
      return
    }

    if (
      effectiveSystemType !== "customize" &&
      (!Number.isFinite(Number(formData.systemPrice)) || Number(formData.systemPrice) <= 0)
    ) {
      setError("Please select a pricing table configuration so system price is set correctly.")
      return
    }

    // Validate subsidies: DCR and BOTH require central subsidy (not for commercial PDF set)
    if (
      !formData.pdfCommercialSet &&
      (effectiveSystemType === "dcr" || effectiveSystemType === "both")
    ) {
      if (!formData.centralSubsidy || formData.centralSubsidy <= 0) {
        setError("Central subsidy is mandatory for DCR and BOTH systems. Please set a valid central subsidy amount.")
        return
      }
    }

    const normalizedProducts = backfillPanelQuantityForPdfRange(
      restoreDcrPackageDisplayForForm({
        ...formData,
        systemType: effectiveSystemType,
        phase: formData.phase || currentPhase,
        stateSubsidy: formData.pdfCommercialSet ? 0 : Number(formData.stateSubsidy) || 0,
        centralSubsidy: formData.pdfCommercialSet ? 0 : Number(formData.centralSubsidy) || 0,
      }),
    )

    setFormData(normalizedProducts)
    onSubmit(normalizedProducts)
  }

  const showDcrFields = effectiveSystemType === "dcr"
  const showBothFields = effectiveSystemType === "both"
  const showCustomizeFields = formData.systemType === "customize"
  const showStandardFields =
    effectiveSystemType && !showCustomizeFields && !showBothFields
  const hasSelectedStandardConfig =
    (effectiveSystemType === "non-dcr" && hasSelectedNonDcrConfig) ||
    (effectiveSystemType === "dcr" && hasSelectedDcrConfig)
  /** Commercial PDF set: hide subsidy inputs (also omit from proposal PDF). */
  const showSubsidyFields = !Boolean(formData.pdfCommercialSet)

  // Auto-select Havells (1-Phase) / Havells (3-Phase) when package phase is known
  useEffect(() => {
    if (!hasSelectedStandardConfig && !showBothFields) return

    const phase: "1-Phase" | "3-Phase" =
      formData.phase === "1-Phase" || formData.phase === "3-Phase" ? formData.phase : currentPhase
    const defaults = defaultAcdbDcdbForPhase(phase)

    setFormData((prev) => {
      const updates: Partial<ProductSelection> = {}
      if (prev.phase !== phase) updates.phase = phase
      if (!prev.acdb?.trim()) updates.acdb = defaults.acdb
      if (!prev.dcdb?.trim()) updates.dcdb = defaults.dcdb
      if (Object.keys(updates).length === 0) return prev
      return { ...prev, ...updates }
    })
  }, [
    hasSelectedStandardConfig,
    showBothFields,
    currentPhase,
    formData.phase,
    formData.acdb,
    formData.dcdb,
  ])

  const showBatteryFields = formData.inverterType === "Hybrid Inverter"

  return (
    <div>
    <Card className="border-0 shadow-xl">
      <CardHeader className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-t-lg">
        <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
          <Sun className="w-5 h-5 text-primary" />
          Product Selection
        </CardTitle>
        <CardDescription className="text-sm">Configure the solar system components for this quotation</CardDescription>
      </CardHeader>
      <CardContent className="pt-4 sm:pt-6">
        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
              {error}
            </div>
          )}

          <div className="space-y-3">
            <Label className="text-sm font-medium">System type *</Label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {SYSTEM_TYPE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleSystemTypeChange(option.value)}
                  className={cn(
                    "rounded-lg border p-4 text-left transition-colors",
                    effectiveSystemType === option.value
                      ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                      : "border-border hover:border-primary/40",
                  )}
                >
                  <p className="font-medium text-foreground">{option.label}</p>
                  <p className="text-xs text-muted-foreground mt-1">{option.description}</p>
                </button>
              ))}
            </div>
          </div>

          {showBothFields && (
            <>
              {/* BOTH Configuration Selector */}
              <div className="border-t border-border pt-4 sm:pt-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-4">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                      <List className="w-4 h-4 text-purple-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-medium break-words">BOTH (DCR + NON DCR) Configuration</h3>
                      <p className="text-xs text-muted-foreground">Select a pre-configured BOTH system</p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setBothConfigDialogOpen(true)}
                    className="flex items-center justify-center gap-2 w-full sm:w-auto"
                  >
                    <List className="w-4 h-4" />
                    <span className="hidden sm:inline">Browse BOTH Configurations</span>
                    <span className="sm:hidden">Browse Configurations</span>
                  </Button>
                </div>
                {/* Quick Select dropdown removed - use Browse button to select configuration */}
              </div>

              {/* DCR Panel, Non-DCR Panel, Inverter - visible only after Browse BOTH selection */}
              {hasSelectedBothConfig && (
              <>
              {/* DCR Panel Selection */}
              <div className="border-t border-border pt-4 sm:pt-6">
                <div className="flex flex-wrap items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                    <Sun className="w-4 h-4 text-green-600" />
                  </div>
                  <h3 className="text-sm font-medium">DCR Panel Configuration</h3>
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full whitespace-nowrap">With Subsidy</span>
                  {(() => {
                    const panelW = formData.dcrPanelSize ? Number.parseFloat(formData.dcrPanelSize.replace("W", "")) : 0
                    const quantity = formData.dcrPanelQuantity || 0
                    const totalW = panelW * quantity
                    return totalW > 0 ? (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium whitespace-nowrap">
                        Total: {totalW.toLocaleString()}W
                      </span>
                    ) : null
                  })()}
                </div>
                <div
                  className={`grid grid-cols-1 gap-3 sm:gap-4 p-3 sm:p-4 bg-green-50/50 rounded-lg border border-green-100 ${hideDcrPanelQty ? "sm:grid-cols-2" : "sm:grid-cols-3"}`}
                >
                  <div>
                    <Label>DCR Panel Brand *</Label>
                    <Select value={formData.dcrPanelBrand} onValueChange={(v) => updatePanelBrand("dcrPanelBrand", v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select brand" />
                      </SelectTrigger>
                      <SelectContent>
                        {panelBrandsList.map((brand) => (
                          <SelectItem key={brand} value={brand}>
                            {brand}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>DCR Panel Size *</Label>
                    <Input
                      value={formData.dcrPanelSize || ""}
                      onChange={(e) => updatePanelSizeWithAutoQuantity("dcrPanelSize", e.target.value)}
                      placeholder={`e.g., ${panelSizesList.join(", ")}`}
                    />
                  </div>
                  {!hideDcrPanelQty && (
                    <div>
                      <Label>DCR Panel Quantity *</Label>
                      <Input
                        type="number"
                        min="1"
                        value={formData.dcrPanelQuantity || ""}
                        onChange={(e) => updateFormData("dcrPanelQuantity", Number.parseInt(e.target.value) || 0)}
                        placeholder="Enter quantity"
                      />
                      {(() => {
                        const panelW = formData.dcrPanelSize
                          ? Number.parseFloat(formData.dcrPanelSize.replace("W", ""))
                          : 0
                        const quantity = formData.dcrPanelQuantity || 0
                        const totalW = panelW * quantity
                        return totalW > 0 ? (
                          <p className="text-xs text-muted-foreground mt-1 font-medium">
                            Total: {totalW.toLocaleString()}W
                          </p>
                        ) : null
                      })()}
                    </div>
                  )}
                </div>
                <PanelPdfRangeOptions
                  panelBrand={formData.dcrPanelBrand || ""}
                  selectedKey={formData.pdfDcrPanelRangeKey}
                  onChange={(key) => updatePdfPanelRangeKey("pdfDcrPanelRangeKey", key)}
                />
                <CommercialPdfOptions
                  checked={Boolean(formData.pdfCommercialSet)}
                  onChange={(checked) => {
                    setFormData((prev) => ({
                      ...prev,
                      pdfCommercialSet: checked,
                      ...(checked ? { centralSubsidy: 0, stateSubsidy: 0 } : {}),
                    }))
                    setError("")
                  }}
                />
              </div>

              {/* Non-DCR Panel Selection */}
              <div className="border-t border-border pt-4 sm:pt-6">
                <div className="flex flex-wrap items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <Sun className="w-4 h-4 text-blue-600" />
                  </div>
                  <h3 className="text-sm font-medium">Non-DCR Panel Configuration</h3>
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full whitespace-nowrap">Without Subsidy</span>
                  {(() => {
                    const panelW = formData.nonDcrPanelSize ? Number.parseFloat(formData.nonDcrPanelSize.replace("W", "")) : 0
                    const quantity = formData.nonDcrPanelQuantity || 0
                    const totalW = panelW * quantity
                    return totalW > 0 ? (
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium whitespace-nowrap">
                        Total: {totalW.toLocaleString()}W
                      </span>
                    ) : null
                  })()}
                </div>
                <div
                  className={`grid grid-cols-1 gap-3 sm:gap-4 p-3 sm:p-4 bg-blue-50/50 rounded-lg border border-blue-100 ${hideNonDcrPanelQty ? "sm:grid-cols-2" : "sm:grid-cols-3"}`}
                >
                  <div>
                    <Label>Non-DCR Panel Brand *</Label>
                    <Select
                      value={formData.nonDcrPanelBrand}
                      onValueChange={(v) => updatePanelBrand("nonDcrPanelBrand", v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select brand" />
                      </SelectTrigger>
                      <SelectContent>
                        {panelBrandsList.map((brand) => (
                          <SelectItem key={brand} value={brand}>
                            {brand}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Non-DCR Panel Size *</Label>
                      <Input
                        value={formData.nonDcrPanelSize || ""}
                        onChange={(e) => updatePanelSizeWithAutoQuantity("nonDcrPanelSize", e.target.value)}
                        placeholder={`e.g., ${panelSizesList.join(", ")}`}
                      />
                  </div>
                  {!hideNonDcrPanelQty && (
                    <div>
                      <Label>Non-DCR Panel Quantity *</Label>
                      <Input
                        type="number"
                        min="1"
                        value={formData.nonDcrPanelQuantity || ""}
                        onChange={(e) =>
                          updateFormData("nonDcrPanelQuantity", Number.parseInt(e.target.value) || 0)
                        }
                        placeholder="Enter quantity"
                      />
                      {(() => {
                        const panelW = formData.nonDcrPanelSize
                          ? Number.parseFloat(formData.nonDcrPanelSize.replace("W", ""))
                          : 0
                        const quantity = formData.nonDcrPanelQuantity || 0
                        const totalW = panelW * quantity
                        return totalW > 0 ? (
                          <p className="text-xs text-muted-foreground mt-1 font-medium">
                            Total: {totalW.toLocaleString()}W
                          </p>
                        ) : null
                      })()}
                    </div>
                  )}
                </div>
                <PanelPdfRangeOptions
                  panelBrand={formData.nonDcrPanelBrand || ""}
                  selectedKey={formData.pdfNonDcrPanelRangeKey}
                  onChange={(key) => updatePdfPanelRangeKey("pdfNonDcrPanelRangeKey", key)}
                />
              </div>

              {/* Inverter Selection for Both */}
              <div className="border-t border-border pt-4 sm:pt-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Zap className="w-4 h-4 text-primary" />
                  </div>
                  <h3 className="text-sm font-medium">Inverter Configuration</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                  <div>
                    <Label>Inverter Type *</Label>
                    <Select value={formData.inverterType} onValueChange={(v) => updateFormData("inverterType", v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        {inverterTypesList.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Inverter Brand *</Label>
                    <Select value={formData.inverterBrand} onValueChange={(v) => updateFormData("inverterBrand", v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select brand" />
                      </SelectTrigger>
                      <SelectContent>
                        {inverterBrandsList.map((brand) => (
                          <SelectItem key={brand} value={brand}>
                            {brand}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Inverter Size *</Label>
                    <Input
                      value={formData.inverterSize || ""}
                      onChange={(e) => updateFormData("inverterSize", e.target.value)}
                      placeholder={`e.g., ${inverterSizesList.join(", ")}`}
                    />
                  </div>
                  <div>
                    <Label>Electrical phase *</Label>
                    <Select
                      value={
                        formData.phase === "1-Phase" || formData.phase === "3-Phase"
                          ? formData.phase
                          : "3-Phase"
                      }
                      onValueChange={(v) => {
                        const p = v as "1-Phase" | "3-Phase"
                        setFormData((prev) => {
                          const swap = (s: string | undefined) =>
                            s ? s.replace(/\((1-Phase|3-Phase)\)/, `(${p})`) : s
                          return {
                            ...prev,
                            phase: p,
                            acdb: swap(prev.acdb) || formatACDBOption("Havells", p),
                            dcdb: swap(prev.dcdb) || formatDCDBOption("Havells", p),
                          }
                        })
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select phase" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1-Phase">Single phase (1-Phase)</SelectItem>
                        <SelectItem value="3-Phase">Three phase (3-Phase)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Structure Selection for Both */}
              <div className="border-t border-border pt-4 sm:pt-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Box className="w-4 h-4 text-primary" />
                  </div>
                  <h3 className="text-sm font-medium">Structure Configuration</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <Label>Structure Type</Label>
                    <Select value={formData.structureType} onValueChange={(v) => updateFormData("structureType", v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        {structureTypesList.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Structure Size</Label>
                    <Input
                      value={formData.structureSize || ""}
                      onChange={(e) => updateFormData("structureSize", e.target.value)}
                      placeholder={`e.g., ${structureSizesList.join(", ")}`}
                    />
                  </div>
                </div>
              </div>
              </>
              )}

              {/* Meter & Cables for Both */}
              {hasSelectedBothConfig && (
              <>
              <div className="border-t border-border pt-4 sm:pt-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Cable className="w-4 h-4 text-primary" />
                  </div>
                  <h3 className="text-sm font-medium">Meter & Cables</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                  <div>
                    <Label>Meter Brand</Label>
                    <Select value={formData.meterBrand} onValueChange={(v) => updateFormData("meterBrand", v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select brand" />
                      </SelectTrigger>
                      <SelectContent>
                        {meterBrandsList.map((brand) => (
                          <SelectItem key={brand} value={brand}>
                            {brand}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>AC Cable Brand</Label>
                    <Select value={formData.acCableBrand} onValueChange={(v) => updateFormData("acCableBrand", v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select brand" />
                      </SelectTrigger>
                      <SelectContent>
                        {cableBrandsList.map((brand) => (
                          <SelectItem key={brand} value={brand}>
                            {brand}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>AC Cable Size</Label>
                    <Select value={formData.acCableSize} onValueChange={(v) => updateFormData("acCableSize", v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select size" />
                      </SelectTrigger>
                      <SelectContent>
                        {cableSizesList.map((size) => (
                          <SelectItem key={size} value={size}>
                            {size}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>DC Cable Brand</Label>
                    <Select value={formData.dcCableBrand} onValueChange={(v) => updateFormData("dcCableBrand", v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select brand" />
                      </SelectTrigger>
                      <SelectContent>
                        {cableBrandsList.map((brand) => (
                          <SelectItem key={brand} value={brand}>
                            {brand}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>DC Cable Size</Label>
                    <Select value={formData.dcCableSize} onValueChange={(v) => updateFormData("dcCableSize", v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select size" />
                      </SelectTrigger>
                      <SelectContent>
                        {cableSizesList.map((size) => (
                          <SelectItem key={size} value={size}>
                            {size}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* ACDB/DCDB for Both */}
              <div className="border-t border-border pt-4 sm:pt-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Gauge className="w-4 h-4 text-primary" />
                  </div>
                  <h3 className="text-sm font-medium">ACDB & DCDB</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <Label>ACDB</Label>
                    <Select value={formData.acdb || ""} onValueChange={(v) => updateFormData("acdb", v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select ACDB" />
                      </SelectTrigger>
                      <SelectContent>
                        {(() => {
                          // Include current value in options if not already present
                          const allOptions = [...new Set([...acdbOptionsList, formData.acdb].filter(Boolean))]
                          return allOptions.map((option) => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          ))
                        })()}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>DCDB</Label>
                    <Select value={formData.dcdb || ""} onValueChange={(v) => updateFormData("dcdb", v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select DCDB" />
                      </SelectTrigger>
                      <SelectContent>
                        {(() => {
                          // Include current value in options if not already present
                          const allOptions = [...new Set([...dcdbOptionsList, formData.dcdb].filter(Boolean))]
                          return allOptions.map((option) => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          ))
                        })()}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Battery Configuration for BOTH - shown when Hybrid Inverter is selected */}
              {showBatteryFields && (
                <div className="border-t border-border pt-4 sm:pt-6">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Zap className="w-4 h-4 text-primary" />
                    </div>
                    <h3 className="text-sm font-medium">Battery Configuration</h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                    <div>
                      <Label>Hybrid Inverter Model</Label>
                      <Input
                        value={formData.hybridInverter || ""}
                        onChange={(e) => updateFormData("hybridInverter", e.target.value)}
                        placeholder="Enter hybrid inverter model"
                      />
                    </div>
                    <div>
                      <Label>Battery Capacity</Label>
                      <Input
                        value={formData.batteryCapacity || ""}
                        onChange={(e) => updateFormData("batteryCapacity", e.target.value)}
                        placeholder="e.g., 5kWh, 10kWh"
                      />
                    </div>
                    <div>
                      <Label>Battery Price (₹)</Label>
                      <Input
                        type="number"
                        min="0"
                        value={formData.batteryPrice || ""}
                        onChange={(e) => updateFormData("batteryPrice", Number.parseInt(e.target.value) || 0)}
                        placeholder="Enter battery price"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Subsidy Information for Both */}
              {showSubsidyFields && (
              <div className="border-t border-border pt-4 sm:pt-6">
                <h3 className="text-sm font-medium mb-4">Subsidy Information (for DCR panels)</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <Label>Central Subsidy (₹)</Label>
                    <Input
                      type="number"
                      min="0"
                      value={formData.centralSubsidy || ""}
                      onChange={(e) => updateFormData("centralSubsidy", Number.parseInt(e.target.value) || 0)}
                      placeholder="Enter central subsidy amount"
                    />
                  </div>
                  <div>
                    <Label>State Subsidy (₹)</Label>
                    <Input
                      type="number"
                      min="0"
                      value={formData.stateSubsidy || ""}
                      onChange={(e) => updateFormData("stateSubsidy", Number.parseInt(e.target.value) || 0)}
                      placeholder="Enter state subsidy amount"
                    />
                  </div>
                </div>
              </div>
              )}
              </>)}
            </>
          )}

          {/* Standard Product Fields (for DCR, Non-DCR, Hybrid) */}
          {showStandardFields && (
            <>
              {/* DCR Configuration Selector */}
              {showDcrFields && (
                <div className="border-t border-border pt-4 sm:pt-6">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-4">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                        <List className="w-4 h-4 text-green-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-medium break-words">DCR Configuration</h3>
                        <p className="text-xs text-muted-foreground">Select a pre-configured DCR system</p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setDcrConfigDialogOpen(true)}
                      className="flex items-center justify-center gap-2 w-full sm:w-auto"
                    >
                      <List className="w-4 h-4" />
                      <span className="hidden sm:inline">Browse DCR Configurations</span>
                      <span className="sm:hidden">Browse Configurations</span>
                    </Button>
                  </div>
                  {/* Quick Select dropdown removed - use Browse button to select configuration */}
                </div>
              )}

              {/* NON DCR Configuration Selector */}
              {effectiveSystemType === "non-dcr" && (
                <div className="border-t border-border pt-4 sm:pt-6">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-4">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                        <List className="w-4 h-4 text-blue-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-medium break-words">NON DCR Configuration</h3>
                        <p className="text-xs text-muted-foreground">Select a pre-configured NON DCR system</p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setNonDcrConfigDialogOpen(true)}
                      className="flex items-center justify-center gap-2 w-full sm:w-auto"
                    >
                      <List className="w-4 h-4" />
                      <span className="hidden sm:inline">Browse NON DCR Configurations</span>
                      <span className="sm:hidden">Browse Configurations</span>
                    </Button>
                  </div>
                  {/* Quick Select dropdown removed - use Browse button to select configuration */}
                </div>
              )}

              {/* Panel Selection - visible only after Browse selection (DCR or NON DCR) */}
              {hasSelectedStandardConfig && (
              <>
              <div className="border-t border-border pt-4 sm:pt-6">
                <div className="flex flex-wrap items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Sun className="w-4 h-4 text-primary" />
                  </div>
                  <h3 className="text-sm font-medium">Panel Configuration</h3>
                  {(() => {
                    const panelW = formData.panelSize ? Number.parseFloat(formData.panelSize.replace("W", "")) : 0
                    const quantity = formData.panelQuantity || 0
                    const totalW = panelW * quantity
                    return totalW > 0 ? (
                      <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium whitespace-nowrap">
                        Total: {totalW.toLocaleString()}W
                      </span>
                    ) : null
                  })()}
                </div>
                <div
                  className={`grid grid-cols-1 gap-3 sm:gap-4 ${hidePanelQtyForSet ? "sm:grid-cols-2" : "sm:grid-cols-3"}`}
                >
                  <div>
                    <Label>Panel Brand *</Label>
                    <Select value={formData.panelBrand} onValueChange={(v) => updatePanelBrand("panelBrand", v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select brand" />
                      </SelectTrigger>
                      <SelectContent>
                        {panelBrandsList.map((brand) => (
                          <SelectItem key={brand} value={brand}>
                            {brand}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Panel Size *</Label>
                    {dcrPackageAsPerSet ? (
                      <>
                        <Input
                          readOnly
                          disabled
                          className="bg-muted"
                          value={tataDcrPanelRangeLabel ?? QUOTATION_AS_PER_THE_SET_LABEL}
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          {tataDcrPanelRangeLabel
                            ? "Panel watt range for the selected Tata DCR package"
                            : "Varies with the selected DCR package set"}
                        </p>
                      </>
                    ) : (
                      <Input
                        value={formData.panelSize || ""}
                        onChange={(e) => updatePanelSizeWithAutoQuantity("panelSize", e.target.value)}
                        placeholder={`e.g., ${panelSizesList.join(", ")}`}
                      />
                    )}
                  </div>
                  {!hidePanelQtyForSet && (
                    <div>
                      <Label>Panel Quantity *</Label>
                      <Input
                        type="number"
                        min="1"
                        value={formData.panelQuantity || ""}
                        onChange={(e) => {
                          const text = e.target.value
                          // Allow clearing the field so the dealer can type a new quantity (e.g. 8).
                          if (text.trim() === "") {
                            setFormData((prev) => ({
                              ...prev,
                              panelQuantity: 0,
                              ...(prev.systemType === "dcr" ? { dcrPanelQuantity: 0 } : {}),
                            }))
                            setError("")
                            return
                          }
                          const raw = Number.parseInt(text, 10)
                          if (Number.isNaN(raw) || raw < 0) return
                          const nominalKw = Number.parseFloat(
                            String(formData.structureSize || formData.inverterSize || "").replace(/kW/i, ""),
                          )
                          const qty =
                            nominalKw > 0 && formData.panelSize && raw > 0
                              ? clampPanelQuantityToNominalSystemKw(nominalKw, formData.panelSize, raw)
                              : raw
                          setFormData((prev) => ({
                            ...prev,
                            panelQuantity: qty,
                            ...(prev.systemType === "dcr" ? { dcrPanelQuantity: qty } : {}),
                          }))
                          setError("")
                        }}
                        placeholder="Enter quantity"
                      />
                      {(() => {
                        const panelW = formData.panelSize ? parsePanelSizeWatts(formData.panelSize) : 0
                        const quantity = formData.panelQuantity || 0
                        const totalW = panelW * quantity
                        const nominalKw = Number.parseFloat(
                          String(formData.inverterSize || formData.structureSize || "").replace(/kW/i, ""),
                        )
                        const maxW = nominalKw > 0 ? maxAllowedWattsForNominalSystemKw(nominalKw) : 0
                        const overMax = maxW > 0 && totalW > maxW
                        return totalW > 0 ? (
                          <p
                            className={`text-xs mt-1 font-medium ${overMax ? "text-destructive" : "text-muted-foreground"}`}
                          >
                            Total: {totalW.toLocaleString()}W
                            {maxW > 0 ? ` (max ${maxW.toLocaleString()}W for ${nominalKw}kW package)` : ""}
                          </p>
                        ) : null
                      })()}
                    </div>
                  )}
                </div>
                <PanelPdfRangeOptions
                  panelBrand={formData.panelBrand || ""}
                  selectedKey={formData.pdfPanelRangeKey}
                  onChange={(key) => updatePdfPanelRangeKey("pdfPanelRangeKey", key)}
                />
                <CommercialPdfOptions
                  checked={Boolean(formData.pdfCommercialSet)}
                  onChange={(checked) => {
                    setFormData((prev) => ({
                      ...prev,
                      pdfCommercialSet: checked,
                      ...(checked ? { centralSubsidy: 0, stateSubsidy: 0 } : {}),
                    }))
                    setError("")
                  }}
                />
              </div>

              {/* Inverter Selection */}
              <div className="border-t border-border pt-4 sm:pt-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Zap className="w-4 h-4 text-primary" />
                  </div>
                  <h3 className="text-sm font-medium">Inverter Configuration</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                  <div>
                    <Label>Inverter Type *</Label>
                    <Select value={formData.inverterType} onValueChange={(v) => updateFormData("inverterType", v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        {inverterTypesList.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Inverter Brand *</Label>
                    {dcrPackageAsPerSet ? (
                      <>
                        <Input
                          readOnly
                          disabled
                          className="bg-muted"
                          value={QUOTATION_AS_PER_THE_SET_LABEL}
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Varies with the selected DCR package set
                        </p>
                      </>
                    ) : (
                      <Select
                        value={formData.inverterBrand || "Vsole/Xwatt"}
                        onValueChange={(v) => updateFormData("inverterBrand", v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select brand" />
                        </SelectTrigger>
                        <SelectContent>
                          {inverterBrandsList.map((brand) => (
                            <SelectItem key={brand} value={brand}>
                              {brand}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                  <div>
                    <Label>Inverter Size *</Label>
                    {dcrPackageAsPerSet ? (
                      <>
                        <Input
                          readOnly
                          disabled
                          className="bg-muted"
                          value={QUOTATION_AS_PER_THE_SET_LABEL}
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Varies with the selected DCR package set
                        </p>
                      </>
                    ) : (
                      <Input
                        value={formData.inverterSize || ""}
                        onChange={(e) => updateFormData("inverterSize", e.target.value)}
                        placeholder={`e.g., ${inverterSizesList.join(", ")}`}
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* Structure Selection */}
              <div className="border-t border-border pt-4 sm:pt-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Box className="w-4 h-4 text-primary" />
                  </div>
                  <h3 className="text-sm font-medium">Structure Configuration</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <Label>Structure Type</Label>
                    <Select value={formData.structureType} onValueChange={(v) => updateFormData("structureType", v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        {structureTypesList.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Structure Size</Label>
                    <Input
                      value={formData.structureSize || ""}
                      onChange={(e) => updateFormData("structureSize", e.target.value)}
                      placeholder={`e.g., ${structureSizesList.join(", ")}`}
                    />
                  </div>
                </div>
              </div>
              </>
              )}

              {/* Meter & Cables */}
              {hasSelectedStandardConfig && (
              <>
              <div className="border-t border-border pt-4 sm:pt-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Cable className="w-4 h-4 text-primary" />
                  </div>
                  <h3 className="text-sm font-medium">Meter & Cables</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                  <div>
                    <Label>Meter Brand</Label>
                    <Select value={formData.meterBrand} onValueChange={(v) => updateFormData("meterBrand", v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select brand" />
                      </SelectTrigger>
                      <SelectContent>
                        {meterBrandsList.map((brand) => (
                          <SelectItem key={brand} value={brand}>
                            {brand}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>AC Cable Brand</Label>
                    <Select value={formData.acCableBrand} onValueChange={(v) => updateFormData("acCableBrand", v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select brand" />
                      </SelectTrigger>
                      <SelectContent>
                        {cableBrandsList.map((brand) => (
                          <SelectItem key={brand} value={brand}>
                            {brand}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>AC Cable Size</Label>
                    <Select value={formData.acCableSize} onValueChange={(v) => updateFormData("acCableSize", v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select size" />
                      </SelectTrigger>
                      <SelectContent>
                        {cableSizesList.map((size) => (
                          <SelectItem key={size} value={size}>
                            {size}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>DC Cable Brand</Label>
                    <Select value={formData.dcCableBrand} onValueChange={(v) => updateFormData("dcCableBrand", v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select brand" />
                      </SelectTrigger>
                      <SelectContent>
                        {cableBrandsList.map((brand) => (
                          <SelectItem key={brand} value={brand}>
                            {brand}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>DC Cable Size</Label>
                    <Select value={formData.dcCableSize} onValueChange={(v) => updateFormData("dcCableSize", v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select size" />
                      </SelectTrigger>
                      <SelectContent>
                        {cableSizesList.map((size) => (
                          <SelectItem key={size} value={size}>
                            {size}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* ACDB/DCDB */}
              <div className="border-t border-border pt-4 sm:pt-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Gauge className="w-4 h-4 text-primary" />
                  </div>
                  <h3 className="text-sm font-medium">ACDB & DCDB</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <Label>ACDB</Label>
                    <Select value={formData.acdb || ""} onValueChange={(v) => updateFormData("acdb", v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select ACDB" />
                      </SelectTrigger>
                      <SelectContent>
                        {(() => {
                          // Include current value in options if not already present
                          const allOptions = [...new Set([...acdbOptionsList, formData.acdb].filter(Boolean))]
                          return allOptions.map((option) => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          ))
                        })()}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>DCDB</Label>
                    <Select value={formData.dcdb || ""} onValueChange={(v) => updateFormData("dcdb", v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select DCDB" />
                      </SelectTrigger>
                      <SelectContent>
                        {(() => {
                          // Include current value in options if not already present
                          const allOptions = [...new Set([...dcdbOptionsList, formData.dcdb].filter(Boolean))]
                          return allOptions.map((option) => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          ))
                        })()}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Battery Configuration for DCR/NON DCR - shown when Hybrid Inverter is selected */}
              {showBatteryFields && (
                <div className="border-t border-border pt-4 sm:pt-6">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Zap className="w-4 h-4 text-primary" />
                    </div>
                    <h3 className="text-sm font-medium">Battery Configuration</h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                    <div>
                      <Label>Hybrid Inverter Model</Label>
                      <Input
                        value={formData.hybridInverter || ""}
                        onChange={(e) => updateFormData("hybridInverter", e.target.value)}
                        placeholder="Enter hybrid inverter model"
                      />
                    </div>
                    <div>
                      <Label>Battery Capacity</Label>
                      <Input
                        value={formData.batteryCapacity || ""}
                        onChange={(e) => updateFormData("batteryCapacity", e.target.value)}
                        placeholder="e.g., 5kWh, 10kWh"
                      />
                    </div>
                    <div>
                      <Label>Battery Price (₹)</Label>
                      <Input
                        type="number"
                        min="0"
                        value={formData.batteryPrice || ""}
                        onChange={(e) => updateFormData("batteryPrice", Number.parseInt(e.target.value) || 0)}
                        placeholder="Enter battery price"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* DCR Specific Fields */}
              {showDcrFields && showSubsidyFields && (
                <div className="border-t border-border pt-4 sm:pt-6">
                  <h3 className="text-sm font-medium mb-4">Subsidy Information</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div>
                      <Label>Central Subsidy (₹)</Label>
                      <Input
                        type="number"
                        min="0"
                        value={formData.centralSubsidy || ""}
                        onChange={(e) => updateFormData("centralSubsidy", Number.parseInt(e.target.value) || 0)}
                        placeholder="Enter central subsidy amount"
                      />
                    </div>
                    <div>
                      <Label>State Subsidy (₹)</Label>
                      <Input
                        type="number"
                        min="0"
                        value={formData.stateSubsidy || ""}
                        onChange={(e) => updateFormData("stateSubsidy", Number.parseInt(e.target.value) || 0)}
                        placeholder="Enter state subsidy amount"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Hybrid Specific Fields */}
              {/* Battery Configuration - shown when Hybrid Inverter is selected */}
              {showBatteryFields && (
                <div className="border-t border-border pt-6">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <Zap className="w-4 h-4 text-primary" />
                    </div>
                    <h3 className="text-sm font-medium">Battery Configuration</h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <Label>Hybrid Inverter Model</Label>
                      <Input
                        value={formData.hybridInverter || ""}
                        onChange={(e) => updateFormData("hybridInverter", e.target.value)}
                        placeholder="Enter hybrid inverter model"
                      />
                    </div>
                    <div>
                      <Label>Battery Capacity</Label>
                      <Input
                        value={formData.batteryCapacity || ""}
                        onChange={(e) => updateFormData("batteryCapacity", e.target.value)}
                        placeholder="e.g., 5kWh, 10kWh"
                      />
                    </div>
                    <div>
                      <Label>Battery Price (₹)</Label>
                      <Input
                        type="number"
                        min="0"
                        value={formData.batteryPrice || ""}
                        onChange={(e) => updateFormData("batteryPrice", Number.parseInt(e.target.value) || 0)}
                        placeholder="Enter battery price"
                      />
                    </div>
                  </div>
                </div>
              )}
              </>)}
            </>
          )}

          {/* CUSTOMIZE option commented out - users should use pre-configured systems */}
          {false && showCustomizeFields && (
            <div className="border-t border-border pt-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <Sun className="w-4 h-4 text-primary" />
                  </div>
                  <h3 className="text-sm font-medium">Custom Panel Configurations</h3>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={addCustomPanel}>
                  <Plus className="w-4 h-4 mr-1" /> Add Panel
                </Button>
              </div>

              {/* CUSTOMIZE option commented out */}
              {false && formData.customPanels && (formData.customPanels?.length ?? 0) > 0 ? (
                <div className="space-y-4">
                  {formData.customPanels?.map((panel, index) => (
                    <div key={index} className="p-4 border border-border rounded-lg relative bg-muted/30">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute top-2 right-2 h-8 w-8 text-destructive"
                        onClick={() => removeCustomPanel(index)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                        <div>
                          <Label>Panel Type</Label>
                          <Select value={panel.type} onValueChange={(v) => updateCustomPanel(index, "type", v)}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="dcr">DCR</SelectItem>
                              <SelectItem value="non-dcr">Non-DCR</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Brand</Label>
                          <Select value={panel.brand} onValueChange={(v) => updateCustomPanel(index, "brand", v)}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select brand" />
                            </SelectTrigger>
                            <SelectContent>
                              {panelBrandsList.map((brand) => (
                                <SelectItem key={brand} value={brand}>
                                  {brand}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Size</Label>
                          <Select value={panel.size} onValueChange={(v) => updateCustomPanel(index, "size", v)}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select size" />
                            </SelectTrigger>
                            <SelectContent>
                              {panelSizesList.map((size) => (
                                <SelectItem key={size} value={size}>
                                  {size}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Quantity</Label>
                          <Input
                            type="number"
                            min="1"
                            value={panel.quantity || ""}
                            onChange={(e) => updateCustomPanel(index, "quantity", Number.parseInt(e.target.value) || 0)}
                            placeholder="Qty"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground border border-dashed border-border rounded-lg">
                  <p>No custom panels added</p>
                  <Button type="button" variant="link" onClick={addCustomPanel}>
                    Add your first panel configuration
                  </Button>
                </div>
              )}

              {/* CUSTOMIZE option commented out - Show all other fields for customize when panels are added */}
              {false && formData.customPanels && (formData.customPanels?.length ?? 0) > 0 && (
                <>
                  {/* Inverter Selection */}
                  <div className="border-t border-border pt-6 mt-6">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <Zap className="w-4 h-4 text-primary" />
                      </div>
                      <h3 className="text-sm font-medium">Inverter Configuration</h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <Label>Inverter Type</Label>
                        <Select value={formData.inverterType} onValueChange={(v) => updateFormData("inverterType", v)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent>
                            {inverterTypesList.map((type) => (
                              <SelectItem key={type} value={type}>
                                {type}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Inverter Brand</Label>
                        <Select
                          value={formData.inverterBrand}
                          onValueChange={(v) => updateFormData("inverterBrand", v)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select brand" />
                          </SelectTrigger>
                          <SelectContent>
                            {inverterBrandsList.map((brand) => (
                              <SelectItem key={brand} value={brand}>
                                {brand}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Inverter Size</Label>
                        <Input
                          value={formData.inverterSize || ""}
                          onChange={(e) => updateFormData("inverterSize", e.target.value)}
                          placeholder={`e.g., ${inverterSizesList.join(", ")}`}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Structure Selection */}
                  <div className="border-t border-border pt-6">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <Box className="w-4 h-4 text-primary" />
                      </div>
                      <h3 className="text-sm font-medium">Structure Configuration</h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <Label>Structure Type</Label>
                        <Select
                          value={formData.structureType}
                          onValueChange={(v) => updateFormData("structureType", v)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent>
                            {structureTypesList.map((type) => (
                              <SelectItem key={type} value={type}>
                                {type}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Structure Size</Label>
                        <Input
                          value={formData.structureSize || ""}
                          onChange={(e) => updateFormData("structureSize", e.target.value)}
                          placeholder={`e.g., ${structureSizesList.join(", ")}`}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Meter & Cables */}
                  <div className="border-t border-border pt-6">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <Cable className="w-4 h-4 text-primary" />
                      </div>
                      <h3 className="text-sm font-medium">Meter & Cables</h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div>
                        <Label>Meter Brand</Label>
                        <Select value={formData.meterBrand} onValueChange={(v) => updateFormData("meterBrand", v)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select brand" />
                          </SelectTrigger>
                          <SelectContent>
                            {meterBrandsList.map((brand) => (
                              <SelectItem key={brand} value={brand}>
                                {brand}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>AC Cable Brand</Label>
                        <Select value={formData.acCableBrand} onValueChange={(v) => updateFormData("acCableBrand", v)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select brand" />
                          </SelectTrigger>
                          <SelectContent>
                            {cableBrandsList.map((brand) => (
                              <SelectItem key={brand} value={brand}>
                                {brand}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>AC Cable Size</Label>
                        <Select value={formData.acCableSize} onValueChange={(v) => updateFormData("acCableSize", v)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select size" />
                          </SelectTrigger>
                          <SelectContent>
                            {cableSizesList.map((size) => (
                              <SelectItem key={size} value={size}>
                                {size}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>DC Cable Brand</Label>
                        <Select value={formData.dcCableBrand} onValueChange={(v) => updateFormData("dcCableBrand", v)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select brand" />
                          </SelectTrigger>
                          <SelectContent>
                            {cableBrandsList.map((brand) => (
                              <SelectItem key={brand} value={brand}>
                                {brand}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>DC Cable Size</Label>
                        <Select value={formData.dcCableSize} onValueChange={(v) => updateFormData("dcCableSize", v)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select size" />
                          </SelectTrigger>
                          <SelectContent>
                            {cableSizesList.map((size) => (
                              <SelectItem key={size} value={size}>
                                {size}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  {/* ACDB/DCDB */}
                  <div className="border-t border-border pt-6">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <Gauge className="w-4 h-4 text-primary" />
                      </div>
                      <h3 className="text-sm font-medium">ACDB & DCDB</h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <Label>ACDB</Label>
                        <Select value={formData.acdb} onValueChange={(v) => updateFormData("acdb", v)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select ACDB" />
                          </SelectTrigger>
                          <SelectContent>
                            {acdbOptionsList.map((option) => (
                              <SelectItem key={option} value={option}>
                                {option}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>DCDB</Label>
                        <Select value={formData.dcdb} onValueChange={(v) => updateFormData("dcdb", v)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select DCDB" />
                          </SelectTrigger>
                          <SelectContent>
                            {dcdbOptionsList.map((option) => (
                              <SelectItem key={option} value={option}>
                                {option}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  {/* Subsidy Information for Customize */}
                  {showSubsidyFields && (
                  <div className="border-t border-border pt-6">
                    <h3 className="text-sm font-medium mb-4">Subsidy Information (if applicable)</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <Label>Central Subsidy (₹)</Label>
                        <Input
                          type="number"
                          min="0"
                          value={formData.centralSubsidy || ""}
                          onChange={(e) => updateFormData("centralSubsidy", Number.parseInt(e.target.value) || 0)}
                          placeholder="Enter central subsidy amount"
                        />
                      </div>
                      <div>
                        <Label>State Subsidy (₹)</Label>
                        <Input
                          type="number"
                          min="0"
                          value={formData.stateSubsidy || ""}
                          onChange={(e) => updateFormData("stateSubsidy", Number.parseInt(e.target.value) || 0)}
                          placeholder="Enter state subsidy amount"
                        />
                      </div>
                    </div>
                  </div>
                  )}

                  {/* Battery Configuration for Customize */}
                  <div className="border-t border-border pt-6">
                    <h3 className="text-sm font-medium mb-4">Battery Configuration (Optional)</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <Label>Hybrid Inverter</Label>
                        <Input
                          value={formData.hybridInverter || ""}
                          onChange={(e) => updateFormData("hybridInverter", e.target.value)}
                          placeholder="Enter hybrid inverter model"
                        />
                      </div>
                      <div>
                        <Label>Battery Capacity</Label>
                        <Input
                          value={formData.batteryCapacity || ""}
                          onChange={(e) => updateFormData("batteryCapacity", e.target.value)}
                          placeholder="e.g., 5kWh, 10kWh"
                        />
                      </div>
                      <div>
                        <Label>Battery Price (₹)</Label>
                        <Input
                          type="number"
                          min="0"
                          value={formData.batteryPrice || ""}
                          onChange={(e) => updateFormData("batteryPrice", Number.parseInt(e.target.value) || 0)}
                          placeholder="Enter battery price"
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Navigation Buttons - visible only after Browse selection */}
          {(hasSelectedBothConfig || hasSelectedDcrConfig || hasSelectedNonDcrConfig) && (
          <div className="flex flex-col sm:flex-row justify-between gap-3 sm:gap-0 pt-4 sm:pt-6 border-t border-border">
            <Button type="button" variant="outline" onClick={onBack} className="w-full sm:w-auto h-11">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <Button type="submit" className="w-full sm:w-auto h-11">
              Continue to Confirmation
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
          )}
        </form>
      </CardContent>
    </Card>

      {/* DCR Configuration Dialog */}
      {showDcrFields && (
        <DcrConfigDialog
          open={dcrConfigDialogOpen}
          onOpenChange={setDcrConfigDialogOpen}
          onSelect={handleDcrConfigSelect}
        />
      )}

      {/* NON DCR Configuration Dialog */}
      {effectiveSystemType === "non-dcr" && (
        <NonDcrConfigDialog
          open={nonDcrConfigDialogOpen}
          onOpenChange={setNonDcrConfigDialogOpen}
          onSelect={handleNonDcrConfigSelect}
        />
      )}

      {/* BOTH Configuration Dialog */}
      {showBothFields && (
        <BothConfigDialog
          open={bothConfigDialogOpen}
          onOpenChange={setBothConfigDialogOpen}
          onSelect={handleBothConfigSelect}
        />
      )}
    </div>
  )
}
