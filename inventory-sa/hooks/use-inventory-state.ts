// @ts-nocheck
"use client"

import { useState, useCallback, useMemo, useEffect } from "react"
import type { Product, InventoryTransaction } from "@/inventory-sa/lib/types"
import { useProducts } from "./use-api-data"
import { productsApi, inventoryTransactionsApi } from "@/inventory-sa/lib/api"
import type { Product as ApiProduct } from "@/inventory-sa/lib/api"

export function useInventoryState(initialProducts: Product[] = []) {
  const shouldFetchFromApi = initialProducts.length === 0
  const { data: apiProducts, loading, error, refetch } = useProducts(shouldFetchFromApi ? [] : initialProducts)
  const [products, setProducts] = useState<Product[]>(shouldFetchFromApi ? apiProducts : initialProducts)
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([])

  // Sync products when API data loads
  useEffect(() => {
    if (shouldFetchFromApi && apiProducts.length > 0) {
      setProducts(apiProducts as Product[])
    }
  }, [apiProducts, shouldFetchFromApi])

  const recordTransaction = useCallback((transaction: Omit<InventoryTransaction, "id" | "timestamp">) => {
    const newTransaction: InventoryTransaction = {
      ...transaction,
      id: Math.random().toString(),
      timestamp: new Date().toISOString(),
    }
    setTransactions((prev) => [newTransaction, ...prev])
  }, [])

  const addProduct = useCallback(
    async (product: Product | Omit<Product, "id">) => {
      try {
        let productId = "id" in product ? product.id : ""
        if ("id" in product && product.id) {
          // Update existing product
          const updated = await productsApi.update(product.id, {
            name: product.name,
            model: product.model,
            category: product.category,
            wattage: product.wattage,
            quantity: product.quantity,
            unit_price: product.price,
          })
          productId = updated.id
          setProducts((prev) =>
            prev.map((p) => (p.id === product.id ? { ...updated, quantity: updated.quantity ?? updated.central_stock ?? 0, price: updated.price ?? updated.unit_price } as Product : p))
          )
          await refetch()
        } else {
          // Create new product
          const created = await productsApi.create({
            name: product.name,
            model: product.model,
            category: product.category,
            wattage: product.wattage,
            quantity: product.quantity,
            unit_price: product.price,
          })
          productId = created.id
          setProducts((prev) => [...prev, { ...created, quantity: created.quantity ?? created.central_stock ?? 0, price: created.price ?? created.unit_price } as Product])
        }
        
        // Record transaction
        if (productId) {
          recordTransaction({
            productId,
            type: "purchase",
            quantity: product.quantity,
            reference: `Initial stock: ${product.name}`,
          })
        }
      } catch (err) {
        console.error("Error saving product:", err)
        throw err
      }
    },
    [refetch, recordTransaction]
  )

  const updateProduct = useCallback(
    async (productId: string, updates: Partial<Product>) => {
      try {
        await productsApi.update(productId, {
          name: updates.name,
          model: updates.model,
          category: updates.category,
          wattage: updates.wattage,
          quantity: updates.quantity,
          unit_price: updates.price,
        })
        setProducts((prev) => prev.map((p) => (p.id === productId ? { ...p, ...updates } : p)))
        await refetch()
      } catch (err) {
        console.error("Error updating product:", err)
        throw err
      }
    },
    [refetch]
  )

  const deleteProduct = useCallback(
    async (productId: string) => {
      try {
        await productsApi.delete(productId)
        setProducts((prev) => prev.filter((p) => p.id !== productId))
        await refetch()
      } catch (err) {
        console.error("Error deleting product:", err)
        throw err
      }
    },
    [refetch]
  )

  const updateQuantity = useCallback(
    async (productId: string, quantity: number, type: InventoryTransaction["type"], reference: string) => {
      const product = products.find((p) => p.id === productId)
      if (product) {
        const newQuantity =
          type === "sale" || type === "return" ? product.quantity - quantity : product.quantity + quantity

        await updateProduct(productId, { quantity: Math.max(0, newQuantity) })
        recordTransaction({ productId, type, quantity, reference })
      }
    },
    [products, updateProduct, recordTransaction],
  )

  const stats = useMemo(() => {
    return {
      totalProducts: products.length,
      totalValue: products.reduce((sum, p) => sum + p.quantity * p.price, 0),
      lowStockCount: products.filter((p) => p.quantity < 50).length,
      totalStock: products.reduce((sum, p) => sum + p.quantity, 0),
    }
  }, [products])

  const getProductById = useCallback((id: string) => products.find((p) => p.id === id), [products])

  const getTransactionHistory = useCallback(
    (productId?: string) => {
      return productId ? transactions.filter((t) => t.productId === productId) : transactions
    },
    [transactions],
  )

  // Load transactions from API
  useEffect(() => {
    const loadTransactions = async () => {
      try {
        const apiTransactions = await inventoryTransactionsApi.getAll()
        const transformed = apiTransactions.map((t) => ({
          id: t.id,
          productId: t.product_id,
          type: (t.transaction_type || t.type) as InventoryTransaction["type"],
          quantity: t.quantity,
          timestamp: t.created_at || t.timestamp || new Date().toISOString(),
          reference: t.reference,
          notes: t.notes,
        }))
        setTransactions(transformed)
      } catch (err) {
        console.error("Error loading transactions:", err)
      }
    }
    loadTransactions()
  }, [])

  return {
    products,
    transactions,
    stats,
    addProduct,
    updateProduct,
    deleteProduct,
    updateQuantity,
    recordTransaction,
    getProductById,
    getTransactionHistory,
    loading,
    error,
    refetch,
  }
}
