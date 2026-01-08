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
// Comprehensive list of panel sizes available in the market
export const defaultPanelPricing: PanelPricing[] = [
  // Adani panels - full range
  { brand: "Adani", size: "320W", price: 18000 },
  { brand: "Adani", size: "330W", price: 18500 },
  { brand: "Adani", size: "340W", price: 19000 },
  { brand: "Adani", size: "350W", price: 19500 },
  { brand: "Adani", size: "360W", price: 20000 },
  { brand: "Adani", size: "370W", price: 20500 },
  { brand: "Adani", size: "380W", price: 21000 },
  { brand: "Adani", size: "390W", price: 21500 },
  { brand: "Adani", size: "400W", price: 22000 },
  { brand: "Adani", size: "410W", price: 22500 },
  { brand: "Adani", size: "420W", price: 23000 },
  { brand: "Adani", size: "430W", price: 23500 },
  { brand: "Adani", size: "440W", price: 25000 },
  { brand: "Adani", size: "445W", price: 25500 },
  { brand: "Adani", size: "450W", price: 26000 },
  { brand: "Adani", size: "455W", price: 26500 },
  { brand: "Adani", size: "460W", price: 27000 },
  { brand: "Adani", size: "470W", price: 27500 },
  { brand: "Adani", size: "480W", price: 28000 },
  { brand: "Adani", size: "490W", price: 28500 },
  { brand: "Adani", size: "500W", price: 29000 },
  { brand: "Adani", size: "510W", price: 29500 },
  { brand: "Adani", size: "520W", price: 30000 },
  { brand: "Adani", size: "530W", price: 30500 },
  { brand: "Adani", size: "540W", price: 30800 },
  { brand: "Adani", size: "545W", price: 31000 },
  { brand: "Adani", size: "550W", price: 31200 },
  { brand: "Adani", size: "555W", price: 31500 },
  { brand: "Adani", size: "560W", price: 31800 },
  { brand: "Adani", size: "570W", price: 32200 },
  { brand: "Adani", size: "580W", price: 32600 },
  { brand: "Adani", size: "590W", price: 33000 },
  { brand: "Adani", size: "600W", price: 33500 },
  { brand: "Adani", size: "610W", price: 34000 },
  { brand: "Adani", size: "620W", price: 35000 },
  { brand: "Adani", size: "630W", price: 36000 },
  { brand: "Adani", size: "640W", price: 37000 },
  { brand: "Adani", size: "650W", price: 38000 },
  { brand: "Adani", size: "660W", price: 39000 },
  { brand: "Adani", size: "670W", price: 40000 },
  { brand: "Adani", size: "680W", price: 41000 },
  { brand: "Adani", size: "690W", price: 42000 },
  { brand: "Adani", size: "700W", price: 43000 },
  { brand: "Adani", size: "720W", price: 45000 },
  { brand: "Adani", size: "750W", price: 48000 },

  // Tata panels - full range
  { brand: "Tata", size: "320W", price: 19000 },
  { brand: "Tata", size: "330W", price: 19500 },
  { brand: "Tata", size: "340W", price: 20000 },
  { brand: "Tata", size: "350W", price: 20500 },
  { brand: "Tata", size: "360W", price: 21000 },
  { brand: "Tata", size: "370W", price: 21500 },
  { brand: "Tata", size: "380W", price: 22000 },
  { brand: "Tata", size: "390W", price: 22500 },
  { brand: "Tata", size: "400W", price: 23000 },
  { brand: "Tata", size: "410W", price: 23500 },
  { brand: "Tata", size: "420W", price: 24000 },
  { brand: "Tata", size: "430W", price: 24500 },
  { brand: "Tata", size: "440W", price: 26000 },
  { brand: "Tata", size: "445W", price: 26500 },
  { brand: "Tata", size: "450W", price: 27000 },
  { brand: "Tata", size: "455W", price: 27500 },
  { brand: "Tata", size: "460W", price: 28000 },
  { brand: "Tata", size: "470W", price: 28500 },
  { brand: "Tata", size: "480W", price: 29000 },
  { brand: "Tata", size: "490W", price: 29500 },
  { brand: "Tata", size: "500W", price: 30000 },
  { brand: "Tata", size: "510W", price: 30500 },
  { brand: "Tata", size: "520W", price: 31000 },
  { brand: "Tata", size: "530W", price: 31500 },
  { brand: "Tata", size: "540W", price: 31800 },
  { brand: "Tata", size: "545W", price: 32000 },
  { brand: "Tata", size: "550W", price: 32200 },
  { brand: "Tata", size: "555W", price: 32500 },
  { brand: "Tata", size: "560W", price: 32800 },
  { brand: "Tata", size: "570W", price: 33200 },
  { brand: "Tata", size: "580W", price: 33600 },
  { brand: "Tata", size: "590W", price: 34000 },
  { brand: "Tata", size: "600W", price: 34500 },
  { brand: "Tata", size: "610W", price: 35000 },
  { brand: "Tata", size: "620W", price: 36000 },
  { brand: "Tata", size: "630W", price: 37000 },
  { brand: "Tata", size: "640W", price: 38000 },
  { brand: "Tata", size: "650W", price: 39000 },
  { brand: "Tata", size: "660W", price: 40000 },
  { brand: "Tata", size: "670W", price: 41000 },
  { brand: "Tata", size: "680W", price: 42000 },
  { brand: "Tata", size: "690W", price: 43000 },
  { brand: "Tata", size: "700W", price: 44000 },
  { brand: "Tata", size: "720W", price: 46000 },
  { brand: "Tata", size: "750W", price: 49000 },

  // Waaree panels - full range
  { brand: "Waaree", size: "320W", price: 17500 },
  { brand: "Waaree", size: "330W", price: 18000 },
  { brand: "Waaree", size: "340W", price: 18500 },
  { brand: "Waaree", size: "350W", price: 19000 },
  { brand: "Waaree", size: "360W", price: 19500 },
  { brand: "Waaree", size: "370W", price: 20000 },
  { brand: "Waaree", size: "380W", price: 20500 },
  { brand: "Waaree", size: "390W", price: 21000 },
  { brand: "Waaree", size: "400W", price: 21500 },
  { brand: "Waaree", size: "410W", price: 22000 },
  { brand: "Waaree", size: "420W", price: 22500 },
  { brand: "Waaree", size: "430W", price: 23000 },
  { brand: "Waaree", size: "440W", price: 24000 },
  { brand: "Waaree", size: "445W", price: 24500 },
  { brand: "Waaree", size: "450W", price: 25000 },
  { brand: "Waaree", size: "455W", price: 25500 },
  { brand: "Waaree", size: "460W", price: 26000 },
  { brand: "Waaree", size: "470W", price: 26500 },
  { brand: "Waaree", size: "480W", price: 27000 },
  { brand: "Waaree", size: "490W", price: 27500 },
  { brand: "Waaree", size: "500W", price: 28000 },
  { brand: "Waaree", size: "510W", price: 28500 },
  { brand: "Waaree", size: "520W", price: 29000 },
  { brand: "Waaree", size: "530W", price: 29500 },
  { brand: "Waaree", size: "540W", price: 29800 },
  { brand: "Waaree", size: "545W", price: 30000 },
  { brand: "Waaree", size: "550W", price: 30200 },
  { brand: "Waaree", size: "555W", price: 30500 },
  { brand: "Waaree", size: "560W", price: 30800 },
  { brand: "Waaree", size: "570W", price: 31200 },
  { brand: "Waaree", size: "580W", price: 31600 },
  { brand: "Waaree", size: "590W", price: 32000 },
  { brand: "Waaree", size: "600W", price: 32500 },
  { brand: "Waaree", size: "610W", price: 33000 },
  { brand: "Waaree", size: "620W", price: 34000 },
  { brand: "Waaree", size: "630W", price: 35000 },
  { brand: "Waaree", size: "640W", price: 36000 },
  { brand: "Waaree", size: "650W", price: 37000 },
  { brand: "Waaree", size: "660W", price: 38000 },
  { brand: "Waaree", size: "670W", price: 39000 },
  { brand: "Waaree", size: "680W", price: 40000 },
  { brand: "Waaree", size: "690W", price: 41000 },
  { brand: "Waaree", size: "700W", price: 42000 },
  { brand: "Waaree", size: "720W", price: 44000 },
  { brand: "Waaree", size: "750W", price: 47000 },

  // Vikram Solar panels - full range
  { brand: "Vikram Solar", size: "320W", price: 18000 },
  { brand: "Vikram Solar", size: "330W", price: 18500 },
  { brand: "Vikram Solar", size: "340W", price: 19000 },
  { brand: "Vikram Solar", size: "350W", price: 19500 },
  { brand: "Vikram Solar", size: "360W", price: 20000 },
  { brand: "Vikram Solar", size: "370W", price: 20500 },
  { brand: "Vikram Solar", size: "380W", price: 21000 },
  { brand: "Vikram Solar", size: "390W", price: 21500 },
  { brand: "Vikram Solar", size: "400W", price: 22000 },
  { brand: "Vikram Solar", size: "410W", price: 22500 },
  { brand: "Vikram Solar", size: "420W", price: 23000 },
  { brand: "Vikram Solar", size: "430W", price: 23500 },
  { brand: "Vikram Solar", size: "440W", price: 24500 },
  { brand: "Vikram Solar", size: "445W", price: 25000 },
  { brand: "Vikram Solar", size: "450W", price: 25500 },
  { brand: "Vikram Solar", size: "455W", price: 26000 },
  { brand: "Vikram Solar", size: "460W", price: 26500 },
  { brand: "Vikram Solar", size: "470W", price: 27000 },
  { brand: "Vikram Solar", size: "480W", price: 27500 },
  { brand: "Vikram Solar", size: "490W", price: 28000 },
  { brand: "Vikram Solar", size: "500W", price: 28500 },
  { brand: "Vikram Solar", size: "510W", price: 29000 },
  { brand: "Vikram Solar", size: "520W", price: 29500 },
  { brand: "Vikram Solar", size: "530W", price: 30000 },
  { brand: "Vikram Solar", size: "540W", price: 30300 },
  { brand: "Vikram Solar", size: "545W", price: 30500 },
  { brand: "Vikram Solar", size: "550W", price: 30700 },
  { brand: "Vikram Solar", size: "555W", price: 31000 },
  { brand: "Vikram Solar", size: "560W", price: 31300 },
  { brand: "Vikram Solar", size: "570W", price: 31700 },
  { brand: "Vikram Solar", size: "580W", price: 32100 },
  { brand: "Vikram Solar", size: "590W", price: 32500 },
  { brand: "Vikram Solar", size: "600W", price: 33000 },
  { brand: "Vikram Solar", size: "610W", price: 33500 },
  { brand: "Vikram Solar", size: "620W", price: 34500 },
  { brand: "Vikram Solar", size: "630W", price: 35500 },
  { brand: "Vikram Solar", size: "640W", price: 36500 },
  { brand: "Vikram Solar", size: "650W", price: 37500 },
  { brand: "Vikram Solar", size: "660W", price: 38500 },
  { brand: "Vikram Solar", size: "670W", price: 39500 },
  { brand: "Vikram Solar", size: "680W", price: 40500 },
  { brand: "Vikram Solar", size: "690W", price: 41500 },
  { brand: "Vikram Solar", size: "700W", price: 42500 },
  { brand: "Vikram Solar", size: "720W", price: 44500 },
  { brand: "Vikram Solar", size: "750W", price: 47500 },

  // RenewSys panels - full range
  { brand: "RenewSys", size: "320W", price: 17000 },
  { brand: "RenewSys", size: "330W", price: 17500 },
  { brand: "RenewSys", size: "340W", price: 18000 },
  { brand: "RenewSys", size: "350W", price: 18500 },
  { brand: "RenewSys", size: "360W", price: 19000 },
  { brand: "RenewSys", size: "370W", price: 19500 },
  { brand: "RenewSys", size: "380W", price: 20000 },
  { brand: "RenewSys", size: "390W", price: 20500 },
  { brand: "RenewSys", size: "400W", price: 21000 },
  { brand: "RenewSys", size: "410W", price: 21500 },
  { brand: "RenewSys", size: "420W", price: 22000 },
  { brand: "RenewSys", size: "430W", price: 22500 },
  { brand: "RenewSys", size: "440W", price: 23500 },
  { brand: "RenewSys", size: "445W", price: 24000 },
  { brand: "RenewSys", size: "450W", price: 24500 },
  { brand: "RenewSys", size: "455W", price: 25000 },
  { brand: "RenewSys", size: "460W", price: 25500 },
  { brand: "RenewSys", size: "470W", price: 26000 },
  { brand: "RenewSys", size: "480W", price: 26500 },
  { brand: "RenewSys", size: "490W", price: 27000 },
  { brand: "RenewSys", size: "500W", price: 27500 },
  { brand: "RenewSys", size: "510W", price: 28000 },
  { brand: "RenewSys", size: "520W", price: 28500 },
  { brand: "RenewSys", size: "530W", price: 29000 },
  { brand: "RenewSys", size: "540W", price: 29300 },
  { brand: "RenewSys", size: "545W", price: 29500 },
  { brand: "RenewSys", size: "550W", price: 29700 },
  { brand: "RenewSys", size: "555W", price: 30000 },
  { brand: "RenewSys", size: "560W", price: 30300 },
  { brand: "RenewSys", size: "570W", price: 30700 },
  { brand: "RenewSys", size: "580W", price: 31100 },
  { brand: "RenewSys", size: "590W", price: 31500 },
  { brand: "RenewSys", size: "600W", price: 32000 },
  { brand: "RenewSys", size: "610W", price: 32500 },
  { brand: "RenewSys", size: "620W", price: 33500 },
  { brand: "RenewSys", size: "630W", price: 34500 },
  { brand: "RenewSys", size: "640W", price: 35500 },
  { brand: "RenewSys", size: "650W", price: 36500 },
  { brand: "RenewSys", size: "660W", price: 37500 },
  { brand: "RenewSys", size: "670W", price: 38500 },
  { brand: "RenewSys", size: "680W", price: 39500 },
  { brand: "RenewSys", size: "690W", price: 40500 },
  { brand: "RenewSys", size: "700W", price: 41500 },
  { brand: "RenewSys", size: "720W", price: 43500 },
  { brand: "RenewSys", size: "750W", price: 46500 },
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
  { systemSize: "4kW", phase: "1-Phase", inverterSize: "4kW", panelType: "Adani", price: 230000 },
  { systemSize: "4kW", phase: "1-Phase", inverterSize: "4kW", panelType: "Waaree", price: 230000 },
  { systemSize: "5kW", phase: "1-Phase", inverterSize: "5kW", panelType: "Adani", price: 265000 },
  { systemSize: "5kW", phase: "1-Phase", inverterSize: "5kW", panelType: "Waaree", price: 265000 },
  { systemSize: "5kW", phase: "1-Phase", inverterSize: "5kW", panelType: "Tata", price: 285000 },
  { systemSize: "6kW", phase: "1-Phase", inverterSize: "6kW", panelType: "Adani", price: 290000 },
  { systemSize: "6kW", phase: "1-Phase", inverterSize: "6kW", panelType: "Waaree", price: 290000 },
  { systemSize: "6kW", phase: "1-Phase", inverterSize: "6kW", panelType: "Tata", price: 330000 },
  
  // 3-Phase Systems
  { systemSize: "3kW", phase: "3-Phase", inverterSize: "5kW", panelType: "Adani", price: 215000 },
  { systemSize: "3kW", phase: "3-Phase", inverterSize: "5kW", panelType: "Waaree", price: 215000 },
  { systemSize: "3kW", phase: "3-Phase", inverterSize: "5kW", panelType: "Tata", price: 265000 },
  { systemSize: "4kW", phase: "3-Phase", inverterSize: "5kW", panelType: "Adani", price: 255000 },
  { systemSize: "4kW", phase: "3-Phase", inverterSize: "5kW", panelType: "Waaree", price: 255000 },
  { systemSize: "5kW", phase: "3-Phase", inverterSize: "5kW", panelType: "Adani", price: 280000 },
  { systemSize: "5kW", phase: "3-Phase", inverterSize: "5kW", panelType: "Waaree", price: 280000 },
  { systemSize: "5kW", phase: "3-Phase", inverterSize: "5kW", panelType: "Tata", price: 310000 },
  { systemSize: "6kW", phase: "3-Phase", inverterSize: "6kW", panelType: "Adani", price: 320000 },
  { systemSize: "6kW", phase: "3-Phase", inverterSize: "6kW", panelType: "Waaree", price: 320000 },
  { systemSize: "6kW", phase: "3-Phase", inverterSize: "6kW", panelType: "Tata", price: 355000 },
  { systemSize: "7kW", phase: "3-Phase", inverterSize: "8kW", panelType: "Adani", price: 360000 },
  { systemSize: "7kW", phase: "3-Phase", inverterSize: "8kW", panelType: "Waaree", price: 360000 },
  { systemSize: "8kW", phase: "3-Phase", inverterSize: "8kW", panelType: "Adani", price: 400000 },
  { systemSize: "8kW", phase: "3-Phase", inverterSize: "8kW", panelType: "Waaree", price: 400000 },
  { systemSize: "8kW", phase: "3-Phase", inverterSize: "8kW", panelType: "Tata", price: 450000 },
  { systemSize: "10kW", phase: "3-Phase", inverterSize: "10kW", panelType: "Adani", price: 460000 },
  { systemSize: "10kW", phase: "3-Phase", inverterSize: "10kW", panelType: "Waaree", price: 460000 },
  { systemSize: "10kW", phase: "3-Phase", inverterSize: "10kW", panelType: "Tata", price: 520000 },
]

// NON DCR System Pricing (Without Subsidy - Adani and Waaree panels separated)
export const nonDcrPricing: SystemPricing[] = [
  // 1-Phase Systems
  { systemSize: "3kW", phase: "1-Phase", inverterSize: "3kW", panelType: "Adani", price: 140000 },
  { systemSize: "3kW", phase: "1-Phase", inverterSize: "3kW", panelType: "Waaree", price: 140000 },
  { systemSize: "5kW", phase: "1-Phase", inverterSize: "5kW", panelType: "Adani", price: 215000 },
  { systemSize: "5kW", phase: "1-Phase", inverterSize: "5kW", panelType: "Waaree", price: 215000 },
  { systemSize: "6kW", phase: "1-Phase", inverterSize: "6kW", panelType: "Adani", price: 230000 },
  { systemSize: "6kW", phase: "1-Phase", inverterSize: "6kW", panelType: "Waaree", price: 230000 },
  
  // 3-Phase Systems
  { systemSize: "3kW", phase: "3-Phase", inverterSize: "5kW", panelType: "Adani", price: 175000 },
  { systemSize: "3kW", phase: "3-Phase", inverterSize: "5kW", panelType: "Waaree", price: 175000 },
  { systemSize: "5kW", phase: "3-Phase", inverterSize: "5kW", panelType: "Adani", price: 240000 },
  { systemSize: "5kW", phase: "3-Phase", inverterSize: "5kW", panelType: "Waaree", price: 240000 },
  { systemSize: "6kW", phase: "3-Phase", inverterSize: "6kW", panelType: "Adani", price: 270000 },
  { systemSize: "6kW", phase: "3-Phase", inverterSize: "6kW", panelType: "Waaree", price: 270000 },
  { systemSize: "6kW", phase: "3-Phase", inverterSize: "6kW", panelType: "Tata", price: 310000 },
  { systemSize: "7kW", phase: "3-Phase", inverterSize: "8kW", panelType: "Adani", price: 290000 },
  { systemSize: "7kW", phase: "3-Phase", inverterSize: "8kW", panelType: "Waaree", price: 290000 },
  { systemSize: "8kW", phase: "3-Phase", inverterSize: "8kW", panelType: "Adani", price: 310000 },
  { systemSize: "8kW", phase: "3-Phase", inverterSize: "8kW", panelType: "Waaree", price: 310000 },
  { systemSize: "8kW", phase: "3-Phase", inverterSize: "8kW", panelType: "Tata", price: 380000 },
  { systemSize: "10kW", phase: "3-Phase", inverterSize: "10kW", panelType: "Adani", price: 380000 },
  { systemSize: "10kW", phase: "3-Phase", inverterSize: "10kW", panelType: "Waaree", price: 380000 },
  { systemSize: "10kW", phase: "3-Phase", inverterSize: "10kW", panelType: "Tata", price: 450000 },
  { systemSize: "12kW", phase: "3-Phase", inverterSize: "12kW", panelType: "Adani", price: 440000 },
  { systemSize: "12kW", phase: "3-Phase", inverterSize: "12kW", panelType: "Waaree", price: 440000 },
  { systemSize: "12kW", phase: "3-Phase", inverterSize: "12kW", panelType: "Tata", price: 510000 },
  { systemSize: "15kW", phase: "3-Phase", inverterSize: "15kW", panelType: "Adani", price: 550000 },
  { systemSize: "15kW", phase: "3-Phase", inverterSize: "15kW", panelType: "Waaree", price: 550000 },
  { systemSize: "15kW", phase: "3-Phase", inverterSize: "15kW", panelType: "Tata", price: 610000 },
  { systemSize: "20kW", phase: "3-Phase", inverterSize: "20kW", panelType: "Adani", price: 680000 },
  { systemSize: "20kW", phase: "3-Phase", inverterSize: "20kW", panelType: "Waaree", price: 680000 },
  { systemSize: "20kW", phase: "3-Phase", inverterSize: "20kW", panelType: "Tata", price: 780000 },
  { systemSize: "25kW", phase: "3-Phase", inverterSize: "25kW", panelType: "Adani", price: 820000 },
  { systemSize: "25kW", phase: "3-Phase", inverterSize: "25kW", panelType: "Waaree", price: 820000 },
  { systemSize: "25kW", phase: "3-Phase", inverterSize: "25kW", panelType: "Tata", price: 910000 },
  { systemSize: "30kW", phase: "3-Phase", inverterSize: "30kW", panelType: "Adani", price: 970000 },
  { systemSize: "30kW", phase: "3-Phase", inverterSize: "30kW", panelType: "Waaree", price: 970000 },
  { systemSize: "30kW", phase: "3-Phase", inverterSize: "30kW", panelType: "Tata", price: 1070000 },
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


