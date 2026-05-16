import { API_CONFIG } from "@/lib/api-config"

const apiBaseTrimmed = () => API_CONFIG.baseURL.replace(/\/+$/, "")

export function getApiOrigin(): string {
  return apiBaseTrimmed().replace(/\/api\/?$/i, "")
}

/** Prefer explicit public URL fields from API document objects. */
export function pickMediaUrlFromValue(raw: unknown): string | undefined {
  if (raw == null) return undefined
  if (typeof raw === "string") return normalizeMediaUrl(raw)
  if (typeof raw !== "object") return undefined
  const o = raw as Record<string, unknown>
  const candidates = [
    o.publicUrl,
    o.public_url,
    o.signedUrl,
    o.signed_url,
    o.url,
    o.fileUrl,
    o.file_url,
    o.location,
    o.path,
    o.key,
    o.href,
    o.src,
  ]
  for (const c of candidates) {
    const normalized = normalizeMediaUrl(c)
    if (normalized) return normalized
  }
  return undefined
}

/** Turn API-stored paths (relative, s3://, protocol-relative) into a browser-openable URL. */
export function normalizeMediaUrl(raw: unknown): string | undefined {
  if (raw == null) return undefined
  const value = typeof raw === "string" ? raw.trim() : ""
  if (!value) return undefined

  const normalizeLikelyDoubleEncodedS3Url = (urlStr: string) => {
    try {
      const parsed = new URL(urlStr)
      const host = parsed.hostname.toLowerCase()
      if (!host.includes("amazonaws.com")) return urlStr
      let nextPath = parsed.pathname
      for (let i = 0; i < 2; i += 1) {
        if (!nextPath.includes("%25")) break
        nextPath = decodeURIComponent(nextPath)
      }
      if (nextPath !== parsed.pathname) {
        parsed.pathname = nextPath
        return parsed.toString()
      }
      return urlStr
    } catch {
      return urlStr
    }
  }

  if (
    value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("data:") ||
    value.startsWith("blob:")
  ) {
    return normalizeLikelyDoubleEncodedS3Url(value)
  }
  if (value.startsWith("//")) return `https:${value}`

  const apiBase = apiBaseTrimmed()
  const apiOrigin = getApiOrigin()

  if (value.startsWith("/")) {
    if (value.startsWith("/api/")) {
      return `${apiBase}${value.slice(4)}`
    }
    if (
      value.startsWith("/uploads/") ||
      value.startsWith("/files/") ||
      value.startsWith("/media/") ||
      value.startsWith("/storage/")
    ) {
      return `${apiOrigin}${value}`
    }
    if (typeof window !== "undefined") return `${window.location.origin}${value}`
    return `${apiOrigin}${value}`
  }

  if (value.startsWith("s3://")) {
    const withoutScheme = value.replace(/^s3:\/\//, "")
    const slashIdx = withoutScheme.indexOf("/")
    if (slashIdx > 0) {
      const bucket = withoutScheme.slice(0, slashIdx)
      const key = withoutScheme.slice(slashIdx + 1)
      if (bucket.includes(".")) {
        return `https://${bucket}/${key}`
      }
      return `https://${bucket}.s3.amazonaws.com/${key}`
    }
  }

  const mediaBase = String(process.env.NEXT_PUBLIC_MEDIA_BASE_URL || "").trim().replace(/\/+$/, "")
  if (mediaBase) return `${mediaBase}/${value.replace(/^\/+/, "")}`
  return `${apiOrigin}/${value.replace(/^\/+/, "")}`
}

/** Same URL used for thumbnail `src` and “Open link” href. */
export function toPublicOpenHref(raw: unknown): string | undefined {
  const normalized = pickMediaUrlFromValue(raw) ?? normalizeMediaUrl(raw)
  if (!normalized) return undefined

  if (typeof window === "undefined") return normalized

  try {
    const parsed = new URL(normalized)
    const pageOrigin = window.location.origin
    const apiOrigin = getApiOrigin()
    if (parsed.origin === pageOrigin && parsed.pathname.startsWith("/api/")) {
      return `${apiBaseTrimmed()}${parsed.pathname.slice(4)}`
    }
    if (parsed.origin === pageOrigin && apiOrigin && parsed.pathname.startsWith("/uploads")) {
      return `${apiOrigin}${parsed.pathname}`
    }
  } catch {
    // keep normalized
  }

  return normalized
}

export function isAmazonS3ObjectUrl(url: string): boolean {
  try {
    return new URL(url).hostname.toLowerCase().includes("amazonaws.com")
  } catch {
    return false
  }
}

/** True when URL already includes SigV4 query params (browser can GET without IAM). */
export function isPresignedS3Url(url: string): boolean {
  try {
    const q = new URL(url).search.toLowerCase()
    return (
      q.includes("x-amz-signature=") ||
      q.includes("x-amz-credential=") ||
      q.includes("awsaccesskeyid=")
    )
  } catch {
    return false
  }
}

/** Object key from virtual-hosted or path-style S3 URL. */
export function extractS3ObjectKeyFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url)
    const host = parsed.hostname.toLowerCase()
    if (!host.includes("amazonaws.com")) return null
    if (host.startsWith("s3.") || host === "s3.amazonaws.com") {
      const parts = parsed.pathname.replace(/^\//, "").split("/")
      if (parts.length < 2) return null
      return parts.slice(1).join("/")
    }
    return parsed.pathname.replace(/^\//, "")
  } catch {
    return null
  }
}

/** Map private S3 URL → CloudFront / public CDN when `NEXT_PUBLIC_MEDIA_BASE_URL` is set. */
export function s3UrlToPublicCdnUrl(s3Url: string): string | undefined {
  const base = String(
    process.env.NEXT_PUBLIC_MEDIA_BASE_URL || process.env.NEXT_PUBLIC_S3_PUBLIC_BASE_URL || "",
  )
    .trim()
    .replace(/\/+$/, "")
  if (!base) return undefined
  const key = extractS3ObjectKeyFromUrl(s3Url)
  if (!key) return undefined
  return `${base}/${key}`
}

export function isProbablyApiAuthenticatedMediaUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    const apiOrigin = getApiOrigin()
    if (!apiOrigin) return false
    const api = new URL(apiOrigin)
    if (parsed.origin !== api.origin) return false
    return parsed.pathname.includes("/api/") || parsed.pathname.includes("/uploads") || parsed.pathname.includes("/files")
  } catch {
    return false
  }
}
