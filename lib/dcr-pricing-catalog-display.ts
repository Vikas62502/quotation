import {
  DCR_PRICING_PANEL_TYPES,
  type SystemPricing,
} from "@/lib/pricing-tables"
import {
  QUOTATION_AS_PER_THE_SET_LABEL,
  TATA_DCR_PANEL_RANGE_KEY,
  getPanelPdfRangeLabel,
} from "@/lib/quotation-pdf-display"

export { QUOTATION_AS_PER_THE_SET_LABEL }

export type DcrPricingBrandGroup = {
  panelType: string
  displayTitle: string
  rows: SystemPricing[]
}

/** Catalog table: inverter size is not fixed per slab — matches June 2026 pricing sheet. */
export function dcrCatalogInverterLabel(): string {
  return QUOTATION_AS_PER_THE_SET_LABEL
}

/** Catalog table: panel watt range per brand (Tata DCR uses 530W–570W; INA uses 500W–600W). */
export function dcrCatalogPanelRangeLabel(panelType?: string): string {
  const normalized = panelType?.trim().toLowerCase() ?? ""
  if (normalized === "tata") {
    return getPanelPdfRangeLabel(TATA_DCR_PANEL_RANGE_KEY) ?? "530W - 570W"
  }
  if (normalized === "ina") {
    return getPanelPdfRangeLabel("ina_500_600_bifacial") ?? "500W - 600W"
  }
  if (normalized === "premier energies" || normalized === "premier") {
    return getPanelPdfRangeLabel("premier_600_625_bifacial_topcon") ?? "600-625W Bifacial Topcon"
  }
  return QUOTATION_AS_PER_THE_SET_LABEL
}

export function groupDcrPricingByPanelType(
  configs: SystemPricing[],
  panelTypes: readonly string[] = DCR_PRICING_PANEL_TYPES,
): DcrPricingBrandGroup[] {
  const filtered = configs
  return panelTypes
    .map((panelType) => ({
      panelType,
      displayTitle: panelType.toUpperCase(),
      rows: filtered.filter((c) => c.panelType === panelType),
    }))
    .filter((g) => g.rows.length > 0)
}
