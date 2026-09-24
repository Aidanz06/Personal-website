'use client'

import { useEffect, useReducer, useState } from 'react'
import { Pond, type PhotoRect } from '@/components/Pond'
import { BackLink } from '@/components/BackLink'
import { ThemeMenu } from '@/components/ThemeMenu'
import { listeningFallbackMarkup } from '@/lib/listening/fallback'
import { formatAsOf, onRepeatLabel } from '@/lib/listening/format'
import { listeningLayout } from '@/lib/listening/rocks'
import { activeRock, initialRockSelection, rockSelection } from '@/lib/pond/rockSelection'
import type { ListeningData } from '@/lib/listening/types'

/**
 * /listening: a small pond where the month's top five tracks are rocks.
 *
 * Structurally this is the homepage's pond with different rocks in it. The
 * canvas is fixed to the viewport and reads the scroll position itself; the
 * rocks are ordinary <button> elements laid over it, positioned in CSS so
 * they need no measurement and work as server-rendered HTML. Nothing is
 * canvas hit-testing, which is what makes the keyboard path and the screen
 * reader path the same path a pointer takes.
 *
 * A rock opens exactly the way a photo rock does — the cover rises out of the
 * ASCII, duotoned into the pond's own colours, with a caption under it. That
 * is not a coincidence: it is the same code, handed an album cover instead of
 * a photograph.
 *
 * Buttons rather than links, for the same reason the photo rocks are: nothing
 * navigates. The rock IS the song.
 */

/**
 * Dimmer than the homepage, the same way the other inner pages are.
 *
 * This page carries a heading, an intro and two labels, and a koi at full
 * brightness passing behind a line of text makes it hard to read.
 */
const QUIET = {
  waterBase: 0.11,
  waterAmplitude: 0.07,
  koiBrightness: 0.5,
  rippleStrength: 0.38,
}

/** How far an open cover drifts, in pixels. */
const COVER_FLOAT = 8

/**
 * How a cover opens here, as distinct from a photograph on the homepage.
 *
 * Smaller, because an album cover is a small square thing surfacing, not a
 * picture to study. Left as characters, because on this page the cover is
 * part of the pond rather than a window out of it. And drifting slightly, as
 * if it were floating rather than pinned to the glass.
 */
const COVERS = {
  ...QUIET,
  photoScale: 0.55,
  photoAscii: true,
  photoFloat: COVER_FLOAT,
}

/** Depths are derived, so they land on values like 2.3500000000000005. */
function vh(value: number): string {
  return `${(value * 100).toFixed(4)}vh`
}

/**
 * The same clamp placeStones() applies, expressed in CSS so it needs no
 * measurement. Keep the two in step: the moment they disagree, the rock the
 * canvas draws and the control the browser gives you stop being in the same
 * place.
 */
function rockSize(radiusFraction: number, minRadius: number): string {
  return `clamp(${minRadius * 2}px, min(100vw, 100vh) * ${(radiusFraction * 2).toFixed(4)}, 240px)`
}

/** The caption's width, in CSS: the cover's, but never cramped or off-screen. */
function captionWidth(coverWidth: number): string {
  return `min(max(${coverWidth}px, 240px), calc(100vw - 40px))`
}

export function ListeningPond({ data }: { data: ListeningData }) {
  // Hover and focus open a rock; a click or tap pins it, and a second one
  // closes it. See lib/pond/rockSelection.ts.
  const [selection, select] = useReducer(rockSelection, initialRockSelection)
  const active = activeRock(selection)
  const pinned = selection.pinned
  // Where the open cover has settled, so the caption can sit under it. The
  // pond reports this twice per rock, not once per frame.
  const [rect, setRect] = useState<PhotoRect | null>(null)

  // Esc closes whatever is open, pinned or not. On the window rather than the
  // button, because a rock pinned by a tap does not have focus — and a cover
  // you cannot dismiss from the keyboard is a trap. The homepage's photo
  // rocks do the same.
  useEffect(() => {
    if (active === null) return
    function close(event: KeyboardEvent) {
      if (event.key === 'Escape') select({ type: 'escape' })
    }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [active])

  const { rocks, depthVh } = listeningLayout(data.pebbles)
  const asOf = formatAsOf(data.asOf)
  const rectIsCurrent = rect !== null && rect.index === active

  function caption(index: number) {
    const rock = rocks[index]
    if (!rock) return null
    return (
      <p className="font-mono text-small text-muted">
        {rock.title} · {rock.artist}
      </p>
    )
  }

  return (
    <>
      {/* Fixed behind everything. aria-hidden lives on the canvas inside. */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <Pond
          className="h-full w-full"
          settings={COVERS}
          scrollDriven
          photoStones={rocks}
          activePhoto={active}
          onPhotoRect={setRect}
        />
      </div>

      <main className="listening-pond relative" style={{ minHeight: vh(depthVh) }}>
        <div className="column py-3">
          <div className="flex items-baseline gap-2">
            <BackLink />
            <ThemeMenu />
          </div>

          <h1 className="mt-4 font-display text-heading font-normal">listening</h1>
          <p className="mt-1 text-muted">my top 5 songs now</p>

          {/* Only when there is something on repeat. With last.fm down and
              nothing remembered, a label over empty water is a caption for a
              picture that is not there. */}
          {data.pebbles.length > 0 && (
            <>
              <p className="mt-3 font-mono text-small text-muted">
                {onRepeatLabel(data.period)}
              </p>
              {asOf && <p className="font-mono text-tiny text-muted">{asOf}</p>}
            </>
          )}
          {data.source === 'fixture' && (
            // Not an error — a placeholder, in the same brackets everything
            // else unfinished on this site wears. It disappears the moment
            // the environment variables exist.
            <p className="mt-0.5 font-mono text-tiny text-muted">
              [example data — last.fm not connected yet]
            </p>
          )}
        </div>

        {/* --- the rocks --- */}
        <div className="listening-rocks">
          {rocks.map((rock, index) => {
            const isActive = active === index
            return (
              <button
                key={rock.dataIndex}
                type="button"
                // Not a link: nothing navigates. It is a control that surfaces
                // a cover in place.
                aria-label={rock.alt}
                aria-pressed={pinned === index}
                className="absolute block cursor-pointer"
                style={{
                  top: vh(rock.depthVh),
                  left: `${rock.xFraction * 100}%`,
                  width: rockSize(rock.radiusFraction, rock.minRadius),
                  height: rockSize(rock.radiusFraction, rock.minRadius),
                  transform: 'translate(-50%, -50%)',
                }}
                onMouseEnter={() => select({ type: 'enter', index })}
                onMouseLeave={() => select({ type: 'leave', index })}
                onFocus={() => select({ type: 'focus', index })}
                onBlur={() => select({ type: 'blur', index })}
                onClick={() => select({ type: 'click', index })}
              >
                {/* A pebble carries its rank, because the ranking is the
                    information. */}
                {/* Hidden while this rock's cover is showing: the cover opens
                    centred on the rock, and an orange number in the middle of
                    the art is the first thing the eye lands on. */}
                {!(isActive && rectIsCurrent) && (
                  <span
                    className={
                      isActive
                        ? 'absolute top-full left-1/2 w-max -translate-x-1/2 pt-0.5 font-mono text-small text-accent'
                        : 'absolute top-full left-1/2 w-max -translate-x-1/2 pt-0.5 font-mono text-small text-muted'
                    }
                  >
                    {String(rock.rank).padStart(2, '0')}
                  </span>
                )}

                {/* The caption, when the cover has not opened — under reduced
                    motion the canvas never animates, so the picture never
                    arrives and the rect never comes. Reduced motion should
                    cost the movement, not the words. */}
                {isActive && !rectIsCurrent && (
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute top-full left-1/2 w-[60vw] max-w-72 -translate-x-1/2 pt-4 text-center"
                  >
                    {caption(index)}
                  </span>
                )}

              </button>
            )
          })}

          {/* --- the caption for whichever rock is open --- */}
          {/* Fixed, because the cover is painted on a canvas fixed to the
              viewport and the rect arrives in viewport coordinates. Hidden
              from screen readers: the same words are already on the button,
              where they are reachable before the picture opens. */}
          {rectIsCurrent && rect && (
            <div
              aria-hidden="true"
              className="pointer-events-none fixed"
              style={{
                // At least 240px wide, however small the cover: a phone opens
                // it at about 160px, and a caption that narrow wraps an album
                // title onto four lines. Then held inside the page's 20px
                // gutters on both sides, so a wider caption under a cover near
                // the edge slides inward rather than off the glass.
                left: `clamp(20px, ${rect.x}px, calc(100vw - 20px - ${captionWidth(rect.width)}))`,
                // Clear of the cover at the lowest point of its drift.
                top: rect.y + rect.height + 8 + COVER_FLOAT,
                width: captionWidth(rect.width),
              }}
            >
              {caption(rect.index)}
            </div>
          )}
        </div>

        <noscript
          dangerouslySetInnerHTML={{
            __html: listeningFallbackMarkup({ pebbles: data.pebbles }),
          }}
        />
      </main>
    </>
  )
}
