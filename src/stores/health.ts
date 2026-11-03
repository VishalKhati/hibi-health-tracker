import { computed, reactive, watch } from 'vue'
import type { ActivityEntry, DayLog, DoseLog, FoodEntry, HibiData, SavedFood, Supplement, WeightEntry } from '../types'
import { dateKey, pastDays } from '../utils/date'
import { bodyMetrics as calculateBodyMetrics, estimateActivityCalories } from '../utils/health'
import { bestStreak, currentStreak, type DayResult } from '../utils/streaks'
import { defaults, normalize, uid } from './normalize'

const STORAGE_KEY = 'hibi-health-data-v1'
/** Mirrored outside the main blob so index.html can apply the theme before first paint. */
export const THEME_KEY = 'hibi-theme'

const load = (): HibiData => {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return value ? normalize(JSON.parse(value)) : defaults()
  } catch {
    return defaults()
  }
}

const data = reactive<HibiData>(load())
const selectedDate = reactive({ value: dateKey() })

watch(data, (value) => localStorage.setItem(STORAGE_KEY, JSON.stringify(value)), { deep: true })
watch(() => data.preferences.theme, (theme) => localStorage.setItem(THEME_KEY, theme), { immediate: true })

const groupByDate = <T extends { date: string }>(items: T[]) => {
  const map = new Map<string, T[]>()
  for (const item of items) {
    const list = map.get(item.date)
    if (list) list.push(item)
    else map.set(item.date, [item])
  }
  return map
}

const foodsByDate = computed(() => groupByDate(data.foods))
const activitiesByDate = computed(() => groupByDate(data.activities))
const dosesByDate = computed(() => groupByDate(data.doseLogs))
const dayLogByDate = computed(() => new Map<string, DayLog>(data.dayLogs.map((log) => [log.date, log])))

const weekday = (date: string) => new Date(`${date}T12:00:00`).getDay()

const dayStats = (date: string) => {
  const foods = foodsByDate.value.get(date) ?? []
  const activities = activitiesByDate.value.get(date) ?? []
  const log = dayLogByDate.value.get(date)
  const doses = dosesByDate.value.get(date) ?? []
  const scheduled = data.supplements.filter((item) => item.days.includes(weekday(date)))
  const taken = scheduled.filter((item) => doses.some((dose) => dose.supplementId === item.id && dose.status === 'taken')).length
  const goals = data.profile.goals
  const stats = {
    date,
    foodsLogged: foods.length,
    calories: foods.reduce((sum, item) => sum + item.calories, 0),
    protein: foods.reduce((sum, item) => sum + item.protein, 0),
    steps: log?.steps ?? 0,
    water: log?.water ?? 0,
    activityMinutes: activities.reduce((sum, item) => sum + item.duration, 0),
    caloriesBurned: activities.reduce((sum, item) => sum + (item.calories ?? 0), 0),
    supplementsScheduled: scheduled.length,
    supplementsTaken: taken,
    supplementRate: scheduled.length ? taken / scheduled.length : 0,
  }
  const checks = [stats.foodsLogged > 0, stats.steps >= goals.steps, stats.water >= goals.water, stats.activityMinutes >= goals.activityMinutes]
  return { ...stats, goalsMet: checks.filter(Boolean).length, goalChecks: checks.length }
}
export type DayStats = ReturnType<typeof dayStats>

/** Oldest date anything was logged; bounds streak and calendar scans. */
const earliestDate = computed(() => {
  let earliest = dateKey()
  for (const list of [data.foods, data.activities, data.dayLogs, data.doseLogs, data.weights]) {
    for (const item of list) if (item.date < earliest) earliest = item.date
  }
  return earliest
})

const sortedWeights = computed(() => [...data.weights].sort((a, b) => a.date.localeCompare(b.date)))
const latestWeight = computed(() => sortedWeights.value[sortedWeights.value.length - 1] as WeightEntry | undefined)
const bodyMetrics = computed(() => calculateBodyMetrics(data.profile.body, latestWeight.value?.kg))

const streakRules: { id: string; label: string; unit: string; isMet: (date: string) => DayResult; visible: () => boolean }[] = [
  { id: 'logging', label: 'Food logged', unit: 'day', isMet: (date) => dayStats(date).foodsLogged > 0, visible: () => true },
  { id: 'water', label: 'Water goal', unit: 'day', isMet: (date) => dayStats(date).water >= data.profile.goals.water, visible: () => true },
  { id: 'movement', label: 'Activity goal', unit: 'day', isMet: (date) => dayStats(date).activityMinutes >= data.profile.goals.activityMinutes, visible: () => true },
  {
    id: 'routine', label: 'Full routine', unit: 'day',
    isMet: (date) => {
      const stats = dayStats(date)
      return stats.supplementsScheduled ? stats.supplementsTaken === stats.supplementsScheduled : null
    },
    visible: () => data.supplements.length > 0,
  },
]

const streaks = computed(() => {
  const today = dateKey()
  return streakRules.filter((rule) => rule.visible()).map((rule) => ({
    id: rule.id,
    label: rule.label,
    current: currentStreak(rule.isMet, today, earliestDate.value),
    best: bestStreak(rule.isMet, today, earliestDate.value),
  }))
})

export const useHealthStore = () => {
  const foodsForDate = computed(() => foodsByDate.value.get(selectedDate.value) ?? [])
  const activitiesForDate = computed(() => activitiesByDate.value.get(selectedDate.value) ?? [])
  const todayTotals = computed(() => dayStats(selectedDate.value))

  const scheduledSupplements = computed(() => data.supplements.filter((item) => item.days.includes(weekday(selectedDate.value))))

  const addFood = (entry: Omit<FoodEntry, 'id' | 'createdAt'>, save = false) => {
    data.foods.push({ ...entry, id: uid(), createdAt: new Date().toISOString() })
    if (save && !data.savedFoods.some((item) => item.name.toLowerCase() === entry.name.toLowerCase())) {
      data.savedFoods.push({ id: uid(), name: entry.name, portion: entry.portion, calories: entry.calories, protein: entry.protein, barcode: entry.barcode })
    }
  }

  const addSavedFood = (food: SavedFood, meal: FoodEntry['meal']) =>
    addFood({ date: selectedDate.value, name: food.name, meal, portion: food.portion, calories: food.calories, protein: food.protein, barcode: food.barcode })

  /** Leaves user-entered calories alone; fills an estimate only when the field was blank and a weight is known. */
  const addActivity = (entry: Omit<ActivityEntry, 'id' | 'createdAt' | 'caloriesEstimated'>) => {
    const record: ActivityEntry = { ...entry, id: uid(), createdAt: new Date().toISOString() }
    if (typeof entry.calories !== 'number' && latestWeight.value) {
      const estimate = estimateActivityCalories(entry.type, entry.duration, latestWeight.value.kg, entry.distance)
      if (estimate > 0) Object.assign(record, { calories: estimate, caloriesEstimated: true })
    }
    data.activities.push(record)
  }

  const setDayValue = (field: 'steps' | 'water', value: number) => {
    let entry = data.dayLogs.find((item) => item.date === selectedDate.value)
    if (!entry) {
      entry = { date: selectedDate.value, steps: 0, water: 0 }
      data.dayLogs.push(entry)
    }
    entry[field] = Math.max(0, value)
  }

  /** One weight per day; logging again on the same date replaces it. */
  const logWeight = (date: string, kg: number) => {
    const existing = data.weights.find((entry) => entry.date === date)
    if (existing) existing.kg = kg
    else data.weights.push({ date, kg })
  }
  const removeWeight = (date: string) => { data.weights = data.weights.filter((entry) => entry.date !== date) }

  const addSupplement = (entry: Omit<Supplement, 'id'>) => data.supplements.push({ ...entry, id: uid() })

  const logDose = (supplementId: string, status: DoseLog['status']) => {
    const old = data.doseLogs.find((log) => log.supplementId === supplementId && log.date === selectedDate.value)
    if (old) old.status = status
    else data.doseLogs.push({ id: uid(), supplementId, date: selectedDate.value, status, createdAt: new Date().toISOString() })
  }

  const doseStatus = (supplementId: string) =>
    dosesByDate.value.get(selectedDate.value)?.find((log) => log.supplementId === supplementId)?.status

  const remove = (type: 'food' | 'activity' | 'supplement', id: string) => {
    const list = type === 'food' ? data.foods : type === 'activity' ? data.activities : data.supplements
    const index = list.findIndex((entry) => entry.id === id)
    if (index >= 0) list.splice(index, 1)
    if (type === 'supplement') data.doseLogs = data.doseLogs.filter((log) => log.supplementId !== id)
  }

  const week = computed(() => pastDays(7).map(dayStats))

  const exportData = () => JSON.stringify({ ...data, exportedAt: new Date().toISOString() }, null, 2)
  const importData = (raw: string) => {
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      throw new Error('This file is not valid JSON.')
    }
    Object.assign(data, normalize(parsed))
  }

  /**
   * Back to how Hibi starts on a new install: default goals and quick foods, no entries.
   * Theme and reminder settings stay, since this device's reminders are registered on the server.
   */
  const resetData = () => {
    Object.assign(data, { ...defaults(), preferences: data.preferences })
    selectedDate.value = dateKey()
  }

  return {
    data, selectedDate, foodsForDate, activitiesForDate, todayTotals, scheduledSupplements, week, dayStats,
    sortedWeights, latestWeight, bodyMetrics, streaks, earliestDate,
    addFood, addSavedFood, addActivity, setDayValue, logWeight, removeWeight, addSupplement, logDose, doseStatus, remove, exportData, importData, resetData,
  }
}
