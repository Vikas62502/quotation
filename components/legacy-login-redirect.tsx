"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

/** Legacy login URLs redirect to the single Login page. Access is assigned in Admin. */
export default function LegacyLoginRedirect({ to = "/login" }: { to?: string }) {
  const router = useRouter()
  useEffect(() => {
    router.replace(to)
  }, [router, to])
  return (
    <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
      Redirecting to Login...
    </div>
  )
}
