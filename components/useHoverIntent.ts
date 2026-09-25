'use client'

import { useCallback, useEffect, useRef } from 'react'
import { hoverIsIntended } from '@/lib/pond/hoverIntent'

/**
 * Returns a check for "did the visitor point at this, or did the page scroll
 * it under a still pointer?". Only the first opens a picture on hover.
 * Keyboard focus and taps don't go through this; they're always intended.
 */
export function useHoverIntent(): () => boolean {
  const times = useRef({ lastPointerMove: 0, lastScroll: 0 })
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
  return useCallback(() => hoverIsIntended(times.current), [])
}
