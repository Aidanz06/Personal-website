import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  formatMonthYear,
  isCaptionEmpty,
  missingAltFor,
  resolveCaption,
  type CaptionsFile,
} from './captions'

const data: CaptionsFile = {
  places: {
    '2025-05-22': 'kamakura',
    '2025-05-25': '',
  },
  photos: {
    'website-01.jpg': {
      alt: 'a torii gate half in the sea, low tide.',
      line: 'the tide was further out than the guidebook said.',
      date: '2025-05-22',
      settings: 'f/8 · 1/160 · iso 320',
    },
    'website-02.jpg': { alt: 'a train platform at dusk.', date: '2025-05-25', settings: 'f/2.8 · 1/1000 · iso 800' },
    'website-03.jpg': { alt: '', line: '', date: '', settings: '' },
    'website-04.jpg': { alt: 'no date on this one.', line: 'still worth a line.' },
  },
}

describe('formatMonthYear', () => {
  it('gives month and year, lowercase', () => {
    expect(formatMonthYear('2025-05-22')).toBe('may 2025')
    expect(formatMonthYear('2026-12-01')).toBe('december 2026')
  })

  it('never shows the day or the time', () => {
    // The camera's clock is on the wrong timezone, so the day is not reliably
    // the day the photograph was taken.
    const formatted = formatMonthYear('2025-05-22')
    expect(formatted).not.toContain('22')
    expect(formatted).not.toContain(':')
  })

  it('returns nothing for a blank or unparseable date', () => {
    expect(formatMonthYear('')).toBe('')
    expect(formatMonthYear(undefined)).toBe('')
    expect(formatMonthYear('sometime in may')).toBe('')
    expect(formatMonthYear('2025-13-01')).toBe('')
  })
})

describe('resolveCaption', () => {
  it('resolves the place from the shoot date, not from the photograph', () => {
    const caption = resolveCaption('website-01.jpg', data)
    expect(caption.headline).toBe('kamakura · may 2025')
  })

  it('falls back to the date alone when the place is blank', () => {
    expect(resolveCaption('website-02.jpg', data).headline).toBe('may 2025')
  })

  it('shows the place alone when there is no date', () => {
    const noDate: CaptionsFile = {
      places: { '': 'nowhere' },
      photos: { 'x.jpg': { date: '', alt: 'a' } },
    }
    // A blank date resolves no place either — a place has to hang off a date.
    expect(resolveCaption('x.jpg', noDate).headline).toBe('')
  })

  it('omits blank fields rather than rendering empty brackets', () => {
    const caption = resolveCaption('website-03.jpg', data)
    expect(caption.headline).toBe('')
    expect(caption.line).toBe('')
    expect(caption.settings).toBe('')
    expect(isCaptionEmpty(caption)).toBe(true)
    // Nothing anywhere in it reads as a hole in the page.
    expect(JSON.stringify(caption)).not.toContain('undefined')
    expect(caption.headline).not.toContain('·')
  })

  it('falls back to a visible placeholder when a photograph has no description', () => {
    const caption = resolveCaption('website-03.jpg', data)
    expect(caption.altMissing).toBe(true)
    expect(caption.alt).toBe(missingAltFor('website-03.jpg'))
    expect(caption.alt).toContain('website-03.jpg')
  })

  it('handles a photograph missing from the file entirely', () => {
    const caption = resolveCaption('website-99.jpg', data)
    expect(caption.altMissing).toBe(true)
    expect(caption.headline).toBe('')
    expect(caption.line).toBe('')
    expect(caption.settings).toBe('')
  })

  it('handles an empty captions file', () => {
    const caption = resolveCaption('website-01.jpg', {})
    expect(caption.alt).toContain('aidan to describe')
    expect(isCaptionEmpty(caption)).toBe(true)
  })

  it('keeps a personal line even when there is no date', () => {
    const caption = resolveCaption('website-04.jpg', data)
    expect(caption.line).toBe('still worth a line.')
    expect(caption.headline).toBe('')
  })

  it('builds a description a screen reader can read aloud', () => {
    // The middot separators are a typographic device, not something anyone
    // wants announced as "middle dot".
    const caption = resolveCaption('website-01.jpg', data)
    expect(caption.description).toBe(
      'kamakura, may 2025. the tide was further out than the guidebook said. f/8, 1/160, iso 320',
    )
    expect(caption.description).not.toContain('·')
  })

  it('leaves the description empty when there is nothing to say', () => {
    expect(resolveCaption('website-03.jpg', data).description).toBe('')
  })

  it('treats whitespace-only fields as blank', () => {
    const whitespace: CaptionsFile = {
      places: { '2025-05-22': '   ' },
      photos: { 'x.jpg': { alt: '  ', line: '\t', date: '2025-05-22', settings: ' ' } },
    }
    const caption = resolveCaption('x.jpg', whitespace)
    expect(caption.altMissing).toBe(true)
    expect(caption.headline).toBe('may 2025')
    expect(caption.line).toBe('')
  })
})

describe('the module itself', () => {
  it('imports no node builtins', () => {
    // The homepage is a client component, and a `node:fs` import anywhere in
    // its import graph fails the production build — with a Turbopack panic
    // that names the bundler rather than the import. Reading captions.json is
    // lib/captionsFile.ts, which only the server ever touches.
    const source = readFileSync(join(process.cwd(), 'lib', 'captions.ts'), 'utf8')
    expect(source).not.toMatch(/^\s*import .* from ['"]node:/m)
  })
})
