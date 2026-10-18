'use client'

import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import { createPortal } from 'react-dom'
import { reportFeeding } from '@/lib/feedClient'
import {
  BUCKET,
  BUCKET_MOUTH_Y,
  BUCKET_RIM_FRONT_Y,
  BUCKET_SIZE_CSS,
  BUCKET_VIEWBOX,
} from '@/lib/pond/bucket'
import { OPEN_SOMETHING, isWaterTarget, requestFeedAt } from '@/lib/pond/food'
import { HAND_FINGERTIPS_Y, HAND_VIEWBOX, handPaths } from '@/lib/pond/hand'
import { HAND_WIDTH, carrying, handPose, type HandMotion, type Point } from '@/lib/pond/handMotion'
import { requestSplashAt } from '@/lib/pond/splash'

/**
 * The bucket of koi food, and the hand that carries it to the water.
 *
 * Click the bucket and a hand comes down into it, curls round a pellet and
 * lifts it out; it follows the pointer (the cursor steps aside for it), and
 * a click on open water opens it, the pellet falls, and the koi comes to
 * eat. Clicking the bucket again, or Esc, takes the food back. One grab is
 * one piece of food, and one feeding on today's count.
 *
 * The bucket and the hand are a pair of line drawings in the site's
 * hairline, filled with the ground so they are solid over the water. The
 * bucket floats, bobbing slowly, and the pond rings around it (see
 * lib/pond/bucket.ts); it gives a little when the hand reaches in. The hand
 * fades out toward the wrist, and below the bucket's rim it is out of sight,
 * inside the bucket.
 *
 * The hand follows its pose (lib/pond/handMotion.ts) on a spring, and swings
 * from the wrist on a looser one, which is what makes it move like a hand
 * rather than a cursor. It is moved by writing styles straight to the
 * elements each frame, so it never re-renders React.
 *
 * On a touchscreen there is nothing to follow between taps, so the hand
 * waits and glides to wherever the water is tapped. From the keyboard it
 * does the whole trip on its own, to the open water beside the bucket.
 * Under reduced motion there is no feeding at all (the pond is a still
 * picture, and the fish could never come), and without JavaScript the
 * button is not shown, because it could do nothing.
 */

/** How quickly the hand catches up with its pose. Higher is tighter. */
const FOLLOW = 30
/** The wrist: looser, and a little under-damped, so the swing settles. */
const SWING = 13
const SWING_DAMPING = 0.5
/** Size of the falling pellet, in pixels. */
const PELLET_PX = 5

type Spring = { x: number; y: number; vx: number; vy: number; angle: number; spin: number; at: number }

const IDLE: HandMotion = { phase: 'idle', startedAt: 0, from: null, to: null, mouth: null, rimFront: null }

/** Drop food at a point on screen and count it. */
function feed({ x, y }: Point): void {
  requestFeedAt(x, y)
  reportFeeding()
}

export function FoodBucket({ depthVh }: { depthVh: string }) {
  const [holding, setHolding] = useState(false)
  const [mounted, setMounted] = useState(false)
  const handRef = useRef<HTMLDivElement | null>(null)
  const pelletRef = useRef<SVGSVGElement | null>(null)
  const bucketRef = useRef<SVGSVGElement | null>(null)
  const motion = useRef<HandMotion>(IDLE)
  const pointer = useRef<Point & { mouse: boolean }>({ x: 0, y: 0, mouse: true })
  const frame = useRef<number | null>(null)
  // Where the fingertips are and how fast they're going, and the swing of
  // the wrist. `null` until the hand is first placed.
  const spring = useRef<Spring | null>(null)
  const fed = useRef(false)
  const lastMask = useRef('')

  // Portalled to <body>: a page transition puts a transform on the page,
  // and a fixed element inside a transform is fixed to that, not the screen.
  useEffect(() => setMounted(true), [])

  /** Where the hand reaches into the bucket, on screen right now. */
  function bucketMouth(): { mouth: Point; rimFront: number } | null {
    const svg = bucketRef.current
    if (!svg) return null
    const box = svg.getBoundingClientRect()
    const unit = box.height / BUCKET_VIEWBOX
    return {
      mouth: { x: box.left + box.width / 2, y: box.top + BUCKET_MOUTH_Y * unit },
      rimFront: box.top + BUCKET_RIM_FRONT_Y * unit,
    }
  }

  function start(phase: HandMotion['phase'], to: Point | null = null) {
    const s = spring.current
    const at = bucketMouth()
    motion.current = {
      phase,
      startedAt: performance.now(),
      from: s ? { x: s.x, y: s.y } : carrying(pointer.current),
      to,
      mouth: at?.mouth ?? null,
      rimFront: at?.rimFront ?? null,
    }
    fed.current = false
    if (frame.current === null) frame.current = requestAnimationFrame(tick)
  }

  function finish() {
    motion.current = IDLE
    spring.current = null
    if (handRef.current) handRef.current.style.opacity = '0'
    if (pelletRef.current) pelletRef.current.style.opacity = '0'
    if (bucketRef.current) bucketRef.current.style.transform = ''
    document.documentElement.classList.remove('holding-food')
    setHolding(false)
  }

  function tick(now: number) {
    frame.current = null
    const hand = handRef.current
    const m = motion.current
    if (!hand || m.phase === 'idle') return
    const pose = handPose(m, now, pointer.current)
    if (pose.done) {
      if (m.phase === 'grabbing') {
        motion.current = { ...m, phase: 'holding', startedAt: now }
        // The keyboard has no pointer to follow: carry the food to the
        // water straight away.
        if (m.to) start('releasing', m.to)
      } else if (m.phase === 'releasing' || m.phase === 'returning') {
        finish()
        return
      }
    }
    if (pose.feed && !fed.current && m.to) {
      fed.current = true
      feed(m.to)
    }
    if (pose.cursorBack) document.documentElement.classList.remove('holding-food')

    // --- the springs ----------------------------------------------------
    let s = spring.current
    if (!s) s = spring.current = { x: pose.x, y: pose.y, vx: 0, vy: 0, angle: 0, spin: 0, at: now }
    const dt = Math.min(1 / 30, Math.max(0, (now - s.at) / 1000))
    s.at = now
    // Critically damped: catches up without overshooting the pointer.
    s.vx += (FOLLOW * FOLLOW * (pose.x - s.x) - 2 * FOLLOW * s.vx) * dt
    s.vy += (FOLLOW * FOLLOW * (pose.y - s.y) - 2 * FOLLOW * s.vy) * dt
    s.x += s.vx * dt
    s.y += s.vy * dt
    // The fingers trail the way it's moving, from the wrist, and swing a
    // little past straight when it stops.
    const lean = Math.max(-18, Math.min(18, s.vx * 0.022)) + pose.twist
    s.spin += (SWING * SWING * (lean - s.angle) - 2 * SWING_DAMPING * SWING * s.spin) * dt
    s.angle += s.spin * dt

    // --- the hand -------------------------------------------------------
    const scale = HAND_WIDTH / 24
    const left = s.x - 12 * scale
    const top = s.y - HAND_FINGERTIPS_Y * scale
    hand.style.opacity = pose.opacity.toFixed(3)
    hand.style.transform = `translate(${left.toFixed(1)}px, ${top.toFixed(1)}px) rotate(${s.angle.toFixed(2)}deg)`
    // Faded toward the wrist; inside the bucket, cut off at the rim.
    const wrist = (HAND_FINGERTIPS_Y * scale * 0.34).toFixed(0)
    const mask =
      pose.cut === null
        ? `linear-gradient(transparent, #000 ${wrist}px)`
        : `linear-gradient(transparent, #000 ${wrist}px, #000 ${(pose.cut - top).toFixed(1)}px, transparent ${(pose.cut - top + 1.5).toFixed(1)}px)`
    if (mask !== lastMask.current) {
      lastMask.current = mask
      hand.style.maskImage = mask
      hand.style.webkitMaskImage = mask
    }
    const paths = handPaths(pose.open)
    hand.querySelectorAll<SVGPathElement>('path[data-part]').forEach((path) => {
      const part = path.dataset.part!
      const shape =
        part === 'thumb'
          ? paths.thumb
          : part === 'back-fill'
            ? paths.backFill
            : part === 'back-line'
              ? paths.backLine
              : paths.fingers[Number(part)]!
      path.setAttribute('d', shape.d)
      if (shape.transform) path.setAttribute('transform', shape.transform)
    })
    const held = hand.querySelector<SVGCircleElement>('[data-pellet]')
    if (held) held.style.opacity = pose.fall === null ? paths.pellet.toFixed(3) : '0'

    // --- the pellet, once it's let go -----------------------------------
    // Falls from the fist to the spot clicked, speeding up as it goes and
    // getting smaller as it meets the water.
    const pellet = pelletRef.current
    if (pellet) {
      if (pose.fall === null || !m.to) pellet.style.opacity = '0'
      else {
        const fall = pose.fall * pose.fall
        const fromY = top + 17.2 * scale
        const y = fromY + (m.to.y - fromY) * fall
        const x = s.x + (m.to.x - s.x) * fall
        pellet.style.opacity = '1'
        pellet.style.transform = `translate(${(x - PELLET_PX / 2).toFixed(1)}px, ${(y - PELLET_PX / 2).toFixed(1)}px) scale(${(1 - 0.45 * fall).toFixed(3)})`
      }
    }

    // --- the bucket, giving under the hand ------------------------------
    if (bucketRef.current) {
      bucketRef.current.style.transform = pose.bucketDip ? `translateY(${pose.bucketDip.toFixed(2)}px)` : ''
    }

    frame.current = requestAnimationFrame(tick)
  }

  // --- the pointer, and the click on the water ---------------------------
  useEffect(() => {
    function move(event: PointerEvent) {
      pointer.current = { x: event.clientX, y: event.clientY, mouse: event.pointerType === 'mouse' }
      if (motion.current.phase !== 'idle' && frame.current === null) {
        frame.current = requestAnimationFrame(tick)
      }
    }
    // Was something open when this tap began? Checked on pointerdown,
    // because by the click it has already been closed by that same tap.
    let closing = false
    function down(event: PointerEvent) {
      closing = document.querySelector(OPEN_SOMETHING) !== null
      move(event)
    }
    function click(event: MouseEvent) {
      const phase = motion.current.phase
      if (phase !== 'holding' && phase !== 'grabbing') return
      if (closing || event.button !== 0) return
      const target = event.target instanceof Element ? event.target : null
      if (!isWaterTarget(target)) return
      if (!(window.getSelection()?.isCollapsed ?? true)) return
      const to = { x: event.clientX, y: event.clientY }
      // Still lifting the food out: drop it there as soon as it's out.
      if (phase === 'grabbing') motion.current = { ...motion.current, to }
      else start('releasing', to)
    }
    function key(event: KeyboardEvent) {
      const phase = motion.current.phase
      if (event.key === 'Escape' && (phase === 'holding' || phase === 'grabbing')) start('returning')
    }
    window.addEventListener('pointermove', move, { passive: true })
    document.addEventListener('pointerdown', down, true)
    document.addEventListener('click', click)
    window.addEventListener('keydown', key)
    return () => {
      window.removeEventListener('pointermove', move)
      document.removeEventListener('pointerdown', down, true)
      document.removeEventListener('click', click)
      window.removeEventListener('keydown', key)
      if (frame.current !== null) cancelAnimationFrame(frame.current)
      document.documentElement.classList.remove('holding-food')
    }
    // tick reads only refs, so the listeners never need replacing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function onBucket(event: ReactMouseEvent<HTMLButtonElement>) {
    const phase = motion.current.phase
    // Clicking the bucket with food in hand puts it back.
    if (phase === 'holding') {
      start('returning')
      return
    }
    if (phase !== 'idle') return
    setHolding(true)
    const at = bucketMouth()
    if (at) requestSplashAt(at.mouth.x / window.innerWidth, at.mouth.y / window.innerHeight, 0.3)
    // A keyboard press has no position (detail is 0): the hand comes from
    // above the bucket and carries the food to the water beside it.
    if (event.detail === 0) {
      const box = event.currentTarget.getBoundingClientRect()
      pointer.current = { x: box.left + box.width / 2, y: box.top, mouse: false }
      start('grabbing', { x: Math.max(40, box.left - box.width * 2.5), y: box.top + box.height })
      return
    }
    pointer.current = { x: event.clientX, y: event.clientY, mouse: pointer.current.mouse }
    if (pointer.current.mouse) document.documentElement.classList.add('holding-food')
    start('grabbing')
  }

  const paths = handPaths(1)
  const scale = HAND_WIDTH / 24

  return (
    <>
      <button
        type="button"
        className="food-bucket group absolute block cursor-pointer"
        style={{
          left: `${BUCKET.xFraction * 100}%`,
          top: depthVh,
          width: BUCKET_SIZE_CSS,
          height: BUCKET_SIZE_CSS,
          transform: 'translate(-50%, -50%)',
        }}
        aria-describedby="food-bucket-hint"
        onClick={onBucket}
      >
        {/* Floats: bobs and rocks a little, slowly. */}
        <span className="bucket-float block h-full w-full">
          <svg
            ref={bucketRef}
            viewBox={`0 0 ${BUCKET_VIEWBOX} ${BUCKET_VIEWBOX}`}
            className="block h-full w-full text-muted transition-colors duration-200 group-hover:text-ink group-focus-visible:text-ink"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.1}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            {/* The handle, a thin bail over the top. */}
            <path d="M5.4 12.2 C 5.6 1.2 26.4 1.2 26.6 12.2" strokeWidth={0.9} />
            {/* The body, tapering to a rounded base, and its hoop. */}
            <path d="M5 12 L 8 27.4 A 8 2.3 0 0 0 24 27.4 L 27 12" className="fill-ground" />
            <path d="M6.5 19.6 A 9.6 2.6 0 0 0 25.5 19.6" />
            {/* The rim, and the food heaped inside it. */}
            <ellipse cx="16" cy="12" rx="11" ry="3.1" className="fill-ground" />
            <g fill="currentColor" stroke="none">
              <circle cx="11.6" cy="12.2" r=".85" />
              <circle cx="14.6" cy="11.1" r=".85" />
              <circle cx="17.4" cy="12.6" r=".85" />
              <circle cx="20.4" cy="11.5" r=".85" />
              <circle cx="15.8" cy="13.4" r=".7" />
              <circle cx="9" cy="11.6" r=".7" />
              <circle cx="22.6" cy="12.4" r=".7" />
            </g>
          </svg>
        </span>
        {/* Below the bucket, like a stone's label. On a phone the bucket is
            near the right edge, so the label lines up with its right side
            instead of centring and running off the screen. */}
        <span className="absolute top-full left-1/2 w-max -translate-x-1/2 pt-1.5 text-center font-mono text-small text-muted max-sm:right-0 max-sm:left-auto max-sm:translate-x-0 max-sm:text-right">
          <span className="block text-ink group-hover:text-accent group-focus-visible:text-accent">
            feed the koi
          </span>
          <span id="food-bucket-hint" className="block" aria-live="polite">
            {holding ? 'drop it in the water' : 'grab some food'}
          </span>
        </span>
      </button>
      <noscript dangerouslySetInnerHTML={{ __html: '<style>.food-bucket{display:none}</style>' }} />

      {mounted &&
        createPortal(
          <>
            <div
              ref={handRef}
              aria-hidden="true"
              className="pointer-events-none fixed top-0 left-0 z-50 text-ink"
              style={{ width: HAND_WIDTH, opacity: 0, transformOrigin: '50% 0', willChange: 'transform' }}
            >
              <svg
                viewBox={HAND_VIEWBOX}
                width={HAND_WIDTH}
                height={26 * scale}
                fill="none"
                stroke="currentColor"
                strokeWidth={0.85}
                strokeLinecap="round"
                strokeLinejoin="round"
                overflow="visible"
                className="block"
              >
                {/* The pellet in the fist, peeking out below the fingers. */}
                <circle data-pellet cx="11" cy="17.2" r="1.2" fill="currentColor" stroke="none" style={{ opacity: 0 }} />
                {paths.fingers.map((finger, index) => (
                  <path key={index} data-part={index} d={finger.d} transform={finger.transform} className="fill-ground" />
                ))}
                <path data-part="thumb" d={paths.thumb.d} className="fill-ground" />
                <path data-part="back-fill" d={paths.backFill.d} className="fill-ground" stroke="none" />
                <path data-part="back-line" d={paths.backLine.d} />
              </svg>
            </div>
            {/* The pellet as it falls, free of the hand. */}
            <svg
              ref={pelletRef}
              aria-hidden="true"
              className="pointer-events-none fixed top-0 left-0 z-50 text-ink"
              width={PELLET_PX}
              height={PELLET_PX}
              viewBox="0 0 2 2"
              style={{ opacity: 0 }}
            >
              <circle cx="1" cy="1" r="1" fill="currentColor" />
            </svg>
          </>,
          document.body,
        )}
    </>
  )
}
