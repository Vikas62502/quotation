"use client"

import { useState, useEffect } from "react"
import { api } from "@/lib/api"

export interface ProductCatalog {
  panels: {
    brands: string[]
    sizes: string[]
  }
  inverters: {
    types: string[]
    brands: string[]
    sizes: string[]
  }
  structures: {
    types: string[]
    sizes: string[]
  }
  meters: {
    brands: string[]
  }
  cables: {
    brands: string[]
    sizes: string[]
  }
  acdb: {
    options: string[]
  }
  dcdb: {
    options: string[]
  }
}

const emptyCatalog: ProductCatalog = {
  panels: {
    brands: [],
    sizes: [],
  },
  inverters: {
    types: [],
    brands: [],
    sizes: [],
  },
  structures: {
    types: [],
    sizes: [],
  },
  meters: {
    brands: [],
  },
  cables: {
    brands: [],
    sizes: [],
  },
  acdb: {
    options: [],
  },
  dcdb: {
    options: [],
  },
}

export function useProductCatalog() {
  const [catalog, setCatalog] = useState<ProductCatalog>(emptyCatalog)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const useApi = process.env.NEXT_PUBLIC_USE_API !== "false"

  useEffect(() => {
    const loadCatalog = async () => {
      if (!useApi) {
        setIsLoading(false)
        setCatalog(emptyCatalog)
        return
      }

      try {
        setIsLoading(true)
        setError(null)
        // Use quotations/product-catalog endpoint for product selection forms
        // This endpoint is accessible to dealers, admins, and visitors
        const response = await api.quotations.getProductCatalog()
        
        console.log("Product catalog API response:", response)
        
        // Handle API response - check if response has data directly or wrapped in success/data
        let catalogData = null
        if (response && response.success && response.data) {
          // Response format: { success: true, data: {...} }
          catalogData = response.data
        } else if (response && response.panels) {
          // Response format: direct data object { panels: {...}, ... }
          catalogData = response
        } else if (response && response.data && !response.success) {
          // Response format: { data: {...} }
          catalogData = response.data
        }
        
        // Use API data only - no fallback to dummy data
        if (catalogData) {
          setCatalog({
            panels: {
              brands: Array.isArray(catalogData.panels?.brands) ? catalogData.panels.brands : [],
              sizes: Array.isArray(catalogData.panels?.sizes) ? catalogData.panels.sizes : [],
            },
            inverters: {
              types: Array.isArray(catalogData.inverters?.types) ? catalogData.inverters.types : [],
              brands: Array.isArray(catalogData.inverters?.brands) ? catalogData.inverters.brands : [],
              sizes: Array.isArray(catalogData.inverters?.sizes) ? catalogData.inverters.sizes : [],
            },
            structures: {
              types: Array.isArray(catalogData.structures?.types) ? catalogData.structures.types : [],
              sizes: Array.isArray(catalogData.structures?.sizes) ? catalogData.structures.sizes : [],
            },
            meters: {
              brands: Array.isArray(catalogData.meters?.brands) ? catalogData.meters.brands : [],
            },
            cables: {
              brands: Array.isArray(catalogData.cables?.brands) ? catalogData.cables.brands : [],
              sizes: Array.isArray(catalogData.cables?.sizes) ? catalogData.cables.sizes : [],
            },
            acdb: {
              options: Array.isArray(catalogData.acdb?.options) ? catalogData.acdb.options : [],
            },
            dcdb: {
              options: Array.isArray(catalogData.dcdb?.options) ? catalogData.dcdb.options : [],
            },
          })
        } else {
          // No data received, use empty catalog
          console.warn("No catalog data received from API, using empty catalog")
          setCatalog(emptyCatalog)
        }
      } catch (err: any) {
        console.error("Error loading product catalog:", err)
        setError(err.message || "Failed to load product catalog")
        // Use empty catalog on error - no fallback to dummy data
        setCatalog(emptyCatalog)
      } finally {
        setIsLoading(false)
      }
    }

    loadCatalog()
  }, [useApi])

  return { catalog, isLoading, error }
}



