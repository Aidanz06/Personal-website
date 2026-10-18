import { describe, expect, it } from 'vitest'
import { handPaths } from './hand'

/** The command letters of a path, with the numbers taken out. */
const commands = (d: string) => d.replace(/-?\d+(\.\d+)?/g, '#')

describe('the food hand', () => {
  it('draws the same shape at every pose, so it can close smoothly', () => {
    const fist = handPaths(0)
    const open = handPaths(1)
    for (const t of [0.25, 0.5, 0.75]) {
      const mid = handPaths(t)
      mid.fingers.forEach((finger, i) => expect(commands(finger.d)).toBe(commands(fist.fingers[i]!.d)))
      expect(commands(mid.thumb.d)).toBe(commands(open.thumb.d))
      expect(commands(mid.backFill.d)).toBe(commands(open.backFill.d))
    }
  })

  it('has four fingers that are longer open than closed', () => {
    const tipY = (d: string) => Math.max(...(d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number).filter((_, i) => i % 2 === 1))
    const fist = handPaths(0)
    const open = handPaths(1)
    expect(open.fingers).toHaveLength(4)
    open.fingers.forEach((finger, i) => expect(tipY(finger.d)).toBeGreaterThan(tipY(fist.fingers[i]!.d)))
  })

  it('shows the pellet only while holding it', () => {
    expect(handPaths(0).pellet).toBe(1)
    expect(handPaths(1).pellet).toBe(0)
  })

  it('never produces a broken number', () => {
    for (const t of [-1, 0, 0.5, 1, 2]) {
      const { fingers, thumb, backFill } = handPaths(t)
      for (const d of [...fingers.map((f) => f.d), thumb.d, backFill.d]) expect(d).not.toMatch(/NaN|Infinity/)
    }
  })
})
