/**
 * Choosing which way to render, from what the browser can actually do.
 */

export type RenderMode =
  /** Leave the plain <img> alone: no canvas, no animation, photo fully visible. */
  | 'static'
  /** Resolve point follows the pointer. */
  | 'pointer'
  /** No pointer to follow, so the resolve point drifts on its own. */
  | 'drift'

export type Capabilities = {
  supportsCanvas: boolean
  prefersReducedMotion: boolean
  /** A pointer that can hover precisely — a mouse or trackpad, not a finger. */
  hasFinePointer: boolean
}

/**
 * Order matters here, and each branch is a requirement rather than a
 * preference:
 *
 *  1. No canvas -> nothing to enhance with, so the untouched <img> stands.
 *  2. Reduced motion -> the spec calls for "fully resolved and static", and
 *     the fully resolved version of this image IS the photograph. Falling
 *     back to the plain <img> satisfies it exactly and moves nothing.
 *  3. Fine pointer -> follow it.
 *  4. Otherwise (touch) -> drift, because a coarse pointer has no hover. A
 *     touch visitor who never taps would otherwise be shown a dead rectangle.
 *
 * Note there is no 'js disabled' capability: that case never reaches this
 * function. The <img> is server-rendered and the canvas is only ever added by
 * client code, so if JS fails the photograph is simply what's on the page.
 */
export function selectRenderMode(capabilities: Capabilities): RenderMode {
  if (!capabilities.supportsCanvas) return 'static'
  if (capabilities.prefersReducedMotion) return 'static'
  return capabilities.hasFinePointer ? 'pointer' : 'drift'
}
