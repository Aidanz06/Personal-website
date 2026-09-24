import { describe, expect, it } from 'vitest'
import {
  PHOTOS_PER_ROW,
  PHOTO_PAIR_OFFSET_VH,
  PHOTO_STEP_VH,
  GALLERY_GAP_VH,
  PHOTOS_START_VH,
  galleryDepthVh,
  photoGroupMarkers,
  placePhotoStones,
  pondDepthVh,
} from './photoStones'
import { DEEPEST_STONE_VH, HOME_STONES, POND_DEPTH_VH, STONE_STEP_VH, placeStones } from './stones'

const photos = Array.from({ length: 8 }, (_, i) => ({
  src: `/_next/image?url=%2Fphotos%2Fp${i}.jpg&w=1200&q=75`,
  original: `/photos/p${i}.jpg`,
}))

describe('placePhotoStones', () => {
  it('makes one rock per photograph, in order', () => {
    const placed = placePhotoStones(photos)
    expect(placed).toHaveLength(8)
    expect(placed.map((p) => p.src)).toEqual(photos.map((p) => p.src))
  })

  it('puts every photo rock below every navigation stone', () => {
    // Nav takes you somewhere, photo rocks open a picture in place. Mixing
    // them would make both ambiguous.
    const deepestNav = Math.max(...HOME_STONES.map((s) => s.depthVh))
    for (const rock of placePhotoStones(photos)) {
      expect(rock.depthVh).toBeGreaterThan(deepestNav)
    }
  })

  it('staggers them rather than stacking a column', () => {
    // A vertical line of rocks reads as a list — the gallery page this
    // replaces.
    const placed = placePhotoStones(photos)
    for (let i = 1; i < placed.length; i++) {
      expect(Math.abs(placed[i]!.xFraction - placed[i - 1]!.xFraction)).toBeGreaterThan(0.2)
    }
  })

  it('keeps every rock well inside the pond', () => {
    for (const rock of placePhotoStones(photos)) {
      expect(rock.xFraction).toBeGreaterThan(0.12)
      expect(rock.xFraction).toBeLessThan(0.88)
    }
  })

  it('puts two rocks in every row, which is what keeps the pond short', () => {
    // One rock per depth step made thirteen photographs eleven and a half
    // screens deep. Pairing halves the rows without changing the rhythm.
    const placed = placePhotoStones(photos)
    const rows = new Set(placed.map((p) => Math.round((p.depthVh - (p.xFraction > 0.5 ? PHOTO_PAIR_OFFSET_VH : 0)) * 1000)))
    expect(rows.size).toBe(Math.ceil(photos.length / PHOTOS_PER_ROW))
  })

  it('spaces the rows evenly down the pond', () => {
    const placed = placePhotoStones(photos)
    // Compare the left-hand rock of each row.
    const lefts = placed.filter((_, i) => i % PHOTOS_PER_ROW === 0)
    for (let i = 1; i < lefts.length; i++) {
      expect(lefts[i]!.depthVh - lefts[i - 1]!.depthVh).toBeCloseTo(PHOTO_STEP_VH, 6)
    }
  })

  it('offsets the two rocks of a pair so they are not a grid', () => {
    const placed = placePhotoStones(photos)
    expect(placed[1]!.depthVh - placed[0]!.depthVh).toBeCloseTo(PHOTO_PAIR_OFFSET_VH, 6)
    expect(PHOTO_PAIR_OFFSET_VH).toBeLessThan(PHOTO_STEP_VH / 2)
  })

  it('puts the pair on opposite sides, so one photo cannot cover its partner', () => {
    const placed = placePhotoStones(photos)
    for (let i = 0; i + 1 < placed.length; i += PHOTOS_PER_ROW) {
      expect(Math.abs(placed[i + 1]!.xFraction - placed[i]!.xFraction)).toBeGreaterThan(0.35)
    }
  })

  it('handles an odd count, leaving the last rock unpaired', () => {
    const odd = placePhotoStones(photos.slice(0, 7))
    expect(odd).toHaveLength(7)
    expect(odd[6]!.xFraction).toBeLessThan(0.5)
  })

  it('makes them smaller than the navigation stones', () => {
    const smallestNav = Math.min(...HOME_STONES.map((s) => s.radiusFraction))
    for (const rock of placePhotoStones(photos)) {
      expect(rock.radiusFraction).toBeLessThan(smallestNav)
    }
  })

  it('gives each one a visible placeholder for its alt text', () => {
    for (const rock of placePhotoStones(photos)) {
      expect(rock.alt).toContain('[')
      expect(rock.alt).toContain('aidan to describe')
    }
  })

  it('names the original file in the alt text, not the optimiser url', () => {
    // "/_next/image?url=..." tells nobody which photograph needs describing.
    const [first] = placePhotoStones(photos)
    expect(first!.alt).toContain('p0.jpg')
    expect(first!.alt).not.toContain('_next')
  })

  it('handles no photographs at all', () => {
    expect(placePhotoStones([])).toEqual([])
  })
})

describe('pondDepthVh', () => {
  it('leaves the pond alone when there are no photographs', () => {
    expect(pondDepthVh(0, POND_DEPTH_VH)).toBe(POND_DEPTH_VH)
  })

  it('grows the pond to fit them, with water to spare below the last', () => {
    const depth = pondDepthVh(8, POND_DEPTH_VH)
    const deepestRock = Math.max(...placePhotoStones(
      Array.from({ length: 8 }, (_, i) => ({ src: `s${i}`, original: `/photos/p${i}.jpg` })),
    ).map((p) => p.depthVh))
    expect(depth).toBeGreaterThan(deepestRock)
  })

  it('grows by a row, not by a photograph', () => {
    // Adding a second photograph to a row costs no depth at all.
    expect(pondDepthVh(2, POND_DEPTH_VH)).toBe(pondDepthVh(1, POND_DEPTH_VH))
    expect(pondDepthVh(3, POND_DEPTH_VH)).toBeGreaterThan(pondDepthVh(2, POND_DEPTH_VH))
  })

  it('keeps thirteen photographs to well under eight screens', () => {
    // The pairing exists for this number: one rock per row made it 11.5.
    expect(pondDepthVh(13, POND_DEPTH_VH)).toBeLessThan(8)
  })

  it('never shrinks below the base depth', () => {
    expect(pondDepthVh(1, POND_DEPTH_VH)).toBeGreaterThanOrEqual(POND_DEPTH_VH)
  })

  it('grows monotonically with the number of photographs', () => {
    let previous = 0
    for (let n = 0; n <= 20; n++) {
      const depth = pondDepthVh(n, POND_DEPTH_VH)
      expect(depth).toBeGreaterThanOrEqual(previous)
      previous = depth
    }
  })
})

describe('clips', () => {
  it('carries a clip through to the rock, and leaves stills without one', () => {
    const [clip, still] = placePhotoStones([
      { src: '/p/posters/a.jpg', original: '/photos/a.mp4', video: '/photos/a.mp4' },
      { src: '/p/b.jpg', original: '/photos/b.jpg' },
    ])
    expect(clip!.video).toBe('/photos/a.mp4')
    expect(still!.video).toBeUndefined()
  })

  it('places a clip exactly like a photograph', () => {
    // A clip is a rock with a moving picture on it, not a different kind of
    // thing, so nothing about its geometry may differ.
    const withVideo = placePhotoStones([{ src: 's', original: '/photos/a.jpg', video: '/v.mp4' }])
    const without = placePhotoStones([{ src: 's', original: '/photos/a.jpg' }])
    expect({ ...withVideo[0], video: undefined }).toEqual({ ...without[0], video: undefined })
  })
})

describe('spacing', () => {
  const media = Array.from({ length: 25 }, (_, i) => ({
    src: `s${i}`,
    original: `/photos/p${i}.jpg`,
  }))

  it('never overlaps two rocks, at any viewport', () => {
    // The gallery was tightened by a third. Rocks that touch read as one
    // blob, and the spacing is now close enough that this needs guarding
    // rather than eyeballing.
    for (const [width, height] of [[375, 667], [768, 1024], [1280, 860], [1440, 900]] as const) {
      const placed = placeStones(placePhotoStones(media), width, height)
      for (let i = 0; i < placed.length; i++) {
        for (let j = i + 1; j < placed.length; j++) {
          const a = placed[i]!
          const b = placed[j]!
          const gap = Math.hypot(a.x - b.x, a.worldY - b.worldY) - (a.radius + b.radius)
          expect(gap, `${width}x${height} rocks ${i} and ${j}`).toBeGreaterThan(0)
        }
      }
    }
  })

  it('keeps twenty-five pieces of media inside eight and a half screens', () => {
    // Was eight. The bubble gap between the navigation and the gallery added
    // 0.45 of a screen, on purpose; this still catches growth nobody chose.
    expect(pondDepthVh(25, POND_DEPTH_VH)).toBeLessThan(8.5)
  })
})

describe('groups', () => {
  const grouped = [
    { src: 's0', original: '/photos/a.jpg', group: '2026' },
    { src: 's1', original: '/photos/b.jpg', group: '2025' },
    { src: 's2', original: '/photos/c.jpg', group: '2025' },
    { src: 's3', original: '/photos/d.jpg', group: '2025' },
    { src: 's4', original: '/photos/e.jpg', group: '2024' },
  ]

  it('starts every group on a new row, left side', () => {
    const placed = placePhotoStones(grouped)
    // 2026 is alone on its row; 2025 starts left on the next.
    expect(placed[1]!.xFraction).toBeLessThan(0.5)
    expect(placed[4]!.xFraction).toBeLessThan(0.5)
    expect(placed[1]!.depthVh).toBeGreaterThan(placed[0]!.depthVh + PHOTO_STEP_VH)
  })

  it('leaves extra water between groups', () => {
    const placed = placePhotoStones(grouped)
    const withinGroup = placed[3]!.depthVh - placed[1]!.depthVh
    const betweenGroups = placed[1]!.depthVh - placed[0]!.depthVh
    expect(betweenGroups).toBeGreaterThan(withinGroup)
  })

  it('marks the top of each group once, above its first rock', () => {
    const placed = placePhotoStones(grouped)
    const markers = photoGroupMarkers(placed)
    expect(markers.map((m) => m.label)).toEqual(['2026', '2025', '2024'])
    expect(markers[1]!.depthVh).toBeLessThan(placed[1]!.depthVh)
    expect(markers[1]!.depthVh).toBeGreaterThan(placed[0]!.depthVh)
  })

  it('has no markers when nothing is grouped', () => {
    expect(photoGroupMarkers(placePhotoStones(photos))).toEqual([])
  })

  it('never overlaps two rocks, with groups, at any viewport', () => {
    const media = Array.from({ length: 25 }, (_, i) => ({
      src: `s${i}`,
      original: `/photos/p${i}.jpg`,
      group: i < 1 ? '2026' : i < 18 ? '2025' : i < 20 ? '2024' : 'undated',
    }))
    for (const [width, height] of [[375, 667], [768, 1024], [1280, 860], [1440, 900]] as const) {
      const placed = placeStones(placePhotoStones(media), width, height)
      for (let i = 0; i < placed.length; i++) {
        for (let j = i + 1; j < placed.length; j++) {
          const a = placed[i]!
          const b = placed[j]!
          const gap = Math.hypot(a.x - b.x, a.worldY - b.worldY) - (a.radius + b.radius)
          expect(gap, `${width}x${height} rocks ${i} and ${j}`).toBeGreaterThan(0)
        }
      }
    }
  })

  it('fits the pond to the deepest rock, not to a count', () => {
    const placed = placePhotoStones(grouped)
    const deepest = Math.max(...placed.map((p) => p.depthVh))
    expect(galleryDepthVh(placed, POND_DEPTH_VH)).toBeGreaterThan(deepest)
    expect(galleryDepthVh([], POND_DEPTH_VH)).toBe(POND_DEPTH_VH)
  })
})

describe('depth with groups', () => {
  it('keeps the real gallery, grouped by year, inside nine screens', () => {
    // Grouping costs depth: each new year starts a row and brings a little
    // extra water. Twenty-five items in the real 1/17/2/5 split came to 7.93
    // screens ungrouped and 8.57 grouped. This guards the new ceiling so the
    // next photographs do not quietly push it past nine.
    const media = Array.from({ length: 25 }, (_, i) => ({
      src: `s${i}`,
      original: `/photos/p${i}.jpg`,
      group: i < 1 ? '2026' : i < 18 ? '2025' : i < 20 ? '2024' : 'undated',
    }))
    // Nine and a half since the bubble gap (0.45 of a screen) went in above
    // the gallery: 8.57 before it, about 9.02 with it.
    expect(galleryDepthVh(placePhotoStones(media), POND_DEPTH_VH)).toBeLessThan(9.5)
  })
})

describe('the gap above the gallery', () => {
  it('leaves room between the last stone and the gallery for the bubbles', () => {
    // Aidan asked for the gap to grow and the bubbles to rise through it.
    expect(GALLERY_GAP_VH).toBeGreaterThanOrEqual(0.4)
    expect(PHOTOS_START_VH).toBeCloseTo(DEEPEST_STONE_VH + STONE_STEP_VH + GALLERY_GAP_VH, 10)
  })
})

