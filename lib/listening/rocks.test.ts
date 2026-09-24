import { describe, expect, it } from 'vitest'
import {
  BOULDER_DENSITY,
  BOULDER_MIN_RADIUS,
  BOULDER_RADIUS_FRACTION,
  LABEL_LIFT_VH,
  PEBBLES_PER_ROW,
  PEBBLES_START_VH,
  PEBBLE_MIN_RADIUS,
  PEBBLE_PAIR_OFFSET_VH,
  PEBBLE_STEP_VH,
  MIN_POND_DEPTH_VH,
  listeningLayout,
} from './rocks.ts'
import { HOME_STONES, placeStones } from '../pond/stones.ts'
import { MIN_PEBBLE_SIZE, selectPebbles } from './albums.ts'
import type { Boulder, Pebble } from './types.ts'

function pebble(n: number, size = 1): Pebble {
  return {
    album: `Album ${n}`,
    artist: `Artist ${n}`,
    playcount: 100 - n,
    rank: n,
    size,
    cover: `/_next/image?url=cover${n}`,
  }
}

function boulder(n: number): Boulder {
  return {
    album: `Forever ${n}`,
    artist: `Someone ${n}`,
    line: 'a line',
    lineMissing: false,
    cover: `/_next/image?url=b${n}`,
  }
}

const pebbles = Array.from({ length: 7 }, (_, i) => pebble(i + 1, 1 - i * 0.07))
const boulders = Array.from({ length: 3 }, (_, i) => boulder(i + 1))

const VIEWPORTS = [
  [375, 667],
  [768, 1024],
  [1280, 860],
  [1440, 900],
] as const

describe('listeningLayout', () => {
  it('makes one rock per album, pebbles first', () => {
    const { rocks } = listeningLayout(pebbles, boulders)
    expect(rocks).toHaveLength(10)
    expect(rocks.slice(0, 7).every((r) => r.kind === 'pebble')).toBe(true)
    expect(rocks.slice(7).every((r) => r.kind === 'boulder')).toBe(true)
  })

  it('puts every boulder below every pebble', () => {
    // The page goes back in time as it goes down. A boulder among the pebbles
    // would make both meaningless.
    const { rocks } = listeningLayout(pebbles, boulders)
    const deepestPebble = Math.max(
      ...rocks.filter((r) => r.kind === 'pebble').map((r) => r.depthVh),
    )
    for (const rock of rocks.filter((r) => r.kind === 'boulder')) {
      expect(rock.depthVh).toBeGreaterThan(deepestPebble)
    }
  })

  it('is deterministic: the same data gives the same layout', () => {
    // A reload must not reshuffle the pond.
    expect(listeningLayout(pebbles, boulders)).toEqual(listeningLayout(pebbles, boulders))
  })

  it('moves the rocks when the ranking changes, and only then', () => {
    // "As if the current moved them" — placement is derived from the rank, so
    // a new month is a new arrangement.
    const reordered = [pebbles[1]!, pebbles[0]!, ...pebbles.slice(2)]
    const a = listeningLayout(pebbles, boulders).rocks
    const b = listeningLayout(reordered, boulders).rocks
    expect(a[0]!.album).not.toBe(b[0]!.album)
    expect(a[0]!.xFraction).toBe(b[0]!.xFraction)
    expect(a[0]!.depthVh).toBe(b[0]!.depthVh)
  })
})

describe('pebbles', () => {
  it('sizes them by playcount', () => {
    const { rocks } = listeningLayout(pebbles, [])
    for (let i = 1; i < rocks.length; i++) {
      expect(rocks[i]!.radiusFraction).toBeLessThan(rocks[i - 1]!.radiusFraction)
    }
  })

  it('keeps the smallest one a comfortable tap target on a phone', () => {
    // 60px across at the floor, which clears the 44px guideline.
    const smallest = listeningLayout([pebble(1, MIN_PEBBLE_SIZE)], [])
    const [placed] = placeStones(smallest.rocks, 375, 667)
    expect(placed!.radius * 2).toBeGreaterThanOrEqual(56)
    expect(PEBBLE_MIN_RADIUS * 2).toBeGreaterThanOrEqual(56)
  })

  it('puts two in a row, offset so they are not a grid', () => {
    const { rocks } = listeningLayout(pebbles, [])
    expect(rocks[1]!.depthVh - rocks[0]!.depthVh).toBeCloseTo(PEBBLE_PAIR_OFFSET_VH, 6)
    expect(rocks[2]!.depthVh - rocks[0]!.depthVh).toBeCloseTo(PEBBLE_STEP_VH, 6)
    expect(PEBBLES_PER_ROW).toBe(2)
  })

  it('puts a pair on opposite sides, so one cover cannot hide its partner', () => {
    const { rocks } = listeningLayout(pebbles, [])
    for (let i = 0; i + 1 < 7; i += PEBBLES_PER_ROW) {
      expect(Math.abs(rocks[i + 1]!.xFraction - rocks[i]!.xFraction)).toBeGreaterThan(0.3)
    }
  })

  it('leaves the top of the page for the heading and the labels', () => {
    // Heading, intro and two labels come to roughly four tenths of a screen
    // at 375 — but the first row has to peek above the fold, or the page does
    // not look like a pond.
    expect(PEBBLES_START_VH).toBeGreaterThan(0.6)
    expect(PEBBLES_START_VH).toBeLessThan(1)
  })
})

describe('boulders', () => {
  it('is noticeably larger than any pebble, at every viewport', () => {
    const { rocks } = listeningLayout(pebbles, boulders)
    for (const [width, height] of VIEWPORTS) {
      const placed = placeStones(rocks, width, height)
      const biggestPebble = Math.max(
        ...placed.filter((p) => p.spec.kind === 'pebble').map((p) => p.radius),
      )
      const smallestBoulder = Math.min(
        ...placed.filter((p) => p.spec.kind === 'boulder').map((p) => p.radius),
      )
      expect(smallestBoulder, `${width}x${height}`).toBeGreaterThan(biggestPebble * 1.6)
    }
  })

  it('is bigger than a navigation stone, which is the heaviest thing so far', () => {
    const biggestNav = Math.max(...HOME_STONES.map((s) => s.radiusFraction))
    expect(BOULDER_RADIUS_FRACTION).toBeGreaterThan(biggestNav)
  })

  it('carries a denser texture, from the same stone drawing', () => {
    const { rocks } = listeningLayout(pebbles, boulders)
    for (const rock of rocks) {
      if (rock.kind === 'boulder') expect(rock.density).toBe(BOULDER_DENSITY)
      // A pebble carries none at all, so the pond draws it exactly the way it
      // draws a photo rock — no new behaviour anywhere else on the site.
      else expect(rock.density).toBeUndefined()
    }
    expect(BOULDER_DENSITY).toBeGreaterThan(1)
  })

  it('takes a row each, alternating sides', () => {
    const { rocks } = listeningLayout([], boulders)
    expect(rocks[1]!.xFraction).not.toBe(rocks[0]!.xFraction)
    expect(rocks[2]!.xFraction).toBe(rocks[0]!.xFraction)
  })

  it('has a label with clear water above it', () => {
    const { rocks, neverLeaveLabelVh } = listeningLayout(pebbles, boulders)
    const firstBoulder = rocks.find((r) => r.kind === 'boulder')!
    expect(neverLeaveLabelVh).toBeCloseTo(firstBoulder.depthVh - LABEL_LIFT_VH, 6)
    // The label must clear the rock's own top edge at the tightest viewport.
    const [placed] = placeStones([firstBoulder], 375, 667)
    expect(placed!.radius).toBe(BOULDER_MIN_RADIUS)
    const labelY = neverLeaveLabelVh! * 667
    expect(placed!.worldY - placed!.radius - labelY).toBeGreaterThan(40)
  })

  it('has no label when there are no boulders', () => {
    expect(listeningLayout(pebbles, []).neverLeaveLabelVh).toBeNull()
  })
})

describe('spacing', () => {
  it('never overlaps two rocks, at any viewport', () => {
    // Eight pebbles and six boulders is the most this page can hold.
    const many = listeningLayout(
      Array.from({ length: 8 }, (_, i) => pebble(i + 1, 1 - i * 0.06)),
      Array.from({ length: 6 }, (_, i) => boulder(i + 1)),
    )
    for (const [width, height] of VIEWPORTS) {
      const placed = placeStones(many.rocks, width, height)
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
    const many = listeningLayout(
      Array.from({ length: 8 }, (_, i) => pebble(i + 1)),
      Array.from({ length: 6 }, (_, i) => boulder(i + 1)),
    )
    for (const [width, height] of VIEWPORTS) {
      for (const placed of placeStones(many.rocks, width, height)) {
        expect(placed.x - placed.radius, `${width}x${height} left`).toBeGreaterThan(0)
        expect(placed.x + placed.radius, `${width}x${height} right`).toBeLessThan(width)
      }
    }
  })
})

describe('pond depth', () => {
  it('follows the rock count: fewer pebbles is a shorter page', () => {
    const few = listeningLayout(pebbles.slice(0, 2), boulders).depthVh
    const many = listeningLayout(pebbles, boulders).depthVh
    expect(few).toBeLessThan(many)
  })

  it('grows by a row, not by a pebble', () => {
    // Counted from three, because one and two pebbles both land on the
    // minimum depth — a pond has to be a pond even when there is nothing in
    // it.
    const three = listeningLayout(pebbles.slice(0, 3), []).depthVh
    const four = listeningLayout(pebbles.slice(0, 4), []).depthVh
    const five = listeningLayout(pebbles.slice(0, 5), []).depthVh
    // Adding the second rock of a row costs only the pair offset.
    expect(four - three).toBeCloseTo(PEBBLE_PAIR_OFFSET_VH, 6)
    // Opening a new row costs a step.
    expect(five - four).toBeGreaterThan(PEBBLE_PAIR_OFFSET_VH)
  })

  it('has a floor, so one pebble is still a pond', () => {
    expect(listeningLayout(pebbles.slice(0, 1), []).depthVh).toBe(MIN_POND_DEPTH_VH)
  })

  it('moves the boulders up when there are no pebbles at all', () => {
    // The api being down should cost the pebble layer, not leave a screen of
    // empty water where it would have been.
    const withPebbles = listeningLayout(pebbles, boulders)
    const without = listeningLayout([], boulders)
    expect(without.rocks[0]!.depthVh).toBeLessThan(withPebbles.rocks[7]!.depthVh)
    expect(without.rocks[0]!.depthVh).toBeCloseTo(PEBBLES_START_VH, 6)
    expect(without.depthVh).toBeLessThan(withPebbles.depthVh)
  })

  it('keeps a full pond to a sensible length', () => {
    const full = listeningLayout(
      Array.from({ length: 8 }, (_, i) => pebble(i + 1)),
      Array.from({ length: 6 }, (_, i) => boulder(i + 1)),
    )
    expect(full.depthVh).toBeLessThan(8)
  })

  it('still has a pond when there is nothing to put in it', () => {
    const empty = listeningLayout([], [])
    expect(empty.rocks).toEqual([])
    expect(empty.depthVh).toBeGreaterThan(1)
  })
})

describe('covers', () => {
  it('uses the cover when there is one', () => {
    const { rocks } = listeningLayout([pebble(1)], [])
    expect(rocks[0]!.src).toContain('_next/image')
  })

  it('draws the album’s name when there is not', () => {
    // Never a broken image: the rock opens onto the name instead.
    const { rocks } = listeningLayout([{ ...pebble(1), cover: '' }], [])
    expect(rocks[0]!.src.startsWith('data:image/svg+xml')).toBe(true)
    expect(decodeURIComponent(rocks[0]!.src)).toContain('Album 1')
  })

  it('describes a rock with a comma, not a middle dot', () => {
    // "·" is announced as "middle dot", which nobody wants read aloud.
    const { rocks } = listeningLayout([pebble(1)], [])
    expect(rocks[0]!.alt).toBe('Album 1, Artist 1')
  })
})

describe('the real pipeline', () => {
  it('lays out what selectPebbles produces', () => {
    const selected = selectPebbles([
      { album: 'A', artist: 'One', playcount: 60, coverUrl: 'https://img/a.jpg' },
      { album: 'B', artist: 'Two', playcount: 12, coverUrl: '' },
    ])
    const { rocks } = listeningLayout(selected, [])
    expect(rocks).toHaveLength(2)
    expect(rocks[0]!.radiusFraction).toBeGreaterThan(rocks[1]!.radiusFraction)
    expect(rocks[1]!.src.startsWith('data:')).toBe(true)
  })
})
