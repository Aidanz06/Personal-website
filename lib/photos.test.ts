import { describe, expect, it } from 'vitest'
import { listPhotos } from './photos'

/**
 * These run against the real public/photos, so they assert properties that
 * hold for any contents rather than a fixed list of filenames — otherwise
 * every photograph Aidan adds breaks the suite.
 */
const media = listPhotos()

describe('listPhotos', () => {
  it('finds something', () => {
    expect(media.length).toBeGreaterThan(0)
  })

  it('classifies by extension, and nothing else', () => {
    for (const item of media) {
      const expected = /\.(mp4|webm|mov)$/i.test(item.file) ? 'video' : 'image'
      expect(item.kind, item.file).toBe(expected)
    }
  })

  it('gives every clip a file to loop, and no still one', () => {
    for (const item of media) {
      if (item.kind === 'video') expect(item.video, item.file).toBe(`/photos/${item.file}`)
      else expect(item.video, item.file).toBeUndefined()
    }
  })

  it('points a clip at its poster frame, not at the clip, for the still', () => {
    // The ASCII stage is built from a still, and next/image cannot resize an
    // mp4. A clip whose `src` were the mp4 would render as a broken tile.
    for (const item of media.filter((m) => m.kind === 'video')) {
      expect(decodeURIComponent(item.src)).toContain('/photos/posters/')
      expect(item.src).not.toContain('.mp4')
    }
  })

  it('routes every still through the optimiser', () => {
    for (const item of media) {
      expect(item.src, item.file).toContain('/_next/image')
    }
  })

  it('never lists a poster as a photograph in its own right', () => {
    // posters/ is a subfolder, and the scan is one level deep. If that ever
    // changed, every clip would appear twice.
    expect(media.some((m) => m.file.includes('poster'))).toBe(false)
  })

  it('gives everything a caption object, even with nothing written yet', () => {
    for (const item of media) {
      expect(item.caption.alt, item.file).not.toBe('')
      expect(typeof item.caption.headline).toBe('string')
    }
  })

  it('is in filename order, which is the order down the pond', () => {
    expect(media.map((m) => m.file)).toEqual([...media.map((m) => m.file)].sort())
  })
})
