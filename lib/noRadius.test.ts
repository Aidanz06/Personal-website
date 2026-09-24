import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * No radius, anywhere (DESIGN.md → Shapes).
 *
 * The site's argument is that it has no furniture: no boxes, so nothing to
 * round. The last exception was a 1px radius on the focus outline, flagged
 * by both halves of the 2026-09-24 critique and squared at Aidan's call. This
 * keeps the next one from creeping in unnoticed.
 */

const root = process.cwd()
const css = readFileSync(join(root, 'app', 'globals.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')

function sources(dir: string): string[] {
  return readdirSync(join(root, dir), { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? sources(join(dir, entry.name))
      : /\.(tsx|mdx)$/.test(entry.name)
        ? [join(dir, entry.name)]
        : [],
  )
}

describe('no radius, anywhere', () => {
  it('declares no border-radius other than zero in the stylesheet', () => {
    const radii = [...css.matchAll(/border-radius\s*:\s*([^;]+);/g)].map((m) => m[1]!.trim())
    expect(radii.filter((r) => !/^0(px)?$/.test(r))).toEqual([])
  })

  it('uses no rounded-* utility in any component or page', () => {
    for (const file of [...sources('components'), ...sources('app')]) {
      // Comments out first: "a phone's notch and rounded corners" in a
      // comment is prose, not a class.
      const source = readFileSync(join(root, file), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/(^|[^:])\/\/.*$/gm, '$1')
      expect(source.match(/\brounded(-[\w[\]./]+)?\b/g) ?? [], file).toEqual([])
    }
  })
})
