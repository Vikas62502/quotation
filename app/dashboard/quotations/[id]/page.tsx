"use client"

import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { DashboardNav } from "@/components/dashboard-nav"
import { QuotationDetailsDialog } from "@/components/quotation-details-dialog"
import type { Quotation } from "@/lib/quotation-context"

export default function QuotationDetailPage() {
  const { isAuthenticated, dealer } = useAuth()
  const router = useRouter()
  const params = useParams()
  const quotationId = params?.id as string
  const [quotation, setQuotation] = useState<Quotation | null>(null)
  const [dialogOpen, setDialogOpen] = useState(true)

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/login")
      return
    }

    // Load quotation from localStorage
    const all = JSON.parse(localStorage.getItem("quotations") || "[]")
    const found = all.find(
      (q: Quotation) => q.id === quotationId && q.dealerId === dealer?.id,
    )

    if (found) {
      setQuotation(found)
    } else {
      // If quotation not found, redirect to quotations list
      router.push("/dashboard/quotations")
    }
  }, [isAuthenticated, router, dealer, quotationId])

  const handleDialogClose = (open: boolean) => {
    setDialogOpen(open)
    if (!open) {
      // Navigate back to quotations list when dialog closes
      router.push("/dashboard/quotations")
    }
  }

  if (!isAuthenticated) return null

  return (
    <div className="min-h-screen bg-background">
      <DashboardNav />
      <main className="container mx-auto px-4 py-8">
        {/* Quotation Details Dialog */}
        <QuotationDetailsDialog
          quotation={quotation}
          open={dialogOpen}
          onOpenChange={handleDialogClose}
        />
      </main>
    </div>
  )
}









