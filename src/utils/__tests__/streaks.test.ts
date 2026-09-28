import { describe, expect, it } from 'vitest'
import { bestStreak, currentStreak, type DayResult } from '../streaks'

const days = (results: Record<string, DayResult>) => (date: string) => (date in results ? results[date] : false)

describe('currentStreak', () => {
  it('counts consecutive met days ending today', () => {
    const isMet = days({ '2026-09-25': true, '2026-09-26': true, '2026-09-27': true })
    expect(currentStreak(isMet, '2026-09-27', '2026-09-01')).toBe(3)
  })

  it('does not break because today is still unfinished', () => {
    const isMet = days({ '2026-09-25': true, '2026-09-26': true })
    expect(currentStreak(isMet, '2026-09-27', '2026-09-01')).toBe(2)
  })

  it('stops at the first missed day', () => {
    const isMet = days({ '2026-09-23': true, '2026-09-25': true, '2026-09-26': true })
    expect(currentStreak(isMet, '2026-09-26', '2026-09-01')).toBe(2)
  })

  it('skips days where nothing was due', () => {
    const isMet = days({ '2026-09-24': true, '2026-09-25': null, '2026-09-26': true })
    expect(currentStreak(isMet, '2026-09-26', '2026-09-01')).toBe(2)
  })

  it('crosses month boundaries', () => {
    const isMet = days({ '2026-08-31': true, '2026-09-01': true })
    expect(currentStreak(isMet, '2026-09-01', '2026-08-01')).toBe(2)
  })
})

describe('bestStreak', () => {
  it('returns the longest run in history', () => {
    const isMet = days({
      '2026-09-01': true, '2026-09-02': true, '2026-09-03': true, '2026-09-04': true,
      '2026-09-06': true, '2026-09-07': true,
    })
    expect(bestStreak(isMet, '2026-09-07', '2026-09-01')).toBe(4)
  })

  it('is zero with no met days', () => {
    expect(bestStreak(() => false, '2026-09-07', '2026-09-01')).toBe(0)
  })
})
