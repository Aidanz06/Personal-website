/**
 * An album with no cover, drawn as its own name.
 *
 * last.fm has no art for plenty of records, and a broken image icon in the
 * middle of the pond is the one outcome worth any amount of work to avoid. So
 * a coverless album opens as its name set in characters — which is what the
 * whole page is made of anyway, so it reads as belonging rather than as a
 * fallback.
 *
 * The trick is that the pond already knows how to open a picture. Rather than
 * teaching it a second thing, the name is turned INTO a picture: an SVG data
 * URL, which the canvas decodes, samples for brightness, and renders through
 * the same ASCII stage and the same duotone as a real cover. Nothing in the
 * pond needs to know the difference.
 *
 * White on black on purpose, and not a theme colour. The image is reduced to
 * luminance for the characters and duotoned for the final draw, so the theme
 * is applied downstream — using a theme colour here would apply it twice and
 * flatten the contrast the ramp needs.
 *
 * A data URL is same-origin, so it does not taint the canvas.
 */

/** The square the name is drawn in. Square, because a cover is. */
const SIZE = 600
/** Space around the text block. */
const PADDING = 44
/** A monospace glyph is about this fraction of the font size wide. */
const CHAR_WIDTH_RATIO = 0.6
/** Longest a line may get before it is wrapped. */
const MAX_LINE_CHARS = 15
const MAX_FONT_SIZE = 92
const MIN_FONT_SIZE = 26

/**
 * Break a title into lines at word boundaries.
 *
 * A word longer than the limit is left on a line of its own rather than being
 * cut in half: "Screamadelica" hyphenated across two lines is worse than
 * "Screamadelica" slightly too wide, and the font size shrinks to fit either
 * way.
 */
export function wrapText(value: string, maxChars = MAX_LINE_CHARS): string[] {
  const words = value.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return []

  const lines: string[] = []
  let current = ''
  for (const word of words) {
    if (!current) current = word
    else if (`${current} ${word}`.length <= maxChars) current = `${current} ${word}`
    else {
      lines.push(current)
      current = word
    }
  }
  if (current) lines.push(current)
  return lines
}

/** XML entities, so a title with an ampersand in it does not break the SVG. */
export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/** Largest size at which the longest line still fits the box. */
function fitFontSize(lines: readonly string[]): number {
  const longest = lines.reduce((max, line) => Math.max(max, line.length), 1)
  const available = SIZE - PADDING * 2
  const size = available / (longest * CHAR_WIDTH_RATIO)
  return Math.max(MIN_FONT_SIZE, Math.min(MAX_FONT_SIZE, Math.floor(size)))
}

/**
 * The album's name and artist as an image the pond can open.
 *
 * Returns '' when there is nothing to draw, which the page reads as "this
 * rock has no picture at all" — a rock that stays a rock rather than one that
 * opens onto nothing.
 */
export function coverlessCover(album: string, artist: string): string {
  const name = album.trim()
  const by = artist.trim()
  if (!name && !by) return ''

  const lines = wrapText(name)
  const fontSize = fitFontSize(lines)
  const lineHeight = Math.round(fontSize * 1.16)
  // The artist sits under the title, smaller: it is the second thing read.
  const artistSize = Math.max(18, Math.round(fontSize * 0.42))
  const gap = Math.round(artistSize * 1.4)

  const blockHeight = lines.length * lineHeight + (by ? gap + artistSize : 0)
  // Baseline of the first line, from a block centred in the square.
  let y = Math.round((SIZE - blockHeight) / 2 + fontSize * 0.82)

  const parts: string[] = []
  for (const line of lines) {
    parts.push(
      `<text x="${SIZE / 2}" y="${y}" font-size="${fontSize}" fill="#ffffff">${escapeXml(line)}</text>`,
    )
    y += lineHeight
  }
  if (by) {
    y += gap - lineHeight + artistSize
    parts.push(
      `<text x="${SIZE / 2}" y="${y}" font-size="${artistSize}" fill="#bbbbbb">${escapeXml(by)}</text>`,
    )
  }

  // No webfont: an SVG inside an <img> is an isolated document and cannot
  // reach the page's fonts. Generic monospace is what it gets, and the result
  // is quantised to characters regardless.
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">` +
    `<rect width="${SIZE}" height="${SIZE}" fill="#000000"/>` +
    `<g font-family="ui-monospace, SFMono-Regular, Menlo, monospace" text-anchor="middle">` +
    parts.join('') +
    `</g></svg>`

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}
