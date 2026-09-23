import { describe, expect, it } from 'vitest'
import { HOME_STONES, POND_DEPTH_VH, placeStones } from './stones'

describe('HOME_STONES', () => {
  it('covers every route except home', () => {
    expect(HOME_STONES.map((s) => s.href).sort()).toEqual([
      '/about',
      '/resume',
      '/tailor-studio',
    ])
  })

  it('leads with tailor studio, the page the site exists to get read', () => {
    expect(HOME_STONES[0]!.href).toBe('/tailor-studio')
  })

  it('is ordered by depth, so the descent never doubles back', () => {
    for (let i = 1; i < HOME_STONES.length; i++) {
      expect(HOME_STONES[i]!.depthVh).toBeGreaterThan(HOME_STONES[i - 1]!.depthVh)
    }
  })

  it('keeps every stone inside the pond, with room to spare', () => {
    for (const stone of HOME_STONES) {
      expect(stone.xFraction).toBeGreaterThan(0.1)
      expect(stone.xFraction).toBeLessThan(0.9)
      expect(stone.depthVh).toBeLessThan(POND_DEPTH_VH)
    }
  })

  it('leaves the first screen clear for the name and availability line', () => {
    // The first stone must sit below the fold, or it competes with the one
    // thing the site exists to say.
    expect(HOME_STONES[0]!.depthVh).toBeGreaterThanOrEqual(0.9)
  })

  it('staggers the stones horizontally so the path reads as a path', () => {
    // Stones in a vertical line look like a list, not stepping stones.
    for (let i = 1; i < HOME_STONES.length; i++) {
      expect(Math.abs(HOME_STONES[i]!.xFraction - HOME_STONES[i - 1]!.xFraction))
        .toBeGreaterThan(0.15)
    }
  })
})

describe('placeStones', () => {
  it('puts a stone where its fractions say', () => {
    const [first] = placeStones(HOME_STONES, 1000, 800)
    expect(first!.x).toBeCloseTo(300, 6)
    expect(first!.worldY).toBeCloseTo(800, 6)
  })

  it('scales depth with the viewport, so the descent feels the same anywhere', () => {
    const tall = placeStones(HOME_STONES, 1000, 1200)
    const short = placeStones(HOME_STONES, 1000, 600)
    expect(tall[0]!.worldY).toBeCloseTo(short[0]!.worldY * 2, 6)
  })

  it('keeps stones a sensible size on any screen', () => {
    for (const [w, h] of [[375, 667], [1440, 900], [3840, 2160], [320, 480]] as const) {
      for (const stone of placeStones(HOME_STONES, w, h)) {
        expect(stone.radius).toBeGreaterThanOrEqual(46)
        expect(stone.radius).toBeLessThanOrEqual(120)
      }
    }
  })

  it('never places a stone off the left or right edge', () => {
    for (const [w, h] of [[375, 667], [1440, 900]] as const) {
      for (const stone of placeStones(HOME_STONES, w, h)) {
        expect(stone.x - stone.radius).toBeGreaterThan(-stone.radius)
        expect(stone.x).toBeLessThan(w)
      }
    }
  })

  it('returns one placement per spec, in order', () => {
    const placed = placeStones(HOME_STONES, 800, 800)
    expect(placed).toHaveLength(HOME_STONES.length)
    expect(placed.map((p) => p.spec.href)).toEqual(HOME_STONES.map((s) => s.href))
  })
})
