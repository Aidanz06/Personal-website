import { describe, expect, it } from 'vitest'
import { coverlessCover, escapeXml, wrapText } from './coverless.ts'

describe('wrapText', () => {
  it('breaks at word boundaries', () => {
    expect(wrapText('what is on repeat this month', 12)).toEqual(['what is on', 'repeat this', 'month'])
  })

  it('leaves a short title on one line', () => {
    expect(wrapText('Kid A', 15)).toEqual(['Kid A'])
  })

  it('does not cut a long word in half', () => {
    // "Screamadelica" hyphenated across two lines is worse than slightly too
    // wide; the font size shrinks to fit either way.
    expect(wrapText('Screamadelica', 6)).toEqual(['Screamadelica'])
  })

  it('collapses stray whitespace', () => {
    expect(wrapText('  a   b  ', 15)).toEqual(['a b'])
  })

  it('handles nothing at all', () => {
    expect(wrapText('', 15)).toEqual([])
    expect(wrapText('   ', 15)).toEqual([])
  })
})

describe('escapeXml', () => {
  it('escapes the characters that would break the svg', () => {
    expect(escapeXml('Simon & Garfunkel')).toBe('Simon &amp; Garfunkel')
    expect(escapeXml('<script>')).toBe('&lt;script&gt;')
    expect(escapeXml(`"'`)).toBe('&quot;&apos;')
  })
})

describe('coverlessCover', () => {
  const url = coverlessCover('Kid A', 'Radiohead')
  const svg = decodeURIComponent(url.replace(/^data:image\/svg\+xml;charset=utf-8,/, ''))

  it('is an svg data url, which is same-origin and cannot taint the canvas', () => {
    // The pond reads the pixels of everything it draws; a tainted canvas
    // would cost the ASCII stage and the duotone.
    expect(url.startsWith('data:image/svg+xml')).toBe(true)
  })

  it('draws the album and the artist', () => {
    expect(svg).toContain('Kid A')
    expect(svg).toContain('Radiohead')
  })

  it('is square, like a cover', () => {
    expect(svg).toContain('width="600" height="600"')
  })

  it('is white on black, not a theme colour', () => {
    // The image is reduced to luminance for the characters and duotoned for
    // the final draw, so the theme is applied downstream. Using a theme
    // colour here would apply it twice and flatten the contrast.
    expect(svg).toContain('fill="#000000"')
    expect(svg).toContain('fill="#ffffff"')
  })

  it('shrinks the type for a long title rather than letting it run off', () => {
    const long = coverlessCover(
      'A Very Long Album Title That Tests Wrapping',
      'Testcard Choir',
    )
    const longSvg = decodeURIComponent(long.split(',').slice(1).join(','))
    const sizes = [...longSvg.matchAll(/font-size="(\d+)"/g)].map((m) => Number(m[1]))
    const shortSizes = [...svg.matchAll(/font-size="(\d+)"/g)].map((m) => Number(m[1]))
    expect(Math.max(...sizes)).toBeLessThan(Math.max(...shortSizes))
  })

  it('escapes a title that would otherwise break the markup', () => {
    const tricky = coverlessCover('Rock & Roll', 'A&M')
    const decoded = decodeURIComponent(tricky.split(',').slice(1).join(','))
    expect(decoded).toContain('Rock &amp; Roll')
    expect(decoded).not.toMatch(/&(?!amp;|lt;|gt;|quot;|apos;|#)/)
  })

  it('is deterministic, so the same album gives the same image', () => {
    expect(coverlessCover('Kid A', 'Radiohead')).toBe(coverlessCover('Kid A', 'Radiohead'))
  })

  it('returns nothing when there is nothing to draw', () => {
    // Read by the page as "this rock has no picture", which is a rock that
    // stays a rock rather than one that opens onto nothing.
    expect(coverlessCover('', '')).toBe('')
    expect(coverlessCover('  ', '  ')).toBe('')
  })

  it('still draws an album with no artist, and an artist with no album', () => {
    expect(coverlessCover('Kid A', '')).not.toBe('')
    expect(coverlessCover('', 'Radiohead')).not.toBe('')
  })
})
