/** Strip non-digits for clipboard / display. */
export function normalizePhoneDigits(mobile?: string): string {
  return (mobile || "").replace(/\D/g, "")
}

function formatTelUri(digits: string): string {
  if (digits.length === 10) return `tel:+91${digits}`
  if (digits.length === 12 && digits.startsWith("91")) return `tel:+${digits}`
  return `tel:${digits}`
}

async function copyDigitsToClipboard(digits: string): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(digits)
      return true
    } catch {
      // fall through to legacy copy
    }
  }
  if (typeof document === "undefined") return false
  try {
    const textarea = document.createElement("textarea")
    textarea.value = digits
    textarea.setAttribute("readonly", "")
    textarea.style.position = "fixed"
    textarea.style.left = "-9999px"
    document.body.appendChild(textarea)
    textarea.select()
    const ok = document.execCommand("copy")
    document.body.removeChild(textarea)
    return ok
  } catch {
    return false
  }
}

export type CopyPhoneForDialResult =
  | "copied"
  | "copy_failed"
  | "missing"
  | "dialer_opened"
  | "dialer_opened_copied"

/**
 * Web: copy lead number for dialling (page stays open).
 * Native app (Capacitor): copy number and open the system phone dialer.
 */
export async function copyPhoneForDial(mobile?: string): Promise<CopyPhoneForDialResult> {
  const digits = normalizePhoneDigits(mobile)
  if (!digits) return "missing"

  if (typeof window !== "undefined") {
    const { Capacitor } = await import("@capacitor/core")
    if (Capacitor.isNativePlatform()) {
      const copied = await copyDigitsToClipboard(digits)
      window.location.href = formatTelUri(digits)
      return copied ? "dialer_opened_copied" : "dialer_opened"
    }
  }

  const copied = await copyDigitsToClipboard(digits)
  return copied ? "copied" : "copy_failed"
}

/** Opens dialer on native; copies on web. */
export const openPhoneDialer = copyPhoneForDial

export function formatPhoneForDisplay(digits: string): string {
  const d = normalizePhoneDigits(digits)
  if (d.length === 10) return `${d.slice(0, 5)} ${d.slice(5)}`
  return d
}
