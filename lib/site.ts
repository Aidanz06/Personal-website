/**
 * Single source of truth for strings that appear on more than one page.
 *
 * Anything still unwritten is a visible bracketed placeholder rather than a
 * plausible-looking fake, so an unfinished page is obvious at a glance
 * instead of shipping as filler.
 */

export const site = {
  name: 'aidan zheng',
  // No domain purchased yet; metadataBase and OG images land in v1.
  url: 'https://example.com',
  identity: 'business analytics @ northeastern · boston',
  description:
    'aidan zheng — business analytics student at northeastern (d’amore-mckim), cs minor.',
} as const

/**
 * Footer contact links.
 *
 * `href` is null while the real destination is unknown. A placeholder string
 * in an href would render a link that silently navigates somewhere wrong, so
 * unset entries render as plain muted text showing what's missing.
 */
export type Contact = {
  readonly label: string
  readonly href: string | null
  readonly placeholder: string
}

export const contacts: readonly Contact[] = [
  { label: 'email', href: null, placeholder: '[email — aidan to add]' },
  { label: 'github', href: null, placeholder: '[github url — aidan to add]' },
  {
    label: 'linkedin',
    href: null,
    placeholder: '[linkedin url — aidan to add]',
  },
]

/** The three inline links on the homepage. */
export const routes = [
  { label: 'tailor studio', href: '/tailor-studio' },
  { label: 'about', href: '/about' },
  { label: 'resume', href: '/resume' },
] as const
