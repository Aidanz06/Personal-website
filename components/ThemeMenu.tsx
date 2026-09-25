'use client'

import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { requestSplashAt } from '@/lib/pond/splash'
import { menuSide } from '@/lib/themeMenu'
import { THEME_RING_MS, themeChange, themeRingRadius } from '@/lib/pond/themeRing'
import {
  DEFAULT_THEME,
  THEMES,
  THEME_STORAGE_KEY,
  isThemeId,
  type ThemeId,
} from '@/lib/themes'

/**
 * The theme control, sitting beside Aidan's name.
 *
 * There is one of these and it is in one place. Setting `data-theme` on
 * <html> is the entire mechanism: every colour on the site resolves through
 * that attribute, including the ones the pond canvas reads, which watches it
 * with a MutationObserver and repaints.
 *
 * Collapsed it is a single muted glyph — not a button, not a box. The design
 * has no furniture and a theme picker is not the thing to introduce it with.
 */

/**
 * How long the menu stays open after the pointer leaves.
 *
 * Zero delay makes the menu flicker shut crossing the gap between the glyph
 * and the first option, which is a real gap because the options sit below
 * the trigger rather than on top of it.
 */
const CLOSE_DELAY_MS = 220

export function ThemeMenu({ className }: { className?: string }) {
  // Starts null rather than at the default, because on the server we do not
  // know: the inline script in <head> set the attribute from localStorage
  // before React existed. Guessing here would mark the wrong option as
  // current until hydration caught up.
  const [theme, setTheme] = useState<ThemeId | null>(null)
  const [open, setOpen] = useState(false)
  // Which way the menu opens; measured when it opens. See lib/themeMenu.ts.
  const [side, setSide] = useState<'left' | 'right'>('left')

  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const itemsRef = useRef<(HTMLButtonElement | null)[]>([])
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const current = document.documentElement.dataset.theme
    setTheme(isThemeId(current) ? current : DEFAULT_THEME)
  }, [])

  useEffect(() => () => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
  }, [])

  function openMenu() {
    const box = triggerRef.current?.getBoundingClientRect()
    if (box) setSide(menuSide(box, window.innerWidth))
    setOpen(true)
  }

  function cancelClose() {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    closeTimer.current = null
  }

  function scheduleClose() {
    cancelClose()
    closeTimer.current = setTimeout(() => setOpen(false), CLOSE_DELAY_MS)
  }

  function choose(next: ThemeId) {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next)
    } catch {
      // Private browsing can refuse storage. The theme still applies to this
      // page view; it just will not be remembered.
    }

    // Synchronous, so a view transition captures the finished new page.
    const apply = () => {
      document.documentElement.dataset.theme = next
      flushSync(() => {
        setTheme(next)
        setOpen(false)
      })
    }

    // The new pond spreads out from the glyph that was pressed, as a ring,
    // and a ripple drops there. See lib/pond/themeRing.ts.
    const doc = document as Document & {
      startViewTransition?: (update: () => void) => { ready: Promise<void> }
    }
    const mode = themeChange({
      reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      supported: typeof doc.startViewTransition === 'function',
    })
    const box = triggerRef.current?.getBoundingClientRect()

    if (mode === 'instant' || !box || !doc.startViewTransition) {
      apply()
    } else {
      const x = box.left + box.width / 2
      const y = box.top + box.height / 2
      const radius = themeRingRadius(x, y, window.innerWidth, window.innerHeight)
      requestSplashAt(x / window.innerWidth, y / window.innerHeight, 0.9)
      doc
        .startViewTransition(apply)
        .ready.then(() => {
          document.documentElement.animate(
            { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
            {
              duration: THEME_RING_MS,
              // Exponential ease-out: fast from the finger, settling at the
              // edges, the way a ring on water slows as it spreads.
              easing: 'cubic-bezier(0.33, 1, 0.68, 1)',
              pseudoElement: '::view-transition-new(root)',
            },
          )
        })
        .catch(() => {
          // A skipped transition still applied the theme; nothing to undo.
        })
    }
    triggerRef.current?.focus()
  }

  function focusItem(index: number) {
    const wrapped = (index + THEMES.length) % THEMES.length
    itemsRef.current[wrapped]?.focus()
  }

  function onMenuKeyDown(event: React.KeyboardEvent, index: number) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      focusItem(index + 1)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      focusItem(index - 1)
    } else if (event.key === 'Home') {
      event.preventDefault()
      focusItem(0)
    } else if (event.key === 'End') {
      event.preventDefault()
      focusItem(THEMES.length - 1)
    } else if (event.key === 'Escape') {
      event.preventDefault()
      setOpen(false)
      triggerRef.current?.focus()
    }
  }

  const label = THEMES.find((entry) => entry.id === theme)?.label

  return (
    <span
      className={`theme-menu relative inline-block ${className ?? ''}`}
      // Hover opens it for a mouse only. A tap also fires the compatibility
      // mouse events, so hover-to-open plus click-to-toggle opened the menu
      // and shut it again on the same tap (Android); on touch the click alone
      // toggles it.
      onPointerEnter={(event) => {
        if (event.pointerType !== 'mouse') return
        cancelClose()
        openMenu()
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === 'mouse') scheduleClose()
      }}
      // Tabbing out of the last option closes the menu, the same way moving
      // the pointer away does.
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setOpen(false)
        }
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label ? `theme: ${label}` : 'theme'}
        className="hit-area cursor-pointer font-mono text-small text-muted"
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault()
            openMenu()
            // The menu may not be mounted yet on this tick.
            requestAnimationFrame(() => focusItem(0))
          } else if (event.key === 'Escape') {
            setOpen(false)
          }
        }}
      >
        ◐
      </button>

      {open && (
        <span
          role="menu"
          aria-label="theme"
          className={`absolute top-full z-20 mt-0.5 block w-max bg-ground py-0.5 ${
            side === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          {THEMES.map((entry, index) => {
            const isCurrent = theme === entry.id
            return (
              <button
                key={entry.id}
                ref={(node) => {
                  itemsRef.current[index] = node
                }}
                type="button"
                role="menuitemradio"
                aria-checked={isCurrent}
                tabIndex={-1}
                title={entry.note}
                onClick={() => choose(entry.id)}
                onKeyDown={(event) => onMenuKeyDown(event, index)}
                className={
                  isCurrent
                    ? 'flex w-full cursor-pointer items-center gap-1 py-0.5 pr-1.5 text-left font-mono text-small text-ink pointer-coarse:py-[11.5px]'
                    : 'flex w-full cursor-pointer items-center gap-1 py-0.5 pr-1.5 text-left font-mono text-small text-muted pointer-coarse:py-[11.5px]'
                }
              >
                {/* The swatch shows the target theme's real colours by
                    scoping data-theme to itself, so it can never drift from
                    globals.css.

                    It reads --t-ground and --t-accent, NOT bg-ground and
                    bg-accent. Those utilities resolve --color-ground, which
                    is declared once on :root as var(--t-ground) — and a
                    custom property inherits its already-substituted value.
                    So every swatch would have come out in the colours of the
                    theme currently showing, which is the one thing a swatch
                    must not do. The --t-* slots are redefined on this element
                    itself, so reading them here gets the right answer.

                    The frame stays outside the scope, in the CURRENT theme's
                    rule colour: inside it, a dark swatch on a dark page would
                    have an invisible border. */}
                <span className="inline-flex border border-rule" aria-hidden="true">
                  <span data-theme={entry.id} className="inline-flex">
                    <span className="block size-1" style={{ background: 'var(--t-ground)' }} />
                    <span className="block size-1" style={{ background: 'var(--t-accent)' }} />
                  </span>
                </span>
                {entry.label}
              </button>
            )
          })}
        </span>
      )}

      {/* Without JavaScript the glyph is a control that cannot do anything,
          so it is not shown at all. Content inside <noscript> is ignored
          entirely when scripts run, so the rule only exists when it is true.
          Set as markup rather than as children because a browser with JS on
          parses <noscript> contents as text, and React would hydrate into
          the mismatch. */}
      <noscript
        dangerouslySetInnerHTML={{ __html: '<style>.theme-menu{display:none}</style>' }}
      />

      {/* Announces the change itself. aria-checked tells a screen reader which
          option is current while the menu is open; this is what it hears when
          the menu has already closed behind the choice. */}
      <span className="sr-only" aria-live="polite">
        {label ? `theme: ${label}` : ''}
      </span>
    </span>
  )
}
