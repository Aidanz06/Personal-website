'use client'

import { Pond } from '@/components/Pond'

/**
 * The pond, behind the inner pages.
 *
 * Same water, same koi, no stones — the navigation lives on the homepage. It
 * is what makes /about and /tailor-studio feel like part of the same place
 * rather than two documents that happen to share a palette, and it is what
 * the page-change wave travels across.
 *
 * **Dimmer than the homepage, deliberately.** The homepage has a name and two
 * words of navigation on it, so the pond can be as bright as it likes. These
 * pages are several hundred words of body text, and a koi at full brightness
 * passing behind a paragraph makes that paragraph hard to read. Everything
 * here is turned down to the point where the water is texture you notice when
 * you look for it.
 */
const QUIET = {
  waterBase: 0.11,
  waterAmplitude: 0.07,
  koiBrightness: 0.5,
  rippleStrength: 0.38,
}

export function PondBackdrop() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10">
      <Pond className="h-full w-full" settings={QUIET} scrollDriven />
    </div>
  )
}
