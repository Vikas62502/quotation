"use client"

import { useCallback, useState } from "react"
import { useToast } from "@/hooks/use-toast"
import { api } from "@/lib/api"

/**
 * When API mode is on: each chosen file is uploaded immediately (server → S3); form stores the returned URL string.
 * When API mode is off: store File locally for multipart submit (dev).
 */
export function useQuotationDocumentFileUpload(
  useApi: boolean,
  updateDocumentsForm: (quotationId: string, updates: Record<string, any>) => void,
) {
  const { toast } = useToast()
  const [uploadingField, setUploadingField] = useState<string | null>(null)

  const onDocumentFileSelected = useCallback(
    async (quotationId: string, field: string, file: File | null) => {
      if (!quotationId) return
      if (!file) {
        updateDocumentsForm(quotationId, { [field]: null })
        return
      }
      if (!useApi) {
        updateDocumentsForm(quotationId, { [field]: file })
        return
      }
      setUploadingField(field)
      try {
        const url = await api.quotations.uploadQuotationDocumentFile(quotationId, field, file)
        updateDocumentsForm(quotationId, { [field]: url })
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Upload failed"
        toast({
          title: "File upload failed",
          description: message,
          variant: "destructive",
        })
      } finally {
        setUploadingField(null)
      }
    },
    [useApi, updateDocumentsForm, toast],
  )

  return { uploadingField, onDocumentFileSelected }
}
