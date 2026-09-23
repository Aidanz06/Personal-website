/**
 * The homepage ASCII header slot.
 *
 * Milestone 2 renders an empty reserved box; milestone 3 drops <AsciiImage>
 * in here. It exists as its own component so the height is committed to now
 * and the renderer cannot change the page's layout when it arrives — the
 * space is already reserved, so there is no layout shift.
 */
export function HeaderSlot() {
  return (
    <div
      className="h-(--header-height) w-full border-b border-rule"
      aria-hidden="true"
    >
      <p className="pt-1 font-mono text-small text-muted">
        [ascii header — milestone 3]
      </p>
    </div>
  )
}
