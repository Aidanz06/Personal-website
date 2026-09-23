import { describe, expect, it } from 'vitest'
import { DEFAULT_WAVES, waterLuminance, waveHeight, type Wave } from './water'
import { DEFAULT_RIPPLE_SETTINGS, isRippleExpired, rippleContribution, ripplesAt } from './ripples'

describe('waveHeight', () => {
  it('stays within -1..1 everywhere', () => {
    for (let x = 0; x < 2000; x += 37) {
      for (let y = 0; y < 1200; y += 41) {
        for (const t of [0, 1.3, 9.7, 120]) {
          const h = waveHeight(x, y, t)
          expect(h).toBeGreaterThanOrEqual(-1)
          expect(h).toBeLessThanOrEqual(1)
        }
      }
    }
  })

  it('is deterministic — the pond is a pure function of position and time', () => {
    // This is what lets the surface be sampled at any resolution and scrolled
    // to any depth without keeping simulation state.
    expect(waveHeight(123, 456, 7.89)).toBe(waveHeight(123, 456, 7.89))
  })

  it('actually moves over time', () => {
    const still = waveHeight(100, 100, 0)
    const later = waveHeight(100, 100, 1.7)
    expect(Math.abs(later - still)).toBeGreaterThan(0.01)
  })

  it('varies across space at a given instant', () => {
    const values = [0, 80, 160, 240, 320].map((x) => waveHeight(x, 50, 3))
    expect(new Set(values.map((v) => v.toFixed(3))).size).toBeGreaterThan(1)
  })

  it('does not visibly repeat over a screen width', () => {
    // Frequencies sharing a common factor tile, and the eye finds it at once.
    const a = waveHeight(0, 0, 0)
    for (let x = 60; x <= 1400; x += 20) {
      if (Math.abs(waveHeight(x, 0, 0) - a) < 1e-6) {
        expect(x).toBeGreaterThan(1200)
      }
    }
  })

  it('normalises regardless of the amplitudes given', () => {
    const loud: Wave[] = DEFAULT_WAVES.map((w) => ({ ...w, amplitude: w.amplitude * 100 }))
    for (let x = 0; x < 600; x += 53) {
      expect(Math.abs(waveHeight(x, 0, 2, loud))).toBeLessThanOrEqual(1)
    }
  })

  it('returns 0 for no waves rather than dividing by zero', () => {
    expect(waveHeight(10, 10, 1, [])).toBe(0)
  })
})

describe('waterLuminance', () => {
  it('keeps still water dim — it is texture, not content', () => {
    // The reference image works because the field is nearly empty and only
    // the fish are bright.
    for (let x = 0; x < 800; x += 29) {
      const v = waterLuminance(x, 120, 4, 0.1, 0.1)
      expect(v).toBeLessThanOrEqual(0.2 + 1e-9)
    }
  })

  it('never leaves 0..1 even with absurd settings', () => {
    for (const [base, amp] of [[0, 5], [1, 5], [-3, 9], [0.5, 0.9]] as const) {
      for (let x = 0; x < 400; x += 31) {
        const v = waterLuminance(x, 0, 1, base, amp)
        expect(v).toBeGreaterThanOrEqual(0)
        expect(v).toBeLessThanOrEqual(1)
      }
    }
  })
})

describe('ripples', () => {
  const settings = DEFAULT_RIPPLE_SETTINGS
  const ripple = { x: 200, y: 200, startedAt: 10, strength: 1 }

  it('contributes nothing before it starts or after it dies', () => {
    expect(rippleContribution(ripple, 200, 200, 9.5, settings)).toBe(0)
    expect(rippleContribution(ripple, 260, 200, 10 + settings.life, settings)).toBe(0)
    expect(rippleContribution(ripple, 260, 200, 99, settings)).toBe(0)
  })

  it('travels outward — the crest is where the wavefront is', () => {
    // At one second old the front is `speed` px from the origin.
    const age = 1
    const front = settings.speed * age
    const atFront = Math.abs(rippleContribution(ripple, 200 + front, 200, 10 + age, settings))
    const wellInside = Math.abs(rippleContribution(ripple, 200 + front / 4, 200, 10 + age, settings))
    expect(atFront).toBeGreaterThan(wellInside)
  })

  it('is radially symmetric', () => {
    const t = 10.8
    const r = 60
    const values = [0, Math.PI / 3, Math.PI, 4.7].map((angle) =>
      rippleContribution(ripple, 200 + Math.cos(angle) * r, 200 + Math.sin(angle) * r, t, settings),
    )
    for (const v of values) expect(v).toBeCloseTo(values[0]!, 10)
  })

  it('fades as it ages', () => {
    const peakAt = (age: number) => {
      let peak = 0
      for (let d = 0; d < 400; d += 2) {
        peak = Math.max(peak, Math.abs(rippleContribution(ripple, 200 + d, 200, 10 + age, settings)))
      }
      return peak
    }
    expect(peakAt(0.4)).toBeGreaterThan(peakAt(1.2))
    expect(peakAt(1.2)).toBeGreaterThan(peakAt(2.2))
  })

  it('costs nothing far from its own wavefront', () => {
    // The early bail is what keeps a pondful of ripples affordable.
    expect(rippleContribution(ripple, 5000, 5000, 10.5, settings)).toBe(0)
  })

  it('expires so the list can be pruned', () => {
    expect(isRippleExpired(ripple, 10.1, settings)).toBe(false)
    expect(isRippleExpired(ripple, 10 + settings.life, settings)).toBe(true)
  })

  it('sums multiple ripples', () => {
    const a = { x: 100, y: 100, startedAt: 0, strength: 1 }
    const b = { x: 140, y: 100, startedAt: 0, strength: 1 }
    const at = (list: typeof a[]) => ripplesAt(list, 120, 100, 0.5, settings)
    expect(at([a, b])).toBeCloseTo(at([a]) + at([b]), 10)
  })

  it('returns 0 for an empty list', () => {
    expect(ripplesAt([], 0, 0, 1, settings)).toBe(0)
  })
})
