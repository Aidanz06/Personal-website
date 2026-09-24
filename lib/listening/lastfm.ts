/**
 * Talking to last.fm, and what to do when it does not answer.
 *
 * **Server-only, and the reason is the API key.** Nothing in here may ever be
 * imported by a client component. The key is read from `process.env` with no
 * `NEXT_PUBLIC_` prefix, so Next will not inline it into the browser bundle —
 * but "will not" is a property worth testing rather than trusting, and
 * lib/listening/secrets.test.ts walks the client import graph and asserts the
 * name never appears in it.
 *
 * There is no filesystem access here either, which keeps this module unit
 * testable: `fetch` and the environment both come in as arguments.
 *
 * The fallback chain, in order:
 *
 * 1. **No key configured** — the committed fixture, plus one console line in
 *    dev saying so. This is the state Aidan is in before he makes a key, and
 *    a blank page would tell him nothing about the design.
 * 2. **The API answered** — use it, and remember it. That is two steps: the
 *    month's top tracks, then track.getInfo for each of the five chosen, for
 *    its album's cover. A cover lookup that fails costs that one cover.
 * 3. **The API failed and we have a remembered answer** — use that. A dead
 *    API should cost freshness, not content.
 * 4. **The API failed and there is nothing remembered** — no pebbles at all.
 *    The page still renders its heading and water, and says nothing about an error,
 *    because a visitor did not come here to read about last.fm's uptime.
 */

import {
  parseTopTracks,
  parseTrackInfoCover,
  selectPebbles,
  selectTracks,
  trackKey,
} from './pebbles.ts'
import {
  LASTFM_ENDPOINT,
  LISTENING_PERIOD,
  MAX_PEBBLES,
  MIN_PLAYCOUNT,
  type Period,
} from './constants.ts'
import { FIXTURE_COVER_FILE, FIXTURE_TOP_TRACKS, FIXTURE_TRACKS_WITH_ART } from './fixture.ts'
import type { HideRule, PebbleSource, Pebble, RawTrack } from './types.ts'

/**
 * How long to wait for last.fm before giving up, per request.
 *
 * This runs during a build or a revalidation, so a hung request does not keep
 * a visitor waiting — but it can keep a deploy waiting, and an eight second
 * ceiling on a request we already have a fallback for is generous.
 */
const TIMEOUT_MS = 8000

/**
 * Just the two names, so a test can hand in an environment without building
 * a whole `ProcessEnv`. Indexed rather than declared, because `process.env`
 * is typed as an index signature and the two shapes have to line up.
 */
export type Env = Record<string, string | undefined>

/** Which route the data took, before any of it is resolved. */
export type Credentials = { apiKey: string; user: string } | null

/** The credentials, or null when either half is missing. */
export function readCredentials(env: Env): Credentials {
  const apiKey = (env.LASTFM_API_KEY ?? '').trim()
  const user = (env.LASTFM_USER ?? '').trim()
  if (!apiKey || !user) return null
  return { apiKey, user }
}

function url(params: Record<string, string>, apiKey: string): string {
  const query = new URLSearchParams({ ...params, api_key: apiKey, format: 'json' })
  return `${LASTFM_ENDPOINT}?${query.toString()}`
}

/** The month's top tracks. Built here so a test can assert what is asked for. */
export function topTracksUrl(
  credentials: { apiKey: string; user: string },
  period: Period,
  limit = 50,
): string {
  return url(
    { method: 'user.gettoptracks', user: credentials.user, period, limit: String(limit) },
    credentials.apiKey,
  )
}

/**
 * One track's details, which is where its album — and so its cover — is.
 *
 * `autocorrect` stays off: it is last.fm renaming a track to what it thinks
 * you meant, and the name on the page should be the one that was played.
 */
export function trackInfoUrl(apiKey: string, artist: string, track: string): string {
  return url({ method: 'track.getinfo', artist, track }, apiKey)
}

/**
 * The last answer last.fm gave that was worth keeping.
 *
 * It holds the tracks as last.fm sent them, NOT the pebbles they were turned
 * into. That distinction is load-bearing: the hide list is applied on the way
 * out, so a track Aidan adds to it disappears from the cached answer too. A
 * cache of already-filtered pebbles would keep serving a song he had just
 * asked never to see again. The covers found for them are kept alongside.
 *
 * Module level, so it survives between revalidations inside one server
 * process. It is deliberately NOT a file on disk: a serverless filesystem is
 * read-only at runtime, and a snapshot committed to the repo would be data
 * pretending to be source. A cold process has no memory of it — which is
 * covered by the other half of the design, since a failed revalidation
 * leaves Next serving the page it last rendered successfully.
 */
export type LastGoodStore = {
  tracks: RawTrack[]
  covers: Map<string, string>
  asOf: string
} | null

let lastGood: LastGoodStore = null

/** For tests: the module-level store, replaced. */
export function setLastGood(value: LastGoodStore): void {
  lastGood = value
}
export function getLastGood(): LastGoodStore {
  return lastGood
}

export type LoadOptions = {
  env?: Env
  hide?: readonly HideRule[]
  period?: Period
  /** Injected so a test never touches the network. */
  fetchImpl?: typeof fetch
  /** Injected so "as of" is assertable. */
  now?: () => Date
  /** Injected so the dev-only notice is assertable. */
  log?: (message: string) => void
  /** Whether the dev notice should be printed at all. */
  isDev?: boolean
}

export type PebbleResult = {
  pebbles: Pebble[]
  asOf: string
  source: PebbleSource
}

/** "2026-09-23", in UTC, so a build machine's timezone cannot shift the date. */
export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/** Fetch and parse JSON, or null if anything at all goes wrong. */
async function requestJson(address: string, fetchImpl: typeof fetch): Promise<unknown | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    // No cache option, deliberately. `cache: 'no-store'` looks like the
    // honest choice and is the wrong one: it opts the whole route into
    // rendering on every request, so the page stops being static and
    // last.fm is asked once per visitor. Left alone, the request runs when
    // the page renders — at build, and every six hours after — which is
    // the only schedule it should have.
    const response = await fetchImpl(address, { signal: controller.signal })
    if (!response.ok) return null
    const payload = await response.json()
    // last.fm answers errors with HTTP 200 and an "error" field in the body.
    if (payload && typeof payload === 'object' && 'error' in payload) return null
    return payload
  } catch {
    // A timeout, a DNS failure, a body that is not JSON. All the same here.
    return null
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Album covers for the chosen tracks, looked up in parallel.
 *
 * Only for the five that will be shown, not the fifty that came back — five
 * small requests every six hours. Each one that fails, or finds no art, is
 * simply missing from the map, and that track opens as its title drawn in
 * characters.
 */
async function lookUpCovers(
  apiKey: string,
  tracks: readonly RawTrack[],
  fetchImpl: typeof fetch,
): Promise<Map<string, string>> {
  const found = await Promise.all(
    tracks.map(async (track) => {
      const payload = await requestJson(trackInfoUrl(apiKey, track.artist, track.title), fetchImpl)
      return [trackKey(track.artist, track.title), parseTrackInfoCover(payload)] as const
    }),
  )
  return new Map(found.filter(([, cover]) => cover !== ''))
}

/**
 * The pebbles, by whichever route works.
 *
 * Never throws and never returns nothing to render: the worst case is an
 * empty pebble list, which the page draws as a quiet pond with nothing in it.
 */
export async function loadPebbles(options: LoadOptions = {}): Promise<PebbleResult> {
  const period = options.period ?? LISTENING_PERIOD
  const now = options.now ?? (() => new Date())
  const select = { hide: options.hide, minPlaycount: MIN_PLAYCOUNT, max: MAX_PEBBLES }

  const credentials = readCredentials(options.env ?? process.env)

  if (!credentials) {
    if (options.isDev ?? process.env.NODE_ENV !== 'production') {
      const log = options.log ?? console.info
      log(
        '[listening] LASTFM_API_KEY / LASTFM_USER are not set — /listening is ' +
          'showing the committed fixture, not real listening data. ' +
          'See .env.example.',
      )
    }
    // No key means no track.getInfo either. The fixture says which of its
    // tracks "have" album art, and those get the repo's test pattern — see
    // FIXTURE_COVER_FILE. The rest stay coverless, so that path shows too.
    const covers = new Map(
      [...FIXTURE_TRACKS_WITH_ART].map(([artist, title]) => [trackKey(artist, title), FIXTURE_COVER_FILE]),
    )
    const pebbles = selectPebbles(parseTopTracks(FIXTURE_TOP_TRACKS), { ...select, covers })
    return { pebbles, asOf: isoDate(now()), source: 'fixture' }
  }

  const fetchImpl = options.fetchImpl ?? fetch
  const payload = await requestJson(topTracksUrl(credentials, period), fetchImpl)
  if (payload !== null) {
    const tracks = parseTopTracks(payload)
    // An answer with nothing in it is not an answer worth remembering — a
    // scrobbler that was off for a month should not wipe out the last good
    // month. Measured before the filters, so an answer that is entirely on
    // the hide list still counts as last.fm having replied.
    if (tracks.length > 0) {
      const asOf = isoDate(now())
      const covers = await lookUpCovers(credentials.apiKey, selectTracks(tracks, select), fetchImpl)
      lastGood = { tracks, covers, asOf }
      return { pebbles: selectPebbles(tracks, { ...select, covers }), asOf, source: 'lastfm' }
    }
  }

  if (lastGood) {
    // Deliberately the ORIGINAL date, not today's: the page says when the
    // data is from, and claiming a stale list is today's is the one lie the
    // "as of" line exists to prevent.
    return {
      pebbles: selectPebbles(lastGood.tracks, { ...select, covers: lastGood.covers }),
      asOf: lastGood.asOf,
      source: 'lastfm',
    }
  }

  return { pebbles: [], asOf: '', source: 'none' }
}
