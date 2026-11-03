import { z } from 'zod'

/**
 * One food from GET /api/food-search. Shared by the Netlify function (which validates the
 * model output against it) and the app (which imports only the types).
 */
export const FoodMatchSchema = z.object({
  name: z.string().describe('Common name, e.g. "Plain roti (phulka)" or "Amul Taaza toned milk".'),
  detail: z.string().describe('How it is prepared or what it is, in under 10 words.'),
  kcalPer100g: z.number().describe('Kilocalories per 100 g (100 ml for drinks) as eaten.'),
  proteinPer100g: z.number().describe('Protein in grams per 100 g (100 ml for drinks) as eaten.'),
  servingLabel: z.string().describe('One typical household serving, e.g. "1 medium roti", "1 katori", "1 glass".'),
  servingGrams: z.number().describe('Weight of that serving in grams (millilitres for drinks).'),
})

export const FoodSearchSchema = z.object({ foods: z.array(FoodMatchSchema) })

export type FoodMatch = z.infer<typeof FoodMatchSchema>
export interface FoodSearchResponse { foods: FoodMatch[] }
