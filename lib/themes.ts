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

/**
 * The inline script that applies the saved theme before first paint. See
 * components/ThemeScript.tsx for why it has to be inline and blocking.
 *
 * It only applies a value that is one of THEMES. Anything else stored
 * there, like a stale id from an older version or a hand-edited value,
 * matches no theme block in the CSS and would leave the page with no theme
 * at all, so it falls back to the default instead.
 */
export function themeScript(): string {
  const ids = THEMES.map((theme) => theme.id)
  return `
(function(){try{
  var t = localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
  document.documentElement.dataset.theme = ${JSON.stringify(ids)}.indexOf(t) >= 0 ? t : ${JSON.stringify(DEFAULT_THEME)};
}catch(e){
  document.documentElement.dataset.theme = ${JSON.stringify(DEFAULT_THEME)};
}})();`
}
