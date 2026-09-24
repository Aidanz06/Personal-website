import { describe, expect, it } from 'vitest'
import { artGrid, buildRamp, edgeFeather, ART_CELL_WIDTH } from './asciiArt'

describe('buildRamp', () => {
  const measured = [
    { char: ' ', coverage: 0 },
    { char: '.', coverage: 0.03 },
    { char: "'", coverage: 0.035 },
    { char: ':', coverage: 0.06 },
    { char: '-', coverage: 0.08 },
    { char: '=', coverage: 0.16 },
    { char: '+', coverage: 0.17 },
    { char: '*', coverage: 0.22 },
    { char: '#', coverage: 0.4 },
    { char: '%', coverage: 0.44 },
    { char: '@', coverage: 0.52 },
  ]

  it('orders glyphs from emptiest to fullest, by what they actually cover', () => {
    const ramp = buildRamp([...measured].reverse(), 6)
    expect(ramp[0]).toBe(' ')
    expect(ramp.at(-1)).toBe('@')
  })

  it('picks glyphs spread evenly across the range, not bunched at one end', () => {
    // Five glyphs sit under 0.1 coverage. Taking the first N would spend
    // most of the ramp on shades of nearly-empty.
    const ramp = buildRamp(measured, 5)
    expect(ramp).toHaveLength(5)
    const lookup = new Map(measured.map((m) => [m.char, m.coverage]))
    const steps = [...ramp].map((c) => lookup.get(c)!)
    const gaps = steps.slice(1).map((v, i) => v - steps[i]!)
    expect(Math.max(...gaps) / Math.min(...gaps)).toBeLessThan(4)
  })

  it('never repeats a glyph', () => {
    const ramp = buildRamp(measured, 10)
    expect(new Set(ramp).size).toBe(ramp.length)
  })

  it('returns fewer glyphs than asked when there are not enough distinct ones', () => {
    expect(buildRamp(measured.slice(0, 3), 8).length).toBeLessThanOrEqual(3)
  })

  it('falls back to a plain ramp when nothing could be measured', () => {
    // Measuring needs a canvas; no canvas must not mean no picture.
    expect(buildRamp([], 16).length).toBeGreaterThan(4)
  })
})

describe('artGrid', () => {
  it('fits many more characters than the pond grid does', () => {
    const grid = artGrid(300, 300, 1.7)
    expect(grid.cols).toBe(Math.round(300 / ART_CELL_WIDTH))
    expect(grid.cols).toBeGreaterThan(300 / 7 * 1.6)
  })

  it('keeps the pond’s glyph proportions, so the two read as one kind of character', () => {
    const grid = artGrid(300, 300, 1.7)
    expect(grid.cellHeight / grid.cellWidth).toBeCloseTo(1.7, 1)
  })

  it('fills the target exactly, so there is no seam against the edge', () => {
    const grid = artGrid(301, 173, 1.7)
    expect(grid.cols * grid.cellWidth).toBeCloseTo(301, 6)
    expect(grid.rows * grid.cellHeight).toBeCloseTo(173, 6)
  })

  it('never goes below a readable number of characters, or to zero', () => {
    const tiny = artGrid(20, 20, 1.7)
    expect(tiny.cols).toBeGreaterThanOrEqual(8)
    expect(tiny.rows).toBeGreaterThanOrEqual(1)
    const none = artGrid(0, 0, 1.7)
    expect(none.cols).toBeGreaterThan(0)
  })
})

describe('edgeFeather', () => {
  const rect = { x: 0, y: 0, width: 200, height: 100 }

  it('is 1 across the middle and 0 at the edge', () => {
    expect(edgeFeather(100, 50, rect, 20)).toBe(1)
    expect(edgeFeather(0, 50, rect, 20)).toBe(0)
    expect(edgeFeather(200, 50, rect, 20)).toBe(0)
  })

  it('eases in, so there is no visible step where the fade begins', () => {
    const near = edgeFeather(2, 50, rect, 20)
    const mid = edgeFeather(10, 50, rect, 20)
    expect(near).toBeLessThan(0.05)
    expect(mid).toBeCloseTo(0.5, 6)
  })

  it('is always 1 with no feather', () => {
    expect(edgeFeather(0, 0, rect, 0)).toBe(1)
  })
})
