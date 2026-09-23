/**
 * Placeholder photography grid for /about.
 *
 * Twelve empty slots, sized and laid out as the real grid will be. The
 * ASCII-reactive version is explicitly out of scope for v0.5 — <AsciiImage>
 * is being built to support tiles like these, but nothing here is wired to
 * it yet.
 *
 * The hairline outlines are a placeholder affordance only. Once real images
 * land they fill the cells edge to edge and the borders come off, keeping
 * the "no boxes, no cards" rule intact.
 */
export function PhotoGrid({ count = 12 }: { count?: number }) {
  return (
    <div
      className="my-3 grid grid-cols-3 gap-1"
      role="list"
      aria-label="photography placeholder grid"
    >
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          role="listitem"
          className="flex aspect-square items-center justify-center border border-rule"
        >
          <span className="font-mono text-small text-muted">
            {String(i + 1).padStart(2, '0')}
          </span>
        </div>
      ))}
    </div>
  )
}
