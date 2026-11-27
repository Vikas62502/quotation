"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Calculator, Download, PackagePlus, RefreshCw, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import {
  INVERTER_PHASE_OPTIONS,
  INVERTER_STRING_OPTIONS,
  PANEL_CONTENT_TYPES,
  PANEL_CONTENT_TYPE_LABELS,
  PANEL_SPEC_OPTIONS,
  STRUCTURE_MEASUREMENT_LABELS,
  STRUCTURE_MEASUREMENT_OPTIONS,
  clearCatalogComponentPricingCache,
  emptyCatalogComponentPricing,
  loadCatalogComponentPricing,
  normalizeCatalogComponentPricing,
  panelBrandSelectOptions,
  saveCatalogComponentPricing,
  type CatalogBrandRow,
  type CatalogComponentKey,
  type CatalogComponentPricingData,
  type PanelContentType,
  type PanelSpec,
  type StructureMeasurement,
} from "@/lib/catalog-component-pricing"
import { api } from "@/lib/api"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"

const PANEL_BIFACIAL_WATT_BELOW = 580
/** Panel & Inverter → 5%; Structure/Cable/Meter/Accessories → 18%; Other → 0%. */
const GST_RATE_BY_CATEGORY: Record<string, number> = {
  Panel: 5,
  Inverter: 5,
  Structure: 18,
  Cable: 18,
  Meter: 18,
  Accessories: 18,
  Other: 0,
}

function gstRateForCategory(category: string): number {
  return GST_RATE_BY_CATEGORY[category] ?? 18
}

type PanelRow = {
  id: string
  brand: string
  contentType: PanelContentType
  spec: PanelSpec
  watt: number
  perWatt: number
  qty: number
}

type InverterRow = {
  id: string
  brand: string
  kw: number
  phases: string
  singleString: string
  price: number
}

type StructureRow = {
  id: string
  brand: string
  product: string
  measurement: StructureMeasurement
  weightKg: number
  perKgPrice: number
  perPiecePrice: number
  qty: number
}

type CableRow = {
  id: string
  brand: string
  mmThickness: number
  perMeterPrice: number
  meters: number
}

type MeterRow = {
  id: string
  brand: string
  phases: string
  price: number
  qty: number
}

type AccessoryRow = {
  id: string
  brand: string
  product: string
  price: number
  qty: number
}

type OtherRow = {
  id: string
  product: string
  price: number
  qty: number
}

type FlatLine = {
  id: string
  category: string
  detail: string
  qty: number
  unitPrice: number
  amount: number
}

function inr(n: number): string {
  return `₹${(Number(n) || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  })}`
}

function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100
}

function newId(): string {
  return `row-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

function defaultPanelSpec(watt: number): PanelSpec {
  return watt > 0 && watt < PANEL_BIFACIAL_WATT_BELOW ? "Bifacial" : "Topcon"
}

function brandNames(data: CatalogComponentPricingData, key: CatalogComponentKey): string[] {
  return panelBrandSelectOptions(
    (data.categories[key]?.brands || [])
      .map((b) => b.name.trim())
      .filter((n) => n && n !== "Unbranded"),
    [],
  )
}

function rowsForBrand(
  data: CatalogComponentPricingData,
  key: CatalogComponentKey,
  brand: string,
): CatalogBrandRow[] {
  const want = brand.trim().toLowerCase()
  if (!want) return []
  const out: CatalogBrandRow[] = []
  for (const bucket of data.categories[key]?.brands || []) {
    const bucketName = bucket.name.trim()
    for (const row of bucket.rows) {
      const rowBrand = (row.brand || bucketName).trim()
      if (rowBrand.toLowerCase() === want || bucketName.toLowerCase() === want) {
        out.push({ ...row, brand: rowBrand })
      }
    }
  }
  return out
}

function pdfText(value: unknown): string {
  return String(value ?? "")
    .replace(/₹/g, "Rs ")
    .replace(/[·•]/g, " - ")
    .replace(/[×✕✖]/g, "x")
    .replace(/[—–−]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
}

export function AdminProjectEstimatedCost() {
  const [pricing, setPricing] = useState<CatalogComponentPricingData>(() =>
    emptyCatalogComponentPricing(),
  )
  const [openSections, setOpenSections] = useState<string[]>(["panel"])

  const [panelRows, setPanelRows] = useState<PanelRow[]>([])
  const [inverterRows, setInverterRows] = useState<InverterRow[]>([])
  const [structureRows, setStructureRows] = useState<StructureRow[]>([])
  const [cableRows, setCableRows] = useState<CableRow[]>([])
  const [meterRows, setMeterRows] = useState<MeterRow[]>([])
  const [accessoryRows, setAccessoryRows] = useState<AccessoryRow[]>([])
  const [otherRows, setOtherRows] = useState<OtherRow[]>([])

  const panelBrands = useMemo(() => brandNames(pricing, "panel"), [pricing])
  const inverterBrands = useMemo(() => brandNames(pricing, "inverter"), [pricing])
  const structureBrands = useMemo(() => brandNames(pricing, "structure"), [pricing])
  const cableBrands = useMemo(() => brandNames(pricing, "cable"), [pricing])
  const meterBrands = useMemo(() => brandNames(pricing, "meter"), [pricing])
  const accessoryBrands = useMemo(() => brandNames(pricing, "accessories"), [pricing])

  const reloadPricing = useCallback(async () => {
    const useApi = process.env.NEXT_PUBLIC_USE_API !== "false"
    if (!useApi) {
      setPricing(loadCatalogComponentPricing())
      return
    }
    try {
      const res = await api.quotations.getCatalogComponentPricing()
      const normalized = normalizeCatalogComponentPricing(res)
      saveCatalogComponentPricing(normalized)
      setPricing(normalized)
    } catch {
      clearCatalogComponentPricingCache()
      setPricing(emptyCatalogComponentPricing())
    }
  }, [])

  useEffect(() => {
    void reloadPricing()
  }, [reloadPricing])

  const panelAmount = (row: PanelRow) =>
    round2(Math.max(1, row.qty || 1) * round2((row.watt || 0) * (row.perWatt || 0)))
  const inverterAmount = (row: InverterRow) => round2(row.price || 0)
  const structureUnit = (row: StructureRow) =>
    row.measurement === "piece"
      ? round2(row.perPiecePrice || 0)
      : round2((row.weightKg || 0) * (row.perKgPrice || 0))
  const structureAmount = (row: StructureRow) =>
    round2(Math.max(1, row.qty || 1) * structureUnit(row))
  const cableAmount = (row: CableRow) =>
    round2(Math.max(0, row.meters || 0) * (row.perMeterPrice || 0))
  const meterAmount = (row: MeterRow) =>
    round2(Math.max(1, row.qty || 1) * (row.price || 0))
  const accessoryAmount = (row: AccessoryRow) =>
    round2(Math.max(1, row.qty || 1) * (row.price || 0))
  const otherAmount = (row: OtherRow) =>
    round2(Math.max(1, row.qty || 1) * (row.price || 0))

  const flatLines: FlatLine[] = useMemo(() => {
    const out: FlatLine[] = []
    for (const row of panelRows) {
      const unit = round2((row.watt || 0) * (row.perWatt || 0))
      out.push({
        id: row.id,
        category: "Panel",
        detail: `${row.brand || "—"} · ${PANEL_CONTENT_TYPE_LABELS[row.contentType]} · ${row.spec} · ${row.watt}W · ${inr(row.perWatt)}/W`,
        qty: Math.max(1, row.qty || 1),
        unitPrice: unit,
        amount: panelAmount(row),
      })
    }
    for (const row of inverterRows) {
      out.push({
        id: row.id,
        category: "Inverter",
        detail: `${row.brand || "—"} · ${row.kw} kW · ${row.phases} · ${row.singleString}`,
        qty: 1,
        unitPrice: round2(row.price || 0),
        amount: inverterAmount(row),
      })
    }
    for (const row of structureRows) {
      const unit = structureUnit(row)
      const detail =
        row.measurement === "piece"
          ? `${row.brand || "—"} · ${row.product || "Structure"} · Piece · ${inr(unit)}`
          : `${row.brand || "—"} · ${row.product || "Structure"} · Kg · ${row.weightKg}kg x ${inr(row.perKgPrice)}`
      out.push({
        id: row.id,
        category: "Structure",
        detail,
        qty: Math.max(1, row.qty || 1),
        unitPrice: unit,
        amount: structureAmount(row),
      })
    }
    for (const row of cableRows) {
      out.push({
        id: row.id,
        category: "Cable",
        detail: `${row.brand || "—"} · ${row.mmThickness} mm · ${inr(row.perMeterPrice)}/m`,
        qty: Math.max(0, row.meters || 0),
        unitPrice: round2(row.perMeterPrice || 0),
        amount: cableAmount(row),
      })
    }
    for (const row of meterRows) {
      out.push({
        id: row.id,
        category: "Meter",
        detail: `${row.brand || "—"} · ${row.phases}`,
        qty: Math.max(1, row.qty || 1),
        unitPrice: round2(row.price || 0),
        amount: meterAmount(row),
      })
    }
    for (const row of accessoryRows) {
      out.push({
        id: row.id,
        category: "Accessories",
        detail: `${row.brand || "—"} · ${row.product || "—"}`,
        qty: Math.max(1, row.qty || 1),
        unitPrice: round2(row.price || 0),
        amount: accessoryAmount(row),
      })
    }
    for (const row of otherRows) {
      out.push({
        id: row.id,
        category: "Other",
        detail: row.product || "—",
        qty: Math.max(1, row.qty || 1),
        unitPrice: round2(row.price || 0),
        amount: otherAmount(row),
      })
    }
    return out
  }, [
    panelRows,
    inverterRows,
    structureRows,
    cableRows,
    meterRows,
    accessoryRows,
    otherRows,
  ])

  const taxSummary = useMemo(() => {
    let subtotal = 0
    let gst5 = 0
    let gst18 = 0
    let otherExempt = 0
    for (const line of flatLines) {
      const amount = Number(line.amount) || 0
      subtotal += amount
      const rate = gstRateForCategory(line.category)
      if (rate === 5) gst5 += amount * 0.05
      else if (rate === 18) gst18 += amount * 0.18
      else otherExempt += amount
    }
    const gstAmount = round2(gst5 + gst18)
    return {
      subtotal: round2(subtotal),
      gst5: round2(gst5),
      gst18: round2(gst18),
      otherExempt: round2(otherExempt),
      gstAmount,
      grandTotal: round2(subtotal + gstAmount),
    }
  }, [flatLines])

  const { subtotal, gst5, gst18, otherExempt, gstAmount, grandTotal } = taxSummary

  const sectionTotal = (category: string) =>
    round2(flatLines.filter((l) => l.category === category).reduce((s, l) => s + l.amount, 0))

  const fillPanelFromPriceSet = (brand: string, contentType: PanelContentType, spec: PanelSpec) => {
    const rows = rowsForBrand(pricing, "panel", brand)
    const match =
      rows.find(
        (r) =>
          (r.contentType || "dcr") === contentType &&
          String(r.spec || "").toLowerCase() === spec.toLowerCase(),
      ) ||
      rows.find((r) => (r.contentType || "dcr") === contentType) ||
      rows[0]
    return Number(match?.perWattPrice) || 0
  }

  const fillInverterPrice = (brand: string, kw: number, phases: string, singleString: string) => {
    const rows = rowsForBrand(pricing, "inverter", brand)
    const match =
      rows.find(
        (r) =>
          Number(r.kw) === Number(kw) &&
          (r.phases || "") === phases &&
          (r.singleString || "") === singleString,
      ) ||
      rows.find((r) => Number(r.kw) === Number(kw) && (r.phases || "") === phases) ||
      rows.find((r) => Number(r.kw) === Number(kw)) ||
      rows[0]
    return Number(match?.price) || 0
  }

  const fillStructure = (brand: string, product: string) => {
    const rows = rowsForBrand(pricing, "structure", brand)
    const match =
      rows.find(
        (r) =>
          product.trim() &&
          String(r.product || r.spec || "").toLowerCase() === product.trim().toLowerCase(),
      ) || rows[0]
    if (!match) return null
    return {
      product: String(match.product || match.spec || product || ""),
      measurement: (match.measurement === "piece" ? "piece" : "kg") as StructureMeasurement,
      weightKg: Number(match.quantity ?? match.weightKg) || 0,
      perKgPrice: Number(match.perKgPrice) || 0,
      perPiecePrice: Number(match.perPiecePrice) || 0,
    }
  }

  const fillCable = (brand: string, mm: number) => {
    const rows = rowsForBrand(pricing, "cable", brand)
    const match = rows.find((r) => Number(r.mmThickness) === Number(mm)) || rows[0]
    return {
      mmThickness: Number(match?.mmThickness ?? mm) || mm,
      perMeterPrice: Number(match?.perMeterPrice ?? match?.unitPrice ?? match?.price) || 0,
    }
  }

  const fillMeter = (brand: string, phases: string) => {
    const rows = rowsForBrand(pricing, "meter", brand)
    const match = rows.find((r) => (r.phases || "") === phases) || rows[0]
    return Number(match?.perPiecePrice ?? match?.price ?? match?.unitPrice) || 0
  }

  const fillAccessory = (brand: string, product: string) => {
    const rows = rowsForBrand(pricing, "accessories", brand)
    const match =
      rows.find(
        (r) =>
          product.trim() &&
          String(r.product || r.spec || "").toLowerCase() === product.trim().toLowerCase(),
      ) || rows[0]
    return {
      product: String(match?.product || match?.spec || product || ""),
      price: Number(match?.perPiecePrice ?? match?.price ?? match?.unitPrice) || 0,
    }
  }

  const addPanelRow = () => {
    const brand = panelBrands[0] || ""
    const contentType: PanelContentType = "dcr"
    const watt = 550
    const spec = defaultPanelSpec(watt)
    setPanelRows((prev) => [
      ...prev,
      {
        id: newId(),
        brand,
        contentType,
        spec,
        watt,
        perWatt: brand ? fillPanelFromPriceSet(brand, contentType, spec) : 0,
        qty: 1,
      },
    ])
    setOpenSections((prev) => (prev.includes("panel") ? prev : [...prev, "panel"]))
  }

  const addInverterRow = () => {
    const brand = inverterBrands[0] || ""
    const kw = 5
    const phases = "1-Phase"
    const singleString = "Single string"
    setInverterRows((prev) => [
      ...prev,
      {
        id: newId(),
        brand,
        kw,
        phases,
        singleString,
        price: brand ? fillInverterPrice(brand, kw, phases, singleString) : 0,
      },
    ])
    setOpenSections((prev) => (prev.includes("inverter") ? prev : [...prev, "inverter"]))
  }

  const addStructureRow = () => {
    const brand = structureBrands[0] || ""
    const filled = brand ? fillStructure(brand, "") : null
    setStructureRows((prev) => [
      ...prev,
      {
        id: newId(),
        brand,
        product: filled?.product || "",
        measurement: filled?.measurement || "kg",
        weightKg: filled?.weightKg || 0,
        perKgPrice: filled?.perKgPrice || 0,
        perPiecePrice: filled?.perPiecePrice || 0,
        qty: 1,
      },
    ])
    setOpenSections((prev) => (prev.includes("structure") ? prev : [...prev, "structure"]))
  }

  const addCableRow = () => {
    const brand = cableBrands[0] || ""
    const filled = brand ? fillCable(brand, 4) : { mmThickness: 4, perMeterPrice: 0 }
    setCableRows((prev) => [
      ...prev,
      {
        id: newId(),
        brand,
        mmThickness: filled.mmThickness,
        perMeterPrice: filled.perMeterPrice,
        meters: 50,
      },
    ])
    setOpenSections((prev) => (prev.includes("cable") ? prev : [...prev, "cable"]))
  }

  const addMeterRow = () => {
    const brand = meterBrands[0] || ""
    const phases = "1-Phase"
    setMeterRows((prev) => [
      ...prev,
      {
        id: newId(),
        brand,
        phases,
        price: brand ? fillMeter(brand, phases) : 0,
        qty: 1,
      },
    ])
    setOpenSections((prev) => (prev.includes("meter") ? prev : [...prev, "meter"]))
  }

  const addAccessoryRow = () => {
    const brand = accessoryBrands[0] || ""
    const filled = brand ? fillAccessory(brand, "") : { product: "", price: 0 }
    setAccessoryRows((prev) => [
      ...prev,
      {
        id: newId(),
        brand,
        product: filled.product,
        price: filled.price,
        qty: 1,
      },
    ])
    setOpenSections((prev) => (prev.includes("accessories") ? prev : [...prev, "accessories"]))
  }

  const addOtherRow = () => {
    setOtherRows((prev) => [...prev, { id: newId(), product: "", price: 0, qty: 1 }])
    setOpenSections((prev) => (prev.includes("other") ? prev : [...prev, "other"]))
  }

  const structureProductsFor = (brand: string) =>
    Array.from(
      new Set(
        rowsForBrand(pricing, "structure", brand)
          .map((r) => String(r.product || r.spec || "").trim())
          .filter(Boolean),
      ),
    )

  const accessoryProductsFor = (brand: string) =>
    Array.from(
      new Set(
        rowsForBrand(pricing, "accessories", brand)
          .map((r) => String(r.product || r.spec || "").trim())
          .filter(Boolean),
      ),
    )

  const downloadPdf = () => {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
    const marginX = 14
    const pageWidth = doc.internal.pageSize.getWidth()
    const tableFont = "helvetica" as const
    const bodySize = 9

    doc.setFont(tableFont, "bold")
    doc.setFontSize(16)
    doc.setTextColor(6, 78, 59)
    doc.text(pdfText("CHAIRBORD SOLAR"), marginX, 18)
    doc.setFontSize(12)
    doc.setTextColor(15, 23, 42)
    doc.text(pdfText("Project Estimated Cost"), marginX, 26)
    doc.setFont(tableFont, "normal")
    doc.setFontSize(bodySize)
    doc.setTextColor(100, 116, 139)
    doc.text(pdfText(`Generated ${new Date().toLocaleString("en-IN")}`), marginX, 32)

    const body =
      flatLines.length > 0
        ? flatLines.map((row) => [
            pdfText(row.category),
            pdfText(row.detail),
            pdfText(row.qty),
            pdfText(row.unitPrice.toLocaleString("en-IN")),
            pdfText(row.amount.toLocaleString("en-IN")),
          ])
        : [[pdfText("-"), pdfText("No lines"), pdfText("-"), pdfText("-"), pdfText("-")]]

    autoTable(doc, {
      startY: 38,
      head: [
        [
          pdfText("Category"),
          pdfText("Detail"),
          pdfText("Qty"),
          pdfText("Unit (Rs)"),
          pdfText("Amount (Rs)"),
        ],
      ],
      body,
      foot: [
        ["", "", "", pdfText("Subtotal"), pdfText(subtotal.toLocaleString("en-IN"))],
        ["", "", "", pdfText("GST 5% (Panel/Inverter)"), pdfText(gst5.toLocaleString("en-IN"))],
        ["", "", "", pdfText("GST 18% (rest)"), pdfText(gst18.toLocaleString("en-IN"))],
        ["", "", "", pdfText("Other (no GST)"), pdfText(otherExempt.toLocaleString("en-IN"))],
        ["", "", "", pdfText("Total GST"), pdfText(gstAmount.toLocaleString("en-IN"))],
        ["", "", "", pdfText("Final amount"), pdfText(grandTotal.toLocaleString("en-IN"))],
      ],
      styles: {
        font: tableFont,
        fontStyle: "normal",
        fontSize: bodySize,
        cellPadding: 2.5,
        textColor: [15, 23, 42],
        valign: "middle",
      },
      headStyles: {
        font: tableFont,
        fontStyle: "bold",
        fontSize: bodySize,
        fillColor: [13, 148, 136],
        textColor: 255,
      },
      bodyStyles: {
        font: tableFont,
        fontStyle: "normal",
        fontSize: bodySize,
        textColor: [15, 23, 42],
      },
      footStyles: {
        font: tableFont,
        fontStyle: "bold",
        fontSize: bodySize,
        fillColor: [240, 253, 250],
        textColor: [19, 78, 74],
      },
      columnStyles: {
        0: { font: tableFont, fontStyle: "normal", fontSize: bodySize },
        1: { font: tableFont, fontStyle: "normal", fontSize: bodySize },
        2: { font: tableFont, fontStyle: "normal", fontSize: bodySize, halign: "right" },
        3: { font: tableFont, fontStyle: "normal", fontSize: bodySize, halign: "right" },
        4: { font: tableFont, fontStyle: "normal", fontSize: bodySize, halign: "right" },
      },
      margin: { left: marginX, right: marginX },
    })

    const last = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable
    const y = (last?.finalY || 40) + 10
    doc.setFont(tableFont, "normal")
    doc.setFontSize(8)
    doc.setTextColor(148, 163, 184)
    doc.text(pdfText("Chairbord Solar - Project estimated cost"), marginX, y)
    doc.text(pdfText("Page 1"), pageWidth - marginX, y, { align: "right" })
    doc.save(`project-estimated-cost-${Date.now()}.pdf`)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold text-emerald-950 sm:text-2xl">
            <Calculator className="h-6 w-6 text-teal-700" />
            Project Estimated Cost
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Panel & Inverter GST 5%. Structure / Cable / Meter / Accessories GST 18%. Other: no
            GST.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={reloadPricing}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Refresh Price set
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={downloadPdf}
            disabled={flatLines.length === 0}
          >
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Download PDF
          </Button>
        </div>
      </div>

      <div className="space-y-4">
      <div className="rounded-xl border border-emerald-100 bg-white px-3 shadow-sm sm:px-4">
        <Accordion type="multiple" value={openSections} onValueChange={setOpenSections}>
          {/* Panel */}
          <AccordionItem value="panel">
            <AccordionTrigger className="text-emerald-950 hover:no-underline">
              Panel
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                · {panelRows.length} row{panelRows.length === 1 ? "" : "s"} ·{" "}
                {inr(sectionTotal("Panel"))}
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-3">
                {panelRows.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No rows. Click Add row.</p>
                ) : (
                  panelRows.map((row) => (
                    <div
                      key={row.id}
                      className="rounded-lg border border-border/60 bg-muted/20 p-2.5"
                    >
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7">
                        <Field label="Brand">
                          <BrandSelect
                            value={row.brand}
                            options={panelBrands}
                            onChange={(brand) =>
                              setPanelRows((prev) =>
                                prev.map((r) =>
                                  r.id === row.id
                                    ? {
                                        ...r,
                                        brand,
                                        perWatt: fillPanelFromPriceSet(
                                          brand,
                                          r.contentType,
                                          r.spec,
                                        ),
                                      }
                                    : r,
                                ),
                              )
                            }
                          />
                        </Field>
                        <Field label="Type">
                          <Select
                            value={row.contentType}
                            onValueChange={(v) => {
                              const contentType = v as PanelContentType
                              setPanelRows((prev) =>
                                prev.map((r) =>
                                  r.id === row.id
                                    ? {
                                        ...r,
                                        contentType,
                                        perWatt: fillPanelFromPriceSet(
                                          r.brand,
                                          contentType,
                                          r.spec,
                                        ),
                                      }
                                    : r,
                                ),
                              )
                            }}
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {PANEL_CONTENT_TYPES.map((key) => (
                                <SelectItem key={key} value={key}>
                                  {PANEL_CONTENT_TYPE_LABELS[key]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </Field>
                        <Field label="Spec">
                          <Select
                            value={row.spec}
                            onValueChange={(v) => {
                              const spec = v as PanelSpec
                              setPanelRows((prev) =>
                                prev.map((r) =>
                                  r.id === row.id
                                    ? {
                                        ...r,
                                        spec,
                                        perWatt: fillPanelFromPriceSet(
                                          r.brand,
                                          r.contentType,
                                          spec,
                                        ),
                                      }
                                    : r,
                                ),
                              )
                            }}
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {PANEL_SPEC_OPTIONS.map((opt) => (
                                <SelectItem key={opt} value={opt}>
                                  {opt}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </Field>
                        <Field label="Watt">
                          <Input
                            type="number"
                            min={0}
                            className="h-9"
                            value={row.watt || ""}
                            onChange={(e) => {
                              const watt = Number(e.target.value) || 0
                              setPanelRows((prev) =>
                                prev.map((r) =>
                                  r.id === row.id
                                    ? { ...r, watt, spec: defaultPanelSpec(watt) }
                                    : r,
                                ),
                              )
                            }}
                          />
                        </Field>
                        <Field label="Per watt (₹)">
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            className="h-9 bg-muted/30"
                            value={row.perWatt || ""}
                            onChange={(e) => {
                              const perWatt = Number(e.target.value) || 0
                              setPanelRows((prev) =>
                                prev.map((r) => (r.id === row.id ? { ...r, perWatt } : r)),
                              )
                            }}
                          />
                        </Field>
                        <Field label="Qty">
                          <Input
                            type="number"
                            min={1}
                            className="h-9"
                            value={row.qty || ""}
                            onChange={(e) => {
                              const qty = Number(e.target.value) || 0
                              setPanelRows((prev) =>
                                prev.map((r) => (r.id === row.id ? { ...r, qty } : r)),
                              )
                            }}
                          />
                        </Field>
                        <div className="flex items-end justify-between gap-2">
                          <p className="pb-2 text-xs font-medium text-teal-800">
                            {inr(panelAmount(row))}
                          </p>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 text-red-600 hover:bg-red-50"
                            onClick={() =>
                              setPanelRows((prev) => prev.filter((r) => r.id !== row.id))
                            }
                            title="Delete row"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
                <div className="flex justify-end">
                  <Button type="button" size="sm" variant="secondary" onClick={addPanelRow}>
                    <PackagePlus className="mr-1.5 h-3.5 w-3.5" />
                    Add row
                  </Button>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Inverter */}
          <AccordionItem value="inverter">
            <AccordionTrigger className="text-emerald-950 hover:no-underline">
              Inverter
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                · {inverterRows.length} row{inverterRows.length === 1 ? "" : "s"} ·{" "}
                {inr(sectionTotal("Inverter"))}
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-3">
                {inverterRows.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No rows. Click Add row.</p>
                ) : (
                  inverterRows.map((row) => (
                    <div
                      key={row.id}
                      className="rounded-lg border border-border/60 bg-muted/20 p-2.5"
                    >
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                        <Field label="Brand">
                          <BrandSelect
                            value={row.brand}
                            options={inverterBrands}
                            onChange={(brand) =>
                              setInverterRows((prev) =>
                                prev.map((r) =>
                                  r.id === row.id
                                    ? {
                                        ...r,
                                        brand,
                                        price: fillInverterPrice(
                                          brand,
                                          r.kw,
                                          r.phases,
                                          r.singleString,
                                        ),
                                      }
                                    : r,
                                ),
                              )
                            }
                          />
                        </Field>
                        <Field label="kW">
                          <Input
                            type="number"
                            min={0}
                            step="0.1"
                            className="h-9"
                            value={row.kw || ""}
                            onChange={(e) => {
                              const kw = Number(e.target.value) || 0
                              setInverterRows((prev) =>
                                prev.map((r) =>
                                  r.id === row.id
                                    ? {
                                        ...r,
                                        kw,
                                        price: fillInverterPrice(
                                          r.brand,
                                          kw,
                                          r.phases,
                                          r.singleString,
                                        ),
                                      }
                                    : r,
                                ),
                              )
                            }}
                          />
                        </Field>
                        <Field label="Phases">
                          <Select
                            value={row.phases}
                            onValueChange={(phases) =>
                              setInverterRows((prev) =>
                                prev.map((r) =>
                                  r.id === row.id
                                    ? {
                                        ...r,
                                        phases,
                                        price: fillInverterPrice(
                                          r.brand,
                                          r.kw,
                                          phases,
                                          r.singleString,
                                        ),
                                      }
                                    : r,
                                ),
                              )
                            }
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {INVERTER_PHASE_OPTIONS.map((opt) => (
                                <SelectItem key={opt} value={opt}>
                                  {opt}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </Field>
                        <Field label="String">
                          <Select
                            value={row.singleString}
                            onValueChange={(singleString) =>
                              setInverterRows((prev) =>
                                prev.map((r) =>
                                  r.id === row.id
                                    ? {
                                        ...r,
                                        singleString,
                                        price: fillInverterPrice(
                                          r.brand,
                                          r.kw,
                                          r.phases,
                                          singleString,
                                        ),
                                      }
                                    : r,
                                ),
                              )
                            }
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {INVERTER_STRING_OPTIONS.map((opt) => (
                                <SelectItem key={opt} value={opt}>
                                  {opt}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </Field>
                        <Field label="Price (₹)">
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            className="h-9 bg-muted/30"
                            value={row.price || ""}
                            onChange={(e) => {
                              const price = Number(e.target.value) || 0
                              setInverterRows((prev) =>
                                prev.map((r) => (r.id === row.id ? { ...r, price } : r)),
                              )
                            }}
                          />
                        </Field>
                        <div className="flex items-end justify-between gap-2">
                          <p className="pb-2 text-xs font-medium text-teal-800">
                            {inr(inverterAmount(row))}
                          </p>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 text-red-600 hover:bg-red-50"
                            onClick={() =>
                              setInverterRows((prev) => prev.filter((r) => r.id !== row.id))
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
                <div className="flex justify-end">
                  <Button type="button" size="sm" variant="secondary" onClick={addInverterRow}>
                    <PackagePlus className="mr-1.5 h-3.5 w-3.5" />
                    Add row
                  </Button>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Structure */}
          <AccordionItem value="structure">
            <AccordionTrigger className="text-emerald-950 hover:no-underline">
              Structure
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                · {structureRows.length} row{structureRows.length === 1 ? "" : "s"} ·{" "}
                {inr(sectionTotal("Structure"))}
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-3">
                {structureRows.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No rows. Click Add row.</p>
                ) : (
                  structureRows.map((row) => {
                    const products = structureProductsFor(row.brand)
                    return (
                      <div
                        key={row.id}
                        className="rounded-lg border border-border/60 bg-muted/20 p-2.5"
                      >
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7">
                          <Field label="Brand">
                            <BrandSelect
                              value={row.brand}
                              options={structureBrands}
                              onChange={(brand) => {
                                const filled = fillStructure(brand, "")
                                setStructureRows((prev) =>
                                  prev.map((r) =>
                                    r.id === row.id
                                      ? {
                                          ...r,
                                          brand,
                                          product: filled?.product || "",
                                          measurement: filled?.measurement || "kg",
                                          weightKg: filled?.weightKg || 0,
                                          perKgPrice: filled?.perKgPrice || 0,
                                          perPiecePrice: filled?.perPiecePrice || 0,
                                        }
                                      : r,
                                  ),
                                )
                              }}
                            />
                          </Field>
                          <Field label="Product">
                            {products.length > 0 ? (
                              <Select
                                value={row.product || undefined}
                                onValueChange={(product) => {
                                  const filled = fillStructure(row.brand, product)
                                  setStructureRows((prev) =>
                                    prev.map((r) =>
                                      r.id === row.id
                                        ? {
                                            ...r,
                                            product,
                                            measurement: filled?.measurement || r.measurement,
                                            weightKg: filled?.weightKg ?? r.weightKg,
                                            perKgPrice: filled?.perKgPrice ?? r.perKgPrice,
                                            perPiecePrice:
                                              filled?.perPiecePrice ?? r.perPiecePrice,
                                          }
                                        : r,
                                    ),
                                  )
                                }}
                              >
                                <SelectTrigger className="h-9">
                                  <SelectValue placeholder="Product" />
                                </SelectTrigger>
                                <SelectContent>
                                  {products.map((p) => (
                                    <SelectItem key={p} value={p}>
                                      {p}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <Input
                                className="h-9"
                                value={row.product}
                                onChange={(e) =>
                                  setStructureRows((prev) =>
                                    prev.map((r) =>
                                      r.id === row.id
                                        ? { ...r, product: e.target.value }
                                        : r,
                                    ),
                                  )
                                }
                              />
                            )}
                          </Field>
                          <Field label="Measurement">
                            <Select
                              value={row.measurement}
                              onValueChange={(v) =>
                                setStructureRows((prev) =>
                                  prev.map((r) =>
                                    r.id === row.id
                                      ? { ...r, measurement: v as StructureMeasurement }
                                      : r,
                                  ),
                                )
                              }
                            >
                              <SelectTrigger className="h-9">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {STRUCTURE_MEASUREMENT_OPTIONS.map((opt) => (
                                  <SelectItem key={opt} value={opt}>
                                    {STRUCTURE_MEASUREMENT_LABELS[opt]}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </Field>
                          {row.measurement === "kg" ? (
                            <>
                              <Field label="Weight (kg)">
                                <Input
                                  type="number"
                                  min={0}
                                  step="0.1"
                                  className="h-9 bg-muted/30"
                                  value={row.weightKg || ""}
                                  onChange={(e) =>
                                    setStructureRows((prev) =>
                                      prev.map((r) =>
                                        r.id === row.id
                                          ? {
                                              ...r,
                                              weightKg: Number(e.target.value) || 0,
                                            }
                                          : r,
                                      ),
                                    )
                                  }
                                />
                              </Field>
                              <Field label="Per kg (₹)">
                                <Input
                                  type="number"
                                  min={0}
                                  step="0.01"
                                  className="h-9 bg-muted/30"
                                  value={row.perKgPrice || ""}
                                  onChange={(e) =>
                                    setStructureRows((prev) =>
                                      prev.map((r) =>
                                        r.id === row.id
                                          ? {
                                              ...r,
                                              perKgPrice: Number(e.target.value) || 0,
                                            }
                                          : r,
                                      ),
                                    )
                                  }
                                />
                              </Field>
                            </>
                          ) : (
                            <Field label="Amount (₹)">
                              <Input
                                type="number"
                                min={0}
                                step="0.01"
                                className="h-9 bg-muted/30"
                                value={row.perPiecePrice || ""}
                                onChange={(e) =>
                                  setStructureRows((prev) =>
                                    prev.map((r) =>
                                      r.id === row.id
                                        ? {
                                            ...r,
                                            perPiecePrice: Number(e.target.value) || 0,
                                          }
                                        : r,
                                    ),
                                  )
                                }
                              />
                            </Field>
                          )}
                          <Field label="Qty">
                            <Input
                              type="number"
                              min={1}
                              className="h-9"
                              value={row.qty || ""}
                              onChange={(e) =>
                                setStructureRows((prev) =>
                                  prev.map((r) =>
                                    r.id === row.id
                                      ? { ...r, qty: Number(e.target.value) || 0 }
                                      : r,
                                  ),
                                )
                              }
                            />
                          </Field>
                          <div className="flex items-end justify-between gap-2">
                            <p className="pb-2 text-xs font-medium text-teal-800">
                              {inr(structureAmount(row))}
                            </p>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9 text-red-600 hover:bg-red-50"
                              onClick={() =>
                                setStructureRows((prev) =>
                                  prev.filter((r) => r.id !== row.id),
                                )
                              }
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
                <div className="flex justify-end">
                  <Button type="button" size="sm" variant="secondary" onClick={addStructureRow}>
                    <PackagePlus className="mr-1.5 h-3.5 w-3.5" />
                    Add row
                  </Button>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Cable */}
          <AccordionItem value="cable">
            <AccordionTrigger className="text-emerald-950 hover:no-underline">
              Cable
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                · {cableRows.length} row{cableRows.length === 1 ? "" : "s"} ·{" "}
                {inr(sectionTotal("Cable"))}
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-3">
                {cableRows.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No rows. Click Add row.</p>
                ) : (
                  cableRows.map((row) => (
                    <div
                      key={row.id}
                      className="rounded-lg border border-border/60 bg-muted/20 p-2.5"
                    >
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                        <Field label="Brand">
                          <BrandSelect
                            value={row.brand}
                            options={cableBrands}
                            onChange={(brand) => {
                              const filled = fillCable(brand, row.mmThickness)
                              setCableRows((prev) =>
                                prev.map((r) =>
                                  r.id === row.id
                                    ? {
                                        ...r,
                                        brand,
                                        mmThickness: filled.mmThickness,
                                        perMeterPrice: filled.perMeterPrice,
                                      }
                                    : r,
                                ),
                              )
                            }}
                          />
                        </Field>
                        <Field label="mm">
                          <Input
                            type="number"
                            min={0}
                            step="0.1"
                            className="h-9"
                            value={row.mmThickness || ""}
                            onChange={(e) => {
                              const mmThickness = Number(e.target.value) || 0
                              const filled = fillCable(row.brand, mmThickness)
                              setCableRows((prev) =>
                                prev.map((r) =>
                                  r.id === row.id
                                    ? {
                                        ...r,
                                        mmThickness,
                                        perMeterPrice: filled.perMeterPrice,
                                      }
                                    : r,
                                ),
                              )
                            }}
                          />
                        </Field>
                        <Field label="Per meter (₹)">
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            className="h-9 bg-muted/30"
                            value={row.perMeterPrice || ""}
                            onChange={(e) =>
                              setCableRows((prev) =>
                                prev.map((r) =>
                                  r.id === row.id
                                    ? {
                                        ...r,
                                        perMeterPrice: Number(e.target.value) || 0,
                                      }
                                    : r,
                                ),
                              )
                            }
                          />
                        </Field>
                        <Field label="Length (m)">
                          <Input
                            type="number"
                            min={0}
                            className="h-9"
                            value={row.meters || ""}
                            onChange={(e) =>
                              setCableRows((prev) =>
                                prev.map((r) =>
                                  r.id === row.id
                                    ? { ...r, meters: Number(e.target.value) || 0 }
                                    : r,
                                ),
                              )
                            }
                          />
                        </Field>
                        <div className="flex items-end justify-between gap-2">
                          <p className="pb-2 text-xs font-medium text-teal-800">
                            {inr(cableAmount(row))}
                          </p>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 text-red-600 hover:bg-red-50"
                            onClick={() =>
                              setCableRows((prev) => prev.filter((r) => r.id !== row.id))
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
                <div className="flex justify-end">
                  <Button type="button" size="sm" variant="secondary" onClick={addCableRow}>
                    <PackagePlus className="mr-1.5 h-3.5 w-3.5" />
                    Add row
                  </Button>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Meter */}
          <AccordionItem value="meter">
            <AccordionTrigger className="text-emerald-950 hover:no-underline">
              Meter
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                · {meterRows.length} row{meterRows.length === 1 ? "" : "s"} ·{" "}
                {inr(sectionTotal("Meter"))}
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-3">
                {meterRows.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No rows. Click Add row.</p>
                ) : (
                  meterRows.map((row) => (
                    <div
                      key={row.id}
                      className="rounded-lg border border-border/60 bg-muted/20 p-2.5"
                    >
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                        <Field label="Brand">
                          <BrandSelect
                            value={row.brand}
                            options={meterBrands}
                            onChange={(brand) =>
                              setMeterRows((prev) =>
                                prev.map((r) =>
                                  r.id === row.id
                                    ? {
                                        ...r,
                                        brand,
                                        price: fillMeter(brand, r.phases),
                                      }
                                    : r,
                                ),
                              )
                            }
                          />
                        </Field>
                        <Field label="Phase">
                          <Select
                            value={row.phases}
                            onValueChange={(phases) =>
                              setMeterRows((prev) =>
                                prev.map((r) =>
                                  r.id === row.id
                                    ? {
                                        ...r,
                                        phases,
                                        price: fillMeter(r.brand, phases),
                                      }
                                    : r,
                                ),
                              )
                            }
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {INVERTER_PHASE_OPTIONS.map((opt) => (
                                <SelectItem key={opt} value={opt}>
                                  {opt}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </Field>
                        <Field label="Price (₹)">
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            className="h-9 bg-muted/30"
                            value={row.price || ""}
                            onChange={(e) =>
                              setMeterRows((prev) =>
                                prev.map((r) =>
                                  r.id === row.id
                                    ? { ...r, price: Number(e.target.value) || 0 }
                                    : r,
                                ),
                              )
                            }
                          />
                        </Field>
                        <Field label="Qty">
                          <Input
                            type="number"
                            min={1}
                            className="h-9"
                            value={row.qty || ""}
                            onChange={(e) =>
                              setMeterRows((prev) =>
                                prev.map((r) =>
                                  r.id === row.id
                                    ? { ...r, qty: Number(e.target.value) || 0 }
                                    : r,
                                ),
                              )
                            }
                          />
                        </Field>
                        <div className="flex items-end justify-between gap-2">
                          <p className="pb-2 text-xs font-medium text-teal-800">
                            {inr(meterAmount(row))}
                          </p>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 text-red-600 hover:bg-red-50"
                            onClick={() =>
                              setMeterRows((prev) => prev.filter((r) => r.id !== row.id))
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
                <div className="flex justify-end">
                  <Button type="button" size="sm" variant="secondary" onClick={addMeterRow}>
                    <PackagePlus className="mr-1.5 h-3.5 w-3.5" />
                    Add row
                  </Button>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Accessories */}
          <AccordionItem value="accessories">
            <AccordionTrigger className="text-emerald-950 hover:no-underline">
              Accessories
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                · {accessoryRows.length} row{accessoryRows.length === 1 ? "" : "s"} ·{" "}
                {inr(sectionTotal("Accessories"))}
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-3">
                {accessoryRows.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No rows. Click Add row.</p>
                ) : (
                  accessoryRows.map((row) => {
                    const products = accessoryProductsFor(row.brand)
                    return (
                      <div
                        key={row.id}
                        className="rounded-lg border border-border/60 bg-muted/20 p-2.5"
                      >
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                          <Field label="Brand">
                            <BrandSelect
                              value={row.brand}
                              options={accessoryBrands}
                              onChange={(brand) => {
                                const filled = fillAccessory(brand, "")
                                setAccessoryRows((prev) =>
                                  prev.map((r) =>
                                    r.id === row.id
                                      ? {
                                          ...r,
                                          brand,
                                          product: filled.product,
                                          price: filled.price,
                                        }
                                      : r,
                                  ),
                                )
                              }}
                            />
                          </Field>
                          <Field label="Product">
                            {products.length > 0 ? (
                              <Select
                                value={row.product || undefined}
                                onValueChange={(product) => {
                                  const filled = fillAccessory(row.brand, product)
                                  setAccessoryRows((prev) =>
                                    prev.map((r) =>
                                      r.id === row.id
                                        ? {
                                            ...r,
                                            product,
                                            price: filled.price,
                                          }
                                        : r,
                                    ),
                                  )
                                }}
                              >
                                <SelectTrigger className="h-9">
                                  <SelectValue placeholder="Product" />
                                </SelectTrigger>
                                <SelectContent>
                                  {products.map((p) => (
                                    <SelectItem key={p} value={p}>
                                      {p}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <Input
                                className="h-9"
                                value={row.product}
                                onChange={(e) =>
                                  setAccessoryRows((prev) =>
                                    prev.map((r) =>
                                      r.id === row.id
                                        ? { ...r, product: e.target.value }
                                        : r,
                                    ),
                                  )
                                }
                              />
                            )}
                          </Field>
                          <Field label="Price (₹)">
                            <Input
                              type="number"
                              min={0}
                              step="0.01"
                              className="h-9 bg-muted/30"
                              value={row.price || ""}
                              onChange={(e) =>
                                setAccessoryRows((prev) =>
                                  prev.map((r) =>
                                    r.id === row.id
                                      ? { ...r, price: Number(e.target.value) || 0 }
                                      : r,
                                  ),
                                )
                              }
                            />
                          </Field>
                          <Field label="Qty">
                            <Input
                              type="number"
                              min={1}
                              className="h-9"
                              value={row.qty || ""}
                              onChange={(e) =>
                                setAccessoryRows((prev) =>
                                  prev.map((r) =>
                                    r.id === row.id
                                      ? { ...r, qty: Number(e.target.value) || 0 }
                                      : r,
                                  ),
                                )
                              }
                            />
                          </Field>
                          <div className="flex items-end justify-between gap-2">
                            <p className="pb-2 text-xs font-medium text-teal-800">
                              {inr(accessoryAmount(row))}
                            </p>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9 text-red-600 hover:bg-red-50"
                              onClick={() =>
                                setAccessoryRows((prev) =>
                                  prev.filter((r) => r.id !== row.id),
                                )
                              }
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
                <div className="flex justify-end">
                  <Button type="button" size="sm" variant="secondary" onClick={addAccessoryRow}>
                    <PackagePlus className="mr-1.5 h-3.5 w-3.5" />
                    Add row
                  </Button>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Other */}
          <AccordionItem value="other">
            <AccordionTrigger className="text-emerald-950 hover:no-underline">
              Other
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                · {otherRows.length} row{otherRows.length === 1 ? "" : "s"} ·{" "}
                {inr(sectionTotal("Other"))}
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-3">
                {otherRows.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No rows. Click Add row.</p>
                ) : (
                  otherRows.map((row) => (
                    <div
                      key={row.id}
                      className="rounded-lg border border-border/60 bg-muted/20 p-2.5"
                    >
                      <div className="grid gap-2 sm:grid-cols-[1fr_6rem_9rem_auto]">
                        <Field label="Product">
                          <Input
                            className="h-9"
                            value={row.product}
                            onChange={(e) =>
                              setOtherRows((prev) =>
                                prev.map((r) =>
                                  r.id === row.id ? { ...r, product: e.target.value } : r,
                                ),
                              )
                            }
                            placeholder="Product / description"
                          />
                        </Field>
                        <Field label="Qty">
                          <Input
                            type="number"
                            min={1}
                            className="h-9"
                            value={row.qty || ""}
                            onChange={(e) =>
                              setOtherRows((prev) =>
                                prev.map((r) =>
                                  r.id === row.id
                                    ? { ...r, qty: Number(e.target.value) || 0 }
                                    : r,
                                ),
                              )
                            }
                          />
                        </Field>
                        <Field label="Price (₹)">
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            className="h-9"
                            value={row.price || ""}
                            onChange={(e) =>
                              setOtherRows((prev) =>
                                prev.map((r) =>
                                  r.id === row.id
                                    ? { ...r, price: Number(e.target.value) || 0 }
                                    : r,
                                ),
                              )
                            }
                          />
                        </Field>
                        <div className="flex items-end justify-between gap-2">
                          <p className="pb-2 text-xs font-medium text-teal-800">
                            {inr(otherAmount(row))}
                          </p>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 text-red-600 hover:bg-red-50"
                            onClick={() =>
                              setOtherRows((prev) => prev.filter((r) => r.id !== row.id))
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
                <div className="flex justify-end">
                  <Button type="button" size="sm" variant="secondary" onClick={addOtherRow}>
                    <PackagePlus className="mr-1.5 h-3.5 w-3.5" />
                    Add row
                  </Button>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>

      <aside className="rounded-xl border border-teal-100 bg-white p-4 shadow-sm sm:p-5">
        <p className="mb-1 text-sm font-semibold text-teal-950">Summary</p>
        <p className="mb-4 text-[11px] leading-snug text-muted-foreground">
          Panel / Inverter 5% · rest 18% · Other 0%
        </p>
        <div className="grid gap-3 border-t border-teal-100 pt-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <div className="flex items-center justify-between gap-3 sm:block sm:space-y-0.5">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="block font-medium tabular-nums sm:text-base">{inr(subtotal)}</span>
          </div>
          <div className="flex items-center justify-between gap-3 sm:block sm:space-y-0.5">
            <span className="text-muted-foreground">GST 5%</span>
            <span className="block font-medium tabular-nums sm:text-base">{inr(gst5)}</span>
          </div>
          <div className="flex items-center justify-between gap-3 sm:block sm:space-y-0.5">
            <span className="text-muted-foreground">GST 18%</span>
            <span className="block font-medium tabular-nums sm:text-base">{inr(gst18)}</span>
          </div>
          <div className="flex items-center justify-between gap-3 sm:block sm:space-y-0.5">
            <span className="text-muted-foreground">Other (no GST)</span>
            <span className="block font-medium tabular-nums sm:text-base">{inr(otherExempt)}</span>
          </div>
          <div className="flex items-center justify-between gap-3 sm:block sm:space-y-0.5">
            <span className="text-muted-foreground">Total GST</span>
            <span className="block font-medium tabular-nums sm:text-base">{inr(gstAmount)}</span>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-lg bg-teal-50/80 px-3 py-2 sm:col-span-2 lg:col-span-1">
            <span className="font-semibold text-teal-950">Final amount</span>
            <span className="text-lg font-bold tabular-nums text-teal-900">
              {inr(grandTotal)}
            </span>
          </div>
        </div>
      </aside>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px] text-muted-foreground">{label}</Label>
      {children}
    </div>
  )
}

function BrandSelect({
  value,
  onChange,
  options,
}: {
  value: string
  onChange: (v: string) => void
  options: string[]
}) {
  return (
    <Select
      value={value || undefined}
      onValueChange={onChange}
      disabled={options.length === 0}
    >
      <SelectTrigger className="h-9">
        <SelectValue placeholder={options.length ? "Select brand" : "No brands in Price set"} />
      </SelectTrigger>
      <SelectContent>
        {options.map((name) => (
          <SelectItem key={name} value={name}>
            {name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
