import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { THEMES } from '../themes'
import { pondPalette } from './theme'

const RAMP = ' .:-=+*#%@'
const SHADES = 6

/**
 * Read the themes straight out of app/globals.css.
 *
 * Copying the hex values into this file would mean the test passes forever
 * while the stylesheet drifts away from it. Parsing the real blocks means a
 * new theme is covered the moment it exists, and a theme whose CSS block is
 * missing fails here rather than in the browser.
 */
function themeTokens(themeId: string): Record<string, string> {
  const css = readFileSync(join(process.cwd(), 'app', 'globals.css'), 'utf8')
  // Matches both "[data-theme='koi']" and the ":root, [data-theme='koi']" pair.
  const block = new RegExp(`\\[data-theme='${themeId}'\\]\\s*\\{([^}]*)\\}`).exec(css)
  if (!block?.[1]) return {}

  const tokens: Record<string, string> = {}
  for (const line of block[1].split('\n')) {
    const declaration = /^\s*(--[\w-]+)\s*:\s*([^;]+);/.exec(line)
    if (declaration) tokens[declaration[1]!] = declaration[2]!.trim()
  }

  // The @theme block indirects --color-* through these --t-* slots. The
  // browser does that substitution; here it is one line.
  return {
    '--color-ground': tokens['--t-ground'] ?? '',
    '--color-ink': tokens['--t-ink'] ?? '',
    '--color-water': tokens['--t-water'] ?? '',
    '--color-koi-1': tokens['--t-koi-1'] ?? '',
    '--color-koi-2': tokens['--t-koi-2'] ?? '',
    '--color-koi-3': tokens['--t-koi-3'] ?? '',
    '--color-accent': tokens['--t-accent'] ?? '',
  }
}

const reader = (tokens: Record<string, string>) => (token: string) => tokens[token] ?? ''

describe('pondPalette', () => {
  it('has a CSS block for every theme in the list', () => {
    // A theme in lib/themes.ts with no block in globals.css shows up as the
    // fallback palette — the pond keeps painting in koi's colours while the
    // page around it changes. That is a confusing bug to chase in a browser.
    for (const theme of THEMES) {
      expect(Object.values(themeTokens(theme.id)).every(Boolean), theme.id).toBe(true)
    }
  })

  it('paints every theme in its own colours', () => {
    const palettes = THEMES.map((theme) =>
      pondPalette(reader(themeTokens(theme.id)), RAMP, SHADES),
    )
    // Nothing is memoised at module scope: three calls, three different
    // answers. This is the property a theme switch depends on.
    const grounds = new Set(palettes.map((palette) => palette.ground))
    const waters = new Set(palettes.map((palette) => palette.colors[0]))
    const kois = new Set(palettes.map((palette) => palette.colors.at(-1)))
    expect(grounds.size).toBe(THEMES.length)
    expect(waters.size).toBe(THEMES.length)
    expect(kois.size).toBe(THEMES.length)
  })

  it('never falls back to the koi defaults for a theme that has real tokens', () => {
    // The fallbacks exist for a missing stylesheet, not as a silent default.
    const paper = pondPalette(reader(themeTokens('paper')), RAMP, SHADES)
    const koi = pondPalette(reader(themeTokens('koi')), RAMP, SHADES)
    expect(paper.ground).not.toBe(koi.ground)
    expect(paper.photoHighlight).not.toBe(koi.photoHighlight)
    expect(paper.photoShadow).not.toBe(koi.photoShadow)
  })

  it('turns the ramp round for a light theme', () => {
    // On a dark ground a dense glyph reads bright; on a light one it reads
    // dark. Get this wrong and the photographs come out as negatives.
    const dark = pondPalette(reader(themeTokens('koi')), RAMP, SHADES)
    const light = pondPalette(reader(themeTokens('paper')), RAMP, SHADES)
    expect(dark.ramp).toBe([...RAMP].reverse().join(''))
    expect(light.ramp).toBe(RAMP)
  })

  it('lays the koi gradient out head to tail', () => {
    const palette = pondPalette(reader(themeTokens('koi')), RAMP, SHADES)
    // Water, stone, then one entry per shade.
    expect(palette.colors).toHaveLength(2 + SHADES)
    expect(palette.colors[2]).toBe('rgb(210,69,30)') // koi-1, exactly
    expect(palette.colors.at(-1)).toBe('rgb(247,239,226)') // koi-3, exactly
  })

  it('carries the ink colour, for pictures that stay as characters', () => {
    // An album cover on /listening is left as ASCII art. Drawn in the koi's
    // colours it reads as part of the fish; drawn in ink it reads as part of
    // the page. Separate from `colors`, so the atlas indices above never move.
    const koi = pondPalette(reader(themeTokens('koi')), RAMP, SHADES)
    const paper = pondPalette(reader(themeTokens('paper')), RAMP, SHADES)
    expect(koi.ink).toBe('rgb(236,231,221)')
    expect(paper.ink).toBe('rgb(21,38,63)')
    expect(pondPalette(() => '', RAMP, SHADES).ink).not.toContain('NaN')
  })

  it('falls back rather than painting with NaN when tokens are missing', () => {
    const palette = pondPalette(() => '', RAMP, SHADES)
    expect(palette.ground).toBe('#0b100f')
    for (const color of palette.colors) {
      expect(color).not.toContain('NaN')
    }
  })

  it('survives a token that is not a colour at all', () => {
    const palette = pondPalette(
      (token) => (token === '--color-ground' ? 'var(--undefined-thing)' : '#ffffff'),
      RAMP,
      SHADES,
    )
    expect(palette.ground).toBe('#0b100f')
    expect(palette.colors.every((color) => !color.includes('NaN'))).toBe(true)
  })

  it('handles a single-shade gradient without dividing by zero', () => {
    const palette = pondPalette(reader(themeTokens('koi')), RAMP, 1)
    expect(palette.colors).toHaveLength(3)
    expect(palette.colors[2]).not.toContain('NaN')
  })
})
