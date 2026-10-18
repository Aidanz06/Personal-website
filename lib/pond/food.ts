/**
 * Feeding the fish: food carried from the bucket (FoodBucket.tsx) drops
 * into the water as a few pellets, and the koi comes over and eats them.
 *
 * Pellets are written into the same field as everything else (the One Grid
 * Rule), in the stones' monochrome: colour belongs to living things, and
 * food is not one. They live in world coordinates beside the koi and the
 * ripples, not in the field, so a grid rebuild keeps them.
 *
 * The tap arrives through a module-level queue, the same way a page-change
 * splash does (see splash.ts): the canvas owns a frame loop that never
 * re-renders, and the click is handled somewhere else in the tree.
 *
 * Pure apart from the queue, so the whole meal can be tested without a
 * browser.
 */

import type { Vec } from './koi'

export type Pellet = {
  /** World coordinates, in pixels: x across the pond, y down the document. */
  x: number
  y: number
  /** Seconds, on the pond's own clock. */
  droppedAt: number
}

/** Pellets in one tap. A handful reads as food; one reads as a speck. */
export const PELLETS_PER_DROP = 3
/** How far apart a drop lands, in pixels. */
export const DROP_SCATTER = 18
/** Most pellets in the water at once; the oldest sink first. */
export const MAX_PELLETS = 12
/**
 * How long an uneaten pellet floats before it has sunk out of sight. Long
 * enough for the fish to cross a screen at its calm pace and find it.
 */
export const PELLET_LIFETIME_S = 30
/** The last part of its life a pellet spends fading as it sinks. */
const SINK_S = 4

// --- the queue ---------------------------------------------------------------

type FeedPoint = { xFraction: number; yFraction: number }

let queue: FeedPoint[] = []

/**
 * Drop food where the visitor tapped, in viewport pixels. Stored as
 * fractions of the viewport, which the pond turns back into its own
 * coordinates on its next frame.
 */
export function requestFeedAt(clientX: number, clientY: number): void {
  if (typeof window === 'undefined') return
  queue.push({ xFraction: clientX / window.innerWidth, yFraction: clientY / window.innerHeight })
}

/** Everything requested since the last frame, in world coordinates. */
export function drainFeeds(width: number, height: number, worldY: number): Vec[] {
  const points = queue.map((p) => ({ x: width * p.xFraction, y: worldY + height * p.yFraction }))
  queue = []
  return points
}

// --- the pellets -------------------------------------------------------------

/** A tap's worth of pellets, scattered a little around where it landed. */
export function dropPellets(
  pellets: readonly Pellet[],
  at: Vec,
  seconds: number,
  random: () => number,
): Pellet[] {
  const dropped: Pellet[] = []
  for (let i = 0; i < PELLETS_PER_DROP; i++) {
    const angle = random() * Math.PI * 2
    const distance = Math.sqrt(random()) * DROP_SCATTER
    dropped.push({
      x: at.x + Math.cos(angle) * distance,
      y: at.y + Math.sin(angle) * distance,
      droppedAt: seconds,
    })
  }
  return [...pellets, ...dropped].slice(-MAX_PELLETS)
}

/** Pellets that have sunk out of sight are gone. */
export function stepPellets(pellets: readonly Pellet[], seconds: number): Pellet[] {
  return pellets.filter((p) => seconds - p.droppedAt < PELLET_LIFETIME_S)
}

/** How visible a pellet still is, 1 while floating and falling to 0 as it sinks. */
export function pelletPresence(pellet: Pellet, seconds: number): number {
  const left = PELLET_LIFETIME_S - (seconds - pellet.droppedAt)
  if (left <= 0) return 0
  return Math.min(1, left / SINK_S)
}

/** The pellet the fish should go for: the closest one. */
export function nearestPellet(head: Vec, pellets: readonly Pellet[]): Pellet | null {
  let best: Pellet | null = null
  let bestDistance = Infinity
  for (const pellet of pellets) {
    const distance = Math.hypot(pellet.x - head.x, pellet.y - head.y)
    if (distance < bestDistance) {
      best = pellet
      bestDistance = distance
    }
  }
  return best
}

/**
 * Whatever is within reach of the fish's mouth is eaten.
 *
 * The reach is generous on purpose: the fish circles a target rather than
 * landing on it (it eases off within 140px, see stepKoi), so a mouth-sized
 * radius would leave it orbiting a pellet it can never quite touch.
 */
export function eatPellets(
  pellets: readonly Pellet[],
  head: Vec,
  reach: number,
): { remaining: Pellet[]; eaten: Pellet[] } {
  const remaining: Pellet[] = []
  const eaten: Pellet[] = []
  for (const pellet of pellets) {
    if (Math.hypot(pellet.x - head.x, pellet.y - head.y) <= reach) eaten.push(pellet)
    else remaining.push(pellet)
  }
  return { remaining, eaten }
}

// --- where food can be dropped ----------------------------------------------

/**
 * What is not the water: anything interactive, anything that is
 * words or a picture, and the inner pages' article. The canvas is never
 * hit-tested (DESIGN.md); a tap that lands on the page's own background is
 * a tap on the water, because the water is all that is drawn there.
 */
export const NOT_WATER = [
  'a',
  'button',
  'input',
  'textarea',
  'select',
  'label',
  'summary',
  '[role="menu"]',
  '[data-rock]',
  'img',
  'video',
  'figure',
  'p',
  'h1',
  'h2',
  'h3',
  'h4',
  'li',
  'blockquote',
  'pre',
  '.over-water',
].join(', ')

/** Whether a tap on this element, with food in hand, drops it in the water. */
export function isWaterTarget(target: { closest(selector: string): unknown } | null): boolean {
  return target !== null && !target.closest(NOT_WATER)
}

/**
 * Something open that a tap on the water closes: a pinned picture (see
 * usePinDismissal) or the theme menu. That tap is for closing it, and should
 * not also drop the food.
 */
export const OPEN_SOMETHING = '[data-rock][aria-pressed="true"], [role="menu"]'
