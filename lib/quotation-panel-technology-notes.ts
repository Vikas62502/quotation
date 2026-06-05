import type { ProductSelection } from "@/lib/quotation-context"
import { isTopconPdfPanelRangeKey, resolvePdfPanelRangeKey } from "@/lib/quotation-pdf-display"

export type PanelNoteGrade = "dcr" | "non-dcr"

type ProductsLike = ProductSelection & Record<string, unknown>

function pickNonEmpty(...values: unknown[]): string {
  for (const value of values) {
    const text = String(value ?? "").trim()
    if (text) return text
  }
  return ""
}

function normalizeBrandKey(brand?: string): string {
  return String(brand || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
}

const ADANI_DCR_TOPCON_NOTE_BODY =
  "Adani DCR-grade bifacial TOPCon modules deliver high efficiency and long-term performance with domestic content compliance — " +
  "optimized for subsidy-eligible installations with manufacturer performance warranty as per BOM."

/** Body text only (no ■ prefix). */
function getPanelTechnologyNoteBody(
  brand: string,
  grade: PanelNoteGrade,
  options?: { useTopcon?: boolean },
): string {
  const key = normalizeBrandKey(brand)
  const useTopcon = options?.useTopcon === true

  if (key === "waaree") {
    if (grade === "non-dcr") {
      return (
        "Waaree 610W/620W panels use Mono PERC Bifacial technology — capturing sunlight from both front " +
        "and rear surfaces for 10–20% higher energy yield. These are Non-DCR (Domestic Content Requirement) grade panels, optimized " +
        "for commercial applications with superior efficiency, durability, and 30-year linear power warranty."
      )
    }
    if (useTopcon) {
      return (
        "Waaree DCR-grade bifacial TOPCon modules deliver high efficiency and long-term performance with domestic content compliance — " +
        "optimized for subsidy-eligible installations with manufacturer performance warranty as per BOM."
      )
    }
    return (
      "Waaree DCR-grade bifacial modules use Mono PERC Bifacial technology — capturing sunlight from both front " +
      "and rear surfaces for higher energy yield. These meet Domestic Content Requirement (DCR) norms for subsidy-eligible " +
      "installations, with superior efficiency, durability, and 30-year linear power warranty."
    )
  }

  if (key === "adani") {
    if (grade === "dcr") {
      if (useTopcon) return ADANI_DCR_TOPCON_NOTE_BODY
      return (
        "Adani DCR-grade bifacial modules use Mono PERC Bifacial technology — capturing sunlight from both front " +
        "and rear surfaces for higher energy yield. These meet Domestic Content Requirement (DCR) norms for subsidy-eligible " +
        "installations, with superior efficiency, durability, and 30-year linear power warranty."
      )
    }
    return (
      "Adani Non-DCR bifacial modules use advanced bifacial technology for enhanced yield from front and rear surfaces — " +
      "optimized for commercial and non-subsidy applications with extended performance warranty (as per manufacturer terms)."
    )
  }

  if (key === "premierenergies" || key === "premier") {
    return (
      "Premier Energies DCR-grade bifacial TOPCon modules (600–625W class) deliver high efficiency with domestic content compliance — " +
      "optimized for subsidy-eligible installations with manufacturer performance warranty as per BOM."
    )
  }

  if (key === "tata") {
    if (grade === "dcr") {
      return (
        `${brand} DCR-grade solar modules meet domestic content requirements for subsidy-eligible systems, with manufacturer ` +
        "performance warranty as per BOM."
      )
    }
    return (
      `${brand} Non-DCR modules are optimized for on-grid commercial and residential applications without DCR subsidy linkage, ` +
      "with manufacturer performance warranty as per BOM."
    )
  }

  const gradeLabel = grade === "dcr" ? "DCR" : "Non-DCR"
  return (
    `${brand || "Selected brand"} ${gradeLabel}-grade high-efficiency bifacial modules with extended performance warranty ` +
    "(as per manufacturer terms)."
  )
}

function formatNoteLine(
  label: string | null,
  brand: string,
  grade: PanelNoteGrade,
  options?: { useTopcon?: boolean },
): string | null {
  const body = getPanelTechnologyNoteBody(brand, grade, options)
  if (!body) return null
  if (label) return `${label} ${body}`
  return `■ Panel Technology Note: ${body}`
}

function topconForBrandScope(products: ProductsLike, scope: "primary" | "dcr" | "nonDcr"): boolean {
  return isTopconPdfPanelRangeKey(resolvePdfPanelRangeKey(products, scope))
}

function resolvePanelBrandsForNotes(products: ProductsLike): {
  systemType: string
  dcrBrand: string
  nonDcrBrand: string
  singleBrand: string
  singleGrade: PanelNoteGrade
} {
  const raw = products as Record<string, unknown>
  const systemType = pickNonEmpty(products.systemType, raw.system_type).toLowerCase()
  const panelBrand = pickNonEmpty(products.panelBrand, raw.panel_brand)
  const dcrBrand = pickNonEmpty(products.dcrPanelBrand, raw.dcr_panel_brand, raw.panelType, raw.panel_type)
  const nonDcrBrand = pickNonEmpty(products.nonDcrPanelBrand, raw.non_dcr_panel_brand)

  let singleBrand = panelBrand
  let singleGrade: PanelNoteGrade = "non-dcr"

  if (systemType === "dcr") {
    singleBrand = dcrBrand || panelBrand
    singleGrade = "dcr"
  } else if (systemType === "non-dcr") {
    singleBrand = panelBrand || nonDcrBrand
    singleGrade = "non-dcr"
  } else if (systemType === "both") {
    singleBrand = panelBrand
  } else {
    const hasDcr = Boolean(
      products.dcrPanelQuantity ||
        Number(raw.dcr_panel_quantity) > 0 ||
        pickNonEmpty(products.dcrPanelSize, raw.dcr_panel_size),
    )
    if (hasDcr && dcrBrand) {
      singleBrand = dcrBrand
      singleGrade = "dcr"
    }
  }

  return { systemType, dcrBrand, nonDcrBrand, singleBrand, singleGrade }
}

/**
 * Green panel technology note on proposal PDF page 2.
 * Varies by system type (DCR / Non-DCR / BOTH) and panel brand.
 */
export function buildPanelTechnologyNote(products: ProductSelection | null | undefined): string | undefined {
  if (!products) return undefined

  const p = products as ProductsLike
  const { systemType, dcrBrand, nonDcrBrand, singleBrand, singleGrade } = resolvePanelBrandsForNotes(p)

  if (systemType === "both") {
    const lines: string[] = []
    if (dcrBrand) {
      const line = formatNoteLine(`■ Panel Technology Note (DCR — ${dcrBrand}):`, dcrBrand, "dcr", {
        useTopcon: topconForBrandScope(p, "dcr"),
      })
      if (line) lines.push(line)
    }
    if (nonDcrBrand) {
      const line = formatNoteLine(`■ Panel Technology Note (Non-DCR — ${nonDcrBrand}):`, nonDcrBrand, "non-dcr", {
        useTopcon: topconForBrandScope(p, "nonDcr"),
      })
      if (line) lines.push(line)
    }
    if (lines.length > 0) return lines.join("\n\n")
    if (singleBrand) {
      const line = formatNoteLine(null, singleBrand, "dcr", { useTopcon: topconForBrandScope(p, "dcr") })
      return line ?? undefined
    }
    return undefined
  }

  if (!singleBrand) return undefined
  const useTopcon =
    singleGrade === "dcr" ? topconForBrandScope(p, "primary") || topconForBrandScope(p, "dcr") : topconForBrandScope(p, "primary")
  return formatNoteLine(null, singleBrand, singleGrade, { useTopcon }) ?? undefined
}
