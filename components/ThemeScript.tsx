import { themeScript } from '@/lib/themes'

/**
 * Applies the saved theme before the browser paints anything.
 *
 * Without this there is a "flash of wrong theme": the server has no idea what
 * the visitor picked last time, so it renders the default, and a React effect
 * corrects it a beat later. On a site whose ground colour is near-black, that
 * beat is a full-screen white flash on every page load.
 *
 * It has to be an inline, blocking script in the document head — a module or
 * a deferred script runs too late to help. It is deliberately tiny, and it
 * runs inside a try/catch because reading localStorage throws outright in
 * some privacy modes.
 */
export function ThemeScript() {
  // Built in lib/themes.ts, where it is tested by running it: it applies the
  // stored theme only when it is a real one, and the default otherwise.
  return <script dangerouslySetInnerHTML={{ __html: themeScript() }} />
}
