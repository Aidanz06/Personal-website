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
  it('reads place · month when the place is written', () => {
    expect(rockLabel(photo('a.jpg').caption, 'image')).toBe('kyoto · may')
  })

  it('falls back to the month alone until the place is written', () => {
    // The year is already on the group's marker; repeating it on every rock
    // would be fifteen identical labels.
    expect(rockLabel(photo('b.jpg').caption, 'image')).toBe('june')
  })

  it('says when a rock is a clip', () => {
    expect(rockLabel(photo('c.mp4').caption, 'video')).toBe('june · clip')
    expect(rockLabel(photo('e.mp4').caption, 'video')).toBe('clip')
  })

  it('is empty for an undated still, rather than a placeholder on the page', () => {
    expect(rockLabel(photo('d.jpg').caption, 'image')).toBe('')
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

  it('adds the place when it is written', () => {
    const noAlt = resolveCaption('x.jpg', { places: { '2025-05-22': 'kyoto' }, photos: { 'x.jpg': { date: '2025-05-22' } } })
    expect(rockName(noAlt, 'image')).toBe('photograph, kyoto, may 2025')
  })
})
