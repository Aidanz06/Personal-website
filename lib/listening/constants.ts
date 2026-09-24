/**
 * The numbers behind /listening, in one place.
 *
 * Every one of these is a judgement that might want changing later — how far
 * back "on repeat" reaches, how many plays count as listening to a record
 * rather than passing through it — so none of them is typed into the middle
 * of a function.
 *
 * Pure. No filesystem, no environment, nothing server-only: this module is
 * reachable from the client bundle and must stay reachable safely.
 */

/** The windows last.fm's user.getTopAlbums understands, of the ones we use. */
export type Period = '7day' | '1month' | '3month'

/**
 * How far back the pebbles reach.
 *
 * One constant, because it appears in three places that must agree: the API
 * request, the label on the page, and what the page means. Changing it here
 * changes the label too.
 */
export const LISTENING_PERIOD: Period = '1month'

/** What each period is called on the page. Derived from the constant above. */
export const PERIOD_LABELS: Record<Period, string> = {
  '7day': 'last 7 days',
  '1month': 'last 30 days',
  '3month': 'last 90 days',
}

/**
 * How many pebbles at most.
 *
 * Six to eight. Fewer reads as a top-five list; more turns the surface of the
 * pond into gravel and the sizes stop being distinguishable.
 */
export const MAX_PEBBLES = 8

/**
 * Fewest plays an album needs before it counts.
 *
 * Below this it is something that was on once, not something on repeat — and
 * a one-play album rendered at the smallest size is a speck the reader cannot
 * open on a phone.
 */
export const MIN_PLAYCOUNT = 4

/**
 * Cover width requested from Next's image optimiser.
 *
 * 640 is the smallest entry in Next's default `deviceSizes`, and a width
 * outside that allowlist is a 400 from the optimiser rather than a slightly
 * different file — the same trap the photographs hit with `q=72`. last.fm's
 * largest size is around 300px square anyway, so there is nothing above this
 * to ask for.
 */
export const COVER_WIDTH = 640
/** Next 16's default `images.qualities` allowlist is `[75]`. */
export const COVER_QUALITY = 75

/** last.fm's API root. Used by the page's fetch and by the covers script. */
export const LASTFM_ENDPOINT = 'https://ws.audioscrobbler.com/2.0/'

/** Where `npm run listening:covers` puts the boulders' covers. */
export const COVERS_DIR = 'public/listening/covers'
/** The same folder as a URL. */
export const COVERS_URL = '/listening/covers'

/** Aidan's file: the boulders, and the hide list. */
export const LISTENING_FILE = 'content/listening.json'

/** Shown under a boulder that has no line written for it yet. */
export const BOULDER_LINE_PLACEHOLDER = '[why this one never leaves — aidan to write]'
