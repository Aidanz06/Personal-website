/**
 * Working out how many character cells fit in a box.
 */

export type Grid = {
  cols: number
  rows: number
  /** Exact cell width in CSS pixels — not necessarily the requested cellSize. */
  cellWidth: number
  cellHeight: number
}

/**
 * Divide a box into character cells.
 *
 * `cellSize` is the *requested* cell width, but the returned cellWidth is
 * usually a hair different. The grid has to tile the box exactly: if the
 * cells were left at the requested size, the remainder at the right and
 * bottom edges would show as a strip of bare ground, and on a photograph
 * that reads as a rendering bug.
 *
 * So the column count is chosen from the requested size, and then the cells
 * are stretched to divide the box evenly. A 640px box at cellSize 9 gives 71
 * columns of 9.014px rather than 71 columns of 9px and a 1px gap.
 */
export function gridDimensions(
  width: number,
  height: number,
  cellSize: number,
  cellAspect = 2,
): Grid {
  const w = safePositive(width)
  const h = safePositive(height)
  const requestedWidth = safePositive(cellSize) || 1
  const aspect = safePositive(cellAspect) || 1
  const requestedHeight = requestedWidth * aspect

  const cols = Math.max(1, Math.floor(w / requestedWidth))
  const rows = Math.max(1, Math.floor(h / requestedHeight))

  return {
    cols,
    rows,
    cellWidth: w / cols,
    cellHeight: h / rows,
  }
}

/**
 * Range of cells that could possibly be affected by a pointer at (x, y).
 *
 * The per-frame loop walks only this window instead of every cell on the
 * grid. At the default radii that is roughly 1,200 cells rather than 3,600,
 * and it is what keeps the frame cost flat as the header gets bigger.
 *
 * Returned bounds are inclusive of `from` and exclusive of `to`, already
 * clamped to the grid, so an off-grid pointer yields an empty range.
 */
export function affectedCellRange(
  grid: Grid,
  pointerX: number,
  pointerY: number,
  outerRadius: number,
): { fromCol: number; toCol: number; fromRow: number; toRow: number } {
  const r = Math.max(0, outerRadius)
  const fromCol = clampInt(Math.floor((pointerX - r) / grid.cellWidth), 0, grid.cols)
  const toCol = clampInt(Math.ceil((pointerX + r) / grid.cellWidth), 0, grid.cols)
  const fromRow = clampInt(Math.floor((pointerY - r) / grid.cellHeight), 0, grid.rows)
  const toRow = clampInt(Math.ceil((pointerY + r) / grid.cellHeight), 0, grid.rows)
  return { fromCol, toCol, fromRow, toRow }
}

function safePositive(n: number): number {
  return Number.isFinite(n) && n > 0 ? n : 0
}

function clampInt(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return lo
  return n < lo ? lo : n > hi ? hi : n
}

/**
 * Source rectangle for drawing an image "cover"-style into a box: fill the
 * box completely, preserve the aspect ratio, crop the overflow evenly on
 * both sides.
 *
 * This is the same thing CSS `object-fit: cover` does, but the canvas has no
 * equivalent — drawImage always stretches unless it is handed an explicit
 * source rectangle. The underlying <img> uses object-fit: cover, so the
 * canvas has to crop identically or the ASCII layer and the photograph
 * underneath it would be framed differently.
 */
export function coverSourceRect(
  imageWidth: number,
  imageHeight: number,
  boxWidth: number,
  boxHeight: number,
): { sx: number; sy: number; sw: number; sh: number } {
  const iw = safePositive(imageWidth)
  const ih = safePositive(imageHeight)
  const bw = safePositive(boxWidth)
  const bh = safePositive(boxHeight)

  if (iw === 0 || ih === 0 || bw === 0 || bh === 0) {
    return { sx: 0, sy: 0, sw: iw, sh: ih }
  }

  const scale = Math.max(bw / iw, bh / ih)
  const sw = Math.min(iw, bw / scale)
  const sh = Math.min(ih, bh / scale)

  return { sx: (iw - sw) / 2, sy: (ih - sh) / 2, sw, sh }
}
