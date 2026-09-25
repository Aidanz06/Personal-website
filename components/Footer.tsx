import { contacts } from '@/lib/site'

/**
 * Contact footer: the links in lib/site.ts (currently email only), at the
 * bottom of /about.
 *
 * Entries without a real destination render as muted text rather than as
 * links, so a placeholder can never be clicked into a dead route.
 */
export function Footer() {
  return (
    <footer className="mt-6 border-t border-rule pt-2">
      <ul className="flex flex-wrap gap-x-2 gap-y-0.5 text-small">
        {contacts.map((contact) => (
          <li key={contact.label}>
            {contact.href ? (
              <a href={contact.href} className="hit-area">
                {contact.label}
              </a>
            ) : (
              <span className="text-muted">{contact.placeholder}</span>
            )}
          </li>
        ))}
      </ul>
    </footer>
  )
}
