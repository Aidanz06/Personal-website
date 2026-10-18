'use client'

import { useEffect, useRef, useState } from 'react'
import { hoverTracker, type HoverTracker } from '@/lib/pond/hoverIntent'

/**
 * Tells the rocks whether a mouse event over them is the visitor pointing,
 * or the page scrolling a rock under a still pointer. Only the first opens a
 * picture on hover. Keyboard focus and taps don't go through this; they're
 * always intended. See hoverTracker.
 */
export function useHoverIntent(): HoverTracker {
  const times = useRef({ lastPointerMove: 0, lastScroll: 0 })
  const [tracker] = useState(() => hoverTracker(times.current))
  useEffect(() => {
    const moved = () => (times.current.lastPointerMove = performance.now())
    const scrolled = () => (times.current.lastScroll = performance.now())
    window.addEventListener('pointermove', moved, { passive: true })
    window.addEventListener('scroll', scrolled, { passive: true })
    return () => {
      window.removeEventListener('pointermove', moved)
      window.removeEventListener('scroll', scrolled)
    }
  }, [])
  return tracker
}
