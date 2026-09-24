import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { imageSize } from './imageSize'

/** A minimal but structurally real PNG header: signature + IHDR. */
function pngHeader(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(24)
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0)
  const view = new DataView(bytes.buffer)
  view.setUint32(8, 13)
  bytes.set([0x49, 0x48, 0x44, 0x52], 12) // "IHDR"
  view.setUint32(16, width)
  view.setUint32(20, height)
  return bytes
}

/** SOI, an arbitrary APP segment to skip over, then an SOF0 frame header. */
function jpegHeader(
  width: number,
  height: number,
  { sofMarker = 0xc0, appPayload = 40 } = {},
): Uint8Array {
  const bytes: number[] = [0xff, 0xd8]
  bytes.push(0xff, 0xe1, ((appPayload + 2) >> 8) & 0xff, (appPayload + 2) & 0xff)
  for (let i = 0; i < appPayload; i++) bytes.push(0x00)
  bytes.push(
    0xff, sofMarker, 0x00, 0x11, 0x08,
    (height >> 8) & 0xff, height & 0xff,
    (width >> 8) & 0xff, width & 0xff,
  )
  return new Uint8Array(bytes)
}

describe('imageSize', () => {
  it('reads a PNG from its IHDR chunk', () => {
    expect(imageSize(pngHeader(1920, 1080))).toEqual({ width: 1920, height: 1080 })
  })

  it('reads a JPEG, skipping whatever metadata sits in front of the frame', () => {
    expect(imageSize(jpegHeader(4000, 6000))).toEqual({ width: 4000, height: 6000 })
  })

  it('does not care how much metadata precedes the frame', () => {
    // A Lightroom export carries EXIF, a colour profile and a thumbnail; a
    // file straight out of an export script may carry almost nothing.
    const lean = imageSize(jpegHeader(800, 600, { appPayload: 4 }))
    const fat = imageSize(jpegHeader(800, 600, { appPayload: 9000 }))
    expect(lean).toEqual({ width: 800, height: 600 })
    expect(fat).toEqual(lean)
  })

  it('handles progressive JPEGs, which use a different frame marker', () => {
    expect(imageSize(jpegHeader(1280, 720, { sofMarker: 0xc2 })))
      .toEqual({ width: 1280, height: 720 })
  })

  it('is not fooled by a marker that only looks like a frame header', () => {
    // 0xc4 is a Huffman table, not a frame. Reading dimensions out of one
    // returns whatever the table happens to contain.
    const bytes = jpegHeader(640, 480, { sofMarker: 0xc4 })
    expect(imageSize(bytes)).toBeNull()
  })

  it('returns null rather than guessing at a format it does not know', () => {
    expect(imageSize(new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]))).toBeNull()
  })

  it('returns null on a truncated file instead of throwing', () => {
    expect(imageSize(new Uint8Array(4))).toBeNull()
    expect(imageSize(pngHeader(100, 100).slice(0, 18))).toBeNull()
    expect(imageSize(new Uint8Array([0xff, 0xd8, 0xff]))).toBeNull()
  })

  it('reads the real photographs in public/photos', () => {
    // The synthetic fixtures above prove the parser; this proves it against
    // files an actual camera and an actual Lightroom export produced.
    const path = join(process.cwd(), 'public', 'photos', 'website-01.jpg')
    const size = imageSize(readFileSync(path))
    expect(size).not.toBeNull()
    expect(size!.width).toBeGreaterThan(500)
    expect(size!.height).toBeGreaterThan(500)
  })
})
