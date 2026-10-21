'use client'

import { useEffect, useState } from 'react'
import type { Contact } from '@/lib/site'

/**
 * One footer contact. An email link shows the address itself and copies it
 * on click, as well as opening the mail app.
 *
 * A bare `mailto:` does nothing at all for anyone without a mail app set up,
 * or whose browser has claimed mailto and has no webmail behind it (Arc, by
 * default): the link said "email", and clicking it did nothing. Now the
 * address is on the page to read or select, and a click copies it whatever
 * the mail app does.
 */
export function ContactLink({ contact }: { contact: Contact }) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(timer)
  }, [copied])

  if (!contact.href) return <span className="text-muted">{contact.placeholder}</span>

  const address = contact.href.startsWith('mailto:') ? contact.href.slice('mailto:'.length) : null
  if (!address) {
    return (
      <a href={contact.href} className="hit-area">
        {contact.label}
      </a>
    )
  }

  return (
    <>
      <a
        href={contact.href}
        className="hit-area"
        onClick={() => {
          // The default still runs: whoever has a mail app still gets it.
          navigator.clipboard?.writeText(address).then(
            () => setCopied(true),
            () => {},
          )
        }}
      >
        {address}
      </a>
      <span className="ml-1 text-muted" aria-live="polite">
        {copied ? 'copied' : ''}
      </span>
    </>
  )
}
