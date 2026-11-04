import { getStore } from '@netlify/blobs'
import type { Config, Context } from '@netlify/functions'
import { isBarcode, SharedProductSchema } from '../../src/shared/product'
import { fail, json } from './lib/http'
import { clientId, withinDailyLimit } from './lib/limits'

/** Products people added from their labels, shared by barcode so the next scan finds them. */
const DAILY_WRITES = Number(process.env.HIBI_DAILY_PRODUCT_WRITES ?? 50)

const codeFrom = (req: Request, context?: Context) =>
  context?.params?.code ?? new URL(req.url).pathname.split('/').pop() ?? ''

export default async (req: Request, context?: Context) => {
  const code = codeFrom(req, context)
  if (!isBarcode(code)) return fail(400, 'That isn’t a product barcode.')
  const store = getStore('hibi-products')

  if (req.method === 'GET') {
    const product = await store.get(code, { type: 'json' })
    return product ? json({ product }) : fail(404, 'Not found.')
  }

  // PUT: someone confirmed this product's values from its label.
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return fail(400, 'Expected a JSON body.')
  }
  const parsed = SharedProductSchema.safeParse(body)
  if (!parsed.success) return fail(400, 'Those product values don’t look right.')
  if (!(await withinDailyLimit('products', clientId(req, context), DAILY_WRITES))) return fail(429, 'Too many products added today.')
  await store.setJSON(code, { ...parsed.data, savedAt: new Date().toISOString() })
  return json({ ok: true })
}

export const config: Config = { path: '/api/products/:code', method: ['GET', 'PUT'] }
