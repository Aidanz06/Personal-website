import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(join(process.cwd(), 'app', 'globals.css'), 'utf8')

/** Every `@keyframes` block, by name. Inner braces are indented; the outer closer is not. */
const keyframes = [...css.matchAll(/@keyframes\s+([\w-]+)\s*\{([\s\S]*?)\n\}/g)].map(
  ([, name, body]) => ({ name: name!, body: body! }),
)

/** Selectors that attach a given animation. */
function selectorsUsing(name: string): string[] {
  const rules = [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)]
  return rules
    .filter(([, , body]) => new RegExp(`animation:[^;]*\\b${name}\\b`).test(body ?? ''))
    .map(([, selector]) => selector!.trim().replace(/\s+/g, ' '))
}

describe('the page-change animation', () => {
  it('moves something, or it is not an animation', () => {
    const moving = keyframes.filter((frame) => /transform\s*:/.test(frame.body))
    expect(moving.length).toBeGreaterThan(0)
  })

  /**
   * The bug this exists for.
   *
   * Any `transform` other than `none` makes an element the containing block
   * for its `position: fixed` descendants. The pond is a `fixed inset-0`
   * canvas, and the page-change animation was applied to a wrapper around the
   * whole page — so for the 480ms it ran, `inset-0` resolved to a box 737
   * viewport-heights tall instead of to the viewport.
   *
   * The canvas then placed the stones at `documentHeight * depthVh` while the
   * real links stayed at `viewportHeight * depthVh`, and the drawn stones and
   * their labels ended up nowhere near each other.
   *
   * So a moving animation may only be attached to `main`, which is a SIBLING
   * of the pond container in both layouts, never to an ancestor of it.
   */
  it('never puts a transform on an ancestor of the fixed pond', () => {
    for (const frame of keyframes) {
      if (!/transform\s*:/.test(frame.body)) continue
      const selectors = selectorsUsing(frame.name)
      expect(selectors.length, `nothing uses @keyframes ${frame.name}`).toBeGreaterThan(0)
      for (const selector of selectors) {
        expect(selector, `@keyframes ${frame.name} is attached to "${selector}"`)
          .toContain('> main')
      }
    }
  })

  /**
   * The second half of the same bug, found building /listening.
   *
   * Moving the animation to `main` kept the pond out of it — but the photo
   * captions are `position: fixed` too, and they live INSIDE main. With
   * `animation-fill-mode: both` the finished animation holds its last
   * keyframe forever, and a held `transform: none` is computed as
   * `matrix(1, 0, 0, 1, 0, 0)` — an identity, but not `none`. So main stayed
   * the containing block for every fixed caption, and each one was placed
   * relative to the top of the document instead of the viewport: measured at
   * 609px above the top of the screen on the homepage, 413px on /listening.
   *
   * `backwards` fills only before the animation starts. When it ends, the
   * element falls back to its own style — opacity 1, no transform, which is
   * exactly the last keyframe — so it looks identical and leaves nothing
   * behind.
   */
  it('does not hold a transform after it has finished', () => {
    for (const frame of keyframes) {
      if (!/transform\s*:/.test(frame.body)) continue
      const rules = [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)].filter(([, , body]) =>
        new RegExp(`animation:[^;]*\\b${frame.name}\\b`).test(body ?? ''),
      )
      for (const [, selector, body] of rules) {
        const declaration = /animation:([^;]*)/.exec(body ?? '')?.[1] ?? ''
        const fill = /animation-fill-mode:\s*([\w-]+)/.exec(body ?? '')?.[1] ?? ''
        const words = `${declaration} ${fill}`
        expect(words, `"${selector!.trim()}" holds @keyframes ${frame.name} after it ends`)
          .not.toMatch(/\b(both|forwards)\b/)
      }
    }
  })

  it('still reaches the page, via main', () => {
    expect(selectorsUsing('page-flow').join(' ')).toContain('.page-flow')
  })

  it('is switched off under reduced motion', () => {
    const reduced = /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{([\s\S]*?)\n\}/.exec(css)
    expect(reduced?.[1] ?? '').toMatch(/animation:\s*none/)
  })
})
