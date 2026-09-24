import { describe, expect, it } from 'vitest'
import { BUBBLE_GLYPHS, bubbleField } from './bubbles'

describe('bubbleField', () => {
  const field = bubbleField()

  it('is a handful of bubbles, not a fizz', () => {
    expect(field.length).toBeGreaterThanOrEqual(6)
    expect(field.length).toBeLessThanOrEqual(12)
  })

  it('is the same on every visit, so the page never reshuffles', () => {
    expect(bubbleField()).toEqual(field)
  })

  it('keeps every bubble well inside the column, clear of the edges', () => {
    for (const bubble of field) {
      expect(bubble.xFraction).toBeGreaterThan(0.1)
      expect(bubble.xFraction).toBeLessThan(0.9)
    }
  })

  it('draws them from the bubble glyphs only', () => {
    for (const bubble of field) expect(BUBBLE_GLYPHS).toContain(bubble.glyph)
  })

  it('rises slowly, and never all at once', () => {
    for (const bubble of field) {
      expect(bubble.duration).toBeGreaterThanOrEqual(5)
      expect(bubble.duration).toBeLessThanOrEqual(9)
    }
    // Staggered starts: a burst that all rises together reads as a glitch.
    const delays = new Set(field.map((b) => b.delay.toFixed(2)))
    expect(delays.size).toBe(field.length)
  })

  it('sways a little, both ways', () => {
    const sways = field.map((b) => b.sway)
    expect(Math.max(...sways.map(Math.abs))).toBeLessThanOrEqual(16)
    expect(sways.some((s) => s > 0) && sways.some((s) => s < 0)).toBe(true)
  })

  it('varies in size, so the smaller ones read as further away', () => {
    expect(new Set(field.map((b) => b.size)).size).toBeGreaterThan(1)
  })
})
