import type { LabelReading, ReadLabelRequest, SharedProduct } from '../shared/product'
import { FoodLookupError, type FoodProduct } from './openFoodFacts'

/**
 * Products other Hibi users added from their labels. Missing, offline or failing all return
 * null, so the scan just moves on to Open Food Facts.
 */
export const findSharedProduct = async (barcode: string, signal?: AbortSignal): Promise<FoodProduct | null> => {
  try {
    const response = await fetch(`/api/products/${barcode}`, { signal, headers: { accept: 'application/json' } })
    if (!response.ok) return null
    const { product } = await response.json() as { product: SharedProduct }
    return { ...product, barcode }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    return null
  }
}

/** Best-effort: a failed share only means the next person reads the label too. */
export const shareProduct = (product: FoodProduct) => {
  const { name, brand, kcalPer100g, proteinPer100g, carbsPer100g, fatPer100g, fiberPer100g, servingGrams, servingLabel } = product
  return fetch(`/api/products/${product.barcode}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name, brand, kcalPer100g, proteinPer100g, carbsPer100g, fatPer100g, fiberPer100g, servingGrams, servingLabel }),
  }).then(() => undefined, () => undefined)
}

export const readLabel = async (request: ReadLabelRequest, signal?: AbortSignal): Promise<LabelReading> => {
  if (!navigator.onLine) throw new FoodLookupError('You’re offline. Reading a label needs an internet connection.')
  let response: Response
  try {
    response = await fetch('/api/read-label', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(request), signal })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new FoodLookupError('Couldn’t reach the server. Check your connection and try again.')
  }
  const body = await response.json().catch(() => null) as (LabelReading & { error?: string }) | null
  if (!response.ok || !body) throw new FoodLookupError(body?.error ?? `Reading the label failed (${response.status}).`)
  return body
}
