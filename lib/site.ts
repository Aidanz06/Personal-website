/**
 * Single source of truth for strings that appear on more than one page.
 *
 * Anything still unwritten is a visible bracketed placeholder rather than a
 * plausible-looking fake, so an unfinished page is obvious at a glance
 * instead of shipping as filler.
 */

export const site = {
  name: 'aidan zheng',
  // The live domain. The apex, aidanzheng.me, 308-redirects here, so www is
  // the address canonical links, the sitemap and link previews use.
  url: 'https://www.aidanzheng.me',
  // The homepage opens as one sentence across two lines: the greeting is the
  // <h1>, so it still carries the name, and the identity finishes it.
  // A non-breaking space inside the name: on a phone the line has to wrap,
  // and "hi, i'm / aidan zheng," reads; "hi, i'm aidan / zheng," splits a name.
  greeting: "hi, i'm aidan\u00a0zheng,",
  identity: 'a third year student at northeastern',
  description:
    'aidan zheng — a personal site: what i make, what i shoot, what i listen to.',
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

// Email only: Aidan chose not to list github or linkedin.
export const contacts: readonly Contact[] = [
  { label: 'email', href: 'mailto:zheng.ai@northeastern.edu', placeholder: '' },
]
