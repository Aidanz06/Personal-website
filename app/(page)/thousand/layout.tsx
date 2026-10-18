import { ProjectHeadings } from '@/components/ProjectHeadings'

/** Titles and headings in the project's own face; see app/projectFonts.ts. */
export default function ThousandLayout({ children }: { children: React.ReactNode }) {
  return <ProjectHeadings project="thousand">{children}</ProjectHeadings>
}
