import { describe, expect, it } from 'vitest'
import { activeRock, initialRockSelection, rockSelection } from './rockSelection'

const tapOn = (i: number) => [
  // What a phone sends for one tap: the pointer "enters", the button takes
  // focus, then the click.
  { type: 'enter', index: i },
  { type: 'focus', index: i },
  { type: 'click', index: i },
] as const

function run(events: readonly Parameters<typeof rockSelection>[1][]) {
  return events.reduce(rockSelection, initialRockSelection)
}

describe('rockSelection on a phone', () => {
  it('opens on the first tap', () => {
    expect(activeRock(run([...tapOn(0)]))).toBe(0)
  })

  it('closes on a second tap of the same rock', () => {
    // The bug: the second tap unpinned it, but the focus the first tap left
    // behind still counted as hovering, so the picture stayed open while
    // aria-pressed said false.
    const state = run([...tapOn(0), ...tapOn(0)])
    expect(activeRock(state)).toBeNull()
    expect(state.pinned).toBeNull()
  })

  it('moves to another rock when a different one is tapped', () => {
    expect(activeRock(run([...tapOn(0), { type: 'blur', index: 0 }, { type: 'leave', index: 0 }, ...tapOn(2)]))).toBe(2)
  })

  it('opens again on a third tap', () => {
    expect(activeRock(run([...tapOn(0), ...tapOn(0), ...tapOn(0)]))).toBe(0)
  })
})

describe('rockSelection with a mouse and keyboard', () => {
  it('opens on hover and closes when the pointer leaves', () => {
    expect(activeRock(run([{ type: 'enter', index: 1 }]))).toBe(1)
    expect(activeRock(run([{ type: 'enter', index: 1 }, { type: 'leave', index: 1 }]))).toBeNull()
  })

  it('stays open after the pointer leaves once clicked', () => {
    expect(activeRock(run([{ type: 'enter', index: 1 }, { type: 'click', index: 1 }, { type: 'leave', index: 1 }]))).toBe(1)
  })

  it('opens on focus, so the keyboard path matches the pointer one', () => {
    expect(activeRock(run([{ type: 'focus', index: 3 }]))).toBe(3)
  })

  it('closes a pinned rock with a second click, even while still hovered', () => {
    expect(activeRock(run([{ type: 'enter', index: 1 }, { type: 'click', index: 1 }, { type: 'click', index: 1 }]))).toBeNull()
  })

  it('closes whatever is open on Escape', () => {
    expect(activeRock(run([{ type: 'focus', index: 1 }, { type: 'click', index: 1 }, { type: 'escape' }]))).toBeNull()
  })

  it('ignores a leave or blur from a rock that is not the one showing', () => {
    expect(activeRock(run([{ type: 'enter', index: 1 }, { type: 'leave', index: 4 }]))).toBe(1)
  })

  it('reports pinned only while pinned, so aria-pressed tells the truth', () => {
    const state = run([...tapOn(0), ...tapOn(0)])
    expect(state.pinned === 0).toBe(false)
    expect(activeRock(state) === 0).toBe(false)
  })
})

describe('rockSelection: letting go of a pinned rock', () => {
  it('closes a pinned rock when the visitor clicks or taps the water', () => {
    // The reported bug: hover opens a photo, a natural click pins it, and
    // after that nothing but clicking that same rock again would close it —
    // moving away didn't, and neither did clicking anywhere else.
    const pinned = run([{ type: 'enter', index: 2 }, { type: 'click', index: 2 }, { type: 'leave', index: 2 }])
    expect(activeRock(pinned)).toBe(2)
    expect(activeRock(rockSelection(pinned, { type: 'dismiss' }))).toBeNull()
  })

  it('closes when its rock scrolls out of view, so no picture is left behind', () => {
    const pinned = run([...tapOn(4)])
    expect(activeRock(rockSelection(pinned, { type: 'dismiss' }))).toBeNull()
  })

  it('leaves a merely hovered rock to the pointer', () => {
    // Dismiss is for pins. A rock the pointer is still over stays open.
    const hovered = run([{ type: 'enter', index: 1 }])
    expect(activeRock(rockSelection(hovered, { type: 'dismiss' }))).toBe(1)
  })
})
