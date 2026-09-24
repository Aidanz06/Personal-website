/**
 * Fetch the cover art for the albums that never leave.
 *
 * Run: npm run listening:covers
 *
 * The boulders on /listening are Aidan's own choices, and they should not go
 * blank because last.fm is having an afternoon. So their covers are fetched
 * once, committed to the repo, and read from disk from then on. Only the
 * pebbles — the "on repeat" layer — depend on a live API.
 *
 * It is safe to run as many times as you like. It never overwrites a cover
 * value that is filled in, never downloads over a file that already exists,
 * and only ever writes inside public/listening/covers. A second run prints
 * what it found and changes nothing.
 *
 * Run manually, not on every build: it writes files into the repo, and a
 * build that edits its own source is a build nobody can reason about.
 *
 * Node runs this .ts file directly in strip-only mode, so nothing in its
 * import graph may use TypeScript syntax that needs real compilation — no
 * enums, no parameter properties, no decorators — and every relative import
 * carries its extension.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { isPlaceholderCover } from '../lib/listening/albums.ts'
import { COVERS_DIR, LISTENING_FILE } from '../lib/listening/constants.ts'
import {
  albumInfoUrl,
  applyCovers,
  coverFileName,
  extensionFromUrl,
  parseAlbumInfo,
  planCovers,
} from '../lib/listening/covers.ts'
import { loadListeningFile, saveListeningFile } from '../lib/listening/file.ts'

const coversDir = resolve(process.cwd(), COVERS_DIR)
const contentFile = resolve(process.cwd(), LISTENING_FILE)

/**
 * The guard that should have been on the clip transcoder.
 *
 * Nothing this script downloads may land anywhere but the covers folder, and
 * the content file is never a download target — it is edited, field by
 * field, and only where the field is blank.
 */
function assertWritable(path: string): void {
  const target = resolve(path)
  if (!target.startsWith(`${coversDir}/`)) {
    throw new Error(`refusing to write outside ${COVERS_DIR}: ${target}`)
  }
  if (target === contentFile) {
    throw new Error('refusing to write a cover over content/listening.json')
  }
  if (existsSync(target)) {
    throw new Error(`refusing to overwrite an existing file: ${target}`)
  }
}

const apiKey = (process.env.LASTFM_API_KEY ?? '').trim()

const file = loadListeningFile()
const plan = planCovers(file)

const named = plan.jobs.length + plan.alreadySet.length
console.log(
  `${LISTENING_FILE}: ${named} album${named === 1 ? '' : 's'} that never leave, ` +
    `${plan.emptySlots} empty slot${plan.emptySlots === 1 ? '' : 's'}`,
)

for (const name of plan.alreadySet) console.log(`  have   ${name}`)

if (plan.jobs.length === 0) {
  console.log('\nnothing to fetch.')
  if (plan.emptySlots > 0) {
    console.log(
      `${plan.emptySlots} slot${plan.emptySlots === 1 ? '' : 's'} still need an album and an artist.`,
    )
  }
  process.exit(0)
}

if (!apiKey) {
  console.log('\nLASTFM_API_KEY is not set, so nothing can be fetched.')
  console.log('Copy .env.example to .env.local and fill it in, then run this again.')
  for (const job of plan.jobs) console.log(`  needs a cover: ${job.album} · ${job.artist}`)
  process.exit(1)
}

mkdirSync(coversDir, { recursive: true })

const fills = new Map<number, string>()
const failed: string[] = []

for (const job of plan.jobs) {
  const label = `${job.album} · ${job.artist}`
  let url = ''
  try {
    const response = await fetch(albumInfoUrl(apiKey, job.artist, job.album))
    if (response.ok) url = parseAlbumInfo(await response.json())
  } catch {
    url = ''
  }

  if (!url || isPlaceholderCover(url)) {
    // No art, or last.fm's grey star. The boulder opens as its name drawn in
    // characters, which is a design rather than a failure — but it is worth
    // saying out loud, because a hand-dropped file would fix it.
    failed.push(label)
    continue
  }

  const name = coverFileName(job.artist, job.album, extensionFromUrl(url))
  const path = join(coversDir, name)

  if (existsSync(path)) {
    // The file is there but the JSON did not point at it. Record the name;
    // downloading over it would be exactly the mistake this script refuses
    // to make.
    console.log(`  kept   ${name} (already on disk)`)
    fills.set(job.index, name)
    continue
  }

  try {
    const image = await fetch(url)
    if (!image.ok) throw new Error(String(image.status))
    const bytes = Buffer.from(await image.arrayBuffer())
    assertWritable(path)
    writeFileSync(path, bytes)
    console.log(`  saved  ${name}  (${Math.round(bytes.length / 1024)}KB)  ${label}`)
    fills.set(job.index, name)
  } catch (error) {
    console.log(`  failed ${label}: ${error instanceof Error ? error.message : error}`)
    failed.push(label)
  }
}

if (fills.size > 0) {
  saveListeningFile(applyCovers(file, fills))
  console.log(`\nfilled in ${fills.size} cover field${fills.size === 1 ? '' : 's'} in ${LISTENING_FILE}`)
} else {
  console.log(`\n${LISTENING_FILE} unchanged`)
}

console.log('\n--- still missing ---')
if (failed.length === 0 && plan.emptySlots === 0) {
  console.log('nothing. every album that never leaves has a cover.')
}
for (const name of failed) console.log(`  no cover art found: ${name}`)
if (plan.emptySlots > 0) {
  console.log(`  ${plan.emptySlots} empty slot${plan.emptySlots === 1 ? '' : 's'} in neverLeave`)
}
