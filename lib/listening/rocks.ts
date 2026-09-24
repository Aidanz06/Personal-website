/**
 * Laying the top five tracks out in the pond.
 *
 * The same idiom as the photo rocks in lib/pond/photoStones.ts — rocks placed
 * in viewport heights — with one difference that comes straight from what
 * the page means.
 *
 * **A pebble's size is information.** Photo rocks are all one size because one
 * photograph is not more of a photograph than another. A track played twelve
 * times this month genuinely is more present than one played twice, so the
 * rock is bigger.
 *
 * Placement is derived entirely from the ranking, so the same data always
 * gives the same layout and a reload never reshuffles the pond. When the
 * ranking changes, the rocks move: the current moved them.
 */

import { coverlessCover } from './coverless.ts'
import type { Pebble } from './types.ts'

/**
 * Where the first pebbles sit.
 *
 * Below the heading, the intro and the two labels — which come to roughly
 * four tenths of a screen at 375 — but high enough that the top of the first
 * row is visible without scrolling. A pond whose first rock is entirely below
 * the fold does not look like a pond, it looks like an empty page.
 */
export const PEBBLES_START_VH = 0.8
/**
 * Where each pebble sits, by rank, relative to PEBBLES_START_VH.
 *
 * A cluster, not columns. The top five are one thing — this month — and
 * two columns a screen deep read as a list you scroll past; five stones
 * close together read as a group you take in at once. Placed by hand rather
 * than by formula because five is few enough to arrange: the most played
 * sits top left, and the rest fall away down and to the right, with no
 * two at the same height so it never reads as a grid.
 *
 * `dy` is in viewport heights, `x` a fraction of the width. Rank 6 and
 * beyond (if MAX_PEBBLES ever grows past the slots) continue in pairs below.
 */
export const PEBBLE_SLOTS: readonly { x: number; dy: number }[] = [
  { x: 0.34, dy: 0 },
  { x: 0.64, dy: 0.1 },
  { x: 0.26, dy: 0.3 },
  { x: 0.54, dy: 0.4 },
  { x: 0.78, dy: 0.3 },
]
/** Depth between consecutive rows, for pebbles past the cluster's slots. */
export const PEBBLE_STEP_VH = 0.3
/** Empty water below the last rock, so the pond does not end abruptly. */
export const LISTENING_TAIL_VH = 0.6
/** Shortest the pond may be, so a page with almost nothing on it still reads. */
export const MIN_POND_DEPTH_VH = 1.5

/** Radius of the most played pebble, as a fraction of the smaller dimension. */
export const PEBBLE_RADIUS_FRACTION = 0.062
/**
 * Smallest a pebble may be drawn, in pixels.
 *
 * A radius, so the tap target is 60px across — comfortably over the 44px
 * floor. The least played track of the month is still something you have to
 * be able to hit on a phone.
 */
export const PEBBLE_MIN_RADIUS = 30

/** A rock on /listening, ready for the pond and for the button over it. */
export type TrackRock = {
  /** Index into the pebble list it came from. */
  dataIndex: number
  title: string
  artist: string
  /** Position 1..5 in the month. */
  rank: number

  // --- what the pond needs (a PhotoStoneSpec) ---
  src: string
  alt: string
  xFraction: number
  depthVh: number
  radiusFraction: number
  minRadius: number
}

export type ListeningLayout = {
  rocks: TrackRock[]
  /** How deep the pond has to be. */
  depthVh: number
}

/**
 * What a rock's cover is, or the track's own name drawn as one.
 *
 * Never a broken image: a cover last.fm could not give us becomes an image of
 * the track's name, which the pond opens exactly as it would open a cover.
 */
function coverFor(cover: string, title: string, artist: string): string {
  return cover || coverlessCover(title, artist)
}

/** The comma form, for a screen reader: "·" is read out as "middle dot". */
function spoken(title: string, artist: string): string {
  return `${title}, ${artist}`
}

/** Where the pebble of a given rank goes: its slot, or a pair row below. */
function pebbleSpot(index: number): { x: number; dy: number } {
  const slot = PEBBLE_SLOTS[index]
  if (slot) return slot
  const extra = index - PEBBLE_SLOTS.length
  const deepest = Math.max(...PEBBLE_SLOTS.map((s) => s.dy))
  const row = Math.floor(extra / 2)
  return { x: extra % 2 === 0 ? 0.3 : 0.66, dy: deepest + PEBBLE_STEP_VH * (row + 1) }
}

/**
 * Lay out the page.
 *
 * Depth follows the rock count: a month with three tracks on repeat is a
 * shorter page than a month with five, and there is a floor so a month with
 * none is still a pond rather than a blank strip.
 */
export function listeningLayout(pebbles: readonly Pebble[]): ListeningLayout {
  const rocks: TrackRock[] = pebbles.map((pebble, index) => {
    const spot = pebbleSpot(index)
    return {
      dataIndex: index,
      title: pebble.title,
      artist: pebble.artist,
      rank: pebble.rank,
      src: coverFor(pebble.cover, pebble.title, pebble.artist),
      alt: spoken(pebble.title, pebble.artist),
      xFraction: spot.x,
      depthVh: PEBBLES_START_VH + spot.dy,
      // The size IS the playcount, scaled by area. See pebbleSize().
      radiusFraction: PEBBLE_RADIUS_FRACTION * pebble.size,
      minRadius: PEBBLE_MIN_RADIUS,
    }
  })

  const deepest = rocks.length > 0 ? Math.max(...rocks.map((rock) => rock.depthVh)) : 0
  return { rocks, depthVh: Math.max(MIN_POND_DEPTH_VH, deepest + LISTENING_TAIL_VH) }
}
