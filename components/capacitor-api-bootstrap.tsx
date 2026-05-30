"use client"

import { useEffect } from "react"
import { Capacitor } from "@capacitor/core"
import { resolveApiBaseUrl, setApiBaseUrl } from "@/lib/api-config"

/** Ensures native WebView uses a reachable API URL before auth/data requests run. */
export function CapacitorApiBootstrap() {
  useEffect(() => {
    const url = resolveApiBaseUrl()
    setApiBaseUrl(url)
    if (Capacitor.isNativePlatform()) {
      console.info("[Capacitor] API base URL:", url)
    }
  }, [])

  return null
}
