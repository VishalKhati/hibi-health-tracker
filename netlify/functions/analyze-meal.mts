import { createHash } from 'node:crypto'
import { getStore } from '@netlify/blobs'
import type { Config } from '@netlify/functions'
import type { AnalyzeMealRequest, MealAnalysis } from '../../src/shared/meal'
import { checkAccessCode, fail, json } from './lib/http'
import { VisionError } from './lib/meal-prompt'
import { estimateWithClaude } from './lib/vision-claude'
import { estimateWithGemini } from './lib/vision-gemini'

/** Per access code, so one person can't use up everyone's share. */
const DAILY_LIMIT = Number(process.env.HIBI_DAILY_PHOTO_LIMIT ?? 40)
/** About 4 MB of base64; the app sends ~200-400 KB after resizing. */
const MAX_IMAGE_CHARS = 5_500_000
const MEDIA_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

/** Gemini's free tier when its key is set; otherwise Claude if that key is set. */
const provider = () => (process.env.HIBI_MOCK_AI === '1' ? 'mock' : process.env.GEMINI_API_KEY ? 'gemini' : process.env.ANTHROPIC_API_KEY ? 'claude' : null)

/** Local QA only: set HIBI_MOCK_AI=1 to exercise the flow without calling a model. */
const MOCK: MealAnalysis = {
  items: [
    { name: 'Rajma', portion: '1 katori (~150 g)', grams: 150, calories: 210, protein: 11, confidence: 'medium', note: 'Assumed home-style with a little oil.' },
    { name: 'Steamed rice', portion: '1 cup (~160 g)', grams: 160, calories: 205, protein: 4, confidence: 'high', note: '' },
    { name: 'Cucumber salad', portion: 'A few slices (~50 g)', grams: 50, calories: 8, protein: 0.3, confidence: 'low', note: 'Partly hidden behind the bowl.' },
  ],
  summary: 'Rajma chawal with a small salad.',
}

/** Bounds use per code if one leaks. Best-effort: concurrent requests can race past by one or two. */
const withinDailyLimit = async (code: string) => {
  const store = getStore('hibi-usage')
  const who = createHash('sha256').update(code).digest('hex').slice(0, 12)
  const key = `analyze-meal/${new Date().toISOString().slice(0, 10)}/${who}`
  const used = Number((await store.get(key)) ?? 0)
  if (used >= DAILY_LIMIT) return false
  await store.set(key, String(used + 1))
  return true
}

const tidy = (analysis: MealAnalysis): MealAnalysis => ({
  summary: analysis.summary.trim(),
  items: analysis.items.map((item) => ({
    ...item,
    name: item.name.trim(),
    portion: item.portion.trim(),
    note: item.note.trim(),
    grams: Math.max(0, Math.round(item.grams)),
    calories: Math.max(0, Math.round(item.calories)),
    protein: Math.max(0, Math.round(item.protein * 10) / 10),
  })),
})

export default async (req: Request) => {
  // The app asks which service is configured so it can tell users where photos go.
  if (req.method === 'GET') return json({ provider: provider() })

  const access = checkAccessCode(req)
  if ('denied' in access) return access.denied

  let body: AnalyzeMealRequest
  try {
    body = await req.json() as AnalyzeMealRequest
  } catch {
    return fail(400, 'Expected a JSON body.')
  }
  if (typeof body.image !== 'string' || !body.image || body.image.length > MAX_IMAGE_CHARS) return fail(413, 'That photo is too large. Try again; the app shrinks photos before sending.')
  if (!MEDIA_TYPES.has(body.mediaType)) return fail(400, 'Unsupported image type.')
  const input = { image: body.image, mediaType: body.mediaType, hint: typeof body.hint === 'string' ? body.hint.trim().slice(0, 300) : '' }

  const service = provider()
  if (service === 'mock') return json(MOCK)
  if (!service) return fail(503, 'Photo estimates aren’t set up on this server yet (missing AI key).')
  if (!(await withinDailyLimit(access.code))) return fail(429, `Today’s limit of ${DAILY_LIMIT} photo estimates for this access code is used up. It resets at midnight UTC.`)

  try {
    return json(tidy(service === 'gemini' ? await estimateWithGemini(input) : await estimateWithClaude(input)))
  } catch (error) {
    if (error instanceof VisionError) return fail(error.status, error.message)
    console.error('analyze-meal failed', error)
    return fail(500, 'Something went wrong while analyzing the photo.')
  }
}

export const config: Config = { path: '/api/analyze-meal', method: ['GET', 'POST'] }
