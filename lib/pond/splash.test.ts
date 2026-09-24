import { describe, expect, it } from 'vitest'
import { drainSplashes, pageSplashWave, requestPageSplash } from './splash'

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
