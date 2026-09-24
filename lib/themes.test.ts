import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { DEFAULT_THEME, THEMES, THEME_STORAGE_KEY, isThemeId } from './themes'

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8')

/** Source with comments removed, so prose about the code is not read as code. */
const readCode = (...parts: string[]) =>
  read(...parts)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')

describe('THEMES', () => {
  it('has a unique id per theme, and a default that is one of them', () => {
    const ids = THEMES.map((theme) => theme.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toContain(DEFAULT_THEME)
  })

  it('recognises its own ids and nothing else', () => {
    for (const theme of THEMES) expect(isThemeId(theme.id)).toBe(true)
    for (const value of ['', 'dark', null, undefined, 0, {}]) {
      expect(isThemeId(value)).toBe(false)
    }
  })
})

describe('the no-flash script and hydration', () => {
  /**
   * The bug this exists for: the root layout renders
   * `<html data-theme="koi">`, ThemeScript rewrites that attribute from
   * localStorage before the browser paints, and React then hydrates, finds
   * "phosphor" where the server said "koi", and reports a hydration mismatch
   * in the console on every load for anyone who has ever changed theme.
   *
   * The attribute HAS to differ — that is the entire point of the script, and
   * the alternative is a full-screen flash of the wrong theme on a near-black
   * site. So the element is marked as one React should not diff.
   */
  it('marks the html element as one React must not diff', () => {
    const html = /<html[\s\S]*?>/.exec(readCode('app', 'layout.tsx'))?.[0] ?? ''
    expect(html).toContain('data-theme=')
    expect(html).toContain('suppressHydrationWarning')
  })

  it('suppresses it on that element only, not on the body or the tree', () => {
    // suppressHydrationWarning applies one level deep. On <html> that covers
    // exactly the attribute the script rewrites; anywhere broader would hide
    // real mismatches — which is the failure mode that makes this attribute
    // dangerous rather than merely untidy.
    const code = readCode('app', 'layout.tsx')
    expect(code.match(/suppressHydrationWarning/g)).toHaveLength(1)
    const body = /<body[\s\S]*?>/.exec(code)?.[0] ?? ''
    expect(body).not.toContain('suppressHydrationWarning')
  })

  it('writes the attribute the script reads, under the key it reads', () => {
    const script = read('components', 'ThemeScript.tsx')
    expect(script).toContain('dataset.theme')
    expect(script).toContain('THEME_STORAGE_KEY')
    expect(THEME_STORAGE_KEY.length).toBeGreaterThan(0)
  })

  it('still falls back to the default when storage throws', () => {
    // Private browsing refuses localStorage outright, and an unguarded read
    // there leaves the page with no theme at all.
    const script = read('components', 'ThemeScript.tsx')
    expect(script).toContain('catch')
    expect(script).toContain('DEFAULT_THEME')
  })
})
