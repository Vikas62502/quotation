export const ADMIN_SUBVENDORS_STORAGE_KEY = "adminSubvendors"

export type SubvendorKind = "office_inside" | "office_outside"

export type SubvendorDealerOption = {
  id: string
  username: string
  firstName: string
  lastName: string
  mobile: string
  email: string
  address?: { city?: string } | null
}

export type AdminSubvendorRecord = {
  id: string
  kind: SubvendorKind
  dealerId: string
  name: string
  contactName: string
  mobile: string
  email: string
  city: string
  category: string
  notes: string
  /** Vendor profit ratio as a percent (0–100). */
  profitRatio: number
  /** File charges rate: INR per rounded kW (4.4 → 4, 4.6 → 5). */
  fileCostPerKw: number
  /** Amount paid on this vendor's leaser. */
  leaserPaid: number
  /** Amount remaining on this vendor's leaser. */
  leaserRemaining: number
  createdAt: string
}

export const DEFAULT_FILE_COST_PER_KW = 1000

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `sv-${Date.now()}-${Math.random().toString(16).slice(2)}`

function asText(value: unknown) {
  return typeof value === "string" ? value : value == null ? "" : String(value)
}

export function parseProfitRatio(raw: unknown): number {
  const cleaned = String(raw ?? "").replace(/%/g, "").trim()
  if (cleaned === "") return 0
  const n = Number(cleaned)
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.min(100, Math.round(n * 100) / 100)
}

export function formatProfitRatioInput(value: number) {
  if (!Number.isFinite(value) || value <= 0) return ""
  return String(Math.round(value * 100) / 100)
}

export function formatProfitRatioLabel(value: number) {
  const n = parseProfitRatio(value)
  return `${n}%`
}

export function parseInrAmount(raw: unknown): number {
  const cleaned = String(raw ?? "").replace(/[₹,\s]/g, "").trim()
  if (cleaned === "") return 0
  const n = Number(cleaned)
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : 0
}

export function formatInrAmountInput(value: number) {
  if (!Number.isFinite(value) || value <= 0) return ""
  return String(Math.round(value))
}

/** 4.4 kW → 4, 4.6 kW → 5. */
export function roundKwForFileCost(kw: number): number {
  if (!Number.isFinite(kw) || kw <= 0) return 0
  return Math.round(kw)
}

export function parseFileCostPerKw(raw: unknown): number {
  const n = parseInrAmount(raw)
  return n > 0 ? n : DEFAULT_FILE_COST_PER_KW
}

export function formatFileCostPerKwInput(value: number) {
  const n = parseFileCostPerKw(value)
  return n > 0 ? String(n) : String(DEFAULT_FILE_COST_PER_KW)
}

export function fileChargesFromVendorRate(kw: number, ratePerKw: number): number {
  return roundKwForFileCost(kw) * parseFileCostPerKw(ratePerKw)
}

export function normalizeAdminSubvendor(raw: unknown): AdminSubvendorRecord | null {
  if (!raw || typeof raw !== "object") return null
  const row = raw as Record<string, unknown>
  const id = asText(row.id).trim()
  if (!id) return null
  return {
    id,
    kind: row.kind === "office_inside" ? "office_inside" : "office_outside",
    dealerId: asText(row.dealerId ?? row.dealer_id).trim(),
    name: asText(row.name).trim(),
    contactName: asText(row.contactName ?? row.contact_name).trim(),
    mobile: asText(row.mobile).trim(),
    email: asText(row.email).trim(),
    city: asText(row.city).trim(),
    category: asText(row.category).trim() || "Other",
    notes: asText(row.notes).trim(),
    profitRatio: parseProfitRatio(row.profitRatio ?? row.profit_ratio),
    fileCostPerKw: parseFileCostPerKw(
      row.fileCostPerKw ?? row.file_cost_per_kw ?? row.fileCost ?? row.file_cost,
    ),
    leaserPaid: parseInrAmount(row.leaserPaid ?? row.leaser_paid),
    leaserRemaining: parseInrAmount(row.leaserRemaining ?? row.leaser_remaining),
    createdAt: asText(row.createdAt ?? row.created_at) || new Date().toISOString(),
  }
}

export function readAdminSubvendors(): AdminSubvendorRecord[] {
  if (typeof window === "undefined") return []
  try {
    const raw = JSON.parse(localStorage.getItem(ADMIN_SUBVENDORS_STORAGE_KEY) || "[]")
    if (!Array.isArray(raw)) return []
    return raw.map(normalizeAdminSubvendor).filter((row): row is AdminSubvendorRecord => Boolean(row))
  } catch {
    return []
  }
}

export function writeAdminSubvendors(rows: AdminSubvendorRecord[]) {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(ADMIN_SUBVENDORS_STORAGE_KEY, JSON.stringify(rows))
  } catch {
    // no-op
  }
}

export function createAdminSubvendor(
  input: Omit<AdminSubvendorRecord, "id" | "createdAt">,
): AdminSubvendorRecord {
  const row: AdminSubvendorRecord = {
    ...input,
    id: newId(),
    createdAt: new Date().toISOString(),
  }
  writeAdminSubvendors([row, ...readAdminSubvendors()])
  return row
}

export function updateAdminSubvendor(
  id: string,
  patch: Partial<Omit<AdminSubvendorRecord, "id" | "createdAt">>,
): AdminSubvendorRecord | null {
  const rows = readAdminSubvendors()
  const idx = rows.findIndex((row) => row.id === id)
  if (idx < 0) return null
  const next = { ...rows[idx], ...patch }
  rows[idx] = next
  writeAdminSubvendors(rows)
  return next
}

export function deleteAdminSubvendor(id: string) {
  writeAdminSubvendors(readAdminSubvendors().filter((row) => row.id !== id))
}

export function pickSubvendorListFromApi(response: unknown): AdminSubvendorRecord[] {
  if (!response || typeof response !== "object") return []
  const root = response as Record<string, unknown>
  const nested =
    root.data && typeof root.data === "object" && !Array.isArray(root.data)
      ? (root.data as Record<string, unknown>)
      : null
  const raw = [
    root.subvendors,
    nested?.subvendors,
    nested?.items,
    root.items,
    Array.isArray(root.data) ? root.data : null,
    Array.isArray(response) ? response : null,
  ].find((value) => Array.isArray(value))
  if (!Array.isArray(raw)) return []
  return raw.map(normalizeAdminSubvendor).filter((row): row is AdminSubvendorRecord => Boolean(row))
}

export function pickSubvendorRecordFromApi(response: unknown): AdminSubvendorRecord | null {
  if (!response || typeof response !== "object") return null
  const root = response as Record<string, unknown>
  const nested =
    root.data && typeof root.data === "object" && !Array.isArray(root.data)
      ? (root.data as Record<string, unknown>)
      : null
  const candidate = nested?.subvendor ?? nested?.item ?? root.subvendor ?? root.data ?? response
  return normalizeAdminSubvendor(candidate)
}

export function subvendorToApiBody(
  row: Omit<AdminSubvendorRecord, "id" | "createdAt">,
): Record<string, unknown> {
  return {
    kind: row.kind,
    dealerId: row.dealerId || null,
    dealer_id: row.dealerId || null,
    name: row.name,
    contactName: row.contactName,
    contact_name: row.contactName,
    mobile: row.mobile,
    email: row.email,
    city: row.city,
    category: row.category || "Other",
    notes: row.notes,
    profitRatio: parseProfitRatio(row.profitRatio),
    profit_ratio: parseProfitRatio(row.profitRatio),
    fileCostPerKw: parseFileCostPerKw(row.fileCostPerKw),
    file_cost_per_kw: parseFileCostPerKw(row.fileCostPerKw),
    leaserPaid: parseInrAmount(row.leaserPaid),
    leaser_paid: parseInrAmount(row.leaserPaid),
    leaserRemaining: parseInrAmount(row.leaserRemaining),
    leaser_remaining: parseInrAmount(row.leaserRemaining),
  }
}

export function dealerDisplayName(dealer: SubvendorDealerOption) {
  const full = `${dealer.firstName || ""} ${dealer.lastName || ""}`.trim()
  return full || dealer.username || "Dealer"
}

export function snapshotFromDealer(dealer: SubvendorDealerOption) {
  return {
    dealerId: dealer.id,
    name: dealerDisplayName(dealer),
    contactName: dealerDisplayName(dealer),
    mobile: dealer.mobile || "",
    email: dealer.email || "",
    city: dealer.address?.city || "",
  }
}

export const SUBVENDOR_CATEGORIES = [
  "Structure",
  "Electrical",
  "Civil",
  "Transport",
  "Other",
] as const
