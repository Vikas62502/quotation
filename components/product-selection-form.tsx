"use client"

import type React from "react"

import { useState } from "react"
import type { ProductSelection } from "@/lib/quotation-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { ArrowLeft, ArrowRight, Plus, Trash2, Sun, Zap, Cable, Gauge, Box } from "lucide-react"
import {
  systemTypes,
  panelBrands,
  panelSizes,
  inverterTypes,
  inverterBrands,
  inverterSizes,
  structureTypes,
  structureSizes,
  meterBrands,
  cableBrands,
  cableSizes,
  acdbOptions,
  dcdbOptions,
} from "@/lib/quotation-data"

interface Props {
  onSubmit: (products: ProductSelection) => void
  onBack: () => void
  initialData?: ProductSelection
}

export function ProductSelectionForm({ onSubmit, onBack, initialData }: Props) {
  const [error, setError] = useState("")
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

  const updateFormData = <K extends keyof ProductSelection>(field: K, value: ProductSelection[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    setError("")
  }

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
    } else if (formData.systemType !== "customize") {
      if (!formData.panelBrand || !formData.panelSize || !formData.panelQuantity) {
        setError("Please complete panel selection")
        return
      }
      if (!formData.inverterType || !formData.inverterBrand || !formData.inverterSize) {
        setError("Please complete inverter selection")
        return
      }
    }

    if (formData.systemType === "customize" && (!formData.customPanels || formData.customPanels.length === 0)) {
      setError("Please add at least one panel configuration for custom setup")
      return
    }

    onSubmit(formData)
  }

  const showDcrFields = formData.systemType === "dcr"
  const showBothFields = formData.systemType === "both"
  const showHybridFields = formData.systemType === "hybrid"
  const showCustomizeFields = formData.systemType === "customize"
  const showStandardFields = formData.systemType && !showCustomizeFields && !showBothFields

  return (
    <Card className="border-0 shadow-xl">
      <CardHeader className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-t-lg">
        <CardTitle className="flex items-center gap-2">
          <Sun className="w-5 h-5 text-primary" />
          Product Selection
        </CardTitle>
        <CardDescription>Configure the solar system components for this quotation</CardDescription>
      </CardHeader>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-6">
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
              onValueChange={(v) => updateFormData("systemType", v)}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-3"
            >
              {systemTypes.map((type) => (
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
              {/* DCR Panel Selection */}
              <div className="border-t border-border pt-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                    <Sun className="w-4 h-4 text-green-600" />
                  </div>
                  <h3 className="text-sm font-medium">DCR Panel Configuration</h3>
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">With Subsidy</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-green-50/50 rounded-lg border border-green-100">
                  <div>
                    <Label>DCR Panel Brand *</Label>
                    <Select value={formData.dcrPanelBrand} onValueChange={(v) => updateFormData("dcrPanelBrand", v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select brand" />
                      </SelectTrigger>
                      <SelectContent>
                        {panelBrands.map((brand) => (
                          <SelectItem key={brand} value={brand}>
                            {brand}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>DCR Panel Size *</Label>
                    <Select value={formData.dcrPanelSize} onValueChange={(v) => updateFormData("dcrPanelSize", v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select size" />
                      </SelectTrigger>
                      <SelectContent>
                        {panelSizes.map((size) => (
                          <SelectItem key={size} value={size}>
                            {size}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                        {panelBrands.map((brand) => (
                          <SelectItem key={brand} value={brand}>
                            {brand}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Non-DCR Panel Size *</Label>
                    <Select
                      value={formData.nonDcrPanelSize}
                      onValueChange={(v) => updateFormData("nonDcrPanelSize", v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select size" />
                      </SelectTrigger>
                      <SelectContent>
                        {panelSizes.map((size) => (
                          <SelectItem key={size} value={size}>
                            {size}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                        {inverterTypes.map((type) => (
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
                        {inverterBrands.map((brand) => (
                          <SelectItem key={brand} value={brand}>
                            {brand}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Inverter Size *</Label>
                    <Select value={formData.inverterSize} onValueChange={(v) => updateFormData("inverterSize", v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select size" />
                      </SelectTrigger>
                      <SelectContent>
                        {inverterSizes.map((size) => (
                          <SelectItem key={size} value={size}>
                            {size}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                        {structureTypes.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Structure Size</Label>
                    <Select value={formData.structureSize} onValueChange={(v) => updateFormData("structureSize", v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select size" />
                      </SelectTrigger>
                      <SelectContent>
                        {structureSizes.map((size) => (
                          <SelectItem key={size} value={size}>
                            {size}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                        {meterBrands.map((brand) => (
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
                        {cableBrands.map((brand) => (
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
                        {cableSizes.map((size) => (
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
                        {cableBrands.map((brand) => (
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
                        {cableSizes.map((size) => (
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
                    <Select value={formData.acdb} onValueChange={(v) => updateFormData("acdb", v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select ACDB" />
                      </SelectTrigger>
                      <SelectContent>
                        {acdbOptions.map((option) => (
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
                        {dcdbOptions.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

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
              {/* Panel Selection */}
              <div className="border-t border-border pt-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <Sun className="w-4 h-4 text-primary" />
                  </div>
                  <h3 className="text-sm font-medium">Panel Configuration</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <Label>Panel Brand *</Label>
                    <Select value={formData.panelBrand} onValueChange={(v) => updateFormData("panelBrand", v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select brand" />
                      </SelectTrigger>
                      <SelectContent>
                        {panelBrands.map((brand) => (
                          <SelectItem key={brand} value={brand}>
                            {brand}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Panel Size *</Label>
                    <Select value={formData.panelSize} onValueChange={(v) => updateFormData("panelSize", v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select size" />
                      </SelectTrigger>
                      <SelectContent>
                        {panelSizes.map((size) => (
                          <SelectItem key={size} value={size}>
                            {size}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                        {inverterTypes.map((type) => (
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
                        {inverterBrands.map((brand) => (
                          <SelectItem key={brand} value={brand}>
                            {brand}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Inverter Size *</Label>
                    <Select value={formData.inverterSize} onValueChange={(v) => updateFormData("inverterSize", v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select size" />
                      </SelectTrigger>
                      <SelectContent>
                        {inverterSizes.map((size) => (
                          <SelectItem key={size} value={size}>
                            {size}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                        {structureTypes.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Structure Size</Label>
                    <Select value={formData.structureSize} onValueChange={(v) => updateFormData("structureSize", v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select size" />
                      </SelectTrigger>
                      <SelectContent>
                        {structureSizes.map((size) => (
                          <SelectItem key={size} value={size}>
                            {size}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                        {meterBrands.map((brand) => (
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
                        {cableBrands.map((brand) => (
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
                        {cableSizes.map((size) => (
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
                        {cableBrands.map((brand) => (
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
                        {cableSizes.map((size) => (
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
                        {acdbOptions.map((option) => (
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
                        {dcdbOptions.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

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
              {showHybridFields && (
                <div className="border-t border-border pt-6">
                  <h3 className="text-sm font-medium mb-4">Battery Configuration</h3>
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
              )}
            </>
          )}

          {showCustomizeFields && (
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

              {formData.customPanels && formData.customPanels.length > 0 ? (
                <div className="space-y-4">
                  {formData.customPanels.map((panel, index) => (
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
                              {panelBrands.map((brand) => (
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
                              {panelSizes.map((size) => (
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

              {/* Show all other fields for customize when panels are added */}
              {formData.customPanels && formData.customPanels.length > 0 && (
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
                            {inverterTypes.map((type) => (
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
                            {inverterBrands.map((brand) => (
                              <SelectItem key={brand} value={brand}>
                                {brand}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Inverter Size</Label>
                        <Select value={formData.inverterSize} onValueChange={(v) => updateFormData("inverterSize", v)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select size" />
                          </SelectTrigger>
                          <SelectContent>
                            {inverterSizes.map((size) => (
                              <SelectItem key={size} value={size}>
                                {size}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
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
                            {structureTypes.map((type) => (
                              <SelectItem key={type} value={type}>
                                {type}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Structure Size</Label>
                        <Select
                          value={formData.structureSize}
                          onValueChange={(v) => updateFormData("structureSize", v)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select size" />
                          </SelectTrigger>
                          <SelectContent>
                            {structureSizes.map((size) => (
                              <SelectItem key={size} value={size}>
                                {size}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
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
                            {meterBrands.map((brand) => (
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
                            {cableBrands.map((brand) => (
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
                            {cableSizes.map((size) => (
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
                            {cableBrands.map((brand) => (
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
                            {cableSizes.map((size) => (
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
                            {acdbOptions.map((option) => (
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
                            {dcdbOptions.map((option) => (
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
          <div className="flex justify-between pt-6 border-t border-border">
            <Button type="button" variant="outline" onClick={onBack}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <Button type="submit">
              Continue to Confirmation
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
