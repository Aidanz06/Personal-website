/**
 * The stepping stones: the site's navigation, laid out down the pond.
 *
 * A stone exists twice over — as a blob the canvas draws, and as a real
 * anchor element layered on top of it. Both read their position from the
 * same spec here, because the moment the two drift apart the page looks
 * broken and the link stops being where it appears to be.
 *
 * Depths are in viewport heights, so the descent works out the same on a
 * laptop and a phone.
 */

export type StoneSpec = {
  href: string
  label: string
  /** A short line under the label. Kept to a handful of words. */
  note: string
  /** Horizontal position as a fraction of the pond's width. */
  xFraction: number
  /** How far down, in viewport heights. */
  depthVh: number
  /** Radius as a fraction of the viewport's smaller dimension. */
  radiusFraction: number
}

/**
 * Ordered by depth. Tailor Studio comes first because it is the page the
 * whole site is built to get someone to read.
 */
export const HOME_STONES: readonly StoneSpec[] = [
  {
    href: '/tailor-studio',
    label: 'tailor studio',
    note: 'the thing i built',
    xFraction: 0.3,
    depthVh: 0.95,
    radiusFraction: 0.1,
  },
  {
    href: '/about',
    label: 'about',
    note: 'and photography',
    xFraction: 0.66,
    depthVh: 1.62,
    radiusFraction: 0.09,
  },
  {
    href: '/resume',
    label: 'resume',
    note: '',
    xFraction: 0.36,
    depthVh: 2.3,
    radiusFraction: 0.085,
  },
]

/** Total scroll depth, in viewport heights. Leaves room below the last stone. */
export const POND_DEPTH_VH = 3.05

/** The geometry any placeable rock needs, navigation stone or photo rock. */
export type Placeable = {
  xFraction: number
  depthVh: number
  radiusFraction: number
  /**
   * Smallest this rock may become on a narrow screen. Navigation stones keep
   * a generous floor because they are tap targets; photo rocks are allowed
   * to be genuinely small.
   */
  minRadius?: number
}

export type Placed<T extends Placeable = StoneSpec> = {
  spec: T
  /** Pixels from the left of the pond. */
  x: number
  /** Pixels from the top of the DOCUMENT, not the viewport. */
  worldY: number
  radius: number
}

export type PlacedStone = Placed<StoneSpec>

/**
 * Turn the specs into pixel positions for a given viewport.
 *
 * Called by the page, and the result is handed to both the canvas and the
 * link layer — one computation, two consumers, no chance of disagreement.
 */
export function placeStones<T extends Placeable>(
  specs: readonly T[],
  viewportWidth: number,
  viewportHeight: number,
): Placed<T>[] {
  const smaller = Math.min(viewportWidth, viewportHeight)
  return specs.map((spec) => ({
    spec,
    x: viewportWidth * spec.xFraction,
    worldY: viewportHeight * spec.depthVh,
    // Clamped so a rock stays a rock: tiny on a short window reads as a
    // speck, huge on a wide one swallows the pond.
    radius: Math.max(spec.minRadius ?? 46, Math.min(120, smaller * spec.radiusFraction)),
  }))
}
