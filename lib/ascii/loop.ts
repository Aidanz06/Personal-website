/**
 * One requestAnimationFrame loop and one pointer listener for the whole page,
 * however many <AsciiImage> instances are mounted.
 *
 * Why this is a module-level singleton rather than a hook per component:
 * every instance animating on its own rAF loop means N callbacks per frame
 * and N pointermove listeners, and — worse — the browser cannot coalesce
 * them, so instances drift out of step with each other. The photography grid
 * in v1 will put 12 to 20 instances on one page, which is exactly where that
 * falls over.
 *
 * The pointer position is WRITTEN on move and READ on the frame. Pointer
 * events fire far more often than 60Hz on a high-polling-rate mouse, so
 * doing work inside the move handler would mean redrawing several times per
 * displayed frame, most of it discarded.
 */

export type FrameCallback = (now: number, fps: number) => void

const subscribers = new Set<FrameCallback>()

/** Pointer position in CLIENT coordinates; each instance maps it to its own box. */
export const pointerState = {
  x: 0,
  y: 0,
  /** False until the pointer has actually moved at least once. */
  seen: false,
}

let rafId: number | null = null
let lastFrameTime = 0
let fps = 60
let listenersAttached = false

function handlePointerMove(event: PointerEvent): void {
  pointerState.x = event.clientX
  pointerState.y = event.clientY
  pointerState.seen = true
}

function handleVisibilityChange(): void {
  if (document.hidden) {
    stop()
  } else if (subscribers.size > 0) {
    start()
  }
}

function attachListeners(): void {
  if (listenersAttached) return
  listenersAttached = true
  window.addEventListener('pointermove', handlePointerMove, { passive: true })
  document.addEventListener('visibilitychange', handleVisibilityChange)
}

function detachListeners(): void {
  if (!listenersAttached) return
  listenersAttached = false
  window.removeEventListener('pointermove', handlePointerMove)
  document.removeEventListener('visibilitychange', handleVisibilityChange)
}

function tick(now: number): void {
  rafId = requestAnimationFrame(tick)

  const delta = now - lastFrameTime
  lastFrameTime = now

  // Ignore the first frame and any gap long enough to be a stall (a
  // backgrounded tab, a long task) — neither says anything about how fast
  // this page actually renders, and folding them in would trigger the
  // degradation path for the wrong reason.
  if (delta > 0 && delta < 250) {
    // Exponential moving average: smooth enough that one slow frame does not
    // coarsen the grid, responsive enough to catch a sustained problem.
    fps += (1000 / delta - fps) * 0.1
  }

  for (const callback of subscribers) callback(now, fps)
}

function start(): void {
  if (rafId !== null) return
  lastFrameTime = performance.now()
  rafId = requestAnimationFrame(tick)
}

function stop(): void {
  if (rafId === null) return
  cancelAnimationFrame(rafId)
  rafId = null
}

export function subscribe(callback: FrameCallback): () => void {
  attachListeners()
  subscribers.add(callback)
  if (!document.hidden) start()

  return () => {
    subscribers.delete(callback)
    if (subscribers.size === 0) {
      stop()
      detachListeners()
    }
  }
}

/** Current smoothed frame rate. Exposed for the runtime degradation check. */
export function currentFps(): number {
  return fps
}

/** Test seam: reset module state between runs. */
export function resetLoopForTesting(): void {
  subscribers.clear()
  stop()
  detachListeners()
  fps = 60
  pointerState.x = 0
  pointerState.y = 0
  pointerState.seen = false
}
