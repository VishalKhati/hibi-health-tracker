import { afterEach, describe, expect, it, vi } from 'vitest'
import { FoodLookupError, lookupBarcode, nutritionFor, searchFoods, toFoodProduct } from '../openFoodFacts'

afterEach(() => vi.unstubAllGlobals())

const respond = (status: number, body: unknown) => vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(body), { status })))

describe('toFoodProduct', () => {
  it('reads per-100 g values, brand, and serving size', () => {
    expect(toFoodProduct({
      code: '123', product_name: ' Greek yogurt ', brands: 'Chobani, Other',
      serving_size: '170 g', serving_quantity: '170',
      nutriments: { 'energy-kcal_100g': 59, proteins_100g: 10.2 },
    })).toEqual({ barcode: '123', name: 'Greek yogurt', brand: 'Chobani', kcalPer100g: 59, proteinPer100g: 10.2, servingGrams: 170, servingLabel: '170 g' })
  })

  it('converts kilojoules when kcal are missing', () => {
    expect(toFoodProduct({ product_name: 'Oats', nutriments: { energy_100g: 1569 } })?.kcalPer100g).toBeCloseTo(375, 0)
  })

  it('skips products with no name or energy value', () => {
    expect(toFoodProduct({ product_name: 'Mystery', nutriments: {} })).toBeNull()
    expect(toFoodProduct({ nutriments: { 'energy-kcal_100g': 100 } })).toBeNull()
  })
})

describe('nutritionFor', () => {
  it('scales per-100 g values to the portion', () => {
    const product = { barcode: '', name: 'Oats', brand: '', kcalPer100g: 375, proteinPer100g: 13.5 }
    expect(nutritionFor(product, 40)).toEqual({ calories: 150, protein: 5.4 })
  })
})

describe('API calls', () => {
  it('drops duplicate and unusable search results', async () => {
    respond(200, { products: [
      { code: '1', product_name: 'Paneer', brands: 'Amul', nutriments: { 'energy-kcal_100g': 290 } },
      { code: '2', product_name: 'Paneer', brands: 'Amul', nutriments: { 'energy-kcal_100g': 290 } },
      { code: '3', product_name: 'No energy', nutriments: {} },
    ] })
    expect((await searchFoods('paneer')).map((product) => product.barcode)).toEqual(['1'])
  })

  it('reports rate limiting as a friendly error', async () => {
    respond(503, {})
    await expect(searchFoods('paneer')).rejects.toThrow(FoodLookupError)
    await expect(searchFoods('paneer')).rejects.toThrow('busy')
  })

  it('returns null for an unknown barcode', async () => {
    respond(200, { status: 0 })
    expect(await lookupBarcode('0000000000123')).toBeNull()
    respond(404, { status: 0 })
    expect(await lookupBarcode('0000000000123')).toBeNull()
  })

  it('rejects input that is not a barcode before calling the API', async () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    await expect(lookupBarcode('12ab')).rejects.toThrow('doesn’t look like a product barcode')
    expect(fetch).not.toHaveBeenCalled()
  })
})
