import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { menuSide } from './themeMenu'

/**
 * The theme menu on a phone. Critique of 2026-09-24 (third run), reproduced
 * at 375×667 with touch emulation.
 */

describe('which side the theme menu opens on', () => {
  it('opens rightward when there is room, as beside the name on a desktop', () => {
    expect(menuSide({ left: 700, right: 716 }, 1280)).toBe('left')
  })

  it('opens leftward when rightward would run off the screen', () => {
    // A phone: the greeting wraps and ◐ ends up at x≈350 of 375. Opening
    // rightward put the labels off-screen and widened the page to 452px.
    expect(menuSide({ left: 343, right: 357 }, 375)).toBe('right')
  })
})

describe('opening the theme menu', () => {
  const source = readFileSync(join(process.cwd(), 'components/ThemeMenu.tsx'), 'utf8')

  it('opens on hover only for a mouse, so a tap is one clean toggle', () => {
    // A tap fires the compatibility mouse events too: mouseenter opened the
    // menu, then the click toggled it shut, so on Android the first tap did
    // nothing. Pointer events say which kind of pointer it was.
    expect(source).not.toMatch(/onMouseEnter=/)
    expect(source).toMatch(/pointerType === 'mouse'/)
  })
})
