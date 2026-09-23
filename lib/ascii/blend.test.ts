import { describe, expect, it } from 'vitest'
import { blendFactor, exitStrength, smoothstep } from './blend'
import { DEFAULT_INNER_RADIUS, DEFAULT_OUTER_RADIUS } from './constants'

const INNER = DEFAULT_INNER_RADIUS // 60
const OUTER = DEFAULT_OUTER_RADIUS // 180

describe('smoothstep', () => {
  it('is 0 at and below edge0, 1 at and above edge1', () => {
    expect(smoothstep(0, 1, -1)).toBe(0)
    expect(smoothstep(0, 1, 0)).toBe(0)
    expect(smoothstep(0, 1, 1)).toBe(1)
    expect(smoothstep(0, 1, 2)).toBe(1)
  })

  it('is exactly 0.5 at the midpoint', () => {
    expect(smoothstep(0, 1, 0.5)).toBe(0.5)
    expect(smoothstep(60, 180, 120)).toBe(0.5)
  })

  it('is flat at both ends — that is the point of using it', () => {
    // Derivative approaches zero at the edges, so there is no visible crease
    // where the resolved area meets the abstract area.
    const nearStart = smoothstep(0, 1, 0.02) - smoothstep(0, 1, 0.01)
    const nearMiddle = smoothstep(0, 1, 0.51) - smoothstep(0, 1, 0.5)
    const nearEnd = smoothstep(0, 1, 0.99) - smoothstep(0, 1, 0.98)
    expect(nearStart).toBeLessThan(nearMiddle / 10)
    expect(nearEnd).toBeLessThan(nearMiddle / 10)
  })

  it('does not divide by zero on a degenerate range', () => {
    expect(smoothstep(100, 100, 99)).toBe(0)
    expect(smoothstep(100, 100, 100)).toBe(1)
    expect(Number.isNaN(smoothstep(100, 50, 75))).toBe(false)
  })
})

describe('blendFactor at the radii', () => {
  it('is fully resolved at the centre and inside the inner radius', () => {
    expect(blendFactor(0, INNER, OUTER)).toBe(1)
    expect(blendFactor(30, INNER, OUTER)).toBe(1)
    expect(blendFactor(INNER, INNER, OUTER)).toBe(1)
  })

  it('is fully abstract at and beyond the outer radius', () => {
    expect(blendFactor(OUTER, INNER, OUTER)).toBe(0)
    expect(blendFactor(500, INNER, OUTER)).toBe(0)
  })
})

describe('blendFactor between the radii', () => {
  it('is 0.5 exactly halfway between them', () => {
    expect(blendFactor((INNER + OUTER) / 2, INNER, OUTER)).toBe(0.5)
  })

  it('decreases monotonically as distance grows', () => {
    let previous = blendFactor(INNER, INNER, OUTER)
    for (let d = INNER + 5; d <= OUTER; d += 5) {
      const current = blendFactor(d, INNER, OUTER)
      expect(current).toBeLessThanOrEqual(previous)
      previous = current
    }
    expect(previous).toBe(0)
  })

  it('always stays within 0..1', () => {
    for (let d = -50; d <= 400; d += 7) {
      const b = blendFactor(d, INNER, OUTER)
      expect(b).toBeGreaterThanOrEqual(0)
      expect(b).toBeLessThanOrEqual(1)
    }
  })

  it('handles inner === outer as a hard edge', () => {
    expect(blendFactor(99, 100, 100)).toBe(1)
    expect(blendFactor(100, 100, 100)).toBe(0)
  })

  it('does not produce NaN when the radii are inverted', () => {
    // Guards against a slider being dragged past its partner in /lab.
    for (let d = 0; d <= 300; d += 25) {
      expect(Number.isNaN(blendFactor(d, 200, 50))).toBe(false)
    }
  })
})

describe('exitStrength', () => {
  it('is full at the moment the pointer leaves', () => {
    expect(exitStrength(0, 600)).toBe(1)
  })

  it('is zero once the ease has elapsed, and stays there', () => {
    expect(exitStrength(600, 600)).toBe(0)
    expect(exitStrength(5000, 600)).toBe(0)
  })

  it('decays monotonically', () => {
    let previous = 1
    for (let t = 0; t <= 600; t += 50) {
      const s = exitStrength(t, 600)
      expect(s).toBeLessThanOrEqual(previous)
      previous = s
    }
  })

  it('drops fast then settles, rather than fading linearly', () => {
    // easeOutCubic: more than half the effect is gone by the midpoint.
    expect(exitStrength(300, 600)).toBeLessThan(0.5)
    expect(exitStrength(300, 600)).toBeCloseTo(0.125, 3)
  })

  it('treats a zero-length ease as an instant cut', () => {
    expect(exitStrength(1, 0)).toBe(0)
  })
})
