"use client"

import type React from "react"

import { useState, useEffect } from "react"
import type { ProductSelection } from "@/lib/quotation-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
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
  getACDBOptions,
  getDCDBOptions,
  formatACDBOption,
  formatDCDBOption,
  determinePhase,
  calculateSystemSize
} from "@/lib/pricing-tables"
import { usePricingTables } from "@/lib/use-pricing-tables"
import {
  systemTypes,
} from "@/lib/quotation-data"
import { useProductCatalog } from "@/lib/use-product-catalog"

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
  
  // Use catalog data from API only (no dummy data fallback)
  const panelBrandsList = catalog?.panels?.brands || []
  // Get panel sizes from pricing tables instead of catalog
  const panelSizesList = getAvailablePanelSizes(pricingTables || undefined)
  const inverterTypesList = catalog?.inverters?.types || []
  const inverterBrandsList = catalog?.inverters?.brands || []
  const inverterSizesList = catalog?.inverters?.sizes || []
  const structureTypesList = catalog?.structures?.types || []
  // Get structure sizes from pricing tables instead of catalog
  const structureSizesList = getAvailableStructureSizes(pricingTables || undefined)
  const meterBrandsList = catalog?.meters?.brands || []
  const cableBrandsList = catalog?.cables?.brands || []
  const cableSizesList = catalog?.cables?.sizes || []
  const [formData, setFormData] = useState<ProductSelection>(
    initialData || {
      systemType: "",
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
    },
  )

  // Determine phase based on system size and inverter size
  // BOTH systems are always 3-Phase
  let systemSizeForPhase = ""
  if (formData.systemType === "both") {
    // BOTH systems are always 3-Phase, but we still calculate system size for pricing lookup
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
  
  // Determine phase - pass pricing tables to get accurate phase from pricing data
  const currentPhase = formData.systemType === "both"
    ? "3-Phase" as "1-Phase" | "3-Phase" // BOTH systems are always 3-Phase
    : formData.inverterSize && systemSizeForPhase
    ? determinePhase(systemSizeForPhase, formData.inverterSize, pricingTables || undefined)
    : formData.inverterSize
    ? (() => {
        // If we only have inverter size, check if it's >= 7kW or if it's a common 3-phase size
        const inverterKw = Number.parseFloat(formData.inverterSize.replace("kW", ""))
        // Common 3-phase inverter sizes: 5kW (for 3-4kW systems), 8kW, 10kW, 12kW, 15kW, 20kW, 25kW, 30kW
        // Common 1-phase inverter sizes: 3kW, 4kW, 5kW (when system matches), 6kW
        if (inverterKw >= 7 || (inverterKw === 5 && !systemSizeForPhase)) {
          return "3-Phase" as "1-Phase" | "3-Phase"
        }
        return "1-Phase" as "1-Phase" | "3-Phase"
      })()
    : "1-Phase" as "1-Phase" | "3-Phase"
  
  // Get ACDB/DCDB options filtered by phase from pricing tables
  const acdbOptions = getACDBOptions(currentPhase, pricingTables || undefined)
  const dcdbOptions = getDCDBOptions(currentPhase, pricingTables || undefined)
  
  // Format options for display
  const acdbOptionsList = acdbOptions.map((opt) => formatACDBOption(opt.brand, opt.phase))
  const dcdbOptionsList = dcdbOptions.map((opt) => formatDCDBOption(opt.brand, opt.phase))

  const updateFormData = <K extends keyof ProductSelection>(field: K, value: ProductSelection[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    setError("")
  }

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
      pricingTables || undefined
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
      
      const dcrQuantity = Math.ceil(dcrW / panelSize)
      const nonDcrQuantity = Math.ceil(nonDcrW / panelSize)
      
      setFormData((prev) => {
        const updated = {
          ...prev,
          ...preFilledData,
          // Override panel quantities for BOTH system
          dcrPanelBrand: systemConfig.panelBrand,
          dcrPanelSize: systemConfig.panelSize,
          dcrPanelQuantity: dcrQuantity,
          nonDcrPanelBrand: systemConfig.panelBrand,
          nonDcrPanelSize: systemConfig.panelSize,
          nonDcrPanelQuantity: nonDcrQuantity,
          // Ensure ACDB/DCDB are set from config (BOTH systems are always 3-Phase)
          acdb: systemConfig.acdb || preFilledData.acdb || formatACDBOption("Havells", "3-Phase"),
          dcdb: systemConfig.dcdb || preFilledData.dcdb || formatDCDBOption("Havells", "3-Phase"),
          // Preserve subsidies if they exist
          centralSubsidy: prev.centralSubsidy || 0,
          stateSubsidy: prev.stateSubsidy || 0,
          // Store the system price from the selected configuration
          systemPrice: config.price,
        }
        console.log("[ProductSelectionForm] BOTH config selected from dialog - filled all fields:", updated)
        console.log("[ProductSelectionForm] ACDB from config:", systemConfig.acdb, "DCDB from config:", systemConfig.dcdb)
        console.log("[ProductSelectionForm] System price from config:", config.price)
        return updated
      })
    } else {
      // Fallback to basic calculation if no preset found
      const dcrKw = Number.parseFloat(config.dcrCapacity.replace("kW", ""))
      const dcrW = dcrKw * 1000
      const nonDcrKw = Number.parseFloat(config.nonDcrCapacity.replace("kW", ""))
      const nonDcrW = nonDcrKw * 1000
      const panelSizesToTry = [545, 550, 540, 555, 445, 440]
      
      let bestDcrPanelSize = 545
      let bestDcrQuantity = Math.ceil(dcrW / bestDcrPanelSize)
      for (const size of panelSizesToTry) {
        const qty = Math.ceil(dcrW / size)
        const diff = Math.abs((qty * size) - dcrW)
        const currentDiff = Math.abs((bestDcrQuantity * bestDcrPanelSize) - dcrW)
        if (diff < currentDiff) {
          bestDcrPanelSize = size
          bestDcrQuantity = qty
        }
      }
      
      let bestNonDcrPanelSize = 545
      let bestNonDcrQuantity = Math.ceil(nonDcrW / bestNonDcrPanelSize)
      for (const size of panelSizesToTry) {
        const qty = Math.ceil(nonDcrW / size)
        const diff = Math.abs((qty * size) - nonDcrW)
        const currentDiff = Math.abs((bestNonDcrQuantity * bestNonDcrPanelSize) - nonDcrW)
        if (diff < currentDiff) {
          bestNonDcrPanelSize = size
          bestNonDcrQuantity = qty
        }
      }
      
      let panelBrand = "Adani"
      if (config.panelType === "Tata") panelBrand = "Tata"
      else if (config.panelType === "Waaree") panelBrand = "Waaree"
      
      // Determine phase for BOTH system (always 3-Phase)
      const bothPhase = "3-Phase" as "1-Phase" | "3-Phase"
      const defaultAcdb = formatACDBOption("Havells", bothPhase)
      const defaultDcdb = formatDCDBOption("Havells", bothPhase)
      
      setFormData((prev) => ({
        ...prev,
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
      }))
    }
  }

  // Handle NON DCR configuration selection from Browse dialog
  const handleNonDcrConfigSelect = (config: SystemPricing) => {
    // Find matching system configuration preset that includes all component details
    const systemConfig = getSystemConfiguration(
      "non-dcr",
      config.systemSize,
      config.panelType,
      pricingTables || undefined
    )
    
    if (systemConfig) {
      // Use the full system configuration preset to fill all fields
      const preFilledData = configToProductSelection(systemConfig)
      const panelSizeToSet = systemConfig.panelSize || preFilledData.panelSize || ""
      
      setFormData((prev) => {
        const updated = {
          ...prev,
          ...preFilledData,
          panelSize: panelSizeToSet,
          // Ensure ACDB/DCDB are set from config
          acdb: systemConfig.acdb || preFilledData.acdb || "",
          dcdb: systemConfig.dcdb || preFilledData.dcdb || "",
          // Set subsidies from config (DCR systems have fixed central subsidy of 78000)
          centralSubsidy: systemConfig.centralSubsidy ?? preFilledData.centralSubsidy ?? (systemConfig.systemType === "dcr" ? 78000 : (prev.centralSubsidy || 0)),
          stateSubsidy: systemConfig.stateSubsidy ?? preFilledData.stateSubsidy ?? (prev.stateSubsidy || 0),
          // Store the system price from the selected configuration
          systemPrice: config.price,
        }
        console.log("[ProductSelectionForm] NON DCR config selected from dialog - filled all fields:", updated)
        console.log("[ProductSelectionForm] ACDB from config:", systemConfig.acdb, "DCDB from config:", systemConfig.dcdb)
        console.log("[ProductSelectionForm] System price from config:", config.price)
        return updated
      })
    } else {
      // Fallback to basic calculation if no preset found
      const systemKw = Number.parseFloat(config.systemSize.replace("kW", ""))
      const systemW = systemKw * 1000
      const panelSizesToTry = [545, 550, 540, 555, 445, 440]
      let bestPanelSize = 545
      let bestQuantity = Math.ceil(systemW / bestPanelSize)
      
      for (const size of panelSizesToTry) {
        const qty = Math.ceil(systemW / size)
        const diff = Math.abs((qty * size) - systemW)
        const currentDiff = Math.abs((bestQuantity * bestPanelSize) - systemW)
        if (diff < currentDiff) {
          bestPanelSize = size
          bestQuantity = qty
        }
      }
      
      let panelBrand = "Adani"
      if (config.panelType === "Tata") panelBrand = "Tata"
      else if (config.panelType === "Waaree") panelBrand = "Waaree"
      
      // Determine phase based on system and inverter size
      const systemSizeForPhase = `${systemKw}kW`
      const fallbackPhase = determinePhase(systemSizeForPhase, config.inverterSize, pricingTables || undefined)
      const defaultAcdb = formatACDBOption("Havells", fallbackPhase)
      const defaultDcdb = formatDCDBOption("Havells", fallbackPhase)
      
      setFormData((prev) => ({
        ...prev,
        panelBrand,
        panelSize: `${bestPanelSize}W`,
        panelQuantity: bestQuantity,
        inverterType: "String Inverter",
        inverterBrand: "Polycab",
        inverterSize: config.inverterSize,
        acdb: defaultAcdb,
        dcdb: defaultDcdb,
      }))
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
    const systemConfig = getSystemConfiguration(
      "dcr",
      config.systemSize,
      config.panelType,
      pricingTables || undefined
    )
    
    if (systemConfig) {
      // Use the full system configuration preset to fill all fields
      const preFilledData = configToProductSelection(systemConfig)
      const panelSizeToSet = systemConfig.panelSize || preFilledData.panelSize || ""
      
      setFormData((prev) => {
        const updated = {
          ...prev,
          ...preFilledData,
          panelSize: panelSizeToSet,
          // Ensure ACDB/DCDB are set from config
          acdb: systemConfig.acdb || preFilledData.acdb || "",
          dcdb: systemConfig.dcdb || preFilledData.dcdb || "",
          // Set subsidies from config (DCR systems have fixed central subsidy of 78000)
          centralSubsidy: systemConfig.centralSubsidy ?? preFilledData.centralSubsidy ?? (systemConfig.systemType === "dcr" ? 78000 : (prev.centralSubsidy || 0)),
          stateSubsidy: systemConfig.stateSubsidy ?? preFilledData.stateSubsidy ?? (prev.stateSubsidy || 0),
          // Store the system price from the selected configuration - CRITICAL: must be > 0
          systemPrice: config.price,
        }
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
    } else {
      // Fallback to basic calculation if no preset found
      const systemKw = Number.parseFloat(config.systemSize.replace("kW", ""))
      const systemW = systemKw * 1000
      const panelSizesToTry = [545, 550, 540, 555, 445, 440]
      let bestPanelSize = 545
      let bestQuantity = Math.ceil(systemW / bestPanelSize)
      
      for (const size of panelSizesToTry) {
        const qty = Math.ceil(systemW / size)
        const diff = Math.abs((qty * size) - systemW)
        const currentDiff = Math.abs((bestQuantity * bestPanelSize) - systemW)
        if (diff < currentDiff) {
          bestPanelSize = size
          bestQuantity = qty
        }
      }
      
      let panelBrand = "Adani"
      if (config.panelType === "Tata") panelBrand = "Tata"
      else if (config.panelType === "Waaree") panelBrand = "Waaree"
      
      // Determine phase based on system and inverter size
      const systemSizeForPhase = `${systemKw}kW`
      const fallbackPhase = determinePhase(systemSizeForPhase, config.inverterSize, pricingTables || undefined)
      const defaultAcdb = formatACDBOption("Havells", fallbackPhase)
      const defaultDcdb = formatDCDBOption("Havells", fallbackPhase)
      
      setFormData((prev) => ({
        ...prev,
        panelBrand,
        panelSize: `${bestPanelSize}W`,
        panelQuantity: bestQuantity,
        inverterType: "String Inverter",
        inverterBrand: "Polycab",
        inverterSize: config.inverterSize,
        acdb: defaultAcdb,
        dcdb: defaultDcdb,
      }))
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.systemType) {
      setError("Please select a system type")
      return
    }

    if (formData.systemType === "both") {
      if (!formData.dcrPanelBrand || !formData.dcrPanelSize || !formData.dcrPanelQuantity) {
        setError("Please complete DCR panel selection")
        return
      }
      if (!formData.nonDcrPanelBrand || !formData.nonDcrPanelSize || !formData.nonDcrPanelQuantity) {
        setError("Please complete Non-DCR panel selection")
        return
      }
      if (!formData.inverterType || !formData.inverterBrand || !formData.inverterSize) {
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
    } else if (formData.systemType !== "customize") {
      if (!formData.panelBrand || !formData.panelSize || !formData.panelQuantity) {
        setError("Please complete panel selection")
        return
      }
      if (!formData.inverterType || !formData.inverterBrand || !formData.inverterSize) {
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
    if (formData.systemType === "customize") {
      setError("Customize option is not available. Please select a pre-configured system.")
      return
    }

    onSubmit(formData)
  }

  const showDcrFields = formData.systemType === "dcr"
  const showBothFields = formData.systemType === "both"
  const showCustomizeFields = formData.systemType === "customize"
  const showStandardFields = formData.systemType && !showCustomizeFields && !showBothFields
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

          {/* System Type Selection */}
          <div>
            <Label className="text-base font-medium">System Type *</Label>
            <RadioGroup
              value={formData.systemType}
              onValueChange={(v) => {
                updateFormData("systemType", v)
              }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-3"
            >
              {systemTypes
                .filter((type) => type.id !== "customize") // Filter out customize option
                .map((type) => (
                  <div key={type.id}>
                    <RadioGroupItem value={type.id} id={type.id} className="peer sr-only" />
                    <Label
                      htmlFor={type.id}
                      className="flex flex-col p-4 border-2 border-border rounded-lg cursor-pointer hover:border-primary/50 peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 transition-all"
                    >
                      <span className="font-medium">{type.name}</span>
                      <span className="text-xs text-muted-foreground mt-1">{type.description}</span>
                    </Label>
                  </div>
                ))}
            </RadioGroup>
          </div>

          {showBothFields && (
            <>
              {/* BOTH Configuration Selector */}
              <div className="border-t border-border pt-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                      <List className="w-4 h-4 text-purple-600" />
                    </div>
                    <div>
                      <h3 className="text-sm font-medium">BOTH (DCR + NON DCR) Configuration</h3>
                      <p className="text-xs text-muted-foreground">Select a pre-configured BOTH system</p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setBothConfigDialogOpen(true)}
                    className="flex items-center gap-2"
                  >
                    <List className="w-4 h-4" />
                    Browse BOTH Configurations
                  </Button>
                </div>
                {/* Quick Select dropdown removed - use Browse button to select configuration */}
              </div>

              {/* DCR Panel Selection */}
              <div className="border-t border-border pt-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                    <Sun className="w-4 h-4 text-green-600" />
                  </div>
                  <h3 className="text-sm font-medium">DCR Panel Configuration</h3>
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">With Subsidy</span>
                  {(() => {
                    const panelW = formData.dcrPanelSize ? Number.parseFloat(formData.dcrPanelSize.replace("W", "")) : 0
                    const quantity = formData.dcrPanelQuantity || 0
                    const totalW = panelW * quantity
                    return totalW > 0 ? (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                        Total: {totalW.toLocaleString()}W
                      </span>
                    ) : null
                  })()}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-green-50/50 rounded-lg border border-green-100">
                  <div>
                    <Label>DCR Panel Brand *</Label>
                    <Select value={formData.dcrPanelBrand} onValueChange={(v) => updateFormData("dcrPanelBrand", v)}>
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
                      onChange={(e) => updateFormData("dcrPanelSize", e.target.value)}
                      placeholder={`e.g., ${panelSizesList.join(", ")}`}
                    />
                    {panelSizesList.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Available sizes: {panelSizesList.join(", ")}
                      </p>
                    )}
                  </div>
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
                      const panelW = formData.dcrPanelSize ? Number.parseFloat(formData.dcrPanelSize.replace("W", "")) : 0
                      const quantity = formData.dcrPanelQuantity || 0
                      const totalW = panelW * quantity
                      return totalW > 0 ? (
                        <p className="text-xs text-muted-foreground mt-1 font-medium">
                          Total: {totalW.toLocaleString()}W
                        </p>
                      ) : null
                    })()}
                  </div>
                </div>
              </div>

              {/* Non-DCR Panel Selection */}
              <div className="border-t border-border pt-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                    <Sun className="w-4 h-4 text-blue-600" />
                  </div>
                  <h3 className="text-sm font-medium">Non-DCR Panel Configuration</h3>
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Without Subsidy</span>
                  {(() => {
                    const panelW = formData.nonDcrPanelSize ? Number.parseFloat(formData.nonDcrPanelSize.replace("W", "")) : 0
                    const quantity = formData.nonDcrPanelQuantity || 0
                    const totalW = panelW * quantity
                    return totalW > 0 ? (
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                        Total: {totalW.toLocaleString()}W
                      </span>
                    ) : null
                  })()}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-blue-50/50 rounded-lg border border-blue-100">
                  <div>
                    <Label>Non-DCR Panel Brand *</Label>
                    <Select
                      value={formData.nonDcrPanelBrand}
                      onValueChange={(v) => updateFormData("nonDcrPanelBrand", v)}
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
                      onChange={(e) => updateFormData("nonDcrPanelSize", e.target.value)}
                      placeholder={`e.g., ${panelSizesList.join(", ")}`}
                    />
                    {panelSizesList.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Available sizes: {panelSizesList.join(", ")}
                      </p>
                    )}
                  </div>
                  <div>
                    <Label>Non-DCR Panel Quantity *</Label>
                    <Input
                      type="number"
                      min="1"
                      value={formData.nonDcrPanelQuantity || ""}
                      onChange={(e) => updateFormData("nonDcrPanelQuantity", Number.parseInt(e.target.value) || 0)}
                      placeholder="Enter quantity"
                    />
                    {(() => {
                      const panelW = formData.nonDcrPanelSize ? Number.parseFloat(formData.nonDcrPanelSize.replace("W", "")) : 0
                      const quantity = formData.nonDcrPanelQuantity || 0
                      const totalW = panelW * quantity
                      return totalW > 0 ? (
                        <p className="text-xs text-muted-foreground mt-1 font-medium">
                          Total: {totalW.toLocaleString()}W
                        </p>
                      ) : null
                    })()}
                  </div>
                </div>
              </div>

              {/* Inverter Selection for Both */}
              <div className="border-t border-border pt-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <Zap className="w-4 h-4 text-primary" />
                  </div>
                  <h3 className="text-sm font-medium">Inverter Configuration</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                    {inverterSizesList.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Available sizes: {inverterSizesList.join(", ")}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Structure Selection for Both */}
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
                    {structureSizesList.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Available sizes: {structureSizesList.join(", ")}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Meter & Cables for Both */}
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

              {/* ACDB/DCDB for Both */}
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

              {/* Subsidy Information for Both */}
              <div className="border-t border-border pt-6">
                <h3 className="text-sm font-medium mb-4">Subsidy Information (for DCR panels)</h3>
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
            </>
          )}

          {/* Standard Product Fields (for DCR, Non-DCR, Hybrid) */}
          {showStandardFields && (
            <>
              {/* DCR Configuration Selector */}
              {showDcrFields && (
                <div className="border-t border-border pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                        <List className="w-4 h-4 text-green-600" />
                      </div>
                      <div>
                        <h3 className="text-sm font-medium">DCR Configuration</h3>
                        <p className="text-xs text-muted-foreground">Select a pre-configured DCR system</p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setDcrConfigDialogOpen(true)}
                      className="flex items-center gap-2"
                    >
                      <List className="w-4 h-4" />
                      Browse DCR Configurations
                    </Button>
                  </div>
                  {/* Quick Select dropdown removed - use Browse button to select configuration */}
                </div>
              )}

              {/* NON DCR Configuration Selector */}
              {formData.systemType === "non-dcr" && (
                <div className="border-t border-border pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                        <List className="w-4 h-4 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="text-sm font-medium">NON DCR Configuration</h3>
                        <p className="text-xs text-muted-foreground">Select a pre-configured NON DCR system</p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setNonDcrConfigDialogOpen(true)}
                      className="flex items-center gap-2"
                    >
                      <List className="w-4 h-4" />
                      Browse NON DCR Configurations
                    </Button>
                  </div>
                  {/* Quick Select dropdown removed - use Browse button to select configuration */}
                </div>
              )}

              {/* Panel Selection */}
              <div className="border-t border-border pt-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <Sun className="w-4 h-4 text-primary" />
                  </div>
                  <h3 className="text-sm font-medium">Panel Configuration</h3>
                  {(() => {
                    const panelW = formData.panelSize ? Number.parseFloat(formData.panelSize.replace("W", "")) : 0
                    const quantity = formData.panelQuantity || 0
                    const totalW = panelW * quantity
                    return totalW > 0 ? (
                      <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                        Total: {totalW.toLocaleString()}W
                      </span>
                    ) : null
                  })()}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <Label>Panel Brand *</Label>
                    <Select value={formData.panelBrand} onValueChange={(v) => updateFormData("panelBrand", v)}>
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
                    <Input
                      value={formData.panelSize || ""}
                      onChange={(e) => updateFormData("panelSize", e.target.value)}
                      placeholder={`e.g., ${panelSizesList.join(", ")}`}
                    />
                    {panelSizesList.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Available sizes: {panelSizesList.join(", ")}
                      </p>
                    )}
                  </div>
                  <div>
                    <Label>Panel Quantity *</Label>
                    <Input
                      type="number"
                      min="1"
                      value={formData.panelQuantity || ""}
                      onChange={(e) => updateFormData("panelQuantity", Number.parseInt(e.target.value) || 0)}
                      placeholder="Enter quantity"
                    />
                    {(() => {
                      const panelW = formData.panelSize ? Number.parseFloat(formData.panelSize.replace("W", "")) : 0
                      const quantity = formData.panelQuantity || 0
                      const totalW = panelW * quantity
                      return totalW > 0 ? (
                        <p className="text-xs text-muted-foreground mt-1 font-medium">
                          Total: {totalW.toLocaleString()}W
                        </p>
                      ) : null
                    })()}
                  </div>
                </div>
              </div>

              {/* Inverter Selection */}
              <div className="border-t border-border pt-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <Zap className="w-4 h-4 text-primary" />
                  </div>
                  <h3 className="text-sm font-medium">Inverter Configuration</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                    {inverterSizesList.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Available sizes: {inverterSizesList.join(", ")}
                      </p>
                    )}
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
                    {structureSizesList.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Available sizes: {structureSizesList.join(", ")}
                      </p>
                    )}
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

              {/* DCR Specific Fields */}
              {showDcrFields && (
                <div className="border-t border-border pt-6">
                  <h3 className="text-sm font-medium mb-4">Subsidy Information</h3>
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
                        {inverterSizesList.length > 0 && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Available sizes: {inverterSizesList.join(", ")}
                          </p>
                        )}
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
                        {structureSizesList.length > 0 && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Available sizes: {structureSizesList.join(", ")}
                          </p>
                        )}
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

          {/* Navigation Buttons */}
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
      {formData.systemType === "non-dcr" && (
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
