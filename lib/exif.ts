/**
 * The four EXIF fields the captions need: when a photograph was taken, and
 * what the camera was set to.
 *
 * Written by hand rather than installed. It reads one JPEG structure — the
 * APP1 segment, its TIFF header, IFD0 and the Exif sub-IFD — and four tags
 * out of it. That is a much smaller surface than a general EXIF library, and
 * it runs at the command line only: nothing here ships to a browser.
 *
 * Deliberately NOT read: camera body and lens. They are in the file and the
 * captions will never show them, because the photographs are the point and
 * the gear is not.
 */

const TAG = {
  exifIfdPointer: 0x8769,
  exposureTime: 0x829a,
  fNumber: 0x829d,
  isoSpeedRatings: 0x8827,
  /** Newer bodies write ISO here instead; the older tag caps out at 65535. */
  photographicSensitivity: 0x8833,
  dateTimeOriginal: 0x9003,
} as const

/** Bytes per component, indexed by EXIF type code. */
const TYPE_SIZE: Record<number, number> = {
  1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8,
}

export type ExifFields = {
  /** "YYYY-MM-DD" in whatever timezone the camera clock was set to. */
  date: string | null
  fNumber: number | null
  /** Shutter speed in seconds. */
  exposureTime: number | null
  iso: number | null
}

/**
 * A view over the bytes that knows the file's byte order.
 *
 * A factory rather than a class with parameter properties: this module is
 * imported directly by `npm run photos:sync`, which Node runs in strip-only
 * mode, and strip-only mode cannot desugar `constructor(private x: T)`.
 */
function createReader(bytes: Uint8Array, littleEndian: boolean, tiffStart: number) {
  const uint16 = (offset: number): number => {
    const a = bytes[offset]
    const b = bytes[offset + 1]
    if (a === undefined || b === undefined) return 0
    return littleEndian ? a | (b << 8) : (a << 8) | b
  }

  const uint32 = (offset: number): number => {
    const a = bytes[offset]
    const b = bytes[offset + 1]
    const c = bytes[offset + 2]
    const d = bytes[offset + 3]
    if (a === undefined || b === undefined || c === undefined || d === undefined) return 0
    return littleEndian
      ? (a | (b << 8) | (c << 16) | (d << 24)) >>> 0
      : (((a << 24) >>> 0) | (b << 16) | (c << 8) | d) >>> 0
  }

  const ascii = (offset: number, length: number): string => {
    let out = ''
    for (let i = 0; i < length; i++) {
      const byte = bytes[offset + i]
      if (byte === undefined || byte === 0) break
      out += String.fromCharCode(byte)
    }
    return out
  }

  const inBounds = (offset: number, length: number): boolean =>
    offset >= 0 && offset + length <= bytes.length

  return { uint16, uint32, ascii, inBounds, tiffStart }
}

type Reader = ReturnType<typeof createReader>

type Entry = { tag: number; type: number; count: number; valueOffset: number }

function readIfd(reader: Reader, ifdOffset: number): Entry[] {
  const base = reader.tiffStart + ifdOffset
  if (!reader.inBounds(base, 2)) return []
  const count = reader.uint16(base)
  const entries: Entry[] = []
  for (let i = 0; i < count; i++) {
    const at = base + 2 + i * 12
    if (!reader.inBounds(at, 12)) break
    const type = reader.uint16(at + 2)
    const componentCount = reader.uint32(at + 4)
    const size = (TYPE_SIZE[type] ?? 0) * componentCount
    // Anything four bytes or smaller is stored inline in the entry itself;
    // anything larger is an offset to where the value really lives.
    const valueOffset = size <= 4 ? at + 8 : reader.tiffStart + reader.uint32(at + 8)
    entries.push({ tag: reader.uint16(at), type, count: componentCount, valueOffset })
  }
  return entries
}

function readRational(reader: Reader, entry: Entry): number | null {
  if (entry.type !== 5 && entry.type !== 10) return null
  if (!reader.inBounds(entry.valueOffset, 8)) return null
  const numerator = reader.uint32(entry.valueOffset)
  const denominator = reader.uint32(entry.valueOffset + 4)
  if (denominator === 0) return null
  return numerator / denominator
}

function readInteger(reader: Reader, entry: Entry): number | null {
  if (entry.type === 3) return reader.uint16(entry.valueOffset)
  if (entry.type === 4) return reader.uint32(entry.valueOffset)
  return null
}

/** Find the APP1 segment holding "Exif\0\0" and return where its TIFF header starts. */
function findTiffStart(bytes: Uint8Array): number | null {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null
  let offset = 2
  while (offset + 4 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset++
      continue
    }
    const marker = bytes[offset + 1]!
    if (marker === 0xff) {
      offset++
      continue
    }
    // Start of scan: the image data begins and there is no metadata past it.
    if (marker === 0xda || marker === 0xd9) return null
    const length = (bytes[offset + 2]! << 8) | bytes[offset + 3]!
    if (length < 2) return null

    if (marker === 0xe1) {
      const header = offset + 4
      const isExif =
        bytes[header] === 0x45 && bytes[header + 1] === 0x78 &&
        bytes[header + 2] === 0x69 && bytes[header + 3] === 0x66 &&
        bytes[header + 4] === 0x00
      // An APP1 that is not Exif is XMP, which this does not read.
      if (isExif) return header + 6
    }
    offset += 2 + length
  }
  return null
}

/** "2025:05:22 01:27:50" as EXIF writes it, "2025-05-22" as JSON wants it. */
function toIsoDate(exifDateTime: string): string | null {
  const match = /^(\d{4}):(\d{2}):(\d{2})/.exec(exifDateTime)
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null
}

export function readExif(bytes: Uint8Array): ExifFields {
  const empty: ExifFields = { date: null, fNumber: null, exposureTime: null, iso: null }

  const tiffStart = findTiffStart(bytes)
  if (tiffStart === null || tiffStart + 8 > bytes.length) return empty

  const byteOrder = (bytes[tiffStart]! << 8) | bytes[tiffStart + 1]!
  if (byteOrder !== 0x4949 && byteOrder !== 0x4d4d) return empty
  const reader = createReader(bytes, byteOrder === 0x4949, tiffStart)
  if (reader.uint16(tiffStart + 2) !== 0x002a) return empty

  const ifd0 = readIfd(reader, reader.uint32(tiffStart + 4))
  const pointer = ifd0.find((entry) => entry.tag === TAG.exifIfdPointer)
  // Every field wanted here lives in the Exif sub-IFD, not in IFD0.
  if (!pointer) return empty
  const exifIfd = readIfd(reader, reader.uint32(pointer.valueOffset))

  const find = (tag: number) => exifIfd.find((entry) => entry.tag === tag)

  const dateEntry = find(TAG.dateTimeOriginal)
  const isoEntry = find(TAG.photographicSensitivity) ?? find(TAG.isoSpeedRatings)
  const fEntry = find(TAG.fNumber)
  const exposureEntry = find(TAG.exposureTime)

  return {
    date:
      dateEntry && dateEntry.type === 2 && reader.inBounds(dateEntry.valueOffset, 10)
        ? toIsoDate(reader.ascii(dateEntry.valueOffset, Math.min(20, dateEntry.count)))
        : null,
    fNumber: fEntry ? readRational(reader, fEntry) : null,
    exposureTime: exposureEntry ? readRational(reader, exposureEntry) : null,
    iso: isoEntry ? readInteger(reader, isoEntry) : null,
  }
}

/** "f/8 · 1/160 · iso 320", skipping whatever the file did not record. */
export function formatSettings(fields: ExifFields): string {
  const parts: string[] = []

  if (fields.fNumber && fields.fNumber > 0) {
    // f/2.8 keeps its decimal, f/8 does not grow a pointless ".0".
    const rounded = Math.round(fields.fNumber * 10) / 10
    parts.push(`f/${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}`)
  }

  if (fields.exposureTime && fields.exposureTime > 0) {
    parts.push(
      fields.exposureTime >= 1
        ? `${Math.round(fields.exposureTime * 10) / 10}s`
        : `1/${Math.round(1 / fields.exposureTime)}`,
    )
  }

  if (fields.iso && fields.iso > 0) parts.push(`iso ${Math.round(fields.iso)}`)

  return parts.join(' · ')
}

/**
 * The date, but only when the file gives a reason to believe it.
 *
 * A date with no exposure data behind it did not come from a camera. Two of
 * the photographs in this folder are Lightroom exports carrying no make, no
 * model and no exposure block — and a `DateTimeOriginal` of the day they were
 * exported. Trusting that produces a shoot date that is really an export
 * date, and since places are keyed by shoot date it also invents a whole
 * phantom day to name.
 *
 * So: no aperture, no shutter and no ISO means the date is unknown, and
 * unknown lands on the sync checklist for Aidan to type in. The cost of being
 * wrong here is one date to fill in by hand. The cost of being wrong the
 * other way is a caption that states something false.
 */
export function trustedDate(fields: ExifFields): string | null {
  const hasExposure =
    (fields.fNumber ?? 0) > 0 || (fields.exposureTime ?? 0) > 0 || (fields.iso ?? 0) > 0
  return hasExposure ? fields.date : null
}
