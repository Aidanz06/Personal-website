import { describe, expect, it } from 'vitest'
import { affectedCellRange, coverSourceRect, gridDimensions } from './grid'

describe('gridDimensions', () => {
  it('divides a box into cells of the requested width', () => {
    const g = gridDimensions(640, 460, 10, 2)
    expect(g.cols).toBe(64) // 640 / 10
    expect(g.rows).toBe(23) // 460 / 20
  })

  it('accounts for monospace glyphs being twice as tall as they are wide', () => {
    // A square-cell grid would stretch the picture vertically.
    const square = gridDimensions(640, 640, 10, 1)
    const proportional = gridDimensions(640, 640, 10, 2)
    expect(square.rows).toBe(64)
    expect(proportional.rows).toBe(32)
  })

  it('tiles the box exactly, leaving no bare strip at the edges', () => {
    // This is why cellWidth is not simply the requested cellSize: a leftover
    // remainder at the right or bottom edge reads as a rendering bug.
    for (const [w, h, size] of [
      [640, 460, 9],
      [375, 187, 8],
      [1001, 333, 10],
    ] as const) {
      const g = gridDimensions(w, h, size)
      expect(g.cols * g.cellWidth).toBeCloseTo(w, 6)
      expect(g.rows * g.cellHeight).toBeCloseTo(h, 6)
    }
  })

  it('keeps the actual cell size close to what was asked for', () => {
    const g = gridDimensions(640, 460, 9)
    expect(g.cellWidth).toBeGreaterThanOrEqual(9)
    expect(g.cellWidth).toBeLessThan(9 * 1.5)
  })

  it('produces fewer cells as cellSize grows — the fps degradation path', () => {
    const fine = gridDimensions(640, 460, 8)
    const coarse = gridDimensions(640, 460, 16)
    expect(coarse.cols * coarse.rows).toBeLessThan(fine.cols * fine.rows)
  })

  it('never returns a zero-cell grid for a degenerate box', () => {
    for (const [w, h] of [
      [0, 0],
      [-100, 50],
      [5, 5],
      [NaN, NaN],
    ] as const) {
      const g = gridDimensions(w, h, 9)
      expect(g.cols).toBeGreaterThanOrEqual(1)
      expect(g.rows).toBeGreaterThanOrEqual(1)
      expect(Number.isNaN(g.cellWidth)).toBe(false)
      expect(Number.isNaN(g.cellHeight)).toBe(false)
    }
  })

  it('survives a zero or negative cellSize instead of dividing by zero', () => {
    const g = gridDimensions(640, 460, 0)
    expect(Number.isFinite(g.cols)).toBe(true)
    expect(g.cols).toBeGreaterThanOrEqual(1)
  })
})

describe('affectedCellRange', () => {
  const grid = gridDimensions(640, 460, 10, 2) // 64 x 23 cells, 10 x 20 px

  it('covers only the cells the pointer can possibly reach', () => {
    const r = affectedCellRange(grid, 320, 230, 180)
    expect(r.fromCol).toBe(14) // (320-180)/10
    expect(r.toCol).toBe(50) // (320+180)/10
    expect(r.fromRow).toBe(2) // (230-180)/20
    expect(r.toRow).toBe(21) // (230+180)/20
  })

  it('is meaningfully cheaper than walking the whole grid', () => {
    const r = affectedCellRange(grid, 320, 230, 180)
    const visited = (r.toCol - r.fromCol) * (r.toRow - r.fromRow)
    expect(visited).toBeLessThan(grid.cols * grid.rows * 0.7)
  })

  it('clamps to the grid when the pointer is near a corner', () => {
    const r = affectedCellRange(grid, 0, 0, 180)
    expect(r.fromCol).toBe(0)
    expect(r.fromRow).toBe(0)
    expect(r.toCol).toBeLessThanOrEqual(grid.cols)
    expect(r.toRow).toBeLessThanOrEqual(grid.rows)
  })

  it('yields an empty range for a pointer far outside the box', () => {
    const r = affectedCellRange(grid, -5000, -5000, 180)
    expect(r.toCol - r.fromCol).toBe(0)
    expect(r.toRow - r.fromRow).toBe(0)
  })

  it('never returns bounds outside the grid', () => {
    for (const [x, y] of [
      [0, 0],
      [640, 460],
      [-100, 900],
      [NaN, NaN],
    ] as const) {
      const r = affectedCellRange(grid, x, y, 180)
      expect(r.fromCol).toBeGreaterThanOrEqual(0)
      expect(r.fromRow).toBeGreaterThanOrEqual(0)
      expect(r.toCol).toBeLessThanOrEqual(grid.cols)
      expect(r.toRow).toBeLessThanOrEqual(grid.rows)
    }
  })
})

describe('coverSourceRect', () => {
  it('uses the whole image when the aspect ratios already match', () => {
    const r = coverSourceRect(1000, 500, 640, 320)
    expect(r).toEqual({ sx: 0, sy: 0, sw: 1000, sh: 500 })
  })

  it('crops vertically when the box is wider than the image', () => {
    // A square image into a 2:1 box: use the full width, crop top and bottom.
    const r = coverSourceRect(1000, 1000, 640, 320)
    expect(r.sw).toBe(1000)
    expect(r.sh).toBe(500)
    expect(r.sx).toBe(0)
    expect(r.sy).toBe(250)
  })

  it('crops horizontally when the image is wider than the box', () => {
    // A 2:1 image into a square box: use the full height, crop left and right.
    const r = coverSourceRect(1000, 500, 400, 400)
    expect(r.sh).toBe(500)
    expect(r.sw).toBe(500)
    expect(r.sx).toBe(250)
    expect(r.sy).toBe(0)
  })

  it('crops the top and bottom of an image taller than the box', () => {
    const r = coverSourceRect(400, 1200, 400, 400)
    expect(r.sw).toBe(400)
    expect(r.sh).toBe(400)
    expect(r.sx).toBe(0)
    expect(r.sy).toBe(400)
  })

  it('always centres the crop', () => {
    for (const [iw, ih] of [
      [1600, 900],
      [900, 1600],
      [1000, 1000],
    ] as const) {
      const r = coverSourceRect(iw, ih, 640, 460)
      expect(r.sx).toBeCloseTo((iw - r.sw) / 2, 6)
      expect(r.sy).toBeCloseTo((ih - r.sh) / 2, 6)
    }
  })

  it('never reads outside the image bounds', () => {
    for (const [iw, ih, bw, bh] of [
      [100, 100, 2000, 10],
      [100, 100, 10, 2000],
      [1, 5000, 640, 460],
    ] as const) {
      const r = coverSourceRect(iw, ih, bw, bh)
      expect(r.sx).toBeGreaterThanOrEqual(0)
      expect(r.sy).toBeGreaterThanOrEqual(0)
      expect(r.sx + r.sw).toBeLessThanOrEqual(iw + 1e-9)
      expect(r.sy + r.sh).toBeLessThanOrEqual(ih + 1e-9)
    }
  })

  it('degrades safely on zero dimensions instead of returning NaN', () => {
    const r = coverSourceRect(0, 0, 640, 460)
    expect(Number.isNaN(r.sw)).toBe(false)
    expect(Number.isNaN(r.sh)).toBe(false)
  })
})
