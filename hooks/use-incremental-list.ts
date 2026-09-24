"use client"

import { useCallback, useEffect, useRef, useState, type RefObject } from "react"

const DEFAULT_BATCH_SIZE = 15

type UseIncrementalListOptions = {
  batchSize?: number
  /** When this changes, visible count resets to one batch. */
  resetKey?: string | number
  enabled?: boolean
  /** Server-side total when `items` is only a loaded subset (e.g. paginated API). */
  totalCount?: number
  /** Scroll container for intersection (defaults to viewport). Use for overflow lists. */
  rootRef?: RefObject<Element | null>
}

/**
 * Reveals list items in batches. Loads the next batch when the sentinel enters the viewport
 * (or via `loadMore`).
 */
export function useIncrementalList<T>(
  items: T[],
  options?: UseIncrementalListOptions,
) {
  const batchSize = options?.batchSize ?? DEFAULT_BATCH_SIZE
  const enabled = options?.enabled ?? true
  const resetKey = options?.resetKey
  const totalCountOverride = options?.totalCount
  const rootRef = options?.rootRef

  const [visibleCount, setVisibleCount] = useState(batchSize)
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const itemsLengthRef = useRef(items.length)
  itemsLengthRef.current = items.length
  const prevResetKeyRef = useRef(resetKey)

  useEffect(() => {
    if (prevResetKeyRef.current === resetKey) return
    prevResetKeyRef.current = resetKey
    setVisibleCount(batchSize)
  }, [resetKey, batchSize])

  // Source list can shrink while scrolling (row moved to another tab). Keep the
  // current window instead of jumping back to the first batch.
  useEffect(() => {
    setVisibleCount((prev) => {
      if (items.length <= 0) return prev
      return Math.min(prev, items.length)
    })
  }, [items.length])

  const loadMore = useCallback(() => {
    setVisibleCount((prev) => {
      const cap = itemsLengthRef.current
      if (cap <= 0) return prev
      return Math.min(prev + batchSize, cap)
    })
  }, [batchSize])

  useEffect(() => {
    if (!enabled) return

    const el = sentinelRef.current
    if (!el) return

    const root = rootRef?.current ?? null
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return
        loadMore()
      },
      { root, rootMargin: "0px 0px 280px 0px", threshold: 0 },
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [enabled, loadMore, visibleCount, items.length, rootRef])

  const visibleItems = items.slice(0, Math.min(visibleCount, items.length))
  const listTotal = Math.max(totalCountOverride ?? items.length, items.length)
  const hasMore = visibleCount < items.length

  return {
    visibleItems,
    visibleCount: visibleItems.length,
    totalCount: listTotal,
    hasMore,
    loadMore,
    sentinelRef,
  }
}
