// @ts-nocheck
/**
 * =============================================================================
 * BACKEND — Google Sheets → HR Social Media Leads (Meta / IG / FB exports)
 * =============================================================================
 *
 * Spreadsheet (production):
 *   https://docs.google.com/spreadsheets/d/18zqPIpa3fcjRvfNqdm3FPC10bszPIPHbv5F3-TMk0A0
 *
 * Each tab (e.g. Ajmer_Leads, Jaipur_Leads, Chairbord - Ajme Leads) becomes an HR
 * panel sub-tab when enabled. Sync reads new rows, stores in DB, round-robin assigns.
 *
 * Oct 2026 — CREATED rows MUST reach dealer Calling Data:
 *   Meta `lead_status=CREATED` is NOT a calling-queue status.
 *   Persist calling `status` = queued (no dealer) or assigned (has dealer).
 *   Never store or echo status="CREATED". Echo lead_status / sheetLeadStatus separately.
 *   Unassigned CREATED / blank-Final rows are round-robin assigned to the tab dealer
 *   pool (or another enabled tab on the same spreadsheet if this tab has no pool).
 *   GET /dealers/me/calling-queue/* must return those assigned rows (see
 *   BACKEND_CALLING_QUEUE_CURRENT.ts).
 *
 * Frontend:
 *   - HR → Social Media tab
 *   - lib/google-sheets-social-leads.ts
 *   - lib/api.ts → api.hr.sheetSources.*
 *
 * Security:
 *   - NEVER commit service account JSON to git.
 *   - Share spreadsheet with service account email (Editor).
 *   - Env: GOOGLE_SERVICE_ACCOUNT_JSON (stringified) OR GOOGLE_APPLICATION_CREDENTIALS path.
 *
 * Credential errors (SPA **§BO** / HANDOFF **§61**):
 *   GOOGLE_SHEETS_CREDENTIALS_MISSING  — neither env var set → 503
 *   GOOGLE_SHEETS_CREDENTIALS_INVALID  — JSON present but unparseable → 500
 *   Google 403 / API errors            — echo Google message; do NOT use MISSING
 * Restart the Node process after adding .env. Do not tell the SPA “add env” when env is set.
 *
 * =============================================================================
 */

import { google } from "googleapis"

const DEFAULT_SPREADSHEET_ID = "18zqPIpa3fcjRvfNqdm3FPC10bszPIPHbv5F3-TMk0A0"

// -----------------------------------------------------------------------------
// DB tables (suggested)
// -----------------------------------------------------------------------------

/**
 * hr_sheet_sources
 *   id UUID PK
 *   spreadsheet_id VARCHAR
 *   sheet_tab_name VARCHAR          -- e.g. Ajmer_Leads
 *   display_name VARCHAR
 *   enabled BOOLEAN DEFAULT false
 *   dealer_ids JSONB                -- pool for round-robin
 *   active_limit_per_dealer INT DEFAULT 1
 *   last_synced_row INT DEFAULT 1     -- 1-based sheet row after header
 *   last_synced_at TIMESTAMPTZ
 *   last_sync_status VARCHAR
 *   last_sync_error TEXT
 *   upload_id UUID NULL               -- latest hr_lead_uploads batch for this tab
 *   created_at, updated_at
 *
 * hr_social_leads (extends hr_leads OR JSONB on hr_leads)
 *   id UUID PK
 *   upload_id UUID FK hr_lead_uploads
 *   sheet_source_id UUID FK hr_sheet_sources
 *   external_id VARCHAR             -- Meta lead id column (l:…)
 *   sheet_row_index INT
 *   platform, campaign_name, ad_name, lead_status
 *   remarks, remarks_2, kw
 *   assigned_person_name            -- NAME column in sheet (ops assignee label)
 *   first_call_response, second_call_response
 *   login_flag BOOLEAN
 *   final_decision, final_decision_reason
 *   created_time TIMESTAMPTZ
 *   email VARCHAR(256)              -- Meta form email column
 *   form_answers JSONB              -- [{ question, answer }] from lead-form Q&A
 *   raw_json JSONB                  -- full sheet row (includes Q&A + email)
 *   -- plus standard hr_leads: name, mobile, address, city, customer_note, assigned_dealer_id, status
 *
 * Reuse hr_lead_uploads with:
 *   source_type = 'google_sheet'
 *   source_sheet_tab = 'Ajmer_Leads'
 *   file_name = 'Google Sheet: Ajmer_Leads'
 */

// -----------------------------------------------------------------------------
// SQL migration (run once)
// -----------------------------------------------------------------------------

/*
-- PostgreSQL example

CREATE TABLE IF NOT EXISTS hr_sheet_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  spreadsheet_id VARCHAR(128) NOT NULL,
  sheet_tab_name VARCHAR(128) NOT NULL,
  display_name VARCHAR(256) NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT false,
  dealer_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  active_limit_per_dealer INT NOT NULL DEFAULT 1,
  last_synced_row INT NOT NULL DEFAULT 1,
  last_synced_at TIMESTAMPTZ,
  last_sync_status VARCHAR(32),
  last_sync_error TEXT,
  upload_id UUID REFERENCES hr_lead_uploads(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (spreadsheet_id, sheet_tab_name)
);

ALTER TABLE hr_lead_uploads
  ADD COLUMN IF NOT EXISTS source_type VARCHAR(32) DEFAULT 'csv',
  ADD COLUMN IF NOT EXISTS source_sheet_tab VARCHAR(128);

ALTER TABLE hr_leads
  ADD COLUMN IF NOT EXISTS sheet_source_id UUID REFERENCES hr_sheet_sources(id),
  ADD COLUMN IF NOT EXISTS external_id VARCHAR(128),
  ADD COLUMN IF NOT EXISTS sheet_row_index INT,
  ADD COLUMN IF NOT EXISTS platform VARCHAR(64),
  ADD COLUMN IF NOT EXISTS campaign_name VARCHAR(256),
  ADD COLUMN IF NOT EXISTS ad_name VARCHAR(256),
  ADD COLUMN IF NOT EXISTS lead_status VARCHAR(64),
  ADD COLUMN IF NOT EXISTS remarks TEXT,
  ADD COLUMN IF NOT EXISTS remarks_2 TEXT,
  ADD COLUMN IF NOT EXISTS kw VARCHAR(32),
  ADD COLUMN IF NOT EXISTS assigned_person_name VARCHAR(128),
  ADD COLUMN IF NOT EXISTS first_call_response TEXT,
  ADD COLUMN IF NOT EXISTS second_call_response TEXT,
  ADD COLUMN IF NOT EXISTS login_flag BOOLEAN,
  ADD COLUMN IF NOT EXISTS final_decision VARCHAR(128),
  ADD COLUMN IF NOT EXISTS final_decision_reason TEXT,
  ADD COLUMN IF NOT EXISTS created_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS email VARCHAR(256),
  ADD COLUMN IF NOT EXISTS form_answers JSONB,
  ADD COLUMN IF NOT EXISTS raw_json JSONB;

CREATE INDEX IF NOT EXISTS idx_hr_leads_sheet_source ON hr_leads(sheet_source_id);
CREATE INDEX IF NOT EXISTS idx_hr_leads_upload_mobile ON hr_leads(upload_id, mobile);
CREATE UNIQUE INDEX IF NOT EXISTS idx_hr_leads_sheet_external
  ON hr_leads(sheet_source_id, external_id)
  WHERE external_id IS NOT NULL AND external_id <> '';

-- One-shot: Meta CREATED leaked into calling status — dealer portal hid the row.
UPDATE hr_leads
SET status = CASE
  WHEN assigned_dealer_id IS NULL OR btrim(assigned_dealer_id::text) = '' THEN 'queued'
  ELSE 'assigned'
END
WHERE lower(btrim(coalesce(status, ''))) = 'created';
*/

// -----------------------------------------------------------------------------
// Helpers — upload batch + API row shape
// -----------------------------------------------------------------------------

function mapSheetSourceForApi(row, counts) {
  return {
    id: row.id,
    spreadsheetId: row.spreadsheet_id,
    sheetTabName: row.sheet_tab_name,
    displayName: row.display_name,
    enabled: row.enabled,
    dealerIds: asArray(row.dealer_ids),
    activeLimitPerDealer: row.active_limit_per_dealer ?? 1,
    lastSyncedAt: row.last_synced_at,
    lastSyncStatus: row.last_sync_status,
    lastSyncError: row.last_sync_error,
    uploadId: row.upload_id,
    rowCount: counts?.rowCount ?? 0,
    assignedCount: counts?.assignedCount ?? 0,
    unassignedCount: counts?.unassignedCount ?? 0,
    completedCount: counts?.completedCount ?? 0,
  }
}

/** Humanize Meta lead-form answers (₹3,000_-_₹6,000 → ₹3,000 - ₹6,000). */
function humanizeSheetFormAnswer(value) {
  const text = String(value || "")
    .replace(/_-+_/g, " - ")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
  if (!text) return ""
  return text.replace(/^[a-z]/, (ch) => ch.toUpperCase())
}

function extractFormAnswersFromRaw(raw) {
  if (!raw || typeof raw !== "object") return []
  const pick = (...aliases) => {
    for (const a of aliases) {
      const key = normalizeHeader(a)
      const v = raw[key]
      if (v) return String(v).trim()
    }
    return ""
  }
  const out = []
  const bill = pick(
    "what_is_your_average_monthly_electricity_bill?",
    "whatisyouraveragemonthlyelectricitybill",
  )
  if (bill) out.push({ question: "Average monthly electricity bill", answer: humanizeSheetFormAnswer(bill) })
  const when = pick(
    "when_are_you_planning_to_install_solar?",
    "whenareyouplanningtoinstallsolar",
  )
  if (when) out.push({ question: "When planning to install solar", answer: humanizeSheetFormAnswer(when) })
  const roof = pick("do_you_have_an_open_rooftop?", "doyouhaveanopenrooftop")
  if (roof) out.push({ question: "Open rooftop", answer: humanizeSheetFormAnswer(roof) })
  return out
}

function callingStatusForApi(r, assignedDealerId) {
  const raw = String(r.status || "").trim().toLowerCase()
  if (raw === "in_progress") return "in_progress"
  if (raw === "rescheduled") return "rescheduled"
  if (["completed", "done", "closed"].includes(raw)) return "completed"
  if (raw === "assigned") return "assigned"
  if (raw === "queued" || raw === "pending" || raw === "open") {
    return assignedDealerId ? "assigned" : "queued"
  }
  // Meta lead_status CREATED must not leak into calling `status` or the dealer portal hides the row.
  if (!raw || raw === "created" || isMetaCreatedLeadStatus(r.lead_status || r.leadStatus)) {
    return assignedDealerId ? "assigned" : "queued"
  }
  return assignedDealerId ? "assigned" : "queued"
}

function mapSocialLeadForApi(r, dealerNameById) {
  const assignedDealerId = normalizeAssigneeId(r.assigned_dealer_id) || null
  const status = callingStatusForApi(r, assignedDealerId)
  const raw = r.raw_json || r.raw || {}
  const formAnswers =
    (Array.isArray(r.form_answers) && r.form_answers.length > 0
      ? r.form_answers
      : extractFormAnswersFromRaw(raw)) || []
  const email =
    String(r.email || raw[normalizeHeader("email")] || raw.email || "").trim() || null
  return {
    id: r.id,
    externalId: r.external_id,
    name: r.name,
    mobile: r.mobile,
    email,
    address: r.address,
    city: r.city,
    customerNote: r.customer_note,
    platform: r.platform,
    campaignName: r.campaign_name,
    adName: r.ad_name,
    leadStatus: r.lead_status,
    lead_status: r.lead_status,
    sheetLeadStatus: r.lead_status,
    sheet_lead_status: r.lead_status,
    sourceType: r.source_type || "google_sheet",
    source_type: r.source_type || "google_sheet",
    sheetSourceId: r.sheet_source_id,
    sheet_source_id: r.sheet_source_id,
    remarks: r.remarks,
    remarks2: r.remarks_2,
    kw: r.kw,
    assignedPersonName: r.assigned_person_name,
    firstCallResponse: r.first_call_response,
    secondCallResponse: r.second_call_response,
    loginFlag: r.login_flag,
    finalDecision: r.final_decision,
    finalDecisionReason: r.final_decision_reason,
    createdTime: r.created_time,
    formAnswers,
    form_answers: formAnswers,
    assignedDealerId,
    assignedDealerName: assignedDealerId ? dealerNameById?.[assignedDealerId] || null : null,
    assignmentStatus: status,
    status,
    sourceTab: r.source_sheet_tab,
    raw,
    raw_json: raw,
  }
}

async function createOrGetSheetUploadBatch(sourceRow, db) {
  if (sourceRow.upload_id) {
    const existing = await db.hrLeadUploads.findByPk(sourceRow.upload_id)
    if (existing) return existing
  }

  const tab = sourceRow.sheet_tab_name
  const upload = await db.hrLeadUploads.create({
    file_name: `Google Sheet: ${tab}`,
    source_type: "google_sheet",
    source_sheet_tab: tab,
    uploaded_by: null,
    uploaded_at: new Date(),
    row_count: 0,
    dealer_ids: asArray(sourceRow.dealer_ids),
  })

  await sourceRow.update({ upload_id: upload.id })
  return upload
}

function asArray(value) {
  if (Array.isArray(value)) return value
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? parsed : [value]
    } catch {
      return [value]
    }
  }
  return []
}

function normalizeAssigneeId(value) {
  const id = String(value ?? "").trim()
  if (!id) return ""
  const lower = id.toLowerCase()
  if (["unassigned", "null", "none", "-", "na", "n/a"].includes(lower)) return ""
  return id
}

// Import from BACKEND_ASSIGN_UNASSIGNED.ts / BACKEND_ADMIN_QUOTATION_STATUS.ts:
//   assignUnassignedWithActiveCap(uploadId, { dealerIds, activeLimitPerDealer })
//   computeHrUploadLeadCounts(leads)


function sheetsCredentialError(code, message) {
  const err = new Error(message)
  err.code = code
  return err
}

function getSheetsClient({ writable = false } = {}) {
  const scope = writable
    ? "https://www.googleapis.com/auth/spreadsheets"
    : "https://www.googleapis.com/auth/spreadsheets.readonly"
  const json = String(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || "").trim()
  const keyFile = String(process.env.GOOGLE_APPLICATION_CREDENTIALS || "").trim()
  if (!json && !keyFile) {
    throw sheetsCredentialError(
      "GOOGLE_SHEETS_CREDENTIALS_MISSING",
      "GOOGLE_SHEETS_CREDENTIALS_MISSING: GOOGLE_SERVICE_ACCOUNT_JSON is not set",
    )
  }
  if (json) {
    let credentials
    try {
      credentials = JSON.parse(json)
    } catch (e) {
      throw sheetsCredentialError(
        "GOOGLE_SHEETS_CREDENTIALS_INVALID",
        "GOOGLE_SERVICE_ACCOUNT_JSON is set but is not valid JSON. Keep private_key newlines as \\n.",
      )
    }
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: [scope],
    })
    return google.sheets({ version: "v4", auth })
  }
  const auth = new google.auth.GoogleAuth({
    keyFile,
    scopes: [scope],
  })
  return google.sheets({ version: "v4", auth })
}

/**
 * Columns the app WRITES back to Google Sheets (create header if missing).
 * Meta import columns (id, phone_number, full_name, …) stay read-only from Meta.
 * Aliases include truncated sheet titles (e.g. "Assignment Stat", "1st Call Respon").
 */
export const SHEET_WRITEBACK_HEADERS = {
  assignedDealer: ["Assigned Dealer", "assigned_dealer", "NAME"],
  assignmentStatus: [
    "Assignment Status",
    "Assignment Stat",
    "assignment_status",
    "Call Status",
  ],
  leadStatus: ["lead_status"],
  remarks: ["Remarks", "remarks"],
  remarks2: ["Remarks 2", "remarks2"],
  firstCallResponse: [
    "1st Call Response",
    "1st Call Respon",
    "1st call response",
  ],
  secondCallResponse: [
    "2nd Call Response",
    "2nd Call Respon",
    "2nd call response",
  ],
  finalDecision: ["Final Decision", "Final Decison", "final decision"],
  finalDecisionReason: ["Reason of Final Decision", "reason of final decision"],
  /** CRM address / visit location — create "Address" column on Ajmer/Jaipur tabs if missing. */
  address: ["Address", "address", "street_address", "Street Address"],
}

/** Find column index; allow truncated headers (sheet title cut off in UI). */
function findHeaderIndex(headers, aliases) {
  const normalized = headers.map((h) => normalizeHeader(h))
  for (const a of aliases) {
    const want = normalizeHeader(a)
    if (!want) continue
    const exact = normalized.indexOf(want)
    if (exact >= 0) return exact
  }
  // Prefix match: "Assignment Stat" ↔ "Assignment Status", "1st Call Respon" ↔ "…Response"
  for (const a of aliases) {
    const want = normalizeHeader(a)
    if (want.length < 6) continue
    const idx = normalized.findIndex(
      (h) => h === want || h.startsWith(want) || want.startsWith(h),
    )
    if (idx >= 0) return idx
  }
  return -1
}

/**
 * DB → Google Sheet write-back (P0).
 * Call after: assign-unassigned, dealer calling submit/complete/reschedule,
 * any PATCH that updates assigned_dealer_id / status / remarks / final_decision / address
 * on a lead with sheet_source_id set.
 *
 * Match row by external_id (column `id`) or sheet_row_index.
 * Never overwrite Meta columns (ad_*, campaign_*, phone_number, full_name, created_time).
 */
function formatLeadAddressForSheet(lead) {
  const raw =
    lead?.address ||
    lead?.street_address ||
    lead?.streetAddress ||
    lead?.customer_address ||
    lead?.customerAddress ||
    ""
  if (typeof raw === "string") return raw.trim()
  if (raw && typeof raw === "object") {
    return [raw.street, raw.city, raw.state, raw.pincode || raw.pinCode]
      .map((x) => String(x || "").trim())
      .filter(Boolean)
      .join(", ")
  }
  const parts = [
    lead?.street,
    lead?.city,
    lead?.state,
    lead?.pincode || lead?.pinCode || lead?.post_code || lead?.postCode,
  ]
    .map((x) => String(x || "").trim())
    .filter(Boolean)
  return parts.join(", ")
}

export async function writeBackHrLeadToSheet(lead, { dealerNameById } = {}) {
  if (!lead?.sheet_source_id && !lead?.sheetSourceId) return { ok: false, skipped: "not_sheet_lead" }

  const source =
    lead.sheetSource ||
    (await HrSheetSource.findByPk(lead.sheet_source_id || lead.sheetSourceId))
  if (!source) return { ok: false, skipped: "no_source" }

  const sheets = getSheetsClient({ writable: true })
  const spreadsheetId = source.spreadsheet_id
  const tab = source.sheet_tab_name

  const meta = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${tab}'!1:1`,
  })
  let headers = (meta.data.values && meta.data.values[0]) || []
  if (!headers.length) return { ok: false, error: "no_headers" }

  // Ensure write-back columns exist (append to header row if missing).
  const ensureHeader = (aliases, preferred) => {
    const idx = findHeaderIndex(headers, aliases)
    if (idx >= 0) return idx
    headers = [...headers, preferred]
    return headers.length - 1
  }

  const colAssigned = ensureHeader(SHEET_WRITEBACK_HEADERS.assignedDealer, "Assigned Dealer")
  const colAssignStatus = ensureHeader(SHEET_WRITEBACK_HEADERS.assignmentStatus, "Assignment Status")
  const colLeadStatus = ensureHeader(SHEET_WRITEBACK_HEADERS.leadStatus, "lead_status")
  const colRemarks = ensureHeader(SHEET_WRITEBACK_HEADERS.remarks, "Remarks")
  const colRemarks2 = ensureHeader(SHEET_WRITEBACK_HEADERS.remarks2, "Remarks 2")
  const colFirst = ensureHeader(SHEET_WRITEBACK_HEADERS.firstCallResponse, "1st Call Response")
  const colSecond = ensureHeader(SHEET_WRITEBACK_HEADERS.secondCallResponse, "2nd Call Response")
  const colFinal = ensureHeader(SHEET_WRITEBACK_HEADERS.finalDecision, "Final Decision")
  const colReason = ensureHeader(SHEET_WRITEBACK_HEADERS.finalDecisionReason, "Reason of Final Decision")
  const colAddress = ensureHeader(SHEET_WRITEBACK_HEADERS.address, "Address")

  // Persist any newly appended headers
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${tab}'!1:1`,
    valueInputOption: "RAW",
    requestBody: { values: [headers] },
  })

  // Resolve row index: prefer sheet_row_index; else find by external id in column `id`
  let rowIndex = Number(lead.sheet_row_index || lead.sheetRowIndex || 0)
  const externalId = lead.external_id || lead.externalId
  if (!rowIndex || rowIndex < 2) {
    if (!externalId) return { ok: false, skipped: "no_row_match" }
    const idCol = headers.findIndex((h) => normalizeHeader(h) === "id")
    if (idCol < 0) return { ok: false, skipped: "no_id_column" }
    const colLetter = sheetsColumnLetter(idCol)
    const idVals = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${tab}'!${colLetter}:${colLetter}`,
    })
    const cells = idVals.data.values || []
    for (let i = 1; i < cells.length; i++) {
      if (String(cells[i]?.[0] || "").trim() === String(externalId).trim()) {
        rowIndex = i + 1 // 1-based
        break
      }
    }
  }
  if (!rowIndex || rowIndex < 2) return { ok: false, skipped: "row_not_found" }

  const dealerId = normalizeAssigneeId(lead.assigned_dealer_id || lead.assignedDealerId)
  const dealerName =
    (dealerId && (dealerNameById?.[dealerId] || lead.assigned_dealer_name || lead.assignedDealerName)) ||
    lead.assigned_person_name ||
    ""

  const status = String(lead.status || lead.assignmentStatus || "").trim()
  const leadStatus = String(lead.lead_status || lead.leadStatus || "").trim()
  // Prefer CRM calling status for lead_status when completed / in progress
  const sheetLeadStatus =
    /complete|done/i.test(status) ? "COMPLETED"
    : /progress|assigned|calling/i.test(status) ? "IN_PROGRESS"
    : leadStatus || "CREATED"

  const addressText = formatLeadAddressForSheet(lead)

  const updates = [
    { col: colAssigned, value: dealerName },
    { col: colAssignStatus, value: status || (dealerId ? "assigned" : "unassigned") },
    { col: colLeadStatus, value: sheetLeadStatus },
    { col: colRemarks, value: lead.remarks || "" },
    { col: colRemarks2, value: lead.remarks_2 || lead.remarks2 || "" },
    { col: colFirst, value: lead.first_call_response || lead.firstCallResponse || "" },
    { col: colSecond, value: lead.second_call_response || lead.secondCallResponse || "" },
    { col: colFinal, value: lead.final_decision || lead.finalDecision || "" },
    {
      col: colReason,
      value: lead.final_decision_reason || lead.finalDecisionReason || "",
    },
    { col: colAddress, value: addressText },
  ]

  const data = updates.map(({ col, value }) => ({
    range: `'${tab}'!${sheetsColumnLetter(col)}${rowIndex}`,
    values: [[value == null ? "" : String(value)]],
  }))

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: { valueInputOption: "RAW", data },
  })

  // Keep cursor accurate if we resolved row by id
  if (lead.id && rowIndex) {
    await HrLead.update(
      { sheet_row_index: rowIndex },
      { where: { id: lead.id } },
    ).catch(() => {})
  }

  return { ok: true, rowIndex, tab }
}

function sheetsColumnLetter(index0) {
  let n = index0 + 1
  let s = ""
  while (n > 0) {
    const r = (n - 1) % 26
    s = String.fromCharCode(65 + r) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}

/**
 * Hook points (call writeBackHrLeadToSheet):
 * 1. After assignUnassignedWithActiveCap — for each newly assigned sheet lead
 * 2. After dealer calling-queue action (submit / complete / reschedule / not_interested)
 *    — including Not Connected → Connected transfer. Persist final_decision +
 *      second_call_response from tagged callRemark (see applyConnectedOutcomePatch),
 *      then writeBack so sheet Final Decision matches Interested within the next
 *      cron cycle (every 30 min sync-all, i.e. within ~30–60 min / “1 hour”).
 * 3. After HR/admin PATCH that changes assignment or calling fields on sheet leads
 *
 * Pull sync (syncSheetTabSource) MUST NOT overwrite these DB fields from empty sheet cells
 * for existing external_id rows — DB is source of truth for assignment + calling status.
 * Especially: do not reset final_decision to an older sheet "Not Interested" when DB
 * already has Interested from a dealer transfer/update.
 */

// -----------------------------------------------------------------------------
// Column mapping (Meta export headers)
// -----------------------------------------------------------------------------

/**
 * Meta Lead Form export headers (live tabs e.g. Ajmer Solar Lead Form New):
 *   id, created_time, ad_id, ad_name, adset_id, adset_name, campaign_id, campaign_name,
 *   form_id, form_name, is_organic, platform, full_name, phone_number, lead_status
 *
 * REQUIRED for import / status / assign:
 *   phone_number → mobile (last 10 digits) — skip row if invalid
 *   id           → external_id (dedupe)
 *   full_name    → name
 *   lead_status  → lead_status (CREATED = New; else Pending until final_decision)
 *
 * ASSIGN dealers from hr_sheet_sources.dealer_ids (NOT from sheet columns).
 *
 * IGNORE for mapping (optional raw_json only): ad_id, adset_id, adset_name, campaign_id, form_id, is_organic
 * OPTIONAL display: platform, campaign_name, ad_name, form_name, created_time, email
 * OPTIONAL lead-form Q&A (persist + show on dealer Current Lead):
 *   what_is_your_average_monthly_electricity_bill?
 *   when_are_you_planning_to_install_solar?
 *   do_you_have_an_open_rooftop?
 *   → form_answers JSONB + customer_note summary; full row in raw_json
 * OPTIONAL status outcomes (other tabs): Final Decison, Reason of Final Decision, Remarks, KW, address
 *
 * Calling queue GET (currentLead / next / lists) MUST echo:
 *   email, formAnswers (or form_answers), raw / raw_json, customerNote
 * so dealer Current Lead can render Q&A without another round-trip.
 *
 * ASSIGN RULE (Meta sheet):
 *   Every row with empty Final Decision (typically lead_status=CREATED) MUST be
 *   imported + assigned to the dealer pool on sync. Do not leave Assignment Status
 *   blank on the sheet while other rows show assigned/completed (e.g. 14 rows → 14).
 *   Use assignOpenSheetLeadsWithoutFinalDecision after active_cap top-up.
 *   CREATED is Meta lead_status only — calling `status` must be queued/assigned so
 *   dealer Calling Data shows the lead. Never persist or echo status=CREATED.
 */
export const SOCIAL_SHEET_COLUMN_MAP = {
  externalId: ["id"],
  createdTime: ["created_time"],
  platform: ["platform"],
  fullName: ["full_name", "name"],
  mobile: ["phone_number", "phone", "mobile"],
  streetAddress: ["street_address", "address"],
  postCode: ["post_code", "postcode"],
  leadStatus: ["lead_status"],
  remarks: ["remarks"],
  remarks2: ["remarks 2", "remarks2"],
  kw: ["kw"],
  assignedPersonName: ["name"], // second NAME column in sheet — disambiguate by index in mapper
  firstCallResponse: ["1st call response", "1stcallresponse"],
  secondCallResponse: ["2nd call response", "2ndcallresponse"],
  login: ["login"],
  finalDecision: ["final decison", "final decision"],
  finalDecisionReason: ["reason of final decision"],
  adName: ["ad_name"],
  campaignName: ["campaign_name"],
  formName: ["form_name"],
  email: ["email", "email_address"],
  electricityBill: ["what_is_your_average_monthly_electricity_bill?"],
  installTimeline: ["when_are_you_planning_to_install_solar?"],
  openRooftop: ["do_you_have_an_open_rooftop?"],
}

function normalizeHeader(h) {
  return String(h || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
}

function normalizeMobile(value) {
  const digits = String(value || "").replace(/\D/g, "")
  return digits.length > 10 ? digits.slice(-10) : digits
}

function rowToLeadObject(headers, values) {
  const raw = {}
  headers.forEach((h, i) => {
    raw[normalizeHeader(h)] = String(values[i] ?? "").trim()
  })
  const mobile = normalizeMobile(
    raw[normalizeHeader("phone_number")] || raw[normalizeHeader("phone")] || raw[normalizeHeader("mobile")],
  )
  if (mobile.length !== 10) return null

  const email = raw[normalizeHeader("email")] || raw[normalizeHeader("email_address")] || ""
  const formAnswers = extractFormAnswersFromRaw(raw)
  const formNote = formAnswers.map((row) => `${row.question}: ${row.answer}`).join(" · ")

  return {
    externalId: raw[normalizeHeader("id")] || null,
    name: raw[normalizeHeader("full_name")] || raw[normalizeHeader("name")] || "",
    mobile,
    email,
    address: [raw[normalizeHeader("street_address")], raw[normalizeHeader("post_code")]]
      .filter(Boolean)
      .join(", "),
    platform: raw[normalizeHeader("platform")] || "",
    campaignName: raw[normalizeHeader("campaign_name")] || "",
    adName: raw[normalizeHeader("ad_name")] || "",
    leadStatus: raw[normalizeHeader("lead_status")] || "",
    remarks: raw[normalizeHeader("remarks")] || "",
    remarks2: raw[normalizeHeader("remarks2")] || "",
    kw: raw[normalizeHeader("kw")] || "",
    firstCallResponse: raw[normalizeHeader("1stcallresponse")] || "",
    secondCallResponse: raw[normalizeHeader("2ndcallresponse")] || "",
    loginFlag: String(raw[normalizeHeader("login")] || "").toLowerCase() === "true",
    finalDecision: raw[normalizeHeader("finaldecison")] || raw[normalizeHeader("finaldecision")] || "",
    finalDecisionReason: raw[normalizeHeader("reasonoffinaldecision")] || "",
    createdTime: raw[normalizeHeader("created_time")] || null,
    formAnswers,
    // Dealer Current Lead reads customer_note + formAnswers + email from queue GET.
    customerNote: [
      email ? `Email: ${email}` : "",
      formNote,
      raw[normalizeHeader("adset_name")] || "",
      raw[normalizeHeader("form_name")] || "",
      raw[normalizeHeader("campaign_name")] || "",
      raw[normalizeHeader("ad_name")] || "",
    ]
      .filter(Boolean)
      .join(" · "),
    raw,
  }
}

// -----------------------------------------------------------------------------
// Sync one tab
// -----------------------------------------------------------------------------

function isCallingCompletedStatus(status) {
  return ["completed", "done", "closed"].includes(String(status || "").trim().toLowerCase())
}

function isMetaCreatedLeadStatus(value) {
  const s = String(value || "").trim().toUpperCase()
  return !s || s === "CREATED"
}

/** Open Meta lead = CREATED / blank Final Decision. These MUST be assigned to a dealer. */
export function isOpenSheetLeadWithoutFinalDecision(lead) {
  if (isCallingCompletedStatus(lead?.status)) return false
  const leadStatus = lead?.lead_status || lead?.leadStatus || ""
  if (isMetaCreatedLeadStatus(leadStatus)) return true
  const final = String(lead?.final_decision || lead?.finalDecision || "").trim()
  if (final) return false
  return true
}

/**
 * Assign every open sheet lead (empty Final Decision) to the dealer pool.
 * Product: sheet may show 14 rows but only 11 with Assignment Status — the remaining
 * CREATED / blank-Final rows must still get a dealer (not stay blank forever).
 * Uses round-robin across dealerIds (not active_cap of 1).
 */
export async function assignOpenSheetLeadsWithoutFinalDecision(
  uploadId,
  { dealerIds, dealerNameById } = {},
) {
  const pool = (dealerIds || []).map(String).filter(Boolean)
  if (!uploadId || pool.length === 0) return { assigned: 0 }

  const allLeads = await HrLead.findAll({ where: { upload_id: uploadId } })
  const open = (allLeads || []).filter((lead) => {
    if (!isOpenSheetLeadWithoutFinalDecision(lead)) return false
    const assignee = normalizeAssigneeId(lead.assigned_dealer_id || lead.assignedDealerId)
    return !assignee
  })
  open.sort((a, b) => {
    const ta = new Date(a.created_time || a.created_at || a.createdAt || 0).getTime()
    const tb = new Date(b.created_time || b.created_at || b.createdAt || 0).getTime()
    return ta - tb
  })

  let assigned = 0
  for (let i = 0; i < open.length; i++) {
    const lead = open[i]
    const dealerId = pool[i % pool.length]
    await lead.update({
      assigned_dealer_id: dealerId,
      status: "assigned",
      assigned_at: new Date(),
    })
    assigned += 1
    try {
      const fresh = typeof lead.reload === "function" ? await lead.reload() : lead
      await writeBackHrLeadToSheet(fresh, { dealerNameById })
    } catch (e) {
      console.error("sheet write-back after open-lead assign failed", e)
    }
  }
  return { assigned }
}

/**
 * Pull every sheet data row (full rescan — do not rely only on last_synced_row cursor).
 * Upsert by mobile: create missing CREATED leads; refresh open leads' Meta fields.
 * Then assign all open leads that still have empty Final Decision.
 */
export async function syncSheetTabSource(sourceRow, { assignLeads = true, db } = {}) {
  const sheets = getSheetsClient()
  const spreadsheetId = sourceRow.spreadsheet_id || DEFAULT_SPREADSHEET_ID
  const tab = sourceRow.sheet_tab_name

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${tab}'`,
  })

  const rows = response.data.values || []
  if (rows.length < 2) {
    return { imported: 0, skipped: 0, updated: 0, assignedOpen: 0, message: "No data rows" }
  }

  const headers = rows[0]
  // Always full-scan data rows so CREATED leads missed earlier (cursor / bad phone) still import.
  const dataRows = rows.slice(1)
  const leads = []
  let skipped = 0

  for (let i = 0; i < dataRows.length; i++) {
    const mapped = rowToLeadObject(headers, dataRows[i])
    if (!mapped) {
      skipped += 1
      continue
    }
    leads.push({
      ...mapped,
      sheetRowIndex: i + 2, // Excel 1-based (row 1 = header)
    })
  }

  const upload = await createOrGetSheetUploadBatch(sourceRow, db)
  let imported = 0
  let updated = 0

  for (const lead of leads) {
    const exists = await HrLead.findOne({
      where: {
        upload_id: upload.id,
        mobile: lead.mobile,
      },
    })

    if (exists) {
      // Refresh Meta fields for open leads (no Final Decision yet). Never wipe CRM calling fields.
      // CREATED rows must stay in the assign pool even if they were imported earlier as queued.
      const sheetCreated = isMetaCreatedLeadStatus(lead.leadStatus)
      if (isOpenSheetLeadWithoutFinalDecision(exists) || sheetCreated) {
        const assignee = normalizeAssigneeId(exists.assigned_dealer_id || exists.assignedDealerId)
        await exists.update({
          external_id: lead.externalId || exists.external_id,
          sheet_row_index: lead.sheetRowIndex,
          name: lead.name || exists.name,
          email: lead.email || exists.email,
          address: lead.address || exists.address,
          customer_note: lead.customerNote || exists.customer_note,
          form_answers: lead.formAnswers?.length ? lead.formAnswers : exists.form_answers,
          platform: lead.platform || exists.platform,
          campaign_name: lead.campaignName || exists.campaign_name,
          ad_name: lead.adName || exists.ad_name,
          lead_status: lead.leadStatus || exists.lead_status || "CREATED",
          created_time: lead.createdTime || exists.created_time,
          raw_json: lead.raw || exists.raw_json,
          ...(sheetCreated && !assignee && !isCallingCompletedStatus(exists.status)
            ? { status: "queued" }
            : {}),
        })
        updated += 1
      } else {
        skipped += 1
      }
      continue
    }

    await HrLead.create({
      upload_id: upload.id,
      sheet_source_id: sourceRow.id,
      external_id: lead.externalId,
      sheet_row_index: lead.sheetRowIndex,
      name: lead.name,
      mobile: lead.mobile,
      email: lead.email || null,
      address: lead.address,
      customer_note: lead.customerNote || [lead.campaignName, lead.adName].filter(Boolean).join(" · "),
      form_answers: lead.formAnswers || [],
      platform: lead.platform,
      campaign_name: lead.campaignName || null,
      ad_name: lead.adName || null,
      lead_status: lead.leadStatus || "CREATED",
      remarks: lead.remarks,
      remarks_2: lead.remarks2,
      kw: lead.kw,
      first_call_response: lead.firstCallResponse,
      second_call_response: lead.secondCallResponse,
      login_flag: lead.loginFlag,
      final_decision: lead.finalDecision || null,
      final_decision_reason: lead.finalDecisionReason || null,
      created_time: lead.createdTime,
      raw_json: lead.raw,
      source_type: "google_sheet",
      status: "queued",
    })
    imported += 1
  }

  await sourceRow.update({
    last_synced_row: rows.length,
    last_synced_at: new Date(),
    last_sync_status: "ok",
    last_sync_error: null,
    upload_id: upload.id,
  })

  let assignedOpen = 0
  const dealerPool = asArray(sourceRow.dealer_ids).filter(Boolean)
  if (dealerPool.length === 0) {
    try {
      const siblings = await HrSheetSource.findAll({
        where: { spreadsheet_id: sourceRow.spreadsheet_id || DEFAULT_SPREADSHEET_ID, enabled: true },
      })
      for (const sibling of siblings || []) {
        const ids = asArray(sibling.dealer_ids).filter(Boolean)
        if (ids.length) {
          dealerPool.push(...ids)
          break
        }
      }
    } catch (e) {
      console.error("sheet sibling dealer pool lookup failed", e)
    }
  }
  if (assignLeads && dealerPool.length) {
    // 1) Keep FIFO active_cap top-up for calling queue.
    await assignUnassignedWithActiveCap(upload.id, {
      dealerIds: dealerPool,
      activeLimitPerDealer: sourceRow.active_limit_per_dealer || 1,
    })
    // 2) Then force-assign every remaining open lead (empty Final Decision / CREATED)
    //    so Assignment Status is not left blank on the sheet (e.g. 14 rows → all 14 assigned).
    const openResult = await assignOpenSheetLeadsWithoutFinalDecision(upload.id, {
      dealerIds: dealerPool,
    })
    assignedOpen = openResult.assigned || 0
  }

  emitSocket("calling:uploads-updated", {
    reason: "sheet_sync",
    sourceId: sourceRow.id,
    spreadsheetId: sourceRow.spreadsheet_id,
    syncedAt: new Date().toISOString(),
  })
  emitSocket("backend:mutation", {
    domain: "hr",
    path: "/hr/sheet-sources/sync",
    reason: "sheet_sync",
  })

  return { imported, skipped, updated, assignedOpen, uploadId: upload.id, rowCount: leads.length }
}

// -----------------------------------------------------------------------------
// API routes
// -----------------------------------------------------------------------------

/**
 * GET /api/hr/sheet-sources
 * List configured tabs + counts + enabled flag.
 */
export async function listHrSheetSources(req, res) {
  const rows = await HrSheetSource.findAll({ order: [["sheet_tab_name", "ASC"]] })
  const sources = []
  for (const row of rows) {
    const leads = await HrLead.findAll({
      where: { sheet_source_id: row.id },
      attributes: ["status", "assigned_dealer_id"],
    })
    const counts = computeHrUploadLeadCounts(leads)
    sources.push(mapSheetSourceForApi(row, counts))
  }
  return res.json({ success: true, data: { sources }, sources })
}

/**
 * POST /api/hr/sheet-sources/discover
 * Body: { spreadsheetId }
 * Reads spreadsheet metadata → returns tab names for HR UI bootstrap.
 */
export async function discoverHrSheetTabs(req, res) {
  const spreadsheetId = req.body?.spreadsheetId || req.body?.spreadsheet_id || DEFAULT_SPREADSHEET_ID
  let sheets
  try {
    sheets = getSheetsClient()
  } catch (e) {
    const code = e.code || "SYS_001"
    const status = code === "GOOGLE_SHEETS_CREDENTIALS_MISSING" ? 503 : 500
    return res.status(status).json({ success: false, error: { code, message: e.message } })
  }
  const meta = await sheets.spreadsheets.get({ spreadsheetId })
  const tabs = (meta.data.sheets || []).map((s) => s.properties?.title).filter(Boolean)

  // Upsert only tabs that exist in the live spreadsheet.
  const created = []
  for (const tab of tabs) {
    const [row] = await HrSheetSource.findOrCreate({
      where: { spreadsheet_id: spreadsheetId, sheet_tab_name: tab },
      defaults: {
        display_name: tab.replace(/_/g, " "),
        enabled: false,
        dealer_ids: [],
        active_limit_per_dealer: 1,
        last_synced_row: 1,
      },
    })
    // Keep display_name in sync with Google tab title.
    if (row.display_name !== tab.replace(/_/g, " ")) {
      await row.update({ display_name: tab.replace(/_/g, " ") })
    }
    created.push(row)
  }

  // Remove DB sources for tabs that were deleted/renamed in Google Sheets
  // so GET /hr/sheet-sources matches the spreadsheet 1:1.
  const existing = await HrSheetSource.findAll({ where: { spreadsheet_id: spreadsheetId } })
  const live = new Set(tabs)
  for (const row of existing) {
    if (!live.has(row.sheet_tab_name)) {
      await row.destroy()
    }
  }

  return res.json({
    success: true,
    data: { spreadsheetId, tabs, sources: created.map((r) => mapSheetSourceForApi(r)) },
    tabs,
    sources: created.map((r) => mapSheetSourceForApi(r)),
  })
}

/**
 * PATCH /api/hr/sheet-sources/:id
 * Body: { enabled, dealerIds, activeLimitPerDealer, displayName }
 */
export async function patchHrSheetSource(req, res) {
  const row = await HrSheetSource.findByPk(req.params.id)
  if (!row) return res.status(404).json({ success: false, error: { code: "RES_001" } })
  const body = req.body || {}
  await row.update({
    enabled: body.enabled ?? row.enabled,
    dealer_ids: body.dealerIds ?? body.dealer_ids ?? row.dealer_ids,
    active_limit_per_dealer: body.activeLimitPerDealer ?? body.active_limit_per_dealer ?? row.active_limit_per_dealer,
    display_name: body.displayName ?? body.display_name ?? row.display_name,
  })

  // Keep linked upload batch dealer pool in sync for assign-unassigned.
  if (row.upload_id && (body.dealerIds ?? body.dealer_ids)) {
    const upload = await HrLeadUpload.findByPk(row.upload_id)
    if (upload) {
      await upload.update({ dealer_ids: asArray(row.dealer_ids) })
    }
  }

  const leads = await HrLead.findAll({
    where: { sheet_source_id: row.id },
    attributes: ["status", "assigned_dealer_id"],
  })
  const counts = computeHrUploadLeadCounts(leads)
  return res.json({ success: true, data: mapSheetSourceForApi(row, counts) })
}

/**
 * POST /api/hr/sheet-sources/:id/sync
 * Pull new rows from Google Sheet → DB → optional round-robin assign.
 */
export async function postHrSheetSourceSync(req, res) {
  const row = await HrSheetSource.findByPk(req.params.id)
  if (!row) return res.status(404).json({ success: false, error: { code: "RES_001" } })
  try {
    const result = await syncSheetTabSource(row, { db: req.db })
    return res.json({ success: true, data: result })
  } catch (e) {
    await row.update({ last_sync_status: "error", last_sync_error: e.message })
    const code = e.code || "SYS_001"
    const status = code === "GOOGLE_SHEETS_CREDENTIALS_MISSING" ? 503 : 500
    return res.status(status).json({ success: false, error: { code, message: e.message } })
  }
}

/**
 * POST /api/hr/sheet-sources/sync-all
 * Cron / ops: sync every **enabled** sheet source for the default spreadsheet.
 * Recommended schedule: every 30 minutes.
 * Emits `calling:uploads-updated` once at the end (and per syncSheetTabSource).
 *
 * Auth: HR JWT, or internal cron secret header `x-cron-secret` matching CRON_SECRET env.
 */
export async function postHrSheetSourcesSyncAll(req, res) {
  const cronSecret = process.env.CRON_SECRET
  const headerSecret = req.headers["x-cron-secret"]
  const isCron = cronSecret && headerSecret && String(headerSecret) === String(cronSecret)
  const isHr = Boolean(req.hr || req.user?.role === "hr" || req.user?.role === "admin")
  if (!isCron && !isHr) {
    return res.status(401).json({ success: false, error: { code: "AUTH_003", message: "HR or cron required" } })
  }

  const spreadsheetId =
    req.body?.spreadsheetId || req.body?.spreadsheet_id || process.env.GOOGLE_SHEETS_SPREADSHEET_ID || DEFAULT_SPREADSHEET_ID

  const sources = await HrSheetSource.findAll({
    where: { spreadsheet_id: spreadsheetId, enabled: true },
    order: [["sheet_tab_name", "ASC"]],
  })

  const results = []
  for (const row of sources) {
    try {
      const result = await syncSheetTabSource(row, { db: req.db })
      results.push({ id: row.id, sheetTabName: row.sheet_tab_name, ok: true, ...result })
    } catch (e) {
      await row.update({ last_sync_status: "error", last_sync_error: e.message })
      results.push({ id: row.id, sheetTabName: row.sheet_tab_name, ok: false, error: e.message })
    }
  }

  emitSocket("calling:uploads-updated", {
    reason: "sheet_auto_sync",
    spreadsheetId,
    syncedAt: new Date().toISOString(),
    count: results.length,
  })
  emitSocket("backend:mutation", {
    domain: "hr",
    path: "/hr/sheet-sources/sync-all",
    reason: "sheet_auto_sync",
  })

  return res.json({
    success: true,
    data: {
      spreadsheetId,
      syncedAt: new Date().toISOString(),
      sources: results,
    },
  })
}

/**
 * Cron entry (node-cron / agenda / system crontab):
 *
 *   // every 30 minutes
 *   cron.schedule("*/30 * * * *", async () => {
 *     await fetch(`${API_BASE}/hr/sheet-sources/sync-all`, {
 *       method: "POST",
 *       headers: { "x-cron-secret": process.env.CRON_SECRET, "Content-Type": "application/json" },
 *       body: JSON.stringify({}),
 *     })
 *   })
 *
 * Do NOT use WebSockets to pull from Google Sheets — Sheets has no push to our socket.
 * Socket is only for notifying HR/dealer UIs AFTER the cron sync finishes.
 */

/**
 * POST /api/hr/sheet-sources/:id/assign-created
 * One-shot: assign every unassigned CREATED / blank-Final lead on this tab.
 * Use after enabling Chairbord - Ajme Leads (or any tab) so existing CREATED
 * rows appear in dealer Calling Data without waiting for a full resync.
 */
export async function postHrSheetSourceAssignCreated(req, res) {
  const row = await HrSheetSource.findByPk(req.params.id)
  if (!row) return res.status(404).json({ success: false, error: { code: "RES_001" } })
  const dealerPool = asArray(row.dealer_ids).filter(Boolean)
  if (dealerPool.length === 0) {
    const siblings = await HrSheetSource.findAll({
      where: { spreadsheet_id: row.spreadsheet_id || DEFAULT_SPREADSHEET_ID, enabled: true },
    })
    for (const sibling of siblings || []) {
      const ids = asArray(sibling.dealer_ids).filter(Boolean)
      if (ids.length) {
        dealerPool.push(...ids)
        break
      }
    }
  }
  if (!row.upload_id || dealerPool.length === 0) {
    return res.status(400).json({
      success: false,
      error: {
        code: "VAL_POOL",
        message: "Enable this tab, save a dealer pool, and Sync once before assign-created.",
      },
    })
  }
  const dealers = await Dealer.findAll({ where: { id: dealerPool } }).catch(() => [])
  const dealerNameById = Object.fromEntries(
    (dealers || []).map((d) => [String(d.id), d.name || d.full_name || d.username || ""]),
  )
  const result = await assignOpenSheetLeadsWithoutFinalDecision(row.upload_id, {
    dealerIds: dealerPool,
    dealerNameById,
  })
  emitSocket("calling:uploads-updated", {
    reason: "assign_created",
    sourceId: row.id,
    assigned: result.assigned,
  })
  return res.json({ success: true, data: result })
}

/**
 * GET /api/hr/sheet-sources/:id/leads?page&limit
 * Paginated leads for HR Social Media tab table (same shape as upload batch rows).
 */
export async function getHrSheetSourceLeads(req, res) {
  const row = await HrSheetSource.findByPk(req.params.id)
  if (!row) return res.status(404).json({ success: false, error: { code: "RES_001" } })
  const page = Math.max(1, Number(req.query.page || 1))
  const limit = Math.min(250, Math.max(1, Number(req.query.limit || 50)))
  const { rows, count } = await HrLead.findAndCountAll({
    where: { sheet_source_id: row.id },
    order: [["created_at", "DESC"]],
    offset: (page - 1) * limit,
    limit,
  })
  const dealerIds = [...new Set(rows.map((r) => r.assigned_dealer_id).filter(Boolean))]
  const dealers = dealerIds.length ? await Dealer.findAll({ where: { id: dealerIds } }) : []
  const dealerNameById = Object.fromEntries(dealers.map((d) => [d.id, d.name || d.full_name]))

  return res.json({
    success: true,
    data: {
      source: mapSheetSourceForApi(row),
      rows: rows.map((r) => mapSocialLeadForApi(r, dealerNameById)),
      leads: rows.map((r) => mapSocialLeadForApi(r, dealerNameById)),
      pagination: { page, limit, total: count },
    },
  })
}

/*
router.get("/hr/sheet-sources", authHr, listHrSheetSources)
router.post("/hr/sheet-sources/discover", authHr, discoverHrSheetTabs)
router.post("/hr/sheet-sources/sync-all", authHrOrCron, postHrSheetSourcesSyncAll) // BEFORE :id routes
router.patch("/hr/sheet-sources/:id", authHr, patchHrSheetSource)
router.post("/hr/sheet-sources/:id/sync", authHr, postHrSheetSourceSync)
router.post("/hr/sheet-sources/:id/assign-created", authHr, postHrSheetSourceAssignCreated)
router.get("/hr/sheet-sources/:id/leads", authHr, getHrSheetSourceLeads)

Cron (required for auto-sync — Google Sheets cannot push via socket):
  */30 * * * *  POST /hr/sheet-sources/sync-all  (header x-cron-secret)
  After each run emit calling:uploads-updated so HR/dealer UIs refresh.

Write-back (P0): after assign + calling actions on sheet leads → writeBackHrLeadToSheet
  Sheets scope must be spreadsheets (read-write). Pull must not wipe CRM fields.
*/

// -----------------------------------------------------------------------------
// QA
// -----------------------------------------------------------------------------
/*
1. Share spreadsheet with service account email (Editor).
2. POST discover → tabs include Ajmer_Leads.
3. PATCH source enabled=true, dealerIds=[…].
4. POST sync → imported N rows; hr_leads created; assigned via active_cap.
5. HR Social Media tab shows coloured status badges.
6. Dealer Calling Data queue receives assigned leads.
7. Re-sync full-scans all rows; upserts missing CREATED leads (empty Final Decision).
8. Open leads (no Final Decision) that are still unassigned get round-robin assigned
   so sheet Assignment Status is not left blank (e.g. 14 sheet rows → 14 assigned).
9. Chairbord - Ajme Leads CREATED rows (no assignee on the sheet) still import and
   assign to that tab's dealer pool (or another enabled tab's pool) and appear in
   dealer Calling Data. GET calling-queue/current|next returns status assigned/queued
   (never CREATED) plus lead_status="CREATED".
10. POST /hr/sheet-sources/:id/assign-created → assigned > 0 for the leftover CREATED rows.
11. One-shot SQL above clears status='created' on existing hr_leads.
*/
