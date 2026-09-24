import { getImageProps } from 'next/image'
import { SlideshowViewer } from '@/components/SlideshowViewer'
import { listSlides, type Slide } from '@/lib/slides'

/**
 * The tailor studio slideshow.
 *
 * A server component, so the deck is read from the folder at build time and
 * the page stays static. It renders two things: the interactive viewer, and a
 * no-JavaScript fallback that stacks every slide in order.
 *
 * Which of the two a visitor sees is decided by the browser, not by a script.
 * The <noscript> block carries a stylesheet that hides the interactive half —
 * content inside <noscript> is ignored entirely when JavaScript runs, so with
 * JS the rule never exists, and without it the rule is already applied before
 * the first paint.
 */

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * The fallback, built as a string.
 *
 * React renders <noscript> children into the page, but a browser with
 * JavaScript enabled parses whatever is inside <noscript> as plain text, not
 * as elements — so hydration finds text where React expects a tree. Setting
 * the markup directly sidesteps the mismatch.
 *
 * The images still go through the optimiser: `getImageProps` returns exactly
 * the attributes <Image> would have rendered, srcset included.
 */
function fallbackMarkup(slides: readonly Slide[]): string {
  const items = slides
    .map((slide, i) => {
      const { props } = getImageProps({
        src: slide.src,
        alt: slide.alt,
        width: slide.width,
        height: slide.height,
        sizes: '(max-width: 1000px) 100vw, 960px',
      })
      // `style` comes back as a React style object, which stringifies to
      // "[object Object]" — and a duplicate style attribute later in the tag
      // does not override it, because the first one wins. The fallback wants
      // its own sizing anyway.
      const attributes = Object.entries(props)
        .filter(([key]) => key !== 'style')
        .filter(([, value]) => value !== undefined && value !== null && value !== false)
        .map(([key, value]) => {
          const name =
            key === 'srcSet' ? 'srcset' : key === 'className' ? 'class' : key.toLowerCase()
          return `${name}="${escapeHtml(String(value))}"`
        })
        .join(' ')
      return `<li><span class="ss-n">${String(i + 1).padStart(2, '0')} / ${String(slides.length).padStart(2, '0')}</span><img ${attributes} style="width:100%;height:auto"></li>`
    })
    .join('')

  return `<style>.slideshow-js{display:none!important}.ss-fallback{list-style:none;padding:0;margin:0}.ss-n{display:block;font-family:var(--font-mono);font-size:var(--text-small);color:var(--color-muted);margin:8px 0 4px}</style><ol class="ss-fallback breakout">${items}</ol>`
}

export function Slideshow() {
  const slides = listSlides()

  if (slides.length === 0) {
    return (
      <p className="my-3 font-mono text-small text-muted">
        [the tailor studio presentation goes here — drop the slides into
        public/tailor-studio/slides as 01.png, 02.png, … and add one line of
        alt text each to public/tailor-studio/slides.json]
      </p>
    )
  }

  return (
    <>
      <SlideshowViewer slides={slides} />
      <noscript dangerouslySetInnerHTML={{ __html: fallbackMarkup(slides) }} />
    </>
  )
}
