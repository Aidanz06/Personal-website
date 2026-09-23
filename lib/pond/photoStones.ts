/**
 * Photo rocks: one small stone per photograph, scattered down the depths.
 *
 * Separate from the navigation stones in stones.ts, and deliberately so. A
 * navigation stone takes you somewhere; a photo rock opens a picture in
 * place, and never navigates. They are different things and they look
 * different — photo rocks are smaller and sit below every nav stone.
 */

export type PhotoStoneSpec = {
  src: string
  /** Real alt text for the button that sits over the rock. */
  alt: string
  xFraction: number
  depthVh: number
  radiusFraction: number
  minRadius: number
}

/** Where the photo rocks begin, in viewport heights. Below the last nav stone. */
export const PHOTOS_START_VH = 3.15
/** Vertical gap between consecutive photo rocks. */
export const PHOTO_STEP_VH = 0.62
/** Empty water below the last rock, so the pond does not end abruptly. */
export const PHOTOS_TAIL_VH = 0.9

/**
 * Lay the photographs out down the pond.
 *
 * Staggered left and right rather than stacked in a column: a vertical line
 * of rocks reads as a list, which is exactly the gallery page this was meant
 * to replace.
 */
export function placePhotoStones(sources: readonly string[]): PhotoStoneSpec[] {
  return sources.map((src, index) => {
    // Alternating sides, nudged by index so it never looks like a zigzag
    // stencil either.
    const left = index % 2 === 0
    const drift = ((index * 7) % 5) / 5 // 0, 0.4, 0.8, 0.2, 0.6, repeating
    const xFraction = left ? 0.24 + drift * 0.12 : 0.64 + drift * 0.12

    return {
      src,
      alt: `[photograph — aidan to describe: ${src.split('/').pop()}]`,
      xFraction,
      depthVh: PHOTOS_START_VH + index * PHOTO_STEP_VH,
      radiusFraction: 0.05,
      // Smaller than a navigation stone's floor: a photo rock is a pebble,
      // and it is never the thing a lost visitor needs to find.
      minRadius: 26,
    }
  })
}

/**
 * How deep the pond needs to be to hold everything.
 *
 * Without photographs it is just the navigation; each one adds a step.
 */
export function pondDepthVh(photoCount: number, baseDepthVh: number): number {
  if (photoCount <= 0) return baseDepthVh
  return Math.max(
    baseDepthVh,
    PHOTOS_START_VH + (photoCount - 1) * PHOTO_STEP_VH + PHOTOS_TAIL_VH,
  )
}
