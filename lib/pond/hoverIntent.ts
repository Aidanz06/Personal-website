/**
 * Whether a pointer entering a rock was the visitor's doing. A mouse resting
 * still while the page scrolls "enters" whatever passes beneath it; that is
 * the page moving, not the visitor pointing. See hoverIntent.test.ts.
 */
export function hoverIsIntended(times: { lastPointerMove: number; lastScroll: number }): boolean {
  return times.lastPointerMove >= times.lastScroll
}
