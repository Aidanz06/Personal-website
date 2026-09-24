import type { CSSProperties } from 'react'
import { bubbleField } from '@/lib/pond/bubbles'

/**
 * Bubbles rising through the water between the navigation and the gallery:
 * a hint that the pond goes deeper, with no arrow and no words.
 *
 * Pure CSS once rendered (see `.bubble` in globals.css), so it runs with
 * JavaScript off and costs the canvas nothing. Hidden under reduced motion,
 * and aria-hidden throughout: it's decoration, not content.
 *
 * `top` and `height` are CSS lengths for the stretch of water they rise
 * through; each bubble rises the full height.
 */
export function Bubbles({ top, height }: { top: string; height: string }) {
  return (
    <div
      aria-hidden="true"
      className="column pointer-events-none absolute inset-x-0"
      style={{ top, height }}
    >
      <div className="relative h-full">
        {bubbleField().map((bubble, index) => (
          <span
            key={index}
            className="bubble absolute bottom-0 font-mono leading-none text-muted"
            style={
              {
                left: `${(bubble.xFraction * 100).toFixed(2)}%`,
                fontSize: `${bubble.size}px`,
                '--rise': height,
                '--sway': `${bubble.sway.toFixed(1)}px`,
                '--duration': `${bubble.duration.toFixed(2)}s`,
                '--delay': `${bubble.delay.toFixed(2)}s`,
              } as CSSProperties
            }
          >
            {bubble.glyph}
          </span>
        ))}
      </div>
    </div>
  )
}
