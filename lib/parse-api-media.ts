/** Extract a media URL from common API response shapes after upload/save. */
export function parseMediaUrlFromApiPayload(payload: unknown, keys: string[]): string | undefined {
  const root = (payload as { data?: unknown })?.data ?? payload
  if (!root || typeof root !== "object") return undefined
  const o = root as Record<string, unknown>
  const containers = [o, o.documents, o.document].filter(
    (c): c is Record<string, unknown> => Boolean(c) && typeof c === "object",
  )
  for (const container of containers) {
    for (const key of keys) {
      const v = container[key]
      if (typeof v === "string" && v.trim()) return v.trim()
    }
  }
  return undefined
}

export function parseMeterDocumentUrlFromApiPayload(payload: unknown): string | undefined {
  return parseMediaUrlFromApiPayload(payload, [
    "meterDocumentPublicUrl",
    "meter_document_public_url",
    "publicUrl",
    "public_url",
    "meterDocumentUrl",
    "meter_document_url",
    "meterDocumentImageUrl",
    "meter_document_image_url",
  ])
}
