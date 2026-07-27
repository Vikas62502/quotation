# Backend handoff — Property Documents (PDF) is **optional** — Jul 2026

**Frontend (already done):** Document Submission on Dashboard / Quotations no longer marks or validates `propertyDocumentPdf` as required. Submit works without that file.

**Backend must match:** `PATCH /api/quotations/{quotationId}/documents` (and any admin alias of the same KYC/document handler) must **not** reject requests that omit `propertyDocumentPdf`.

---

## Change required

| Item | Action |
|------|--------|
| Zod / Joi / class-validator schema for document PATCH | Remove `propertyDocumentPdf` from **required** file list |
| Business rules that check “all KYC docs present” | Do **not** treat missing property PDF as incomplete |
| HTTP **400** / `VALIDATION_ERROR` when PDF absent | **Stop** returning this for `propertyDocumentPdf` |
| Storage | If never uploaded, leave column / JSON key `null` or omit; do not invent a placeholder |
| Still allowlist the field | Keep accepting `propertyDocumentPdf` when the user **does** upload one |

### Still required (unchanged by this change)

Typical UI-required set (backend may enforce these if you already do):

- Text: `phoneNumber`, `emailId`, `electricityKno` (and compliant variants when that flow is used)
- Files often required by product: Aadhaar front/back, PAN image, electricity bill image, bank passbook image  
  *(exact required set is product policy — only **property PDF** is explicitly optional as of Jul 2026)*

### Optional file fields (submit without them must succeed)

- `propertyDocumentPdf` ← **this change**
- `geotagRoofPhoto`
- `customerWithHousePhoto`

---

## Suggested validation sketch

```ts
// BEFORE (wrong for Jul 2026 UI)
const requiredFiles = [
  "aadharFront",
  "aadharBack",
  "panImage",
  "electricityBillImage",
  "bankPassbookImage",
  "propertyDocumentPdf", // ← REMOVE from required
]

// AFTER
const optionalFiles = new Set([
  "propertyDocumentPdf",
  "geotagRoofPhoto",
  "customerWithHousePhoto",
])
// Do not 400 solely because propertyDocumentPdf is missing on this PATCH
// or missing on the quotation after save.
```

Partial updates: if the key is omitted on this request, **keep** any existing stored URL. If the user never uploaded one, stored value stays null — that is valid.

---

## QA

1. Open Document Submission, fill required text + required images, **skip** Property Documents (PDF), click Submit → **200**.
2. Reopen modal → Property Documents still empty; other files still viewable.
3. Upload Property Documents PDF later → **200**; field persists on next open.
4. Confirm no `400` with message mentioning property document / `propertyDocumentPdf` when the PDF is absent.

---

## Related

- `BACKEND_CHANGES_REQUIRED.md` — Quotation customer documents `PATCH …/documents` (§ file parts + “Required backend behavior” §2)
- Frontend: `app/dashboard/page.tsx`, `app/dashboard/quotations/page.tsx`
- Form builder: `lib/quotation-documents-form.ts` (still sends the file **when present**)
