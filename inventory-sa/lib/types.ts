// @ts-nocheck
export interface Product {
  id: string
  name: string
  model: string
  wattage: string
  price: number
  quantity: number
  image: string
  category: string
}

export interface StockRequest {
  id: string
  productName: string
  model: string
  quantity: number
  adminName: string
  status: "pending" | "approved" | "rejected"
  requestedDate: string
  rejectionReason?: string
}

export interface Sale {
  id: string
  type: "B2B" | "B2C"
  customerName: string
  productName: string
  quantity: number
  totalAmount: number
  paymentStatus: "pending" | "completed"
  saleDate: string
  image: string
}

export interface InventoryTransaction {
  id: string
  productId: string
  type: "purchase" | "sale" | "return" | "adjustment"
  quantity: number
  timestamp: string
  reference: string
  notes?: string
}

export interface User {
  id: string
  name: string
  role: "super-admin" | "admin" | "agent"
}

export interface InventoryStats {
  totalProducts: number
  totalValue: number
  lowStockCount: number
  totalStock: number
}

export interface SalesStats {
  b2bCount: number
  b2cCount: number
  totalRevenue: number
  b2bRevenue: number
  b2cRevenue: number
  pendingPayments: number
  pendingAmount: number
  completedPayments: number
}

export interface RequestStats {
  pending: number
  approved: number
  rejected: number
  total: number
}
