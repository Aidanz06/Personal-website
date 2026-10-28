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
  'about, tailor studio and $1,000': 'mdx-components.tsx',
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

describe('project pages', () => {
  // Each project's title, headings and stone label are its logo, in its own
  // deck's display face: Instrument Serif for tailor studio, Silkscreen
  // (pixel) for $1,000, Literata (the app's own serif) for secretariat.
  const fonts = readFileSync(join(process.cwd(), 'app/projectFonts.ts'), 'utf8')

  it('loads each project face once, into --ff-project', () => {
    expect(fonts).toMatch(/import \{ Instrument_Serif, Literata, Silkscreen \} from 'next\/font\/google'/)
    expect(fonts.match(/variable: '--ff-project'/g)).toHaveLength(3)
  })

  for (const project of ['secretariat', 'thousand', 'tailor-studio']) {
    it(`/${project} sets its headings in the project's face`, () => {
      const layout = readFileSync(join(process.cwd(), `app/(page)/${project}/layout.tsx`), 'utf8')
      expect(layout).toContain(`<ProjectHeadings project="${project}">`)
    })
  }

  it('gives every logo a paper-theme accent', () => {
    expect(fonts.match(/accent: \{ dark: '#[0-9a-f]{6}', paper: '#[0-9a-f]{6}' \}/g)).toHaveLength(3)
  })

  it('redefines only --font-display, so body text stays in the site font', () => {
    const source = readFileSync(join(process.cwd(), 'components/ProjectHeadings.tsx'), 'utf8')
    expect(source).toMatch(/'--font-display': `var\(--ff-project\), \$\{logo\.fallback\}`/)
    expect(source).not.toMatch(/--font-body|--font-mono/)
  })

  it("draws secretariat's S mark as its S, on its page and its stone", () => {
    expect(fonts).toMatch(/mark: SecretariatMark/)
    const logo = readFileSync(join(process.cwd(), 'components/ProjectLogo.tsx'), 'utf8')
    expect(logo).toMatch(/\{Mark && <Mark \/>\}/)
    const page = readFileSync(join(process.cwd(), 'app/(page)/secretariat/page.mdx'), 'utf8')
    expect(page).toMatch(/^# <SecretariatMark \/>ecretariat$/m)
    const mark = readFileSync(join(process.cwd(), 'components/SecretariatMark.tsx'), 'utf8')
    expect(mark).toContain('<span className="logo-letter">S</span>')
  })

  it("labels a project's stone in the pond with its logo", () => {
    const home = readFileSync(join(process.cwd(), 'components/PondHome.tsx'), 'utf8')
    expect(home).toMatch(/<ProjectLogo project=/)
  })
})
