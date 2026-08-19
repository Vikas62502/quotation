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
  const firstString = (...values: unknown[]) => {
    for (const value of values) {
      if (typeof value === "string" && value.trim()) return value.trim()
    }
    return null
  }
  const camelUrl = `${field}Url`
  const camelPublic = `${field}PublicUrl`
  const snake = field.replace(/[A-Z]/g, (l) => `_${l.toLowerCase()}`)
  const snakeUrl = `${snake}_url`
  const snakePublic = `${snake}_public_url`
  const docs = root.documents && typeof root.documents === "object" ? root.documents : null
  return firstString(
    root.publicUrl,
    root.public_url,
    root[camelPublic],
    root[snakePublic],
    docs?.[camelPublic],
    docs?.[snakePublic],
    root.url,
    root.fileUrl,
    root.file_url,
    root.location,
    root[field],
    root[camelUrl],
    root[snakeUrl],
    docs?.[field],
    docs?.[camelUrl],
    docs?.[snakeUrl],
  )
}
