import { api } from "@/lib/api"
import {
  isAmazonS3ObjectUrl,
  isPresignedS3Url,
  s3UrlToPublicCdnUrl,
  toPublicOpenHref,
} from "@/lib/media-url"

/**
 * Resolve a stored media reference to a URL the browser can open (presigned GET, CDN, or API).
 * Raw `https://bucket.s3.region.amazonaws.com/key` URLs are private unless the bucket is public-read.
 */
export async function resolvePublicOpenMediaUrl(
  raw: string,
  quotationId?: string,
): Promise<string> {
  const initial = toPublicOpenHref(raw) || raw.trim()
  if (!initial) return raw

  if (isPresignedS3Url(initial)) return initial

  const fromApi = await api.media.resolvePublicUrl(initial, quotationId)
  if (fromApi) {
    const opened = toPublicOpenHref(fromApi) || fromApi
    if (isPresignedS3Url(opened) || !isAmazonS3ObjectUrl(opened)) return opened
    return opened
  }

  if (!isAmazonS3ObjectUrl(initial)) return initial

  const cdn = s3UrlToPublicCdnUrl(initial)
  if (cdn) return cdn

  return initial
}
