/**
 * Fine-grained ASCII art, for a picture that stays as characters.
 *
 * The pond draws everything on one grid of 7px characters, which is right
 * for water and a fish and too coarse for an album cover at 300px: about 43
 * characters across, and a ten-step ramp. So a cover that stays as characters
 * hands over, at the end of its reveal, to its own rendering on a finer grid
 * with a longer ramp — the same moment a photograph hands over to the real
 * image. The coarse pond characters are still what it rises out of.
 *
 * The rendering is a finished image, so it can be drawn at sub-pixel
 * positions. That is what lets it drift smoothly instead of stepping one
 * pond cell at a time.
 *
 * Pure. The canvas work — measuring glyphs, drawing them — is in Pond.tsx.
 */

import type { Rect } from './photo'

/**
 * Width of one character in the fine rendering, in CSS pixels.
 *
 * 4px, against the pond's 7. Much smaller and a glyph stops reading as a
 * character at 1x and becomes a smudge of tone — at which point it is a
 * blurry photograph, not ASCII art.
 */
export const ART_CELL_WIDTH = 4

/** Tones in the fine ramp. The pond's own has ten; this is the extra detail. */
export const ART_RAMP_LEVELS = 16

/**
 * Candidates for the ramp, before measuring.
 *
 * Mostly punctuation and symbols. Letters carry more tone per glyph, but a
 * cover full of letters reads as text — a paragraph you try to read — rather
 * than as a picture drawn in characters. A few are kept for the dense end,
 * where punctuation runs out.
 */
export const ART_CANDIDATES = ` .'\`,-_:;~^"!|/\\+<>=?)(][}{*ilrtcxzvnjo7123CLJYUZ%#&8$B@WM`

/** Used when the glyphs cannot be measured, e.g. no canvas. */
const FALLBACK_RAMP = ` .:-=+*#%@`

export type MeasuredGlyph = { char: string; coverage: number }

/**
 * A ramp of `levels` glyphs, spaced evenly by how much ink each one puts
 * down in the font actually in use.
 *
 * Measured rather than typed out, because glyph density is a property of the
 * font: a ramp ordered for one monospace face has steps in the wrong order in
 * another, and a step in the wrong order is a speck of noise in every cover.
 * Spaced by coverage rather than taken in order, because most glyphs are
 * light — take the first sixteen and most of the ramp is spent on shades of
 * nearly-empty.
 */
export function buildRamp(measured: readonly MeasuredGlyph[], levels: number): string {
  const usable = measured
    .filter((m) => Number.isFinite(m.coverage) && m.char.length === 1)
    .sort((a, b) => a.coverage - b.coverage)
  // Two glyphs with the same coverage are the same tone; keep the first.
  const distinct: MeasuredGlyph[] = []
  for (const glyph of usable) {
    const last = distinct.at(-1)
    if (!last || glyph.coverage - last.coverage > 0.004) distinct.push(glyph)
  }
  if (distinct.length < 3) return FALLBACK_RAMP

  const count = Math.min(levels, distinct.length)
  const lo = distinct[0]!.coverage
  const hi = distinct.at(-1)!.coverage
  const chosen: MeasuredGlyph[] = []
  const used = new Set<number>()
  for (let i = 0; i < count; i++) {
    const target = lo + ((hi - lo) * i) / Math.max(1, count - 1)
    let best = -1
    for (let j = 0; j < distinct.length; j++) {
      if (used.has(j)) continue
      if (best === -1 || Math.abs(distinct[j]!.coverage - target) < Math.abs(distinct[best]!.coverage - target)) {
        best = j
      }
    }
    if (best === -1) break
    used.add(best)
    chosen.push(distinct[best]!)
  }
  return chosen
    .sort((a, b) => a.coverage - b.coverage)
    .map((g) => g.char)
    .join('')
}

/**
 * The fine grid for a picture of a given size.
 *
 * The cells are stretched very slightly so the grid fills the target
 * exactly — a whole number of characters that falls a few pixels short leaves
 * a seam of ground colour down one side.
 */
export function artGrid(
  width: number,
  height: number,
  cellAspect: number,
): { cols: number; rows: number; cellWidth: number; cellHeight: number } {
  const w = Math.max(1, width)
  const h = Math.max(1, height)
  const cols = Math.max(8, Math.round(w / ART_CELL_WIDTH))
  const cellWidth = w / cols
  const rows = Math.max(1, Math.round(h / (cellWidth * cellAspect)))
  return { cols, rows, cellWidth, cellHeight: h / rows }
}

/**
 * How far into a rectangle a point is, eased: 0 at the edge, 1 once it is
 * `featherPx` in. The coarse stage and the fine art both fade by this, so the
 * two dissolve into the water along the same line.
 */
export function edgeFeather(x: number, y: number, rect: Rect, featherPx: number): number {
  if (featherPx <= 0) return 1
  const edge = Math.min(x - rect.x, rect.x + rect.width - x, y - rect.y, rect.y + rect.height - y)
  const t = Math.min(1, Math.max(0, edge / featherPx))
  return t * t * (3 - 2 * t)
}
