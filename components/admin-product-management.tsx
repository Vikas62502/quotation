"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus, Trash2, Save, X } from "lucide-react"
import { api } from "@/lib/api"
import { useProductCatalog, type ProductCatalog } from "@/lib/use-product-catalog"

// Helper function to normalize catalog data - ensures all fields are arrays
const normalizeCatalog = (catalog: ProductCatalog | null): ProductCatalog | null => {
  if (!catalog) return null

  // Ensure all fields are arrays (never undefined)
  return {
    panels: {
      brands: Array.isArray(catalog.panels?.brands) ? catalog.panels.brands : [],
      sizes: Array.isArray(catalog.panels?.sizes) ? catalog.panels.sizes : [],
    },
    inverters: {
      types: Array.isArray(catalog.inverters?.types) ? catalog.inverters.types : [],
      brands: Array.isArray(catalog.inverters?.brands) ? catalog.inverters.brands : [],
      sizes: Array.isArray(catalog.inverters?.sizes) ? catalog.inverters.sizes : [],
    },
    structures: {
      types: Array.isArray(catalog.structures?.types) ? catalog.structures.types : [],
      sizes: Array.isArray(catalog.structures?.sizes) ? catalog.structures.sizes : [],
    },
    meters: {
      brands: Array.isArray(catalog.meters?.brands) ? catalog.meters.brands : [],
    },
    cables: {
      brands: Array.isArray(catalog.cables?.brands) ? catalog.cables.brands : [],
      sizes: Array.isArray(catalog.cables?.sizes) ? catalog.cables.sizes : [],
    },
    acdb: {
      options: Array.isArray(catalog.acdb?.options) ? catalog.acdb.options : [],
    },
    dcdb: {
      options: Array.isArray(catalog.dcdb?.options) ? catalog.dcdb.options : [],
    },
  }
}

export function AdminProductManagement() {
  const { catalog, isLoading } = useProductCatalog()
  const [editedCatalog, setEditedCatalog] = useState<ProductCatalog | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const useApi = process.env.NEXT_PUBLIC_USE_API !== "false"

  useEffect(() => {
    if (catalog) {
      // Normalize catalog when loading to ensure all fields are arrays
      const normalized = normalizeCatalog(catalog)
      if (normalized) {
        setEditedCatalog(JSON.parse(JSON.stringify(normalized)))
      }
    }
  }, [catalog])

  const handleAddItem = (category: string, field: string) => {
    if (!editedCatalog) return

    const newItem = prompt(`Enter new ${field}:`)
    if (!newItem || !newItem.trim()) return

    setEditedCatalog((prev) => {
      if (!prev) return prev
      const updated = JSON.parse(JSON.stringify(prev))
      
      if (category === "panels" && field === "brands") {
        updated.panels.brands = [...updated.panels.brands, newItem.trim()]
      } else if (category === "panels" && field === "sizes") {
        updated.panels.sizes = [...updated.panels.sizes, newItem.trim()]
      } else if (category === "inverters" && field === "types") {
        updated.inverters.types = [...updated.inverters.types, newItem.trim()]
      } else if (category === "inverters" && field === "brands") {
        updated.inverters.brands = [...updated.inverters.brands, newItem.trim()]
      } else if (category === "inverters" && field === "sizes") {
        updated.inverters.sizes = [...updated.inverters.sizes, newItem.trim()]
      } else if (category === "structures" && field === "types") {
        updated.structures.types = [...updated.structures.types, newItem.trim()]
      } else if (category === "structures" && field === "sizes") {
        updated.structures.sizes = [...updated.structures.sizes, newItem.trim()]
      } else if (category === "meters" && field === "brands") {
        updated.meters.brands = [...updated.meters.brands, newItem.trim()]
      } else if (category === "cables" && field === "brands") {
        updated.cables.brands = [...updated.cables.brands, newItem.trim()]
      } else if (category === "cables" && field === "sizes") {
        updated.cables.sizes = [...updated.cables.sizes, newItem.trim()]
      } else if (category === "acdb" && field === "options") {
        updated.acdb.options = [...updated.acdb.options, newItem.trim()]
      } else if (category === "dcdb" && field === "options") {
        updated.dcdb.options = [...updated.dcdb.options, newItem.trim()]
      }
      
      return updated
    })
  }

  const handleRemoveItem = (category: string, field: string, index: number) => {
    if (!editedCatalog) return
    if (!confirm("Are you sure you want to remove this item?")) return

    setEditedCatalog((prev) => {
      if (!prev) return prev
      const updated = JSON.parse(JSON.stringify(prev))
      
      if (category === "panels" && field === "brands") {
        updated.panels.brands = updated.panels.brands.filter((_: any, i: number) => i !== index)
      } else if (category === "panels" && field === "sizes") {
        updated.panels.sizes = updated.panels.sizes.filter((_: any, i: number) => i !== index)
      } else if (category === "inverters" && field === "types") {
        updated.inverters.types = updated.inverters.types.filter((_: any, i: number) => i !== index)
      } else if (category === "inverters" && field === "brands") {
        updated.inverters.brands = updated.inverters.brands.filter((_: any, i: number) => i !== index)
      } else if (category === "inverters" && field === "sizes") {
        updated.inverters.sizes = updated.inverters.sizes.filter((_: any, i: number) => i !== index)
      } else if (category === "structures" && field === "types") {
        updated.structures.types = updated.structures.types.filter((_: any, i: number) => i !== index)
      } else if (category === "structures" && field === "sizes") {
        updated.structures.sizes = updated.structures.sizes.filter((_: any, i: number) => i !== index)
      } else if (category === "meters" && field === "brands") {
        updated.meters.brands = updated.meters.brands.filter((_: any, i: number) => i !== index)
      } else if (category === "cables" && field === "brands") {
        updated.cables.brands = updated.cables.brands.filter((_: any, i: number) => i !== index)
      } else if (category === "cables" && field === "sizes") {
        updated.cables.sizes = updated.cables.sizes.filter((_: any, i: number) => i !== index)
      } else if (category === "acdb" && field === "options") {
        updated.acdb.options = updated.acdb.options.filter((_: any, i: number) => i !== index)
      } else if (category === "dcdb" && field === "options") {
        updated.dcdb.options = updated.dcdb.options.filter((_: any, i: number) => i !== index)
      }
      
      return updated
    })
  }

  const validateCatalog = (catalog: ProductCatalog): string[] => {
    const errors: string[] = []

    // Validate panels
    if (!catalog.panels.brands || catalog.panels.brands.length === 0) {
      errors.push("At least one panel brand is required")
    }
    if (!catalog.panels.sizes || catalog.panels.sizes.length === 0) {
      errors.push("At least one panel size is required")
    }

    // Validate inverters
    if (!catalog.inverters.types || catalog.inverters.types.length === 0) {
      errors.push("At least one inverter type is required")
    }
    if (!catalog.inverters.brands || catalog.inverters.brands.length === 0) {
      errors.push("At least one inverter brand is required")
    }
    if (!catalog.inverters.sizes || catalog.inverters.sizes.length === 0) {
      errors.push("At least one inverter size is required")
    }

    // Validate structures
    if (!catalog.structures.types || catalog.structures.types.length === 0) {
      errors.push("At least one structure type is required")
    }
    if (!catalog.structures.sizes || catalog.structures.sizes.length === 0) {
      errors.push("At least one structure size is required")
    }

    // Validate meters
    if (!catalog.meters.brands || catalog.meters.brands.length === 0) {
      errors.push("At least one meter brand is required")
    }

    // Validate cables
    if (!catalog.cables.brands || catalog.cables.brands.length === 0) {
      errors.push("At least one cable brand is required")
    }
    if (!catalog.cables.sizes || catalog.cables.sizes.length === 0) {
      errors.push("At least one cable size is required")
    }

    // Validate acdb
    if (!catalog.acdb.options || catalog.acdb.options.length === 0) {
      errors.push("At least one ACDB option is required")
    }

    // Validate dcdb
    if (!catalog.dcdb.options || catalog.dcdb.options.length === 0) {
      errors.push("At least one DCDB option is required")
    }

    return errors
  }

  const handleSave = async () => {
    if (!editedCatalog || !useApi) {
      setSaveMessage({ type: "error", text: "API is not enabled" })
      setTimeout(() => setSaveMessage(null), 3000)
      return
    }

    // Normalize catalog to ensure all fields are arrays (never undefined)
    const normalizedCatalog = normalizeCatalog(editedCatalog)
    if (!normalizedCatalog) {
      setSaveMessage({ type: "error", text: "Invalid catalog data" })
      setTimeout(() => setSaveMessage(null), 5000)
      return
    }

    // Client-side validation
    const validationErrors = validateCatalog(normalizedCatalog)
    if (validationErrors.length > 0) {
      setSaveMessage({ 
        type: "error", 
        text: validationErrors.join("; ") 
      })
      setTimeout(() => setSaveMessage(null), 10000)
      return
    }

    setIsSaving(true)
    setSaveMessage(null)

    try {
      await api.adminProducts.updateProducts(normalizedCatalog)
      setSaveMessage({ type: "success", text: "Product catalog updated successfully!" })
      setTimeout(() => setSaveMessage(null), 3000)
    } catch (error: any) {
      console.error("Error saving product catalog:", error)
      
      if (error.code === "HTTP_404") {
        setSaveMessage({ 
          type: "error", 
          text: "Backend endpoint not implemented. Please implement PUT /api/config/products endpoint. See BACKEND_PRODUCT_CATALOG_API.md for details." 
        })
      } else if (error.code === "VAL_001" && error.details && error.details.length > 0) {
        // Show validation details from backend
        const detailsText = error.details.map((d: { field: string; message: string }) => 
          `${d.message}`
        ).join("; ")
        setSaveMessage({ 
          type: "error", 
          text: detailsText 
        })
      } else {
        setSaveMessage({ 
          type: "error", 
          text: error.message || "Failed to save product catalog" 
        })
      }
      setTimeout(() => setSaveMessage(null), 8000)
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return <div className="text-center py-8">Loading product catalog...</div>
  }

  if (!editedCatalog) {
    return <div className="text-center py-8">No product catalog data available</div>
  }

  const renderList = (items: string[], category: string, field: string, label: string) => (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">{label}</Label>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => handleAddItem(category, field)}
          className="h-7"
        >
          <Plus className="w-3 h-3 mr-1" />
          Add
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        {items.map((item, index) => (
          <div
            key={index}
            className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-md text-sm"
          >
            <span>{item}</span>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => handleRemoveItem(category, field, index)}
              className="h-5 w-5 p-0 hover:bg-destructive/10 hover:text-destructive"
            >
              <X className="w-3 h-3" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Product Catalog Management</h2>
          <p className="text-muted-foreground">Manage product categories, brands, and options</p>
        </div>
        {useApi && (
          <Button onClick={handleSave} disabled={isSaving}>
            <Save className="w-4 h-4 mr-2" />
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        )}
      </div>

      {saveMessage && (
        <div
          className={`p-4 rounded-lg ${
            saveMessage.type === "success"
              ? "bg-green-50 text-green-800 border border-green-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          {saveMessage.text.includes(";") && saveMessage.type === "error" ? (
            <div className="space-y-1">
              <div className="font-semibold mb-2">Validation errors:</div>
              <ul className="list-disc list-inside space-y-1">
                {saveMessage.text.split(";").map((error, index) => (
                  <li key={index}>{error.trim()}</li>
                ))}
              </ul>
            </div>
          ) : (
            saveMessage.text
          )}
        </div>
      )}

      {!useApi && (
        <div className="p-4 bg-yellow-50 text-yellow-800 border border-yellow-200 rounded-lg">
          API is disabled. Product catalog changes will not be saved.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Panels */}
        <Card>
          <CardHeader>
            <CardTitle>Solar Panels</CardTitle>
            <CardDescription>Manage panel brands and sizes</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {renderList(editedCatalog.panels.brands, "panels", "brands", "Panel Brands")}
            {renderList(editedCatalog.panels.sizes, "panels", "sizes", "Panel Sizes")}
          </CardContent>
        </Card>

        {/* Inverters */}
        <Card>
          <CardHeader>
            <CardTitle>Inverters</CardTitle>
            <CardDescription>Manage inverter types, brands, and sizes</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {renderList(editedCatalog.inverters.types, "inverters", "types", "Inverter Types")}
            {renderList(editedCatalog.inverters.brands, "inverters", "brands", "Inverter Brands")}
            {renderList(editedCatalog.inverters.sizes, "inverters", "sizes", "Inverter Sizes")}
          </CardContent>
        </Card>

        {/* Structures */}
        <Card>
          <CardHeader>
            <CardTitle>Structures</CardTitle>
            <CardDescription>Manage structure types and sizes</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {renderList(editedCatalog.structures.types, "structures", "types", "Structure Types")}
            {renderList(editedCatalog.structures.sizes, "structures", "sizes", "Structure Sizes")}
          </CardContent>
        </Card>

        {/* Meters */}
        <Card>
          <CardHeader>
            <CardTitle>Meters</CardTitle>
            <CardDescription>Manage meter brands</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {renderList(editedCatalog.meters.brands, "meters", "brands", "Meter Brands")}
          </CardContent>
        </Card>

        {/* Cables */}
        <Card>
          <CardHeader>
            <CardTitle>Cables</CardTitle>
            <CardDescription>Manage cable brands and sizes</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {renderList(editedCatalog.cables.brands, "cables", "brands", "Cable Brands")}
            {renderList(editedCatalog.cables.sizes, "cables", "sizes", "Cable Sizes")}
          </CardContent>
        </Card>

        {/* ACDB/DCDB */}
        <Card>
          <CardHeader>
            <CardTitle>ACDB & DCDB</CardTitle>
            <CardDescription>Manage ACDB and DCDB options</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {renderList(editedCatalog.acdb.options, "acdb", "options", "ACDB Options")}
            {renderList(editedCatalog.dcdb.options, "dcdb", "options", "DCDB Options")}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}



