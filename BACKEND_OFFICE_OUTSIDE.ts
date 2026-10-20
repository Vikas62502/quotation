// @ts-nocheck
/**
 * =============================================================================
 * BACKEND REFERENCE — Office Outside records (not All quotations)
 * =============================================================================
 *
 * Frontend (Oct 2026):
 *   Admin → Quotations → All Outside   (`components/office-outside-admin-panel.tsx`)
 *   Accounts → Accounts list (sent rows mixed with quotations)
 *   Accounts → Manage (GST / file charges same as Office Inside)
 *   Accounts → Vendor Outside (vendor card + leaser + customer dropdown)
 *   Accounts → Vendor Outside ledger   (`components/office-outside-accounts-ledger.tsx`)
 *   `lib/api.ts` → `api.admin.officeOutside`
 *   `lib/office-outside-accounts.ts`
 *
 * Auth:
 *   Admin JWT for create / list / vendor / send / slip / delete
 *   Account-management JWT (and admin) for GET sent list, PATCH vendor/fileType,
 *     ledger PATCH, payment-details PATCH, leaser PUT on office_outside vendors
 *   Dealers must NOT see or mutate these rows
 *
 * This is a SEPARATE dataset from `quotations`.
 * Do NOT insert into quotations. Do NOT show these rows on All quotations.
 * Do NOT inject OO-* ids into GET /quotations (approved / accounts).
 * Accounts SPA GETs `/admin/office-outside?status=sent` and merges into the payments table.
 * Create uses the same customer + product form, but POST lands here only.
 *
 * Flow:
 *   1. POST record (customer + products + subtotal + fileType)
 *   2. PATCH outsideVendorId (subvendors.kind must be office_outside)
 *   3. POST send-to-accounts  → sets sentToAccountsAt
 *   4. Accounts list = rows where sentToAccountsAt IS NOT NULL
 *   5. Slip = 1-page quotation (customer, selected dealer, required products, subtotal)
 *      Chairbord / company name / GST / bank / logo must NOT appear on this document
 *      (PDF is generated on the client; backend only stores slip notes + product snapshot)
 *   6. After send, vendor + fileType stay editable (PATCH). Echo the new vendor/fileType
 *      on every GET so Admin, Accounts list, Manage, slip, and Vendor Outside stay in sync.
 *   7. Accounts Manage ledger = Office Inside amounts (proposal, PI, file charges, GST, others)
 *      GST = (proposal − PI) × 8.9% when PI > 0, else 0. Same formula as office inside.
 *   8. Leaser for these files lives on the office_outside vendor (SUNDER JI), NOT office_inside.
 *      Same PUT `/admin/subvendors/:id/leaser`. customer_ids may be OO-* record ids.
 *      Profit on that vendor card is COMPLETE file profit:
 *        subtotal − (PI + fileCharges + GST + others)
 *      Ignore subvendors.profit_ratio for kind=office_outside.
 *
 * Display amount is ALWAYS subtotal (set price), never amount-after-subsidy.
 *
 * Do:
 *   - Allow PATCH outsideVendorId / fileType after sent_to_accounts_at
 *   - Persist GST with Office Inside formula (8.9% of proposal − PI when PI > 0)
 *   - Persist installments on the OO record (not quotations)
 *   - Accept office_outside vendor ids on PUT /admin/subvendors/:id/leaser
 *   - Accept OO-* ids in leaser customer_ids
 *
 * Do not:
 *   - Insert OO rows into quotations
 *   - PUT OO ledger onto subvendor_ledger.quotation_id
 *   - Freeze vendor/fileType after send
 *   - Apply profit_ratio to Vendor Outside profit
 *   - Post Office Outside collect-other onto office_inside vendors
 *   - 404 leaser because vendor.kind is office_outside
 *
 * -----------------------------------------------------------------------------
 * SQL
 * -----------------------------------------------------------------------------
 *
 * CREATE TABLE IF NOT EXISTS office_outside_records (
 *   id                   VARCHAR(64) PRIMARY KEY,
 *   customer_name        VARCHAR(255) NOT NULL DEFAULT '',
 *   mobile               VARCHAR(16)  NOT NULL DEFAULT '',
 *   email                VARCHAR(255) NOT NULL DEFAULT '',
 *   address              TEXT         NOT NULL DEFAULT '',
 *   notes                TEXT         NOT NULL DEFAULT '',
 *   customer_json        JSONB        NOT NULL DEFAULT '{}'::jsonb,
 *   products_json        JSONB        NOT NULL DEFAULT '{}'::jsonb,
 *   discount             INTEGER      NOT NULL DEFAULT 0,
 *   subtotal             INTEGER      NOT NULL DEFAULT 0,
 *   amount               INTEGER      NOT NULL DEFAULT 0,  -- store SAME as subtotal
 *   file_type            VARCHAR(16)  NULL
 *                          CHECK (file_type IS NULL OR file_type IN ('loan','cash','mix')),
 *   outside_vendor_id    UUID         NULL REFERENCES subvendors(id) ON DELETE SET NULL,
 *   sent_to_accounts_at  TIMESTAMPTZ  NULL,
 *   slip_items           TEXT         NOT NULL DEFAULT '',
 *   slip_notes           TEXT         NOT NULL DEFAULT '',
 *   slip_updated_at      TIMESTAMPTZ  NULL,
 *   installments_json    JSONB        NOT NULL DEFAULT '[]'::jsonb,
 *   payment_status       VARCHAR(16)  NOT NULL DEFAULT 'pending'
 *                          CHECK (payment_status IN ('pending','partial','completed')),
 *   payment_mode         VARCHAR(16)  NULL,
 *   created_by           VARCHAR(64)  NULL,
 *   updated_by           VARCHAR(64)  NULL,
 *   created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
 *   updated_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
 * );
 *
 * CREATE INDEX IF NOT EXISTS office_outside_sent_idx
 *   ON office_outside_records (sent_to_accounts_at)
 *   WHERE sent_to_accounts_at IS NOT NULL;
 * CREATE INDEX IF NOT EXISTS office_outside_vendor_idx
 *   ON office_outside_records (outside_vendor_id);
 * CREATE INDEX IF NOT EXISTS office_outside_mobile_idx
 *   ON office_outside_records (mobile);
 * CREATE INDEX IF NOT EXISTS office_outside_file_type_idx
 *   ON office_outside_records (file_type);
 *
 * -- Ledger keyed by office_outside id (NOT quotations.id)
 * CREATE TABLE IF NOT EXISTS office_outside_ledger (
 *   id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *   record_id        VARCHAR(64) NOT NULL UNIQUE
 *                      REFERENCES office_outside_records(id) ON DELETE CASCADE,
 *   vendor_id        UUID NULL REFERENCES subvendors(id) ON DELETE SET NULL,
 *   proposal         INTEGER NOT NULL DEFAULT 0,
 *   pi               INTEGER NOT NULL DEFAULT 0,
 *   file_charges     INTEGER NOT NULL DEFAULT 0,
 *   gst_charges      INTEGER NOT NULL DEFAULT 0,
 *   others           INTEGER NOT NULL DEFAULT 0,
 *   received_amount  INTEGER NOT NULL DEFAULT 0,
 *   loan_amount      INTEGER NOT NULL DEFAULT 0,
 *   cash_amount      INTEGER NOT NULL DEFAULT 0,
 *   remaining        INTEGER NOT NULL DEFAULT 0,
 *   cost_of_site     INTEGER NOT NULL DEFAULT 0,  -- vendor cost = PI + file + GST + others
 *   updated_by       VARCHAR(64) NULL,
 *   created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 *   updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
 * );
 *
 * CREATE INDEX IF NOT EXISTS office_outside_ledger_vendor_idx
 *   ON office_outside_ledger (vendor_id);
 *
 * ALTER TABLE office_outside_records
 *   ADD COLUMN IF NOT EXISTS installments_json JSONB NOT NULL DEFAULT '[]'::jsonb,
 *   ADD COLUMN IF NOT EXISTS payment_status VARCHAR(16) NOT NULL DEFAULT 'pending',
 *   ADD COLUMN IF NOT EXISTS payment_mode VARCHAR(16) NULL;
 *
 * ALTER TABLE office_outside_ledger
 *   ADD COLUMN IF NOT EXISTS loan_amount INTEGER NOT NULL DEFAULT 0,
 *   ADD COLUMN IF NOT EXISTS cash_amount INTEGER NOT NULL DEFAULT 0,
 *   ADD COLUMN IF NOT EXISTS remaining INTEGER NOT NULL DEFAULT 0,
 *   ADD COLUMN IF NOT EXISTS cost_of_site INTEGER NOT NULL DEFAULT 0;
 *
 * Do not reuse subvendor_ledger.quotation_id for these rows.
 *
 * -----------------------------------------------------------------------------
 * Sequelize (copy-paste)
 * -----------------------------------------------------------------------------
 *
 * OfficeOutsideRecord.init({
 *   id: { type: DataTypes.STRING(64), primaryKey: true },
 *   customerName: { type: DataTypes.STRING(255), allowNull: false, defaultValue: '', field: 'customer_name' },
 *   mobile: { type: DataTypes.STRING(16), allowNull: false, defaultValue: '' },
 *   email: { type: DataTypes.STRING(255), allowNull: false, defaultValue: '' },
 *   address: { type: DataTypes.TEXT, allowNull: false, defaultValue: '' },
 *   notes: { type: DataTypes.TEXT, allowNull: false, defaultValue: '' },
 *   customerJson: { type: DataTypes.JSONB, allowNull: false, defaultValue: {}, field: 'customer_json' },
 *   productsJson: { type: DataTypes.JSONB, allowNull: false, defaultValue: {}, field: 'products_json' },
 *   discount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
 *   subtotal: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
 *   amount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
 *   fileType: { type: DataTypes.STRING(16), allowNull: true, field: 'file_type' },
 *   outsideVendorId: { type: DataTypes.UUID, allowNull: true, field: 'outside_vendor_id' },
 *   sentToAccountsAt: { type: DataTypes.DATE, allowNull: true, field: 'sent_to_accounts_at' },
 *   slipItems: { type: DataTypes.TEXT, allowNull: false, defaultValue: '', field: 'slip_items' },
 *   slipNotes: { type: DataTypes.TEXT, allowNull: false, defaultValue: '', field: 'slip_notes' },
 *   slipUpdatedAt: { type: DataTypes.DATE, allowNull: true, field: 'slip_updated_at' },
 *   installmentsJson: { type: DataTypes.JSONB, allowNull: false, defaultValue: [], field: 'installments_json' },
 *   paymentStatus: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'pending', field: 'payment_status' },
 *   paymentMode: { type: DataTypes.STRING(16), allowNull: true, field: 'payment_mode' },
 *   createdBy: { type: DataTypes.STRING(64), allowNull: true, field: 'created_by' },
 *   updatedBy: { type: DataTypes.STRING(64), allowNull: true, field: 'updated_by' },
 * }, { tableName: 'office_outside_records', underscored: true, timestamps: true })
 *
 * OfficeOutsideLedger.init({
 *   id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
 *   recordId: { type: DataTypes.STRING(64), allowNull: false, unique: true, field: 'record_id' },
 *   vendorId: { type: DataTypes.UUID, allowNull: true, field: 'vendor_id' },
 *   proposal: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
 *   pi: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
 *   fileCharges: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: 'file_charges' },
 *   gstCharges: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: 'gst_charges' },
 *   others: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
 *   receivedAmount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: 'received_amount' },
 *   loanAmount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: 'loan_amount' },
 *   cashAmount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: 'cash_amount' },
 *   remaining: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
 *   costOfSite: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: 'cost_of_site' },
 *   updatedBy: { type: DataTypes.STRING(64), allowNull: true, field: 'updated_by' },
 * }, { tableName: 'office_outside_ledger', underscored: true, timestamps: true })
 *
 * -----------------------------------------------------------------------------
 * Endpoints
 * -----------------------------------------------------------------------------
 *
 * GET    /admin/office-outside
 * POST   /admin/office-outside
 * PATCH  /admin/office-outside/:id
 * DELETE /admin/office-outside/:id
 * POST   /admin/office-outside/:id/send-to-accounts
 * PATCH  /admin/office-outside/:id/slip
 * PATCH  /admin/office-outside/:id/payment-details   ← installments (same shape as quotations)
 *
 * GET    /admin/office-outside/ledger
 * PATCH  /admin/office-outside/ledger/:id
 *
 * Existing leaser (no new route):
 *   GET/PUT /admin/subvendors/:id/leaser   where subvendors.kind = office_outside
 *   customer_ids may be OO-* record ids. Do NOT 404 because vendor is not office_inside.
 *
 * Query on GET /admin/office-outside:
 *   status = all | pending | sent     (pending = sentToAccountsAt is null)
 *   search = name / mobile / id / vendor
 *   vendorId = outside vendor uuid
 *   fileType = loan | cash | mix
 *
 * Accounts GET should use status=sent (or only return sent rows for account-management role).
 *
 * -----------------------------------------------------------------------------
 * Request / response
 * -----------------------------------------------------------------------------
 *
 * POST /admin/office-outside body:
 * {
 *   "id": "OO-A1B2C3D4",          // optional; if omitted generate OO- + 8 hex
 *   "customerName": "Aman Rajak",
 *   "mobile": "8920094209",
 *   "email": "",
 *   "address": "…",
 *   "notes": "",
 *   "customer": { firstName, lastName, mobile, email, address: { street, city, state, pincode }, remarks },
 *   "products": { …ProductSelection… },   // full quotation product snapshot
 *   "discount": 0,
 *   "subtotal": 220000,                   // REQUIRED display amount (set price)
 *   "amount": 220000,                     // persist equal to subtotal
 *   "fileType": "loan" | "cash" | "mix",  // mix = Cash + loan
 *   "outsideVendorId": null
 * }
 *
 * Accept snake_case: customer_name, file_type, outside_vendor_id, customer_json, products_json.
 *
 * Validation:
 *   customerName or customer.firstName required
 *   mobile 10 digits when sent
 *   subtotal integer ≥ 0 (this is the list + slip amount)
 *   amount if sent → round INR; if omitted set amount = subtotal
 *   fileType if sent must be loan | cash | mix
 *     aliases: "cash+loan" / "cash + loan" / "cash_loan" → mix
 *   outsideVendorId if sent must exist AND subvendors.kind = 'office_outside'
 *
 * PATCH /admin/office-outside/:id  (partial — omitted keys stay)
 * {
 *   "outsideVendorId": "uuid",
 *   "fileType": "cash",
 *   "customer": { … },
 *   "products": { … },
 *   "subtotal": 220000,
 *   "discount": 0
 * }
 *
 * Vendor + fileType MUST stay writable after send-to-accounts.
 * Do NOT 400 OO_ALREADY_SENT when changing vendor/fileType on a sent row.
 * Changing vendor also updates office_outside_ledger.vendor_id.
 * Echo the new vendor name on GET (join subvendors.name).
 *
 * POST /admin/office-outside/:id/send-to-accounts
 *   400 OO_VENDOR_REQUIRED if outside_vendor_id is null
 *   400 OO_VENDOR_KIND if vendor is not office_outside
 *   Sets sent_to_accounts_at = NOW() (idempotent if already set)
 *   Upsert office_outside_ledger with proposal = subtotal when proposal is 0
 *   Does NOT freeze vendor / fileType
 *
 * PATCH /admin/office-outside/:id/payment-details
 *   Same body as quotations payment-details (phases / installments / paymentStatus / paymentMode).
 *   Persist installments_json + payment_status + payment_mode on the OO record.
 *   Do NOT call quotations installment replace. Do NOT require a quotations.id.
 *   Echo installments on GET record as installments + paymentPhases.
 *
 * PATCH /admin/office-outside/:id/slip
 * {
 *   "items": "Solar Panels: …\nSolar Inverter: …",
 *   "notes": "site notes"
 * }
 *   400 OO_VENDOR_REQUIRED if no vendor yet
 *   Sets slip_items, slip_notes, slip_updated_at
 *
 * PATCH /admin/office-outside/ledger/:id  (id = office_outside record id)
 * {
 *   "proposal": 220000,
 *   "pi": 0,
 *   "fileCharges": 5000,
 *   "gstCharges": 19135,          // SPA also sends this; recompute if omitted
 *   "others": 0,
 *   "receivedAmount": 0,
 *   "loanAmount": 0,
 *   "cashAmount": 0,
 *   "remaining": 0,
 *   "costOfSite": 0               // vendor cost; if omitted compute PI+file+GST+others
 * }
 *   Partial upsert. Missing keys must NOT reset to 0.
 *   Default proposal on first upsert = record.subtotal.
 *   GST (same as Office Inside):
 *     gstCharges = pi > 0 ? round(max(0, proposal − pi) * 0.089) : 0
 *   Always persist the computed gstCharges (do not trust a stale 0 when PI > 0).
 *   costOfSite vendor = pi + fileCharges + gstCharges + others
 *   Do NOT copy this onto quotations.site_cost.
 *
 * Profit (Vendor Outside card, COMPLETE — not profit_ratio):
 *   profit = record.subtotal − (pi + fileCharges + gstCharges + others)
 *   leaser_remaining on office_outside vendor = max(0, sum(profit of that vendor's sent files) − leaser_paid)
 *
 * GET /admin/office-outside 200:
 * {
 *   "success": true,
 *   "data": {
 *     "records": [ publicOfficeOutside(row) ],
 *     "counts": { "all": 1, "pending": 1, "sent": 0 }
 *   }
 * }
 *
 * GET /admin/office-outside/ledger 200:
 * {
 *   "success": true,
 *   "data": {
 *     "items": [
 *       {
 *         "recordId": "OO-…",
 *         "record_id": "OO-…",
 *         "vendorId": "…",
 *         "proposal": 220000,
 *         "pi": 0,
 *         "fileCharges": 0,
 *         "gstCharges": 0,
 *         "others": 0,
 *         "receivedAmount": 0,
 *         "updatedAt": "…"
 *       }
 *     ]
 *   }
 * }
 *
 * Echo camelCase + snake_case. Frontend reads camelCase first.
 *
 * Nested customer / products: echo as `customer` + `customer_json`, `products` + `products_json`.
 * requirementSlip: { items, notes, updatedAt } from slip_* columns.
 *
 * -----------------------------------------------------------------------------
 * Controller sketch
 * -----------------------------------------------------------------------------
 */

function roundInr(value) {
  const n = Math.round(Number(value) || 0)
  return Number.isFinite(n) && n >= 0 ? n : 0
}

function newOfficeOutsideId() {
  const hex = (typeof crypto !== "undefined" && crypto.randomUUID)
    ? crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()
    : Date.now().toString(36).toUpperCase()
  return `OO-${hex}`
}

function normalizeFileType(raw) {
  const t = String(raw || "").trim().toLowerCase().replace(/[\s_+-]+/g, "")
  if (t === "loan") return "loan"
  if (t === "cash") return "cash"
  if (t === "mix" || t === "cashloan" || t === "cashandloan") return "mix"
  return null
}

function publicOfficeOutside(row, vendor) {
  const customer = row.customerJson || row.customer_json || row.customer || {}
  const products = row.productsJson || row.products_json || row.products || {}
  const subtotal = roundInr(row.subtotal)
  const amount = subtotal > 0 ? subtotal : roundInr(row.amount)
  const slipUpdated = row.slipUpdatedAt || row.slip_updated_at
  const vendorId = row.outsideVendorId || row.outside_vendor_id || ""
  return {
    id: row.id,
    customerName: row.customerName || row.customer_name || "",
    customer_name: row.customerName || row.customer_name || "",
    mobile: row.mobile || "",
    email: row.email || "",
    address: row.address || "",
    notes: row.notes || "",
    customer,
    products,
    customer_json: customer,
    products_json: products,
    discount: roundInr(row.discount),
    subtotal,
    amount,
    fileType: row.fileType || row.file_type || null,
    file_type: row.fileType || row.file_type || null,
    outsideVendorId: vendorId || "",
    outside_vendor_id: vendorId || "",
    outsideVendorName: vendor?.name || row.outsideVendorName || row.outside_vendor_name || "",
    outside_vendor_name: vendor?.name || row.outsideVendorName || row.outside_vendor_name || "",
    sentToAccountsAt: row.sentToAccountsAt || row.sent_to_accounts_at || null,
    sent_to_accounts_at: row.sentToAccountsAt || row.sent_to_accounts_at || null,
    requirementSlip: {
      items: row.slipItems || row.slip_items || "",
      notes: row.slipNotes || row.slip_notes || "",
      updatedAt: slipUpdated || null,
    },
    installments: row.installmentsJson || row.installments_json || row.installments || [],
    paymentPhases: row.installmentsJson || row.installments_json || row.paymentPhases || [],
    paymentStatus: row.paymentStatus || row.payment_status || "pending",
    payment_status: row.paymentStatus || row.payment_status || "pending",
    paymentMode: row.paymentMode || row.payment_mode || row.fileType || row.file_type || null,
    payment_mode: row.paymentMode || row.payment_mode || row.fileType || row.file_type || null,
    createdAt: row.createdAt || row.created_at,
    updatedAt: row.updatedAt || row.updated_at,
  }
}

function publicOutsideLedger(row) {
  const n = (v) => roundInr(v)
  const recordId = row.recordId || row.record_id
  return {
    recordId,
    record_id: recordId,
    quotationId: recordId,
    quotation_id: recordId,
    vendorId: row.vendorId || row.vendor_id || null,
    vendor_id: row.vendorId || row.vendor_id || null,
    proposal: n(row.proposal),
    pi: n(row.pi),
    fileCharges: n(row.fileCharges ?? row.file_charges),
    file_charges: n(row.fileCharges ?? row.file_charges),
    gstCharges: n(row.gstCharges ?? row.gst_charges),
    gst_charges: n(row.gstCharges ?? row.gst_charges),
    others: n(row.others),
    receivedAmount: n(row.receivedAmount ?? row.received_amount),
    received_amount: n(row.receivedAmount ?? row.received_amount),
    loanAmount: n(row.loanAmount ?? row.loan_amount),
    loan_amount: n(row.loanAmount ?? row.loan_amount),
    cashAmount: n(row.cashAmount ?? row.cash_amount),
    cash_amount: n(row.cashAmount ?? row.cash_amount),
    remaining: n(row.remaining),
    costOfSite: n(row.costOfSite ?? row.cost_of_site),
    cost_of_site: n(row.costOfSite ?? row.cost_of_site),
    updatedAt: row.updatedAt || row.updated_at,
  }
}

const OFFICE_INSIDE_GST_RATE = 0.089

function officeOutsideGstCharges(proposal, pi) {
  const proposalAmt = roundInr(proposal)
  const piAmt = roundInr(pi)
  if (piAmt <= 0) return 0
  return Math.round(Math.max(0, proposalAmt - piAmt) * OFFICE_INSIDE_GST_RATE)
}

function officeOutsideVendorCost(row) {
  const pi = roundInr(row.pi)
  const fileCharges = roundInr(row.fileCharges ?? row.file_charges)
  const gst = officeOutsideGstCharges(row.proposal, pi)
  const others = roundInr(row.others)
  return pi + fileCharges + gst + others
}

function officeOutsideCompleteProfit(subtotal, ledger) {
  return Math.max(0, roundInr(subtotal) - officeOutsideVendorCost(ledger || {}))
}

/**
 * Error codes:
 *   AUTH_004             — not admin / not accounts
 *   OO_VAL_CUSTOMER      — missing customer name
 *   OO_VAL_MOBILE        — mobile not 10 digits
 *   OO_VAL_SUBTOTAL      — subtotal invalid
 *   OO_VAL_FILE_TYPE     — fileType not loan|cash|mix
 *   OO_VENDOR_REQUIRED   — send / slip without outside vendor
 *   OO_VENDOR_KIND       — vendor is not office_outside
 *   OO_VENDOR_404        — vendor id not found
 *   OO_404               — record not found
 *
 * Do not 400 if fileType is omitted on create (frontend may set it later on the row).
 * Do not 400 OO_ALREADY_SENT for vendor / fileType PATCH on a sent row.
 */
export const OFFICE_OUTSIDE_ERROR_CODES = {
  AUTH_004: "AUTH_004",
  OO_VAL_CUSTOMER: "OO_VAL_CUSTOMER",
  OO_VAL_MOBILE: "OO_VAL_MOBILE",
  OO_VAL_SUBTOTAL: "OO_VAL_SUBTOTAL",
  OO_VAL_FILE_TYPE: "OO_VAL_FILE_TYPE",
  OO_VENDOR_REQUIRED: "OO_VENDOR_REQUIRED",
  OO_VENDOR_KIND: "OO_VENDOR_KIND",
  OO_VENDOR_404: "OO_VENDOR_404",
  OO_404: "OO_404",
}

export {
  publicOfficeOutside,
  publicOutsideLedger,
  normalizeFileType,
  newOfficeOutsideId,
  roundInr,
  officeOutsideGstCharges,
  officeOutsideVendorCost,
  officeOutsideCompleteProfit,
  OFFICE_INSIDE_GST_RATE,
}
