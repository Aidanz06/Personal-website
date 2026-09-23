import { describe, expect, it } from 'vitest'
import { selectRenderMode, type Capabilities } from './mode'

const capable: Capabilities = {
  supportsCanvas: true,
  prefersReducedMotion: false,
  hasFinePointer: true,
}

describe('selectRenderMode', () => {
  it('follows the pointer on a normal desktop browser', () => {
    expect(selectRenderMode(capable)).toBe('pointer')
  })

  it('drifts on touch, where there is no hover to respond to', () => {
    // Without this, a phone visitor gets a rectangle that never moves.
    expect(selectRenderMode({ ...capable, hasFinePointer: false })).toBe('drift')
  })

  it('goes static under prefers-reduced-motion', () => {
    expect(
      selectRenderMode({ ...capable, prefersReducedMotion: true }),
    ).toBe('static')
  })

  it('honours reduced motion even on a touch device', () => {
    // The drift animation is still motion; reduced motion has to beat it.
    expect(
      selectRenderMode({
        ...capable,
        prefersReducedMotion: true,
        hasFinePointer: false,
      }),
    ).toBe('static')
  })

  it('goes static without canvas support', () => {
    expect(selectRenderMode({ ...capable, supportsCanvas: false })).toBe('static')
  })

  it('prefers static whenever any reason to avoid the canvas applies', () => {
    // Exhaustive over the eight capability combinations: 'static' must win
    // whenever canvas is missing OR reduced motion is set, and the animated
    // modes must only ever appear when both are clear.
    for (const supportsCanvas of [true, false]) {
      for (const prefersReducedMotion of [true, false]) {
        for (const hasFinePointer of [true, false]) {
          const mode = selectRenderMode({
            supportsCanvas,
            prefersReducedMotion,
            hasFinePointer,
          })
          if (!supportsCanvas || prefersReducedMotion) {
            expect(mode).toBe('static')
          } else {
            expect(mode).toBe(hasFinePointer ? 'pointer' : 'drift')
          }
        }
      }
    }
  })
})
