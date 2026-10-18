import { describe, expect, it } from 'vitest'
import { feedCountCopy } from './feedClient'
import {
  FEEDS_PER_MINUTE,
  feedDayKey,
  feedStore,
  readFeedCount,
  recordFeeding,
  visitorId,
} from './feedCount'

/** An in-memory stand-in for Upstash's REST pipeline. */
function fakeStore() {
  const data = new Map<string, number>()
  const calls: (string | number)[][][] = []
  const fetchImpl = (async (_url: string, init: RequestInit) => {
    const commands = JSON.parse(String(init.body)) as (string | number)[][]
    calls.push(commands)
    const results = commands.map(([op, key]) => {
      const k = String(key)
      if (op === 'INCR') {
        data.set(k, (data.get(k) ?? 0) + 1)
        return { result: data.get(k) }
      }
      if (op === 'GET') return { result: data.has(k) ? String(data.get(k)) : null }
      return { result: 1 }
    })
    return new Response(JSON.stringify(results))
  }) as typeof fetch
  return { data, calls, fetchImpl }
}

const STORE = { url: 'https://example.upstash.io', token: 't' }
const NOON = new Date('2026-10-17T16:00:00Z')

describe('which day it is', () => {
  it('rolls over at midnight in New York, not in UTC', () => {
    // 03:30 UTC on the 18th is still the evening of the 17th in New York.
    expect(feedDayKey(new Date('2026-10-18T03:30:00Z'))).toBe('feed:2026-10-17')
    expect(feedDayKey(new Date('2026-10-18T04:30:00Z'))).toBe('feed:2026-10-18')
  })
})

describe('the store', () => {
  it('reads the names the Vercel integration sets, or Upstash’s own', () => {
    expect(feedStore({ KV_REST_API_URL: 'https://a/', KV_REST_API_TOKEN: 'x' })).toEqual({ url: 'https://a', token: 'x' })
    expect(feedStore({ UPSTASH_REDIS_REST_URL: 'https://b', UPSTASH_REDIS_REST_TOKEN: 'y' })).toEqual({ url: 'https://b', token: 'y' })
  })

  it('is absent without both a url and a token, and then there is no count', async () => {
    expect(feedStore({ KV_REST_API_URL: 'https://a' })).toBeNull()
    const { fetchImpl, calls } = fakeStore()
    expect(await readFeedCount(null, fetchImpl, NOON)).toBeNull()
    expect(await recordFeeding(null, fetchImpl, 'v', NOON)).toBeNull()
    expect(calls).toHaveLength(0)
  })

  it('answers null, not an error, when the store is down', async () => {
    const down = (async () => new Response('nope', { status: 500 })) as unknown as typeof fetch
    expect(await readFeedCount(STORE, down, NOON)).toBeNull()
    expect(await recordFeeding(STORE, down, 'v', NOON)).toBeNull()
  })
})

describe('counting', () => {
  it('counts each feeding and reads back the day’s total', async () => {
    const { fetchImpl } = fakeStore()
    expect(await readFeedCount(STORE, fetchImpl, NOON)).toBe(0)
    expect(await recordFeeding(STORE, fetchImpl, 'a', NOON)).toBe(1)
    expect(await recordFeeding(STORE, fetchImpl, 'b', NOON)).toBe(2)
    expect(await readFeedCount(STORE, fetchImpl, NOON)).toBe(2)
  })

  it('stops counting one visitor past the per-minute cap, without failing', async () => {
    const { fetchImpl } = fakeStore()
    let last: number | null = null
    for (let i = 0; i < FEEDS_PER_MINUTE + 5; i++) last = await recordFeeding(STORE, fetchImpl, 'masher', NOON)
    expect(last).toBe(FEEDS_PER_MINUTE)
    // Someone else still counts.
    expect(await recordFeeding(STORE, fetchImpl, 'other', NOON)).toBe(FEEDS_PER_MINUTE + 1)
  })

  it('lets each day’s count expire after it is over', async () => {
    const { fetchImpl, calls } = fakeStore()
    await recordFeeding(STORE, fetchImpl, 'a', NOON)
    const expires = calls.flat().filter(([op]) => op === 'EXPIRE')
    expect(expires.map(([, key]) => key)).toContain('feed:2026-10-17')
  })

  it('keeps a hash of the visitor’s address, never the address', async () => {
    const id = await visitorId(new Headers({ 'x-forwarded-for': '203.0.113.7, 10.0.0.1' }))
    expect(id).toMatch(/^[0-9a-f]{24}$/)
    expect(id).not.toContain('203')
    expect(await visitorId(new Headers({ 'x-forwarded-for': '203.0.113.7' }))).toBe(id)
  })
})

describe('the line under the name', () => {
  it('says how many times, in words that read right at 0 and 1', () => {
    expect(feedCountCopy(0)).toBe("the koi haven't been fed today")
    expect(feedCountCopy(1)).toBe('the koi have been fed 1 time today')
    expect(feedCountCopy(37)).toBe('the koi have been fed 37 times today')
  })
})
