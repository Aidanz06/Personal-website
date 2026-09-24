/**
 * What the photo rocks say about themselves.
 *
 * The gallery used to be twenty-five rocks numbered 01 to 25 — nothing to
 * choose between, and a screen reader heard a filename twenty-five times.
 * The critique of 2026-09-24 scored recognition 1 of 4 for it. Now:
 *
 * - **order is time**, newest first, so going deeper goes back, the same way
 *   /listening reads — and the undated come last, at the bottom;
 * - **grouped by shoot**, one marker per trip ("kamakura · may 2025");
 * - **each rock carries Aidan's name for it**, and nothing until he writes
 *   one;
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
 * Newest month first, undated last, and within a month each place kept
 * together, so a shoot reads as one set rather than being interleaved with
 * another trip that happened the same month. Places within a month keep the
 * order they first appear in; photographs keep their filename order. Month
 * resolution, because the camera's clock is on the wrong timezone and the day
 * is not reliable.
 */
export function orderGallery<T extends { file: string; caption: Caption }>(
  photos: readonly T[],
): T[] {
  const firstSeen = new Map<string, number>()
  photos.forEach((photo, index) => {
    const key = shootKey(photo.caption)
    if (!firstSeen.has(key)) firstSeen.set(key, index)
  })
  return photos
    .map((photo, index) => ({ photo, index }))
    .sort((a, b) => {
      const da = sortableDate(a.photo.caption)
      const db = sortableDate(b.photo.caption)
      if (da && db && da !== db) return da < db ? 1 : -1
      if (da && !db) return -1
      if (!da && db) return 1
      const pa = firstSeen.get(shootKey(a.photo.caption))!
      const pb = firstSeen.get(shootKey(b.photo.caption))!
      if (pa !== pb) return pa - pb
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

/** One shoot: a place in a month. Everything undated is one "shoot". */
function shootKey(caption: Caption): string {
  const when = sortableDate(caption)
  return when ? `${when}|${caption.place}` : 'undated'
}

/**
 * The marker each photograph sits under, for a gallery already in
 * orderGallery's order: one per shoot, "kamakura · may 2025".
 *
 * A shoot of one photograph would be a marker and a row for a single rock,
 * and there are several of those in a row. So neighbouring lone photographs
 * share one marker, naming their places and the span they cover:
 * "hawaii, kaua'i · august 2025", or "qianling, hawaii · 2025–2026".
 *
 * Replaced the one-marker-per-year grouping after the second critique of
 * 2026-09-24, which found 2025 a single run of 17 rocks, 12 of them one day.
 */
export function galleryGroups(captions: readonly Caption[]): string[] {
  type Run = { key: string; captions: Caption[] }
  const runs: Run[] = []
  for (const caption of captions) {
    const key = shootKey(caption)
    const last = runs[runs.length - 1]
    if (last && last.key === key) last.captions.push(caption)
    else runs.push({ key, captions: [caption] })
  }

  // Neighbouring single-photograph shoots merge into one group.
  const groups: Caption[][] = []
  let pendingSingles: Caption[] = []
  const flush = () => {
    if (pendingSingles.length > 0) groups.push(pendingSingles)
    pendingSingles = []
  }
  for (const run of runs) {
    if (run.key !== 'undated' && run.captions.length === 1) {
      pendingSingles.push(run.captions[0]!)
    } else {
      flush()
      groups.push(run.captions)
    }
  }
  flush()

  return groups.flatMap((group) => {
    const label = groupLabel(group)
    return group.map(() => label)
  })
}

function groupLabel(group: readonly Caption[]): string {
  if (group.every((caption) => !sortableDate(caption))) return 'undated'
  const places = [...new Set(group.map((caption) => caption.place).filter(Boolean))]
  const months = new Set(group.map((caption) => `${caption.month} ${caption.year}`))
  const years = group.map((caption) => Number(caption.year))
  const when =
    months.size === 1
      ? [...months][0]!
      : Math.min(...years) === Math.max(...years)
        ? String(years[0])
        : `${Math.min(...years)}–${Math.max(...years)}`
  return places.length > 0 ? `${places.join(', ')} · ${when}` : when
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
