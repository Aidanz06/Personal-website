import { describe, expect, it } from 'vitest'
import {
  MIN_PEBBLE_SIZE,
  isHidden,
  isPlaceholderCover,
  optimisedCover,
  parseTopTracks,
  parseTrackInfoCover,
  pebbleSize,
  pickCover,
  selectPebbles,
  selectTracks,
  trackKey,
} from './pebbles.ts'
import { COVER_WIDTH, MAX_PEBBLES, MIN_PLAYCOUNT } from './constants.ts'
import { FIXTURE_TOP_TRACKS } from './fixture.ts'

const PLACEHOLDER =
  'https://lastfm-img.freetls.fastly.net/i/u/300x300/2a96cbd8b46e442fc41c2b86b821562f.png'

function track(name: string, artist: string, playcount: number) {
  return {
    name,
    playcount: String(playcount),
    artist: { name: artist },
    image: [{ '#text': PLACEHOLDER, size: 'extralarge' }],
  }
}

function payload(tracks: unknown[]) {
  return { toptracks: { track: tracks } }
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

describe('parseTopTracks', () => {
  it('reads title, artist and playcount out of the response', () => {
    const [first] = parseTopTracks(payload([track('Idioteque', 'Radiohead', 42)]))
    expect(first).toEqual({ title: 'Idioteque', artist: 'Radiohead', playcount: 42 })
  })

  it('reads the fixture, which is a real response in shape', () => {
    // The fixture goes through this same parser, which is the point of it
    // being shaped like a response rather than like a list of pebbles.
    expect(parseTopTracks(FIXTURE_TOP_TRACKS)).toHaveLength(7)
  })

  it('handles a single track coming back as an object, not an array', () => {
    expect(parseTopTracks({ toptracks: { track: track('One', 'Someone', 9) } })).toHaveLength(1)
  })

  it('drops entries with no title or no artist', () => {
    expect(parseTopTracks(payload([track('', 'Someone', 9), track('Thing', '', 9)]))).toEqual([])
  })

  it('returns nothing rather than throwing on rubbish', () => {
    // last.fm answering strangely should cost the pebbles, not the page.
    for (const input of [null, undefined, 'x', 7, {}, { toptracks: null }, []]) {
      expect(parseTopTracks(input)).toEqual([])
    }
  })

  it('treats a missing playcount as zero rather than NaN', () => {
    const [first] = parseTopTracks(payload([{ name: 'A', artist: { name: 'B' } }]))
    expect(first!.playcount).toBe(0)
  })

  it('takes no cover from the track itself, because last.fm never has one', () => {
    // Every track image is the grey placeholder, measured across a real
    // month. The cover comes from the album, via track.getInfo.
    const [first] = parseTopTracks(payload([track('Idioteque', 'Radiohead', 42)]))
    expect(Object.keys(first!)).not.toContain('coverUrl')
  })
})

describe('parseTrackInfoCover', () => {
  it('takes the album\u2019s cover from track.getInfo', () => {
    expect(
      parseTrackInfoCover({
        track: {
          name: 'Touch the Sky',
          album: {
            title: 'Empires',
            image: [
              { '#text': 'https://img/s.jpg', size: 'small' },
              { '#text': 'https://img/xl.jpg', size: 'extralarge' },
            ],
          },
        },
      }),
    ).toBe('https://img/xl.jpg')
  })

  it('has no cover for a track last.fm never linked to an album', () => {
    // Real: "Majesty" by The Worship Initiative comes back with no album.
    expect(parseTrackInfoCover({ track: { name: 'Majesty' } })).toBe('')
  })

  it('has no cover for an album with no artwork, rather than a placeholder', () => {
    // Real: two singles came back with an album and an empty image list.
    expect(parseTrackInfoCover({ track: { album: { title: 'Darkness', image: [] } } })).toBe('')
    expect(
      parseTrackInfoCover({ track: { album: { image: [{ '#text': PLACEHOLDER, size: 'large' }] } } }),
    ).toBe('')
  })

  it('returns nothing rather than throwing on rubbish', () => {
    for (const input of [null, undefined, {}, { track: null }, { error: 6 }]) {
      expect(parseTrackInfoCover(input)).toBe('')
    }
  })
})

describe('trackKey', () => {
  it('matches regardless of case and stray whitespace', () => {
    expect(trackKey(' Prince', 'Purple  Rain')).toBe(trackKey('prince', 'purple rain'))
  })

  it('keeps artist and title apart, so they cannot run together', () => {
    expect(trackKey('ab', 'c')).not.toBe(trackKey('a', 'bc'))
  })
})

describe('isHidden', () => {
  it('hides one song when the rule names a track', () => {
    const hide = [{ artist: 'Brian Eno', track: 'An Ending (Ascent)' }]
    expect(isHidden('An Ending (Ascent)', 'Brian Eno', hide)).toBe(true)
    expect(isHidden('Deep Blue Day', 'Brian Eno', hide)).toBe(false)
  })

  it('hides everything by an artist when the track is left out', () => {
    const hide = [{ artist: 'Sleep Sounds' }]
    expect(isHidden('Rain for Eight Hours', 'Sleep Sounds', hide)).toBe(true)
    expect(isHidden('Anything', 'Sleep Sounds', hide)).toBe(true)
  })

  it('hides a track by title alone, whoever sings it', () => {
    expect(isHidden('White Noise', 'Anyone', [{ artist: '', track: 'white noise' }])).toBe(true)
  })

  it('ignores case and stray whitespace', () => {
    expect(isHidden('IDIOTEQUE', 'radiohead', [{ artist: ' Radiohead ', track: 'idioteque' }])).toBe(true)
  })

  it('hides nothing for a blank rule', () => {
    // content/listening.json ships with an empty slot so the shape is
    // visible. An empty slot that hid the entire pond would be memorable.
    expect(isHidden('Idioteque', 'Radiohead', [{ artist: '', track: '' }])).toBe(false)
    expect(isHidden('Idioteque', 'Radiohead', [])).toBe(false)
    expect(isHidden('Idioteque', 'Radiohead', undefined)).toBe(false)
  })
})

describe('pebbleSize', () => {
  it('gives the most played track the full size', () => {
    expect(pebbleSize(100, 100)).toBe(1)
  })

  it('scales by area, not by radius', () => {
    // A track played half as often should look half as PRESENT, and
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
  const tracks = [
    { title: 'A', artist: 'One', playcount: 12 },
    { title: 'B', artist: 'Two', playcount: 6 },
    { title: 'C', artist: 'Three', playcount: 1 },
  ]
  const covers = new Map([[trackKey('One', 'A'), 'https://img/a.jpg']])

  it('shows the top five', () => {
    expect(MAX_PEBBLES).toBe(5)
    const many = Array.from({ length: 30 }, (_, i) => ({
      title: `T${i}`,
      artist: 'X',
      playcount: 100 - i,
    }))
    expect(selectPebbles(many).map((p) => p.title)).toEqual(['T0', 'T1', 'T2', 'T3', 'T4'])
  })

  it('drops anything under the minimum playcount', () => {
    expect(selectPebbles(tracks).map((p) => p.title)).toEqual(['A', 'B'])
    // Two: once is passing through. At four, a real month had three tracks.
    expect(MIN_PLAYCOUNT).toBe(2)
  })

  it('drops anything on the hide list', () => {
    expect(selectPebbles(tracks, { hide: [{ artist: 'Two' }] }).map((p) => p.title)).toEqual(['A'])
  })

  it('backfills from further down when one of the five is hidden', () => {
    const six = Array.from({ length: 6 }, (_, i) => ({ title: `T${i}`, artist: `A${i}`, playcount: 10 - i }))
    const shown = selectPebbles(six, { hide: [{ artist: 'A0' }] })
    expect(shown).toHaveLength(5)
    expect(shown.map((p) => p.title)).toEqual(['T1', 'T2', 'T3', 'T4', 'T5'])
  })

  it('ranks from one, in the order last.fm gave', () => {
    // Not re-sorted: a tie should break the way last.fm broke it.
    expect(selectPebbles(tracks).map((p) => p.rank)).toEqual([1, 2])
  })

  it('sizes them against the most played track, not against the floor', () => {
    const [first, second] = selectPebbles(tracks)
    expect(first!.size).toBe(1)
    expect(second!.size).toBeLessThan(1)
    expect(second!.size).toBeGreaterThanOrEqual(MIN_PEBBLE_SIZE)
  })

  it('gives a track the album cover it was found, optimised', () => {
    const [first, second] = selectPebbles(tracks, { covers })
    expect(decodeURIComponent(first!.cover)).toContain('https://img/a.jpg')
    expect(first!.cover).toContain('/_next/image')
    // No cover found for B: coverless, which opens as its title.
    expect(second!.cover).toBe('')
  })

  it('marks a placeholder cover as coverless rather than showing it', () => {
    const [pebble] = selectPebbles(tracks, {
      covers: new Map([[trackKey('One', 'A'), PLACEHOLDER]]),
    })
    expect(pebble!.cover).toBe('')
  })

  it('handles no tracks at all', () => {
    expect(selectPebbles([])).toEqual([])
  })

  it('is deterministic: the same data gives the same pebbles', () => {
    expect(selectPebbles(tracks, { covers })).toEqual(selectPebbles(tracks, { covers }))
  })
})

describe('selectTracks', () => {
  it('picks exactly the tracks selectPebbles shows, so covers are looked up for those', () => {
    const tracks = Array.from({ length: 9 }, (_, i) => ({ title: `T${i}`, artist: 'X', playcount: 20 - i }))
    const hide = [{ artist: 'X', track: 'T1' }]
    expect(selectTracks(tracks, { hide }).map((t) => t.title)).toEqual(
      selectPebbles(tracks, { hide }).map((p) => p.title),
    )
  })
})
