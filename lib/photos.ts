import { readdirSync } from 'node:fs'
import { extname, join } from 'node:path'

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.avif', '.gif'])

/**
 * The photographs the koi carries, read from public/photos at build time.
 *
 * Adding a photograph is dropping a file in that folder — no code change, no
 * manifest to keep in step. Server-only: it touches the filesystem, so it can
 * only be called from a server component.
 */
export function listPhotos(): string[] {
  try {
    return readdirSync(join(process.cwd(), 'public', 'photos'))
      .filter((file) => IMAGE_EXTENSIONS.has(extname(file).toLowerCase()))
      .sort()
      .map((file) => `/photos/${file}`)
  } catch {
    return []
  }
}
