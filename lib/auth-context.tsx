"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import { api, ApiError } from "./api"

export interface Dealer {
  id: string
  username: string
  firstName: string
  lastName: string
  mobile: string
  email: string
  gender: string
  dateOfBirth: string
  fatherName: string
  fatherContact: string
  governmentIdType: string
  governmentIdNumber: string
  address: {
    street: string
    city: string
    state: string
    pincode: string
  }
  isActive?: boolean
  createdAt?: string
  emailVerified?: boolean
}

export interface Visitor {
  id: string
  username: string
  password: string
  firstName: string
  lastName: string
  mobile: string
  email: string
  employeeId?: string
  isActive?: boolean
  createdBy?: string
  createdAt?: string
  updatedAt?: string
}

export type UserRole = "dealer" | "visitor" | "admin"

interface AuthContextType {
  dealer: Dealer | null
  visitor: Visitor | null
  role: UserRole | null
  isAuthenticated: boolean
  login: (username: string, password: string) => Promise<boolean>
  logout: () => void
  register: (dealerData: Dealer & { password: string }) => Promise<boolean>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [dealer, setDealer] = useState<Dealer | null>(null)
  const [visitor, setVisitor] = useState<Visitor | null>(null)
  const [role, setRole] = useState<UserRole | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  useEffect(() => {
    const useApi = process.env.NEXT_PUBLIC_USE_API !== "false"

    // Check for existing session from API token
    const token = localStorage.getItem("authToken")
    const savedUser = localStorage.getItem("user")
    const savedRole = localStorage.getItem("userRole") as UserRole | null

    if (token && savedUser) {
      try {
        const user = JSON.parse(savedUser)
        if (user.role === "visitor") {
          setVisitor(user)
          setRole("visitor")
        } else {
          setDealer(user)
          setRole(user.role === "admin" ? "admin" : "dealer")
        }
        setIsAuthenticated(true)
      } catch {
        // Invalid saved data, clear it
        localStorage.removeItem("authToken")
        localStorage.removeItem("refreshToken")
        localStorage.removeItem("user")
        localStorage.removeItem("userRole")
      }
    } else if (!useApi) {
      // Fallback to localStorage for development (only if API is disabled)
      const savedDealer = localStorage.getItem("dealer")
      const savedVisitor = localStorage.getItem("visitor")

      if (savedDealer) {
        setDealer(JSON.parse(savedDealer))
        setRole(savedRole || "dealer")
        setIsAuthenticated(true)
      } else if (savedVisitor) {
        setVisitor(JSON.parse(savedVisitor))
        setRole("visitor")
        setIsAuthenticated(true)
      }
    }
  }, [])

  const login = async (username: string, password: string): Promise<boolean> => {
    const useApi = process.env.NEXT_PUBLIC_USE_API !== "false"

    if (useApi) {
      try {
        const response = await api.auth.login(username, password)
        const user = response.user
        const userRole: UserRole = user.role === "admin" ? "admin" : user.role === "visitor" ? "visitor" : "dealer"

        // Store tokens
        if (response.token) {
          localStorage.setItem("authToken", response.token)
        }
        if (response.refreshToken) {
          localStorage.setItem("refreshToken", response.refreshToken)
        }

        if (userRole === "visitor") {
          setVisitor({
            id: user.id,
            username: user.username,
            password: "",
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            mobile: (user as any).mobile || "",
          })
          setDealer(null)
        } else {
          setDealer({
            id: user.id,
            username: user.username,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            mobile: (user as any).mobile || "",
            gender: (user as any).gender || "",
            dateOfBirth: (user as any).dateOfBirth || "",
            fatherName: (user as any).fatherName || "",
            fatherContact: (user as any).fatherContact || "",
            governmentIdType: (user as any).governmentIdType || "",
            governmentIdNumber: (user as any).governmentIdNumber || "",
            address: (user as any).address || {
              street: "",
              city: "",
              state: "",
              pincode: "",
            },
            isActive: (user as any).isActive ?? true, // Backend should reject login if false
            emailVerified: (user as any).emailVerified ?? false,
            createdAt: (user as any).createdAt,
          })
          setVisitor(null)
        }

        setRole(userRole)
        setIsAuthenticated(true)
        localStorage.setItem("user", JSON.stringify(user))
        localStorage.setItem("userRole", userRole)
        return true
      } catch (error) {
        console.error("Login error:", error)
        // Log more details for debugging
        if (error instanceof ApiError) {
          console.error("API Error Code:", error.code)
          console.error("API Error Message:", error.message)
        }
        return false
      }
    } else {
      // Fallback to localStorage for development
      const dealers = JSON.parse(localStorage.getItem("dealers") || "[]")
      const foundDealer = dealers.find((d: Dealer & { password: string }) => d.username === username && d.password === password)

      if (foundDealer) {
        const { password: _, ...dealerData } = foundDealer
        setDealer(dealerData)
        setVisitor(null)
        const userRole: UserRole = username === "admin" ? "admin" : "dealer"
        setRole(userRole)
        setIsAuthenticated(true)
        localStorage.setItem("dealer", JSON.stringify(dealerData))
        localStorage.setItem("userRole", userRole)
        localStorage.removeItem("visitor")
        return true
      }

      // Check visitors
      const visitors = JSON.parse(localStorage.getItem("visitors") || "[]")
      const foundVisitor = visitors.find((v: Visitor & { password?: string }) => {
        return v.username === username && v.password === password
      })

      if (foundVisitor) {
        const { password: _, ...visitorData } = foundVisitor
        setVisitor(visitorData as Visitor)
        setDealer(null)
        setRole("visitor")
        setIsAuthenticated(true)
        localStorage.setItem("visitor", JSON.stringify(visitorData))
        localStorage.setItem("userRole", "visitor")
        localStorage.removeItem("dealer")
        return true
      }

      return false
    }
  }

  const logout = async () => {
    const useApi = process.env.NEXT_PUBLIC_USE_API !== "false"

    if (useApi) {
      try {
        await api.auth.logout()
      } catch (error) {
        console.error("Logout error:", error)
      }
    }

    setDealer(null)
    setVisitor(null)
    setRole(null)
    setIsAuthenticated(false)
    localStorage.removeItem("dealer")
    localStorage.removeItem("visitor")
    localStorage.removeItem("userRole")
    localStorage.removeItem("authToken")
    localStorage.removeItem("refreshToken")
    localStorage.removeItem("user")
  }

  const register = async (dealerData: Dealer & { password: string }): Promise<boolean> => {
    const useApi = process.env.NEXT_PUBLIC_USE_API !== "false"

    if (useApi) {
      try {
        const registrationData: any = {
          username: dealerData.username,
          password: dealerData.password,
          firstName: dealerData.firstName,
          lastName: dealerData.lastName,
          email: dealerData.email,
          mobile: dealerData.mobile,
          gender: dealerData.gender,
          dateOfBirth: dealerData.dateOfBirth,
          fatherName: dealerData.fatherName,
          fatherContact: dealerData.fatherContact,
          governmentIdType: dealerData.governmentIdType,
          governmentIdNumber: dealerData.governmentIdNumber,
          address: dealerData.address,
        }
        
        // Only include governmentIdImage if it exists and is not empty
        // Note: governmentIdImage is optional according to API spec
        // If the field exists in dealerData but is empty, we omit it
        if ((dealerData as any).governmentIdImage && (dealerData as any).governmentIdImage.trim() !== "") {
          registrationData.governmentIdImage = (dealerData as any).governmentIdImage
        }
        
        await api.dealers.register(registrationData)
        return true
      } catch (error) {
        console.error("Registration error:", error)
        // Re-throw error so it can be handled in the component with proper error messages
        throw error
      }
    } else {
      // Fallback to localStorage for development
      const dealers = JSON.parse(localStorage.getItem("dealers") || "[]")
      const exists = dealers.find((d: Dealer) => d.username === dealerData.username || d.email === dealerData.email)

      if (exists) {
        return false
      }

      dealers.push(dealerData)
      localStorage.setItem("dealers", JSON.stringify(dealers))
      return true
    }
  }

  return (
    <AuthContext.Provider value={{ dealer, visitor, role, isAuthenticated, login, logout, register }}>{children}</AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
