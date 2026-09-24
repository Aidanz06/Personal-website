/**
 * The compositor.
 *
 * Everything in the pond — water, ripples, koi, stones, and eventually a
 * photograph — writes brightness into one buffer. The renderer then maps that
 * buffer through the density ramp and draws characters, exactly as it does
 * for a photograph.
 *
 * That is the whole architectural idea: a fish and a photo are not different
 * kinds of thing, they are different sources writing into the same field. It
 * is what makes a koi dissolving into a photograph a crossfade between two
 * numbers rather than a special effect.
 */

import type { Koi } from './koi'
import { koiSilhouette } from './koi'
import { edgeFeather } from './asciiArt'
import { samplePhoto, type PhotoGrid, type Rect } from './photo'

/** What a cell is showing, so the draw step knows which colour to use. */
export const MATERIAL = {
  water: 0,
  koi: 1,
  stone: 2,
  /** A photograph the koi has opened into. Drawn in ink, not koi colour. */
  photo: 3,
} as const

export type Material = (typeof MATERIAL)[keyof typeof MATERIAL]

export type Field = {
  cols: number
  rows: number
  /** Brightness per cell, 0..1. */
  luminance: Float32Array
  /** Which material won each cell. */
  material: Uint8Array
  /** For koi cells, position along the body 0..1 — drives the colour gradient. */
  tint: Float32Array
}

export function createField(cols: number, rows: number): Field {
  const count = Math.max(0, cols * rows)
  return {
    cols,
    rows,
    luminance: new Float32Array(count),
    material: new Uint8Array(count),
    tint: new Float32Array(count),
  }
}

/** Reset every cell to plain water at the given brightness. */
export function clearField(field: Field, baseLuminance = 0): void {
  field.luminance.fill(baseLuminance)
  field.material.fill(MATERIAL.water)
  field.tint.fill(0)
}

/**
 * Write a soft radial blob into the field.
 *
 * Brightness takes the MAXIMUM rather than adding, so overlapping fish don't
 * blow out to solid white where they cross — a fish swimming over another
 * stays as bright as one fish, which is what the eye expects. The material
 * of the brighter contributor wins the cell.
 */
export function stampBlob(
  field: Field,
  centreX: number,
  centreY: number,
  radius: number,
  strength: number,
  material: Material,
  tint: number,
  cellWidth: number,
  cellHeight: number,
): void {
  if (radius <= 0 || strength <= 0) return

  const fromCol = Math.max(0, Math.floor((centreX - radius) / cellWidth))
  const toCol = Math.min(field.cols - 1, Math.ceil((centreX + radius) / cellWidth))
  const fromRow = Math.max(0, Math.floor((centreY - radius) / cellHeight))
  const toRow = Math.min(field.rows - 1, Math.ceil((centreY + radius) / cellHeight))

  const radiusSquared = radius * radius

  for (let row = fromRow; row <= toRow; row++) {
    const cellCentreY = (row + 0.5) * cellHeight
    const dy = cellCentreY - centreY
    const dySquared = dy * dy
    if (dySquared > radiusSquared) continue

    for (let col = fromCol; col <= toCol; col++) {
      const cellCentreX = (col + 0.5) * cellWidth
      const dx = cellCentreX - centreX
      const distanceSquared = dx * dx + dySquared
      if (distanceSquared > radiusSquared) continue

      // Smooth falloff: 1 at the centre, 0 at the rim, flat at both ends.
      const t = 1 - distanceSquared / radiusSquared
      const value = strength * t * t

      const index = row * field.cols + col
      if (value > field.luminance[index]!) {
        field.luminance[index] = value
        field.material[index] = material
        field.tint[index] = tint
      }
    }
  }
}

/**
 * Stamp a whole fish: body, tail fin and pectoral fins.
 *
 * The anatomy lives in koi.ts — this just draws whatever blobs it is handed,
 * so the compositor never needs to know what a fin is.
 */
export function stampKoi(
  field: Field,
  koi: Koi,
  bodyRadius: number,
  brightness: number,
  cellWidth: number,
  cellHeight: number,
  tailAmplitude?: number,
  /** Subtracted from every y, to turn world coordinates into screen ones. */
  offsetY = 0,
): void {
  for (const stamp of koiSilhouette(koi, bodyRadius, tailAmplitude)) {
    stampBlob(
      field,
      stamp.x,
      stamp.y - offsetY,
      stamp.radius,
      brightness * stamp.strength,
      MATERIAL.koi,
      stamp.tint,
      cellWidth,
      cellHeight,
    )
  }
}

export type Stone = {
  x: number
  y: number
  radius: number
  /** The route this stone leads to, for the real <a> layered over it. */
  href: string
  label: string
}

/** Stamp a stone. Stones are static, dense and deliberately dull. */
export function stampStone(
  field: Field,
  stone: Stone,
  brightness: number,
  cellWidth: number,
  cellHeight: number,
): void {
  stampBlob(
    field,
    stone.x,
    stone.y,
    stone.radius,
    brightness,
    MATERIAL.stone,
    0,
    cellWidth,
    cellHeight,
  )
}

/**
 * Write a photograph into the field, over a rectangular region.
 *
 * `blend` crossfades it against whatever is already in each cell, so the koi
 * dissolves into the picture rather than being replaced by it in one frame.
 * At blend 1 the photograph wins outright.
 */
export function stampPhoto(
  field: Field,
  photo: PhotoGrid,
  rect: Rect,
  blend: number,
  cellWidth: number,
  cellHeight: number,
  /**
   * Soften the edges into the water, over this fraction of the picture's
   * shorter side. 0 — what the homepage uses — leaves a hard rectangle, which
   * is fine there because the real photograph is painted over it with its own
   * vignette. A picture that stays as characters has nothing painted over
   * it, so its edge IS its edge, and a slab of dense characters ending in a
   * straight line reads as a box dropped on the pond.
   */
  feather = 0,
): void {
  if (blend <= 0 || rect.width <= 0 || rect.height <= 0) return
  const strength = Math.min(1, Math.max(0, blend))
  const featherPx = Math.max(0, feather) * Math.min(rect.width, rect.height)

  const fromCol = Math.max(0, Math.floor(rect.x / cellWidth))
  const toCol = Math.min(field.cols - 1, Math.ceil((rect.x + rect.width) / cellWidth))
  const fromRow = Math.max(0, Math.floor(rect.y / cellHeight))
  const toRow = Math.min(field.rows - 1, Math.ceil((rect.y + rect.height) / cellHeight))

  for (let row = fromRow; row <= toRow; row++) {
    const centreY = (row + 0.5) * cellHeight
    const v = (centreY - rect.y) / rect.height
    if (v < 0 || v >= 1) continue

    for (let col = fromCol; col <= toCol; col++) {
      const centreX = (col + 0.5) * cellWidth
      const u = (centreX - rect.x) / rect.width
      if (u < 0 || u >= 1) continue

      const index = row * field.cols + col
      const value = samplePhoto(photo, u, v)
      const existing = field.luminance[index] ?? 0

      const edgeFactor = edgeFeather(centreX, centreY, rect, featherPx)
      const cellStrength = strength * edgeFactor

      field.luminance[index] = existing + (value - existing) * cellStrength
      // The cell only calls itself a photograph once the picture is actually
      // the dominant contributor; before that it keeps the koi's colouring,
      // which is what makes the fish look like it is turning into the image.
      //
      // At a feathered edge the test is the picture's own blend, not the
      // faded one: a fading cell is still the picture, thinning out. Testing
      // the faded value flips the colour to the water's halfway through the
      // fade, which draws the very line the feathering exists to remove.
      if (strength > 0.5 && (featherPx === 0 ? cellStrength > 0.5 : edgeFactor > 0.1)) {
        field.material[index] = MATERIAL.photo
        field.tint[index] = 0
      }
    }
  }
}
