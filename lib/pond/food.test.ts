import { describe, expect, it } from 'vitest'
import {
  DROP_SCATTER,
  MAX_PELLETS,
  PELLETS_PER_DROP,
  PELLET_LIFETIME_S,
  dropPellets,
  eatPellets,
  isWaterTarget,
  nearestPellet,
  pelletPresence,
  stepPellets,
  type Pellet,
} from './food'
import {
  DEFAULT_BODY_RADIUS,
  DEFAULT_KOI_SETTINGS,
  DEFAULT_SEGMENTS,
  createKoi,
  stepKoi,
  type Koi,
} from './koi'

/** Deterministic PRNG, the same one koi.test.ts uses. */
function seeded(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

/** The reach Pond.tsx gives the fish's mouth. */
const REACH = DEFAULT_BODY_RADIUS * 1.5

describe('dropping food', () => {
  it('drops a handful of pellets close to the tap', () => {
    const pellets = dropPellets([], { x: 300, y: 200 }, 5, seeded(1))
    expect(pellets).toHaveLength(PELLETS_PER_DROP)
    for (const p of pellets) {
      expect(Math.hypot(p.x - 300, p.y - 200)).toBeLessThanOrEqual(DROP_SCATTER)
      expect(p.droppedAt).toBe(5)
    }
  })

  it('keeps at most a dozen in the water, letting the oldest go', () => {
    let pellets: Pellet[] = []
    for (let i = 0; i < 10; i++) pellets = dropPellets(pellets, { x: i * 50, y: 0 }, i, seeded(i))
    expect(pellets).toHaveLength(MAX_PELLETS)
    expect(Math.min(...pellets.map((p) => p.droppedAt))).toBeGreaterThan(0)
  })
})

describe('an uneaten pellet', () => {
  const pellet: Pellet = { x: 0, y: 0, droppedAt: 10 }

  it('floats at full presence, then fades as it sinks', () => {
    expect(pelletPresence(pellet, 11)).toBe(1)
    expect(pelletPresence(pellet, 10 + PELLET_LIFETIME_S - 1)).toBeGreaterThan(0)
    expect(pelletPresence(pellet, 10 + PELLET_LIFETIME_S - 1)).toBeLessThan(1)
    expect(pelletPresence(pellet, 10 + PELLET_LIFETIME_S)).toBe(0)
  })

  it('is gone once it has sunk', () => {
    expect(stepPellets([pellet], 10 + PELLET_LIFETIME_S - 0.1)).toHaveLength(1)
    expect(stepPellets([pellet], 10 + PELLET_LIFETIME_S)).toHaveLength(0)
  })
})

describe('eating', () => {
  it('goes for the closest pellet', () => {
    const near: Pellet = { x: 100, y: 0, droppedAt: 0 }
    const far: Pellet = { x: 400, y: 0, droppedAt: 0 }
    expect(nearestPellet({ x: 0, y: 0 }, [far, near])).toBe(near)
    expect(nearestPellet({ x: 0, y: 0 }, [])).toBeNull()
  })

  it('eats what is within reach and leaves the rest', () => {
    const { remaining, eaten } = eatPellets(
      [
        { x: 10, y: 0, droppedAt: 0 },
        { x: 500, y: 0, droppedAt: 0 },
      ],
      { x: 0, y: 0 },
      REACH,
    )
    expect(eaten.map((p) => p.x)).toEqual([10])
    expect(remaining.map((p) => p.x)).toEqual([500])
  })

  it('a fish across the screen swims over and eats a whole drop before it sinks', () => {
    // The loop Pond.tsx runs: the nearest pellet is the fish's target, and
    // anything within reach of its head is eaten.
    const bounds = { width: 1000, height: 600 }
    const rng = seeded(3)
    let koi: Koi = createKoi({ x: 120, y: 120 }, 0, DEFAULT_SEGMENTS, 0.5)
    let pellets = dropPellets([], { x: 820, y: 460 }, 0, rng)
    let seconds = 0
    while (pellets.length > 0 && seconds < PELLET_LIFETIME_S) {
      seconds += 1 / 60
      pellets = stepPellets(pellets, seconds)
      const target = nearestPellet(koi.head, pellets)
      koi = stepKoi(koi, [], target, bounds, 1 / 60, DEFAULT_KOI_SETTINGS, rng)
      pellets = eatPellets(pellets, koi.head, REACH).remaining
    }
    expect(pellets).toHaveLength(0)
    expect(seconds).toBeLessThan(PELLET_LIFETIME_S * 0.75)
  })
})

describe('where a tap feeds', () => {
  /** A stand-in for an element: its own tag and classes, then its ancestors'. */
  function element(...chain: string[]) {
    return {
      closest(selector: string) {
        const parts = selector.split(',').map((s) => s.trim())
        return chain.some((node) => parts.includes(node)) ? {} : null
      },
    }
  }

  it("feeds on the page's own background, which is where the water shows", () => {
    expect(isWaterTarget(element('main', 'body'))).toBe(true)
    expect(isWaterTarget(element('section', 'main', 'body'))).toBe(true)
  })

  it('does not feed on links, buttons, rocks or the theme menu', () => {
    expect(isWaterTarget(element('a', 'nav', 'main'))).toBe(false)
    expect(isWaterTarget(element('span', 'a', 'nav'))).toBe(false)
    expect(isWaterTarget(element('button', 'main'))).toBe(false)
    expect(isWaterTarget(element('[data-rock]', 'main'))).toBe(false)
    expect(isWaterTarget(element('button', '[role="menu"]'))).toBe(false)
  })

  it('does not feed on words, pictures or an inner page’s article', () => {
    expect(isWaterTarget(element('p', 'section'))).toBe(false)
    expect(isWaterTarget(element('h1', 'section'))).toBe(false)
    expect(isWaterTarget(element('img', 'figure'))).toBe(false)
    expect(isWaterTarget(element('div', '.over-water', 'main'))).toBe(false)
  })

  it('does not feed with nothing to aim at', () => {
    expect(isWaterTarget(null)).toBe(false)
  })
})
