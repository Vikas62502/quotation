import { api } from "@/lib/api"
import { normalizeMediaUrl } from "@/lib/media-url"
import type { Quotation } from "@/lib/quotation-context"
import { extractVisitsFromApiResponse, normalizeVisitStatus, type VisitStatus } from "@/lib/visit-report"

export interface VisitVisitorAssignment {
  visitorId: string
  visitorName: string
}

export interface VisitDetailRecord {
  id: string
  quotationId: string
  date: string
  time: string
  location: string
  locationLink?: string
  status: VisitStatus
  notes?: string
  feedback?: string
  rejectionReason?: string
  length?: number
  width?: number
  height?: number
  backLegFeet?: number
  midLegFeet?: number
  frontLegFeet?: number
  unit?: "feet" | "cm"
  rowDiagramImage?: string
  meterImage?: string
  images?: string[]
  visitors?: VisitVisitorAssignment[]
  customerName: string
  customerMobile: string
  dealerName: string
}

const resolveVisitTimeRange = (visit: Record<string, unknown>) => {
  const start = String(visit?.visitStartTime || visit?.startTime || "").trim()
  const end = String(visit?.visitEndTime || visit?.endTime || "").trim()
  if (start && end) return `${start} - ${end}`
  const explicitRange = String(visit?.visitTimeRange || visit?.timeRange || "").trim()
  if (explicitRange) return explicitRange
  return String(visit?.visitTime || visit?.time || "").trim()
}

const pickFirstNumber = (...values: unknown[]): number | undefined => {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value
    if (typeof value === "string" && value.trim() !== "") {
      const parsed = Number.parseFloat(value)
      if (Number.isFinite(parsed)) return parsed
    }
  }
  return undefined
}

const getSafeLastName = (lastName?: string) => {
  const cleaned = (lastName || "").trim()
  return cleaned.toLowerCase() === "na" ? "" : cleaned
}

const extractImageList = (visit: Record<string, unknown>): string[] => {
  const sources = [
    visit?.images,
    visit?.siteImages,
    visit?.site_images,
    visit?.completionImages,
    visit?.completion_images,
    (visit?.documents as Record<string, unknown> | undefined)?.siteCompletionImages,
    (visit?.documents as Record<string, unknown> | undefined)?.site_completion_images,
    (visit?.documents as Record<string, unknown> | undefined)?.images,
  ]
  const result: string[] = []
  sources.forEach((source) => {
    if (!Array.isArray(source)) return
    source.forEach((item) => {
      const maybeUrl =
        typeof item === "string"
          ? item
          : (item as Record<string, unknown>)?.url ||
            (item as Record<string, unknown>)?.s3Url ||
            (item as Record<string, unknown>)?.s3_url ||
            (item as Record<string, unknown>)?.location ||
            (item as Record<string, unknown>)?.path ||
            (item as Record<string, unknown>)?.key
      const normalized = normalizeMediaUrl(maybeUrl)
      if (normalized && !result.includes(normalized)) result.push(normalized)
    })
  })
  return result
}

export const mapVisitDetailFromApi = (
  visit: Record<string, unknown>,
  context?: {
    quotation?: Quotation
    dealerName?: string
  },
): VisitDetailRecord => {
  const completion =
    (visit?.completionDetails as Record<string, unknown> | undefined) ||
    (visit?.completion_details as Record<string, unknown> | undefined) ||
    {}
  const dimensions =
    (visit?.siteDimensions as Record<string, unknown> | undefined) ||
    (visit?.site_dimensions as Record<string, unknown> | undefined) ||
    (completion.siteDimensions as Record<string, unknown> | undefined) ||
    (completion.site_dimensions as Record<string, unknown> | undefined) ||
    {}
  const documents = (visit?.documents as Record<string, unknown> | undefined) || {}
  const quotation = context?.quotation
  const customer =
    (visit?.customer as Record<string, unknown> | undefined) ||
    (quotation?.customer as unknown as Record<string, unknown>) ||
    {}
  const dealerPayload = visit?.dealer as Record<string, unknown> | undefined
  const customerFirst = String(customer.firstName || "").trim()
  const customerLast = getSafeLastName(String(customer.lastName || ""))
  const rawVisitors = Array.isArray(visit?.visitors)
    ? visit.visitors
    : Array.isArray(visit?.otherVisitors)
      ? visit.otherVisitors
      : []

  return {
    id: String(visit?.id || ""),
    quotationId: String(visit?.quotationId || quotation?.id || ""),
    date: String(visit?.visitDate || visit?.date || ""),
    time: resolveVisitTimeRange(visit),
    location: String(visit?.location || visit?.visitLocation || ""),
    locationLink: visit?.locationLink
      ? String(visit.locationLink)
      : visit?.location_link
        ? String(visit.location_link)
        : undefined,
    status: normalizeVisitStatus(String(visit?.status || visit?.visitStatus || visit?.visit_status || "")),
    notes: visit?.notes ? String(visit.notes) : completion.notes ? String(completion.notes) : undefined,
    feedback: visit?.feedback ? String(visit.feedback) : undefined,
    rejectionReason: visit?.rejectionReason
      ? String(visit.rejectionReason)
      : visit?.rejection_reason
        ? String(visit.rejection_reason)
        : undefined,
    length: pickFirstNumber(
      visit?.length,
      visit?.lengthFeet,
      visit?.length_feet,
      dimensions.length,
      dimensions.lengthFeet,
      dimensions.length_feet,
    ),
    width: pickFirstNumber(
      visit?.width,
      visit?.widthFeet,
      visit?.width_feet,
      dimensions.width,
      dimensions.widthFeet,
      dimensions.width_feet,
    ),
    height: pickFirstNumber(visit?.height, dimensions.height, dimensions.heightFeet, dimensions.height_feet),
    backLegFeet: pickFirstNumber(
      visit?.backLegFeet,
      visit?.back_leg_feet,
      dimensions.backLegFeet,
      dimensions.back_leg_feet,
    ),
    midLegFeet: pickFirstNumber(visit?.midLegFeet, visit?.mid_leg_feet, dimensions.midLegFeet, dimensions.mid_leg_feet),
    frontLegFeet: pickFirstNumber(
      visit?.frontLegFeet,
      visit?.front_leg_feet,
      dimensions.frontLegFeet,
      dimensions.front_leg_feet,
    ),
    unit: (visit?.unit || dimensions.unit || completion.unit || "feet") as "feet" | "cm",
    rowDiagramImage: normalizeMediaUrl(
      visit?.rowDiagramImage ||
        visit?.row_diagram_image ||
        completion.rowDiagramImage ||
        completion.row_diagram_image ||
        documents.rowDiagramImage ||
        documents.row_diagram_image ||
        documents.rowDiagram ||
        documents.row_diagram,
    ),
    meterImage: normalizeMediaUrl(
      visit?.meterImage ||
        visit?.meter_image ||
        completion.meterImage ||
        completion.meter_image ||
        documents.meterImage ||
        documents.meter_image ||
        documents.meterPhoto ||
        documents.meter_photo,
    ),
    images: extractImageList(visit),
    visitors: (rawVisitors as Record<string, unknown>[])
      .map((item) => ({
        visitorId: String(item?.visitorId || item?.id || ""),
        visitorName: String(item?.visitorName || item?.name || "").trim(),
      }))
      .filter((item) => item.visitorId || item.visitorName),
    customerName: `${customerFirst} ${customerLast}`.trim() || "N/A",
    customerMobile: String(customer.mobile || "").trim(),
    dealerName:
      context?.dealerName ||
      `${String(dealerPayload?.firstName || "").trim()} ${String(dealerPayload?.lastName || "").trim()}`.trim() ||
      "N/A",
  }
}

export async function fetchAdminVisitDetails(options: {
  quotationId: string
  visitId: string
  dealerName?: string
  quotation?: Quotation
  useApi: boolean
}): Promise<VisitDetailRecord | null> {
  const { quotationId, visitId, dealerName, quotation, useApi } = options
  if (!quotationId || !visitId) return null

  if (useApi) {
    try {
      const response = await api.visits.getByQuotation(quotationId)
      const visits = extractVisitsFromApiResponse(response)
      const matched = visits.find((item) => String(item?.id || "") === visitId)
      if (!matched) return null
      return mapVisitDetailFromApi(matched, { quotation, dealerName })
    } catch {
      return null
    }
  }

  const stored = localStorage.getItem(`visits_${quotationId}`)
  if (!stored) return null
  const visits = JSON.parse(stored) as Record<string, unknown>[]
  const matched = visits.find((item) => String(item?.id || "") === visitId)
  if (!matched) return null
  return mapVisitDetailFromApi(
    {
      ...matched,
      quotationId,
      quotation,
    },
    { quotation, dealerName },
  )
}
