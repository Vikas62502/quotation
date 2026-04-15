import JSZip from "jszip"

/** Form shape used by dashboard / admin document submission dialogs */
export type DocumentsFormLike = Record<string, unknown>

const FILE_FIELDS: { formKey: string; label: string }[] = [
  { formKey: "aadharFront", label: "aadhar-front" },
  { formKey: "aadharBack", label: "aadhar-back" },
  { formKey: "compliantAadharFront", label: "compliant-aadhar-front" },
  { formKey: "compliantAadharBack", label: "compliant-aadhar-back" },
  { formKey: "compliantPanImage", label: "compliant-pan" },
  { formKey: "panImage", label: "pan" },
  { formKey: "electricityBillImage", label: "electricity-bill" },
  { formKey: "bankPassbookImage", label: "bank-passbook" },
  { formKey: "compliantBankPassbookImage", label: "compliant-bank-passbook" },
  { formKey: "geotagRoofPhoto", label: "geotag-roof" },
  { formKey: "customerWithHousePhoto", label: "customer-with-house" },
  { formKey: "propertyDocumentPdf", label: "property-document" },
]

function sanitizeFilenameSegment(segment: string): string {
  const cleaned = segment
    .replace(/[/\\?%*:|"<>]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
  return cleaned.length > 0 ? cleaned.slice(0, 120) : "unknown"
}

function extensionFromMime(mime: string): string {
  if (mime === "image/jpeg" || mime === "image/jpg") return ".jpg"
  if (mime === "image/png") return ".png"
  if (mime === "image/webp") return ".webp"
  if (mime === "image/gif") return ".gif"
  if (mime === "application/pdf") return ".pdf"
  return ""
}

function extensionFromUrl(url: string): string {
  try {
    const pathname = new URL(url, typeof window !== "undefined" ? window.location.origin : "http://local").pathname
    const match = pathname.match(/\.([a-zA-Z0-9]+)$/)
    if (match) {
      const ext = match[1].toLowerCase()
      if (["jpg", "jpeg", "png", "webp", "gif", "pdf"].includes(ext)) {
        return `.${ext === "jpeg" ? "jpg" : ext}`
      }
    }
  } catch {
    /* ignore */
  }
  return ""
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  anchor.rel = "noopener"
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

function buildTextManifest(params: {
  customerName: string
  quotationId: string
  form: DocumentsFormLike
  fetchFailures: string[]
}): string {
  const { customerName, quotationId, form, fetchFailures } = params
  const lines: string[] = [
    "Document submission — text fields",
    "================================",
    `Customer name: ${customerName}`,
    `Quotation ID: ${quotationId}`,
    "",
    "Compliant (age > 60): " + (form.isCompliantSenior ? "yes" : "no"),
    "",
    "Aadhar & contact",
    "----------------",
    `Aadhar number: ${String(form.aadharNumber ?? "")}`,
    `Phone number: ${String(form.contactPhone ?? "")}`,
    "",
    "Compliant (senior) details",
    "-------------------------",
    `Compliant Aadhar number: ${String(form.compliantAadharNumber ?? "")}`,
    `Compliant contact phone: ${String(form.compliantContactPhone ?? "")}`,
    `Compliant PAN number: ${String(form.compliantPanNumber ?? "")}`,
    `Compliant bank account number: ${String(form.compliantBankAccountNumber ?? "")}`,
    `Compliant bank IFSC: ${String(form.compliantBankIfsc ?? "")}`,
    `Compliant bank name: ${String(form.compliantBankName ?? "")}`,
    `Compliant bank branch: ${String(form.compliantBankBranch ?? "")}`,
    "",
    "PAN & electricity",
    "-----------------",
    `PAN number: ${String(form.panNumber ?? "")}`,
    `Electricity bill KNO: ${String(form.electricityKno ?? "")}`,
    "",
    "Bank (customer)",
    "---------------",
    `Bank account number: ${String(form.bankAccountNumber ?? "")}`,
    `Bank IFSC: ${String(form.bankIfsc ?? "")}`,
    `Bank name: ${String(form.bankName ?? "")}`,
    `Bank branch: ${String(form.bankBranch ?? "")}`,
    "",
    "Contact",
    "-------",
    `Email: ${String(form.contactEmail ?? "")}`,
  ]

  if (fetchFailures.length > 0) {
    lines.push("", "Attachments that could not be fetched (URLs / network)", "--------------------------------------------------------")
    fetchFailures.forEach((f) => lines.push(`- ${f}`))
  }

  return lines.join("\n")
}

async function addFileFieldToZip(
  zip: JSZip,
  form: DocumentsFormLike,
  formKey: string,
  entryLabel: string,
  fetchFailures: string[],
): Promise<void> {
  const value = form[formKey]
  if (value instanceof File) {
    const safeName = sanitizeFilenameSegment(value.name || `${entryLabel}.bin`)
    zip.file(`${entryLabel}-${safeName}`, value)
    return
  }
  if (typeof value === "string" && value.trim() !== "") {
    const url = value.trim()
    try {
      const response = await fetch(url)
      if (!response.ok) {
        fetchFailures.push(`${entryLabel}: HTTP ${response.status}`)
        return
      }
      const blob = await response.blob()
      const ext = extensionFromMime(blob.type) || extensionFromUrl(url) || ".bin"
      zip.file(`${entryLabel}${ext}`, blob)
    } catch {
      fetchFailures.push(`${entryLabel}: fetch failed (check URL / CORS)`)
    }
  }
}

/**
 * Builds a ZIP of all document files (local `File` picks + remote URL strings) and one manifest `.txt` with text fields.
 * Zip file name: `{CustomerName}-{QuotationId}.zip` (sanitized).
 */
export async function downloadQuotationDocumentsZip(params: {
  customerName: string
  quotationId: string
  form: DocumentsFormLike
}): Promise<{ ok: true } | { ok: false; message: string }> {
  if (typeof window === "undefined") {
    return { ok: false, message: "Download is only available in the browser." }
  }

  const { customerName, quotationId, form } = params
  const zip = new JSZip()
  const fetchFailures: string[] = []

  for (const { formKey, label } of FILE_FIELDS) {
    await addFileFieldToZip(zip, form, formKey, label, fetchFailures)
  }

  const manifest = buildTextManifest({
    customerName,
    quotationId,
    form,
    fetchFailures,
  })
  zip.file("document-details.txt", manifest)

  let blob: Blob
  try {
    blob = await zip.generateAsync({ type: "blob" })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not build ZIP."
    return { ok: false, message }
  }

  const zipName = `${sanitizeFilenameSegment(customerName)}-${sanitizeFilenameSegment(quotationId)}.zip`
  triggerBlobDownload(blob, zipName)
  return { ok: true }
}
