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
  // Critique of 2026-09-24 (second run): a mistyped link landed on Next's
  // unstyled default, "404: This page could not be found", with no pond and
  // no way home.
  'not found': 'app/not-found.tsx',
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

describe('the 404 page', () => {
  it('is in the pond, with a way back to the surface', () => {
    const source = readFileSync(join(process.cwd(), 'app/not-found.tsx'), 'utf8')
    expect(source).toMatch(/<PondBackdrop \/>/)
    expect(source).toMatch(/href="\/"/)
  })
})
