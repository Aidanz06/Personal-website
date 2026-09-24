/**
 * Bubbles rising between the navigation and the gallery.
 *
 * A handful of small characters drift up through the gap above the
 * photographs, as if something down there is breathing: a hint that the pond
 * goes deeper, without an arrow and without a word. Aidan's choice over a
 * cue at the surface.
 *
 * Fixed rather than random, so the page is the same on every visit. It's a
 * tiny seeded sequence, not Math.random at render, which would also differ
 * between the server's HTML and the browser's and break hydration.
 *
 * Pure: the page turns these into elements and CSS does the rising.
 */

/** Small, round, and in the site's own mono: a bubble, a smaller one, a speck. */
export const BUBBLE_GLYPHS = ['o', '°', '.'] as const

export type Bubble = {
  glyph: (typeof BUBBLE_GLYPHS)[number]
  /** Across the pond, as a fraction of its width. */
  xFraction: number
  /** Seconds before it first rises, so they never go up together. */
  delay: number
  /** Seconds from the bottom of the gap to the top. */
  duration: number
  /** Sideways drift at the middle of the rise, in px. */
  sway: number
  /** Font size in px. Smaller reads as further away. */
  size: number
}

/** A small, stable pseudo-random sequence (a linear congruential generator). */
function seeded(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 2 ** 32
  }
}

export function bubbleField(count = 9, seed = 7): Bubble[] {
  const next = seeded(seed)
  return Array.from({ length: count }, (_, i) => {
    // Spread across the pond in slots from edge to edge, jittered within
    // each, so they cover the width without two stacking on one line.
    const slot = count === 1 ? 0.5 : i / (count - 1)
    return {
      glyph: BUBBLE_GLYPHS[Math.floor(next() * BUBBLE_GLYPHS.length)]!,
      xFraction: Math.min(0.95, Math.max(0.05, 0.08 + 0.84 * slot + (next() - 0.5) * (0.6 / count))),
      delay: i * 0.83 + next() * 0.5,
      duration: 5 + next() * 4,
      sway: (next() < 0.5 ? -1 : 1) * (4 + next() * 10),
      size: [11, 13, 15][Math.floor(next() * 3)]!,
    }
  })
}
