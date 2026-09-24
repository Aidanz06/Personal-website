import type { MetadataRoute } from 'next'
import { sitemapEntries } from '@/lib/siteMeta'

export default function sitemap(): MetadataRoute.Sitemap {
  return sitemapEntries()
}
