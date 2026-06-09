/** Parsed from `[statusCategory] statusText | free remark` (see buildTaggedCallRemark). */
export function parseTaggedCallRemark(remark?: string) {
  const raw = (remark || "").trim()
  if (!raw) return { statusCategory: "", status: "", remark: "" }

  const match = raw.match(/^\[([^\]]+)\]\s*([^|]*?)\s*(?:\|\s*(.*))?$/)
  if (!match) return { statusCategory: "", status: "", remark: raw }

  return {
    statusCategory: (match[1] || "").trim(),
    status: (match[2] || "").trim(),
    remark: (match[3] || "").trim(),
  }
}

export function buildTaggedCallRemark(
  statusCategory: string,
  statusText: string,
  freeTextRemark?: string,
): string {
  const category = statusCategory.trim()
  const status = statusText.trim()
  const trimmed = cleanFreeCallRemark(freeTextRemark)
  if (!category || !status) return trimmed
  return `[${category}] ${status}${trimmed ? ` | ${trimmed}` : ""}`
}

const CALL_REMARK_FREE_TEXT_MAX = 4000

const TAGGED_REMARK_LINE_RE = /^\[[^\]]+\]\s*[^|\n]*(\s*\|.*)?$/

/** Strip nested `[category] status |` history so resubmit does not grow call_remark indefinitely. */
export function cleanFreeCallRemark(raw?: string): string {
  let text = (raw || "").trim()
  if (!text) return ""

  // Backend concat often stores one tagged line per submit (newline-separated).
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  const nonTagLines = lines.filter((line) => !TAGGED_REMARK_LINE_RE.test(line))
  if (nonTagLines.length > 0) {
    text = nonTagLines.join("\n").trim()
  } else if (lines.length > 0 && lines.every((line) => TAGGED_REMARK_LINE_RE.test(line))) {
    return ""
  }

  for (let i = 0; i < 20; i++) {
    const parsed = parseTaggedCallRemark(text)
    if (!parsed.statusCategory && !parsed.status) break
    const next = (parsed.remark || "").trim()
    if (!next || next === text) {
      if (!next) text = ""
      break
    }
    if (!/^\[[^\]]+\]/.test(next)) {
      text = next
      break
    }
    text = next
  }

  const final = parseTaggedCallRemark(text)
  const result = (final.remark || (final.statusCategory ? "" : text)).trim()
  return result.slice(0, CALL_REMARK_FREE_TEXT_MAX)
}

/** One canonical tagged string for PATCH — never resend stacked history tags. */
export function normalizeCallRemarkForSubmit(
  callRemark: string,
  overrides?: { statusCategory?: string; statusText?: string },
): string {
  const parsed = parseTaggedCallRemark(callRemark)
  const category = (overrides?.statusCategory || parsed.statusCategory || "").trim()
  const status = (overrides?.statusText || parsed.status || "").trim()
  const free = cleanFreeCallRemark(parsed.remark || callRemark)
  if (category && status) return buildTaggedCallRemark(category, status, free)
  return free || callRemark.trim()
}

export type CallingLeadActionPayload = {
  action: "start" | "called" | "follow_up" | "not_interested" | "rescheduled"
  callRemark?: string
  nextFollowUpAt?: string
  next_follow_up_at?: string
  actionAt?: string
  action_at?: string
  claim?: boolean
  autoAssign?: boolean
  assignedDealerId?: string
  call_remark?: string
  statusCategory?: string
  status_category?: string
  statusText?: string
  status_text?: string
  remark?: string
}

/** Send camelCase + snake_case + structured fields so backends persist remarks reliably. */
export function enrichCallingActionPayload(payload: CallingLeadActionPayload): CallingLeadActionPayload {
  const enriched: CallingLeadActionPayload = { ...payload }

  if (payload.nextFollowUpAt) {
    enriched.next_follow_up_at = payload.nextFollowUpAt
  }
  if (payload.actionAt) {
    enriched.action_at = payload.actionAt
  }

  const rawCallRemark = payload.callRemark?.trim()
  if (!rawCallRemark) return enriched

  const parsed = parseTaggedCallRemark(rawCallRemark)
  const statusCategory = (payload.statusCategory || payload.status_category || parsed.statusCategory || "").trim()
  const statusText = (payload.statusText || payload.status_text || parsed.status || "").trim()
  const freeRemark = cleanFreeCallRemark(parsed.remark || payload.remark || rawCallRemark)
  const callRemark = normalizeCallRemarkForSubmit(rawCallRemark, {
    statusCategory: statusCategory || undefined,
    statusText: statusText || undefined,
  })

  return {
    ...enriched,
    callRemark,
    call_remark: callRemark,
    statusCategory: statusCategory || undefined,
    status_category: statusCategory || undefined,
    statusText: statusText || undefined,
    status_text: statusText || undefined,
    remark: freeRemark || undefined,
  }
}

/** Reschedule / decision-pending holds — backends often accept only `follow_up`. */
export function getRescheduleSubmitAction(): "follow_up" {
  return "follow_up"
}

export function isCallingActionServerError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  const apiError = error as { code?: string; message?: string }
  if (apiError.code === "HTTP_500" || apiError.code === "SYS_001") return true
  return /internal server error/i.test(apiError.message || "")
}
