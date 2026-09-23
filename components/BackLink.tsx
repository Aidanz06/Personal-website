import Link from 'next/link'

/**
 * The only navigation on the site besides the homepage's inline links.
 * There is deliberately no persistent nav bar — it would compete with the
 * ASCII header and add furniture to a design whose whole argument is that it
 * has none.
 */
export function BackLink() {
  return (
    <Link href="/" className="text-small">
      ← aidan zheng
    </Link>
  )
}
