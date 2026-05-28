/** Logical file fields on the dealer/admin “Document Submission” form (KYC + property PDF). */

export const QUOTATION_DOCUMENT_FILE_KEYS = [
  "aadharFront",
  "aadharBack",
  "compliantAadharFront",
  "compliantAadharBack",
  "compliantPanImage",
  "compliantBankPassbookImage",
  "panImage",
  "electricityBillImage",
  "bankPassbookImage",
  "geotagRoofPhoto",
  "customerWithHousePhoto",
  "propertyDocumentPdf",
] as const

export type QuotationDocumentFileKey = (typeof QUOTATION_DOCUMENT_FILE_KEYS)[number]

export function firstPendingDocumentFileField(form: Record<string, unknown>): string | null {
  for (const key of QUOTATION_DOCUMENT_FILE_KEYS) {
    if (form[key] instanceof File) return key
  }
  return null
}

/**
 * Multipart PATCH body: text fields + each document slot as either a **File** (local dev)
 * or a **URL string** (after immediate upload). Omits empty slots for partial updates.
 */
export function buildDocumentsMultipartFormData(form: Record<string, any>): FormData {
  const formData = new FormData()
  const appendIfValue = (key: string, value: any) => {
    if (value === undefined || value === null || value === "") return
    formData.append(key, String(value))
  }
  const appendFileOrUrl = (key: string, value: any) => {
    if (value instanceof File) formData.append(key, value)
    else if (typeof value === "string" && value.trim()) formData.append(key, value.trim())
  }

  const resolvedCompliantAadharNumber = form.compliantAadharNumber || form.aadharNumber || ""
  const resolvedCompliantPanNumber = form.compliantPanNumber || form.panNumber || ""
  const resolvedCompliantBankAccountNumber = form.compliantBankAccountNumber || form.bankAccountNumber || ""
  const resolvedCompliantBankIfsc = form.compliantBankIfsc || form.bankIfsc || ""
  const resolvedCompliantBankName = form.compliantBankName || form.bankName || ""
  const resolvedCompliantBankBranch = form.compliantBankBranch || form.bankBranch || ""

  appendIfValue("isCompliantSenior", form.isCompliantSenior ? "true" : "false")
  appendIfValue("aadharNumber", form.aadharNumber)
  appendIfValue("phoneNumber", form.contactPhone)
  appendFileOrUrl("aadharFront", form.aadharFront)
  appendFileOrUrl("aadharBack", form.aadharBack)

  appendIfValue("compliantAadharNumber", resolvedCompliantAadharNumber)
  appendIfValue("compliantContactPhone", form.compliantContactPhone)
  appendFileOrUrl("compliantAadharFront", form.compliantAadharFront)
  appendFileOrUrl("compliantAadharBack", form.compliantAadharBack)
  appendIfValue("compliantPanNumber", resolvedCompliantPanNumber)
  appendFileOrUrl("compliantPanImage", form.compliantPanImage)
  appendIfValue("compliantBankAccountNumber", resolvedCompliantBankAccountNumber)
  appendIfValue("compliantBankIfsc", resolvedCompliantBankIfsc)
  appendIfValue("compliantBankName", resolvedCompliantBankName)
  appendIfValue("compliantBankBranch", resolvedCompliantBankBranch)
  appendFileOrUrl("compliantBankPassbookImage", form.compliantBankPassbookImage)

  appendIfValue("panNumber", form.panNumber)
  appendFileOrUrl("panImage", form.panImage)
  appendIfValue("electricityKno", form.electricityKno)
  appendFileOrUrl("electricityBillImage", form.electricityBillImage)

  appendIfValue("bankAccountNumber", form.bankAccountNumber)
  appendIfValue("bankIfsc", form.bankIfsc)
  appendIfValue("bankName", form.bankName)
  appendIfValue("bankBranch", form.bankBranch)
  appendFileOrUrl("bankPassbookImage", form.bankPassbookImage)
  appendFileOrUrl("geotagRoofPhoto", form.geotagRoofPhoto)
  appendFileOrUrl("customerWithHousePhoto", form.customerWithHousePhoto)
  appendFileOrUrl("propertyDocumentPdf", form.propertyDocumentPdf)

  appendIfValue("emailId", form.contactEmail)
  return formData
}

export function parseQuotationDocumentUploadUrl(payload: any, field: string): string | null {
  const root = payload?.data ?? payload
  if (!root || typeof root !== "object") return null
  if (typeof root.url === "string" && root.url.trim()) return root.url.trim()
  if (typeof root.fileUrl === "string" && root.fileUrl.trim()) return root.fileUrl.trim()
  if (typeof root[field] === "string" && root[field].trim()) return root[field].trim()
  const camelUrl = `${field}Url`
  if (typeof root[camelUrl] === "string" && root[camelUrl].trim()) return root[camelUrl].trim()
  const snake = field.replace(/[A-Z]/g, (l) => `_${l.toLowerCase()}`)
  const snakeUrl = `${snake}_url`
  if (typeof root[snakeUrl] === "string" && root[snakeUrl].trim()) return root[snakeUrl].trim()
  const docs = root.documents
  if (docs && typeof docs === "object" && typeof docs[field] === "string" && docs[field].trim()) {
    return docs[field].trim()
  }
  return null
}
