import type { Quotation } from "@/lib/quotation-context"
import {
  mergeQuotationProductsForDisplay,
  preserveInaDisplayFromPrior,
} from "@/lib/quotation-api-payload"
import { mergeQuotationProductSources, omitEmptyProductsField } from "@/lib/merge-quotation-products"
import { flattenWrappedQuotationRow } from "@/lib/operational-install-queue"
import { normalizeQuotationTimestamps } from "@/lib/quotation-proposal-document"

type RecordLike = Record<string, unknown>

/** Merge GET-by-id (or admin detail) payload into a list row for kW / product display. */
export function applyQuotationDetailToRow<T extends Quotation>(
  row: T,
  detailRaw: unknown,
): T {
  const detail = omitEmptyProductsField(flattenWrappedQuotationRow(detailRaw) as RecordLike)
  const priorProducts = mergeQuotationProductsForDisplay(row)
  const apiMerged = mergeQuotationProductSources({
    ...row,
    ...detail,
  }) as Quotation["products"]
  const mergedProducts = preserveInaDisplayFromPrior(priorProducts, apiMerged)

  const detailPricing =
    detail.pricing && typeof detail.pricing === "object" && !Array.isArray(detail.pricing)
      ? (detail.pricing as RecordLike)
      : null

  const qp =
    detail.quotationProduct ??
    detail.QuotationProduct ??
    detail.quotation_product ??
    (row as RecordLike).quotationProduct

  const timestamps = normalizeQuotationTimestamps({ ...row, ...detail })

  return {
    ...row,
    ...detail,
    id: String(row.id || detail.id || ""),
    createdAt: timestamps.createdAt ?? row.createdAt,
    updatedAt: timestamps.updatedAt ?? row.updatedAt,
    validUntil: timestamps.validUntil ?? row.validUntil,
    customer: row.customer?.firstName
      ? row.customer
      : (detail.customer as T["customer"]) || row.customer,
    products: mergedProducts,
    quotationProduct: qp,
    pricing: detailPricing ?? (row as RecordLike).pricing,
    subtotal:
      Number(detailPricing?.subtotal) ||
      Number(detail.subtotal) ||
      Number(detail.totalAmount) ||
      row.subtotal,
    totalAmount: Number(detailPricing?.totalAmount) || row.totalAmount,
    finalAmount:
      Number(detailPricing?.finalAmount) ||
      Number(detail.finalAmount) ||
      row.finalAmount,
    statusApprovedAt:
      (detail.statusApprovedAt as string | undefined) ??
      (detail.status_approved_at as string | undefined) ??
      (detail.approvedAt as string | undefined) ??
      row.statusApprovedAt,
    dealerId: String(detail.dealerId || detail.dealer_id || (detail.dealer as RecordLike)?.id || row.dealerId || ""),
    dealer: (detail.dealer as T["dealer"]) || row.dealer,
  } as T
}
