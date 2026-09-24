import type { Metadata } from 'next'
import Link from 'next/link'
import { BackLink } from '@/components/BackLink'
import { PondBackdrop } from '@/components/PondBackdrop'
import { ThemeMenu } from '@/components/ThemeMenu'

export const metadata: Metadata = {
  title: 'not found',
}

/**
 * A mistyped or stale link, in the pond like every other page.
 *
 * It used to be Next's unstyled default: "404: This page could not be found"
 * on a plain ground, with no pond and no way home. The critique of
 * 2026-09-24 (second run) flagged it. Same chrome as the inner pages, the
 * same quiet water, and the same way back up the homepage's floor offers.
 */
export default function NotFound() {
  return (
    <>
      <PondBackdrop />
      <main className="column py-3">
        <div className="flex items-baseline gap-2">
          <BackLink />
          <ThemeMenu />
        </div>
        <div className="over-water mt-4">
          <h1 className="font-display text-name font-normal">nothing here</h1>
          <p className="mt-1 text-muted">this part of the pond is empty.</p>
          <p className="mt-3 font-mono text-small">
            <Link href="/" className="hit-area text-muted">
              ↑ back to the surface
            </Link>
          </p>
        </div>
      </main>
    </>
  )
}
