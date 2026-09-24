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
    <html lang="en" className={fontVariables} data-theme={DEFAULT_THEME}>
      <head>
        <ThemeScript />
      </head>
      <body>
        <PageFlow>{children}</PageFlow>
      </body>
    </html>
  )
}
