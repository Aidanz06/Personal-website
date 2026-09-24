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
import { bannerSupports } from '../banner'

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

/** Longest label line, in letters. Past this it runs off a phone screen. */
export const LABEL_LINE_CHARS = 8

/**
 * The label under a rock: Aidan's name for the photograph, as lines ready to
 * draw. Nothing at all until he names it. A month under every rock read "may"
 * fourteen times in a row, and a placeholder would be noise on every rock.
 *
 * Lowercased, and stripped to what the banner font can draw. Wrapped at word
 * boundaries to LABEL_LINE_CHARS, because ASCII art can't reflow like text,
 * and a long line under a rock near the edge of a 375px screen runs off it.
 * A single word longer than that stays whole rather than being cut.
 */
export function rockLabel(caption: Caption): string[] {
  const drawable = [...caption.name.toLowerCase()].filter((char) => bannerSupports(char)).join('')
  const words = drawable.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    if (!current) current = word
    else if (`${current} ${word}`.length <= LABEL_LINE_CHARS) current = `${current} ${word}`
    else {
      lines.push(current)
      current = word
    }
  }
  if (current) lines.push(current)
  return lines
}

/**
 * The rock's accessible name. The written description wins; until there is
 * one, what is actually known, in the order a person would say it.
 */
export function rockName(caption: Caption, kind: Kind): string {
  if (!caption.altMissing) return caption.alt
  const what = kind === 'video' ? 'clip' : 'photograph'
  const when = [caption.month, caption.year].filter(Boolean).join(' ') || 'undated'
  return [what, caption.name, caption.place, when].filter(Boolean).join(', ')
}
