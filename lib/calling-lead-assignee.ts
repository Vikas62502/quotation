/**
 * Calling queue assignee resolution — who may act on a lead (PATCH /calling-queue/{id}/action).
 */

export type CallingLeadAssigneeRow = {
  assignedDealerId?: string
  assignedDealerName?: string
  dealerId?: string
  dealer_id?: string
  status?: string
}

export type CallingDealerIdentity = {
  id: string
  username?: string
  fullName?: string
}

const UNASSIGNED_ASSIGNMENT_TOKENS = new Set([
  "",
  "unassigned",
  "null",
  "none",
  "-",
  "na",
  "n/a",
  "pool",
  "open",
])

export function normalizeCallingAssigneeToken(raw: unknown): string {
  const s = String(raw ?? "").trim()
  if (UNASSIGNED_ASSIGNMENT_TOKENS.has(s.toLowerCase())) return ""
  return s
}

/** Explicit calling assignee fields (not uploader `dealerId` unless assignee fields are empty). */
export function resolveCallingAssigneeId(source: Record<string, unknown> | null | undefined): string {
  if (!source) return ""
  const explicit = normalizeCallingAssigneeToken(
    source.assignedDealerId ??
      source.assigned_dealer_id ??
      source.assignedToDealerId ??
      source.assigned_to_dealer_id ??
      source.assignedTo ??
      source.assigned_to ??
      source.assignedToUsername ??
      source.assigned_to_username,
  )
  if (explicit) return explicit
  // Legacy backends sometimes only set dealerId on assigned rows.
  return normalizeCallingAssigneeToken(source.dealerId ?? source.dealer_id)
}

export function leadHasExplicitCallingAssigneeId(
  lead: Pick<CallingLeadAssigneeRow, "assignedDealerId"> & Record<string, unknown>,
): boolean {
  const id = resolveCallingAssigneeId(lead as Record<string, unknown>)
  return Boolean(id)
}

function assigneeMatchesDealer(assigneeId: string, dealer: CallingDealerIdentity): boolean {
  const normalized = assigneeId.toLowerCase()
  const dealerId = String(dealer.id || "").trim().toLowerCase()
  if (dealerId && normalized === dealerId) return true
  const username = String(dealer.username || "").trim().toLowerCase()
  if (username && normalized === username) return true
  return false
}

function assigneeNameMatchesDealer(assigneeName: string, dealer: CallingDealerIdentity): boolean {
  const name = assigneeName.toLowerCase()
  const username = String(dealer.username || "").trim().toLowerCase()
  const fullName = String(dealer.fullName || "").trim().toLowerCase()
  if (username && name.includes(username)) return true
  if (fullName && fullName.length > 2 && name.includes(fullName)) return true
  return false
}

/** Lead is assigned to the logged-in dealer (backend should allow PATCH). */
export function callingLeadAssignedToDealer(
  lead: CallingLeadAssigneeRow & Record<string, unknown>,
  dealer: CallingDealerIdentity,
): boolean {
  const assigneeId = resolveCallingAssigneeId(lead as Record<string, unknown>)
  if (assigneeId && assigneeMatchesDealer(assigneeId, dealer)) return true

  const assigneeName = normalizeCallingAssigneeToken(
    lead.assignedDealerName ?? (lead as Record<string, unknown>).assigned_dealer_name,
  )
  if (assigneeName && assigneeNameMatchesDealer(assigneeName, dealer)) return true

  return false
}

/** Assigned to a different dealer — hide from current queue. */
export function callingLeadAssignedToOtherDealer(
  lead: CallingLeadAssigneeRow & Record<string, unknown>,
  dealer: CallingDealerIdentity,
): boolean {
  if (!leadHasExplicitCallingAssigneeId(lead as Record<string, unknown>)) return false
  return !callingLeadAssignedToDealer(lead, dealer)
}

export function callingLeadIsPoolUnassigned(lead: CallingLeadAssigneeRow & Record<string, unknown>): boolean {
  return !leadHasExplicitCallingAssigneeId(lead as Record<string, unknown>)
}

export function isLeadNotAssignedToDealerError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  const apiErr = error as { code?: string; message?: string; details?: Array<{ message?: string }> }
  if (apiErr.code === "LEAD_004") return true
  if (/not assigned to dealer/i.test(apiErr.message || "")) return true
  if (apiErr.details?.some((d) => /not assigned/i.test(String(d.message || "")))) return true
  return false
}
