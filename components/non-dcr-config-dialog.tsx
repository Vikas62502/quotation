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
import { nonDcrPricing, type SystemPricing } from "@/lib/pricing-tables"
import { Search } from "lucide-react"

interface NonDcrConfigDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (config: SystemPricing) => void
}

export function NonDcrConfigDialog({ open, onOpenChange, onSelect }: NonDcrConfigDialogProps) {
  const [searchTerm, setSearchTerm] = useState("")

  // Filter configurations based on search
  const filteredConfigs = nonDcrPricing.filter((config) => {
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-[90vw] md:max-w-[85vw] lg:max-w-[1400px] w-[95vw] sm:w-[90vw] md:w-[85vw] lg:w-[1000px] max-h-[95vh] overflow-hidden flex flex-col p-4 sm:p-5 md:p-6 pr-10 sm:pr-12">
        <DialogHeader className="pb-3 space-y-2 pr-6 sm:pr-8">
          <DialogTitle className="text-lg sm:text-xl font-semibold leading-tight">Select NON DCR Configuration</DialogTitle>
          <DialogDescription className="text-xs sm:text-sm text-muted-foreground mt-1.5 leading-relaxed">
            Choose a pre-configured NON DCR system. The form will be automatically filled with the selected configuration.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 sm:space-y-4 flex-1 flex flex-col min-h-0">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by system size, inverter size, panel type..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 h-10 sm:h-11 text-sm"
            />
          </div>

          {/* Note */}
          <div className="p-3 sm:p-3.5 bg-muted/50 rounded-lg text-xs sm:text-sm text-muted-foreground leading-relaxed">
            <strong>Note:</strong> Prices may vary based on customer requirements, site conditions, and system specifications. NON DCR systems are not eligible for subsidies.
          </div>

          {/* Table */}
          <div className="border rounded-lg overflow-hidden flex-1 min-h-0 flex flex-col bg-background shadow-sm">
            <div className="overflow-y-auto overflow-x-auto flex-1 relative">
              <Table className="w-full">
                <TableHeader className="sticky top-0 z-30">
                  <TableRow className="bg-primary/10 hover:bg-primary/10 border-b">
                    <TableHead className="font-semibold text-sm px-4 sm:px-5 md:px-6 py-3 sm:py-3.5 whitespace-nowrap bg-primary/10">System Size</TableHead>
                    <TableHead className="font-semibold text-sm px-4 sm:px-5 md:px-6 py-3 sm:py-3.5 whitespace-nowrap bg-primary/10">Inverter Size</TableHead>
                    <TableHead className="font-semibold text-sm px-4 sm:px-5 md:px-6 py-3 sm:py-3.5 whitespace-nowrap bg-primary/10">Panel Type</TableHead>
                    <TableHead className="font-semibold text-sm text-right px-4 sm:px-5 md:px-6 py-3 sm:py-3.5 whitespace-nowrap bg-primary/10">Price (INR)</TableHead>
                    <TableHead className="font-semibold text-sm text-center px-4 sm:px-5 md:px-6 py-3 sm:py-3.5 whitespace-nowrap bg-primary/10">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                {filteredConfigs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8 sm:py-10 text-sm">
                      No configurations found matching your search.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredConfigs.map((config, index) => (
                    <TableRow key={index} className="hover:bg-muted/50 border-b transition-colors">
                      <TableCell className="text-sm px-4 sm:px-5 md:px-6 py-3 sm:py-4 whitespace-nowrap">
                        <span className="font-medium">{config.systemSize}</span>
                        <span className="text-muted-foreground ml-1.5">({config.phase})</span>
                      </TableCell>
                      <TableCell className="text-sm px-4 sm:px-5 md:px-6 py-3 sm:py-4 whitespace-nowrap">{config.inverterSize}</TableCell>
                      <TableCell className="text-sm px-4 sm:px-5 md:px-6 py-3 sm:py-4 whitespace-nowrap font-medium">{config.panelType}</TableCell>
                      <TableCell className="text-right text-sm font-semibold px-4 sm:px-5 md:px-6 py-3 sm:py-4 whitespace-nowrap">
                        ₹{config.price.toLocaleString("en-IN")}
                      </TableCell>
                      <TableCell className="text-center px-4 sm:px-5 md:px-6 py-3 sm:py-4 whitespace-nowrap">
                        <Button
                          size="sm"
                          onClick={() => handleSelect(config)}
                          className="bg-primary hover:bg-primary/90 text-sm h-8 sm:h-9 px-4 sm:px-5 font-medium"
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



