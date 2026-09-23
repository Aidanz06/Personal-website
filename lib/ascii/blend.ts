/**
 * How much of the real photograph shows through at a given point.
 */

/**
 * Classic smoothstep: 0 below edge0, 1 above edge1, and an S-curve between
 * them that starts and ends flat.
 *
 * The flat ends are the reason to prefer it over a straight line here. A
 * linear falloff has a visible crease at both radii — the eye catches the
 * sudden change in rate and the effect reads as a hard-edged circle dragged
 * around the page. Smoothstep's derivative is zero at both ends, so the
 * resolved area blends into the abstract area with no seam.
 */
export function smoothstep(edge0: number, edge1: number, x: number): number {
  if (!Number.isFinite(x)) return 0
  // Degenerate range: treat it as a hard step rather than dividing by zero.
  if (!(edge1 > edge0)) return x < edge0 ? 0 : 1
  const t = clamp01((x - edge0) / (edge1 - edge0))
  return t * t * (3 - 2 * t)
}

/**
 * Blend factor for a cell: 1 = draw the photograph, 0 = draw the character.
 *
 *   distance <= innerRadius   -> 1   (fully resolved)
 *   distance >= outerRadius   -> 0   (fully abstract)
 *   between                   -> smoothstep crossfade
 */
export function blendFactor(
  distance: number,
  innerRadius: number,
  outerRadius: number,
): number {
  return 1 - smoothstep(innerRadius, outerRadius, distance)
}

/**
 * Global multiplier that eases the whole effect out after the pointer leaves.
 *
 * Returns 1 at the moment of departure and 0 once exitEaseMs has elapsed,
 * on an ease-out curve so it drops away quickly and then settles, rather
 * than fading at a constant rate (which reads as a dimmer switch).
 */
export function exitStrength(elapsedMs: number, exitEaseMs: number): number {
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return 1
  if (!(exitEaseMs > 0)) return 0
  const t = clamp01(elapsedMs / exitEaseMs)
  // easeOutCubic, inverted: 1 -> 0
  return 1 - (1 - (1 - t) * (1 - t) * (1 - t))
}

function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n
}
