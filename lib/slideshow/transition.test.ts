import { describe, expect, it } from 'vitest'
import {
  DISSOLVE_HOLD,
  dissolveFrame,
  formatCounter,
  stepIndex,
  swipeDirection,
} from './transition'

describe('dissolveFrame', () => {
  it('starts on the outgoing slide with no characters over it', () => {
    expect(dissolveFrame(0)).toEqual({ source: 'from', ascii: 0 })
  })

  it('ends on the incoming slide with no characters over it', () => {
    expect(dissolveFrame(1)).toEqual({ source: 'to', ascii: 0 })
  })

  it('hides the swap completely behind the characters', () => {
    // The moment the underlying image changes, the character layer has to be
    // fully opaque — otherwise the swap is visible as a hard cut, which is
    // the one thing the effect exists to avoid.
    for (const t of [0.45, 0.49, 0.5, 0.51, 0.55]) {
      expect(dissolveFrame(t).ascii).toBe(1)
    }
  })

  it('swaps which slide is underneath exactly at the midpoint', () => {
    expect(dissolveFrame(0.499).source).toBe('from')
    expect(dissolveFrame(0.5).source).toBe('to')
  })

  it('holds on pure characters for a legible beat', () => {
    const full = [0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5,
      0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95, 1]
      .filter((t) => dissolveFrame(t).ascii === 1).length
    // Roughly the configured hold, sampled at 5% intervals.
    expect(full / 21).toBeGreaterThanOrEqual(DISSOLVE_HOLD)
  })

  it('never goes backwards on the way in, or forwards on the way out', () => {
    let previous = -1
    for (let t = 0; t <= 0.5; t += 0.01) {
      const { ascii } = dissolveFrame(t)
      expect(ascii).toBeGreaterThanOrEqual(previous - 1e-9)
      previous = ascii
    }
    previous = 2
    for (let t = 0.5; t <= 1; t += 0.01) {
      const { ascii } = dissolveFrame(t)
      expect(ascii).toBeLessThanOrEqual(previous + 1e-9)
      previous = ascii
    }
  })

  it('stays inside 0..1 however badly it is called', () => {
    for (const t of [-5, -0.001, 1.001, 42, 0.3333]) {
      const { ascii } = dissolveFrame(t)
      expect(ascii).toBeGreaterThanOrEqual(0)
      expect(ascii).toBeLessThanOrEqual(1)
    }
  })
})

describe('stepIndex', () => {
  it('moves one slide at a time', () => {
    expect(stepIndex(3, 1, 12)).toBe(4)
    expect(stepIndex(3, -1, 12)).toBe(2)
  })

  it('stops at the ends rather than wrapping round', () => {
    expect(stepIndex(0, -1, 12)).toBe(0)
    expect(stepIndex(11, 1, 12)).toBe(11)
  })

  it('survives an empty deck', () => {
    expect(stepIndex(0, 1, 0)).toBe(0)
  })
})

describe('formatCounter', () => {
  it('reads as a deck position', () => {
    expect(formatCounter(2, 12)).toBe('03 / 12')
    expect(formatCounter(0, 9)).toBe('01 / 09')
  })

  it('widens for a deck over ninety-nine slides rather than misaligning', () => {
    expect(formatCounter(4, 120)).toBe('005 / 120')
  })
})

describe('swipeDirection', () => {
  it('pulls the next slide in when the finger drags left', () => {
    expect(swipeDirection(-80, 5)).toBe(1)
    expect(swipeDirection(80, 5)).toBe(-1)
  })

  it('ignores a drag too short to be deliberate', () => {
    expect(swipeDirection(-12, 0)).toBe(0)
  })

  it('ignores a scroll, so the slideshow is not a trap on a phone', () => {
    expect(swipeDirection(-60, 200)).toBe(0)
  })

  it('ignores nonsense coordinates', () => {
    expect(swipeDirection(Number.NaN, 0)).toBe(0)
  })
})
