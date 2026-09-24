/**
 * Scan public/photos, and keep captions.json in step with it.
 *
 * Run: npm run photos:sync
 *
 * It fills in what the camera knows — the date and the exposure, read
 * straight out of each file's EXIF — and never touches a word Aidan wrote.
 * New photographs arrive with blank `alt` and `line`; new shoot dates arrive
 * in `places` with a blank value. Then it prints what is still blank.
 *
 * Run manually, not on every build: it writes a file into the repo, and a
 * build that edits its own source is a build nobody can reason about.
 *
 * Node runs this .ts file directly in strip-only mode, so nothing here may
 * use TypeScript syntax that needs real compilation — no enums, no
 * parameter properties, no decorators.
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { extname, join } from 'node:path'
import { formatSettings, readExif, trustedDate } from '../lib/exif.ts'
import { mergeCaptions, type ScannedPhoto } from '../lib/photosSync.ts'
import { loadCaptions } from '../lib/captionsFile.ts'

const PHOTOS_DIR = join(process.cwd(), 'public', 'photos')
const CAPTIONS_PATH = join(PHOTOS_DIR, 'captions.json')
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.avif'])
/**
 * Clips are scanned too. They carry no EXIF, so their date and settings come
 * back blank and land on the checklist for Aidan to fill in — which is
 * honest, and better than the alternative: an mp4's container timestamp is
 * rewritten by any transcode, so reading one would confidently record the
 * date the file was last processed as the day the clip was shot.
 */
const VIDEO_EXTENSIONS = new Set(['.mp4', '.webm', '.mov'])

function scan(): ScannedPhoto[] {
  return readdirSync(PHOTOS_DIR)
    .filter((file) => {
      const extension = extname(file).toLowerCase()
      return IMAGE_EXTENSIONS.has(extension) || VIDEO_EXTENSIONS.has(extension)
    })
    .sort()
    .map((file) => {
      const fields = readExif(readFileSync(join(PHOTOS_DIR, file)))
      return {
        file,
        // trustedDate, not fields.date: a date with no exposure data behind
        // it is an export date wearing a shoot date's clothes.
        date: trustedDate(fields) ?? '',
        settings: formatSettings(fields),
      }
    })
}

function list(label: string, items: readonly string[]): void {
  if (items.length === 0) return
  console.log(`\n${label} (${items.length})`)
  for (const item of items) console.log(`  ${item}`)
}

const photos = scan()
const result = mergeCaptions(loadCaptions(CAPTIONS_PATH), photos)

writeFileSync(CAPTIONS_PATH, `${JSON.stringify(result.captions, null, 2)}\n`)

console.log(`scanned ${photos.length} photograph${photos.length === 1 ? '' : 's'} in public/photos`)
if (result.added.length === 0 && result.newDates.length === 0) {
  console.log('captions.json was already up to date')
}
list('added', result.added)
list('new shoot dates — each one needs a place', result.newDates)

console.log('\n--- still to write ---')
if (result.missingPlace.length === 0 && result.missingAlt.length === 0) {
  console.log('nothing. every photograph has a description and every shoot has a place.')
}
list('shoot dates with no place', result.missingPlace)
list('photographs with no description (alt)', result.missingAlt)
list(
  'no usable date — clips carry none, and an export with no camera EXIF has\n  only the date it was exported. Type the shoot date in',
  result.missingDate,
)
list('photographs with no name (no label under their rock)', result.missingName)
list('photographs with no personal line (optional)', result.missingLine)
list('entries whose file is gone — kept, delete by hand if you meant it', result.orphans)

const blocking =
  result.missingPlace.length + result.missingAlt.length + result.missingDate.length
console.log(
  `\n${blocking} field${blocking === 1 ? '' : 's'} still blank that should not ship blank.`,
)
