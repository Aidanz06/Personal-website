import { parseCssColor } from '../ascii/color'
import { luminance } from '../ascii/luminance'
import { orientRamp } from '../ascii/ramp'

/**
 * Turning the current theme's CSS tokens into the colours the pond paints in.
 *
 * Pulled out of the component so it can be tested: "the canvas repaints in
 * the new theme" is a claim about this function returning different answers
 * for different tokens, plus a MutationObserver that calls it again. The
 * observer is three lines; this is where a theme switch can actually go
 * wrong, by caching something it should have re-read.
 *
 * Nothing here is memoised, deliberately. Every value is derived from the
 * tokens passed in on the call.
 */

export type PondPalette = {
  /** The ground the canvas clears to. */
  ground: string
  /** Bright end of the photograph duotone: the koi's palest tone. */
  photoHighlight: string
  /**
   * The page's own text colour, for a picture that stays as characters.
   *
   * Kept out of `colors` so the atlas indices every other material relies on
   * never move; the pond appends it to the atlas itself.
   */
  ink: string
  /** Dark end of the duotone: the water. */
  photoShadow: string
  /** The ramp, pointed the right way for this theme's ground. */
  ramp: string
  /** Index 0 water, index 1 stone, then the koi gradient. */
  colors: string[]
}

/** Used only when a token is missing or unparseable. */
const FALLBACK = {
  ground: '#0b100f',
  ink: '#ece7dd',
  water: '#243230',
  stone: '#7f7f7e',
  koi: [
    [210, 69, 30],
    [240, 129, 58],
    [247, 239, 226],
  ] as [number, number, number][],
}

export function pondPalette(
  read: (token: string) => string,
  baseRamp: string,
  koiShades: number,
): PondPalette {
  const readColor = (token: string, fallback: string) => {
    const rgb = parseCssColor(read(token))
    return rgb ? { css: `rgb(${rgb.join(',')})`, rgb } : { css: fallback, rgb: null }
  }

  const ground = readColor('--color-ground', FALLBACK.ground)
  const ink = readColor('--color-ink', FALLBACK.ink)
  const water = readColor('--color-water', FALLBACK.water)
  // Stones are drawn in the muted tone, not full ink. They sit directly
  // behind their own labels, and at full strength they compete with the text
  // for the same pale colour — which makes the navigation, the one thing on
  // this page that has to be readable, hard to read.
  const stone = readColor('--color-muted', FALLBACK.stone)
  const koi = [
    readColor('--color-koi-1', '#d2451e'),
    readColor('--color-koi-2', '#f0813a'),
    readColor('--color-koi-3', '#f7efe2'),
  ]

  const stops = koi.map((entry, i) => entry.rgb ?? FALLBACK.koi[i]!)
  const gradient: string[] = []
  for (let i = 0; i < koiShades; i++) {
    const t = koiShades === 1 ? 0 : i / (koiShades - 1)
    const scaled = t * (stops.length - 1)
    const lo = Math.min(stops.length - 1, Math.floor(scaled))
    const hi = Math.min(stops.length - 1, lo + 1)
    const f = scaled - lo
    const channel = (k: number) => Math.round(stops[lo]![k]! * (1 - f) + stops[hi]![k]! * f)
    gradient.push(`rgb(${channel(0)},${channel(1)},${channel(2)})`)
  }

  return {
    ground: ground.css,
    photoHighlight: koi[2]!.css,
    ink: ink.css,
    photoShadow: water.css,
    ramp: orientRamp(
      baseRamp,
      ground.rgb ? luminance(...ground.rgb) : 0,
      ink.rgb ? luminance(...ink.rgb) : 1,
    ),
    colors: [water.css, stone.css, ...gradient],
  }
}
