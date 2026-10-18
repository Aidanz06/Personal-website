import type { CSSProperties, ReactNode } from 'react'
import { PROJECT_LOGOS, type ProjectId } from '@/app/projectFonts'

/**
 * The project's display face and logo accent, in scope for everything inside.
 *
 * It works by redefining --font-display: anything below that is
 * `font-display` follows, and nothing else does. The `em` of a logo takes
 * the accent; see `.project-logo` in globals.css.
 */
export function projectScope(project: ProjectId): { className: string; style: CSSProperties } {
  const logo = PROJECT_LOGOS[project]
  return {
    className: `project-logo ${logo.font.variable}`,
    style: {
      '--font-display': `var(--ff-project), ${logo.fallback}`,
      '--logo-accent': logo.accent.dark,
      '--logo-accent-paper': logo.accent.paper,
    } as CSSProperties,
  }
}

/**
 * A project page's title and section headings, in that project's own display
 * face, so the page and the slides on it read as the same thing. The title
 * is also the logo: its emphasised part (the `*Studio*` in
 * `# Tailor *Studio*`) takes the logo's accent.
 *
 * Body text, the slideshow's controls, the back link and the theme menu all
 * stay in the site's own fonts.
 */
export function ProjectHeadings({ project, children }: { project: ProjectId; children: ReactNode }) {
  return <div {...projectScope(project)}>{children}</div>
}
