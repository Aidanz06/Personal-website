'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { requestPageSplash } from '@/lib/pond/splash'

/**
 * What a page change looks like.
 *
 * Two things happen at once: the incoming content rises and fades in, and a
 * wave crosses the pond behind it. The wave is the more important half — the
 * water is the only thing on this site that survives a navigation, so it is
 * the only thing that can connect the two pages.
 *
 * Keying the wrapper on the path is what runs the CSS animation: a new key is
 * a new element, and a new element starts its animation from the beginning.
 * The alternative — React's <ViewTransition>, which would also animate the
 * OUTGOING page — wants a wrapper inside every `page.tsx`, and two of these
 * pages are MDX files whose default export is the prose itself. Putting the
 * transition here keeps the content files free of it.
 *
 * Nothing fires on first load. An animation on arrival is a page that looks
 * slow, and there is no previous page for the wave to be coming from.
 */
export function PageFlow({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isFirstRender = useRef(true)

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    requestPageSplash()
  }, [pathname])

  return (
    <div key={pathname} className="page-flow">
      {children}
    </div>
  )
}
