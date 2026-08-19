import { pickMediaUrlFromValue, isPresignedS3Url, toPublicOpenHref } from "@/lib/media-url"
import { resolvePublicOpenMediaUrl } from "@/lib/resolve-public-media-url"

/** Open the stored document as a presigned S3 URL (or a local blob for a newly chosen File). */
export function openQuotationDocumentPreview(value: unknown, quotationId?: string) {
  if (typeof File !== "undefined" && value instanceof File) {
    const objectUrl = URL.createObjectURL(value)
    window.open(objectUrl, "_blank", "noopener,noreferrer")
    setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000)
    return
  }

  const raw = toPublicOpenHref(value) || pickMediaUrlFromValue(value) || ""
  if (!raw.trim()) return

  if (isPresignedS3Url(raw)) {
    window.open(raw, "_blank", "noopener,noreferrer")
    return
  }

  const popup = window.open("about:blank", "_blank")
  void resolvePublicOpenMediaUrl(raw, quotationId).then((href) => {
    const next = href || raw
    if (popup && !popup.closed) {
      popup.location.replace(next)
      return
    }
    window.open(next, "_blank", "noopener,noreferrer")
  })
}
