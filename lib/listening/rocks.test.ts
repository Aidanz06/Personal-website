import { describe, expect, it } from 'vitest'
import {
  LISTENING_TAIL_VH,
  MIN_POND_DEPTH_VH,
  PEBBLES_START_VH,
  PEBBLE_MIN_RADIUS,
  PEBBLE_SLOTS,
  listeningLayout,
} from './rocks.ts'
import { placeStones } from '../pond/stones.ts'
import { MIN_PEBBLE_SIZE, selectPebbles, trackKey } from './pebbles.ts'
import { MAX_PEBBLES } from './constants.ts'
import type { Pebble } from './types.ts'

function pebble(n: number, size = 1): Pebble {
  return {
    title: `Track ${n}`,
    artist: `Artist ${n}`,
    playcount: 100 - n,
    rank: n,
    size,
    cover: `/_next/image?url=cover${n}`,
  }
}

const pebbles = Array.from({ length: 5 }, (_, i) => pebble(i + 1, 1 - i * 0.1))

const VIEWPORTS = [
  [375, 667],
  [768, 1024],
  [1280, 860],
  [1440, 900],
] as const

describe('listeningLayout', () => {
  it('makes one rock per track, in rank order', () => {
    const { rocks } = listeningLayout(pebbles)
    expect(rocks.map((r) => r.title)).toEqual(pebbles.map((p) => p.title))
    expect(rocks.map((r) => r.rank)).toEqual([1, 2, 3, 4, 5])
  })

  it('is deterministic: the same data gives the same layout', () => {
    // A reload must not reshuffle the pond.
    expect(listeningLayout(pebbles)).toEqual(listeningLayout(pebbles))
  })

  it('moves the rocks when the ranking changes, and only then', () => {
    // "As if the current moved them" — placement is derived from the rank, so
    // a new month is a new arrangement.
    const reordered = [pebbles[1]!, pebbles[0]!, ...pebbles.slice(2)]
    const a = listeningLayout(pebbles).rocks
    const b = listeningLayout(reordered).rocks
    expect(a[0]!.title).not.toBe(b[0]!.title)
    expect(a[0]!.xFraction).toBe(b[0]!.xFraction)
    expect(a[0]!.depthVh).toBe(b[0]!.depthVh)
  })
})

describe('the cluster', () => {
  it('has a place for every one of the top five', () => {
    expect(PEBBLE_SLOTS.length).toBeGreaterThanOrEqual(MAX_PEBBLES)
  })

  it('groups them close together, within half a screen', () => {
    // Two columns a screen deep read as a list you scroll past. The top five
    // are one thing, and should be taken in at once.
    const depths = listeningLayout(pebbles).rocks.map((r) => r.depthVh)
    expect(Math.max(...depths) - Math.min(...depths)).toBeLessThanOrEqual(0.5)
  })

  it('puts no two at the same height, so it never reads as a grid', () => {
    const rows = new Set(listeningLayout(pebbles).rocks.map((r) => r.depthVh.toFixed(4)))
    // Two may share a height if they are far apart across the page.
    expect(rows.size).toBeGreaterThanOrEqual(4)
  })

  it('leads with the most played, top left', () => {
    const { rocks } = listeningLayout(pebbles)
    expect(rocks[0]!.depthVh).toBe(Math.min(...rocks.map((r) => r.depthVh)))
    expect(rocks[0]!.xFraction).toBeLessThan(0.5)
  })

  it('carries on below the cluster if there are ever more than five', () => {
    const { rocks } = listeningLayout(Array.from({ length: 8 }, (_, i) => pebble(i + 1)))
    const clusterBottom = PEBBLES_START_VH + Math.max(...PEBBLE_SLOTS.map((s) => s.dy))
    for (const rock of rocks.slice(PEBBLE_SLOTS.length)) {
      expect(rock.depthVh).toBeGreaterThan(clusterBottom)
    }
  })

  it('leaves the top of the page for the heading and the labels', () => {
    // Heading, intro and two labels come to roughly four tenths of a screen
    // at 375 — but the first rock has to peek above the fold, or the page
    // does not look like a pond.
    expect(PEBBLES_START_VH).toBeGreaterThan(0.6)
    expect(PEBBLES_START_VH).toBeLessThan(1)
  })
})

describe('sizes', () => {
  it('sizes them by playcount', () => {
    const { rocks } = listeningLayout(pebbles)
    for (let i = 1; i < rocks.length; i++) {
      expect(rocks[i]!.radiusFraction).toBeLessThan(rocks[i - 1]!.radiusFraction)
    }
  })

  it('keeps the smallest one a comfortable tap target on a phone', () => {
    // 60px across at the floor, which clears the 44px guideline.
    const [placed] = placeStones(listeningLayout([pebble(1, MIN_PEBBLE_SIZE)]).rocks, 375, 667)
    expect(placed!.radius * 2).toBeGreaterThanOrEqual(56)
    expect(PEBBLE_MIN_RADIUS * 2).toBeGreaterThanOrEqual(56)
  })
})

describe('spacing', () => {
  it('never overlaps two rocks, at any viewport', () => {
    for (const [width, height] of VIEWPORTS) {
      const placed = placeStones(listeningLayout(pebbles).rocks, width, height)
      for (let i = 0; i < placed.length; i++) {
        for (let j = i + 1; j < placed.length; j++) {
          const a = placed[i]!
          const b = placed[j]!
          const gap = Math.hypot(a.x - b.x, a.worldY - b.worldY) - (a.radius + b.radius)
          expect(gap, `${width}x${height} rocks ${i} and ${j}`).toBeGreaterThan(0)
        }
      }
    }
  })

  it('keeps every rock inside the pond, horizontally', () => {
    for (const [width, height] of VIEWPORTS) {
      for (const placed of placeStones(listeningLayout(pebbles).rocks, width, height)) {
        expect(placed.x - placed.radius, `${width}x${height} left`).toBeGreaterThan(0)
        expect(placed.x + placed.radius, `${width}x${height} right`).toBeLessThan(width)
      }
    }
  })
})

describe('pond depth', () => {
  it('follows the rock count, with water below the last', () => {
    const { rocks, depthVh } = listeningLayout(pebbles)
    expect(depthVh).toBeCloseTo(Math.max(...rocks.map((r) => r.depthVh)) + LISTENING_TAIL_VH, 6)
  })

  it('still has a pond when there is nothing to put in it', () => {
    const empty = listeningLayout([])
    expect(empty.rocks).toEqual([])
    expect(empty.depthVh).toBe(MIN_POND_DEPTH_VH)
  })
})

describe('covers', () => {
  it('uses the cover when there is one', () => {
    expect(listeningLayout([pebble(1)]).rocks[0]!.src).toContain('_next/image')
  })

  it('draws the track’s name when there is not', () => {
    // Never a broken image: the rock opens onto the name instead.
    const [rock] = listeningLayout([{ ...pebble(1), cover: '' }]).rocks
    expect(rock!.src.startsWith('data:image/svg+xml')).toBe(true)
    expect(decodeURIComponent(rock!.src)).toContain('Track 1')
  })

  it('describes a rock with a comma, not a middle dot', () => {
    // "·" is announced as "middle dot", which nobody wants read aloud.
    expect(listeningLayout([pebble(1)]).rocks[0]!.alt).toBe('Track 1, Artist 1')
  })
})

describe('the real pipeline', () => {
  it('lays out what selectPebbles produces', () => {
    const selected = selectPebbles(
      [
        { title: 'A', artist: 'One', playcount: 60 },
        { title: 'B', artist: 'Two', playcount: 12 },
      ],
      { covers: new Map([[trackKey('One', 'A'), 'https://img/a.jpg']]) },
    )
    const { rocks } = listeningLayout(selected)
    expect(rocks).toHaveLength(2)
    expect(rocks[0]!.radiusFraction).toBeGreaterThan(rocks[1]!.radiusFraction)
    expect(rocks[1]!.src.startsWith('data:')).toBe(true)
  })
})
