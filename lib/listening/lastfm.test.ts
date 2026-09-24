import { describe, expect, it, vi } from 'vitest'
import {
  isoDate,
  loadPebbles,
  readCredentials,
  setLastGood,
  topTracksUrl,
  trackInfoUrl,
} from './lastfm.ts'
import { LISTENING_PERIOD, MAX_PEBBLES, MIN_PLAYCOUNT } from './constants.ts'
import { FIXTURE_TOP_TRACKS } from './fixture.ts'

const CREDENTIALS = { LASTFM_API_KEY: 'secret-key', LASTFM_USER: 'aidan' }
const NOW = () => new Date('2026-09-23T11:00:00Z')
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

const topTracks = {
  toptracks: {
    track: [track('Touch the Sky', 'Hillsong United', 4), track('Majesty', 'The Worship Initiative', 5)],
  },
}

/** Album art per track title, as track.getInfo would give it. */
const ALBUM_ART: Record<string, string> = {
  'Touch the Sky': 'https://lastfm-img.freetls.fastly.net/i/u/300x300/empires.jpg',
}

function respond(payload: unknown, ok = true) {
  return { ok, json: async () => payload } as unknown as Response
}

/**
 * A fetch that answers like last.fm: top tracks for user.gettoptracks, and
 * an album (or none) for track.getinfo.
 */
function lastfm(top: unknown = topTracks, options: { infoFails?: boolean } = {}) {
  return vi.fn(async (address: string) => {
    const params = new URL(address).searchParams
    if (params.get('method') === 'user.gettoptracks') return respond(top)
    if (params.get('method') === 'track.getinfo') {
      if (options.infoFails) throw new Error('econnreset')
      const art = ALBUM_ART[params.get('track') ?? '']
      return respond({
        track: art ? { album: { title: 'x', image: [{ '#text': art, size: 'extralarge' }] } } : {},
      })
    }
    return respond({ error: 3 })
  }) as unknown as typeof fetch
}

function failingFetch() {
  return vi.fn(async () => {
    throw new Error('econnrefused')
  }) as unknown as typeof fetch
}

function calls(fetchImpl: typeof fetch): string[] {
  return (fetchImpl as unknown as { mock: { calls: [string][] } }).mock.calls.map(
    ([address]) => new URL(address).searchParams.get('method') ?? '',
  )
}

function options(extra: Record<string, unknown> = {}) {
  return { now: NOW, isDev: false, log: () => {}, ...extra }
}

describe('readCredentials', () => {
  it('needs both halves', () => {
    expect(readCredentials(CREDENTIALS)).toEqual({ apiKey: 'secret-key', user: 'aidan' })
    expect(readCredentials({ LASTFM_API_KEY: 'k' })).toBeNull()
    expect(readCredentials({ LASTFM_USER: 'u' })).toBeNull()
    expect(readCredentials({})).toBeNull()
    expect(readCredentials({ LASTFM_API_KEY: '  ', LASTFM_USER: 'u' })).toBeNull()
  })
})

describe('request urls', () => {
  it('asks for top tracks over the period the constant names', () => {
    const url = topTracksUrl({ apiKey: 'k', user: 'aidan' }, LISTENING_PERIOD)
    expect(url).toContain('method=user.gettoptracks')
    expect(url).toContain(`period=${LISTENING_PERIOD}`)
    expect(url).toContain('user=aidan')
    expect(url).toContain('format=json')
  })

  it('asks track.getInfo for one track, without autocorrect renaming it', () => {
    const url = trackInfoUrl('k', 'Prince', 'Purple Rain')
    expect(url).toContain('method=track.getinfo')
    expect(url).toContain('track=Purple+Rain')
    expect(url).not.toContain('autocorrect=1')
  })
})

describe('isoDate', () => {
  it('is UTC, so a build machine’s timezone cannot shift the date', () => {
    expect(isoDate(new Date('2026-01-01T23:30:00Z'))).toBe('2026-01-01')
  })
})

describe('loadPebbles with no key', () => {
  it('falls back to the committed fixture', async () => {
    setLastGood(null)
    const result = await loadPebbles(options({ env: {} }))
    expect(result.source).toBe('fixture')
    // Seven in the fixture: one past the top five, one under the floor.
    expect(result.pebbles).toHaveLength(5)
    expect(result.asOf).toBe('2026-09-23')
  })

  it('never touches the network', async () => {
    const fetchImpl = lastfm()
    await loadPebbles(options({ env: {}, fetchImpl }))
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('logs one clear line in dev, and nothing in production', async () => {
    const log = vi.fn()
    await loadPebbles(options({ env: {}, isDev: true, log }))
    expect(log).toHaveBeenCalledTimes(1)
    expect(String(log.mock.calls[0]?.[0])).toContain('LASTFM_API_KEY')

    const quiet = vi.fn()
    await loadPebbles(options({ env: {}, isDev: false, log: quiet }))
    expect(quiet).not.toHaveBeenCalled()
  })

  it('gives the fixture covers that actually exist, and leaves one coverless', async () => {
    // A made-up last.fm URL would 404, and a cover that 404s never opens.
    const { pebbles } = await loadPebbles(options({ env: {} }))
    const withCovers = pebbles.filter((p) => p.cover)
    expect(withCovers.length).toBeGreaterThan(0)
    for (const pebble of withCovers) {
      expect(decodeURIComponent(pebble.cover)).toContain('/lab/00-test-pattern.png')
    }
    expect(pebbles.some((p) => p.cover === '')).toBe(true)
  })
})

describe('loadPebbles with a key', () => {
  it('never asks for an uncached request, which would make the page dynamic', async () => {
    // `cache: 'no-store'` on a fetch opts the whole route into rendering on
    // every request. The page's own revalidate is the only schedule this
    // should run on.
    setLastGood(null)
    const fetchImpl = lastfm()
    await loadPebbles(options({ env: CREDENTIALS, fetchImpl }))
    const mock = (fetchImpl as unknown as { mock: { calls: [string, RequestInit?][] } }).mock
    for (const [, init] of mock.calls) {
      const typed = init as (RequestInit & { next?: { revalidate?: number } }) | undefined
      expect(typed?.cache).not.toBe('no-store')
      expect(typed?.next?.revalidate).not.toBe(0)
    }
  })

  it('uses the top tracks, in last.fm’s order', async () => {
    setLastGood(null)
    const result = await loadPebbles(options({ env: CREDENTIALS, fetchImpl: lastfm() }))
    expect(result.source).toBe('lastfm')
    expect(result.pebbles.map((p) => p.title)).toEqual(['Touch the Sky', 'Majesty'])
  })

  it('gives each track its album’s cover, and leaves the rest coverless', async () => {
    // Majesty is real: last.fm links it to no album, so it has no art.
    setLastGood(null)
    const { pebbles } = await loadPebbles(options({ env: CREDENTIALS, fetchImpl: lastfm() }))
    expect(decodeURIComponent(pebbles[0]!.cover)).toContain('empires.jpg')
    expect(pebbles[1]!.cover).toBe('')
  })

  it('looks up covers only for the tracks it will show', async () => {
    setLastGood(null)
    const many = {
      toptracks: { track: Array.from({ length: 20 }, (_, i) => track(`T${i}`, 'X', 30 - i)) },
    }
    const fetchImpl = lastfm(many)
    await loadPebbles(options({ env: CREDENTIALS, fetchImpl }))
    expect(calls(fetchImpl).filter((m) => m === 'track.getinfo')).toHaveLength(MAX_PEBBLES)
  })

  it('still shows the tracks when every cover lookup fails', async () => {
    // A cover lookup that fails costs that cover, never the pebble.
    setLastGood(null)
    const result = await loadPebbles(
      options({ env: CREDENTIALS, fetchImpl: lastfm(topTracks, { infoFails: true }) }),
    )
    expect(result.pebbles).toHaveLength(2)
    expect(result.pebbles.every((p) => p.cover === '')).toBe(true)
  })

  it('applies the hide list, including to the remembered answer', async () => {
    setLastGood(null)
    const hidden = await loadPebbles(
      options({ env: CREDENTIALS, fetchImpl: lastfm(), hide: [{ artist: 'Hillsong United' }] }),
    )
    expect(hidden.pebbles.map((p) => p.title)).toEqual(['Majesty'])

    // Then last.fm goes down, and a track is hidden after the fact.
    const after = await loadPebbles(
      options({ env: CREDENTIALS, fetchImpl: failingFetch(), hide: [{ artist: '', track: 'Majesty' }] }),
    )
    expect(after.pebbles.map((p) => p.title)).toEqual(['Touch the Sky'])
  })

  it('never falls back to the fixture once a key exists', async () => {
    // Fixture data on a live site would be a lie. No pebbles is honest.
    setLastGood(null)
    const result = await loadPebbles(options({ env: CREDENTIALS, fetchImpl: failingFetch() }))
    expect(result.source).not.toBe('fixture')
    expect(result.pebbles).toEqual([])
  })

  it('keeps the last good data, covers included, when the api fails', async () => {
    setLastGood(null)
    const good = await loadPebbles(options({ env: CREDENTIALS, fetchImpl: lastfm() }))
    const after = await loadPebbles(
      options({
        env: CREDENTIALS,
        fetchImpl: failingFetch(),
        now: () => new Date('2026-10-05T11:00:00Z'),
      }),
    )
    expect(after.pebbles).toEqual(good.pebbles)
    // The ORIGINAL date, not today's.
    expect(after.asOf).toBe(good.asOf)
  })

  it('has no pebbles at all when the api fails and nothing was ever good', async () => {
    setLastGood(null)
    const result = await loadPebbles(options({ env: CREDENTIALS, fetchImpl: failingFetch() }))
    expect(result).toMatchObject({ pebbles: [], asOf: '', source: 'none' })
  })

  it('treats an http error, a last.fm error body and bad json the same way', async () => {
    setLastGood(null)
    const cases: (typeof fetch)[] = [
      vi.fn(async () => respond(topTracks, false)) as unknown as typeof fetch,
      vi.fn(async () => respond({ error: 6, message: 'User not found' })) as unknown as typeof fetch,
      vi.fn(async () => ({
        ok: true,
        json: async () => {
          throw new Error('unexpected token')
        },
      })) as unknown as typeof fetch,
    ]
    for (const fetchImpl of cases) {
      const result = await loadPebbles(options({ env: CREDENTIALS, fetchImpl }))
      expect(result.source).toBe('none')
    }
  })

  it('does not remember an empty answer over a good one', async () => {
    setLastGood(null)
    const good = await loadPebbles(options({ env: CREDENTIALS, fetchImpl: lastfm() }))
    const empty = await loadPebbles(
      options({ env: CREDENTIALS, fetchImpl: lastfm({ toptracks: { track: [] } }) }),
    )
    expect(empty.pebbles).toEqual(good.pebbles)
  })

  it('filters by playcount the same way the fixture path does', async () => {
    setLastGood(null)
    const quiet = { toptracks: { track: [track('Once', 'Someone', MIN_PLAYCOUNT - 1)] } }
    const result = await loadPebbles(options({ env: CREDENTIALS, fetchImpl: lastfm(quiet) }))
    expect(result.pebbles).toEqual([])
  })
})

describe('the fixture itself', () => {
  it('is obviously not real data', () => {
    const names = FIXTURE_TOP_TRACKS.toptracks.track.map((t) => `${t.name} ${t.artist.name}`)
    expect(names.join(' ').toLowerCase()).toMatch(/fixture|example|sample|dummy|testcard/)
  })
})
