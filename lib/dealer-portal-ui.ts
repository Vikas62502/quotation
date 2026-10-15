import { cn } from "@/lib/utils"

export const DEALER_PORTAL_PAGE_BG = "dealer-portal-canvas"

export const DEALER_HERO_TONES = {
  orange: {
    wrap: "bg-gradient-to-r from-orange-50 to-amber-50/80 border-orange-100",
    title: "text-orange-950",
    description: "text-orange-800/70",
  },
  violet: {
    wrap: "bg-gradient-to-r from-violet-50 to-fuchsia-50/70 border-violet-100",
    title: "text-violet-950",
    description: "text-violet-800/70",
  },
  sky: {
    wrap: "bg-gradient-to-r from-sky-50 to-cyan-50/70 border-sky-100",
    title: "text-sky-950",
    description: "text-sky-800/70",
  },
  emerald: {
    wrap: "bg-gradient-to-r from-emerald-50 to-teal-50/70 border-emerald-100",
    title: "text-emerald-950",
    description: "text-emerald-800/70",
  },
  amber: {
    wrap: "bg-gradient-to-r from-amber-50 to-orange-50/70 border-amber-100",
    title: "text-amber-950",
    description: "text-amber-800/70",
  },
  rose: {
    wrap: "bg-gradient-to-r from-rose-50 to-pink-50/70 border-rose-100",
    title: "text-rose-950",
    description: "text-rose-800/70",
  },
  teal: {
    wrap: "bg-gradient-to-r from-teal-50 to-cyan-50/70 border-teal-100",
    title: "text-teal-950",
    description: "text-teal-800/70",
  },
} as const

export type DealerHeroTone = keyof typeof DEALER_HERO_TONES

export const DEALER_NAV_TONES: Record<string, { active: string; idle: string }> = {
  "/dashboard": {
    active: "bg-orange-100 text-orange-800 hover:bg-orange-100",
    idle: "text-orange-700 hover:bg-orange-50 hover:text-orange-900",
  },
  "/dashboard/customers": {
    active: "bg-violet-100 text-violet-800 hover:bg-violet-100",
    idle: "text-violet-700 hover:bg-violet-50 hover:text-violet-900",
  },
  "/dashboard/quotations": {
    active: "bg-sky-100 text-sky-800 hover:bg-sky-100",
    idle: "text-sky-700 hover:bg-sky-50 hover:text-sky-900",
  },
  "/dashboard/payments": {
    active: "bg-amber-100 text-amber-800 hover:bg-amber-100",
    idle: "text-amber-700 hover:bg-amber-50 hover:text-amber-900",
  },
  "/dashboard/calling-data": {
    active: "bg-rose-100 text-rose-800 hover:bg-rose-100",
    idle: "text-rose-700 hover:bg-rose-50 hover:text-rose-900",
  },
  "/dashboard/customer-journey": {
    active: "bg-teal-100 text-teal-800 hover:bg-teal-100",
    idle: "text-teal-700 hover:bg-teal-50 hover:text-teal-900",
  },
}

export function isDealerNavActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard"
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function dealerNavButtonClass(pathname: string, href: string) {
  const tone = DEALER_NAV_TONES[href]
  const active = isDealerNavActive(pathname, href)
  if (!tone) {
    return active ? "bg-orange-100 text-orange-800" : "text-muted-foreground hover:text-foreground"
  }
  return active ? tone.active : tone.idle
}

export const DEALER_PANEL_TONES = {
  violet: "border-violet-100 bg-white shadow-none",
  sky: "border-sky-100 bg-white shadow-none",
  emerald: "border-emerald-100 bg-white shadow-none",
  amber: "border-amber-100 bg-white shadow-none",
  rose: "border-rose-100 bg-white shadow-none",
  teal: "border-teal-100 bg-white shadow-none",
  orange: "border-orange-100 bg-white shadow-none",
} as const

export const DEALER_CUSTOMER_CARD_TONES = [
  "border-violet-100 bg-violet-50/70 hover:bg-violet-50",
  "border-sky-100 bg-sky-50/70 hover:bg-sky-50",
  "border-emerald-100 bg-emerald-50/70 hover:bg-emerald-50",
  "border-amber-100 bg-amber-50/70 hover:bg-amber-50",
  "border-rose-100 bg-rose-50/70 hover:bg-rose-50",
  "border-teal-100 bg-teal-50/70 hover:bg-teal-50",
] as const

export function dealerCustomerCardClass(index: number) {
  return cn(
    "rounded-xl border p-4 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-sm",
    DEALER_CUSTOMER_CARD_TONES[index % DEALER_CUSTOMER_CARD_TONES.length],
  )
}
