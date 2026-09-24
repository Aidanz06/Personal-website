/**
 * What the photo rocks say about themselves.
 *
 * The gallery used to be twenty-five rocks numbered 01 to 25 — nothing to
 * choose between, and a screen reader heard a filename twenty-five times.
 * The critique of 2026-09-24 scored recognition 1 of 4 for it. Now:
 *
 * - **order is time**, newest first, so going deeper goes back, the same way
 *   /listening reads — and the undated come last, at the bottom;
 * - **each rock carries Aidan's name for it**, and nothing until he writes
 *   one; the year is said once, on its group's marker;
 * - **a screen reader hears what is known** — the description once Aidan has
 *   written it, and until then "photograph, may 2025", never a filename.
 *
 * Names live in captions.json beside each photograph's description.
 *
 * Pure: it works on captions, not files.
 */

import type { Caption } from '../captions'

type Kind = 'image' | 'video'

/**
 * Newest first, undated last. Stable: photographs from the same month, and
 * the undated ones among themselves, keep their filename order. Month
 * resolution, because the camera's clock is on the wrong timezone and the day
 * is not reliable.
 */
export function orderGallery<T extends { file: string; caption: Caption }>(
  photos: readonly T[],
): T[] {
  const key = (photo: T) => sortableDate(photo.caption)
  return photos
    .map((photo, index) => ({ photo, index }))
    .sort((a, b) => {
      const da = key(a.photo)
      const db = key(b.photo)
      if (da && db && da !== db) return da < db ? 1 : -1
      if (da && !db) return -1
      if (!da && db) return 1
      return a.index - b.index
    })
    .map(({ photo }) => photo)
}

const MONTHS = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
]

/** "2025-05" from a caption, or '' when undated. Month resolution is enough. */
function sortableDate(caption: Caption): string {
  if (!caption.year || !caption.month) return ''
  const m = MONTHS.indexOf(caption.month) + 1
  return m > 0 ? `${caption.year}-${String(m).padStart(2, '0')}` : ''
}

/** The group a photograph falls in: its year, or "undated". */
export function galleryGroup(caption: Caption): string {
  return caption.year || 'undated'
}

/**
 * The label under a rock: Aidan's name for the photograph, exactly as he
 * wrote it, or empty until he names it. A month under every rock read "may"
 * fourteen times in a row, and a placeholder would be noise on every rock.
 * Plain text, so it wraps by itself, the page caps its width, and zoom works.
 */
export function rockLabel(caption: Caption): string {
  return caption.name.trim()
}

/**
 * The rock's accessible name, in the order a person would say it.
 *
 * It starts with the name under the rock whenever there is one, so what a
 * sighted voice-control user reads is what they can say ("click qianling
 * bridge"; WCAG 2.5.3, label in name). Then the written description, or
 * until there is one, what is actually known.
 */
export function rockName(caption: Caption, kind: Kind): string {
  const name = caption.name.trim()
  if (!caption.altMissing) return name ? `${name}: ${caption.alt}` : caption.alt
  const what = kind === 'video' ? 'clip' : 'photograph'
  const when = [caption.month, caption.year].filter(Boolean).join(' ') || 'undated'
  return [name, what, caption.place, when].filter(Boolean).join(', ')
}
