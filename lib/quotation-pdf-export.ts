import html2canvas from "html2canvas"
import jsPDF from "jspdf"
import { sanitizeColorsForHtml2Canvas } from "@/lib/html2canvas-color-sanitize"
import { PROPOSAL_PDF_STYLES } from "@/lib/quotation-proposal-pdf-styles"

function mountPageForCapture(pageEl: HTMLElement): { cleanup: () => void; clone: HTMLElement; view: Window } {
  const iframe = document.createElement("iframe")
  iframe.setAttribute("data-pdf-capture-frame", "true")
  iframe.style.cssText = [
    "position:fixed",
    "left:0",
    "top:0",
    "width:210mm",
    "height:297mm",
    "border:0",
    "visibility:visible",
    "z-index:2147483647",
    "margin:0",
    "padding:0",
    "pointer-events:none",
  ].join(";")
  document.body.appendChild(iframe)

  const doc = iframe.contentDocument
  const view = iframe.contentWindow
  if (!doc || !view) {
    iframe.remove()
    throw new Error("PDF capture iframe is unavailable")
  }

  doc.open()
  doc.write("<!DOCTYPE html><html><head></head><body></body></html>")
  doc.close()
  doc.body.style.cssText = "margin:0;padding:0;background:#ffffff"

  const styleEl = doc.createElement("style")
  styleEl.textContent = PROPOSAL_PDF_STYLES
  doc.head.appendChild(styleEl)

  const clone = pageEl.cloneNode(true) as HTMLElement
  clone.style.margin = "0"
  doc.body.appendChild(clone)
  sanitizeColorsForHtml2Canvas(clone, view)

  return {
    cleanup: () => iframe.remove(),
    clone,
    view,
  }
}

async function waitForImages(container: HTMLElement): Promise<void> {
  const images = Array.from(container.querySelectorAll("img"))
  await Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) {
            resolve()
            return
          }
          img.onload = () => resolve()
          img.onerror = () => resolve()
          setTimeout(() => resolve(), 5000)
        }),
    ),
  )
}

/** Capture each `.proposal-pdf-page` as a separate A4 PDF page. */
export async function exportProposalPagesToPdf(
  rootId: string,
  filename: string,
  save: (pdf: jsPDF, name: string) => Promise<void>,
): Promise<void> {
  const root = document.getElementById(rootId)
  if (!root) throw new Error(`PDF root #${rootId} not found`)

  root.classList.add("proposal-pdf-rendering")

  try {
    const pages = root.querySelectorAll<HTMLElement>(".proposal-pdf-page")
    if (!pages.length) throw new Error("No .proposal-pdf-page elements found")

    const pdf = new jsPDF("p", "mm", "a4")
    const imgWidth = 210

    for (let i = 0; i < pages.length; i++) {
      const pageEl = pages[i]
      const { cleanup, clone } = mountPageForCapture(pageEl)

      try {
        await new Promise((resolve) => setTimeout(resolve, 80))
        await waitForImages(clone)

        const canvas = await html2canvas(clone, {
          useCORS: true,
          logging: false,
          backgroundColor: "#ffffff",
          scale: 2,
          width: clone.offsetWidth,
          height: clone.offsetHeight,
          foreignObjectRendering: false,
          windowWidth: clone.scrollWidth,
          windowHeight: clone.scrollHeight,
          onclone: (clonedDoc, clonedElement) => {
            if (clonedElement instanceof HTMLElement && clonedDoc.defaultView) {
              sanitizeColorsForHtml2Canvas(clonedElement, clonedDoc.defaultView)
            }
          },
        })

        const imgHeight = (canvas.height * imgWidth) / canvas.width
        const imgData = canvas.toDataURL("image/jpeg", 0.92)

        if (i > 0) pdf.addPage()
        pdf.addImage(imgData, "JPEG", 0, 0, imgWidth, imgHeight)
      } finally {
        cleanup()
      }
    }

    await save(pdf, filename)
  } finally {
    root.classList.remove("proposal-pdf-rendering")
  }
}
