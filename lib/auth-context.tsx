"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import { seedDummyData } from "./dummy-data"

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
}

export interface Visitor {
  id: string
  username: string
  password: string
  firstName: string
  lastName: string
  mobile: string
  email: string
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
    seedDummyData()

    // Check for existing session
    const savedDealer = localStorage.getItem("dealer")
    const savedVisitor = localStorage.getItem("visitor")
    const savedRole = localStorage.getItem("userRole") as UserRole | null

    if (savedDealer) {
      setDealer(JSON.parse(savedDealer))
      setRole(savedRole || "dealer")
      setIsAuthenticated(true)
    } else if (savedVisitor) {
      setVisitor(JSON.parse(savedVisitor))
      setRole("visitor")
      setIsAuthenticated(true)
    }
  }, [])

  const login = async (username: string, password: string): Promise<boolean> => {
    // Check dealers first
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

  const logout = () => {
    setDealer(null)
    setVisitor(null)
    setRole(null)
    setIsAuthenticated(false)
    localStorage.removeItem("dealer")
    localStorage.removeItem("visitor")
    localStorage.removeItem("userRole")
  }

  const register = async (dealerData: Dealer & { password: string }): Promise<boolean> => {
    const dealers = JSON.parse(localStorage.getItem("dealers") || "[]")
    const exists = dealers.find((d: Dealer) => d.username === dealerData.username || d.email === dealerData.email)

    if (exists) {
      return false
    }

    dealers.push(dealerData)
    localStorage.setItem("dealers", JSON.stringify(dealers))
    return true
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
