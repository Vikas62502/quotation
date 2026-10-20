"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Download, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { savePdfForDevice } from "@/lib/mobile-pdf"
import { exportProposalPagesToPdf } from "@/lib/quotation-pdf-export"
import { formatPersonName } from "@/lib/name-display"
import type { AdminSubvendorRecord } from "@/lib/admin-subvendors"
import type { OfficeOutsideRecord } from "@/lib/office-outside-accounts"
import { OfficeOutsideQuotationPage } from "@/components/office-outside-quotation-page"
import { cn } from "@/lib/utils"

const PRINT_ROOT_ID = "office-outside-slip-print"
const PAGE_WIDTH_PX = (210 / 25.4) * 96
const PAGE_HEIGHT_PX = (297 / 25.4) * 96

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  record: OfficeOutsideRecord | null
  vendor?: Pick<AdminSubvendorRecord, "name" | "contactName" | "mobile" | "email"> | null
  notes: string
  onNotesChange: (value: string) => void
  onSave: () => void
}

export function OfficeOutsideSlipDialog({
  open,
  onOpenChange,
  record,
  vendor,
  notes,
  onNotesChange,
  onSave,
}: Props) {
  const { toast } = useToast()
  const [downloading, setDownloading] = useState(false)
  const [scale, setScale] = useState(0.72)

  useEffect(() => {
    if (!open) return
    const fit = () => {
      const chrome = 168
      const maxW = Math.max(280, window.innerWidth - 40)
      const maxH = Math.max(320, window.innerHeight - chrome)
      setScale(Math.min(1, maxW / PAGE_WIDTH_PX, maxH / PAGE_HEIGHT_PX))
    }
    fit()
    window.addEventListener("resize", fit)
    return () => window.removeEventListener("resize", fit)
  }, [open])

  const downloadPdf = async () => {
    if (!record) return
    setDownloading(true)
    try {
      const name =
        formatPersonName(record.customer?.firstName, record.customer?.lastName, record.customerName) ||
        "Customer"
      const safeName = name.replace(/[^\w-]+/g, "_")
      await exportProposalPagesToPdf(
        PRINT_ROOT_ID,
        `Quotation_${safeName}_${record.id}.pdf`,
        savePdfForDevice,
      )
    } catch (error) {
      toast({
        title: "Could not download quotation",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "destructive",
      })
    } finally {
      setDownloading(false)
    }
  }

  const previewW = Math.round(PAGE_WIDTH_PX * scale)
  const previewH = Math.round(PAGE_HEIGHT_PX * scale)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "w-fit overflow-hidden p-3 gap-2 sm:max-w-none",
          "max-w-[calc(100vw-1.25rem)]",
        )}
      >
        <DialogHeader className="gap-0.5 pr-6">
          <DialogTitle className="text-base">Requirement slip</DialogTitle>
          <DialogDescription className="text-xs">
            One-page quotation: customer, selected dealer, and required products.
          </DialogDescription>
        </DialogHeader>
        {record ? (
          <div className="space-y-2">
            <div
              className="overflow-hidden rounded-md border bg-white"
              style={{ width: previewW, height: previewH }}
            >
              <div
                style={{
                  width: PAGE_WIDTH_PX,
                  height: PAGE_HEIGHT_PX,
                  transform: `scale(${scale})`,
                  transformOrigin: "top left",
                }}
              >
                <OfficeOutsideQuotationPage
                  record={record}
                  vendor={vendor}
                  notes={notes}
                  hidden={false}
                  rootId="office-outside-slip-preview"
                />
              </div>
            </div>
            <OfficeOutsideQuotationPage
              record={record}
              vendor={vendor}
              notes={notes}
              hidden
              rootId={PRINT_ROOT_ID}
            />
            <div className="flex items-center gap-2">
              <Label className="text-xs shrink-0">Notes</Label>
              <Input
                value={notes}
                onChange={(e) => onNotesChange(e.target.value)}
                placeholder="Site notes for this slip"
                className="h-8"
              />
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={downloading}
                onClick={() => void downloadPdf()}
              >
                {downloading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Download className="w-4 h-4 mr-2" />
                )}
                Download
              </Button>
              <Button type="button" size="sm" onClick={onSave}>
                Save slip
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
