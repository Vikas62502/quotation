"use client"

import { useState } from "react"
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
import { dcrPricing, type SystemPricing } from "@/lib/pricing-tables"
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

  // Filter configurations based on search
  const filteredConfigs = dcrPricing.filter((config) => {
    const searchLower = searchTerm.toLowerCase()
    return (
      config.systemSize.toLowerCase().includes(searchLower) ||
      config.inverterSize.toLowerCase().includes(searchLower) ||
      config.panelType.toLowerCase().includes(searchLower) ||
      config.phase.toLowerCase().includes(searchLower)
    )
  })

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
        windowWidth: tableElement.scrollWidth,
        windowHeight: tableElement.scrollHeight,
        allowTaint: false,
      })

      const imgWidth = 210 // A4 width in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width

      const pdf = new jsPDF("p", "mm", "a4")
      
      // Add title
      pdf.setFontSize(18)
      pdf.text("DCR Configuration Catalog", 105, 15, { align: "center" })
      pdf.setFontSize(12)
      pdf.text("Pre-configured DCR Solar System Options", 105, 22, { align: "center" })
      
      // Add the table image
      const pageHeight = 297 // A4 height in mm
      let heightLeft = imgHeight
      let position = 30 // Start below title

      // Add first page
      pdf.addImage(canvas.toDataURL("image/jpeg", 0.95), "JPEG", 10, position, imgWidth - 20, imgHeight)
      heightLeft -= (pageHeight - position - 10)

      // Add additional pages if needed
      while (heightLeft > 10) {
        position = heightLeft - imgHeight
        pdf.addPage()
        pdf.addImage(canvas.toDataURL("image/jpeg", 0.95), "JPEG", 10, position, imgWidth - 20, imgHeight)
        heightLeft -= pageHeight
      }

      // Generate filename
      const filename = `DCR_Configuration_Catalog_${new Date().toISOString().split("T")[0]}.pdf`

      // Save
      pdf.save(filename)
    } catch (error) {
      console.error("Error generating PDF:", error)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[90vw] w-[90vw] max-h-[90vh] overflow-hidden flex flex-col p-6">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <DialogTitle>Select DCR Configuration</DialogTitle>
              <DialogDescription>
                Choose a pre-configured DCR system. The form will be automatically filled with the selected configuration.
              </DialogDescription>
            </div>
            <Button
              onClick={generatePDF}
              variant="outline"
              size="sm"
              className="ml-4"
            >
              <Download className="w-4 h-4 mr-2" />
              Export PDF
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-4 flex-1 flex flex-col min-h-0">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by system size, inverter size, panel type..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Note */}
          <div className="p-3 bg-muted/50 rounded-lg text-sm text-muted-foreground">
            <strong>Note:</strong> Prices may vary based on customer requirements, site conditions, and system specifications.
          </div>

          {/* Table */}
          <div id="dcr-config-table" className="border rounded-lg overflow-hidden flex-1 min-h-0 flex flex-col">
            <div className="overflow-y-auto flex-1">
              <Table className="w-full">
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow className="bg-primary/10">
                    <TableHead className="font-semibold w-[18%]">System Size</TableHead>
                    <TableHead className="font-semibold w-[15%]">Inverter Size</TableHead>
                    <TableHead className="font-semibold w-[15%]">Panel Type</TableHead>
                    <TableHead className="font-semibold text-right w-[25%]">Price (INR)</TableHead>
                    <TableHead className="font-semibold text-center w-[20%]">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                {filteredConfigs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      No configurations found matching your search.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredConfigs.map((config, index) => (
                    <TableRow key={index} className="hover:bg-muted/50">
                      <TableCell className="font-medium w-[20%]">
                        {config.systemSize} ({config.phase})
                      </TableCell>
                      <TableCell className="w-[15%]">{config.inverterSize}</TableCell>
                      <TableCell className="w-[20%]">{config.panelType}</TableCell>
                      <TableCell className="text-right font-medium w-[25%]">
                        ₹{config.price.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-center w-[20%]">
                        <Button
                          size="sm"
                          onClick={() => handleSelect(config)}
                          className="bg-primary hover:bg-primary/90"
                        >
                          Select
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}



