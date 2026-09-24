import { describe, expect, it } from 'vitest'
import { escapeHtml, listeningFallbackMarkup } from './fallback.ts'
import type { Pebble } from './types.ts'

const pebbles: Pebble[] = [
  { title: 'Idioteque', artist: 'Radiohead', playcount: 40, rank: 1, size: 1, cover: '' },
  { title: 'Hidden Place', artist: 'Björk', playcount: 20, rank: 2, size: 0.7, cover: '' },
]

const content = { pebbles }

describe('escapeHtml', () => {
  it('escapes what would otherwise become markup', () => {
    expect(escapeHtml('<b>&"')).toBe('&lt;b&gt;&amp;&quot;')
  })
})

describe('listeningFallbackMarkup', () => {
  const markup = listeningFallbackMarkup(content)

  it('lists every track, with the artist', () => {
    for (const title of ['Idioteque', 'Hidden Place']) expect(markup).toContain(title)
    for (const artist of ['Radiohead', 'Björk']) {
      expect(markup).toContain(artist)
    }
  })

  it('keeps the ranking', () => {
    expect(markup).toContain('>01<')
    expect(markup).toContain('>02<')
  })

  it('hides the rock layer and collapses the pond', () => {
    // Without a script the canvas never draws, so a pond seven screens deep
    // is seven screens of nothing.
    expect(markup).toContain('.listening-rocks{display:none!important}')
    expect(markup).toContain('.listening-pond{min-height:0!important}')
  })

  it('escapes a title that would otherwise become markup', () => {
    const nasty = listeningFallbackMarkup({
      ...content,
      pebbles: [{ ...pebbles[0]!, title: '<script>alert(1)</script>' }],
    })
    expect(nasty).not.toContain('<script>alert(1)')
    expect(nasty).toContain('&lt;script&gt;')
  })

  it('is still valid with nothing at all to list', () => {
    const empty = listeningFallbackMarkup({ pebbles: [] })
    expect(empty).toContain('<style>')
    expect(empty).not.toContain('<ol')
  })
})
