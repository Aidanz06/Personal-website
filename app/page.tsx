import type { Metadata } from 'next'
import Link from 'next/link'
import { HeaderSlot } from '@/components/HeaderSlot'
import { Footer } from '@/components/Footer'
import { routes, site } from '@/lib/site'

export const metadata: Metadata = {
  // `absolute` opts out of the "%s — aidan zheng" template from the root
  // layout, which would otherwise render "aidan zheng — aidan zheng".
  title: { absolute: `${site.name} — business analytics @ northeastern` },
  description: site.description,
}

/**
 * Home.
 *
 * Ordering is load-bearing: the availability line has to clear the fold at
 * 375px with the ASCII header above it, so everything between the top of the
 * page and that line is on a height budget. Nothing decorative goes in
 * before it.
 */
export default function Home() {
  return (
    <main className="column py-3">
      <HeaderSlot />

      <h1 className="mt-3 font-display text-name font-normal">{site.name}</h1>

      <p className="mt-1 text-muted">{site.identity}</p>

      {/* Availability — the single most important line on the site.
          Must stay above the fold at 375px. */}
      <p className="mt-1" data-availability="">
        [availability line — spring 2027 co-op + target roles, in aidan&rsquo;s
        exact words]
      </p>

      <p className="mt-3 text-muted">
        [interests sentence, 1&ndash;2 lines in aidan&rsquo;s voice — cars,
        audio, mechanical keyboards, pc hardware, guitar, basketball, running.
        specificity is the point: name the switches, not the hobby]
      </p>

      {/* Inline text links, not cards. In v1 these get folded into running
          prose that names the work in a sentence. */}
      <nav className="mt-3">
        <ul className="flex flex-wrap gap-x-1.5 gap-y-0.5">
          {routes.map((route, i) => (
            <li key={route.href}>
              <Link href={route.href}>{route.label}</Link>
              {i < routes.length - 1 && (
                <span className="ml-1.5 text-muted" aria-hidden="true">
                  ·
                </span>
              )}
            </li>
          ))}
        </ul>
      </nav>

      <Footer />
    </main>
  )
}
