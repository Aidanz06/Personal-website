import { describe, expect, it } from 'vitest'
import {
  DEFAULT_KOI_SETTINGS,
  createKoi,
  followSpine,
  spineWidth,
  stepKoi,
  type Koi,
} from './koi'

const BOUNDS = { width: 800, height: 500 }
const settle = (koi: Koi, others: Koi[], pointer: { x: number; y: number } | null, frames: number) => {
  let current = koi
  for (let i = 0; i < frames; i++) current = stepKoi(current, others, pointer, BOUNDS, 1 / 60)
  return current
}

describe('followSpine', () => {
  it('keeps every segment exactly one length apart', () => {
    const koi = createKoi({ x: 400, y: 250 }, 0, 14, 0.5)
    const moved = followSpine({ x: 430, y: 270 }, koi.spine, 7)
    for (let i = 1; i < moved.length; i++) {
      const d = Math.hypot(moved[i]!.x - moved[i - 1]!.x, moved[i]!.y - moved[i - 1]!.y)
      expect(d).toBeCloseTo(7, 6)
    }
  })

  it('bends rather than pivoting — this is what makes the S-curve', () => {
    // Yank the head sideways; the tail should lag behind, not snap round.
    const koi = createKoi({ x: 400, y: 250 }, 0, 16, 0.5)
    const moved = followSpine({ x: 400, y: 180 }, koi.spine, 7)
    const tail = moved[moved.length - 1]!
    expect(tail.y).toBeGreaterThan(200)
  })

  it('preserves the number of spine points', () => {
    const koi = createKoi({ x: 100, y: 100 }, 1, 20, 0.2)
    expect(followSpine({ x: 110, y: 100 }, koi.spine, 7)).toHaveLength(20)
  })

  it('recovers from a fully collapsed spine instead of staying stuck', () => {
    const collapsed = Array.from({ length: 6 }, () => ({ x: 50, y: 50 }))
    const moved = followSpine({ x: 50, y: 50 }, collapsed, 7)
    for (let i = 1; i < moved.length; i++) {
      const d = Math.hypot(moved[i]!.x - moved[i - 1]!.x, moved[i]!.y - moved[i - 1]!.y)
      expect(d).toBeCloseTo(7, 6)
      expect(Number.isNaN(moved[i]!.x)).toBe(false)
    }
  })
})

describe('spineWidth', () => {
  it('is widest near the head and zero at the tail', () => {
    const count = 16
    const widths = Array.from({ length: count }, (_, i) => spineWidth(i, count))
    const widest = widths.indexOf(Math.max(...widths))
    expect(widest).toBeLessThan(count / 2)
    expect(widths[count - 1]).toBeCloseTo(0, 5)
  })

  it('never goes negative', () => {
    for (let count = 2; count < 40; count++) {
      for (let i = 0; i < count; i++) expect(spineWidth(i, count)).toBeGreaterThanOrEqual(0)
    }
  })

  it('handles a single-point spine', () => {
    expect(spineWidth(0, 1)).toBe(1)
  })
})

describe('stepKoi — attraction', () => {
  it('swims TOWARD the pointer, because the fish must be catchable', () => {
    // The whole interaction depends on this sign. A fish that flees cannot
    // carry a photograph you are meant to hover.
    const koi = createKoi({ x: 400, y: 250 }, 0, 12, 0.5)
    // Inside attractRadius — outside it the fish is supposed to ignore the
    // pointer, which is what the next test checks.
    const pointer = { x: 540, y: 250 }
    const before = Math.hypot(pointer.x - koi.head.x, pointer.y - koi.head.y)
    const after = settle(koi, [], pointer, 120)
    const distance = Math.hypot(pointer.x - after.head.x, pointer.y - after.head.y)
    expect(distance).toBeLessThan(before)
  })

  it('ignores a pointer beyond the attract radius', () => {
    const koi = createKoi({ x: 100, y: 100 }, 0, 12, 0.5)
    const far = { x: 100 + DEFAULT_KOI_SETTINGS.attractRadius * 3, y: 100 }
    const moved = settle({ ...koi, wanderTarget: { x: 100, y: 100 }, wanderTimer: 999 }, [], far, 60)
    // It should still be near where it started, not charging across the pond.
    expect(Math.hypot(moved.head.x - 100, moved.head.y - 100)).toBeLessThan(
      DEFAULT_KOI_SETTINGS.attractRadius,
    )
  })

  it('keeps moving with no pointer at all', () => {
    const koi = createKoi({ x: 400, y: 250 }, 0.7, 12, 0.5)
    const moved = settle(koi, [], null, 90)
    expect(Math.hypot(moved.head.x - 400, moved.head.y - 250)).toBeGreaterThan(1)
  })
})

describe('stepKoi — constraints', () => {
  it('never exceeds its top speed', () => {
    let koi = createKoi({ x: 50, y: 50 }, 0, 12, 0.5)
    for (let i = 0; i < 400; i++) {
      koi = stepKoi(koi, [], { x: 700, y: 400 }, BOUNDS, 1 / 60)
      expect(Math.hypot(koi.velocity.x, koi.velocity.y)).toBeLessThanOrEqual(
        DEFAULT_KOI_SETTINGS.maxSpeed + 1e-6,
      )
    }
  })

  it('stays inside the pond', () => {
    let koi = createKoi({ x: 400, y: 250 }, 0, 12, 0.5)
    for (let i = 0; i < 1500; i++) {
      // Chase a pointer permanently outside the bounds.
      koi = stepKoi(koi, [], { x: -900, y: -900 }, BOUNDS, 1 / 60)
      expect(koi.head.x).toBeGreaterThanOrEqual(0)
      expect(koi.head.y).toBeGreaterThanOrEqual(0)
      expect(koi.head.x).toBeLessThanOrEqual(BOUNDS.width)
      expect(koi.head.y).toBeLessThanOrEqual(BOUNDS.height)
    }
  })

  it('pushes apart rather than stacking up', () => {
    // Two fish on the same pointer must not converge to the same point.
    let a = createKoi({ x: 395, y: 250 }, 0, 12, 0.2)
    let b = createKoi({ x: 405, y: 250 }, Math.PI, 12, 0.8)
    const pointer = { x: 400, y: 250 }
    for (let i = 0; i < 300; i++) {
      const [pa, pb] = [a, b]
      a = stepKoi(pa, [pb], pointer, BOUNDS, 1 / 60)
      b = stepKoi(pb, [pa], pointer, BOUNDS, 1 / 60)
    }
    expect(Math.hypot(a.head.x - b.head.x, a.head.y - b.head.y)).toBeGreaterThan(4)
  })

  it('does not teleport after a stalled tab hands it a huge delta', () => {
    const koi = createKoi({ x: 400, y: 250 }, 0, 12, 0.5)
    const jumped = stepKoi(koi, [], { x: 700, y: 400 }, BOUNDS, 30)
    const moved = Math.hypot(jumped.head.x - 400, jumped.head.y - 250)
    expect(moved).toBeLessThan(DEFAULT_KOI_SETTINGS.maxSpeed * 0.05 + 1)
  })

  it('never produces NaN', () => {
    let koi = createKoi({ x: 400, y: 250 }, 0, 12, 0.5)
    for (let i = 0; i < 500; i++) {
      koi = stepKoi(koi, [], i % 2 ? { x: 400, y: 250 } : null, BOUNDS, 1 / 60)
    }
    expect(Number.isFinite(koi.head.x)).toBe(true)
    expect(Number.isFinite(koi.head.y)).toBe(true)
    for (const p of koi.spine) {
      expect(Number.isFinite(p.x)).toBe(true)
      expect(Number.isFinite(p.y)).toBe(true)
    }
  })
})
