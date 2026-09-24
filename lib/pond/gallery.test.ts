import { describe, expect, it } from 'vitest'
import { galleryGroup, orderGallery, rockLabel, rockName } from './gallery'
import { resolveCaption, type CaptionsFile } from '../captions'

const data: CaptionsFile = {
  places: { '2025-05-22': 'kyoto', '2024-06-08': '' },
  photos: {
    'a.jpg': { date: '2025-05-22', alt: 'two motorbikes parked by a fence' },
    'b.jpg': { date: '2024-06-08' },
    'c.mp4': { date: '2026-06-14' },
    'd.jpg': {},
    'e.mp4': {},
  },
}
const photo = (file: string) => ({
  file,
  kind: file.endsWith('.mp4') ? ('video' as const) : ('image' as const),
  caption: resolveCaption(file, data),
})

describe('orderGallery', () => {
  it('puts the newest first and the undated last, deeper being older', () => {
    const order = orderGallery(['b.jpg', 'd.jpg', 'a.jpg', 'e.mp4', 'c.mp4'].map(photo))
    expect(order.map((p) => p.file)).toEqual(['c.mp4', 'a.jpg', 'b.jpg', 'd.jpg', 'e.mp4'])
  })

  it('keeps filename order within the same date, and among the undated', () => {
    const same = orderGallery(['b.jpg', 'a.jpg'].map((f) => ({ ...photo(f), caption: resolveCaption('a.jpg', data), file: f })))
    expect(same.map((p) => p.file)).toEqual(['b.jpg', 'a.jpg'])
  })

  it('does not reorder the array it was given', () => {
    const input = ['b.jpg', 'a.jpg'].map(photo)
    orderGallery(input)
    expect(input.map((p) => p.file)).toEqual(['b.jpg', 'a.jpg'])
  })
})

describe('galleryGroup', () => {
  it('groups by year, with the undated together', () => {
    expect(galleryGroup(photo('a.jpg').caption)).toBe('2025')
    expect(galleryGroup(photo('d.jpg').caption)).toBe('undated')
  })
})

describe('rockLabel', () => {
  const named = (name: string) =>
    resolveCaption('n.jpg', { photos: { 'n.jpg': { date: '2025-05-22', name } } })

  it('is the name Aidan gave the photograph', () => {
    expect(rockLabel(named('bikes'))).toEqual(['bikes'])
  })

  it('is nothing at all until he names it — no month, no placeholder', () => {
    // Months under the rocks read "may" fourteen times in a row. A rock with
    // no name simply has no label.
    expect(rockLabel(photo('a.jpg').caption)).toEqual([])
    expect(rockLabel(photo('e.mp4').caption)).toEqual([])
  })

  it('wraps a long name onto more lines, so it stays on a phone screen', () => {
    // ASCII art cannot reflow like text; the label is drawn one banner per
    // line, and a line past about eight letters runs off a 375px screen from
    // a rock near the edge.
    expect(rockLabel(named('the tide was out'))).toEqual(['the tide', 'was out'])
    for (const line of rockLabel(named('a long walk home through the rain'))) {
      expect(line.length).toBeLessThanOrEqual(8)
    }
  })

  it('keeps a single long word whole rather than cutting it', () => {
    expect(rockLabel(named('kaleidoscope'))).toEqual(['kaleidoscope'])
  })

  it('draws only what the font can draw, lowercased', () => {
    expect(rockLabel(named('Bikes!'))).toEqual(['bikes'])
  })
})

describe('rockName', () => {
  it('uses the written description when there is one', () => {
    expect(rockName(photo('a.jpg').caption, 'image')).toBe('two motorbikes parked by a fence')
  })

  it('says what is known instead of reading out a filename', () => {
    // Before: "[photograph — aidan to describe: website-01.jpg]", twenty-five
    // times over, to anyone using a screen reader.
    expect(rockName(photo('b.jpg').caption, 'image')).toBe('photograph, june 2024')
    expect(rockName(photo('c.mp4').caption, 'video')).toBe('clip, june 2026')
    expect(rockName(photo('d.jpg').caption, 'image')).toBe('photograph, undated')
    for (const f of ['b.jpg', 'c.mp4', 'd.jpg', 'e.mp4']) {
      const name = rockName(photo(f).caption, photo(f).kind)
      expect(name).not.toMatch(/\.jpg|\.mp4|\[/)
    }
  })

  it('uses the name while there is no description', () => {
    const c = resolveCaption('n.jpg', { photos: { 'n.jpg': { date: '2025-05-22', name: 'bikes' } } })
    expect(rockName(c, 'image')).toBe('photograph, bikes, may 2025')
  })

  it('adds the place when it is written', () => {
    const noAlt = resolveCaption('x.jpg', { places: { '2025-05-22': 'kyoto' }, photos: { 'x.jpg': { date: '2025-05-22' } } })
    expect(rockName(noAlt, 'image')).toBe('photograph, kyoto, may 2025')
  })
})
