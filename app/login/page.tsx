"use client"

import type React from "react"

import { useState, Suspense, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { ApiError } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { SolarLogo } from "@/components/solar-logo"
import { Eye, EyeOff, Check } from "lucide-react"

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { login, isAuthenticated, role } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [otpSent, setOtpSent] = useState(false)

  useEffect(() => {
    // Redirect if already logged in
    if (isAuthenticated) {
      if (role === "visitor") {
        router.push("/visitor/dashboard")
      } else if (role === "admin") {
        router.push("/dashboard/admin")
      } else {
        router.push("/dashboard")
      }
    }
  }, [isAuthenticated, role, router])

  const [credentials, setCredentials] = useState({
    username: "",
    password: "",
    mobile: "",
    otp: "",
  })

  const registered = searchParams.get("registered") === "true"

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!credentials.username || !credentials.password) {
      setError("Please enter username and password")
      return
    }

    setIsLoading(true)
    setError("")

    try {
      const success = await login(credentials.username, credentials.password)
      if (success) {
        // Get role from localStorage (set by login function)
        const userRole = localStorage.getItem("userRole")
        
        // Small delay to ensure state is updated
        setTimeout(() => {
          if (userRole === "visitor") {
            router.push("/visitor/dashboard")
          } else if (userRole === "admin") {
            router.push("/dashboard/admin")
          } else {
            router.push("/dashboard")
          }
        }, 100)
      } else {
        setError("Invalid username or password. Please check your credentials.")
      }
    } catch (err) {
      console.error("Login error:", err)
      // Provide more specific error messages
      if (err instanceof ApiError) {
        setError(err.message)
      } else if (err instanceof Error) {
        setError(err.message || "Login failed. Please try again.")
      } else {
        setError("Login failed. Please check your connection and try again.")
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleSendOtp = () => {
    if (!/^\d{10}$/.test(credentials.mobile)) {
      setError("Please enter a valid 10-digit mobile number")
      return
    }
    setOtpSent(true)
    setError("")
  }

  const handleOtpLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!credentials.mobile || !credentials.otp) {
      setError("Please enter mobile number and OTP")
      return
    }
    if (credentials.otp.length === 6) {
      setError("OTP login - In demo mode, please use password login")
    } else {
      setError("Please enter a valid 6-digit OTP")
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
          {registered && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm text-center flex items-center justify-center gap-2">
              <Check className="w-4 h-4" />
              Registration successful! Please login with your credentials.
            </div>
          )}

          <Card className="shadow-lg border-border/50">
            <CardHeader className="text-center pb-4">
              <CardTitle className="text-2xl">Welcome Back</CardTitle>
              <CardDescription>Login as Dealer, Admin, or Visitor</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="password">
                <TabsList className="grid w-full grid-cols-2 mb-6">
                  <TabsTrigger value="password">Password</TabsTrigger>
                  <TabsTrigger value="otp">OTP</TabsTrigger>
                </TabsList>

                <TabsContent value="password">
                  <form onSubmit={handlePasswordLogin} className="space-y-4">
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
                        onClick={() => router.push("/reset-password")}
                        className="text-muted-foreground hover:text-primary hover:underline"
                      >
                        Reset Password
                      </button>
                    </div>
                    <Button type="submit" className="w-full h-11 shadow-lg shadow-primary/25" disabled={isLoading}>
                      {isLoading ? "Logging in..." : "Login"}
                    </Button>
                  </form>
                </TabsContent>

                <TabsContent value="otp">
                  <form onSubmit={handleOtpLogin} className="space-y-4">
                    {error && (
                      <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
                        {error}
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label htmlFor="mobile">Mobile Number</Label>
                      <Input
                        id="mobile"
                        type="tel"
                        value={credentials.mobile}
                        onChange={(e) => setCredentials((prev) => ({ ...prev, mobile: e.target.value }))}
                        placeholder="Enter 10-digit mobile number"
                        maxLength={10}
                        className="h-11"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="otp">OTP</Label>
                      <div className="flex gap-2">
                        <Input
                          id="otp"
                          value={credentials.otp}
                          onChange={(e) => setCredentials((prev) => ({ ...prev, otp: e.target.value }))}
                          placeholder="Enter 6-digit OTP"
                          maxLength={6}
                          disabled={!otpSent}
                          className="h-11"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleSendOtp}
                          disabled={otpSent}
                          className="h-11 bg-transparent"
                        >
                          {otpSent ? "Sent" : "Send OTP"}
                        </Button>
                      </div>
                    </div>
                    <Button type="submit" className="w-full h-11" disabled={isLoading || !otpSent}>
                      {isLoading ? "Logging in..." : "Login with OTP"}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <p className="text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{" "}
            <button onClick={() => router.push("/register")} className="text-primary font-medium hover:underline">
              Register here
            </button>
          </p>
        </div>
      </main>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center">Loading...</div>}>
      <LoginForm />
    </Suspense>
  )
}
