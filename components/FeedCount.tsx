'use client'

import { useEffect, useState } from 'react'
import {
  feedCountCopy,
  loadFeedCount,
  subscribeFeedCount,
  type FeedCountState,
} from '@/lib/feedClient'

/**
 * The line under the name: how many times the koi have been fed today, by
 * everyone. Feeding them is the bucket's job (FoodBucket.tsx).
 *
 * The line keeps its height while the count loads, so nothing below it
 * moves. With no shared count to show (none configured, or the store not
 * answering) it stays empty.
 */
export function FeedCount() {
  const [count, setCount] = useState<FeedCountState>(null)

  useEffect(() => {
    loadFeedCount()
    return subscribeFeedCount(setCount)
  }, [])

  const tally = typeof count === 'number' ? feedCountCopy(count) : null

  return (
    <p className="mt-0.5 min-h-[1.5em] font-mono text-small text-muted">
      {/* Announced politely: a visitor who fed them hears the new total. */}
      <span aria-live="polite">{tally}</span>
    </p>
  )
}
