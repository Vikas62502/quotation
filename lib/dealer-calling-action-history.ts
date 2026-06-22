import { buildTaggedCallRemark, parseTaggedCallRemark } from "@/lib/calling-remark-payload"

export type StoredDealerCallingAction = {
  id: string
  leadId: string
  dealerId: string
  name: string
  mobile: string
  action?: string
  actionAt?: string
  callRemark?: string
  nextFollowUpAt?: string
  statusCategory?: string
  statusText?: string
  kNumber?: string
  address?: string
  city?: string
  state?: string
  customerNote?: string
}

const STORAGE_PREFIX = "dealer-calling-action-history:"
const MAX_ENTRIES = 600

function storageKey(dealerId: string): string {
  return `${STORAGE_PREFIX}${dealerId}`
}

function readRaw(dealerId: string): StoredDealerCallingAction[] {
  if (!dealerId || typeof localStorage === "undefined") return []
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey(dealerId)) || "[]")
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeRaw(dealerId: string, rows: StoredDealerCallingAction[]) {
  if (!dealerId || typeof localStorage === "undefined") return
  try {
    localStorage.setItem(storageKey(dealerId), JSON.stringify(rows.slice(0, MAX_ENTRIES)))
  } catch {
    // ignore quota errors
  }
}

/** Normalize remark from API row or rebuild from structured status fields. */
export function resolveCallingActionRemark(source: Record<string, unknown> | null | undefined): string {
  if (!source) return ""
  const direct = String(
    source.callRemark ||
      source.call_remark ||
      source.lastCallRemark ||
      source.last_call_remark ||
      "",
  ).trim()
  if (direct) return direct

  const category = String(source.statusCategory || source.status_category || "").trim()
  const status = String(source.statusText || source.status_text || "").trim()
  const free = String(source.remark || source.freeRemark || source.free_remark || "").trim()
  if (category && status) return buildTaggedCallRemark(category, status, free)
  if (status && free) return `${status} | ${free}`
  return status || free
}

export function readDealerCallingActions(dealerId: string): StoredDealerCallingAction[] {
  return readRaw(dealerId)
}

export function appendDealerCallingAction(
  dealerId: string,
  item: Omit<StoredDealerCallingAction, "dealerId"> & { dealerId?: string },
) {
  if (!dealerId) return
  const parsed = parseTaggedCallRemark(item.callRemark)
  const row: StoredDealerCallingAction = {
    ...item,
    dealerId,
    callRemark: item.callRemark?.trim() || "",
    statusCategory: item.statusCategory || parsed.statusCategory || undefined,
    statusText: item.statusText || parsed.status || undefined,
  }
  if (!row.callRemark?.trim() && !row.action) return

  const fingerprint = [row.leadId, row.actionAt || "", row.action || ""].join("|")

  const existing = readRaw(dealerId).filter((entry) => {
    const fp = [entry.leadId, entry.actionAt || "", entry.action || ""].join("|")
    return fp !== fingerprint
  })

  writeRaw(dealerId, [row, ...existing])
}

/** Prefer the richest callRemark when merging API + local duplicates. */
export function pickRicherCallRemark(a?: string, b?: string): string {
  const left = (a || "").trim()
  const right = (b || "").trim()
  if (!left) return right
  if (!right) return left
  return left.length >= right.length ? left : right
}
