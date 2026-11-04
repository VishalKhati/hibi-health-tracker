import type { MacroBreakdown } from '../types'

export const round1 = (value: number) => Math.round(value * 10) / 10

export interface Nutrients extends MacroBreakdown {
  calories: number
  protein: number
}

/** Only the fields that are known, rounded, so entries without a breakdown stay without one. */
export const pickMacros = (source: MacroBreakdown): MacroBreakdown => {
  const out: MacroBreakdown = {}
  for (const key of ['carbs', 'fat', 'fiber'] as const) {
    const value = source[key]
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) out[key] = round1(value)
  }
  return out
}

export const hasBreakdown = (item: MacroBreakdown) => typeof item.carbs === 'number' || typeof item.fat === 'number'

/** "3g protein · 15g carbs · 0.4g fat" for list rows. */
export const macroLine = (item: Nutrients) => [
  `${round1(item.protein)}g protein`,
  typeof item.carbs === 'number' ? `${round1(item.carbs)}g carbs` : '',
  typeof item.fat === 'number' ? `${round1(item.fat)}g fat` : '',
].filter(Boolean).join(' · ')

/** Share of calories from protein, carbs and fat (4/4/9 kcal per gram), or null with nothing to split. */
export const calorieSplit = ({ protein, carbs = 0, fat = 0 }: Nutrients) => {
  const parts = { protein: protein * 4, carbs: carbs * 4, fat: fat * 9 }
  const total = parts.protein + parts.carbs + parts.fat
  if (!total) return null
  return { protein: parts.protein / total, carbs: parts.carbs / total, fat: parts.fat / total }
}
