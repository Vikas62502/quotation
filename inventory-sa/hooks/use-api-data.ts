// @ts-nocheck
"use client"

import { useState, useEffect, useCallback } from "react"
import { productsApi, salesApi, stockRequestsApi } from "@/inventory-sa/lib/api"
import type { Product, Sale, StockRequest } from "@/inventory-sa/lib/api"
import { ApiClientError } from "@/inventory-sa/lib/api-client"

interface UseApiDataResult<T> {
  data: T[]
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

/**
 * Hook to fetch products from API
 */
function useProducts(initialData: Product[] = []): UseApiDataResult<Product> & {
  data: Product[]
} {
  const [data, setData] = useState<Product[]>(initialData)
  const [loading, setLoading] = useState(initialData.length === 0)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const products = await productsApi.getAll()
      // Transform API data to match frontend format
      const transformedProducts = products.map((p) => ({
        ...p,
        quantity: p.quantity ?? p.central_stock ?? 0,
        price: p.price ?? p.unit_price,
      }))
      setData(transformedProducts)
    } catch (err) {
      const errorMessage =
        err instanceof ApiClientError
          ? err.data?.error || err.message
          : "Failed to fetch products"
      setError(errorMessage)
      console.error("Error fetching products:", err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (initialData.length === 0) {
      fetchData()
    }
  }, [fetchData, initialData.length])

  return {
    data,
    loading,
    error,
    refetch: fetchData,
  }
}

/**
 * Hook to fetch sales from API
 * 
 * NOTE: Backend automatically filters sales based on authenticated user's role:
 * - Agents: Only their own sales (created_by_id = current_user.id)
 * - Admins: Their own sales + sales from agents they created
 * - Account & Super-Admin: All sales
 */
function useSales(initialData: Sale[] = []): UseApiDataResult<Sale> & {
  data: Sale[]
} {
  const [data, setData] = useState<Sale[]>(initialData)
  const [loading, setLoading] = useState(initialData.length === 0)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      // Backend returns pre-filtered sales based on user role
      const sales = await salesApi.getAll()
      // Transform API data to match frontend format
      const transformedSales = sales.map((s) => ({
        ...s,
        totalAmount: s.total_amount,
        saleDate: s.created_at,
        // For backward compatibility, add productName from first item if items exist
        productName: s.items?.[0]?.product?.name || "Multiple Products",
        quantity: s.items?.reduce((sum, item) => sum + item.quantity, 0) || 0,
      }))
      setData(transformedSales)
    } catch (err) {
      const errorMessage =
        err instanceof ApiClientError
          ? err.data?.error || err.message
          : "Failed to fetch sales"
      setError(errorMessage)
      console.error("Error fetching sales:", err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (initialData.length === 0) {
      fetchData()
    }
  }, [fetchData, initialData.length])

  return {
    data,
    loading,
    error,
    refetch: fetchData,
  }
}

/**
 * Hook to fetch stock requests from API
 * 
 * NOTE: Backend automatically filters stock requests based on authenticated user's role:
 * - Agents: Only their own requests (requested_by_id = current_user.id)
 * - Admins: Requests from their agents + their own requests + admin-to-admin transfers
 * - Super-Admin: Requests coming to super-admin
 * - Account: All requests
 */
function useStockRequests(
  initialData: StockRequest[] = []
): UseApiDataResult<StockRequest> & {
  data: StockRequest[]
} {
  const [data, setData] = useState<StockRequest[]>(initialData)
  const [loading, setLoading] = useState(initialData.length === 0)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      // Backend returns pre-filtered requests based on user role
      const requests = await stockRequestsApi.getAll()
      // Transform API data to match frontend format
      const transformedRequests = requests.map((r) => ({
        ...r,
        requestedDate: r.requested_date || r.created_at,
        rejectionReason: r.rejection_reason,
        adminName: r.requested_by_name || "Unknown",
        // Use primary_product_name from backend, fallback to first item product name
        productName: r.primary_product_name || r.items?.[0]?.product?.name || "Multiple Products",
        model: r.items?.[0]?.product?.model || "",
        quantity: r.items?.reduce((sum, item) => sum + item.quantity, 0) || 0,
        status: r.status, // Keep original status (pending, dispatched, confirmed, rejected)
      }))
      setData(transformedRequests)
    } catch (err) {
      const errorMessage =
        err instanceof ApiClientError
          ? err.data?.error || err.message
          : "Failed to fetch stock requests"
      setError(errorMessage)
      console.error("Error fetching stock requests:", err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (initialData.length === 0) {
      fetchData()
    }
  }, [fetchData, initialData.length])

  return {
    data,
    loading,
    error,
    refetch: fetchData,
  }
}

export { useProducts, useSales, useStockRequests }

