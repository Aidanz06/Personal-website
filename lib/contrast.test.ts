import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { THEMES } from './themes'

/**
 * Every theme's colours against its own ground.
 *
 * The rule has always been written in globals.css — body and muted text
 * clear 4.5:1, the koi clear the 3:1 floor for graphics — but only as
 * comments, which is how it nearly broke unnoticed: moving the paper theme to
 * a softer ground took its 62% muted text from passing to 4.17:1. Muted text
 * is a mix of ink into ground, so its contrast depends on BOTH, and changing
 * either one silently moves it.
 *
 * Parses the real stylesheet rather than restating the values, so a new theme
 * is covered the moment it exists.
 */

const css = readFileSync(join(process.cwd(), 'app', 'globals.css'), 'utf8')

function block(id: string): string {
  const pattern = new RegExp(`\\[data-theme='${id}'\\]\\s*\\{([^}]*)\\}`)
  const match = pattern.exec(css)
  if (!match) throw new Error(`no block for theme ${id}`)
  return match[1]!
}

function token(body: string, name: string): string {
  const match = new RegExp(`--t-${name}:\\s*([^;]+);`).exec(body)
  if (!match) throw new Error(`--t-${name} missing`)
  return match[1]!.trim()
}

function rgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number]
}

function luminance([r, g, b]: [number, number, number]): number {
  const lin = (c: number) => {
    const v = c / 255
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

function contrast(a: [number, number, number], b: [number, number, number]): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
  return (hi + 0.05) / (lo + 0.05)
}

/** `color-mix(in srgb, ink P%, ground)`, the way --color-muted is built. */
function mix(ink: [number, number, number], ground: [number, number, number], p: number) {
  return ink.map((c, i) => Math.round(c * p + ground[i]! * (1 - p))) as [number, number, number]
}

describe.each(THEMES.map((theme) => theme.id))('theme %s', (id) => {
  const body = block(id)
  const ground = rgb(token(body, 'ground'))
  const ink = rgb(token(body, 'ink'))

  it('body text clears 4.5:1', () => {
    expect(contrast(ink, ground)).toBeGreaterThanOrEqual(4.5)
  })

  it('muted text clears 4.5:1', () => {
    const p = parseFloat(token(body, 'muted-mix')) / 100
    expect(contrast(mix(ink, ground, p), ground)).toBeGreaterThanOrEqual(4.5)
  })

  it('links clear 4.5:1', () => {
    expect(contrast(rgb(token(body, 'accent')), ground)).toBeGreaterThanOrEqual(4.5)
  })

  it('every koi colour clears the 3:1 floor for graphics', () => {
    for (const n of [1, 2, 3]) {
      expect(contrast(rgb(token(body, `koi-${n}`)), ground), `koi-${n}`).toBeGreaterThanOrEqual(3)
    }
  })
})

describe('the paper theme', () => {
  it('is white and blue, and not glaring', () => {
    const ground = rgb(token(block('paper'), 'ground'))
    // Still plainly white…
    expect(luminance(ground)).toBeGreaterThan(0.75)
    // …but not the near-pure white it was (0.955).
    expect(luminance(ground)).toBeLessThan(0.9)
    // Blue is the largest channel of the ground's cast and of the accent.
    const accent = rgb(token(block('paper'), 'accent'))
    expect(ground[2]).toBeGreaterThan(ground[0])
    expect(accent[2]).toBeGreaterThan(accent[0])
  })
})
