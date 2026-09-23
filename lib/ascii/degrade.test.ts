import { describe, expect, it } from 'vitest'
import {
  DEGRADE_BELOW_FPS,
  SUSTAINED_SLOW_FRAMES,
  stepDegradation,
  type DegradeState,
} from './degrade'
import { MAX_CELL_SIZE, MIN_ACCEPTABLE_FPS } from './constants'

const start = (): DegradeState => ({ slowFrames: 0, cellSize: 9 })

/** Run `frames` frames at a steady rate and report the final state. */
function run(state: DegradeState, fps: number, frames: number) {
  let current = state
  let coarsenings = 0
  for (let i = 0; i < frames; i++) {
    const next = stepDegradation(current, fps, MAX_CELL_SIZE)
    if (next.coarsened) coarsenings++
    current = { slowFrames: next.slowFrames, cellSize: next.cellSize }
  }
  return { ...current, coarsenings }
}

describe('stepDegradation — the trigger threshold', () => {
  it('never coarsens on a display running at exactly the target frame rate', () => {
    // The regression this function exists for. 30fps is the PRD's acceptable
    // floor, not a failure, and degradation is one-way — so triggering at the
    // boundary ratchets quality down permanently on a 30Hz display for no
    // reason. The trigger needs margin below the target.
    const result = run(start(), MIN_ACCEPTABLE_FPS, 600)
    expect(result.coarsenings).toBe(0)
    expect(result.cellSize).toBe(9)
  })

  it('never coarsens when the frame rate jitters either side of the target', () => {
    // A smoothed fps estimate hovering around 30 dips below it constantly.
    let state = start()
    let coarsenings = 0
    for (let i = 0; i < 600; i++) {
      const fps = MIN_ACCEPTABLE_FPS + (i % 2 === 0 ? 0.6 : -0.6)
      const next = stepDegradation(state, fps, MAX_CELL_SIZE)
      if (next.coarsened) coarsenings++
      state = { slowFrames: next.slowFrames, cellSize: next.cellSize }
    }
    expect(coarsenings).toBe(0)
    expect(state.cellSize).toBe(9)
  })

  it('leaves a comfortable frame rate completely alone', () => {
    expect(run(start(), 60, 600).cellSize).toBe(9)
    expect(run(start(), 120, 600).cellSize).toBe(9)
  })
})

describe('stepDegradation — genuine slowness', () => {
  it('coarsens once the frame rate is sustainedly below the trigger', () => {
    const result = run(start(), 15, SUSTAINED_SLOW_FRAMES)
    expect(result.coarsenings).toBe(1)
    expect(result.cellSize).toBeGreaterThan(9)
  })

  it('requires the slowness to be sustained, not a single hitch', () => {
    const result = run(start(), 15, SUSTAINED_SLOW_FRAMES - 1)
    expect(result.coarsenings).toBe(0)
    expect(result.cellSize).toBe(9)
  })

  it('forgives an isolated slow frame among fast ones', () => {
    let state = start()
    let coarsenings = 0
    for (let i = 0; i < 1000; i++) {
      const fps = i % 50 === 0 ? 5 : 60 // one bad frame in every fifty
      const next = stepDegradation(state, fps, MAX_CELL_SIZE)
      if (next.coarsened) coarsenings++
      state = { slowFrames: next.slowFrames, cellSize: next.cellSize }
    }
    expect(coarsenings).toBe(0)
  })

  it('keeps coarsening while the page stays slow, but stops at the ceiling', () => {
    const result = run(start(), 5, SUSTAINED_SLOW_FRAMES * 40)
    expect(result.cellSize).toBe(MAX_CELL_SIZE)
  })

  it('never exceeds the ceiling', () => {
    const result = run({ slowFrames: 0, cellSize: MAX_CELL_SIZE }, 1, 5000)
    expect(result.cellSize).toBe(MAX_CELL_SIZE)
    expect(result.coarsenings).toBe(0)
  })

  it('always makes the cell strictly bigger when it coarsens', () => {
    // A rounding scheme that produced the same size would loop forever.
    for (let size = 3; size < MAX_CELL_SIZE; size++) {
      const state = { slowFrames: SUSTAINED_SLOW_FRAMES - 1, cellSize: size }
      const next = stepDegradation(state, 5, MAX_CELL_SIZE)
      expect(next.coarsened).toBe(true)
      expect(next.cellSize).toBeGreaterThan(size)
    }
  })
})

describe('stepDegradation — bad input', () => {
  it('does not coarsen on a non-finite frame rate', () => {
    // performance timing can hand back NaN around tab switches.
    expect(run(start(), NaN, 1000).cellSize).toBe(9)
  })

  it('treats the trigger as strictly below, never equal', () => {
    expect(run(start(), DEGRADE_BELOW_FPS, 1000).coarsenings).toBe(0)
    expect(run(start(), DEGRADE_BELOW_FPS - 1, SUSTAINED_SLOW_FRAMES).coarsenings).toBe(1)
  })
})
