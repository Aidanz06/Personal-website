'use client'

import Image from 'next/image'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { parseCssColor } from '@/lib/ascii/color'
import { DEFAULT_RAMP } from '@/lib/ascii/constants'
import { gridDimensions } from '@/lib/ascii/grid'
import { luminance, luminanceGrid } from '@/lib/ascii/luminance'
import { orientRamp, rampGrid } from '@/lib/ascii/ramp'
import { fitWithin } from '@/lib/pond/photo'
import {
  DISSOLVE_MS,
  dissolveFrame,
  formatCounter,
  stepIndex,
  swipeDirection,
} from '@/lib/slideshow/transition'
import type { Slide } from '@/lib/slides'

/**
 * The slideshow's interactive half: one slide at a time, with the ASCII
 * dissolve between them.
 *
 * The slides themselves are plain <Image> elements, not canvas. That is
 * deliberate — a slide is a picture of text, and text has to be crisp, so the
 * canvas only appears for the three-quarters of a second a transition lasts
 * and then gets out of the way.
 */

/** Character cell width during a dissolve, in CSS pixels. */
const CELL_SIZE = 7
const CELL_ASPECT = 1.7

/**
 * How many groups the characters are split into.
 *
 * Fading one character layer in and out is a crossfade through some text. The
 * dissolve reads as a dissolve because the characters arrive in waves: each
 * band is a quarter of the cells, picked by a hash of their position, and
 * each band has its own window inside the transition. Four is enough to read
 * as scattered and cheap enough to be four drawImage calls a frame.
 */
const BANDS = 4

/** Deterministic per-cell noise, so the same slide always breaks up the same way. */
function cellNoise(col: number, row: number, seed: number): number {
  const h = Math.sin(col * 127.1 + row * 311.7 + seed * 74.7) * 43758.5453
  return h - Math.floor(h)
}

type AsciiBands = {
  /** One transparent canvas per band, characters only. */
  layers: HTMLCanvasElement[]
  width: number
  height: number
}

export function SlideshowViewer({ slides }: { slides: readonly Slide[] }) {
  const [index, setIndex] = useState(0)
  /** Non-null only while a dissolve is running. */
  const [transition, setTransition] = useState<{ from: number; to: number } | null>(null)

  const containerRef = useRef<HTMLDivElement | null>(null)
  const stageRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const imagesRef = useRef(new Map<number, HTMLImageElement>())
  const bandsRef = useRef(new Map<number, AsciiBands>())
  const frameRef = useRef<number | null>(null)
  const pointerRef = useRef<{ x: number; y: number } | null>(null)

  const count = slides.length
  const first = slides[0]!
  const current = slides[index]!

  // The stage keeps the first slide's shape for the whole deck. A stage that
  // resized per slide would reflow the page mid-transition, and a deck is
  // almost always one shape anyway — an odd slide letterboxes instead.
  const stageAspect = `${first.width} / ${first.height}`

  // Only the slide either side of the current one is mounted. That is what
  // makes "preload the next slide" true: mounting all twelve would have the
  // browser fetch every one of them the moment the section scrolls into view.
  const mounted = useMemo(() => {
    const window = new Set<number>()
    for (const i of [index - 1, index, index + 1]) {
      if (i >= 0 && i < count) window.add(i)
    }
    if (transition) {
      window.add(transition.from)
      window.add(transition.to)
    }
    return window
  }, [index, count, transition])

  /**
   * Split one slide into its character bands, at the stage's current size.
   *
   * Cached per slide and thrown away on resize. Each band is transparent with
   * only its own share of the characters drawn into it, which is what lets
   * the frame loop stagger them with nothing but four alpha values.
   */
  const buildBands = useCallback(
    (slideIndex: number, cssWidth: number, cssHeight: number): AsciiBands | null => {
      const cached = bandsRef.current.get(slideIndex)
      if (cached && cached.width === cssWidth && cached.height === cssHeight) return cached

      const image = imagesRef.current.get(slideIndex)
      const stage = stageRef.current
      if (!image || !stage || !image.complete || image.naturalWidth === 0) return null

      const styles = getComputedStyle(stage)
      const groundRgb = parseCssColor(styles.getPropertyValue('--color-ground').trim())
      const inkRgb = parseCssColor(styles.getPropertyValue('--color-ink').trim())
      const ink = inkRgb ? `rgb(${inkRgb.join(',')})` : '#ece7dd'
      const ramp = orientRamp(
        DEFAULT_RAMP,
        groundRgb ? luminance(...groundRgb) : 0,
        inkRgb ? luminance(...inkRgb) : 1,
      )
      const mono = styles.getPropertyValue('--font-mono').trim() || 'ui-monospace, monospace'

      const grid = gridDimensions(cssWidth, cssHeight, CELL_SIZE, CELL_ASPECT)

      // Where the slide actually sits inside the stage. The <img> is
      // object-fit: contain, so a slide of a different shape is letterboxed —
      // and the characters have to be letterboxed the same way or they will
      // not line up with the picture they are replacing.
      const fitted = fitWithin(image.naturalWidth / image.naturalHeight, cssWidth, cssHeight)
      const offsetX = (cssWidth - fitted.width) / 2
      const offsetY = (cssHeight - fitted.height) / 2

      const sampler = document.createElement('canvas')
      sampler.width = grid.cols
      sampler.height = grid.rows
      const samplerContext = sampler.getContext('2d', { willReadFrequently: true })
      if (!samplerContext) return null
      samplerContext.imageSmoothingEnabled = true
      samplerContext.imageSmoothingQuality = 'high'
      samplerContext.drawImage(
        image,
        (offsetX / cssWidth) * grid.cols,
        (offsetY / cssHeight) * grid.rows,
        (fitted.width / cssWidth) * grid.cols,
        (fitted.height / cssHeight) * grid.rows,
      )

      let characters: string[]
      try {
        const pixels = samplerContext.getImageData(0, 0, grid.cols, grid.rows).data
        characters = rampGrid(luminanceGrid(pixels, grid.cols, grid.rows), ramp)
      } catch {
        // Only possible if a slide ever became cross-origin. The caller falls
        // back to a plain crossfade.
        return null
      }

      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const layers = Array.from({ length: BANDS }, () => {
        const layer = document.createElement('canvas')
        layer.width = Math.round(cssWidth * dpr)
        layer.height = Math.round(cssHeight * dpr)
        const layerContext = layer.getContext('2d')
        if (layerContext) {
          layerContext.setTransform(dpr, 0, 0, dpr, 0, 0)
          layerContext.font = `${(grid.cellHeight * 0.82).toFixed(2)}px ${mono}`
          layerContext.fillStyle = ink
          layerContext.textAlign = 'center'
          layerContext.textBaseline = 'middle'
        }
        return layer
      })
      const contexts = layers.map((layer) => layer.getContext('2d'))

      for (let row = 0; row < grid.rows; row++) {
        const y = (row + 0.5) * grid.cellHeight
        for (let col = 0; col < grid.cols; col++) {
          const char = characters[row * grid.cols + col]
          if (!char || char === ' ') continue
          const band = Math.min(
            BANDS - 1,
            Math.floor(cellNoise(col, row, slideIndex + 1) * BANDS),
          )
          contexts[band]?.fillText(char, (col + 0.5) * grid.cellWidth, y)
        }
      }

      const built = { layers, width: cssWidth, height: cssHeight }
      bandsRef.current.set(slideIndex, built)
      return built
    },
    [],
  )

  /** Draw one frame of a dissolve. */
  const paint = useCallback(
    (from: number, to: number, t: number) => {
      const canvas = canvasRef.current
      const stage = stageRef.current
      if (!canvas || !stage) return false

      const cssWidth = stage.clientWidth
      const cssHeight = stage.clientHeight
      if (cssWidth <= 0 || cssHeight <= 0) return false

      const context = canvas.getContext('2d')
      if (!context) return false

      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const pixelWidth = Math.round(cssWidth * dpr)
      const pixelHeight = Math.round(cssHeight * dpr)
      if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
        canvas.width = pixelWidth
        canvas.height = pixelHeight
      }

      const frame = dissolveFrame(t)
      const sourceIndex = frame.source === 'from' ? from : to
      const bands = buildBands(sourceIndex, cssWidth, cssHeight)
      if (!bands) return false

      const image = imagesRef.current.get(sourceIndex)
      const ground =
        getComputedStyle(stage).getPropertyValue('--color-ground').trim() || '#0b100f'

      context.setTransform(dpr, 0, 0, dpr, 0, 0)
      context.globalAlpha = 1
      context.fillStyle = ground
      context.fillRect(0, 0, cssWidth, cssHeight)

      if (image && image.naturalWidth > 0) {
        const fitted = fitWithin(
          image.naturalWidth / image.naturalHeight,
          cssWidth,
          cssHeight,
        )
        context.drawImage(
          image,
          (cssWidth - fitted.width) / 2,
          (cssHeight - fitted.height) / 2,
          fitted.width,
          fitted.height,
        )
      }

      // The ground veils the picture evenly, then the character bands arrive
      // in waves on top of it.
      context.globalAlpha = frame.ascii
      context.fillStyle = ground
      context.fillRect(0, 0, cssWidth, cssHeight)

      bands.layers.forEach((layer, band) => {
        const alpha = frame.ascii * BANDS - band
        if (alpha <= 0.01) return
        context.globalAlpha = alpha > 1 ? 1 : alpha
        context.drawImage(layer, 0, 0, cssWidth, cssHeight)
      })

      context.globalAlpha = 1
      return true
    },
    [buildBands],
  )

  const go = useCallback(
    (delta: number) => {
      const next = stepIndex(index, delta, count)
      if (next === index) return

      const instant =
        typeof window === 'undefined' ||
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
      if (instant) {
        setIndex(next)
        return
      }

      const from = index
      setIndex(next)
      setTransition({ from, to: next })
    },
    [index, count],
  )

  // Run the dissolve. It lives in an effect rather than inside `go` so that
  // the incoming slide is mounted — and therefore decodable — before the
  // first frame is drawn.
  useEffect(() => {
    if (!transition) return
    const { from, to } = transition
    const started = performance.now()

    // If anything about the canvas path fails, the images underneath are
    // already crossfading in CSS, so dropping out of it looks like a plain
    // crossfade rather than like a bug.
    if (!paint(from, to, 0)) {
      setTransition(null)
      return
    }

    const tick = (now: number) => {
      const t = (now - started) / DISSOLVE_MS
      if (t >= 1 || !paint(from, to, t)) {
        setTransition(null)
        return
      }
      frameRef.current = requestAnimationFrame(tick)
    }
    frameRef.current = requestAnimationFrame(tick)

    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
      frameRef.current = null
    }
  }, [transition, paint])

  // Cached character layers are sized to the stage and painted in the
  // theme's ink, so a resize or a theme change invalidates every one of them.
  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    const invalidate = () => bandsRef.current.clear()

    const resize = new ResizeObserver(invalidate)
    resize.observe(stage)

    const themeChange = new MutationObserver(invalidate)
    themeChange.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    })

    return () => {
      resize.disconnect()
      themeChange.disconnect()
    }
  }, [])

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'ArrowRight') {
      event.preventDefault()
      go(1)
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault()
      go(-1)
    }
  }

  return (
    <div
      ref={containerRef}
      className="slideshow-js breakout my-4"
      role="group"
      aria-roledescription="slideshow"
      aria-label="tailor studio, slide by slide"
      onKeyDown={onKeyDown}
    >
      <div
        ref={stageRef}
        tabIndex={0}
        aria-label="slides. use the left and right arrow keys."
        className="relative w-full touch-pan-y select-none"
        style={{ aspectRatio: stageAspect }}
        onPointerDown={(event) => {
          pointerRef.current = { x: event.clientX, y: event.clientY }
        }}
        onPointerUp={(event) => {
          const start = pointerRef.current
          pointerRef.current = null
          if (!start) return
          const direction = swipeDirection(
            event.clientX - start.x,
            event.clientY - start.y,
          )
          if (direction !== 0) go(direction)
        }}
        onPointerCancel={() => {
          pointerRef.current = null
        }}
      >
        {slides.map((slide, i) =>
          mounted.has(i) ? (
            <Image
              key={slide.file}
              ref={(node) => {
                if (node) imagesRef.current.set(i, node)
                else imagesRef.current.delete(i)
              }}
              src={slide.src}
              alt={i === index ? slide.alt : ''}
              fill
              sizes="(max-width: 1000px) 100vw, 960px"
              loading={i === index ? 'eager' : 'lazy'}
              aria-hidden={i === index ? undefined : true}
              className="object-contain transition-opacity duration-300"
              style={{ opacity: i === index ? 1 : 0 }}
            />
          ) : null,
        )}

        {/* Only present during a transition. Decorative: whatever it shows is
            a halfway state between two slides that both have alt text. */}
        <canvas
          ref={canvasRef}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full"
          style={{ opacity: transition ? 1 : 0 }}
        />
      </div>

      <div className="mt-1 flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => go(-1)}
          disabled={index === 0}
          className="hit-area font-mono text-small text-muted disabled:opacity-40"
          aria-label="previous slide"
        >
          ←
        </button>
        <button
          type="button"
          onClick={() => go(1)}
          disabled={index === count - 1}
          className="hit-area font-mono text-small text-muted disabled:opacity-40"
          aria-label="next slide"
        >
          →
        </button>
        <span className="font-mono text-small text-muted" aria-hidden="true">
          {formatCounter(index, count)}
        </span>
        {/* The counter alone announces "02 / 03", which tells a screen reader
            user that something moved but not what it moved to. Slides are
            pictures of text, so the description is the content. */}
        <span className="sr-only" aria-live="polite">
          {`slide ${index + 1} of ${count}. ${current.alt}`}
        </span>
      </div>

      {/* Slides are pictures of text, so a missing or unchecked description is
          a content bug. It is shown rather than hidden in the markup. */}
      {current.missing ? (
        <p className="mt-0.5 font-mono text-small text-muted">{current.alt}</p>
      ) : current.draft ? (
        <p className="mt-0.5 font-mono text-small text-muted">
          [draft alt — aidan to check] {current.alt}
        </p>
      ) : null}
    </div>
  )
}
