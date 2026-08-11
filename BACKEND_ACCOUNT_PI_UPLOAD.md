# Backend — Account Management PI upload (multiple PDF / images)

**Frontend:** Account Management → Payment Management modal → below **Cost of site / Profit** → **PI upload (multiple)**  
**Code:** `app/dashboard/account-management/page.tsx` · `lib/api.ts` → `api.quotations.uploadPiDocuments`  
**Related:** Installation multi-PI (`BACKEND_INSTALLATION_PARTIAL_AND_METERING.md` §2) — same storage fields preferred

Account Management must upload **one or many** proforma / PI files (PDF or images) per quotation, list them, and remove individual files. Same `piUploadUrls` used elsewhere is preferred so Admin/Installer already see the files.

---

## Must ship

| # | Deliverable | If missing |
|---|-------------|------------|
| **A** | `POST /quotations/:id/pi-upload` (multipart) for **account-management** (+ admin) | Toast: PI upload failed / 404 |
| **B** | Accept **repeated** `piUpload` file parts (`maxCount` ≥ **20**) | Only first file saved |
| **C** | Allow **PDF + images** (see MIME list) | 400 on valid JPG/PDF |
| **D** | Persist `piUploadUrls[]` (+ singular `piUploadUrl` = first) | List empty after refresh |
| **E** | Echo URLs on `GET /quotations?status=approved` (AM list) | Files vanish on reload |
| **F** | Honor `existingPiUploadUrlsJson` + `replacePiUploads` for remove/sync | Remove does not stick |

---

## A) Preferred endpoint

```http
POST /api/quotations/:quotationId/pi-upload
Authorization: Bearer <account-management | admin token>
Content-Type: multipart/form-data
```

### Aliases FE tries on 404/403/405/501

1. `POST /quotations/:id/pi-documents`
2. `POST /account-management/quotations/:id/pi-upload`
3. `POST /admin/quotations/:id/pi-upload`
4. `POST /admin/quotations/:id/installer-documents` (PI-only body OK)
5. `POST /quotations/:id/documents`
6. `POST /installer/quotations/:id/documents` (only if AM role allowed)

Ship **one** primary route; aliases are fallbacks.

### Auth

Allow roles: **`account-management`**, **`admin`**, **`superadmin`** (and installer if you reuse the same handler).

---

## B) Multipart fields

| Field | Type | Required | Notes |
|-------|------|----------|--------|
| `piUpload` | **file**, **repeatable** | At least one file **or** a replace/sync of URLs | Multer `maxCount` ≥ **20** |
| `existingPiUploadUrlsJson` | text | Optional | JSON string array of URLs to **keep** |
| `existingPiUploadUrl` | text | Optional | Singular when exactly one retained URL |
| `replacePiUploads` / `replace_pi_uploads` | text `"true"` \| `"false"` | Optional | Default `false` = **append** new files to retained + existing DB list |

### Modes

**1) Upload (append)** — FE default when selecting new files:

```
piUpload=<file1>
piUpload=<file2>
…
existingPiUploadUrlsJson=["https://…/already-saved-1.pdf"]
replacePiUploads=false
```

→ `next = unique([…existingFromDbOrJson, …newlyUploadedUrls])`

**2) Remove / replace list** — FE after user deletes a file (may send **zero** new files):

```
existingPiUploadUrlsJson=["https://…/kept.pdf"]
replacePiUploads=true
```

→ `next = unique(parsed existingPiUploadUrlsJson)` (overwrite stored list)

Optional JSON fallback FE may try:

```http
PATCH /api/quotations/:quotationId/pi-upload
{ "piUploadUrls": ["…"], "replacePiUploads": true }
```

---

## C) Allowed file types

Accept (case-insensitive):

| Kind | MIME / ext |
|------|------------|
| PDF | `application/pdf`, `.pdf` |
| Images | `image/jpeg`, `image/png`, `image/webp`, `image/gif`, `image/heic`, `image/heif`, `.jpg`, `.jpeg`, `.png`, `.webp`, `.gif`, `.heic`, `.heif` |

Reject others with **400** `VAL_002` and a clear message.  
Suggested max size per file: **15–25 MB** (align with other document uploads).

---

## D) Storage

Prefer the **same columns** as installation PI:

```sql
-- Example (adapt to your schema)
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS pi_upload_url TEXT;
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS pi_upload_urls JSONB; -- or TEXT[] / JSON
```

Or store under `documents.piUploadUrls` / `documents.pi_upload_urls` — FE reads both.

Rules:

1. Upload files to S3 / storage; store **public or signed URLs** FE can open.
2. Always set:
   - `piUploadUrls` / `pi_upload_urls` = full array
   - `piUploadUrl` / `pi_upload_url` = `urls[0]` or null if empty
3. Do **not** wipe unrelated payment / installment fields.

---

## E) Success response

```json
{
  "success": true,
  "quotationId": "<uuid>",
  "piUploadUrl": "https://…/first.pdf",
  "piUploadUrls": [
    "https://…/first.pdf",
    "https://…/second.jpg"
  ],
  "pi_upload_url": "https://…/first.pdf",
  "pi_upload_urls": [
    "https://…/first.pdf",
    "https://…/second.jpg"
  ]
}
```

FE also accepts nested `data` / `documents` with the same keys.

---

## F) GET approved list (required echo)

```http
GET /api/quotations?status=approved
Authorization: Bearer <account-management>
```

Each quotation (or nested `documents`) must include:

- `piUploadUrls` / `pi_upload_urls` (array)
- `piUploadUrl` / `pi_upload_url` (first, optional)

Without this, Manage modal shows no files after refresh.

---

## G) Errors

| Status | Code | When |
|--------|------|------|
| 401 | `AUTH_003` | Not logged in |
| 403 | `AUTH_004` | Role not allowed — **also fix allow-list for account-management** |
| 404 | `NOT_001` | Quotation missing |
| 400 | `VAL_002` | Bad MIME / empty when replace=false and no files |
| 413 | — | File too large |

---

## Acceptance checklist

- [ ] AM opens Manage → Upload PI (multiple) → select **2+ PDFs/images** → all appear in list
- [ ] Refresh page → same URLs still listed
- [ ] Remove one file → list updates and stays after refresh
- [ ] Append more files → previous URLs kept
- [ ] Invalid type rejected with clear 400
- [ ] Admin / Installation views that already read `piUploadUrls` see the same files (if shared storage)

---

## Reference (Multer sketch)

```js
const upload = multer({
  storage, // disk or memory → S3
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    const ok =
      file.mimetype === "application/pdf" ||
      file.mimetype.startsWith("image/") ||
      /\.(pdf|jpe?g|png|webp|gif|heic|heif)$/i.test(file.originalname || "")
    cb(ok ? null : new Error("Only PDF or images allowed"), ok)
  },
}).array("piUpload", 20)

// POST /quotations/:id/pi-upload
// 1) Parse existingPiUploadUrlsJson
// 2) Upload req.files → URLs
// 3) If replacePiUploads === "true" → save retained (+ new)
//    else → merge with DB urls + new
// 4) Persist piUploadUrls + piUploadUrl
// 5) Return arrays above
```
