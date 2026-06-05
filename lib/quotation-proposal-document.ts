import type { Customer, ProductSelection } from "@/lib/quotation-context"
import { formatPersonName, sanitizeNamePart } from "@/lib/name-display"
import {
  calculateSystemSize,
  formatQuotationPhaseLabel,
  resolveQuotationPhase,
} from "@/lib/pricing-tables"
import { buildPanelTechnologyNote } from "@/lib/quotation-panel-technology-notes"
import {
  formatPanelSizeWithQuantityForPdf,
  getMountingStructurePdfBrandModel,
  getMountingStructurePdfSpecification,
  getPanelPdfRangeLabel,
  isAsPerTheSetLabel,
  normalizeInverterBrandForDisplay,
  QUOTATION_AS_PER_THE_SET_LABEL,
  resolvePdfPanelRangeKey,
  type PdfPanelRangeKey,
} from "@/lib/quotation-pdf-display"

/** Quotation offer validity from date of issue. */
export const PROPOSAL_VALIDITY_DAYS = 7

/** Payment terms shown in PDF Terms & Conditions (page 3). */
export const PROPOSAL_PAYMENT_TERMS_DETAIL = [
  "Token Money (Cash/UPI/Netbanking): 10–20% of total system cost to secure the contract and cover initial costs (design, permits, equipment ordering).",
  "For Cash: 70–80% of the system cost must be cleared in cash when material reaches the customer's home/site (on delivery), before installation work starts.",
  "For Loan: 70% of the system cost must be cleared before installation work starts, with the remaining 30% payable after installation.",
  "Material Delivery: Once 70% is paid (loan) or 70–80% is paid (cash on delivery), equipment is dispatched to the site and installation must start within 7–10 days.",
  "Metering & Closure: After successful installation, only 10% remains and the rest of the amount must be cleared before metering work and commissioning finalize.",
].join("\n")

export const DEFAULT_PROPOSAL_SUPPORT_FORM_URL = "https://www.chairbord.com/support"
export const DEFAULT_PROPOSAL_SUPPORT_PHONE = "+91 9785230023"
export const DEFAULT_PROPOSAL_SUPPORT_EMAIL = "support@chairbord.com"

export type ProposalOfficeLocation = {
  label: string
  address: string
}

export const PROPOSAL_OFFICE_LOCATIONS: ProposalOfficeLocation[] = [
  {
    label: "Jaipur (Head Office)",
    address:
      "Plot No. 10, Ground Floor, Shri Shyam Vihar, Kalwar Road, Jhotwara, Jaipur, Rajasthan, India - 302012",
  },
  {
    label: "Ajmer",
    address:
      "2nd Floor, Miraj Cinema Mall, Gaurav Path, Apna Nagar, Vaishali Nagar, Ajmer, Rajasthan 305001",
  },
  {
    label: "Chomu",
    address: "Radha Swami Bagh, Jaipur Rd, behind MRF Showroom, Chomu, Rajasthan 303702",
  },
]

export type ProposalCompanyInfo = {
  name: string
  address: string
  phone: string
  email: string
  gst: string
  logoUrl: string
  supportFormUrl?: string
  /** Office lines in PDF footer; defaults to PROPOSAL_OFFICE_LOCATIONS. */
  offices?: ProposalOfficeLocation[]
}

export function getProposalOfficeLocations(company: ProposalCompanyInfo): ProposalOfficeLocation[] {
  if (company.offices?.length) return company.offices
  if (company.address?.trim()) {
    return [
      { label: "Jaipur (Head Office)", address: company.address.trim() },
      ...PROPOSAL_OFFICE_LOCATIONS.filter((o) => o.label !== "Jaipur (Head Office)"),
    ]
  }
  return PROPOSAL_OFFICE_LOCATIONS
}

export type ProposalDealerContactSource = {
  firstName?: string
  lastName?: string
  email?: string
  mobile?: string
}

export type ProposalDealerInfo = {
  name: string
  contact: string
  email: string
}

export function buildProposalDealerInfo(
  source?: ProposalDealerContactSource | null,
  company?: Pick<ProposalCompanyInfo, "name" | "phone" | "email">,
): ProposalDealerInfo {
  const name = formatPersonName(source?.firstName, source?.lastName, "")
  return {
    name: name || company?.name || "—",
    contact: source?.mobile?.trim() || company?.phone?.trim() || "—",
    email: source?.email?.trim() || company?.email?.trim() || "—",
  }
}

export type ProposalBankAccount = {
  bankName: string
  accountName: string
  accountNumber: string
  ifscCode: string
}

export type SpecRow = {
  component: string
  specification: string
  brandModel: string
  qty: string
}

export type PricingRow = {
  description: string
  rate: string
  capacity: string
  amount: string
  highlight?: boolean
}

export type PaymentRow = {
  stage: string
  when: string
  percentage: string
  amount: string
  highlight?: boolean
}

export type WarrantyRow = {
  component: string
  period: string
  coverage: string
}

export type TermsRow = {
  category: string
  detail: string
}

export type QuotationProposalDocumentData = {
  quotationId: string
  quotationDate: Date
  validityDate: Date
  customer: Customer
  products: ProductSelection
  company: ProposalCompanyInfo
  dealer: ProposalDealerInfo
  banks: { icici: ProposalBankAccount; sbi: ProposalBankAccount }
  subtotal: number
  totalAmount: number
  systemKwLabel: string
  phaseLabel: string
  systemTypeLabel: string
  specRows: SpecRow[]
  panelNote?: string
  /** Rate column in pricing table — Non-DCR only. */
  showPricingRateColumn: boolean
  pricingRows: PricingRow[]
  paymentRows: PaymentRow[]
  warrantyRows: WarrantyRow[]
  supportLine: string
  termsRows: TermsRow[]
  /** BOTH system: page 2 PDF typography is 1px smaller to fit extra content. */
  page2CompactFont: boolean
}

export function formatProposalDate(d: Date): string {
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" })
}

export function formatInr(amount: number): string {
  return `₹${Math.round(amount).toLocaleString("en-IN")}`
}

type ProductsLike = ProductSelection & Record<string, unknown>

function pickNonEmpty(...values: unknown[]): string {
  for (const value of values) {
    const text = String(value ?? "").trim()
    if (text) return text
  }
  return ""
}

/** Resolve panel brand for PDF from DCR / non-DCR / API field aliases. */
export function resolvePanelBrandForPdf(products: ProductsLike): string {
  const raw = products as Record<string, unknown>
  const systemType = pickNonEmpty(products.systemType, raw.system_type).toLowerCase()
  const panelType = pickNonEmpty(raw.panelType, raw.panel_type)
  const panelBrand = pickNonEmpty(products.panelBrand, raw.panel_brand)
  const dcrBrand = pickNonEmpty(products.dcrPanelBrand, raw.dcr_panel_brand, panelType)
  const nonDcrBrand = pickNonEmpty(products.nonDcrPanelBrand, raw.non_dcr_panel_brand)
  const customDcrBrand = Array.isArray(products.customPanels)
    ? pickNonEmpty(products.customPanels.find((p) => String(p.type || "").toLowerCase() === "dcr")?.brand)
    : ""

  if (systemType === "dcr") {
    return dcrBrand || customDcrBrand || panelBrand
  }
  if (systemType === "both") {
    if (dcrBrand && nonDcrBrand) return `${dcrBrand} / ${nonDcrBrand}`
    return dcrBrand || nonDcrBrand || panelBrand
  }
  const hasDcrPanels = Boolean(
    products.dcrPanelQuantity ||
      Number(raw.dcr_panel_quantity) > 0 ||
      pickNonEmpty(products.dcrPanelSize, raw.dcr_panel_size),
  )
  if (hasDcrPanels && dcrBrand) return dcrBrand
  return panelBrand || nonDcrBrand || dcrBrand
}

function toKwFromProducts(products: ProductSelection): number {
  const parseW = (size?: string, qty?: number) => {
    if (!size || !qty) return 0
    const w = Number.parseFloat(size.replace(/[^0-9.]/g, ""))
    if (Number.isNaN(w)) return 0
    return (w * qty) / 1000
  }
  if (products.systemType === "both") {
    return (
      parseW(products.dcrPanelSize, products.dcrPanelQuantity) +
      parseW(products.nonDcrPanelSize, products.nonDcrPanelQuantity)
    )
  }
  if (products.systemType === "dcr") {
    const fromDcr = parseW(products.dcrPanelSize, products.dcrPanelQuantity)
    if (fromDcr > 0) return fromDcr
  }
  if (products.panelSize && products.panelQuantity) {
    return parseW(products.panelSize, products.panelQuantity)
  }
  if (products.inverterSize) {
    const n = Number.parseFloat(products.inverterSize.replace(/[^0-9.]/g, ""))
    return Number.isNaN(n) ? 0 : n
  }
  return 0
}

export function getSystemKwLabel(products: ProductSelection): string {
  const kw = toKwFromProducts(products)
  if (kw > 0) return `${Math.max(1, Math.round(kw))} kW`
  const fromCalc = calculateSystemSize(products.panelSize || "", products.panelQuantity || 0)
  if (fromCalc && fromCalc !== "0kW") return fromCalc.replace(/kW/i, " kW").replace(" ", "")
  return products.inverterSize || "—"
}

export function getSystemTypeLabel(systemType: string): string {
  const map: Record<string, string> = {
    dcr: "On-Grid DCR Solar System",
    "non-dcr": "On-Grid Non-DCR Solar System",
    both: "On-Grid DCR + Non-DCR Solar System",
    customize: "Customized Solar System",
  }
  return map[systemType] || "On-Grid Solar System"
}

function getPanelGradeLabel(systemType: string | undefined): string {
  if (systemType === "dcr") return "DCR Grade"
  if (systemType === "non-dcr") return "Non-DCR Grade"
  if (systemType === "both") return "DCR / Non-DCR Grade"
  return "Non-DCR Grade"
}

function resolvePrimaryPanelFields(products: ProductsLike) {
  const raw = products as Record<string, unknown>
  if (String(products.systemType || raw.system_type || "").toLowerCase() === "dcr") {
    // Standard DCR flow saves panelSize/panelQuantity; prefer those over stale dcrPanel* copies.
    return {
      size: pickNonEmpty(products.panelSize, raw.panel_size, products.dcrPanelSize, raw.dcr_panel_size),
      quantity:
        products.panelQuantity ||
        Number(raw.panel_quantity) ||
        products.dcrPanelQuantity ||
        Number(raw.dcr_panel_quantity) ||
        0,
      brand: resolvePanelBrandForPdf(products),
    }
  }
  return {
    size: pickNonEmpty(products.panelSize, raw.panel_size, products.nonDcrPanelSize, raw.non_dcr_panel_size),
    quantity:
      products.panelQuantity ||
      Number(raw.panel_quantity) ||
      products.nonDcrPanelQuantity ||
      Number(raw.non_dcr_panel_quantity) ||
      0,
    brand: resolvePanelBrandForPdf(products),
  }
}

export function buildSpecRows(products: ProductSelection | ProductsLike): SpecRow[] {
  const p = products as ProductsLike
  if (!p?.systemType && !(p as Record<string, unknown>).system_type) {
    return [
      {
        component: "Solar Panels",
        specification: "As per BOM",
        brandModel: "—",
        qty: "As Per BOM",
      },
    ]
  }
  const systemType = String(p.systemType || (p as Record<string, unknown>).system_type || "")
  const gradeLabel = getPanelGradeLabel(systemType)
  const primary = resolvePrimaryPanelFields(p)
  const primaryRange = resolvePdfPanelRangeKey(p, "primary")
  const dcrRange = resolvePdfPanelRangeKey(p, "dcr")
  const nonDcrRange = resolvePdfPanelRangeKey(p, "nonDcr")

  const buildPanelSpecText = (size: string, grade: string, rangeKey: PdfPanelRangeKey | null) => {
    if (rangeKey) {
      const rangeLabel = getPanelPdfRangeLabel(rangeKey) ?? QUOTATION_AS_PER_THE_SET_LABEL
      return `${rangeLabel}, ${grade}`
    }
    if (isAsPerTheSetLabel(size)) return `${QUOTATION_AS_PER_THE_SET_LABEL}, ${grade}`
    return `${size || "—"} Mono PERC Bifacial Technology, ${grade}`
  }

  const buildPanelQty = (quantity: number, rangeKey: PdfPanelRangeKey | null) => {
    if (rangeKey) return "As Per BOM"
    return quantity ? `${quantity} Pcs` : "As Per BOM"
  }

  const panelSpec = buildPanelSpecText(primary.size || "", gradeLabel, primaryRange)
  const panelBrand = primary.brand || "—"
  const panelQty = buildPanelQty(primary.quantity, primaryRange)

  const invSpec = `${p.inverterSize || "—"} ${p.inverterType || "String Inverter"}, ${formatQuotationPhaseLabel(resolveQuotationPhase(p))}, MPPT, IP65, Wi-Fi Monitoring`
  const invBrand =
    isAsPerTheSetLabel(p.inverterBrand) || isAsPerTheSetLabel(p.inverterSize)
      ? QUOTATION_AS_PER_THE_SET_LABEL
      : normalizeInverterBrandForDisplay(p.inverterBrand) || "Vsole/Xwatt"
  const dcrBrandForBoth = pickNonEmpty(
    p.dcrPanelBrand,
    (p as Record<string, unknown>).dcr_panel_brand,
    (p as Record<string, unknown>).panelType,
    (p as Record<string, unknown>).panel_type,
  )

  const panelRows: SpecRow[] =
    systemType === "both" && dcrBrandForBoth
      ? [
          {
            component: "DCR Panels",
            specification: buildPanelSpecText(
              p.dcrPanelSize || "",
              "DCR Grade",
              dcrRange,
            ),
            brandModel: dcrBrandForBoth,
            qty: buildPanelQty(p.dcrPanelQuantity || 0, dcrRange),
          },
          ...(pickNonEmpty(p.nonDcrPanelBrand, (p as Record<string, unknown>).non_dcr_panel_brand)
            ? [
                {
                  component: "Non-DCR Panels",
                  specification: buildPanelSpecText(
                    p.nonDcrPanelSize || "",
                    "Non-DCR Grade",
                    nonDcrRange,
                  ),
                  brandModel: pickNonEmpty(p.nonDcrPanelBrand, (p as Record<string, unknown>).non_dcr_panel_brand),
                  qty: buildPanelQty(p.nonDcrPanelQuantity || 0, nonDcrRange),
                } satisfies SpecRow,
              ]
            : []),
        ]
      : [
          {
            component: "Solar Panels",
            specification: panelSpec,
            brandModel: panelBrand,
            qty: panelQty,
          },
        ]

  const rows: SpecRow[] = [
    ...panelRows,
    {
      component: "Solar Inverter",
      specification: invSpec,
      brandModel: invBrand,
      qty: "1 Unit",
    },
    {
      component: "Mounting Structure",
      specification: getMountingStructurePdfSpecification(),
      brandModel: getMountingStructurePdfBrandModel(p),
      qty: "As Required",
    },
    {
      component: "DC Cables",
      specification: `${p.dcCableSize || "4mm²/6mm²"} DC Solar Cable`,
      brandModel: p.dcCableBrand || "Polycab / Standard",
      qty: "As Per BOM",
    },
    {
      component: "AC Cables",
      specification: `AC Output Cables, ${formatQuotationPhaseLabel(resolveQuotationPhase(p))}`,
      brandModel: p.acCableBrand || "Polycab / Standard",
      qty: "As Per BOM",
    },
    {
      component: "ACDB / DCDB",
      specification: "AC & DC Distribution Box",
      brandModel: p.acdb || p.dcdb ? `${p.acdb || ""} ${p.dcdb || ""}`.trim() : "Havells MCB",
      qty: "1 Set",
    },
    {
      component: "Lightning Arrestor & Earthing",
      specification: "Lightning Protection, Green Earthing Wire",
      brandModel: "JMP Green Earthing Wire",
      qty: "1 Set",
    },
    {
      component: "Net Meter",
      specification: "Bi-Directional Energy Meter",
      brandModel: p.meterBrand || "L&T/HPL/Genus/Secure",
      qty: "1 Unit",
    },
  ]

  return rows
}

export function shouldUseCompactPage2PdfFont(products?: ProductsLike | null): boolean {
  return resolveProductsSystemType(products) === "both"
}

/** Normalize system type from products (camelCase or API snake_case). */
export function resolveProductsSystemType(products?: ProductsLike | null): string {
  if (!products) return ""
  const raw = products as Record<string, unknown>
  return pickNonEmpty(products.systemType, raw.system_type)
    .toLowerCase()
    .replace(/_/g, "-")
    .replace(/\s+/g, "-")
}

/** Subsidy T&C row — shown for DCR and BOTH only; hidden for Non-DCR. */
export function shouldShowSubsidyTermsInPdf(products: ProductsLike): boolean {
  const systemType = resolveProductsSystemType(products)
  return systemType === "dcr" || systemType === "both"
}

/** Rate column in pricing PDF table — visible for Non-DCR only. */
export function shouldShowPricingRateColumn(
  systemType?: string,
  products?: ProductsLike | null,
): boolean {
  const type = (systemType || resolveProductsSystemType(products)).toLowerCase().replace(/_/g, "-")
  return type === "non-dcr"
}

export function buildPricingRows(subtotal: number, systemKwLabel: string): PricingRow[] {
  const kwNum = Number.parseFloat(systemKwLabel.replace(/[^0-9.]/g, "")) || 0
  const watts = Math.round(kwNum * 1000)
  const ratePerWatt = watts > 0 ? Math.round(subtotal / watts) : 0
  return [
    {
      description: `${systemKwLabel.replace(/\s*kW/i, " KW")} Solar System`,
      rate: ratePerWatt > 0 ? `${ratePerWatt} per Watt` : "As quoted",
      capacity: watts > 0 ? `${watts} W` : "—",
      amount: formatInr(subtotal),
      highlight: true,
    },
    { description: "GST & Taxes", rate: "Included", capacity: "Included", amount: "Included" },
    {
      description: "Transportation & Logistics",
      rate: "Included",
      capacity: "Included",
      amount: "Included",
    },
    {
      description: "Installation & Commissioning",
      rate: "Included",
      capacity: "Included",
      amount: "Included",
    },
  ]
}

/** Page-2 payment schedule summary (full policy text is in Terms & Conditions). */
export function buildPaymentRows(subtotal: number): PaymentRow[] {
  return [
    {
      stage: "Token Money",
      when: "At Order Confirmation (Cash/UPI/Netbanking)",
      percentage: "10–20%",
      amount: "As per T&C",
      highlight: true,
    },
    {
      stage: "Material Delivery (Cash)",
      when: "When Material Reaches Customer Home",
      percentage: "70–80%",
      amount: "As per T&C",
    },
    {
      stage: "Pre-Installation (Loan)",
      when: "Before Installation Starts",
      percentage: "70%",
      amount: "As per T&C",
    },
    {
      stage: "Post-Installation (Loan)",
      when: "After Installation",
      percentage: "30%",
      amount: "As per T&C",
    },
    {
      stage: "Metering & Closure",
      when: "Before Metering & Commissioning",
      percentage: "Balance (~10%)",
      amount: "As per T&C",
    },
    {
      stage: "TOTAL PROJECT COST",
      when: "",
      percentage: "100%",
      amount: formatInr(subtotal),
    },
  ]
}

export function buildSubsidyTermsDetail(_products: ProductsLike): string {
  return (
    "Government subsidy is applicable to this customer for this quotation. " +
    "ChairBord Solar will apply for the eligible subsidy on the customer's behalf as per prevailing MNRE/state norms and timelines. " +
    "Subsidy sanction and disbursement are subject to government authorities; balance payment shall be as per the payment terms below."
  )
}

export function buildWarrantyRows(panelBrand: string): WarrantyRow[] {
  const brandLabel = panelBrand || "Selected brand"
  return [
    {
      component: `Solar Panels (${brandLabel})`,
      period: "30 Years",
      coverage: "Linear Power Output Guarantee",
    },
    {
      component: "GTI Inverter (Vsol/Xwatt)",
      period: "8–10 Years",
      coverage: "Manufacturing Defects",
    },
    {
      component: "Complete System",
      period: "5 Years",
      coverage: "Comprehensive System Warranty",
    },
  ]
}

export function buildAfterSalesSupportLine(company: ProposalCompanyInfo): string {
  const formUrl = company.supportFormUrl?.trim() || DEFAULT_PROPOSAL_SUPPORT_FORM_URL
  return [
    `Support No: ${DEFAULT_PROPOSAL_SUPPORT_PHONE}`,
    `Support Email: ${DEFAULT_PROPOSAL_SUPPORT_EMAIL}`,
    `Support Form: ${formUrl}`,
  ].join("  |  ")
}

export function getProposalConsentText(companyName: string): string {
  return `I have read, understood, and agree to all Terms & Conditions stated in this proposal (including payment schedule, project timeline, validity, on-grid operation, net metering, subsidy, and other clauses). I authorize ${companyName} to proceed as per this quotation.`
}

export const DEFAULT_TERMS_ROWS: TermsRow[] = [
  {
    category: "Payment",
    detail: PROPOSAL_PAYMENT_TERMS_DETAIL,
  },
  {
    category: "Project Timeline",
    detail:
      "15–20 days from receipt of Solar NOC from DISCOM, commercially clear order, and advance payment.",
  },
  {
    category: "Validity",
    detail: `${PROPOSAL_VALIDITY_DAYS} days from the date of offer. After this period, confirmation must be obtained.`,
  },
  {
    category: "Client Scope",
    detail:
      "Module cleaning, rooftop access, electricity/water during construction, safe storage, LT panel connection space, and internet for monitoring (if applicable) — client scope.",
  },
  {
    category: "Transport",
    detail: "Transportation of BOM to the installation site is included in the quoted price.",
  },
  {
    category: "Net Meter",
    detail:
      "Net metering application, approval, meter issue, testing, and grid synchronization are processed solely by the DISCOM; timelines and outcomes are outside Chairbord Solar's control and are not part of our project commitment. All DISCOM charges (file charges, demand charges, net-meter testing, electrical inspector report, etc.) shall be paid by the client directly to the DISCOM.",
  },
  {
    category: "On-Grid Operation",
    detail:
      "This is an on-grid solar plant. The system will generate and supply power only when grid electricity is available; during a power cut or grid outage, the plant will not work and will not provide backup power to the premises.",
  },
  {
    category: "Subsidy",
    detail:
      "If subsidy is applicable to the customer, ChairBord Solar will apply; if not applicable, subsidy is not ChairBord Solar's responsibility. Payment as per payment terms below.",
  },
  {
    category: "Inverter",
    detail: "Grid-tie inverter as per specification; manufacturer warranty (typically 8–10 years) applies.",
  },
]

function buildTermsRows(products: ProductsLike, panelBrand: string): TermsRow[] {
  const brandLabel = panelBrand || "selected brand"
  const showSubsidyTerms = shouldShowSubsidyTermsInPdf(products)

  const panelsRow: TermsRow = {
    category: "Panels",
    detail: `${brandLabel} bifacial modules with manufacturer performance warranty as per BOM.`,
  }

  const rows = DEFAULT_TERMS_ROWS.filter(
    (row) => showSubsidyTerms || row.category !== "Subsidy",
  ).map((row) => {
    if (row.category === "Payment") {
      return { ...row, detail: PROPOSAL_PAYMENT_TERMS_DETAIL }
    }
    if (row.category === "Subsidy") {
      return { ...row, detail: buildSubsidyTermsDetail(products) }
    }
    return row
  })

  const inverterIndex = rows.findIndex((row) => row.category === "Inverter")
  if (inverterIndex === -1) return [...rows, panelsRow]
  return [...rows.slice(0, inverterIndex), panelsRow, ...rows.slice(inverterIndex)]
}

export function buildQuotationProposalDocumentData(params: {
  quotationId: string
  customer: Customer
  products: ProductSelection | null | undefined
  company: ProposalCompanyInfo
  dealer?: ProposalDealerContactSource | null
  banks: { icici: ProposalBankAccount; sbi: ProposalBankAccount }
  subtotal: number
  totalAmount: number
  quotationDate?: Date
  validityDate?: Date
}): QuotationProposalDocumentData {
  const products = (params.products || { systemType: "dcr", phase: "1-Phase" }) as ProductsLike
  const quotationDate = params.quotationDate ?? new Date()
  const validityDate =
    params.validityDate ??
    new Date(quotationDate.getTime() + PROPOSAL_VALIDITY_DAYS * 24 * 60 * 60 * 1000)
  const phaseLabel = formatQuotationPhaseLabel(resolveQuotationPhase(products))
  const systemKwLabel = getSystemKwLabel(products)
  const panelBrand = resolvePanelBrandForPdf(products)

  return {
    quotationId: params.quotationId,
    quotationDate,
    validityDate,
    customer: {
      ...params.customer,
      firstName:
        sanitizeNamePart(params.customer.firstName) ||
        String(params.customer.firstName ?? "").trim(),
      lastName: sanitizeNamePart(params.customer.lastName),
    },
    products,
    company: params.company,
    dealer: buildProposalDealerInfo(params.dealer, params.company),
    banks: params.banks,
    subtotal: params.subtotal,
    totalAmount: params.totalAmount,
    systemKwLabel,
    phaseLabel,
    systemTypeLabel: getSystemTypeLabel(products.systemType),
    specRows: buildSpecRows(products),
    panelNote: buildPanelTechnologyNote(products),
    showPricingRateColumn: shouldShowPricingRateColumn(undefined, products),
    pricingRows: buildPricingRows(params.subtotal, systemKwLabel),
    paymentRows: buildPaymentRows(params.subtotal),
    warrantyRows: buildWarrantyRows(panelBrand),
    supportLine: buildAfterSalesSupportLine(params.company),
    termsRows: buildTermsRows(products, panelBrand),
    page2CompactFont: shouldUseCompactPage2PdfFont(products),
  }
}
