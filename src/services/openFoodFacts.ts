/**
 * Open Food Facts client (https://world.openfoodfacts.org, data under ODbL), used for barcodes.
 * Text search goes through Hibi's own /api/food-search instead (see foodSearch.ts): Open Food
 * Facts' search is rate-limited, often down, and has few Indian home-cooked dishes.
 */
import type { KnownProduct } from '../types'

const BASE = 'https://world.openfoodfacts.org'
const FIELDS = 'code,product_name,brands,nutriments,serving_size,serving_quantity'

/** A food with per-100 g values: a barcode product, or a search result (estimated, no barcode). */
export interface FoodProduct extends KnownProduct {
  /** How it's prepared, for AI search results that have no brand. */
  detail?: string
  /** True for AI search results: reference values rather than a product label. */
  estimated?: boolean
}

interface RawProduct {
  code?: string
  product_name?: string
  brands?: string | string[]
  serving_size?: string
  serving_quantity?: number | string
  nutriments?: Record<string, number | string | undefined>
}

export class FoodLookupError extends Error {}

const number = (value: unknown) => {
  const parsed = typeof value === 'string' ? Number.parseFloat(value) : value
  return typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : undefined
}

/** Returns null for products without an energy value, which can't be logged meaningfully. */
export const toFoodProduct = (raw: RawProduct): FoodProduct | null => {
  const nutriments = raw.nutriments ?? {}
  const kcal = number(nutriments['energy-kcal_100g']) ?? (number(nutriments['energy_100g']) !== undefined ? number(nutriments['energy_100g'])! / 4.184 : undefined)
  const name = raw.product_name?.trim()
  if (kcal === undefined || !name) return null
  const brand = (Array.isArray(raw.brands) ? raw.brands[0] : raw.brands?.split(',')[0])?.trim() ?? ''
  const servingGrams = number(raw.serving_quantity)
  return {
    barcode: raw.code ?? '',
    name,
    brand,
    kcalPer100g: kcal,
    proteinPer100g: number(nutriments['proteins_100g']) ?? 0,
    ...defined({
      carbsPer100g: number(nutriments['carbohydrates_100g']),
      fatPer100g: number(nutriments['fat_100g']),
      fiberPer100g: number(nutriments['fiber_100g']),
    }),
    servingGrams: servingGrams && servingGrams > 0 ? servingGrams : undefined,
    servingLabel: raw.serving_size?.trim() || undefined,
  }
}

/** Drops undefined values, so products without a label value stay without the key. */
const defined = <T extends object>(values: T) => Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined)) as Partial<T>

const scale = (per100g: number, grams: number) => Math.round((per100g * grams) / 10) / 10

/** Nutrients for an amount; carbs, fat and fibre only when the product has them. */
export const nutritionFor = (product: FoodProduct, grams: number) => ({
  calories: Math.round((product.kcalPer100g * grams) / 100),
  protein: scale(product.proteinPer100g, grams),
  ...defined({
    carbs: product.carbsPer100g === undefined ? undefined : scale(product.carbsPer100g, grams),
    fat: product.fatPer100g === undefined ? undefined : scale(product.fatPer100g, grams),
    fiber: product.fiberPer100g === undefined ? undefined : scale(product.fiberPer100g, grams),
  }),
})

const request = async (url: string, signal?: AbortSignal) => {
  if (typeof navigator !== 'undefined' && !navigator.onLine) throw new FoodLookupError('You’re offline. Saved foods and manual entry still work.')
  let response: Response
  try {
    response = await fetch(url, { signal, headers: { Accept: 'application/json' } })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new FoodLookupError('Couldn’t reach Open Food Facts. Check your connection and try again.')
  }
  // Unknown barcodes come back either as 404 or as 200 with status 0; both mean "not found".
  if (response.status === 404) return {}
  if (response.status === 429 || response.status === 503) throw new FoodLookupError('Open Food Facts is busy right now. Wait a moment and try again.')
  if (!response.ok) throw new FoodLookupError(`Open Food Facts returned an error (${response.status}).`)
  return response.json()
}

export const lookupBarcode = async (barcode: string, signal?: AbortSignal): Promise<FoodProduct | null> => {
  const code = barcode.replace(/\D/g, '')
  if (code.length < 6) throw new FoodLookupError('That doesn’t look like a product barcode.')
  const body = await request(`${BASE}/api/v2/product/${code}.json?fields=${FIELDS}`, signal) as { status?: number; product?: RawProduct }
  return body.status === 1 && body.product ? toFoodProduct({ ...body.product, code: body.product.code ?? code }) : null
}
