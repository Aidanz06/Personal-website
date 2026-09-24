import { describe, expect, it, vi } from 'vitest'
import {
  isoDate,
  loadPebbles,
  readCredentials,
  setLastGood,
  topAlbumsUrl,
} from './lastfm.ts'
import { LISTENING_PERIOD, MIN_PLAYCOUNT } from './constants.ts'
import { FIXTURE_TOP_ALBUMS } from './fixture.ts'

const CREDENTIALS = { LASTFM_API_KEY: 'secret-key', LASTFM_USER: 'aidan' }
const NOW = () => new Date('2026-09-23T11:00:00Z')

/** A fetch that answers with one payload, or fails. */
function stubFetch(payload: unknown, ok = true) {
  return vi.fn(async () =>
    ({ ok, json: async () => payload }) as unknown as Response,
  ) as unknown as typeof fetch
}

function failingFetch() {
  return vi.fn(async () => {
    throw new Error('econnrefused')
  }) as unknown as typeof fetch
}

const realAlbums = {
  topalbums: {
    album: [
      {
        name: 'Real Album',
        playcount: '40',
        artist: { name: 'Real Artist' },
        image: [{ '#text': 'https://img/real.jpg', size: 'extralarge' }],
      },
    ],
  },
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

describe('topAlbumsUrl', () => {
  it('asks for the period the constant names', () => {
    const url = topAlbumsUrl({ apiKey: 'k', user: 'aidan' }, LISTENING_PERIOD)
    expect(url).toContain('method=user.gettopalbums')
    expect(url).toContain(`period=${LISTENING_PERIOD}`)
    expect(url).toContain('user=aidan')
    expect(url).toContain('format=json')
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
    // Eight in the fixture, one under the playcount floor.
    expect(result.pebbles).toHaveLength(7)
    expect(result.asOf).toBe('2026-09-23')
  })

  it('never touches the network', async () => {
    const fetchImpl = stubFetch(realAlbums)
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

  it('gives the fixture covers that actually exist', async () => {
    // A fixture cover URL is faithful in shape but has no file behind it, and
    // a cover that 404s never opens — hiding the thing the fixture exists to
    // show.
    const { pebbles } = await loadPebbles(options({ env: {} }))
    const withCovers = pebbles.filter((p) => p.cover)
    expect(withCovers.length).toBeGreaterThan(0)
    for (const pebble of withCovers) {
      expect(decodeURIComponent(pebble.cover)).toContain('/lab/00-test-pattern.png')
    }
  })

  it('keeps the fixture’s coverless album coverless', async () => {
    const { pebbles } = await loadPebbles(options({ env: {} }))
    expect(pebbles.some((p) => p.cover === '')).toBe(true)
  })
})

describe('loadPebbles with a key', () => {
  it('uses the answer, and applies the hide list to it', async () => {
    setLastGood(null)
    const result = await loadPebbles(
      options({ env: CREDENTIALS, fetchImpl: stubFetch(realAlbums) }),
    )
    expect(result.source).toBe('lastfm')
    expect(result.pebbles.map((p) => p.album)).toEqual(['Real Album'])

    // The hide list applies on the way out of the cache too, so a record
    // just added to it cannot come back from a stale answer.
    const hidden = await loadPebbles(
      options({
        env: CREDENTIALS,
        fetchImpl: stubFetch(realAlbums),
        hide: [{ artist: 'Real Artist' }],
      }),
    )
    expect(hidden.pebbles).toEqual([])
  })

  it('never falls back to the fixture once a key exists', async () => {
    // Fixture data on a live site would be a lie. No pebbles is honest.
    setLastGood(null)
    const result = await loadPebbles(
      options({ env: CREDENTIALS, fetchImpl: failingFetch() }),
    )
    expect(result.source).not.toBe('fixture')
    expect(result.pebbles).toEqual([])
    expect(result.pebbles.map((p) => p.album)).not.toContain('Placeholder in Blue')
  })

  it('keeps the last good data when the api fails', async () => {
    setLastGood(null)
    const good = await loadPebbles(
      options({ env: CREDENTIALS, fetchImpl: stubFetch(realAlbums) }),
    )
    const after = await loadPebbles(
      options({
        env: CREDENTIALS,
        fetchImpl: failingFetch(),
        now: () => new Date('2026-10-05T11:00:00Z'),
      }),
    )
    expect(after.pebbles).toEqual(good.pebbles)
    // The ORIGINAL date, not today's: claiming a stale list is today's is the
    // one lie the "as of" line exists to prevent.
    expect(after.asOf).toBe(good.asOf)
  })

  it('has no pebbles at all when the api fails and nothing was ever good', async () => {
    setLastGood(null)
    const result = await loadPebbles(
      options({ env: CREDENTIALS, fetchImpl: failingFetch() }),
    )
    expect(result).toMatchObject({ pebbles: [], asOf: '', source: 'none' })
  })

  it('treats an http error, a last.fm error body and bad json the same way', async () => {
    setLastGood(null)
    const cases: (typeof fetch)[] = [
      stubFetch(realAlbums, false),
      stubFetch({ error: 6, message: 'User not found' }),
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

  it('hides an album that is already in the remembered answer', async () => {
    setLastGood(null)
    await loadPebbles(options({ env: CREDENTIALS, fetchImpl: stubFetch(realAlbums) }))
    const after = await loadPebbles(
      options({
        env: CREDENTIALS,
        fetchImpl: failingFetch(),
        hide: [{ artist: 'Real Artist' }],
      }),
    )
    expect(after.pebbles).toEqual([])
  })

  it('does not remember an empty answer over a good one', async () => {
    // A scrobbler that was off for a month should not wipe out the last good
    // month.
    setLastGood(null)
    const good = await loadPebbles(
      options({ env: CREDENTIALS, fetchImpl: stubFetch(realAlbums) }),
    )
    const empty = await loadPebbles(
      options({ env: CREDENTIALS, fetchImpl: stubFetch({ topalbums: { album: [] } }) }),
    )
    expect(empty.pebbles).toEqual(good.pebbles)
  })

  it('filters by playcount the same way the fixture path does', async () => {
    setLastGood(null)
    const quiet = {
      topalbums: {
        album: [
          {
            name: 'Barely Played',
            playcount: String(MIN_PLAYCOUNT - 1),
            artist: { name: 'Someone' },
            image: [],
          },
        ],
      },
    }
    const result = await loadPebbles(options({ env: CREDENTIALS, fetchImpl: stubFetch(quiet) }))
    expect(result.pebbles).toEqual([])
  })
})

describe('the fixture itself', () => {
  it('is obviously not real data', async () => {
    const names = FIXTURE_TOP_ALBUMS.topalbums.album.map((a) => `${a.name} ${a.artist.name}`)
    expect(names.join(' ').toLowerCase()).toMatch(/fixture|example|sample|dummy|testcard/)
  })
})
