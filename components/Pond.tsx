'use client'

import { useEffect, useRef } from 'react'
import { buildAtlas, atlasTile, type Atlas } from '@/lib/ascii/atlas'
import { gridDimensions, type Grid } from '@/lib/ascii/grid'
import { luminanceGrid } from '@/lib/ascii/luminance'
import { rampIndex } from '@/lib/ascii/ramp'
import { DEFAULT_RAMP } from '@/lib/ascii/constants'
import { subscribe, pointerState } from '@/lib/ascii/loop'
import { shouldRecalibrate, stepDegradation } from '@/lib/ascii/degrade'
import { MAX_CELL_SIZE } from '@/lib/ascii/constants'
import {
  DEFAULT_WAVES,
  waveHeight,
} from '@/lib/pond/water'
import {
  DEFAULT_RIPPLE_SETTINGS,
  isRippleExpired,
  ripplesAt,
  type Ripple,
} from '@/lib/pond/ripples'
import {
  DEFAULT_BODY_RADIUS,
  DEFAULT_KOI_SETTINGS,
  DEFAULT_SEGMENTS,
  createKoi,
  stepKoi,
  type Koi,
} from '@/lib/pond/koi'
import { drainSplashes } from '@/lib/pond/splash'
import { RING_STRENGTH, ringDue } from '@/lib/pond/rings'
import { placeStones, type StoneSpec } from '@/lib/pond/stones'
import { pondPalette } from '@/lib/pond/theme'
import {
  fitWithin,
  photoMaxWidth,
  photoOpacity,
  revealRect,
  stretchContrast,
  type PhotoGrid,
  type Rect,
} from '@/lib/pond/photo'
import type { PhotoStoneSpec } from '@/lib/pond/photoStones'
import {
  MATERIAL,
  clearField,
  createField,
  stampKoi,
  stampPhoto,
  stampStone,
  type Field,
} from '@/lib/pond/field'

export type PondSettings = {
  cellSize: number
  cellAspect: number
  waterBase: number
  waterAmplitude: number
  rippleStrength: number
  koiCount: number
  bodyRadius: number
  /** How far the tail sweeps, in pixels. */
  tailAmplitude: number
  /** Multiplier on the tail beat rate. Below 1 is calmer. */
  beatRate: number
  /** Within this distance of the koi, its photograph is fully open. */
  photoInnerRadius: number
  /** Beyond this distance, no photograph at all. */
  photoOuterRadius: number
  koiBrightness: number
  attractRadius: number
  attractStrength: number
  stoneBrightness: number
  /**
   * How large an opened picture gets, as a fraction of the size it would
   * otherwise open to. 1 everywhere but /listening, where an album cover is
   * a small thing surfacing rather than a photograph to look at.
   */
  photoScale: number
  /**
   * Keep an opened picture as ASCII art for good.
   *
   * Every picture passes through characters on its way open; a photograph
   * then hands over to the real image, because a photograph has to be
   * seeable. With this on, the characters are the picture: no hand-over,
   * drawn in the page's ink rather than the koi's colours (which would make
   * it read as part of the fish), and feathered into the water at the edges,
   * since there is no vignetted image painted over them to hide a hard one.
   */
  photoAscii: boolean
  /**
   * How far an opened picture drifts, in pixels, as if suspended in the
   * water. 0 holds it still, which is what photographs do.
   */
  photoFloat: number
}

export const DEFAULT_POND_SETTINGS: PondSettings = {
  // One fish, rendered well, on a finer grid. A single koi can carry far more
  // detail than five can — fins and a tail beat only read at this size.
  cellSize: 7,
  // 1.7, not 2. A monospace glyph box is about 0.6 wide to 1 tall, so a cell
  // aspect of 2 wastes vertical resolution — and vertical rows are exactly
  // what the fish needs to read as a body rather than a bar.
  cellAspect: 1.7,
  waterBase: 0.15,
  waterAmplitude: 0.09,
  rippleStrength: 0.45,
  koiCount: 1,
  bodyRadius: DEFAULT_BODY_RADIUS,
  tailAmplitude: 15,
  beatRate: 1.3,
  photoInnerRadius: 90,
  photoOuterRadius: 330,
  koiBrightness: 0.95,
  attractRadius: DEFAULT_KOI_SETTINGS.attractRadius,
  attractStrength: DEFAULT_KOI_SETTINGS.attractStrength,
  stoneBrightness: 0.45,
  photoScale: 1,
  photoAscii: false,
  photoFloat: 0,
}

/**
 * Settings that cannot be changed on the fly — they decide the size of the
 * grid, the atlas and the fish population, so changing one means rebuilding.
 */
const STRUCTURAL_KEYS = ['cellSize', 'cellAspect', 'koiCount'] as const

/** How many gradient steps the koi colours get in the atlas. */
const KOI_SHADES = 6
/** Atlas slot for the page's ink, appended after water, stone and the koi. */
const INK_COLOR = 2 + KOI_SHADES
/** How far in an ASCII picture's edges fade, as a fraction of its shorter side. */
const PHOTO_FEATHER = 0.22

/**
 * The pond's ramp has a BLANK at its sparse end, which the photograph ramp
 * does not.
 *
 * Without it every single cell draws something, and still water comes out as
 * a perfectly regular lattice of dots — which reads as graph paper, not
 * water. The blank is what lets most of the surface be genuinely empty, so
 * the koi are the only bright thing in the frame. That emptiness is most of
 * why the reference image works.
 *
 * It survives orientRamp() in both directions: on a dark ground the ramp
 * reverses and the blank ends up on the dim end, on a light ground it stays
 * put and lands on the bright end. Either way the quietest water draws
 * nothing, and atlasTile() skips it without a blit.
 */
const POND_RAMP = ` ${DEFAULT_RAMP}`

/** Where an open photograph has landed on screen, in viewport pixels. */
export type PhotoRect = {
  index: number
  x: number
  y: number
  width: number
  height: number
}

/**
 * Space kept clear beneath an open photograph, for its caption.
 *
 * Without it a rock near the bottom of the screen opens a picture flush
 * against the bottom edge and the caption has nowhere to go but on top of it.
 */
const CAPTION_SPACE = 92

/**
 * How far open a photograph has to be before its caption appears.
 *
 * The reveal eases asymptotically, so it never literally reaches 1. At 0.85
 * the eased rect is within a third of a percent of its final size, which is
 * to say the caption is positioned where the photograph actually ends up.
 */
const CAPTION_THRESHOLD = 0.85

/** A stone as the pond needs it: document coordinates, not viewport ones. */
export type PondStone = {
  x: number
  /** Pixels from the top of the DOCUMENT. */
  worldY: number
  radius: number
}

export type PondProps = {
  className?: string
  settings?: Partial<PondSettings>
  stones?: readonly PondStone[]
  /**
   * Stone specs the pond places itself from its own size. Preferred over
   * `stones`: it means the page does not have to measure anything, so the
   * links it renders can be plain server-side HTML.
   */
  stoneSpecs?: readonly StoneSpec[]
  /**
   * Follow the page scroll, so the water and the stones slide past as the
   * reader descends. The koi is deliberately NOT world-anchored — see the
   * note in the frame loop.
   */
  scrollDriven?: boolean
  /** Index of the stone currently hovered or focused, if any. */
  highlight?: number | null
  /** Photo rocks, placed by the page. */
  photoStones?: readonly PhotoStoneSpec[]
  /** Index of the photo rock currently hovered, focused or pinned open. */
  activePhoto?: number | null
  /**
   * Reports where an open photograph has settled, so the page can put a
   * caption under it.
   *
   * Called twice per photograph, not once per frame: once when the picture is
   * as good as fully open, and once with null when it closes. The rect is in
   * viewport coordinates, which is what the canvas works in — it is fixed to
   * the viewport — so the caption can be positioned straight from it.
   */
  onPhotoRect?: (rect: PhotoRect | null) => void
  /** Reports the measured frame rate, for the lab readout. */
  onStats?: (stats: { fps: number; cellsDrawn: number; cells: number }) => void
}

export function Pond({
  className,
  settings,
  stones = [],
  stoneSpecs,
  scrollDriven = false,
  highlight = null,
  photoStones,
  activePhoto = null,
  onPhotoRect,
  onStats,
}: PondProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const refreshRef = useRef<(() => void) | null>(null)

  const settingsRef = useRef<PondSettings>({ ...DEFAULT_POND_SETTINGS, ...settings })
  settingsRef.current = { ...DEFAULT_POND_SETTINGS, ...settings }

  const stonesRef = useRef(stones)
  stonesRef.current = stones

  const stoneSpecsRef = useRef(stoneSpecs)
  stoneSpecsRef.current = stoneSpecs

  const highlightRef = useRef(highlight)
  highlightRef.current = highlight

  const scrollDrivenRef = useRef(scrollDriven)
  scrollDrivenRef.current = scrollDriven

  const photoStonesRef = useRef(photoStones)
  photoStonesRef.current = photoStones

  const activePhotoRef = useRef(activePhoto)
  activePhotoRef.current = activePhoto

  const onPhotoRectRef = useRef(onPhotoRect)
  onPhotoRectRef.current = onPhotoRect

  const onStatsRef = useRef(onStats)
  onStatsRef.current = onStats

  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    if (!container || !canvas) return

    const context = canvas.getContext('2d', { alpha: false })
    if (!context) return

    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')

    let width = 0
    let height = 0
    let dpr = 1
    let grid: Grid | null = null
    let field: Field | null = null
    let atlas: Atlas | null = null

    let ground = '#0b100f'
    let photoHighlightCss = '#f7efe2'
    let photoShadowCss = '#243230'
    let ramp = POND_RAMP
    let colors: string[] = []
    let ink = '#ece7dd'

    let koi: Koi[] = []
    let ripples: Ripple[] = []

    type LoadedPhoto = {
      /** The still: a photograph, or a clip's poster frame. */
      image: HTMLImageElement
      /** The photograph, filtered to belong to the pond. See stylise(). */
      styled: HTMLCanvasElement | null
      grid: PhotoGrid
      /**
       * The same grid with its tones stretched to the full range, for a
       * picture that stays as characters. See stretchContrast().
       */
      asciiGrid: PhotoGrid
      aspect: number
      /**
       * A clip, if this rock holds one.
       *
       * Muted, looping and inline, which is the only combination a browser
       * will start on its own. It is created but never played until the rock
       * opens — twenty clips decoding in the background is a page that melts
       * a laptop.
       */
      video: HTMLVideoElement | null
      /**
       * Scratch canvas for filtering a clip's current frame.
       *
       * A photograph is filtered once at load. A clip changes thirty times a
       * second, so its duotone has to be redone every frame — into one reused
       * canvas, because allocating a canvas per frame is how you find out
       * what a garbage collector sounds like.
       */
      scratch: HTMLCanvasElement | null
    }
    /**
     * Sparse, indexed alongside the photo rocks. A photograph is only decoded
     * when its rock is within reach — twenty full-size camera files decoded
     * and filtered at mount would stall the page for seconds, and the pond is
     * the first thing anyone sees.
     */
    let loadedPhotos: (LoadedPhoto | null)[] = []
    let photoLoadState: ('idle' | 'loading' | 'done' | 'failed')[] = []
    /** Smoothed reveal per rock, so opening and closing are eased. */
    let photoReveal = 0
    let revealingIndex: number | null = null
    /** Which photograph's rect was last handed to the page, if any. */
    let reportedPhoto: number | null = null

    // Previous frame's glyph per cell, so only changed cells are redrawn.
    // -1 means "nothing drawn there yet".
    let previousChar: Int16Array = new Int16Array(0)
    let previousColor: Int16Array = new Int16Array(0)

    let activeCellSize = settingsRef.current.cellSize
    // The cell size the props last asked for, as distinct from the working
    // size, which runtime degradation may have coarsened.
    let requestedCellSize = settingsRef.current.cellSize
    let slowFrames = 0
    /** The box the current cell size was judged against. */
    let measuredBox = { width: 0, height: 0 }
    let lastTime = performance.now()
    let lastRippleAt = 0
    /** When each ringing stone last rang, in seconds. Indexed like the stones. */
    const lastRingAt: (number | null)[] = []
    let visible = true
    let unsubscribe: (() => void) | null = null

    // ---- theme -----------------------------------------------------------

    function readTheme(): void {
      const styles = getComputedStyle(container!)
      const palette = pondPalette(
        (token) => styles.getPropertyValue(token).trim(),
        POND_RAMP,
        KOI_SHADES,
      )
      ground = palette.ground
      photoHighlightCss = palette.photoHighlight
      photoShadowCss = palette.photoShadow
      ramp = palette.ramp
      colors = palette.colors
      ink = palette.ink
    }

    function colorIndexFor(material: number, tint: number): number {
      if (material === MATERIAL.water) return 0
      if (material === MATERIAL.stone) return 1
      if (material === MATERIAL.photo && settingsRef.current.photoAscii) return INK_COLOR
      const step = Math.round(tint * (KOI_SHADES - 1))
      return 2 + Math.min(KOI_SHADES - 1, Math.max(0, step))
    }

    /**
     * Reduce each photograph to a brightness grid, once.
     *
     * Sampled at a fixed resolution and then read with normalised
     * coordinates, so the region can open to any size without re-sampling the
     * source every frame.
     */
    async function loadPhoto(index: number): Promise<void> {
      const stones = photoStonesRef.current ?? []
      const spec = stones[index]
      if (!spec) return
      if (photoLoadState[index] && photoLoadState[index] !== 'idle') return
      photoLoadState[index] = 'loading'

      const image = new Image()
      image.src = spec.src
      try {
        await image.decode()
      } catch {
        // A missing or broken file costs one photograph, not the pond.
        photoLoadState[index] = 'failed'
        return
      }
      if (image.naturalWidth === 0) {
        photoLoadState[index] = 'failed'
        return
      }

      const cols = 150
      const rows = Math.max(1, Math.round(cols * (image.naturalHeight / image.naturalWidth)))
      const sampler = document.createElement('canvas')
      sampler.width = cols
      sampler.height = rows
      const samplerContext = sampler.getContext('2d', { willReadFrequently: true })
      if (!samplerContext) {
        photoLoadState[index] = 'failed'
        return
      }
      samplerContext.imageSmoothingEnabled = true
      samplerContext.imageSmoothingQuality = 'high'
      samplerContext.drawImage(image, 0, 0, cols, rows)

      try {
        const pixels = samplerContext.getImageData(0, 0, cols, rows).data

        // The ASCII stage is built from the still either way, so a rock holding
        // a clip is drawable long before a single frame of video has arrived.
        let video: HTMLVideoElement | null = null
        if (spec.video) {
          video = document.createElement('video')
          video.src = spec.video
          video.muted = true
          video.loop = true
          video.playsInline = true
          video.preload = 'auto'
          // Never audible, and never asked to be: a clip that wanted sound
          // would simply refuse to autoplay.
          video.volume = 0
          video.load()
        }

        const grid = { cols, rows, luminance: luminanceGrid(pixels, cols, rows) }
        loadedPhotos[index] = {
          image,
          styled: stylise(image),
          grid,
          asciiGrid: stretchContrast(grid),
          aspect: image.naturalWidth / image.naturalHeight,
          video,
          scratch: null,
        }
        photoLoadState[index] = 'done'
      } catch {
        // A cross-origin image taints the canvas.
        photoLoadState[index] = 'failed'
      }
    }

    /**
     * Filter a photograph so it belongs to the pond.
     *
     * A raw colour photograph appearing inside a monochrome, near-black ASCII
     * pond looks like a browser window opened on top of the artwork. The
     * filter is what stops the resolve feeling like the effect simply gave up
     * at the end: desaturated, tinted toward the koi's warm tones, its blacks
     * sunk toward the pond's ground, and vignetted so it has no hard
     * rectangular border.
     *
     * Done once per photograph at load rather than per frame, and redone when
     * the theme changes, because the tints come from the theme.
     */
    function stylise(image: HTMLImageElement): HTMLCanvasElement | null {
      const maxWidth = 1400
      const scale = Math.min(1, maxWidth / Math.max(1, image.naturalWidth))
      return styliseInto(
        null,
        image,
        Math.max(1, Math.round(image.naturalWidth * scale)),
        Math.max(1, Math.round(image.naturalHeight * scale)),
      )
    }

    /**
     * The filter itself, over anything the canvas can draw.
     *
     * `into` lets a clip reuse one canvas for every frame. Passing null
     * allocates a fresh one, which is what a photograph wants: it is filtered
     * exactly once and then kept.
     */
    function styliseInto(
      into: HTMLCanvasElement | null,
      source: CanvasImageSource,
      w: number,
      h: number,
    ): HTMLCanvasElement | null {
      const out = into ?? document.createElement('canvas')
      if (out.width !== w) out.width = w
      if (out.height !== h) out.height = h
      const c = out.getContext('2d')
      if (!c) return null
      c.setTransform(1, 0, 0, 1, 0, 0)
      c.globalAlpha = 1
      c.globalCompositeOperation = 'source-over'

      // Desaturate and firm up the contrast first.
      c.filter = 'grayscale(1) contrast(1.14) brightness(1.02)'
      c.drawImage(source, 0, 0, w, h)
      c.filter = 'none'

      // Duotone, in the pond's own two colours.
      //
      // Multiplying by the highlight tint pulls the bright end toward the
      // koi's palest tone; screening the shadow tint lifts the dark end to
      // the colour of the water. Between them the photograph's whole range is
      // remapped into the palette everything else on the page is drawn in —
      // which is the difference between a picture that surfaced out of the
      // pond and a browser window opened on top of the artwork.
      c.globalCompositeOperation = 'multiply'
      c.fillStyle = photoHighlightCss
      c.fillRect(0, 0, w, h)

      c.globalCompositeOperation = 'screen'
      c.fillStyle = photoShadowCss
      c.fillRect(0, 0, w, h)

      // Vignette, so the photograph fades into the water instead of ending at
      // a hard rectangle. The outer stop is inside the corners on purpose:
      // reach it only at the corners and the edges stay visibly straight.
      c.globalCompositeOperation = 'source-over'
      const gradient = c.createRadialGradient(
        w / 2, h / 2, Math.min(w, h) * 0.2,
        w / 2, h / 2, Math.max(w, h) * 0.56,
      )
      gradient.addColorStop(0, 'rgba(0,0,0,0)')
      gradient.addColorStop(0.62, 'rgba(0,0,0,0)')
      gradient.addColorStop(1, ground)
      c.fillStyle = gradient
      c.fillRect(0, 0, w, h)

      c.globalCompositeOperation = 'source-over'
      return out
    }

    // ---- sizing ----------------------------------------------------------

    function rebuild(): void {
      width = container!.clientWidth
      height = container!.clientHeight
      if (width <= 0 || height <= 0) return

      // A new cell size from the props overrides whatever degradation had
      // settled on. Without this the slider moves and nothing happens.
      if (settingsRef.current.cellSize !== requestedCellSize) {
        requestedCellSize = settingsRef.current.cellSize
        activeCellSize = requestedCellSize
      }

      // A coarsened grid is a judgement about the box it was measured in. If
      // the box has changed size dramatically, that judgement is about some
      // other box, so try the fine grid again and let degradation re-decide.
      if (shouldRecalibrate(measuredBox, { width, height })) {
        activeCellSize = requestedCellSize
        slowFrames = 0
      }
      measuredBox = { width, height }

      dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas!.width = Math.round(width * dpr)
      canvas!.height = Math.round(height * dpr)

      grid = gridDimensions(width, height, activeCellSize, settingsRef.current.cellAspect)
      field = createField(grid.cols, grid.rows)

      previousChar = new Int16Array(grid.cols * grid.rows).fill(-1)
      previousColor = new Int16Array(grid.cols * grid.rows).fill(-1)

      readTheme()

      const styles = getComputedStyle(container!)
      const fontFamily =
        styles.getPropertyValue('--font-mono').trim() || 'ui-monospace, monospace'
      // Ink goes last, so every index the other materials use stays put.
      atlas = buildAtlas(ramp, [...colors, ink], grid.cellWidth, grid.cellHeight, fontFamily, dpr)

      // The filter's tints come from the theme, so a theme change invalidates
      // every stylised photograph.
      for (const photo of loadedPhotos) {
        if (photo) photo.styled = stylise(photo.image)
      }

      // Repaint everything on the next frame.
      context!.setTransform(1, 0, 0, 1, 0, 0)
      context!.fillStyle = ground
      context!.fillRect(0, 0, canvas!.width, canvas!.height)

      if (koi.length !== settingsRef.current.koiCount) seedKoi()
    }

    function seedKoi(): void {
      const count = Math.max(0, Math.round(settingsRef.current.koiCount))
      const seedTop = scrollDrivenRef.current ? window.scrollY : 0
      koi = Array.from({ length: count }, (_, i) =>
        createKoi(
          { x: Math.random() * width, y: seedTop + Math.random() * height },
          Math.random() * Math.PI * 2,
          DEFAULT_SEGMENTS,
          i / Math.max(1, count - 1),
        ),
      )
    }

    // ---- frame -----------------------------------------------------------

    function frame(now: number, fps: number): void {
      if (!visible || !grid || !field || !atlas) return

      const s = settingsRef.current
      const seconds = now / 1000
      const dt = Math.min(0.05, (now - lastTime) / 1000)
      lastTime = now

      // How far down the pond we are. The water is a pure function of
      // position, so sampling it at an offset costs nothing — descending is
      // literally just adding a number to y.
      const worldY = scrollDrivenRef.current ? window.scrollY : 0
      // The koi swims the whole document; the viewport is only the part of it
      // the reader happens to be looking at.
      const worldHeight = scrollDrivenRef.current
        ? Math.max(height, document.documentElement.scrollHeight)
        : height
      const focusBand = { top: worldY, bottom: worldY + height }

      // Pointer in local coordinates.
      const rect = container!.getBoundingClientRect()
      const localX = pointerState.x - rect.left
      const localY = pointerState.y - rect.top
      // World coordinates, so a ripple stays where it was dropped instead of
      // sliding with the viewport.
      const worldPointerY = localY + worldY
      const pointerInside =
        pointerState.seen &&
        localX >= -80 && localX <= width + 80 &&
        localY >= -80 && localY <= height + 80
      const pointer = pointerInside ? { x: localX, y: worldPointerY } : null

      // Drop a ripple as the pointer moves, rate limited so a fast mouse does
      // not flood the list.
      if (pointer && now - lastRippleAt > 110) {
        lastRippleAt = now
        ripples.push({ x: pointer.x, y: pointer.y, startedAt: seconds, strength: s.rippleStrength })
      }
      // Fish leave wakes.
      for (const fish of koi) {
        if (Math.random() < 0.02) {
          ripples.push({
            x: fish.spine[fish.spine.length - 1]?.x ?? fish.head.x,
            y: fish.spine[fish.spine.length - 1]?.y ?? fish.head.y,
            startedAt: seconds,
            strength: s.rippleStrength * 0.33,
          })
        }
      }
      // A page change sends a wave across. The delays are in the future, and
      // rippleContribution() returns nothing for a ripple that has not
      // started, so the row arrives as a wave travelling rather than a line
      // appearing.
      for (const point of drainSplashes()) {
        ripples.push({
          x: width * point.xFraction,
          y: worldY + height * point.yFraction,
          startedAt: seconds + point.delay,
          strength: point.strength,
        })
      }

      ripples = ripples.filter((r) => !isRippleExpired(r, seconds, DEFAULT_RIPPLE_SETTINGS))

      // --- water + ripples into the field ---
      clearField(field, 0)
      const cw = grid.cellWidth
      const ch = grid.cellHeight
      for (let row = 0; row < grid.rows; row++) {
        const y = (row + 0.5) * ch
        for (let col = 0; col < grid.cols; col++) {
          const x = (col + 0.5) * cw
          const h = waveHeight(x, y + worldY, seconds, DEFAULT_WAVES)
          const r = ripplesAt(ripples, x, y + worldY, seconds, DEFAULT_RIPPLE_SETTINGS)
          let value = s.waterBase + h * s.waterAmplitude + r * 0.35
          if (value < 0) value = 0
          else if (value > 1) value = 1
          field.luminance[row * grid.cols + col] = value
        }
      }

      // --- stones, then koi on top ---
      // Stones live in document coordinates and scroll past; the koi does
      // not. A world-anchored fish would be left behind the moment you
      // scrolled, leaving empty water for most of the descent — with one
      // fish it should stay with the reader the whole way down.
      // Specs win when given: the pond sizes them from its own box, so the
      // page never has to measure the viewport to render its links.
      const placed: readonly (PondStone & { rings?: boolean })[] = stoneSpecsRef.current
        ? placeStones(stoneSpecsRef.current, width, height).map((p) => ({
            x: p.x,
            worldY: p.worldY,
            radius: p.radius,
            rings: p.spec.rings,
          }))
        : stonesRef.current

      // A ringing stone drops a soft ripple at its centre every couple of
      // seconds. The stone is stamped over the water below, so the ring is
      // hidden under it at first and seen emerging from the rim. Only while
      // it is on screen — a ring nobody can see is a ring that is due the
      // moment it comes back, not a backlog — and never under reduced motion,
      // where it would be a frozen circle rather than a breath.
      if (!reducedMotionQuery.matches) {
        placed.forEach((stone, index) => {
          if (!stone.rings) return
          const screenY = stone.worldY - worldY
          if (screenY < -stone.radius || screenY > height + stone.radius) {
            lastRingAt[index] = null
            return
          }
          if (!ringDue(lastRingAt[index] ?? null, seconds)) return
          lastRingAt[index] = seconds
          ripples.push({ x: stone.x, y: stone.worldY, startedAt: seconds, strength: RING_STRENGTH })
        })
      }

      const visibleStones: { x: number; y: number; radius: number }[] = []
      for (const stone of placed) {
        const screenY = stone.worldY - worldY
        // Skip anything well off-screen rather than stamping into nothing.
        if (screenY < -stone.radius * 2 || screenY > height + stone.radius * 2) continue
        visibleStones.push({ x: stone.x, y: screenY, radius: stone.radius })
      }

      const highlighted = highlightRef.current
      const target = field
      placed.forEach((stone, index) => {
        const screenY = stone.worldY - worldY
        if (screenY < -stone.radius * 2 || screenY > height + stone.radius * 2) return
        const lit = index === highlighted
        stampStone(
          target,
          { x: stone.x, y: screenY, radius: stone.radius, href: '', label: '' },
          // A hovered or focused stone brightens. Focus counts, so tabbing
          // through the links lights the pond up the same way hovering does.
          lit ? Math.min(1, s.stoneBrightness * 1.9) : s.stoneBrightness,
          cw,
          ch,
        )
      })

      // A focused stone pulls the fish, so keyboard users get the same
      // response to their attention that a pointer gets.
      let interest = pointer
      if (highlighted !== null && visibleStones[highlighted]) {
        const stone = visibleStones[highlighted]!
        interest = { x: stone.x, y: stone.y + worldY }
      }

      koi = koi.map((fish) =>
        stepKoi(
          fish,
          koi,
          interest,
          { width, height: worldHeight },
          dt,
          {
            ...DEFAULT_KOI_SETTINGS,
            attractRadius: s.attractRadius,
            attractStrength: s.attractStrength,
            baseBeat: DEFAULT_KOI_SETTINGS.baseBeat * s.beatRate,
            dartBeat: DEFAULT_KOI_SETTINGS.dartBeat * s.beatRate,
          },
          Math.random,
          focusBand,
        ),
      )
      for (const fish of koi) {
        stampKoi(field, fish, s.bodyRadius, s.koiBrightness, cw, ch, s.tailAmplitude, worldY)
      }

      // --- photo rocks ---
      // Hovering, focusing or tapping a rock opens its photograph in place.
      // Nothing navigates anywhere: the rock IS the photograph.
      let photoDraw: { photo: LoadedPhoto; rect: Rect; opacity: number } | null = null

      const rockSpecs = photoStonesRef.current ?? []
      const placedRocks = rockSpecs.length
        ? placeStones(rockSpecs, width, height).map((p) => ({
            x: p.x,
            worldY: p.worldY,
            radius: p.radius,
            // 1 for a photo rock. Heavier for a rock that is meant to read as
            // heavier — see PhotoStoneSpec.density.
            density: p.spec.density ?? 1,
          }))
        : []

      const active = activePhotoRef.current

      // Decode what is within reach, and always whatever is open.
      const preloadMargin = height * 1.5
      placedRocks.forEach((rock, index) => {
        const screenY = rock.worldY - worldY
        if (screenY > -preloadMargin && screenY < height + preloadMargin) {
          void loadPhoto(index)
        }
      })
      if (active !== null) void loadPhoto(active)

      // Which rock is opening, and how far. The reveal is deliberately slow:
      // a picture surfacing out of the water, not a hover state.
      if (active !== null && active !== revealingIndex && photoReveal < 0.02) {
        revealingIndex = active
      }
      const opening = active !== null && active === revealingIndex
      const targetReveal = opening ? 1 : 0
      // Deliberately slow — roughly two and a half seconds each way. This is
      // a picture surfacing out of the water, not a hover state, and the
      // ASCII stage needs time to be seen before the photograph takes over.
      photoReveal += (targetReveal - photoReveal) * (1 - Math.exp(-1.45 * dt))
      // A clip plays only while its own rock is open, and never under
      // reduced motion — an autoplaying loop is exactly the kind of movement
      // that preference is asking us not to start.
      for (let i = 0; i < loadedPhotos.length; i++) {
        const video = loadedPhotos[i]?.video
        if (!video) continue
        const shouldPlay =
          i === revealingIndex && photoReveal > 0.2 && !reducedMotionQuery.matches
        if (shouldPlay) {
          // play() rejects if the browser declines; it is muted and inline so
          // it should not, and if it does the poster frame stays up.
          if (video.paused) void video.play().catch(() => {})
        } else if (!video.paused) {
          video.pause()
          // Back to the first frame, so a rock always opens on the start of
          // the loop rather than wherever it was abandoned.
          video.currentTime = 0
        }
      }

      if (!opening && photoReveal < 0.01) revealingIndex = null
      if (revealingIndex === null && reportedPhoto !== null) {
        reportedPhoto = null
        onPhotoRectRef.current?.(null)
      }

      placedRocks.forEach((rock, index) => {
        const screenY = rock.worldY - worldY
        if (screenY < -rock.radius * 2 || screenY > height + rock.radius * 2) return
        const lit = index === active
        stampStone(
          target,
          { x: rock.x, y: screenY, radius: rock.radius, href: '', label: '' },
          Math.min(1, s.stoneBrightness * (lit ? 1.9 : 0.85) * rock.density),
          cw,
          ch,
        )
      })

      if (revealingIndex !== null && photoReveal > 0.01) {
        const photo = loadedPhotos[revealingIndex]
        const rock = placedRocks[revealingIndex]
        if (photo && rock) {
          // Fits both dimensions: a portrait photograph sized on width alone
          // runs off the top and bottom of the screen.
          const target = fitWithin(
            photo.aspect,
            photoMaxWidth(width) * s.photoScale,
            height * 0.7 * s.photoScale,
          )
          const settled = revealRect(
            rock.x,
            rock.worldY - worldY,
            photoReveal,
            rock.radius * 2,
            target.width,
            target.height,
            // Short of the full viewport, so the caption below it has room.
            { width, height: Math.max(target.height, height - CAPTION_SPACE) },
          )

          // Drift, as if the picture were suspended in the water. Two slow,
          // unrelated periods so the path never visibly repeats. The rect
          // reported to the page is the settled one — the caption holds still
          // and the page leaves room for the drift instead.
          const drift = s.photoFloat * Math.min(1, photoReveal)
          const rect = drift > 0
            ? {
                ...settled,
                x: settled.x + Math.sin(seconds * 0.53) * drift * 0.7,
                y: settled.y + Math.sin(seconds * 0.37 + 1.3) * drift,
              }
            : settled

          if (photoReveal > CAPTION_THRESHOLD && reportedPhoto !== revealingIndex) {
            reportedPhoto = revealingIndex
            onPhotoRectRef.current?.({
              index: revealingIndex,
              x: settled.x,
              y: settled.y,
              width: settled.width,
              height: settled.height,
            })
          }
          stampPhoto(field, s.photoAscii ? photo.asciiGrid : photo.grid, rect, photoReveal, cw, ch, s.photoAscii ? PHOTO_FEATHER : 0)

          const opacity = s.photoAscii ? 0 : photoOpacity(photoReveal)
          if (opacity > 0.01) photoDraw = { photo, rect, opacity }
        }
      }

      // --- draw only what changed ---
      context!.setTransform(1, 0, 0, 1, 0, 0)
      let drawn = 0
      const tileW = atlas.tileWidth
      const tileH = atlas.tileHeight

      for (let row = 0; row < grid.rows; row++) {
        for (let col = 0; col < grid.cols; col++) {
          const i = row * grid.cols + col
          const charIndex = rampIndex(field.luminance[i]!, ramp.length)
          const colorIndex = colorIndexFor(field.material[i]!, field.tint[i]!)

          if (previousChar[i] === charIndex && previousColor[i] === colorIndex) continue
          previousChar[i] = charIndex
          previousColor[i] = colorIndex
          drawn++

          const dx = Math.round(col * cw * dpr)
          const dy = Math.round(row * ch * dpr)

          context!.fillStyle = ground
          context!.fillRect(dx, dy, tileW, tileH)

          const tile = atlasTile(atlas, charIndex, colorIndex)
          if (!tile) continue
          context!.drawImage(atlas.canvas, tile.sx, tile.sy, tileW, tileH, dx, dy, tileW, tileH)
        }
      }

      // --- and finally the photograph itself ---
      // The characters hold until the picture is most of the way open, then
      // hand over. ASCII is the presentation layer, not a wall: a visitor has
      // to be able to actually see the photograph.
      if (photoDraw) {
        const { photo, rect, opacity } = photoDraw
        let source: CanvasImageSource = photo.styled ?? photo.image

        // A clip is filtered frame by frame, into the one scratch canvas it
        // keeps. The ASCII stage behind it stays built from the poster: the
        // characters only show while the picture is opening, and re-reading
        // the pixels of every frame to rebuild them would cost a getImageData
        // per frame to animate something nobody looks at for longer than a
        // second.
        const video = photo.video
        if (video && video.readyState >= 2 && video.videoWidth > 0) {
          const w = Math.min(720, video.videoWidth)
          const h = Math.max(1, Math.round(w * (video.videoHeight / video.videoWidth)))
          photo.scratch = styliseInto(photo.scratch, video, w, h)
          if (photo.scratch) source = photo.scratch
        }
        context!.save()
        context!.globalAlpha = opacity
        context!.drawImage(
          source,
          rect.x * dpr,
          rect.y * dpr,
          rect.width * dpr,
          rect.height * dpr,
        )
        context!.restore()

        // Those cells now have a photograph painted over them, so the
        // dirty-cell tracking no longer knows what they show. Invalidate them
        // or they will never be repainted once the picture closes.
        const c0 = Math.max(0, Math.floor(rect.x / cw))
        const c1 = Math.min(grid.cols - 1, Math.ceil((rect.x + rect.width) / cw))
        const r0 = Math.max(0, Math.floor(rect.y / ch))
        const r1 = Math.min(grid.rows - 1, Math.ceil((rect.y + rect.height) / ch))
        for (let row = r0; row <= r1; row++) {
          for (let col = c0; col <= c1; col++) previousChar[row * grid.cols + col] = -1
        }
      }

      onStatsRef.current?.({ fps, cellsDrawn: drawn, cells: grid.cols * grid.rows })

      // Coarsen the grid if the page cannot keep up.
      const next = stepDegradation({ slowFrames, cellSize: activeCellSize }, fps, MAX_CELL_SIZE)
      slowFrames = next.slowFrames
      if (next.coarsened) {
        activeCellSize = next.cellSize
        rebuild()
      }
    }

    // ---- wiring ----------------------------------------------------------

    function attach(): void {
      if (unsubscribe || reducedMotionQuery.matches) return
      lastTime = performance.now()
      unsubscribe = subscribe(frame)
    }

    function detach(): void {
      unsubscribe?.()
      unsubscribe = null
      // Nothing is being drawn any more, so nothing should be decoding.
      for (const photo of loadedPhotos) {
        if (photo?.video && !photo.video.paused) photo.video.pause()
      }
    }

    /**
     * Reduced motion: draw one still frame of the pond and stop. The water
     * and the fish are visible, nothing moves.
     */
    function drawStill(): void {
      if (!grid || !field || !atlas) return
      visible = true
      frame(performance.now(), 60)
    }

    /**
     * Rebuild, then repaint if nothing is going to repaint on its own.
     *
     * Under reduced motion the component never subscribes to the frame loop,
     * so a rebuild on its own leaves bare ground on screen. That is not
     * hypothetical: the first rebuild runs before layout has given the
     * container a size, bails out, and the real rebuild arrives from the
     * ResizeObserver a moment later — with nothing to draw the pond after it.
     */
    function refresh(): void {
      rebuild()
      if (reducedMotionQuery.matches) drawStill()
    }

    photoLoadState = (photoStonesRef.current ?? []).map(() => 'idle')
    loadedPhotos = (photoStonesRef.current ?? []).map(() => null)

    refreshRef.current = refresh
    refresh()

    if (!reducedMotionQuery.matches) attach()

    const intersectionObserver = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (!entry) return
        visible = entry.isIntersecting
        if (visible) attach()
        else detach()
      },
      { rootMargin: '120px' },
    )
    intersectionObserver.observe(container)

    const resizeObserver = new ResizeObserver(() => refresh())
    resizeObserver.observe(container)

    // Under reduced motion nothing repaints on its own, so a scroll would
    // leave a frozen frame from the wrong depth.
    const handleScroll = () => {
      if (reducedMotionQuery.matches) drawStill()
    }
    window.addEventListener('scroll', handleScroll, { passive: true })

    const themeObserver = new MutationObserver(() => refresh())
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    })

    const handleReducedMotion = () => {
      if (reducedMotionQuery.matches) {
        detach()
        drawStill()
      } else {
        attach()
      }
    }
    reducedMotionQuery.addEventListener('change', handleReducedMotion)

    return () => {
      refreshRef.current = null
      detach()
      intersectionObserver.disconnect()
      resizeObserver.disconnect()
      themeObserver.disconnect()
      window.removeEventListener('scroll', handleScroll)
      reducedMotionQuery.removeEventListener('change', handleReducedMotion)
    }
  }, [])

  // The main effect runs once and owns all the mutable state, so a prop
  // change reaches it only through settingsRef — which is enough for values
  // read every frame, but not for ones baked into the grid, the atlas or the
  // fish population. Those need an explicit rebuild, or their sliders are
  // silently dead.
  const structuralKey = STRUCTURAL_KEYS.map((key) => settingsRef.current[key]).join('|')
  useEffect(() => {
    refreshRef.current?.()
  }, [structuralKey])

  return (
    <div ref={containerRef} className={`relative overflow-hidden ${className ?? ''}`}>
      {/* Decorative: the stones layered over this are real links, and they
          are what a screen reader or keyboard user navigates. */}
      <canvas ref={canvasRef} aria-hidden="true" className="block h-full w-full" />
    </div>
  )
}
