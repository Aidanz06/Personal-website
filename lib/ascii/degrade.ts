/**
 * Runtime quality degradation: coarsen the character grid when the page
 * cannot keep up.
 */

import { MIN_ACCEPTABLE_FPS } from './constants'

/**
 * Coarsen only when the frame rate falls meaningfully below the target, not
 * the moment it touches it.
 *
 * The PRD's 30fps is the floor of *acceptable*, so a display sitting exactly
 * on it is meeting the requirement, not failing it. Triggering at 30 has two
 * problems: a smoothed frame-rate estimate hovering around 30 dips under it
 * constantly, and degradation is one-way — nothing ever restores the finer
 * grid. Together those ratchet a 30Hz display down to the coarsest possible
 * rendering for no reason. The margin is what stops that.
 */
export const DEGRADE_BELOW_FPS = MIN_ACCEPTABLE_FPS - 4 // 26

/**
 * How many consecutive slow frames before acting. At 30fps this is about a
 * second and a half of genuine slowness — long enough that a single long
 * task, a garbage collection pause, or a scroll cannot trigger it.
 */
export const SUSTAINED_SLOW_FRAMES = 45

/** How much bigger each cell gets when coarsening. */
const GROWTH_FACTOR = 1.25

export type DegradeState = {
  /** Running count of consecutive slow frames. */
  slowFrames: number
  /** Current working cell size in CSS pixels. */
  cellSize: number
}

export type DegradeStep = DegradeState & {
  /** True on the single frame where the grid was just coarsened. */
  coarsened: boolean
}

/**
 * Advance the degradation state by one frame.
 *
 * Pure so it can be tested without a browser: given the same state and frame
 * rate it always returns the same next state, and it never touches a canvas.
 */
export function stepDegradation(
  state: DegradeState,
  fps: number,
  maxCellSize: number,
): DegradeStep {
  // Already as coarse as it is allowed to get — nothing further to do.
  if (state.cellSize >= maxCellSize) {
    return { slowFrames: 0, cellSize: state.cellSize, coarsened: false }
  }

  // A non-finite reading says nothing about performance. Treat it as fine
  // rather than as infinitely slow.
  const fastEnough = !Number.isFinite(fps) || fps >= DEGRADE_BELOW_FPS

  if (fastEnough) {
    // Decay rather than reset, so alternating fast/slow frames cannot creep
    // up to the threshold over time.
    return {
      slowFrames: Math.max(0, state.slowFrames - 1),
      cellSize: state.cellSize,
      coarsened: false,
    }
  }

  const slowFrames = state.slowFrames + 1
  if (slowFrames < SUSTAINED_SLOW_FRAMES) {
    return { slowFrames, cellSize: state.cellSize, coarsened: false }
  }

  // Math.ceil, not Math.round: at small cell sizes rounding can land back on
  // the same integer, which would spin without ever making progress.
  const grown = Math.min(maxCellSize, Math.ceil(state.cellSize * GROWTH_FACTOR))

  return { slowFrames: 0, cellSize: grown, coarsened: grown > state.cellSize }
}

/**
 * How much the drawing area has to change before the current cell size stops
 * being a judgement about *this* box and becomes a leftover about another one.
 */
export const RECALIBRATE_AREA_RATIO = 1.5

/**
 * Should degradation start over from the requested cell size?
 *
 * Degradation is one-way by design — nothing restores the finer grid — which
 * is fine while the box stays roughly the same size, and a trap when it does
 * not. A layout bug once made the pond's container the height of the whole
 * document for half a second. The grid went to about 666,000 cells, the
 * frame rate collapsed, the cell size ratcheted all the way to the ceiling,
 * and it stayed there long after the container snapped back: the pond
 * rendered in enormous characters for the rest of the session.
 *
 * The rule is that a measurement only describes the box it was taken in. A
 * large enough change in area invalidates it, so the fine grid is tried again
 * and degradation re-decides on the evidence.
 *
 * Area, not dimensions, because area is what the cost scales with — turning a
 * phone sideways swaps width and height and costs exactly the same.
 */
export function shouldRecalibrate(
  previous: { width: number; height: number },
  next: { width: number; height: number },
): boolean {
  const before = previous.width * previous.height
  const after = next.width * next.height
  if (!Number.isFinite(before) || !Number.isFinite(after)) return false
  // Nothing to compare against on the very first measurement.
  if (before <= 0) return false
  if (after <= 0) return false
  const ratio = after > before ? after / before : before / after
  return ratio >= RECALIBRATE_AREA_RATIO
}
