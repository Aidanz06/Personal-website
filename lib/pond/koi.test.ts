import { describe, expect, it } from 'vitest'
import {
  DEFAULT_BODY_RADIUS,
  DEFAULT_KOI_SETTINGS,
  DEFAULT_SEGMENTS,
  createKoi,
  flutterSpine,
  followSpine,
  koiSilhouette,
  spineWidth,
  stepKoi,
  turnToward,
  wrapAngle,
  type Koi,
} from './koi'

const BOUNDS = { width: 1000, height: 600 }

/** Deterministic PRNG so darts and wander targets are reproducible. */
function seeded(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

const run = (
  koi: Koi,
  pointer: { x: number; y: number } | null,
  frames: number,
  rng = seeded(7),
  others: Koi[] = [],
) => {
  let current = koi
  for (let i = 0; i < frames; i++) {
    current = stepKoi(current, others, pointer, BOUNDS, 1 / 60, DEFAULT_KOI_SETTINGS, rng)
  }
  return current
}

describe('angles', () => {
  it('wraps into -pi..pi', () => {
    for (const a of [0, 3, -3, 7, -7, 100, -100]) {
      const w = wrapAngle(a)
      expect(w).toBeGreaterThanOrEqual(-Math.PI - 1e-9)
      expect(w).toBeLessThanOrEqual(Math.PI + 1e-9)
      expect(Math.abs(Math.sin(w) - Math.sin(a))).toBeLessThan(1e-9)
    }
  })

  it('turns the short way round the circle', () => {
    // From just below +pi to just above -pi is a small step, not a near-full turn.
    const from = Math.PI - 0.1
    const to = -Math.PI + 0.1
    expect(Math.abs(wrapAngle(turnToward(from, to, 1) - to))).toBeLessThan(1e-9)
  })

  it('never overshoots the target angle', () => {
    expect(turnToward(0, 1, 0.25)).toBeCloseTo(0.25, 9)
    expect(turnToward(0, 0.1, 5)).toBeCloseTo(0.1, 9)
  })
})

describe('followSpine', () => {
  it('keeps every segment exactly one length apart', () => {
    const koi = createKoi({ x: 400, y: 300 }, 0, 14, 0.5)
    const moved = followSpine({ x: 430, y: 320 }, koi.spine, 11)
    for (let i = 1; i < moved.length; i++) {
      const d = Math.hypot(moved[i]!.x - moved[i - 1]!.x, moved[i]!.y - moved[i - 1]!.y)
      expect(d).toBeCloseTo(11, 6)
    }
  })

  it('bends rather than pivoting — this is what makes the S-curve', () => {
    const koi = createKoi({ x: 400, y: 300 }, 0, 16, 0.5)
    const moved = followSpine({ x: 400, y: 220 }, koi.spine, 11)
    expect(moved[moved.length - 1]!.y).toBeGreaterThan(250)
  })

  it('recovers from a fully collapsed spine', () => {
    const collapsed = Array.from({ length: 6 }, () => ({ x: 50, y: 50 }))
    const moved = followSpine({ x: 50, y: 50 }, collapsed, 11)
    for (let i = 1; i < moved.length; i++) {
      expect(Number.isFinite(moved[i]!.x)).toBe(true)
      const d = Math.hypot(moved[i]!.x - moved[i - 1]!.x, moved[i]!.y - moved[i - 1]!.y)
      expect(d).toBeCloseTo(11, 6)
    }
  })
})

describe('spineWidth', () => {
  it('is widest in the front half of the body', () => {
    const count = 26
    const widths = Array.from({ length: count }, (_, i) => spineWidth(i, count))
    expect(widths.indexOf(Math.max(...widths))).toBeLessThan(count / 2)
  })

  it('keeps a substantial wrist for the tail fin to attach to', () => {
    // Taper to a point and the fin reads as a separate smudge behind the
    // fish, because nothing solid joins them — it looks like a tadpole.
    const last = spineWidth(25, 26)
    expect(last).toBeGreaterThan(0.2)
    expect(last).toBeLessThan(0.45)
  })

  it('stays full through the middle rather than tapering the whole way', () => {
    // A steady taper from the shoulder reads as a comma, not a koi.
    expect(spineWidth(13, 26)).toBeGreaterThan(0.55)
  })

  it('never widens again after the shoulder', () => {
    const count = 26
    let previous = Infinity
    for (let i = Math.ceil(count * 0.2); i < count; i++) {
      const w = spineWidth(i, count)
      expect(w).toBeLessThanOrEqual(previous + 1e-9)
      previous = w
    }
  })

  it('handles a single-point spine', () => {
    expect(spineWidth(0, 1)).toBe(1)
  })
})

describe('flutterSpine — the tail beat', () => {
  const straight = Array.from({ length: 20 }, (_, i) => ({ x: 500 - i * 11, y: 300 }))

  it('barely moves the head and sweeps the tail', () => {
    // A fish whose whole body swings is wagging rigidly, not swimming.
    const out = flutterSpine(straight, 1.2, 1, 30)
    const headOffset = Math.abs(out[0]!.y - straight[0]!.y)
    const tailOffset = Math.abs(out[out.length - 1]!.y - straight[straight.length - 1]!.y)
    expect(headOffset).toBeLessThan(0.5)
    expect(tailOffset).toBeGreaterThan(5)
  })

  it('is a TRAVELLING wave — the phase lags down the body', () => {
    // Every point moving in step would be a rigid wag. The lag is the whole
    // difference between that and swimming, and the eye knows instantly.
    const out = flutterSpine(straight, 0, 1, 30, 0.55)
    const offsets = out.map((p, i) => p.y - straight[i]!.y)
    // Somewhere down the body the offset must change sign.
    const signs = offsets.filter((o) => Math.abs(o) > 0.2).map((o) => Math.sign(o))
    expect(new Set(signs).size).toBe(2)
  })

  it('sweeps harder when the fish is beating harder', () => {
    const lazy = flutterSpine(straight, 1.2, 0, 30)
    const hard = flutterSpine(straight, 1.2, 1, 30)
    const swing = (s: typeof lazy) => Math.abs(s[s.length - 1]!.y - straight[straight.length - 1]!.y)
    expect(swing(hard)).toBeGreaterThan(swing(lazy))
  })

  it('advances with the phase', () => {
    const a = flutterSpine(straight, 0, 1, 30)
    const b = flutterSpine(straight, Math.PI / 2, 1, 30)
    expect(a[19]!.y).not.toBeCloseTo(b[19]!.y, 3)
  })

  it('handles degenerate spines', () => {
    expect(flutterSpine([], 1, 1, 30)).toEqual([])
    expect(flutterSpine([{ x: 1, y: 2 }], 1, 1, 30)).toEqual([{ x: 1, y: 2 }])
  })

  it('never produces NaN', () => {
    const out = flutterSpine(straight, 12.3, 0.7, 30)
    for (const p of out) {
      expect(Number.isFinite(p.x)).toBe(true)
      expect(Number.isFinite(p.y)).toBe(true)
    }
  })
})

describe('stepKoi — attraction', () => {
  it('notices the pointer from right across the pond', () => {
    // The bug this guards: attractRadius is a DETECTION radius, and when it
    // was smaller than the pond the fish spent most of its life unable to
    // see the cursor, which reads as the feature being broken.
    const corner = createKoi({ x: 60, y: 60 }, 0, DEFAULT_SEGMENTS, 0.5)
    const pointer = { x: 940, y: 540 }
    const far = Math.hypot(pointer.x - 60, pointer.y - 60)
    expect(DEFAULT_KOI_SETTINGS.attractRadius).toBeGreaterThan(far)

    // 20 seconds. A calm koi crosses a pond at a stroll, not a sprint — the
    // earlier version of this test allowed 6 seconds, which only passed
    // because the fish was moving twice as fast as it should have been.
    const after = run(corner, pointer, 1200)
    expect(Math.hypot(pointer.x - after.head.x, pointer.y - after.head.y)).toBeLessThan(far * 0.4)
  })

  it('needs no click — a pointer position is the entire input', () => {
    // There is no button, tap or key anywhere in the signature.
    const koi = createKoi({ x: 500, y: 300 }, 0, DEFAULT_SEGMENTS, 0.5)
    const after = run(koi, { x: 200, y: 500 }, 200)
    expect(Math.hypot(200 - after.head.x, 500 - after.head.y)).toBeLessThan(
      Math.hypot(200 - 500, 500 - 300),
    )
  })

  it('keeps swimming with no pointer at all', () => {
    const koi = createKoi({ x: 500, y: 300 }, 0.7, DEFAULT_SEGMENTS, 0.5)
    const after = run(koi, null, 180)
    expect(Math.hypot(after.head.x - 500, after.head.y - 300)).toBeGreaterThan(20)
  })

  it('hovers near the pointer instead of overshooting past it', () => {
    const koi = createKoi({ x: 500, y: 300 }, 0, DEFAULT_SEGMENTS, 0.5)
    const pointer = { x: 520, y: 310 }
    let current = koi
    const rng = seeded(3)
    let worst = 0
    for (let i = 0; i < 600; i++) {
      current = stepKoi(current, [], pointer, BOUNDS, 1 / 60, DEFAULT_KOI_SETTINGS, rng)
      if (i > 200) {
        worst = Math.max(worst, Math.hypot(pointer.x - current.head.x, pointer.y - current.head.y))
      }
    }
    expect(worst).toBeLessThan(320)
  })
})

describe('stepKoi — burst and glide', () => {
  it('speeds up in bursts and coasts between them', () => {
    // Constant speed is the thing that makes a fish look like a cursor.
    const koi = createKoi({ x: 200, y: 300 }, 0, DEFAULT_SEGMENTS, 0.5)
    let current = koi
    const rng = seeded(11)
    const speeds: number[] = []
    for (let i = 0; i < 600; i++) {
      current = stepKoi(current, [], { x: 800, y: 300 }, BOUNDS, 1 / 60, DEFAULT_KOI_SETTINGS, rng)
      speeds.push(current.speed)
    }
    const fastest = Math.max(...speeds)
    const slowest = Math.min(...speeds)
    expect(fastest).toBeGreaterThan(slowest * 1.8)
  })

  it('beats its tail hardest right after a burst', () => {
    const koi = createKoi({ x: 200, y: 300 }, 0, DEFAULT_SEGMENTS, 0.5)
    const rng = seeded(5)
    let current = { ...koi, tailEnergy: 0, dartCooldown: 0 }
    current = stepKoi(current, [], null, BOUNDS, 1 / 60, DEFAULT_KOI_SETTINGS, rng)
    const justDarted = current.tailEnergy
    for (let i = 0; i < 40; i++) {
      current = stepKoi(current, [], null, BOUNDS, 1 / 60, DEFAULT_KOI_SETTINGS, () => 0.99)
    }
    expect(justDarted).toBeGreaterThan(current.tailEnergy)
  })

  it('beats slowly enough to read as a sweep, not a flicker', () => {
    // Above roughly 3Hz the tail crosses character cells faster than the grid
    // can describe it and the motion reads as buzzing. An earlier version ran
    // at 2.1Hz idle and 9.6Hz mid-burst, which looked like jitter.
    const idleHz = DEFAULT_KOI_SETTINGS.baseBeat
    const burstHz = DEFAULT_KOI_SETTINGS.baseBeat + DEFAULT_KOI_SETTINGS.dartBeat
    expect(idleHz).toBeLessThanOrEqual(1.2)
    expect(burstHz).toBeLessThanOrEqual(3)

    // And confirm the phase actually advances at that rate over a second.
    const koi = createKoi({ x: 500, y: 300 }, 0, DEFAULT_SEGMENTS, 0.5)
    let current = { ...koi, tailPhase: 0, tailEnergy: 0, dartCooldown: 99 }
    for (let i = 0; i < 60; i++) {
      current = stepKoi(current, [], null, BOUNDS, 1 / 60, DEFAULT_KOI_SETTINGS, () => 0.5)
    }
    const beatsInOneSecond = current.tailPhase / (Math.PI * 2)
    expect(beatsInOneSecond).toBeLessThanOrEqual(1.2)
  })

  it('carries about one wavelength on the body, not several', () => {
    // Two wiggles at once reads as buzzing rather than swimming.
    const straightSpine = Array.from({ length: DEFAULT_SEGMENTS }, (_, i) => ({ x: 500 - i * 18, y: 300 }))
    const out = flutterSpine(straightSpine, 0, 1, 15)
    const offsets = out.map((p, i) => p.y - straightSpine[i]!.y)
    let crossings = 0
    for (let i = 1; i < offsets.length; i++) {
      if (Math.abs(offsets[i]!) > 0.15 && Math.abs(offsets[i - 1]!) > 0.15 &&
          Math.sign(offsets[i]!) !== Math.sign(offsets[i - 1]!)) crossings++
    }
    expect(crossings).toBeLessThanOrEqual(2)
  })

  it('always advances the tail phase, even while gliding', () => {
    const koi = createKoi({ x: 500, y: 300 }, 0, DEFAULT_SEGMENTS, 0.5)
    const a = stepKoi({ ...koi, tailEnergy: 0, dartCooldown: 99 }, [], null, BOUNDS, 1 / 60)
    expect(a.tailPhase).toBeGreaterThan(koi.tailPhase)
  })

  it('never exceeds its top speed', () => {
    let koi = createKoi({ x: 50, y: 50 }, 0, DEFAULT_SEGMENTS, 0.5)
    const rng = seeded(2)
    for (let i = 0; i < 900; i++) {
      koi = stepKoi(koi, [], { x: 900, y: 550 }, BOUNDS, 1 / 60, DEFAULT_KOI_SETTINGS, rng)
      expect(koi.speed).toBeLessThanOrEqual(DEFAULT_KOI_SETTINGS.maxSpeed + 1e-6)
    }
  })
})

describe('stepKoi — fluidity', () => {
  it('drives speed from the tail stroke, not from a shove', () => {
    // Speed should surge and ease with the sweep, twice per beat. An instant
    // impulse plus a waving tail are two unrelated animations, and the eye
    // reads the tail as decoration; tying them together is what makes the
    // fish look like it is pushing itself along.
    const koi = createKoi({ x: 500, y: 300 }, 0, DEFAULT_SEGMENTS, 0.5)
    let current = { ...koi, tailEnergy: 1, dartCooldown: 99 }
    const speeds: number[] = []
    for (let i = 0; i < 240; i++) {
      current = stepKoi(current, [], null, BOUNDS, 1 / 60, DEFAULT_KOI_SETTINGS, () => 0.5)
      speeds.push(current.speed)
    }
    // Count direction changes: a stroke-driven speed oscillates, a decaying
    // impulse only ever falls.
    let reversals = 0
    for (let i = 2; i < speeds.length; i++) {
      const before = speeds[i - 1]! - speeds[i - 2]!
      const after = speeds[i]! - speeds[i - 1]!
      if (Math.sign(before) !== Math.sign(after)) reversals++
    }
    expect(reversals).toBeGreaterThan(3)
  })

  it('keeps swimming gently without ever darting', () => {
    // Idle tail beating alone must be enough to move it, or the fish stalls
    // between bursts and looks like it is being dragged.
    const koi = createKoi({ x: 500, y: 300 }, 0, DEFAULT_SEGMENTS, 0.5)
    let current = { ...koi, tailEnergy: 0, dartCooldown: 1e9, speed: 0 }
    for (let i = 0; i < 300; i++) {
      current = stepKoi(current, [], null, BOUNDS, 1 / 60, DEFAULT_KOI_SETTINGS, () => 0.5)
    }
    expect(current.speed).toBeGreaterThan(5)
    expect(current.speed).toBeLessThan(45)
  })

  it('carries momentum through a turn instead of stopping dead', () => {
    // A fixed turn-rate clamp turns at exactly one speed and halts the
    // instant it arrives, which is the most mechanical thing a creature can
    // do. A damped spring keeps rotating briefly after the error closes.
    const koi = createKoi({ x: 500, y: 300 }, 0, DEFAULT_SEGMENTS, 0.5)
    let current = { ...koi, tailEnergy: 1, dartCooldown: 99 }
    // Ask for a hard turn, then let it settle.
    for (let i = 0; i < 30; i++) {
      current = stepKoi(current, [], { x: 500, y: 40 }, BOUNDS, 1 / 60, DEFAULT_KOI_SETTINGS, () => 0.5)
    }
    expect(Math.abs(current.angularVelocity)).toBeGreaterThan(0.05)
  })

  it('never spins faster than its turn ceiling', () => {
    let koi = createKoi({ x: 500, y: 300 }, 0, DEFAULT_SEGMENTS, 0.5)
    const rng = seeded(31)
    for (let i = 0; i < 600; i++) {
      // Whip the target from side to side to provoke the worst case.
      const target = i % 20 < 10 ? { x: 60, y: 60 } : { x: 940, y: 540 }
      koi = stepKoi(koi, [], target, BOUNDS, 1 / 60, DEFAULT_KOI_SETTINGS, rng)
      expect(Math.abs(koi.angularVelocity)).toBeLessThanOrEqual(DEFAULT_KOI_SETTINGS.turnRate + 1e-6)
    }
  })

  it('has no angular velocity at rest', () => {
    expect(createKoi({ x: 0, y: 0 }, 0, 10, 0).angularVelocity).toBe(0)
  })
})

describe('stepKoi — constraints', () => {
  it('stays inside the pond', () => {
    let koi = createKoi({ x: 500, y: 300 }, 0, DEFAULT_SEGMENTS, 0.5)
    const rng = seeded(13)
    for (let i = 0; i < 2000; i++) {
      koi = stepKoi(koi, [], { x: -2000, y: -2000 }, BOUNDS, 1 / 60, DEFAULT_KOI_SETTINGS, rng)
      expect(koi.head.x).toBeGreaterThanOrEqual(0)
      expect(koi.head.y).toBeGreaterThanOrEqual(0)
      expect(koi.head.x).toBeLessThanOrEqual(BOUNDS.width)
      expect(koi.head.y).toBeLessThanOrEqual(BOUNDS.height)
    }
  })

  it('does not teleport after a stalled tab hands it a huge delta', () => {
    const koi = createKoi({ x: 500, y: 300 }, 0, DEFAULT_SEGMENTS, 0.5)
    const jumped = stepKoi(koi, [], { x: 900, y: 550 }, BOUNDS, 30)
    expect(Math.hypot(jumped.head.x - 500, jumped.head.y - 300)).toBeLessThan(
      DEFAULT_KOI_SETTINGS.maxSpeed * 0.05 + 1,
    )
  })

  it('never produces NaN', () => {
    let koi = createKoi({ x: 500, y: 300 }, 0, DEFAULT_SEGMENTS, 0.5)
    const rng = seeded(17)
    for (let i = 0; i < 800; i++) {
      koi = stepKoi(koi, [], i % 3 ? { x: 400, y: 200 } : null, BOUNDS, 1 / 60, DEFAULT_KOI_SETTINGS, rng)
    }
    expect(Number.isFinite(koi.head.x)).toBe(true)
    expect(Number.isFinite(koi.heading)).toBe(true)
    expect(Number.isFinite(koi.speed)).toBe(true)
    for (const p of koi.spine) expect(Number.isFinite(p.x)).toBe(true)
  })
})

describe('koiSilhouette', () => {
  const koi = createKoi({ x: 500, y: 300 }, 0, DEFAULT_SEGMENTS, 0.4)

  it('produces more blobs than it has spine points — body plus fins', () => {
    const stamps = koiSilhouette(koi, DEFAULT_BODY_RADIUS)
    expect(stamps.length).toBeGreaterThan(DEFAULT_SEGMENTS)
  })

  it('puts the tail fin behind the head, not in front', () => {
    // Fish points along +x, so the fin must sit at lower x than the head.
    const stamps = koiSilhouette(koi, DEFAULT_BODY_RADIUS)
    const furthestBack = Math.min(...stamps.map((s) => s.x))
    expect(furthestBack).toBeLessThan(koi.head.x)
  })

  it('keeps every blob finite and positive', () => {
    for (const s of koiSilhouette(koi, DEFAULT_BODY_RADIUS)) {
      expect(Number.isFinite(s.x)).toBe(true)
      expect(Number.isFinite(s.y)).toBe(true)
      expect(s.radius).toBeGreaterThan(0)
      expect(s.strength).toBeGreaterThan(0)
      expect(s.tint).toBeGreaterThanOrEqual(0)
      expect(s.tint).toBeLessThanOrEqual(1)
    }
  })

  it('moves as the tail beats', () => {
    const a = koiSilhouette({ ...koi, tailPhase: 0, tailEnergy: 1 }, DEFAULT_BODY_RADIUS)
    const b = koiSilhouette({ ...koi, tailPhase: Math.PI, tailEnergy: 1 }, DEFAULT_BODY_RADIUS)
    const moved = a.some((s, i) => Math.abs(s.y - b[i]!.y) > 1)
    expect(moved).toBe(true)
  })

  it('survives a two-point spine without fins', () => {
    const stubby = { ...koi, spine: [{ x: 10, y: 10 }, { x: 0, y: 10 }] }
    expect(() => koiSilhouette(stubby, 20)).not.toThrow()
  })
})
