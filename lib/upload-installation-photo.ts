import { api } from "@/lib/api"
import { toPublicOpenHref } from "@/lib/media-url"

export type InstallationImmediateUpload = {
  name: string
  url: string
  localFile?: File
}

function isRemoteUrl(url: string): boolean {
  const trimmed = url.trim()
  if (!trimmed || trimmed.startsWith("blob:") || trimmed.startsWith("data:")) return false
  return Boolean(toPublicOpenHref(trimmed) || /^https?:\/\//i.test(trimmed) || trimmed.includes("/"))
}

export function retainedInstallationUrlsByField(
  filesByField: Record<string, Array<{ url?: string; localFile?: File }> | undefined>,
  skipField?: string,
): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  for (const [key, slots] of Object.entries(filesByField)) {
    if (skipField && key === skipField) continue
    const urls = (slots || [])
      .filter((slot) => !slot.localFile && slot.url && isRemoteUrl(slot.url))
      .map((slot) => toPublicOpenHref(slot.url!) || slot.url!)
    if (urls.length) out[key] = urls
  }
  return out
}

/** Upload one installation photo to S3 now and return a public/presigned URL. */
export async function uploadInstallationPhotoNow(args: {
  quotationId: string
  fieldKey: string
  file: File
  caller?: "admin" | "installer"
  existingUrlsByField?: Record<string, string[]>
}): Promise<string> {
  const url = await api.installer.uploadCompletionAsset(args.quotationId, args.fieldKey, args.file, {
    caller: args.caller,
    existingUrlsByField: args.existingUrlsByField,
  })
  return toPublicOpenHref(url) || url
}

export async function uploadInstallationPhotosNow(args: {
  quotationId: string
  fieldKey: string
  files: File[]
  caller?: "admin" | "installer"
  existingUrlsByField?: Record<string, string[]>
}): Promise<InstallationImmediateUpload[]> {
  const uploaded: InstallationImmediateUpload[] = []
  for (const file of args.files) {
    const url = await uploadInstallationPhotoNow({
      quotationId: args.quotationId,
      fieldKey: args.fieldKey,
      file,
      caller: args.caller,
      existingUrlsByField: {
        ...args.existingUrlsByField,
        [args.fieldKey]: uploaded.map((item) => item.url).filter((itemUrl) => isRemoteUrl(itemUrl)),
      },
    })
    uploaded.push({ name: file.name, url })
  }
  return uploaded
}
