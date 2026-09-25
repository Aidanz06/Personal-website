import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { contacts } from './site'

/**
 * The bottom of the pond: where the homepage ends.
 *
 * It used to end on three bracketed placeholders floating in the middle of
 * the last screen, with more than half a screen of empty water under them
 * and no way back but scrolling the whole descent in reverse.
 */

const home = readFileSync(join(process.cwd(), 'components/PondHome.tsx'), 'utf8')

describe('the pond floor', () => {
  it('links email, and only email', () => {
    // Aidan's call: no github or linkedin on the site.
    expect(contacts.map((c) => c.label)).toEqual(['email'])
    expect(contacts[0]?.href).toBe('mailto:zheng.ai@northeastern.edu')
  })

  it('sits the footer on the bottom of the page, not partway up the last screen', () => {
    expect(home).not.toMatch(/depthVh - 0\.5/)
    expect(home).toMatch(/<footer[\s\S]{0,200}\bbottom-0\b/)
  })

  it('offers a way back to the surface that works without JavaScript', () => {
    expect(home).toMatch(/href="#surface"/)
    expect(home).toMatch(/id="surface"/)
  })
})

describe('the bottom of /about', () => {
  it('ends with the email, so a reader never has to go back to the homepage floor for it', () => {
    // Critique of 2026-09-24 (third run): the inner pages had no contact;
    // Aidan chose an email at the bottom of /about.
    const about = readFileSync(join(process.cwd(), 'app/(page)/about/page.mdx'), 'utf8')
    expect(about.trimEnd()).toMatch(/<Footer \/>$/)
  })
})
