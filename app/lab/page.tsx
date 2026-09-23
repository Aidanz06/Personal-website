import { readdirSync } from 'node:fs'
import { extname, join } from 'node:path'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { LabBench } from './LabBench'

export const metadata: Metadata = {
  title: 'lab',
  robots: { index: false, follow: false },
}

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.avif', '.gif'])

/**
 * Dev-only tuning bench for <AsciiImage>.
 *
 * In a production build this calls notFound() during prerendering, so the
 * route ships as a 404 rather than as a page — the sliders and the candidate
 * photographs never reach the public site.
 *
 * The image list is read from public/lab/ at build time. Drop files in,
 * restart the dev server, and they appear.
 */
export default function LabPage() {
  if (process.env.NODE_ENV === 'production') notFound()

  let images: string[] = []
  try {
    images = readdirSync(join(process.cwd(), 'public', 'lab'))
      .filter((file) => IMAGE_EXTENSIONS.has(extname(file).toLowerCase()))
      .sort()
      .map((file) => `/lab/${file}`)
  } catch {
    images = []
  }

  return (
    <main className="mx-auto w-full max-w-[1400px] px-2.5 py-3">
      <h1 className="font-display text-heading">ascii renderer lab</h1>
      <p className="mt-1 max-w-column text-small text-muted">
        dev only — this route 404s in production. move the pointer over each
        image. the question this page answers is whether a stranger can tell
        what the photograph is at the abstract end, with the pointer away.
      </p>
      <div className="mt-4">
        <LabBench images={images} />
      </div>
    </main>
  )
}
