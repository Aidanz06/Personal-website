/**
 * Reading colours back out of CSS.
 *
 * The canvas has to paint in the current theme's colours, and the only place
 * those exist is the stylesheet. So the renderer reads the resolved token
 * values at runtime rather than hardcoding anything — which is also what
 * makes a theme switch propagate into the canvas.
 */

/**
 * Parse a CSS colour into 0-255 channels.
 *
 * Handles the forms getComputedStyle actually returns for these tokens:
 * `#abc`, `#aabbcc`, `rgb(r g b)`, `rgb(r, g, b)` and their rgba variants.
 * Anything else returns null so the caller can fall back rather than paint
 * with NaN.
 */
export function parseCssColor(value: string): [number, number, number] | null {
  const input = value.trim().toLowerCase()
  if (input === '') return null

  if (input.startsWith('#')) {
    const hex = input.slice(1)
    if (hex.length === 3 || hex.length === 4) {
      const r = hex[0]
      const g = hex[1]
      const b = hex[2]
      if (!r || !g || !b) return null
      const parsed = [r + r, g + g, b + b].map((pair) => Number.parseInt(pair, 16))
      return parsed.some(Number.isNaN) ? null : [parsed[0]!, parsed[1]!, parsed[2]!]
    }
    if (hex.length === 6 || hex.length === 8) {
      const parsed = [hex.slice(0, 2), hex.slice(2, 4), hex.slice(4, 6)].map((pair) =>
        Number.parseInt(pair, 16),
      )
      return parsed.some(Number.isNaN) ? null : [parsed[0]!, parsed[1]!, parsed[2]!]
    }
    return null
  }

  // color(srgb r g b) — what Chrome computes any color-mix() result to, and
  // therefore what --color-muted and any mixed theme token resolve to. The
  // channels are 0-1 floats rather than 0-255.
  const colorFn = input.match(/^color\(\s*([a-z-]+)\s+([^)]+)\)$/)
  if (colorFn) {
    // Only sRGB can be read as-is. Converting display-p3 or lab by pretending
    // the channels are sRGB would shift every colour, so refuse instead.
    if (colorFn[1] !== 'srgb') return null
    const channels = (colorFn[2] ?? '')
      .replace(/\//g, ' ')
      .split(/[\s,]+/)
      .filter(Boolean)
      .slice(0, 3)
      .map((part) =>
        part.endsWith('%') ? Number.parseFloat(part) / 100 : Number.parseFloat(part),
      )
    if (channels.length < 3 || channels.some((n) => !Number.isFinite(n))) return null
    return [
      Math.round(clampChannel(channels[0]!) * 255),
      Math.round(clampChannel(channels[1]!) * 255),
      Math.round(clampChannel(channels[2]!) * 255),
    ]
  }

  const match = input.match(/^rgba?\(([^)]+)\)$/)
  if (!match?.[1]) return null

  // Both the legacy comma syntax and the modern space syntax, which may carry
  // a `/ alpha` suffix that is irrelevant here.
  const parts = match[1]
    .replace(/\//g, ' ')
    .split(/[\s,]+/)
    .filter(Boolean)
    .slice(0, 3)
    .map((part) => (part.endsWith('%') ? (Number.parseFloat(part) / 100) * 255 : Number.parseFloat(part)))

  if (parts.length < 3 || parts.some((n) => !Number.isFinite(n))) return null
  return [parts[0]!, parts[1]!, parts[2]!]
}

function clampChannel(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n
}
