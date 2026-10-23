// @ts-nocheck
/**
 * =============================================================================
 * BACKEND — Vendor leaser bills (Account Management → Vendor Outside)
 * =============================================================================
 *
 * CHANGELOG Oct 23 2026 — APPLY THIS
 *   Vendor Outside → Vendor leaser → Manage → Bills is no longer localStorage-only.
 *   Persist each bill row: date, basic, payment mode, customer, remark, uploaded file.
 *   Edit / delete on the SPA is a full PUT replace (same pattern as leaser payments).
 *
 * Frontend (Oct 2026):
 *   - Account Management → Vendor Outside → Vendor leaser → Manage → Bills
 *   - `lib/api.ts` → `api.admin.subvendors.bills`
 *   - `lib/admin-subvendors.ts` (`SubvendorVendorBill`)
 *   - `components/admin-subvendor-panel.tsx`
 *
 * Auth: same as `/admin/subvendors/:id/leaser`
 *   Admin / super-admin JWT, or access includes "admin" / account-management.
 *   Account-management JWT may GET/PUT bills for office_outside vendors.
 *   403 for dealer / visitor unless they have admin or accounts access.
 *
 * Why:
 *   Bills were device-only (`adminSubvendorVendorBills`). Refresh / other devices lost
 *   the bill amount, so GST and profit vendor reset. The SPA now GETs on load and
 *   PUTs on Save payments.
 *
 * Do NOT put bills on PUT /admin/subvendors/:id/leaser.
 * Leaser = payment rows. Bills = this table / these routes.
 *
 * -----------------------------------------------------------------------------
 * UI contract (do not invent a different meaning)
 * -----------------------------------------------------------------------------
 *
 * Vendor Outside leaser (FE-derived except bill rows and payments):
 *   Subtotal          = sum of Office Outside file subtotals
 *   Total amount      = loan + cash (from Accounts)
 *   Bill              = SUM(bills.basicAmount) for that vendor
 *   Charges           = file charges + others (Accounts ledger)
 *   GST               = (subtotal − bill) × 9.8%   (FE; do not persist GST)
 *   Profit vendor     = loanAmount − bill − charges − GST
 *                       (if loan is 0, use total amount)
 *   Total payment     = SUM(leaser payment amounts)
 *   Total remaining   = Profit vendor − Total payment
 *
 * Each bill row (Manage → Bills):
 *   date            YYYY-MM-DD as sent
 *   basicAmount     INR int (this is the bill amount that feeds Bill / GST / profit)
 *   paymentMode     Cash | Bank | UPI | Cheque | Other
 *   remark          string
 *   customerIds     array — Office Outside record ids (OO-* AND UUID PKs)
 *   billFileName    original filename
 *   billFileDataUrl data URL  OR  billFileUrl https URL after object-storage upload
 *
 * Newest bill is shown on top in the SPA; sortOrder 1 is the oldest (first saved).
 * Empty bills [] is valid (clears that vendor's bills; Bill column → ₹0).
 *
 * Do not:
 *   - Compute GST / profit vendor on the backend (SPA already does)
 *   - Reject office_outside vendors
 *   - Reject customer_ids that are OO-* or UUID office_outside_records.id
 *   - Require a quotations row for customer_ids
 *   - Store bills on office_inside vendors (SPA only sends them for office_outside)
 *   - Drop the uploaded file because the next PUT omitted a huge data URL but
 *     still sent the same billFileName — if data URL / URL is blank AND name is
 *     unchanged, keep the previously stored file
 *   - 404 because vendor.kind is office_outside
 *
 * JSON body can be large (data URL up to 2.5 MB file ≈ ~3.4 MB string).
 * Set express.json({ limit: "5mb" }) on these routes (or the admin router).
 *
 * -----------------------------------------------------------------------------
 * SQL
 * -----------------------------------------------------------------------------
 *
 * CREATE TABLE IF NOT EXISTS subvendor_vendor_bills (
 *   id                  TEXT PRIMARY KEY,
 *   vendor_id           UUID NOT NULL REFERENCES subvendors(id) ON DELETE CASCADE,
 *   bill_date           DATE NOT NULL,
 *   basic_amount        NUMERIC(14, 2) NOT NULL DEFAULT 0,
 *   remark              TEXT NOT NULL DEFAULT '',
 *   payment_mode        VARCHAR(32) NOT NULL DEFAULT 'Cash',
 *   customer_ids        JSONB NOT NULL DEFAULT '[]'::jsonb,
 *   bill_file_name      TEXT NOT NULL DEFAULT '',
 *   bill_file_data_url  TEXT NOT NULL DEFAULT '',
 *   bill_file_url       TEXT NOT NULL DEFAULT '',
 *   sort_order          INTEGER NOT NULL DEFAULT 1,
 *   created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 *   updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
 * );
 *
 * CREATE INDEX IF NOT EXISTS subvendor_vendor_bills_vendor_idx
 *   ON subvendor_vendor_bills (vendor_id, sort_order);
 *
 * customer_ids is a JSON array of id strings:
 *   office_outside → office_outside_records.id (OO-* or UUID)
 * Do not reject OO-* ids. Do not require a quotations row.
 *
 * Preferred file storage:
 *   On PUT, if billFileDataUrl starts with "data:", upload the bytes to object
 *   storage, set bill_file_url, and you MAY clear bill_file_data_url so GET
 *   stays small. Echo billFileUrl (SPA also reads billFileDataUrl as the href).
 *   If you cannot upload, persist the data URL in bill_file_data_url (TEXT).
 *
 * Max file: 2.5 MB decoded. Larger → 400 VAL_BILL_FILE.
 *
 * -----------------------------------------------------------------------------
 * Sequelize (copy-paste)
 * -----------------------------------------------------------------------------
 *
 * SubvendorVendorBill.init({
 *   id: { type: DataTypes.STRING(80), primaryKey: true },
 *   vendorId: { type: DataTypes.UUID, allowNull: false, field: 'vendor_id' },
 *   date: { type: DataTypes.DATEONLY, allowNull: false, field: 'bill_date' },
 *   basicAmount: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0, field: 'basic_amount' },
 *   remark: { type: DataTypes.TEXT, allowNull: false, defaultValue: '' },
 *   paymentMode: { type: DataTypes.STRING(32), allowNull: false, defaultValue: 'Cash', field: 'payment_mode' },
 *   customerIds: { type: DataTypes.JSONB, allowNull: false, defaultValue: [], field: 'customer_ids' },
 *   billFileName: { type: DataTypes.TEXT, allowNull: false, defaultValue: '', field: 'bill_file_name' },
 *   billFileDataUrl: { type: DataTypes.TEXT, allowNull: false, defaultValue: '', field: 'bill_file_data_url' },
 *   billFileUrl: { type: DataTypes.TEXT, allowNull: false, defaultValue: '', field: 'bill_file_url' },
 *   sortOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1, field: 'sort_order' },
 * }, { tableName: 'subvendor_vendor_bills', underscored: true, timestamps: true })
 *
 * Subvendor.hasMany(SubvendorVendorBill, { foreignKey: 'vendorId', as: 'vendorBills' })
 * SubvendorVendorBill.belongsTo(Subvendor, { foreignKey: 'vendorId' })
 *
 * -----------------------------------------------------------------------------
 * Endpoints
 * -----------------------------------------------------------------------------
 *
 * GET  /admin/subvendors/bills
 * GET  /admin/subvendors/:id/bills
 * PUT  /admin/subvendors/:id/bills     ← replace ALL bills for that vendor
 *
 * Query on GET /admin/subvendors/bills:
 *   vendorId  (optional)
 *
 * PUT is a full replace for that vendor (matches Manage → Save payments).
 *   - Delete existing rows for vendor_id
 *   - Insert the sent bills. Persist client `id` as-is when non-empty
 *     (UUID **or** `vb-…`). Only generate a UUID when id is missing/blank.
 *   - Do NOT touch subvendor_leaser_payments
 *   - Do NOT recompute leaser_paid
 *
 * Vendor must exist. kind = office_outside is the live caller; office_inside
 * is allowed (no-op empty array) — do not 404 on kind.
 *
 * -----------------------------------------------------------------------------
 * Request / response
 * -----------------------------------------------------------------------------
 *
 * PUT /admin/subvendors/:id/bills body:
 * {
 *   "bills": [
 *     {
 *       "id": "optional-uuid",
 *       "date": "2026-10-23",
 *       "basicAmount": 180000,
 *       "remark": "",
 *       "paymentMode": "Cash",
 *       "customerIds": ["8d9ecb7b-25db-4716-81d3-d7057b0ebc86"],
 *       "billFileName": "sitaram-bill.pdf",
 *       "billFileDataUrl": "data:application/pdf;base64,...",
 *       "sortOrder": 1
 *     }
 *   ]
 * }
 *
 * Accept snake_case:
 *   basic_amount, payment_mode, payment_type (alias of paymentMode),
 *   customer_ids, customer_id (single → wrap as array),
 *   bill_date (alias of date), bill_file_name, bill_file_data_url,
 *   bill_file_url, sort_order.
 *
 * paymentMode allowed: Cash, Bank, UPI, Cheque, Other. Unknown → "Cash".
 * basicAmount: INR integer ≥ 0.
 * date: YYYY-MM-DD DATEONLY as sent (`date` or `bill_date`). Empty → today.
 *   Do **not** rewrite a sent date to NOW() / created_at.
 * customerIds: array of strings (OO-* or UUID office-outside record ids).
 *   Invalid / missing → []. Do not require the id to exist in quotations.
 * sortOrder: integer ≥ 1. If omitted, use 1..n in body order.
 * billFileDataUrl: optional data URL. billFileUrl: optional https URL.
 * Empty bills [] is valid (clears that vendor's bills).
 *
 * GET /admin/subvendors/bills 200:
 * {
 *   "success": true,
 *   "data": {
 *     "bills": [
 *       {
 *         "id": "...",
 *         "vendorId": "...",
 *         "vendor_id": "...",
 *         "date": "2026-10-23",
 *         "bill_date": "2026-10-23",
 *         "basicAmount": 180000,
 *         "basic_amount": 180000,
 *         "remark": "",
 *         "paymentMode": "Cash",
 *         "payment_mode": "Cash",
 *         "customerIds": ["8d9ecb7b-25db-4716-81d3-d7057b0ebc86"],
 *         "customer_ids": ["8d9ecb7b-25db-4716-81d3-d7057b0ebc86"],
 *         "billFileName": "sitaram-bill.pdf",
 *         "bill_file_name": "sitaram-bill.pdf",
 *         "billFileDataUrl": "data:application/pdf;base64,...",
 *         "bill_file_data_url": "data:application/pdf;base64,...",
 *         "billFileUrl": "",
 *         "bill_file_url": "",
 *         "sortOrder": 1,
 *         "sort_order": 1,
 *         "createdAt": "...",
 *         "updatedAt": "..."
 *       }
 *     ]
 *   }
 * }
 *
 * If the file was uploaded to object storage, billFileDataUrl may be "" and
 * billFileUrl must be the https URL. SPA uses either as the download href.
 *
 * GET /admin/subvendors/:id/bills 200:
 * {
 *   "success": true,
 *   "data": {
 *     "vendorId": "...",
 *     "billSum": 180000,
 *     "bill_sum": 180000,
 *     "bills": [ ...same as above, that vendor only... ]
 *   }
 * }
 *
 * billSum MUST equal SUM(bills.basicAmount) and MUST be 0 when there are no rows.
 * Echo camelCase + snake_case. SPA reads camelCase first.
 *
 * Order on GET: sort_order ASC. Frontend reverses for newest-on-top.
 *
 * Errors:
 *   AUTH_004        — not admin / not accounts
 *   SUBVENDOR_404   — vendor id not found (office_inside OR office_outside is valid)
 *   VAL_BILLS       — bills missing or not an array
 *   VAL_AMOUNT      — basicAmount negative / not a number
 *   VAL_BILL_FILE   — file larger than 2.5 MB or not a data URL / http(s) URL
 *
 * -----------------------------------------------------------------------------
 * Controller sketch
 * -----------------------------------------------------------------------------
 */

const BILL_PAYMENT_MODES = ["Cash", "Bank", "UPI", "Cheque", "Other"]
const MAX_BILL_FILE_BYTES = 2.5 * 1024 * 1024

function roundInr(value) {
  const n = Math.round(Number(value) || 0)
  return Number.isFinite(n) && n >= 0 ? n : 0
}

function asText(value) {
  return value == null ? "" : String(value).trim()
}

function asCustomerIds(raw, fallbackSingle) {
  if (Array.isArray(raw)) return raw.map((value) => asText(value)).filter(Boolean)
  const single = asText(fallbackSingle)
  return single ? [single] : []
}

function billDateYmd(raw) {
  const text = asText(raw)
  const match = text.match(/^(\d{4}-\d{2}-\d{2})/)
  if (match) return match[1]
  const parsed = new Date(text)
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10)
  return new Date().toISOString().slice(0, 10)
}

function paymentModeOf(row) {
  const value = asText(row.paymentMode || row.payment_mode || row.paymentType || row.payment_type)
  return BILL_PAYMENT_MODES.includes(value) ? value : "Cash"
}

function decodedDataUrlBytes(dataUrl) {
  const text = asText(dataUrl)
  const match = text.match(/^data:[^;]+;base64,(.*)$/s)
  if (!match) return 0
  return Math.floor((match[1].replace(/\s+/g, "").length * 3) / 4)
}

function assertBillFile(row) {
  const dataUrl = asText(row.billFileDataUrl || row.bill_file_data_url)
  const fileUrl = asText(row.billFileUrl || row.bill_file_url)
  if (dataUrl) {
    if (!dataUrl.startsWith("data:")) {
      const err = new Error("billFileDataUrl must be a data URL")
      err.status = 400
      err.code = "VAL_BILL_FILE"
      throw err
    }
    if (decodedDataUrlBytes(dataUrl) > MAX_BILL_FILE_BYTES) {
      const err = new Error("Bill file must be under 2.5 MB")
      err.status = 400
      err.code = "VAL_BILL_FILE"
      throw err
    }
  }
  if (fileUrl && !/^https?:\/\//i.test(fileUrl)) {
    const err = new Error("billFileUrl must be an http(s) URL")
    err.status = 400
    err.code = "VAL_BILL_FILE"
    throw err
  }
}

function publicVendorBill(row) {
  const customerIds = asCustomerIds(row.customerIds ?? row.customer_ids, row.customerId ?? row.customer_id)
  const date = billDateYmd(row.date || row.bill_date)
  const paymentMode = paymentModeOf(row)
  const basicAmount = roundInr(row.basicAmount ?? row.basic_amount ?? row.amount)
  const billFileName = asText(row.billFileName ?? row.bill_file_name)
  const billFileDataUrl = asText(row.billFileDataUrl ?? row.bill_file_data_url)
  const billFileUrl = asText(row.billFileUrl ?? row.bill_file_url)
  const href = billFileDataUrl || billFileUrl
  const sortOrder = Math.max(1, roundInr(row.sortOrder ?? row.sort_order) || 1)
  return {
    id: row.id,
    vendorId: row.vendorId || row.vendor_id,
    vendor_id: row.vendorId || row.vendor_id,
    date,
    bill_date: date,
    basicAmount,
    basic_amount: basicAmount,
    remark: asText(row.remark ?? row.remarks),
    paymentMode,
    payment_mode: paymentMode,
    customerIds,
    customer_ids: customerIds,
    billFileName,
    bill_file_name: billFileName,
    billFileDataUrl: href,
    bill_file_data_url: href,
    billFileUrl,
    bill_file_url: billFileUrl,
    sortOrder,
    sort_order: sortOrder,
    createdAt: row.createdAt || row.created_at,
    updatedAt: row.updatedAt || row.updated_at,
  }
}

function normalizeIncomingBill(row, vendorId, index, previousById) {
  assertBillFile(row)
  const id = asText(row.id) || (typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `vb-${Date.now()}-${index}`)
  const previous = previousById.get(id)
  const nextName = asText(row.billFileName ?? row.bill_file_name)
  let billFileDataUrl = asText(row.billFileDataUrl ?? row.bill_file_data_url)
  let billFileUrl = asText(row.billFileUrl ?? row.bill_file_url)
  const billFileName = nextName || asText(previous?.billFileName)
  if (!billFileDataUrl && !billFileUrl && previous && billFileName === asText(previous.billFileName)) {
    billFileDataUrl = asText(previous.billFileDataUrl)
    billFileUrl = asText(previous.billFileUrl)
  }
  return {
    id,
    vendorId,
    date: billDateYmd(row.date || row.bill_date),
    basicAmount: roundInr(row.basicAmount ?? row.basic_amount ?? row.amount),
    remark: asText(row.remark ?? row.remarks),
    paymentMode: paymentModeOf(row),
    customerIds: asCustomerIds(row.customerIds ?? row.customer_ids, row.customerId ?? row.customer_id),
    billFileName,
    billFileDataUrl,
    billFileUrl,
    sortOrder: Math.max(1, roundInr(row.sortOrder ?? row.sort_order) || index + 1),
  }
}

/**
 * GET  /admin/subvendors/bills
 * GET  /admin/subvendors/:id/bills
 * PUT  /admin/subvendors/:id/bills
 *
 * After PUT: billSum = sum(bills.basicAmount). Never set from file charges / kW.
 *
 * Express-style:
 *
 *   router.get("/admin/subvendors/bills", requireAdminOrAccounts, async (req, res) => {
 *     const where = req.query.vendorId ? { vendorId: req.query.vendorId } : {}
 *     const rows = await SubvendorVendorBill.findAll({ where, order: [["sortOrder", "ASC"]] })
 *     res.json({ success: true, data: { bills: rows.map(publicVendorBill) } })
 *   })
 *
 *   router.get("/admin/subvendors/:id/bills", requireAdminOrAccounts, async (req, res) => {
 *     const vendor = await Subvendor.findByPk(req.params.id)
 *     if (!vendor) return res.status(404).json({ success: false, code: "SUBVENDOR_404" })
 *     const rows = await SubvendorVendorBill.findAll({
 *       where: { vendorId: vendor.id },
 *       order: [["sortOrder", "ASC"]],
 *     })
 *     const bills = rows.map(publicVendorBill)
 *     const billSum = bills.reduce((sum, row) => sum + row.basicAmount, 0)
 *     res.json({
 *       success: true,
 *       data: { vendorId: vendor.id, billSum, bill_sum: billSum, bills },
 *     })
 *   })
 *
 *   router.put("/admin/subvendors/:id/bills", requireAdminOrAccounts, async (req, res) => {
 *     const vendor = await Subvendor.findByPk(req.params.id)
 *     if (!vendor) return res.status(404).json({ success: false, code: "SUBVENDOR_404" })
 *     const incoming = req.body?.bills ?? req.body?.items
 *     if (!Array.isArray(incoming)) {
 *       return res.status(400).json({ success: false, code: "VAL_BILLS" })
 *     }
 *     const existing = await SubvendorVendorBill.findAll({ where: { vendorId: vendor.id } })
 *     const previousById = new Map(existing.map((row) => [row.id, row]))
 *     const next = incoming.map((row, index) => normalizeIncomingBill(row, vendor.id, index, previousById))
 *     await SubvendorVendorBill.destroy({ where: { vendorId: vendor.id } })
 *     if (next.length) await SubvendorVendorBill.bulkCreate(next)
 *     const bills = next.map(publicVendorBill)
 *     const billSum = bills.reduce((sum, row) => sum + row.basicAmount, 0)
 *     res.json({
 *       success: true,
 *       data: { vendorId: vendor.id, billSum, bill_sum: billSum, bills },
 *     })
 *   })
 */
export const SUBVENDOR_BILLS_ERROR_CODES = {
  AUTH_004: "AUTH_004",
  SUBVENDOR_404: "SUBVENDOR_404",
  VAL_BILLS: "VAL_BILLS",
  VAL_AMOUNT: "VAL_AMOUNT",
  VAL_BILL_FILE: "VAL_BILL_FILE",
}

export {
  publicVendorBill,
  normalizeIncomingBill,
  roundInr,
  asCustomerIds,
  BILL_PAYMENT_MODES,
}
