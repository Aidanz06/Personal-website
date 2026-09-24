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

describe('the pond frame', () => {
  for (const file of FRAMES) {
    const source = readFileSync(join(process.cwd(), file), 'utf8')
    const frame = /className="([^"]*\bfixed\b[^"]*)"\s*>\s*(?:\{\/\*[\s\S]*?\*\/\}\s*)?<Pond/.exec(source)?.[1]

    it(`${file} has a fixed frame around its pond`, () => {
      expect(frame, 'no fixed frame found directly around <Pond>').toBeDefined()
    })

    it(`${file} sizes it in vh, like the page, not to the visible viewport`, () => {
      expect(frame).not.toMatch(/\binset-0\b/)
      expect(frame).toMatch(/\bh-screen\b/)
      expect(frame).toMatch(/\btop-0\b/)
    })
  }
})
