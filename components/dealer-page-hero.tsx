import type { ReactNode } from "react"
import { DEALER_HERO_TONES, type DealerHeroTone } from "@/lib/dealer-portal-ui"
import { cn } from "@/lib/utils"

export function DealerPageHero({
  tone,
  title,
  description,
  action,
  className,
}: {
  tone: DealerHeroTone
  title: string
  description?: string
  action?: ReactNode
  className?: string
}) {
  const colors = DEALER_HERO_TONES[tone]
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border p-5 sm:p-6 mb-6 sm:mb-8 shadow-sm",
        colors.wrap,
        className,
      )}
    >
      <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="min-w-0">
          <h1 className={cn("text-2xl sm:text-3xl font-bold tracking-tight", colors.title)}>{title}</h1>
          {description ? (
            <p className={cn("text-sm sm:text-base mt-1", colors.description)}>{description}</p>
          ) : null}
        </div>
        {action}
      </div>
    </div>
  )
}
