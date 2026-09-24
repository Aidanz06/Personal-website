/**
 * Choosing a theme changes the pond, so it should look like the pond
 * changing: the new water spreads outward in a ring from the control that
 * was pressed, and a ripple drops where it started. Before this, the palette
 * snapped from one set of colours to the next like a stylesheet swap.
 *
 * The ring is a view transition: the new page is revealed through a growing
 * circle clipped over the old one. Browsers without view transitions, and
 * anyone who asked for reduced motion, get the instant swap, which is the
 * same result without the movement.
 */

/** How far the ring must grow to cover the screen from (x, y). */
export function themeRingRadius(x: number, y: number, width: number, height: number): number {
  return Math.hypot(Math.max(x, width - x), Math.max(y, height - y))
}

export function themeChange(env: { reducedMotion: boolean; supported: boolean }): 'ring' | 'instant' {
  return env.supported && !env.reducedMotion ? 'ring' : 'instant'
}

/** Long enough to read as water spreading, short enough to never be waited on. */
export const THEME_RING_MS = 700
