import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Every public page's title is the same size.
 *
 * Critique of 2026-09-24 (second run): /listening's h1 was `text-heading`
 * while the homepage and the MDX pages (/about, /tailor-studio) use
 * `text-name`, so one page's title read as a section heading.
 */

const sources: Record<string, string> = {
  homepage: 'components/PondHome.tsx',
  listening: 'components/ListeningPond.tsx',
  'about and tailor studio': 'mdx-components.tsx',
}

describe('page titles', () => {
  for (const [page, file] of Object.entries(sources)) {
    it(`${page} uses text-name for its h1`, () => {
      const source = readFileSync(join(process.cwd(), file), 'utf8')
      const h1 = /<h1[^>]*className="([^"]*)"/.exec(source)?.[1]
      expect(h1, `no h1 className in ${file}`).toBeDefined()
      expect(h1).toMatch(/\btext-name\b/)
    })
  }
})
