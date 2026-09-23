/**
 * A pre-rendered sheet of every character in every colour it can appear in.
 *
 * The photograph renderer never needed this: its character layer is drawn
 * once and reused, because the picture does not move. The pond breaks that
 * assumption — the water is always moving, so characters change every frame,
 * and we are back to thousands of glyph draws per frame.
 *
 * `fillText` is expensive out of proportion to how simple it looks: every
 * call does font matching, shaping and layout before it rasterises anything.
 * Drawing the same glyph once into an atlas and then blitting it as a sprite
 * skips all of that — `drawImage` of a small tile is close to a memory copy.
 *
 * The atlas is a grid: one row per colour, one column per ramp character.
 */

export type Atlas = {
  canvas: HTMLCanvasElement
  /** Tile size in device pixels. */
  tileWidth: number
  tileHeight: number
  /** Characters, in ramp order. */
  ramp: string
  /** Colours, in the order the caller supplied them. */
  colors: string[]
  /** Device pixel ratio the tiles were rendered at. */
  dpr: number
}

export function buildAtlas(
  ramp: string,
  colors: string[],
  cellWidth: number,
  cellHeight: number,
  fontFamily: string,
  dpr: number,
): Atlas | null {
  const tileWidth = Math.max(1, Math.ceil(cellWidth * dpr))
  const tileHeight = Math.max(1, Math.ceil(cellHeight * dpr))

  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, tileWidth * ramp.length)
  canvas.height = Math.max(1, tileHeight * colors.length)

  const context = canvas.getContext('2d')
  if (!context) return null

  // Transparent tiles: the caller paints the ground, then blits the glyph on
  // top, so one atlas works on any background.
  context.clearRect(0, 0, canvas.width, canvas.height)
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.font = `${(cellHeight * dpr * 0.82).toFixed(2)}px ${fontFamily}`

  for (let c = 0; c < colors.length; c++) {
    context.fillStyle = colors[c]!
    for (let i = 0; i < ramp.length; i++) {
      const char = ramp[i]!
      if (char === ' ') continue
      context.fillText(
        char,
        i * tileWidth + tileWidth / 2,
        c * tileHeight + tileHeight / 2,
      )
    }
  }

  return { canvas, tileWidth, tileHeight, ramp, colors, dpr }
}

/**
 * Where a given character and colour live in the atlas.
 *
 * Returns null for a blank, so the caller can skip the draw entirely rather
 * than blit an empty tile — on calm water most cells are blank, so this is
 * the common path.
 */
export function atlasTile(
  atlas: Atlas,
  charIndex: number,
  colorIndex: number,
): { sx: number; sy: number } | null {
  if (charIndex < 0 || charIndex >= atlas.ramp.length) return null
  if (colorIndex < 0 || colorIndex >= atlas.colors.length) return null
  if (atlas.ramp[charIndex] === ' ') return null
  return { sx: charIndex * atlas.tileWidth, sy: colorIndex * atlas.tileHeight }
}
