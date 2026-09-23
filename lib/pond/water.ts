/**
 * The water surface.
 *
 * A height field: for any point in the pond at any moment, how high is the
 * surface. There is no simulation and no state — the whole pond is a pure
 * function of position and time, which means it can be sampled at any
 * resolution, scrolled to any depth, and unit tested without a canvas.
 *
 * Three sine waves at unrelated frequencies and angles. Unrelated matters:
 * frequencies that share a common factor visibly repeat, and the eye finds
 * the tiling immediately.
 */

export type Wave = {
  /** How much this wave contributes, before normalisation. */
  amplitude: number
  /** Spatial frequency in radians per pixel, x and y. */
  kx: number
  ky: number
  /** Temporal frequency in radians per second. */
  omega: number
  /** Offset, so the waves do not all peak at the origin at t=0. */
  phase: number
}

/**
 * Wavelengths here are 150–320px, which at a ~9px cell is 17–35 characters
 * per swell. Much shorter and the water reads as noise rather than movement.
 */
export const DEFAULT_WAVES: readonly Wave[] = [
  { amplitude: 0.55, kx: 0.0200, ky: 0.0130, omega: 0.55, phase: 0.0 },
  { amplitude: 0.30, kx: -0.0130, ky: 0.0280, omega: 0.41, phase: 2.1 },
  { amplitude: 0.15, kx: 0.0410, ky: 0.0090, omega: 0.77, phase: 4.3 },
]

/**
 * Surface height at a point, normalised to -1..1 regardless of how many
 * waves are supplied or what their amplitudes are.
 */
export function waveHeight(
  x: number,
  y: number,
  timeSeconds: number,
  waves: readonly Wave[] = DEFAULT_WAVES,
): number {
  let total = 0
  let scale = 0
  for (const wave of waves) {
    total +=
      wave.amplitude *
      Math.sin(x * wave.kx + y * wave.ky + timeSeconds * wave.omega + wave.phase)
    scale += Math.abs(wave.amplitude)
  }
  if (scale === 0) return 0
  return total / scale
}

/**
 * Surface height converted to a brightness value.
 *
 * `base` is how visible still water is and `amplitude` is how much the swell
 * moves it. Both are deliberately small: the water is texture, not content.
 * The reference image works because the field is nearly empty and only the
 * fish are bright, so the default keeps water in the bottom fifth of the
 * range where the ramp only reaches its sparsest characters.
 */
export function waterLuminance(
  x: number,
  y: number,
  timeSeconds: number,
  base: number,
  amplitude: number,
  waves: readonly Wave[] = DEFAULT_WAVES,
): number {
  const h = waveHeight(x, y, timeSeconds, waves)
  const value = base + h * amplitude
  return value < 0 ? 0 : value > 1 ? 1 : value
}
