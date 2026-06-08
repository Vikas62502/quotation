"use client"

import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ImageIcon } from "lucide-react"
import type { AdminVisitReportRow } from "@/lib/visit-report"
import { fetchAdminVisitDetails, type VisitDetailRecord } from "@/lib/visit-details"

interface AdminVisitDetailsDialogProps {
  row: AdminVisitReportRow | null
  open: boolean
  onOpenChange: (open: boolean) => void
  useApi: boolean
}

const hasCompletionContent = (details: VisitDetailRecord) =>
  details.length != null ||
  details.width != null ||
  details.backLegFeet != null ||
  details.midLegFeet != null ||
  details.frontLegFeet != null ||
  Boolean(details.notes?.trim()) ||
  Boolean(details.rowDiagramImage) ||
  Boolean(details.meterImage) ||
  (details.images?.length ?? 0) > 0

export function AdminVisitDetailsDialog({
  row,
  open,
  onOpenChange,
  useApi,
}: AdminVisitDetailsDialogProps) {
  const [details, setDetails] = useState<VisitDetailRecord | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !row) {
      setDetails(null)
      setError(null)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    void fetchAdminVisitDetails({
      quotationId: row.quotationId,
      visitId: row.id,
      dealerName: row.dealerName,
      useApi,
    })
      .then((result) => {
        if (cancelled) return
        if (!result) {
          setError("Could not load visit completion details.")
          setDetails(null)
          return
        }
        setDetails(result)
      })
      .catch(() => {
        if (!cancelled) {
          setError("Could not load visit completion details.")
          setDetails(null)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [open, row, useApi])

  const fallbackNotes = row?.notes?.trim() || undefined

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Completion details</DialogTitle>
          <DialogDescription>Dimensions, photos, and notes entered by the visitor.</DialogDescription>
        </DialogHeader>

        {loading ? (
          <p className="text-sm text-muted-foreground rounded-md border bg-muted/30 px-3 py-2">
            Loading completion details...
          </p>
        ) : null}

        {error ? (
          <p className="text-sm text-amber-900 rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
            {error}
          </p>
        ) : null}

        {details && hasCompletionContent(details) ? (
          <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-4 space-y-4">
            <div className="flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-blue-700" />
              <p className="text-sm font-semibold text-blue-900">Completion details (visitor entered)</p>
            </div>

            {(details.length != null ||
              details.width != null ||
              details.backLegFeet != null ||
              details.midLegFeet != null ||
              details.frontLegFeet != null) && (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {details.length != null ? (
                  <div className="rounded-md border bg-white p-3">
                    <p className="text-[11px] text-muted-foreground">Length</p>
                    <p className="text-sm font-semibold">
                      {details.length}
                      {details.unit ? ` ${details.unit}` : ""}
                    </p>
                  </div>
                ) : null}
                {details.width != null ? (
                  <div className="rounded-md border bg-white p-3">
                    <p className="text-[11px] text-muted-foreground">Width</p>
                    <p className="text-sm font-semibold">
                      {details.width}
                      {details.unit ? ` ${details.unit}` : ""}
                    </p>
                  </div>
                ) : null}
                {details.backLegFeet != null ? (
                  <div className="rounded-md border bg-white p-3">
                    <p className="text-[11px] text-muted-foreground">Back leg (ft)</p>
                    <p className="text-sm font-semibold">{details.backLegFeet}</p>
                  </div>
                ) : null}
                {details.midLegFeet != null ? (
                  <div className="rounded-md border bg-white p-3">
                    <p className="text-[11px] text-muted-foreground">Mid leg (ft)</p>
                    <p className="text-sm font-semibold">{details.midLegFeet}</p>
                  </div>
                ) : null}
                {details.frontLegFeet != null ? (
                  <div className="rounded-md border bg-white p-3">
                    <p className="text-[11px] text-muted-foreground">Front leg (ft)</p>
                    <p className="text-sm font-semibold">{details.frontLegFeet}</p>
                  </div>
                ) : null}
              </div>
            )}

            {details.notes?.trim() ? (
              <div className="rounded-md border bg-white p-3 text-sm">
                <p className="text-[11px] text-muted-foreground mb-1">Visit notes</p>
                <p className="font-medium">{details.notes}</p>
              </div>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2">
              {details.rowDiagramImage ? (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Row diagram</p>
                  <a href={details.rowDiagramImage} target="_blank" rel="noreferrer">
                    <img
                      src={details.rowDiagramImage}
                      alt="Row diagram"
                      className="max-h-44 rounded-md border bg-white object-contain"
                    />
                  </a>
                </div>
              ) : null}
              {details.meterImage ? (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Meter image</p>
                  <a href={details.meterImage} target="_blank" rel="noreferrer">
                    <img
                      src={details.meterImage}
                      alt="Meter"
                      className="max-h-44 rounded-md border bg-white object-contain"
                    />
                  </a>
                </div>
              ) : null}
            </div>

            {details.images && details.images.length > 0 ? (
              <div>
                <p className="text-xs text-muted-foreground mb-2">Site images ({details.images.length})</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {details.images.map((img, idx) => (
                    <a key={`${details.id}-${idx}`} href={img} target="_blank" rel="noreferrer">
                      <img
                        src={img}
                        alt={`Site ${idx + 1}`}
                        className="h-28 w-full rounded-md border bg-white object-cover"
                      />
                    </a>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : !loading && !error && fallbackNotes ? (
          <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-4 space-y-1">
            <p className="text-[11px] text-muted-foreground">Visit notes</p>
            <p className="text-sm font-medium">{fallbackNotes}</p>
          </div>
        ) : !loading && !error ? (
          <p className="text-sm text-muted-foreground">No completion details recorded for this visit.</p>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
