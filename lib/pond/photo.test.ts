import { describe, expect, it } from 'vitest'
import {
  photoDepthFactor,
  photoOpacity,
  revealRect,
  samplePhoto,
  type PhotoGrid,
} from './photo'

const grid: PhotoGrid = {
  cols: 4,
  rows: 2,
  luminance: new Float32Array([0, 0.25, 0.5, 0.75, 0.1, 0.35, 0.6, 0.85]),
}

const BOUNDS = { width: 1000, height: 800 }

describe('samplePhoto', () => {
  it('maps normalised coordinates onto cells', () => {
    expect(samplePhoto(grid, 0, 0)).toBe(0)
    expect(samplePhoto(grid, 0.99, 0)).toBeCloseTo(0.75, 6)
    expect(samplePhoto(grid, 0, 0.99)).toBeCloseTo(0.1, 6)
    expect(samplePhoto(grid, 0.99, 0.99)).toBeCloseTo(0.85, 6)
  })

  it('clamps out-of-range coordinates instead of reading past the end', () => {
    expect(samplePhoto(grid, -5, -5)).toBe(0)
    expect(samplePhoto(grid, 5, 5)).toBeCloseTo(0.85, 6)
    expect(Number.isNaN(samplePhoto(grid, NaN, NaN))).toBe(false)
  })

  it('returns 0 for an empty grid rather than undefined', () => {
    expect(samplePhoto({ cols: 0, rows: 0, luminance: new Float32Array() }, 0.5, 0.5)).toBe(0)
  })

  it('never returns undefined anywhere in range', () => {
    for (let u = 0; u < 1; u += 0.07) {
      for (let v = 0; v < 1; v += 0.11) {
        expect(typeof samplePhoto(grid, u, v)).toBe('number')
      }
    }
  })
})

describe('revealRect', () => {
  it('is roughly the fish at zero reveal, and the target at full', () => {
    const closed = revealRect(500, 400, 0, 80, 520, 360, BOUNDS)
    expect(closed.width).toBeCloseTo(80, 6)
    expect(closed.height).toBeCloseTo(80, 6)

    const open = revealRect(500, 400, 1, 80, 520, 360, BOUNDS)
    expect(open.width).toBeCloseTo(520, 6)
    expect(open.height).toBeCloseTo(360, 6)
  })

  it('stays centred on the fish while there is room', () => {
    const rect = revealRect(500, 400, 1, 80, 520, 360, BOUNDS)
    expect(rect.x + rect.width / 2).toBeCloseTo(500, 6)
    expect(rect.y + rect.height / 2).toBeCloseTo(400, 6)
  })

  it('opens fast and then settles, rather than scaling linearly', () => {
    const half = revealRect(500, 400, 0.5, 80, 520, 360, BOUNDS)
    const linear = 80 + (520 - 80) * 0.5
    expect(half.width).toBeGreaterThan(linear)
  })

  it('never hangs off the edge of the pond', () => {
    // The fish spends plenty of its time near an edge.
    for (const [cx, cy] of [[0, 0], [1000, 800], [20, 780], [990, 10]] as const) {
      const rect = revealRect(cx, cy, 1, 80, 520, 360, BOUNDS)
      expect(rect.x).toBeGreaterThanOrEqual(0)
      expect(rect.y).toBeGreaterThanOrEqual(0)
      expect(rect.x + rect.width).toBeLessThanOrEqual(BOUNDS.width + 1e-6)
      expect(rect.y + rect.height).toBeLessThanOrEqual(BOUNDS.height + 1e-6)
    }
  })

  it('centres a photo too large for the pond instead of jamming it to an edge', () => {
    const rect = revealRect(100, 100, 1, 80, 1400, 1000, { width: 1000, height: 800 })
    expect(rect.x + rect.width / 2).toBeCloseTo(500, 6)
    expect(rect.y + rect.height / 2).toBeCloseTo(400, 6)
  })

  it('grows monotonically', () => {
    let previous = 0
    for (let r = 0; r <= 1; r += 0.05) {
      const w = revealRect(500, 400, r, 80, 520, 360, BOUNDS).width
      expect(w).toBeGreaterThanOrEqual(previous - 1e-9)
      previous = w
    }
  })

  it('clamps reveal outside 0..1', () => {
    expect(revealRect(500, 400, -3, 80, 520, 360, BOUNDS).width).toBeCloseTo(80, 6)
    expect(revealRect(500, 400, 9, 80, 520, 360, BOUNDS).width).toBeCloseTo(520, 6)
  })
})

describe('photoOpacity', () => {
  it('shows nothing until the photograph is most of the way open', () => {
    // The characters should hold, then hand over — an image emerging from the
    // text, not the text simply fading out.
    expect(photoOpacity(0)).toBe(0)
    expect(photoOpacity(0.3)).toBe(0)
    expect(photoOpacity(0.62)).toBe(0)
  })

  it('reaches fully opaque at full reveal', () => {
    expect(photoOpacity(1)).toBeCloseTo(1, 6)
  })

  it('rises monotonically once it starts', () => {
    let previous = -1
    for (let r = 0; r <= 1; r += 0.02) {
      const o = photoOpacity(r)
      expect(o).toBeGreaterThanOrEqual(previous - 1e-9)
      previous = o
    }
  })

  it('stays within 0..1 for any input', () => {
    for (const r of [-5, 0, 0.5, 1, 7, NaN]) {
      const o = photoOpacity(r)
      expect(o).toBeGreaterThanOrEqual(0)
      expect(o).toBeLessThanOrEqual(1)
    }
  })
})

describe('photoDepthFactor', () => {
  const H = 800

  it('opens no photographs at the surface', () => {
    // The surface carries the name and the availability line. A photograph
    // over them buries the one thing a recruiter came for.
    expect(photoDepthFactor(0, H)).toBe(0)
    expect(photoDepthFactor(H * 0.4, H)).toBe(0)
  })

  it('is fully willing once the reader is a screen down', () => {
    expect(photoDepthFactor(H * 1.05, H)).toBeCloseTo(1, 6)
    expect(photoDepthFactor(H * 3, H)).toBeCloseTo(1, 6)
  })

  it('ramps rather than switching on', () => {
    const mid = photoDepthFactor(H * 0.8, H)
    expect(mid).toBeGreaterThan(0)
    expect(mid).toBeLessThan(1)
  })

  it('rises monotonically with depth', () => {
    let previous = -1
    for (let y = 0; y < H * 2; y += H / 20) {
      const f = photoDepthFactor(y, H)
      expect(f).toBeGreaterThanOrEqual(previous - 1e-9)
      previous = f
    }
  })

  it('scales with the viewport rather than assuming a size', () => {
    expect(photoDepthFactor(400, 800)).toBe(photoDepthFactor(200, 400))
  })

  it('returns 0 for nonsense input instead of NaN', () => {
    for (const [y, h] of [[NaN, 800], [0, 0], [100, -5], [100, NaN]] as const) {
      const f = photoDepthFactor(y, h)
      expect(Number.isFinite(f)).toBe(true)
      expect(f).toBe(0)
    }
  })
})
