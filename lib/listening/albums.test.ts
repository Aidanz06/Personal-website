import { describe, expect, it } from 'vitest'
import {
  MIN_PEBBLE_SIZE,
  isHidden,
  isPlaceholderCover,
  optimisedCover,
  parseTopAlbums,
  pebbleSize,
  pickCover,
  selectPebbles,
} from './albums.ts'
import { COVER_WIDTH, MAX_PEBBLES, MIN_PLAYCOUNT } from './constants.ts'
import { FIXTURE_TOP_ALBUMS } from './fixture.ts'

const PLACEHOLDER =
  'https://lastfm-img.freetls.fastly.net/i/u/300x300/2a96cbd8b46e442fc41c2b86b821562f.png'

function album(name: string, artist: string, playcount: number, image = 'https://img/x.jpg') {
  return {
    name,
    playcount: String(playcount),
    artist: { name: artist },
    image: [{ '#text': image, size: 'extralarge' }],
  }
}

function payload(albums: unknown[]) {
  return { topalbums: { album: albums } }
}

describe('isPlaceholderCover', () => {
  it('accepts a real last.fm url', () => {
    expect(isPlaceholderCover('https://lastfm-img.freetls.fastly.net/i/u/300x300/abc.jpg')).toBe(false)
  })

  it('rejects last.fm’s grey "no cover" star', () => {
    // It is a real image that loads fine, which is exactly why it has to be
    // detected: without this the pond shows a picture of a missing cover.
    expect(isPlaceholderCover(PLACEHOLDER)).toBe(true)
  })

  it('rejects blank, whitespace and undefined', () => {
    expect(isPlaceholderCover('')).toBe(true)
    expect(isPlaceholderCover('   ')).toBe(true)
    expect(isPlaceholderCover(undefined)).toBe(true)
  })

  it('rejects anything that is not an address', () => {
    expect(isPlaceholderCover('cover.jpg')).toBe(true)
    expect(isPlaceholderCover('javascript:alert(1)')).toBe(true)
  })

  it('accepts a root-relative path, which is a cover we downloaded', () => {
    expect(isPlaceholderCover('/listening/covers/a-b.jpg')).toBe(false)
  })
})

describe('pickCover', () => {
  it('takes the largest size on offer', () => {
    expect(
      pickCover([
        { '#text': 'https://img/small.jpg', size: 'small' },
        { '#text': 'https://img/large.jpg', size: 'large' },
        { '#text': 'https://img/xl.jpg', size: 'extralarge' },
      ]),
    ).toBe('https://img/xl.jpg')
  })

  it('falls past a placeholder to a real smaller size', () => {
    expect(
      pickCover([
        { '#text': 'https://img/small.jpg', size: 'small' },
        { '#text': PLACEHOLDER, size: 'extralarge' },
      ]),
    ).toBe('https://img/small.jpg')
  })

  it('returns nothing when every size is a placeholder', () => {
    expect(pickCover([{ '#text': PLACEHOLDER, size: 'extralarge' }])).toBe('')
  })

  it('survives a missing, empty or malformed image array', () => {
    expect(pickCover(undefined)).toBe('')
    expect(pickCover([])).toBe('')
    expect(pickCover([null, 3, 'x'])).toBe('')
  })
})

describe('parseTopAlbums', () => {
  it('reads name, artist and playcount out of the response', () => {
    const [first] = parseTopAlbums(payload([album('Kid A', 'Radiohead', 42)]))
    expect(first).toMatchObject({ album: 'Kid A', artist: 'Radiohead', playcount: 42 })
  })

  it('reads the fixture, which is a real response in shape', () => {
    // The fixture goes through this same parser, which is the point of it
    // being shaped like a response rather than like a list of pebbles.
    expect(parseTopAlbums(FIXTURE_TOP_ALBUMS)).toHaveLength(8)
  })

  it('handles a single album coming back as an object, not an array', () => {
    expect(parseTopAlbums({ topalbums: { album: album('One', 'Someone', 9) } })).toHaveLength(1)
  })

  it('drops entries with no album or no artist', () => {
    expect(
      parseTopAlbums(payload([album('', 'Someone', 9), album('Thing', '', 9)])),
    ).toEqual([])
  })

  it('returns nothing rather than throwing on rubbish', () => {
    // last.fm answering strangely should cost the pebbles, not the page.
    for (const input of [null, undefined, 'x', 7, {}, { topalbums: null }, []]) {
      expect(parseTopAlbums(input)).toEqual([])
    }
  })

  it('treats a missing playcount as zero rather than NaN', () => {
    const [first] = parseTopAlbums(
      payload([{ name: 'A', artist: { name: 'B' }, image: [] }]),
    )
    expect(first!.playcount).toBe(0)
  })
})

describe('isHidden', () => {
  it('hides one record when the rule names an album', () => {
    const hide = [{ artist: 'Brian Eno', album: 'Music for Airports' }]
    expect(isHidden('Music for Airports', 'Brian Eno', hide)).toBe(true)
    expect(isHidden('Another Green World', 'Brian Eno', hide)).toBe(false)
  })

  it('hides everything by an artist when the album is left out', () => {
    const hide = [{ artist: 'Sleep Sounds' }]
    expect(isHidden('Rain for Eight Hours', 'Sleep Sounds', hide)).toBe(true)
    expect(isHidden('Anything', 'Sleep Sounds', hide)).toBe(true)
  })

  it('ignores case and stray whitespace', () => {
    expect(isHidden('KID A', 'radiohead', [{ artist: ' Radiohead ', album: 'Kid  A' }])).toBe(true)
  })

  it('hides nothing for a blank rule', () => {
    // content/listening.json ships with an empty slot so the shape is
    // visible. An empty slot that hid the entire pond would be memorable.
    expect(isHidden('Kid A', 'Radiohead', [{ artist: '', album: '' }])).toBe(false)
    expect(isHidden('Kid A', 'Radiohead', [])).toBe(false)
    expect(isHidden('Kid A', 'Radiohead', undefined)).toBe(false)
  })
})

describe('pebbleSize', () => {
  it('gives the most played album the full size', () => {
    expect(pebbleSize(100, 100)).toBe(1)
  })

  it('scales by area, not by radius', () => {
    // An album played half as often should look half as PRESENT, and
    // presence is area. Scaling the radius linearly would make it a quarter.
    expect(pebbleSize(50, 100)).toBeCloseTo(Math.SQRT1_2, 6)
  })

  it('never goes below the floor, so the last pebble is still tappable', () => {
    expect(pebbleSize(1, 10_000)).toBe(MIN_PEBBLE_SIZE)
    expect(MIN_PEBBLE_SIZE).toBeGreaterThan(0.4)
  })

  it('is monotonic in playcount', () => {
    let previous = 0
    for (let n = 1; n <= 60; n++) {
      const size = pebbleSize(n, 60)
      expect(size).toBeGreaterThanOrEqual(previous)
      previous = size
    }
  })

  it('survives zero, negative and non-finite input', () => {
    for (const value of [0, -5, NaN, Infinity]) {
      const size = pebbleSize(value, 100)
      expect(Number.isFinite(size)).toBe(true)
      expect(size).toBeGreaterThan(0)
    }
    expect(pebbleSize(10, 0)).toBe(1)
  })
})

describe('optimisedCover', () => {
  it('routes a cover through the image optimiser at an allowed width', () => {
    // A width outside Next's deviceSizes allowlist is a 400 from the
    // optimiser, not a slightly different file.
    const url = optimisedCover('https://img/x.jpg')
    expect(url).toContain('/_next/image?url=')
    expect(url).toContain(`w=${COVER_WIDTH}`)
    expect(url).toContain('q=75')
    expect([640, 750, 828, 1080, 1200, 1920, 2048, 3840]).toContain(COVER_WIDTH)
  })

  it('makes the cover same-origin, so the canvas is not tainted', () => {
    // The pond reads the pixels of everything it draws. A cross-origin image
    // makes getImageData throw and costs the whole opening effect.
    expect(optimisedCover('https://lastfm.example/x.jpg').startsWith('/_next/')).toBe(true)
  })

  it('leaves nothing as nothing', () => {
    expect(optimisedCover('')).toBe('')
  })
})

describe('selectPebbles', () => {
  const albums = [
    { album: 'A', artist: 'One', playcount: 60, coverUrl: 'https://img/a.jpg' },
    { album: 'B', artist: 'Two', playcount: 30, coverUrl: 'https://img/b.jpg' },
    { album: 'C', artist: 'Three', playcount: 2, coverUrl: 'https://img/c.jpg' },
  ]

  it('drops anything under the minimum playcount', () => {
    const pebbles = selectPebbles(albums)
    expect(pebbles.map((p) => p.album)).toEqual(['A', 'B'])
    expect(MIN_PLAYCOUNT).toBeGreaterThan(1)
  })

  it('drops anything on the hide list', () => {
    const pebbles = selectPebbles(albums, { hide: [{ artist: 'Two' }] })
    expect(pebbles.map((p) => p.album)).toEqual(['A'])
  })

  it('keeps at most MAX_PEBBLES of them', () => {
    const many = Array.from({ length: 30 }, (_, i) => ({
      album: `A${i}`,
      artist: 'X',
      playcount: 100 - i,
      coverUrl: 'https://img/x.jpg',
    }))
    expect(selectPebbles(many)).toHaveLength(MAX_PEBBLES)
    expect(MAX_PEBBLES).toBeGreaterThanOrEqual(6)
    expect(MAX_PEBBLES).toBeLessThanOrEqual(8)
  })

  it('ranks from one, in the order last.fm gave', () => {
    // Not re-sorted: a tie should break the way last.fm broke it rather than
    // the way Array.sort happens to.
    expect(selectPebbles(albums).map((p) => p.rank)).toEqual([1, 2])
  })

  it('sizes them against the most played album, not against the floor', () => {
    const [first, second] = selectPebbles(albums)
    expect(first!.size).toBe(1)
    expect(second!.size).toBeLessThan(1)
    expect(second!.size).toBeGreaterThanOrEqual(MIN_PEBBLE_SIZE)
  })

  it('marks a placeholder cover as coverless rather than showing it', () => {
    const [pebble] = selectPebbles([
      { album: 'A', artist: 'One', playcount: 60, coverUrl: PLACEHOLDER },
    ])
    expect(pebble!.cover).toBe('')
  })

  it('handles no albums at all', () => {
    expect(selectPebbles([])).toEqual([])
  })

  it('is deterministic: the same data gives the same pebbles', () => {
    expect(selectPebbles(albums)).toEqual(selectPebbles(albums))
  })
})
