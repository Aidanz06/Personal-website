import type { MetadataRoute } from 'next'
import { robotsRules } from '@/lib/siteMeta'

export default function robots(): MetadataRoute.Robots {
  return robotsRules()
}
