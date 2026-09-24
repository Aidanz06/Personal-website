import type { Metadata } from 'next'
import { PondHome } from '@/components/PondHome'
import { listPhotos } from '@/lib/photos'
import { site } from '@/lib/site'
import { pageOpenGraph } from '@/lib/siteMeta'

export const metadata: Metadata = {
  // `absolute` opts out of the "%s — aidan zheng" template from the root
  // layout, which would otherwise render "aidan zheng — aidan zheng".
  title: { absolute: site.name },
  description: site.description,
  alternates: { canonical: '/' },
  openGraph: pageOpenGraph(null, site.description, '/'),
}

export default function Home() {
  // Read at build time, so the page stays static.
  return <PondHome photos={listPhotos()} />
}
