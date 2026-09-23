import { ThemeSwitcher } from '@/components/ThemeSwitcher'
import { contacts } from '@/lib/site'

/**
 * Homepage footer: email, github, linkedin.
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
              <a href={contact.href}>{contact.label}</a>
            ) : (
              <span className="text-muted">{contact.placeholder}</span>
            )}
          </li>
        ))}
      </ul>
      <ThemeSwitcher className="mt-1.5" />
    </footer>
  )
}
