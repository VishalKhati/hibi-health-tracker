import { z } from 'zod'

/**
 * Shape Claude returns for a meal photo. Shared by the Netlify function (which validates
 * the model output against it) and the app (which imports only the types).
 */
export const MealItemSchema = z.object({
  name: z.string().describe('Common name of the dish or food, e.g. "Rajma chawal" or "Masala dosa".'),
  portion: z.string().describe('Household description of the eaten amount, e.g. "2 medium rotis" or "1 katori (~150 g)".'),
  grams: z.number().describe('Estimated weight in grams (millilitres for drinks).'),
  calories: z.number().describe('Estimated kilocalories for this portion.'),
  protein: z.number().describe('Estimated protein in grams for this portion.'),
  confidence: z.enum(['low', 'medium', 'high']).describe('How sure the identification and portion estimate are.'),
  note: z.string().describe('What was assumed (oil, ingredients, hidden parts), or an empty string.'),
})

export const MealAnalysisSchema = z.object({
  items: z.array(MealItemSchema),
  summary: z.string().describe('One or two sentences about the meal, or why no food could be identified.'),
})

export type MealItem = z.infer<typeof MealItemSchema>
export type MealAnalysis = z.infer<typeof MealAnalysisSchema>

/** Request body for POST /api/analyze-meal. */
export interface AnalyzeMealRequest {
  /** Base64 JPEG without the data: prefix. */
  image: string
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp'
  /** Optional free-text hint from the user, e.g. "2 rotis, dal has ghee". */
  hint?: string
}
