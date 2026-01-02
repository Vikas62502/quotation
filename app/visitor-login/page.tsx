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
}
