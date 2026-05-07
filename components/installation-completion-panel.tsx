"use client"

import { useEffect, useMemo, useState } from "react"
import type { ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Image as ImageIcon, Plus, Trash2, Upload, X } from "lucide-react"

export type InstallationImageField = {
  readonly key: string
  readonly label: string
  readonly required?: boolean
  readonly multiple?: boolean
}

export type InstallationExpenseLine = {
  id: string
  description: string
  amount: string
}

export type InstallationInfoRow = {
  label: string
  value: ReactNode
}

export type InstallationInfoSection = {
  title: string
  rows: InstallationInfoRow[]
  emptyText?: string
}

type Props = {
  loadingText?: string
  imageFields: readonly InstallationImageField[]
  filesByField: Record<string, File[] | undefined>
  onFilesChange: (fieldKey: string, files: File[]) => void
  piFile: File | null
  onPiFileChange: (file: File | null) => void
  extraExpenses: InstallationExpenseLine[]
  onAddExpense: () => void
  onExpenseChange: (id: string, patch: Partial<InstallationExpenseLine>) => void
  onRemoveExpense: (id: string) => void
  dimensions: { length: string; width: string; height: string }
  onDimensionsChange: (next: { length?: string; width?: string; height?: string }) => void
  notes: string
  onNotesChange: (value: string) => void
  infoSections: InstallationInfoSection[]
  saveLabel: string
  saving: boolean
  onCancel: () => void
  onSave: () => void
}

export function InstallationCompletionPanel({
  loadingText,
  imageFields,
  filesByField,
  onFilesChange,
  piFile,
  onPiFileChange,
  extraExpenses,
  onAddExpense,
  onExpenseChange,
  onRemoveExpense,
  dimensions,
  onDimensionsChange,
  notes,
  onNotesChange,
  infoSections,
  saveLabel,
  saving,
  onCancel,
  onSave,
}: Props) {
  const [previewLoadErrorByField, setPreviewLoadErrorByField] = useState<Record<string, boolean>>({})
  const sampleBackgroundImageUrl =
    "https://img.freepik.com/premium-vector/house-front-view-home-facade-building-exterior_171867-73.jpg"
  const frontWithPersonBackgroundImageUrl =
    "https://img.freepik.com/free-photo/3d-render-man-leaning-traditional-timber-house_1048-5603.jpg?semt=ais_hybrid&w=740&q=80"
  const inverterWithCustomerBackgroundImageUrl =
    "/install-guides/inverter-with-customer.png"
  const plantWithCustomerBackgroundImageUrl = "/install-guides/plant-with-customer.png"
  const inverterWithSerialBackgroundImageUrl = "/install-guides/inverter-with-serial.png"
  const panelWithSerialBackgroundImageUrl = "/install-guides/panel-with-serial.png"
  const geotagWithPlantsBackgroundImageUrl = "/install-guides/geotag-with-plants.png"
  const piTemplateBackgroundImageUrl =
    "https://assets.refrens.com/442_Product_Quotation_Template_Word_2c06e58c5d.webp"

  const getImageGuide = (key: string) => {
    const k = String(key || "").toLowerCase()
    if (k.includes("homefront")) return "Capture full front elevation of the house."
    if (k.includes("homewithperson")) return "Capture front view with customer standing in frame."
    if (k.includes("inverterwithcustomer")) return "Capture inverter with customer clearly visible."
    if (k.includes("plantwithcustomer")) return "Capture installed plant/array with customer."
    if (k.includes("inverterserial")) return "Capture inverter serial sticker close-up, fully readable."
    if (k.includes("panelserial")) return "Capture panel serial labels clearly and in focus."
    if (k.includes("geotag")) return "Capture geo-tagged site photo with plant visible."
    if (k.includes("other")) return "Upload any extra supporting site images."
    return "Upload a clear, well-lit photo for this document."
  }

  const uploadedPreviewItems = useMemo(() => {
    const fileEntries = Object.entries(filesByField)
      .flatMap(([fieldKey, files]) => {
        if (!files || files.length === 0) return []
        const firstImage = files.find((f) => f.type?.startsWith("image/")) || files[0]
        return firstImage ? [{ fieldKey, file: firstImage }] : []
      })
      .slice(0, 3)

    return fileEntries.map((entry) => ({
      fieldKey: entry.fieldKey,
      fileName: entry.file.name,
      url: URL.createObjectURL(entry.file),
    }))
  }, [filesByField])

  useEffect(() => {
    return () => {
      uploadedPreviewItems.forEach((item) => URL.revokeObjectURL(item.url))
    }
  }, [uploadedPreviewItems])

  const uploadedFieldPreviewMap = useMemo(() => {
    const entries = Object.entries(filesByField)
      .map(([fieldKey, files]) => {
        if (!files || files.length === 0) return null
        const firstImage = files.find((f) => f.type?.startsWith("image/")) || files[0]
        if (!firstImage) return null
        return [fieldKey, URL.createObjectURL(firstImage)] as const
      })
      .filter(Boolean) as Array<readonly [string, string]>
    return Object.fromEntries(entries) as Record<string, string>
  }, [filesByField])

  useEffect(() => {
    return () => {
      Object.values(uploadedFieldPreviewMap).forEach((url) => URL.revokeObjectURL(url))
    }
  }, [uploadedFieldPreviewMap])

  const piPreviewUrl = useMemo(() => {
    if (!piFile) return ""
    if (piFile.type?.startsWith("image/")) return URL.createObjectURL(piFile)
    return ""
  }, [piFile])

  useEffect(() => {
    return () => {
      if (piPreviewUrl) URL.revokeObjectURL(piPreviewUrl)
    }
  }, [piPreviewUrl])

  const renderImageFieldCard = (field: InstallationImageField) => {
    const inputId = `install-image-${field.key}`
    const key = String(field.key).toLowerCase()
    const backgroundImageUrl = key.includes("homewithperson")
      ? frontWithPersonBackgroundImageUrl
      : key.includes("inverterwithcustomer")
        ? inverterWithCustomerBackgroundImageUrl
        : key.includes("plantwithcustomer")
          ? plantWithCustomerBackgroundImageUrl
          : key.includes("inverterserial")
            ? inverterWithSerialBackgroundImageUrl
            : key.includes("panelserial")
              ? panelWithSerialBackgroundImageUrl
              : key.includes("geotag")
                ? geotagWithPlantsBackgroundImageUrl
                : sampleBackgroundImageUrl
    const uploadedCardPreviewUrl = uploadedFieldPreviewMap[field.key]
    const hasUploadedPreview = Boolean(uploadedCardPreviewUrl) && !previewLoadErrorByField[field.key]

    return (
      <div key={field.key} className="space-y-1.5">
        <p className="text-xs text-muted-foreground">
          {field.label}
          {field.required !== false ? " *" : ""}
        </p>
        <div
          className="relative overflow-hidden rounded-md border border-dashed border-border/70 aspect-square"
          style={{
            backgroundImage: hasUploadedPreview ? undefined : `url(${backgroundImageUrl})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          {hasUploadedPreview ? (
            <img
              src={uploadedCardPreviewUrl}
              alt={`${field.label} preview`}
              className="absolute inset-0 h-full w-full object-cover"
              onLoad={() =>
                setPreviewLoadErrorByField((prev) =>
                  prev[field.key] ? { ...prev, [field.key]: false } : prev,
                )
              }
              onError={() =>
                setPreviewLoadErrorByField((prev) => ({ ...prev, [field.key]: true }))
              }
            />
          ) : null}
          {((filesByField[field.key] || []).length > 0 || hasUploadedPreview) ? (
            <button
              type="button"
              aria-label={`Remove ${field.label} image`}
              className="absolute right-2 top-2 z-20 inline-flex h-6 w-6 items-center justify-center rounded-full border border-border bg-background/90 text-foreground shadow-sm hover:bg-background"
              onClick={() => {
                setPreviewLoadErrorByField((prev) => ({ ...prev, [field.key]: false }))
                onFilesChange(field.key, [])
              }}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
          <div className={`absolute inset-0 ${hasUploadedPreview ? "bg-background/20" : "bg-background/65"}`} />
          <div className="absolute top-2 left-2 right-2 flex items-start gap-2">
            <div className="mt-0.5 rounded bg-background/80 p-1">
              <ImageIcon className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
            <p className={`text-[11px] leading-snug line-clamp-3 ${hasUploadedPreview ? "text-foreground" : "text-muted-foreground"}`}>
              {getImageGuide(field.key)}
            </p>
          </div>
          <div className="absolute inset-x-0 bottom-2 flex justify-center px-2">
            <Label
              htmlFor={inputId}
              className="h-8 inline-flex items-center gap-1.5 rounded-md border border-border bg-background/90 px-3 text-xs font-medium text-foreground cursor-pointer hover:bg-background"
            >
              <Upload className="w-3.5 h-3.5" />
              Upload
            </Label>
          </div>
        </div>
        <Input
          id={inputId}
          type="file"
          accept="image/*"
          multiple={field.multiple === true}
          className="hidden"
          onChange={(e) => {
            setPreviewLoadErrorByField((prev) => ({ ...prev, [field.key]: false }))
            onFilesChange(field.key, Array.from(e.target.files || []))
            // Allow selecting the same file again after replacing/removing.
            e.currentTarget.value = ""
          }}
        />
        <p className="text-[11px] text-muted-foreground truncate">
          {(filesByField[field.key] || []).length > 0 ? `${(filesByField[field.key] || []).length} file(s) selected` : "No file selected"}
        </p>
        {previewLoadErrorByField[field.key] ? (
          <p className="text-[11px] text-amber-700">
            Preview unavailable for this image format in browser. Upload is still selected.
          </p>
        ) : null}
      </div>
    )
  }

  const renderPiUploadCard = () => {
    return (
      <div key="pi-upload-card" className="space-y-1.5">
        <p className="text-xs text-muted-foreground">PI Upload</p>
        <div
          className="relative overflow-hidden rounded-md border border-dashed border-border/70 aspect-square"
          style={{
            backgroundImage: `url(${piPreviewUrl || piTemplateBackgroundImageUrl})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <div className={`absolute inset-0 ${piPreviewUrl ? "bg-background/25" : "bg-background/55"}`} />
          <div className="absolute top-2 left-2 right-2 flex items-start gap-2">
            <div className="mt-0.5 rounded bg-background/80 p-1">
              <ImageIcon className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
            <p className="text-[11px] leading-snug text-muted-foreground line-clamp-3">
              Upload PI document or image. Template shown as guide background.
            </p>
          </div>
          <div className="absolute inset-x-0 bottom-2 flex justify-center px-2">
            <Label
              htmlFor="install-pi-upload"
              className="h-8 inline-flex items-center gap-1.5 rounded-md border border-border bg-background/90 px-3 text-xs font-medium text-foreground cursor-pointer hover:bg-background"
            >
              <Upload className="w-3.5 h-3.5" />
              Upload PI
            </Label>
          </div>
        </div>
        <Input
          id="install-pi-upload"
          type="file"
          accept="application/pdf,image/*"
          className="hidden"
          onChange={(e) => {
            onPiFileChange(e.target.files?.[0] || null)
            e.currentTarget.value = ""
          }}
        />
        <p className="text-[11px] text-muted-foreground truncate">{piFile?.name || "No file selected"}</p>
      </div>
    )
  }

  const piSpacerCount = (3 - ((imageFields.length + 1) % 3)) % 3

  return (
    <div className="rounded-md border border-border/70 p-3 space-y-3">
      {loadingText ? <p className="text-xs text-muted-foreground">{loadingText}</p> : null}
      <div className="grid grid-cols-1 xl:grid-cols-[2fr_1fr] gap-4">
        <div className="space-y-3">
          <div className="space-y-1.5">
            <p className="text-xs font-medium">Installation Completion Images (required as marked *)</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {imageFields.map((field) => renderImageFieldCard(field))}
              {Array.from({ length: piSpacerCount }).map((_, idx) => (
                <div key={`pi-spacer-${idx}`} className="hidden md:block" aria-hidden="true" />
              ))}
              {renderPiUploadCard()}
            </div>
          </div>

          <div className="space-y-2 rounded-md border border-border/60 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label className="text-xs font-medium">Extra expenses (optional)</Label>
              <Button type="button" variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={onAddExpense}>
                <Plus className="w-3.5 h-3.5" />
                Add expense
              </Button>
            </div>
            {extraExpenses.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">No extra expenses added.</p>
            ) : (
              <div className="space-y-2">
                {extraExpenses.map((line) => (
                  <div key={line.id} className="grid grid-cols-1 sm:grid-cols-[1fr_120px_auto] gap-2 items-end">
                    <div className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground">Description</Label>
                      <Input
                        className="h-9 text-sm"
                        placeholder="e.g. Transport, extra cable"
                        value={line.description}
                        onChange={(e) => onExpenseChange(line.id, { description: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground">Amount (₹)</Label>
                      <Input
                        className="h-9 text-sm"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0"
                        value={line.amount}
                        onChange={(e) => onExpenseChange(line.id, { amount: e.target.value })}
                      />
                    </div>
                    <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0 text-muted-foreground" onClick={() => onRemoveExpense(line.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-medium">Site legs (feet) *</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Back leg *</Label>
                <Input type="number" min="0" step="0.01" value={dimensions.length} onChange={(e) => onDimensionsChange({ length: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Mid leg (optional)</Label>
                <Input type="number" min="0" step="0.01" value={dimensions.width} onChange={(e) => onDimensionsChange({ width: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Front leg *</Label>
                <Input type="number" min="0" step="0.01" value={dimensions.height} onChange={(e) => onDimensionsChange({ height: e.target.value })} />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-medium">Notes (optional)</p>
            <Textarea rows={2} placeholder="Installation notes, material used, issues, etc." value={notes} onChange={(e) => onNotesChange(e.target.value)} />
          </div>
        </div>

        <div className="rounded-md border border-border/60 bg-muted/20 p-3 space-y-3">
          {infoSections.map((section, idx) => (
            <div key={section.title} className={idx === 0 ? "space-y-2" : "space-y-2 border-t border-border/60 pt-2"}>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{section.title}</p>
              {section.rows.length > 0 ? (
                <div className="space-y-1.5">
                  {section.rows.map((row) => (
                    <div key={row.label} className="text-xs flex items-start justify-between gap-2">
                      <span className="text-muted-foreground">{row.label}</span>
                      <span className="font-medium text-right">{row.value}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">{section.emptyText || "No details available."}</p>
              )}
            </div>
          ))}
          <div className="space-y-2 border-t border-border/60 pt-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Uploaded image preview</p>
            {uploadedPreviewItems.length === 0 ? (
              <p className="text-xs text-muted-foreground">Upload images to see preview here.</p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {uploadedPreviewItems.map((item) => (
                  <div key={`${item.fieldKey}-${item.fileName}`} className="space-y-1">
                    <div
                      className="aspect-square rounded-md border border-border/60 bg-center bg-cover bg-no-repeat"
                      style={{ backgroundImage: `url(${item.url})` }}
                    />
                    <p className="text-[10px] text-muted-foreground truncate">{item.fileName}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button size="sm" onClick={onSave} disabled={saving}>
          {saving ? "Saving..." : saveLabel}
        </Button>
      </div>
    </div>
  )
}
