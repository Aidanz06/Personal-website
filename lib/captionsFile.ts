import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { CaptionsFile } from './captions'

/**
 * Reading captions.json. Server-only, and separate from lib/captions.ts for
 * exactly that reason: the homepage is a client component, and a `node:fs`
 * import anywhere in a client component's import graph fails the build with
 * an error that names the bundler rather than the import.
 */

const CAPTIONS_PATH = join(process.cwd(), 'public', 'photos', 'captions.json')

/**
 * Read captions.json, at build time.
 *
 * A missing or half-edited file is not an error. Every photograph still
 * renders; they just have no captions and their descriptions show as
 * placeholders, which is visible on the page rather than silent.
 */
export function loadCaptions(path = CAPTIONS_PATH): CaptionsFile {
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as CaptionsFile
    return {
      places: parsed.places ?? {},
      photos: parsed.photos ?? {},
    }
  } catch {
    return { places: {}, photos: {} }
  }
}
