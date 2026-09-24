/**
 * Photo rocks: one small stone per photograph, scattered down the depths.
 *
 * Separate from the navigation stones in stones.ts, and deliberately so. A
 * navigation stone takes you somewhere; a photo rock opens a picture in
 * place, and never navigates. They are different things and they look
 * different — photo rocks are smaller and sit below every nav stone.
 */

import { DEEPEST_STONE_VH, STONE_STEP_VH } from './stones'

export type PhotoStoneSpec = {
  /** The still the ASCII stage is built from. A clip's poster frame. */
  src: string
  /** For a clip, the file to loop once the rock opens. */
  video?: string
  /** Real alt text for the button that sits over the rock. */
  alt: string
  xFraction: number
  depthVh: number
  radiusFraction: number
  minRadius: number
  /**
   * The group this rock belongs to — its year, on the homepage. A new group
   * starts a new row, after a little extra water, under a marker.
   */
  group?: string
}

/**
 * Where the photo rocks begin, in viewport heights.
 *
 * One stone-step below the deepest navigation stone, rather than a number
 * typed in here. Adding or removing a navigation stone moves the whole
 * photography section with it, which is the only way the two can never
 * collide.
 */
export const PHOTOS_START_VH = DEEPEST_STONE_VH + STONE_STEP_VH
/**
 * Vertical gap between consecutive ROWS of photo rocks.
 *
 * Was 0.58, tightened by a third. Twenty-five pieces of media at the old
 * spacing is a very long descent, and the gallery reads better as a drift of
 * rocks close enough to take in together than as one rock per screen.
 */
export const PHOTO_STEP_VH = 0.383
/**
 * How much lower the second rock of a pair sits than the first.
 *
 * Two rocks at identical depth read as a grid, which is the gallery page this
 * replaced. A small offset keeps them scattered.
 */
export const PHOTO_PAIR_OFFSET_VH = 0.106
/** Empty water below the last rock, so the pond does not end abruptly. */
export const PHOTOS_TAIL_VH = 0.6
/** Rocks per row. */
export const PHOTOS_PER_ROW = 2
/**
 * Extra water before each new group, on top of the row step.
 *
 * Enough for the group's marker to sit clear of the previous row's labels
 * and above its own first rock; measured at 375x667, the tightest case.
 */
export const GROUP_GAP_VH = 0.12
/** How far above a group's first rock its marker sits. */
export const GROUP_MARKER_LIFT_VH = 0.16

/**
 * Lay the photographs out down the pond, two to a row.
 *
 * One rock per depth step is the obvious layout and it makes the pond
 * enormous — thirteen photographs came to eleven and a half screens. The
 * tempting fix is to squeeze the vertical spacing, but that packs the rocks
 * into a dense column and loses the stepping-stone reading altogether.
 *
 * Pairing halves the row count while leaving the vertical rhythm exactly as
 * it was, which is why the pond gets a third shorter without feeling any more
 * crowded as you descend past it.
 */
export function placePhotoStones(
  sources: readonly {
    src: string
    original: string
    alt?: string
    video?: string
    group?: string
  }[],
): PhotoStoneSpec[] {
  // Rows are counted as we go rather than derived from the index, because a
  // new group starts a new row even when the last one had a free seat.
  let row = -1
  let seat = PHOTOS_PER_ROW
  let groupsBefore = 0
  let previousGroup: string | undefined

  return sources.map((photo, index) => {
    const newGroup = index > 0 && photo.group !== previousGroup
    if (newGroup) groupsBefore++
    if (seat >= PHOTOS_PER_ROW || newGroup) {
      row++
      seat = 0
    }
    previousGroup = photo.group
    const isRight = seat === 1
    seat++

    // Drift per row, so the two columns are not perfectly straight either.
    const drift = ((row * 7) % 5) / 5
    const xFraction = isRight ? 0.64 + drift * 0.12 : 0.22 + drift * 0.12

    return {
      src: photo.src,
      ...(photo.video ? { video: photo.video } : {}),
      ...(photo.group !== undefined ? { group: photo.group } : {}),
      // The real description when captions.json has one; the same bracketed
      // placeholder as before when it does not.
      alt:
        photo.alt?.trim() ||
        `[photograph — aidan to describe: ${photo.original.split('/').pop()}]`,
      xFraction,
      depthVh:
        PHOTOS_START_VH +
        row * PHOTO_STEP_VH +
        groupsBefore * GROUP_GAP_VH +
        (isRight ? PHOTO_PAIR_OFFSET_VH : 0),
      radiusFraction: 0.05,
      // Smaller than a navigation stone's floor: a photo rock is a pebble,
      // and it is never the thing a lost visitor needs to find.
      minRadius: 26,
    }
  })
}

/**
 * One marker per group, just above the group's first rock. None at all when
 * nothing is grouped, so an ungrouped gallery looks exactly as it did.
 */
export function photoGroupMarkers(
  stones: readonly PhotoStoneSpec[],
): { label: string; depthVh: number }[] {
  const markers: { label: string; depthVh: number }[] = []
  let previous: string | undefined
  for (const stone of stones) {
    if (stone.group === undefined || stone.group === previous) continue
    previous = stone.group
    markers.push({ label: stone.group, depthVh: stone.depthVh - GROUP_MARKER_LIFT_VH })
  }
  return markers
}

/**
 * How deep the pond has to be for these rocks: the deepest one plus a tail of
 * water. Measured from the placed rocks rather than computed from a count,
 * because groups make the rows uneven.
 */
export function galleryDepthVh(stones: readonly PhotoStoneSpec[], baseDepthVh: number): number {
  if (stones.length === 0) return baseDepthVh
  const deepest = Math.max(...stones.map((stone) => stone.depthVh))
  return Math.max(baseDepthVh, deepest + PHOTOS_TAIL_VH)
}

/**
 * How deep the pond needs to be to hold everything.
 *
 * Without photographs it is just the navigation; each ROW adds a step.
 */
export function pondDepthVh(photoCount: number, baseDepthVh: number): number {
  if (photoCount <= 0) return baseDepthVh
  const lastRow = Math.floor((photoCount - 1) / PHOTOS_PER_ROW)
  const deepest =
    PHOTOS_START_VH + lastRow * PHOTO_STEP_VH + PHOTO_PAIR_OFFSET_VH + PHOTOS_TAIL_VH
  return Math.max(baseDepthVh, deepest)
}
