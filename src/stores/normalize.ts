import type { HibiData, ReminderSettings } from '../types'

export const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`

export const defaultReminders = (): ReminderSettings => ({
  water: { enabled: false, start: '09:00', end: '21:00', everyMinutes: 120 },
  supplements: false,
})

export const defaults = (): HibiData => ({
  version: 1,
  profile: {
    name: '',
    goals: { calories: 2200, protein: 120, steps: 8000, water: 8, activityMinutes: 30 },
    body: { activityLevel: 'light' },
  },
  preferences: { theme: 'system', reminders: defaultReminders() },
  foods: [],
  savedFoods: [
    { id: uid(), name: 'Banana', portion: '1 medium', calories: 105, protein: 1, carbs: 27, fat: 0.4, fiber: 3.1 },
    { id: uid(), name: 'Greek yogurt', portion: '1 cup', calories: 130, protein: 17, carbs: 8, fat: 1, fiber: 0 },
    { id: uid(), name: 'Eggs', portion: '2 large', calories: 144, protein: 13, carbs: 1, fat: 10, fiber: 0 },
  ],
  products: [],
  activities: [],
  supplements: [],
  doseLogs: [],
  dayLogs: [],
  weights: [],
})

const LISTS = ['foods', 'savedFoods', 'products', 'activities', 'supplements', 'doseLogs', 'dayLogs', 'weights'] as const
const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

const normalizePreferences = (raw: unknown, base: HibiData['preferences']): HibiData['preferences'] => {
  const prefs = isObject(raw) ? raw : {}
  const reminders = isObject(prefs.reminders) ? prefs.reminders : {}
  return {
    ...base,
    ...prefs,
    reminders: {
      ...base.reminders,
      ...reminders,
      water: { ...base.reminders.water, ...(isObject(reminders.water) ? reminders.water : {}) },
    },
  } as HibiData['preferences']
}

/**
 * Accepts stored data or a backup from any earlier release and fills in fields added since,
 * so older backups keep importing. Throws if the value isn't Hibi data at all.
 */
export const normalize = (raw: unknown): HibiData => {
  if (!isObject(raw) || raw.version !== 1 || !isObject(raw.profile)) throw new Error('This is not a valid Hibi backup.')
  for (const key of LISTS) {
    if (raw[key] !== undefined && !Array.isArray(raw[key])) throw new Error(`This backup is damaged: "${key}" is not a list.`)
  }
  const base = defaults()
  const profile = raw.profile as Partial<HibiData['profile']>
  return {
    ...base,
    version: 1,
    profile: {
      name: typeof profile.name === 'string' ? profile.name : '',
      goals: { ...base.profile.goals, ...(isObject(profile.goals) ? profile.goals : {}) },
      body: { ...base.profile.body, ...(isObject(profile.body) ? profile.body : {}) },
    },
    preferences: normalizePreferences(raw.preferences, base.preferences),
    ...Object.fromEntries(LISTS.map((key) => [key, raw[key] ?? base[key]])),
  }
}
