import {
  applyOfficeInsideGstToAmounts,
  type SubvendorLedgerAmounts,
} from "@/lib/admin-subvendor-ledger"

export type RajeshPortalLedgerRow = {
  name: string
  proposal: number
  pi: number
  others: number
}

/** Customer portal sheet for dealer Rajesh: PARPOSAL → proposal, PI → pi, RAJESH → others. */
export const RAJESH_CUSTOMER_PORTAL_ROWS: RajeshPortalLedgerRow[] = [
  { name: "BHERU LAL SHARMA", proposal: 210000, pi: 144264, others: 1380 },
  { name: "SANJU SAROJ", proposal: 225000, pi: 223828, others: 6450 },
  { name: "JHAMRI DEVI", proposal: 210000, pi: 141354, others: 2300 },
  { name: "RAM RATAN BHANWARIYA", proposal: 210000, pi: 154542, others: 2500 },
  { name: "ASHOK BHANWARIYA", proposal: 210000, pi: 154542, others: 2500 },
  { name: "SUMAN YADAV", proposal: 225000, pi: 244424, others: 2060 },
  { name: "SHILPI GUPTA", proposal: 225000, pi: 191628, others: 1000 },
  { name: "SAJNA DEVI", proposal: 200000, pi: 201241, others: 1760 },
  { name: "RAJENDRA KUMAR SETHI", proposal: 172000, pi: 225296, others: 1830 },
  { name: "ARJUN SINGH CHOUDHARY", proposal: 150000, pi: 224342, others: 3355 },
  { name: "SUBE SINGH", proposal: 225000, pi: 259261, others: 500 },
  { name: "SUBHASH SINGH", proposal: 180000, pi: 207154, others: 2000 },
  { name: "SUPYAR DEVI", proposal: 225000, pi: 219131, others: 2000 },
  { name: "OM PRAKASH SHARMA", proposal: 0, pi: 135438, others: 2300 },
  { name: "VANDAN JANGID", proposal: 200000, pi: 136733, others: 2000 },
  { name: "OM PRAKASH", proposal: 0, pi: 215134, others: 0 },
  { name: "SAROJ KANWAR", proposal: 225000, pi: 224830, others: 0 },
]

const TITLE_PREFIX = /^(SHRI|SMT|SMT\.|MRS|MR|MS|DR)\s+/
const NAME_SUFFIX = /\s+(JI|SIR)$/

export function normalizePortalCustomerName(name: string): string {
  return String(name || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, " ")
    .replace(TITLE_PREFIX, "")
    .replace(NAME_SUFFIX, "")
    .replace(/\bCHAUDHARY\b/g, "CHOUDHARY")
    .replace(/\bCHOWDHARY\b/g, "CHOUDHARY")
    .replace(/\bBHANWARIA\b/g, "BHANWARIYA")
    .replace(/\s+/g, " ")
    .trim()
}

export function isRajeshDealerName(...parts: Array<string | null | undefined>): boolean {
  return /\brajesh\b/i.test(parts.filter(Boolean).join(" "))
}

const PORTAL_BY_NAME = new Map(
  RAJESH_CUSTOMER_PORTAL_ROWS.map((row) => [normalizePortalCustomerName(row.name), row]),
)

export function findRajeshPortalLedger(customerName: string): RajeshPortalLedgerRow | null {
  const key = normalizePortalCustomerName(customerName)
  if (!key) return null
  const exact = PORTAL_BY_NAME.get(key)
  if (exact) return exact

  const rows = [...PORTAL_BY_NAME.entries()]
    .filter(([nameKey]) => key.startsWith(nameKey) || nameKey.startsWith(key))
    .sort((a, b) => b[0].length - a[0].length)
  if (rows.length === 1) return rows[0][1]

  const longestExactPrefix = rows.find(([nameKey]) => key === nameKey || key.startsWith(`${nameKey} `))
  return longestExactPrefix?.[1] ?? null
}

export function mergeRajeshPortalIntoLedger(
  stored: SubvendorLedgerAmounts,
  portal: RajeshPortalLedgerRow,
): SubvendorLedgerAmounts {
  const proposal = portal.proposal > 0 ? portal.proposal : stored.proposal
  return applyOfficeInsideGstToAmounts({
    ...stored,
    proposal,
    pi: portal.pi,
    others: portal.others,
  })
}

export function rajeshPortalNeedsApply(
  stored: SubvendorLedgerAmounts,
  portal: RajeshPortalLedgerRow,
): boolean {
  if ((stored.pi ?? 0) <= 0 && portal.pi > 0) return true
  if ((stored.others ?? 0) <= 0 && portal.others > 0) return true
  if ((stored.proposal ?? 0) <= 0 && portal.proposal > 0) return true
  return false
}
