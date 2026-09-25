'use client'

import { useEffect, useState } from 'react'

/**
 * Whether the visitor has asked for reduced motion, kept current if they
 * change it while the page is open. False on the server and on the first
 * render, which is the state that shows the most, so nothing is hidden by
 * mistake before the real answer arrives.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReduced(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  return reduced
}
