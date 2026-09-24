import { describe, expect, it } from 'vitest'
import { themeChange, themeRingRadius } from './themeRing'
import { drainSplashes, requestSplashAt } from './splash'

/**
 * Choosing a theme spreads the new pond outward from the control you
 * pressed, as a ring, and drops a ripple there. It is the one response the
 * theme choice gets, so it has to be quick, and it has to be absent when
 * the visitor asked for less motion.
 */

describe('the theme ring', () => {
  it('grows until it covers the farthest corner of the screen', () => {
    // From the top-left control on a phone, the far corner is bottom-right.
    expect(themeRingRadius(20, 20, 375, 667)).toBeCloseTo(Math.hypot(355, 647))
    // From the middle, every corner is the same distance.
    expect(themeRingRadius(640, 400, 1280, 800)).toBeCloseTo(Math.hypot(640, 400))
  })

  it('rings only when motion is welcome and the browser can do it', () => {
    expect(themeChange({ reducedMotion: false, supported: true })).toBe('ring')
    expect(themeChange({ reducedMotion: true, supported: true })).toBe('instant')
    expect(themeChange({ reducedMotion: false, supported: false })).toBe('instant')
  })
})

describe('a splash where you pressed', () => {
  it('queues one ripple at that spot, as fractions of the screen', () => {
    drainSplashes()
    requestSplashAt(0.25, 0.1, 0.9)
    expect(drainSplashes()).toEqual([{ xFraction: 0.25, yFraction: 0.1, delay: 0, strength: 0.9 }])
  })

  it('keeps the spot on the water even if the control is at an edge', () => {
    drainSplashes()
    requestSplashAt(-0.2, 1.4, 0.9)
    const [point] = drainSplashes()
    expect(point).toMatchObject({ xFraction: 0, yFraction: 1 })
  })
})
