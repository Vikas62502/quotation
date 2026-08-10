import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import {
  DCR_PRICING_EFFECTIVE_FROM,
  DCR_PRICING_VALID_TILL,
  getPricingData,
  type BothSystemPricing,
  type SystemPricing,
} from "@/lib/pricing-tables"
import {
  dcrCatalogInverterLabel,
  dcrCatalogPanelRangeLabel,
  groupDcrPricingByPanelType,
} from "@/lib/dcr-pricing-catalog-display"

export type PricingPdfScope = "dcr" | "nonDcr" | "both"

export const PRICING_PDF_SCOPE_OPTIONS: ReadonlyArray<{
  value: PricingPdfScope
  label: string
  shortLabel: string
}> = [
  { value: "dcr", label: "DCR package prices", shortLabel: "DCR" },
  { value: "nonDcr", label: "Non-DCR package prices", shortLabel: "Non-DCR" },
  { value: "both", label: "Pricings (DCR + Non DCR)", shortLabel: "DCR + Non DCR" },
]

export function formatPricePlain(amount: number): string {
  return Number(amount || 0).toLocaleString("en-IN")
}

export function formatBothPanelMixLabel(row: Pick<BothSystemPricing, "dcrCapacity" | "nonDcrCapacity">): string {
  return `${row.dcrCapacity} (DCR) + ${row.nonDcrCapacity} (Non DCR)`
}

export function formatPricingSheetSystemSize(row: Pick<BothSystemPricing, "systemSize" | "phase">): string {
  return `${row.systemSize} (${row.phase})`
}

function rankSheetSystemSize(systemSize: string, phase: string): number {
  const kw = Number.parseFloat(String(systemSize).replace(/kW/i, "")) || 0
  const phaseBoost = phase === "1-Phase" ? 0 : 0.5
  return kw + phaseBoost
}

/** One sheet row per systemSize+phase (Adani/Waaree share the same package price on the printed sheet). */
export function uniqueBothSheetRows(rows: BothSystemPricing[]): BothSystemPricing[] {
  const out: BothSystemPricing[] = []
  const seen = new Set<string>()
  for (const row of rows) {
    const key = `${row.systemSize}|${row.phase}|${row.dcrCapacity}|${row.nonDcrCapacity}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(row)
  }
  return out.sort(
    (a, b) => rankSheetSystemSize(a.systemSize, a.phase) - rankSheetSystemSize(b.systemSize, b.phase),
  )
}

/** One Non-DCR sheet row per systemSize+phase+inverter (Adani/Waaree share the same package price). */
export function uniqueNonDcrSheetRows(rows: SystemPricing[]): SystemPricing[] {
  const out: SystemPricing[] = []
  const seen = new Set<string>()
  for (const row of rows) {
    const key = `${row.systemSize}|${row.phase}|${row.inverterSize}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(row)
  }
  return out.sort(
    (a, b) => rankSheetSystemSize(a.systemSize, a.phase) - rankSheetSystemSize(b.systemSize, b.phase),
  )
}

export const NON_DCR_SHEET_PANEL_LABEL = "Adani / Waaree"
export const NON_DCR_SHEET_SUBHEADER =
  "Without Subsidy (Polycab / Luminous / Vsole Inverter / X watt)"

function formatIsoDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

function formatIsoDateLong(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  })
}

function brandSectionLabel(panelType: string, scope: PricingPdfScope): string {
  if (scope === "dcr") {
    if (panelType === "Adani") return "Adani (555W)"
    if (panelType === "Adani Topcon") return "Adani Topcon (620W)"
    if (panelType === "Waaree") return "Waaree (540W)"
    if (panelType === "Waaree Topcon") return "Waaree Topcon (610W)"
    if (panelType === "Premier Energies") return "Premier Energies (600-625W Topcon)"
    if (panelType === "INA") return "INA (500W-600W)"
    if (panelType === "Tata") return "Tata (530W-570W)"
    if (panelType.toLowerCase().includes("crompton")) return "Crompton set (610W)"
  }
  return panelType
}

function scopeTitle(scope: PricingPdfScope): string {
  if (scope === "nonDcr") return "Pricings (Non DCR)"
  if (scope === "both") return "Pricings (DCR + Non DCR)"
  return "Pricings (DCR)"
}

function groupSystemRows(rows: SystemPricing[]) {
  return groupDcrPricingByPanelType(rows)
}

function drawSheetBanner(doc: jsPDF, title: string, pageWidth: number, marginX: number) {
  doc.setFillColor(30, 41, 59) // slate-800
  doc.rect(0, 0, pageWidth, 22, "F")
  doc.setTextColor(255, 255, 255)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(16)
  doc.text(title, pageWidth / 2, 14, { align: "center" })
  doc.setTextColor(0, 0, 0)

  doc.setFont("helvetica", "normal")
  doc.setFontSize(9)
  doc.setTextColor(12, 74, 110)
  doc.text(
    "Note: Prices may vary based on customer requirements, site conditions, and system specifications.",
    pageWidth / 2,
    30,
    { align: "center", maxWidth: pageWidth - marginX * 2 },
  )
  doc.setTextColor(0, 0, 0)
}

function drawBothSheetPdf(
  doc: jsPDF,
  rows: BothSystemPricing[],
  pageWidth: number,
  marginX: number,
) {
  const sheetRows = uniqueBothSheetRows(rows)
  drawSheetBanner(doc, scopeTitle("both"), pageWidth, marginX)

  autoTable(doc, {
    startY: 38,
    head: [
      [
        {
          content:
            "With Subsidy (Polycab / Luminous / Vsole Inverter / X watt) — Panel Type (Adani / Waaree) 620W",
          colSpan: 4,
          styles: { halign: "center", fillColor: [30, 41, 59], textColor: 255, fontStyle: "bold" },
        },
      ],
      ["System Size", "Inverter Size", "Panel Type", "Price (INR)"],
    ],
    body: sheetRows.map((row) => [
      formatPricingSheetSystemSize(row),
      row.inverterSize,
      formatBothPanelMixLabel(row),
      formatPricePlain(row.price),
    ]),
    margin: { left: marginX, right: marginX },
    styles: { fontSize: 9, cellPadding: 2.2, halign: "left", valign: "middle" },
    headStyles: { fillColor: [51, 65, 85], textColor: 255, fontStyle: "bold", halign: "left" },
    alternateRowStyles: { fillColor: [239, 246, 255] },
    columnStyles: {
      3: { halign: "right" },
    },
  })

  const last = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable
  const y = (last?.finalY ?? 200) + 10
  doc.setFontSize(9)
  doc.setTextColor(71, 85, 105)
  doc.text(`*Effective From ${formatIsoDateLong(DCR_PRICING_EFFECTIVE_FROM)}`, marginX, y)
  doc.setTextColor(0, 0, 0)
}

function drawNonDcrSheetPdf(
  doc: jsPDF,
  rows: SystemPricing[],
  pageWidth: number,
  marginX: number,
) {
  const sheetRows = uniqueNonDcrSheetRows(rows)
  drawSheetBanner(doc, scopeTitle("nonDcr"), pageWidth, marginX)

  autoTable(doc, {
    startY: 38,
    head: [
      [
        {
          content: NON_DCR_SHEET_SUBHEADER,
          colSpan: 4,
          styles: { halign: "center", fillColor: [30, 41, 59], textColor: 255, fontStyle: "bold" },
        },
      ],
      ["System Size", "Inverter Size", "Panel Type", "Price (INR)"],
    ],
    body: sheetRows.map((row) => [
      formatPricingSheetSystemSize(row),
      row.inverterSize,
      NON_DCR_SHEET_PANEL_LABEL,
      formatPricePlain(row.price),
    ]),
    margin: { left: marginX, right: marginX },
    styles: { fontSize: 8.5, cellPadding: 1.8, halign: "left", valign: "middle" },
    headStyles: { fillColor: [51, 65, 85], textColor: 255, fontStyle: "bold", halign: "left" },
    alternateRowStyles: { fillColor: [239, 246, 255] },
    columnStyles: {
      3: { halign: "right" },
    },
  })

  const last = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable
  const y = (last?.finalY ?? 200) + 8
  doc.setFontSize(9)
  doc.setTextColor(71, 85, 105)
  doc.text(`*Effective From ${formatIsoDateLong(DCR_PRICING_EFFECTIVE_FROM)}`, marginX, y)
  doc.setTextColor(0, 0, 0)
}

function writeGenericHeader(doc: jsPDF, scope: PricingPdfScope, pageWidth: number) {
  doc.setFillColor(30, 41, 59)
  doc.rect(0, 0, pageWidth, 22, "F")
  doc.setTextColor(255, 255, 255)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(16)
  doc.text(scopeTitle(scope), pageWidth / 2, 14, { align: "center" })
  doc.setTextColor(0, 0, 0)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(9)
  doc.setTextColor(12, 74, 110)
  doc.text(
    "Note: Prices may vary based on customer requirements, site conditions, and system specifications.",
    pageWidth / 2,
    30,
    { align: "center", maxWidth: pageWidth - 28 },
  )
  doc.setTextColor(0, 0, 0)
  doc.setFontSize(8)
  doc.setTextColor(100)
  doc.text(
    `Effective from ${formatIsoDate(DCR_PRICING_EFFECTIVE_FROM)} · Valid till ${formatIsoDate(DCR_PRICING_VALID_TILL)}`,
    pageWidth / 2,
    36,
    { align: "center" },
  )
  doc.setTextColor(0)
}

/** Download package pricing PDF for DCR, Non-DCR, or BOTH (user choice). */
export async function downloadPricingPdf(options?: {
  scope?: PricingPdfScope
  dcrRows?: SystemPricing[]
  nonDcrRows?: SystemPricing[]
  bothRows?: BothSystemPricing[]
  filename?: string
}): Promise<void> {
  const scope: PricingPdfScope = options?.scope ?? "dcr"
  const data = getPricingData()
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
  const pageWidth = doc.internal.pageSize.getWidth()
  const marginX = 14

  if (scope === "both") {
    const rows = options?.bothRows ?? data.both ?? []
    if (!rows.length) throw new Error("No DCR + Non DCR pricing rows available to export")
    drawBothSheetPdf(doc, rows, pageWidth, marginX)
  } else if (scope === "nonDcr") {
    const rows = options?.nonDcrRows ?? data.nonDcr ?? []
    if (!rows.length) throw new Error("No Non-DCR pricing rows available to export")
    drawNonDcrSheetPdf(doc, rows, pageWidth, marginX)
  } else {
    writeGenericHeader(doc, scope, pageWidth)
    let cursorY = 42

    const rows = options?.dcrRows ?? data.dcr ?? []
    if (!rows.length) {
      throw new Error("No DCR pricing rows available to export")
    }

    for (const group of groupSystemRows(rows)) {
      if (cursorY > 250) {
        doc.addPage()
        cursorY = 16
      }

      doc.setFontSize(12)
      doc.setFont("helvetica", "bold")
      doc.text(brandSectionLabel(group.panelType, scope), marginX, cursorY)
      cursorY += 3
      doc.setFont("helvetica", "normal")
      doc.setFontSize(8)
      doc.setTextColor(90)
      doc.text(
        `Panel: ${dcrCatalogPanelRangeLabel(group.panelType)} · Inverter: ${dcrCatalogInverterLabel()}`,
        marginX,
        cursorY + 3,
      )
      doc.setTextColor(0)
      cursorY += 6

      autoTable(doc, {
        startY: cursorY,
        head: [["System Size", "Phase", "Inverter", "Price (INR)"]],
        body: group.rows.map((row) => [
          row.systemSize,
          row.phase,
          dcrCatalogInverterLabel(),
          formatPricePlain(row.price),
        ]),
        margin: { left: marginX, right: marginX },
        styles: { fontSize: 8, cellPadding: 1.5, halign: "left", valign: "middle" },
        headStyles: { fillColor: [51, 65, 85], textColor: 255, fontStyle: "bold", halign: "left" },
        alternateRowStyles: { fillColor: [239, 246, 255] },
        columnStyles: { 3: { halign: "right" } },
      })

      const last = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable
      cursorY = (last?.finalY ?? cursorY) + 10
    }

    doc.setFontSize(8)
    doc.setTextColor(100)
    doc.text(
      `*Effective From ${formatIsoDateLong(DCR_PRICING_EFFECTIVE_FROM)}`,
      marginX,
      Math.min(cursorY + 4, doc.internal.pageSize.getHeight() - 10),
    )
  }

  const stamp = new Date().toISOString().slice(0, 10)
  const prefix = scope === "nonDcr" ? "NonDCR" : scope === "both" ? "DCR_NonDCR" : "DCR"
  const filename = options?.filename ?? `${prefix}_Pricings_${stamp}.pdf`
  doc.save(filename)
}

/** @deprecated Prefer downloadPricingPdf({ scope: "dcr" }) */
export async function downloadDcrPricingPdf(options?: {
  rows?: SystemPricing[]
  filename?: string
}): Promise<void> {
  return downloadPricingPdf({
    scope: "dcr",
    dcrRows: options?.rows,
    filename: options?.filename,
  })
}
