import type { Config, Context } from '@netlify/functions'
import type { AnalyzeMealRequest, MealAnalysis } from '../../src/shared/meal'
import { fail, json } from './lib/http'
import { clientId, withinDailyLimit } from './lib/limits'
import { VisionError } from './lib/meal-prompt'
import { estimateWithClaude } from './lib/vision-claude'
import { estimateWithGemini } from './lib/vision-gemini'

/** Per visitor (IP), so one person can't use up everyone's free quota. */
const DAILY_LIMIT = Number(process.env.HIBI_DAILY_PHOTO_LIMIT ?? 40)
/** About 4 MB of base64; the app sends ~200-400 KB after resizing. */
const MAX_IMAGE_CHARS = 5_500_000
const MEDIA_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

/** Gemini's free tier when its key is set; otherwise Claude if that key is set. */
const provider = () => (process.env.HIBI_MOCK_AI === '1' ? 'mock' : process.env.GEMINI_API_KEY ? 'gemini' : process.env.ANTHROPIC_API_KEY ? 'claude' : null)

/** Local QA only: set HIBI_MOCK_AI=1 to exercise the flow without calling a model. */
const MOCK: MealAnalysis = {
  items: [
    { name: 'Rajma', portion: '1 katori (~150 g)', grams: 150, calories: 210, protein: 11, carbs: 28, fat: 6, fiber: 8, confidence: 'medium', note: 'Assumed home-style with a little oil.' },
    { name: 'Steamed rice', portion: '1 cup (~160 g)', grams: 160, calories: 205, protein: 4, carbs: 45, fat: 0.4, fiber: 0.6, confidence: 'high', note: '' },
    { name: 'Cucumber salad', portion: 'A few slices (~50 g)', grams: 50, calories: 8, protein: 0.3, carbs: 1.8, fat: 0.1, fiber: 0.3, confidence: 'low', note: 'Partly hidden behind the bowl.' },
  ],
  summary: 'Rajma chawal with a small salad.',
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
    carbs: Math.max(0, Math.round(item.carbs * 10) / 10),
    fat: Math.max(0, Math.round(item.fat * 10) / 10),
    fiber: Math.max(0, Math.round(item.fiber * 10) / 10),
  })),
})

export default async (req: Request, context?: Context) => {
  // The app asks which service is configured so it can tell users where photos go.
  if (req.method === 'GET') return json({ provider: provider() })

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
  if (!(await withinDailyLimit('analyze-meal', clientId(req, context), DAILY_LIMIT))) return fail(429, `Today’s limit of ${DAILY_LIMIT} photo estimates is used up. It resets at 5:30 am India time.`)

  try {
    return json(tidy(service === 'gemini' ? await estimateWithGemini(input) : await estimateWithClaude(input)))
  } catch (error) {
    if (error instanceof VisionError) return fail(error.status, error.message)
    console.error('analyze-meal failed', error)
    return fail(500, 'Something went wrong while analyzing the photo.')
  }
}

export const config: Config = { path: '/api/analyze-meal', method: ['GET', 'POST'] }
