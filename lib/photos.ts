import { readdirSync } from 'node:fs'
import { extname, join } from 'node:path'
import { resolveCaption, type Caption } from './captions'
import { loadCaptions } from './captionsFile'

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.avif', '.gif'])

/**
 * Width the pond actually needs.
 *
 * A photograph never opens wider than 600 CSS pixels, so 1200 covers a 2×
 * display with nothing to spare and nothing wasted. Straight from the camera
 * these are 2048px and up to 3.3MB each, which is an order of magnitude over
 * the PRD's 250KB budget — and the pond is the first thing anyone sees.
 */
const PHOTO_WIDTH = 1200
/**
 * Next 16 only accepts qualities from an allowlist, which defaults to [75];
 * anything else is a 400 from the optimiser rather than a slightly different
 * file. Changing this means adding the value to `images.qualities` in
 * next.config.ts as well.
 */
const PHOTO_QUALITY = 75

/**
 * Route a photograph through Next's image optimiser.
 *
 * It re-encodes to AVIF or WebP at the requested width and caches the result,
 * so the browser fetches a couple of hundred kilobytes instead of a couple of
 * megabytes. Same-origin, so it does not taint the canvas the way a
 * cross-origin image would.
 */
function optimised(src: string): string {
  return `/_next/image?url=${encodeURIComponent(src)}&w=${PHOTO_WIDTH}&q=${PHOTO_QUALITY}`
}

export type Photo = {
  /** Filename, which is the key into captions.json. */
  file: string
  /** What the canvas loads: optimised. */
  src: string
  /** The original file, kept for the filename and for a full-size link later. */
  original: string
  /** Description, place, date and exposure. Blank fields are omitted, never shown. */
  caption: Caption
}

/**
 * The photographs, read from public/photos at build time.
 *
 * Adding one is dropping a file in that folder — no code change and no
 * manifest to keep in step. Server-only: it touches the filesystem.
 */
export function listPhotos(): Photo[] {
  // Read once for the whole folder rather than per photograph.
  const captions = loadCaptions()
  try {
    return readdirSync(join(process.cwd(), 'public', 'photos'))
      .filter((file) => IMAGE_EXTENSIONS.has(extname(file).toLowerCase()))
      .sort()
      .map((file) => ({
        file,
        src: optimised(`/photos/${file}`),
        original: `/photos/${file}`,
        caption: resolveCaption(file, captions),
      }))
  } catch {
    return []
  }
}
