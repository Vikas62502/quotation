/**
 * BACKEND — Presigned S3 URLs for Document Submission (“View uploaded file”)
 *
 * Symptom:
 *   Opening
 *     https://{bucket}.s3.{region}.amazonaws.com/quotation-documents/{id}/aadharBack-….jpeg
 *   returns XML AccessDenied.
 *
 * Cause:
 *   The bucket is private. Browsers need a presigned GET URL, same as site-completion photos:
 *     https://{bucket}.s3.{region}.amazonaws.com/quotation-workflow/{id}/site_completion_image-….jpeg
 *     ?X-Amz-Algorithm=AWS4-HMAC-SHA256
 *     &X-Amz-Credential=…
 *     &X-Amz-Date=…
 *     &X-Amz-Expires=604800
 *     &X-Amz-Signature=…
 *     &X-Amz-SignedHeaders=host
 *
 * Persist the object **key** (or unsigned URL) in the DB. Always **return** a signed GET
 * (TTL 7 days / 604800s) on read and upload.
 *
 * Frontend (`lib/open-quotation-document-preview.ts`, `lib/api.ts` → `api.media.resolvePublicUrl`):
 *   1) If the stored value already has X-Amz-Signature, open it.
 *   2) Else GET view-url (below) and open `data.publicUrl`.
 */

export const QUOTATION_KYC_DOCUMENT_FIELDS = [
  "aadharFront",
  "aadharBack",
  "panImage",
  "electricityBillImage",
  "bankPassbookImage",
  "geotagRoofPhoto",
  "customerWithHousePhoto",
  "propertyDocumentPdf",
  "compliantAadharFront",
  "compliantAadharBack",
  "compliantPanImage",
  "compliantBankPassbookImage",
] as const

export const DOCUMENT_PRESIGN_TTL_SECONDS = 604800

/** Routes the frontend already calls */
export const QUOTATION_DOCUMENT_PRESIGN_ROUTES = {
  dealerViewUrl: "GET /api/quotations/:quotationId/documents/view-url?url=",
  dealerPresignAlias: "GET /api/quotations/:quotationId/documents/presign-url?url=",
  adminViewUrl: "GET /api/admin/quotations/:quotationId/documents/view-url?url=",
  dealerUpload: "POST /api/quotations/:quotationId/documents/upload",
  dealerGetById: "GET /api/quotations/:quotationId",
  dealerList: "GET /api/quotations",
  adminGetById: "GET /api/admin/quotations/:quotationId",
} as const

/**
 * GET view-url query:
 *   url   — encodeURIComponent(private S3 URL or stored key)
 *   field — optional, e.g. aadharBack (fallback if url is missing / not scoped)
 *
 * Success body:
 * {
 *   success: true,
 *   data: {
 *     publicUrl: "https://…amazonaws.com/quotation-documents/QT-…/aadharBack-….jpeg?X-Amz-Algorithm=…",
 *     url: "<same>",
 *     public_url: "<same>"
 *   }
 * }
 *
 * POST upload success `data.url` / `data.publicUrl` / `data[field]` must also be that signed URL,
 * not the unsigned object URL.
 *
 * GET quotation (list + by id) `documents.aadharBack` (and `aadharBackUrl` / `aadharBackPublicUrl`)
 * must be signed. Do not overwrite signed URLs with unsigned `https://bucket.s3.region.amazonaws.com/key`.
 *
 * Scope check: key must contain `quotation-documents/{quotationId}/` (KYC) or
 * `quotation-workflow/{quotationId}/` (installation).
 *
 * Node sketch (AWS SDK v2):
 *
 *   s3.getSignedUrl("getObject", {
 *     Bucket: process.env.AWS_BUCKET_NAME,
 *     Key: "quotation-documents/QT-8MMLAF/aadharBack-1787130772869.jpeg",
 *     Expires: 604800,
 *   })
 */
export const DOCUMENT_PRESIGN_RESPONSE_KEYS = ["publicUrl", "url", "public_url", "signedUrl"] as const
