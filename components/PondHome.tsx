'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Pond, type PhotoRect } from '@/components/Pond'
import { HOME_STONES, POND_DEPTH_VH } from '@/lib/pond/stones'
import { placePhotoStones, pondDepthVh } from '@/lib/pond/photoStones'
import { isCaptionEmpty } from '@/lib/captions'
import type { Photo } from '@/lib/photos'
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
/**
 * Depths are derived, so they land on values like 2.3500000000000005. Four
 * decimal places of a viewport height is well under a pixel, and it keeps the
 * inline styles readable when someone opens the inspector.
 */
function vh(value: number): string {
  return `${(value * 100).toFixed(4)}vh`
}

export function PondHome({ photos }: { photos: readonly Photo[] }) {
  const [highlight, setHighlight] = useState<number | null>(null)
  // Hover and focus open a photo rock; a tap pins it, which is the whole
  // touch story since there is no hover on a phone.
  const [hoveredPhoto, setHoveredPhoto] = useState<number | null>(null)
  const [pinnedPhoto, setPinnedPhoto] = useState<number | null>(null)
  const activePhoto = pinnedPhoto ?? hoveredPhoto
  // Where the open photograph has settled, so the caption can sit under it.
  // The pond reports this twice per photograph, not once per frame.
  const [photoRect, setPhotoRect] = useState<PhotoRect | null>(null)

  const photoStones = placePhotoStones(
    photos.map((photo) => ({ ...photo, alt: photo.caption.alt })),
  )
  const depthVh = pondDepthVh(photoStones.length, POND_DEPTH_VH)

  return (
    <>
      {/* Fixed behind everything. aria-hidden lives on the canvas inside. */}
      <div className="pointer-events-none fixed inset-0 -z-10">
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
          <h1 className="font-display text-name font-normal">{site.name}</h1>
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

        {/* --- the photo rocks --- */}
        {photoStones.length > 0 && (
          <p
            className="column absolute inset-x-0 font-mono text-small text-muted"
            style={{ top: vh(photoStones[0]!.depthVh - 0.42) }}
          >
            photographs. rest on a stone to bring one up.
          </p>
        )}

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
                isCaptionEmpty(photos[index]!.caption)
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
              onMouseEnter={() => setHoveredPhoto(index)}
              onMouseLeave={() =>
                setHoveredPhoto((current) => (current === index ? null : current))
              }
              onFocus={() => setHoveredPhoto(index)}
              onBlur={() =>
                setHoveredPhoto((current) => (current === index ? null : current))
              }
              onClick={() =>
                setPinnedPhoto((current) => (current === index ? null : index))
              }
            >
              <span
                className={
                  isActive
                    ? 'absolute top-full left-1/2 w-max -translate-x-1/2 pt-0.5 font-mono text-small text-accent'
                    : 'absolute top-full left-1/2 w-max -translate-x-1/2 pt-0.5 font-mono text-small text-muted'
                }
              >
                {String(index + 1).padStart(2, '0')}
              </span>
              {!isCaptionEmpty(photos[index]!.caption) && (
                <span id={`photo-caption-${index}`} className="sr-only">
                  {photos[index]!.caption.description}
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
          !isCaptionEmpty(photos[photoRect.index]!.caption) && (
            <div
              aria-hidden="true"
              className="pointer-events-none fixed"
              style={{
                left: photoRect.x,
                top: photoRect.y + photoRect.height + 8,
                width: photoRect.width,
              }}
            >
              {photos[photoRect.index]!.caption.headline && (
                <p className="font-mono text-small text-muted">
                  {photos[photoRect.index]!.caption.headline}
                </p>
              )}
              {photos[photoRect.index]!.caption.line && (
                <p className="font-mono text-small text-ink">
                  {photos[photoRect.index]!.caption.line}
                </p>
              )}
              {photos[photoRect.index]!.caption.settings && (
                <p className="font-mono text-tiny text-muted">
                  {photos[photoRect.index]!.caption.settings}
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
