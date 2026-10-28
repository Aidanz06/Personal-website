/**
 * The koi.
 *
 * A fish is a head with a heading and a speed, a chain of spine points that
 * trail behind it, and a tail that beats. Everything here is a pure step
 * function — state in, next state out — so the behaviour can be tested
 * without a canvas or a clock.
 *
 * Locomotion is deliberately NOT constant-velocity steering. Real fish, and
 * the ones in Animal Crossing that this is chasing, move in bursts: a few
 * hard tail beats that drive them forward, then a long glide while they
 * slow, then another burst. Modelling that is the difference between
 * something that drifts around the screen and something that looks alive.
 */

export type Vec = { x: number; y: number }

export type Koi = {
  head: Vec
  /** Radians. The fish always faces where it is going. */
  heading: number
  /** Radians/second. Turns carry momentum instead of stopping dead. */
  angularVelocity: number
  /** Scalar px/second. Decays constantly and is topped up by darts. */
  speed: number
  /** Spine points from head to tail base, before the tail beat is applied. */
  spine: Vec[]
  wanderTarget: Vec
  wanderTimer: number
  /** Which koi colour this fish leans toward, 0..1. */
  hue: number
  /** Phase of the tail beat, radians. */
  tailPhase: number
  /** How hard it is currently beating, 0..1. Spikes on a dart, then decays. */
  tailEnergy: number
  /** Seconds until the next burst. */
  dartCooldown: number
  /** What it is up to. Only ever 'cruise' unless `features.moods` is on. */
  mood: KoiMood
  /** Seconds left in the current mood, for the moods that end on their own. */
  moodTimer: number
  /** 0..1. Builds while it inspects the pointer; full means it loses interest. */
  boredom: number
  /** Where the pointer was last frame, to tell a flick from a hover. */
  lastPointer: Vec | null
  /** Seconds alive. Drives the meander, which needs a smooth clock. */
  age: number
}

export type KoiMood =
  | 'cruise'
  /** Nearly still, holding position on its pectoral fins. */
  | 'hover'
  /** Close to the pointer, circling it. */
  | 'inspect'
  /** Has seen enough of the pointer and ignores it for a while. */
  | 'bored'
  /** A fast flick nearby: bolt away. */
  | 'startle'
  /** After a startle: keeps its distance until it settles. */
  | 'wary'
  /** Food in the water: hungry, quick and agile. */
  | 'feed'
  /** Just ate: a slow, lazy glide. */
  | 'sated'
  /** A sudden sprint somewhere for no reason, as koi do. */
  | 'dash'

/**
 * Behaviours layered on the basic swim, each switchable on its own in
 * /lab/pond. The pond turns all of them on (DEFAULT_POND_SETTINGS); a bare
 * stepKoi leaves them off, so the swim itself can be tested on its own.
 *
 * A fourth, depth (sinking and dimming, surfacing with a ring), was tried
 * and left out.
 */
export type KoiFeatures = {
  /** Hover, inspect, boredom, startle, feeding frenzy and the glide after. */
  moods: boolean
  /** Curving paths, and visits to the edges and stones instead of random points. */
  wander: boolean
  /** Head recoil and a turn-biased tail (render), stroke wakes (pond). */
  body: boolean
}

export const NO_KOI_FEATURES: KoiFeatures = {
  moods: false,
  wander: false,
  body: false,
}

/** What the fish's point of interest actually is, so it can react in kind. */
export type KoiContext = {
  interest?: 'pointer' | 'food' | 'stone'
  /** Stones, in world coordinates, for the wander to visit. */
  landmarks?: readonly Vec[]
}

export type KoiSettings = {
  maxSpeed: number
  /** Ceiling on angular velocity, radians/second. */
  turnRate: number
  /** How hard it pulls its heading toward where it wants to go. */
  turnAccel: number
  /** Damping on that turn. Low values let it drift past and settle back. */
  turnDamping: number
  /** Forward push from one tail stroke, px/second squared. */
  thrust: number
  /**
   * How far away the fish notices the pointer.
   *
   * This is a DETECTION radius, not a pull radius: beyond it the fish is
   * unaware of the cursor entirely. It has to be large enough to cover the
   * pond, or the fish spends most of its time unable to see you and the
   * whole interaction reads as broken.
   */
  attractRadius: number
  /** How much more eagerly it darts when chasing the pointer. */
  attractStrength: number
  /** How close two fish get before they turn away from each other. */
  separation: number
  /** Distance between spine points. */
  segmentLength: number
  /** Seconds between bursts, min and max. */
  dartInterval: [number, number]
  /** Fraction of speed lost per second while gliding. */
  drag: number
  /** Beats per second when idle, and the extra beats when darting. */
  baseBeat: number
  dartBeat: number
  /** Seconds for a burst's tail energy to fade. */
  tailDecay: number
  features?: KoiFeatures
}

export const DEFAULT_KOI_SETTINGS: KoiSettings = {
  maxSpeed: 251,
  turnRate: 1.7,
  turnAccel: 4.2,
  turnDamping: 2.4,
  // Sized against drag: at rest this settles around 55px/s, and a burst of
  // beating carries it to the speed cap.
  thrust: 410,
  // Large on purpose — see the field note above. A pond-sized radius means
  // the fish always knows where the cursor is.
  attractRadius: 1400,
  attractStrength: 1.8,
  separation: 130,
  segmentLength: 18,
  // Long gaps between bursts. Frequent darts read as agitation; a koi should
  // look like it has nowhere to be.
  dartInterval: [1.6, 3.6],
  // Low drag, so a burst carries a long way and the glide is the main event.
  drag: 0.9,
  // Beats per second. A cruising koi is around 1Hz and tops out near 2 — the
  // first version ran at 2.1 idle and 9.6 mid-burst, which is where the
  // jitter came from. Above roughly 3Hz the tail also crosses character cells
  // faster than the grid can describe, so it stops reading as a sweep and
  // starts reading as flicker.
  baseBeat: 0.5,
  dartBeat: 1.5,
  // Slow fade, so a burst eases off instead of snapping back to idle.
  tailDecay: 1.6,
}

/**
 * How much faster the koi swims while it is outside the visible band.
 *
 * A fish catching up is a fish swimming hard, so this is not a cheat — but
 * the real reason is impatience. At cruising speed a 700px scroll is a seven
 * to eleven second wait staring at empty water, and nobody waits that long
 * to see whether a website has a fish in it.
 *
 * Returns 1 inside the band, rising to this ceiling a full band away.
 */
export const CATCH_UP_MAX = 3.4

export function catchUpBoost(
  headY: number,
  bandTop: number,
  bandBottom: number,
): number {
  const bandHeight = Math.max(1, bandBottom - bandTop)
  const outside =
    headY < bandTop ? bandTop - headY : headY > bandBottom ? headY - bandBottom : 0
  if (!Number.isFinite(outside) || outside <= 0) return 1
  const t = Math.min(1, outside / bandHeight)
  return 1 + (CATCH_UP_MAX - 1) * t
}

/** Spine points per fish. 17 at 18px spacing gives a ~290px body. */
export const DEFAULT_SEGMENTS = 17

/**
 * Body radius at the widest point, in pixels.
 *
 * Sized by ROW COUNT, not by how big it looks in pixels. Vertical resolution
 * is the scarce one — cells are far taller than they are wide — and a body
 * spanning only three or four rows cannot describe a curve, so it reads as a
 * horizontal bar however correct its pixel proportions are. At 50px against
 * a ~12px cell height the body covers eight or nine rows, which is the point
 * where it starts to look like a fish.
 *
 * Keep it near a quarter of the body length; koi are roughly 4:1.
 */
export const DEFAULT_BODY_RADIUS = 40

// --- angles ---------------------------------------------------------------

export function wrapAngle(angle: number): number {
  const twoPi = Math.PI * 2
  let a = (angle + Math.PI) % twoPi
  if (a < 0) a += twoPi
  return a - Math.PI
}

/** Rotate `from` toward `to` by at most `maxDelta`, the short way round. */
export function turnToward(from: number, to: number, maxDelta: number): number {
  const diff = wrapAngle(to - from)
  if (Math.abs(diff) <= maxDelta) return wrapAngle(to)
  return wrapAngle(from + Math.sign(diff) * maxDelta)
}

// --- the step -------------------------------------------------------------

/**
 * The slice of the world the reader can currently see.
 *
 * The koi swims in WORLD coordinates, not screen ones — but it is told where
 * the reader is looking and wanders inside that band. Screen-space would glue
 * it to the viewport, so scrolling slides the water past a motionless fish;
 * pure world-space would leave it behind the moment you scrolled, and most of
 * the descent would be empty water. Wandering within the focus band gives the
 * behaviour that actually reads right: it lags when you scroll, then swims
 * back into frame after you.
 */
export type FocusBand = { top: number; bottom: number }

export function stepKoi(
  koi: Koi,
  others: readonly Koi[],
  pointer: Vec | null,
  bounds: { width: number; height: number },
  dt: number,
  settings: KoiSettings = DEFAULT_KOI_SETTINGS,
  random: () => number = Math.random,
  focus?: FocusBand,
  context: KoiContext = {},
): Koi {
  const features = settings.features ?? NO_KOI_FEATURES
  // Guard against a huge dt after a stalled tab, which would otherwise
  // teleport the fish across the pond in a single frame.
  const step = Math.min(Math.max(dt, 0), 0.05)

  // Where is it allowed to wander? The visible band if we were given one,
  // otherwise the whole pond.
  const bandTop = focus ? focus.top : 0
  const bandBottom = focus ? focus.bottom : bounds.height
  const bandHeight = Math.max(1, bandBottom - bandTop)

  // If the reader has scrolled away, the fish is suddenly a long way outside
  // the band. Re-target at once rather than waiting out the wander timer —
  // that wait is the difference between a fish that follows you down and one
  // that seems to have been abandoned upstream.
  const slack = bandHeight * 0.35
  const strandedAbove = koi.head.y < bandTop - slack
  const strandedBelow = koi.head.y > bandBottom + slack

  // Past a certain distance, swimming back is not a plan. A reader who jumps
  // to the bottom of a three-screen pond leaves the fish roughly 1,700px
  // behind, which at any believable swimming speed is a twenty-five second
  // trip — and the pond sits empty for all of it.
  //
  // So beyond a screen's distance it re-enters from the near edge instead,
  // heading inward. It is a relocation, but never a visible one: the
  // threshold is far enough off-screen that the fish simply swims in from the
  // side the reader came from, which is what it would have looked like if it
  // had been keeping up all along.
  // Half a band, not nearly a whole one. Past this the swim back is longer
  // than anyone will wait, and re-entering is both faster and — because it
  // happens well off-screen — invisible.
  const farAbove = koi.head.y < bandTop - bandHeight * 0.5
  const farBelow = koi.head.y > bandBottom + bandHeight * 0.5
  if (focus && (farAbove || farBelow)) {
    return enterBand(koi, bounds, bandTop, bandBottom, farAbove, settings, random)
  }

  let wanderTimer = koi.wanderTimer - step
  let wanderTarget = koi.wanderTarget
  const arrived =
    Math.hypot(wanderTarget.x - koi.head.x, wanderTarget.y - koi.head.y) < 70
  const targetOutOfBand =
    wanderTarget.y < bandTop - slack || wanderTarget.y > bandBottom + slack

  let mood = koi.mood
  let moodTimer = koi.moodTimer - step
  let boredom = koi.boredom
  const retarget =
    wanderTimer <= 0 || arrived || strandedAbove || strandedBelow || targetOutOfBand

  if (retarget) {
    wanderTarget = features.wander
      ? pickDestination(bounds, bandTop, bandHeight, context.landmarks ?? [], random)
      : // Keep away from the very edges so it does not spend its life in a corner.
        {
          x: bounds.width * (0.12 + random() * 0.76),
          y: bandTop + bandHeight * (0.15 + random() * 0.7),
        }
    wanderTimer = features.wander ? 3.5 + random() * 4 : 2.2 + random() * 3.4

    // Now and then, instead of setting off somewhere new, it just stops —
    // or bolts off across the pond for the fun of it.
    if (features.moods && mood === 'cruise') {
      const roll = random()
      if (roll < 0.35) {
        mood = 'hover'
        moodTimer = 3 + random() * 3
      } else if (roll < 0.5) {
        mood = 'dash'
        moodTimer = 1.4 + random() * 1
        wanderTarget = {
          x: koi.head.x < bounds.width / 2 ? bounds.width * 0.85 : bounds.width * 0.15,
          y: bandTop + bandHeight * (0.2 + random() * 0.6),
        }
      }
    }
  }

  // --- what is it interested in? ---
  let target = wanderTarget
  let chasing = false
  if (pointer) {
    const d = Math.hypot(pointer.x - koi.head.x, pointer.y - koi.head.y)
    if (d < settings.attractRadius) {
      target = pointer
      chasing = true
    }
  }

  const interest = context.interest ?? 'pointer'
  // Only the cursor counts here. Food and stones are targets too, and the
  // jump from an eaten pellet back to the cursor would read as a flick.
  const cursor = interest === 'pointer' ? pointer : null
  const pointerSpeed =
    cursor && koi.lastPointer && step > 0
      ? Math.hypot(cursor.x - koi.lastPointer.x, cursor.y - koi.lastPointer.y) / step
      : 0

  if (features.moods) {
    const d = pointer ? Math.hypot(pointer.x - koi.head.x, pointer.y - koi.head.y) : Infinity

    // A flick right beside it is a threat, whatever it was doing.
    if (pointer && interest === 'pointer' && pointerSpeed > 1600 && d < 240 && mood !== 'startle') {
      mood = 'startle'
      moodTimer = 1.1
      boredom = 0
    } else if (chasing && interest === 'food' && mood !== 'startle') {
      mood = 'feed'
    } else if (mood === 'feed') {
      // The food is gone, so it has eaten.
      mood = 'sated'
      moodTimer = 3 + random() * 2
    } else if (moodTimer <= 0) {
      if (mood === 'startle') {
        mood = 'wary'
        moodTimer = 2.5 + random() * 2
      } else if (
        mood === 'hover' || mood === 'bored' || mood === 'wary' || mood === 'sated' || mood === 'dash'
      ) {
        mood = 'cruise'
        boredom = Math.min(boredom, 0.3)
      }
    }

    if (chasing && interest === 'pointer') {
      if (mood === 'cruise' || mood === 'hover') mood = d < 220 ? 'inspect' : 'cruise'
      if (mood === 'inspect') {
        if (d > 320) mood = 'cruise'
        // Interest wears off while it looks, and a moving pointer renews it.
        boredom += step / 5
        if (pointerSpeed > 80) boredom -= step * 0.6
        boredom = Math.min(1, Math.max(0, boredom))
        if (boredom >= 1 && pointer) {
          mood = 'bored'
          moodTimer = 4 + random() * 4
          // Turns its back and swims off to the far side, so losing interest
          // is something you can see, not just a fish that stopped coming.
          wanderTarget = {
            x: pointer.x < bounds.width / 2 ? bounds.width * 0.82 : bounds.width * 0.18,
            y: bandTop + bandHeight * (0.2 + random() * 0.6),
          }
          wanderTimer = moodTimer
        }
      }
    }
    if (mood === 'bored') {
      boredom = Math.max(0, boredom - step / 8)
      // Wave at it and it comes round sooner.
      if (pointerSpeed > 500) moodTimer -= step * 2
    }

    // Moods that ignore the pointer go back to the wander.
    if (interest === 'pointer' && (mood === 'bored' || mood === 'sated')) {
      target = wanderTarget
      chasing = false
    }

    if (mood === 'inspect' && pointer) {
      // Circle rather than park on it: aim a little round the ring from where
      // it is now, always the same way for a given fish.
      const around = Math.atan2(koi.head.y - pointer.y, koi.head.x - pointer.x)
      const direction = koi.hue < 0.5 ? 1 : -1
      const ring = 140
      target = {
        x: pointer.x + Math.cos(around + 1.2 * direction) * ring,
        y: pointer.y + Math.sin(around + 1.2 * direction) * ring,
      }
    } else if (mood === 'wary' && pointer && interest === 'pointer') {
      // Keeps an eye on it from a distance.
      const away = Math.atan2(koi.head.y - pointer.y, koi.head.x - pointer.x)
      target = { x: pointer.x + Math.cos(away) * 260, y: pointer.y + Math.sin(away) * 260 }
      chasing = false
    } else if (mood === 'startle') {
      const from = pointer ?? koi.lastPointer ?? target
      const away = Math.atan2(koi.head.y - from.y, koi.head.x - from.x)
      target = { x: koi.head.x + Math.cos(away) * 400, y: koi.head.y + Math.sin(away) * 400 }
      chasing = false
    } else if (mood === 'hover') {
      // Holds its line: a target just off the nose.
      target = {
        x: koi.head.x + Math.cos(koi.heading) * 30,
        y: koi.head.y + Math.sin(koi.heading) * 30,
      }
    }
  }

  let desiredHeading = Math.atan2(target.y - koi.head.y, target.x - koi.head.x)

  // A glide that is a dead straight line is a glide nobody believes. Two slow
  // sines, out of step with each other, bend the path into lazy curves; the
  // walls and neighbours below still win.
  const age = koi.age + step
  if (features.wander) {
    const meander =
      0.8 * Math.sin(age * 0.7 + koi.hue * 20) + 0.45 * Math.sin(age * 1.6 + koi.hue * 7)
    // Never on the way to food: a bent approach is how it ends up orbiting.
    if (interest !== 'food' || !chasing) desiredHeading += meander * (chasing ? 0.25 : 1)
  }

  // --- turn away from neighbours ---
  for (const other of others) {
    if (other === koi) continue
    const dx = koi.head.x - other.head.x
    const dy = koi.head.y - other.head.y
    const d = Math.hypot(dx, dy)
    if (d > 0 && d < settings.separation) {
      const away = Math.atan2(dy, dx)
      const urgency = (settings.separation - d) / settings.separation
      desiredHeading = turnToward(desiredHeading, away, urgency * Math.PI * 0.9)
    }
  }

  // --- turn away from the walls, before hitting them ---
  const margin = 90
  if (koi.head.x < margin) desiredHeading = turnToward(desiredHeading, 0, (1 - koi.head.x / margin) * Math.PI * 0.8)
  if (koi.head.x > bounds.width - margin) desiredHeading = turnToward(desiredHeading, Math.PI, (1 - (bounds.width - koi.head.x) / margin) * Math.PI * 0.8)

  // Vertically it is turned back at the edges of the VISIBLE band, not of the
  // whole document — in a pond three screens deep, document edges would only
  // matter twice in the entire descent.
  const topEdge = bandTop + margin
  const bottomEdge = bandBottom - margin
  if (koi.head.y < topEdge) desiredHeading = turnToward(desiredHeading, Math.PI / 2, Math.min(1, (topEdge - koi.head.y) / margin) * Math.PI * 0.8)
  if (koi.head.y > bottomEdge) desiredHeading = turnToward(desiredHeading, -Math.PI / 2, Math.min(1, (koi.head.y - bottomEdge) / margin) * Math.PI * 0.8)

  // --- turning, with momentum ---
  // A damped spring on heading rather than a fixed turn rate. A hard rate
  // clamp turns at exactly one speed and stops dead on arrival, which is the
  // single most mechanical-looking thing a creature can do. A spring
  // accelerates into the turn, drifts very slightly past, and settles.
  //
  // A fish steers with its tail, so it is far more agile mid-burst than while
  // gliding — that is what produces a flick-and-glide arc instead of a
  // smooth circle.
  let agility = 0.35 + 0.65 * koi.tailEnergy
  if (mood === 'feed' || mood === 'startle' || mood === 'dash') agility = Math.min(1.4, agility + 0.4)
  const headingError = wrapAngle(desiredHeading - koi.heading)

  let angularVelocity =
    koi.angularVelocity + headingError * settings.turnAccel * agility * step
  angularVelocity *= Math.exp(-settings.turnDamping * step)
  const maxTurn = settings.turnRate * agility
  angularVelocity = Math.min(maxTurn, Math.max(-maxTurn, angularVelocity))

  const heading = wrapAngle(koi.heading + angularVelocity * step)

  // --- the tail does the swimming ---
  const boostPending = focus ? catchUpBoost(koi.head.y, bandTop, bandBottom) : 1
  let dartCooldown = koi.dartCooldown - step
  let tailEnergy = koi.tailEnergy
  const distance = Math.hypot(target.x - koi.head.x, target.y - koi.head.y)

  // A dart is no longer a shove applied to the body — it is a decision to
  // beat harder. Speed follows from the tail, which is the whole point:
  // an instant impulse and a waving tail are two unrelated animations, and
  // the eye reads the tail as decoration. Driving speed from the stroke makes
  // the fish visibly push itself along.
  if (mood === 'startle' && koi.mood !== 'startle') {
    // A bolt is one hard beat, at once.
    tailEnergy = 1
    dartCooldown = 0.5
  } else if (mood === 'dash') {
    tailEnergy = Math.max(tailEnergy, 0.95)
  } else if (mood === 'hover') {
    // No bursts while it holds still.
    dartCooldown = Math.max(dartCooldown, 0.3)
  } else if (dartCooldown <= 0) {
    // Ease off once it is basically there, so it settles rather than
    // overshooting back and forth across the target.
    const proximity = Math.min(1, distance / 140)
    tailEnergy = Math.min(1, 0.45 + 0.55 * proximity)
    if (mood === 'sated') tailEnergy *= 0.6
    const [lo, hi] = settings.dartInterval
    const eagerness =
      mood === 'feed' ? settings.attractStrength * 1.6
      : mood === 'sated' ? 0.55
      : chasing ? settings.attractStrength
      : 1
    dartCooldown = (lo + random() * (hi - lo)) / eagerness
  }

  tailEnergy = Math.max(0, tailEnergy - step / settings.tailDecay)
  // Out of sight and hurrying: beat hard, so it arrives already moving
  // rather than easing in from a glide.
  if (focus && boostPending > 1.05) tailEnergy = Math.max(tailEnergy, 0.85)

  // Tail beats faster when working harder. The phase is what the render wave
  // rides on, and also what the thrust rides on.
  const beat = settings.baseBeat + settings.dartBeat * tailEnergy
  const tailPhase = koi.tailPhase + beat * step * Math.PI * 2

  // Thrust peaks at mid-stroke and falls to nothing at the turnaround, twice
  // per beat — a fish pushes on both halves of the sweep. The result is a
  // gentle surge-and-ease in speed that the body's own motion explains.
  const stroke = Math.abs(Math.cos(tailPhase))
  const effort = 0.18 + 0.82 * tailEnergy

  // Swimming hard to catch up with a reader who has scrolled away.
  const boost = boostPending

  let speed = koi.speed + settings.thrust * boost * stroke * effort * step

  // Close to what it wants but pointing past it, a fish brakes and turns
  // rather than sweeping by. Without this it orbits food forever: gliding,
  // its tightest circle (speed over turn rate, ~90px) is wider than its
  // mouth's reach, so the pellet sits in the middle of a loop it can never
  // close, and sinks.
  if (chasing && distance < 180) {
    const alignment = Math.cos(wrapAngle(desiredHeading - heading))
    const closeness = 1 - distance / 180
    speed *= Math.exp(-5 * closeness * Math.max(0, 0.9 - alignment) * step)
  }
  // Hovering, it brakes on its fins.
  speed *= Math.exp(-settings.drag * (mood === 'hover' ? 3 : 1) * step)
  const ceiling =
    settings.maxSpeed * boost * (mood === 'startle' ? 1.5 : mood === 'dash' ? 1.3 : 1)
  if (speed > ceiling) speed = ceiling

  let head = {
    x: koi.head.x + Math.cos(heading) * speed * step,
    y: koi.head.y + Math.sin(heading) * speed * step,
  }

  // Hard clamp as a safety net; the wall steering above should mean this
  // almost never fires.
  // Clamped to the pond, not to the band: the fish is allowed to be
  // off-screen, which is exactly what lets it swim back in.
  const edge = 8
  head = {
    x: Math.min(bounds.width - edge, Math.max(edge, head.x)),
    y: Math.min(bounds.height - edge, Math.max(edge, head.y)),
  }

  return {
    ...koi,
    head,
    heading,
    angularVelocity,
    speed,
    tailPhase,
    tailEnergy,
    dartCooldown,
    wanderTarget,
    wanderTimer,
    spine: followSpine(head, koi.spine, settings.segmentLength),
    mood,
    moodTimer,
    boredom,
    lastPointer: cursor ? { x: cursor.x, y: cursor.y } : null,
    age,
  }
}

/**
 * Somewhere worth swimming to. Koi patrol: they run the margins and drift
 * round whatever sits in the water, and rarely cut straight across the open
 * middle. A uniformly random point is exactly that straight cut.
 */
function pickDestination(
  bounds: { width: number; height: number },
  bandTop: number,
  bandHeight: number,
  landmarks: readonly Vec[],
  random: () => number,
): Vec {
  const roll = random()
  const inBand = landmarks.filter((l) => l.y > bandTop && l.y < bandTop + bandHeight)
  if (roll < 0.35 && inBand.length > 0) {
    const stone = inBand[Math.floor(random() * inBand.length)]!
    const angle = random() * Math.PI * 2
    const reach = 90 + random() * 50
    return { x: stone.x + Math.cos(angle) * reach, y: stone.y + Math.sin(angle) * reach }
  }
  if (roll < 0.75) {
    // Along one side.
    const side = random() < 0.5 ? 0.1 + random() * 0.12 : 0.78 + random() * 0.12
    return { x: bounds.width * side, y: bandTop + bandHeight * (0.12 + random() * 0.76) }
  }
  return {
    x: bounds.width * (0.12 + random() * 0.76),
    y: bandTop + bandHeight * (0.15 + random() * 0.7),
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

/**
 * Apply the tail beat: a wave travelling from head to tail.
 *
 * Each spine point is pushed sideways, perpendicular to the body, by a sine
 * whose phase lags further down the body. That lag is the whole trick — every
 * point moving together is a fish wagging rigidly, whereas a travelling wave
 * is how a fish actually swims, and the eye knows the difference instantly.
 *
 * Amplitude grows toward the tail so the head barely moves and the tail
 * sweeps, and scales with how hard the fish is currently beating.
 */
export function flutterSpine(
  spine: readonly Vec[],
  tailPhase: number,
  tailEnergy: number,
  amplitude: number,
  // Phase lag per spine point. Across ~17 points this puts a little under one
  // wavelength on the body, which is what a real fish carries. The first
  // version used 0.55, packing 1.5 wavelengths on — so the body wiggled in
  // two places at once and read as buzzing rather than swimming.
  waveNumber = 0.3,
  /**
   * Opt-in extras. `recoil` lets the head swing slightly against each stroke,
   * as a real one does; `turn` (-1..1) throws the tail toward the outside of
   * a turn, so turning reads as something the fish does.
   */
  extras: { recoil?: number; turn?: number } = {},
): Vec[] {
  const n = spine.length
  if (n < 2) return [...spine]

  const effort = 0.3 + 0.7 * Math.min(1, Math.max(0, tailEnergy))
  const recoil = extras.recoil ?? 0
  const turn = extras.turn ?? 0
  const out: Vec[] = []

  for (let i = 0; i < n; i++) {
    const point = spine[i]!
    const t = i / (n - 1)

    // Cubic ramp: the head is effectively rigid, the tail does the work.
    const local = amplitude * Math.pow(t, 1.7) * effort
    const headSwing = t < 0.3 ? amplitude * recoil * effort * (1 - t / 0.3) : 0
    const bend = amplitude * turn * t * t
    if (local < 0.01 && headSwing < 0.01 && Math.abs(bend) < 0.01) {
      out.push({ x: point.x, y: point.y })
      continue
    }

    // Body direction at this point, from the neighbour in front.
    const ahead = spine[Math.max(0, i - 1)]!
    const behind = spine[Math.min(n - 1, i + 1)]!
    const dx = behind.x - ahead.x
    const dy = behind.y - ahead.y
    const len = Math.hypot(dx, dy) || 1

    // Perpendicular to the body.
    const px = -dy / len
    const py = dx / len

    const offset =
      Math.sin(tailPhase - i * waveNumber) * local - Math.sin(tailPhase) * headSwing + bend
    out.push({ x: point.x + px * offset, y: point.y + py * offset })
  }

  return out
}

/** Where along the body the fish is widest, 0 = head, 1 = tail. */
const SHOULDER = 0.2
/** Width at the very nose, relative to the widest point. */
const NOSE_WIDTH = 0.55
/**
 * Width at the wrist, where the tail fin attaches.
 *
 * Generous on purpose. Taper the body to a point and the fin reads as a
 * separate smudge floating behind the fish, because there is nothing solid
 * joining them — the whole thing looks like a tadpole. A fat wrist is what
 * makes body and tail read as one animal.
 */
const WRIST_WIDTH = 0.26

/**
 * Body thickness along the spine, 0..1.
 *
 * Widest just behind the head and tapering toward the tail — that asymmetry
 * is what makes a row of blobs read as a fish rather than a worm. A profile
 * that peaks in the middle looks like a grain of rice.
 *
 * It does not taper fully to zero: the body meets the tail fin at a narrow
 * but real wrist, which is what the fin attaches to.
 */
export function spineWidth(index: number, count: number): number {
  if (count <= 1) return 1
  const t = index / (count - 1)

  if (t <= SHOULDER) {
    const u = t / SHOULDER
    return NOSE_WIDTH + (1 - NOSE_WIDTH) * (u * u * (3 - 2 * u))
  }

  // Near-linear taper rather than a steep curve: the body stays full most of
  // its length and only narrows close to the tail, which is what a koi
  // actually looks like from above.
  const u = (t - SHOULDER) / (1 - SHOULDER)
  return WRIST_WIDTH + (1 - WRIST_WIDTH) * Math.pow(1 - u, 1.1)
}

/** One blob to draw. The renderer knows nothing about fish anatomy. */
export type Stamp = {
  x: number
  y: number
  radius: number
  strength: number
  /** Position along the colour gradient, 0..1. */
  tint: number
}

/**
 * Turn a fish into a list of blobs: body, tail fin, pectoral fins.
 *
 * Kept separate from the stepping so the silhouette can be unit tested, and
 * so the renderer never needs to know what a fin is.
 */
export function koiSilhouette(
  koi: Koi,
  bodyRadius: number,
  tailAmplitude = bodyRadius * 0.38,
  /** The body extras from `KoiFeatures.body`. */
  body = false,
): Stamp[] {
  const display = flutterSpine(
    koi.spine,
    koi.tailPhase,
    koi.tailEnergy,
    tailAmplitude,
    undefined,
    body
      ? {
          recoil: 0.35,
          turn: Math.max(-1, Math.min(1, koi.angularVelocity / DEFAULT_KOI_SETTINGS.turnRate)) * 2.5,
        }
      : {},
  )
  const n = display.length
  const stamps: Stamp[] = []
  if (n === 0) return stamps

  const tintAt = (t: number) => Math.min(1, Math.max(0, t * 0.72 + koi.hue * 0.28))

  // --- body ---
  for (let i = 0; i < n; i++) {
    const point = display[i]!
    const width = spineWidth(i, n)
    const t = n > 1 ? i / (n - 1) : 0
    stamps.push({
      x: point.x,
      y: point.y,
      radius: bodyRadius * width,
      strength: 0.6 + 0.4 * width,
      tint: tintAt(t),
    })
  }

  if (n < 3) return stamps

  // --- tail fin ---
  // Two lobes splaying back from the wrist, forked like a real caudal fin.
  // It inherits the tail's sideways motion for free, because the wrist it
  // hangs off is already part of the flutter wave.
  const tail = display[n - 1]!
  const wrist = display[n - 3]!
  const backAngle = Math.atan2(tail.y - wrist.y, tail.x - wrist.x)
  const finLength = bodyRadius * 1.15
  const spread = 0.55

  for (const side of [-1, 1]) {
    const angle = backAngle + side * spread
    for (const [reach, size] of [[0.32, 0.5], [0.62, 0.42], [0.92, 0.3]] as const) {
      stamps.push({
        x: tail.x + Math.cos(angle) * finLength * reach,
        y: tail.y + Math.sin(angle) * finLength * reach,
        radius: bodyRadius * size,
        // Bright enough to land in the dense half of the ramp. Below about
        // 0.5 a fin maps to sparse characters and visually evaporates.
        strength: 0.62,
        tint: tintAt(1),
      })
    }
  }

  // --- pectoral fins ---
  // Just behind the head, sweeping gently out of phase with the tail.
  const shoulderIndex = Math.max(1, Math.round(n * 0.22))
  const shoulder = display[shoulderIndex]!
  const ahead = display[shoulderIndex - 1]!
  const bodyAngle = Math.atan2(shoulder.y - ahead.y, shoulder.x - ahead.x)
  // Hovering, the pectorals do the work: wider, quicker sculling.
  const sweep =
    koi.mood === 'hover' ? Math.sin(koi.tailPhase * 2.4) * 0.55 : Math.sin(koi.tailPhase * 0.8) * 0.3

  for (const side of [-1, 1]) {
    const angle = bodyAngle + side * (1.15 + sweep * side)
    for (const [reach, size] of [[0.5, 0.34], [0.85, 0.24]] as const) {
      stamps.push({
        x: shoulder.x + Math.cos(angle) * bodyRadius * reach,
        y: shoulder.y + Math.sin(angle) * bodyRadius * reach,
        radius: bodyRadius * size,
        strength: 0.52,
        tint: tintAt(0.25),
      })
    }
  }

  return stamps
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
    heading,
    angularVelocity: 0,
    speed: 18,
    spine,
    wanderTarget: { x: head.x, y: head.y },
    // Zero, not a random delay: stepKoi picks a real target on the very
    // first frame. Seeded with its own position and a timer still running, a
    // fish seeks the spot it is already on, stops, and sits frozen — so the
    // pond looks dead on load, exactly when someone is deciding whether to
    // stay.
    wanderTimer: 0,
    hue,
    tailPhase: Math.random() * Math.PI * 2,
    tailEnergy: 0.5,
    dartCooldown: 0,
    mood: 'cruise',
    moodTimer: 0,
    boredom: 0,
    lastPointer: null,
    age: Math.random() * 100,
  }
}

/**
 * Re-enter the visible band from whichever edge the fish was stranded beyond,
 * pointing inward with its body trailing off-screen behind it.
 *
 * Deterministic given `random`, so the behaviour can be tested.
 */
function enterBand(
  koi: Koi,
  bounds: { width: number; height: number },
  bandTop: number,
  bandBottom: number,
  fromAbove: boolean,
  settings: KoiSettings,
  random: () => number,
): Koi {
  const margin = settings.segmentLength * 3
  const entryY = fromAbove ? bandTop - margin : bandBottom + margin
  // Pointing into the band: down when entering from the top, up from below.
  const heading = fromAbove ? Math.PI / 2 : -Math.PI / 2

  const x = Math.min(
    bounds.width * 0.85,
    Math.max(bounds.width * 0.15, bounds.width * (0.2 + random() * 0.6)),
  )
  const head = { x, y: Math.min(bounds.height - 8, Math.max(8, entryY)) }

  const spine: Vec[] = []
  for (let i = 0; i < koi.spine.length; i++) {
    spine.push({
      x: head.x - Math.cos(heading) * settings.segmentLength * i,
      y: head.y - Math.sin(heading) * settings.segmentLength * i,
    })
  }

  return {
    ...koi,
    head,
    heading,
    angularVelocity: 0,
    // Arrives with some way on, so it glides in rather than appearing and
    // then starting from a standstill.
    speed: settings.maxSpeed * 0.45,
    spine,
    wanderTarget: {
      x: bounds.width * (0.2 + random() * 0.6),
      y: bandTop + (bandBottom - bandTop) * (0.25 + random() * 0.5),
    },
    wanderTimer: 2 + random() * 2,
    tailEnergy: 0.9,
    dartCooldown: 0.4,
  }
}
