import { describe, expect, it } from 'vitest'
import { resolveHideList } from './hide.ts'
import { loadListeningFile } from './file.ts'

describe('resolveHideList', () => {
  it('drops the empty scaffold slot', () => {
    expect(resolveHideList({ hide: [{ artist: '', track: '' }] })).toEqual([])
  })

  it('keeps a rule with either half filled in', () => {
    expect(resolveHideList({ hide: [{ artist: 'Sleep Sounds' }] })).toHaveLength(1)
    expect(resolveHideList({ hide: [{ artist: '', track: 'Rain' }] })).toHaveLength(1)
  })

  it('handles a missing file or list', () => {
    expect(resolveHideList(undefined)).toEqual([])
    expect(resolveHideList({})).toEqual([])
  })
})

describe('the committed content file', () => {
  it('parses, and hides nothing yet', () => {
    expect(resolveHideList(loadListeningFile())).toEqual([])
  })
})
