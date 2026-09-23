import type { Metadata } from 'next'
import { fontVariables } from './fonts'
import { site } from '@/lib/site'
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
    <html lang="en" className={fontVariables}>
      <body>{children}</body>
    </html>
  )
}
