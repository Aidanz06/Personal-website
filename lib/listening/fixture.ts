/**
 * Pebbles to design against, for before the API key exists.
 *
 * This is a real user.getTopTracks response in shape — strings for numbers,
 * the image size array, and last.fm's grey placeholder on every track image,
 * because that is genuinely what it sends for tracks. It goes through exactly
 * the same parser and filters the live data does. A fixture that skips the
 * parsing tests the layout and nothing else.
 *
 * The names are invented and meant to read that way. They vary in length on
 * purpose: the longest one is there to find out what a title that does not
 * fit does to a caption at 375px, which is the question a fixture exists to
 * answer.
 */

/** last.fm's grey "no cover" star — what it returns for every track image. */
const PLACEHOLDER =
  'https://lastfm-img.freetls.fastly.net/i/u/300x300/2a96cbd8b46e442fc41c2b86b821562f.png'

function track(name: string, artist: string, playcount: number) {
  return {
    name,
    playcount: String(playcount),
    artist: { name: artist, mbid: '', url: `https://www.last.fm/music/${artist}` },
    image: ['small', 'medium', 'large', 'extralarge'].map((size) => ({
      '#text': PLACEHOLDER,
      size,
    })),
  }
}

/**
 * A user.getTopTracks payload, as last.fm would send it.
 *
 * Seven tracks: five shown, one below MIN_PLAYCOUNT that is supposed to
 * vanish, and one past the top five. Seeing five rocks where the fixture
 * lists seven is the filter and the limit working.
 */
export const FIXTURE_TOP_TRACKS = {
  toptracks: {
    track: [
      track('Placeholder in Blue', 'The Example Trio', 14),
      track('Second Fixture', 'Sample Kestrel', 11),
      track('A Very Long Track Title That Tests Wrapping', 'Testcard Choir', 9),
      track('Coverless', 'No Art Collective', 6),
      track('Untitled Fixture No. 5', 'Dummy Data Band', 4),
      track('Sixth, and Past the Limit', 'The Stand-Ins', 3),
      track('Below the Minimum', 'Quiet Filter', 1),
    ],
    '@attr': { user: 'fixture', totalPages: '1', page: '1', perPage: '50', total: '7' },
  },
}

/**
 * Which fixture tracks "have" album art, as [artist, title].
 *
 * With no key there is no track.getInfo to ask, so the fixture says. The rest
 * stay coverless, so the "open as its own title" path is visible too.
 */
export const FIXTURE_TRACKS_WITH_ART: ReadonlyArray<readonly [string, string]> = [
  ['The Example Trio', 'Placeholder in Blue'],
  ['Sample Kestrel', 'Second Fixture'],
  ['Testcard Choir', 'A Very Long Track Title That Tests Wrapping'],
  ['Dummy Data Band', 'Untitled Fixture No. 5'],
]

/**
 * What a fixture track's cover actually points at.
 *
 * The repo's own synthetic test pattern: visibly a test pattern, and never
 * mistakable for album art, which is the same reason the ASCII header uses
 * it. A made-up last.fm URL would 404, and a cover that 404s never opens —
 * hiding the exact thing the fixture exists to let Aidan look at.
 */
export const FIXTURE_COVER_FILE = '/lab/00-test-pattern.png'
