import { describe, expect, it } from 'vitest'
import { normalize } from '../normalize'

const v1Backup = {
  version: 1,
  profile: { name: 'Aiko', goals: { calories: 2000, protein: 100, steps: 9000, water: 8, activityMinutes: 30 } },
  foods: [{ id: 'f1', date: '2026-09-20', name: 'Rice', meal: 'Lunch', portion: '1 bowl', calories: 200, protein: 4, createdAt: '' }],
  savedFoods: [],
  activities: [],
  supplements: [],
  doseLogs: [],
  dayLogs: [],
  exportedAt: '2026-09-20T10:00:00Z',
}

describe('normalize', () => {
  it('upgrades backups made before body tracking and themes existed', () => {
    const data = normalize(v1Backup)
    expect(data.profile.goals.calories).toBe(2000)
    expect(data.profile.body).toEqual({ activityLevel: 'light' })
    expect(data.preferences.theme).toBe('system')
    expect(data.preferences.reminders).toEqual({ water: { enabled: false, start: '09:00', end: '21:00', everyMinutes: 120 }, supplements: false })
    expect(data.weights).toEqual([])
    expect(data.foods).toHaveLength(1)
  })

  it('keeps saved reminder choices and fills new reminder fields', () => {
    const data = normalize({ ...v1Backup, preferences: { theme: 'dark', reminders: { supplements: true, water: { enabled: true } } } })
    expect(data.preferences.theme).toBe('dark')
    expect(data.preferences.reminders).toEqual({ supplements: true, water: { enabled: true, start: '09:00', end: '21:00', everyMinutes: 120 } })
  })

  it('drops keys that are not part of the data model', () => {
    expect(normalize(v1Backup)).not.toHaveProperty('exportedAt')
  })

  it('fills goals added in later versions without losing saved ones', () => {
    const data = normalize({ ...v1Backup, profile: { name: '', goals: { calories: 1800 } } })
    expect(data.profile.goals).toMatchObject({ calories: 1800, steps: 8000 })
  })

  it.each([
    ['not an object', 'hello'],
    ['the wrong version', { ...v1Backup, version: 2 }],
    ['no profile', { ...v1Backup, profile: undefined }],
  ])('rejects %s', (_, value) => {
    expect(() => normalize(value)).toThrow('not a valid Hibi backup')
  })

  it('rejects lists that are not arrays', () => {
    expect(() => normalize({ ...v1Backup, foods: {} })).toThrow('"foods" is not a list')
  })
})
