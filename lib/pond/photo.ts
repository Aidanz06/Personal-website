/**
 * Photographs carried by the koi.
 *
 * The point of the pond's compositor is that a fish and a photograph are not
 * different kinds of thing — both are brightness written into the same field.
 * So a koi opening into a photograph is a crossfade between two sources, not
 * a separate animation with its own machinery.
 *
 * Nothing here navigates anywhere. Approaching the fish is the whole
 * interaction.
 */

/** A photograph reduced to brightness, once, at a fixed resolution. */
export type PhotoGrid = {
  cols: number
  rows: number
  /** One luminance per cell, row-major. */
  luminance: Float32Array
}

/**
 * Sample a photo grid with normalised coordinates.
 *
 * Nearest-neighbour, deliberately. The grid is sampled into a region whose
 * size changes every frame as the photograph opens, and resampling the source
 * at each new size would be both slower and blurrier than picking the nearest
 * cell — the output is going to be quantised to characters regardless.
 */
export function samplePhoto(photo: PhotoGrid, u: number, v: number): number {
  if (photo.cols <= 0 || photo.rows <= 0) return 0
  const col = Math.min(photo.cols - 1, Math.max(0, Math.floor(u * photo.cols)))
  const row = Math.min(photo.rows - 1, Math.max(0, Math.floor(v * photo.rows)))
  return photo.luminance[row * photo.cols + col] ?? 0
}

export type Rect = { x: number; y: number; width: number; height: number }

/**
 * Clamp to 0..1, treating a non-finite value as 0.
 *
 * `Math.max(0, NaN)` is NaN, so the obvious clamp does not actually clamp —
 * and a NaN reveal would propagate into the rect geometry and silently paint
 * nothing at all.
 */
function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0
  return n < 0 ? 0 : n > 1 ? 1 : n
}

/**
 * The region a photograph occupies as it opens, in pixels.
 *
 * Grows from roughly the fish's own footprint out to a target size, centred
 * on the fish and eased so it blooms open rather than scaling linearly. The
 * result is clamped inside the pond so a photograph never hangs off the edge
 * — which matters because the fish spends plenty of its time near one.
 */
export function revealRect(
  centreX: number,
  centreY: number,
  reveal: number,
  fishSize: number,
  targetWidth: number,
  targetHeight: number,
  bounds: { width: number; height: number },
): Rect {
  const t = clamp01(reveal)
  // easeOutCubic: most of the opening happens early, then it settles.
  const eased = 1 - Math.pow(1 - t, 3)

  const width = fishSize + (targetWidth - fishSize) * eased
  const height = fishSize + (targetHeight - fishSize) * eased

  // Keep it on screen. If the photo is wider than the pond, centre it rather
  // than jamming it against an edge.
  const x =
    width >= bounds.width
      ? (bounds.width - width) / 2
      : Math.min(bounds.width - width, Math.max(0, centreX - width / 2))
  const y =
    height >= bounds.height
      ? (bounds.height - height) / 2
      : Math.min(bounds.height - height, Math.max(0, centreY - height / 2))

  return { x, y, width, height }
}

/**
 * How much of the real photograph shows through, as opposed to its ASCII.
 *
 * Deliberately not linear with the reveal. The characters hold until the
 * photograph is most of the way open, then hand over quickly — so the
 * resolve reads as an image emerging from the text rather than the text
 * simply fading out, which is the same reason the header renderer crossfades
 * per cell instead of dissolving the whole thing.
 */
export function photoOpacity(reveal: number, handover = 0.62): number {
  const t = clamp01(reveal)
  if (t <= handover) return 0
  const u = (t - handover) / (1 - handover)
  return u * u * (3 - 2 * u)
}

/**
 * How willing the koi is to open a photograph, by depth.
 *
 * Zero at the surface, rising to one as the reader descends.
 *
 * This is a design rule before it is a technical one: the surface carries the
 * name and the line under it, and a photograph opening over them buries the
 * first thing anyone reads — muted grey text on a bright picture is
 * unreadable. Names at the surface, pictures in the depths.
 */
export function photoDepthFactor(scrollY: number, viewportHeight: number): number {
  if (!Number.isFinite(scrollY) || !Number.isFinite(viewportHeight) || viewportHeight <= 0) {
    return 0
  }
  // Nothing at all across the first screen, then a half-screen ramp.
  const start = viewportHeight * 0.55
  const end = viewportHeight * 1.05
  return clamp01((scrollY - start) / (end - start))
}

/**
 * The largest size a photograph may open to, respecting its aspect ratio.
 *
 * Constrains BOTH dimensions. Sizing on width alone is fine until the first
 * portrait photograph arrives, at which point it computes a height taller
 * than the screen and the picture runs off the top and bottom — and a
 * synthetic landscape test pattern never reveals that.
 */
export function fitWithin(
  aspect: number,
  maxWidth: number,
  maxHeight: number,
): { width: number; height: number } {
  const safeAspect = Number.isFinite(aspect) && aspect > 0 ? aspect : 1.5
  const w = Math.max(0, maxWidth)
  const h = Math.max(0, maxHeight)

  // Widest it can be before it gets too tall.
  const widthLimitedByHeight = h * safeAspect
  const width = Math.min(w, widthLimitedByHeight)

  return { width, height: width / safeAspect }
}

/**
 * How wide a photograph may open, for a given viewport.
 *
 * Not a fixed fraction. On a desktop 60% leaves the picture sitting in the
 * pond with water around it, which is the intent — but the same 60% on a
 * phone is 225 pixels, and at that size a photograph is a thumbnail rather
 * than something you can actually look at. A narrow screen has nothing else
 * competing for the space, so it gets nearly all of it.
 */
export function photoMaxWidth(viewportWidth: number): number {
  const w = Number.isFinite(viewportWidth) && viewportWidth > 0 ? viewportWidth : 0
  if (w === 0) return 0
  if (w < 640) return w * 0.88
  if (w < 1024) return w * 0.72
  return Math.min(w * 0.6, 640)
}

/**
 * Stretch a picture's tones across the whole range, for ASCII art.
 *
 * A photograph survives having a narrow range because the real image is
 * painted over its characters at the end. A picture that STAYS as characters
 * does not: an album cover that is mostly pale sky sits between 0.8 and 0.95,
 * which maps to the densest glyph everywhere and loses whatever is in the sky.
 * Stretching the picture's own range to 0..1 is what every ASCII-art tool
 * does first, because characters only have a handful of steps to spend.
 *
 * The range is taken from the 2nd and 98th percentiles rather than the
 * extremes, so one specular highlight or one black border pixel cannot
 * decide it. Order is preserved: it is the same picture with more contrast.
 */
export function stretchContrast(photo: PhotoGrid, low = 0.02, high = 0.98): PhotoGrid {
  const count = photo.luminance.length
  if (count === 0) return { ...photo, luminance: new Float32Array(0) }
  const sorted = Float32Array.from(photo.luminance).sort()
  const lo = sorted[Math.floor(low * (count - 1))]!
  const hi = sorted[Math.round(high * (count - 1))]!
  const span = hi - lo
  const out = new Float32Array(count)
  for (let i = 0; i < count; i++) {
    const value = photo.luminance[i]!
    out[i] = span > 1e-4 ? clamp01((value - lo) / span) : value
  }
  return { cols: photo.cols, rows: photo.rows, luminance: out }
}
