"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  dcrPricing,
  DCR_PRICING_EFFECTIVE_FROM,
  DCR_PRICING_VALID_TILL,
  type SystemPricing,
} from "@/lib/pricing-tables"
import {
  dcrCatalogInverterLabel,
  dcrCatalogPanelRangeLabel,
  groupDcrPricingByPanelType,
} from "@/lib/dcr-pricing-catalog-display"
import { Search, Download } from "lucide-react"
import jsPDF from "jspdf"
import html2canvas from "html2canvas"

interface DcrConfigDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (config: SystemPricing) => void
}

export function DcrConfigDialog({ open, onOpenChange, onSelect }: DcrConfigDialogProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [activeBrandTab, setActiveBrandTab] = useState<string>("")

  const filteredConfigs = useMemo(() => {
    const searchLower = searchTerm.toLowerCase().trim()
    if (!searchLower) return dcrPricing
    return dcrPricing.filter((config) => {
      return (
        config.systemSize.toLowerCase().includes(searchLower) ||
        config.inverterSize.toLowerCase().includes(searchLower) ||
        config.panelType.toLowerCase().includes(searchLower) ||
        config.phase.toLowerCase().includes(searchLower) ||
        dcrCatalogInverterLabel().toLowerCase().includes(searchLower) ||
        dcrCatalogPanelRangeLabel(config.panelType).toLowerCase().includes(searchLower) ||
        dcrCatalogPanelRangeLabel("tata").toLowerCase().includes(searchLower)
      )
    })
  }, [searchTerm])

  const brandGroups = useMemo(() => groupDcrPricingByPanelType(filteredConfigs), [filteredConfigs])
  const visiblePanelTypes = useMemo(() => brandGroups.map((group) => group.panelType), [brandGroups])

  useEffect(() => {
    if (visiblePanelTypes.length === 0) return
    if (!activeBrandTab || !visiblePanelTypes.includes(activeBrandTab)) {
      setActiveBrandTab(visiblePanelTypes[0])
    }
  }, [activeBrandTab, visiblePanelTypes])

  const brandTabLabel = (panelType: string): string => {
    if (panelType === "Adani") return "Adani (555W)"
    if (panelType === "Adani Topcon") return "Adani Topcon (620W)"
    if (panelType === "Waaree") return "Waaree (540W)"
    if (panelType === "Premier Energies") return "Premier Energies (600-625W Topcon)"
    if (panelType === "INA") return "INA (500W-600W)"
    if (panelType === "Tata") return "Tata (530W-570W)"
    return panelType
  }

  const handleSelect = (config: SystemPricing) => {
    onSelect(config)
    onOpenChange(false)
    setSearchTerm("")
  }

  const generatePDF = async () => {
    const tableElement = document.getElementById("dcr-config-table")

    if (!tableElement) {
      console.error("Table element not found.")
      return
    }

    try {
      const canvas = await html2canvas(tableElement as HTMLElement, {
        useCORS: true,
        logging: false,
        allowTaint: false,
      })

      const imgWidth = 210
      const imgHeight = (canvas.height * imgWidth) / canvas.width

      const pdf = new jsPDF("p", "mm", "a4")

      pdf.setFontSize(18)
      pdf.text("DCR Configuration Catalog", 105, 15, { align: "center" })
      pdf.setFontSize(12)
      pdf.text("Pre-configured DCR Solar System Options", 105, 22, { align: "center" })

      const pageHeight = 297
      let heightLeft = imgHeight
      let position = 30

      pdf.addImage(canvas.toDataURL("image/jpeg", 0.95), "JPEG", 10, position, imgWidth - 20, imgHeight)
      heightLeft -= pageHeight - position - 10

      while (heightLeft > 10) {
        position = heightLeft - imgHeight
        pdf.addPage()
        pdf.addImage(canvas.toDataURL("image/jpeg", 0.95), "JPEG", 10, position, imgWidth - 20, imgHeight)
        heightLeft -= pageHeight
      }

      const filename = `DCR_Configuration_Catalog_${new Date().toISOString().split("T")[0]}.pdf`
      pdf.save(filename)
    } catch (error) {
      console.error("Error generating PDF:", error)
    }
  }

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-[90vw] md:max-w-[85vw] lg:max-w-[1400px] w-[95vw] sm:w-[90vw] md:w-[85vw] lg:w-[1000px] max-h-[95vh] overflow-hidden flex flex-col p-4 sm:p-5 md:p-6 pr-10 sm:pr-12">
        <DialogHeader className="pb-3 space-y-2 pr-6 sm:pr-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-lg sm:text-xl font-semibold leading-tight">Select DCR Configuration</DialogTitle>
              <DialogDescription className="text-xs sm:text-sm text-muted-foreground mt-1.5 leading-relaxed">
                Choose a pre-configured DCR system. The form will be automatically filled with the selected configuration.
              </DialogDescription>
            </div>
            <Button
              onClick={generatePDF}
              variant="outline"
              size="sm"
              className="flex-shrink-0 h-9 sm:h-10 text-xs sm:text-sm px-3 sm:px-4 w-full sm:w-auto"
            >
              <Download className="w-4 h-4 mr-2" />
              Export PDF
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-3 sm:space-y-4 flex-1 flex flex-col min-h-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by system size, panel brand, phase..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 h-10 sm:h-11 text-sm"
            />
          </div>

          <div className="p-3 sm:p-3.5 bg-muted/50 rounded-lg text-xs sm:text-sm text-muted-foreground leading-relaxed space-y-1">
            <p>
              <strong>Pricings</strong> — Effective from {formatDate(DCR_PRICING_EFFECTIVE_FROM)}, valid till{" "}
              {formatDate(DCR_PRICING_VALID_TILL)}.
            </p>
            <p>
              Inverter size and panel range columns show <strong>As per the set</strong> (package BOM). Actual inverter
              brand and panel watts are filled when you select a row.
            </p>
            <p>
              Brands: <strong>Adani (555W)</strong>, <strong>Adani Topcon (620W)</strong>, <strong>Waaree (540W)</strong>,{" "}
              <strong>Premier Energies (600–625W Topcon)</strong>, <strong>INA (500W–600W)</strong>, <strong>Tata (530W–570W)</strong>.
            </p>
          </div>

          <div
            id="dcr-config-table"
            className="border rounded-lg overflow-hidden flex-1 min-h-0 flex flex-col bg-background shadow-sm space-y-0"
          >
            <div className="overflow-y-auto overflow-x-auto flex-1 relative p-3 sm:p-4 space-y-6">
              {brandGroups.length === 0 ? (
                <p className="text-center text-muted-foreground py-8 text-sm">
                  No configurations found matching your search.
                </p>
              ) : (
                <Tabs value={activeBrandTab} onValueChange={setActiveBrandTab} className="space-y-4">
                  <TabsList className="w-full h-auto flex flex-wrap justify-start gap-2 bg-transparent p-0">
                    {brandGroups.map((group) => (
                      <TabsTrigger key={group.panelType} value={group.panelType} className="px-3 py-1.5 text-xs sm:text-sm">
                        {brandTabLabel(group.panelType)}
                      </TabsTrigger>
                    ))}
                  </TabsList>

                  {brandGroups.map((group) => (
                    <TabsContent key={group.panelType} value={group.panelType} className="space-y-2">
                      <div className="rounded-md border border-primary/20 bg-primary/5 px-4 py-2 text-center">
                        <p className="text-base sm:text-lg font-bold tracking-wide text-primary">{brandTabLabel(group.panelType)}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Effective from {formatDate(DCR_PRICING_EFFECTIVE_FROM)} to {formatDate(DCR_PRICING_VALID_TILL)}
                        </p>
                      </div>
                      <Table className="w-full">
                        <TableHeader>
                          <TableRow className="bg-primary/10 hover:bg-primary/10 border-b">
                            <TableHead className="font-semibold text-sm px-4 py-3 whitespace-nowrap">System Size</TableHead>
                            <TableHead className="font-semibold text-sm px-4 py-3 whitespace-nowrap">Inverter Size</TableHead>
                            <TableHead className="font-semibold text-sm px-4 py-3 whitespace-nowrap">Panel Range</TableHead>
                            <TableHead className="font-semibold text-sm text-right px-4 py-3 whitespace-nowrap">
                              Price (INR)
                            </TableHead>
                            <TableHead className="font-semibold text-sm text-center px-4 py-3 whitespace-nowrap">
                              Action
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {group.rows.map((config, index) => (
                            <TableRow
                              key={`${group.panelType}-${config.systemSize}-${config.phase}-${index}`}
                              className="hover:bg-muted/50 border-b transition-colors"
                            >
                              <TableCell className="text-sm px-4 py-3 whitespace-nowrap">
                                <span className="font-medium">{config.systemSize}</span>
                                <span className="text-muted-foreground ml-1.5">({config.phase})</span>
                              </TableCell>
                              <TableCell className="text-sm px-4 py-3 whitespace-nowrap text-muted-foreground">
                                {dcrCatalogInverterLabel()}
                              </TableCell>
                              <TableCell className="text-sm px-4 py-3 whitespace-nowrap text-muted-foreground">
                                {dcrCatalogPanelRangeLabel(config.panelType)}
                              </TableCell>
                              <TableCell className="text-right text-sm font-semibold px-4 py-3 whitespace-nowrap">
                                ₹{config.price.toLocaleString("en-IN")}
                              </TableCell>
                              <TableCell className="text-center px-4 py-3 whitespace-nowrap">
                                <Button
                                  size="sm"
                                  onClick={() => handleSelect(config)}
                                  className="bg-primary hover:bg-primary/90 text-sm h-8 px-4 font-medium"
                                >
                                  Select
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TabsContent>
                  ))}
                </Tabs>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
