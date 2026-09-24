/**
 * Photograph captions: what a picture is, where it was taken, and what the
 * camera was set to.
 *
 * Pure: no filesystem, because the homepage is a client component and a
 * `node:fs` import anywhere in its graph fails the build. Reading the file is
 * lib/captionsFile.ts, which only ever runs on the server.
 *
 * The data lives in public/photos/captions.json, written partly by
 * `npm run photos:sync` (date and settings, read from EXIF) and partly by
 * Aidan (the description and the personal line). Every field is allowed to be
 * blank, and a blank one is omitted rather than rendered as an empty bracket
 * or the word "undefined" — an unfinished caption should look like a
 * photograph with no caption, not like a bug.
 */

export type CaptionEntry = {
  /** Screen-reader description of the photograph. */
  alt?: string
  /** An optional line from Aidan. */
  line?: string
  /** "YYYY-MM-DD", from EXIF. Also the key into `places`. */
  date?: string
  /** "f/8 · 1/160 · iso 320", from EXIF. */
  settings?: string
}

export type CaptionsFile = {
  /** One place per shoot date, so a whole day is named once. */
  places?: Record<string, string>
  photos?: Record<string, CaptionEntry>
}

export type Caption = {
  /** What a screen reader gets. Never blank: falls back to a placeholder. */
  alt: string
  /** True while `alt` is still that placeholder. */
  altMissing: boolean
  /** Line one: "kamakura · may 2025". Blank if neither is known. */
  headline: string
  /** Line two: Aidan's own line, if he wrote one. */
  line: string
  /** Line three: "f/8 · 1/160 · iso 320". */
  settings: string
  /** The same thing as one readable sentence, for a screen reader. */
  description: string
}

const MONTHS = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
]

/**
 * "2025-05-22" becomes "may 2025".
 *
 * Month and year only, never the day and never the time. The camera's clock
 * is set to the wrong timezone, so the day is not reliably the day the
 * photograph was taken — and at month resolution the error cannot show.
 */
export function formatMonthYear(date: string | undefined): string {
  if (!date) return ''
  const match = /^(\d{4})-(\d{2})/.exec(date.trim())
  if (!match) return ''
  const month = MONTHS[Number(match[2]) - 1]
  return month ? `${month} ${match[1]}` : ''
}

/** The bracketed stand-in shown, and read out, when a photograph has no description. */
export function missingAltFor(file: string): string {
  return `[photograph — aidan to describe: ${file}]`
}

function clean(value: string | undefined): string {
  return (value ?? '').trim()
}

/**
 * Join caption parts into sentences, without doubling punctuation.
 *
 * Aidan's line is a sentence and will usually already end in a full stop, so
 * a plain `join('. ')` produces "…said.. f/8" — which a screen reader reads
 * as a pause of the wrong length and a sighted reader reads as a typo.
 */
function joinSentences(parts: readonly string[]): string {
  return parts
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => (/[.!?]$/.test(part) ? part : `${part}.`))
    .join(' ')
    // The last part is a fragment, not a sentence: settings do not want a
    // full stop and neither does a bare "may 2025".
    .replace(/\.$/, '')
}

/**
 * Join the parts of a caption for a given photograph.
 *
 * Place comes from the shoot date rather than from the photograph, because a
 * shoot happens in one place and naming it thirty times is thirty chances to
 * type it differently.
 */
export function resolveCaption(file: string, data: CaptionsFile): Caption {
  const entry = data.photos?.[file] ?? {}
  const alt = clean(entry.alt)
  const line = clean(entry.line)
  const settings = clean(entry.settings)
  const date = clean(entry.date)
  const place = clean(date ? data.places?.[date] : undefined)
  const when = formatMonthYear(date)

  // Both, either, or neither — and "neither" is an empty string, not " · ".
  const headline = place && when ? `${place} · ${when}` : place || when

  const description = joinSentences([
    headline.replace(' · ', ', '),
    line,
    settings.replace(/ · /g, ', '),
  ])

  return {
    alt: alt || missingAltFor(file),
    altMissing: alt === '',
    headline,
    line,
    settings,
    description,
  }
}

/** True when there is nothing at all to show beneath the photograph. */
export function isCaptionEmpty(caption: Caption): boolean {
  return !caption.headline && !caption.line && !caption.settings
}
