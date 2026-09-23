/**
 * Defaults for <AsciiImage>. Every one of these is exposed as a prop and is
 * meant to be adjusted by eye in /lab, not reasoned about from here.
 */

/** Sparse -> dense. See rampChar() for why the direction matters. */
export const DEFAULT_RAMP = '.:-=+*#%@'

/** Character cell width in CSS pixels. */
export const DEFAULT_CELL_SIZE = 9

/**
 * Cell height / cell width. Monospace glyphs are about twice as tall as they
 * are wide, so a square cell would stretch the picture. 2 keeps the image's
 * proportions intact.
 */
export const DEFAULT_CELL_ASPECT = 2

/** Within this distance of the pointer, the photograph is fully resolved. */
export const DEFAULT_INNER_RADIUS = 60

/** Beyond this distance, pure characters. */
export const DEFAULT_OUTER_RADIUS = 180

/** Time to ease back to fully abstract after the pointer leaves. */
export const DEFAULT_EXIT_EASE_MS = 600

/** Below this, the renderer coarsens its own grid. */
export const MIN_ACCEPTABLE_FPS = 30

/** Ceiling on runtime cell-size growth, so degradation can't run away. */
export const MAX_CELL_SIZE = 24
