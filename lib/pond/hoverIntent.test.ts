import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { hoverIsIntended, hoverTracker } from './hoverIntent'

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

describe('hoverTracker', () => {
  it('opens on an intended enter, and moving over it does not open it again', () => {
    const tracker = hoverTracker({ lastPointerMove: 1000, lastScroll: 400 })
    expect(tracker.enter(3)).toBe(true)
    // A click or Esc closed it here; the pointer is still resting on it.
    expect(tracker.move(3)).toBe(false)
  })

  it('opens on the first move after an enter a scroll turned away, once', () => {
    const times = { lastPointerMove: 400, lastScroll: 1000 }
    const tracker = hoverTracker(times)
    expect(tracker.enter(3)).toBe(false)
    expect(tracker.move(3)).toBe(false)
    times.lastPointerMove = 1200
    expect(tracker.move(3)).toBe(true)
    expect(tracker.move(3)).toBe(false)
  })

  it('does not open from moves over a rock other than the one turned away', () => {
    const times = { lastPointerMove: 400, lastScroll: 1000 }
    const tracker = hoverTracker(times)
    tracker.enter(3)
    times.lastPointerMove = 1200
    expect(tracker.move(5)).toBe(false)
  })

  it('forgets a turned-away rock once the pointer leaves it', () => {
    const times = { lastPointerMove: 400, lastScroll: 1000 }
    const tracker = hoverTracker(times)
    tracker.enter(3)
    tracker.leave(3)
    times.lastPointerMove = 1200
    expect(tracker.move(3)).toBe(false)
  })
})

describe('the pages use it', () => {
  for (const file of ['components/PondHome.tsx', 'components/ListeningPond.tsx']) {
    it(`${file} checks intent before a hover opens a picture`, () => {
      const source = readFileSync(join(process.cwd(), file), 'utf8')
      expect(source).toMatch(/onMouseEnter=\{\(\) => hover\.enter\(index\) && select\(\{ type: 'enter', index \}\)\}/)
      expect(source).toMatch(/onMouseMove=\{\(\) => hover\.move\(index\) && select\(\{ type: 'enter', index \}\)\}/)
      expect(source).toMatch(/hover\.leave\(index\)/)
    })
  }
})
