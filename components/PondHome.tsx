'use client'

import Link from 'next/link'
import { useEffect, useReducer, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { Pond, type PhotoRect } from '@/components/Pond'
import { ThemeMenu } from '@/components/ThemeMenu'
import { DEEPEST_STONE_VH, HOME_STONES, POND_DEPTH_VH } from '@/lib/pond/stones'
import { PHOTOS_START_VH, galleryDepthVh, photoGroupMarkers, placePhotoStones } from '@/lib/pond/photoStones'
import { Bubbles } from '@/components/Bubbles'
import { galleryGroups, orderGallery, rockLabel, rockName } from '@/lib/pond/gallery'
import { isCaptionEmpty } from '@/lib/captions'
import type { Photo } from '@/lib/photos'
import { contacts, site } from '@/lib/site'
import { activeRock, initialRockSelection, rockSelection } from '@/lib/pond/rockSelection'
import { usePinDismissal } from '@/components/usePinDismissal'
import { useHoverIntent } from '@/components/useHoverIntent'
import { useReducedMotion } from '@/components/useReducedMotion'
import { rovingNext } from '@/lib/pond/roving'

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
  // A rock scrolling under a still mouse is not a hover. See useHoverIntent.
  const hoverIntended = useHoverIntent()

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
  // Labels and the focus ring step aside the moment a picture starts to
  // open, not once it has settled: waiting for the settled rect left every
  // name and the ring drawn over the surfacing picture for up to ~3.5s.
  // Under reduced motion the picture never animates open and the rect never
  // comes, so there the labels stay until it has (which is never).
  const reducedMotion = useReducedMotion()
  const stepAside = photoOpen || (activePhoto !== null && !reducedMotion)
  // Where the open picture's caption goes, measured once in <main>'s own
  // coordinates when the picture settles. The caption used to be
  // position:fixed at the settled viewport position, so a pinned picture
  // scrolled away with its rock and left its caption floating behind.
  const mainRef = useRef<HTMLElement | null>(null)
  const [captionTop, setCaptionTop] = useState(0)
  function onPhotoRect(rect: PhotoRect | null) {
    setPhotoRect(rect)
    const main = mainRef.current
    if (rect && main) setCaptionTop(rect.y + rect.height + 8 - main.getBoundingClientRect().top)
  }
  // The one photo rock in the Tab order: the gallery is a single Tab stop,
  // and the arrow keys move this. It stays on the rock last visited, so
  // tabbing back into the gallery returns you where you were.
  const [roving, setRoving] = useState(0)
  // Whether a rock has keyboard focus, for the visible arrow-key hint.
  const [keyboardInGallery, setKeyboardInGallery] = useState(false)

  function moveInGallery(event: ReactKeyboardEvent, index: number) {
    const next = rovingNext(index, event.key, photoStones.length)
    if (next === null || next === index) return
    event.preventDefault()
    const rock = document.querySelector<HTMLElement>(`[data-rock="${next}"]`)
    if (!rock) return
    setRoving(next)
    // Centred rather than the browser's nearest edge: the photograph opens
    // around its rock and needs the screen above and below it.
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    rock.focus({ preventScroll: true })
    rock.scrollIntoView({ block: 'center', behavior: reduced ? 'auto' : 'smooth' })
  }

  // Newest first, grouped by shoot: going deeper goes back in time, one
  // trip at a time. Every lookup below reads `gallery`, never `photos`, so a
  // rock, its hidden description and its open caption are always the same
  // photograph.
  const gallery = orderGallery(photos)
  const groups = galleryGroups(gallery.map((photo) => photo.caption))
  const photoStones = placePhotoStones(
    gallery.map((photo, index) => ({
      ...photo,
      alt: rockName(photo.caption, photo.kind),
      group: groups[index],
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
          onPhotoRect={onPhotoRect}
        />
      </div>

      <main ref={mainRef} className="relative" style={{ minHeight: vh(depthVh) }}>
        {/* --- the surface --- */}
        {/* id="surface": where "back to the surface" at the bottom lands. */}
        <section id="surface" className="column pt-[22vh]">
          <div className="flex items-baseline gap-1.5">
            {/* tabIndex -1 so the way back up can hand focus here, and the
                next Tab starts from the top rather than the pond floor. */}
            <h1 id="greeting" tabIndex={-1} className="font-display text-name font-normal">
              {site.greeting}
            </h1>
            <ThemeMenu />
          </div>
          <p className="mt-1 text-muted">{site.identity}</p>
        </section>

        {/* --- the stones --- */}
        {/* A landmark, so a screen reader can jump to the pages. It has no
            box of its own: the stones are placed against <main>. */}
        <nav aria-label="pages">
        {HOME_STONES.map((spec, index) => {
          // The same clamp placeStones() applies, expressed in CSS so it
          // needs no measurement. Keep the two in step.
          const size = `clamp(92px, min(100vw, 100vh) * ${(spec.radiusFraction * 2).toFixed(3)}, 240px)`
          return (
            <Link
              key={spec.href}
              href={spec.href}
              aria-label={spec.label}
              // The note is a description, not part of the name, the same
              // way a photo rock's caption is: the name alone replaced it.
              aria-describedby={spec.note ? `stone-note-${index}` : undefined}
              // A focused stone lands with its label and note on screen,
              // not with only its top edge showing.
              className="absolute block scroll-my-[25vh] no-underline"
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
                  stepAside ? 'opacity-0' : 'opacity-100'
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
                  <span
                    id={`stone-note-${index}`}
                    className="mt-0.5 block font-mono text-small text-muted"
                  >
                    {spec.note}
                  </span>
                )}
              </span>
            </Link>
          )
        })}
        </nav>

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
              stepAside ? 'opacity-0' : 'opacity-100'
            }`}
            style={{ top: vh(photoStones[0]!.depthVh - GALLERY_TITLE_LIFT_VH) }}
          >
            <h2 className="water-wobble font-display text-heading font-normal text-muted">
              photo gallery
            </h2>
            {/* For whoever tabs in without seeing the hint below. */}
            <p className="sr-only">
              one tab stop: the arrow keys move between photographs, and
              escape closes one.
            </p>
          </div>
        )}

        {/* One marker per shoot, in the water above its first rock:
            "kamakura · may 2025". Hidden from screen readers: each rock's
            description already says where and when. */}
        {groupMarkers.map((marker) => (
          <div
            key={`${marker.label}@${marker.depthVh}`}
            className={`column absolute inset-x-0 transition-opacity duration-500 ${
              stepAside ? 'opacity-0' : 'opacity-100'
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
              // One Tab stop for the whole gallery; see moveInGallery.
              tabIndex={index === roving ? 0 : -1}
              // While this rock's picture is open, the picture is the focus
              // indicator: a ring drawn in the middle of the photograph is not.
              className={`absolute block scroll-my-[25vh] cursor-pointer ${
                stepAside && isActive ? 'focus-visible:outline-transparent' : ''
              }`}
              style={{
                top: vh(spec.depthVh),
                left: `${spec.xFraction * 100}%`,
                width: size,
                height: size,
                transform: 'translate(-50%, -50%)',
              }}
              data-rock={index}
              onMouseEnter={() => hoverIntended() && select({ type: 'enter', index })}
              // The pointer moving over a rock is always intended, including
              // straight after a scroll, when mouseenter can arrive before the
              // move that caused it has been recorded.
              onMouseMove={() => activePhoto !== index && hoverIntended() && select({ type: 'enter', index })}
              onMouseLeave={() => select({ type: 'leave', index })}
              onFocus={(event) => {
                select({ type: 'focus', index })
                setRoving(index)
                setKeyboardInGallery(event.currentTarget.matches(':focus-visible'))
              }}
              onBlur={() => {
                select({ type: 'blur', index })
                setKeyboardInGallery(false)
              }}
              onClick={() => select({ type: 'click', index })}
              onKeyDown={(event) => moveInGallery(event, index)}
            >
              {/* Every rock's name steps aside while a photograph is open —
                  not just this one's. Names are HTML over the canvas, so any
                  within the picture's reach are drawn on top of it; the
                  picture gets the stage, the same as the heading and years.
                  9rem (144px) wide, not w-36: this project's spacing unit is
                  8px, so w-36 is 288px and ran off a phone screen. Centred,
                  so a long name wraps under its rock. */}
              {rockLabel(gallery[index]!.caption).length > 0 && (
                <span
                  className={`absolute top-full left-1/2 w-[9rem] -translate-x-1/2 pt-0.5 text-center transition-opacity duration-500 ${
                    stepAside ? 'opacity-0' : 'opacity-100'
                  }`}
                >
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
        {/* Placed in the page, not the viewport: the rect arrives in
            viewport coordinates, and is turned into <main>'s once (see
            onPhotoRect), so the caption scrolls with its picture. Hidden from
            screen readers: the same words are already on the rock's button,
            where they are reachable by keyboard before the picture opens. */}
        {photoRect &&
          activePhoto === photoRect.index &&
          !isCaptionEmpty(gallery[photoRect.index]!.caption) && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute"
              style={{
                // Held inside the page's 20px gutters. On a phone a
                // photograph opens nearly full width and is clamped against
                // the edge of the screen, and a caption following it there
                // would touch the glass. Same rule as on /listening.
                left: `clamp(20px, ${photoRect.x}px, calc(100vw - 20px - min(${photoRect.width}px, 100vw - 40px)))`,
                top: captionTop,
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

        {/* The gallery is one Tab stop, which is only discoverable if
            someone says so. Shown while a rock has keyboard focus, and never
            to a pointer. Screen readers get the sentence under the heading. */}
        {keyboardInGallery && (
          <p
            aria-hidden="true"
            className="over-water pointer-events-none fixed inset-x-0 bottom-3 text-center font-mono text-tiny text-muted"
          >
            ↑ ↓ between photographs · esc to close
          </p>
        )}

        {/* --- the bottom --- */}
        {/* The pond floor: the page ends here, on the bottom of the pond
            rather than partway up the last screen. Contacts, then the way
            back up, which is a plain #surface link so it works with
            JavaScript off; with it on, the climb is a smooth scroll back
            through the water (the koi comes with you) and focus returns to
            the greeting. */}
        <footer className="column absolute inset-x-0 bottom-0 pb-[8vh]">
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
          <p className="mt-3 font-mono text-small">
            <a
              href="#surface"
              className="hit-area text-muted"
              onClick={(event) => {
                event.preventDefault()
                const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
                window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' })
                document.getElementById('greeting')?.focus({ preventScroll: true })
              }}
            >
              ↑ back to the surface
            </a>
          </p>
        </footer>
      </main>
    </>
  )
}
