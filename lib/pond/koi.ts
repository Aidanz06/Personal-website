/**
 * The koi.
 *
 * Each fish is a head that steers, plus a chain of spine points that follow
 * it. Everything here is a pure step function — state in, next state out —
 * so the behaviour can be tested without a canvas or a clock.
 */

export type Vec = { x: number; y: number }

export type Koi = {
  head: Vec
  velocity: Vec
  /** Spine points from head to tail. Index 0 is at the head. */
  spine: Vec[]
  /** Where it wanders to when nothing is attracting it. */
  wanderTarget: Vec
  /** Seconds until it picks a new wander target. */
  wanderTimer: number
  /** Which koi colour this fish leans toward, 0..1. */
  hue: number
}

export type KoiSettings = {
  maxSpeed: number
  /** How hard it can turn. Low values give the long lazy arcs koi actually swim. */
  maxForce: number
  /** Distance at which the pointer starts attracting it. */
  attractRadius: number
  /** How strongly the pointer pulls, relative to wandering. */
  attractStrength: number
  /** How close two fish get before they push apart. */
  separation: number
  /** Distance between spine points. */
  segmentLength: number
}

export const DEFAULT_KOI_SETTINGS: KoiSettings = {
  maxSpeed: 46,
  maxForce: 34,
  attractRadius: 260,
  attractStrength: 1.9,
  separation: 70,
  segmentLength: 11,
}

/** Spine points per fish. ~22 at the default spacing gives a 230px body. */
export const DEFAULT_SEGMENTS = 22

/**
 * Body radius at the widest point, in pixels.
 *
 * This has to be much larger than it first seems. Character cells are twice
 * as tall as they are wide, so vertical resolution is half of horizontal: a
 * radius of 11px covers barely one row and the fish renders as a thin
 * horizontal line rather than a body. At 30px it spans three or four rows,
 * which is what makes it read as a koi.
 */
export const DEFAULT_BODY_RADIUS = 30

const clampMagnitude = (v: Vec, max: number): Vec => {
  const m = Math.hypot(v.x, v.y)
  if (m <= max || m === 0) return v
  return { x: (v.x / m) * max, y: (v.y / m) * max }
}

/**
 * Steer one fish and drag its spine along behind it.
 *
 * The pointer ATTRACTS rather than repels, and that is a deliberate
 * interaction decision rather than a physical one. The fish carry the
 * photographs, so they have to be catchable — and hovering something that
 * flees is the single most frustrating interaction there is. Inverting it
 * means you never chase: you hold still and a fish comes to you.
 */
export function stepKoi(
  koi: Koi,
  others: readonly Koi[],
  pointer: Vec | null,
  bounds: { width: number; height: number },
  dt: number,
  settings: KoiSettings = DEFAULT_KOI_SETTINGS,
): Koi {
  // Guard against a huge dt after a stalled tab, which would otherwise
  // teleport every fish across the pond in one frame.
  const step = Math.min(Math.max(dt, 0), 0.05)

  let wanderTimer = koi.wanderTimer - step
  let wanderTarget = koi.wanderTarget
  if (wanderTimer <= 0) {
    wanderTarget = {
      x: Math.random() * bounds.width,
      y: Math.random() * bounds.height,
    }
    wanderTimer = 2.5 + Math.random() * 3.5
  }

  // Seek: the pointer if it is close enough, otherwise the wander target.
  let target = wanderTarget
  let weight = 1
  if (pointer) {
    const d = Math.hypot(pointer.x - koi.head.x, pointer.y - koi.head.y)
    if (d < settings.attractRadius) {
      target = pointer
      // Pull hardest at the edge of the radius and ease off up close, so
      // fish gather around the cursor instead of piling onto it.
      weight = settings.attractStrength * (0.35 + 0.65 * (d / settings.attractRadius))
    }
  }

  const toTarget = { x: target.x - koi.head.x, y: target.y - koi.head.y }
  const distance = Math.hypot(toTarget.x, toTarget.y) || 1
  const desired = {
    x: (toTarget.x / distance) * settings.maxSpeed,
    y: (toTarget.y / distance) * settings.maxSpeed,
  }

  let steer = {
    x: (desired.x - koi.velocity.x) * weight,
    y: (desired.y - koi.velocity.y) * weight,
  }

  // Separation: push away from anyone too close, harder the closer they are.
  for (const other of others) {
    if (other === koi) continue
    const dx = koi.head.x - other.head.x
    const dy = koi.head.y - other.head.y
    const d = Math.hypot(dx, dy)
    if (d > 0 && d < settings.separation) {
      const push = (settings.separation - d) / settings.separation
      steer.x += (dx / d) * push * settings.maxForce * 1.6
      steer.y += (dy / d) * push * settings.maxForce * 1.6
    }
  }

  steer = clampMagnitude(steer, settings.maxForce)

  let velocity = clampMagnitude(
    { x: koi.velocity.x + steer.x * step, y: koi.velocity.y + steer.y * step },
    settings.maxSpeed,
  )

  let head = { x: koi.head.x + velocity.x * step, y: koi.head.y + velocity.y * step }

  // Turn away at the edges rather than wrapping. A fish popping from one
  // side of the pond to the other breaks the illusion instantly.
  const margin = 24
  if (head.x < margin) { head.x = margin; velocity = { ...velocity, x: Math.abs(velocity.x) } }
  if (head.x > bounds.width - margin) { head.x = bounds.width - margin; velocity = { ...velocity, x: -Math.abs(velocity.x) } }
  if (head.y < margin) { head.y = margin; velocity = { ...velocity, y: Math.abs(velocity.y) } }
  if (head.y > bounds.height - margin) { head.y = bounds.height - margin; velocity = { ...velocity, y: -Math.abs(velocity.y) } }

  return {
    ...koi,
    head,
    velocity,
    wanderTarget,
    wanderTimer,
    spine: followSpine(head, koi.spine, settings.segmentLength),
  }
}

/**
 * Drag the spine after the head.
 *
 * Each point is pulled to sit exactly `segmentLength` behind the one in
 * front of it. That single constraint is what produces the S-curve a koi
 * makes when it turns — the body cannot pivot instantly, so it trails and
 * bends. No spring, no physics.
 */
export function followSpine(
  head: Vec,
  spine: readonly Vec[],
  segmentLength: number,
): Vec[] {
  const next: Vec[] = [head]
  for (let i = 1; i < spine.length; i++) {
    const previous = next[i - 1]!
    const current = spine[i]!
    const dx = current.x - previous.x
    const dy = current.y - previous.y
    const d = Math.hypot(dx, dy)
    if (d === 0) {
      // Degenerate: nudge it straight back so the chain cannot collapse to
      // a single point and stay there.
      next.push({ x: previous.x - segmentLength, y: previous.y })
      continue
    }
    next.push({
      x: previous.x + (dx / d) * segmentLength,
      y: previous.y + (dy / d) * segmentLength,
    })
  }
  return next
}

/** Where along the body the fish is widest, 0 = head, 1 = tail. */
const SHOULDER = 0.22
/** Width at the very nose, relative to the widest point. */
const NOSE_WIDTH = 0.62

/**
 * Body thickness along the spine, 0..1.
 *
 * Widest just behind the head and tapering to nothing at the tail — that
 * asymmetry is what makes a row of blobs read as a fish rather than a worm.
 * A profile that peaks in the middle looks like a grain of rice.
 *
 * Two pieces: a smoothstep from the nose out to the shoulder, then a taper
 * to zero at the tail.
 */
export function spineWidth(index: number, count: number): number {
  if (count <= 1) return 1
  const t = index / (count - 1)

  if (t <= SHOULDER) {
    const u = t / SHOULDER
    return NOSE_WIDTH + (1 - NOSE_WIDTH) * (u * u * (3 - 2 * u))
  }

  const u = (t - SHOULDER) / (1 - SHOULDER)
  return Math.pow(1 - u, 1.6)
}

/** Build a koi at rest, its spine trailing straight back from the head. */
export function createKoi(
  head: Vec,
  heading: number,
  segments: number,
  hue: number,
  segmentLength = DEFAULT_KOI_SETTINGS.segmentLength,
): Koi {
  const spine: Vec[] = []
  for (let i = 0; i < segments; i++) {
    spine.push({
      x: head.x - Math.cos(heading) * segmentLength * i,
      y: head.y - Math.sin(heading) * segmentLength * i,
    })
  }
  return {
    head,
    velocity: { x: Math.cos(heading) * 12, y: Math.sin(heading) * 12 },
    spine,
    wanderTarget: { x: head.x, y: head.y },
    // Zero, not a random delay: stepKoi picks a real target on the very
    // first frame. Seeded with its own position and a timer still running, a
    // fish seeks the spot it is already on, decelerates to a stop, and sits
    // frozen for up to three seconds — so the pond looks dead on load,
    // exactly when someone is deciding whether to stay.
    wanderTimer: 0,
    hue,
  }
}
