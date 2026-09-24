import { describe, expect, it } from 'vitest'
import { rovingNext } from './roving'

describe('rovingNext', () => {
  it('moves to the next rock on → or ↓, and the previous on ← or ↑', () => {
    expect(rovingNext(3, 'ArrowRight', 25)).toBe(4)
    expect(rovingNext(3, 'ArrowDown', 25)).toBe(4)
    expect(rovingNext(3, 'ArrowLeft', 25)).toBe(2)
    expect(rovingNext(3, 'ArrowUp', 25)).toBe(2)
  })

  it('jumps to the first and last with Home and End', () => {
    expect(rovingNext(7, 'Home', 25)).toBe(0)
    expect(rovingNext(7, 'End', 25)).toBe(24)
  })

  it('stops at the ends rather than wrapping', () => {
    // The gallery is a descent: wrapping from the deepest rock back to the
    // surface would fling the page up eight screens.
    expect(rovingNext(24, 'ArrowDown', 25)).toBe(24)
    expect(rovingNext(0, 'ArrowUp', 25)).toBe(0)
  })

  it('ignores every other key, so Tab, Enter and Space keep their jobs', () => {
    for (const key of ['Tab', 'Enter', ' ', 'Escape', 'a']) {
      expect(rovingNext(3, key, 25)).toBeNull()
    }
  })

  it('does nothing with no rocks', () => {
    expect(rovingNext(0, 'ArrowDown', 0)).toBeNull()
  })
})
