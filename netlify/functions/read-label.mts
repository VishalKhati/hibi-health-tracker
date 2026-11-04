import type { Config, Context } from '@netlify/functions'
import { LabelReadingSchema, type LabelReading, type ReadLabelRequest } from '../../src/shared/product'
import { generateJson, geminiSchema, type ModelChoice } from './lib/gemini'
import { AiError, fail, json } from './lib/http'
import { clientId, withinDailyLimit } from './lib/limits'

const DAILY_LIMIT = Number(process.env.HIBI_DAILY_LABEL_LIMIT ?? 40)
const MAX_IMAGE_CHARS = 5_500_000
const MEDIA_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

/**
 * Copying printed numbers doesn't need the bigger models: Lite read a test label exactly in
 * under 2 s, where 3.5 Flash took over 20 s. The person checks every value before using it.
 */
export const LABEL_MODELS: ModelChoice[] = [
  { model: 'gemini-3.5-flash-lite', timeoutMs: 15_000 },
  { model: 'gemini-3.5-flash', timeoutMs: 28_000 },
]

export const LABEL_PROMPT = `You read the nutrition information table on a photo of a packaged food or drink, for a calorie tracker. Copy the numbers exactly as printed; do not estimate from the product type.

Report values per 100 g, or per 100 ml for drinks. Indian labels print a per-100 g (or ml) column; use it. If a label only gives values per serving, convert them to per 100 using the printed serving size. If energy is only given in kJ, divide by 4.184. Use total carbohydrate (not just sugars) and total fat.

Also copy the product name, brand and serving size if they are visible. If no nutrition table is visible, or it is too blurry or cut off to read the energy, protein, carbohydrate and fat values, set readable to false and explain in the note.`

const responseSchema = geminiSchema(LabelReadingSchema)

const MOCK: LabelReading = {
  readable: true, name: 'Masala oats', brand: 'Saffola', unit: 'g',
  kcalPer100: 380, proteinPer100: 10.5, carbsPer100: 66, fatPer100: 8.2, fiberPer100: 7.5, servingSize: 40, note: '',
}

export default async (req: Request, context?: Context) => {
  let body: ReadLabelRequest
  try {
    body = await req.json() as ReadLabelRequest
  } catch {
    return fail(400, 'Expected a JSON body.')
  }
  if (typeof body.image !== 'string' || !body.image || body.image.length > MAX_IMAGE_CHARS) return fail(413, 'That photo is too large. Try again; the app shrinks photos before sending.')
  if (!MEDIA_TYPES.has(body.mediaType)) return fail(400, 'Unsupported image type.')

  if (process.env.HIBI_MOCK_AI === '1') return json(MOCK)
  if (!process.env.GEMINI_API_KEY) return fail(503, 'Label reading isn’t set up on this server yet (missing Gemini key).')
  if (!(await withinDailyLimit('read-label', clientId(req, context), DAILY_LIMIT))) return fail(429, `Today’s limit of ${DAILY_LIMIT} label photos is used up. You can still type the values under “New”.`)

  let raw: unknown
  try {
    raw = await generateJson({
      models: LABEL_MODELS,
      system: LABEL_PROMPT,
      parts: [{ inlineData: { mimeType: body.mediaType, data: body.image } }, { text: 'Read this nutrition label.' }],
      responseSchema,
      temperature: 0,
      busyMessage: 'Label reading is busy right now. Try again in a little while, or type the values under “New”.',
      blockedMessage: 'This photo couldn’t be read. Try another photo of the label.',
    })
  } catch (error) {
    if (error instanceof AiError) return fail(error.status, error.message)
    console.error('read-label failed', error)
    return fail(500, 'Something went wrong while reading the label.')
  }
  const parsed = LabelReadingSchema.safeParse(raw)
  if (!parsed.success) return fail(502, 'The label reading came back incomplete. Please try again.')
  return json({ ...parsed.data, name: parsed.data.name.trim(), brand: parsed.data.brand.trim(), note: parsed.data.note.trim() })
}

export const config: Config = { path: '/api/read-label', method: ['POST'] }
