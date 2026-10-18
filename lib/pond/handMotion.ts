/**
 * When the food hand does what: reaching into the bucket, carrying, letting
 * go over the water, or putting the food back.
 *
 * A pose is a pure function of the phase, the time since it began and the
 * pointer, so FoodBucket only has to ask for one each frame and draw it, and
 * the timings can be tested without a browser. The pose is where the hand
 * is heading; FoodBucket follows it on a spring, which is what gives the
 * hand its weight, and swings it from the wrist as it goes.
 *
 * Positions are of the fingertips. While carrying, they ride HOVER_PX above
 * the pointer, so the food has a little way to fall to the spot clicked.
 */

/** The hand's width on screen, in CSS pixels. */
export const HAND_WIDTH = 52
/** How high the fingertips carry the food above where it will land. */
export const HOVER_PX = 22

/** Reaching in, closing round a pellet, lifting it out and coming to the pointer. */
export const HAND_GRAB_MS = 820
/** Opening, the food falling, and the hand drawing away. After any glide. */
export const HAND_RELEASE_MS = 720
/** Taking the food back to the bucket and letting go of it there. */
export const HAND_RETURN_MS = 700

export type Point = { x: number; y: number }

export type HandMotion = {
  phase: 'idle' | 'grabbing' | 'holding' | 'releasing' | 'returning'
  /** performance.now() when the phase began. */
  startedAt: number
  /** Where the fingertips were when it began, for a glide. */
  from: Point | null
  /** Where the food goes: the water tapped, or for the keyboard, beside the bucket. */
  to: Point | null
  /** The middle of the bucket's rim, on screen. */
  mouth: Point | null
  /** The rim's front edge, on screen: below it, the hand is in the bucket. */
  rimFront: number | null
}

export type HandPose = {
  /** Where the fingertips are heading. */
  x: number
  y: number
  /** 0 a fist, 1 open. */
  open: number
  opacity: number
  /** Degrees, added to the swing: a flick of the wrist as it lets go. */
  twist: number
  /** Below this screen y the hand is inside the bucket and hidden. */
  cut: number | null
  /** How far the dropped pellet has fallen, 0 to 1, or null if none is falling. */
  fall: number | null
  /** How far the bucket is pushed down by the hand reaching in, in pixels. */
  bucketDip: number
  /** The food has reached the water: drop it in the pond now. */
  feed: boolean
  /** The pointer's own cursor can come back. */
  cursorBack: boolean
  done: boolean
}

const clamp01 = (t: number) => Math.max(0, Math.min(1, t))
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const progress = (elapsed: number, start: number, end: number) => clamp01((elapsed - start) / (end - start))
const inOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const out = (t: number) => 1 - Math.pow(1 - t, 3)
/** Eased progress through [start, end]. */
const span = (elapsed: number, start: number, end: number, ease = inOut) => ease(progress(elapsed, start, end))
/** Up and back down again over [start, end]. */
const bump = (elapsed: number, start: number, end: number) => Math.sin(Math.PI * progress(elapsed, start, end))

/** How long the hand takes to glide from where it is to the water tapped. */
export function glideMs(from: Point | null, to: Point | null): number {
  if (!from || !to) return 0
  const distance = Math.hypot(to.x - from.x, to.y - from.y)
  if (distance < 4) return 0
  return Math.max(260, Math.min(560, 200 + distance * 0.5))
}

/** Where the fingertips carry the food to land at `p`. */
export const carrying = (p: Point): Point => ({ x: p.x, y: p.y - HOVER_PX })

/** How deep into the bucket the fingertips go, and how high they come out. */
const REACH_IN = 10
const ABOVE_RIM = 18

export function handPose(motion: HandMotion, now: number, pointer: Point): HandPose {
  const elapsed = now - motion.startedAt
  const held = carrying(pointer)
  const rest: HandPose = {
    ...held,
    open: 0,
    opacity: 1,
    twist: 0,
    cut: null,
    fall: null,
    bucketDip: 0,
    feed: false,
    cursorBack: false,
    done: false,
  }

  switch (motion.phase) {
    case 'idle':
      return { ...rest, opacity: 0, open: 1, cursorBack: true, done: true }

    case 'grabbing': {
      const mouth = motion.mouth ?? held
      // Comes down into the bucket, slowing as it goes in.
      const down = span(elapsed, 0, 300, out)
      // Lifts straight up and out, then comes over to the pointer.
      const up = span(elapsed, 470, 640)
      const over = span(elapsed, 600, HAND_GRAB_MS)
      const inBucket = lerp(lerp(mouth.y - 30, mouth.y + REACH_IN, down), mouth.y - ABOVE_RIM, up)
      return {
        ...rest,
        x: lerp(mouth.x, held.x, over),
        y: lerp(inBucket, held.y, over),
        opacity: span(elapsed, 0, 160),
        // The fingers close once they are in among the food.
        open: 1 - span(elapsed, 210, 470),
        cut: elapsed < 640 ? motion.rimFront : null,
        // The bucket gives a little under the hand, and bobs back.
        bucketDip: 3 * bump(elapsed, 200, 760),
        done: elapsed >= HAND_GRAB_MS,
      }
    }

    case 'holding':
      return rest

    case 'releasing': {
      const target = carrying(motion.to ?? pointer)
      const from = motion.from ?? target
      const glide = glideMs(motion.from, target)
      const g = span(elapsed, 0, Math.max(1, glide))
      const after = elapsed - glide
      const away = span(after, 360, HAND_RELEASE_MS)
      return {
        ...rest,
        x: lerp(from.x, target.x, g),
        y: lerp(from.y, target.y, g) - 16 * away,
        open: span(after, 0, 240),
        // A small flick of the wrist as it lets go.
        twist: -5 * bump(after, 0, 320),
        fall: after >= 40 && after < 320 ? progress(after, 40, 300) : null,
        feed: after >= 300,
        cursorBack: after >= 300,
        opacity: 1 - away,
        done: after >= HAND_RELEASE_MS,
      }
    }

    case 'returning': {
      // Back over to the bucket, in, open, and away.
      const mouth = motion.mouth
      if (!mouth) {
        return {
          ...rest,
          open: span(elapsed, 0, 220),
          opacity: 1 - span(elapsed, 80, 320),
          cursorBack: true,
          done: elapsed >= 320,
        }
      }
      const from = motion.from ?? held
      const over = span(elapsed, 0, 300)
      const away = span(elapsed, 440, HAND_RETURN_MS)
      return {
        ...rest,
        x: lerp(from.x, mouth.x, over),
        y: lerp(from.y, mouth.y + 4, over) - 24 * away,
        open: span(elapsed, 260, 460),
        opacity: 1 - away,
        // Only once it is over the bucket: on the way there it may pass
        // lower down the screen than the rim.
        cut: elapsed >= 240 ? motion.rimFront : null,
        bucketDip: 2 * bump(elapsed, 240, 600),
        cursorBack: true,
        done: elapsed >= HAND_RETURN_MS,
      }
    }
  }
}
