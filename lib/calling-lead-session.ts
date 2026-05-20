/** Persist in-progress calling UI per lead (remarks, notes) across navigation. */
export type CallingLeadSessionDraft = {
  callRemark?: string
  customerNote?: string
  callConnection?: string
  connectedOutcome?: string
}

export const CALLING_ACTIVE_LEAD_ID_KEY = "calling-data-active-lead-id"

export function callingLeadSessionKey(leadId: string) {
  return `calling-data-session:${leadId}`
}

/** @deprecated Use callingLeadSessionKey — kept for older drafts. */
export function callRemarkDraftStorageKey(leadId: string) {
  return `calling-data-remark:${leadId}`
}

export function loadCallingLeadSession(leadId: string): CallingLeadSessionDraft | null {
  if (!leadId || typeof sessionStorage === "undefined") return null
  try {
    const raw = sessionStorage.getItem(callingLeadSessionKey(leadId))
    if (raw) {
      const parsed = JSON.parse(raw) as CallingLeadSessionDraft
      if (parsed && typeof parsed === "object") return parsed
    }
    const legacyRemark = sessionStorage.getItem(callRemarkDraftStorageKey(leadId))
    if (legacyRemark?.trim()) return { callRemark: legacyRemark.trim() }
  } catch {
    // ignore
  }
  return null
}

export function saveCallingLeadSession(leadId: string, draft: CallingLeadSessionDraft) {
  if (!leadId || typeof sessionStorage === "undefined") return
  try {
    const prev = loadCallingLeadSession(leadId) || {}
    const next: CallingLeadSessionDraft = { ...prev }
    ;(Object.keys(draft) as (keyof CallingLeadSessionDraft)[]).forEach((key) => {
      const value = draft[key]
      if (value === undefined) return
      const trimmed = String(value).trim()
      if (trimmed) next[key] = trimmed
      else delete next[key]
    })
    const hasContent = Object.values(next).some((v) => String(v || "").trim())
    if (!hasContent) {
      sessionStorage.removeItem(callingLeadSessionKey(leadId))
      sessionStorage.removeItem(callRemarkDraftStorageKey(leadId))
      return
    }
    sessionStorage.setItem(callingLeadSessionKey(leadId), JSON.stringify(next))
    if (next.callRemark?.trim()) {
      sessionStorage.setItem(callRemarkDraftStorageKey(leadId), next.callRemark.trim())
    }
  } catch {
    // ignore
  }
}

export function setCallingActiveLeadId(leadId: string) {
  if (!leadId || typeof sessionStorage === "undefined") return
  try {
    sessionStorage.setItem(CALLING_ACTIVE_LEAD_ID_KEY, leadId)
  } catch {
    // ignore
  }
}

export function getCallingActiveLeadId(): string | null {
  if (typeof sessionStorage === "undefined") return null
  try {
    return sessionStorage.getItem(CALLING_ACTIVE_LEAD_ID_KEY)
  } catch {
    return null
  }
}
