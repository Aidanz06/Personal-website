/**
 * The slideshow's pure logic: which slide is showing, and what a transition
 * between two of them looks like at a given moment.
 *
 * None of it touches the DOM, so all of it is testable — the component is
 * left holding only canvases and event listeners.
 */

/** How long a slide change takes, in milliseconds. */
export const DISSOLVE_MS = 760

/**
 * Fraction of the transition spent at full characters, in the middle.
 *
 * Without a hold the deck crossfades through a glimpse of text and the effect
 * reads as a smudge. The pond made the same call for the photo rocks: the
 * ASCII stage has to be legible for a beat or it is just a fade with extra
 * steps.
 */
export const DISSOLVE_HOLD = 0.2

export type DissolveFrame = {
  /** Whose pixels sit underneath the characters right now. */
  source: 'from' | 'to'
  /** How strongly the character layer is drawn over them, 0..1. */
  ascii: number
}

function smoothstep(t: number): number {
  const u = t < 0 ? 0 : t > 1 ? 1 : t
  return u * u * (3 - 2 * u)
}

/**
 * One frame of a slide change.
 *
 * The outgoing slide breaks into characters, the characters hold, and the
 * incoming slide resolves out of them. The swap happens at the midpoint,
 * while the character layer is fully opaque and hiding both.
 */
export function dissolveFrame(t: number, hold = DISSOLVE_HOLD): DissolveFrame {
  const clamped = t < 0 ? 0 : t > 1 ? 1 : t
  const ramp = (1 - hold) / 2
  const source = clamped < 0.5 ? 'from' : 'to'

  if (clamped < ramp) return { source, ascii: smoothstep(clamped / ramp) }
  if (clamped > 1 - ramp) return { source, ascii: smoothstep((1 - clamped) / ramp) }
  return { source, ascii: 1 }
}

/**
 * Move by `delta` slides, stopping at the ends.
 *
 * Clamped rather than wrapped. This is a presentation: running off slide
 * twelve back to slide one mid-read tells the reader nothing, and the
 * controls disable at the ends so the boundary is visible before it is hit.
 */
export function stepIndex(current: number, delta: number, count: number): number {
  if (count <= 0) return 0
  const next = current + delta
  return next < 0 ? 0 : next > count - 1 ? count - 1 : next
}

/** The mono counter: "03 / 12". */
export function formatCounter(index: number, count: number): string {
  const width = Math.max(2, String(count).length)
  return `${String(index + 1).padStart(width, '0')} / ${String(count).padStart(width, '0')}`
}

/** Distance a finger has to travel before it counts as a swipe, in pixels. */
export const SWIPE_THRESHOLD = 44

/**
 * Which way a drag went: -1 back, 1 forward, 0 not a swipe.
 *
 * A gesture that moved further vertically than horizontally is the reader
 * scrolling the page past the slideshow, and eating it would make the
 * component a scroll trap on a phone.
 */
export function swipeDirection(
  dx: number,
  dy: number,
  threshold = SWIPE_THRESHOLD,
): -1 | 0 | 1 {
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return 0
  if (Math.abs(dx) < threshold) return 0
  if (Math.abs(dy) > Math.abs(dx)) return 0
  // Dragging leftwards pulls the next slide in, as it does on every photo
  // viewer a phone has ever shipped with.
  return dx < 0 ? 1 : -1
}
