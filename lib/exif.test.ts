import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { formatSettings, readExif, trustedDate } from './exif'

/**
 * Build a JPEG carrying exactly the EXIF this module reads.
 *
 * Synthetic files are the only way to test the byte-order branch — every
 * photograph in the repo came off the same body and is little-endian, so a
 * big-endian bug would sit there undetected until Aidan borrowed a camera.
 */
function jpegWithExif(
  fields: {
    date?: string
    fNumber?: [number, number]
    exposure?: [number, number]
    iso?: number
  },
  { bigEndian = false, includeExifIfd = true } = {},
): Uint8Array {
  const tiff: number[] = []
  const u16 = (n: number) => (bigEndian ? [(n >> 8) & 0xff, n & 0xff] : [n & 0xff, (n >> 8) & 0xff])
  const u32 = (n: number) =>
    bigEndian
      ? [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff]
      : [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff]

  tiff.push(...(bigEndian ? [0x4d, 0x4d] : [0x49, 0x49]), ...u16(0x002a), ...u32(8))

  // IFD0: one entry, the pointer to the Exif sub-IFD.
  const ifd0Offset = 8
  const exifIfdOffset = ifd0Offset + 2 + 12 + 4
  tiff.push(...u16(1))
  tiff.push(...u16(0x8769), ...u16(4), ...u32(1), ...u32(exifIfdOffset))
  tiff.push(...u32(0))

  // Values too big for the four inline bytes go in a heap after the IFD.
  const entries: number[][] = []
  const heap: number[] = []
  const entryCount =
    (fields.date ? 1 : 0) + (fields.fNumber ? 1 : 0) + (fields.exposure ? 1 : 0) +
    (fields.iso !== undefined ? 1 : 0)
  const heapBase = exifIfdOffset + 2 + entryCount * 12 + 4

  const pushHeap = (bytes: number[]) => {
    const at = heapBase + heap.length
    heap.push(...bytes)
    return at
  }

  if (fields.date) {
    const ascii = [...`${fields.date}\0`].map((c) => c.charCodeAt(0))
    entries.push([...u16(0x9003), ...u16(2), ...u32(ascii.length), ...u32(pushHeap(ascii))])
  }
  if (fields.exposure) {
    entries.push([...u16(0x829a), ...u16(5), ...u32(1),
      ...u32(pushHeap([...u32(fields.exposure[0]), ...u32(fields.exposure[1])]))])
  }
  if (fields.fNumber) {
    entries.push([...u16(0x829d), ...u16(5), ...u32(1),
      ...u32(pushHeap([...u32(fields.fNumber[0]), ...u32(fields.fNumber[1])]))])
  }
  if (fields.iso !== undefined) {
    // A SHORT is two bytes, so it lives inline — padded out to four.
    entries.push([...u16(0x8827), ...u16(3), ...u32(1), ...u16(fields.iso), 0, 0])
  }

  tiff.push(...u16(entries.length))
  for (const entry of entries) tiff.push(...entry)
  tiff.push(...u32(0))
  tiff.push(...heap)

  const payload = includeExifIfd
    ? [0x45, 0x78, 0x69, 0x66, 0x00, 0x00, ...tiff]
    : [0x58, 0x4d, 0x50, 0x00, 0x00, 0x00] // an APP1 that is XMP, not Exif
  const length = payload.length + 2
  return new Uint8Array([
    0xff, 0xd8,
    0xff, 0xe1, (length >> 8) & 0xff, length & 0xff,
    ...payload,
    0xff, 0xda, 0x00, 0x02,
  ])
}

describe('readExif', () => {
  it('reads all four fields from a little-endian file', () => {
    const bytes = jpegWithExif({
      date: '2025:05:22 01:27:50',
      fNumber: [8, 1],
      exposure: [1, 160],
      iso: 320,
    })
    expect(readExif(bytes)).toEqual({
      date: '2025-05-22',
      fNumber: 8,
      exposureTime: 1 / 160,
      iso: 320,
    })
  })

  it('reads a big-endian file identically', () => {
    const bytes = jpegWithExif(
      { date: '2025:05:22 01:27:50', fNumber: [28, 10], exposure: [1, 1000], iso: 800 },
      { bigEndian: true },
    )
    expect(readExif(bytes)).toEqual({
      date: '2025-05-22',
      fNumber: 2.8,
      exposureTime: 0.001,
      iso: 800,
    })
  })

  it('returns nulls, not zeros, for whatever the file left out', () => {
    // Null and 0 are different answers: f/0 would render as a caption.
    expect(readExif(jpegWithExif({ iso: 100 }))).toEqual({
      date: null,
      fNumber: null,
      exposureTime: null,
      iso: 100,
    })
  })

  it('ignores an APP1 segment that is not Exif', () => {
    const bytes = jpegWithExif({ iso: 100 }, { includeExifIfd: false })
    expect(readExif(bytes).iso).toBeNull()
  })

  it('returns nulls rather than throwing on junk', () => {
    const nothing = { date: null, fNumber: null, exposureTime: null, iso: null }
    expect(readExif(new Uint8Array(0))).toEqual(nothing)
    expect(readExif(new Uint8Array([0xff, 0xd8]))).toEqual(nothing)
    expect(readExif(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]))).toEqual(nothing)
    expect(readExif(jpegWithExif({ date: '2025:05:22 01:27:50' }).slice(0, 20)))
      .toEqual(nothing)
  })

  it('reads every photograph actually in the repo without producing nonsense', () => {
    // The synthetic fixtures prove the parser; these prove it against what
    // the real pipeline produces. Note what is NOT asserted: that every file
    // has exposure data. Two of them are Lightroom exports with no camera
    // EXIF at all, and an earlier version of this test demanded an aperture
    // from them and failed.
    const dir = join(process.cwd(), 'public', 'photos')
    const files = readdirSync(dir).filter((file) => file.endsWith('.jpg'))
    expect(files.length).toBeGreaterThan(0)

    let withExposure = 0
    for (const file of files) {
      const fields = readExif(readFileSync(join(dir, file)))
      if (fields.date !== null) expect(fields.date, file).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      for (const value of [fields.fNumber, fields.exposureTime, fields.iso]) {
        if (value !== null) expect(value, file).toBeGreaterThan(0)
      }
      if (formatSettings(fields) !== '') withExposure++
    }
    // Most of them are real camera files; if that ever stops being true the
    // parser has broken rather than the folder having changed.
    expect(withExposure).toBeGreaterThan(files.length / 2)
  })
})

describe('formatSettings', () => {
  const base = { date: null, fNumber: null, exposureTime: null, iso: null }

  it('reads the way a photographer writes it', () => {
    expect(formatSettings({ ...base, fNumber: 8, exposureTime: 1 / 160, iso: 320 }))
      .toBe('f/8 · 1/160 · iso 320')
  })

  it('keeps the decimal on a fractional aperture and drops a pointless one', () => {
    expect(formatSettings({ ...base, fNumber: 2.8 })).toBe('f/2.8')
    expect(formatSettings({ ...base, fNumber: 16 })).toBe('f/16')
  })

  it('writes a long exposure in seconds, not as a fraction', () => {
    expect(formatSettings({ ...base, exposureTime: 2 })).toBe('2s')
    expect(formatSettings({ ...base, exposureTime: 1 / 60 })).toBe('1/60')
  })

  it('omits what is missing instead of printing a gap', () => {
    expect(formatSettings({ ...base, fNumber: 4, iso: 100 })).toBe('f/4 · iso 100')
    expect(formatSettings(base)).toBe('')
  })
})

describe('trustedDate', () => {
  const base = { date: '2026-09-23', fNumber: null, exposureTime: null, iso: null }

  it('returns the date when the file has exposure data behind it', () => {
    expect(trustedDate({ ...base, fNumber: 8, exposureTime: 1 / 160, iso: 320 }))
      .toBe('2026-09-23')
  })

  it('accepts any one of the three as evidence of a camera', () => {
    expect(trustedDate({ ...base, iso: 100 })).toBe('2026-09-23')
    expect(trustedDate({ ...base, fNumber: 2.8 })).toBe('2026-09-23')
    expect(trustedDate({ ...base, exposureTime: 0.01 })).toBe('2026-09-23')
  })

  it('refuses a date from a file with no camera EXIF at all', () => {
    // These are Lightroom exports whose DateTimeOriginal is the export date.
    // Believing it invents a shoot date, and with it a phantom place to name.
    expect(trustedDate(base)).toBeNull()
  })

  it('refuses rather than passing through a null date', () => {
    expect(trustedDate({ ...base, date: null, iso: 100 })).toBeNull()
  })

  it('matches the two real files this rule exists for', () => {
    const dir = join(process.cwd(), 'public', 'photos')
    for (const file of ['website-14.jpg', 'website-19.jpg']) {
      const fields = readExif(readFileSync(join(dir, file)))
      expect(fields.date, file).not.toBeNull()
      expect(trustedDate(fields), file).toBeNull()
    }
  })
})
