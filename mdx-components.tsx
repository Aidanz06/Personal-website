import type { MDXComponents } from 'mdx/types'
import Link from 'next/link'
import type { AnchorHTMLAttributes } from 'react'

/**
 * @next/mdx looks for this file by name at the project root and uses it for
 * every MDX file in the app. It is the one place MDX output gets styled —
 * the .mdx content files stay pure prose with no className attributes, which
 * is the whole point of putting content in MDX.
 */
export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    h1: ({ children }) => (
      <h1 className="mt-0 mb-3 font-display text-name font-normal text-ink">
        {children}
      </h1>
    ),

    h2: ({ children }) => (
      <h2 className="mt-5 mb-1.5 font-display text-heading font-normal text-ink">
        {children}
      </h2>
    ),

    h3: ({ children }) => (
      <h3 className="mt-4 mb-1 font-body text-body font-medium text-ink">
        {children}
      </h3>
    ),

    p: ({ children }) => <p className="my-2 text-body text-ink">{children}</p>,

    ul: ({ children }) => (
      <ul className="my-2 list-disc space-y-1 pl-3 text-body text-ink marker:text-muted">
        {children}
      </ul>
    ),

    ol: ({ children }) => (
      <ol className="my-2 list-decimal space-y-1 pl-3 text-body text-ink marker:text-muted">
        {children}
      </ol>
    ),

    li: ({ children }) => <li className="pl-0.5">{children}</li>,

    // Hairline rule, never a boxed divider.
    hr: () => <hr className="my-5 border-t border-rule" />,

    blockquote: ({ children }) => (
      <blockquote className="my-3 border-l border-rule pl-2 text-muted">
        {children}
      </blockquote>
    ),

    code: ({ children }) => (
      <code className="font-mono text-small text-ink">{children}</code>
    ),

    strong: ({ children }) => (
      <strong className="font-medium text-ink">{children}</strong>
    ),

    // Internal links go through next/link for client-side navigation;
    // external ones stay plain anchors and open in a new tab.
    a: ({ href, children, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement>) => {
      const target = href ?? ''
      if (target.startsWith('/')) {
        return (
          <Link href={target} {...rest}>
            {children}
          </Link>
        )
      }
      return (
        <a
          href={target}
          target="_blank"
          rel="noopener noreferrer"
          {...rest}
        >
          {children}
        </a>
      )
    },

    ...components,
  }
}
