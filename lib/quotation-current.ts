import { normalizeMobileForMatch } from "@/lib/quotation-api-payload"

const STORAGE_KEY = "quotation-current-by-mobile"

type CurrentMap = Record<string, string>

function readMap(): CurrentMap {
  if (typeof window === "undefined") return {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === "object" ? (parsed as CurrentMap) : {}
  } catch {
    return {}
  }
}

function writeMap(map: CurrentMap) {
  if (typeof window === "undefined") return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
}

export function getCustomerMobileFromQuotation(q: {
  customer?: { mobile?: string } | null
  mobile?: string
  customerMobile?: string
  customer_mobile?: string
}): string {
  return normalizeMobileForMatch(
    String(q.customer?.mobile || q.mobile || q.customerMobile || q.customer_mobile || ""),
  )
}

/** Mark this quotation id as the current one for its customer mobile. */
export function setCurrentQuotationForMobile(mobile: string, quotationId: string) {
  const m = normalizeMobileForMatch(mobile)
  if (!m || !quotationId) return
  const map = readMap()
  map[m] = quotationId
  writeMap(map)
}

export function getCurrentQuotationIdForMobile(mobile: string): string | null {
  const m = normalizeMobileForMatch(mobile)
  if (!m) return null
  return readMap()[m] || null
}

export function isQuotationMarkedCurrent(quotation: {
  id: string
  isCurrent?: boolean
  is_current?: boolean
  customer?: { mobile?: string } | null
  mobile?: string
}): boolean {
  if (quotation.isCurrent === true || quotation.is_current === true) return true
  if (quotation.isCurrent === false || quotation.is_current === false) {
    // Explicit false from API — still allow local override
  }
  const mobile = getCustomerMobileFromQuotation(quotation)
  const stored = getCurrentQuotationIdForMobile(mobile)
  return Boolean(stored && stored === quotation.id)
}

/**
 * Annotate list with isCurrent.
 * Prefer API is_current; else localStorage; else newest by createdAt per mobile.
 */
export function annotateQuotationsWithCurrent<
  T extends {
    id: string
    createdAt?: string
    isCurrent?: boolean
    is_current?: boolean
    customer?: { mobile?: string } | null
    mobile?: string
  },
>(list: T[]): Array<T & { isCurrent: boolean }> {
  const byMobile = new Map<string, T[]>()
  for (const q of list) {
    const mobile = getCustomerMobileFromQuotation(q) || `__id:${q.id}`
    const arr = byMobile.get(mobile) || []
    arr.push(q)
    byMobile.set(mobile, arr)
  }

  const currentIds = new Set<string>()
  for (const [mobile, rows] of byMobile) {
    if (mobile.startsWith("__id:")) {
      currentIds.add(rows[0]!.id)
      continue
    }
    const fromApi = rows.find((r) => r.isCurrent === true || r.is_current === true)
    if (fromApi) {
      currentIds.add(fromApi.id)
      continue
    }
    const stored = getCurrentQuotationIdForMobile(mobile)
    if (stored && rows.some((r) => r.id === stored)) {
      currentIds.add(stored)
      continue
    }
    const newest = [...rows].sort(
      (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(),
    )[0]
    if (newest) currentIds.add(newest.id)
  }

  return list.map((q) => ({
    ...q,
    isCurrent: currentIds.has(q.id),
  }))
}

/** True when this customer has more than one quotation (restore is useful). */
export function customerHasMultipleQuotations(
  list: Array<{ id: string; customer?: { mobile?: string } | null; mobile?: string }>,
  quotation: { id: string; customer?: { mobile?: string } | null; mobile?: string },
): boolean {
  const mobile = getCustomerMobileFromQuotation(quotation)
  if (!mobile) return false
  return list.filter((q) => getCustomerMobileFromQuotation(q) === mobile).length > 1
}

export type CustomerQuotationGroup<T extends { id: string; createdAt?: string; isCurrent?: boolean }> = {
  key: string
  current: T
  history: T[]
  all: T[]
}

/**
 * One visible row per customer: the current quotation.
 * Older versions live in `history` for the History action.
 */
export function groupQuotationsByCustomerCurrentFirst<
  T extends {
    id: string
    createdAt?: string
    isCurrent?: boolean
    is_current?: boolean
    customer?: { mobile?: string } | null
    mobile?: string
  },
>(list: T[]): Array<CustomerQuotationGroup<T>> {
  const annotated = annotateQuotationsWithCurrent(list)
  const byMobile = new Map<string, typeof annotated>()

  for (const q of annotated) {
    const mobile = getCustomerMobileFromQuotation(q) || `__id:${q.id}`
    const arr = byMobile.get(mobile) || []
    arr.push(q)
    byMobile.set(mobile, arr)
  }

  const groups: Array<CustomerQuotationGroup<(typeof annotated)[number]>> = []
  for (const [key, rows] of byMobile) {
    const sorted = [...rows].sort(
      (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(),
    )
    const current = sorted.find((r) => r.isCurrent) || sorted[0]!
    const history = sorted.filter((r) => r.id !== current.id)
    groups.push({ key, current, history, all: sorted })
  }

  groups.sort(
    (a, b) =>
      new Date(b.current.createdAt || 0).getTime() - new Date(a.current.createdAt || 0).getTime(),
  )
  return groups
}

/** Ids of the current quotation for each customer in `list`. */
export function getCurrentQuotationIds<
  T extends {
    id: string
    createdAt?: string
    isCurrent?: boolean
    is_current?: boolean
    customer?: { mobile?: string } | null
    mobile?: string
  },
>(list: T[]): Set<string> {
  return new Set(groupQuotationsByCustomerCurrentFirst(list).map((g) => g.current.id))
}

/**
 * Keep only the current quotation per customer.
 * When `universe` is provided, "current" is decided from that full list
 * (so a stage subset does not promote an older row to current).
 */
export function keepCurrentQuotationsOnly<
  T extends {
    id: string
    createdAt?: string
    isCurrent?: boolean
    is_current?: boolean
    customer?: { mobile?: string } | null
    mobile?: string
  },
>(list: T[], universe?: T[]): T[] {
  const ids = getCurrentQuotationIds(universe && universe.length > 0 ? universe : list)
  return list.filter((q) => ids.has(q.id))
}

