import { describe, expect, it } from 'vitest'
import { mergeCaptions, type ScannedPhoto } from './photosSync'
import type { CaptionsFile } from './captions'

const scan: ScannedPhoto[] = [
  { file: 'website-01.jpg', date: '2025-05-22', settings: 'f/8 · 1/160 · iso 320' },
  { file: 'website-02.jpg', date: '2025-05-22', settings: 'f/2.8 · 1/1000 · iso 800' },
  { file: 'website-11.jpg', date: '2025-05-25', settings: 'f/2.8 · 1/100 · iso 500' },
]

describe('mergeCaptions', () => {
  it('scaffolds every photograph with blank alt, name and line', () => {
    const { captions, added } = mergeCaptions({}, scan)
    expect(added).toEqual(['website-01.jpg', 'website-02.jpg', 'website-11.jpg'])
    expect(captions.photos!['website-01.jpg']).toEqual({
      alt: '',
      name: '',
      line: '',
      date: '2025-05-22',
      settings: 'f/8 · 1/160 · iso 320',
    })
  })

  it('adds one place entry per shoot date, blank, ready to fill in', () => {
    const { captions, newDates } = mergeCaptions({}, scan)
    expect(newDates).toEqual(['2025-05-22', '2025-05-25'])
    expect(captions.places).toEqual({ '2025-05-22': '', '2025-05-25': '' })
  })

  it('never overwrites text Aidan wrote, on a second run', () => {
    // The one guarantee the script makes. Running it twice must be safe, or
    // it is not a tool anybody will run.
    const first = mergeCaptions({}, scan).captions
    const edited: CaptionsFile = {
      places: { ...first.places, '2025-05-22': 'kamakura' },
      photos: {
        ...first.photos,
        'website-01.jpg': {
          ...first.photos!['website-01.jpg'],
          alt: 'a torii gate half in the sea.',
          line: 'the tide was further out than the guidebook said.',
        },
      },
    }

    const second = mergeCaptions(edited, scan)
    expect(second.captions.photos!['website-01.jpg']!.alt).toBe('a torii gate half in the sea.')
    expect(second.captions.photos!['website-01.jpg']!.line)
      .toBe('the tide was further out than the guidebook said.')
    expect(second.captions.places!['2025-05-22']).toBe('kamakura')
    expect(second.added).toEqual([])
    expect(second.newDates).toEqual([])

    // And a third run changes nothing at all.
    const third = mergeCaptions(second.captions, scan)
    expect(third.captions).toEqual(second.captions)
  })

  it('leaves a hand-corrected date alone rather than re-reading EXIF over it', () => {
    // The camera clock is on the wrong timezone. A date fixed by hand has to
    // survive the next sync or fixing it is pointless.
    const existing: CaptionsFile = {
      photos: { 'website-01.jpg': { alt: 'x', line: '', date: '2025-05-21', settings: '' } },
    }
    const { captions } = mergeCaptions(existing, scan)
    expect(captions.photos!['website-01.jpg']!.date).toBe('2025-05-21')
    // A blank settings field still gets filled.
    expect(captions.photos!['website-01.jpg']!.settings).toBe('f/8 · 1/160 · iso 320')
  })

  it('adds only the new photograph when one arrives', () => {
    const before = mergeCaptions({}, scan.slice(0, 2)).captions
    const after = mergeCaptions(before, scan)
    expect(after.added).toEqual(['website-11.jpg'])
    expect(after.newDates).toEqual(['2025-05-25'])
  })

  it('reports what is still blank', () => {
    const result = mergeCaptions({}, scan)
    expect(result.missingAlt).toHaveLength(3)
    expect(result.missingPlace).toEqual(['2025-05-22', '2025-05-25'])
    expect(result.missingLine).toHaveLength(3)
    expect(result.missingDate).toEqual([])
  })

  it('reports a clip as needing a date, since it carries none', () => {
    // An mp4's container timestamp is rewritten by any transcode, so reading
    // one would record the day the file was last processed as the day the
    // clip was shot. Blank and on the checklist is the honest answer.
    const result = mergeCaptions({}, [
      ...scan,
      { file: 'website-16.mp4', date: '', settings: '' },
    ])
    expect(result.missingDate).toEqual(['website-16.mp4'])
    // And no blank key creeps into places off the back of it.
    expect(Object.keys(result.captions.places!)).not.toContain('')
  })

  it('stops reporting a clip once its date is typed in', () => {
    const typed = mergeCaptions(
      { photos: { 'clip.mp4': { alt: 'a', line: '', date: '2025-08-03', settings: '' } } },
      [{ file: 'clip.mp4', date: '', settings: '' }],
    )
    expect(typed.missingDate).toEqual([])
    expect(typed.captions.photos!['clip.mp4']!.date).toBe('2025-08-03')
    expect(typed.captions.places!['2025-08-03']).toBe('')
  })

  it('stops reporting a field once it is filled in', () => {
    const filled: CaptionsFile = {
      places: { '2025-05-22': 'kamakura', '2025-05-25': 'tokyo' },
      photos: Object.fromEntries(
        scan.map((photo) => [photo.file, { alt: 'described.', line: 'said.', date: photo.date, settings: photo.settings }]),
      ),
    }
    const result = mergeCaptions(filled, scan)
    expect(result.missingAlt).toEqual([])
    expect(result.missingPlace).toEqual([])
    expect(result.missingLine).toEqual([])
  })

  it('keeps an entry whose file has gone, and says so', () => {
    // Deleting it would throw away a description over what is probably a
    // rename. Reporting it costs a line of output.
    const existing = mergeCaptions({}, scan).captions
    const result = mergeCaptions(existing, scan.slice(0, 2))
    expect(result.orphans).toEqual(['website-11.jpg'])
    expect(result.captions.photos!['website-11.jpg']).toBeDefined()
  })

  it('sorts both maps, so a sync is a readable diff', () => {
    const shuffled = [...scan].reverse()
    const { captions } = mergeCaptions({}, shuffled)
    expect(Object.keys(captions.photos!)).toEqual([...Object.keys(captions.photos!)].sort())
    expect(Object.keys(captions.places!)).toEqual([...Object.keys(captions.places!)].sort())
  })

  it('handles a photograph whose EXIF carried nothing', () => {
    const { captions } = mergeCaptions({}, [{ file: 'scan.jpg', date: '', settings: '' }])
    expect(captions.photos!['scan.jpg']).toEqual({ alt: '', name: '', line: '', date: '', settings: '' })
    // No date means no place entry to create — a blank key would be nonsense.
    expect(captions.places).toEqual({})
  })
})

describe('names', () => {
  const scanned: ScannedPhoto[] = [
    { file: 'a.jpg', date: '2025-05-22', settings: 'f/8' },
    { file: 'b.jpg', date: '', settings: '' },
  ]

  it('keeps a name Aidan typed, on every run', () => {
    // The merge rebuilt each entry from a fixed list of fields, so a field it
    // did not know about was silently dropped on the next sync. A name is
    // Aidan's own words; losing it is exactly what this script must not do.
    const existing: CaptionsFile = { photos: { 'a.jpg': { name: 'two bikes' } } }
    let result = mergeCaptions(existing, scanned)
    result = mergeCaptions(result.captions, scanned)
    expect(result.captions.photos!['a.jpg']!.name).toBe('two bikes')
  })

  it('scaffolds a blank name for every photograph, ready to type into', () => {
    const result = mergeCaptions({}, scanned)
    expect(result.captions.photos!['b.jpg']!.name).toBe('')
  })

  it('lists the photographs that still need a name', () => {
    const result = mergeCaptions({ photos: { 'a.jpg': { name: 'two bikes' } } }, scanned)
    expect(result.missingName).toEqual(['b.jpg'])
  })

  it('keeps any other field it does not know about, too', () => {
    const existing = { photos: { 'a.jpg': { note: 'keep me' } } } as unknown as CaptionsFile
    const result = mergeCaptions(existing, scanned)
    expect((result.captions.photos!['a.jpg'] as Record<string, unknown>).note).toBe('keep me')
  })
})
