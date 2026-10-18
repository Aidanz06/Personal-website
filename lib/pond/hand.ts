/**
 * The hand that carries food from the bucket to the water: an outline drawn
 * in the site's hairline, seen from above with the fingers reaching down.
 *
 * Drawn from numbers rather than stored as two pictures, so it can close
 * smoothly: `handPaths(open)` gives the same commands for every `open` from
 * 0 (a fist round a pellet) to 1 (fingers spread, letting go), and only the
 * numbers move. The fingers shorten as they curl and fan as they open, and
 * the thumb swings in under the first finger.
 *
 * They don't move together. A hand closes from the little finger in, with
 * the thumb last, and opens from the thumb out: `STAGGER` is how far apart,
 * as a share of the whole movement.
 *
 * Every part is filled with the ground colour as well as outlined, so
 * whatever is drawn later hides what is behind it the way a solid hand
 * would: the order is fingers, thumb, the back of the hand.
 *
 * The viewBox is 24 wide by 26 tall, wrist at the top, fingertips toward the
 * bottom. Pure, so it can be tested.
 */

export const HAND_VIEWBOX = '0 0 24 26'
/** The tip of the longest finger, open, in viewBox units: the hand's anchor. */
export const HAND_FINGERTIPS_Y = 23.4

/** Half the width of a finger. */
const R = 1.75
/** Where the fingers leave the back of the hand. */
const KNUCKLES = 12

type Finger = { x: number; open: number; closed: number; fan: number }
// Index (beside the thumb) to little finger. The open lengths make a gentle
// arc, like a real hand; closed, they are the curled knuckles of a fist.
const FINGERS: readonly Finger[] = [
  { x: 7.75, open: 21.6, closed: 15.6, fan: 7 },
  { x: 11.25, open: 23.4, closed: 16.3, fan: 2.5 },
  { x: 14.75, open: 23, closed: 16.1, fan: -2.5 },
  { x: 18.25, open: 20.8, closed: 15.2, fan: -8 },
]

/** How far apart the fingers move, as a share of the whole closing. */
const STAGGER = 0.45

const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const smooth = (t: number) => t * t * (3 - 2 * t)

/**
 * How open one part is when the whole hand is `t` open. `order` runs from 0
 * (the thumb, first to open and last to close) to 1 (the little finger).
 * Everything is 0 at a fist and 1 fully open; only the in-between differs.
 */
function partOpen(t: number, order: number): number {
  return smooth(Math.max(0, Math.min(1, t * (1 + STAGGER) - STAGGER * order)))
}
const n = (value: number) => Number(value.toFixed(2))
type Point = { x: number; y: number }
const at = (p: Point) => `${n(p.x)} ${n(p.y)}`

export type Shape = { d: string; transform?: string }

export type HandPaths = {
  fingers: Shape[]
  thumb: Shape
  /** The back of the hand: filled closed, outlined only where it shows. */
  backFill: Shape
  backLine: Shape
  /** How visible the pellet held in the fist is: 1 closed, 0 open. */
  pellet: number
}

export function handPaths(open: number): HandPaths {
  const t = Math.max(0, Math.min(1, open))
  // A single cubic is within 0.03% of a semicircle with its controls this
  // far out.
  const k = (4 / 3) * R

  const fingers = FINGERS.map((finger, index) => {
    const f = partOpen(t, 0.25 + index * 0.25)
    const end = lerp(finger.closed, finger.open, f) - R
    const left = finger.x - R
    const right = finger.x + R
    return {
      d: `M ${n(left)} ${KNUCKLES} L ${n(left)} ${n(end)} C ${n(left)} ${n(end + k)} ${n(right)} ${n(end + k)} ${n(right)} ${n(end)} L ${n(right)} ${KNUCKLES}`,
      transform: `rotate(${n(finger.fan * f)} ${finger.x} ${KNUCKLES})`,
    }
  })

  // The thumb: a capsule from its root at the side of the hand, swinging
  // from out to the side (open) to tucked under the first finger (closed).
  // Angles are y-down, so 90° points straight down at the fingertips.
  const th = partOpen(t, 0)
  const angle = lerp(82, 142, th) * (Math.PI / 180)
  const length = lerp(3.6, 6.4, th)
  const root = { x: 6.6, y: 7.8 }
  const dir = { x: Math.cos(angle), y: Math.sin(angle) }
  // Across the thumb, toward its outer edge: the side nearer the wrist.
  const out = { x: -dir.y * R, y: dir.x * R }
  const end = { x: root.x + dir.x * length, y: root.y + dir.y * length }
  const rootOuter = { x: root.x + out.x, y: root.y + out.y }
  const rootInner = { x: root.x - out.x, y: root.y - out.y }
  const tipOuter = { x: end.x + out.x, y: end.y + out.y }
  const tipInner = { x: end.x - out.x, y: end.y - out.y }
  const ahead = { x: dir.x * k, y: dir.y * k }
  const thumb = {
    d: [
      `M ${at(rootOuter)}`,
      `L ${at(tipOuter)}`,
      `C ${at({ x: tipOuter.x + ahead.x, y: tipOuter.y + ahead.y })} ${at({ x: tipInner.x + ahead.x, y: tipInner.y + ahead.y })} ${at(tipInner)}`,
      `L ${at(rootInner)}`,
    ].join(' '),
  }

  // The back of the hand: its two sides, running up off the top into an arm
  // that is never drawn (the hand fades out toward the wrist; see
  // FoodBucket). No line across the top, so it isn't a mitten.
  const littleSide = `M 20 ${KNUCKLES} C 20.2 8 20.6 4 21 0`
  const thumbSide = `M 4.6 0 C 4.9 2.6 5.2 4.6 ${at(rootOuter)}`

  return {
    fingers,
    thumb,
    backFill: {
      d: `M 20 ${KNUCKLES} C 20.2 8 20.6 4 21 0 L 4.6 0 C 4.9 2.6 5.2 4.6 ${at(rootOuter)} L 6 ${KNUCKLES} Z`,
    },
    backLine: { d: `${littleSide} ${thumbSide}` },
    pellet: 1 - t,
  }
}
