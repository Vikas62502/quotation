// Hook to fetch and cache pricing tables from backend API
import { useState, useEffect } from "react"
import { api } from "./api"
import { setPricingData, type PricingTablesData } from "./pricing-tables"

let cachedPricingTables: PricingTablesData | null = null
let pricingTablesPromise: Promise<PricingTablesData> | null = null

export function usePricingTables() {
  const [pricingTables, setPricingTables] = useState<PricingTablesData | null>(cachedPricingTables)
  const [isLoading, setIsLoading] = useState(!cachedPricingTables)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // If already cached, use it
    if (cachedPricingTables) {
      setPricingTables(cachedPricingTables)
      setPricingData(cachedPricingTables) // Set global pricing data
      setIsLoading(false)
      return
    }

    // If a request is already in progress, wait for it
    if (pricingTablesPromise) {
      pricingTablesPromise
        .then((data) => {
          setPricingTables(data)
          setPricingData(data) // Set global pricing data
          setIsLoading(false)
        })
        .catch((err) => {
          setError(err.message || "Failed to load pricing tables")
          setIsLoading(false)
        })
      return
    }

    // Start new request
    setIsLoading(true)
    setError(null)
    pricingTablesPromise = api.quotations
      .getPricingTables()
      .then((data) => {
        cachedPricingTables = data
        setPricingTables(data)
        setPricingData(data) // Set global pricing data for use by pricing functions
        setIsLoading(false)
        return data
      })
      .catch((err) => {
        setError(err.message || "Failed to load pricing tables")
        setIsLoading(false)
        pricingTablesPromise = null
        // Don't set pricing data on error - will use hardcoded fallback
        throw err
      })

    pricingTablesPromise.catch(() => {
      // Error already handled above
    })
  }, [])

  return { pricingTables, isLoading, error }
}

// Function to clear cache (useful for testing or when pricing is updated)
export function clearPricingTablesCache() {
  cachedPricingTables = null
  pricingTablesPromise = null
  setPricingData(null) // Clear global pricing data
}

