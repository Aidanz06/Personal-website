/**
 * Laying the albums out down the pond.
 *
 * The same idiom as the photo rocks in lib/pond/photoStones.ts — rocks placed
 * in viewport heights, two to a row, drifting slightly so they do not read as
 * a grid — with two differences that come straight from what the page means.
 *
 * **A pebble's size is information.** Photo rocks are all one size because one
 * photograph is not more of a photograph than another. An album played sixty
 * times this month genuinely is more present than one played nine times, so
 * the rock is bigger.
 *
 * **A boulder is not a large pebble.** It is heavier — a denser texture, from
 * the same stone drawing — bigger, and completely still, and it sits at the
 * bottom because the page goes back in time as it goes down.
 *
 * Placement is derived entirely from the ranking, so the same data always
 * gives the same layout and a reload never reshuffles the pond. When the
 * ranking changes, the rocks move: the current moved them.
 */

import { coverlessCover } from './coverless.ts'
import type { Boulder, Pebble } from './types.ts'

/**
 * Where the first pebbles sit.
 *
 * Below the heading, the intro and the two labels — which come to roughly
 * four tenths of a screen at 375 — but high enough that the top of the first
 * row is visible without scrolling. A pond whose first rock is entirely below
 * the fold does not look like a pond, it looks like an empty page.
 */
export const PEBBLES_START_VH = 0.8
/** Depth between consecutive ROWS of pebbles. */
export const PEBBLE_STEP_VH = 0.52
/** How much lower the right-hand pebble of a pair sits than the left. */
export const PEBBLE_PAIR_OFFSET_VH = 0.13
/** Pebbles per row. */
export const PEBBLES_PER_ROW = 2
/**
 * Water between the last pebble and the first boulder.
 *
 * Wider than a pebble step, because this gap is the descent: it is where the
 * page stops being about this month and starts being about everything else.
 */
export const BOULDER_GAP_VH = 0.85
/** Depth between boulders. One per row — a boulder gets the width to itself. */
export const BOULDER_STEP_VH = 0.62
/** How far above the first boulder its label sits. */
export const LABEL_LIFT_VH = 0.3
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
 * floor. The least played album of the month is still something you have to
 * be able to hit on a phone.
 */
export const PEBBLE_MIN_RADIUS = 30

/** A boulder is twice a pebble at every viewport, and bigger than a nav stone. */
export const BOULDER_RADIUS_FRACTION = 0.125
export const BOULDER_MIN_RADIUS = 62
/**
 * How much denser a boulder's texture is.
 *
 * Brightness, which the renderer maps through the density ramp — so a heavier
 * number is literally a denser character in every cell of the rock. It is the
 * same stone drawing the navigation stones use, leaned on harder, rather than
 * a second kind of rock with its own code.
 */
export const BOULDER_DENSITY = 1.6

/** A rock on /listening, ready for the pond and for the button over it. */
export type AlbumRock = {
  kind: 'pebble' | 'boulder'
  /** Index into the pebble or boulder list it came from. */
  dataIndex: number
  album: string
  artist: string
  /** A boulder's line from Aidan. Empty for a pebble. */
  line: string
  /** Position 1..n among the pebbles. 0 for a boulder, which has no rank. */
  rank: number

  // --- what the pond needs (a PhotoStoneSpec) ---
  src: string
  alt: string
  xFraction: number
  depthVh: number
  radiusFraction: number
  minRadius: number
  density?: number
}

export type ListeningLayout = {
  rocks: AlbumRock[]
  /** Depth of the "the ones that never leave" label. null when none. */
  neverLeaveLabelVh: number | null
  /** How deep the pond has to be. */
  depthVh: number
}

/**
 * What a rock's cover is, or the album's own name drawn as one.
 *
 * Never a broken image: a cover last.fm could not give us becomes an image of
 * the album's name, which the pond opens exactly as it would open a cover.
 */
function coverFor(cover: string, album: string, artist: string): string {
  return cover || coverlessCover(album, artist)
}

/** The comma form, for a screen reader: "·" is read out as "middle dot". */
function spoken(album: string, artist: string): string {
  return `${album}, ${artist}`
}

function pebbleX(row: number, isRight: boolean): number {
  // Drift per row, so neither column is a perfectly straight line.
  const drift = ((row * 7) % 5) / 5
  return isRight ? 0.66 + drift * 0.1 : 0.24 + drift * 0.1
}

/**
 * Lay out the whole page.
 *
 * Depth follows the rock count in both directions: a month with three albums
 * on repeat is a shorter page than a month with eight, and a pond with no
 * boulders in it ends where the pebbles do.
 */
export function listeningLayout(
  pebbles: readonly Pebble[],
  boulders: readonly Boulder[],
): ListeningLayout {
  const rocks: AlbumRock[] = []

  pebbles.forEach((pebble, index) => {
    const row = Math.floor(index / PEBBLES_PER_ROW)
    const isRight = index % PEBBLES_PER_ROW === 1
    rocks.push({
      kind: 'pebble',
      dataIndex: index,
      album: pebble.album,
      artist: pebble.artist,
      line: '',
      rank: pebble.rank,
      src: coverFor(pebble.cover, pebble.album, pebble.artist),
      alt: spoken(pebble.album, pebble.artist),
      xFraction: pebbleX(row, isRight),
      depthVh:
        PEBBLES_START_VH + row * PEBBLE_STEP_VH + (isRight ? PEBBLE_PAIR_OFFSET_VH : 0),
      // The size IS the playcount, scaled by area. See pebbleSize().
      radiusFraction: PEBBLE_RADIUS_FRACTION * pebble.size,
      minRadius: PEBBLE_MIN_RADIUS,
    })
  })

  const lastPebbleVh =
    pebbles.length > 0
      ? Math.max(...rocks.map((rock) => rock.depthVh))
      : // No pebbles: the boulders move up into the space, rather than the
        // page holding open a gap for a layer that is not there.
        PEBBLES_START_VH - BOULDER_GAP_VH

  const bouldersStartVh = lastPebbleVh + BOULDER_GAP_VH

  boulders.forEach((boulder, index) => {
    rocks.push({
      kind: 'boulder',
      dataIndex: index,
      album: boulder.album,
      artist: boulder.artist,
      line: boulder.line,
      rank: 0,
      src: coverFor(boulder.cover, boulder.album, boulder.artist),
      alt: spoken(boulder.album, boulder.artist),
      // Alternating sides, one to a row: a boulder gets the width to itself.
      xFraction: index % 2 === 0 ? 0.31 : 0.69,
      depthVh: bouldersStartVh + index * BOULDER_STEP_VH,
      radiusFraction: BOULDER_RADIUS_FRACTION,
      minRadius: BOULDER_MIN_RADIUS,
      density: BOULDER_DENSITY,
    })
  })

  const deepest = rocks.length > 0 ? Math.max(...rocks.map((rock) => rock.depthVh)) : 0

  return {
    rocks,
    neverLeaveLabelVh: boulders.length > 0 ? bouldersStartVh - LABEL_LIFT_VH : null,
    depthVh: Math.max(MIN_POND_DEPTH_VH, deepest + LISTENING_TAIL_VH),
  }
}
