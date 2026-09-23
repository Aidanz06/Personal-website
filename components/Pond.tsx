'use client'

import { useEffect, useRef } from 'react'
import { buildAtlas, atlasTile, type Atlas } from '@/lib/ascii/atlas'
import { parseCssColor } from '@/lib/ascii/color'
import { gridDimensions, type Grid } from '@/lib/ascii/grid'
import { luminance, luminanceGrid } from '@/lib/ascii/luminance'
import { orientRamp, rampIndex } from '@/lib/ascii/ramp'
import { DEFAULT_RAMP } from '@/lib/ascii/constants'
import { subscribe, pointerState } from '@/lib/ascii/loop'
import { stepDegradation } from '@/lib/ascii/degrade'
import { blendFactor } from '@/lib/ascii/blend'
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
import { placeStones, type StoneSpec } from '@/lib/pond/stones'
import {
  photoDepthFactor,
  photoOpacity,
  revealRect,
  type PhotoGrid,
  type Rect,
} from '@/lib/pond/photo'
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
}

/**
 * Settings that cannot be changed on the fly — they decide the size of the
 * grid, the atlas and the fish population, so changing one means rebuilding.
 */
const STRUCTURAL_KEYS = ['cellSize', 'cellAspect', 'koiCount'] as const

/** How many gradient steps the koi colours get in the atlas. */
const KOI_SHADES = 6

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
  /**
   * Photographs the koi carries. Approaching a fish opens the one it is
   * holding, in place — there is deliberately no navigation involved.
   */
  photos?: readonly string[]
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
  photos,
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

  const photosRef = useRef(photos)
  photosRef.current = photos

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
    let ramp = POND_RAMP
    let colors: string[] = []

    let koi: Koi[] = []
    let ripples: Ripple[] = []

    type LoadedPhoto = { image: HTMLImageElement; grid: PhotoGrid; aspect: number }
    let loadedPhotos: LoadedPhoto[] = []
    let photoIndex = 0
    /** True once the current photograph has been opened most of the way. */
    let photoWasSeen = false
    /** Latched open: see the note where it is set. */
    let photoLatched = false
    /** Smoothed reveal, so opening and closing are eased rather than abrupt. */
    let photoReveal = 0

    // Previous frame's glyph per cell, so only changed cells are redrawn.
    // -1 means "nothing drawn there yet".
    let previousChar: Int16Array = new Int16Array(0)
    let previousColor: Int16Array = new Int16Array(0)

    let activeCellSize = settingsRef.current.cellSize
    // The cell size the props last asked for, as distinct from the working
    // size, which runtime degradation may have coarsened.
    let requestedCellSize = settingsRef.current.cellSize
    let slowFrames = 0
    let lastTime = performance.now()
    let lastRippleAt = 0
    let visible = true
    let unsubscribe: (() => void) | null = null

    // ---- theme -----------------------------------------------------------

    function readTheme(): void {
      const styles = getComputedStyle(container!)
      const read = (token: string, fallback: string) => {
        const rgb = parseCssColor(styles.getPropertyValue(token).trim())
        return rgb ? { css: `rgb(${rgb.join(',')})`, rgb } : { css: fallback, rgb: null }
      }

      const groundRead = read('--color-ground', '#0b100f')
      const inkRead = read('--color-ink', '#ece7dd')
      const waterRead = read('--color-water', '#243230')
      // Stones are drawn in the muted tone, not full ink. They sit directly
      // behind their own labels, and at full strength they compete with the
      // text for the same pale colour — which makes the navigation, the one
      // thing on this page that has to be readable, hard to read.
      const stoneRead = read('--color-muted', '#7f7f7e')
      const koi1 = read('--color-koi-1', '#d2451e')
      const koi2 = read('--color-koi-2', '#f0813a')
      const koi3 = read('--color-koi-3', '#f7efe2')

      ground = groundRead.css

      const groundLuminance = groundRead.rgb ? luminance(...groundRead.rgb) : 0
      const inkLuminance = inkRead.rgb ? luminance(...inkRead.rgb) : 1
      ramp = orientRamp(POND_RAMP, groundLuminance, inkLuminance)

      // Colour index 0 is water, 1 is stone, then the koi gradient.
      // Water is dim on purpose: the reference works because the field is
      // nearly empty and only the fish are bright.
      const koiStops = [koi1.rgb, koi2.rgb, koi3.rgb].map(
        (c, i) => c ?? [[210, 69, 30], [240, 129, 58], [247, 239, 226]][i]!,
      )
      const gradient: string[] = []
      for (let i = 0; i < KOI_SHADES; i++) {
        const t = i / (KOI_SHADES - 1)
        const scaled = t * (koiStops.length - 1)
        const lo = Math.min(koiStops.length - 1, Math.floor(scaled))
        const hi = Math.min(koiStops.length - 1, lo + 1)
        const f = scaled - lo
        const mixChannel = (k: number) =>
          Math.round(koiStops[lo]![k]! * (1 - f) + koiStops[hi]![k]! * f)
        gradient.push(`rgb(${mixChannel(0)},${mixChannel(1)},${mixChannel(2)})`)
      }

      colors = [waterRead.css, stoneRead.css, ...gradient]
    }

    function colorIndexFor(material: number, tint: number): number {
      if (material === MATERIAL.water) return 0
      if (material === MATERIAL.stone) return 1
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
    async function loadPhotos(): Promise<void> {
      const sources = photosRef.current ?? []
      const loaded: LoadedPhoto[] = []

      for (const src of sources) {
        const image = new Image()
        image.src = src
        try {
          await image.decode()
        } catch {
          // A missing or broken file should cost one photograph, not the pond.
          continue
        }
        if (image.naturalWidth === 0) continue

        const cols = 150
        const rows = Math.max(
          1,
          Math.round(cols * (image.naturalHeight / image.naturalWidth)),
        )
        const sampler = document.createElement('canvas')
        sampler.width = cols
        sampler.height = rows
        const samplerContext = sampler.getContext('2d', { willReadFrequently: true })
        if (!samplerContext) continue
        samplerContext.imageSmoothingEnabled = true
        samplerContext.imageSmoothingQuality = 'high'
        samplerContext.drawImage(image, 0, 0, cols, rows)

        try {
          const pixels = samplerContext.getImageData(0, 0, cols, rows).data
          loaded.push({
            image,
            grid: { cols, rows, luminance: luminanceGrid(pixels, cols, rows) },
            aspect: image.naturalWidth / image.naturalHeight,
          })
        } catch {
          // A cross-origin image taints the canvas; skip it.
          continue
        }
      }

      loadedPhotos = loaded
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
      atlas = buildAtlas(ramp, colors, grid.cellWidth, grid.cellHeight, fontFamily, dpr)

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
      const placed: readonly PondStone[] = stoneSpecsRef.current
        ? placeStones(stoneSpecsRef.current, width, height).map((p) => ({
            x: p.x,
            worldY: p.worldY,
            radius: p.radius,
          }))
        : stonesRef.current

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

      // --- the koi opens into the photograph it is carrying ---
      // No navigation: approaching the fish IS the interaction. Because the
      // fish is drawn to the cursor, holding still brings it to you and the
      // picture opens as it arrives.
      let photoDraw: { image: HTMLImageElement; rect: Rect; opacity: number } | null = null

      if (loadedPhotos.length > 0 && koi.length > 0) {
        const carrier = koi[0]!
        let proximity = 0
        if (pointer) {
          const distance = Math.hypot(
            pointer.x - carrier.head.x,
            pointer.y - carrier.head.y,
          )
          proximity = blendFactor(distance, s.photoInnerRadius, s.photoOuterRadius)
          // Only in the depths — see photoDepthFactor.
          proximity *= scrollDrivenRef.current ? photoDepthFactor(worldY, height) : 1
        }

        // Latch, with a wide gap between opening and closing.
        //
        // The koi is attracted to the cursor but circles it rather than
        // settling on it, so raw proximity hovers somewhere short of 1 and
        // wobbles — which left the characters permanently half-faded over the
        // picture like a screen door, and flickering as the fish orbited.
        // Once you have drawn the fish in, the photograph commits to opening
        // and stays open until you actually leave.
        if (proximity > 0.72) photoLatched = true
        if (proximity < 0.3) photoLatched = false

        const target = photoLatched ? 1 : proximity
        // Exponential smoothing, frame-rate independent: eases both ways, so
        // nothing ever snaps between states.
        photoReveal += (target - photoReveal) * (1 - Math.exp(-6 * dt))
        const reveal = photoReveal

        // Each full look swaps in the next photograph, so approaching the
        // fish again shows something new rather than the same picture.
        if (reveal > 0.9) photoWasSeen = true
        if (reveal < 0.05 && photoWasSeen) {
          photoWasSeen = false
          photoIndex = (photoIndex + 1) % loadedPhotos.length
        }

        if (reveal > 0.01) {
          const photo = loadedPhotos[photoIndex % loadedPhotos.length]!
          const targetWidth = Math.min(width * 0.62, 620)
          const targetHeight = targetWidth / (photo.aspect || 1.5)
          const rect = revealRect(
            carrier.head.x,
            carrier.head.y - worldY,
            reveal,
            s.bodyRadius * 2,
            targetWidth,
            targetHeight,
            { width, height },
          )
          stampPhoto(field, photo.grid, rect, reveal, cw, ch)

          const opacity = photoOpacity(reveal)
          if (opacity > 0.01) photoDraw = { image: photo.image, rect, opacity }
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
        const { image, rect, opacity } = photoDraw
        context!.save()
        context!.globalAlpha = opacity
        context!.drawImage(
          image,
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

    void loadPhotos()

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
