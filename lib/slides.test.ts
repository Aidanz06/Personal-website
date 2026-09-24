import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { compareSlideFiles, missingAltFor, readSlides } from './slides'

/** A real PNG header, which is all the loader reads. */
function png(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(24)
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0)
  const view = new DataView(bytes.buffer)
  view.setUint32(8, 13)
  bytes.set([0x49, 0x48, 0x44, 0x52], 12)
  view.setUint32(16, width)
  view.setUint32(20, height)
  return bytes
}

function fixture(
  files: Record<string, Uint8Array | string>,
  manifest?: unknown,
): { dir: string; manifestPath: string } {
  const dir = mkdtempSync(join(tmpdir(), 'slides-'))
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(join(dir, name), content)
  }
  const manifestPath = join(dir, 'slides.json')
  if (manifest !== undefined) writeFileSync(manifestPath, JSON.stringify(manifest))
  return { dir, manifestPath }
}

const load = (files: Record<string, Uint8Array | string>, manifest?: unknown) => {
  const { dir, manifestPath } = fixture(files, manifest)
  return readSlides(dir, manifestPath, '/tailor-studio/slides')
}

describe('compareSlideFiles', () => {
  it('orders by the number, not by the string', () => {
    expect(['10.png', '2.png', '1.png'].sort(compareSlideFiles))
      .toEqual(['1.png', '2.png', '10.png'])
  })

  it('leaves zero-padded names alone', () => {
    expect(['03.png', '01.png', '02.png'].sort(compareSlideFiles))
      .toEqual(['01.png', '02.png', '03.png'])
  })

  it('puts an unnumbered file last rather than at the front', () => {
    expect(['cover.png', '01.png'].sort(compareSlideFiles))
      .toEqual(['01.png', 'cover.png'])
  })
})

describe('readSlides', () => {
  it('reads the deck in order, with real dimensions from each file', () => {
    const slides = load({ '01.png': png(1600, 900), '02.png': png(1600, 900) })
    expect(slides.map((s) => s.file)).toEqual(['01.png', '02.png'])
    expect(slides[0]).toMatchObject({
      src: '/tailor-studio/slides/01.png',
      width: 1600,
      height: 900,
    })
  })

  it('ignores anything that is not an image', () => {
    const slides = load({ '01.png': png(800, 600), 'README.md': '# notes' })
    expect(slides).toHaveLength(1)
  })

  it('marks a slide with no manifest entry as missing, with a visible placeholder', () => {
    const [slide] = load({ '01.png': png(800, 600) }, { slides: {} })
    expect(slide!.missing).toBe(true)
    expect(slide!.alt).toBe(missingAltFor(1))
    expect(slide!.alt).toContain('[')
    expect(slide!.alt).toContain('aidan to write')
  })

  it('treats a blank alt exactly like a missing one', () => {
    // An empty string in the manifest is a slide someone started and did not
    // finish. Rendering alt="" would silently mark it decorative.
    const [slide] = load({ '01.png': png(800, 600) }, { slides: { '01.png': { alt: '   ' } } })
    expect(slide!.missing).toBe(true)
    expect(slide!.alt).toContain('aidan to write')
  })

  it('carries real alt text through, and defaults it to a draft', () => {
    const [slide] = load(
      { '01.png': png(800, 600) },
      { slides: { '01.png': { alt: 'the sell form, filled in.' } } },
    )
    expect(slide!.alt).toBe('the sell form, filled in.')
    expect(slide!.missing).toBe(false)
    expect(slide!.draft).toBe(true)
  })

  it('stops calling it a draft once it has been checked', () => {
    const [slide] = load(
      { '01.png': png(800, 600) },
      { slides: { '01.png': { alt: 'the sell form.', draft: false } } },
    )
    expect(slide!.draft).toBe(false)
  })

  it('skips a file whose dimensions cannot be read rather than guessing', () => {
    // A guessed aspect ratio is a layout shift with extra steps.
    const slides = load({ '01.png': png(800, 600), '02.png': 'not an image' })
    expect(slides.map((s) => s.file)).toEqual(['01.png'])
  })

  it('works with no manifest at all', () => {
    const slides = load({ '01.png': png(800, 600) })
    expect(slides).toHaveLength(1)
    expect(slides[0]!.missing).toBe(true)
  })

  it('survives a half-edited manifest instead of failing the build', () => {
    const { dir, manifestPath } = fixture({ '01.png': png(800, 600) })
    writeFileSync(manifestPath, '{ "slides": { ')
    const slides = readSlides(dir, manifestPath, '/tailor-studio/slides')
    expect(slides).toHaveLength(1)
    expect(slides[0]!.missing).toBe(true)
  })

  it('returns nothing when the folder does not exist', () => {
    expect(readSlides('/no/such/folder', '/no/such/slides.json', '/x')).toEqual([])
  })
})
