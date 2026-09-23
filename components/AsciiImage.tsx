'use client'

import { useEffect, useRef, useState } from 'react'
import {
  DEFAULT_CELL_ASPECT,
  DEFAULT_CELL_SIZE,
  DEFAULT_EXIT_EASE_MS,
  DEFAULT_INNER_RADIUS,
  DEFAULT_OUTER_RADIUS,
  DEFAULT_RAMP,
  MAX_CELL_SIZE,
} from '@/lib/ascii/constants'
import { stepDegradation } from '@/lib/ascii/degrade'
import { blendFactor, exitStrength } from '@/lib/ascii/blend'
import {
  affectedCellRange,
  coverSourceRect,
  gridDimensions,
  type Grid,
} from '@/lib/ascii/grid'
import { luminance, luminanceGrid } from '@/lib/ascii/luminance'
import { orientRamp, rampGrid } from '@/lib/ascii/ramp'
import { parseCssColor } from '@/lib/ascii/color'
import { selectRenderMode, type RenderMode } from '@/lib/ascii/mode'
import { pointerState, subscribe } from '@/lib/ascii/loop'

export type AsciiImageProps = {
  src: string
  /** Real alt text. This is what a screen reader gets — the canvas is hidden. */
  alt: string
  className?: string
  /** Sparse -> dense. Reverse the string to flip for a light-on-dark ground. */
  ramp?: string
  /** Character cell width in CSS pixels. */
  cellSize?: number
  /** Cell height / width. ~2 matches monospace glyph proportions. */
  cellAspect?: number
  /** Inside this distance from the pointer, the photograph is fully resolved. */
  innerRadius?: number
  /** Beyond this distance, pure characters. */
  outerRadius?: number
  /** Time to ease back to fully abstract after the pointer leaves. */
  exitEaseMs?: number
  /** Speed of the autonomous drift used when there is no hover (touch). */
  driftSpeed?: number
  /** Reports runtime changes — used by /lab to show the degraded cell size. */
  onDegrade?: (cellSize: number) => void
}

// Ground and ink are read from the design tokens so the renderer can never
// drift away from the rest of the site's palette.
const FALLBACK_GROUND = '#fafaf8'
const FALLBACK_INK = '#1a1a1a'

/** Alpha values below this contribute nothing visible; skip the fill. */
const ALPHA_EPSILON = 0.004

/** Precomputed rgba() strings, so the hot loop never concatenates a string. */
const ALPHA_STEPS = 64
const ALPHA_STRINGS = Array.from(
  { length: ALPHA_STEPS + 1 },
  (_, i) => `rgba(0,0,0,${(i / ALPHA_STEPS).toFixed(4)})`,
)

export function AsciiImage({
  src,
  alt,
  className,
  ramp = DEFAULT_RAMP,
  cellSize = DEFAULT_CELL_SIZE,
  cellAspect = DEFAULT_CELL_ASPECT,
  innerRadius = DEFAULT_INNER_RADIUS,
  outerRadius = DEFAULT_OUTER_RADIUS,
  exitEaseMs = DEFAULT_EXIT_EASE_MS,
  driftSpeed = 1,
  onDegrade,
}: AsciiImageProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  // Whether the canvas has painted at least once. Until it has, the plain
  // <img> underneath is what the visitor sees.
  const [enhanced, setEnhanced] = useState(false)

  // Props are mirrored into a ref so the animation frame always reads the
  // current values without the effect having to tear down and re-subscribe
  // every time a slider moves in /lab.
  const paramsRef = useRef({
    ramp,
    cellSize,
    cellAspect,
    innerRadius,
    outerRadius,
    exitEaseMs,
    driftSpeed,
  })
  paramsRef.current = {
    ramp,
    cellSize,
    cellAspect,
    innerRadius,
    outerRadius,
    exitEaseMs,
    driftSpeed,
  }

  const onDegradeRef = useRef(onDegrade)
  onDegradeRef.current = onDegrade

  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    const img = imgRef.current
    if (!container || !canvas || !img) return

    const context = canvas.getContext('2d')
    const supportsCanvas = Boolean(context)

    const reducedMotionQuery = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    )
    const finePointerQuery = window.matchMedia('(hover: hover) and (pointer: fine)')

    let mode: RenderMode = selectRenderMode({
      supportsCanvas,
      prefersReducedMotion: reducedMotionQuery.matches,
      hasFinePointer: finePointerQuery.matches,
    })

    // ---- state owned by this instance -----------------------------------

    /** Offscreen: ground + characters. Rebuilt only when the image or size changes. */
    let asciiLayer: HTMLCanvasElement | null = null
    /** Offscreen: the photograph, cropped to the box exactly as the <img> is. */
    let photoLayer: HTMLCanvasElement | null = null

    let grid: Grid | null = null
    let cssWidth = 0
    let cssHeight = 0
    let dpr = 1

    /** Working cell size — may grow above the prop if frame rate drops. */
    let activeCellSize = paramsRef.current.cellSize

    let rect = container.getBoundingClientRect()
    let visible = true
    let pointerInside = false
    let lastLocalX = 0
    let lastLocalY = 0
    let leftAt = 0
    let slowFrames = 0
    let unsubscribe: (() => void) | null = null

    // Theme colours, re-read whenever the theme changes. `let`, not `const`:
    // a theme switch has to reach the canvas too, and the cached layers are
    // painted in whatever these held at the time.
    let ground = FALLBACK_GROUND
    let ink = FALLBACK_INK
    let orientedRamp = paramsRef.current.ramp
    let monoFamily = 'ui-monospace, monospace'

    function readTheme(): void {
      const styles = getComputedStyle(container!)
      monoFamily =
        styles.getPropertyValue('--font-mono').trim() || 'ui-monospace, monospace'

      // Prefer the token; fall back to real resolved properties if a browser
      // hands back an unsubstituted var(). `color` is inherited from body and
      // always resolves to an rgb() triple.
      const groundToken = styles.getPropertyValue('--color-ground').trim()
      const inkToken = styles.getPropertyValue('--color-ink').trim()

      const groundRgb =
        parseCssColor(groundToken) ??
        parseCssColor(getComputedStyle(document.body).backgroundColor)
      const inkRgb = parseCssColor(inkToken) ?? parseCssColor(styles.color)

      ground = groundRgb ? `rgb(${groundRgb.join(',')})` : FALLBACK_GROUND
      ink = inkRgb ? `rgb(${inkRgb.join(',')})` : FALLBACK_INK

      // Point the ramp the right way for this theme. On a dark ground a dense
      // glyph reads BRIGHT, so the mapping has to invert or the photo comes
      // out as a negative.
      const groundLuminance = groundRgb ? luminance(...groundRgb) : 1
      const inkLuminance = inkRgb ? luminance(...inkRgb) : 0
      orientedRamp = orientRamp(paramsRef.current.ramp, groundLuminance, inkLuminance)
    }

    readTheme()

    // ---- building the two static layers ---------------------------------

    function buildLayers(): void {
      if (!context || !img || !img.complete || img.naturalWidth === 0) return

      cssWidth = container!.clientWidth
      cssHeight = container!.clientHeight
      if (cssWidth <= 0 || cssHeight <= 0) return

      // Cap the pixel ratio at 2. Beyond that the fill-rate cost rises
      // quadratically for a difference nobody can see on a photograph.
      dpr = Math.min(window.devicePixelRatio || 1, 2)

      const { cellAspect: aspect } = paramsRef.current
      const currentRamp = orientedRamp
      grid = gridDimensions(cssWidth, cssHeight, activeCellSize, aspect)

      // Size the visible canvas in device pixels, then scale the drawing
      // context so all drawing code can keep working in CSS pixels.
      canvas!.width = Math.round(cssWidth * dpr)
      canvas!.height = Math.round(cssHeight * dpr)

      const crop = coverSourceRect(
        img.naturalWidth,
        img.naturalHeight,
        cssWidth,
        cssHeight,
      )

      // --- photo layer ---
      photoLayer ??= document.createElement('canvas')
      photoLayer.width = canvas!.width
      photoLayer.height = canvas!.height
      const photoContext = photoLayer.getContext('2d')
      if (!photoContext) return
      photoContext.setTransform(dpr, 0, 0, dpr, 0, 0)
      photoContext.clearRect(0, 0, cssWidth, cssHeight)
      photoContext.drawImage(
        img,
        crop.sx,
        crop.sy,
        crop.sw,
        crop.sh,
        0,
        0,
        cssWidth,
        cssHeight,
      )

      // --- luminance, sampled once ---
      // Draw the image down to exactly one pixel per cell and read it back.
      // The browser's own image scaling does the box-filter averaging in
      // native code, which is far faster than averaging pixels in JS.
      const sampler = document.createElement('canvas')
      sampler.width = grid.cols
      sampler.height = grid.rows
      const samplerContext = sampler.getContext('2d', { willReadFrequently: true })
      if (!samplerContext) return
      samplerContext.imageSmoothingEnabled = true
      samplerContext.imageSmoothingQuality = 'high'
      samplerContext.drawImage(
        img,
        crop.sx,
        crop.sy,
        crop.sw,
        crop.sh,
        0,
        0,
        grid.cols,
        grid.rows,
      )

      let characters: string[]
      try {
        const pixels = samplerContext.getImageData(0, 0, grid.cols, grid.rows).data
        characters = rampGrid(luminanceGrid(pixels, grid.cols, grid.rows), currentRamp)
      } catch {
        // A cross-origin image taints the canvas and makes getImageData throw.
        // Nothing to enhance with, so leave the plain <img> in place.
        mode = 'static'
        setEnhanced(false)
        return
      }

      // --- ascii layer ---
      asciiLayer ??= document.createElement('canvas')
      asciiLayer.width = canvas!.width
      asciiLayer.height = canvas!.height
      const asciiContext = asciiLayer.getContext('2d')
      if (!asciiContext) return
      asciiContext.setTransform(dpr, 0, 0, dpr, 0, 0)
      asciiContext.fillStyle = ground
      asciiContext.fillRect(0, 0, cssWidth, cssHeight)

      // 0.82 of the cell height makes a typical monospace glyph's advance
      // width land almost exactly on the cell width at the default aspect.
      asciiContext.font = `${(grid.cellHeight * 0.82).toFixed(2)}px ${monoFamily}`
      asciiContext.fillStyle = ink
      asciiContext.textAlign = 'center'
      asciiContext.textBaseline = 'middle'

      for (let row = 0; row < grid.rows; row++) {
        const y = (row + 0.5) * grid.cellHeight
        for (let col = 0; col < grid.cols; col++) {
          const char = characters[row * grid.cols + col]
          if (!char || char === ' ') continue
          asciiContext.fillText(char, (col + 0.5) * grid.cellWidth, y)
        }
      }

      rect = container!.getBoundingClientRect()
      draw(performance.now())
      setEnhanced(true)
    }

    // ---- the per-frame draw ---------------------------------------------

    function draw(now: number): void {
      if (!context || !asciiLayer || !photoLayer || !grid) return

      const { innerRadius: inner, outerRadius: outer, exitEaseMs: easeMs, driftSpeed: drift } =
        paramsRef.current

      context.setTransform(dpr, 0, 0, dpr, 0, 0)
      context.globalCompositeOperation = 'source-over'
      context.clearRect(0, 0, cssWidth, cssHeight)
      context.drawImage(asciiLayer, 0, 0, cssWidth, cssHeight)

      // Where is the resolve point, and how strongly does it apply?
      let x = lastLocalX
      let y = lastLocalY
      let strength = 0

      if (mode === 'drift') {
        // Two sine waves at unrelated frequencies: the point wanders the box
        // without ever settling into an obvious repeating orbit.
        const t = (now / 1000) * drift
        x = cssWidth * (0.5 + 0.34 * Math.sin(t * 0.63))
        y = cssHeight * (0.5 + 0.3 * Math.sin(t * 0.41 + 1.3))
        strength = 1
      } else if (pointerInside) {
        x = lastLocalX
        y = lastLocalY
        strength = 1
      } else if (leftAt > 0) {
        strength = exitStrength(now - leftAt, easeMs)
      }

      if (strength > ALPHA_EPSILON) {
        const range = affectedCellRange(grid, x, y, outer)

        // Punch holes in the character layer, one cell at a time, with an
        // alpha equal to that cell's blend factor.
        context.globalCompositeOperation = 'destination-out'
        const outerSquared = outer * outer

        for (let row = range.fromRow; row < range.toRow; row++) {
          const cellY = row * grid.cellHeight
          const dy = cellY + grid.cellHeight / 2 - y
          const dySquared = dy * dy
          if (dySquared > outerSquared) continue

          for (let col = range.fromCol; col < range.toCol; col++) {
            const cellX = col * grid.cellWidth
            const dx = cellX + grid.cellWidth / 2 - x
            const distanceSquared = dx * dx + dySquared
            if (distanceSquared > outerSquared) continue

            const blend =
              blendFactor(Math.sqrt(distanceSquared), inner, outer) * strength
            if (blend <= ALPHA_EPSILON) continue

            context.fillStyle =
              ALPHA_STRINGS[Math.round(blend * ALPHA_STEPS)] ?? ALPHA_STRINGS[0]!
            // The half-pixel overdraw closes hairline seams between cells
            // that fractional cell sizes would otherwise leave behind.
            context.fillRect(
              cellX,
              cellY,
              grid.cellWidth + 0.5,
              grid.cellHeight + 0.5,
            )
          }
        }

        // Then slide the photograph in behind. It shows only through the
        // holes just punched, which is the crossfade.
        context.globalCompositeOperation = 'destination-over'
        context.drawImage(photoLayer, 0, 0, cssWidth, cssHeight)
        context.globalCompositeOperation = 'source-over'
      }
    }

    // ---- frame callback --------------------------------------------------

    function onFrame(now: number, fps: number): void {
      if (!visible) return

      if (mode === 'pointer') {
        // Treat the pointer as engaged slightly outside the box, so the
        // effect starts before the cursor crosses the edge instead of
        // popping on at the boundary.
        const margin = paramsRef.current.outerRadius
        const inside =
          pointerState.seen &&
          pointerState.x >= rect.left - margin &&
          pointerState.x <= rect.right + margin &&
          pointerState.y >= rect.top - margin &&
          pointerState.y <= rect.bottom + margin

        if (inside) {
          pointerInside = true
          lastLocalX = pointerState.x - rect.left
          lastLocalY = pointerState.y - rect.top
          leftAt = 0
        } else if (pointerInside) {
          pointerInside = false
          leftAt = now
        }

        // Nothing to redraw once the exit ease has fully played out.
        if (!pointerInside && leftAt > 0 && now - leftAt > paramsRef.current.exitEaseMs) {
          if (leftAt !== -1) {
            draw(now)
            leftAt = -1
          }
          return
        }
        if (!pointerInside && leftAt === -1) return
      }

      checkFrameRate(fps)
      draw(now)
    }

    /**
     * Runtime degradation. The decision itself lives in lib/ascii/degrade.ts
     * so it can be unit tested; this only applies the result.
     */
    function checkFrameRate(fps: number): void {
      const next = stepDegradation(
        { slowFrames, cellSize: activeCellSize },
        fps,
        MAX_CELL_SIZE,
      )
      slowFrames = next.slowFrames
      if (!next.coarsened) return

      activeCellSize = next.cellSize
      buildLayers()
      onDegradeRef.current?.(activeCellSize)
    }

    // ---- wiring ----------------------------------------------------------

    function attach(): void {
      if (unsubscribe || mode === 'static') return
      unsubscribe = subscribe(onFrame)
    }

    function detach(): void {
      unsubscribe?.()
      unsubscribe = null
    }

    function handleImageReady(): void {
      if (mode === 'static') return
      buildLayers()
      attach()
    }

    // Pause entirely when scrolled out of view. A header animating while the
    // reader is three screens down is wasted battery.
    const intersectionObserver = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (!entry) return
        visible = entry.isIntersecting
        if (visible) {
          rect = container.getBoundingClientRect()
          attach()
        } else {
          detach()
        }
      },
      { rootMargin: '100px' },
    )
    intersectionObserver.observe(container)

    // The cached rect goes stale on scroll and on resize. Recomputing it here
    // instead of inside the frame callback keeps a layout read out of the
    // animation path.
    const refreshRect = () => {
      rect = container.getBoundingClientRect()
    }
    window.addEventListener('scroll', refreshRect, { passive: true })
    window.addEventListener('resize', refreshRect, { passive: true })

    const resizeObserver = new ResizeObserver(() => {
      if (mode === 'static') return
      refreshRect()
      buildLayers()
    })
    resizeObserver.observe(container)

    const handleReducedMotionChange = () => {
      mode = selectRenderMode({
        supportsCanvas,
        prefersReducedMotion: reducedMotionQuery.matches,
        hasFinePointer: finePointerQuery.matches,
      })
      if (mode === 'static') {
        detach()
        setEnhanced(false)
      } else {
        buildLayers()
        attach()
      }
    }
    reducedMotionQuery.addEventListener('change', handleReducedMotionChange)
    finePointerQuery.addEventListener('change', handleReducedMotionChange)

    // A theme switch changes the ground, the ink and the ramp direction, all
    // of which are baked into the cached layers — so they have to be redrawn.
    const themeObserver = new MutationObserver(() => {
      if (mode === 'static') return
      readTheme()
      buildLayers()
    })
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    })

    if (mode !== 'static') {
      if (img.complete && img.naturalWidth > 0) {
        handleImageReady()
      } else {
        img.addEventListener('load', handleImageReady, { once: true })
      }
    }

    return () => {
      detach()
      intersectionObserver.disconnect()
      resizeObserver.disconnect()
      themeObserver.disconnect()
      window.removeEventListener('scroll', refreshRect)
      window.removeEventListener('resize', refreshRect)
      reducedMotionQuery.removeEventListener('change', handleReducedMotionChange)
      finePointerQuery.removeEventListener('change', handleReducedMotionChange)
      img.removeEventListener('load', handleImageReady)
    }
    // Rebuild from scratch only when the source or a structural parameter
    // changes. Radii and easing are read live from paramsRef, so dragging
    // those sliders never tears the effect down.
  }, [src, cellSize, cellAspect, ramp])

  return (
    <div ref={containerRef} className={`relative overflow-hidden ${className ?? ''}`}>
      {/* Server-rendered and real. If JS never runs, this is the page. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        className="block h-full w-full object-cover"
        draggable={false}
      />
      {/* Decorative: everything it conveys is already in the img's alt text. */}
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full"
        style={{ opacity: enhanced ? 1 : 0 }}
      />
    </div>
  )
}
