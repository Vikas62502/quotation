"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import { api, ApiError } from "./api"

// asd

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

export interface AccountManager {
  id: string
  username: string
  firstName: string
  lastName: string
  mobile: string
  email: string
  isActive?: boolean
  createdAt?: string
  emailVerified?: boolean
}

export type UserRole = "dealer" | "visitor" | "admin" | "account-management"

interface AuthContextType {
  dealer: Dealer | null
  visitor: Visitor | null
  accountManager: AccountManager | null
  role: UserRole | null
  isAuthenticated: boolean
  login: (username: string, password: string) => Promise<boolean>
  loginAccountManagement: (username: string, password: string) => Promise<boolean>
  logout: () => void
  register: (dealerData: Dealer & { password: string }) => Promise<boolean>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [dealer, setDealer] = useState<Dealer | null>(null)
  const [visitor, setVisitor] = useState<Visitor | null>(null)
  const [accountManager, setAccountManager] = useState<AccountManager | null>(null)
  const [role, setRole] = useState<UserRole | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  useEffect(() => {
    // Seed dummy data on app initialization (only in development/localStorage mode)
    const useApi = process.env.NEXT_PUBLIC_USE_API !== "false"
    if (!useApi && typeof window !== "undefined") {
      // Import and call seedDummyData to ensure account managers and quotations exist
      import("@/lib/dummy-data").then(({ seedDummyData }) => {
        seedDummyData()
      }).catch((error) => {
        console.error("Error seeding dummy data:", error)
      })
    }
  }, [])

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
          setAccountManager(null)
          setDealer(null)
        } else if (user.role === "account-management" || user.role === "accountManager") {
          setAccountManager(user)
          setRole("account-management")
          setVisitor(null)
          setDealer(null)
        } else {
          setDealer(user)
          setRole(user.role === "admin" ? "admin" : "dealer")
          setAccountManager(null)
          setVisitor(null)
        }
        setIsAuthenticated(true)
      } catch {
        // Invalid saved data, clear it
        localStorage.removeItem("authToken")
        localStorage.removeItem("refreshToken")
        localStorage.removeItem("user")
        localStorage.removeItem("userRole")
        localStorage.removeItem("accountManager")
      }
    } else if (!useApi) {
      // Fallback to localStorage for development (only if API is disabled)
      const savedDealer = localStorage.getItem("dealer")
      const savedVisitor = localStorage.getItem("visitor")
      const savedAccountManager = localStorage.getItem("accountManager")

      if (savedAccountManager) {
        setAccountManager(JSON.parse(savedAccountManager))
        setRole("account-management")
        setIsAuthenticated(true)
        setDealer(null)
        setVisitor(null)
      } else if (savedDealer) {
        setDealer(JSON.parse(savedDealer))
        setRole(savedRole || "dealer")
        setIsAuthenticated(true)
        setAccountManager(null)
        setVisitor(null)
      } else if (savedVisitor) {
        setVisitor(JSON.parse(savedVisitor))
        setRole("visitor")
        setIsAuthenticated(true)
        setAccountManager(null)
        setDealer(null)
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
    setAccountManager(null)
    setRole(null)
    setIsAuthenticated(false)
    localStorage.removeItem("dealer")
    localStorage.removeItem("visitor")
    localStorage.removeItem("accountManager")
    localStorage.removeItem("userRole")
    localStorage.removeItem("authToken")
    localStorage.removeItem("refreshToken")
    localStorage.removeItem("user")
  }

  const loginAccountManagement = async (username: string, password: string): Promise<boolean> => {
    const useApi = process.env.NEXT_PUBLIC_USE_API !== "false"

    if (useApi) {
      try {
        // For account management, use same login endpoint but check for account-management role
        const response = await api.auth.login(username, password)
        const user = response.user
        const userRole = user.role === "account-management" || user.role === "accountManager" ? "account-management" : user.role

        // Only allow account-management role users
        if (userRole !== "account-management") {
          // Not an account management user, reject login
          console.error("Login rejected: User role is not account-management")
          return false
        }

        // Store tokens
        if (response.token) {
          localStorage.setItem("authToken", response.token)
        }
        if (response.refreshToken) {
          localStorage.setItem("refreshToken", response.refreshToken)
        }

        setAccountManager({
          id: user.id,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          mobile: (user as any).mobile || "",
          isActive: (user as any).isActive ?? true,
          emailVerified: (user as any).emailVerified ?? false,
          createdAt: (user as any).createdAt,
        })
        setDealer(null)
        setVisitor(null)

        setRole("account-management")
        setIsAuthenticated(true)
        localStorage.setItem("user", JSON.stringify(user))
        localStorage.setItem("userRole", "account-management")
        localStorage.setItem("accountManager", JSON.stringify({
          id: user.id,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          mobile: (user as any).mobile || "",
        }))
        return true
      } catch (error) {
        console.error("Account Management login error:", error)
        if (error instanceof ApiError) {
          console.error("API Error Code:", error.code)
          console.error("API Error Message:", error.message)
        }
        return false
      }
    } else {
      // Fallback to localStorage for development
      // Check for account management users (stored in separate localStorage key or with special prefix)
      const accountManagers = JSON.parse(localStorage.getItem("accountManagers") || "[]")
      
      // If account managers don't exist, seed them first
      if (accountManagers.length === 0) {
        try {
          const { seedDummyData } = await import("@/lib/dummy-data")
          seedDummyData()
          // Re-fetch after seeding
          const refreshedAccountManagers = JSON.parse(localStorage.getItem("accountManagers") || "[]")
          const foundAccountManager = refreshedAccountManagers.find((am: AccountManager & { password: string }) => 
            am.username === username && am.password === password
          )
          
          if (foundAccountManager) {
            if (foundAccountManager.isActive === false) {
              console.error("Account manager is inactive")
              return false
            }
            
            const { password: _, ...accountManagerData } = foundAccountManager
            setAccountManager(accountManagerData)
            setDealer(null)
            setVisitor(null)
            setRole("account-management")
            setIsAuthenticated(true)
            localStorage.setItem("accountManager", JSON.stringify(accountManagerData))
            localStorage.setItem("userRole", "account-management")
            localStorage.setItem("user", JSON.stringify({
              ...accountManagerData,
              role: "account-management"
            }))
            localStorage.removeItem("dealer")
            localStorage.removeItem("visitor")
            localStorage.removeItem("authToken")
            localStorage.removeItem("refreshToken")
            console.log("Account Management login successful (after seeding):", accountManagerData.username)
            return true
          }
        } catch (seedError) {
          console.error("Error seeding account managers:", seedError)
        }
      }
      
      const foundAccountManager = accountManagers.find((am: AccountManager & { password: string }) => 
        am.username === username && am.password === password
      )

      if (foundAccountManager) {
        // Check if account manager is active
        if (foundAccountManager.isActive === false) {
          console.error("Account manager is inactive")
          return false
        }
        
        const { password: _, ...accountManagerData } = foundAccountManager
        setAccountManager(accountManagerData)
        setDealer(null)
        setVisitor(null)
        setRole("account-management")
        setIsAuthenticated(true)
        
        // Persist to localStorage
        localStorage.setItem("accountManager", JSON.stringify(accountManagerData))
        localStorage.setItem("userRole", "account-management")
        localStorage.setItem("user", JSON.stringify({
          ...accountManagerData,
          role: "account-management"
        }))
        localStorage.removeItem("dealer")
        localStorage.removeItem("visitor")
        localStorage.removeItem("authToken")
        localStorage.removeItem("refreshToken")
        
        console.log("Account Management login successful:", accountManagerData.username)
        return true
      }

      console.error("Account manager not found with username:", username)
      return false
    }
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
    <AuthContext.Provider value={{ dealer, visitor, accountManager, role, isAuthenticated, login, loginAccountManagement, logout, register }}>{children}</AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
