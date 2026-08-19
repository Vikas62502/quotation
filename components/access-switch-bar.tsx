"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SolarLogo } from "@/components/solar-logo"
import { ChevronDown, LogOut, PhoneCall } from "lucide-react"
import { canOpenSection, getAccessOptions, type UserAccessKey } from "@/lib/user-access"
import { cn } from "@/lib/utils"

type Props = {
  current?: UserAccessKey
  title?: string
}

function isSectionActive(key: UserAccessKey, pathname: string, current?: UserAccessKey) {
  if (current) return key === current
  if (key === "quotation") {
    return (
      pathname === "/dashboard" ||
      pathname.startsWith("/dashboard/customers") ||
      pathname.startsWith("/dashboard/quotations") ||
      pathname.startsWith("/dashboard/payments") ||
      pathname.startsWith("/dashboard/calling-data") ||
      pathname.startsWith("/dashboard/new-quotation")
    )
  }
  const href = getAccessOptions([key])[0]?.href
  if (!href) return false
  return pathname === href || pathname.startsWith(href + "/")
}

/**
 * Single primary header for multi-access ops pages (HR, Visitor, Installer, …).
 * Returns null when the user has only one access (page keeps its own header).
 * Do not use together with DashboardNav on Quotation pages — DashboardNav embeds its own switcher.
 */
export function AccessSwitchBar({ current, title }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const { access, logout, role } = useAuth()
  const options = getAccessOptions(access)
  const canUseDealer = canOpenSection(access, role, "quotation") || role === "dealer"
  const callingActive = pathname.startsWith("/dashboard/calling-data")

  if (options.length <= 1) return null

  const currentLabel =
    options.find((item) => isSectionActive(item.key, pathname, current))?.label ||
    title ||
    "Workspace"

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 shadow-sm">
      <div className="container mx-auto px-4">
        <div className="flex h-14 items-center gap-3 justify-between">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <button
              type="button"
              onClick={() => router.push("/dashboard/workspace")}
              className="shrink-0 flex items-center"
            >
              <SolarLogo size="md" />
            </button>
            {title ? (
              <span className="hidden md:inline text-sm font-semibold text-foreground shrink-0 border-l border-border pl-3">
                {title}
              </span>
            ) : null}

            {/* Mobile: Dealer / HR / Visitor in dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="md:hidden h-8 gap-1.5 shrink-0 text-xs"
                >
                  {callingActive ? "Calling Data" : currentLabel}
                  <ChevronDown className="w-3.5 h-3.5 opacity-70" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                {options.map((item) => {
                  const active = isSectionActive(item.key, pathname, current)
                  return (
                    <DropdownMenuItem
                      key={item.key}
                      onSelect={() => router.push(item.href)}
                      className={cn(active && !callingActive && "bg-accent")}
                    >
                      {item.label}
                    </DropdownMenuItem>
                  )
                })}
                {canUseDealer ? (
                  <DropdownMenuItem
                    onSelect={() => router.push("/dashboard/calling-data")}
                    className={cn(callingActive && "bg-accent")}
                  >
                    Calling Data
                  </DropdownMenuItem>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Desktop: pill switcher */}
            <nav className="hidden md:flex items-center gap-0.5 rounded-lg border border-border/70 bg-muted/30 p-0.5 overflow-x-auto min-w-0">
              {options.map((item) => {
                const active = isSectionActive(item.key, pathname, current) && !callingActive
                return (
                  <Button
                    key={item.key}
                    asChild
                    size="sm"
                    variant={active ? "default" : "ghost"}
                    className={cn("h-8 text-xs px-2.5 shrink-0", active && "shadow-sm")}
                  >
                    <Link href={item.href}>{item.label}</Link>
                  </Button>
                )
              })}
              {canUseDealer ? (
                <Button
                  asChild
                  size="sm"
                  variant={callingActive ? "default" : "ghost"}
                  className={cn("h-8 text-xs px-2.5 shrink-0 gap-1", callingActive && "shadow-sm")}
                >
                  <Link href="/dashboard/calling-data">
                    <PhoneCall className="w-3 h-3" />
                    Calling Data
                  </Link>
                </Button>
              ) : null}
            </nav>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1.5 shrink-0"
            onClick={async () => {
              await logout()
              router.push("/")
            }}
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Logout</span>
          </Button>
        </div>
      </div>
    </header>
  )
}

/** True when AccessSwitchBar will render (multi-access). Use to hide duplicate page headers. */
export function useHasMultiAccessBar() {
  const { access } = useAuth()
  return getAccessOptions(access).length > 1
}
