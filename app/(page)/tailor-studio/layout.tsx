import { ProjectHeadings } from '@/components/ProjectHeadings'

/** Titles and headings in the project's own face; see app/projectFonts.ts. */
export default function TailorStudioLayout({ children }: { children: React.ReactNode }) {
  return <ProjectHeadings project="tailor-studio">{children}</ProjectHeadings>
}
