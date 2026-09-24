'use client'

import { useEffect, useRef } from 'react'

/**
 * A clip that behaves like an animated GIF: silent, looping, no controls, no
 * play button. It is a moving photograph, not a video you watch.
 *
 * Three things keep it from behaving like a video player:
 *
 * - **`preload="none"` and a poster.** Nothing downloads until the tile is
 *   actually on screen. A page with three clips on it should cost three
 *   still frames until someone scrolls to them.
 * - **It only plays while visible.** An IntersectionObserver starts and stops
 *   it, so a clip three screens up is not decoding in the background.
 * - **Reduced motion stops it dead.** The poster frame is what that visitor
 *   gets, which is the whole point of the preference. This is why the
 *   component exists at all rather than an `autoPlay` attribute: the
 *   attribute cannot ask.
 */
export function LoopingClip({
  src,
  poster,
  alt,
  className,
}: {
  src: string
  poster: string
  alt: string
  className?: string
}) {
  const ref = useRef<HTMLVideoElement | null>(null)

  useEffect(() => {
    const video = ref.current
    if (!video) return

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')

    const update = (visible: boolean) => {
      if (visible && !reducedMotion.matches) {
        void video.play().catch(() => {
          // Declined: the poster frame stays, which is a fine outcome.
        })
      } else if (!video.paused) {
        video.pause()
      }
    }

    let visible = false
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (!entry) return
        visible = entry.isIntersecting
        update(visible)
      },
      { rootMargin: '200px' },
    )
    observer.observe(video)

    const onPreferenceChange = () => update(visible)
    reducedMotion.addEventListener('change', onPreferenceChange)

    return () => {
      observer.disconnect()
      reducedMotion.removeEventListener('change', onPreferenceChange)
    }
  }, [])

  return (
    <video
      ref={ref}
      src={src}
      poster={poster}
      className={className}
      muted
      loop
      playsInline
      preload="none"
      // A looping clip with no controls is a picture that moves, so it is
      // announced as one. Without this a screen reader finds a media element
      // with no name and no way to describe itself.
      role="img"
      aria-label={alt}
    />
  )
}
