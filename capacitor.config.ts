import type { CapacitorConfig } from "@capacitor/cli"
import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"

/** Default WebView URL (production): https://quotation.chairbordsolar.com */
const DEFAULT_LIVE_URL = "https://quotation.chairbordsolar.com"

/**
 * The native shell loads this URL in the WebView (Next.js is not bundled in `public/` alone).
 * Override with CAPACITOR_LIVE_URL in the environment, `.env.local`, or `.env` (e.g. local dev).
 */
function resolveCapacitorLiveUrl(): string | undefined {
  const trim = (v: string) => v.trim().replace(/^["']|["']$/g, "")
  if (process.env.CAPACITOR_LIVE_URL) {
    return trim(process.env.CAPACITOR_LIVE_URL)
  }
  for (const name of [".env.local", ".env"]) {
    const full = resolve(process.cwd(), name)
    if (!existsSync(full)) continue
    const text = readFileSync(full, "utf8")
    for (const line of text.split("\n")) {
      if (/^\s*#/.test(line)) continue
      const m = line.match(/^\s*CAPACITOR_LIVE_URL\s*=\s*(.*)\s*$/)
      if (m) {
        const v = trim(m[1])
        if (v) return v
      }
    }
  }
  return undefined
}

const liveUrl = resolveCapacitorLiveUrl() ?? DEFAULT_LIVE_URL

const config: CapacitorConfig = {
  appId: "com.hairbord.solarquotation",
  appName: "Solar Quotation",
  webDir: "public",
  bundledWebRuntime: false,
  /**
   * WebView loads https://… (server.url) while NEXT_PUBLIC_API_URL is often http://… .
   * Without this, Android WebView blocks those API calls (mixed content) and the app can look stuck.
   */
  android: {
    allowMixedContent: true,
  },
  server: liveUrl
    ? {
        url: liveUrl,
        cleartext: liveUrl.startsWith("http://"),
      }
    : undefined,
}

export default config
