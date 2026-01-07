// API Configuration
// This file can be used to configure the API base URL at runtime

export const API_CONFIG = {
  baseURL: typeof window !== "undefined" 
    ? (window as any).__API_URL__ || process.env.NEXT_PUBLIC_API_URL || "http://localhost:3050/api"
    : process.env.NEXT_PUBLIC_API_URL || "http://localhost:3050/api",
  
  // Set this to false to use localStorage fallback instead of API
  useApi: process.env.NEXT_PUBLIC_USE_API !== "false",
}

// Function to update API URL at runtime (useful for development)
export function setApiBaseUrl(url: string) {
  if (typeof window !== "undefined") {
    (window as any).__API_URL__ = url
  }
}



