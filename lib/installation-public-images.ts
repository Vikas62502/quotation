import { pickMediaUrlFromValue, toPublicOpenHref } from "@/lib/media-url"
import {
  isInstallationApprovedForAdminTab,
  type OperationalQuotationRecord,
} from "@/lib/operational-install-queue"

export const OPERATIONAL_INSTALLATION_IMAGE_FIELD_KEYS = [
  "homeFrontPhoto",
  "homeWithPersonPhoto",
  "inverterWithCustomerPhoto",
  "plantWithCustomerPhoto",
  "inverterSerialNumberPhoto",
  "panelSerialNumberPhoto",
  "geoTagPlantPhoto",
  "otherImages",
] as const

function pickNonEmptyString(v: unknown): string | undefined {
  if (typeof v === "string" && v.trim()) return v.trim()
  return undefined
}

function collectUrlsForInstallField(fieldKey: string, ...containers: unknown[]): string[] {
  const snake = fieldKey.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`)
  const urls: string[] = []
  const add = (s?: string) => {
    const normalized = toPublicOpenHref(s)
    if (normalized && !urls.includes(normalized)) urls.push(normalized)
  }
  for (const raw of containers) {
    const o = raw as Record<string, unknown> | null | undefined
    if (!o || typeof o !== "object") continue
    add(pickNonEmptyString(o[`${fieldKey}PublicUrl`]))
    add(pickNonEmptyString(o[`${fieldKey}_public_url`]))
    add(pickNonEmptyString(o[`${snake}_public_url`]))
    add(pickNonEmptyString(o[`${fieldKey}Url`]))
    add(pickNonEmptyString(o[`${fieldKey}_url`]))
    add(pickNonEmptyString(o[`${snake}_url`]))
    const rawField = o[fieldKey]
    if (typeof rawField === "string") add(rawField)
    else if (rawField && typeof rawField === "object") add(pickMediaUrlFromValue(rawField))
    const arrKeys = [`${fieldKey}s`, `${fieldKey}Urls`, `${fieldKey}_urls`, `${snake}s`, `${snake}_urls`]
    for (const k of arrKeys) {
      const arr = o[k]
      if (!Array.isArray(arr)) continue
      for (const item of arr) {
        if (typeof item === "string") add(item)
        else if (item && typeof item === "object") add(pickMediaUrlFromValue(item))
      }
    }
  }
  return urls
}

function extractPiMediaUrl(q: Record<string, unknown>): string | undefined {
  const doc = (q.documents || q.document || {}) as Record<string, unknown>
  const u =
    pickNonEmptyString(doc.piUploadUrl) ||
    pickNonEmptyString(doc.pi_upload_url) ||
    pickNonEmptyString(q.piUploadUrl) ||
    pickNonEmptyString(q.pi_upload_url)
  return u ? toPublicOpenHref(u) || u : undefined
}

function addDedupedUrl(sink: string[], max: number, s?: string) {
  const normalized = toPublicOpenHref(s)
  if (!normalized || sink.includes(normalized) || sink.length >= max) return
  sink.push(normalized)
}

function collectUrlsFromArrayLike(arr: unknown, sink: string[], max: number) {
  if (!Array.isArray(arr)) return
  for (const item of arr) {
    if (sink.length >= max) return
    addDedupedUrl(sink, max, pickMediaUrlFromValue(item))
  }
}

/** All public http(s) image/doc URLs for installation completion (list + detail shapes). */
export function gatherInstallationPublicImageUrls(q: Record<string, unknown>, max = 24): string[] {
  const out: string[] = []
  const doc = (q.documents || q.document || q.installationDocuments || q.quotationDocuments || {}) as Record<
    string,
    unknown
  >
  const inst = (q.installation || q.installerInstallation || q.installationCompletion || {}) as Record<string, unknown>

  for (const fieldKey of OPERATIONAL_INSTALLATION_IMAGE_FIELD_KEYS) {
    for (const url of collectUrlsForInstallField(fieldKey, doc, q, inst)) {
      addDedupedUrl(out, max, url)
    }
  }
  addDedupedUrl(out, max, extractPiMediaUrl(q))

  const nested = [
    q,
    doc,
    (q.installation || q.installerInstallation) as Record<string, unknown> | undefined,
    q.installerCompletion as Record<string, unknown> | undefined,
    q.installationCompletion as Record<string, unknown> | undefined,
  ].filter((x): x is Record<string, unknown> => Boolean(x) && typeof x === "object")

  const arrayKeys = [
    "siteCompletionImages",
    "site_completion_images",
    "installerCompletionImages",
    "installer_completion_images",
    "completionImages",
    "completion_images",
    "installationImages",
    "installation_images",
    "installerCompletionImageUrls",
  ]

  for (const src of nested) {
    for (const k of arrayKeys) {
      collectUrlsFromArrayLike(src[k], out, max)
    }
  }

  const jsonBlob =
    pickNonEmptyString(q.installationImageUrls) ||
    pickNonEmptyString(q.installation_image_urls) ||
    pickNonEmptyString(doc.installationImageUrls) ||
    pickNonEmptyString(doc.installation_image_urls) ||
    pickNonEmptyString(q.existingInstallationImageUrlsJson) ||
    pickNonEmptyString(q.existing_installation_image_urls_json) ||
    pickNonEmptyString(doc.existingInstallationImageUrlsJson) ||
    pickNonEmptyString(doc.existing_installation_image_urls_json)
  if (jsonBlob && (jsonBlob.startsWith("[") || jsonBlob.startsWith("{"))) {
    try {
      const parsed = JSON.parse(jsonBlob)
      if (Array.isArray(parsed)) collectUrlsFromArrayLike(parsed, out, max)
      else if (parsed && typeof parsed === "object") {
        for (const v of Object.values(parsed as Record<string, unknown>)) {
          if (Array.isArray(v)) collectUrlsFromArrayLike(v, out, max)
          else if (typeof v === "string") addDedupedUrl(out, max, v)
        }
      }
    } catch {
      // ignore invalid JSON
    }
  }

  return out
}

export function isInstallationUploadCompleteWithMedia(
  q: OperationalQuotationRecord,
  opts?: { approvedQueueIds?: Set<string> },
): boolean {
  const id = String(q.id || "").trim()
  return isInstallationApprovedForAdminTab(q, {
    imageUrlCount: gatherInstallationPublicImageUrls(q as Record<string, unknown>).length,
    inInstallerApprovedQueue: id ? opts?.approvedQueueIds?.has(id) : false,
  })
}

export const INSTALLATION_APPROVED_MEDIA_STATUSES = new Set([
  "installer_approved",
  "pending_metering",
  "metering_in_progress",
  "metering_approved",
  "mco",
  "pending_baldev",
  "baldev_approved",
  "completed",
])
