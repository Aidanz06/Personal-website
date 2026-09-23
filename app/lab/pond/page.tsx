import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { PondBench } from './PondBench'

export const metadata: Metadata = {
  title: 'pond lab',
  robots: { index: false, follow: false },
}

/**
 * Dev-only tuning bench for the ASCII koi pond. 404s in production, the same
 * way /lab does.
 */
export default function PondLabPage() {
  if (process.env.NODE_ENV === 'production') notFound()

  return (
    <main className="mx-auto w-full max-w-[1200px] px-2.5 py-3">
      <h1 className="font-display text-heading">koi pond lab</h1>
      <p className="mt-1 max-w-column text-small text-muted">
        dev only. move the pointer over the water — the fish are attracted to
        it, so you should never have to chase one. the fps readout shows how
        many cells actually had to be redrawn each frame; that number is what
        makes per-frame character drawing affordable.
      </p>
      <div className="mt-3">
        <PondBench />
      </div>
    </main>
  )
}
