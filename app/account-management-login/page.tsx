"use client"

import type React from "react"

import { useState, Suspense, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { ApiError } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { SolarLogo } from "@/components/solar-logo"
import { Eye, EyeOff, Check, Wallet } from "lucide-react"

function AccountManagementLoginForm() {
  const router = useRouter()
  const { loginAccountManagement, isAuthenticated, role } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [showPassword, setShowPassword] = useState(false)

  const [credentials, setCredentials] = useState({
    username: "",
    password: "",
  })

  useEffect(() => {
    // Redirect if already logged in as account management
    if (isAuthenticated && role === "account-management") {
      // Small delay to ensure state is stable
      const timer = setTimeout(() => {
        router.push("/dashboard/account-management")
        router.refresh()
      }, 100)
      return () => clearTimeout(timer)
    } else if (isAuthenticated && role !== "account-management") {
      // If logged in but not as account management, redirect to appropriate page
      const timer = setTimeout(() => {
        if (role === "visitor") {
          router.push("/visitor/dashboard")
        } else if (role === "admin") {
          router.push("/dashboard/admin")
        } else {
          router.push("/dashboard")
        }
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [isAuthenticated, role, router])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!credentials.username || !credentials.password) {
      setError("Please enter username and password")
      return
    }

    setIsLoading(true)
    setError("")

    try {
      const success = await loginAccountManagement(credentials.username, credentials.password)
      if (success) {
        // Clear any previous errors
        setError("")
        
        // Wait a moment to ensure state is persisted to localStorage
        await new Promise(resolve => setTimeout(resolve, 500))
        
        // Verify state was saved
        const savedRole = localStorage.getItem("userRole")
        const savedAccountManager = localStorage.getItem("accountManager")
        
        if (savedRole === "account-management" && savedAccountManager) {
          // Use window.location for reliable navigation with full page reload
          window.location.href = "/dashboard/account-management"
        } else {
          // State not saved properly, try again
          console.error("Login state not saved properly. Retrying...")
          setError("Login succeeded but state was not saved. Please try again.")
          setIsLoading(false)
        }
      } else {
        setError("Invalid credentials or you don't have access to Account Management.")
        setIsLoading(false)
      }
    } catch (err) {
      console.error("Account Management login error:", err)
      setIsLoading(false)
      if (err instanceof ApiError) {
        setError(err.message || "Login failed. Please check your credentials.")
      } else if (err instanceof Error) {
        setError(err.message || "Login failed. Please try again.")
      } else {
        setError("Login failed. Please check your connection and try again.")
      }
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <button onClick={() => router.push("/")} className="flex items-center">
            <SolarLogo size="md" />
          </button>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-4">
          <Card className="shadow-lg border-border/50">
            <CardHeader className="text-center pb-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Wallet className="w-8 h-8 text-primary" />
              </div>
              <CardTitle className="text-2xl">Account Management</CardTitle>
              <CardDescription>Login to access approved quotations</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin} className="space-y-4">
                {error && (
                  <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
                    {error}
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    value={credentials.username}
                    onChange={(e) => setCredentials((prev) => ({ ...prev, username: e.target.value }))}
                    placeholder="Enter your username"
                    className="h-11"
                    autoComplete="username"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={credentials.password}
                      onChange={(e) => setCredentials((prev) => ({ ...prev, password: e.target.value }))}
                      placeholder="Enter your password"
                      className="h-11 pr-10"
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <button
                    type="button"
                    onClick={() => router.push("/forgot-password")}
                    className="text-primary font-medium hover:underline"
                  >
                    Forgot Password?
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push("/login")}
                    className="text-muted-foreground hover:text-primary hover:underline"
                  >
                    Regular Login
                  </button>
                </div>
                <Button type="submit" className="w-full h-11 shadow-lg shadow-primary/25" disabled={isLoading}>
                  {isLoading ? "Logging in..." : "Login to Account Management"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <p className="text-center text-sm text-muted-foreground">
            Need dealer or admin access?{" "}
            <button onClick={() => router.push("/login")} className="text-primary font-medium hover:underline">
              Go to regular login
            </button>
          </p>
        </div>
      </main>
    </div>
  )
}

export default function AccountManagementLoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center">Loading...</div>}>
      <AccountManagementLoginForm />
    </Suspense>
  )
}
