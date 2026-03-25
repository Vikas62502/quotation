import type { CapacitorConfig } from "@capacitor/cli"

const liveUrl = process.env.CAPACITOR_LIVE_URL

const config: CapacitorConfig = {
  appId: "com.hairbord.solarquotation",
  appName: "Solar Quotation",
  webDir: "public",
  bundledWebRuntime: false,
  server: liveUrl
    ? {
        url: liveUrl,
        cleartext: liveUrl.startsWith("http://"),
      }
    : undefined,
}

export default config
