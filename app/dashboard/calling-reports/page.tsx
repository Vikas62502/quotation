"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { canOpenSection, getPostLoginPath } from "@/lib/user-access"

/** Dedicated Calling Reports dashboard — loads report UI via Admin tab shell (ops chrome, not Admin Panel). */
export default function CallingReportsDashboardPage() {
  const router = useRouter()
  const { isAuthenticated, access, role, authReady } = useAuth()

  useEffect(() => {
    if (!authReady) return
    if (!isAuthenticated) {
      router.replace("/login")
      return
    }
    if (!canOpenSection(access, role, "calling_reports") && role !== "admin" && role !== "super-admin") {
      router.replace(getPostLoginPath(access.length ? access : []))
      return
    }
    router.replace("/dashboard/admin?tab=calling-reports")
  }, [authReady, isAuthenticated, access, role, router])

  return (
    <div className="min-h-screen bg-background flex items-center justify-center text-sm text-muted-foreground">
      Opening Calling Reports…
    </div>
  )
}
