/**
 * What the photo rocks say about themselves.
 *
 * The gallery used to be twenty-five rocks numbered 01 to 25 — nothing to
 * choose between, and a screen reader heard a filename twenty-five times.
 * The critique of 2026-09-24 scored recognition 1 of 4 for it. Now:
 *
 * - **order is time**, newest first, so going deeper goes back, the same way
 *   /listening reads — and the undated come last, at the bottom;
 * - **each rock names its place and month** ("kyoto · may"), with the year
 *   said once, on its group's marker, instead of on fifteen rocks;
 * - **a clip says it is a clip**, since it is the rock where something moves;
 * - **a screen reader hears what is known** — the description once Aidan has
 *   written it, and until then "photograph, may 2025", never a filename.
 *
 * Places come from captions.json and are blank until written, so today the
 * labels are months. Filling in `places` upgrades every label at once.
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
 * The line under a rock. Place and month, then "clip" for a clip. Empty for an
 * undated still — the group marker already says "undated", and a bracketed
 * placeholder on the page would be noise on every one of them.
 */
export function rockLabel(caption: Caption, kind: Kind): string {
  const parts = [caption.place, caption.month].filter(Boolean)
  if (kind === 'video') parts.push('clip')
  return parts.join(' · ')
}

/**
 * The rock's accessible name. The written description wins; until there is
 * one, what is actually known, in the order a person would say it.
 */
export function rockName(caption: Caption, kind: Kind): string {
  if (!caption.altMissing) return caption.alt
  const what = kind === 'video' ? 'clip' : 'photograph'
  const when = [caption.month, caption.year].filter(Boolean).join(' ') || 'undated'
  return [what, caption.place, when].filter(Boolean).join(', ')
}
