// API Configuration
import { DEFAULT_API_BASE_URL, resolveApiBaseUrl } from "./resolve-api-base-url"

export { DEFAULT_API_BASE_URL, resolveApiBaseUrl }

export const API_CONFIG = {
  get baseURL(): string {
    return resolveApiBaseUrl()
  },

  // Set this to false to use localStorage fallback instead of API
  useApi: process.env.NEXT_PUBLIC_USE_API !== "false",
}

// Function to update API URL at runtime (useful for development)
export function setApiBaseUrl(url: string) {
  if (typeof window !== "undefined") {
    (window as any).__API_URL__ = url
  }
}



