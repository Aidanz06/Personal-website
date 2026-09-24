import type { CaptionsFile } from './captions'

/**
 * The merge behind `npm run photos:sync`.
 *
 * Kept separate from the script so it can be tested without a filesystem,
 * because the one thing this must never do — overwrite something Aidan wrote
 * — is exactly the kind of thing that is easy to get wrong on the second run
 * and painful to notice.
 */

export type ScannedPhoto = {
  file: string
  /** "YYYY-MM-DD" from EXIF, or '' when the file carries no date. */
  date: string
  /** "f/8 · 1/160 · iso 320" from EXIF, or '' when it carries no exposure. */
  settings: string
}

export type SyncResult = {
  captions: CaptionsFile
  /** Photographs that were not in the file before. */
  added: string[]
  /** Shoot dates that were not in `places` before. */
  newDates: string[]
  /** Photographs with no description. These block shipping. */
  missingAlt: string[]
  /** Shoot dates with no place. These block shipping too. */
  missingPlace: string[]
  /** Photographs with no personal line. Optional — not every picture needs one. */
  missingLine: string[]
  /**
   * Media with no date at all.
   *
   * Only clips reach this list: a photograph's date comes from its EXIF. A
   * blank date also means no place, because place is keyed by shoot date.
   */
  missingDate: string[]
  /** Entries whose file is no longer in the folder. Kept, never deleted. */
  orphans: string[]
}

function sortedRecord<T>(record: Record<string, T>): Record<string, T> {
  // Sorted so a sync produces a readable diff instead of a reshuffle.
  return Object.fromEntries(Object.entries(record).sort(([a], [b]) => a.localeCompare(b)))
}

export function mergeCaptions(
  existing: CaptionsFile,
  scanned: readonly ScannedPhoto[],
): SyncResult {
  const places = { ...(existing.places ?? {}) }
  const photos = { ...(existing.photos ?? {}) }

  const added: string[] = []
  const newDates: string[] = []

  for (const photo of scanned) {
    const before = photos[photo.file]
    if (!before) added.push(photo.file)

    photos[photo.file] = {
      // Aidan's words, untouched. This is the whole contract of the script:
      // it fills in what the camera knows and never touches what he wrote.
      alt: before?.alt ?? '',
      line: before?.line ?? '',
      // EXIF fills a blank, and only a blank. The camera clock is on the
      // wrong timezone, so a date he corrected by hand has to survive — and
      // a re-read from the same file would silently put the wrong one back.
      date: (before?.date ?? '').trim() || photo.date,
      settings: (before?.settings ?? '').trim() || photo.settings,
    }
  }

  for (const entry of Object.values(photos)) {
    const date = (entry.date ?? '').trim()
    if (!date || date in places) continue
    places[date] = ''
    newDates.push(date)
  }

  const scannedFiles = new Set(scanned.map((photo) => photo.file))
  const orphans = Object.keys(photos).filter((file) => !scannedFiles.has(file))

  const missingAlt: string[] = []
  const missingLine: string[] = []
  const missingDate: string[] = []
  for (const [file, entry] of Object.entries(photos)) {
    if (!(entry.alt ?? '').trim()) missingAlt.push(file)
    if (!(entry.line ?? '').trim()) missingLine.push(file)
    if (!(entry.date ?? '').trim()) missingDate.push(file)
  }

  const missingPlace = Object.entries(places)
    .filter(([, place]) => !place.trim())
    .map(([date]) => date)

  return {
    captions: { places: sortedRecord(places), photos: sortedRecord(photos) },
    added: added.sort(),
    newDates: newDates.sort(),
    missingAlt: missingAlt.sort(),
    missingPlace: missingPlace.sort(),
    missingLine: missingLine.sort(),
    missingDate: missingDate.sort(),
    orphans: orphans.sort(),
  }
}
