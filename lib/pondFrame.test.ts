import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * The pond's frame has to be the same height as the page's `vh`.
 *
 * Every stone, rock and label is placed in CSS `vh`, which a phone fixes at
 * its LARGEST viewport height (address bar hidden). The canvas places the
 * same things from its own measured height. A frame of `fixed inset-0`
 * follows the VISIBLE viewport instead, so while the address bar is showing
 * the two disagree: the drawn rocks sit above the buttons you tap by about
 * 80px per screen of depth, and every show/hide of the bar resizes and
 * repaints the canvas mid-scroll. A frame that is `h-screen` (100vh) from the
 * top matches the unit everything else uses and never resizes on scroll.
 */

const FRAMES = ['components/PondHome.tsx', 'components/PondBackdrop.tsx', 'components/ListeningPond.tsx']

/**
 * Second part, found on a real phone (2026-09-24): "the fish and ui jump
 * around a bit as you scroll". A fixed canvas redrawn at the new scroll
 * position lags the page whenever the phone is busy — the page itself is
 * scrolled by the compositor, the canvas only when the main thread gets a
 * frame — and then catches up in a hop. Measured with a 6x CPU throttle and a
 * touch scroll: drawn stones up to 36px off their links, one entirely out of
 * its box.
 *
 * So the pond is no longer fixed. It lives in the page, inside a frame as
 * tall as the page that clips it, and the pond moves itself to the scroll
 * position each time it draws. Between draws the compositor scrolls it with
 * everything else, so the drawing and the HTML over it cannot come apart.
 * The pond's own box is still sized in vh, for the reason above.
 */
describe('the pond frame', () => {
  for (const file of FRAMES) {
    const source = readFileSync(join(process.cwd(), file), 'utf8')
    const frame = /<div\s+className="([^"]*)"\s*>\s*(?:\{\/\*[\s\S]*?\*\/\}\s*)?<Pond\b/.exec(source)?.[1]
    const pondBox = /<Pond\s+className="([^"]*)"/.exec(source)?.[1]

    it(`${file} puts its pond in the page, in a frame that clips it`, () => {
      expect(frame, 'no frame found directly around <Pond>').toBeDefined()
      expect(frame).not.toMatch(/\bfixed\b/)
      expect(frame).toMatch(/\babsolute\b/)
      expect(frame).toMatch(/\binset-0\b/)
      expect(frame).toMatch(/\boverflow-hidden\b/)
    })

    it(`${file} sizes the pond itself in vh, like the page, not to the visible viewport`, () => {
      expect(pondBox).toMatch(/\bh-screen\b/)
    })
  }

  it('the page wrapper is the positioned box the frame fills', () => {
    const flow = readFileSync(join(process.cwd(), 'components/PageFlow.tsx'), 'utf8')
    expect(flow).toMatch(/className="page-flow relative min-h-screen"/)
  })

  it('the pond moves itself to the scroll position when it draws', () => {
    const pond = readFileSync(join(process.cwd(), 'components/Pond.tsx'), 'utf8')
    expect(pond).toMatch(/style\.transform = `translate3d\(0, \$\{/)
  })
})
