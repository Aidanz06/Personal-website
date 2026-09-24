import { asciiBanner, asciiBannerLines } from '@/lib/banner'

/**
 * Words drawn in characters, seen through moving water.
 *
 * Every piece of text inside the gallery — its heading, the year markers, the
 * label under each rock — is ASCII art in the site's five-row font
 * (lib/banner.ts), distorted by an SVG filter so it bends like lettering
 * under the surface. It's text that belongs to the pond rather than text laid
 * over it.
 *
 * Always aria-hidden: read aloud, ASCII art is a minute of "number sign".
 * Whatever uses it must carry the words for screen readers some other way (a
 * hidden heading, the rock's own accessible name).
 *
 * A <span> set to display:block and white-space:pre rather than a <pre>, so it
 * can sit inside a <button>, whose content has to be phrasing content.
 */

export type WaterSize = 'heading' | 'marker' | 'label'

/**
 * Font size per role. Line height is 0.62 at every size — about a monospace
 * glyph's width — so each pixel of the font is square and the strokes join.
 */
const SIZE: Record<WaterSize, string> = {
  heading: 'text-[7px]', // 22px tall
  marker: 'text-[6px]', // 19px tall
  label: 'text-[6px]', // 19px tall. 5px tore apart under the water
}

/**
 * The strong filter for headings and markers; the gentler one for rock
 * labels, which are small enough that the same displacement would tear them.
 */
const FILTER: Record<WaterSize, string> = {
  heading: '[filter:url(#water)] motion-reduce:[filter:url(#water-still)]',
  marker: '[filter:url(#water)] motion-reduce:[filter:url(#water-still)]',
  label: '[filter:url(#water-small)] motion-reduce:[filter:url(#water-small-still)]',
}

export function WaterText({
  text,
  size,
  className = 'text-muted',
}: {
  /** One line, or several for a label that wraps. */
  text: string | readonly string[]
  size: WaterSize
  className?: string
}) {
  return (
    <span
      aria-hidden="true"
      className={`block w-max font-mono leading-[0.62] whitespace-pre ${SIZE[size]} ${FILTER[size]} ${className}`}
    >
      {(typeof text === 'string' ? asciiBanner(text) : asciiBannerLines(text)).join('\n')}
    </span>
  )
}

/**
 * The filters WaterText refers to, defined once per page.
 *
 * A turbulence pattern whose frequency drifts over 13 seconds feeds a
 * displacement map. Low horizontal frequency makes long, rolling waves; the
 * higher vertical frequency makes each row bend differently from its
 * neighbours, which is what reads as refraction rather than a wobble. The
 * "-still" versions are the same distortion held still, for reduced motion:
 * still under water, just not moving.
 */
export function WaterFilters() {
  const waves = (id: string, scale: number, animate: boolean) => (
    <filter id={id} x="-8%" y="-60%" width="116%" height="220%">
      <feTurbulence type="fractalNoise" baseFrequency="0.011 0.09" numOctaves="2" seed="7">
        {animate && (
          <animate
            attributeName="baseFrequency"
            dur="13s"
            values="0.011 0.09;0.017 0.14;0.009 0.07;0.011 0.09"
            repeatCount="indefinite"
          />
        )}
      </feTurbulence>
      <feDisplacementMap in="SourceGraphic" scale={scale} xChannelSelector="R" yChannelSelector="G" />
    </filter>
  )
  return (
    <svg aria-hidden="true" width="0" height="0" className="absolute">
      {waves('water', 8, true)}
      {waves('water-still', 8, false)}
      {waves('water-small', 3.5, true)}
      {waves('water-small-still', 3.5, false)}
    </svg>
  )
}
