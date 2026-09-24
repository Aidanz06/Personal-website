import { describe, expect, it } from 'vitest'
import { BANNER_ROWS, asciiBanner, bannerSupports } from './banner'

describe('asciiBanner', () => {
  it('draws every word on the same number of rows', () => {
    expect(asciiBanner('photo')).toHaveLength(BANNER_ROWS)
    expect(asciiBanner('gallery')).toHaveLength(BANNER_ROWS)
  })

  it('fits a phone when stacked, and a laptop on one line', () => {
    // 335px of column at 375, at ~8.4px a character (14px monospace).
    const widest = (lines: string[]) => Math.max(...lines.map((l) => l.length))
    expect(widest(asciiBanner('gallery'))).toBeLessThanOrEqual(38)
    expect(widest(asciiBanner('photo gallery'))).toBeLessThanOrEqual(64)
  })

  it('draws letters people can read: an o is a ring', () => {
    expect(asciiBanner('o')).toEqual([' ##', '#  #', '#  #', '#  #', ' ##'])
  })

  it('draws with whichever character it is given', () => {
    expect(asciiBanner('l', '=').join('')).not.toContain('#')
    expect(asciiBanner('l', '=').join('')).toContain('=')
  })

  it('ignores case', () => {
    expect(asciiBanner('Photo')).toEqual(asciiBanner('photo'))
  })

  it('trims trailing blanks so the art sizes to itself', () => {
    for (const line of asciiBanner('photo gallery')) expect(line).toBe(line.trimEnd())
  })

  it('refuses a letter it cannot draw rather than dropping it', () => {
    // A heading missing a letter is a typo that ships.
    expect(() => asciiBanner('photo!')).toThrow(/!/)
    expect(bannerSupports('photo gallery')).toBe(true)
    expect(bannerSupports('zebra')).toBe(false)
  })
})
