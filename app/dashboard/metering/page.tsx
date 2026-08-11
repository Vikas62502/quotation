"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { SolarLogo } from "@/components/solar-logo"
import { LogOut, Gauge } from "lucide-react"
import { MeteringWorkflowPanel } from "@/components/metering/metering-workflow-panel"

export default function MeteringDashboardPage() {
  const router = useRouter()
  const { isAuthenticated, role, meteringUser, logout } = useAuth()

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/metering-login")
      return
    }
    if (role !== "metering") {
      router.push("/login")
    }
  }, [isAuthenticated, role, router])

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <button onClick={() => router.push("/")} className="flex items-center">
            <SolarLogo size="md" />
          </button>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              await logout()
              router.push("/")
            }}
            className="gap-2"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <Gauge className="w-4 h-4 text-primary" />
          </div>
          <h1 className="text-xl font-semibold">Metering Dashboard</h1>
        </div>

        <MeteringWorkflowPanel
          description={`Welcome, ${meteringUser?.firstName || "Metering"}. Meter process: Meter Pending → Meter in Discom → WCC Pending → Meter Installation Pending → Final Step — same flow as Admin → Metering.`}
        />
      </main>
    </div>
  )
}
