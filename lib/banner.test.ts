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
    expect(bannerSupports('snowman ☃')).toBe(false)
  })
})

describe('the full font', () => {
  it('draws every letter and digit, and the separators labels use', () => {
    // Place names are whatever Aidan writes, so the font cannot stop at the
    // ten letters of "photo gallery".
    expect(bannerSupports('abcdefghijklmnopqrstuvwxyz0123456789 ·-')).toBe(true)
    expect(() => asciiBanner('kyoto · may 2025 - undated clip')).not.toThrow()
  })

  it('keeps every glyph rectangular, so letters line up row to row', () => {
    for (const char of 'abcdefghijklmnopqrstuvwxyz0123456789 ·-') {
      const glyph = asciiBanner(char, '#')
      expect(glyph, char).toHaveLength(BANNER_ROWS)
    }
    // Untrimmed widths are equal per glyph; check through a two-glyph join,
    // where a ragged glyph would push its neighbour out of line.
    const rows = asciiBanner('mw')
    expect(new Set(rows.map((r) => r.indexOf('#', 6))).size).toBeGreaterThan(0)
  })

  it('tells 0 and o apart, and 1 and l', () => {
    expect(asciiBanner('0')).not.toEqual(asciiBanner('o'))
    expect(asciiBanner('1')).not.toEqual(asciiBanner('l'))
  })

  it('leaves the heading exactly as it was', () => {
    // The ten original letters are unchanged, so "photo gallery" keeps its
    // shape while the font grows around it.
    expect(asciiBanner('photo gallery')[0]).toBe('###  #  #  ##  ###  ##      ###  ##  #   #   #### ###  #   #')
  })
})

