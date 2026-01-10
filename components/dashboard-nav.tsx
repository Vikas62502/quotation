"use client"

import { useRouter, usePathname } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SolarLogo } from "@/components/solar-logo"
import { Menu, X, Home, Users, FileText, PlusCircle, LogOut, User, Shield, Wallet } from "lucide-react"
import { useState } from "react"

const ADMIN_USERNAME = "admin"

const getNavItems = (isAdmin: boolean, role: string | null) => {
  // Account Management users should not see regular navigation (they have their own header)
  if (role === "account-management") {
    return []
  }
  
  // If admin, show Admin Panel only (Account Management has separate login)
  if (isAdmin) {
    return [
      { href: "/dashboard/admin", label: "Admin Panel", icon: Shield },
    ]
  }
  
  // For regular dealers, show standard navigation (Account Management has separate login)
  return [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/dashboard/customers", label: "Customers", icon: Users },
  { href: "/dashboard/quotations", label: "Quotations", icon: FileText },
  { href: "/dashboard/new-quotation", label: "New Quotation", icon: PlusCircle },
]
}

export function DashboardNav() {
  const router = useRouter()
  const pathname = usePathname()
  const { dealer, logout, role } = useAuth()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const isAdmin = dealer?.username === ADMIN_USERNAME
  const navItems = getNavItems(isAdmin, role)
  
  // Don't render navigation for account-management users (they have their own header)
  if (role === "account-management") {
    return null
  }

  const handleLogout = () => {
    logout()
    router.push("/")
  }

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 shadow-sm">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <button onClick={() => router.push("/dashboard")} className="flex items-center">
            <SolarLogo size="md" />
          </button>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <Button
                key={item.href}
                variant={pathname === item.href ? "default" : "ghost"}
                size="sm"
                onClick={() => router.push(item.href)}
                className={`gap-2 ${pathname === item.href ? "" : "text-muted-foreground hover:text-foreground"}`}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </Button>
            ))}
          </nav>

          {/* User Menu */}
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
                    <User className="w-4 h-4 text-primary" />
                  </div>
                  <span className="hidden sm:block font-medium">
                    {dealer?.firstName} {dealer?.lastName}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium">
                    {dealer?.firstName} {dealer?.lastName}
                  </p>
                  <p className="text-xs text-muted-foreground">{dealer?.email}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                  <LogOut className="w-4 h-4 mr-2" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Mobile Menu Toggle */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <nav className="md:hidden py-4 border-t border-border">
            <div className="flex flex-col gap-1">
              {navItems.map((item) => (
                <Button
                  key={item.href}
                  variant={pathname === item.href ? "default" : "ghost"}
                  className={`justify-start gap-2 ${pathname === item.href ? "" : "text-muted-foreground"}`}
                  onClick={() => {
                    router.push(item.href)
                    setMobileMenuOpen(false)
                  }}
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </Button>
              ))}
            </div>
          </nav>
        )}
      </div>
    </header>
  )
}
