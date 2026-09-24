import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { site } from './site'
import { PREVIEW_IMAGE, PUBLIC_ROUTES, pageOpenGraph, sitemapEntries, robotsRules } from './siteMeta'

/**
 * What a crawler or a link preview sees.
 *
 * The domain is live and the apex (aidanzheng.me) 308-redirects to www, so
 * www is the one true address: canonical links, the sitemap and the
 * preview image all have to use it, or every share and every search result
 * goes through a redirect first.
 */

describe('the site address', () => {
  it('is the live www domain, not the placeholder', () => {
    expect(site.url).toBe('https://www.aidanzheng.me')
  })
})

describe('the sitemap', () => {
  it('lists every public page at the www address', () => {
    expect(sitemapEntries().map((e) => e.url)).toEqual([
      'https://www.aidanzheng.me/',
      'https://www.aidanzheng.me/tailor-studio',
      'https://www.aidanzheng.me/about',
      'https://www.aidanzheng.me/listening',
    ])
  })

  it('leaves out the lab, which is marked noindex', () => {
    expect(PUBLIC_ROUTES).not.toContain('/lab')
  })
})

describe('robots', () => {
  it('points crawlers at the sitemap and keeps them out of the lab', () => {
    const rules = robotsRules()
    expect(rules.sitemap).toBe('https://www.aidanzheng.me/sitemap.xml')
    expect(rules.rules).toMatchObject({ userAgent: '*', allow: '/', disallow: '/lab' })
  })
})

describe('canonical links', () => {
  // Set per page, never in the root layout: a canonical there would be
  // inherited by every page and tell search engines they are all the homepage.
  const pages: Record<string, string> = {
    'app/page.tsx': "'/'",
    'app/listening/page.tsx': "'/listening'",
    'app/(page)/about/page.mdx': "'/about'",
    'app/(page)/tailor-studio/page.mdx': "'/tailor-studio'",
  }
  for (const [file, path] of Object.entries(pages)) {
    it(`${file} declares its own canonical`, () => {
      const source = readFileSync(join(process.cwd(), file), 'utf8')
      expect(source).toContain(`alternates: { canonical: ${path} }`)
    })
  }

  it('the root layout sets the base, not a canonical', () => {
    const layout = readFileSync(join(process.cwd(), 'app/layout.tsx'), 'utf8')
    expect(layout).toContain('metadataBase: new URL(site.url)')
    expect(layout).not.toMatch(/canonical\s*:/)
  })
})

describe('link previews', () => {
  it('give each page its own title and address, on top of the shared defaults', () => {
    expect(pageOpenGraph('tailor studio', 'drafts grailed listings', '/tailor-studio')).toEqual({
      type: 'website',
      siteName: 'aidan zheng',
      locale: 'en_US',
      title: 'tailor studio — aidan zheng',
      description: 'drafts grailed listings',
      url: '/tailor-studio',
      images: [PREVIEW_IMAGE],
    })
  })

  it('does not repeat the name on the homepage', () => {
    expect(pageOpenGraph(null, 'x', '/').title).toBe('aidan zheng')
  })
})

describe('the preview image', () => {
  // A page's own openGraph replaces the parent's wholesale, and that took the
  // file-convention image (app/opengraph-image.png) with it: /about,
  // /tailor-studio and /listening shipped with no og:image at all.
  it('is carried by every page preview, not left to inheritance', () => {
    for (const path of PUBLIC_ROUTES) {
      expect(pageOpenGraph(null, 'x', path).images).toEqual([PREVIEW_IMAGE])
    }
  })

  it('is a real 1200×630 file in public/', () => {
    const png = readFileSync(join(process.cwd(), 'public', PREVIEW_IMAGE.url))
    expect(png.readUInt32BE(16)).toBe(1200)
    expect(png.readUInt32BE(20)).toBe(630)
    expect(PREVIEW_IMAGE.alt.length).toBeGreaterThan(0)
  })
})
