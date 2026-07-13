// @ts-nocheck
"use client"

import { useState, useCallback, useMemo, useEffect } from "react"
import type { StockRequest } from "@/inventory-sa/lib/api"
import { useStockRequests } from "./use-api-data"
import { stockRequestsApi } from "@/inventory-sa/lib/api"

function useStockRequestsState(initialRequests: StockRequest[] = []) {
  const shouldFetchFromApi = initialRequests.length === 0
  const { data: apiRequests, loading, error, refetch } = useStockRequests(shouldFetchFromApi ? [] : initialRequests)
  const [requests, setRequests] = useState<StockRequest[]>(shouldFetchFromApi ? apiRequests : initialRequests)

  // Sync requests when API data loads
  useEffect(() => {
    if (shouldFetchFromApi && apiRequests.length > 0) {
      setRequests(apiRequests as StockRequest[])
    }
  }, [apiRequests, shouldFetchFromApi])

  const createRequest = useCallback(
    async (request: Omit<StockRequest, "id">) => {
      try {
        const created = await stockRequestsApi.create({
          requested_from: request.requested_from,
          items: request.items.map((item) => ({
            product_id: item.product_id,
            quantity: item.quantity,
          })),
          notes: request.notes,
        })
        setRequests((prev) => [...prev, created])
        await refetch()
      } catch (err) {
        console.error("Error creating stock request:", err)
        throw err
      }
    },
    [refetch]
  )

  const approveRequest = useCallback(
    async (requestId: string, dispatchImage?: File) => {
      try {
        const updated = await stockRequestsApi.dispatch(requestId, { dispatch_image: dispatchImage })
        setRequests((prev) =>
          prev.map((r) => (r.id === requestId ? updated : r))
        )
        await refetch()
      } catch (err) {
        console.error("Error approving request:", err)
        throw err
      }
    },
    [refetch]
  )

  const rejectRequest = useCallback(
    async (requestId: string, reason: string) => {
      try {
        await stockRequestsApi.dispatch(requestId, { rejection_reason: reason })
        setRequests((prev) =>
          prev.map((r) => (r.id === requestId ? { ...r, status: "rejected" as const, rejection_reason: reason } : r))
        )
        await refetch()
      } catch (err) {
        console.error("Error rejecting request:", err)
        throw err
      }
    },
    [refetch]
  )

  const deleteRequest = useCallback(
    async (requestId: string) => {
      try {
        await stockRequestsApi.delete(requestId)
        setRequests((prev) => prev.filter((r) => r.id !== requestId))
        await refetch()
      } catch (err) {
        console.error("Error deleting request:", err)
        throw err
      }
    },
    [refetch]
  )

  const stats = useMemo(() => {
    return {
      pending: requests.filter((r) => r.status === "pending").length,
      dispatched: requests.filter((r) => r.status === "dispatched").length,
      confirmed: requests.filter((r) => r.status === "confirmed").length,
      rejected: requests.filter((r) => r.status === "rejected").length,
      total: requests.length,
    }
  }, [requests])

  const getPendingRequests = useCallback(() => requests.filter((r) => r.status === "pending"), [requests])

  const getRequestsByStatus = useCallback(
    (status: "pending" | "dispatched" | "confirmed" | "rejected") => requests.filter((r) => r.status === status),
    [requests],
  )

  const getRequestsByAdmin = useCallback(
    (adminName: string) => requests.filter((r) => r.requested_by_name === adminName),
    [requests],
  )

  const getTotalRequestedQuantity = useCallback(() => {
    return requests.reduce((sum, r) => {
      return sum + (r.items?.reduce((itemSum, item) => itemSum + item.quantity, 0) || 0)
    }, 0)
  }, [requests])

  const getApprovalRate = useCallback(() => {
    if (requests.length === 0) return 0
    const confirmed = requests.filter((r) => r.status === "confirmed").length
    return Math.round((confirmed / requests.length) * 100)
  }, [requests])

  return {
    requests,
    stats,
    createRequest,
    approveRequest,
    rejectRequest,
    deleteRequest,
    getPendingRequests,
    getRequestsByStatus,
    getRequestsByAdmin,
    getTotalRequestedQuantity,
    getApprovalRate,
    loading,
    error,
    refetch,
  }
}

export { useStockRequestsState }
