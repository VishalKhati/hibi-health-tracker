import type { ReminderSettings } from '../shared/reminders'

export type Screen = 'today' | 'food' | 'activity' | 'supplements' | 'body' | 'progress' | 'settings'

/** Grams per entry. Optional: foods logged before v2.3 only have calories and protein. */
export interface MacroBreakdown {
  carbs?: number
  fat?: number
  fiber?: number
}

export interface FoodEntry extends MacroBreakdown {
  id: string
  date: string
  name: string
  meal: 'Breakfast' | 'Lunch' | 'Dinner' | 'Snack'
  portion: string
  calories: number
  protein: number
  barcode?: string
  createdAt: string
}

export interface SavedFood extends MacroBreakdown {
  id: string
  name: string
  portion: string
  calories: number
  protein: number
  barcode?: string
}

/** A packaged product's per-100 g values, remembered by barcode so a repeat scan works offline. */
export interface KnownProduct {
  barcode: string
  name: string
  brand: string
  kcalPer100g: number
  proteinPer100g: number
  carbsPer100g?: number
  fatPer100g?: number
  fiberPer100g?: number
  /** Grams in one labelled serving, when the label gives one. */
  servingGrams?: number
  servingLabel?: string
}

export interface ActivityEntry {
  id: string
  date: string
  type: 'Walk' | 'Run' | 'Gym' | 'Other'
  name: string
  duration: number
  distance?: number
  sets?: number
  reps?: number
  weight?: number
  calories?: number
  caloriesEstimated?: boolean
  createdAt: string
}

export interface Supplement {
  id: string
  name: string
  dosage: string
  time: string
  days: number[]
}

export interface DoseLog {
  id: string
  supplementId: string
  date: string
  status: 'taken' | 'skipped'
  createdAt: string
}

export interface DayLog {
  date: string
  steps: number
  water: number
}

export interface WeightEntry {
  date: string
  kg: number
}

export interface Goals {
  calories: number
  protein: number
  steps: number
  water: number
  activityMinutes: number
}

export type Sex = 'male' | 'female'
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'veryActive'

export interface BodyProfile {
  heightCm?: number
  birthYear?: number
  sex?: Sex
  activityLevel: ActivityLevel
}

export interface UserProfile {
  name: string
  goals: Goals
  body: BodyProfile
}

export type Theme = 'system' | 'light' | 'dark'

export type { ReminderSettings }

export interface Preferences {
  theme: Theme
  reminders: ReminderSettings
}

export interface HibiData {
  version: 1
  profile: UserProfile
  preferences: Preferences
  foods: FoodEntry[]
  savedFoods: SavedFood[]
  products: KnownProduct[]
  activities: ActivityEntry[]
  supplements: Supplement[]
  doseLogs: DoseLog[]
  dayLogs: DayLog[]
  weights: WeightEntry[]
}
