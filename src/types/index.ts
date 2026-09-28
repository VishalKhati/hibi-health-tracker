export type Screen = 'today' | 'food' | 'activity' | 'supplements' | 'body' | 'progress' | 'settings'

export interface FoodEntry {
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

export interface SavedFood {
  id: string
  name: string
  portion: string
  calories: number
  protein: number
  barcode?: string
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

export interface Preferences {
  theme: Theme
}

export interface HibiData {
  version: 1
  profile: UserProfile
  preferences: Preferences
  foods: FoodEntry[]
  savedFoods: SavedFood[]
  activities: ActivityEntry[]
  supplements: Supplement[]
  doseLogs: DoseLog[]
  dayLogs: DayLog[]
  weights: WeightEntry[]
}
