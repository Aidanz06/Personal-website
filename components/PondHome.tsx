'use client'

import Link from 'next/link'
import { useEffect, useReducer, useState, type CSSProperties } from 'react'
import { Pond, type PhotoRect } from '@/components/Pond'
import { ThemeMenu } from '@/components/ThemeMenu'
import { DEEPEST_STONE_VH, HOME_STONES, POND_DEPTH_VH } from '@/lib/pond/stones'
import { PHOTOS_START_VH, galleryDepthVh, photoGroupMarkers, placePhotoStones } from '@/lib/pond/photoStones'
import { Bubbles } from '@/components/Bubbles'
import { galleryGroup, orderGallery, rockLabel, rockName } from '@/lib/pond/gallery'
import { isCaptionEmpty } from '@/lib/captions'
import type { Photo } from '@/lib/photos'
import { contacts, site } from '@/lib/site'
import { activeRock, initialRockSelection, rockSelection } from '@/lib/pond/rockSelection'
import { usePinDismissal } from '@/components/usePinDismissal'

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
/**
 * Depths are derived, so they land on values like 2.3500000000000005. Four
 * decimal places of a viewport height is well under a pixel, and it keeps the
 * inline styles readable when someone opens the inspector.
 */
/** How far above the first photo rock the title sits, in viewport heights. */
const GALLERY_TITLE_LIFT_VH = 0.25
/**
 * The stretch of water the bubbles rise through: from clear of the last
 * stone's label to clear of the gallery heading. Measured at 375x667, the
 * tightest case, where the label ends about 0.23 of a screen below its stone.
 */
const BUBBLES_TOP_VH = DEEPEST_STONE_VH + 0.3
const BUBBLES_BOTTOM_VH = PHOTOS_START_VH - GALLERY_TITLE_LIFT_VH - 0.08

function vh(value: number): string {
  return `${(value * 100).toFixed(4)}vh`
}

export function PondHome({ photos }: { photos: readonly Photo[] }) {
  const [highlight, setHighlight] = useState<number | null>(null)
  // Hover and focus open a photo rock; a click or tap pins it, and a second
  // one closes it. See lib/pond/rockSelection.ts for why closing is the part
  // that has to be exact on a phone.
  const [selection, select] = useReducer(rockSelection, initialRockSelection)
  const activePhoto = activeRock(selection)
  const pinnedPhoto = selection.pinned
  usePinDismissal(pinnedPhoto, select)

  // Esc closes whatever is open, the same as on /listening.
  useEffect(() => {
    if (activePhoto === null) return
    function close(event: KeyboardEvent) {
      if (event.key === 'Escape') select({ type: 'escape' })
    }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [activePhoto])
  // Where the open photograph has settled, so the caption can sit under it.
  // The pond reports this twice per photograph, not once per frame.
  const [photoRect, setPhotoRect] = useState<PhotoRect | null>(null)
  // A photograph has finished opening. The labels are HTML over the canvas,
  // so on a short screen — a phone turned sideways is 375px tall — they sit
  // on top of the picture unless they step aside while it is showing.
  const photoOpen = photoRect !== null && activePhoto === photoRect.index

  // Newest first, grouped by year: going deeper goes back in time. Every
  // lookup below reads `gallery`, never `photos`, so a rock, its hidden
  // description and its open caption are always the same photograph.
  const gallery = orderGallery(photos)
  const photoStones = placePhotoStones(
    gallery.map((photo) => ({
      ...photo,
      alt: rockName(photo.caption, photo.kind),
      group: galleryGroup(photo.caption),
    })),
  )
  const groupMarkers = photoGroupMarkers(photoStones)
  const depthVh = galleryDepthVh(photoStones, POND_DEPTH_VH)

  return (
    <>
      {/* Fixed behind everything. aria-hidden lives on the canvas inside. */}
      <div className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-screen">
        <Pond
          className="h-full w-full"
          stoneSpecs={HOME_STONES}
          scrollDriven
          highlight={highlight}
          photoStones={photoStones}
          activePhoto={activePhoto}
          onPhotoRect={setPhotoRect}
        />
      </div>

      <main className="relative" style={{ minHeight: vh(depthVh) }}>
        {/* --- the surface --- */}
        <section className="column pt-[22vh]">
          <div className="flex items-baseline gap-1.5">
            <h1 className="font-display text-name font-normal">{site.greeting}</h1>
            <ThemeMenu />
          </div>
          <p className="mt-1 text-muted">{site.identity}</p>
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
                top: vh(spec.depthVh),
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
              <span
                className={`absolute top-full left-1/2 w-max -translate-x-1/2 pt-1 text-center transition-opacity duration-500 ${
                  photoOpen ? 'opacity-0' : 'opacity-100'
                }`}
              >
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

        {/* --- the photo rocks --- */}
        {/* --- between the pages and the photographs --- */}
        {photoStones.length > 0 && (
          <Bubbles
            top={vh(BUBBLES_TOP_VH)}
            height={vh(BUBBLES_BOTTOM_VH - BUBBLES_TOP_VH)}
          />
        )}

        {/* The gallery's heading, in the site's heading serif, muted so the
            photographs stay the thing, and swaying slowly as if seen through
            the water (.water-wobble in globals.css). A real <h2>: it gives
            the gallery a landmark a screen reader can jump to. */}
        {photoStones.length > 0 && (
          <div
            className={`column absolute inset-x-0 transition-opacity duration-500 ${
              photoOpen ? 'opacity-0' : 'opacity-100'
            }`}
            style={{ top: vh(photoStones[0]!.depthVh - GALLERY_TITLE_LIFT_VH) }}
          >
            <h2 className="water-wobble font-display text-heading font-normal text-muted">
              photo gallery
            </h2>
          </div>
        )}

        {/* One year per group, in the water above its first rock. Hidden
            from screen readers: every rock's name already says its year. */}
        {groupMarkers.map((marker) => (
          <div
            key={marker.label}
            className={`column absolute inset-x-0 transition-opacity duration-500 ${
              photoOpen ? 'opacity-0' : 'opacity-100'
            }`}
            style={{ top: vh(marker.depthVh) }}
          >
            <span
              aria-hidden="true"
              className="water-wobble font-mono text-small text-muted"
              style={{ '--wobble-delay': `-${(marker.depthVh * 3) % 7}s` } as CSSProperties}
            >
              {marker.label}
            </span>
          </div>
        ))}

        {photoStones.map((spec, index) => {
          const size = `clamp(52px, min(100vw, 100vh) * ${(spec.radiusFraction * 2).toFixed(3)}, 240px)`
          const isActive = activePhoto === index
          return (
            <button
              key={spec.src}
              type="button"
              // Not a link: nothing navigates. It is a control that surfaces
              // a picture in place, so it is a button, and it is focusable so
              // the keyboard path matches the pointer one.
              aria-label={spec.alt}
              // The caption is a description, not part of the name: a screen
              // reader reads the photograph first and then where and when.
              // It is on the button rather than on the visible caption so it
              // is available on focus, before the picture has opened.
              aria-describedby={
                isCaptionEmpty(gallery[index]!.caption)
                  ? undefined
                  : `photo-caption-${index}`
              }
              aria-pressed={pinnedPhoto === index}
              className="absolute block cursor-pointer"
              style={{
                top: vh(spec.depthVh),
                left: `${spec.xFraction * 100}%`,
                width: size,
                height: size,
                transform: 'translate(-50%, -50%)',
              }}
              data-rock={index}
              onMouseEnter={() => select({ type: 'enter', index })}
              onMouseLeave={() => select({ type: 'leave', index })}
              onFocus={() => select({ type: 'focus', index })}
              onBlur={() => select({ type: 'blur', index })}
              onClick={() => select({ type: 'click', index })}
            >
              {/* Hidden while this rock's own photograph is showing: it
                  opens centred on the rock, and an orange number in the
                  middle of the picture is the first thing the eye lands on. */}
              {!(isActive && photoOpen) && rockLabel(gallery[index]!.caption).length > 0 && (
                <span className="absolute top-full left-1/2 w-[9rem] -translate-x-1/2 pt-0.5 text-center">
                  {/* 9rem (144px), not w-36: this project's spacing unit is 8px, so
                      w-36 is 288px and ran off a phone screen. Capped and
                      centred, so a long name wraps under
                      its rock instead of running off a phone screen. */}
                  <span
                    className={`water-wobble font-mono text-small ${isActive ? 'text-accent' : 'text-muted'}`}
                    style={{ '--wobble-delay': `-${(index * 0.9) % 7}s` } as CSSProperties}
                  >
                    {rockLabel(gallery[index]!.caption)}
                  </span>
                </span>
              )}
              {!isCaptionEmpty(gallery[index]!.caption) && (
                <span id={`photo-caption-${index}`} className="sr-only">
                  {gallery[index]!.caption.description}
                </span>
              )}
            </button>
          )
        })}

        {/* --- the caption for whichever photograph is open --- */}
        {/* Fixed, because the photograph is painted on a canvas fixed to the
            viewport and the rect arrives in viewport coordinates. Hidden from
            screen readers: the same words are already on the rock's button,
            where they are reachable by keyboard before the picture opens. */}
        {photoRect &&
          activePhoto === photoRect.index &&
          !isCaptionEmpty(gallery[photoRect.index]!.caption) && (
            <div
              aria-hidden="true"
              className="pointer-events-none fixed"
              style={{
                // Held inside the page's 20px gutters. On a phone a
                // photograph opens nearly full width and is clamped against
                // the edge of the screen, and a caption following it there
                // would touch the glass. Same rule as on /listening.
                left: `clamp(20px, ${photoRect.x}px, calc(100vw - 20px - min(${photoRect.width}px, 100vw - 40px)))`,
                top: photoRect.y + photoRect.height + 8,
                width: `min(${photoRect.width}px, calc(100vw - 40px))`,
              }}
            >
              {gallery[photoRect.index]!.caption.headline && (
                <p className="font-mono text-small text-muted">
                  {gallery[photoRect.index]!.caption.headline}
                </p>
              )}
              {gallery[photoRect.index]!.caption.line && (
                <p className="font-mono text-small text-ink">
                  {gallery[photoRect.index]!.caption.line}
                </p>
              )}
              {gallery[photoRect.index]!.caption.settings && (
                <p className="font-mono text-tiny text-muted">
                  {gallery[photoRect.index]!.caption.settings}
                </p>
              )}
            </div>
          )}

        {/* --- the bottom --- */}
        <footer
          className="column absolute inset-x-0"
          style={{ top: vh(depthVh - 0.5) }}
        >
          <ul className="flex flex-wrap gap-x-2 gap-y-0.5 text-small">
            {contacts.map((contact) => (
              <li key={contact.label}>
                {contact.href ? (
                  <a href={contact.href} className="hit-area">
                    {contact.label}
                  </a>
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
