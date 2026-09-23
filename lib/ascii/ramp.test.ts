import { describe, expect, it } from 'vitest'
import { rampChar, rampGrid, rampIndex } from './ramp'
import { luminance, luminanceGrid } from './luminance'
import { DEFAULT_RAMP } from './constants'

describe('luminance', () => {
  it('maps black to 0 and white to 1', () => {
    expect(luminance(0, 0, 0)).toBe(0)
    expect(luminance(255, 255, 255)).toBe(1)
  })

  it('weights green far above blue', () => {
    const green = luminance(0, 255, 0)
    const red = luminance(255, 0, 0)
    const blue = luminance(0, 0, 255)
    expect(green).toBeGreaterThan(red)
    expect(red).toBeGreaterThan(blue)
    expect(green).toBeCloseTo(0.7152, 4)
    expect(blue).toBeCloseTo(0.0722, 4)
  })

  it('composites transparency over the ground, not over black', () => {
    // A fully transparent pixel should read as the ground, so a PNG with a
    // cut-out background does not render as a slab of dense characters.
    expect(luminance(0, 0, 0, 0, 1)).toBe(1)
    expect(luminance(0, 0, 0, 128, 1)).toBeCloseTo(0.498, 2)
  })

  it('clamps out-of-range input instead of producing NaN', () => {
    expect(luminance(NaN, 0, 0)).toBe(0)
    expect(luminance(999, 999, 999)).toBe(1)
  })

  it('reads one luminance per cell from an RGBA buffer', () => {
    // 2x1 grid: one black pixel, one white pixel.
    const rgba = new Uint8ClampedArray([0, 0, 0, 255, 255, 255, 255, 255])
    const grid = luminanceGrid(rgba, 2, 1)
    expect(grid.length).toBe(2)
    expect(grid[0]).toBe(0)
    expect(grid[1]).toBe(1)
  })
})

describe('rampIndex — direction', () => {
  const len = DEFAULT_RAMP.length // 9

  it('sends dark pixels to the DENSE end of the ramp', () => {
    // This is the assertion that catches a photographic-negative render.
    expect(rampIndex(0, len)).toBe(len - 1)
    expect(rampChar(0, DEFAULT_RAMP)).toBe('@')
  })

  it('sends bright pixels to the SPARSE end', () => {
    expect(rampIndex(1, len)).toBe(0)
    expect(rampChar(1, DEFAULT_RAMP)).toBe('.')
  })

  it('moves monotonically from dense to sparse as brightness rises', () => {
    let previous = rampIndex(0, len)
    for (let lum = 0.05; lum <= 1; lum += 0.05) {
      const current = rampIndex(lum, len)
      expect(current).toBeLessThanOrEqual(previous)
      previous = current
    }
    expect(previous).toBe(0)
  })

  it('puts mid grey in the middle of the ramp', () => {
    expect(rampIndex(0.5, len)).toBe(4)
    expect(rampChar(0.5, DEFAULT_RAMP)).toBe('+')
  })

  it('reversing the ramp string reverses the mapping', () => {
    // The documented way to flip for a light-on-dark ground.
    const reversed = [...DEFAULT_RAMP].reverse().join('')
    expect(rampChar(0, reversed)).toBe('.')
    expect(rampChar(1, reversed)).toBe('@')
  })
})

describe('rampIndex — edges', () => {
  it('clamps luminance outside 0..1', () => {
    expect(rampIndex(-5, 9)).toBe(8)
    expect(rampIndex(5, 9)).toBe(0)
    expect(rampIndex(NaN, 9)).toBe(8)
  })

  it('never indexes outside the ramp', () => {
    for (const lum of [0, 0.1, 0.5, 0.9, 1]) {
      for (const length of [1, 2, 9, 70]) {
        const i = rampIndex(lum, length)
        expect(i).toBeGreaterThanOrEqual(0)
        expect(i).toBeLessThan(length)
      }
    }
  })

  it('survives a single-character ramp', () => {
    expect(rampIndex(0, 1)).toBe(0)
    expect(rampChar(0.5, '#')).toBe('#')
  })

  it('returns a space for an empty ramp rather than undefined', () => {
    expect(rampChar(0.5, '')).toBe(' ')
  })
})

describe('rampGrid', () => {
  it('precomputes one character per cell', () => {
    const lums = new Float32Array([0, 0.5, 1])
    expect(rampGrid(lums, DEFAULT_RAMP)).toEqual(['@', '+', '.'])
  })
})
