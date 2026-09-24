import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { imageSize } from './imageSize'

/**
 * The tailor studio slideshow, read from public/tailor-studio/slides at build
 * time.
 *
 * Adding a slide is dropping a numbered image in that folder. Order comes
 * from the filename, so reordering is renaming — there is no list anywhere
 * that can fall out of step with the folder.
 *
 * Server-only: it touches the filesystem.
 */

const SLIDES_DIR = join(process.cwd(), 'public', 'tailor-studio', 'slides')
const MANIFEST_PATH = join(process.cwd(), 'public', 'tailor-studio', 'slides.json')
const SLIDE_EXTENSIONS = /\.(png|jpe?g|webp|avif)$/i

export type Slide = {
  /** Filename, which is also the key in slides.json. */
  file: string
  /** Public path, served straight out of /public. */
  src: string
  width: number
  height: number
  /** What a screen reader gets. Slides are pictures of text, so this matters. */
  alt: string
  /** True when `alt` is machine-drafted and still needs Aidan's eye. */
  draft: boolean
  /** True when there is no alt text at all yet. */
  missing: boolean
}

type ManifestEntry = { alt?: string; draft?: boolean }
type Manifest = { slides?: Record<string, ManifestEntry> }

function readManifest(manifestPath: string): Record<string, ManifestEntry> {
  try {
    const parsed = JSON.parse(readFileSync(manifestPath, 'utf8')) as Manifest
    return parsed.slides ?? {}
  } catch {
    // No manifest yet, or a half-edited one. Slides still render; they just
    // all report their alt text as missing, which is visible on the page.
    return {}
  }
}

/**
 * Sort by the number in the filename, not by the string.
 *
 * A plain sort puts "10.png" before "2.png". Zero-padded names dodge that,
 * but relying on the convention means one unpadded file silently reorders the
 * deck — and a reordered deck is the kind of bug nobody notices until the
 * presentation makes no sense.
 */
export function compareSlideFiles(a: string, b: string): number {
  const numberOf = (name: string) => {
    const match = /^(\d+)/.exec(name)
    return match ? Number(match[1]) : Number.POSITIVE_INFINITY
  }
  const diff = numberOf(a) - numberOf(b)
  return diff !== 0 && Number.isFinite(diff) ? diff : a.localeCompare(b)
}

/** The placeholder shown, and read out, when a slide has no alt text yet. */
export function missingAltFor(position: number): string {
  return `[slide ${String(position).padStart(2, '0')} — one sentence saying what this slide shows, aidan to write]`
}

/**
 * The deck in a given folder, described by a given manifest.
 *
 * Separated from `listSlides` only so the tests can point it at a fixture
 * folder instead of at the real one, which changes whenever Aidan adds a
 * slide.
 */
export function readSlides(
  slidesDir: string,
  manifestPath: string,
  publicPath: string,
): Slide[] {
  let files: string[]
  try {
    files = readdirSync(slidesDir).filter((file) => SLIDE_EXTENSIONS.test(file))
  } catch {
    return []
  }
  files.sort(compareSlideFiles)

  const manifest = readManifest(manifestPath)

  return files.flatMap((file, index) => {
    // Dimensions are read from the file header rather than configured, so a
    // slide can never reserve the wrong box and shift the page as it loads.
    let size: ReturnType<typeof imageSize> = null
    try {
      size = imageSize(readFileSync(join(slidesDir, file)))
    } catch {
      size = null
    }
    // A file whose dimensions cannot be read is skipped rather than guessed
    // at: a guessed aspect ratio is a layout shift with extra steps.
    if (!size) return []

    const entry = manifest[file] ?? {}
    const alt = (entry.alt ?? '').trim()

    return [{
      file,
      src: `${publicPath}/${file}`,
      width: size.width,
      height: size.height,
      alt: alt || missingAltFor(index + 1),
      draft: alt !== '' && entry.draft !== false,
      missing: alt === '',
    }]
  })
}

/** The real deck: public/tailor-studio/slides. */
export function listSlides(): Slide[] {
  return readSlides(SLIDES_DIR, MANIFEST_PATH, '/tailor-studio/slides')
}
