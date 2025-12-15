"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"

export default function VisitorLoginPage() {
  const router = useRouter()
  const { isAuthenticated, role } = useAuth()

  useEffect(() => {
    // Redirect to main login page
    if (isAuthenticated && role === "visitor") {
      router.push("/visitor/dashboard")
    } else {
      router.push("/login")
    }
  }, [isAuthenticated, role, router])

  return null

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!credentials.username || !credentials.password) {
      setError("Please enter username and password")
      return
    }

    setIsLoading(true)
    setError("")

    try {
      // Ensure visitors are seeded before login attempt
      seedDummyData()
      
      const success = await login(credentials.username, credentials.password)
      if (success) {
        // Small delay to ensure state is updated
        setTimeout(() => {
          router.push("/visitor/dashboard")
        }, 100)
      } else {
        // Check if visitors exist in localStorage for debugging
        const visitors = JSON.parse(localStorage.getItem("visitors") || "[]")
        if (visitors.length === 0) {
          setError("No visitors found. Please refresh the page.")
        } else {
          setError("Invalid username or password. Please check your credentials.")
        }
      }
    } catch (err) {
      console.error("Login error:", err)
      setError("Login failed. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <SolarLogo />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1 text-center">
            <CardTitle className="text-2xl font-bold">Visitor Login</CardTitle>
            <CardDescription>Login to view your assigned visits</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              {error && (
                <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md border border-destructive/20">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="Enter your username"
                  value={credentials.username}
                  onChange={(e) => setCredentials({ ...credentials, username: e.target.value })}
                  required
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={credentials.password}
                    onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
                    required
                    disabled={isLoading}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Logging in..." : "Login"}
              </Button>

              <div className="text-center text-sm text-muted-foreground">
                <p>Demo credentials:</p>
                <p className="font-mono text-xs mt-1">
                  visitor1 / visitor123
                  <br />
                  visitor2 / visitor123
                  <br />
                  visitor3 / visitor123
                </p>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}

