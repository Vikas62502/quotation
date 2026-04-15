// API Configuration and Service Layer
import { API_CONFIG } from "./api-config"

const API_BASE_URL = API_CONFIG.baseURL

interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
    details?: Array<{ field: string; message: string }>
  }
  message?: string
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
  body?: any
  headers?: Record<string, string>
  requiresAuth?: boolean
}

class ApiError extends Error {
  code: string
  details?: Array<{ field: string; message: string }>

  constructor(message: string, code: string = "API_ERROR", details?: Array<{ field: string; message: string }>) {
    super(message)
    this.name = "ApiError"
    this.code = code
    this.details = details
  }
}

// Get auth token from localStorage
const getAuthToken = (): string | null => {
  if (typeof window === "undefined") return null
  return localStorage.getItem("authToken")
}

// Get refresh token from localStorage
const getRefreshToken = (): string | null => {
  if (typeof window === "undefined") return null
  return localStorage.getItem("refreshToken")
}

// Save auth tokens
const saveAuthTokens = (token: string, refreshToken?: string) => {
  if (typeof window === "undefined") return
  localStorage.setItem("authToken", token)
  if (refreshToken) {
    localStorage.setItem("refreshToken", refreshToken)
  }
}

// Clear auth tokens
const clearAuthTokens = () => {
  if (typeof window === "undefined") return
  localStorage.removeItem("authToken")
  localStorage.removeItem("refreshToken")
}

// Main API request function
async function apiRequest<T = any>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  console.log('[API] ========================================')
  console.log('[API] Starting API request')
  console.log('[API] Endpoint:', endpoint)
  console.log('[API] Method:', options.method || 'GET')
  console.log('[API] Requires Auth:', options.requiresAuth !== false)
  
  const { method = "GET", body, headers = {}, requiresAuth = true } = options

  const url = `${API_BASE_URL}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`
  console.log('[API] Full URL:', url)

  const requestHeaders: HeadersInit = {
    "Content-Type": "application/json",
    ...headers,
  }
  console.log('[API] Request headers (before auth):', { ...requestHeaders, Authorization: '***' })

  // Add auth token if required
  if (requiresAuth) {
    const token = getAuthToken()
    if (token) {
      requestHeaders.Authorization = `Bearer ${token}`
      console.log('[API] Auth token added (length):', token.length)
    } else {
      console.warn('[API] WARNING: Auth required but no token found')
      // Don't throw error here - let the backend return 401 so we can handle it properly
      // This allows the error handling flow to work correctly
    }
  } else {
    console.log('[API] Auth not required for this request')
  }

  const config: RequestInit = {
    method,
    headers: requestHeaders,
  }

  if (body && method !== "GET") {
    console.log('[API] Request body present:', {
      type: typeof body,
      isObject: typeof body === 'object',
      keys: typeof body === 'object' ? Object.keys(body) : 'N/A'
    })
    
    // Log request body for quotation creation (for debugging)
    if (endpoint.includes('/quotations') && method === 'POST' && body) {
      console.log('[API] ===== QUOTATION CREATION REQUEST =====')
      console.log('[API] Quotation creation request body:', {
        hasSubtotal: 'subtotal' in body,
        subtotalValue: (body as any).subtotal,
        subtotalType: typeof (body as any).subtotal,
        hasTotalAmount: 'totalAmount' in body,
        totalAmountValue: (body as any).totalAmount,
        totalAmountType: typeof (body as any).totalAmount,
        hasFinalAmount: 'finalAmount' in body,
        finalAmountValue: (body as any).finalAmount,
        finalAmountType: typeof (body as any).finalAmount,
        rootLevelKeys: Object.keys(body),
        fullBody: JSON.stringify(body, null, 2)
      })
      console.log('[API] ========================================')
    }
    
    config.body = JSON.stringify(body)
    console.log('[API] Body serialized to JSON, length:', config.body.length)
    console.log('[API] Serialized body preview:', config.body.substring(0, 200) + (config.body.length > 200 ? '...' : ''))
  } else {
    console.log('[API] No request body (GET request or body not provided)')
  }

  console.log('[API] Final request config:', {
    method: config.method,
    url: url,
    hasBody: !!config.body,
    bodyLength: config.body && typeof config.body === 'string' ? config.body.length : 0,
    headersCount: Object.keys(config.headers || {}).length
  })

  try {
    console.log('[API] Sending fetch request...')
    const response = await fetch(url, config)
    console.log('[API] Response received:', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      headers: Object.fromEntries(response.headers.entries())
    })

    // Handle non-JSON responses
    const contentType = response.headers.get("content-type")
    console.log('[API] Response content-type:', contentType)
    
    if (!contentType?.includes("application/json")) {
      console.log('[API] Non-JSON response detected')
      if (response.ok) {
        console.log('[API] Response OK, returning as-is')
        return response as any
      }
      // For non-JSON error responses, extract text if possible
      console.log('[API] Non-JSON error response, extracting text...')
      const errorText = await response.text().catch(() => response.statusText)
      console.error('[API] Non-JSON error:', errorText)
      throw new ApiError(
        errorText || `HTTP ${response.status}: ${response.statusText}`,
        `HTTP_${response.status}`
      )
    }

    console.log('[API] Parsing JSON response...')
    const data: ApiResponse<T> = await response.json()
    console.log('[API] Parsed response data:', {
      success: data.success,
      hasData: !!data.data,
      hasError: !!data.error,
      errorCode: data.error?.code,
      errorMessage: data.error?.message
    })

    // Handle API errors (success: false in response body)
    // Check this FIRST, even if response.ok is false, because API returns error structure in body
    if (!data.success || !response.ok) {
      console.error('[API] ===== API ERROR DETECTED =====')
      const errorMessage = data.error?.message || `HTTP ${response.status}: ${response.statusText}` || "An error occurred"
      const errorCode = data.error?.code || (response.status === 401 ? "AUTH_001" : `HTTP_${response.status}`) || "API_ERROR"
      const errorDetails = data.error?.details || undefined
      
      // Log for debugging
      console.error('[API] API Error Response:', {
        status: response.status,
        statusText: response.statusText,
        message: errorMessage,
        code: errorCode,
        details: errorDetails,
        fullData: data
      })
      
      // Special handling for "User not authenticated" errors
      if (errorMessage?.toLowerCase().includes("not authenticated") || 
          errorMessage?.toLowerCase().includes("user not authenticated") ||
          errorCode === "AUTH_001" || 
          errorCode === "AUTH_003") {
        console.error('[API] Authentication error detected - clearing tokens and redirecting')
        clearAuthTokens()
        if (typeof window !== "undefined") {
          // Don't redirect immediately - let the calling code handle it
          // This allows for better error messages
        }
      }
      
      // Special logging for quotation creation errors
      if (endpoint.includes('/quotations') && method === 'POST') {
        console.error('[API] QUOTATION CREATION ERROR DETAILS:')
        if (errorDetails && Array.isArray(errorDetails)) {
          errorDetails.forEach((detail: any, index: number) => {
            console.error(`[API]   Error Detail ${index + 1}:`, {
              field: detail.field,
              message: detail.message
            })
          })
        }
        console.error('[API] Request that failed:', {
          endpoint,
          method,
          bodyKeys: body && typeof body === 'object' ? Object.keys(body) : 'N/A',
          hasSubtotal: body && typeof body === 'object' ? 'subtotal' in body : false,
          hasTotalAmount: body && typeof body === 'object' ? 'totalAmount' in body : false,
          hasFinalAmount: body && typeof body === 'object' ? 'finalAmount' in body : false
        })
      }
      console.error('[API] =================================')
      
      throw new ApiError(errorMessage, errorCode, errorDetails)
    }
    
    console.log('[API] Request successful, returning data')

    // Handle token refresh if needed
    if (response.status === 401 && requiresAuth) {
      console.log('[API] 401 Unauthorized, attempting token refresh...')
      const refreshToken = getRefreshToken()
      if (refreshToken) {
        console.log('[API] Refresh token found, attempting refresh...')
        try {
          const refreshResponse = await apiRequest<{ token: string; expiresIn: number }>(
            "/auth/refresh",
            {
              method: "POST",
              requiresAuth: false,
              headers: {
                Authorization: `Bearer ${refreshToken}`,
              },
            }
          )
          console.log('[API] Token refresh successful, saving new token')
          saveAuthTokens(refreshResponse.token)
          console.log('[API] Retrying original request...')
          // Retry original request
          return apiRequest<T>(endpoint, options)
        } catch (refreshError) {
          console.error('[API] Token refresh failed:', refreshError)
          clearAuthTokens()
          if (typeof window !== "undefined") {
            console.log('[API] Redirecting to login...')
            window.location.href = "/login"
          }
          throw new ApiError("Session expired. Please login again.", "AUTH_002")
        }
      } else {
        console.warn('[API] No refresh token available')
        clearAuthTokens()
        if (typeof window !== "undefined") {
          console.log('[API] Redirecting to login...')
          window.location.href = "/login"
        }
        throw new ApiError("Unauthorized. Please login again.", "AUTH_003")
      }
    }

    console.log('[API] Request completed successfully')
    console.log('[API] ========================================')
    return data.data as T
  } catch (error) {
    console.error('[API] ===== EXCEPTION CAUGHT =====')
    console.error('[API] Error type:', error instanceof Error ? error.constructor.name : typeof error)
    console.error('[API] Error message:', error instanceof Error ? error.message : String(error))
    
    if (error instanceof ApiError) {
      console.error('[API] ApiError detected, re-throwing:', {
        message: error.message,
        code: error.code,
        hasDetails: !!error.details
      })
      console.error('[API] =================================')
      throw error
    }
    if (error instanceof Error) {
      console.error('[API] Generic Error detected')
      // Handle network/connection errors
      if (error.message.includes("Failed to fetch") || error.message.includes("NetworkError") || error.message.includes("ERR_CONNECTION_REFUSED")) {
        console.error('[API] Network error detected:', error.message)
        console.error('[API] =================================')
        throw new ApiError(
          "Cannot connect to the server. Please ensure the API server is running at http://localhost:3050/api",
          "NETWORK_ERROR"
        )
      }
      console.error('[API] Converting to ApiError with message:', error.message)
      console.error('[API] =================================')
      throw new ApiError(error.message, "NETWORK_ERROR")
    }
    console.error('[API] Unknown error type, converting to ApiError')
    console.error('[API] =================================')
    throw new ApiError("An unexpected error occurred", "UNKNOWN_ERROR")
  }
}

// Multipart helper for file uploads through backend
async function multipartRequest<T = any>(endpoint: string, method: "POST" | "PATCH", formData: FormData): Promise<T> {
  const token = getAuthToken()
  const url = `${API_BASE_URL}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: token ? `Bearer ${token}` : "",
    },
    body: formData,
  })

  const contentType = response.headers.get("content-type")
  if (contentType?.includes("application/json")) {
    const data = await response.json()
    if (!response.ok || data?.success === false) {
      const message = data?.error?.message || response.statusText
      throw new ApiError(message, data?.error?.code || `HTTP_${response.status}`)
    }
    return data?.data || data
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => response.statusText)
    throw new ApiError(errorText || `HTTP_${response.status}`)
  }

  return response as any
}

// API Service Methods
export const api = {
  // Authentication
  auth: {
    login: async (username: string, password: string) => {
      const response = await apiRequest<{
        token: string
        refreshToken: string
        user: {
          id: string
          username: string
          firstName: string
          lastName: string
          email: string
          role: string
        }
        expiresIn: number
      }>("/auth/login", {
        method: "POST",
        body: { username, password },
        requiresAuth: false,
      })

      saveAuthTokens(response.token, response.refreshToken)
      return response
    },

    logout: async () => {
      const token = getAuthToken()
      try {
        const url = `${API_BASE_URL}/auth/logout`
        // Use direct fetch so logout never triggers global auth redirect-to-login logic.
        await fetch(url, {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
      } catch {
        // Ignore errors on logout
      } finally {
        clearAuthTokens()
      }
    },

    refreshToken: async () => {
      const refreshToken = getRefreshToken()
      if (!refreshToken) throw new ApiError("No refresh token available", "AUTH_002")

      const response = await apiRequest<{ token: string; expiresIn: number }>("/auth/refresh", {
        method: "POST",
        requiresAuth: false,
        headers: {
          Authorization: `Bearer ${refreshToken}`,
        },
      })

      saveAuthTokens(response.token)
      return response
    },

    changePassword: async (currentPassword: string, newPassword: string) => {
      return apiRequest("/auth/change-password", {
        method: "PUT",
        body: { currentPassword, newPassword },
      })
    },

    resetPassword: async (username: string, oldPassword: string, newPassword: string) => {
      return apiRequest("/auth/reset-password", {
        method: "POST",
        body: { username, oldPassword, newPassword },
        requiresAuth: false,
      })
    },

    forgotPassword: async (username: string, dateOfBirth: string, newPassword: string) => {
      return apiRequest("/auth/forgot-password", {
        method: "POST",
        body: { username, dateOfBirth, newPassword },
        requiresAuth: false,
      })
    },
  },

  // Dealers
  dealers: {
    register: async (dealerData: any) => {
      return apiRequest("/dealers/register", {
        method: "POST",
        body: dealerData,
        requiresAuth: false,
      })
    },

    getProfile: async () => {
      return apiRequest("/dealers/me")
    },

    updateProfile: async (profileData: any) => {
      return apiRequest("/dealers/me", {
        method: "PUT",
        body: profileData,
      })
    },

    getStatistics: async (startDate?: string, endDate?: string) => {
      const params = new URLSearchParams()
      if (startDate) params.append("startDate", startDate)
      if (endDate) params.append("endDate", endDate)
      const query = params.toString()
      return apiRequest(`/dealers/me/statistics${query ? `?${query}` : ""}`)
    },

    getVisitors: async (params?: {
      search?: string
      isActive?: boolean
    }) => {
      const queryParams = new URLSearchParams()
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined) queryParams.append(key, String(value))
        })
      }
      const query = queryParams.toString()
      return apiRequest(`/dealers/visitors${query ? `?${query}` : ""}`)
    },

    getCallingQueueNext: async () => {
      try {
        return await apiRequest("/dealers/me/calling-queue/next")
      } catch (error) {
        // Backward compatibility if backend uses /current instead of /next.
        if (error instanceof ApiError && (error.code === "HTTP_404" || error.code === "HTTP_405")) {
          return apiRequest("/dealers/me/calling-queue/current")
        }
        throw error
      }
    },

    updateCallingLeadAction: async (
      leadId: string,
      payload: {
        action: "start" | "called" | "follow_up" | "not_interested" | "rescheduled"
        callRemark?: string
        nextFollowUpAt?: string
        actionAt?: string
      },
    ) => {
      return apiRequest(`/dealers/me/calling-queue/${leadId}/action`, {
        method: "PATCH",
        body: payload,
      })
    },
  },

  // Customers
  customers: {
    create: async (customerData: any) => {
      return apiRequest("/customers", {
        method: "POST",
        body: customerData,
      })
    },

    getAll: async (params?: {
      page?: number
      limit?: number
      search?: string
      sortBy?: string
      sortOrder?: "asc" | "desc"
    }) => {
      const queryParams = new URLSearchParams()
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined) queryParams.append(key, String(value))
        })
      }
      const query = queryParams.toString()
      return apiRequest(`/customers${query ? `?${query}` : ""}`)
    },

    getById: async (customerId: string) => {
      return apiRequest(`/customers/${customerId}`)
    },

    update: async (customerId: string, customerData: any) => {
      return apiRequest(`/customers/${customerId}`, {
        method: "PUT",
        body: customerData,
      })
    },
  },

  // Quotations
  quotations: {
    create: async (quotationData: any) => {
      return apiRequest("/quotations", {
        method: "POST",
        body: quotationData,
      })
    },

    getProductCatalog: async () => {
      return apiRequest("/quotations/product-catalog", {
        method: "GET",
        requiresAuth: true,
      })
    },

    getPricingTables: async () => {
      return apiRequest("/quotations/pricing-tables", {
        method: "GET",
        requiresAuth: true,
      })
    },

    getAll: async (params?: {
      page?: number
      limit?: number
      status?: string
      search?: string
      startDate?: string
      endDate?: string
      sortBy?: string
      sortOrder?: "asc" | "desc"
    }) => {
      const queryParams = new URLSearchParams()
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined) queryParams.append(key, String(value))
        })
      }
      const query = queryParams.toString()
      return apiRequest(`/quotations${query ? `?${query}` : ""}`)
    },

    getById: async (quotationId: string) => {
      return apiRequest(`/quotations/${quotationId}`)
    },

    updateDiscount: async (quotationId: string, discount: number | string) => {
      return apiRequest(`/quotations/${quotationId}/discount`, {
        method: "PATCH",
        body: { discount },
      })
    },

    updatePaymentDetails: async (
      quotationId: string,
      paymentData: {
        paymentType?: string
        paymentMode?: string
        paymentStatus?: "pending" | "partial" | "completed"
        phases?: Array<{
          phaseNumber: number
          phaseName: string
          amount: number
          paidAmount: number
          status: "pending" | "partial" | "completed"
          dueDate?: string
          paymentDate?: string
          paymentMode?: string
          transactionId?: string
          note?: string
        }>
        /** Account Management subsidy cheque audit (optional; backend should persist JSON). */
        subsidyCheques?: Array<{
          id: string
          details: string
          amount: number
          status: "pending" | "cleared"
          clearedAt?: string
        }>
      },
    ) => {
      const attempts: Array<{ endpoint: string; method: "PATCH" | "PUT"; body: Record<string, any> }> = [
        {
          endpoint: `/quotations/${quotationId}/payment-details`,
          method: "PATCH",
          body: paymentData,
        },
        {
          endpoint: `/quotations/${quotationId}/installments`,
          method: "PATCH",
          body: {
            installments: paymentData.phases,
            paymentStatus: paymentData.paymentStatus,
            ...(paymentData.subsidyCheques?.length ? { subsidyCheques: paymentData.subsidyCheques } : {}),
          },
        },
        {
          endpoint: `/quotations/${quotationId}/installments`,
          method: "PUT",
          body: {
            installments: paymentData.phases,
            paymentStatus: paymentData.paymentStatus,
            ...(paymentData.subsidyCheques?.length ? { subsidyCheques: paymentData.subsidyCheques } : {}),
          },
        },
        {
          endpoint: `/quotations/${quotationId}/payment-mode`,
          method: "PATCH",
          body: { paymentMode: paymentData.paymentMode },
        },
      ]

      let lastError: unknown = null
      for (const attempt of attempts) {
        try {
          return await apiRequest(attempt.endpoint, {
            method: attempt.method,
            body: attempt.body,
          })
        } catch (error) {
          lastError = error
          const retryableMissingEndpoint =
            error instanceof ApiError &&
            (error.code === "HTTP_404" || error.code === "HTTP_405" || error.code === "HTTP_501")
          if (!retryableMissingEndpoint) throw error
        }
      }

      throw lastError
    },

    updateProducts: async (quotationId: string, products: any) => {
      return apiRequest(`/quotations/${quotationId}/products`, {
        method: "PATCH",
        body: { products },
      })
    },

    updatePricing: async (quotationId: string, pricing: {
      subtotal?: number
      stateSubsidy?: number
      centralSubsidy?: number
      discountAmount?: number
      totalAmount?: number
      finalAmount?: number
    }) => {
      return apiRequest(`/quotations/${quotationId}/pricing`, {
        method: "PATCH",
        body: pricing,
      })
    },

    updateDocuments: async (quotationId: string, formData: FormData) => {
      const token = getAuthToken()
      const url = `${API_BASE_URL}/quotations/${quotationId}/documents`
      const response = await fetch(url, {
        method: "PATCH",
        headers: {
          Authorization: token ? `Bearer ${token}` : "",
        },
        body: formData,
      })

      const contentType = response.headers.get("content-type")
      if (contentType?.includes("application/json")) {
        const data = await response.json()
        if (!response.ok || data?.success === false) {
          const message = data?.error?.message || response.statusText
          throw new ApiError(message, data?.error?.code || `HTTP_${response.status}`)
        }
        return data?.data || data
      }

      if (!response.ok) {
        const errorText = await response.text().catch(() => response.statusText)
        throw new ApiError(errorText || `HTTP_${response.status}`)
      }

      return response as any
    },

    downloadPDF: async (quotationId: string) => {
      const token = getAuthToken()
      const url = `${API_BASE_URL}/quotations/${quotationId}/pdf`
      const response = await fetch(url, {
        headers: {
          Authorization: token ? `Bearer ${token}` : "",
        },
      })
      if (!response.ok) throw new ApiError(`Failed to download PDF: ${response.statusText}`)
      const blob = await response.blob()
      return blob
    },
  },

  // Visits
  visits: {
    create: async (visitData: any) => {
      return apiRequest("/visits", {
        method: "POST",
        body: visitData,
      })
    },

    getAll: async (params?: {
      page?: number
      limit?: number
      status?: string
      startDate?: string
      endDate?: string
      search?: string
    }) => {
      const queryParams = new URLSearchParams()
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined) queryParams.append(key, String(value))
        })
      }
      const query = queryParams.toString()
      return apiRequest(`/visits${query ? `?${query}` : ""}`)
    },

    getByQuotation: async (quotationId: string) => {
      return apiRequest(`/quotations/${quotationId}/visits`)
    },

    approve: async (visitId: string) => {
      return apiRequest(`/visits/${visitId}/approve`, {
        method: "PATCH",
      })
    },

    complete: async (visitId: string, completeData: {
      length: number
      width: number
      height: number
      images: string[]
      notes?: string
    }) => {
      return apiRequest(`/visits/${visitId}/complete`, {
        method: "PATCH",
        body: completeData,
      })
    },

    incomplete: async (visitId: string, reason: string) => {
      return apiRequest(`/visits/${visitId}/incomplete`, {
        method: "PATCH",
        body: { reason },
      })
    },

    reschedule: async (
      visitId: string,
      rescheduleData:
        | string
        | {
            reason: string
            visitDate?: string
            visitTime?: string
            visitStartTime?: string
            visitEndTime?: string
            visitTimeRange?: string
          },
    ) => {
      const payload =
        typeof rescheduleData === "string"
          ? { reason: rescheduleData }
          : {
              reason: rescheduleData.reason,
              ...(rescheduleData.visitDate ? { visitDate: rescheduleData.visitDate } : {}),
              ...(rescheduleData.visitTime ? { visitTime: rescheduleData.visitTime } : {}),
              ...(rescheduleData.visitStartTime ? { visitStartTime: rescheduleData.visitStartTime } : {}),
              ...(rescheduleData.visitEndTime ? { visitEndTime: rescheduleData.visitEndTime } : {}),
              ...(rescheduleData.visitTimeRange ? { visitTimeRange: rescheduleData.visitTimeRange } : {}),
            }
      return apiRequest(`/visits/${visitId}/reschedule`, {
        method: "PATCH",
        body: payload,
      })
    },

    reject: async (visitId: string, rejectionReason: string) => {
      return apiRequest(`/visits/${visitId}/reject`, {
        method: "PATCH",
        body: { rejectionReason },
      })
    },

    delete: async (visitId: string) => {
      return apiRequest(`/visits/${visitId}`, {
        method: "DELETE",
      })
    },
  },

  // Visitors
  visitors: {
    getAssignedVisits: async (params?: {
      status?: string
      startDate?: string
      endDate?: string
      search?: string
    }) => {
      const queryParams = new URLSearchParams()
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined) queryParams.append(key, String(value))
        })
      }
      const query = queryParams.toString()
      return apiRequest(`/visitors/me/visits${query ? `?${query}` : ""}`)
    },

    getStatistics: async () => {
      return apiRequest("/visitors/me/statistics")
    },
  },

  // Installer APIs
  installer: {
    uploadCompletionDocuments: async (quotationId: string, formData: FormData) => {
      try {
        // Preferred installer-specific endpoint (backend should upload files to AWS/S3)
        return await multipartRequest(`/installer/quotations/${quotationId}/documents`, "POST", formData)
      } catch (error) {
        // Temporary compatibility fallback to existing quotation documents endpoint
        if (error instanceof ApiError && (error.code === "HTTP_404" || error.code === "HTTP_405")) {
          return multipartRequest(`/quotations/${quotationId}/documents`, "PATCH", formData)
        }
        throw error
      }
    },
  },

  // HR APIs
  hr: {
    dealers: {
      getAll: async (params?: {
        page?: number
        limit?: number
        search?: string
        includeInactive?: boolean
        isActive?: boolean
      }) => {
        const queryParams = new URLSearchParams()
        if (params) {
          Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined) queryParams.append(key, String(value))
          })
        }
        const query = queryParams.toString()
        const querySuffix = query ? `?${query}` : ""

        const endpoints = [
          `/hr/dealers${querySuffix}`,
          `/hr/dealer-pool${querySuffix}`,
          `/hr/assignment/dealers${querySuffix}`,
          `/admin/dealers${querySuffix}`,
        ]

        let lastError: unknown = null
        for (const endpoint of endpoints) {
          try {
            return await apiRequest(endpoint)
          } catch (error) {
            lastError = error
            const isRetryable =
              error instanceof ApiError &&
              (error.code === "HTTP_404" ||
                error.code === "HTTP_405" ||
                error.code === "HTTP_501" ||
                error.code === "HTTP_403")
            if (!isRetryable) throw error
          }
        }

        throw lastError
      },
    },

    uploadedLeads: {
      getAll: async (params?: { page?: number; limit?: number }) => {
        const queryParams = new URLSearchParams()
        if (params) {
          Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined) queryParams.append(key, String(value))
          })
        }
        const query = queryParams.toString()
        const querySuffix = query ? `?${query}` : ""

        const endpoints = [
          `/hr/leads/uploads${querySuffix}`,
          `/hr/calling-uploads${querySuffix}`,
          `/hr/uploads${querySuffix}`,
          `/admin/leads/uploads${querySuffix}`,
        ]

        let lastError: unknown = null
        for (const endpoint of endpoints) {
          try {
            return await apiRequest(endpoint)
          } catch (error) {
            lastError = error
            const isMissingEndpoint =
              error instanceof ApiError &&
              (error.code === "HTTP_404" || error.code === "HTTP_405" || error.code === "HTTP_501")
            if (!isMissingEndpoint) throw error
          }
        }

        throw lastError
      },
    },

    callingActions: {
      getAll: async (params?: {
        page?: number
        limit?: number
        dealerId?: string
        startDate?: string
        endDate?: string
        range?: "daily" | "weekly" | "monthly" | "last_month" | "all"
      }) => {
        const queryParams = new URLSearchParams()
        if (params) {
          Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined) queryParams.append(key, String(value))
          })
        }
        const query = queryParams.toString()
        const querySuffix = query ? `?${query}` : ""

        const endpoints = [
          `/hr/calling-actions${querySuffix}`,
          `/hr/calling-queue/actions${querySuffix}`,
          `/admin/calling-actions${querySuffix}`,
        ]

        let lastError: unknown = null
        for (const endpoint of endpoints) {
          try {
            return await apiRequest(endpoint)
          } catch (error) {
            lastError = error
            const isMissingEndpoint =
              error instanceof ApiError &&
              (error.code === "HTTP_404" || error.code === "HTTP_405" || error.code === "HTTP_501")
            if (!isMissingEndpoint) throw error
          }
        }

        throw lastError
      },
    },

    uploadLeadsCsv: async (file: File, dealerIds: string[], activeLimitPerDealer?: number) => {
      const buildFormData = (config: {
        fileKey: "file" | "csvFile"
        dealerMode: "array-brackets" | "repeat-key" | "json-string"
        limitKey?: "activeLimitPerDealer" | "activeLeadsLimit"
      }) => {
        const formData = new FormData()
        formData.append(config.fileKey, file)

        if (config.dealerMode === "array-brackets") {
          dealerIds.forEach((dealerId) => formData.append("dealerIds[]", dealerId))
        } else if (config.dealerMode === "repeat-key") {
          dealerIds.forEach((dealerId) => formData.append("dealerIds", dealerId))
        } else {
          formData.append("dealerIds", JSON.stringify(dealerIds))
        }

        if (config.limitKey && activeLimitPerDealer && Number.isFinite(activeLimitPerDealer)) {
          formData.append(config.limitKey, String(activeLimitPerDealer))
        }

        return formData
      }

      const attempts: Array<{
        fileKey: "file" | "csvFile"
        dealerMode: "array-brackets" | "repeat-key" | "json-string"
        limitKey?: "activeLimitPerDealer" | "activeLeadsLimit"
      }> = [
        { fileKey: "file", dealerMode: "array-brackets", limitKey: "activeLimitPerDealer" },
        { fileKey: "file", dealerMode: "repeat-key", limitKey: "activeLeadsLimit" },
        { fileKey: "csvFile", dealerMode: "json-string", limitKey: "activeLeadsLimit" },
      ]

      let lastError: unknown = null
      for (const attempt of attempts) {
        try {
          const formData = buildFormData(attempt)
          return await multipartRequest("/hr/leads/upload-csv", "POST", formData)
        } catch (error) {
          lastError = error
          const isValidationError =
            error instanceof ApiError &&
            (error.code === "VAL_001" || error.code === "HTTP_400" || error.message.toLowerCase().includes("validation"))
          if (!isValidationError) throw error
        }
      }

      throw lastError
    },
  },

  // Admin APIs
  admin: {
    callingActions: {
      getAll: async (params?: {
        page?: number
        limit?: number
        dealerId?: string
        startDate?: string
        endDate?: string
        range?: "daily" | "weekly" | "monthly" | "last_month" | "all"
      }) => {
        const queryParams = new URLSearchParams()
        if (params) {
          Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined) queryParams.append(key, String(value))
          })
        }
        const query = queryParams.toString()
        const querySuffix = query ? `?${query}` : ""

        const endpoints = [
          `/admin/calling-actions${querySuffix}`,
          `/admin/calling-queue/actions${querySuffix}`,
          `/admin/leads/actions${querySuffix}`,
        ]

        let lastError: unknown = null
        for (const endpoint of endpoints) {
          try {
            return await apiRequest(endpoint)
          } catch (error) {
            lastError = error
            const isMissingEndpoint =
              error instanceof ApiError &&
              (error.code === "HTTP_404" || error.code === "HTTP_405" || error.code === "HTTP_501")
            if (!isMissingEndpoint) throw error
          }
        }

        throw lastError
      },
    },

    quotations: {
      getAll: async (params?: {
        page?: number
        limit?: number
        status?: string
        search?: string
        startDate?: string
        endDate?: string
        dealerId?: string
      }) => {
        const queryParams = new URLSearchParams()
        if (params) {
          Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined) queryParams.append(key, String(value))
          })
        }
        const query = queryParams.toString()
        return apiRequest(`/admin/quotations${query ? `?${query}` : ""}`)
      },

      updateStatus: async (
        quotationId: string,
        status: string,
        approval?: {
          paymentType: "loan" | "cash" | "mix"
          bankName?: string
          bankIfsc?: string
          /** Subsidy cheque (cash or cash + loan) */
          subsidyChequeDetails?: string
        },
      ) => {
        return apiRequest(`/admin/quotations/${quotationId}/status`, {
          method: "PATCH",
          body: {
            status,
            ...(approval
              ? {
                  paymentType: approval.paymentType,
                  paymentMode: approval.paymentType,
                  ...(approval.bankName ? { bankName: approval.bankName } : {}),
                  ...(approval.bankIfsc ? { bankIfsc: approval.bankIfsc } : {}),
                  ...(approval.subsidyChequeDetails?.trim()
                    ? { subsidyChequeDetails: approval.subsidyChequeDetails.trim() }
                    : {}),
                }
              : {}),
          },
        })
      },

      /**
       * Persist file-login workflow (portal filing). Backend should store fileLoginAt, file payment type,
       * optional bank + subsidy cheque, and return these fields on quotation GET/list.
       * Send `{ reset: true }` to clear file-login fields (backend should interpret `resetFileLogin: true` in body).
       */
      updateFileLogin: async (
        quotationId: string,
        payload:
          | { reset: true }
          | {
              fileLoginStatus: "already_login" | "login_now"
              filePaymentType: "loan" | "cash" | "mix"
              bankName?: string
              bankIfsc?: string
              fileSubsidyChequeDetails?: string
            },
      ) => {
        let body: Record<string, unknown>
        if ("reset" in payload && payload.reset) {
          body = { resetFileLogin: true }
        } else {
          const p = payload as {
            fileLoginStatus: "already_login" | "login_now"
            filePaymentType: "loan" | "cash" | "mix"
            bankName?: string
            bankIfsc?: string
            fileSubsidyChequeDetails?: string
          }
          body = {
            fileLoginStatus: p.fileLoginStatus,
            filePaymentType: p.filePaymentType,
            paymentMode: p.filePaymentType,
            ...(p.bankName ? { fileBankName: p.bankName, bankName: p.bankName } : {}),
            ...(p.bankIfsc ? { fileBankIfsc: p.bankIfsc, bankIfsc: p.bankIfsc } : {}),
            ...(p.fileSubsidyChequeDetails?.trim()
              ? { fileSubsidyChequeDetails: p.fileSubsidyChequeDetails.trim() }
              : {}),
          }
        }
        return apiRequest(`/admin/quotations/${quotationId}/file-login`, {
          method: "PATCH",
          body,
        })
      },
    },

    dealers: {
      getAll: async (params?: {
        page?: number
        limit?: number
        search?: string
        isActive?: boolean
        includeInactive?: boolean
      }) => {
        const queryParams = new URLSearchParams()
        if (params) {
          Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined) queryParams.append(key, String(value))
          })
        }
        const query = queryParams.toString()
        return apiRequest(`/admin/dealers${query ? `?${query}` : ""}`)
      },
      
      update: async (dealerId: string, dealerData: any) => {
        return apiRequest(`/admin/dealers/${dealerId}`, {
          method: "PUT",
          body: dealerData,
        })
      },
      
      activate: async (dealerId: string) => {
        return apiRequest(`/admin/dealers/${dealerId}/activate`, {
          method: "PATCH",
        })
      },
    },

    statistics: async (startDate?: string, endDate?: string) => {
      const params = new URLSearchParams()
      if (startDate) params.append("startDate", startDate)
      if (endDate) params.append("endDate", endDate)
      const query = params.toString()
      return apiRequest(`/admin/statistics${query ? `?${query}` : ""}`)
    },

    visitors: {
      create: async (visitorData: any) => {
        return apiRequest("/admin/visitors", {
          method: "POST",
          body: visitorData,
        })
      },

      getAll: async (params?: {
        page?: number
        limit?: number
        search?: string
        isActive?: boolean
        sortBy?: string
        sortOrder?: "asc" | "desc"
      }) => {
        const queryParams = new URLSearchParams()
        if (params) {
          Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined) queryParams.append(key, String(value))
          })
        }
        const query = queryParams.toString()
        return apiRequest(`/admin/visitors${query ? `?${query}` : ""}`)
      },

      getById: async (visitorId: string) => {
        return apiRequest(`/admin/visitors/${visitorId}`)
      },

      update: async (visitorId: string, visitorData: any) => {
        return apiRequest(`/admin/visitors/${visitorId}`, {
          method: "PUT",
          body: visitorData,
        })
      },

      updatePassword: async (visitorId: string, newPassword: string) => {
        return apiRequest(`/admin/visitors/${visitorId}/password`, {
          method: "PUT",
          body: { newPassword },
        })
      },

      delete: async (visitorId: string) => {
        return apiRequest(`/admin/visitors/${visitorId}`, {
          method: "DELETE",
        })
      },
    },

    accountManagers: {
      create: async (accountManagerData: any) => {
        return apiRequest("/admin/account-managers", {
          method: "POST",
          body: accountManagerData,
        })
      },

      getAll: async (params?: {
        page?: number
        limit?: number
        search?: string
        isActive?: boolean
        sortBy?: string
        sortOrder?: "asc" | "desc"
      }) => {
        const queryParams = new URLSearchParams()
        if (params) {
          Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined) queryParams.append(key, String(value))
          })
        }
        const query = queryParams.toString()
        return apiRequest(`/admin/account-managers${query ? `?${query}` : ""}`)
      },

      getById: async (accountManagerId: string) => {
        return apiRequest(`/admin/account-managers/${accountManagerId}`)
      },

      getHistory: async (accountManagerId: string, params?: {
        page?: number
        limit?: number
        startDate?: string
        endDate?: string
      }) => {
        const queryParams = new URLSearchParams()
        if (params) {
          Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined) queryParams.append(key, String(value))
          })
        }
        const query = queryParams.toString()
        return apiRequest(`/admin/account-managers/${accountManagerId}/history${query ? `?${query}` : ""}`)
      },

      update: async (accountManagerId: string, accountManagerData: any) => {
        return apiRequest(`/admin/account-managers/${accountManagerId}`, {
          method: "PUT",
          body: accountManagerData,
        })
      },

      updatePassword: async (accountManagerId: string, newPassword: string) => {
        return apiRequest(`/admin/account-managers/${accountManagerId}/password`, {
          method: "PUT",
          body: { newPassword },
        })
      },

      activate: async (accountManagerId: string) => {
        return apiRequest(`/admin/account-managers/${accountManagerId}/activate`, {
          method: "PATCH",
        })
      },

      deactivate: async (accountManagerId: string) => {
        return apiRequest(`/admin/account-managers/${accountManagerId}/deactivate`, {
          method: "PATCH",
        })
      },

      delete: async (accountManagerId: string) => {
        return apiRequest(`/admin/account-managers/${accountManagerId}`, {
          method: "DELETE",
        })
      },
    },
  },

  // System Config
  config: {
    getProducts: async (category?: string) => {
      const query = category ? `?category=${category}` : ""
      return apiRequest(`/config/products${query}`)
    },

    getStates: async () => {
      return apiRequest("/config/states")
    },
  },

  // Admin Product Management
  adminProducts: {
    updateProducts: async (productData: any) => {
      // Note: This endpoint needs to be implemented on the backend
      // See BACKEND_PRODUCT_CATALOG_API.md for implementation details
      return apiRequest("/config/products", {
        method: "PUT",
        body: productData,
        requiresAuth: true,
      })
    },

    getProducts: async () => {
      return apiRequest("/config/products", {
        requiresAuth: true,
      })
    },
  },
}

// api is already exported above, so we only export the other items here
export { ApiError, getAuthToken, clearAuthTokens }
export type { ApiResponse }



