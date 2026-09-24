/**
 * Intrinsic pixel dimensions of an image file, read from its header.
 *
 * `next/image` needs a width and a height to reserve the right box before the
 * file arrives — without them the page jumps when each slide loads, which is
 * exactly the layout shift the whole site's budget is written against.
 *
 * The obvious way to get them is an image library. This reads the two numbers
 * out of the file header instead, which is a few dozen lines for PNG and JPEG
 * and adds nothing to install. It runs at build time only.
 */

export type ImageSize = { width: number; height: number }

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

/**
 * Start-of-frame markers. Every one of these carries the frame dimensions;
 * the gaps in the sequence (0xc4, 0xc8, 0xcc) are other things entirely —
 * Huffman tables and arithmetic coding conditioning — and reading dimensions
 * out of those gives nonsense.
 */
const SOF_MARKERS = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
])

function isPng(bytes: Uint8Array): boolean {
  return PNG_SIGNATURE.every((byte, i) => bytes[i] === byte)
}

function readUint32BE(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset]! << 24) |
      (bytes[offset + 1]! << 16) |
      (bytes[offset + 2]! << 8) |
      bytes[offset + 3]!) >>>
    0
  )
}

function readUint16BE(bytes: Uint8Array, offset: number): number {
  return (bytes[offset]! << 8) | bytes[offset + 1]!
}

/** PNG: the IHDR chunk is always first, and always at the same offsets. */
function pngSize(bytes: Uint8Array): ImageSize | null {
  if (bytes.length < 24) return null
  const width = readUint32BE(bytes, 16)
  const height = readUint32BE(bytes, 20)
  return width > 0 && height > 0 ? { width, height } : null
}

/**
 * JPEG: walk the segment chain until a start-of-frame marker.
 *
 * Unlike PNG there is no fixed offset — a file from a camera or an export
 * carries EXIF, colour profiles and thumbnails ahead of the image data, and
 * how much of that there is varies by file. So each segment's own length
 * field says where the next one begins.
 */
function jpegSize(bytes: Uint8Array): ImageSize | null {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null

  let offset = 2
  while (offset + 3 < bytes.length) {
    // Segments are padded with 0xff bytes; skip to the marker itself.
    if (bytes[offset] !== 0xff) {
      offset++
      continue
    }
    const marker = bytes[offset + 1]!
    if (marker === 0xff) {
      offset++
      continue
    }
    // Standalone markers: no length field, nothing to skip over.
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd9)) {
      offset += 2
      continue
    }

    const length = readUint16BE(bytes, offset + 2)
    if (length < 2) return null

    if (SOF_MARKERS.has(marker)) {
      // ff xx | length(2) | precision(1) | height(2) | width(2)
      const height = readUint16BE(bytes, offset + 5)
      const width = readUint16BE(bytes, offset + 7)
      return width > 0 && height > 0 ? { width, height } : null
    }

    offset += 2 + length
  }
  return null
}

/**
 * Read an image's dimensions, or null if the format is not one we handle.
 *
 * Null is a real answer, not a failure: a caller that cannot size an image
 * should say so rather than guess an aspect ratio, because a guessed ratio is
 * a layout shift with extra steps.
 */
export function imageSize(bytes: Uint8Array): ImageSize | null {
  if (bytes.length < 16) return null
  if (isPng(bytes)) return pngSize(bytes)
  return jpegSize(bytes)
}
