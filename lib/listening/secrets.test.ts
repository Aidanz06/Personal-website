import { readFileSync, existsSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * The API key must not reach the browser.
 *
 * Next only inlines environment variables prefixed `NEXT_PUBLIC_`, so
 * `process.env.LASTFM_API_KEY` in a server component is safe by construction.
 * But "safe by construction" is a property of the code as written, and the
 * way it stops being true is somebody importing the wrong module into a
 * client component a month from now — at which point the key is compiled
 * into a JavaScript file served to every visitor, silently.
 *
 * So this walks the real import graph from every client entry point and
 * asserts what is reachable from it, the same way lib/captions.test.ts
 * asserts that no `node:` builtin is reachable from the homepage.
 */

const ROOT = resolve(__dirname, '..', '..')

/**
 * Where the client bundle starts.
 *
 * Every file marked 'use client', plus anything they pull in. Listed by hand
 * rather than discovered, because a list that silently finds nothing is a
 * test that silently passes.
 */
const CLIENT_ENTRIES = [
  'components/Pond.tsx',
  'components/PondHome.tsx',
  'components/PondBackdrop.tsx',
  'components/ThemeMenu.tsx',
  'components/PageFlow.tsx',
  'components/SlideshowViewer.tsx',
  'components/AsciiImage.tsx',
  'components/LoopingClip.tsx',
]

/** The names that must never be reachable from any of the above. */
const SECRETS = ['LASTFM_API_KEY', 'LASTFM_USER']

const EXTENSIONS = ['', '.ts', '.tsx', '.json', '/index.ts', '/index.tsx']

/**
 * Comments out, before anything is searched.
 *
 * The same trap the suppressHydrationWarning test fell into: the first
 * version of this failed on the comment in boulders.ts explaining why a
 * `node:fs` import must not appear there. A test that fails on its own
 * documentation teaches everyone to weaken the test.
 *
 * The `[^:\w]` guard is what keeps `https://` out of it.
 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:\w])\/\/.*$/gm, '$1')
}

function resolveSpecifier(specifier: string, fromFile: string): string | null {
  // Bare specifiers are packages: react, next/image. Not our code.
  let base: string
  if (specifier.startsWith('@/')) base = join(ROOT, specifier.slice(2))
  else if (specifier.startsWith('.')) base = resolve(dirname(fromFile), specifier)
  else return null

  for (const extension of EXTENSIONS) {
    const candidate = `${base}${extension}`
    if (existsSync(candidate) && !candidate.endsWith('/')) {
      try {
        if (readFileSync(candidate).length >= 0) return candidate
      } catch {
        // A directory. Keep looking.
      }
    }
  }
  return null
}

/** Every file reachable from these entry points, transitively. */
function importGraph(entries: readonly string[]): Map<string, string> {
  const seen = new Map<string, string>()
  const queue = entries.map((entry) => join(ROOT, entry))

  while (queue.length > 0) {
    const file = queue.pop()!
    if (seen.has(file)) continue
    let source: string
    try {
      source = readFileSync(file, 'utf8')
    } catch {
      continue
    }
    seen.set(file, stripComments(source))

    const pattern = /(?:from|import)\s*['"]([^'"]+)['"]/g
    let match: RegExpExecArray | null
    while ((match = pattern.exec(source)) !== null) {
      const resolved = resolveSpecifier(match[1]!, file)
      if (resolved && !seen.has(resolved)) queue.push(resolved)
    }
  }
  return seen
}

describe('the last.fm key', () => {
  const graph = importGraph(CLIENT_ENTRIES)

  it('has entry points that actually exist', () => {
    // A resolver that quietly finds nothing is a test that quietly passes.
    for (const entry of CLIENT_ENTRIES) {
      expect(existsSync(join(ROOT, entry)), entry).toBe(true)
    }
    expect(graph.size).toBeGreaterThan(CLIENT_ENTRIES.length)
  })

  it('is never named anywhere the browser can reach', () => {
    for (const [file, source] of graph) {
      for (const secret of SECRETS) {
        expect(source.includes(secret), `${relative(ROOT, file)} names ${secret}`).toBe(false)
      }
    }
  })

  it('is not reachable through process.env either', () => {
    // Even a harmless-looking `process.env.SOMETHING` in the client graph is
    // the shape this goes wrong in.
    for (const [file, source] of graph) {
      expect(source.includes('process.env'), `${relative(ROOT, file)} reads process.env`).toBe(
        false,
      )
    }
  })

  it('is not reachable through the server-only listening modules', () => {
    for (const [file] of graph) {
      const name = relative(ROOT, file)
      expect(name, `${name} is server-only`).not.toBe('lib/listening/lastfm.ts')
      expect(name, `${name} is server-only`).not.toBe('lib/listening/data.ts')
      expect(name, `${name} is server-only`).not.toBe('lib/listening/file.ts')
    }
  })
})

describe('the modules the page shares with the browser', () => {
  const shared = [
    'lib/listening/albums.ts',
    'lib/listening/boulders.ts',
    'lib/listening/constants.ts',
    'lib/listening/types.ts',
  ]

  it('import no node builtins, so they can cross the boundary', () => {
    // The same failure lib/captions.ts had: a node:fs import in a client
    // component's graph fails the build with an error naming the bundler
    // rather than the import.
    for (const file of shared) {
      const source = stripComments(readFileSync(join(ROOT, file), 'utf8'))
      expect(source.includes('node:'), `${file} imports a node builtin`).toBe(false)
    }
  })

  it('read no environment at all', () => {
    for (const file of shared) {
      const source = stripComments(readFileSync(join(ROOT, file), 'utf8'))
      expect(source.includes('process.env'), `${file} reads process.env`).toBe(false)
    }
  })
})

describe('.env.example', () => {
  it('is committed, names both variables, and carries no values', () => {
    const example = readFileSync(join(ROOT, '.env.example'), 'utf8')
    for (const secret of SECRETS) {
      expect(example).toContain(`${secret}=`)
      // A value in a committed example file is a leaked credential.
      expect(new RegExp(`${secret}=[ \\t]*\\S`).test(example)).toBe(false)
    }
  })

  it('never suggests a NEXT_PUBLIC_ name, which would be inlined', () => {
    const example = readFileSync(join(ROOT, '.env.example'), 'utf8')
    expect(example).not.toMatch(/^NEXT_PUBLIC_LASTFM/m)
  })
})
