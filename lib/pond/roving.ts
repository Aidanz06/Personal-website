/**
 * Moving between photo rocks with the arrow keys.
 *
 * The gallery used to be twenty-five Tab stops, one per rock, before the
 * footer — the critique's keyboard finding. It's one Tab stop now (a roving
 * tabindex): Tab enters the gallery on the rock last visited, the arrow keys
 * move between rocks in the order they sit in the pond, Home and End jump
 * to the ends, and Tab leaves.
 *
 * No wrapping: the gallery is a descent, and wrapping from the deepest rock
 * to the first would fling the page up eight screens.
 */
export function rovingNext(index: number, key: string, count: number): number | null {
  if (count <= 0) return null
  const last = count - 1
  switch (key) {
    case 'ArrowRight':
    case 'ArrowDown':
      return Math.min(last, index + 1)
    case 'ArrowLeft':
    case 'ArrowUp':
      return Math.max(0, index - 1)
    case 'Home':
      return 0
    case 'End':
      return last
    default:
      return null
  }
}
