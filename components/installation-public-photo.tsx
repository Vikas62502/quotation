"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { ImageIcon, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { API_CONFIG } from "@/lib/api-config"
import {
  isAmazonS3ObjectUrl,
  isPresignedS3Url,
  isProbablyApiAuthenticatedMediaUrl,
} from "@/lib/media-url"
import { resolvePublicOpenMediaUrl } from "@/lib/resolve-public-media-url"

type Props = {
  rawUrl: string
  quotationId?: string
  className?: string
}

/** Thumbnail + public open link (presigned/CDN/API); not raw private S3 object URLs. */
export function InstallationPublicPhoto({ rawUrl, quotationId, className }: Props) {
  const [href, setHref] = useState<string | null>(null)
  const [imgSrc, setImgSrc] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const blobUrlRef = useRef<string | null>(null)
  const authAttemptedRef = useRef(false)

  const tryAuthenticatedBlob = useCallback(
    async (sourceUrl?: string) => {
      const target = sourceUrl || href
      if (!target) {
        setFailed(true)
        return false
      }
      if (authAttemptedRef.current) {
        setFailed(true)
        return false
      }
      authAttemptedRef.current = true
      const token = typeof window !== "undefined" ? localStorage.getItem("authToken") : null
      const apiBase = API_CONFIG.baseURL.replace(/\/+$/, "")

      const candidates: string[] = []
      if (isProbablyApiAuthenticatedMediaUrl(target) || target.startsWith(apiBase)) {
        candidates.push(target)
      }
      if (quotationId && isAmazonS3ObjectUrl(target)) {
        candidates.push(
          `${apiBase}/quotations/${quotationId}/documents/download?url=${encodeURIComponent(target)}`,
          `${apiBase}/quotations/${quotationId}/documents/file?url=${encodeURIComponent(target)}`,
        )
      }

      for (const fetchUrl of candidates) {
        try {
          const res = await fetch(fetchUrl, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            credentials: "include",
          })
          if (!res.ok) continue
          const blob = await res.blob()
          if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current)
          const objectUrl = URL.createObjectURL(blob)
          blobUrlRef.current = objectUrl
          setImgSrc(objectUrl)
          setHref(objectUrl)
          setFailed(false)
          return true
        } catch {
          continue
        }
      }
      setFailed(true)
      return false
    },
    [href, quotationId],
  )

  useEffect(() => {
    let cancelled = false
    authAttemptedRef.current = false
    setLoading(true)
    setFailed(false)
    setHref(null)
    setImgSrc(null)
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current)
      blobUrlRef.current = null
    }

    void (async () => {
      try {
        const resolved = await resolvePublicOpenMediaUrl(rawUrl, quotationId)
        if (cancelled) return

        const isPrivateS3 =
          isAmazonS3ObjectUrl(resolved) && !isPresignedS3Url(resolved)

        if (isPrivateS3) {
          const ok = await tryAuthenticatedBlob(resolved)
          if (cancelled) return
          if (!ok) setFailed(true)
          return
        }

        setHref(resolved)
        setImgSrc(resolved)
      } catch {
        if (!cancelled) setFailed(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [rawUrl, quotationId, tryAuthenticatedBlob])

  useEffect(() => {
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current)
        blobUrlRef.current = null
      }
    }
  }, [])

  if (loading) {
    return (
      <div className={cn("flex w-[92px] shrink-0 flex-col items-center gap-1", className)}>
        <div className="flex h-16 w-full items-center justify-center rounded-md border border-border/70 bg-muted">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
        <span className="text-[10px] text-muted-foreground">Loading…</span>
      </div>
    )
  }

  if (!href || failed) {
    return (
      <div className={cn("flex w-[92px] shrink-0 flex-col items-center gap-1", className)}>
        <div className="flex h-16 w-full flex-col items-center justify-center gap-0.5 rounded-md border border-border/70 bg-muted text-muted-foreground">
          <ImageIcon className="h-5 w-5 opacity-60" />
          <span className="text-[9px] px-1 text-center">Preview unavailable</span>
        </div>
      </div>
    )
  }

  return (
    <div className={cn("flex w-[92px] shrink-0 flex-col items-center gap-1", className)}>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="block w-full overflow-hidden rounded-md border border-border/70 bg-muted"
        title={href}
      >
        {imgSrc ? (
          <img
            src={imgSrc}
            alt=""
            loading="lazy"
            className="h-16 w-full object-cover"
            onError={() => {
              void tryAuthenticatedBlob()
            }}
          />
        ) : (
          <div className="flex h-16 w-full items-center justify-center bg-muted">
            <ImageIcon className="h-5 w-5 opacity-60" />
          </div>
        )}
      </a>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="w-full truncate text-center text-[10px] font-medium text-primary underline"
        title={href}
      >
        Open link
      </a>
    </div>
  )
}
