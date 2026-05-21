/**
 * Shared date bounds for dealer calling reports (HR / Admin panels).
 * Week = Monday–Sunday (ISO-style week start).
 */

export type CallingReportPreset = "daily" | "weekly" | "monthly" | "last_month"

export function formatYmdLocal(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function dayStart(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function dayEnd(d: Date): Date {
  const x = new Date(d)
  x.setHours(23, 59, 59, 999)
  return x
}

export function getPresetBounds(preset: CallingReportPreset, now = new Date()): { start: Date; end: Date } {
  if (preset === "daily") {
    return { start: dayStart(now), end: dayEnd(now) }
  }
  if (preset === "weekly") {
    const start = dayStart(now)
    const wd = start.getDay()
    const diff = wd === 0 ? 6 : wd - 1
    start.setDate(start.getDate() - diff)
    const end = new Date(start)
    end.setDate(start.getDate() + 6)
    end.setHours(23, 59, 59, 999)
    return { start, end }
  }
  if (preset === "monthly") {
    const start = dayStart(new Date(now.getFullYear(), now.getMonth(), 1))
    const end = dayEnd(new Date(now.getFullYear(), now.getMonth() + 1, 0))
    return { start, end }
  }
  const prevMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1
  const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()
  const start = dayStart(new Date(prevYear, prevMonth, 1))
  const end = dayEnd(new Date(prevYear, prevMonth + 1, 0))
  return { start, end }
}

/** Parse `YYYY-MM-DD` as local calendar dates; inclusive range. */
export function getCustomBoundsFromYmd(fromYmd: string, toYmd: string): { start: Date; end: Date } | null {
  const from = String(fromYmd || "").trim()
  const to = String(toYmd || "").trim()
  if (!from || !to) return null
  const parse = (ymd: string, endOfDay: boolean) => {
    const parts = ymd.split("-").map((p) => Number(p))
    if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return null
    const [y, m, d] = parts
    const dt = endOfDay ? new Date(y, m - 1, d, 23, 59, 59, 999) : new Date(y, m - 1, d, 0, 0, 0, 0)
    return Number.isNaN(dt.getTime()) ? null : dt
  }
  const start = parse(from, false)
  const end = parse(to, true)
  if (!start || !end || start > end) return null
  return { start, end }
}

export function boundsToApiIsoRange(bounds: { start: Date; end: Date }): { startDate: string; endDate: string } {
  return { startDate: bounds.start.toISOString(), endDate: bounds.end.toISOString() }
}

/** Query params for HR/Admin calling-actions list (optional `startDate` / `endDate`). */
export function buildCallingActionsQueryDates(
  range: "daily" | "weekly" | "monthly" | "last_month" | "all" | "custom",
  customFromYmd: string,
  customToYmd: string,
): { startDate?: string; endDate?: string } {
  if (range === "all") return {}
  if (range === "custom") {
    const b = getCustomBoundsFromYmd(customFromYmd, customToYmd)
    if (!b) return {}
    return boundsToApiIsoRange(b)
  }
  return boundsToApiIsoRange(getPresetBounds(range, new Date()))
}
