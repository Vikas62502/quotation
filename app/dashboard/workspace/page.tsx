"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { SolarLogo } from "@/components/solar-logo"
import { LogOut, ArrowRight, PhoneCall } from "lucide-react"
import { getAccessOptions, getPostLoginPath } from "@/lib/user-access"

export default function WorkspacePage() {
  const router = useRouter()
  const { isAuthenticated, access, logout, dealer, accountManager, installer, meteringUser, baldev, hrUser, visitor } =
    useAuth()

  const options = getAccessOptions(access)
  const displayName =
    dealer?.firstName ||
    accountManager?.firstName ||
    installer?.firstName ||
    meteringUser?.firstName ||
    baldev?.firstName ||
    hrUser?.firstName ||
    visitor?.firstName ||
    "User"

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/login")
      return
    }
    // Admin never uses the workspace chooser
    if (access.includes("admin")) {
      router.replace("/dashboard/admin")
      return
    }
    if (options.length === 0) {
      router.push("/dashboard")
      return
    }
    if (options.length === 1) {
      router.replace(options[0].href)
    }
  }, [isAuthenticated, access, options, router])

  if (!isAuthenticated || access.includes("admin") || options.length <= 1) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-sm text-muted-foreground">
        Loading workspace...
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <button type="button" onClick={() => router.push(getPostLoginPath(access))} className="flex items-center">
            <SolarLogo size="md" />
          </button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={async () => {
              await logout()
              router.push("/")
            }}
          >
            <LogOut className="w-4 h-4" />
            Logout
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-6 max-w-4xl">
        <div>
          <h1 className="text-2xl font-semibold">Welcome, {displayName}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Open only the dashboards Admin assigned to you.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {options.map((item) => (
            <Card
              key={item.key}
              className="cursor-pointer border-border/70 hover:border-primary/40 hover:bg-muted/30 transition-colors"
              onClick={() => router.push(item.href)}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center justify-between gap-2">
                  {item.label}
                  <ArrowRight className="w-4 h-4 text-muted-foreground" />
                </CardTitle>
                <CardDescription>{item.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button size="sm" className="w-full" onClick={() => router.push(item.href)}>
                  Open {item.label}
                </Button>
              </CardContent>
            </Card>
          ))}
          {options.some((item) => item.key === "quotation") ? (
            <Card
              className="cursor-pointer border-border/70 hover:border-primary/40 hover:bg-muted/30 transition-colors"
              onClick={() => router.push("/dashboard/calling-data")}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center justify-between gap-2">
                  Calling Data
                  <PhoneCall className="w-4 h-4 text-muted-foreground" />
                </CardTitle>
                <CardDescription>Open the calling queue for your Dealer access.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button size="sm" className="w-full" onClick={() => router.push("/dashboard/calling-data")}>
                  Open Calling Data
                </Button>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </main>
    </div>
  )
}
