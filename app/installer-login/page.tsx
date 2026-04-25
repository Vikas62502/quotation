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
import { Eye, EyeOff, Wrench } from "lucide-react"

function InstallerLoginForm() {
  const router = useRouter()
  const { loginInstaller, isAuthenticated, role } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [credentials, setCredentials] = useState({ username: "", password: "" })

  useEffect(() => {
    if (!isAuthenticated) return

    const timer = setTimeout(() => {
      if (role === "installer") {
        router.push("/dashboard/installer")
      } else if (role === "metering") {
        router.push("/dashboard/metering")
      } else if (role === "baldev") {
        router.push("/dashboard/baldev")
      } else if (role === "account-management") {
        router.push("/dashboard/account-management")
      } else if (role === "hr") {
        router.push("/dashboard/hr")
      } else if (role === "visitor") {
        router.push("/visitor/dashboard")
      } else if (role === "admin") {
        router.push("/dashboard/admin")
      } else {
        router.push("/dashboard")
      }
    }, 100)

    return () => clearTimeout(timer)
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
      const success = await loginInstaller(credentials.username, credentials.password)
      if (!success) {
        setError("Invalid credentials or you don't have installer access.")
        setIsLoading(false)
        return
      }

      await new Promise((resolve) => setTimeout(resolve, 300))
      window.location.href = "/dashboard/installer"
    } catch (err) {
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
                <Wrench className="w-8 h-8 text-primary" />
              </div>
              <CardTitle className="text-2xl">Installer Login</CardTitle>
              <CardDescription>Login to process pending installation jobs</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin} className="space-y-4">
                {error && <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">{error}</div>}
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
                <Button type="submit" className="w-full h-11 shadow-lg shadow-primary/25" disabled={isLoading}>
                  {isLoading ? "Logging in..." : "Login as Installer"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}

export default function InstallerLoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center">Loading...</div>}>
      <InstallerLoginForm />
    </Suspense>
  )
}
