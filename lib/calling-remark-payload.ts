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
  const trimmed = (freeTextRemark || "").trim()
  if (!category || !status) return trimmed
  return `[${category}] ${status}${trimmed ? ` | ${trimmed}` : ""}`
}

export type CallingLeadActionPayload = {
  action: "start" | "called" | "follow_up" | "not_interested" | "rescheduled"
  callRemark?: string
  nextFollowUpAt?: string
  actionAt?: string
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
  const callRemark = payload.callRemark?.trim()
  if (!callRemark) return payload

  const parsed = parseTaggedCallRemark(callRemark)
  return {
    ...payload,
    callRemark,
    call_remark: callRemark,
    statusCategory: parsed.statusCategory || undefined,
    status_category: parsed.statusCategory || undefined,
    statusText: parsed.status || undefined,
    status_text: parsed.status || undefined,
    remark: parsed.remark || undefined,
  }
}
