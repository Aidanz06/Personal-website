import { ProjectHeadings } from '@/components/ProjectHeadings'

/** Titles and headings in the project's own face; see app/projectFonts.ts. */
export default function SecretariatLayout({ children }: { children: React.ReactNode }) {
  return <ProjectHeadings project="secretariat">{children}</ProjectHeadings>
}
