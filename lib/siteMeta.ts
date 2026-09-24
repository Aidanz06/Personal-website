import type { MetadataRoute } from 'next'
import { site } from './site'

/**
 * The pages a search engine should know about, in the order they sit in the
 * pond. /lab is a private workbench, marked noindex, and left out.
 */
export const PUBLIC_ROUTES = ['/', '/tailor-studio', '/about', '/listening'] as const

function absolute(path: string): string {
  return new URL(path, site.url).toString()
}

export function sitemapEntries(): MetadataRoute.Sitemap {
  return PUBLIC_ROUTES.map((path) => ({
    url: absolute(path),
    // /listening refreshes from last.fm every six hours; the rest change
    // when Aidan writes something.
    changeFrequency: path === '/listening' ? 'daily' : 'monthly',
  }))
}

export function robotsRules(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: '/lab' },
    sitemap: absolute('/sitemap.xml'),
  }
}

/**
 * The picture a shared link shows: the real homepage at 1200×630, captured
 * in headless Chrome from the production build, koi theme, with the koi
 * curving under the name rather than across it.
 */
export const PREVIEW_IMAGE = {
  url: '/preview.png',
  width: 1200,
  height: 630,
  alt: "hi, i'm aidan zheng, a third year student at northeastern. an ascii koi swims through a dark pond of characters.",
}

/**
 * A page's link preview: the shared defaults, plus its own title, words and
 * address. Next replaces a parent's `openGraph` wholesale rather than merging
 * it, so every page has to carry the shared fields itself. That is what this
 * is for, image included: a file-convention app/opengraph-image.png was
 * dropped by exactly that replacement on every page with its own preview.
 *
 * `title` is null on the homepage, which is already the name.
 */
export function pageOpenGraph(title: string | null, description: string, path: string) {
  return {
    type: 'website' as const,
    siteName: site.name,
    locale: 'en_US',
    title: title ? `${title} — ${site.name}` : site.name,
    description,
    url: path,
    images: [PREVIEW_IMAGE],
  }
}
