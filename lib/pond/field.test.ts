import { describe, expect, it } from 'vitest'
import { MATERIAL, clearField, createField, stampBlob, stampKoi, stampStone } from './field'
import { DEFAULT_BODY_RADIUS, DEFAULT_SEGMENTS, createKoi } from './koi'

const CELL_W = 9
const CELL_H = 18

describe('createField / clearField', () => {
  it('allocates one entry per cell', () => {
    const field = createField(20, 10)
    expect(field.luminance.length).toBe(200)
    expect(field.material.length).toBe(200)
    expect(field.tint.length).toBe(200)
  })

  it('resets to water at the given brightness', () => {
    const field = createField(4, 4)
    stampBlob(field, 18, 36, 40, 1, MATERIAL.koi, 0.5, CELL_W, CELL_H)
    clearField(field, 0.1)
    expect([...field.luminance].every((v) => Math.abs(v - 0.1) < 1e-6)).toBe(true)
    expect([...field.material].every((m) => m === MATERIAL.water)).toBe(true)
  })

  it('survives a degenerate size', () => {
    expect(createField(0, 0).luminance.length).toBe(0)
    expect(createField(-5, 3).luminance.length).toBe(0)
  })
})

describe('stampBlob', () => {
  it('is brightest at the centre and fades to the rim', () => {
    const field = createField(40, 20)
    stampBlob(field, 180, 180, 60, 1, MATERIAL.koi, 0.5, CELL_W, CELL_H)
    const at = (col: number, row: number) => field.luminance[row * field.cols + col]!
    const centre = at(20, 10)
    const nearRim = at(26, 10)
    expect(centre).toBeGreaterThan(nearRim)
    expect(nearRim).toBeGreaterThan(0)
  })

  it('writes nothing beyond its radius', () => {
    const field = createField(40, 20)
    clearField(field, 0)
    stampBlob(field, 90, 90, 20, 1, MATERIAL.koi, 0.5, CELL_W, CELL_H)
    expect(field.luminance[10 * 40 + 38]).toBe(0)
    expect(field.material[10 * 40 + 38]).toBe(MATERIAL.water)
  })

  it('takes the maximum rather than adding, so overlaps do not blow out', () => {
    // Two fish crossing must stay as bright as one fish.
    const one = createField(40, 20)
    stampBlob(one, 180, 180, 50, 0.8, MATERIAL.koi, 0.3, CELL_W, CELL_H)
    const peakOne = Math.max(...one.luminance)

    const two = createField(40, 20)
    stampBlob(two, 180, 180, 50, 0.8, MATERIAL.koi, 0.3, CELL_W, CELL_H)
    stampBlob(two, 180, 180, 50, 0.8, MATERIAL.koi, 0.9, CELL_W, CELL_H)
    expect(Math.max(...two.luminance)).toBeCloseTo(peakOne, 10)
  })

  it('lets the brighter contributor claim the cell and its material', () => {
    const field = createField(40, 20)
    clearField(field, 0)
    stampBlob(field, 180, 180, 50, 0.3, MATERIAL.stone, 0, CELL_W, CELL_H)
    stampBlob(field, 180, 180, 50, 0.9, MATERIAL.koi, 0.7, CELL_W, CELL_H)
    const i = 10 * 40 + 20
    expect(field.material[i]).toBe(MATERIAL.koi)
    expect(field.tint[i]).toBeCloseTo(0.7, 6)
  })

  it('clips at the edges instead of writing out of bounds', () => {
    const field = createField(12, 8)
    expect(() => {
      stampBlob(field, -200, -200, 90, 1, MATERIAL.koi, 0, CELL_W, CELL_H)
      stampBlob(field, 9000, 9000, 90, 1, MATERIAL.koi, 0, CELL_W, CELL_H)
      stampBlob(field, 0, 0, 400, 1, MATERIAL.koi, 0, CELL_W, CELL_H)
    }).not.toThrow()
    expect([...field.luminance].every((v) => Number.isFinite(v))).toBe(true)
  })

  it('ignores a zero or negative radius', () => {
    const field = createField(10, 10)
    clearField(field, 0)
    stampBlob(field, 45, 90, 0, 1, MATERIAL.koi, 0, CELL_W, CELL_H)
    stampBlob(field, 45, 90, -20, 1, MATERIAL.koi, 0, CELL_W, CELL_H)
    expect(Math.max(...field.luminance)).toBe(0)
  })
})

describe('stampKoi', () => {
  it('lays the whole fish into the field', () => {
    const field = createField(80, 40)
    clearField(field, 0)
    const koi = createKoi({ x: 300, y: 300 }, 0, DEFAULT_SEGMENTS, 0.4)
    stampKoi(field, koi, DEFAULT_BODY_RADIUS, 1, CELL_W, CELL_H)
    const koiCells = [...field.material].filter((m) => m === MATERIAL.koi).length
    expect(koiCells).toBeGreaterThan(40)
  })

  it('is several rows tall, not a one-row line', () => {
    // Cells are twice as tall as they are wide, so a body radius that looks
    // generous horizontally can still be a single row vertically — which
    // renders as a dash, not a fish.
    const field = createField(80, 40)
    clearField(field, 0)
    stampKoi(field, createKoi({ x: 300, y: 300 }, 0, DEFAULT_SEGMENTS, 0.4), DEFAULT_BODY_RADIUS, 1, CELL_W, CELL_H)
    const rows = new Set<number>()
    for (let i = 0; i < field.material.length; i++) {
      if (field.material[i] === MATERIAL.koi) rows.add(Math.floor(i / field.cols))
    }
    expect(rows.size).toBeGreaterThanOrEqual(3)
  })

  it('runs a tint gradient from head to tail', () => {
    const field = createField(80, 40)
    clearField(field, 0)
    stampKoi(field, createKoi({ x: 300, y: 300 }, 0, 14, 0), DEFAULT_BODY_RADIUS, 1, CELL_W, CELL_H)
    const tints = [...field.material]
      .map((m, i) => (m === MATERIAL.koi ? field.tint[i]! : null))
      .filter((v): v is number => v !== null)
    expect(Math.max(...tints)).toBeGreaterThan(Math.min(...tints))
    expect(Math.min(...tints)).toBeGreaterThanOrEqual(0)
    expect(Math.max(...tints)).toBeLessThanOrEqual(1)
  })

  it('is thicker at the head end than the tail end', () => {
    const field = createField(120, 60)
    clearField(field, 0)
    // Pointing straight right, so head is at larger x than tail.
    const koi = createKoi({ x: 600, y: 540 }, 0, 18, 0.5)
    stampKoi(field, koi, DEFAULT_BODY_RADIUS, 1, CELL_W, CELL_H)
    const row = 30
    const columnHits = (col: number) => {
      let n = 0
      for (let r = 0; r < field.rows; r++) if (field.material[r * field.cols + col] === MATERIAL.koi) n++
      return n
    }
    const headCol = Math.floor(koi.spine[2]!.x / CELL_W)
    const tailCol = Math.floor(koi.spine[16]!.x / CELL_W)
    expect(row).toBeGreaterThan(0)
    expect(columnHits(headCol)).toBeGreaterThan(columnHits(tailCol))
  })
})

describe('stampStone', () => {
  it('marks its cells as stone', () => {
    const field = createField(60, 30)
    clearField(field, 0)
    stampStone(field, { x: 270, y: 270, radius: 40, href: '/about', label: 'about' }, 0.6, CELL_W, CELL_H)
    expect([...field.material].filter((m) => m === MATERIAL.stone).length).toBeGreaterThan(4)
  })
})
