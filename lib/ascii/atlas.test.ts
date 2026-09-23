import { describe, expect, it } from 'vitest'
import { atlasTile, type Atlas } from './atlas'

// buildAtlas needs a real canvas, so the geometry is tested against a
// hand-built descriptor instead. The lookup is where an off-by-one would
// silently draw the wrong character, so that is what matters here.
const atlas: Atlas = {
  canvas: null as unknown as HTMLCanvasElement,
  tileWidth: 18,
  tileHeight: 36,
  ramp: '.:-=+*#%@',
  colors: ['#fff', '#f00', '#0f0'],
  dpr: 2,
}

describe('atlasTile', () => {
  it('locates the first tile at the origin', () => {
    expect(atlasTile(atlas, 0, 0)).toEqual({ sx: 0, sy: 0 })
  })

  it('advances by one tile per character and one row per colour', () => {
    expect(atlasTile(atlas, 3, 0)).toEqual({ sx: 54, sy: 0 })
    expect(atlasTile(atlas, 0, 2)).toEqual({ sx: 0, sy: 72 })
    expect(atlasTile(atlas, 8, 2)).toEqual({ sx: 144, sy: 72 })
  })

  it('rejects out-of-range indices instead of reading a neighbouring tile', () => {
    expect(atlasTile(atlas, -1, 0)).toBeNull()
    expect(atlasTile(atlas, 9, 0)).toBeNull()
    expect(atlasTile(atlas, 0, -1)).toBeNull()
    expect(atlasTile(atlas, 0, 3)).toBeNull()
  })

  it('reports blanks as nothing to draw', () => {
    // Most cells on calm water are blank, so skipping them is the hot path.
    const withSpace: Atlas = { ...atlas, ramp: ' .:-' }
    expect(atlasTile(withSpace, 0, 0)).toBeNull()
    expect(atlasTile(withSpace, 1, 0)).toEqual({ sx: 18, sy: 0 })
  })

  it('never returns a tile outside the sheet', () => {
    for (let c = 0; c < atlas.colors.length; c++) {
      for (let i = 0; i < atlas.ramp.length; i++) {
        const tile = atlasTile(atlas, i, c)!
        expect(tile.sx + atlas.tileWidth).toBeLessThanOrEqual(atlas.tileWidth * atlas.ramp.length)
        expect(tile.sy + atlas.tileHeight).toBeLessThanOrEqual(atlas.tileHeight * atlas.colors.length)
      }
    }
  })
})
