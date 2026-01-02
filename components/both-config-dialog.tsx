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
import { bothPricing, type BothSystemPricing } from "@/lib/pricing-tables"
import { Search } from "lucide-react"

interface BothConfigDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (config: BothSystemPricing) => void
}

export function BothConfigDialog({ open, onOpenChange, onSelect }: BothConfigDialogProps) {
  const [searchTerm, setSearchTerm] = useState("")

  // Filter configurations based on search
  const filteredConfigs = bothPricing.filter((config) => {
    const searchLower = searchTerm.toLowerCase()
    return (
      config.systemSize.toLowerCase().includes(searchLower) ||
      config.inverterSize.toLowerCase().includes(searchLower) ||
      config.dcrCapacity.toLowerCase().includes(searchLower) ||
      config.nonDcrCapacity.toLowerCase().includes(searchLower) ||
      config.panelType.toLowerCase().includes(searchLower) ||
      config.phase.toLowerCase().includes(searchLower)
    )
  })

  const handleSelect = (config: BothSystemPricing) => {
    onSelect(config)
    onOpenChange(false)
    setSearchTerm("")
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[90vw] w-[90vw] max-h-[90vh] overflow-hidden flex flex-col p-6">
        <DialogHeader>
          <DialogTitle>Select BOTH (DCR + NON DCR) Configuration</DialogTitle>
          <DialogDescription>
            Choose a pre-configured BOTH system with mixed DCR and NON DCR panels. The form will be automatically filled with the selected configuration.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 flex flex-col min-h-0">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by system size, inverter size, DCR capacity, NON DCR capacity..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Note */}
          <div className="p-3 bg-muted/50 rounded-lg text-sm text-muted-foreground">
            <strong>Note:</strong> Prices may vary based on customer requirements, site conditions, and system specifications. BOTH systems include both DCR (with subsidy) and NON DCR panels.
          </div>

          {/* Table */}
          <div className="border rounded-lg overflow-hidden flex-1 min-h-0 flex flex-col">
            <div className="overflow-y-auto overflow-x-auto flex-1">
              <Table className="min-w-full">
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow className="bg-primary/10">
                    <TableHead className="font-semibold min-w-[150px]">System Size</TableHead>
                    <TableHead className="font-semibold min-w-[120px]">Inverter Size</TableHead>
                    <TableHead className="font-semibold min-w-[150px]">Panel Type</TableHead>
                    <TableHead className="font-semibold min-w-[130px]">DCR Capacity</TableHead>
                    <TableHead className="font-semibold min-w-[140px]">NON DCR Capacity</TableHead>
                    <TableHead className="font-semibold text-right min-w-[130px]">Price (INR)</TableHead>
                    <TableHead className="font-semibold text-center min-w-[100px]">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                {filteredConfigs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      No configurations found matching your search.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredConfigs.map((config, index) => (
                    <TableRow key={index} className="hover:bg-muted/50">
                      <TableCell className="font-medium">
                        {config.systemSize} ({config.phase})
                      </TableCell>
                      <TableCell>{config.inverterSize}</TableCell>
                      <TableCell>{config.panelType}</TableCell>
                      <TableCell className="text-green-600 font-medium">
                        {config.dcrCapacity}
                      </TableCell>
                      <TableCell className="text-blue-600 font-medium">
                        {config.nonDcrCapacity}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        ₹{config.price.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-center">
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


