/**
 * The browser's side of the shared feeding count: sending feedings to
 * /api/feed, and telling whoever shows the number when it changes.
 *
 * The bucket feeds and the line under the name shows the number, two
 * components apart, so this is a module they both talk to.
 *
 * Nothing secret in here; the store's token stays in lib/feedCount.ts.
 */

/** At most one count sent per this long; taps in between share the next one. */
export const FEED_REPORT_INTERVAL_MS = 3000

/** `null` until known; `'unavailable'` when there is no shared count to show. */
export type FeedCountState = number | null | 'unavailable'

let state: FeedCountState = null
const listeners = new Set<(state: FeedCountState) => void>()
let lastSentAt = -Infinity
let pending: ReturnType<typeof setTimeout> | null = null

function publish(next: FeedCountState): void {
  state = next
  for (const listener of listeners) listener(next)
}

async function call(method: 'GET' | 'POST'): Promise<void> {
  try {
    const response = await fetch('/api/feed', { method })
    const body = (await response.json()) as { count: number | null }
    publish(response.ok && typeof body.count === 'number' ? body.count : 'unavailable')
  } catch {
    publish('unavailable')
  }
}

/** Fetch today's count once, for whoever is about to show it. */
export function loadFeedCount(): void {
  if (state === null) void call('GET')
}

/** Show the count, now and whenever it changes. Returns the unsubscribe. */
export function subscribeFeedCount(listener: (state: FeedCountState) => void): () => void {
  listeners.add(listener)
  listener(state)
  return () => listeners.delete(listener)
}

/**
 * Count a feeding. Throttled: the first is sent at once, and any more
 * inside FEED_REPORT_INTERVAL_MS are folded into one sent when it is up.
 */
export function reportFeeding(now = performance.now()): void {
  if (pending) return
  const wait = lastSentAt + FEED_REPORT_INTERVAL_MS - now
  const send = () => {
    pending = null
    lastSentAt = performance.now()
    void call('POST')
  }
  if (wait <= 0) send()
  else pending = setTimeout(send, wait)
}

/** The line under the name. */
export function feedCountCopy(count: number): string {
  if (count <= 0) return "the koi haven't been fed today"
  return `the koi have been fed ${count} ${count === 1 ? 'time' : 'times'} today`
}
