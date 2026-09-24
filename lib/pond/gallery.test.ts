import { describe, expect, it } from 'vitest'
import { galleryGroups, orderGallery, rockLabel, rockName } from './gallery'
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

describe('grouping by shoot', () => {
  // The critique of 2026-09-24 (second run): 2025 was one run of 17 rocks,
  // 12 of them the same kamakura day. Aidan chose to group by shoot instead.
  const shoot = (file: string, date: string, place: string) =>
    ({ file, caption: resolveCaption(file, { places: { [date]: place }, photos: { [file]: { date } } }) })
  const undated = (file: string) => ({ file, caption: resolveCaption(file, { photos: { [file]: {} } }) })

  const photos = [
    shoot('01.jpg', '2025-05-22', 'kamakura'),
    shoot('02.jpg', '2025-05-22', 'kamakura'),
    shoot('11.jpg', '2025-05-25', 'osaka'),
    shoot('12.jpg', '2025-05-25', 'osaka'),
    shoot('13.jpg', '2026-06-14', 'qianling'),
    shoot('15.jpg', '2025-08-03', 'hawaii'),
    shoot('17.jpg', '2025-05-17', 'kamakura'),
    shoot('18.jpg', '2025-08-09', "kaua'i"),
    shoot('23.jpg', '2025-03-12', 'london'),
    undated('14.jpg'),
    undated('19.jpg'),
  ]

  it('keeps one place together within a month, newest month first', () => {
    expect(orderGallery(photos).map((p) => p.file)).toEqual([
      '13.jpg', '15.jpg', '18.jpg', '01.jpg', '02.jpg', '17.jpg', '11.jpg', '12.jpg', '23.jpg', '14.jpg', '19.jpg',
    ])
  })

  it('labels a shoot by its place and month', () => {
    const labels = galleryGroups(orderGallery(photos).map((p) => p.caption))
    expect(labels.slice(3, 8)).toEqual([
      'kamakura · may 2025', 'kamakura · may 2025', 'kamakura · may 2025',
      'osaka · may 2025', 'osaka · may 2025',
    ])
  })

  it('lets neighbouring lone photographs share one marker, so a single is not a group of its own', () => {
    const labels = galleryGroups(orderGallery(photos).map((p) => p.caption))
    expect(labels.slice(0, 3)).toEqual(Array(3).fill("qianling, hawaii, kaua'i · 2025–2026"))
    expect(labels[8]).toBe('london · march 2025')
  })

  it('puts the undated together at the bottom', () => {
    const labels = galleryGroups(orderGallery(photos).map((p) => p.caption))
    expect(labels.slice(9)).toEqual(['undated', 'undated'])
  })

  it('names a merged run by its month when it shares one', () => {
    const aug = [shoot('15.jpg', '2025-08-03', 'hawaii'), shoot('18.jpg', '2025-08-09', "kaua'i")]
    expect(galleryGroups(orderGallery(aug).map((p) => p.caption))).toEqual(Array(2).fill("hawaii, kaua'i · august 2025"))
  })
})

describe('rockLabel', () => {
  const named = (name: string) =>
    resolveCaption('n.jpg', { photos: { 'n.jpg': { date: '2025-05-22', name } } })

  it('is the name Aidan gave the photograph, exactly as he wrote it', () => {
    // Regular text now, not ASCII art, so nothing is lowercased or stripped:
    // it's his words.
    expect(rockLabel(named('Two Bikes!'))).toBe('Two Bikes!')
  })

  it('is empty until he names it: no month, no placeholder', () => {
    expect(rockLabel(photo('a.jpg').caption)).toBe('')
    expect(rockLabel(photo('e.mp4').caption)).toBe('')
  })

  it('trims stray whitespace', () => {
    expect(rockLabel(named('  bikes  '))).toBe('bikes')
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

  it('starts with the visible name, so what you see is what you can say (WCAG 2.5.3)', () => {
    // The critique of 2026-09-24 (second run): "qianling bridge" was under
    // the rock but not in its accessible name, so a voice-control user saying
    // "click qianling bridge" got nothing.
    const both = resolveCaption('q.jpg', {
      photos: { 'q.jpg': { date: '2026-06-14', name: 'qianling bridge', alt: 'A stone arch bridge over a lake.' } },
    })
    expect(rockName(both, 'image')).toBe('qianling bridge: A stone arch bridge over a lake.')
    const nameOnly = resolveCaption('n.jpg', { photos: { 'n.jpg': { date: '2025-05-22', name: 'bikes' } } })
    expect(rockName(nameOnly, 'image')).toBe('bikes, photograph, may 2025')
  })

  it('adds the place when it is written', () => {
    const noAlt = resolveCaption('x.jpg', { places: { '2025-05-22': 'kyoto' }, photos: { 'x.jpg': { date: '2025-05-22' } } })
    expect(rockName(noAlt, 'image')).toBe('photograph, kyoto, may 2025')
  })
})

describe('the /about grid', () => {
  it('shows the photographs in the same order as the pond', async () => {
    // Critique of 2026-09-24 (second run): the grid was in filename order, so
    // june 2026 sat among may 2025 while the pond runs newest first.
    const { readFileSync } = await import('node:fs')
    const { join } = await import('node:path')
    const grid = readFileSync(join(process.cwd(), 'components/PhotoGrid.tsx'), 'utf8')
    expect(grid).toMatch(/orderGallery\(listPhotos\(\)\)/)
  })
})

describe('the /about grid, grouped', () => {
  it('uses the pond\'s shoot markers and names instead of repeating place and date under every tile', async () => {
    // Polish, 2026-09-24: "kamakura · may 2025" appeared under eleven tiles
    // in a row. The pond says it once per shoot and names each rock.
    const { readFileSync } = await import('node:fs')
    const { join } = await import('node:path')
    const grid = readFileSync(join(process.cwd(), 'components/PhotoGrid.tsx'), 'utf8')
    expect(grid).toMatch(/galleryGroups\(/)
    expect(grid).toMatch(/rockLabel\(/)
  })
})
