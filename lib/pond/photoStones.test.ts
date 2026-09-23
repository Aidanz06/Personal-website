import { describe, expect, it } from 'vitest'
import {
  PHOTOS_START_VH,
  PHOTO_STEP_VH,
  placePhotoStones,
  pondDepthVh,
} from './photoStones'
import { HOME_STONES, POND_DEPTH_VH } from './stones'

const photos = Array.from({ length: 8 }, (_, i) => ({
  src: `/_next/image?url=%2Fphotos%2Fp${i}.jpg&w=1200&q=75`,
  original: `/photos/p${i}.jpg`,
}))

describe('placePhotoStones', () => {
  it('makes one rock per photograph, in order', () => {
    const placed = placePhotoStones(photos)
    expect(placed).toHaveLength(8)
    expect(placed.map((p) => p.src)).toEqual(photos.map((p) => p.src))
  })

  it('puts every photo rock below every navigation stone', () => {
    // Nav takes you somewhere, photo rocks open a picture in place. Mixing
    // them would make both ambiguous.
    const deepestNav = Math.max(...HOME_STONES.map((s) => s.depthVh))
    for (const rock of placePhotoStones(photos)) {
      expect(rock.depthVh).toBeGreaterThan(deepestNav)
    }
  })

  it('staggers them rather than stacking a column', () => {
    // A vertical line of rocks reads as a list — the gallery page this
    // replaces.
    const placed = placePhotoStones(photos)
    for (let i = 1; i < placed.length; i++) {
      expect(Math.abs(placed[i]!.xFraction - placed[i - 1]!.xFraction)).toBeGreaterThan(0.2)
    }
  })

  it('keeps every rock well inside the pond', () => {
    for (const rock of placePhotoStones(photos)) {
      expect(rock.xFraction).toBeGreaterThan(0.12)
      expect(rock.xFraction).toBeLessThan(0.88)
    }
  })

  it('spaces them evenly down the pond', () => {
    const placed = placePhotoStones(photos)
    for (let i = 1; i < placed.length; i++) {
      expect(placed[i]!.depthVh - placed[i - 1]!.depthVh).toBeCloseTo(PHOTO_STEP_VH, 6)
    }
  })

  it('makes them smaller than the navigation stones', () => {
    const smallestNav = Math.min(...HOME_STONES.map((s) => s.radiusFraction))
    for (const rock of placePhotoStones(photos)) {
      expect(rock.radiusFraction).toBeLessThan(smallestNav)
    }
  })

  it('gives each one a visible placeholder for its alt text', () => {
    for (const rock of placePhotoStones(photos)) {
      expect(rock.alt).toContain('[')
      expect(rock.alt).toContain('aidan to describe')
    }
  })

  it('names the original file in the alt text, not the optimiser url', () => {
    // "/_next/image?url=..." tells nobody which photograph needs describing.
    const [first] = placePhotoStones(photos)
    expect(first!.alt).toContain('p0.jpg')
    expect(first!.alt).not.toContain('_next')
  })

  it('handles no photographs at all', () => {
    expect(placePhotoStones([])).toEqual([])
  })
})

describe('pondDepthVh', () => {
  it('leaves the pond alone when there are no photographs', () => {
    expect(pondDepthVh(0, POND_DEPTH_VH)).toBe(POND_DEPTH_VH)
  })

  it('grows the pond to fit them, with water to spare below the last', () => {
    const depth = pondDepthVh(8, POND_DEPTH_VH)
    const deepestRock = PHOTOS_START_VH + 7 * PHOTO_STEP_VH
    expect(depth).toBeGreaterThan(deepestRock)
  })

  it('never shrinks below the base depth', () => {
    expect(pondDepthVh(1, POND_DEPTH_VH)).toBeGreaterThanOrEqual(POND_DEPTH_VH)
  })

  it('grows monotonically with the number of photographs', () => {
    let previous = 0
    for (let n = 0; n <= 20; n++) {
      const depth = pondDepthVh(n, POND_DEPTH_VH)
      expect(depth).toBeGreaterThanOrEqual(previous)
      previous = depth
    }
  })
})
