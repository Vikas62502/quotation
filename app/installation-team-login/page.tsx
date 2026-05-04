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
import { Eye, EyeOff, Users } from "lucide-react"

function InstallationTeamLoginForm() {
  const router = useRouter()
  const { loginInstallationTeam, isAuthenticated, role } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [credentials, setCredentials] = useState({ username: "", password: "" })

  useEffect(() => {
    if (!isAuthenticated) return
    const timer = setTimeout(() => {
      if (role === "installation-team") {
        router.push("/dashboard/installer")
      } else if (role === "installer") {
        router.push("/dashboard/installer")
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
      const success = await loginInstallationTeam(credentials.username, credentials.password)
      if (!success) {
        setError("Invalid credentials or this account is not an installation team login.")
        setIsLoading(false)
        return
      }
      await new Promise((resolve) => setTimeout(resolve, 200))
      window.location.href = "/dashboard/installer"
    } catch (err) {
      setIsLoading(false)
      if (err instanceof ApiError) {
        setError(err.message || "Login failed.")
      } else if (err instanceof Error) {
        setError(err.message || "Login failed.")
      } else {
        setError("Login failed. Please try again.")
      }
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <button type="button" onClick={() => router.push("/")} className="flex items-center">
            <SolarLogo size="md" />
          </button>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-4">
          <Card className="shadow-lg border-border/50">
            <CardHeader className="text-center pb-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-primary" />
              </div>
              <CardTitle className="text-2xl">Installation team login</CardTitle>
              <CardDescription>Teams created in Admin → Installation see only assigned jobs.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin} className="space-y-4">
                {error ? (
                  <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">{error}</div>
                ) : null}
                <div className="space-y-2">
                  <Label htmlFor="it-username">Username</Label>
                  <Input
                    id="it-username"
                    value={credentials.username}
                    onChange={(e) => setCredentials((prev) => ({ ...prev, username: e.target.value }))}
                    placeholder="Team username"
                    className="h-11"
                    autoComplete="username"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="it-password">Password</Label>
                  <div className="relative">
                    <Input
                      id="it-password"
                      type={showPassword ? "text" : "password"}
                      value={credentials.password}
                      onChange={(e) => setCredentials((prev) => ({ ...prev, password: e.target.value }))}
                      placeholder="Team password"
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
                  {isLoading ? "Signing in…" : "Sign in as team"}
                </Button>
                <p className="text-xs text-center text-muted-foreground">
                  <button type="button" className="underline hover:text-foreground" onClick={() => router.push("/installer-login")}>
                        Legacy installer login
                  </button>
                </p>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}

export default function InstallationTeamLoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center">Loading…</div>}>
      <InstallationTeamLoginForm />
    </Suspense>
  )
}
