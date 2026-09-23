/**
 * Luminance: how bright a pixel is, on a 0..1 scale.
 */

/**
 * Perceived brightness of an sRGB pixel, 0 (black) to 1 (white).
 *
 * Uses the Rec. 709 weights (green counts for most of what the eye reads as
 * brightness, blue for very little) applied directly to the gamma-encoded
 * channel values.
 *
 * This is deliberately NOT the WCAG "relative luminance" formula, which
 * linearizes each channel first. Linear luminance answers "how much light is
 * this", which is the right question for contrast ratios and the wrong one
 * here: it drags midtones far darker than they look, and an ASCII render
 * built on it comes out muddy with the dense end of the ramp swallowing most
 * of the picture. The gamma-encoded weighted sum tracks perceived brightness,
 * which is what the density ramp is standing in for.
 *
 * `alpha` composites over the page ground rather than over black, so a
 * transparent PNG doesn't produce a solid block of dark characters.
 */
export function luminance(
  r: number,
  g: number,
  b: number,
  alpha = 255,
  groundLuminance = 1,
): number {
  const l = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
  const a = clamp01(alpha / 255)
  const composited = l * a + groundLuminance * (1 - a)
  return snapEndpoints(clamp01(composited))
}

/**
 * The Rec. 709 weights do not sum to exactly 1 in floating point, so pure
 * white comes out as 0.9999999999999999 rather than 1. Nothing visible
 * depends on the difference — 8-bit channels are 1/255 apart, four orders of
 * magnitude coarser — but the function promises a 0..1 range and callers are
 * entitled to hit both ends of it exactly.
 */
function snapEndpoints(n: number): number {
  const epsilon = 1e-9
  if (n > 1 - epsilon) return 1
  if (n < epsilon) return 0
  return n
}

/**
 * Convert a downsampled RGBA buffer into one luminance value per cell.
 *
 * The caller is expected to have already scaled the source image down to
 * exactly cols x rows using the canvas (the browser's own image scaling does
 * the box-filter averaging far faster than JS can), so this is a
 * straight one-pixel-per-cell pass.
 */
export function luminanceGrid(
  rgba: Uint8ClampedArray,
  cols: number,
  rows: number,
  groundLuminance = 1,
): Float32Array {
  const count = cols * rows
  const out = new Float32Array(count)
  for (let i = 0; i < count; i++) {
    const p = i * 4
    out[i] = luminance(
      rgba[p] ?? 0,
      rgba[p + 1] ?? 0,
      rgba[p + 2] ?? 0,
      rgba[p + 3] ?? 255,
      groundLuminance,
    )
  }
  return out
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0
  return n < 0 ? 0 : n > 1 ? 1 : n
}
