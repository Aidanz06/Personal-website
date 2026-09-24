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
  it('links github, the one destination known so far', () => {
    expect(contacts.find((c) => c.label === 'github')?.href).toBe('https://github.com/Aidanz06')
  })

  it('keeps the unknown ones as placeholders, never guessed', () => {
    for (const label of ['email', 'linkedin']) {
      expect(contacts.find((c) => c.label === label)?.href).toBeNull()
    }
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
