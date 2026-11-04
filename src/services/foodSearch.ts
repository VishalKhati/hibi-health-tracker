import type { FoodSearchResponse } from '../shared/food'
import { FoodLookupError, type FoodProduct } from './openFoodFacts'

/**
 * Text search through Hibi's server, which asks Gemini for reference values (IFCT for Indian
 * foods, USDA otherwise). Results are estimates, so the app labels them that way.
 */
export const searchFoods = async (query: string, signal?: AbortSignal): Promise<FoodProduct[]> => {
  if (typeof navigator !== 'undefined' && !navigator.onLine) throw new FoodLookupError('You’re offline. Saved foods and manual entry still work.')
  let response: Response
  try {
    // Functions live at the domain root, whatever base path the app is served under.
    response = await fetch(`/api/food-search?q=${encodeURIComponent(query)}`, { signal, headers: { accept: 'application/json' } })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new FoodLookupError('Couldn’t reach the server. Check your connection and try again.')
  }
  const body = await response.json().catch(() => null) as (FoodSearchResponse & { error?: string }) | null
  if (!response.ok || !body) throw new FoodLookupError(body?.error ?? `Food search failed (${response.status}). Try again.`)
  return body.foods.map((food) => ({
    barcode: '',
    name: food.name,
    brand: '',
    detail: food.detail,
    kcalPer100g: food.kcalPer100g,
    proteinPer100g: food.proteinPer100g,
    carbsPer100g: food.carbsPer100g,
    fatPer100g: food.fatPer100g,
    fiberPer100g: food.fiberPer100g,
    servingGrams: food.servingGrams > 0 ? food.servingGrams : undefined,
    servingLabel: food.servingLabel || undefined,
    estimated: true,
  }))
}
