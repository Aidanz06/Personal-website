import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { FIXTURE_TOP_TRACKS } from './fixture.ts'

/**
 * The optimiser only fetches from hosts listed in next.config.ts, and
 * anything else is a 400 — which the pond reads as a cover that failed to
 * load, so the rock simply never opens. No error anywhere; just a pond of
 * rocks that do nothing.
 *
 * The first version allowed `lastfm.freetls.fastly.net`, written from memory,
 * and the fixture was written with the same host — so the fixture and the
 * config agreed with each other and both were wrong. Real covers come from
 * `lastfm-img.freetls.fastly.net`, measured across three months of a real
 * account. This pins the real host rather than whatever the fixture says.
 */

const config = readFileSync(join(process.cwd(), 'next.config.ts'), 'utf8')
const allowed = [...config.matchAll(/hostname:\s*'([^']+)'/g)].map((m) => m[1]!)

/** The host last.fm actually serves cover art from. */
const REAL_COVER_HOST = 'lastfm-img.freetls.fastly.net'

describe('images.remotePatterns', () => {
  it('allows the host last.fm really serves covers from', () => {
    expect(allowed).toContain(REAL_COVER_HOST)
  })

  it('covers every host the fixture uses, so the fixture is faithful', () => {
    const hosts = new Set(
      FIXTURE_TOP_TRACKS.toptracks.track.flatMap((track) =>
        track.image.map((image) => new URL(image['#text']).hostname),
      ),
    )
    for (const host of hosts) expect(allowed, host).toContain(host)
    expect(hosts).toContain(REAL_COVER_HOST)
  })
})
