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

/** What a cell is showing, so the draw step knows which colour to use. */
export const MATERIAL = {
  water: 0,
  koi: 1,
  stone: 2,
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
): void {
  for (const stamp of koiSilhouette(koi, bodyRadius, tailAmplitude)) {
    stampBlob(
      field,
      stamp.x,
      stamp.y,
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
