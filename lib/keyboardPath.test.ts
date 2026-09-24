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
})
