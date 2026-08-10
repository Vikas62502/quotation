"use client"

import { useState } from "react"
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
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { SolarLogo } from "@/components/solar-logo"
import { PricingSheetViewDialog } from "@/components/pricing-sheet-view-dialog"
import { PRICING_PDF_SCOPE_OPTIONS, type PricingPdfScope } from "@/lib/download-dcr-pricing-pdf"
import { usePricingTables } from "@/lib/use-pricing-tables"
import { Menu, Home, Users, FileText, PlusCircle, LogOut, User, Shield, PhoneCall, Eye, ChevronDown } from "lucide-react"
import { isQuotationAdminAccess } from "@/lib/admin-access"

const getNavItems = (isAdmin: boolean, role: string | null) => {
  // Account Management users should not see regular navigation (they have their own header)
  if (
    role === "account-management" ||
    role === "installer" ||
    role === "installation-team" ||
    role === "metering" ||
    role === "baldev" ||
    role === "hr"
  ) {
    return []
  }

  // If admin, show Admin Panel only (Account Management has separate login)
  if (isAdmin) {
    return [{ href: "/dashboard/admin", label: "Admin Panel", icon: Shield }]
  }

  // For regular dealers, show standard navigation (Account Management has separate login)
  return [
    { href: "/dashboard", label: "Dashboard", icon: Home },
    { href: "/dashboard/customers", label: "Customers", icon: Users },
    { href: "/dashboard/quotations", label: "Quotations", icon: FileText },
    { href: "/dashboard/calling-data", label: "Calling Data", icon: PhoneCall },
  ]
}

export function DashboardNav() {
  const router = useRouter()
  const pathname = usePathname()
  const { dealer, logout, role, accountManager } = useAuth()
  const isAdmin = isQuotationAdminAccess({ role, username: dealer?.username })
  const navItems = getNavItems(isAdmin, role)
  const [pricingViewScope, setPricingViewScope] = useState<PricingPdfScope | null>(null)
  usePricingTables()

  // Don't render navigation for account-management users/routes (they have their own header)
  if (
    role === "account-management" ||
    role === "installer" ||
    role === "installation-team" ||
    role === "metering" ||
    role === "baldev" ||
    role === "hr" ||
    accountManager ||
    pathname.startsWith("/dashboard/account-management") ||
    pathname.startsWith("/dashboard/installer") ||
    pathname.startsWith("/dashboard/metering") ||
    pathname.startsWith("/dashboard/baldev") ||
    pathname.startsWith("/dashboard/hr")
  ) {
    return null
  }

  const handleLogout = async () => {
    await logout()
    router.push("/")
  }

  const showDealerActions = !isAdmin && navItems.length > 0

  return (
    <>
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
              {showDealerActions ? (
                <>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="gap-1.5 text-muted-foreground hover:text-foreground"
                      >
                        <Eye className="w-4 h-4" />
                        Pricing
                        <ChevronDown className="w-3.5 h-3.5 opacity-70" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {PRICING_PDF_SCOPE_OPTIONS.map((opt) => (
                        <DropdownMenuItem
                          key={`nav-view-${opt.value}`}
                          onSelect={() => setPricingViewScope(opt.value as PricingPdfScope)}
                        >
                          <Eye className="w-3.5 h-3.5 mr-2 opacity-70" />
                          View {opt.shortLabel}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button size="sm" onClick={() => router.push("/dashboard/new-quotation")} className="gap-2">
                    <PlusCircle className="w-4 h-4" />
                    New Quotation
                  </Button>
                </>
              ) : null}
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
              <div className="md:hidden">
                <Sheet>
                  <SheetTrigger asChild>
                    <Button variant="ghost" size="icon" aria-label="Open navigation menu">
                      <Menu className="w-5 h-5" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="right" className="w-[85vw] max-w-sm">
                    <SheetHeader>
                      <SheetTitle>Navigation</SheetTitle>
                      <SheetDescription>Move quickly across dashboard sections.</SheetDescription>
                    </SheetHeader>
                    <div className="px-4 pb-4 space-y-2">
                      {navItems.map((item) => (
                        <SheetClose asChild key={item.href}>
                          <Button
                            variant={pathname === item.href ? "default" : "ghost"}
                            className="w-full justify-start gap-2"
                            onClick={() => router.push(item.href)}
                          >
                            <item.icon className="w-4 h-4" />
                            {item.label}
                          </Button>
                        </SheetClose>
                      ))}
                      {showDealerActions ? (
                        <>
                          <p className="text-xs font-medium text-muted-foreground pt-2 px-1">View pricing</p>
                          {PRICING_PDF_SCOPE_OPTIONS.map((opt) => (
                            <SheetClose asChild key={`mobile-view-${opt.value}`}>
                              <Button
                                type="button"
                                variant="ghost"
                                className="w-full justify-start gap-2"
                                onClick={() => setPricingViewScope(opt.value as PricingPdfScope)}
                              >
                                <Eye className="w-4 h-4" />
                                {opt.label}
                              </Button>
                            </SheetClose>
                          ))}
                          <SheetClose asChild>
                            <Button
                              className="w-full justify-start gap-2"
                              onClick={() => router.push("/dashboard/new-quotation")}
                            >
                              <PlusCircle className="w-4 h-4" />
                              New Quotation
                            </Button>
                          </SheetClose>
                        </>
                      ) : null}
                      <SheetClose asChild>
                        <Button
                          variant="outline"
                          className="w-full justify-start gap-2 text-destructive border-destructive/30 hover:text-destructive"
                          onClick={handleLogout}
                        >
                          <LogOut className="w-4 h-4" />
                          Logout
                        </Button>
                      </SheetClose>
                    </div>
                  </SheetContent>
                </Sheet>
              </div>
            </div>
          </div>
        </div>
      </header>

      {pricingViewScope ? (
        <PricingSheetViewDialog
          open={Boolean(pricingViewScope)}
          onOpenChange={(open) => {
            if (!open) setPricingViewScope(null)
          }}
          scope={pricingViewScope}
        />
      ) : null}
    </>
  )
}
