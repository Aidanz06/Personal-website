import { feedStore, readFeedCount, recordFeeding, visitorId } from '@/lib/feedCount'

/**
 * Today's shared count of fish feedings.
 *
 * GET reads it; POST counts one feeding (rate-limited per visitor) and
 * returns the new total. Both answer `{ count }`, or 503 when there is no
 * store configured or it isn't answering, and the page drops the number.
 */

function answer(count: number | null, cacheSeconds: number): Response {
  if (count === null) return Response.json({ count: null }, { status: 503 })
  return Response.json(
    { count },
    {
      headers: {
        'Cache-Control':
          cacheSeconds > 0
            ? `public, s-maxage=${cacheSeconds}, stale-while-revalidate=60`
            : 'no-store',
      },
    },
  )
}

export async function GET() {
  return answer(await readFeedCount(feedStore(process.env), fetch, new Date()), 20)
}

export async function POST(request: Request) {
  const visitor = await visitorId(request.headers)
  return answer(await recordFeeding(feedStore(process.env), fetch, visitor, new Date()), 0)
}
