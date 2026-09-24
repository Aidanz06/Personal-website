import { describe, expect, it } from 'vitest'
import { drainSplashes, pageSplashWave, requestPageSplash, descentCue, shouldPlayCue, MAX_CUES } from './splash'

describe('pageSplashWave', () => {
  it('crosses the pond left to right', () => {
    const wave = pageSplashWave()
    expect(wave[0]!.xFraction).toBeLessThan(0.2)
    expect(wave.at(-1)!.xFraction).toBeGreaterThan(0.8)
    for (let i = 1; i < wave.length; i++) {
      expect(wave[i]!.xFraction).toBeGreaterThan(wave[i - 1]!.xFraction)
    }
  })

  it('starts each ripple a beat after the last, so it travels', () => {
    // Identical delays would be a row of ripples appearing at once, which
    // reads as a machine rather than as water.
    const wave = pageSplashWave()
    for (let i = 1; i < wave.length; i++) {
      expect(wave[i]!.delay).toBeGreaterThan(wave[i - 1]!.delay)
    }
    expect(wave[0]!.delay).toBe(0)
    expect(wave.at(-1)!.delay).toBeLessThan(0.4)
  })

  it('stays inside the pond', () => {
    for (const point of pageSplashWave(20)) {
      expect(point.xFraction).toBeGreaterThan(0)
      expect(point.xFraction).toBeLessThan(1)
      expect(point.yFraction).toBeGreaterThan(0)
      expect(point.yFraction).toBeLessThan(1)
    }
  })

  it('does not sit in a perfectly straight line', () => {
    const heights = new Set(pageSplashWave().map((p) => p.yFraction.toFixed(4)))
    expect(heights.size).toBeGreaterThan(1)
  })

  it('handles being asked for a single ripple', () => {
    const wave = pageSplashWave(1)
    expect(wave).toHaveLength(1)
    expect(Number.isFinite(wave[0]!.xFraction)).toBe(true)
    expect(Number.isFinite(wave[0]!.delay)).toBe(true)
  })
})

describe('the queue', () => {
  it('hands the wave over exactly once', () => {
    requestPageSplash()
    expect(drainSplashes().length).toBeGreaterThan(0)
    expect(drainSplashes()).toEqual([])
  })

  it('is empty when nothing has been requested', () => {
    drainSplashes()
    expect(drainSplashes()).toEqual([])
  })

  it('collapses two fast navigations into one wave', () => {
    // Clicking through three pages quickly should not leave a storm behind.
    drainSplashes()
    requestPageSplash()
    requestPageSplash()
    requestPageSplash()
    expect(drainSplashes()).toHaveLength(pageSplashWave().length)
  })
})

describe('descentCue', () => {
  const cue = descentCue(0.3, 0.55, 0.95)

  it('is a chain of rings, each lower than the last, like a stone sinking', () => {
    expect(cue.length).toBeGreaterThanOrEqual(4)
    for (let i = 1; i < cue.length; i++) {
      expect(cue[i]!.yFraction).toBeGreaterThan(cue[i - 1]!.yFraction)
      expect(cue[i]!.delay).toBeGreaterThan(cue[i - 1]!.delay)
    }
  })

  it('runs from under the name to the first stone, and no further', () => {
    expect(cue[0]!.yFraction).toBeCloseTo(0.55, 6)
    expect(cue.at(-1)!.yFraction).toBeCloseTo(0.95, 6)
  })

  it('sinks toward the stone it is pointing at', () => {
    for (const point of cue) expect(Math.abs(point.xFraction - 0.3)).toBeLessThan(0.08)
  })

  it('is slow enough to read as sinking, not as a flash', () => {
    expect(cue.at(-1)!.delay).toBeGreaterThan(1.5)
  })

  it('is gentler than a page-change wave', () => {
    const wave = pageSplashWave()
    for (const point of cue) expect(point.strength).toBeLessThan(wave[0]!.strength)
  })

  it('fades as it sinks, the way a disturbance does going deeper', () => {
    expect(cue.at(-1)!.strength).toBeLessThan(cue[0]!.strength)
  })
})

describe('shouldPlayCue', () => {
  it('plays at the top of the page, a few times at most', () => {
    expect(shouldPlayCue({ scrollY: 0, played: 0, reducedMotion: false })).toBe(true)
    expect(shouldPlayCue({ scrollY: 0, played: MAX_CUES, reducedMotion: false })).toBe(false)
  })

  it('stops once the visitor has started to descend: the cue has done its job', () => {
    expect(shouldPlayCue({ scrollY: 60, played: 0, reducedMotion: false })).toBe(false)
  })

  it('never plays under reduced motion', () => {
    expect(shouldPlayCue({ scrollY: 0, played: 0, reducedMotion: true })).toBe(false)
  })

  it('does not nag: three times, then never again this visit', () => {
    expect(MAX_CUES).toBeLessThanOrEqual(3)
  })
})
