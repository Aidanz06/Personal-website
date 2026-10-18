import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * The keyboard and screen-reader path through the pond.
 *
 * Found in the critique and the polish pass, measured in headless Chrome:
 *
 * - Tabbing to a stone or rock scrolled only far enough to show its top
 *   edge, so a focused rock could sit half off the bottom of the screen with
 *   its photograph opening out of sight.
 * - The gallery was twenty-five Tab stops between the last stone and the
 *   contact links.
 * - The stones had no landmark, and each link's aria-label replaced its
 *   note, so a screen reader never heard "what's on repeat".
 *
 * These read the components' source, the same way pondFrame.test.ts does:
 * the behaviour lives in markup, and the markup is what has to stay put.
 */

const home = readFileSync(join(process.cwd(), 'components/PondHome.tsx'), 'utf8')
const listening = readFileSync(join(process.cwd(), 'components/ListeningPond.tsx'), 'utf8')

describe('the keyboard path', () => {
  it('wraps the homepage stones in a navigation landmark', () => {
    expect(home).toMatch(/<nav aria-label="pages"[^>]*>[\s\S]*HOME_STONES\.map[\s\S]*<\/nav>/)
  })

  it('lets a screen reader hear each stone note', () => {
    expect(home).toMatch(/aria-describedby=\{spec\.note \? `stone-note-/)
    expect(home).toMatch(/id=\{`stone-note-\$\{index\}`\}/)
  })

  it('makes the gallery a single Tab stop, moved with the arrow keys', () => {
    expect(home).toMatch(/tabIndex=\{index === roving \? 0 : -1\}/)
    expect(home).toMatch(/rovingNext\(/)
  })

  it('scrolls a focused stone or rock fully into view, with room for what it opens', () => {
    // Stones, photo rocks, and the listening rocks.
    expect(home.match(/scroll-my-\[/g)?.length).toBeGreaterThanOrEqual(2)
    expect(listening).toMatch(/scroll-my-\[/)
  })

  it('keeps the focus ring off a picture while it is open', () => {
    // Polish, 2026-09-24: arrowing to a rock opened its photograph, and the
    // square focus ring was drawn on top of the picture, in the middle of it.
    // The open picture, its caption and the arrow-key hint already say which
    // rock has focus; the ring steps aside only while that picture shows.
    expect(home).toMatch(/photoOpen && isActive \? 'focus-visible:outline-transparent'/)
    expect(listening).toMatch(/rectIsCurrent && isActive \? 'focus-visible:outline-transparent'/)
  })

  it('keeps the focus ring until the picture is actually there', () => {
    // Review, 2026-10-17: the ring stepped aside as soon as a rock became
    // active, so while the picture surfaced (up to ~3.5s) nothing showed
    // where keyboard focus was.
    expect(home).not.toMatch(/stepAside && isActive \? 'focus-visible:outline-transparent'/)
  })
})
