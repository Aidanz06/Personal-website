import { describe, expect, it } from 'vitest'
import {
  DEEPEST_STONE_VH,
  FIRST_STONE_VH,
  HOME_STONES,
  POND_DEPTH_VH,
  STONE_STEP_VH,
  STONE_TAIL_VH,
  placeStones,
} from './stones'

describe('HOME_STONES', () => {
  it('covers every route except home', () => {
    expect(HOME_STONES.map((s) => s.href).sort()).toEqual([
      '/about',
      '/listening',
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

  it('leaves the first screen clear for the name and the line under it', () => {
    // The first stone must sit below the fold, or it competes with the first
    // thing anyone reads.
    expect(HOME_STONES[0]!.depthVh).toBeGreaterThanOrEqual(0.9)
  })

  it('keeps the navigation within the first three screens', () => {
    // Nobody should have to descend the whole photography section to find a
    // page the site is actually about.
    expect(DEEPEST_STONE_VH).toBeLessThanOrEqual(2.5)
  })

  it('derives depth from position in the list, not from a typed-in number', () => {
    // This is what makes the list extensible: a third stone in step 5 is one
    // entry, not four numbers to re-tune.
    HOME_STONES.forEach((stone, index) => {
      expect(stone.depthVh).toBeCloseTo(FIRST_STONE_VH + index * STONE_STEP_VH, 10)
    })
  })

  it('ends the pond below the last stone, with water to spare', () => {
    expect(POND_DEPTH_VH).toBeCloseTo(DEEPEST_STONE_VH + STONE_TAIL_VH, 10)
    expect(POND_DEPTH_VH).toBeGreaterThan(DEEPEST_STONE_VH)
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
    const spec = HOME_STONES[0]!
    expect(first!.x).toBeCloseTo(1000 * spec.xFraction, 6)
    expect(first!.worldY).toBeCloseTo(800 * spec.depthVh, 6)
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

describe('the listening stone', () => {
  const listening = HOME_STONES.find((s) => s.href === '/listening')!

  it('is the third stone, below about', () => {
    expect(HOME_STONES.map((s) => s.href)).toEqual(['/tailor-studio', '/about', '/listening'])
    expect(listening.label).toBe('listening')
    expect(listening.note).toBe("what's on repeat")
  })

  it('got its depth from the list, not from a number typed in', () => {
    // The whole point of step 1's derivation: adding this stone was one entry.
    expect(listening.depthVh).toBeCloseTo(FIRST_STONE_VH + 2 * STONE_STEP_VH, 10)
    expect(DEEPEST_STONE_VH).toBe(listening.depthVh)
    expect(POND_DEPTH_VH).toBeCloseTo(listening.depthVh + STONE_TAIL_VH, 10)
  })

  it('is the only stone that rings', () => {
    expect(listening.rings).toBe(true)
    for (const stone of HOME_STONES) {
      if (stone !== listening) expect(stone.rings).toBeFalsy()
    }
  })

  it('never overlaps its neighbour, at any viewport', () => {
    for (const [w, h] of [[375, 667], [768, 1024], [1280, 860], [1440, 900]] as const) {
      const placed = placeStones(HOME_STONES, w, h)
      for (let i = 1; i < placed.length; i++) {
        const a = placed[i - 1]!
        const b = placed[i]!
        const gap = Math.hypot(a.x - b.x, a.worldY - b.worldY) - (a.radius + b.radius)
        expect(gap, `${w}x${h} stones ${i - 1} and ${i}`).toBeGreaterThan(0)
      }
    }
  })
})
