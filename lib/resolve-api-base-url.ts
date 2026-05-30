import { Capacitor } from "@capacitor/core"

/** Production API — must use HTTPS on Android (HTTP returns 301 and breaks login in WebView). */
export const DEFAULT_API_BASE_URL = "https://api.inventory.chairbordsolar.com/api"

function trimTrailingSlashes(url: string): string {
  return url.replace(/\/+$/, "")
}

function isLoopbackHost(url: string): boolean {
  return /localhost|127\.0\.0\.1/i.test(url)
}

/** Android/iOS WebView: upgrade external http API URLs to https (POST + 301 redirect fails on native). */
function upgradeApiUrlForNative(url: string): string {
  if (!Capacitor.isNativePlatform()) return url
  if (!/^http:\/\//i.test(url)) return url
  if (/^http:\/\/10\.0\.2\.2/i.test(url) || /^http:\/\/localhost/i.test(url) || /^http:\/\/127\.0\.0\.1/i.test(url)) {
    return url
  }
  return url.replace(/^http:\/\//i, "https://")
}

/** Map API host to Android emulator host when the UI is loaded from 10.0.2.2. */
function mapLoopbackForEmulator(apiUrl: string, pageHostname: string): string {
  if (pageHostname !== "10.0.2.2") return apiUrl
  return apiUrl.replace(/localhost/gi, "10.0.2.2").replace(/127\.0\.0\.1/gi, "10.0.2.2")
}

/**
 * Resolves API base URL for browser and Capacitor WebView.
 * Native apps must not call localhost (that points at the phone/emulator, not your PC).
 */
export function resolveApiBaseUrl(): string {
  if (typeof window === "undefined") {
    const env = process.env.NEXT_PUBLIC_API_URL?.trim()
    return trimTrailingSlashes(env || DEFAULT_API_BASE_URL)
  }

  const override = (window as unknown as { __API_URL__?: string }).__API_URL__?.trim()
  if (override) return trimTrailingSlashes(override)

  let url = process.env.NEXT_PUBLIC_API_URL?.trim() || DEFAULT_API_BASE_URL

  if (Capacitor.isNativePlatform() && isLoopbackHost(url)) {
    url = DEFAULT_API_BASE_URL
  }

  url = mapLoopbackForEmulator(url, window.location.hostname)
  url = upgradeApiUrlForNative(url)

  return trimTrailingSlashes(url)
}
