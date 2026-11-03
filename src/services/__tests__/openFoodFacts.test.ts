import { afterEach, describe, expect, it, vi } from 'vitest'
import { FoodLookupError, lookupBarcode, nutritionFor, toFoodProduct } from '../openFoodFacts'
import { searchFoods } from '../foodSearch'

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
  it('reports a busy Open Food Facts as a friendly error', async () => {
    respond(503, {})
    await expect(lookupBarcode('8901262150101')).rejects.toThrow(FoodLookupError)
    await expect(lookupBarcode('8901262150101')).rejects.toThrow('busy')
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

describe('food search', () => {
  it('asks Hibi’s server and marks results as estimates', async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ foods: [
      { name: 'Plain roti (phulka)', detail: 'Whole wheat, no oil', kcalPer100g: 247, proteinPer100g: 8.2, servingLabel: '1 medium roti', servingGrams: 35 },
      { name: 'Ghee', detail: 'Clarified butter', kcalPer100g: 900, proteinPer100g: 0, servingLabel: '', servingGrams: 0 },
    ] }), { status: 200 }))
    vi.stubGlobal('fetch', fetch)
    const [roti, ghee] = await searchFoods('roti & dal')
    expect(String((fetch.mock.calls[0] as unknown[])[0])).toBe('/api/food-search?q=roti%20%26%20dal')
    expect(roti).toEqual({ barcode: '', name: 'Plain roti (phulka)', brand: '', detail: 'Whole wheat, no oil', kcalPer100g: 247, proteinPer100g: 8.2, servingGrams: 35, servingLabel: '1 medium roti', estimated: true })
    expect(ghee.servingGrams).toBeUndefined()
    expect(nutritionFor(roti, 70)).toEqual({ calories: 173, protein: 5.7 })
  })

  it('shows the server’s error message', async () => {
    respond(429, { error: 'Today’s limit of 150 searches is used up.' })
    await expect(searchFoods('roti')).rejects.toThrow('limit of 150 searches')
  })
})
