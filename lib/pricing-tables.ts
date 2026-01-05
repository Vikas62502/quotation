// Pricing Tables for Solar Systems
// Based on system type: DCR, NON DCR, and BOTH (DCR + NON DCR)
// Pricing data can come from backend API or use hardcoded fallback values

export interface SystemPricing {
  systemSize: string
  phase: "1-Phase" | "3-Phase"
  inverterSize: string
  panelType: string
  price: number
  notes?: string
}

// Component Pricing Interfaces
export interface PanelPricing {
  brand: string
  size: string // e.g., "440W", "545W"
  price: number // Price per panel
}

export interface InverterPricing {
  brand: string
  size: string // e.g., "3kW", "5kW"
  price: number
}

export interface StructurePricing {
  type: string // e.g., "GI Structure", "Aluminum Structure"
  size: string // e.g., "1kW", "5kW"
  price: number // Price per kW or total
}

export interface MeterPricing {
  brand: string
  price: number
}

export interface CablePricing {
  brand: string
  size: string // e.g., "4 sq mm", "6 sq mm"
  type: "AC" | "DC"
  price: number // Price per meter or fixed price
}

export interface ACDBPricing {
  brand: string // e.g., "Havells", "L&T"
  phase: "1-Phase" | "3-Phase"
  price: number
}

export interface DCDBPricing {
  brand: string // e.g., "Havells", "L&T"
  phase: "1-Phase" | "3-Phase"
  price: number
}

// System Configuration Preset - Default product selections for a system
export interface SystemConfigurationPreset {
  systemType: "dcr" | "non-dcr" | "both"
  systemSize: string // e.g., "3kW", "5kW"
  panelBrand: string
  panelSize: string
  inverterBrand: string
  inverterSize: string
  inverterType: string
  structureType: string
  structureSize: string
  meterBrand: string
  acCableBrand: string
  acCableSize: string
  dcCableBrand: string
  dcCableSize: string
  acdb: string
  dcdb: string
  // Subsidies (optional - DCR systems have fixed central subsidy of 78000)
  centralSubsidy?: number
  stateSubsidy?: number
}

// Pricing tables data structure (from API or fallback)
export interface PricingTablesData {
  // System pricing (DCR, NON DCR, BOTH)
  dcr?: SystemPricing[]
  nonDcr?: SystemPricing[]
  both?: BothSystemPricing[]
  
  // Component pricing
  panels?: PanelPricing[]
  inverters?: InverterPricing[]
  structures?: StructurePricing[]
  meters?: MeterPricing[]
  cables?: CablePricing[]
  acdb?: ACDBPricing[]
  dcdb?: DCDBPricing[]
  
  // System configuration presets (default product selections)
  systemConfigs?: SystemConfigurationPreset[]
}

// Global variable to store API pricing data (set by usePricingTables hook)
let apiPricingData: PricingTablesData | null = null

// Function to set pricing data from API
export function setPricingData(data: PricingTablesData | null) {
  apiPricingData = data
}

// Default component pricing (fallback values)
export const defaultPanelPricing: PanelPricing[] = [
  { brand: "Adani", size: "440W", price: 25000 },
  { brand: "Adani", size: "545W", price: 31000 },
  { brand: "Tata", size: "440W", price: 26000 },
  { brand: "Tata", size: "545W", price: 32000 },
  { brand: "Waaree", size: "440W", price: 24000 },
  { brand: "Waaree", size: "545W", price: 30000 },
  { brand: "Vikram Solar", size: "440W", price: 24500 },
  { brand: "Vikram Solar", size: "545W", price: 30500 },
  { brand: "RenewSys", size: "440W", price: 23500 },
  { brand: "RenewSys", size: "545W", price: 29500 },
]

export const defaultInverterPricing: InverterPricing[] = [
  { brand: "Growatt", size: "3kW", price: 35000 },
  { brand: "Growatt", size: "5kW", price: 58000 },
  { brand: "Growatt", size: "6kW", price: 70000 },
  { brand: "Growatt", size: "8kW", price: 93000 },
  { brand: "Growatt", size: "10kW", price: 117000 },
  { brand: "Solis", size: "3kW", price: 32000 },
  { brand: "Solis", size: "5kW", price: 53000 },
  { brand: "Solis", size: "6kW", price: 64000 },
  { brand: "Fronius", size: "3kW", price: 45000 },
  { brand: "Fronius", size: "5kW", price: 75000 },
  { brand: "Fronius", size: "6kW", price: 90000 },
  { brand: "Havells", size: "3kW", price: 38000 },
  { brand: "Havells", size: "5kW", price: 63000 },
  { brand: "Polycab", size: "3kW", price: 36000 },
  { brand: "Polycab", size: "5kW", price: 60000 },
  { brand: "Delta", size: "3kW", price: 40000 },
  { brand: "Delta", size: "5kW", price: 67000 },
]

export const defaultStructurePricing: StructurePricing[] = [
  { type: "GI Structure", size: "1kW", price: 8000 },
  { type: "GI Structure", size: "3kW", price: 24000 },
  { type: "GI Structure", size: "5kW", price: 40000 },
  { type: "GI Structure", size: "10kW", price: 80000 },
  { type: "Aluminum Structure", size: "1kW", price: 10000 },
  { type: "Aluminum Structure", size: "3kW", price: 30000 },
  { type: "Aluminum Structure", size: "5kW", price: 50000 },
  { type: "MS Structure", size: "1kW", price: 9000 },
  { type: "MS Structure", size: "3kW", price: 27000 },
  { type: "MS Structure", size: "5kW", price: 45000 },
]

export const defaultMeterPricing: MeterPricing[] = [
  { brand: "L&T", price: 5000 },
  { brand: "HPL", price: 4800 },
  { brand: "Havells", price: 5200 },
  { brand: "Genus", price: 4900 },
  { brand: "Secure", price: 5100 },
]

export const defaultCablePricing: CablePricing[] = [
  { brand: "Polycab", size: "4 sq mm", type: "AC", price: 3000 },
  { brand: "Polycab", size: "6 sq mm", type: "AC", price: 3500 },
  { brand: "Polycab", size: "4 sq mm", type: "DC", price: 3000 },
  { brand: "Polycab", size: "6 sq mm", type: "DC", price: 3500 },
  { brand: "Havells", size: "4 sq mm", type: "AC", price: 3200 },
  { brand: "Havells", size: "6 sq mm", type: "AC", price: 3800 },
  { brand: "Havells", size: "4 sq mm", type: "DC", price: 3200 },
  { brand: "KEI", size: "4 sq mm", type: "DC", price: 3100 },
  { brand: "KEI", size: "6 sq mm", type: "DC", price: 3600 },
  { brand: "Finolex", size: "6 sq mm", type: "AC", price: 3400 },
  { brand: "RR Kabel", size: "6 sq mm", type: "AC", price: 3600 },
  { brand: "RR Kabel", size: "10 sq mm", type: "AC", price: 4500 },
]

export const defaultACDBPricing: ACDBPricing[] = [
  // 1-Phase ACDB
  { brand: "Havells", phase: "1-Phase", price: 2500 },
  { brand: "L&T", phase: "1-Phase", price: 2800 },
  { brand: "Polycab", phase: "1-Phase", price: 2300 },
  { brand: "HPL", phase: "1-Phase", price: 2400 },
  // 3-Phase ACDB
  { brand: "Havells", phase: "3-Phase", price: 5000 },
  { brand: "L&T", phase: "3-Phase", price: 5500 },
  { brand: "Polycab", phase: "3-Phase", price: 4800 },
  { brand: "HPL", phase: "3-Phase", price: 4900 },
]

export const defaultDCDBPricing: DCDBPricing[] = [
  // 1-Phase DCDB
  { brand: "Havells", phase: "1-Phase", price: 2500 },
  { brand: "L&T", phase: "1-Phase", price: 2800 },
  { brand: "Polycab", phase: "1-Phase", price: 2300 },
  { brand: "HPL", phase: "1-Phase", price: 2400 },
  // 3-Phase DCDB
  { brand: "Havells", phase: "3-Phase", price: 5000 },
  { brand: "L&T", phase: "3-Phase", price: 5500 },
  { brand: "Polycab", phase: "3-Phase", price: 4800 },
  { brand: "HPL", phase: "3-Phase", price: 4900 },
]

// Helper function to get available panel sizes from pricing tables
export function getAvailablePanelSizes(pricingData?: PricingTablesData): string[] {
  const data = pricingData || getPricingData()
  const pricingTable = data.panels || defaultPanelPricing
  
  // Extract unique panel sizes from pricing table
  const sizes = new Set<string>()
  pricingTable.forEach((panel) => {
    if (panel.size) {
      sizes.add(panel.size)
    }
  })
  
  // Return sorted sizes
  return Array.from(sizes).sort((a, b) => {
    const aSize = Number.parseInt(a.replace("W", "")) || 0
    const bSize = Number.parseInt(b.replace("W", "")) || 0
    return aSize - bSize
  })
}

// Helper function to get available structure sizes from pricing tables
export function getAvailableStructureSizes(pricingData?: PricingTablesData): string[] {
  const data = pricingData || getPricingData()
  const pricingTable = data.structures || defaultStructurePricing
  
  // Extract unique structure sizes from pricing table
  const sizes = new Set<string>()
  pricingTable.forEach((structure) => {
    if (structure.size) {
      sizes.add(structure.size)
    }
  })
  
  // Return sorted sizes
  return Array.from(sizes).sort((a, b) => {
    const aSize = Number.parseInt(a.replace("kW", "")) || 0
    const bSize = Number.parseInt(b.replace("kW", "")) || 0
    return aSize - bSize
  })
}

// Default System Configuration Presets
// These define default product selections for each system type, size, and panel brand
// Each preset matches the pricing table entries (lines 372-515) with fixed component configurations
// When a user selects a configuration, all product selection fields are auto-filled
export const defaultSystemConfigs: SystemConfigurationPreset[] = [
  // ========== DCR SYSTEMS (1-Phase) ==========
  // Adani DCR 1-Phase
  { systemType: "dcr", systemSize: "3kW", panelBrand: "Adani", panelSize: "545W", inverterBrand: "XWatt", inverterSize: "3kW", inverterType: "String Inverter", structureType: "GI Structure", structureSize: "3kW", meterBrand: "L&T", acCableBrand: "Polycab", acCableSize: "4 sq mm", dcCableBrand: "Polycab", dcCableSize: "4 sq mm", acdb: "Havells (1-Phase)", dcdb: "Havells (1-Phase)", centralSubsidy: 78000 },
  { systemType: "dcr", systemSize: "4kW", panelBrand: "Adani", panelSize: "545W", inverterBrand: "XWatt", inverterSize: "5kW", inverterType: "String Inverter", structureType: "GI Structure", structureSize: "4kW", meterBrand: "L&T", acCableBrand: "Polycab", acCableSize: "4 sq mm", dcCableBrand: "Polycab", dcCableSize: "4 sq mm", acdb: "Havells (1-Phase)", dcdb: "Havells (1-Phase)", centralSubsidy: 78000 },
  { systemType: "dcr", systemSize: "5kW", panelBrand: "Adani", panelSize: "545W", inverterBrand: "XWatt", inverterSize: "5kW", inverterType: "String Inverter", structureType: "GI Structure", structureSize: "5kW", meterBrand: "L&T", acCableBrand: "Polycab", acCableSize: "4 sq mm", dcCableBrand: "Polycab", dcCableSize: "4 sq mm", acdb: "Havells (1-Phase)", dcdb: "Havells (1-Phase)", centralSubsidy: 78000 },
  { systemType: "dcr", systemSize: "6kW", panelBrand: "Adani", panelSize: "545W", inverterBrand: "XWatt", inverterSize: "6kW", inverterType: "String Inverter", structureType: "GI Structure", structureSize: "6kW", meterBrand: "L&T", acCableBrand: "Polycab", acCableSize: "6 sq mm", dcCableBrand: "Polycab", dcCableSize: "4 sq mm", acdb: "Havells (1-Phase)", dcdb: "Havells (1-Phase)", centralSubsidy: 78000 },
  
  // Waaree DCR 1-Phase
  { systemType: "dcr", systemSize: "3kW", panelBrand: "Waaree", panelSize: "545W", inverterBrand: "XWatt", inverterSize: "3kW", inverterType: "String Inverter", structureType: "GI Structure", structureSize: "3kW", meterBrand: "L&T", acCableBrand: "Polycab", acCableSize: "4 sq mm", dcCableBrand: "Polycab", dcCableSize: "4 sq mm", acdb: "Havells (1-Phase)", dcdb: "Havells (1-Phase)", centralSubsidy: 78000 },
  { systemType: "dcr", systemSize: "4kW", panelBrand: "Waaree", panelSize: "545W", inverterBrand: "XWatt", inverterSize: "5kW", inverterType: "String Inverter", structureType: "GI Structure", structureSize: "4kW", meterBrand: "L&T", acCableBrand: "Polycab", acCableSize: "4 sq mm", dcCableBrand: "Polycab", dcCableSize: "4 sq mm", acdb: "Havells (1-Phase)", dcdb: "Havells (1-Phase)", centralSubsidy: 78000 },
  { systemType: "dcr", systemSize: "5kW", panelBrand: "Waaree", panelSize: "545W", inverterBrand: "XWatt", inverterSize: "5kW", inverterType: "String Inverter", structureType: "GI Structure", structureSize: "5kW", meterBrand: "L&T", acCableBrand: "Polycab", acCableSize: "4 sq mm", dcCableBrand: "Polycab", dcCableSize: "4 sq mm", acdb: "Havells (1-Phase)", dcdb: "Havells (1-Phase)", centralSubsidy: 78000 },
  { systemType: "dcr", systemSize: "6kW", panelBrand: "Waaree", panelSize: "545W", inverterBrand: "XWatt", inverterSize: "6kW", inverterType: "String Inverter", structureType: "GI Structure", structureSize: "6kW", meterBrand: "L&T", acCableBrand: "Polycab", acCableSize: "6 sq mm", dcCableBrand: "Polycab", dcCableSize: "4 sq mm", acdb: "Havells (1-Phase)", dcdb: "Havells (1-Phase)", centralSubsidy: 78000 },
  
  // Tata DCR 1-Phase
  { systemType: "dcr", systemSize: "3kW", panelBrand: "Tata", panelSize: "545W", inverterBrand: "GoodWe", inverterSize: "3kW", inverterType: "String Inverter", structureType: "GI Structure", structureSize: "3kW", meterBrand: "L&T", acCableBrand: "Polycab", acCableSize: "4 sq mm", dcCableBrand: "Polycab", dcCableSize: "4 sq mm", acdb: "Havells (1-Phase)", dcdb: "Havells (1-Phase)", centralSubsidy: 78000 },
  { systemType: "dcr", systemSize: "4kW", panelBrand: "Tata", panelSize: "545W", inverterBrand: "GoodWe", inverterSize: "5kW", inverterType: "String Inverter", structureType: "GI Structure", structureSize: "4kW", meterBrand: "L&T", acCableBrand: "Polycab", acCableSize: "4 sq mm", dcCableBrand: "Polycab", dcCableSize: "4 sq mm", acdb: "Havells (1-Phase)", dcdb: "Havells (1-Phase)", centralSubsidy: 78000 },
  { systemType: "dcr", systemSize: "5kW", panelBrand: "Tata", panelSize: "545W", inverterBrand: "GoodWe", inverterSize: "5kW", inverterType: "String Inverter", structureType: "GI Structure", structureSize: "5kW", meterBrand: "L&T", acCableBrand: "Polycab", acCableSize: "4 sq mm", dcCableBrand: "Polycab", dcCableSize: "4 sq mm", acdb: "Havells (1-Phase)", dcdb: "Havells (1-Phase)", centralSubsidy: 78000 },
  { systemType: "dcr", systemSize: "6kW", panelBrand: "Tata", panelSize: "545W", inverterBrand: "GoodWe", inverterSize: "6kW", inverterType: "String Inverter", structureType: "GI Structure", structureSize: "6kW", meterBrand: "L&T", acCableBrand: "Polycab", acCableSize: "6 sq mm", dcCableBrand: "Polycab", dcCableSize: "4 sq mm", acdb: "Havells (1-Phase)", dcdb: "Havells (1-Phase)", centralSubsidy: 78000 },
  
  // ========== DCR SYSTEMS (3-Phase) ==========
  // Adani DCR 3-Phase
  { systemType: "dcr", systemSize: "3kW", panelBrand: "Adani", panelSize: "545W", inverterBrand: "XWatt", inverterSize: "5kW", inverterType: "String Inverter", structureType: "GI Structure", structureSize: "3kW", meterBrand: "L&T", acCableBrand: "Polycab", acCableSize: "4 sq mm", dcCableBrand: "Polycab", dcCableSize: "4 sq mm", acdb: "Havells (3-Phase)", dcdb: "Havells (3-Phase)", centralSubsidy: 78000 },
  { systemType: "dcr", systemSize: "4kW", panelBrand: "Adani", panelSize: "545W", inverterBrand: "XWatt", inverterSize: "5kW", inverterType: "String Inverter", structureType: "GI Structure", structureSize: "4kW", meterBrand: "L&T", acCableBrand: "Polycab", acCableSize: "4 sq mm", dcCableBrand: "Polycab", dcCableSize: "4 sq mm", acdb: "Havells (3-Phase)", dcdb: "Havells (3-Phase)", centralSubsidy: 78000 },
  { systemType: "dcr", systemSize: "5kW", panelBrand: "Adani", panelSize: "545W", inverterBrand: "XWatt", inverterSize: "5kW", inverterType: "String Inverter", structureType: "GI Structure", structureSize: "5kW", meterBrand: "L&T", acCableBrand: "Polycab", acCableSize: "4 sq mm", dcCableBrand: "Polycab", dcCableSize: "4 sq mm", acdb: "Havells (3-Phase)", dcdb: "Havells (3-Phase)", centralSubsidy: 78000 },
  { systemType: "dcr", systemSize: "6kW", panelBrand: "Adani", panelSize: "545W", inverterBrand: "XWatt", inverterSize: "6kW", inverterType: "String Inverter", structureType: "GI Structure", structureSize: "6kW", meterBrand: "L&T", acCableBrand: "Polycab", acCableSize: "6 sq mm", dcCableBrand: "Polycab", dcCableSize: "4 sq mm", acdb: "Havells (3-Phase)", dcdb: "Havells (3-Phase)", centralSubsidy: 78000 },
  { systemType: "dcr", systemSize: "7kW", panelBrand: "Adani", panelSize: "545W", inverterBrand: "XWatt", inverterSize: "8kW", inverterType: "String Inverter", structureType: "GI Structure", structureSize: "7kW", meterBrand: "L&T", acCableBrand: "Polycab", acCableSize: "6 sq mm", dcCableBrand: "Polycab", dcCableSize: "6 sq mm", acdb: "Havells (3-Phase)", dcdb: "Havells (3-Phase)", centralSubsidy: 78000 },
  { systemType: "dcr", systemSize: "8kW", panelBrand: "Adani", panelSize: "545W", inverterBrand: "XWatt", inverterSize: "8kW", inverterType: "String Inverter", structureType: "GI Structure", structureSize: "8kW", meterBrand: "L&T", acCableBrand: "Polycab", acCableSize: "6 sq mm", dcCableBrand: "Polycab", dcCableSize: "6 sq mm", acdb: "Havells (3-Phase)", dcdb: "Havells (3-Phase)", centralSubsidy: 78000 },
  { systemType: "dcr", systemSize: "10kW", panelBrand: "Adani", panelSize: "545W", inverterBrand: "XWatt", inverterSize: "10kW", inverterType: "String Inverter", structureType: "GI Structure", structureSize: "10kW", meterBrand: "L&T", acCableBrand: "Polycab", acCableSize: "6 sq mm", dcCableBrand: "Polycab", dcCableSize: "6 sq mm", acdb: "Havells (3-Phase)", dcdb: "Havells (3-Phase)", centralSubsidy: 78000 },
  { systemType: "dcr", systemSize: "12kW", panelBrand: "Adani", panelSize: "545W", inverterBrand: "XWatt", inverterSize: "12kW", inverterType: "String Inverter", structureType: "GI Structure", structureSize: "12kW", meterBrand: "L&T", acCableBrand: "Polycab", acCableSize: "6 sq mm", dcCableBrand: "Polycab", dcCableSize: "6 sq mm", acdb: "Havells (3-Phase)", dcdb: "Havells (3-Phase)", centralSubsidy: 78000 },
  { systemType: "dcr", systemSize: "15kW", panelBrand: "Adani", panelSize: "545W", inverterBrand: "XWatt", inverterSize: "15kW", inverterType: "String Inverter", structureType: "GI Structure", structureSize: "15kW", meterBrand: "L&T", acCableBrand: "Polycab", acCableSize: "10 sq mm", dcCableBrand: "Polycab", dcCableSize: "6 sq mm", acdb: "Havells (3-Phase)", dcdb: "Havells (3-Phase)", centralSubsidy: 78000 },
  { systemType: "dcr", systemSize: "20kW", panelBrand: "Adani", panelSize: "545W", inverterBrand: "XWatt", inverterSize: "20kW", inverterType: "String Inverter", structureType: "GI Structure", structureSize: "20kW", meterBrand: "L&T", acCableBrand: "Polycab", acCableSize: "10 sq mm", dcCableBrand: "Polycab", dcCableSize: "10 sq mm", acdb: "Havells (3-Phase)", dcdb: "Havells (3-Phase)", centralSubsidy: 78000 },
  { systemType: "dcr", systemSize: "25kW", panelBrand: "Adani", panelSize: "545W", inverterBrand: "XWatt", inverterSize: "25kW", inverterType: "String Inverter", structureType: "GI Structure", structureSize: "25kW", meterBrand: "L&T", acCableBrand: "Polycab", acCableSize: "10 sq mm", dcCableBrand: "Polycab", dcCableSize: "10 sq mm", acdb: "Havells (3-Phase)", dcdb: "Havells (3-Phase)", centralSubsidy: 78000 },
  { systemType: "dcr", systemSize: "30kW", panelBrand: "Adani", panelSize: "545W", inverterBrand: "XWatt", inverterSize: "30kW", inverterType: "String Inverter", structureType: "GI Structure", structureSize: "30kW", meterBrand: "L&T", acCableBrand: "Polycab", acCableSize: "10 sq mm", dcCableBrand: "Polycab", dcCableSize: "10 sq mm", acdb: "Havells (3-Phase)", dcdb: "Havells (3-Phase)", centralSubsidy: 78000 },
  
  // Waaree DCR 3-Phase
  { systemType: "dcr", systemSize: "3kW", panelBrand: "Waaree", panelSize: "545W", inverterBrand: "XWatt", inverterSize: "5kW", inverterType: "String Inverter", structureType: "GI Structure", structureSize: "3kW", meterBrand: "L&T", acCableBrand: "Polycab", acCableSize: "4 sq mm", dcCableBrand: "Polycab", dcCableSize: "4 sq mm", acdb: "Havells (3-Phase)", dcdb: "Havells (3-Phase)", centralSubsidy: 78000 },
  { systemType: "dcr", systemSize: "4kW", panelBrand: "Waaree", panelSize: "545W", inverterBrand: "XWatt", inverterSize: "5kW", inverterType: "String Inverter", structureType: "GI Structure", structureSize: "4kW", meterBrand: "L&T", acCableBrand: "Polycab", acCableSize: "4 sq mm", dcCableBrand: "Polycab", dcCableSize: "4 sq mm", acdb: "Havells (3-Phase)", dcdb: "Havells (3-Phase)", centralSubsidy: 78000 },
  { systemType: "dcr", systemSize: "5kW", panelBrand: "Waaree", panelSize: "545W", inverterBrand: "XWatt", inverterSize: "5kW", inverterType: "String Inverter", structureType: "GI Structure", structureSize: "5kW", meterBrand: "L&T", acCableBrand: "Polycab", acCableSize: "4 sq mm", dcCableBrand: "Polycab", dcCableSize: "4 sq mm", acdb: "Havells (3-Phase)", dcdb: "Havells (3-Phase)", centralSubsidy: 78000 },
  { systemType: "dcr", systemSize: "6kW", panelBrand: "Waaree", panelSize: "545W", inverterBrand: "XWatt", inverterSize: "6kW", inverterType: "String Inverter", structureType: "GI Structure", structureSize: "6kW", meterBrand: "L&T", acCableBrand: "Polycab", acCableSize: "6 sq mm", dcCableBrand: "Polycab", dcCableSize: "4 sq mm", acdb: "Havells (3-Phase)", dcdb: "Havells (3-Phase)", centralSubsidy: 78000 },
  { systemType: "dcr", systemSize: "7kW", panelBrand: "Waaree", panelSize: "545W", inverterBrand: "XWatt", inverterSize: "8kW", inverterType: "String Inverter", structureType: "GI Structure", structureSize: "7kW", meterBrand: "L&T", acCableBrand: "Polycab", acCableSize: "6 sq mm", dcCableBrand: "Polycab", dcCableSize: "6 sq mm", acdb: "Havells (3-Phase)", dcdb: "Havells (3-Phase)", centralSubsidy: 78000 },
  { systemType: "dcr", systemSize: "8kW", panelBrand: "Waaree", panelSize: "545W", inverterBrand: "XWatt", inverterSize: "8kW", inverterType: "String Inverter", structureType: "GI Structure", structureSize: "8kW", meterBrand: "L&T", acCableBrand: "Polycab", acCableSize: "6 sq mm", dcCableBrand: "Polycab", dcCableSize: "6 sq mm", acdb: "Havells (3-Phase)", dcdb: "Havells (3-Phase)", centralSubsidy: 78000 },
  { systemType: "dcr", systemSize: "10kW", panelBrand: "Waaree", panelSize: "545W", inverterBrand: "XWatt", inverterSize: "10kW", inverterType: "String Inverter", structureType: "GI Structure", structureSize: "10kW", meterBrand: "L&T", acCableBrand: "Polycab", acCableSize: "6 sq mm", dcCableBrand: "Polycab", dcCableSize: "6 sq mm", acdb: "Havells (3-Phase)", dcdb: "Havells (3-Phase)", centralSubsidy: 78000 },
  { systemType: "dcr", systemSize: "12kW", panelBrand: "Waaree", panelSize: "545W", inverterBrand: "XWatt", inverterSize: "12kW", inverterType: "String Inverter", structureType: "GI Structure", structureSize: "12kW", meterBrand: "L&T", acCableBrand: "Polycab", acCableSize: "6 sq mm", dcCableBrand: "Polycab", dcCableSize: "6 sq mm", acdb: "Havells (3-Phase)", dcdb: "Havells (3-Phase)", centralSubsidy: 78000 },
  { systemType: "dcr", systemSize: "15kW", panelBrand: "Waaree", panelSize: "545W", inverterBrand: "XWatt", inverterSize: "15kW", inverterType: "String Inverter", structureType: "GI Structure", structureSize: "15kW", meterBrand: "L&T", acCableBrand: "Polycab", acCableSize: "10 sq mm", dcCableBrand: "Polycab", dcCableSize: "6 sq mm", acdb: "Havells (3-Phase)", dcdb: "Havells (3-Phase)", centralSubsidy: 78000 },
  { systemType: "dcr", systemSize: "20kW", panelBrand: "Waaree", panelSize: "545W", inverterBrand: "XWatt", inverterSize: "20kW", inverterType: "String Inverter", structureType: "GI Structure", structureSize: "20kW", meterBrand: "L&T", acCableBrand: "Polycab", acCableSize: "10 sq mm", dcCableBrand: "Polycab", dcCableSize: "10 sq mm", acdb: "Havells (3-Phase)", dcdb: "Havells (3-Phase)", centralSubsidy: 78000 },
  { systemType: "dcr", systemSize: "25kW", panelBrand: "Waaree", panelSize: "545W", inverterBrand: "XWatt", inverterSize: "25kW", inverterType: "String Inverter", structureType: "GI Structure", structureSize: "25kW", meterBrand: "L&T", acCableBrand: "Polycab", acCableSize: "10 sq mm", dcCableBrand: "Polycab", dcCableSize: "10 sq mm", acdb: "Havells (3-Phase)", dcdb: "Havells (3-Phase)", centralSubsidy: 78000 },
  { systemType: "dcr", systemSize: "30kW", panelBrand: "Waaree", panelSize: "545W", inverterBrand: "XWatt", inverterSize: "30kW", inverterType: "String Inverter", structureType: "GI Structure", structureSize: "30kW", meterBrand: "L&T", acCableBrand: "Polycab", acCableSize: "10 sq mm", dcCableBrand: "Polycab", dcCableSize: "10 sq mm", acdb: "Havells (3-Phase)", dcdb: "Havells (3-Phase)", centralSubsidy: 78000 },
  
  // Tata DCR 3-Phase
  { systemType: "dcr", systemSize: "3kW", panelBrand: "Tata", panelSize: "545W", inverterBrand: "GoodWe", inverterSize: "5kW", inverterType: "String Inverter", structureType: "GI Structure", structureSize: "3kW", meterBrand: "L&T", acCableBrand: "Polycab", acCableSize: "4 sq mm", dcCableBrand: "Polycab", dcCableSize: "4 sq mm", acdb: "Havells (3-Phase)", dcdb: "Havells (3-Phase)", centralSubsidy: 78000 },
  { systemType: "dcr", systemSize: "4kW", panelBrand: "Tata", panelSize: "545W", inverterBrand: "GoodWe", inverterSize: "5kW", inverterType: "String Inverter", structureType: "GI Structure", structureSize: "4kW", meterBrand: "L&T", acCableBrand: "Polycab", acCableSize: "4 sq mm", dcCableBrand: "Polycab", dcCableSize: "4 sq mm", acdb: "Havells (3-Phase)", dcdb: "Havells (3-Phase)", centralSubsidy: 78000 },
  { systemType: "dcr", systemSize: "5kW", panelBrand: "Tata", panelSize: "545W", inverterBrand: "GoodWe", inverterSize: "5kW", inverterType: "String Inverter", structureType: "GI Structure", structureSize: "5kW", meterBrand: "L&T", acCableBrand: "Polycab", acCableSize: "4 sq mm", dcCableBrand: "Polycab", dcCableSize: "4 sq mm", acdb: "Havells (3-Phase)", dcdb: "Havells (3-Phase)", centralSubsidy: 78000 },
  { systemType: "dcr", systemSize: "6kW", panelBrand: "Tata", panelSize: "545W", inverterBrand: "GoodWe", inverterSize: "6kW", inverterType: "String Inverter", structureType: "GI Structure", structureSize: "6kW", meterBrand: "L&T", acCableBrand: "Polycab", acCableSize: "6 sq mm", dcCableBrand: "Polycab", dcCableSize: "4 sq mm", acdb: "Havells (3-Phase)", dcdb: "Havells (3-Phase)", centralSubsidy: 78000 },
  { systemType: "dcr", systemSize: "7kW", panelBrand: "Tata", panelSize: "545W", inverterBrand: "GoodWe", inverterSize: "8kW", inverterType: "String Inverter", structureType: "GI Structure", structureSize: "7kW", meterBrand: "L&T", acCableBrand: "Polycab", acCableSize: "6 sq mm", dcCableBrand: "Polycab", dcCableSize: "6 sq mm", acdb: "Havells (3-Phase)", dcdb: "Havells (3-Phase)", centralSubsidy: 78000 },
  { systemType: "dcr", systemSize: "8kW", panelBrand: "Tata", panelSize: "545W", inverterBrand: "GoodWe", inverterSize: "8kW", inverterType: "String Inverter", structureType: "GI Structure", structureSize: "8kW", meterBrand: "L&T", acCableBrand: "Polycab", acCableSize: "6 sq mm", dcCableBrand: "Polycab", dcCableSize: "6 sq mm", acdb: "Havells (3-Phase)", dcdb: "Havells (3-Phase)", centralSubsidy: 78000 },
  { systemType: "dcr", systemSize: "10kW", panelBrand: "Tata", panelSize: "545W", inverterBrand: "GoodWe", inverterSize: "10kW", inverterType: "String Inverter", structureType: "GI Structure", structureSize: "10kW", meterBrand: "L&T", acCableBrand: "Polycab", acCableSize: "6 sq mm", dcCableBrand: "Polycab", dcCableSize: "6 sq mm", acdb: "Havells (3-Phase)", dcdb: "Havells (3-Phase)", centralSubsidy: 78000 },
  { systemType: "dcr", systemSize: "12kW", panelBrand: "Tata", panelSize: "545W", inverterBrand: "GoodWe", inverterSize: "12kW", inverterType: "String Inverter", structureType: "GI Structure", structureSize: "12kW", meterBrand: "L&T", acCableBrand: "Polycab", acCableSize: "6 sq mm", dcCableBrand: "Polycab", dcCableSize: "6 sq mm", acdb: "Havells (3-Phase)", dcdb: "Havells (3-Phase)", centralSubsidy: 78000 },
  { systemType: "dcr", systemSize: "15kW", panelBrand: "Tata", panelSize: "545W", inverterBrand: "GoodWe", inverterSize: "15kW", inverterType: "String Inverter", structureType: "GI Structure", structureSize: "15kW", meterBrand: "L&T", acCableBrand: "Polycab", acCableSize: "10 sq mm", dcCableBrand: "Polycab", dcCableSize: "6 sq mm", acdb: "Havells (3-Phase)", dcdb: "Havells (3-Phase)", centralSubsidy: 78000 },
  { systemType: "dcr", systemSize: "20kW", panelBrand: "Tata", panelSize: "545W", inverterBrand: "GoodWe", inverterSize: "20kW", inverterType: "String Inverter", structureType: "GI Structure", structureSize: "20kW", meterBrand: "L&T", acCableBrand: "Polycab", acCableSize: "10 sq mm", dcCableBrand: "Polycab", dcCableSize: "10 sq mm", acdb: "Havells (3-Phase)", dcdb: "Havells (3-Phase)", centralSubsidy: 78000 },
  { systemType: "dcr", systemSize: "25kW", panelBrand: "Tata", panelSize: "545W", inverterBrand: "GoodWe", inverterSize: "25kW", inverterType: "String Inverter", structureType: "GI Structure", structureSize: "25kW", meterBrand: "L&T", acCableBrand: "Polycab", acCableSize: "10 sq mm", dcCableBrand: "Polycab", dcCableSize: "10 sq mm", acdb: "Havells (3-Phase)", dcdb: "Havells (3-Phase)", centralSubsidy: 78000 },
  { systemType: "dcr", systemSize: "30kW", panelBrand: "Tata", panelSize: "545W", inverterBrand: "GoodWe", inverterSize: "30kW", inverterType: "String Inverter", structureType: "GI Structure", structureSize: "30kW", meterBrand: "L&T", acCableBrand: "Polycab", acCableSize: "10 sq mm", dcCableBrand: "Polycab", dcCableSize: "10 sq mm", acdb: "Havells (3-Phase)", dcdb: "Havells (3-Phase)", centralSubsidy: 78000 },
  
  // ========== NON DCR SYSTEMS (1-Phase) ==========
  // Adani NON DCR 1-Phase
  { systemType: "non-dcr", systemSize: "3kW", panelBrand: "Adani", panelSize: "545W", inverterBrand: "XWatt", inverterSize: "3kW", inverterType: "String Inverter", structureType: "GI Structure", structureSize: "3kW", meterBrand: "L&T", acCableBrand: "Polycab", acCableSize: "4 sq mm", dcCableBrand: "Polycab", dcCableSize: "4 sq mm", acdb: "Havells (1-Phase)", dcdb: "Havells (1-Phase)" },
  { systemType: "non-dcr", systemSize: "4kW", panelBrand: "Adani", panelSize: "545W", inverterBrand: "XWatt", inverterSize: "5kW", inverterType: "String Inverter", structureType: "GI Structure", structureSize: "4kW", meterBrand: "L&T", acCableBrand: "Polycab", acCableSize: "4 sq mm", dcCableBrand: "Polycab", dcCableSize: "4 sq mm", acdb: "Havells (1-Phase)", dcdb: "Havells (1-Phase)" },
  { systemType: "non-dcr", systemSize: "5kW", panelBrand: "Adani", panelSize: "545W", inverterBrand: "XWatt", inverterSize: "5kW", inverterType: "String Inverter", structureType: "GI Structure", structureSize: "5kW", meterBrand: "L&T", acCableBrand: "Polycab", acCableSize: "4 sq mm", dcCableBrand: "Polycab", dcCableSize: "4 sq mm", acdb: "Havells (1-Phase)", dcdb: "Havells (1-Phase)" },
  { systemType: "non-dcr", systemSize: "6kW", panelBrand: "Adani", panelSize: "545W", inverterBrand: "XWatt", inverterSize: "6kW", inverterType: "String Inverter", structureType: "GI Structure", structureSize: "6kW", meterBrand: "L&T", acCableBrand: "Polycab", acCableSize: "6 sq mm", dcCableBrand: "Polycab", dcCableSize: "4 sq mm", acdb: "Havells (1-Phase)", dcdb: "Havells (1-Phase)" },
  
  // Waaree NON DCR 1-Phase
  { systemType: "non-dcr", systemSize: "3kW", panelBrand: "Waaree", panelSize: "545W", inverterBrand: "XWatt", inverterSize: "3kW", inverterType: "String Inverter", structureType: "GI Structure", structureSize: "3kW", meterBrand: "L&T", acCableBrand: "Polycab", acCableSize: "4 sq mm", dcCableBrand: "Polycab", dcCableSize: "4 sq mm", acdb: "Havells (1-Phase)", dcdb: "Havells (1-Phase)" },
  { systemType: "non-dcr", systemSize: "4kW", panelBrand: "Waaree", panelSize: "545W", inverterBrand: "XWatt", inverterSize: "5kW", inverterType: "String Inverter", structureType: "GI Structure", structureSize: "4kW", meterBrand: "L&T", acCableBrand: "Polycab", acCableSize: "4 sq mm", dcCableBrand: "Polycab", dcCableSize: "4 sq mm", acdb: "Havells (1-Phase)", dcdb: "Havells (1-Phase)" },
  { systemType: "non-dcr", systemSize: "5kW", panelBrand: "Waaree", panelSize: "545W", inverterBrand: "XWatt", inverterSize: "5kW", inverterType: "String Inverter", structureType: "GI Structure", structureSize: "5kW", meterBrand: "L&T", acCableBrand: "Polycab", acCableSize: "4 sq mm", dcCableBrand: "Polycab", dcCableSize: "4 sq mm", acdb: "Havells (1-Phase)", dcdb: "Havells (1-Phase)" },
  { systemType: "non-dcr", systemSize: "6kW", panelBrand: "Waaree", panelSize: "545W", inverterBrand: "XWatt", inverterSize: "6kW", inverterType: "String Inverter", structureType: "GI Structure", structureSize: "6kW", meterBrand: "L&T", acCableBrand: "Polycab", acCableSize: "6 sq mm", dcCableBrand: "Polycab", dcCableSize: "4 sq mm", acdb: "Havells (1-Phase)", dcdb: "Havells (1-Phase)" },
  
  // Tata NON DCR 1-Phase
  { systemType: "non-dcr", systemSize: "3kW", panelBrand: "Tata", panelSize: "545W", inverterBrand: "GoodWe", inverterSize: "3kW", inverterType: "String Inverter", structureType: "GI Structure", structureSize: "3kW", meterBrand: "L&T", acCableBrand: "Polycab", acCableSize: "4 sq mm", dcCableBrand: "Polycab", dcCableSize: "4 sq mm", acdb: "Havells (1-Phase)", dcdb: "Havells (1-Phase)" },
  { systemType: "non-dcr", systemSize: "4kW", panelBrand: "Tata", panelSize: "545W", inverterBrand: "GoodWe", inverterSize: "5kW", inverterType: "String Inverter", structureType: "GI Structure", structureSize: "4kW", meterBrand: "L&T", acCableBrand: "Polycab", acCableSize: "4 sq mm", dcCableBrand: "Polycab", dcCableSize: "4 sq mm", acdb: "Havells (1-Phase)", dcdb: "Havells (1-Phase)" },
  { systemType: "non-dcr", systemSize: "5kW", panelBrand: "Tata", panelSize: "545W", inverterBrand: "GoodWe", inverterSize: "5kW", inverterType: "String Inverter", structureType: "GI Structure", structureSize: "5kW", meterBrand: "L&T", acCableBrand: "Polycab", acCableSize: "4 sq mm", dcCableBrand: "Polycab", dcCableSize: "4 sq mm", acdb: "Havells (1-Phase)", dcdb: "Havells (1-Phase)" },
  { systemType: "non-dcr", systemSize: "6kW", panelBrand: "Tata", panelSize: "545W", inverterBrand: "GoodWe", inverterSize: "6kW", inverterType: "String Inverter", structureType: "GI Structure", structureSize: "6kW", meterBrand: "L&T", acCableBrand: "Polycab", acCableSize: "6 sq mm", dcCableBrand: "Polycab", dcCableSize: "4 sq mm", acdb: "Havells (1-Phase)", dcdb: "Havells (1-Phase)" },
  
  // ========== NON DCR SYSTEMS (3-Phase) ==========
  // Adani NON DCR 3-Phase
  { systemType: "non-dcr", systemSize: "3kW", panelBrand: "Adani", panelSize: "545W", inverterBrand: "XWatt", inverterSize: "5kW", inverterType: "String Inverter", structureType: "GI Structure", structureSize: "3kW", meterBrand: "L&T", acCableBrand: "Polycab", acCableSize: "4 sq mm", dcCableBrand: "Polycab", dcCableSize: "4 sq mm", acdb: "Havells (3-Phase)", dcdb: "Havells (3-Phase)" },
  { systemType: "non-dcr", systemSize: "4kW", panelBrand: "Adani", panelSize: "545W", inverterBrand: "XWatt", inverterSize: "5kW", inverterType: "String Inverter", structureType: "GI Structure", structureSize: "4kW", meterBrand: "L&T", acCableBrand: "Polycab", acCableSize: "4 sq mm", dcCableBrand: "Polycab", dcCableSize: "4 sq mm", acdb: "Havells (3-Phase)", dcdb: "Havells (3-Phase)" },
  { systemType: "non-dcr", systemSize: "5kW", panelBrand: "Adani", panelSize: "545W", inverterBrand: "XWatt", inverterSize: "5kW", inverterType: "String Inverter", structureType: "GI Structure", structureSize: "5kW", meterBrand: "L&T", acCableBrand: "Polycab", acCableSize: "4 sq mm", dcCableBrand: "Polycab", dcCableSize: "4 sq mm", acdb: "Havells (3-Phase)", dcdb: "Havells (3-Phase)" },
  { systemType: "non-dcr", systemSize: "6kW", panelBrand: "Adani", panelSize: "545W", inverterBrand: "XWatt", inverterSize: "6kW", inverterType: "String Inverter", structureType: "GI Structure", structureSize: "6kW", meterBrand: "L&T", acCableBrand: "Polycab", acCableSize: "6 sq mm", dcCableBrand: "Polycab", dcCableSize: "4 sq mm", acdb: "Havells (3-Phase)", dcdb: "Havells (3-Phase)" },
  { systemType: "non-dcr", systemSize: "7kW", panelBrand: "Adani", panelSize: "545W", inverterBrand: "XWatt", inverterSize: "8kW", inverterType: "String Inverter", structureType: "GI Structure", structureSize: "7kW", meterBrand: "L&T", acCableBrand: "Polycab", acCableSize: "6 sq mm", dcCableBrand: "Polycab", dcCableSize: "6 sq mm", acdb: "Havells (3-Phase)", dcdb: "Havells (3-Phase)" },
  { systemType: "non-dcr", systemSize: "8kW", panelBrand: "Adani", panelSize: "545W", inverterBrand: "XWatt", inverterSize: "8kW", inverterType: "String Inverter", structureType: "GI Structure", structureSize: "8kW", meterBrand: "L&T", acCableBrand: "Polycab", acCableSize: "6 sq mm", dcCableBrand: "Polycab", dcCableSize: "6 sq mm", acdb: "Havells (3-Phase)", dcdb: "Havells (3-Phase)" },
  { systemType: "non-dcr", systemSize: "10kW", panelBrand: "Adani", panelSize: "545W", inverterBrand: "XWatt", inverterSize: "10kW", inverterType: "String Inverter", structureType: "GI Structure", structureSize: "10kW", meterBrand: "L&T", acCableBrand: "Polycab", acCableSize: "6 sq mm", dcCableBrand: "Polycab", dcCableSize: "6 sq mm", acdb: "Havells (3-Phase)", dcdb: "Havells (3-Phase)" },
  { systemType: "non-dcr", systemSize: "12kW", panelBrand: "Adani", panelSize: "545W", inverterBrand: "XWatt", inverterSize: "12kW", inverterType: "String Inverter", structureType: "GI Structure", structureSize: "12kW", meterBrand: "L&T", acCableBrand: "Polycab", acCableSize: "6 sq mm", dcCableBrand: "Polycab", dcCableSize: "6 sq mm", acdb: "Havells (3-Phase)", dcdb: "Havells (3-Phase)" },
  { systemType: "non-dcr", systemSize: "15kW", panelBrand: "Adani", panelSize: "545W", inverterBrand: "XWatt", inverterSize: "15kW", inverterType: "String Inverter", structureType: "GI Structure", structureSize: "15kW", meterBrand: "L&T", acCableBrand: "Polycab", acCableSize: "10 sq mm", dcCableBrand: "Polycab", dcCableSize: "6 sq mm", acdb: "Havells (3-Phase)", dcdb: "Havells (3-Phase)" },
  { systemType: "non-dcr", systemSize: "20kW", panelBrand: "Adani", panelSize: "545W", inverterBrand: "XWatt", inverterSize: "20kW", inverterType: "String Inverter", structureType: "GI Structure", structureSize: "20kW", meterBrand: "L&T", acCableBrand: "Polycab", acCableSize: "10 sq mm", dcCableBrand: "Polycab", dcCableSize: "10 sq mm", acdb: "Havells (3-Phase)", dcdb: "Havells (3-Phase)" },
  { systemType: "non-dcr", systemSize: "25kW", panelBrand: "Adani", panelSize: "545W", inverterBrand: "XWatt", inverterSize: "25kW", inverterType: "String Inverter", structureType: "GI Structure", structureSize: "25kW", meterBrand: "L&T", acCableBrand: "Polycab", acCableSize: "10 sq mm", dcCableBrand: "Polycab", dcCableSize: "10 sq mm", acdb: "Havells (3-Phase)", dcdb: "Havells (3-Phase)" },
  { systemType: "non-dcr", systemSize: "30kW", panelBrand: "Adani", panelSize: "545W", inverterBrand: "XWatt", inverterSize: "30kW", inverterType: "String Inverter", structureType: "GI Structure", structureSize: "30kW", meterBrand: "L&T", acCableBrand: "Polycab", acCableSize: "10 sq mm", dcCableBrand: "Polycab", dcCableSize: "10 sq mm", acdb: "Havells (3-Phase)", dcdb: "Havells (3-Phase)" },
  
  // Waaree NON DCR 3-Phase
  { systemType: "non-dcr", systemSize: "3kW", panelBrand: "Waaree", panelSize: "545W", inverterBrand: "XWatt", inverterSize: "5kW", inverterType: "String Inverter", structureType: "GI Structure", structureSize: "3kW", meterBrand: "L&T", acCableBrand: "Polycab", acCableSize: "4 sq mm", dcCableBrand: "Polycab", dcCableSize: "4 sq mm", acdb: "Havells (3-Phase)", dcdb: "Havells (3-Phase)" },
  { systemType: "non-dcr", systemSize: "4kW", panelBrand: "Waaree", panelSize: "545W", inverterBrand: "XWatt", inverterSize: "5kW", inverterType: "String Inverter", structureType: "GI Structure", structureSize: "4kW", meterBrand: "L&T", acCableBrand: "Polycab", acCableSize: "4 sq mm", dcCableBrand: "Polycab", dcCableSize: "4 sq mm", acdb: "Havells (3-Phase)", dcdb: "Havells (3-Phase)" },
  { systemType: "non-dcr", systemSize: "5kW", panelBrand: "Waaree", panelSize: "545W", inverterBrand: "XWatt", inverterSize: "5kW", inverterType: "String Inverter", structureType: "GI Structure", structureSize: "5kW", meterBrand: "L&T", acCableBrand: "Polycab", acCableSize: "4 sq mm", dcCableBrand: "Polycab", dcCableSize: "4 sq mm", acdb: "Havells (3-Phase)", dcdb: "Havells (3-Phase)" },
  { systemType: "non-dcr", systemSize: "6kW", panelBrand: "Waaree", panelSize: "545W", inverterBrand: "XWatt", inverterSize: "6kW", inverterType: "String Inverter", structureType: "GI Structure", structureSize: "6kW", meterBrand: "L&T", acCableBrand: "Polycab", acCableSize: "6 sq mm", dcCableBrand: "Polycab", dcCableSize: "4 sq mm", acdb: "Havells (3-Phase)", dcdb: "Havells (3-Phase)" },
  { systemType: "non-dcr", systemSize: "7kW", panelBrand: "Waaree", panelSize: "545W", inverterBrand: "XWatt", inverterSize: "8kW", inverterType: "String Inverter", structureType: "GI Structure", structureSize: "7kW", meterBrand: "L&T", acCableBrand: "Polycab", acCableSize: "6 sq mm", dcCableBrand: "Polycab", dcCableSize: "6 sq mm", acdb: "Havells (3-Phase)", dcdb: "Havells (3-Phase)" },
  { systemType: "non-dcr", systemSize: "8kW", panelBrand: "Waaree", panelSize: "545W", inverterBrand: "XWatt", inverterSize: "8kW", inverterType: "String Inverter", structureType: "GI Structure", structureSize: "8kW", meterBrand: "L&T", acCableBrand: "Polycab", acCableSize: "6 sq mm", dcCableBrand: "Polycab", dcCableSize: "6 sq mm", acdb: "Havells (3-Phase)", dcdb: "Havells (3-Phase)" },
  { systemType: "non-dcr", systemSize: "10kW", panelBrand: "Waaree", panelSize: "545W", inverterBrand: "XWatt", inverterSize: "10kW", inverterType: "String Inverter", structureType: "GI Structure", structureSize: "10kW", meterBrand: "L&T", acCableBrand: "Polycab", acCableSize: "6 sq mm", dcCableBrand: "Polycab", dcCableSize: "6 sq mm", acdb: "Havells (3-Phase)", dcdb: "Havells (3-Phase)" },
  { systemType: "non-dcr", systemSize: "12kW", panelBrand: "Waaree", panelSize: "545W", inverterBrand: "XWatt", inverterSize: "12kW", inverterType: "String Inverter", structureType: "GI Structure", structureSize: "12kW", meterBrand: "L&T", acCableBrand: "Polycab", acCableSize: "6 sq mm", dcCableBrand: "Polycab", dcCableSize: "6 sq mm", acdb: "Havells (3-Phase)", dcdb: "Havells (3-Phase)" },
  { systemType: "non-dcr", systemSize: "15kW", panelBrand: "Waaree", panelSize: "545W", inverterBrand: "XWatt", inverterSize: "15kW", inverterType: "String Inverter", structureType: "GI Structure", structureSize: "15kW", meterBrand: "L&T", acCableBrand: "Polycab", acCableSize: "10 sq mm", dcCableBrand: "Polycab", dcCableSize: "6 sq mm", acdb: "Havells (3-Phase)", dcdb: "Havells (3-Phase)" },
  { systemType: "non-dcr", systemSize: "20kW", panelBrand: "Waaree", panelSize: "545W", inverterBrand: "XWatt", inverterSize: "20kW", inverterType: "String Inverter", structureType: "GI Structure", structureSize: "20kW", meterBrand: "L&T", acCableBrand: "Polycab", acCableSize: "10 sq mm", dcCableBrand: "Polycab", dcCableSize: "10 sq mm", acdb: "Havells (3-Phase)", dcdb: "Havells (3-Phase)" },
  { systemType: "non-dcr", systemSize: "25kW", panelBrand: "Waaree", panelSize: "545W", inverterBrand: "XWatt", inverterSize: "25kW", inverterType: "String Inverter", structureType: "GI Structure", structureSize: "25kW", meterBrand: "L&T", acCableBrand: "Polycab", acCableSize: "10 sq mm", dcCableBrand: "Polycab", dcCableSize: "10 sq mm", acdb: "Havells (3-Phase)", dcdb: "Havells (3-Phase)" },
  { systemType: "non-dcr", systemSize: "30kW", panelBrand: "Waaree", panelSize: "545W", inverterBrand: "XWatt", inverterSize: "30kW", inverterType: "String Inverter", structureType: "GI Structure", structureSize: "30kW", meterBrand: "L&T", acCableBrand: "Polycab", acCableSize: "10 sq mm", dcCableBrand: "Polycab", dcCableSize: "10 sq mm", acdb: "Havells (3-Phase)", dcdb: "Havells (3-Phase)" },
  
  // Tata NON DCR 3-Phase
  { systemType: "non-dcr", systemSize: "3kW", panelBrand: "Tata", panelSize: "545W", inverterBrand: "GoodWe", inverterSize: "5kW", inverterType: "String Inverter", structureType: "GI Structure", structureSize: "3kW", meterBrand: "L&T", acCableBrand: "Polycab", acCableSize: "4 sq mm", dcCableBrand: "Polycab", dcCableSize: "4 sq mm", acdb: "Havells (3-Phase)", dcdb: "Havells (3-Phase)" },
  { systemType: "non-dcr", systemSize: "4kW", panelBrand: "Tata", panelSize: "545W", inverterBrand: "GoodWe", inverterSize: "5kW", inverterType: "String Inverter", structureType: "GI Structure", structureSize: "4kW", meterBrand: "L&T", acCableBrand: "Polycab", acCableSize: "4 sq mm", dcCableBrand: "Polycab", dcCableSize: "4 sq mm", acdb: "Havells (3-Phase)", dcdb: "Havells (3-Phase)" },
  { systemType: "non-dcr", systemSize: "5kW", panelBrand: "Tata", panelSize: "545W", inverterBrand: "GoodWe", inverterSize: "5kW", inverterType: "String Inverter", structureType: "GI Structure", structureSize: "5kW", meterBrand: "L&T", acCableBrand: "Polycab", acCableSize: "4 sq mm", dcCableBrand: "Polycab", dcCableSize: "4 sq mm", acdb: "Havells (3-Phase)", dcdb: "Havells (3-Phase)" },
  { systemType: "non-dcr", systemSize: "6kW", panelBrand: "Tata", panelSize: "545W", inverterBrand: "GoodWe", inverterSize: "6kW", inverterType: "String Inverter", structureType: "GI Structure", structureSize: "6kW", meterBrand: "L&T", acCableBrand: "Polycab", acCableSize: "6 sq mm", dcCableBrand: "Polycab", dcCableSize: "4 sq mm", acdb: "Havells (3-Phase)", dcdb: "Havells (3-Phase)" },
  { systemType: "non-dcr", systemSize: "7kW", panelBrand: "Tata", panelSize: "545W", inverterBrand: "GoodWe", inverterSize: "8kW", inverterType: "String Inverter", structureType: "GI Structure", structureSize: "7kW", meterBrand: "L&T", acCableBrand: "Polycab", acCableSize: "6 sq mm", dcCableBrand: "Polycab", dcCableSize: "6 sq mm", acdb: "Havells (3-Phase)", dcdb: "Havells (3-Phase)" },
  { systemType: "non-dcr", systemSize: "8kW", panelBrand: "Tata", panelSize: "545W", inverterBrand: "GoodWe", inverterSize: "8kW", inverterType: "String Inverter", structureType: "GI Structure", structureSize: "8kW", meterBrand: "L&T", acCableBrand: "Polycab", acCableSize: "6 sq mm", dcCableBrand: "Polycab", dcCableSize: "6 sq mm", acdb: "Havells (3-Phase)", dcdb: "Havells (3-Phase)" },
  { systemType: "non-dcr", systemSize: "10kW", panelBrand: "Tata", panelSize: "545W", inverterBrand: "GoodWe", inverterSize: "10kW", inverterType: "String Inverter", structureType: "GI Structure", structureSize: "10kW", meterBrand: "L&T", acCableBrand: "Polycab", acCableSize: "6 sq mm", dcCableBrand: "Polycab", dcCableSize: "6 sq mm", acdb: "Havells (3-Phase)", dcdb: "Havells (3-Phase)" },
  { systemType: "non-dcr", systemSize: "12kW", panelBrand: "Tata", panelSize: "545W", inverterBrand: "GoodWe", inverterSize: "12kW", inverterType: "String Inverter", structureType: "GI Structure", structureSize: "12kW", meterBrand: "L&T", acCableBrand: "Polycab", acCableSize: "6 sq mm", dcCableBrand: "Polycab", dcCableSize: "6 sq mm", acdb: "Havells (3-Phase)", dcdb: "Havells (3-Phase)" },
  { systemType: "non-dcr", systemSize: "15kW", panelBrand: "Tata", panelSize: "545W", inverterBrand: "GoodWe", inverterSize: "15kW", inverterType: "String Inverter", structureType: "GI Structure", structureSize: "15kW", meterBrand: "L&T", acCableBrand: "Polycab", acCableSize: "10 sq mm", dcCableBrand: "Polycab", dcCableSize: "6 sq mm", acdb: "Havells (3-Phase)", dcdb: "Havells (3-Phase)" },
  { systemType: "non-dcr", systemSize: "20kW", panelBrand: "Tata", panelSize: "545W", inverterBrand: "GoodWe", inverterSize: "20kW", inverterType: "String Inverter", structureType: "GI Structure", structureSize: "20kW", meterBrand: "L&T", acCableBrand: "Polycab", acCableSize: "10 sq mm", dcCableBrand: "Polycab", dcCableSize: "10 sq mm", acdb: "Havells (3-Phase)", dcdb: "Havells (3-Phase)" },
  { systemType: "non-dcr", systemSize: "25kW", panelBrand: "Tata", panelSize: "545W", inverterBrand: "GoodWe", inverterSize: "25kW", inverterType: "String Inverter", structureType: "GI Structure", structureSize: "25kW", meterBrand: "L&T", acCableBrand: "Polycab", acCableSize: "10 sq mm", dcCableBrand: "Polycab", dcCableSize: "10 sq mm", acdb: "Havells (3-Phase)", dcdb: "Havells (3-Phase)" },
  { systemType: "non-dcr", systemSize: "30kW", panelBrand: "Tata", panelSize: "545W", inverterBrand: "GoodWe", inverterSize: "30kW", inverterType: "String Inverter", structureType: "GI Structure", structureSize: "30kW", meterBrand: "L&T", acCableBrand: "Polycab", acCableSize: "10 sq mm", dcCableBrand: "Polycab", dcCableSize: "10 sq mm", acdb: "Havells (3-Phase)", dcdb: "Havells (3-Phase)" },
  
  // ========== BOTH SYSTEMS (DCR + NON DCR) - 3-Phase Only ==========
  // Adani BOTH 3-Phase
  { systemType: "both", systemSize: "5kW", panelBrand: "Adani", panelSize: "545W", inverterBrand: "XWatt", inverterSize: "5kW", inverterType: "String Inverter", structureType: "GI Structure", structureSize: "5kW", meterBrand: "L&T", acCableBrand: "Polycab", acCableSize: "4 sq mm", dcCableBrand: "Polycab", dcCableSize: "4 sq mm", acdb: "Havells (3-Phase)", dcdb: "Havells (3-Phase)" },
  { systemType: "both", systemSize: "6kW", panelBrand: "Adani", panelSize: "545W", inverterBrand: "XWatt", inverterSize: "6kW", inverterType: "String Inverter", structureType: "GI Structure", structureSize: "6kW", meterBrand: "L&T", acCableBrand: "Polycab", acCableSize: "6 sq mm", dcCableBrand: "Polycab", dcCableSize: "4 sq mm", acdb: "Havells (3-Phase)", dcdb: "Havells (3-Phase)" },
  { systemType: "both", systemSize: "8kW", panelBrand: "Adani", panelSize: "545W", inverterBrand: "XWatt", inverterSize: "8kW", inverterType: "String Inverter", structureType: "GI Structure", structureSize: "8kW", meterBrand: "L&T", acCableBrand: "Polycab", acCableSize: "6 sq mm", dcCableBrand: "Polycab", dcCableSize: "6 sq mm", acdb: "Havells (3-Phase)", dcdb: "Havells (3-Phase)" },
  { systemType: "both", systemSize: "10kW", panelBrand: "Adani", panelSize: "545W", inverterBrand: "XWatt", inverterSize: "10kW", inverterType: "String Inverter", structureType: "GI Structure", structureSize: "10kW", meterBrand: "L&T", acCableBrand: "Polycab", acCableSize: "6 sq mm", dcCableBrand: "Polycab", dcCableSize: "6 sq mm", acdb: "Havells (3-Phase)", dcdb: "Havells (3-Phase)" },
  { systemType: "both", systemSize: "12kW", panelBrand: "Adani", panelSize: "545W", inverterBrand: "XWatt", inverterSize: "12kW", inverterType: "String Inverter", structureType: "GI Structure", structureSize: "12kW", meterBrand: "L&T", acCableBrand: "Polycab", acCableSize: "6 sq mm", dcCableBrand: "Polycab", dcCableSize: "6 sq mm", acdb: "Havells (3-Phase)", dcdb: "Havells (3-Phase)" },
  { systemType: "both", systemSize: "15kW", panelBrand: "Adani", panelSize: "545W", inverterBrand: "XWatt", inverterSize: "15kW", inverterType: "String Inverter", structureType: "GI Structure", structureSize: "15kW", meterBrand: "L&T", acCableBrand: "Polycab", acCableSize: "10 sq mm", dcCableBrand: "Polycab", dcCableSize: "6 sq mm", acdb: "Havells (3-Phase)", dcdb: "Havells (3-Phase)" },
  { systemType: "both", systemSize: "20kW", panelBrand: "Adani", panelSize: "545W", inverterBrand: "XWatt", inverterSize: "20kW", inverterType: "String Inverter", structureType: "GI Structure", structureSize: "20kW", meterBrand: "L&T", acCableBrand: "Polycab", acCableSize: "10 sq mm", dcCableBrand: "Polycab", dcCableSize: "10 sq mm", acdb: "Havells (3-Phase)", dcdb: "Havells (3-Phase)" },
  { systemType: "both", systemSize: "25kW", panelBrand: "Adani", panelSize: "545W", inverterBrand: "XWatt", inverterSize: "25kW", inverterType: "String Inverter", structureType: "GI Structure", structureSize: "25kW", meterBrand: "L&T", acCableBrand: "Polycab", acCableSize: "10 sq mm", dcCableBrand: "Polycab", dcCableSize: "10 sq mm", acdb: "Havells (3-Phase)", dcdb: "Havells (3-Phase)" },
  { systemType: "both", systemSize: "30kW", panelBrand: "Adani", panelSize: "545W", inverterBrand: "XWatt", inverterSize: "30kW", inverterType: "String Inverter", structureType: "GI Structure", structureSize: "30kW", meterBrand: "L&T", acCableBrand: "Polycab", acCableSize: "10 sq mm", dcCableBrand: "Polycab", dcCableSize: "10 sq mm", acdb: "Havells (3-Phase)", dcdb: "Havells (3-Phase)" },
  
  // Waaree BOTH 3-Phase
  { systemType: "both", systemSize: "5kW", panelBrand: "Waaree", panelSize: "545W", inverterBrand: "XWatt", inverterSize: "5kW", inverterType: "String Inverter", structureType: "GI Structure", structureSize: "5kW", meterBrand: "L&T", acCableBrand: "Polycab", acCableSize: "4 sq mm", dcCableBrand: "Polycab", dcCableSize: "4 sq mm", acdb: "Havells (3-Phase)", dcdb: "Havells (3-Phase)" },
  { systemType: "both", systemSize: "6kW", panelBrand: "Waaree", panelSize: "545W", inverterBrand: "XWatt", inverterSize: "6kW", inverterType: "String Inverter", structureType: "GI Structure", structureSize: "6kW", meterBrand: "L&T", acCableBrand: "Polycab", acCableSize: "6 sq mm", dcCableBrand: "Polycab", dcCableSize: "4 sq mm", acdb: "Havells (3-Phase)", dcdb: "Havells (3-Phase)" },
  { systemType: "both", systemSize: "8kW", panelBrand: "Waaree", panelSize: "545W", inverterBrand: "XWatt", inverterSize: "8kW", inverterType: "String Inverter", structureType: "GI Structure", structureSize: "8kW", meterBrand: "L&T", acCableBrand: "Polycab", acCableSize: "6 sq mm", dcCableBrand: "Polycab", dcCableSize: "6 sq mm", acdb: "Havells (3-Phase)", dcdb: "Havells (3-Phase)" },
  { systemType: "both", systemSize: "10kW", panelBrand: "Waaree", panelSize: "545W", inverterBrand: "XWatt", inverterSize: "10kW", inverterType: "String Inverter", structureType: "GI Structure", structureSize: "10kW", meterBrand: "L&T", acCableBrand: "Polycab", acCableSize: "6 sq mm", dcCableBrand: "Polycab", dcCableSize: "6 sq mm", acdb: "Havells (3-Phase)", dcdb: "Havells (3-Phase)" },
  { systemType: "both", systemSize: "12kW", panelBrand: "Waaree", panelSize: "545W", inverterBrand: "XWatt", inverterSize: "12kW", inverterType: "String Inverter", structureType: "GI Structure", structureSize: "12kW", meterBrand: "L&T", acCableBrand: "Polycab", acCableSize: "6 sq mm", dcCableBrand: "Polycab", dcCableSize: "6 sq mm", acdb: "Havells (3-Phase)", dcdb: "Havells (3-Phase)" },
  { systemType: "both", systemSize: "15kW", panelBrand: "Waaree", panelSize: "545W", inverterBrand: "XWatt", inverterSize: "15kW", inverterType: "String Inverter", structureType: "GI Structure", structureSize: "15kW", meterBrand: "L&T", acCableBrand: "Polycab", acCableSize: "10 sq mm", dcCableBrand: "Polycab", dcCableSize: "6 sq mm", acdb: "Havells (3-Phase)", dcdb: "Havells (3-Phase)" },
  { systemType: "both", systemSize: "20kW", panelBrand: "Waaree", panelSize: "545W", inverterBrand: "XWatt", inverterSize: "20kW", inverterType: "String Inverter", structureType: "GI Structure", structureSize: "20kW", meterBrand: "L&T", acCableBrand: "Polycab", acCableSize: "10 sq mm", dcCableBrand: "Polycab", dcCableSize: "10 sq mm", acdb: "Havells (3-Phase)", dcdb: "Havells (3-Phase)" },
  { systemType: "both", systemSize: "25kW", panelBrand: "Waaree", panelSize: "545W", inverterBrand: "XWatt", inverterSize: "25kW", inverterType: "String Inverter", structureType: "GI Structure", structureSize: "25kW", meterBrand: "L&T", acCableBrand: "Polycab", acCableSize: "10 sq mm", dcCableBrand: "Polycab", dcCableSize: "10 sq mm", acdb: "Havells (3-Phase)", dcdb: "Havells (3-Phase)" },
  { systemType: "both", systemSize: "30kW", panelBrand: "Waaree", panelSize: "545W", inverterBrand: "XWatt", inverterSize: "30kW", inverterType: "String Inverter", structureType: "GI Structure", structureSize: "30kW", meterBrand: "L&T", acCableBrand: "Polycab", acCableSize: "10 sq mm", dcCableBrand: "Polycab", dcCableSize: "10 sq mm", acdb: "Havells (3-Phase)", dcdb: "Havells (3-Phase)" },
]

// Function to get current pricing data (API or fallback)
export function getPricingData(): PricingTablesData {
  return apiPricingData || {
    dcr: dcrPricing,
    nonDcr: nonDcrPricing,
    both: bothPricing,
    panels: defaultPanelPricing,
    inverters: defaultInverterPricing,
    structures: defaultStructurePricing,
    meters: defaultMeterPricing,
    cables: defaultCablePricing,
    acdb: defaultACDBPricing,
    dcdb: defaultDCDBPricing,
    systemConfigs: defaultSystemConfigs,
  }
}

// Function to get system configuration preset
// Returns default product selections for a given system type, size, and panel brand
export function getSystemConfiguration(
  systemType: "dcr" | "non-dcr" | "both",
  systemSize: string,
  panelBrand: string,
  pricingData?: PricingTablesData
): SystemConfigurationPreset | null {
  const data = pricingData || getPricingData()
  const configs = data.systemConfigs || defaultSystemConfigs
  
  // Try exact match first
  let config = configs.find(
    (c) => c.systemType === systemType && 
           c.systemSize === systemSize && 
           c.panelBrand === panelBrand
  )
  
  // If no exact match, try to find by system type and size (any panel brand)
  if (!config) {
    config = configs.find(
      (c) => c.systemType === systemType && c.systemSize === systemSize
    )
  }
  
  // If still no match, try to find by system type only
  if (!config) {
    config = configs.find((c) => c.systemType === systemType)
  }
  
  return config || null
}

// System Configuration Dropdown Option
export interface SystemConfigOption {
  id: string // Unique identifier for the config
  label: string // Display label for dropdown
  value: SystemConfigurationPreset // The actual configuration
}

// Function to get all available system configurations as dropdown options
// Returns formatted options that can be used in a Select component
export function getSystemConfigOptions(
  pricingData?: PricingTablesData
): SystemConfigOption[] {
  const data = pricingData || getPricingData()
  const configs = data.systemConfigs || defaultSystemConfigs
  
  return configs.map((config, index) => {
    // Create a readable label for the dropdown
    const systemTypeLabel = config.systemType === "dcr" 
      ? "DCR" 
      : config.systemType === "non-dcr" 
      ? "NON DCR" 
      : "BOTH"
    
    const label = `${systemTypeLabel} - ${config.systemSize} - ${config.panelBrand} (${config.panelSize}, ${config.inverterBrand} ${config.inverterSize})`
    
    return {
      id: `config-${config.systemType}-${config.systemSize}-${config.panelBrand}-${index}`,
      label,
      value: config,
    }
  })
}

// Function to get system configurations filtered by system type
export function getSystemConfigOptionsByType(
  systemType: "dcr" | "non-dcr" | "both",
  pricingData?: PricingTablesData
): SystemConfigOption[] {
  const allOptions = getSystemConfigOptions(pricingData)
  return allOptions.filter((option) => option.value.systemType === systemType)
}

// Function to get system configurations filtered by panel brand
export function getSystemConfigOptionsByBrand(
  panelBrand: string,
  pricingData?: PricingTablesData
): SystemConfigOption[] {
  const allOptions = getSystemConfigOptions(pricingData)
  return allOptions.filter((option) => option.value.panelBrand === panelBrand)
}

// Function to convert system configuration preset to ProductSelection format
// This can be used to auto-populate form fields
export function configToProductSelection(
  config: SystemConfigurationPreset,
  panelQuantity?: number
): Partial<import("./quotation-context").ProductSelection> {
  // Calculate panel quantity if not provided
  let calculatedQuantity = panelQuantity || 0
  if (calculatedQuantity === 0) {
    const systemKw = Number.parseFloat(config.systemSize.replace("kW", ""))
    const panelW = Number.parseFloat(config.panelSize.replace("W", ""))
    if (!Number.isNaN(systemKw) && !Number.isNaN(panelW) && panelW > 0) {
      calculatedQuantity = Math.ceil((systemKw * 1000) / panelW)
    }
  }
  
  return {
    systemType: config.systemType,
    panelBrand: config.panelBrand,
    panelSize: config.panelSize,
    panelQuantity: calculatedQuantity,
    inverterType: config.inverterType,
    inverterBrand: config.inverterBrand,
    inverterSize: config.inverterSize,
    structureType: config.structureType,
    structureSize: config.structureSize,
    meterBrand: config.meterBrand,
    acCableBrand: config.acCableBrand,
    acCableSize: config.acCableSize,
    dcCableBrand: config.dcCableBrand,
    dcCableSize: config.dcCableSize,
    acdb: config.acdb,
    dcdb: config.dcdb,
    // Include subsidies if present in config
    ...(config.centralSubsidy !== undefined && { centralSubsidy: config.centralSubsidy }),
    ...(config.stateSubsidy !== undefined && { stateSubsidy: config.stateSubsidy }),
  }
}

// Function to find system configuration by ID (from dropdown selection)
export function getSystemConfigById(
  configId: string,
  pricingData?: PricingTablesData
): SystemConfigurationPreset | null {
  const options = getSystemConfigOptions(pricingData)
  const option = options.find((opt) => opt.id === configId)
  return option ? option.value : null
}

// DCR System Pricing (With Subsidy - Adani and Waaree panels separated)
export const dcrPricing: SystemPricing[] = [
  // 1-Phase Systems
  { systemSize: "3kW", phase: "1-Phase", inverterSize: "3kW", panelType: "Adani", price: 185000 },
  { systemSize: "3kW", phase: "1-Phase", inverterSize: "3kW", panelType: "Waaree", price: 185000 },
  { systemSize: "3kW", phase: "1-Phase", inverterSize: "3kW", panelType: "Tata", price: 200000 },
  { systemSize: "4kW", phase: "1-Phase", inverterSize: "4kW", panelType: "Adani", price: 240000 },
  { systemSize: "4kW", phase: "1-Phase", inverterSize: "4kW", panelType: "Waaree", price: 240000 },
  { systemSize: "4kW", phase: "1-Phase", inverterSize: "4kW", panelType: "Tata", price: 260000 },
  { systemSize: "5kW", phase: "1-Phase", inverterSize: "5kW", panelType: "Adani", price: 300000 },
  { systemSize: "5kW", phase: "1-Phase", inverterSize: "5kW", panelType: "Waaree", price: 300000 },
  { systemSize: "5kW", phase: "1-Phase", inverterSize: "5kW", panelType: "Tata", price: 330000 },
  { systemSize: "6kW", phase: "1-Phase", inverterSize: "6kW", panelType: "Adani", price: 360000 },
  { systemSize: "6kW", phase: "1-Phase", inverterSize: "6kW", panelType: "Waaree", price: 360000 },
  { systemSize: "6kW", phase: "1-Phase", inverterSize: "6kW", panelType: "Tata", price: 400000 },
  
  // 3-Phase Systems
  { systemSize: "3kW", phase: "3-Phase", inverterSize: "5kW", panelType: "Adani", price: 200000 },
  { systemSize: "3kW", phase: "3-Phase", inverterSize: "5kW", panelType: "Waaree", price: 200000 },
  { systemSize: "3kW", phase: "3-Phase", inverterSize: "5kW", panelType: "Tata", price: 220000 },
  { systemSize: "4kW", phase: "3-Phase", inverterSize: "5kW", panelType: "Adani", price: 250000 },
  { systemSize: "4kW", phase: "3-Phase", inverterSize: "5kW", panelType: "Waaree", price: 250000 },
  { systemSize: "4kW", phase: "3-Phase", inverterSize: "5kW", panelType: "Tata", price: 280000 },
  { systemSize: "5kW", phase: "3-Phase", inverterSize: "5kW", panelType: "Adani", price: 280000 },
  { systemSize: "5kW", phase: "3-Phase", inverterSize: "5kW", panelType: "Waaree", price: 280000 },
  { systemSize: "5kW", phase: "3-Phase", inverterSize: "5kW", panelType: "Tata", price: 310000 },
  { systemSize: "6kW", phase: "3-Phase", inverterSize: "6kW", panelType: "Adani", price: 270000 },
  { systemSize: "6kW", phase: "3-Phase", inverterSize: "6kW", panelType: "Waaree", price: 270000 },
  { systemSize: "6kW", phase: "3-Phase", inverterSize: "6kW", panelType: "Tata", price: 310000 },
  { systemSize: "7kW", phase: "3-Phase", inverterSize: "8kW", panelType: "Adani", price: 320000 },
  { systemSize: "7kW", phase: "3-Phase", inverterSize: "8kW", panelType: "Waaree", price: 320000 },
  { systemSize: "7kW", phase: "3-Phase", inverterSize: "8kW", panelType: "Tata", price: 370000 },
  { systemSize: "8kW", phase: "3-Phase", inverterSize: "8kW", panelType: "Adani", price: 360000 },
  { systemSize: "8kW", phase: "3-Phase", inverterSize: "8kW", panelType: "Waaree", price: 360000 },
  { systemSize: "8kW", phase: "3-Phase", inverterSize: "8kW", panelType: "Tata", price: 410000 },
  { systemSize: "10kW", phase: "3-Phase", inverterSize: "10kW", panelType: "Adani", price: 460000 },
  { systemSize: "10kW", phase: "3-Phase", inverterSize: "10kW", panelType: "Waaree", price: 460000 },
  { systemSize: "10kW", phase: "3-Phase", inverterSize: "10kW", panelType: "Tata", price: 520000 },
  { systemSize: "12kW", phase: "3-Phase", inverterSize: "12kW", panelType: "Adani", price: 550000 },
  { systemSize: "12kW", phase: "3-Phase", inverterSize: "12kW", panelType: "Waaree", price: 550000 },
  { systemSize: "12kW", phase: "3-Phase", inverterSize: "12kW", panelType: "Tata", price: 620000 },
  { systemSize: "15kW", phase: "3-Phase", inverterSize: "15kW", panelType: "Adani", price: 690000 },
  { systemSize: "15kW", phase: "3-Phase", inverterSize: "15kW", panelType: "Waaree", price: 690000 },
  { systemSize: "15kW", phase: "3-Phase", inverterSize: "15kW", panelType: "Tata", price: 780000 },
  { systemSize: "20kW", phase: "3-Phase", inverterSize: "20kW", panelType: "Adani", price: 920000 },
  { systemSize: "20kW", phase: "3-Phase", inverterSize: "20kW", panelType: "Waaree", price: 920000 },
  { systemSize: "20kW", phase: "3-Phase", inverterSize: "20kW", panelType: "Tata", price: 1040000 },
  { systemSize: "25kW", phase: "3-Phase", inverterSize: "25kW", panelType: "Adani", price: 1150000 },
  { systemSize: "25kW", phase: "3-Phase", inverterSize: "25kW", panelType: "Waaree", price: 1150000 },
  { systemSize: "25kW", phase: "3-Phase", inverterSize: "25kW", panelType: "Tata", price: 1300000 },
  { systemSize: "30kW", phase: "3-Phase", inverterSize: "30kW", panelType: "Adani", price: 1380000 },
  { systemSize: "30kW", phase: "3-Phase", inverterSize: "30kW", panelType: "Waaree", price: 1380000 },
  { systemSize: "30kW", phase: "3-Phase", inverterSize: "30kW", panelType: "Tata", price: 1560000 },
]

// NON DCR System Pricing (Without Subsidy - Adani and Waaree panels separated)
export const nonDcrPricing: SystemPricing[] = [
  // 1-Phase Systems
  { systemSize: "3kW", phase: "1-Phase", inverterSize: "3kW", panelType: "Adani", price: 200000 },
  { systemSize: "3kW", phase: "1-Phase", inverterSize: "3kW", panelType: "Waaree", price: 200000 },
  { systemSize: "3kW", phase: "1-Phase", inverterSize: "3kW", panelType: "Tata", price: 220000 },
  { systemSize: "4kW", phase: "1-Phase", inverterSize: "4kW", panelType: "Adani", price: 260000 },
  { systemSize: "4kW", phase: "1-Phase", inverterSize: "4kW", panelType: "Waaree", price: 260000 },
  { systemSize: "4kW", phase: "1-Phase", inverterSize: "4kW", panelType: "Tata", price: 290000 },
  { systemSize: "5kW", phase: "1-Phase", inverterSize: "5kW", panelType: "Adani", price: 320000 },
  { systemSize: "5kW", phase: "1-Phase", inverterSize: "5kW", panelType: "Waaree", price: 320000 },
  { systemSize: "5kW", phase: "1-Phase", inverterSize: "5kW", panelType: "Tata", price: 360000 },
  { systemSize: "6kW", phase: "1-Phase", inverterSize: "6kW", panelType: "Adani", price: 380000 },
  { systemSize: "6kW", phase: "1-Phase", inverterSize: "6kW", panelType: "Waaree", price: 380000 },
  { systemSize: "6kW", phase: "1-Phase", inverterSize: "6kW", panelType: "Tata", price: 430000 },
  
  // 3-Phase Systems
  { systemSize: "3kW", phase: "3-Phase", inverterSize: "5kW", panelType: "Adani", price: 220000 },
  { systemSize: "3kW", phase: "3-Phase", inverterSize: "5kW", panelType: "Waaree", price: 220000 },
  { systemSize: "3kW", phase: "3-Phase", inverterSize: "5kW", panelType: "Tata", price: 250000 },
  { systemSize: "4kW", phase: "3-Phase", inverterSize: "5kW", panelType: "Adani", price: 270000 },
  { systemSize: "4kW", phase: "3-Phase", inverterSize: "5kW", panelType: "Waaree", price: 270000 },
  { systemSize: "4kW", phase: "3-Phase", inverterSize: "5kW", panelType: "Tata", price: 310000 },
  { systemSize: "5kW", phase: "3-Phase", inverterSize: "5kW", panelType: "Adani", price: 300000 },
  { systemSize: "5kW", phase: "3-Phase", inverterSize: "5kW", panelType: "Waaree", price: 300000 },
  { systemSize: "5kW", phase: "3-Phase", inverterSize: "5kW", panelType: "Tata", price: 340000 },
  { systemSize: "6kW", phase: "3-Phase", inverterSize: "6kW", panelType: "Adani", price: 360000 },
  { systemSize: "6kW", phase: "3-Phase", inverterSize: "6kW", panelType: "Waaree", price: 360000 },
  { systemSize: "6kW", phase: "3-Phase", inverterSize: "6kW", panelType: "Tata", price: 410000 },
  { systemSize: "7kW", phase: "3-Phase", inverterSize: "8kW", panelType: "Adani", price: 420000 },
  { systemSize: "7kW", phase: "3-Phase", inverterSize: "8kW", panelType: "Waaree", price: 420000 },
  { systemSize: "7kW", phase: "3-Phase", inverterSize: "8kW", panelType: "Tata", price: 480000 },
  { systemSize: "8kW", phase: "3-Phase", inverterSize: "8kW", panelType: "Adani", price: 480000 },
  { systemSize: "8kW", phase: "3-Phase", inverterSize: "8kW", panelType: "Waaree", price: 480000 },
  { systemSize: "8kW", phase: "3-Phase", inverterSize: "8kW", panelType: "Tata", price: 550000 },
  { systemSize: "10kW", phase: "3-Phase", inverterSize: "10kW", panelType: "Adani", price: 600000 },
  { systemSize: "10kW", phase: "3-Phase", inverterSize: "10kW", panelType: "Waaree", price: 600000 },
  { systemSize: "10kW", phase: "3-Phase", inverterSize: "10kW", panelType: "Tata", price: 680000 },
  { systemSize: "12kW", phase: "3-Phase", inverterSize: "12kW", panelType: "Adani", price: 720000 },
  { systemSize: "12kW", phase: "3-Phase", inverterSize: "12kW", panelType: "Waaree", price: 720000 },
  { systemSize: "12kW", phase: "3-Phase", inverterSize: "12kW", panelType: "Tata", price: 820000 },
  { systemSize: "15kW", phase: "3-Phase", inverterSize: "15kW", panelType: "Adani", price: 900000 },
  { systemSize: "15kW", phase: "3-Phase", inverterSize: "15kW", panelType: "Waaree", price: 900000 },
  { systemSize: "15kW", phase: "3-Phase", inverterSize: "15kW", panelType: "Tata", price: 1020000 },
  { systemSize: "20kW", phase: "3-Phase", inverterSize: "20kW", panelType: "Adani", price: 1200000 },
  { systemSize: "20kW", phase: "3-Phase", inverterSize: "20kW", panelType: "Waaree", price: 1200000 },
  { systemSize: "20kW", phase: "3-Phase", inverterSize: "20kW", panelType: "Tata", price: 1360000 },
  { systemSize: "25kW", phase: "3-Phase", inverterSize: "25kW", panelType: "Adani", price: 1500000 },
  { systemSize: "25kW", phase: "3-Phase", inverterSize: "25kW", panelType: "Waaree", price: 1500000 },
  { systemSize: "25kW", phase: "3-Phase", inverterSize: "25kW", panelType: "Tata", price: 1700000 },
  { systemSize: "30kW", phase: "3-Phase", inverterSize: "30kW", panelType: "Adani", price: 1800000 },
  { systemSize: "30kW", phase: "3-Phase", inverterSize: "30kW", panelType: "Waaree", price: 1800000 },
  { systemSize: "30kW", phase: "3-Phase", inverterSize: "30kW", panelType: "Tata", price: 2040000 },
]

// BOTH (DCR + NON DCR) System Pricing
// Format: "XkW (DCR) + YkW (Non DCR)" = Total System Size
export interface BothSystemPricing {
  systemSize: string
  phase: "1-Phase" | "3-Phase"
  inverterSize: string
  dcrCapacity: string // e.g., "3kW"
  nonDcrCapacity: string // e.g., "2kW"
  panelType: string
  price: number
}

export const bothPricing: BothSystemPricing[] = [
  // 3-Phase Systems (BOTH typically uses 3kW DCR + variable Non DCR) - Adani and Waaree separated
  { systemSize: "5kW", phase: "3-Phase", inverterSize: "5kW", dcrCapacity: "3kW", nonDcrCapacity: "2kW", panelType: "Adani", price: 260000 },
  { systemSize: "5kW", phase: "3-Phase", inverterSize: "5kW", dcrCapacity: "3kW", nonDcrCapacity: "2kW", panelType: "Waaree", price: 260000 },
  { systemSize: "6kW", phase: "3-Phase", inverterSize: "6kW", dcrCapacity: "3kW", nonDcrCapacity: "3kW", panelType: "Adani", price: 300000 },
  { systemSize: "6kW", phase: "3-Phase", inverterSize: "6kW", dcrCapacity: "3kW", nonDcrCapacity: "3kW", panelType: "Waaree", price: 300000 },
  { systemSize: "8kW", phase: "3-Phase", inverterSize: "8kW", dcrCapacity: "3kW", nonDcrCapacity: "5kW", panelType: "Adani", price: 360000 },
  { systemSize: "8kW", phase: "3-Phase", inverterSize: "8kW", dcrCapacity: "3kW", nonDcrCapacity: "5kW", panelType: "Waaree", price: 360000 },
  { systemSize: "10kW", phase: "3-Phase", inverterSize: "10kW", dcrCapacity: "3kW", nonDcrCapacity: "7kW", panelType: "Adani", price: 410000 },
  { systemSize: "10kW", phase: "3-Phase", inverterSize: "10kW", dcrCapacity: "3kW", nonDcrCapacity: "7kW", panelType: "Waaree", price: 410000 },
  { systemSize: "12kW", phase: "3-Phase", inverterSize: "12kW", dcrCapacity: "3kW", nonDcrCapacity: "9kW", panelType: "Adani", price: 470000 },
  { systemSize: "12kW", phase: "3-Phase", inverterSize: "12kW", dcrCapacity: "3kW", nonDcrCapacity: "9kW", panelType: "Waaree", price: 470000 },
  { systemSize: "15kW", phase: "3-Phase", inverterSize: "15kW", dcrCapacity: "3kW", nonDcrCapacity: "12kW", panelType: "Adani", price: 580000 },
  { systemSize: "15kW", phase: "3-Phase", inverterSize: "15kW", dcrCapacity: "3kW", nonDcrCapacity: "12kW", panelType: "Waaree", price: 580000 },
  { systemSize: "20kW", phase: "3-Phase", inverterSize: "20kW", dcrCapacity: "3kW", nonDcrCapacity: "17kW", panelType: "Adani", price: 770000 },
  { systemSize: "20kW", phase: "3-Phase", inverterSize: "20kW", dcrCapacity: "3kW", nonDcrCapacity: "17kW", panelType: "Waaree", price: 770000 },
  { systemSize: "25kW", phase: "3-Phase", inverterSize: "25kW", dcrCapacity: "3kW", nonDcrCapacity: "22kW", panelType: "Adani", price: 960000 },
  { systemSize: "25kW", phase: "3-Phase", inverterSize: "25kW", dcrCapacity: "3kW", nonDcrCapacity: "22kW", panelType: "Waaree", price: 960000 },
  { systemSize: "30kW", phase: "3-Phase", inverterSize: "30kW", dcrCapacity: "3kW", nonDcrCapacity: "27kW", panelType: "Adani", price: 1150000 },
  { systemSize: "30kW", phase: "3-Phase", inverterSize: "30kW", dcrCapacity: "3kW", nonDcrCapacity: "27kW", panelType: "Waaree", price: 1150000 },
]

// Helper function to get DCR pricing
// Uses API data if available, otherwise falls back to hardcoded values
export function getDcrPrice(
  systemSize: string,
  phase: "1-Phase" | "3-Phase",
  inverterSize: string,
  panelBrand: string,
  pricingData?: PricingTablesData
): number | null {
  // Use provided pricing data, API data, or fallback to hardcoded
  const data = pricingData || getPricingData()
  const pricingTable = data.dcr || dcrPricing
  
  // Use panel brand directly (Adani, Waaree, or Tata)
  // If brand is not in pricing table, try to find closest match
  let panelType = panelBrand
  
  // Map panel brands to pricing table types
  if (panelBrand !== "Tata" && panelBrand !== "Adani" && panelBrand !== "Waaree") {
    // Default to Adani for unknown brands (legacy support)
    panelType = "Adani"
  }
  
  const pricing = pricingTable.find(
    (p) =>
      p.systemSize === systemSize &&
      p.phase === phase &&
      p.inverterSize === inverterSize &&
      p.panelType === panelType
  )
  
  return pricing ? pricing.price : null
}

// Helper function to get NON DCR pricing
// Uses API data if available, otherwise falls back to hardcoded values
export function getNonDcrPrice(
  systemSize: string,
  phase: "1-Phase" | "3-Phase",
  inverterSize: string,
  panelBrand: string,
  pricingData?: PricingTablesData
): number | null {
  // Use provided pricing data, API data, or fallback to hardcoded
  const data = pricingData || getPricingData()
  const pricingTable = data.nonDcr || nonDcrPricing
  
  // Use panel brand directly (Adani, Waaree, or Tata)
  // If brand is not in pricing table, try to find closest match
  let panelType = panelBrand
  
  // Map panel brands to pricing table types
  if (panelBrand !== "Tata" && panelBrand !== "Adani" && panelBrand !== "Waaree") {
    // Default to Adani for unknown brands (legacy support)
    panelType = "Adani"
  }
  
  const pricing = pricingTable.find(
    (p) =>
      p.systemSize === systemSize &&
      p.phase === phase &&
      p.inverterSize === inverterSize &&
      p.panelType === panelType
  )
  
  return pricing ? pricing.price : null
}

// Helper function to get BOTH (DCR + NON DCR) pricing
// Uses API data if available, otherwise falls back to hardcoded values
export function getBothPrice(
  systemSize: string,
  phase: "1-Phase" | "3-Phase",
  inverterSize: string,
  dcrCapacity: string,
  nonDcrCapacity: string,
  panelBrand: string,
  pricingData?: PricingTablesData
): number | null {
  // Use provided pricing data, API data, or fallback to hardcoded
  const data = pricingData || getPricingData()
  const pricingTable = data.both || bothPricing
  
  // Use panel brand directly (Adani, Waaree, or Tata)
  // If brand is not in pricing table, try to find closest match
  let panelType = panelBrand
  
  // Map panel brands to pricing table types
  if (panelBrand !== "Tata" && panelBrand !== "Adani" && panelBrand !== "Waaree") {
    // Default to Adani for unknown brands (legacy support)
    panelType = "Adani"
  }
  
  const pricing = pricingTable.find(
    (p) =>
      p.systemSize === systemSize &&
      p.phase === phase &&
      p.inverterSize === inverterSize &&
      p.dcrCapacity === dcrCapacity &&
      p.nonDcrCapacity === nonDcrCapacity &&
      p.panelType === panelType
  )
  
  return pricing ? pricing.price : null
}

// Helper function to determine phase from system size and inverter
// Can optionally check pricing tables for exact phase match
export function determinePhase(
  systemSize: string, 
  inverterSize: string,
  pricingData?: PricingTablesData
): "1-Phase" | "3-Phase" {
  const systemKw = Number.parseInt(systemSize.replace("kW", ""))
  const inverterKw = Number.parseInt(inverterSize.replace("kW", ""))
  
  // If pricing data is available, check for exact match first
  if (pricingData) {
    // Check DCR pricing
    const dcrMatch = pricingData.dcr?.find(
      (p) => p.systemSize === systemSize && p.inverterSize === inverterSize
    )
    if (dcrMatch) {
      return dcrMatch.phase
    }
    
    // Check NON DCR pricing
    const nonDcrMatch = pricingData.nonDcr?.find(
      (p) => p.systemSize === systemSize && p.inverterSize === inverterSize
    )
    if (nonDcrMatch) {
      return nonDcrMatch.phase
    }
    
    // Check BOTH pricing (BOTH systems are always 3-Phase)
    const bothMatch = pricingData.both?.find(
      (p) => p.systemSize === systemSize && p.inverterSize === inverterSize
    )
    if (bothMatch) {
      return "3-Phase" // BOTH systems are always 3-Phase
    }
  }
  
  // Fallback logic: Systems 7kW and above are typically 3-Phase
  // Also if inverter is larger than system, it's likely 3-Phase
  // For 3-6kW systems: if inverter matches system size exactly, it's likely 1-Phase
  // If inverter is larger (e.g., 3kW system with 5kW inverter), it's 3-Phase
  if (systemKw >= 7) {
    return "3-Phase"
  }
  
  if (inverterKw > systemKw) {
    return "3-Phase"
  }
  
  // For 3-6kW systems where inverter matches system size, default to 1-Phase
  // But this could also be 3-Phase, so we check pricing tables if available
  if (systemKw >= 3 && systemKw <= 6 && inverterKw === systemKw) {
    // Default to 1-Phase, but this should ideally come from pricing tables
    return "1-Phase"
  }
  
  // Default to 1-Phase for smaller systems
  return "1-Phase"
}

// Helper function to calculate system size from panel configuration
export function calculateSystemSize(
  panelSize: string | undefined | null,
  panelQuantity: number | undefined | null
): string {
  // Handle undefined/null values
  if (!panelSize || !panelQuantity || panelQuantity <= 0) {
    return "0kW"
  }
  
  try {
    const sizeW = Number.parseInt(panelSize.replace("W", ""))
    if (Number.isNaN(sizeW) || sizeW <= 0) {
      return "0kW"
    }
    const totalW = sizeW * panelQuantity
    const totalKw = totalW / 1000
    return `${totalKw}kW`
  } catch (error) {
    console.error("Error calculating system size:", error)
    return "0kW"
  }
}

// Component Pricing Helper Functions
// These functions use API data if available, otherwise fall back to hardcoded values

export function getPanelPrice(
  brand: string,
  size: string,
  pricingData?: PricingTablesData
): number {
  // Handle null/undefined/empty values
  if (!brand || !size) {
    console.warn(`[getPanelPrice] Missing brand or size. Brand: ${brand}, Size: ${size}`)
    return 0
  }

  const data = pricingData || getPricingData()
  const pricingTable = data.panels || defaultPanelPricing
  
  // Try exact match first
  let pricing = pricingTable.find(
    (p) => p.brand === brand && p.size === size
  )
  
  // If no exact match, try to find by brand and calculate based on size
  if (!pricing) {
    const brandPricing = pricingTable.find((p) => p.brand === brand)
    if (brandPricing && brandPricing.size) {
      const baseSize = Number.parseInt(brandPricing.size.replace("W", ""))
      const targetSize = Number.parseInt(size.replace("W", ""))
      if (!Number.isNaN(baseSize) && !Number.isNaN(targetSize) && baseSize > 0 && targetSize > 0) {
        return (brandPricing.price * targetSize) / baseSize
      }
    }
  }
  
  // Fallback to default calculation if no pricing found
  if (!pricing) {
    const basePrices: Record<string, number> = {
      Adani: 25000,
      Tata: 26000,
      Waaree: 24000,
      "Vikram Solar": 24500,
      RenewSys: 23500,
    }
    // Safely parse size, default to 440W if invalid
    const sizeValue = Number.parseInt(size.replace("W", ""))
    if (Number.isNaN(sizeValue) || sizeValue <= 0) {
      console.warn(`[getPanelPrice] Invalid size value: ${size}, using default 440W`)
      return basePrices[brand] || 24000
    }
    const sizeMultiplier = sizeValue / 440
    return (basePrices[brand] || 24000) * sizeMultiplier
  }
  
  return pricing.price
}

export function getInverterPrice(
  brand: string,
  size: string,
  pricingData?: PricingTablesData
): number {
  // Handle null/undefined/empty values
  if (!brand || !size) {
    console.warn(`[getInverterPrice] Missing brand or size. Brand: ${brand}, Size: ${size}`)
    return 0
  }

  const data = pricingData || getPricingData()
  const pricingTable = data.inverters || defaultInverterPricing
  
  // Try exact match first
  const pricing = pricingTable.find(
    (p) => p.brand === brand && p.size === size
  )
  
  // If no exact match, try to interpolate based on size
  if (!pricing) {
    const brandPricings = pricingTable.filter((p) => p.brand === brand).sort((a, b) => {
      const aSize = Number.parseInt(a.size?.replace("kW", "") || "0")
      const bSize = Number.parseInt(b.size?.replace("kW", "") || "0")
      return aSize - bSize
    })
    
    if (brandPricings.length > 0) {
      const targetSize = Number.parseInt(size.replace("kW", ""))
      if (!Number.isNaN(targetSize) && targetSize > 0) {
        const closest = brandPricings.reduce((prev, curr) => {
          const prevSize = Number.parseInt(prev.size?.replace("kW", "") || "0")
          const currSize = Number.parseInt(curr.size?.replace("kW", "") || "0")
          return Math.abs(currSize - targetSize) < Math.abs(prevSize - targetSize) ? curr : prev
        })
        
        const closestSize = Number.parseInt(closest.size?.replace("kW", "") || "0")
        if (!Number.isNaN(closestSize) && closestSize > 0) {
          return (closest.price * targetSize) / closestSize
        }
      }
    }
  }
  
  // Fallback to default calculation
  if (!pricing) {
    const basePrices: Record<string, number> = {
      Growatt: 35000,
      Solis: 32000,
      Fronius: 45000,
      Havells: 38000,
      Polycab: 36000,
      Delta: 40000,
    }
    const sizeKw = Number.parseInt(size.replace("kW", ""))
    if (Number.isNaN(sizeKw) || sizeKw <= 0) {
      console.warn(`[getInverterPrice] Invalid size value: ${size}, using default 3kW`)
      return basePrices[brand] || 35000
    }
    return (basePrices[brand] || 35000) * (sizeKw / 3)
  }
  
  return pricing.price
}

export function getStructurePrice(
  type: string,
  size: string,
  pricingData?: PricingTablesData
): number {
  // Handle null/undefined/empty values
  if (!type || !size) {
    console.warn(`[getStructurePrice] Missing type or size. Type: ${type}, Size: ${size}`)
    return 0
  }

  const data = pricingData || getPricingData()
  const pricingTable = data.structures || defaultStructurePricing
  
  // Try exact match first
  let pricing = pricingTable.find(
    (p) => p.type === type && p.size === size
  )
  
  // If no exact match, calculate based on size (price per kW)
  if (!pricing) {
    const typePricing = pricingTable.find((p) => p.type === type)
    if (typePricing && typePricing.size) {
      const baseSize = Number.parseInt(typePricing.size.replace("kW", ""))
      const targetSize = Number.parseInt(size.replace("kW", ""))
      if (!Number.isNaN(baseSize) && !Number.isNaN(targetSize) && baseSize > 0 && targetSize > 0) {
        return (typePricing.price * targetSize) / baseSize
      }
    }
  }
  
  // Fallback to default calculation (8000 per kW)
  if (!pricing) {
    const sizeKw = Number.parseInt(size.replace("kW", ""))
    if (Number.isNaN(sizeKw) || sizeKw <= 0) {
      console.warn(`[getStructurePrice] Invalid size value: ${size}, returning 0`)
      return 0
    }
    return sizeKw * 8000
  }
  
  return pricing.price
}

export function getMeterPrice(
  brand: string,
  pricingData?: PricingTablesData
): number {
  const data = pricingData || getPricingData()
  const pricingTable = data.meters || defaultMeterPricing
  
  const pricing = pricingTable.find((p) => p.brand === brand)
  
  // Fallback to default price
  return pricing?.price || 5000
}

export function getCablePrice(
  brand: string,
  size: string,
  type: "AC" | "DC",
  pricingData?: PricingTablesData
): number {
  const data = pricingData || getPricingData()
  const pricingTable = data.cables || defaultCablePricing
  
  // Try exact match first
  let pricing = pricingTable.find(
    (p) => p.brand === brand && p.size === size && p.type === type
  )
  
  // If no exact match, try to find by brand and type
  if (!pricing) {
    pricing = pricingTable.find((p) => p.brand === brand && p.type === type)
  }
  
  // Fallback to default price
  return pricing?.price || 3000
}

// Helper function to get ACDB options filtered by phase
export function getACDBOptions(
  phase: "1-Phase" | "3-Phase",
  pricingData?: PricingTablesData
): ACDBPricing[] {
  const data = pricingData || getPricingData()
  const pricingTable = data.acdb || defaultACDBPricing
  
  return pricingTable.filter((p) => p.phase === phase)
}

// Helper function to get DCDB options filtered by phase
export function getDCDBOptions(
  phase: "1-Phase" | "3-Phase",
  pricingData?: PricingTablesData
): DCDBPricing[] {
  const data = pricingData || getPricingData()
  const pricingTable = data.dcdb || defaultDCDBPricing
  
  return pricingTable.filter((p) => p.phase === phase)
}

// Helper function to format ACDB/DCDB option for display
export function formatACDBOption(brand: string, phase: "1-Phase" | "3-Phase"): string {
  return `${brand} (${phase})`
}

// Helper function to format DCDB option for display
export function formatDCDBOption(brand: string, phase: "1-Phase" | "3-Phase"): string {
  return `${brand} (${phase})`
}

// Helper function to parse ACDB/DCDB option string
export function parseACDBOption(option: string): { brand: string; phase: "1-Phase" | "3-Phase" } | null {
  const match = option.match(/^(.+?)\s*\((.+?)\)$/)
  if (match) {
    const brand = match[1].trim()
    const phase = match[2].trim() as "1-Phase" | "3-Phase"
    if (phase === "1-Phase" || phase === "3-Phase") {
      return { brand, phase }
    }
  }
  return null
}

export function getACDBPrice(
  brand: string,
  phase: "1-Phase" | "3-Phase",
  pricingData?: PricingTablesData
): number {
  const data = pricingData || getPricingData()
  const pricingTable = data.acdb || defaultACDBPricing
  
  const pricing = pricingTable.find((p) => p.brand === brand && p.phase === phase)
  
  // Fallback to default price
  return pricing?.price || 2500
}

export function getDCDBPrice(
  brand: string,
  phase: "1-Phase" | "3-Phase",
  pricingData?: PricingTablesData
): number {
  const data = pricingData || getPricingData()
  const pricingTable = data.dcdb || defaultDCDBPricing
  
  const pricing = pricingTable.find((p) => p.brand === brand && p.phase === phase)
  
  // Fallback to default price
  return pricing?.price || 2500
}


