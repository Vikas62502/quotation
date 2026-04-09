"use client"

import type jsPDF from "jspdf"
import { Capacitor } from "@capacitor/core"
import { Directory, Filesystem } from "@capacitor/filesystem"
import { Share } from "@capacitor/share"

const blobToBase64 = async (blob: Blob): Promise<string> => {
  const buffer = await blob.arrayBuffer()
  let binary = ""
  const bytes = new Uint8Array(buffer)
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const sub = bytes.subarray(i, i + chunkSize)
    binary += String.fromCharCode(...sub)
  }
  return btoa(binary)
}

export const savePdfForDevice = async (pdf: jsPDF, filename: string) => {
  const blob = pdf.output("blob")
  const isNative = Capacitor.isNativePlatform()
  const hasFilesystem = Capacitor.isPluginAvailable("Filesystem")
  const hasShare = Capacitor.isPluginAvailable("Share")

  if (!isNative || !hasFilesystem) {
    pdf.save(filename)
    return
  }

  const base64Data = await blobToBase64(blob)
  const isAndroid = Capacitor.getPlatform() === "android"
  if (isAndroid) {
    try {
      const current = await Filesystem.checkPermissions()
      if (current.publicStorage !== "granted") {
        await Filesystem.requestPermissions()
      }
    } catch {
      // Continue with app-private directory fallback.
    }
  }

  const writeWithFallback = async () => {
    const targets = [Directory.Documents, Directory.Data, Directory.Cache]
    let lastError: unknown = null
    for (const directory of targets) {
      try {
        return await Filesystem.writeFile({
          path: filename,
          data: base64Data,
          directory,
          recursive: true,
        })
      } catch (error) {
        lastError = error
      }
    }
    throw lastError ?? new Error("Unable to save PDF on device")
  }

  const result = await writeWithFallback()

  if (hasShare) {
    try {
      await Share.share({
        title: "Quotation PDF",
        text: "Quotation downloaded successfully.",
        files: [result.uri],
        url: result.uri,
        dialogTitle: "Save or share quotation",
      })
    } catch {
      // Share dialog cancellation is non-fatal; file is already saved.
    }
  }
}

