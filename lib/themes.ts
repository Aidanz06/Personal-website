/**
 * The site's themes.
 *
 * A theme is nothing but a set of --t-* values in app/globals.css. Adding one
 * means adding a CSS block and an entry here; no component needs to change.
 */

export const THEMES = [
  { id: 'koi', label: 'koi', note: 'a pond at night' },
  { id: 'phosphor', label: 'phosphor', note: 'crt green' },
  { id: 'paper', label: 'paper', note: 'sailcloth and blue' },
] as const

export type ThemeId = (typeof THEMES)[number]['id']

export const DEFAULT_THEME: ThemeId = 'koi'

export const THEME_STORAGE_KEY = 'aidan-theme'

export function isThemeId(value: unknown): value is ThemeId {
  return THEMES.some((theme) => theme.id === value)
}
