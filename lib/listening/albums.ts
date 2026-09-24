/**
 * Turning last.fm's answer into pebbles.
 *
 * Pure: no filesystem, no network, no environment. This module is imported by
 * the page that runs in the browser, so anything server-only here would drag
 * the API key toward the client bundle — which is the one thing this feature
 * must never do. A test walks the client import graph and asserts it.
 *
 * Everything last.fm sends is a string, including the numbers, and plenty of
 * it is missing or a placeholder. Every function here assumes the worst about
 * its input and returns something renderable.
 */

import {
  COVER_QUALITY,
  COVER_WIDTH,
  MAX_PEBBLES,
  MIN_PLAYCOUNT,
} from './constants.ts'
import type { HideRule, Pebble, RawAlbum } from './types.ts'

/**
 * last.fm's own "no cover art" images.
 *
 * It does not return an empty string when an album has no art — it returns a
 * grey star placeholder, which is a real image that loads fine and tells the
 * reader nothing. Detecting it is the difference between "this album has no
 * cover" and "this album's cover is a picture of a missing cover".
 */
const PLACEHOLDER_COVER_HASHES = [
  '2a96cbd8b46e442fc41c2b86b821562f',
  'c6f59c1e5e7240a4c0d427abd71f3dbb',
]

/** The sizes last.fm offers, worst to best. We take the best that is real. */
const COVER_SIZE_ORDER = ['mega', 'extralarge', 'large', 'medium', 'small', '']

/** Trim, and treat anything that is not a string as blank. */
function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

/** last.fm sends every number as a string, and sometimes not at all. */
function count(value: unknown): number {
  const n = Number(text(value))
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
}

/**
 * Is this cover URL actually a cover?
 *
 * Blank, non-http, or one of last.fm's placeholder stars. A `true` here means
 * the album opens as its name drawn in characters instead — which is a
 * deliberate design, where a broken image icon is a bug.
 */
export function isPlaceholderCover(url: string | undefined): boolean {
  const value = text(url)
  if (!value) return true
  // A root-relative path is a cover we downloaded ourselves; anything else
  // that is not http is not an address at all.
  if (!/^https?:\/\//i.test(value) && !value.startsWith('/')) return true
  const lower = value.toLowerCase()
  return PLACEHOLDER_COVER_HASHES.some((hash) => lower.includes(hash))
}

/**
 * Pick the largest usable image from last.fm's size array.
 *
 * Returns '' when every size is missing or a placeholder — which happens, and
 * happens more often than you would expect for anything not on a major label.
 */
export function pickCover(images: unknown): string {
  if (!Array.isArray(images)) return ''
  const bySize = new Map<string, string>()
  for (const entry of images) {
    if (!entry || typeof entry !== 'object') continue
    const record = entry as Record<string, unknown>
    const size = text(record.size).toLowerCase()
    const url = text(record['#text'])
    if (!url || isPlaceholderCover(url)) continue
    if (!bySize.has(size)) bySize.set(size, url)
  }
  for (const size of COVER_SIZE_ORDER) {
    const found = bySize.get(size)
    if (found) return found
  }
  // A size last.fm invented after this was written is still better than none.
  return bySize.values().next().value ?? ''
}

/**
 * Read a user.getTopAlbums response.
 *
 * Anything unrecognisable comes back as an empty list rather than throwing:
 * last.fm answering strangely should cost the pebble layer, not the page.
 */
export function parseTopAlbums(payload: unknown): RawAlbum[] {
  if (!payload || typeof payload !== 'object') return []
  const top = (payload as Record<string, unknown>).topalbums
  if (!top || typeof top !== 'object') return []
  const list = (top as Record<string, unknown>).album
  // One album comes back as an object rather than an array of one.
  const entries = Array.isArray(list) ? list : list ? [list] : []

  const albums: RawAlbum[] = []
  for (const entry of entries) {
    if (!entry || typeof entry !== 'object') continue
    const record = entry as Record<string, unknown>
    const artistField = record.artist
    const artist =
      artistField && typeof artistField === 'object'
        ? text((artistField as Record<string, unknown>).name)
        : text(artistField)
    const album = text(record.name)
    if (!album || !artist) continue
    albums.push({
      album,
      artist,
      playcount: count(record.playcount),
      coverUrl: pickCover(record.image),
    })
  }
  return albums
}

/** Fold case and whitespace, so "Björk " and "björk" are the same artist. */
function key(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

/**
 * Should this album be kept out of the pond?
 *
 * A rule with an album hides that one record; a rule with only an artist
 * hides everything by them. A rule with a blank artist hides **nothing** —
 * the scaffolded file ships with an empty slot in it so the shape is visible,
 * and an empty slot that hid the entire pond would be a memorable bug.
 */
export function isHidden(
  album: string,
  artist: string,
  hide: readonly HideRule[] | undefined,
): boolean {
  if (!hide || hide.length === 0) return false
  const albumKey = key(album)
  const artistKey = key(artist)
  return hide.some((rule) => {
    const ruleArtist = key(rule.artist ?? '')
    const ruleAlbum = key(rule.album ?? '')
    if (!ruleArtist && !ruleAlbum) return false
    // An album on its own is allowed: "hide this record, whoever made it".
    if (!ruleArtist) return ruleAlbum === albumKey
    if (ruleArtist !== artistKey) return false
    return ruleAlbum === '' || ruleAlbum === albumKey
  })
}

/** Smallest a pebble may be, as a fraction of the largest. */
export const MIN_PEBBLE_SIZE = 0.52

/**
 * How big a pebble is, relative to the most played album.
 *
 * The square root, not the ratio. A rock's presence on the page is its AREA,
 * and area goes as the square of the radius — so scaling the radius linearly
 * with playcount makes an album played twice as often look four times as
 * important. The floor is what stops the eighth album becoming a speck: it
 * still has to be a comfortable tap target on a phone.
 */
export function pebbleSize(playcount: number, topPlaycount: number): number {
  if (!Number.isFinite(playcount) || playcount <= 0) return MIN_PEBBLE_SIZE
  if (!Number.isFinite(topPlaycount) || topPlaycount <= 0) return 1
  const ratio = Math.min(1, playcount / topPlaycount)
  return Math.max(MIN_PEBBLE_SIZE, Math.sqrt(ratio))
}

/**
 * Optimise a cover URL, whether it is last.fm's or one we downloaded.
 *
 * Going through Next's optimiser is not only about bytes here. The pond reads
 * the pixels of every image it draws, and a cross-origin image taints the
 * canvas and makes `getImageData` throw — which would cost the ASCII stage,
 * the duotone and the whole opening effect. Routed through `/_next/image` the
 * cover is same-origin, so the canvas stays clean.
 */
export function optimisedCover(url: string): string {
  if (!url) return ''
  return `/_next/image?url=${encodeURIComponent(url)}&w=${COVER_WIDTH}&q=${COVER_QUALITY}`
}

export type SelectOptions = {
  hide?: readonly HideRule[]
  minPlaycount?: number
  max?: number
}

/**
 * The albums, filtered and ranked, ready to be laid out as rocks.
 *
 * Order is last.fm's order, which is by playcount — we do not re-sort, so a
 * tie breaks the way last.fm broke it rather than the way `Array.sort`
 * happens to.
 */
export function selectPebbles(
  albums: readonly RawAlbum[],
  options: SelectOptions = {},
): Pebble[] {
  const minPlaycount = options.minPlaycount ?? MIN_PLAYCOUNT
  const max = options.max ?? MAX_PEBBLES

  const kept = albums
    .filter((entry) => entry.playcount >= minPlaycount)
    .filter((entry) => !isHidden(entry.album, entry.artist, options.hide))
    .slice(0, max)

  const top = kept[0]?.playcount ?? 0

  return kept.map((entry, index) => ({
    album: entry.album,
    artist: entry.artist,
    playcount: entry.playcount,
    rank: index + 1,
    size: pebbleSize(entry.playcount, top),
    cover: isPlaceholderCover(entry.coverUrl) ? '' : optimisedCover(entry.coverUrl),
  }))
}
