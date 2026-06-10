export type FinalConfirmationDocumentFiles = {
  customerFinalBillFile?: File | null
  panelWarrantyFile?: File | null
  inverterWarrantyFile?: File | null
  workCompletionWarrantyFile?: File | null
}

export const FINAL_CONFIRMATION_DOCUMENT_FILE_KEYS = [
  "customerFinalBillFile",
  "panelWarrantyFile",
  "inverterWarrantyFile",
  "workCompletionWarrantyFile",
] as const

export function buildFinalConfirmationDocumentsFormData(
  files: FinalConfirmationDocumentFiles,
): FormData | null {
  const formData = new FormData()
  let count = 0
  const append = (key: (typeof FINAL_CONFIRMATION_DOCUMENT_FILE_KEYS)[number], file?: File | null) => {
    if (!(file instanceof File)) return
    formData.append(key, file)
    count += 1
  }

  append("customerFinalBillFile", files.customerFinalBillFile)
  append("panelWarrantyFile", files.panelWarrantyFile)
  append("inverterWarrantyFile", files.inverterWarrantyFile)
  append("workCompletionWarrantyFile", files.workCompletionWarrantyFile)

  return count > 0 ? formData : null
}
