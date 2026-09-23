/**
 * Generates a high-contrast test image for /lab, so the renderer can be
 * judged before real photographs are dropped in.
 *
 * Writes a PNG by hand using only node:zlib — the project has no image
 * dependency and the ASCII renderer is not allowed one.
 *
 * Run: node scripts/generate-test-image.mjs
 */
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'

const WIDTH = 1200
const HEIGHT = 900
const OUT = 'public/lab/00-test-pattern.png'

// --- PNG encoding ----------------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c
  }
  return table
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const typeAndData = Buffer.concat([Buffer.from(type, 'latin1'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(typeAndData))
  return Buffer.concat([len, typeAndData, crc])
}

function encodePng(width, height, rgb) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // colour type: truecolour RGB
  // 10-12: compression, filter, interlace — all 0

  // Each scanline is prefixed with a filter byte; 0 means "no filter".
  const stride = width * 3
  const raw = Buffer.alloc((stride + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0
    rgb.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// --- the picture -----------------------------------------------------------
//
// A lit sphere above a receding checkerboard, with a black-to-white step
// wedge down one side. The point is to exercise the whole tonal range at
// once: smooth gradients on the sphere, hard edges on the checks, and known
// flat values on the wedge, so it is obvious whether the density ramp is
// mapping light and dark the right way round.

const HORIZON = 0.62
const SPHERE_X = 0.40
const SPHERE_Y = 0.44
const SPHERE_R = 0.30 // fraction of height
const LIGHT = normalise([-0.55, -0.7, 0.45])

function normalise([x, y, z]) {
  const len = Math.hypot(x, y, z)
  return [x / len, y / len, z / len]
}

const pixels = Buffer.alloc(WIDTH * HEIGHT * 3)

for (let py = 0; py < HEIGHT; py++) {
  for (let px = 0; px < WIDTH; px++) {
    const u = px / WIDTH
    const v = py / HEIGHT
    let value

    // Step wedge down the right-hand tenth.
    if (u > 0.9) {
      const step = Math.floor(v * 10)
      value = step / 9
    } else if (v > HORIZON) {
      // Perspective checkerboard: rows compress towards the horizon.
      const depth = (v - HORIZON) / (1 - HORIZON)
      const rowScale = 1 / (depth * depth * 6 + 0.5)
      const checkX = Math.floor(u * 8 * (0.45 + depth * 1.1))
      const checkY = Math.floor(v * rowScale * 5)
      value = (checkX + checkY) % 2 === 0 ? 0.14 : 0.62
      // Haze towards the horizon line.
      value = value * (0.45 + depth * 0.55) + (1 - depth) * 0.22
    } else {
      // Sky: a smooth vertical gradient, bright at the top.
      value = 0.93 - (v / HORIZON) * 0.38
    }

    // The sphere sits on top of whatever is behind it.
    const dx = (u - SPHERE_X) * (WIDTH / HEIGHT)
    const dy = v - SPHERE_Y
    const r2 = (dx * dx + dy * dy) / (SPHERE_R * SPHERE_R)
    if (r2 <= 1 && u <= 0.9) {
      const nz = Math.sqrt(Math.max(0, 1 - r2))
      const n = normalise([dx / SPHERE_R, dy / SPHERE_R, nz])
      const lambert = Math.max(0, n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2])
      const specular = Math.pow(lambert, 42) * 0.9
      value = 0.04 + lambert * 0.78 + specular
      // Darken the very edge so the silhouette stays readable.
      value *= 0.35 + 0.65 * Math.sqrt(Math.max(0, 1 - r2 * r2 * r2))
    }

    const c = Math.max(0, Math.min(255, Math.round(value * 255)))
    const i = (py * WIDTH + px) * 3
    pixels[i] = c
    pixels[i + 1] = c
    pixels[i + 2] = c
  }
}

mkdirSync('public/lab', { recursive: true })
writeFileSync(OUT, encodePng(WIDTH, HEIGHT, pixels))
console.log(`wrote ${OUT} (${WIDTH}x${HEIGHT})`)
