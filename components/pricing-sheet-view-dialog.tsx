"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Download, Loader2 } from "lucide-react"
import { useMemo, useState } from "react"
import {
  DCR_PRICING_EFFECTIVE_FROM,
  getPricingData,
  type BothSystemPricing,
  type SystemPricing,
} from "@/lib/pricing-tables"
import {
  downloadPricingPdf,
  formatBothPanelMixLabel,
  formatPricingSheetSystemSize,
  uniqueBothSheetRows,
  uniqueNonDcrSheetRows,
  NON_DCR_SHEET_PANEL_LABEL,
  NON_DCR_SHEET_SUBHEADER,
  type PricingPdfScope,
} from "@/lib/download-dcr-pricing-pdf"
import {
  dcrCatalogInverterLabel,
  dcrCatalogPanelRangeLabel,
  groupDcrPricingByPanelType,
} from "@/lib/dcr-pricing-catalog-display"

function formatIsoDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  })
}

function formatPrice(amount: number): string {
  return Number(amount || 0).toLocaleString("en-IN")
}

function scopeTitle(scope: PricingPdfScope): string {
  if (scope === "both") return "Pricings (DCR + Non DCR)"
  if (scope === "nonDcr") return "Pricings (Non DCR)"
  return "Pricings (DCR)"
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  scope: PricingPdfScope
  dcrRows?: SystemPricing[]
  nonDcrRows?: SystemPricing[]
  bothRows?: BothSystemPricing[]
}

export function PricingSheetViewDialog({
  open,
  onOpenChange,
  scope,
  dcrRows,
  nonDcrRows,
  bothRows,
}: Props) {
  const [downloading, setDownloading] = useState(false)
  const data = getPricingData()

  const bothSheetRows = useMemo(
    () => uniqueBothSheetRows(bothRows ?? data.both ?? []),
    [bothRows, data.both],
  )

  const nonDcrSheetRows = useMemo(
    () => uniqueNonDcrSheetRows(nonDcrRows ?? data.nonDcr ?? []),
    [nonDcrRows, data.nonDcr],
  )

  const dcrGroups = useMemo(
    () => groupDcrPricingByPanelType(dcrRows ?? data.dcr ?? []),
    [dcrRows, data.dcr],
  )

  const handleDownload = async () => {
    setDownloading(true)
    try {
      await downloadPricingPdf({
        scope,
        dcrRows,
        nonDcrRows,
        bothRows,
      })
    } finally {
      setDownloading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0">
        <div className="bg-slate-800 text-white px-5 py-4 flex items-center justify-between gap-3">
          <DialogHeader className="space-y-0 text-left">
            <DialogTitle className="text-white text-lg sm:text-xl font-bold tracking-wide">
              {scopeTitle(scope)}
            </DialogTitle>
          </DialogHeader>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="shrink-0"
            disabled={downloading}
            onClick={() => void handleDownload()}
          >
            {downloading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Download className="w-4 h-4 mr-1" />}
            Download PDF
          </Button>
        </div>

        <div className="overflow-y-auto px-4 sm:px-5 py-4 space-y-4 bg-slate-50/60">
          <p className="text-sm text-sky-800">
            Note: Prices may vary based on customer requirements, site conditions, and system specifications.
          </p>

          {scope === "both" ? (
            <div className="rounded-md border overflow-hidden bg-white shadow-sm">
              <div className="bg-slate-800 text-white text-center text-xs sm:text-sm font-medium px-3 py-2.5">
                With Subsidy (Polycab / Luminous / Vsole Inverter / X watt) — Panel Type (Adani / Waaree) 620W
              </div>
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-700 hover:bg-slate-700">
                    <TableHead className="text-white">System Size</TableHead>
                    <TableHead className="text-white">Inverter Size</TableHead>
                    <TableHead className="text-white">Panel Type</TableHead>
                    <TableHead className="text-white text-right">Price (INR)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bothSheetRows.map((row, idx) => (
                    <TableRow key={`${row.systemSize}-${row.phase}-${idx}`} className={idx % 2 ? "bg-sky-50/70" : "bg-white"}>
                      <TableCell>{formatPricingSheetSystemSize(row)}</TableCell>
                      <TableCell>{row.inverterSize}</TableCell>
                      <TableCell>{formatBothPanelMixLabel(row)}</TableCell>
                      <TableCell className="text-right font-medium">{formatPrice(row.price)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : null}

          {scope === "dcr"
            ? dcrGroups.map((group) => (
                <div key={group.panelType} className="rounded-md border overflow-hidden bg-white shadow-sm space-y-0">
                  <div className="bg-slate-800 text-white px-3 py-2 text-sm font-semibold">{group.panelType}</div>
                  <p className="text-xs text-muted-foreground px-3 py-1.5 border-b">
                    Panel: {dcrCatalogPanelRangeLabel(group.panelType)} · Inverter: {dcrCatalogInverterLabel()}
                  </p>
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-700 hover:bg-slate-700">
                        <TableHead className="text-white">System Size</TableHead>
                        <TableHead className="text-white">Phase</TableHead>
                        <TableHead className="text-white">Inverter</TableHead>
                        <TableHead className="text-white text-right">Price (INR)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {group.rows.map((row, idx) => (
                        <TableRow key={`${group.panelType}-${idx}`} className={idx % 2 ? "bg-sky-50/70" : "bg-white"}>
                          <TableCell>{row.systemSize}</TableCell>
                          <TableCell>{row.phase}</TableCell>
                          <TableCell>{dcrCatalogInverterLabel()}</TableCell>
                          <TableCell className="text-right font-medium">{formatPrice(row.price)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ))
            : null}

          {scope === "nonDcr" ? (
            <div className="rounded-md border overflow-hidden bg-white shadow-sm">
              <div className="bg-slate-800 text-white text-center text-xs sm:text-sm font-medium px-3 py-2.5">
                {NON_DCR_SHEET_SUBHEADER}
              </div>
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-700 hover:bg-slate-700">
                    <TableHead className="text-white">System Size</TableHead>
                    <TableHead className="text-white">Inverter Size</TableHead>
                    <TableHead className="text-white">Panel Type</TableHead>
                    <TableHead className="text-white text-right">Price (INR)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {nonDcrSheetRows.map((row, idx) => (
                    <TableRow key={`${row.systemSize}-${row.phase}-${idx}`} className={idx % 2 ? "bg-sky-50/70" : "bg-white"}>
                      <TableCell>{formatPricingSheetSystemSize(row)}</TableCell>
                      <TableCell>{row.inverterSize}</TableCell>
                      <TableCell>{NON_DCR_SHEET_PANEL_LABEL}</TableCell>
                      <TableCell className="text-right font-medium">{formatPrice(row.price)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : null}

          <p className="text-xs text-muted-foreground">*Effective From {formatIsoDate(DCR_PRICING_EFFECTIVE_FROM)}</p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
