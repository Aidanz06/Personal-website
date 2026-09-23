import { AsciiImage } from '@/components/AsciiImage'

/**
 * The homepage ASCII header.
 *
 * The height is set by --header-height (see globals.css), which is fluid so
 * the availability line below it stays above the fold at 375px. Reserving
 * the space in CSS rather than letting the image size the box means the
 * renderer causes no layout shift when it initialises.
 */
export function HeaderSlot() {
  return (
    <div>
      <div className="h-(--header-height) w-full border-b border-rule">
        <AsciiImage
          src="/header-placeholder.png"
          alt="[header photograph — placeholder test pattern, aidan to choose a real source image]"
          className="h-full w-full"
        />
      </div>
      <p className="mt-1 font-mono text-small text-muted">
        [header photo — placeholder test pattern. pick a real one in /lab]
      </p>
    </div>
  )
}
