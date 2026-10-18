/**
 * Whether a pointer entering a rock was the visitor's doing. A mouse resting
 * still while the page scrolls "enters" whatever passes beneath it; that is
 * the page moving, not the visitor pointing. See hoverIntent.test.ts.
 */
export function hoverIsIntended(times: { lastPointerMove: number; lastScroll: number }): boolean {
  return times.lastPointerMove >= times.lastScroll
}

/**
 * Which mouse events over the rocks should open one.
 *
 * A mouseenter is checked with hoverIsIntended. Straight after a scroll the
 * enter can arrive before the move that caused it is recorded, so a turned-
 * away enter is remembered and the next real move over that rock opens it.
 * Only that once: re-opening on every move undid a click or Esc that had
 * just closed the rock under a resting pointer, and re-rendered the page on
 * every mousemove while another rock was pinned.
 */
export function hoverTracker(times: { lastPointerMove: number; lastScroll: number }) {
  let turnedAway: number | null = null
  return {
    enter(index: number): boolean {
      const intended = hoverIsIntended(times)
      turnedAway = intended ? null : index
      return intended
    },
    move(index: number): boolean {
      if (turnedAway !== index || !hoverIsIntended(times)) return false
      turnedAway = null
      return true
    },
    leave(index: number): void {
      if (turnedAway === index) turnedAway = null
    },
  }
}

export type HoverTracker = ReturnType<typeof hoverTracker>
