import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Captions and labels around an open picture. Critique of 2026-09-24 (third
 * run), both reproduced at 375×667 with touch emulation.
 */

const pages = {
  home: readFileSync(join(process.cwd(), 'components/PondHome.tsx'), 'utf8'),
  listening: readFileSync(join(process.cwd(), 'components/ListeningPond.tsx'), 'utf8'),
}

describe('the caption of an open picture', () => {
  for (const [page, source] of Object.entries(pages)) {
    it(`${page}: scrolls with its picture instead of staying where it first landed`, () => {
      // Pinned, then scrolled 120px: the picture moved with its rock, and the
      // position:fixed caption stayed put, floating in the water below it.
      expect(source).not.toMatch(/className="pointer-events-none fixed"/)
      expect(source).toMatch(/captionTop/)
    })
  }
})

describe('labels while a picture opens', () => {
  it('step aside as soon as a picture starts opening, not after it has settled', () => {
    // After an arrow key the names and the focus ring sat on the surfacing
    // picture for ~3.5s, until the settled rect arrived.
    expect(pages.home).toMatch(/const stepAside = photoOpen \|\| \(activePhoto !== null && !reducedMotion\)/)
  })

  it('stay put under reduced motion, where the picture never animates open', () => {
    expect(pages.home).toMatch(/useReducedMotion\(\)/)
  })
})
