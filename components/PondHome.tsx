'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Pond } from '@/components/Pond'
import { HOME_STONES, POND_DEPTH_VH } from '@/lib/pond/stones'
import { contacts, site } from '@/lib/site'

/**
 * The homepage: a pond you descend.
 *
 * The canvas is fixed to the viewport and reads the scroll position itself,
 * while the stones are ordinary anchors in the scrolling document.
 *
 * Both get their positions from the same specs in lib/pond/stones.ts, but by
 * different routes: the canvas places them in pixels from its own box, and
 * the links place themselves in CSS with `vh` and `%`. That matters — an
 * earlier version measured the viewport in an effect and rendered the links
 * from the result, which meant that with JavaScript disabled the homepage
 * had no navigation at all. Positioning in CSS needs no measurement, so the
 * links are plain server-rendered HTML that works with the canvas missing.
 *
 * The navigation is real links, not canvas hit-testing. That is what makes
 * it work with a keyboard, with a screen reader, and with JS off — the pond
 * is decoration layered behind functioning HTML, never the other way round.
 */
export function PondHome({ photos }: { photos: readonly string[] }) {
  const [highlight, setHighlight] = useState<number | null>(null)

  return (
    <>
      {/* Fixed behind everything. aria-hidden lives on the canvas inside. */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <Pond
          className="h-full w-full"
          stoneSpecs={HOME_STONES}
          scrollDriven
          highlight={highlight}
          photos={photos}
        />
      </div>

      <main className="relative" style={{ minHeight: `${POND_DEPTH_VH * 100}vh` }}>
        {/* --- the surface --- */}
        <section className="column pt-[22vh]">
          <h1 className="font-display text-name font-normal">{site.name}</h1>
          <p className="mt-1 text-muted">{site.identity}</p>
          <p className="mt-1" data-availability="">
            spring 2027 co-op ·{' '}
            <span className="text-muted">[target roles — aidan to add]</span>
          </p>
        </section>

        {/* --- the stones --- */}
        {HOME_STONES.map((spec, index) => {
          // The same clamp placeStones() applies, expressed in CSS so it
          // needs no measurement. Keep the two in step.
          const size = `clamp(92px, min(100vw, 100vh) * ${(spec.radiusFraction * 2).toFixed(3)}, 240px)`
          return (
            <Link
              key={spec.href}
              href={spec.href}
              aria-label={spec.label}
              className="absolute block no-underline"
              style={{
                top: `${spec.depthVh * 100}vh`,
                left: `${spec.xFraction * 100}%`,
                width: size,
                height: size,
                // The anchor covers the stone, so the whole stone is the
                // click target rather than just the words.
                transform: 'translate(-50%, -50%)',
              }}
              onMouseEnter={() => setHighlight(index)}
              onMouseLeave={() =>
                setHighlight((current) => (current === index ? null : current))
              }
              onFocus={() => setHighlight(index)}
              onBlur={() =>
                setHighlight((current) => (current === index ? null : current))
              }
            >
              {/* The label sits BELOW the stone, not on it. Centred on the
                  stone it lands on the brightest part of the drawing and
                  becomes unreadable. */}
              <span className="absolute top-full left-1/2 w-max -translate-x-1/2 pt-1 text-center">
                <span
                  className={
                    highlight === index
                      ? 'block font-display text-heading text-accent underline underline-offset-4'
                      : 'block font-display text-heading text-ink'
                  }
                >
                  {spec.label}
                </span>
                {spec.note && (
                  <span className="mt-0.5 block font-mono text-small text-muted">
                    {spec.note}
                  </span>
                )}
              </span>
            </Link>
          )
        })}

        {/* --- a hint, at the depth where the koi tends to be --- */}
        <p
          className="column absolute inset-x-0 font-mono text-small text-muted"
          style={{ top: `${(POND_DEPTH_VH - 1.05) * 100}vh` }}
        >
          the koi carries photographs down here. hold still and let it come to you.
        </p>

        {/* --- the bottom --- */}
        <footer
          className="column absolute inset-x-0"
          style={{ top: `${(POND_DEPTH_VH - 0.55) * 100}vh` }}
        >
          <ul className="flex flex-wrap gap-x-2 gap-y-0.5 text-small">
            {contacts.map((contact) => (
              <li key={contact.label}>
                {contact.href ? (
                  <a href={contact.href}>{contact.label}</a>
                ) : (
                  <span className="text-muted">{contact.placeholder}</span>
                )}
              </li>
            ))}
          </ul>
        </footer>
      </main>
    </>
  )
}
