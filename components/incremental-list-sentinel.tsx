"use client"

import type { RefObject } from "react"
import { Button } from "@/components/ui/button"

type IncrementalListSentinelProps = {
  sentinelRef: RefObject<HTMLDivElement | null>
  visibleCount: number
  totalCount: number
  hasMore: boolean
  onLoadMore: () => void
  className?: string
}

export function IncrementalListSentinel({
  sentinelRef,
  visibleCount,
  totalCount,
  hasMore,
  onLoadMore,
  className,
}: IncrementalListSentinelProps) {
  if (totalCount === 0) return null

  return (
    <div className={className ?? "pt-3 pb-1"}>
      <p className="text-xs text-center text-muted-foreground">
        Showing {visibleCount} of {totalCount}
        {hasMore ? " — scroll for more" : ""}
      </p>
      {hasMore ? (
        <>
          <div ref={sentinelRef} className="h-1 w-full" aria-hidden />
          <Button type="button" variant="outline" size="sm" className="w-full mt-2" onClick={onLoadMore}>
            Load more
          </Button>
        </>
      ) : null}
    </div>
  )
}
