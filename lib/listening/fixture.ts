/**
 * Pebbles to design against, for before the API key exists.
 *
 * This is a real last.fm response in shape — strings for numbers, the image
 * size array, the placeholder cover, an album under the playcount floor — so
 * it goes through exactly the same parser and filters the live data does. A
 * fixture that skips the parsing tests the layout and nothing else.
 *
 * The names are invented and meant to read that way. They vary in length on
 * purpose: the longest one is there to find out what a title that does not
 * fit does to a caption at 375px, which is the question a fixture exists to
 * answer.
 */

/** last.fm's grey "no cover" star, so the coverless path is exercised too. */
const PLACEHOLDER =
  'https://lastfm.freetls.fastly.net/i/u/300x300/2a96cbd8b46e442fc41c2b86b821562f.png'

function images(id: string) {
  return [
    { '#text': `https://lastfm.freetls.fastly.net/i/u/34s/${id}.jpg`, size: 'small' },
    { '#text': `https://lastfm.freetls.fastly.net/i/u/64s/${id}.jpg`, size: 'medium' },
    { '#text': `https://lastfm.freetls.fastly.net/i/u/174s/${id}.jpg`, size: 'large' },
    { '#text': `https://lastfm.freetls.fastly.net/i/u/300x300/${id}.jpg`, size: 'extralarge' },
  ]
}

function placeholderImages() {
  return [
    { '#text': PLACEHOLDER, size: 'small' },
    { '#text': PLACEHOLDER, size: 'medium' },
    { '#text': PLACEHOLDER, size: 'large' },
    { '#text': PLACEHOLDER, size: 'extralarge' },
  ]
}

function album(name: string, artist: string, playcount: number, cover: string | null) {
  return {
    name,
    playcount: String(playcount),
    artist: { name: artist, mbid: '', url: `https://www.last.fm/music/${artist}` },
    image: cover ? images(cover) : placeholderImages(),
  }
}

/**
 * A user.getTopAlbums payload, as last.fm would send it.
 *
 * The last entry is below MIN_PLAYCOUNT and is supposed to disappear: seeing
 * seven rocks where the fixture lists eight is the filter working.
 */
export const FIXTURE_TOP_ALBUMS = {
  topalbums: {
    album: [
      album('Placeholder in Blue', 'The Example Trio', 61, 'fixture0001'),
      album('Second Fixture', 'Sample Kestrel', 54, 'fixture0002'),
      album(
        'A Very Long Album Title That Tests Wrapping',
        'Testcard Choir',
        47,
        'fixture0003',
      ),
      album('Untitled Fixture No. 4', 'Dummy Data Band', 39, 'fixture0004'),
      album('Coverless', 'No Art Collective', 31, null),
      album('Six', 'Fixture', 24, 'fixture0006'),
      album('Loop of Nothing', 'The Stand-Ins', 18, 'fixture0007'),
      album('Below the Minimum', 'Quiet Filter', 2, 'fixture0008'),
    ],
    '@attr': {
      user: 'fixture',
      totalPages: '1',
      page: '1',
      perPage: '50',
      total: '8',
    },
  },
}

/**
 * What a fixture pebble's cover actually points at.
 *
 * The URLs in the payload above are faithful to last.fm's shape, which means
 * no file is behind them — and a rock whose cover 404s never opens, hiding
 * the exact thing the fixture exists to let Aidan look at. So in fixture mode
 * the cover is the repo's own synthetic test pattern: it is visibly a test
 * pattern and could never be mistaken for album art, which is the same reason
 * the ASCII header uses it.
 *
 * Albums the fixture marks coverless stay coverless, so the "open as the name
 * drawn in characters" path is visible too.
 */
export const FIXTURE_COVER_FILE = '/lab/00-test-pattern.png'
