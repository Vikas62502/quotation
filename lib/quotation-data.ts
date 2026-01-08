// Solar Panel Brands
export const panelBrands = ["Adani", "Tata", "Waaree", "Vikram Solar", "RenewSys"]

// Inverter Types and Brands
export const inverterTypes = ["String Inverter", "Micro Inverter", "Hybrid Inverter"]
export const inverterBrands = ["Growatt", "Solis", "Fronius", "Havells", "Polycab", "Delta"]

// Panel Sizes (in watts)
export const panelSizes = ["440W", "445W", "540W", "545W", "550W", "555W"]

// Inverter Sizes (in kW)
export const inverterSizes = ["3kW", "5kW", "6kW", "8kW", "10kW", "12kW", "15kW", "20kW", "25kW", "30kW", "50kW", "100kW"]

// Structure Types and Sizes
export const structureTypes = ["GI Structure", "Aluminum Structure", "MS Structure"]
export const structureSizes = ["1kW", "2kW", "3kW", "5kW", "10kW", "15kW", "20kW"]

// Meter Brands
export const meterBrands = ["L&T", "HPL", "Havells", "Genus", "Secure"]

// Cable Brands
export const cableBrands = ["Polycab", "Havells", "KEI", "Finolex", "RR Kabel"]

// Cable Sizes (sq mm)
export const cableSizes = ["4 sq mm", "6 sq mm", "10 sq mm", "16 sq mm", "25 sq mm"]

// ACDB/DCDB Options
export const acdbOptions = ["1-String", "2-String", "3-String", "4-String"]
export const dcdbOptions = ["1-String", "2-String", "3-String", "4-String", "5-String"]

// Government IDs
export const governmentIds = ["Aadhaar Card", "PAN Card", "Voter ID", "Passport", "Driving License"]

// System Types
export const systemTypes = [
  { id: "dcr", name: "DCR", description: "DCR panels - Eligible for subsidy" },
  { id: "non-dcr", name: "NON DCR", description: "Non-DCR panels - No subsidy eligibility" },
  { id: "both", name: "BOTH (DCR + NON DCR)", description: "Mixed panel configuration" },
  // CUSTOMIZE option commented out - users should use pre-configured systems
  // { id: "customize", name: "CUSTOMIZE", description: "Custom configuration" },
]

// Indian States
export const indianStates = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  "Delhi",
  "Jammu & Kashmir",
]

// Subsidy Rates (example rates)
export const centralSubsidyRates = {
  "1kW": 30000,
  "2kW": 60000,
  "3kW": 78000,
  "4kW": 78000,
  "5kW": 78000,
  "10kW": 78000,
}

export const stateSubsidyRates: Record<string, number> = {
  Gujarat: 10000,
  Maharashtra: 15000,
  Rajasthan: 12000,
  Karnataka: 20000,
  "Tamil Nadu": 18000,
}
