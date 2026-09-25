import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { hoverIsIntended } from './hoverIntent'

/**
 * A mouse resting still while the page scrolls under it "enters" every rock
 * that passes beneath, and each one opened its picture mid-descent (critique
 * of 2026-09-24, third run, on a trackpad). A hover counts only when the
 * pointer itself has moved since the page last scrolled.
 */

describe('hoverIsIntended', () => {
  it('counts a hover the pointer moved into', () => {
    expect(hoverIsIntended({ lastPointerMove: 1000, lastScroll: 400 })).toBe(true)
  })

  it('ignores a rock that scrolled under a still pointer', () => {
    expect(hoverIsIntended({ lastPointerMove: 400, lastScroll: 1000 })).toBe(false)
  })

  it('counts a hover before anything has scrolled', () => {
    expect(hoverIsIntended({ lastPointerMove: 0, lastScroll: 0 })).toBe(true)
  })
})

describe('the pages use it', () => {
  for (const file of ['components/PondHome.tsx', 'components/ListeningPond.tsx']) {
    it(`${file} checks intent before a hover opens a picture`, () => {
      const source = readFileSync(join(process.cwd(), file), 'utf8')
      expect(source).toMatch(/onMouseEnter=\{\(\) => hoverIntended\(\) && select\(\{ type: 'enter', index \}\)\}/)
    })
  }
})
