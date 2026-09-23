'use client'

import { useEffect, useRef } from 'react'
import { buildAtlas, atlasTile, type Atlas } from '@/lib/ascii/atlas'
import { parseCssColor } from '@/lib/ascii/color'
import { gridDimensions, type Grid } from '@/lib/ascii/grid'
import { luminance } from '@/lib/ascii/luminance'
import { orientRamp, rampIndex } from '@/lib/ascii/ramp'
import { DEFAULT_RAMP } from '@/lib/ascii/constants'
import { subscribe, pointerState } from '@/lib/ascii/loop'
import { stepDegradation } from '@/lib/ascii/degrade'
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
import {
  MATERIAL,
  clearField,
  createField,
  stampKoi,
  stampStone,
  type Field,
  type Stone,
} from '@/lib/pond/field'

export type PondSettings = {
  cellSize: number
  cellAspect: number
  waterBase: number
  waterAmplitude: number
  rippleStrength: number
  koiCount: number
  bodyRadius: number
  koiBrightness: number
  attractRadius: number
  attractStrength: number
  stoneBrightness: number
}

export const DEFAULT_POND_SETTINGS: PondSettings = {
  cellSize: 9,
  cellAspect: 2,
  waterBase: 0.10,
  waterAmplitude: 0.09,
  rippleStrength: 0.45,
  koiCount: 5,
  bodyRadius: DEFAULT_BODY_RADIUS,
  koiBrightness: 0.95,
  attractRadius: DEFAULT_KOI_SETTINGS.attractRadius,
  attractStrength: DEFAULT_KOI_SETTINGS.attractStrength,
  stoneBrightness: 0.45,
}

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

export type PondProps = {
  className?: string
  settings?: Partial<PondSettings>
  stones?: readonly Stone[]
  /** Reports the measured frame rate, for the lab readout. */
  onStats?: (stats: { fps: number; cellsDrawn: number; cells: number }) => void
}

export function Pond({ className, settings, stones = [], onStats }: PondProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  const settingsRef = useRef<PondSettings>({ ...DEFAULT_POND_SETTINGS, ...settings })
  settingsRef.current = { ...DEFAULT_POND_SETTINGS, ...settings }

  const stonesRef = useRef(stones)
  stonesRef.current = stones

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

    // Previous frame's glyph per cell, so only changed cells are redrawn.
    // -1 means "nothing drawn there yet".
    let previousChar: Int16Array = new Int16Array(0)
    let previousColor: Int16Array = new Int16Array(0)

    let activeCellSize = settingsRef.current.cellSize
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

      colors = [waterRead.css, inkRead.css, ...gradient]
    }

    function colorIndexFor(material: number, tint: number): number {
      if (material === MATERIAL.water) return 0
      if (material === MATERIAL.stone) return 1
      const step = Math.round(tint * (KOI_SHADES - 1))
      return 2 + Math.min(KOI_SHADES - 1, Math.max(0, step))
    }

    // ---- sizing ----------------------------------------------------------

    function rebuild(): void {
      width = container!.clientWidth
      height = container!.clientHeight
      if (width <= 0 || height <= 0) return

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
      koi = Array.from({ length: count }, (_, i) =>
        createKoi(
          { x: Math.random() * width, y: Math.random() * height },
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

      // Pointer in local coordinates.
      const rect = container!.getBoundingClientRect()
      const localX = pointerState.x - rect.left
      const localY = pointerState.y - rect.top
      const pointerInside =
        pointerState.seen &&
        localX >= -80 && localX <= width + 80 &&
        localY >= -80 && localY <= height + 80
      const pointer = pointerInside ? { x: localX, y: localY } : null

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
          const h = waveHeight(x, y, seconds, DEFAULT_WAVES)
          const r = ripplesAt(ripples, x, y, seconds, DEFAULT_RIPPLE_SETTINGS)
          let value = s.waterBase + h * s.waterAmplitude + r * 0.35
          if (value < 0) value = 0
          else if (value > 1) value = 1
          field.luminance[row * grid.cols + col] = value
        }
      }

      // --- stones, then koi on top ---
      for (const stone of stonesRef.current) {
        stampStone(field, stone, s.stoneBrightness, cw, ch)
      }

      koi = koi.map((fish) =>
        stepKoi(fish, koi, pointer, { width, height }, dt, {
          ...DEFAULT_KOI_SETTINGS,
          attractRadius: s.attractRadius,
          attractStrength: s.attractStrength,
        }),
      )
      for (const fish of koi) {
        stampKoi(field, fish, s.bodyRadius, s.koiBrightness, cw, ch)
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
      detach()
      intersectionObserver.disconnect()
      resizeObserver.disconnect()
      themeObserver.disconnect()
      reducedMotionQuery.removeEventListener('change', handleReducedMotion)
    }
  }, [])

  return (
    <div ref={containerRef} className={`relative overflow-hidden ${className ?? ''}`}>
      {/* Decorative: the stones layered over this are real links, and they
          are what a screen reader or keyboard user navigates. */}
      <canvas ref={canvasRef} aria-hidden="true" className="block h-full w-full" />
    </div>
  )
}
