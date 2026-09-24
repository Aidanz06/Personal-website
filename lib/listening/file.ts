import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { ListeningFile } from './types.ts'

/**
 * Reading and writing content/listening.json. Server-only, and separate from
 * boulders.ts for exactly that reason: a `node:fs` import anywhere in a
 * client component's graph fails the build.
 *
 * The write half is used by `npm run listening:covers` and by nothing else.
 * Nothing writes this file during a build — a build that edits its own source
 * is a build nobody can reason about.
 */

/**
 * Written out as literal segments rather than built from the LISTENING_FILE
 * constant. Next's build traces filesystem access statically, and a path it
 * cannot read at build time makes it trace and deploy the ENTIRE project as
 * server code — public folder included. The constant is still what the
 * covers script prints; this is the one place that has to be spelled out.
 */
export const LISTENING_PATH = join(process.cwd(), 'content', 'listening.json')

/**
 * Read the file, at build time.
 *
 * A missing or half-edited file is not an error: /listening still renders,
 * with no boulders and no hide list. The page being blank in the right place
 * is more useful than a build that fails.
 */
export function loadListeningFile(path = LISTENING_PATH): ListeningFile {
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as ListeningFile
    return {
      neverLeave: Array.isArray(parsed.neverLeave) ? parsed.neverLeave : [],
      hide: Array.isArray(parsed.hide) ? parsed.hide : [],
    }
  } catch {
    return { neverLeave: [], hide: [] }
  }
}

/** Write it back, formatted the way it is written by hand. */
export function saveListeningFile(file: ListeningFile, path = LISTENING_PATH): void {
  writeFileSync(path, `${JSON.stringify(file, null, 2)}\n`)
}
