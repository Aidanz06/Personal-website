import { describe, expect, it } from 'vitest'
import {
  albumInfoUrl,
  applyCovers,
  coverFileName,
  extensionFromUrl,
  parseAlbumInfo,
  planCovers,
} from './covers.ts'
import type { ListeningFile } from './types.ts'

const file: ListeningFile = {
  neverLeave: [
    { album: 'Kid A', artist: 'Radiohead', line: 'still', cover: '' },
    { album: 'Vespertine', artist: 'Björk', line: '', cover: 'bjork-vespertine.jpg' },
    { album: '', artist: '', line: '', cover: '' },
  ],
  hide: [],
}

describe('planCovers', () => {
  it('asks only for the albums with no cover yet', () => {
    const plan = planCovers(file)
    expect(plan.jobs.map((job) => job.album)).toEqual(['Kid A'])
    expect(plan.jobs[0]!.index).toBe(0)
  })

  it('reports what is already covered and what is still an empty slot', () => {
    const plan = planCovers(file)
    expect(plan.alreadySet).toEqual(['Vespertine · Björk'])
    expect(plan.emptySlots).toBe(1)
  })

  it('handles an empty or missing file', () => {
    expect(planCovers({})).toEqual({ jobs: [], alreadySet: [], emptySlots: 0 })
  })
})

describe('applyCovers', () => {
  it('fills in a blank cover', () => {
    const next = applyCovers(file, new Map([[0, 'radiohead-kid-a.jpg']]))
    expect(next.neverLeave![0]!.cover).toBe('radiohead-kid-a.jpg')
  })

  it('never overwrites a cover that is already there', () => {
    // The whole contract of the script. A value Aidan typed, or a previous
    // run wrote, is not a thing to be improved on.
    const next = applyCovers(file, new Map([[1, 'something-else.jpg']]))
    expect(next.neverLeave![1]!.cover).toBe('bjork-vespertine.jpg')
  })

  it('leaves the words alone', () => {
    const next = applyCovers(file, new Map([[0, 'radiohead-kid-a.jpg']]))
    expect(next.neverLeave![0]!.line).toBe('still')
    expect(next.neverLeave![0]!.album).toBe('Kid A')
  })

  it('does not mutate the file it was given', () => {
    const before = JSON.stringify(file)
    applyCovers(file, new Map([[0, 'x.jpg']]))
    expect(JSON.stringify(file)).toBe(before)
  })

  it('keeps the hide list', () => {
    const withHide: ListeningFile = { ...file, hide: [{ artist: 'Sleep Sounds' }] }
    expect(applyCovers(withHide, new Map()).hide).toEqual([{ artist: 'Sleep Sounds' }])
  })

  it('changes nothing on a second run', () => {
    // The clips in step 7 were destroyed by a script that wrote over its own
    // input. This is the test that says this one cannot.
    const first = applyCovers(file, new Map([[0, 'radiohead-kid-a.jpg']]))
    const plan = planCovers(first)
    expect(plan.jobs).toEqual([])

    // Even handed the same fills again, which is what a second run would do
    // if it ignored its own plan.
    const second = applyCovers(first, new Map([[0, 'radiohead-kid-a.jpg']]))
    expect(second).toEqual(first)

    const third = applyCovers(second, new Map([[0, 'a-different-name.jpg']]))
    expect(third).toEqual(first)
  })
})

describe('coverFileName', () => {
  it('is readable, which an image hash is not', () => {
    expect(coverFileName('Radiohead', 'Kid A')).toBe('radiohead-kid-a.jpg')
  })

  it('folds accents rather than escaping them', () => {
    expect(coverFileName('Björk', 'Vespertine')).toBe('bjork-vespertine.jpg')
  })

  it('survives punctuation, and never produces a path', () => {
    const name = coverFileName('AC/DC', '../../etc/passwd')
    expect(name).not.toContain('/')
    expect(name).not.toContain('..')
  })

  it('is deterministic, so a second run finds the same file', () => {
    expect(coverFileName('Radiohead', 'Kid A')).toBe(coverFileName('Radiohead', 'Kid A'))
  })

  it('never comes out empty', () => {
    expect(coverFileName('', '')).toBe('cover.jpg')
  })

  it('takes the extension it is given', () => {
    expect(coverFileName('A', 'B', '.png')).toBe('a-b.png')
  })
})

describe('extensionFromUrl', () => {
  it('reads the extension out of the url', () => {
    expect(extensionFromUrl('https://img/x.png')).toBe('.png')
    expect(extensionFromUrl('https://img/x.webp?v=2')).toBe('.webp')
  })

  it('normalises jpeg to jpg', () => {
    expect(extensionFromUrl('https://img/x.jpeg')).toBe('.jpg')
  })

  it('assumes jpg when the url says nothing', () => {
    expect(extensionFromUrl('https://img/cover')).toBe('.jpg')
  })
})

describe('albumInfoUrl and parseAlbumInfo', () => {
  it('asks album.getInfo for one specific record', () => {
    const url = albumInfoUrl('k', 'Radiohead', 'Kid A')
    expect(url).toContain('method=album.getinfo')
    expect(url).toContain('artist=Radiohead')
    expect(url).toContain('album=Kid+A')
  })

  it('takes the largest image last.fm offers', () => {
    expect(
      parseAlbumInfo({
        album: {
          image: [
            { '#text': 'https://img/small.jpg', size: 'small' },
            { '#text': 'https://img/xl.jpg', size: 'extralarge' },
          ],
        },
      }),
    ).toBe('https://img/xl.jpg')
  })

  it('returns nothing rather than throwing on rubbish', () => {
    for (const input of [null, undefined, {}, { album: {} }, { album: { image: 'x' } }]) {
      expect(parseAlbumInfo(input)).toBe('')
    }
  })
})
