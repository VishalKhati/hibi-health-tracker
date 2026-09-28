/**
 * Open Food Facts client (https://world.openfoodfacts.org, data under ODbL).
 * Only this host sends CORS headers for browser requests; search.openfoodfacts.org does not.
 */
const BASE = 'https://world.openfoodfacts.org'
const FIELDS = 'code,product_name,brands,nutriments,serving_size,serving_quantity'

export interface FoodProduct {
  barcode: string
  name: string
  brand: string
  kcalPer100g: number
  proteinPer100g: number
  /** Grams in one labelled serving, when the label gives one. */
  servingGrams?: number
  servingLabel?: string
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
    servingGrams: servingGrams && servingGrams > 0 ? servingGrams : undefined,
    servingLabel: raw.serving_size?.trim() || undefined,
  }
}

export const nutritionFor = (product: FoodProduct, grams: number) => ({
  calories: Math.round((product.kcalPer100g * grams) / 100),
  protein: Math.round((product.proteinPer100g * grams) / 10) / 10,
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
  // Search is limited to ~10 requests/minute per IP; the limiter answers 429 or a 503 HTML page.
  if (response.status === 429 || response.status === 503) throw new FoodLookupError('Food search is busy right now. Wait a moment and try again.')
  if (!response.ok) throw new FoodLookupError(`Open Food Facts returned an error (${response.status}).`)
  return response.json()
}

export const searchFoods = async (query: string, signal?: AbortSignal): Promise<FoodProduct[]> => {
  const params = new URLSearchParams({ search_terms: query, search_simple: '1', action: 'process', json: '1', page_size: '24', fields: FIELDS })
  const body = await request(`${BASE}/cgi/search.pl?${params}`, signal) as { products?: RawProduct[] }
  const seen = new Set<string>()
  return (body.products ?? []).map(toFoodProduct).filter((product): product is FoodProduct => {
    if (!product) return false
    const key = `${product.name}|${product.brand}`.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export const lookupBarcode = async (barcode: string, signal?: AbortSignal): Promise<FoodProduct | null> => {
  const code = barcode.replace(/\D/g, '')
  if (code.length < 6) throw new FoodLookupError('That doesn’t look like a product barcode.')
  const body = await request(`${BASE}/api/v2/product/${code}.json?fields=${FIELDS}`, signal) as { status?: number; product?: RawProduct }
  return body.status === 1 && body.product ? toFoodProduct({ ...body.product, code: body.product.code ?? code }) : null
}
