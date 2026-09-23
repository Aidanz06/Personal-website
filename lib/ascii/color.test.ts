import { describe, expect, it } from 'vitest'
import { parseCssColor } from './color'
import { orientRamp, rampChar } from './ramp'
import { luminance } from './luminance'
import { DEFAULT_RAMP } from './constants'

describe('parseCssColor', () => {
  it('reads six-digit hex', () => {
    expect(parseCssColor('#0b100f')).toEqual([11, 16, 15])
    expect(parseCssColor('#FAFAF8')).toEqual([250, 250, 248])
  })

  it('reads shorthand hex', () => {
    expect(parseCssColor('#fff')).toEqual([255, 255, 255])
    expect(parseCssColor('#0a0')).toEqual([0, 170, 0])
  })

  it('reads both rgb() syntaxes, which is what getComputedStyle returns', () => {
    expect(parseCssColor('rgb(11, 16, 15)')).toEqual([11, 16, 15])
    expect(parseCssColor('rgb(11 16 15)')).toEqual([11, 16, 15])
    expect(parseCssColor('rgba(11, 16, 15, 0.5)')).toEqual([11, 16, 15])
    expect(parseCssColor('rgb(11 16 15 / 50%)')).toEqual([11, 16, 15])
  })

  it('reads color(srgb ...), which is what color-mix() computes to', () => {
    // Chrome returns this form for any value derived from color-mix — which
    // includes --color-muted, and could include a themed water colour. The
    // channels are 0-1 floats here, not 0-255.
    expect(parseCssColor('color(srgb 0.528431 0.526471 0.503137)')).toEqual([135, 134, 128])
    expect(parseCssColor('color(srgb 0 0 0)')).toEqual([0, 0, 0])
    expect(parseCssColor('color(srgb 1 1 1)')).toEqual([255, 255, 255])
    expect(parseCssColor('color(srgb 0.5 0.5 0.5 / 0.4)')).toEqual([128, 128, 128])
  })

  it('refuses colour spaces it cannot convert, rather than guessing', () => {
    // Treating display-p3 channels as srgb would silently shift every colour.
    expect(parseCssColor('color(display-p3 0.5 0.2 0.1)')).toBeNull()
  })

  it('tolerates surrounding whitespace and casing', () => {
    expect(parseCssColor('  #0B100F  ')).toEqual([11, 16, 15])
  })

  it('returns null rather than NaN for anything it cannot read', () => {
    // The caller falls back to a known colour; painting with NaN would
    // silently produce an invisible canvas.
    for (const bad of ['', '   ', 'var(--t-ground)', 'transparent', 'oklch(0.2 0 0)', '#12345']) {
      expect(parseCssColor(bad)).toBeNull()
    }
  })
})

describe('orientRamp', () => {
  const darkGround = luminance(11, 16, 15) // koi theme
  const lightInk = luminance(236, 231, 221)
  const lightGround = luminance(250, 250, 248) // paper theme
  const darkInk = luminance(26, 26, 26)

  it('leaves the ramp alone for dark ink on a light ground', () => {
    expect(orientRamp(DEFAULT_RAMP, lightGround, darkInk)).toBe(DEFAULT_RAMP)
  })

  it('reverses the ramp for light ink on a dark ground', () => {
    expect(orientRamp(DEFAULT_RAMP, darkGround, lightInk)).toBe('@%#*+=-:.')
  })

  it('keeps dark pixels reading dark in BOTH orientations', () => {
    // The property that actually matters. On paper a dark pixel gets a dense
    // glyph because dense means more dark ink; on koi it gets a sparse glyph
    // because dense would mean more light. Either way the picture is not a
    // negative.
    const onPaper = orientRamp(DEFAULT_RAMP, lightGround, darkInk)
    const onKoi = orientRamp(DEFAULT_RAMP, darkGround, lightInk)

    expect(rampChar(0, onPaper)).toBe('@') // darkest pixel -> most ink
    expect(rampChar(1, onPaper)).toBe('.') // brightest -> least ink

    expect(rampChar(0, onKoi)).toBe('.') // darkest pixel -> least light
    expect(rampChar(1, onKoi)).toBe('@') // brightest -> most light
  })

  it('is its own inverse', () => {
    const flipped = orientRamp(DEFAULT_RAMP, darkGround, lightInk)
    expect(orientRamp(flipped, darkGround, lightInk)).toBe(DEFAULT_RAMP)
  })

  it('does not flip when ink and ground are equally bright', () => {
    expect(orientRamp(DEFAULT_RAMP, 0.5, 0.5)).toBe(DEFAULT_RAMP)
  })

  it('handles an empty ramp', () => {
    expect(orientRamp('', 0, 1)).toBe('')
  })
})
