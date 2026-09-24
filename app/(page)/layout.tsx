import { BackLink } from '@/components/BackLink'
import { ThemeMenu } from '@/components/ThemeMenu'

/**
 * Shared chrome for the inner pages: /tailor-studio and /about.
 *
 * `(page)` is a route group — the parentheses mean the folder organizes files
 * without appearing in the URL, so these stay at /about rather than
 * /page/about. The homepage sits outside the group because it has no back
 * link and a different vertical rhythm.
 */
export default function PageLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <main className="column py-3">
      <div className="flex items-baseline gap-1">
        <BackLink />
        <ThemeMenu />
      </div>
      <article className="mt-4">{children}</article>
    </main>
  )
}
