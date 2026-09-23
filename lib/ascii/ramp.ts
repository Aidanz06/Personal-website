/**
 * Mapping a cell's brightness to a character.
 */

/**
 * Index into the ramp for a given luminance.
 *
 * The direction is the whole trick. On this site the ground is off-white and
 * the characters are near-black ink, so a character's *density* controls how
 * dark that cell reads: '@' deposits a lot of ink, '.' almost none.
 *
 * That means brightness has to be inverted. A DARK part of the photograph
 * needs a DENSE character, and a BRIGHT part needs a sparse one — otherwise
 * the render comes out as a photographic negative.
 *
 * So with the default ramp '.:-=+*#%@' (sparse -> dense):
 *   luminance 0 (black pixel) -> last character  '@'
 *   luminance 1 (white pixel) -> first character '.'
 *
 * To flip the mapping for a light-on-dark ground, reverse the ramp string
 * rather than changing this function.
 */
export function rampIndex(luminance: number, rampLength: number): number {
  if (rampLength <= 0) return 0
  const lum = Number.isFinite(luminance)
    ? luminance < 0
      ? 0
      : luminance > 1
        ? 1
        : luminance
    : 0
  const last = rampLength - 1
  const i = Math.round((1 - lum) * last)
  return i < 0 ? 0 : i > last ? last : i
}

/** The character a cell of this brightness should draw. */
export function rampChar(luminance: number, ramp: string): string {
  if (ramp.length === 0) return ' '
  return ramp[rampIndex(luminance, ramp.length)] ?? ' '
}

/**
 * Precompute the ramp character for every cell once, so the per-frame path
 * never touches this logic. Luminance per cell is fixed for a given image at
 * a given size; only the blend factor changes as the pointer moves.
 */
export function rampGrid(luminances: Float32Array, ramp: string): string[] {
  const out = new Array<string>(luminances.length)
  for (let i = 0; i < luminances.length; i++) {
    out[i] = rampChar(luminances[i] ?? 0, ramp)
  }
  return out
}
