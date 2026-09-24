/**
 * The merge behind `npm run listening:covers`.
 *
 * Kept separate from the script so it can be tested without a filesystem or a
 * network, because the one thing this must never do — overwrite something
 * that is already there — is exactly the kind of thing that is easy to get
 * wrong on the second run and painful to notice. The clips in step 7 were
 * destroyed by a script that wrote over its own input, and this is the same
 * class of mistake.
 *
 * The contract, in full:
 *
 * - a `cover` value that is already filled in is never touched;
 * - a file that already exists on disk is never downloaded over;
 * - the script writes only into public/listening/covers, never into content/;
 * - so a second run does nothing at all, and a test asserts exactly that.
 *
 * Every relative import under lib/listening carries its `.ts` extension,
 * including in the modules the page uses. Node runs this script directly and
 * its ESM resolver does not guess extensions, and one rule that always holds
 * is easier to keep than a rule about which files the script happens to
 * reach today. `allowImportingTsExtensions` in tsconfig is what lets the
 * compiler agree; the bundler resolves either spelling to the same module.
 */

import { LASTFM_ENDPOINT } from './constants.ts'
import type { ListeningFile } from './types.ts'

/** An album whose cover still has to be found. */
export type CoverJob = {
  /** Index into `neverLeave`, which is what applyCovers fills in. */
  index: number
  album: string
  artist: string
}

export type CoverPlan = {
  jobs: CoverJob[]
  /** Boulders that already have a cover. Nothing to do for these. */
  alreadySet: string[]
  /** Slots with no album or no artist — not yet filled in by Aidan. */
  emptySlots: number
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

/** album.getInfo, which is where a specific album's cover comes from. */
export function albumInfoUrl(apiKey: string, artist: string, album: string): string {
  const params = new URLSearchParams({
    method: 'album.getinfo',
    artist,
    album,
    api_key: apiKey,
    format: 'json',
  })
  return `${LASTFM_ENDPOINT}?${params.toString()}`
}

/**
 * The cover out of an album.getInfo response.
 *
 * Deliberately does NOT reject last.fm's placeholder star here — that
 * decision belongs to isPlaceholderCover in albums.ts, and the script checks
 * it before writing anything. Returning '' for "no image at all" is all this
 * needs to do.
 */
export function parseAlbumInfo(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return ''
  const album = (payload as Record<string, unknown>).album
  if (!album || typeof album !== 'object') return ''
  const images = (album as Record<string, unknown>).image
  if (!Array.isArray(images)) return ''
  // Largest last, which is last.fm's own order.
  for (let i = images.length - 1; i >= 0; i--) {
    const entry = images[i]
    if (!entry || typeof entry !== 'object') continue
    const url = text((entry as Record<string, unknown>)['#text'])
    if (url) return url
  }
  return ''
}

/** ".jpg" unless the URL clearly says otherwise. */
export function extensionFromUrl(url: string): string {
  const match = /\.(jpe?g|png|webp|gif|avif)(?:[?#]|$)/i.exec(url)
  if (!match) return '.jpg'
  const extension = match[1]!.toLowerCase()
  return extension === 'jpeg' ? '.jpg' : `.${extension}`
}

/**
 * A stable, readable filename for one album's cover.
 *
 * Derived from the artist and album rather than from last.fm's image hash,
 * because a file called `kid-a-radiohead.jpg` in a folder is obvious and
 * `2a96cbd8.jpg` is not — and the point of downloading these is that they
 * stop depending on last.fm at all.
 */
export function coverFileName(artist: string, album: string, extension = '.jpg'): string {
  const slug = (value: string) =>
    value
      .toLowerCase()
      .normalize('NFD')
      // Strip combining accents, so "Björk" and "Bjork" land on one name.
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48)
  const name = [slug(artist), slug(album)].filter(Boolean).join('-')
  return `${name || 'cover'}${extension}`
}

/** What needs doing, given the file as it stands. */
export function planCovers(file: ListeningFile): CoverPlan {
  const jobs: CoverJob[] = []
  const alreadySet: string[] = []
  let emptySlots = 0

  const entries = file.neverLeave ?? []
  entries.forEach((entry, index) => {
    const album = text(entry?.album)
    const artist = text(entry?.artist)
    if (!album || !artist) {
      emptySlots++
      return
    }
    if (text(entry?.cover)) {
      alreadySet.push(`${album} · ${artist}`)
      return
    }
    jobs.push({ index, album, artist })
  })

  return { jobs, alreadySet, emptySlots }
}

/**
 * Fill in the cover fields that are blank, and only those.
 *
 * Returns a new file; the input is never mutated. A fill aimed at a slot that
 * has since been filled in by hand is dropped on the floor rather than
 * applied, which is what makes running this twice a no-op.
 */
export function applyCovers(
  file: ListeningFile,
  fills: ReadonlyMap<number, string>,
): ListeningFile {
  const entries = (file.neverLeave ?? []).map((entry, index) => {
    const existing = text(entry?.cover)
    const fill = text(fills.get(index))
    return {
      album: entry?.album ?? '',
      artist: entry?.artist ?? '',
      line: entry?.line ?? '',
      // Aidan's value wins, always. This is the whole contract of the script.
      cover: existing || fill,
    }
  })
  return { neverLeave: entries, hide: file.hide ?? [] }
}
