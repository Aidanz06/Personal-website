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

/** Footer contact links. Labels are final; hrefs are placeholders. */
export const contacts = [
  { label: 'email', href: 'mailto:[email — aidan to confirm]' },
  { label: 'github', href: '[github url — aidan to add]' },
  { label: 'linkedin', href: '[linkedin url — aidan to add]' },
] as const

/** The three inline links on the homepage. */
export const routes = [
  { label: 'tailor studio', href: '/tailor-studio' },
  { label: 'about', href: '/about' },
  { label: 'resume', href: '/resume' },
] as const
