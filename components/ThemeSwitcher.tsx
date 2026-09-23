'use client'

import { useEffect, useState } from 'react'
import {
  DEFAULT_THEME,
  THEMES,
  THEME_STORAGE_KEY,
  isThemeId,
  type ThemeId,
} from '@/lib/themes'

/**
 * Theme control. Text only — the design system has no icon set, so this is a
 * row of words rather than a sun/moon toggle.
 *
 * Setting `data-theme` on <html> is the entire mechanism: every colour on the
 * site, including the ones the canvas renderer reads, resolves through that
 * attribute.
 */
export function ThemeSwitcher({ className }: { className?: string }) {
  // Starts as null rather than the default, because on the server we genuinely
  // do not know which theme is active — ThemeScript set it from localStorage
  // before React ever ran. Rendering a guess here would mark the wrong entry
  // as current until hydration caught up.
  const [theme, setTheme] = useState<ThemeId | null>(null)

  useEffect(() => {
    const current = document.documentElement.dataset.theme
    setTheme(isThemeId(current) ? current : DEFAULT_THEME)
  }, [])

  function choose(next: ThemeId) {
    document.documentElement.dataset.theme = next
    setTheme(next)
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next)
    } catch {
      // Private browsing can refuse storage. The theme still applies for
      // this page view; it just will not be remembered.
    }
  }

  return (
    <div className={className}>
      <ul className="flex flex-wrap gap-x-1.5 gap-y-0.5">
        {THEMES.map((entry) => {
          const isCurrent = theme === entry.id
          return (
            <li key={entry.id}>
              <button
                type="button"
                onClick={() => choose(entry.id)}
                aria-pressed={isCurrent}
                title={entry.note}
                className={
                  isCurrent
                    ? 'font-mono text-small text-ink underline underline-offset-2'
                    : 'font-mono text-small text-muted underline underline-offset-2'
                }
              >
                {entry.label}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
