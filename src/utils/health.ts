import type { ActivityEntry, ActivityLevel, BodyProfile, Goals, Sex, WeightEntry } from '../types'

export const ACTIVITY_LEVELS: Record<ActivityLevel, { label: string; hint: string; factor: number }> = {
  sedentary: { label: 'Sedentary', hint: 'Desk job, little exercise', factor: 1.2 },
  light: { label: 'Lightly active', hint: 'Exercise 1–3 days a week', factor: 1.375 },
  moderate: { label: 'Moderately active', hint: 'Exercise 3–5 days a week', factor: 1.55 },
  active: { label: 'Very active', hint: 'Hard exercise 6–7 days a week', factor: 1.725 },
  veryActive: { label: 'Extra active', hint: 'Physical job or twice-daily training', factor: 1.9 },
}

export const GLASS_ML = 250

const round = (value: number, step = 1) => Math.round(value / step) * step

export const ageFromBirthYear = (birthYear: number, today = new Date()) => today.getFullYear() - birthYear

export const bmi = (kg: number, heightCm: number) => {
  const metres = heightCm / 100
  return kg / (metres * metres)
}

export type BmiBand = 'under' | 'healthy' | 'over' | 'obese'

/** WHO adult bands. */
export const bmiBand = (value: number): { band: BmiBand; label: string } =>
  value < 18.5 ? { band: 'under', label: 'Underweight' }
    : value < 25 ? { band: 'healthy', label: 'Healthy range' }
      : value < 30 ? { band: 'over', label: 'Overweight' }
        : { band: 'obese', label: 'Obese' }

/** Weight range that keeps BMI between 18.5 and 24.9 at this height. */
export const healthyWeightRange = (heightCm: number) => {
  const metres = heightCm / 100
  return { min: 18.5 * metres * metres, max: 24.9 * metres * metres }
}

/** Mifflin-St Jeor resting energy expenditure, kcal/day. */
export const bmr = (kg: number, heightCm: number, age: number, sex: Sex) =>
  10 * kg + 6.25 * heightCm - 5 * age + (sex === 'male' ? 5 : -161)

export const tdee = (bmrValue: number, level: ActivityLevel) => bmrValue * ACTIVITY_LEVELS[level].factor

/** 1.2 g/kg for lighter activity, 1.6 g/kg once training is regular. */
export const proteinPerKg = (level: ActivityLevel) => (level === 'sedentary' || level === 'light' ? 1.2 : 1.6)

/** 35 ml per kg of body weight, expressed in 250 ml glasses. */
export const waterGlasses = (kg: number) => Math.max(1, Math.round((kg * 35) / GLASS_ML))

export interface BodyMetrics {
  age: number
  bmi: number
  bmr: number
  tdee: number
  protein: number
  water: number
}

/** Everything that needs a complete profile plus a weight; null until both exist. */
export const bodyMetrics = (body: BodyProfile, kg: number | undefined, today = new Date()): BodyMetrics | null => {
  if (!kg || !body.heightCm || !body.birthYear || !body.sex) return null
  const age = ageFromBirthYear(body.birthYear, today)
  const rest = bmr(kg, body.heightCm, age, body.sex)
  return {
    age,
    bmi: bmi(kg, body.heightCm),
    bmr: rest,
    tdee: tdee(rest, body.activityLevel),
    protein: kg * proteinPerKg(body.activityLevel),
    water: waterGlasses(kg),
  }
}

export const suggestedGoals = (metrics: BodyMetrics): Pick<Goals, 'calories' | 'protein' | 'water'> => ({
  calories: round(metrics.tdee, 50),
  protein: round(metrics.protein, 5),
  water: metrics.water,
})

// MET values from the 2011 Compendium of Physical Activities.
const WALK_METS: [maxKmh: number, met: number][] = [[3.2, 2.0], [4.0, 2.8], [5.0, 3.5], [5.8, 4.3], [6.8, 5.0], [Infinity, 7.0]]
const RUN_METS: [maxKmh: number, met: number][] = [[7.2, 6.0], [8.8, 8.3], [10.3, 9.8], [11.0, 10.5], [11.7, 11.0], [12.5, 11.5], [13.3, 11.8], [14.1, 12.3], [15.3, 12.8], [Infinity, 14.5]]
const DEFAULT_METS: Record<ActivityEntry['type'], number> = { Walk: 3.5, Run: 9.8, Gym: 3.5, Other: 4.0 }

export const activityMet = (type: ActivityEntry['type'], minutes: number, distanceKm?: number) => {
  const table = type === 'Walk' ? WALK_METS : type === 'Run' ? RUN_METS : null
  if (!table || !distanceKm || minutes <= 0) return DEFAULT_METS[type]
  const kmh = distanceKm / (minutes / 60)
  return table.find(([maxKmh]) => kmh < maxKmh)![1]
}

/** Gross energy cost: MET × body weight (kg) × hours. */
export const estimateActivityCalories = (type: ActivityEntry['type'], minutes: number, kg: number, distanceKm?: number) =>
  minutes > 0 && kg > 0 ? Math.round(activityMet(type, minutes, distanceKm) * kg * (minutes / 60)) : 0

const dayNumber = (key: string) => Date.UTC(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, Number(key.slice(8, 10))) / 86_400_000

/**
 * Trailing time-window average: each entry is averaged with every entry logged in the
 * `days` days ending on its date, so gaps in logging don't distort the line.
 */
export const movingAverage = (entries: WeightEntry[], days = 7) => {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date))
  return sorted.map((entry, index) => {
    const end = dayNumber(entry.date)
    let sum = 0
    let count = 0
    for (let i = index; i >= 0 && end - dayNumber(sorted[i].date) < days; i -= 1) {
      sum += sorted[i].kg
      count += 1
    }
    return { date: entry.date, kg: sum / count }
  })
}
