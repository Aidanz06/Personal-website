import type { Metadata } from 'next'
import { fontVariables } from './fonts'
import { PageFlow } from '@/components/PageFlow'
import { ThemeScript } from '@/components/ThemeScript'
import { site } from '@/lib/site'
import { DEFAULT_THEME } from '@/lib/themes'
import './globals.css'

export const metadata: Metadata = {
  // Each route sets its own title; this template wraps them. The homepage
  // opts out with `title: { absolute: ... }` so it is not "aidan zheng —
  // aidan zheng".
  title: {
    default: site.name,
    template: `%s — ${site.name}`,
  },
  description: site.description,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    // data-theme is set here for the server-rendered markup and immediately
    // corrected by ThemeScript from localStorage, before first paint.
    //
    // suppressHydrationWarning is not papering over a bug — the mismatch is
    // the design. The server cannot know which theme this visitor picked last
    // time, so it renders the default; the inline script in <head> rewrites
    // the attribute before the browser paints; React then hydrates and finds
    // "phosphor" where the server wrote "koi". Without this, anyone who has
    // ever changed theme gets a hydration error in the console on every page
    // load. The alternative — not writing the attribute on the server — is a
    // full-screen flash of the wrong theme on a near-black site.
    //
    // It applies one level deep, so it covers exactly this element's
    // attributes and hides nothing inside the app.
    <html
      lang="en"
      className={fontVariables}
      data-theme={DEFAULT_THEME}
      suppressHydrationWarning
    >
      <head>
        <ThemeScript />
      </head>
      <body>
        <PageFlow>{children}</PageFlow>
      </body>
    </html>
  )
}
