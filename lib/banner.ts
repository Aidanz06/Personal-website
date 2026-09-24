/**
 * Words drawn as ASCII art, for headings that belong to the pond.
 *
 * A five-row bitmap font, written by hand. A figlet-style library would be a
 * dependency, and its fonts are far wider than a phone: "photo gallery" in
 * figlet's standard font is about 90 characters. This one is 60.
 *
 * Pure: it returns lines of text. What colour they are is the page's job, and
 * the page gives them a theme token, so they change with the theme like every
 * other character on the site.
 */

/**
 * Each glyph as rows of '#' (ink) and '.' (blank). Widths vary by glyph, but
 * every row of one glyph is the same width.
 *
 * The whole alphabet, the digits, and the two separators labels use. Place
 * names are whatever Aidan writes, so the font can't stop at the letters of
 * "photo gallery". Those ten (a e g h l o p r t y) are unchanged from the
 * first version, so the heading keeps its shape.
 */
const FONT: Record<string, readonly string[]> = {
  a: ['.##.', '#..#', '####', '#..#', '#..#'],
  b: ['###.', '#..#', '###.', '#..#', '###.'],
  c: ['.###', '#...', '#...', '#...', '.###'],
  d: ['###.', '#..#', '#..#', '#..#', '###.'],
  e: ['####', '#...', '###.', '#...', '####'],
  f: ['####', '#...', '###.', '#...', '#...'],
  g: ['.###', '#...', '#.##', '#..#', '.###'],
  h: ['#..#', '#..#', '####', '#..#', '#..#'],
  i: ['###', '.#.', '.#.', '.#.', '###'],
  j: ['..##', '...#', '...#', '#..#', '.##.'],
  k: ['#..#', '#.#.', '##..', '#.#.', '#..#'],
  l: ['#..', '#..', '#..', '#..', '###'],
  m: ['#...#', '##.##', '#.#.#', '#...#', '#...#'],
  n: ['#..#', '##.#', '#.##', '#..#', '#..#'],
  o: ['.##.', '#..#', '#..#', '#..#', '.##.'],
  p: ['###.', '#..#', '###.', '#...', '#...'],
  q: ['.##.', '#..#', '#..#', '.###', '...#'],
  r: ['###.', '#..#', '###.', '#.#.', '#..#'],
  s: ['.###', '#...', '.##.', '...#', '###.'],
  t: ['###', '.#.', '.#.', '.#.', '.#.'],
  u: ['#..#', '#..#', '#..#', '#..#', '.##.'],
  v: ['#...#', '#...#', '.#.#.', '.#.#.', '..#..'],
  w: ['#...#', '#...#', '#.#.#', '##.##', '#...#'],
  x: ['#...#', '.#.#.', '..#..', '.#.#.', '#...#'],
  y: ['#...#', '.#.#.', '..#..', '..#..', '..#..'],
  z: ['####', '...#', '.##.', '#...', '####'],
  '0': ['.##.', '#.##', '#..#', '##.#', '.##.'],
  '1': ['.#.', '##.', '.#.', '.#.', '###'],
  '2': ['###.', '...#', '.##.', '#...', '####'],
  '3': ['###.', '...#', '.##.', '...#', '###.'],
  '4': ['#..#', '#..#', '####', '...#', '...#'],
  '5': ['####', '#...', '###.', '...#', '###.'],
  '6': ['.##.', '#...', '###.', '#..#', '.##.'],
  '7': ['####', '...#', '..#.', '.#..', '.#..'],
  '8': ['.##.', '#..#', '.##.', '#..#', '.##.'],
  '9': ['.##.', '#..#', '.###', '...#', '.##.'],
  '·': ['.', '.', '#', '.', '.'],
  '-': ['...', '...', '###', '...', '...'],
  ' ': ['..', '..', '..', '..', '..'],
}

/** Rows in the font. */
export const BANNER_ROWS = 5

/** Characters the font can draw. */
export function bannerSupports(text: string): boolean {
  return [...text.toLowerCase()].every((char) => char in FONT)
}

/**
 * The text as BANNER_ROWS lines of ASCII art.
 *
 * One blank column between letters. Trailing space is trimmed from every line
 * so a <pre> sizes to the art rather than to invisible padding. A character
 * the font does not have throws, rather than silently vanishing from a
 * heading — which is how a typo would ship.
 */
export function asciiBanner(text: string, ink = '#'): string[] {
  const letters = [...text.toLowerCase()]
  for (const char of letters) {
    if (!(char in FONT)) throw new Error(`asciiBanner has no glyph for "${char}"`)
  }
  const rows: string[] = []
  for (let row = 0; row < BANNER_ROWS; row++) {
    const line = letters.map((char) => FONT[char]![row]!).join('.')
    rows.push(line.replace(/#/g, ink).replace(/\./g, ' ').replace(/\s+$/, ''))
  }
  return rows
}

/**
 * Several lines of text as one piece of ASCII art: a banner per line, with a
 * blank row between them. For labels long enough to need wrapping. ASCII art
 * can't reflow like text, so the caller decides where the lines break.
 */
export function asciiBannerLines(lines: readonly string[], ink = '#'): string[] {
  const blocks = lines.map((line) => asciiBanner(line, ink))
  const widthOf = (block: string[]) => Math.max(0, ...block.map((row) => row.length))
  const widest = Math.max(0, ...blocks.map(widthOf))
  const rows: string[] = []
  blocks.forEach((block, index) => {
    if (index > 0) rows.push('')
    // Centred: labels sit under the middle of a rock, and a short line pushed
    // to the block's left edge reads as a mistake.
    const pad = ' '.repeat(Math.floor((widest - widthOf(block)) / 2))
    rows.push(...block.map((row) => (row ? pad + row : row)))
  })
  return rows
}

