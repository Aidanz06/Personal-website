/**
 * Which rock is open: the photo rocks on the homepage and the album rocks on
 * /listening share this.
 *
 * Two ways a rock can be open. Hovering or focusing it opens it while the
 * pointer or focus stays; clicking or tapping it pins it open. Whichever is
 * set wins, pinned first.
 *
 * The part that has to be right is closing, because on a phone one tap is
 * three events: the pointer "enters", the button takes focus, then the click.
 * The first version only unpinned on the second tap, and the focus left over
 * from the first tap still counted as hovering, so the picture stayed open
 * while `aria-pressed` said it wasn't. A click on the open rock now closes it
 * outright, whatever else is holding it.
 *
 * Pure, so the whole touch sequence can be tested without a browser.
 */

export type RockSelection = {
  /** Open because the pointer is over it or it has focus. */
  hovered: number | null
  /** Open because it was clicked or tapped. */
  pinned: number | null
}

export type RockEvent =
  | { type: 'enter' | 'focus' | 'leave' | 'blur' | 'click'; index: number }
  | { type: 'escape' }

export const initialRockSelection: RockSelection = { hovered: null, pinned: null }

export function rockSelection(state: RockSelection, event: RockEvent): RockSelection {
  switch (event.type) {
    case 'enter':
    case 'focus':
      return { ...state, hovered: event.index }
    case 'leave':
    case 'blur':
      return state.hovered === event.index ? { ...state, hovered: null } : state
    case 'click':
      // Clicking a PINNED rock closes it, and means it: hover and focus are
      // cleared too, or the tap that opened it keeps it open. Pinned, not
      // merely showing — a tap's own enter and focus have already opened the
      // rock by the time its click arrives, and that first click must pin it,
      // not close it again.
      if (state.pinned === event.index) return initialRockSelection
      return { ...state, pinned: event.index }
    case 'escape':
      return initialRockSelection
  }
}

/** The rock that is open, if any. */
export function activeRock(state: RockSelection): number | null {
  return state.pinned ?? state.hovered
}
