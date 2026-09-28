import { describe, expect, it } from 'vitest'
import { addDays, dateKey, monthGrid, pastDays, weekdayShort } from '../date'

describe('date helpers', () => {
  it('uses the local calendar date, not UTC', () => {
    expect(dateKey(new Date(2026, 8, 27, 0, 30))).toBe('2026-09-27')
    expect(dateKey(new Date(2026, 8, 27, 23, 30))).toBe('2026-09-27')
  })

  it('adds days across month and year ends', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('lists the last N days ending today', () => {
    const days = pastDays(7)
    expect(days).toHaveLength(7)
    expect(days[6]).toBe(dateKey())
    expect(days[0]).toBe(addDays(dateKey(), -6))
  })

  it('names weekdays regardless of how the locale orders date parts', () => {
    expect(weekdayShort('2026-09-27')).toBe('Sun')
  })

  it('pads month grids to whole Sunday-first weeks', () => {
    const grid = monthGrid(2026, 8) // September 2026 starts on a Tuesday
    expect(grid.length % 7).toBe(0)
    expect(grid.slice(0, 3)).toEqual([null, null, '2026-09-01'])
    expect(grid.filter(Boolean)).toHaveLength(30)
  })
})
