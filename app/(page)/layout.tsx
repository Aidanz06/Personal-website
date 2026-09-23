import { BackLink } from '@/components/BackLink'

/**
 * Shared chrome for /tailor-studio, /about and /resume.
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
      <BackLink />
      <article className="mt-4">{children}</article>
    </main>
  )
}
