/**
 * The two lines of type above the pebbles.
 *
 * Both are derived from the period constant rather than typed out, so
 * changing `LISTENING_PERIOD` from a month to a week changes the request, the
 * label and what the page means, all at once. A hand-written label is how a
 * page ends up claiming thirty days of data it is not asking for.
 *
 * Its own month names rather than the ones in lib/captions.ts: that module is
 * about photographs, and a shared list would tie an album label to a caption
 * format that has different rules (month and year only, never a day, because
 * the camera clock is wrong).
 */

import { PERIOD_LABELS, type Period } from './constants.ts'

const MONTHS = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
]

/** "on repeat · last 30 days". */
export function onRepeatLabel(period: Period): string {
  return `on repeat · ${PERIOD_LABELS[period]}`
}

/**
 * "2026-09-23" becomes "as of september 23".
 *
 * A day, unlike a photograph's caption: this one is about freshness, and
 * "september" on its own does not say whether the data is a day or a month
 * old. Blank in, blank out — a page with no pebble data says nothing about
 * when it was fetched rather than claiming a date it does not have.
 */
export function formatAsOf(date: string | undefined): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec((date ?? '').trim())
  if (!match) return ''
  const month = MONTHS[Number(match[2]) - 1]
  if (!month) return ''
  // No leading zero: "september 03" reads like a serial number.
  const day = Number(match[3])
  if (!day) return ''
  return `as of ${month} ${day}`
}
