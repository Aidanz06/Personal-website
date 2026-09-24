/**
 * What /listening is made of.
 *
 * Two kinds of rock, and they are genuinely different things rather than one
 * thing at two sizes:
 *
 * - a **pebble** is a track: a fact about the last month, pulled from
 *   last.fm, with a playcount and a rank and no opinion attached;
 * - a **boulder** is a choice Aidan made, written down in a file, with a line
 *   from him and no playcount at all.
 *
 * Pure types. Nothing here imports anything.
 */

import type { Period } from './constants.ts'

/** One track as last.fm reports it, once the noise is stripped out. */
export type RawTrack = {
  title: string
  artist: string
  playcount: number
}

/** A track near the surface: small, few, and moved by the current. */
export type Pebble = {
  /** The track's name. */
  title: string
  artist: string
  playcount: number
  /** 1 for the most played. Placement is derived from this. */
  rank: number
  /**
   * How big this pebble is, 0..1, relative to the most played track.
   *
   * A fraction rather than a radius: the page decides what a fraction is
   * worth in pixels, and it is not the same on a phone as on a laptop.
   */
  size: number
  /**
   * Cover URL through the image optimiser, or '' for a coverless track.
   *
   * A track's cover is its ALBUM's cover. last.fm returns a grey placeholder
   * for every track image, so the art comes from track.getInfo, which names
   * the album and carries its artwork — when last.fm has any.
   */
  cover: string
}

/** An album at the bottom: big, heavy, and there because Aidan says so. */
export type Boulder = {
  album: string
  artist: string
  /** Aidan's line. Never blank on the page — the placeholder stands in. */
  line: string
  /** True while that line is still the placeholder. */
  lineMissing: boolean
  /** Cover URL through the image optimiser, or '' for a coverless album. */
  cover: string
}

/**
 * One entry in the hide list. A blank track hides the whole artist.
 *
 * A track, not an album: the top-tracks response does not say which album a
 * track is on, so a rule naming an album could not be matched until after
 * the five had already been chosen.
 */
export type HideRule = {
  artist: string
  track?: string
}

/** content/listening.json, as written. Every field is allowed to be blank. */
export type ListeningFile = {
  neverLeave?: {
    album?: string
    artist?: string
    line?: string
    cover?: string
  }[]
  hide?: HideRule[]
}

/** Where the pebbles came from. The page says so when they are not real. */
export type PebbleSource =
  /** Real data from last.fm. */
  | 'lastfm'
  /** The committed fixture, because no API key is configured. */
  | 'fixture'
  /** Nothing: the API failed and there has never been a good response. */
  | 'none'

/** Everything /listening needs, resolved at build time. */
export type ListeningData = {
  pebbles: Pebble[]
  boulders: Boulder[]
  period: Period
  /**
   * "2026-09-23" — when the pebble data was fetched. Blank when there is no
   * pebble data at all.
   */
  asOf: string
  source: PebbleSource
}
