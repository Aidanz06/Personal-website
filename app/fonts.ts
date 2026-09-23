import { Newsreader, Inter, JetBrains_Mono } from 'next/font/google'

/**
 * Typeface pairing. Swap a family here and the whole site follows — nothing
 * else in the codebase names a font, it all goes through the CSS variables
 * these expose (see the @theme block in globals.css).
 *
 * Current pairing (A): Newsreader / Inter / JetBrains Mono.
 *   - Newsreader is a *text* serif, so it stays readable at 48px lowercase
 *     for the name and at 20px for headings. Display serifs get spindly small.
 *   - Inter is deliberately neutral; the page should read as type and space,
 *     not as a typeface choice.
 *   - JetBrains Mono is metric-stable, which the ASCII grid depends on —
 *     every glyph must occupy exactly the same advance width.
 *
 * Alternatives, both drop-in:
 *   (B) Instrument_Serif / Geist / Geist_Mono — sharper, more editorial display
 *       serif; thinner at small sizes.
 *   (C) Source_Serif_4 / IBM_Plex_Sans / IBM_Plex_Mono — warmer, slightly more
 *       corporate.
 *
 * next/font/google downloads and self-hosts these at build time. No request
 * ever reaches Google's servers at runtime, and there is no render-blocking
 * stylesheet.
 */

export const display = Newsreader({
  subsets: ['latin'],
  display: 'swap',
  variable: '--ff-display',
  weight: ['400', '500'],
})

export const body = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--ff-body',
})

export const mono = JetBrains_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--ff-mono',
  weight: ['400'],
})

export const fontVariables = `${display.variable} ${body.variable} ${mono.variable}`
