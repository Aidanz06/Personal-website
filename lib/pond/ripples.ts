/**
 * Ripples: expanding rings left by the cursor and by the koi.
 */

export type Ripple = {
  x: number
  y: number
  /** When it started, in the same seconds-based clock as the water. */
  startedAt: number
  /** Initial strength. Cursor ripples are stronger than fish wakes. */
  strength: number
}

export type RippleSettings = {
  /** How fast the ring travels outward, px/second. */
  speed: number
  /** Seconds until a ripple has faded to nothing. */
  life: number
  /** Thickness of the ring in px — how sharp the crest reads. */
  width: number
}

export const DEFAULT_RIPPLE_SETTINGS: RippleSettings = {
  speed: 90,
  life: 2.4,
  width: 26,
}

/** True once a ripple has outlived its usefulness and can be discarded. */
export function isRippleExpired(
  ripple: Ripple,
  now: number,
  settings: RippleSettings = DEFAULT_RIPPLE_SETTINGS,
): boolean {
  return now - ripple.startedAt >= settings.life
}

/**
 * How much one ripple lifts the surface at a point.
 *
 * The ring is a gaussian centred on the expanding wavefront rather than a
 * plain sine, so a ripple is a single travelling crest instead of an endless
 * train of them filling the pond. Two decays multiply: one with age, so the
 * ripple dies out, and one with the gaussian, so it only exists near its
 * own wavefront.
 *
 * Returns a signed value — ripples can pull the surface down as well as up.
 */
export function rippleContribution(
  ripple: Ripple,
  x: number,
  y: number,
  now: number,
  settings: RippleSettings = DEFAULT_RIPPLE_SETTINGS,
): number {
  const age = now - ripple.startedAt
  if (age < 0 || age >= settings.life) return 0

  const dx = x - ripple.x
  const dy = y - ripple.y
  const distance = Math.sqrt(dx * dx + dy * dy)

  const front = age * settings.speed
  const offset = distance - front

  // Outside the ring entirely — by far the common case, so bail before the
  // exponentials.
  if (Math.abs(offset) > settings.width * 3) return 0

  const ring = Math.exp(-(offset * offset) / (2 * settings.width * settings.width))
  const fade = 1 - age / settings.life

  // The crest leads and a shallow trough follows, which is what makes it
  // read as a ripple rather than a glowing halo.
  const shape = Math.cos((offset / settings.width) * 1.6)

  return ripple.strength * ring * fade * fade * shape
}

/** Combined lift from every live ripple at a point. */
export function ripplesAt(
  ripples: readonly Ripple[],
  x: number,
  y: number,
  now: number,
  settings: RippleSettings = DEFAULT_RIPPLE_SETTINGS,
): number {
  let total = 0
  for (const ripple of ripples) {
    total += rippleContribution(ripple, x, y, now, settings)
  }
  return total
}
