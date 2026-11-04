import { createHash } from 'node:crypto'
import { getStore } from '@netlify/blobs'
import type { Config, Context } from '@netlify/functions'
import { FoodSearchSchema, type FoodMatch } from '../../src/shared/food'
import { generateJson, geminiSchema, type ModelChoice } from './lib/gemini'
import { AiError, fail, json } from './lib/http'
import { clientId, withinDailyLimit } from './lib/limits'

/** Per visitor (IP). Cached searches don't count, since they don't call the model. */
const DAILY_LIMIT = Number(process.env.HIBI_DAILY_SEARCH_LIMIT ?? 150)
const CACHE_DAYS = 30

/** 3.5 Flash gives cooked-food values close to the reference tables; Lite is the fast fallback. */
export const SEARCH_MODELS: ModelChoice[] = [
  { model: process.env.GEMINI_SEARCH_MODEL ?? 'gemini-3.5-flash', timeoutMs: 18_000 },
  { model: 'gemini-3.5-flash-lite', timeoutMs: 10_000 },
]

export const SEARCH_PROMPT = `You are the food database behind a calorie tracker used mainly in India. For the search term, list up to 6 foods or dishes that match it, the most commonly eaten version first.

Values must be for the food as it is eaten: cooked, prepared or ready to drink, never raw flour, dry grains or uncooked ingredients. Base them on standard reference data: the Indian Food Composition Tables (IFCT 2017, National Institute of Nutrition) and typical home-style Indian recipes for Indian dishes, USDA FoodData Central for other foods, and the manufacturer's label for named packaged products. Give energy, protein, carbohydrate, fat and dietary fibre per 100 g, and one typical household serving (for example "1 medium roti", "1 katori", "1 glass") with its weight in grams (millilitres for drinks).

Only include a brand when the person searched for it. If the term is not a food, return an empty list.`

const responseSchema = geminiSchema(FoodSearchSchema)

/** Local QA only, with HIBI_MOCK_AI=1. */
const MOCK: FoodMatch[] = [
  { name: 'Plain roti (phulka)', detail: 'Whole wheat, cooked on a tawa without oil', kcalPer100g: 247, proteinPer100g: 8.2, carbsPer100g: 46, fatPer100g: 1.5, fiberPer100g: 6.5, servingLabel: '1 medium roti', servingGrams: 35 },
  { name: 'Roti with ghee', detail: 'Whole wheat roti brushed with ghee', kcalPer100g: 298, proteinPer100g: 7.5, carbsPer100g: 42, fatPer100g: 9, fiberPer100g: 6, servingLabel: '1 medium roti', servingGrams: 40 },
]

const round1 = (value: number) => Math.round(value * 10) / 10

/** Drops unusable rows and duplicates; numbers are rounded for display. */
export const tidyFoods = (foods: FoodMatch[]) => {
  const seen = new Set<string>()
  return foods.flatMap((food) => {
    const name = food.name.trim()
    const key = name.toLowerCase()
    if (!name || seen.has(key) || !(food.kcalPer100g > 0) || food.kcalPer100g > 950) return []
    seen.add(key)
    return [{
      name,
      detail: food.detail.trim(),
      kcalPer100g: Math.round(food.kcalPer100g),
      proteinPer100g: Math.max(0, round1(food.proteinPer100g)),
      carbsPer100g: Math.max(0, round1(food.carbsPer100g)),
      fatPer100g: Math.max(0, round1(food.fatPer100g)),
      fiberPer100g: Math.max(0, round1(food.fiberPer100g)),
      servingLabel: food.servingLabel.trim(),
      servingGrams: food.servingGrams > 0 ? Math.round(food.servingGrams) : 0,
    }]
  }).slice(0, 6)
}

export default async (req: Request, context?: Context) => {
  const query = (new URL(req.url).searchParams.get('q') ?? '').trim().replace(/\s+/g, ' ').slice(0, 60)
  if (query.length < 2) return fail(400, 'Type at least 2 letters to search.')

  // The same words give the same answer for everyone, and repeat searches are instant and free.
  const cache = getStore('hibi-food-search')
  const cacheKey = `v2/${createHash('sha256').update(query.toLowerCase()).digest('hex').slice(0, 24)}`
  const cached = await cache.get(cacheKey, { type: 'json' }) as { foods: FoodMatch[]; savedAt: number } | null
  if (cached && Date.now() - cached.savedAt < CACHE_DAYS * 86_400_000) return json({ foods: cached.foods })

  if (process.env.HIBI_MOCK_AI === '1') return json({ foods: MOCK })
  if (!process.env.GEMINI_API_KEY) return fail(503, 'Food search isn’t set up on this server yet (missing Gemini key).')
  if (!(await withinDailyLimit('food-search', clientId(req, context), DAILY_LIMIT))) return fail(429, `Today’s limit of ${DAILY_LIMIT} searches is used up. Saved foods and manual entry still work.`)

  let raw: unknown
  try {
    raw = await generateJson({
      models: SEARCH_MODELS,
      system: SEARCH_PROMPT,
      parts: [{ text: `Search term: ${query}` }],
      responseSchema,
      temperature: 0,
      busyMessage: 'Food search is busy right now. Wait a moment and try again.',
      blockedMessage: 'That search couldn’t be answered. Try different words.',
    })
  } catch (error) {
    if (error instanceof AiError) return fail(error.status, error.message)
    console.error('food-search failed', error)
    return fail(500, 'Something went wrong while searching.')
  }
  const parsed = FoodSearchSchema.safeParse(raw)
  if (!parsed.success) return fail(502, 'The search came back incomplete. Please try again.')

  const foods = tidyFoods(parsed.data.foods)
  if (foods.length) await cache.setJSON(cacheKey, { foods, savedAt: Date.now() })
  return json({ foods })
}

export const config: Config = { path: '/api/food-search', method: ['GET'] }
