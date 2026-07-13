"use client"

import { useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Package } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { DashboardNav } from "@/components/dashboard-nav"
import { Button } from "@/components/ui/button"
import { SuperAdminInventoryPanel } from "@/components/inventory/super-admin-inventory-panel"
import { getAuthToken } from "@/lib/api"
import {
  buildInventoryAuthUserFromQuotationSession,
  isQuotationAdminAccess,
} from "@/lib/admin-access"
import { authService as inventoryAuthService } from "@/inventory-sa/lib/auth"
import { resolveApiBaseUrl } from "@/lib/resolve-api-base-url"

export default function InventoryPage() {
  const { isAuthenticated, role, dealer, authReady } = useAuth()
  const router = useRouter()

  const canAccess = isQuotationAdminAccess({
    role,
    username: dealer?.username,
  })

  // Sync quotation Admin session → inventory keys (no second login)
  useEffect(() => {
    if (!authReady || !isAuthenticated || !canAccess) return
    const token =
      getAuthToken() ||
      (typeof window !== "undefined"
        ? localStorage.getItem("authToken") || localStorage.getItem("auth_token")
        : null)
    if (!token || !dealer) return
    inventoryAuthService.setToken(token)
    inventoryAuthService.setUser(
      buildInventoryAuthUserFromQuotationSession({
        id: dealer.id,
        username: dealer.username,
        firstName: dealer.firstName,
        lastName: dealer.lastName,
        role: role || "admin",
        isActive: dealer.isActive ?? true,
        loginUser: {
          role: role || "admin",
          inventoryAccess: true,
          requiresInventoryLogin: false,
          inventoryRole: "super-admin",
        },
      })
    )
  }, [authReady, isAuthenticated, canAccess, dealer, role])

  useEffect(() => {
    if (!authReady) return
    if (!isAuthenticated) {
      router.push("/login")
      return
    }
    if (!canAccess) {
      router.push("/dashboard")
    }
  }, [authReady, isAuthenticated, canAccess, router])

  const getToken = useCallback(() => {
    return (
      getAuthToken() ||
      inventoryAuthService.getToken() ||
      (typeof window !== "undefined"
        ? localStorage.getItem("authToken") || localStorage.getItem("auth_token")
        : null)
    )
  }, [])

  if (!authReady || !isAuthenticated || !canAccess) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground text-sm">Loading inventory…</p>
      </div>
    )
  }

  const displayName =
    [dealer?.firstName, dealer?.lastName].filter(Boolean).join(" ").trim() ||
    dealer?.username ||
    (role === "super-admin" ? "Super Admin" : "Admin")

  return (
    <div className="min-h-screen bg-background">
      <DashboardNav />
      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6">
        <div className="mb-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Package className="w-4 h-4 text-primary" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-semibold text-foreground">Super Admin Inventory</h1>
              <p className="text-sm text-muted-foreground">
                Welcome {displayName} — using your Admin session (no extra login).
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push("/dashboard/admin")}
            className="gap-2 shrink-0 self-start sm:self-auto"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Admin
          </Button>
        </div>

        <SuperAdminInventoryPanel
          getAuthToken={getToken}
          apiBaseUrl={resolveApiBaseUrl()}
          userName={displayName}
        />
      </main>
    </div>
  )
}
