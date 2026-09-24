/**
 * The ones that never leave, read out of content/listening.json.
 *
 * Pure — the reading is lib/listening/file.ts. Same split as captions.ts and
 * captionsFile.ts, and for the same reason: a `node:fs` import anywhere in a
 * client component's graph fails the build with an error that names the
 * bundler rather than the import.
 *
 * A boulder is Aidan's choice, so the file is the only authority. Nothing
 * here asks last.fm anything, and the page renders the boulders whether or
 * not there is a network.
 */

import { BOULDER_LINE_PLACEHOLDER, COVERS_URL } from './constants.ts'
import { optimisedCover } from './pebbles.ts'
import type { Boulder, ListeningFile } from './types.ts'

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

/**
 * Turn a cover field into a URL the page can use.
 *
 * `npm run listening:covers` writes a bare filename, because a filename is
 * what someone editing the file by hand would expect to see. A value that
 * already looks like a path or a URL is taken as-is, so a cover dropped in by
 * hand from anywhere still works.
 */
export function boulderCoverUrl(cover: string): string {
  const value = text(cover)
  if (!value) return ''
  if (/^https?:\/\//i.test(value)) return optimisedCover(value)
  const path = value.startsWith('/') ? value : `${COVERS_URL}/${value}`
  return optimisedCover(path)
}

/**
 * The boulders, in the order they are written down.
 *
 * **An empty slot is not a boulder.** The file ships with three blank ones so
 * the shape is obvious, and a blank slot renders nothing at all rather than a
 * rock with no name on it. A blank *line*, on the other hand, does render —
 * as the bracketed placeholder, because a boulder with nothing said about it
 * is an unfinished page and unfinished should be visible.
 */
export function resolveBoulders(file: ListeningFile | undefined): Boulder[] {
  const entries = file?.neverLeave ?? []
  const boulders: Boulder[] = []
  for (const entry of entries) {
    const album = text(entry?.album)
    const artist = text(entry?.artist)
    // Both, or it is a slot rather than a record.
    if (!album || !artist) continue
    const line = text(entry?.line)
    boulders.push({
      album,
      artist,
      line: line || BOULDER_LINE_PLACEHOLDER,
      lineMissing: line === '',
      cover: boulderCoverUrl(text(entry?.cover)),
    })
  }
  return boulders
}

/** The hide list, with the empty scaffold slots dropped. */
export function resolveHideList(file: ListeningFile | undefined) {
  return (file?.hide ?? []).filter(
    (rule) => text(rule?.artist) !== '' || text(rule?.track) !== '',
  )
}
