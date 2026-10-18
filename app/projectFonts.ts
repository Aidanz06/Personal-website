import { Instrument_Serif, Silkscreen } from 'next/font/google'

/**
 * Each project's own logo: the display face its deck and its app are set in,
 * and the accent its logo is drawn with. Used for the project page's title
 * and headings (components/ProjectHeadings.tsx) and for its stone's label in
 * the pond (components/ProjectLogo.tsx), so the two always match.
 *
 * Every face fills the same --ff-project variable; only one project's face
 * is ever in scope on an element.
 */

const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  display: 'swap',
  variable: '--ff-project',
  weight: '400',
  style: ['normal', 'italic'],
})

const silkscreen = Silkscreen({
  subsets: ['latin'],
  display: 'swap',
  variable: '--ff-project',
  weight: '400',
})

export type ProjectLogoSpec = {
  font: { variable: string }
  /** What renders during the swap, and if the face never arrives. */
  fallback: string
  /**
   * The logo's accent, as on the deck's title slide (`dark`), and a darker
   * one for the paper theme, where the deck's colour would not be legible.
   */
  accent: { dark: string; paper: string }
  /** The logo's words, in order; `accent` marks the coloured part. */
  parts: readonly { text: string; accent?: boolean }[]
}

export const PROJECT_LOGOS = {
  // Instrument Serif: "Tailor" upright, "Studio" italic and gold. The gold is
  // 10.6:1 on koi; on paper a darker gold, 4.5:1.
  'tailor-studio': {
    font: instrumentSerif,
    fallback: "Georgia, 'Times New Roman', serif",
    accent: { dark: '#e0bb7b', paper: '#8a5f14' },
    parts: [{ text: 'Tailor ' }, { text: 'Studio', accent: true }],
  },
  // Silkscreen, the game's pixel face: a lime "$" and the rest in ink. The
  // lime is 16:1 on koi; on paper a deep green, 4.1:1.
  thousand: {
    font: silkscreen,
    fallback: "ui-monospace, 'SF Mono', Menlo, monospace",
    accent: { dark: '#c6ff3d', paper: '#4a7a00' },
    parts: [{ text: '$', accent: true }, { text: '1,000' }],
  },
} satisfies Record<string, ProjectLogoSpec>

export type ProjectId = keyof typeof PROJECT_LOGOS

export function isProjectId(value: string): value is ProjectId {
  return Object.hasOwn(PROJECT_LOGOS, value)
}
