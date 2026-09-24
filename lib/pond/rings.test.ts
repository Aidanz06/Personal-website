import { describe, expect, it } from 'vitest'
import { RING_INTERVAL, RING_STRENGTH, ringDue } from './rings'
import { DEFAULT_RIPPLE_SETTINGS } from './ripples'

describe('ringDue', () => {
  it('rings once straight away, so a stone coming into view does something', () => {
    expect(ringDue(null, 10)).toBe(true)
  })

  it('waits the interval between rings', () => {
    expect(ringDue(10, 10 + RING_INTERVAL - 0.01)).toBe(false)
    expect(ringDue(10, 10 + RING_INTERVAL)).toBe(true)
  })

  it('never makes up for rings missed while paused', () => {
    // A minute off-screen is one ring on return, not thirty at once.
    let lastAt: number | null = 0
    let rings = 0
    const now = 60
    if (ringDue(lastAt, now)) {
      rings++
      lastAt = now
    }
    expect(ringDue(lastAt, now)).toBe(false)
    expect(rings).toBe(1)
  })

  it('survives a non-finite clock', () => {
    expect(ringDue(null, NaN)).toBe(false)
    expect(ringDue(NaN, 5)).toBe(true)
  })

  it('rings at a steady rate over time', () => {
    // Each ring fires on the first frame after the interval, so the real
    // period is the interval plus up to one frame — never less, never drifting
    // further than that.
    const frame = 1 / 60
    let lastAt: number | null = null
    const times: number[] = []
    for (let t = 0; t <= 18; t += frame) {
      if (ringDue(lastAt, t)) {
        times.push(t)
        lastAt = t
      }
    }
    for (let i = 1; i < times.length; i++) {
      const gap = times[i]! - times[i - 1]!
      expect(gap).toBeGreaterThanOrEqual(RING_INTERVAL - 1e-9)
      expect(gap).toBeLessThanOrEqual(RING_INTERVAL + frame + 1e-9)
    }
    expect(times.length).toBeGreaterThanOrEqual(9)
  })
})

describe('the ring itself', () => {
  it('rings every one and a half to two seconds', () => {
    expect(RING_INTERVAL).toBeGreaterThanOrEqual(1.5)
    expect(RING_INTERVAL).toBeLessThanOrEqual(2)
  })

  it('disturbs the water far less than a moving pointer does', () => {
    // Per second, not per ripple: the pointer drops a 0.45 ripple every
    // 110ms while it moves, so its ripples stack. Comparing one ring against
    // one pointer ripple is how the first calibration made rings invisible.
    const pointerPerSecond = 0.45 * (1000 / 110)
    const ringPerSecond = RING_STRENGTH / RING_INTERVAL
    expect(ringPerSecond).toBeLessThan(pointerPerSecond / 8)
  })

  it('is strong enough to see', () => {
    // Measured: at 0.2 a ring never lifts a cell past the blank at the bottom
    // of the ramp, and nothing on screen changes.
    expect(RING_STRENGTH).toBeGreaterThan(0.4)
    expect(RING_STRENGTH).toBeLessThan(1)
  })

  it('overlaps the next ring only a little, so they never pile up', () => {
    // A ripple lives 2.4s; at 1.8s apart there are at most two alive, and the
    // older one is nearly faded.
    expect(DEFAULT_RIPPLE_SETTINGS.life / RING_INTERVAL).toBeLessThan(2)
  })
})
