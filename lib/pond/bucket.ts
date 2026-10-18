/**
 * The bucket of koi food, floating in the water between the name and the
 * first stone.
 *
 * The bucket itself is a line drawing (FoodBucket.tsx), the same hairline as
 * the hand that reaches into it: drawn in the pond's characters it was a
 * blob at any size small enough to stay out of the way. What puts it in
 * the water is the pond: it rings slowly around the bucket, the way the
 * listening stone does. Both read their position from BUCKET here.
 */

/** Where the bucket floats: right of the column, above the first stone. */
export const BUCKET = { xFraction: 0.76, depthVh: 0.58 } as const

/** The bucket's width (and height) on screen. Small, but still a tap target. */
export const BUCKET_SIZE_CSS = 'clamp(44px, min(100vw, 100vh) * 0.06, 54px)'

/**
 * Inside the drawing's 32-unit box: the middle of the rim, where the hand
 * reaches in, and the front edge of the rim, below which the hand is inside
 * the bucket and out of sight.
 */
export const BUCKET_VIEWBOX = 32
export const BUCKET_MOUTH_Y = 12
export const BUCKET_RIM_FRONT_Y = 15.1

/** Seconds between the soft rings the floating bucket gives off. */
export const BUCKET_RING_INTERVAL = 3.4
/** How strong a ring is, against a stone's. Quieter: it is only floating. */
export const BUCKET_RING_STRENGTH = 0.32
