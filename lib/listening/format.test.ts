import { describe, expect, it } from 'vitest'
import { formatAsOf, onRepeatLabel } from './format.ts'
import { LISTENING_PERIOD } from './constants.ts'

describe('onRepeatLabel', () => {
  it('is derived from the period, so the label cannot claim a window it is not asking for', () => {
    expect(onRepeatLabel('1month')).toBe('on repeat · last 30 days')
    expect(onRepeatLabel('7day')).toBe('on repeat · last 7 days')
    expect(onRepeatLabel('3month')).toBe('on repeat · last 90 days')
  })

  it('says thirty days for the period the page actually uses', () => {
    expect(LISTENING_PERIOD).toBe('1month')
    expect(onRepeatLabel(LISTENING_PERIOD)).toContain('last 30 days')
  })
})

describe('formatAsOf', () => {
  it('reads as a month and a day, without a leading zero', () => {
    expect(formatAsOf('2026-09-23')).toBe('as of september 23')
    expect(formatAsOf('2026-03-04')).toBe('as of march 4')
  })

  it('says nothing rather than claiming a date it does not have', () => {
    for (const value of ['', undefined, 'yesterday', '2026-13-01', '2026-09-00', '2026-09']) {
      expect(formatAsOf(value)).toBe('')
    }
  })
})
