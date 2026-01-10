import type { Dealer, Visitor, AccountManager } from "./auth-context"
import type { Quotation, Customer, ProductSelection } from "./quotation-context"

// Dummy Dealers (for login testing)
export const dummyDealers: (Dealer & { password: string })[] = [
  {
    id: "dealer-001",
    username: "demo",
    password: "demo123",
    firstName: "Rajesh",
    lastName: "Kumar",
    mobile: "9876543210",
    email: "rajesh.kumar@solardealer.com",
    gender: "Male",
    dateOfBirth: "1985-06-15",
    fatherName: "Suresh Kumar",
    fatherContact: "9876543211",
    governmentIdType: "Aadhaar Card",
    governmentIdNumber: "1234-5678-9012",
    address: {
      street: "123, Solar Complex, MG Road",
      city: "Ahmedabad",
      state: "Gujarat",
      pincode: "380001",
    },
  },
  {
    id: "dealer-002",
    username: "admin",
    password: "admin123",
    firstName: "Priya",
    lastName: "Sharma",
    mobile: "9988776655",
    email: "priya.sharma@greenenergy.com",
    gender: "Female",
    dateOfBirth: "1990-03-22",
    fatherName: "Ramesh Sharma",
    fatherContact: "9988776656",
    governmentIdType: "PAN Card",
    governmentIdNumber: "ABCDE1234F",
    address: {
      street: "456, Green Tower, Ring Road",
      city: "Jaipur",
      state: "Rajasthan",
      pincode: "302001",
    },
  },
  {
    id: "dealer-003",
    username: "testuser",
    password: "test123",
    firstName: "Amit",
    lastName: "Patel",
    mobile: "8765432109",
    email: "amit.patel@sunpower.in",
    gender: "Male",
    dateOfBirth: "1988-11-08",
    fatherName: "Mahesh Patel",
    fatherContact: "8765432110",
    governmentIdType: "Voter ID",
    governmentIdNumber: "GJ/01/123/456789",
    address: {
      street: "789, Industrial Area, Phase 2",
      city: "Surat",
      state: "Gujarat",
      pincode: "395003",
    },
  },
]

// Dummy Customers
export const dummyCustomers: Customer[] = [
  {
    firstName: "Vikram",
    lastName: "Singh",
    mobile: "9123456780",
    email: "vikram.singh@gmail.com",
    address: {
      street: "12, Lakshmi Nagar",
      city: "Mumbai",
      state: "Maharashtra",
      pincode: "400001",
    },
  },
  {
    firstName: "Anita",
    lastName: "Desai",
    mobile: "9234567891",
    email: "anita.desai@yahoo.com",
    address: {
      street: "45, Green Park Colony",
      city: "Pune",
      state: "Maharashtra",
      pincode: "411001",
    },
  },
  {
    firstName: "Mohan",
    lastName: "Reddy",
    mobile: "9345678902",
    email: "mohan.reddy@outlook.com",
    address: {
      street: "78, Jubilee Hills",
      city: "Hyderabad",
      state: "Telangana",
      pincode: "500033",
    },
  },
  {
    firstName: "Sunita",
    lastName: "Verma",
    mobile: "9456789013",
    email: "sunita.verma@gmail.com",
    address: {
      street: "23, Civil Lines",
      city: "Jaipur",
      state: "Rajasthan",
      pincode: "302006",
    },
  },
  {
    firstName: "Karthik",
    lastName: "Nair",
    mobile: "9567890124",
    email: "karthik.nair@gmail.com",
    address: {
      street: "56, Marine Drive",
      city: "Kochi",
      state: "Kerala",
      pincode: "682001",
    },
  },
  {
    firstName: "Deepak",
    lastName: "Gupta",
    mobile: "9678901235",
    email: "deepak.gupta@company.com",
    address: {
      street: "89, Sector 15",
      city: "Gurugram",
      state: "Haryana",
      pincode: "122001",
    },
  },
  {
    firstName: "Lakshmi",
    lastName: "Iyer",
    mobile: "9789012346",
    email: "lakshmi.iyer@email.com",
    address: {
      street: "34, Anna Nagar",
      city: "Chennai",
      state: "Tamil Nadu",
      pincode: "600040",
    },
  },
  {
    firstName: "Rahul",
    lastName: "Joshi",
    mobile: "9890123457",
    email: "rahul.joshi@mail.com",
    address: {
      street: "67, Model Town",
      city: "Lucknow",
      state: "Uttar Pradesh",
      pincode: "226001",
    },
  },
]

// Dummy Product Selections
const dummyProducts: ProductSelection[] = [
  {
    systemType: "dcr",
    panelBrand: "Adani",
    panelSize: "545W",
    panelQuantity: 10,
    inverterType: "String Inverter",
    inverterBrand: "Growatt",
    inverterSize: "5kW",
    structureType: "GI Structure",
    structureSize: "5kW",
    meterBrand: "L&T",
    acCableBrand: "Polycab",
    acCableSize: "6 sq mm",
    dcCableBrand: "Havells",
    dcCableSize: "4 sq mm",
    acdb: "2-String",
    dcdb: "2-String",
    centralSubsidy: 78000,
    stateSubsidy: 10000,
  },
  {
    systemType: "non-dcr",
    panelBrand: "Tata",
    panelSize: "550W",
    panelQuantity: 8,
    inverterType: "String Inverter",
    inverterBrand: "Solis",
    inverterSize: "3kW",
    structureType: "Aluminum Structure",
    structureSize: "3kW",
    meterBrand: "Havells",
    acCableBrand: "KEI",
    acCableSize: "4 sq mm",
    dcCableBrand: "Polycab",
    dcCableSize: "4 sq mm",
    acdb: "1-String",
    dcdb: "2-String",
  },
  {
    systemType: "hybrid",
    panelBrand: "Waaree",
    panelSize: "540W",
    panelQuantity: 12,
    inverterType: "Hybrid Inverter",
    inverterBrand: "Growatt",
    inverterSize: "6kW",
    structureType: "GI Structure",
    structureSize: "5kW",
    meterBrand: "Genus",
    acCableBrand: "Polycab",
    acCableSize: "10 sq mm",
    dcCableBrand: "Havells",
    dcCableSize: "6 sq mm",
    acdb: "2-String",
    dcdb: "3-String",
    hybridInverter: "Growatt SPH 6000",
    batteryCapacity: "10kWh",
    batteryPrice: 85000,
  },
  {
    systemType: "dcr",
    panelBrand: "Vikram Solar",
    panelSize: "555W",
    panelQuantity: 20,
    inverterType: "String Inverter",
    inverterBrand: "Fronius",
    inverterSize: "10kW",
    structureType: "MS Structure",
    structureSize: "10kW",
    meterBrand: "L&T",
    acCableBrand: "Finolex",
    acCableSize: "16 sq mm",
    dcCableBrand: "KEI",
    dcCableSize: "10 sq mm",
    acdb: "3-String",
    dcdb: "4-String",
    centralSubsidy: 78000,
    stateSubsidy: 15000,
  },
  {
    systemType: "both",
    panelBrand: "Adani",
    panelSize: "545W",
    panelQuantity: 15,
    inverterType: "String Inverter",
    inverterBrand: "Delta",
    inverterSize: "8kW",
    structureType: "Aluminum Structure",
    structureSize: "10kW",
    meterBrand: "HPL",
    acCableBrand: "RR Kabel",
    acCableSize: "10 sq mm",
    dcCableBrand: "Polycab",
    dcCableSize: "6 sq mm",
    acdb: "2-String",
    dcdb: "3-String",
  },
]

// Generate dummy quotations
export function generateDummyQuotations(): Quotation[] {
  const quotations: Quotation[] = []
  const now = new Date()

  // Generate quotations for each dealer
  dummyDealers.forEach((dealer, dealerIndex) => {
    // Assign 2-4 quotations per dealer
    const numQuotations = 2 + (dealerIndex % 3)

    for (let i = 0; i < numQuotations; i++) {
      const customerIndex = (dealerIndex * 3 + i) % dummyCustomers.length
      const productIndex = (dealerIndex + i) % dummyProducts.length

      // Generate dates spread across current and previous month
      const daysAgo = Math.floor(Math.random() * 45)
      const quotationDate = new Date(now)
      quotationDate.setDate(quotationDate.getDate() - daysAgo)

      const products = dummyProducts[productIndex]
      const panelPrice = Number.parseInt(products.panelSize) * products.panelQuantity * 25
      const inverterPrice = Number.parseInt(products.inverterSize) * 8000
      const structurePrice = Number.parseInt(products.structureSize) * 5000
      const cablePrice = 15000
      const meterPrice = 8000
      const acdbDcdbPrice = 12000

      let totalAmount = panelPrice + inverterPrice + structurePrice + cablePrice + meterPrice + acdbDcdbPrice

      if (products.batteryPrice) {
        totalAmount += products.batteryPrice
      }

      const discount = [5, 8, 10, 12, 15][Math.floor(Math.random() * 5)]
      const finalAmount = totalAmount - (totalAmount * discount) / 100

      quotations.push({
        id: `QT-${1000 + quotations.length}`,
        customer: dummyCustomers[customerIndex],
        products: products,
        discount,
        totalAmount,
        finalAmount,
        createdAt: quotationDate.toISOString(),
        dealerId: dealer.id,
        // Make at least some quotations approved for account management testing
        status: (i < 2 ? "approved" : (["pending", "approved", "rejected", "completed"][Math.floor(Math.random() * 4)])) as "pending" | "approved" | "rejected" | "completed",
      })
    }
  })

  return quotations
}

// Function to seed localStorage with dummy data
export function seedDummyData() {
  // Always ensure account managers exist (they might be deleted or missing)
  const existingAccountManagers = JSON.parse(localStorage.getItem("accountManagers") || "[]")
  if (existingAccountManagers.length === 0) {
    localStorage.setItem("accountManagers", JSON.stringify(dummyAccountManagers))
  } else {
    // Merge with dummy account managers to ensure all dummy account managers exist
    const mergedAccountManagers = [...existingAccountManagers]
    dummyAccountManagers.forEach((dummyAccountManager) => {
      const exists = mergedAccountManagers.find((am: AccountManager & { password?: string }) => 
        am.id === dummyAccountManager.id || am.username === dummyAccountManager.username
      )
      if (!exists) {
        mergedAccountManagers.push(dummyAccountManager)
      } else {
        // Update existing account manager to ensure password is correct
        const index = mergedAccountManagers.findIndex((am: AccountManager & { password?: string }) => 
          am.id === dummyAccountManager.id || am.username === dummyAccountManager.username
        )
        if (index !== -1) {
          mergedAccountManagers[index] = { ...mergedAccountManagers[index], password: dummyAccountManager.password }
        }
      }
    })
    localStorage.setItem("accountManagers", JSON.stringify(mergedAccountManagers))
  }

  // Always ensure visitors exist (they might be deleted or missing)
  const existingVisitors = JSON.parse(localStorage.getItem("visitors") || "[]")
  if (existingVisitors.length === 0) {
    localStorage.setItem("visitors", JSON.stringify(dummyVisitors))
  } else {
    // Merge with dummy visitors to ensure all dummy visitors exist
    const mergedVisitors = [...existingVisitors]
    dummyVisitors.forEach((dummyVisitor) => {
      const exists = mergedVisitors.find((v: Visitor) => v.id === dummyVisitor.id || v.username === dummyVisitor.username)
      if (!exists) {
        mergedVisitors.push(dummyVisitor)
      } else {
        // Update existing visitor to ensure password is correct
        const index = mergedVisitors.findIndex((v: Visitor) => v.id === dummyVisitor.id || v.username === dummyVisitor.username)
        if (index !== -1) {
          mergedVisitors[index] = { ...mergedVisitors[index], password: dummyVisitor.password }
        }
      }
    })
    localStorage.setItem("visitors", JSON.stringify(mergedVisitors))
  }

  // Check if data already seeded
  const isSeeded = localStorage.getItem("dummyDataSeeded")

  if (!isSeeded) {
    // Seed dealers
    const existingDealers = JSON.parse(localStorage.getItem("dealers") || "[]")
    if (existingDealers.length === 0) {
      localStorage.setItem("dealers", JSON.stringify(dummyDealers))
    }

    // Seed quotations
    const existingQuotations = JSON.parse(localStorage.getItem("quotations") || "[]")
    if (existingQuotations.length === 0) {
      const dummyQuotations = generateDummyQuotations()
      localStorage.setItem("quotations", JSON.stringify(dummyQuotations))
    } else {
      // Ensure at least some quotations have "approved" status for account management testing
      const updatedQuotations = existingQuotations.map((q: Quotation, index: number) => {
        // Make first 2-3 quotations approved for testing
        if (index < 3 && q.status !== "approved") {
          return { ...q, status: "approved" as const }
        }
        return q
      })
      localStorage.setItem("quotations", JSON.stringify(updatedQuotations))
    }

    localStorage.setItem("dummyDataSeeded", "true")
  }
}

// Dummy Account Management Users (for login testing)
export const dummyAccountManagers: (AccountManager & { password: string })[] = [
  {
    id: "account-mgr-001",
    username: "accountmgr",
    password: "account123",
    firstName: "Arjun",
    lastName: "Singh",
    mobile: "9876543215",
    email: "arjun.singh@accountmanagement.com",
    isActive: true,
    emailVerified: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: "account-mgr-002",
    username: "accmgr",
    password: "accmgr123",
    firstName: "Sneha",
    lastName: "Reddy",
    mobile: "9876543216",
    email: "sneha.reddy@accountmanagement.com",
    isActive: true,
    emailVerified: true,
    createdAt: new Date().toISOString(),
  },
]

export const dummyVisitors: Visitor[] = [
  {
    id: "visitor-001",
    username: "visitor1",
    password: "visitor123",
    firstName: "Rahul",
    lastName: "Singh",
    mobile: "9876543210",
    email: "rahul.singh@example.com",
  },
  {
    id: "visitor-002",
    username: "visitor2",
    password: "visitor123",
    firstName: "Sneha",
    lastName: "Verma",
    mobile: "9876543211",
    email: "sneha.verma@example.com",
  },
  {
    id: "visitor-003",
    username: "visitor3",
    password: "visitor123",
    firstName: "Vikram",
    lastName: "Yadav",
    mobile: "9876543212",
    email: "vikram.yadav@example.com",
  },
]

// Login credentials info for display
export const loginCredentials = [
  { username: "demo", password: "demo123", name: "Rajesh Kumar (Dealer)" },
  { username: "admin", password: "admin123", name: "Priya Sharma (Admin)" },
  { username: "testuser", password: "test123", name: "Amit Patel (Dealer)" },
  { username: "visitor1", password: "visitor123", name: "Rahul Singh (Visitor)" },
  { username: "visitor2", password: "visitor123", name: "Sneha Verma (Visitor)" },
  { username: "visitor3", password: "visitor123", name: "Vikram Yadav (Visitor)" },
  { username: "accountmgr", password: "account123", name: "Arjun Singh (Account Management)" },
  { username: "accmgr", password: "accmgr123", name: "Sneha Reddy (Account Management)" },
]
