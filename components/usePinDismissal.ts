'use client'

import { useEffect } from 'react'
import type { RockEvent } from '@/lib/pond/rockSelection'

/**
 * Let go of a pinned rock the ways a visitor expects to.
 *
 * While a rock is pinned open: a click or tap anywhere that isn't a rock
 * dismisses it — the "tap the water to close" a phone user reaches for, and
 * the way out of a pin a desktop visitor made by clicking a rock they were
 * already hovering. And the pinned rock scrolling out of view dismisses it,
 * so a picture is never left open over a part of the pond its rock has left.
 *
 * Rocks carry `data-rock`, which is how a click on one is told apart from a
 * click on the water; clicking another rock is the reducer's business.
 */
export function usePinDismissal(pinned: number | null, select: (event: RockEvent) => void): void {
  useEffect(() => {
    if (pinned === null) return

    function onPointerDown(event: PointerEvent) {
      const target = event.target instanceof Element ? event.target : null
      if (target?.closest('[data-rock]')) return
      select({ type: 'dismiss' })
    }
    document.addEventListener('pointerdown', onPointerDown)

    let observer: IntersectionObserver | null = null
    const rock = document.querySelector(`[data-rock="${pinned}"]`)
    if (rock) {
      observer = new IntersectionObserver(([entry]) => {
        if (entry && !entry.isIntersecting) select({ type: 'dismiss' })
      })
      observer.observe(rock)
    }

    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      observer?.disconnect()
    }
  }, [pinned, select])
}
