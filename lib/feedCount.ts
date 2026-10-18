/**
 * The shared count of today's feedings, kept in Upstash Redis.
 *
 * **Server-only, because of the token.** Read from `process.env` with no
 * `NEXT_PUBLIC_` prefix, and lib/listening/secrets.test.ts walks the client
 * import graph to make sure the names never reach the browser. What the
 * browser needs (the copy, the throttle) is in lib/feedClient.ts.
 *
 * Talks to Upstash's REST API with plain `fetch`, so there is no client
 * library to install. `fetch` and the environment come in as arguments,
 * which keeps this testable without a network.
 *
 * Every failure is quiet: no store configured, or the store not answering,
 * comes back as `null`, the page drops the number, and feeding still works.
 */

export type FeedStore = { url: string; token: string }

type Fetch = typeof fetch
type Env = Record<string, string | undefined>

/** "Today" ends at midnight where Aidan is, not at midnight UTC. */
export const FEED_TIME_ZONE = 'America/New_York'
/** Taps one visitor can add in a minute; past this they still feed, uncounted. */
export const FEEDS_PER_MINUTE = 20
/** A day's count outlives the day by one, so a late reader still finds it. */
const DAY_TTL_S = 2 * 24 * 60 * 60

/**
 * The store's address and token, under the names the Vercel Marketplace
 * integration injects (or Upstash's own), or `null` if there is none.
 */
export function feedStore(env: Env): FeedStore | null {
  const url = env.KV_REST_API_URL ?? env.UPSTASH_REDIS_REST_URL
  const token = env.KV_REST_API_TOKEN ?? env.UPSTASH_REDIS_REST_TOKEN
  return url && token ? { url: url.replace(/\/$/, ''), token } : null
}

/** The key for a day's count: `feed:YYYY-MM-DD`, in New York. */
export function feedDayKey(date: Date): string {
  // en-CA formats a date as YYYY-MM-DD.
  const day = new Intl.DateTimeFormat('en-CA', {
    timeZone: FEED_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
  return `feed:${day}`
}

/** The key that rate-limits one visitor for one minute. */
export function feedVisitorKey(visitor: string, date: Date): string {
  return `feed:visitor:${visitor}:${Math.floor(date.getTime() / 60_000)}`
}

/** Runs Redis commands in one round trip. Throws if the store doesn't answer. */
async function pipeline(store: FeedStore, fetchImpl: Fetch, commands: (string | number)[][]) {
  const response = await fetchImpl(`${store.url}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${store.token}` },
    body: JSON.stringify(commands),
    cache: 'no-store',
  })
  if (!response.ok) throw new Error(`feed store answered ${response.status}`)
  const results = (await response.json()) as { result?: unknown; error?: string }[]
  return results.map((entry) => {
    if (entry.error) throw new Error(entry.error)
    return entry.result
  })
}

function asCount(value: unknown): number {
  const n = Number(value ?? 0)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
}

/** Today's count, or `null` if it can't be had. */
export async function readFeedCount(
  store: FeedStore | null,
  fetchImpl: Fetch,
  now: Date,
): Promise<number | null> {
  if (!store) return null
  try {
    const [count] = await pipeline(store, fetchImpl, [['GET', feedDayKey(now)]])
    return asCount(count)
  } catch {
    return null
  }
}

/**
 * Counts one feeding and returns today's total, or `null` if it can't.
 *
 * A visitor past FEEDS_PER_MINUTE gets the total back without adding to it,
 * so mashing the water feeds the fish but doesn't inflate the number.
 */
export async function recordFeeding(
  store: FeedStore | null,
  fetchImpl: Fetch,
  visitor: string,
  now: Date,
): Promise<number | null> {
  if (!store) return null
  try {
    const visitorKey = feedVisitorKey(visitor, now)
    const [taps] = await pipeline(store, fetchImpl, [
      ['INCR', visitorKey],
      ['EXPIRE', visitorKey, 60],
    ])
    if (asCount(taps) > FEEDS_PER_MINUTE) return readFeedCount(store, fetchImpl, now)
    const dayKey = feedDayKey(now)
    const [count] = await pipeline(store, fetchImpl, [
      ['INCR', dayKey],
      ['EXPIRE', dayKey, DAY_TTL_S],
    ])
    return asCount(count)
  } catch {
    return null
  }
}

/**
 * Who is tapping, as a hash of their address: enough to rate-limit them,
 * never stored as the address itself.
 */
export async function visitorId(headers: Headers): Promise<string> {
  const address =
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() || headers.get('x-real-ip') || 'unknown'
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(address))
  return Array.from(new Uint8Array(digest).slice(0, 12), (b) => b.toString(16).padStart(2, '0')).join('')
}
