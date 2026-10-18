import { describe, expect, it } from 'vitest'
import {
  HAND_GRAB_MS,
  HAND_RELEASE_MS,
  HAND_RETURN_MS,
  HOVER_PX,
  carrying,
  glideMs,
  handPose,
  type HandMotion,
} from './handMotion'

const pointer = { x: 500, y: 300 }
const mouth = { x: 900, y: 420 }
const rimFront = 425
const motion = (phase: HandMotion['phase'], extra: Partial<HandMotion> = {}): HandMotion => ({
  phase,
  startedAt: 1000,
  from: null,
  to: null,
  mouth,
  rimFront,
  ...extra,
})

describe('grabbing food from the bucket', () => {
  const grab = motion('grabbing')

  it('comes down into the bucket open, from above it', () => {
    const first = handPose(grab, 1000, pointer)
    expect(first.open).toBe(1)
    expect(first.opacity).toBe(0)
    expect(first.x).toBe(mouth.x)
    expect(first.y).toBeLessThan(mouth.y)
    // In among the food, and hidden below the rim.
    const deep = handPose(grab, 1000 + 300, pointer)
    expect(deep.y).toBeGreaterThan(rimFront)
    expect(deep.cut).toBe(rimFront)
  })

  it('closes while it is in the bucket, which gives a little under it', () => {
    const closing = handPose(grab, 1000 + 400, pointer)
    expect(closing.open).toBeLessThan(0.5)
    expect(closing.bucketDip).toBeGreaterThan(0)
    expect(handPose(grab, 1000 + 470, pointer).open).toBe(0)
  })

  it('lifts out above the rim before it comes over to the pointer', () => {
    const out = handPose(grab, 1000 + 620, pointer)
    expect(out.y).toBeLessThan(mouth.y)
    const done = handPose(grab, 1000 + HAND_GRAB_MS, pointer)
    expect(done).toMatchObject({ ...carrying(pointer), open: 0, cut: null, done: true })
  })

  it('carries the food a little above the pointer, so it has somewhere to fall', () => {
    const pose = handPose(motion('holding'), 5000, { x: 10, y: 200 })
    expect([pose.x, pose.y, pose.open]).toEqual([10, 200 - HOVER_PX, 0])
  })
})

describe('letting go over the water', () => {
  it('opens, drops the pellet onto the spot, then draws away', () => {
    const to = { x: 500, y: 300 }
    const release = motion('releasing', { from: carrying(to), to })
    const start = handPose(release, 1000, pointer)
    expect(start.feed).toBe(false)
    expect(start.fall).toBeNull()
    const falling = handPose(release, 1000 + 150, pointer)
    expect(falling.fall).toBeGreaterThan(0)
    expect(falling.fall).toBeLessThan(1)
    expect(falling.twist).toBeLessThan(0)
    const landed = handPose(release, 1000 + 300, pointer)
    expect(landed.feed).toBe(true)
    expect(landed.open).toBe(1)
    const gone = handPose(release, 1000 + HAND_RELEASE_MS, pointer)
    expect(gone.opacity).toBe(0)
    expect(gone.y).toBeLessThan(carrying(to).y)
    expect(gone.done).toBe(true)
  })

  it('on a touchscreen, glides to the tap before it opens', () => {
    const from = { x: 300, y: 400 }
    const to = { x: 80, y: 600 }
    const glide = glideMs(from, carrying(to))
    expect(glide).toBeGreaterThan(200)
    const release = motion('releasing', { from, to })
    const halfway = handPose(release, 1000 + glide / 2, pointer)
    expect(halfway.x).toBeLessThan(from.x)
    expect(halfway.x).toBeGreaterThan(to.x)
    expect(halfway.open).toBe(0)
    expect(handPose(release, 1000 + glide, pointer)).toMatchObject(carrying(to))
    expect(handPose(release, 1000 + glide + 300, pointer).feed).toBe(true)
  })

  it('does not glide when the hand is already there', () => {
    expect(glideMs({ x: 1, y: 1 }, { x: 2, y: 2 })).toBe(0)
  })
})

describe('putting it back', () => {
  it('takes the food back to the bucket, lets go there, and gives the cursor back', () => {
    const back = motion('returning', { from: { x: 300, y: 200 } })
    expect(handPose(back, 1000, pointer).cursorBack).toBe(true)
    // Not hidden behind the rim while it is still on the way over.
    expect(handPose(back, 1000 + 100, pointer).cut).toBeNull()
    const there = handPose(back, 1000 + 300, pointer)
    expect(there.x).toBe(mouth.x)
    expect(handPose(back, 1000 + 470, pointer).open).toBe(1)
    expect(handPose(back, 1000 + HAND_RETURN_MS, pointer)).toMatchObject({ opacity: 0, done: true })
  })

  it('with no bucket to go to, just opens and goes', () => {
    const back = motion('returning', { mouth: null, rimFront: null })
    expect(handPose(back, 1000 + 320, pointer)).toMatchObject({ opacity: 0, open: 1, done: true })
  })
})
