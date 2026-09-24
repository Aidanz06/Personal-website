import { describe, expect, it } from 'vitest'
import { boulderCoverUrl, resolveBoulders, resolveHideList } from './boulders.ts'
import { BOULDER_LINE_PLACEHOLDER, COVERS_URL } from './constants.ts'
import { loadListeningFile } from './file.ts'

describe('resolveBoulders', () => {
  it('renders an album that has both a name and an artist', () => {
    const [boulder] = resolveBoulders({
      neverLeave: [{ album: 'Kid A', artist: 'Radiohead', line: 'still', cover: '' }],
    })
    expect(boulder).toMatchObject({ album: 'Kid A', artist: 'Radiohead', line: 'still' })
    expect(boulder!.lineMissing).toBe(false)
  })

  it('does not render an empty slot', () => {
    // The file ships with three blank slots so the shape is obvious. A blank
    // slot is not a boulder with no name on it — it is nothing at all.
    expect(
      resolveBoulders({
        neverLeave: [
          { album: '', artist: '', line: '', cover: '' },
          { album: '  ', artist: '  ', line: '', cover: '' },
        ],
      }),
    ).toEqual([])
  })

  it('does not render a half-filled slot either', () => {
    expect(resolveBoulders({ neverLeave: [{ album: 'Kid A', artist: '' }] })).toEqual([])
    expect(resolveBoulders({ neverLeave: [{ album: '', artist: 'Radiohead' }] })).toEqual([])
  })

  it('shows the bracketed placeholder when there is no line yet', () => {
    // An unfinished page should be visibly unfinished, not quietly empty.
    const [boulder] = resolveBoulders({
      neverLeave: [{ album: 'Kid A', artist: 'Radiohead', line: '' }],
    })
    expect(boulder!.line).toBe(BOULDER_LINE_PLACEHOLDER)
    expect(boulder!.line).toContain('[')
    expect(boulder!.lineMissing).toBe(true)
  })

  it('keeps the order they are written down in', () => {
    const boulders = resolveBoulders({
      neverLeave: [
        { album: 'A', artist: 'X' },
        { album: '', artist: '' },
        { album: 'B', artist: 'Y' },
      ],
    })
    expect(boulders.map((b) => b.album)).toEqual(['A', 'B'])
  })

  it('handles a missing or empty file', () => {
    expect(resolveBoulders(undefined)).toEqual([])
    expect(resolveBoulders({})).toEqual([])
  })
})

describe('boulderCoverUrl', () => {
  it('turns a bare filename into a path in the covers folder', () => {
    const url = boulderCoverUrl('radiohead-kid-a.jpg')
    expect(decodeURIComponent(url)).toContain(`${COVERS_URL}/radiohead-kid-a.jpg`)
    expect(url).toContain('/_next/image')
  })

  it('takes a path or a url as given', () => {
    expect(decodeURIComponent(boulderCoverUrl('/other/x.jpg'))).toContain('/other/x.jpg')
    expect(decodeURIComponent(boulderCoverUrl('https://img/x.jpg'))).toContain('https://img/x.jpg')
  })

  it('leaves a blank cover blank, so the album opens as its name', () => {
    expect(boulderCoverUrl('')).toBe('')
    expect(boulderCoverUrl('   ')).toBe('')
  })
})

describe('resolveHideList', () => {
  it('drops the empty scaffold slot', () => {
    expect(resolveHideList({ hide: [{ artist: '', album: '' }] })).toEqual([])
  })

  it('keeps a rule with either half filled in', () => {
    expect(resolveHideList({ hide: [{ artist: 'Sleep Sounds' }] })).toHaveLength(1)
    expect(resolveHideList({ hide: [{ artist: '', album: 'Rain' }] })).toHaveLength(1)
  })
})

describe('the committed content file', () => {
  it('parses, and scaffolds three empty boulder slots', () => {
    const file = loadListeningFile()
    expect(file.neverLeave).toHaveLength(3)
    // Empty until Aidan fills them in, and empty renders nothing.
    expect(resolveBoulders(file)).toEqual([])
  })

  it('hides nothing yet', () => {
    expect(resolveHideList(loadListeningFile())).toEqual([])
  })
})
