import type { Metadata } from 'next'
import { ListeningPond } from '@/components/ListeningPond'
import { getListeningData } from '@/lib/listening/data'

/**
 * /listening — the pond of album rocks.
 *
 * **Static, and revalidated every six hours.** 21600 seconds, written as a
 * literal because Next has to be able to read the value without running the
 * module — `60 * 60 * 6` is not statically analyzable and would be ignored.
 *
 * So last.fm is asked at most four times a day, by the server, on a schedule
 * of its own. A visitor never waits for it and never triggers it: the page
 * they get was rendered before they arrived. If a revalidation fails, Next
 * keeps serving the last page that rendered successfully, which is the outer
 * half of the fallback chain in lib/listening/lastfm.ts.
 *
 * This route sits outside the `(page)` group on purpose. That group's layout
 * renders its own <PondBackdrop>, and this page needs a pond with rocks in
 * it — two ponds would be two canvases and twice the work. The chrome the
 * group provides, a back link and the theme control, is a dozen lines and is
 * rendered by ListeningPond instead.
 */
export const revalidate = 21600

export const metadata: Metadata = {
  title: 'listening',
  description: 'what aidan zheng has on repeat, and the records that never leave.',
}

export default async function ListeningPage() {
  return <ListeningPond data={await getListeningData()} />
}
