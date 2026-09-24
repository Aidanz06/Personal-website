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
 * A stone as it is written down: everything except how deep it sits.
 *
 * Depth is derived rather than authored, because it is the one property that
 * cannot be chosen independently — adding or removing a stone changes where
 * every stone below it belongs, how far down the photographs start, and how
 * deep the pond has to be. Hand-tuning four numbers every time the list
 * changes is how the pond and the links drift apart.
 */
export type StoneDefinition = Omit<StoneSpec, 'depthVh'>

/** Where the first stone sits. Below the fold, so the name gets the surface. */
export const FIRST_STONE_VH = 0.95
/**
 * Depth between consecutive stones. Also the gap before the photographs.
 *
 * Was 0.7; tightened 20% so the navigation reads as one group you descend
 * past rather than three separate screens.
 */
export const STONE_STEP_VH = 0.56
/** Empty water below the last stone, so the navigation does not end abruptly. */
export const STONE_TAIL_VH = 0.6

/**
 * Ordered top to bottom. Tailor Studio comes first because it is the page
 * the rest of the site is arranged around.
 *
 * To add a stone: add an entry, pick an `xFraction` at least 0.15 away from
 * its neighbours' so the path still reads as a path, and stop. The depth,
 * the pond's total height and where the photographs begin all follow.
 */
export const HOME_STONE_DEFINITIONS: readonly StoneDefinition[] = [
  {
    href: '/tailor-studio',
    label: 'tailor studio',
    note: 'the thing i built',
    xFraction: 0.3,
    radiusFraction: 0.1,
  },
  {
    href: '/about',
    label: 'about',
    note: 'and photography',
    xFraction: 0.66,
    radiusFraction: 0.09,
  },
]

/** The definitions with their depths filled in: evenly spaced down the pond. */
export const HOME_STONES: readonly StoneSpec[] = HOME_STONE_DEFINITIONS.map(
  (definition, index) => ({
    ...definition,
    depthVh: FIRST_STONE_VH + index * STONE_STEP_VH,
  }),
)

/** How deep the last stone sits. Everything below the navigation keys off it. */
export const DEEPEST_STONE_VH =
  HOME_STONES.length > 0
    ? HOME_STONES[HOME_STONES.length - 1]!.depthVh
    : FIRST_STONE_VH

/** Total scroll depth, in viewport heights, before any photographs. */
export const POND_DEPTH_VH = DEEPEST_STONE_VH + STONE_TAIL_VH

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
