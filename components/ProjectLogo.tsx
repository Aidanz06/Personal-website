import { PROJECT_LOGOS, type ProjectId } from '@/app/projectFonts'
import { projectScope } from '@/components/ProjectHeadings'

/**
 * A project's name drawn as its logo, for its stone in the pond. Takes the
 * size and colour of wherever it is put; only the face and the accented part
 * are the project's own.
 */
export function ProjectLogo({ project }: { project: ProjectId }) {
  const { className, style } = projectScope(project)
  return (
    <span className={`${className} font-display`} style={style}>
      {PROJECT_LOGOS[project].parts.map((part) =>
        part.accent ? <em key={part.text}>{part.text}</em> : part.text,
      )}
    </span>
  )
}
