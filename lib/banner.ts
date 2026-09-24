/**
 * Words drawn as ASCII art, for headings that belong to the pond.
 *
 * A five-row bitmap font, written by hand, covering only the letters the site
 * uses. A figlet-style library would be a dependency for ten letters, and its
 * fonts are far wider than a phone: "photo gallery" in figlet's standard font
 * is about 90 characters. This one is 60 on a line, 33 stacked.
 *
 * Pure: it returns lines of text. What colour they are is the page's job, and
 * the page gives them a theme token, so they change with the theme like every
 * other character on the site.
 */

/** Each letter as rows of '#' (ink) and '.' (blank). Widths vary by letter. */
const FONT: Record<string, readonly string[]> = {
  a: ['.##.', '#..#', '####', '#..#', '#..#'],
  e: ['####', '#...', '###.', '#...', '####'],
  g: ['.###', '#...', '#.##', '#..#', '.###'],
  h: ['#..#', '#..#', '####', '#..#', '#..#'],
  l: ['#..', '#..', '#..', '#..', '###'],
  o: ['.##.', '#..#', '#..#', '#..#', '.##.'],
  p: ['###.', '#..#', '###.', '#...', '#...'],
  r: ['###.', '#..#', '###.', '#.#.', '#..#'],
  t: ['###', '.#.', '.#.', '.#.', '.#.'],
  y: ['#...#', '.#.#.', '..#..', '..#..', '..#..'],
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
