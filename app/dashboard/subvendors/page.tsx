"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Truck } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { DashboardNav } from "@/components/dashboard-nav"
import { Button } from "@/components/ui/button"
import { AdminSubvendorPanel } from "@/components/admin-subvendor-panel"
import { api } from "@/lib/api"
import { isQuotationAdminAccess } from "@/lib/admin-access"
import { fetchAllPaginatedQuotationListPages } from "@/lib/fetch-paginated-quotation-list"
import { flattenQuotationListRow } from "@/lib/operational-install-queue"
import type { Quotation } from "@/lib/quotation-context"
import { pickDealerList, type SubvendorDealerOption } from "@/lib/admin-subvendors"

export default function SubvendorsPage() {
  const { isAuthenticated, role, dealer, authReady } = useAuth()
  const router = useRouter()
  const [dealers, setDealers] = useState<SubvendorDealerOption[]>([])
  const [quotations, setQuotations] = useState<Quotation[]>([])

  const canAccess = isQuotationAdminAccess({
    role,
    username: dealer?.username,
  })

  const useApi = process.env.NEXT_PUBLIC_USE_API !== "false"

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

  useEffect(() => {
    if (!authReady || !isAuthenticated || !canAccess || !useApi) return
    let cancelled = false
    const load = async () => {
      try {
        const dealersRes = await api.admin.dealers.getAll({ includeInactive: true, limit: 2000 })
        if (!cancelled) setDealers(pickDealerList(dealersRes))
      } catch {
        // Panel still works from the Users list cache on Admin.
      }
      try {
        const { rows } = await fetchAllPaginatedQuotationListPages((page, limit) =>
          api.admin.quotations.getAll({ page, limit, status: "approved" }, { suppressErrorLog: true }),
        )
        if (cancelled) return
        setQuotations(rows.map((row) => flattenQuotationListRow(row) as Quotation))
      } catch {
        // Ledger stays empty until approved quotations load.
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [authReady, isAuthenticated, canAccess, useApi])

  const displayName = useMemo(() => {
    return (
      [dealer?.firstName, dealer?.lastName].filter(Boolean).join(" ").trim() ||
      dealer?.username ||
      "Admin"
    )
  }, [dealer?.firstName, dealer?.lastName, dealer?.username])

  if (!authReady || !isAuthenticated || !canAccess) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading subvendors…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardNav />
      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6">
        <div className="mb-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Truck className="w-4 h-4 text-primary" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-semibold text-foreground">Subvendors</h1>
              <p className="text-sm text-muted-foreground">
                Welcome {displayName} — office inside ledger and outside vendor registration.
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
        <AdminSubvendorPanel dealers={dealers} quotations={quotations} />
      </main>
    </div>
  )
}
