/**
 * The wave a page change sends across the pond.
 *
 * Navigating between pages replaces the text but the water is the one thing
 * that persists across the whole site, so it is the thing that can carry the
 * transition. A wave crossing the surface says "something moved" in the
 * language the page is already speaking.
 *
 * This is a module-level queue rather than a prop, for the same reason the
 * pointer position is: the canvas owns a frame loop that never re-renders,
 * and the navigation happens somewhere entirely else in the tree. The pond
 * drains the queue on its next frame.
 */

export type SplashPoint = {
  /** Horizontal position, as a fraction of the pond's width. */
  xFraction: number
  /** Vertical position, as a fraction of the viewport height. */
  yFraction: number
  /** Seconds to wait before this one starts. */
  delay: number
  strength: number
}

/**
 * A row of ripples, started a beat apart, left to right.
 *
 * One big ripple in the middle reads as a splash — something dropped in. The
 * staggered row reads as a wave travelling across, which is the right verb
 * for moving from one page to another.
 */
export function pageSplashWave(count = 7, strength = 0.85): SplashPoint[] {
  const points: SplashPoint[] = []
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : i / (count - 1)
    points.push({
      xFraction: 0.08 + t * 0.84,
      // Slightly above centre, and not perfectly level: a dead-straight line
      // of ripples reads as a machine, not as water.
      yFraction: 0.42 + Math.sin(t * Math.PI) * 0.12,
      delay: t * 0.22,
      strength,
    })
  }
  return points
}

const pending: SplashPoint[] = []

/** Ask the pond for a wave. Safe to call when no pond is mounted. */
export function requestPageSplash(): void {
  // Replace rather than append: two fast navigations should send one wave,
  // not stack into a storm.
  pending.length = 0
  pending.push(...pageSplashWave())
}

/**
 * One ripple at a spot, as fractions of the screen: a single splash, for
 * something dropped in rather than a page moving past. The theme control
 * uses it, so a new pond starts where it was chosen.
 */
export function requestSplashAt(xFraction: number, yFraction: number, strength: number): void {
  const clamp = (value: number) => Math.min(1, Math.max(0, value))
  pending.push({ xFraction: clamp(xFraction), yFraction: clamp(yFraction), delay: 0, strength })
}

/** Take whatever is queued. The pond calls this once per frame. */
export function drainSplashes(): SplashPoint[] {
  if (pending.length === 0) return []
  return pending.splice(0, pending.length)
}
