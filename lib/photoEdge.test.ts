import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * An opened photograph must not end in a straight line.
 *
 * Critique of 2026-09-24 (second run): opened photos showed a hard top and
 * right edge. The vignette faded the picture into an opaque fill of the
 * ground colour, which is a rectangle of plain ground that hides the water
 * dots around the picture, so the box shows exactly where the dots stop.
 * And the characters under the photograph were stamped unfeathered on the
 * homepage, on the assumption that the opaque fill would cover them.
 */

const pond = readFileSync(join(process.cwd(), 'components/Pond.tsx'), 'utf8')
const stylise = pond.slice(pond.indexOf('function styliseInto'), pond.indexOf('// ---- fine ASCII art'))

describe('the edge of an opened photograph', () => {
  it('fades the picture to transparent, so the water shows through, not to a fill', () => {
    expect(stylise).toMatch(/globalCompositeOperation = 'destination-in'/)
    expect(stylise).not.toMatch(/addColorStop\([^)]*\bground\b/)
  })

  it('fades all four sides, not only the corners a radial reaches', () => {
    // The radial never reaches the long sides of a landscape photograph.
    expect(stylise).toMatch(/createLinearGradient/)
  })

  it('feathers the characters under every photograph, not only ones kept as ASCII', () => {
    expect(pond).not.toMatch(/s\.photoAscii \? PHOTO_FEATHER : 0/)
  })

  it('lets the characters step aside as the real photograph arrives, on every page', () => {
    // With the edge now transparent, a photograph's own characters showed
    // through as a rectangle of koi-red dots around the picture. /listening
    // already handed its characters over to the finished picture; the
    // homepage has to as well, so what is under the fade is plain water.
    expect(pond).toMatch(/const handover = !s\.photoAscii \|\| photo\.art \? photoOpacity\(photoReveal\) : 0/)
  })
})
