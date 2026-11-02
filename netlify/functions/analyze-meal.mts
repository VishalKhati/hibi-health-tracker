import Anthropic from '@anthropic-ai/sdk'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import { getStore } from '@netlify/blobs'
import type { Config } from '@netlify/functions'
import { MealAnalysisSchema, type AnalyzeMealRequest, type MealAnalysis } from '../../src/shared/meal'
import { checkAccessCode, fail, json } from './lib/http'

const SYSTEM_PROMPT = `You estimate the nutrition of meals from photos for a personal food diary. The person reviews and edits your estimate before anything is logged, so give your best specific estimate and be honest about uncertainty rather than declining.

Identify each distinct food or drink that will be eaten. Treat a composite dish as one item when its parts are eaten together (a sandwich, a bowl of biryani) and list separate items when they sit separately on the plate (rice, dal and sabzi in a thali; rotis as one item with a count). The person eats a lot of Indian home cooking, so name regional dishes specifically (poha, rajma chawal, paneer bhurji, idli with sambar) and assume typical home-style oil or ghee unless the photo suggests otherwise.

For each item, estimate the portion using the plate, bowl, cutlery or hands as scale references. Give grams (millilitres for drinks), a short household description such as "2 medium rotis" or "1 katori (~150 g)", calories, and protein in grams, based on standard nutrition values for the dish as typically prepared. Use low confidence when the dish is ambiguous, partly hidden, or the amount is hard to judge, and put what you assumed in the note.

If the person's note gives quantities or ingredients, trust it over what you see. Skip plates, packaging and garnish-only bits. If the photo shows no food or drink, return no items and say so in the summary.`

const DAILY_LIMIT = Number(process.env.HIBI_DAILY_PHOTO_LIMIT ?? 60)
/** About 4 MB of base64; the app sends ~200-400 KB after resizing. */
const MAX_IMAGE_CHARS = 5_500_000
const MEDIA_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

/** Local QA only: set HIBI_MOCK_AI=1 to exercise the flow without spending API credit. */
const MOCK: MealAnalysis = {
  items: [
    { name: 'Rajma', portion: '1 katori (~150 g)', grams: 150, calories: 210, protein: 11, confidence: 'medium', note: 'Assumed home-style with a little oil.' },
    { name: 'Steamed rice', portion: '1 cup (~160 g)', grams: 160, calories: 205, protein: 4, confidence: 'high', note: '' },
    { name: 'Cucumber salad', portion: 'A few slices (~50 g)', grams: 50, calories: 8, protein: 0.3, confidence: 'low', note: 'Partly hidden behind the bowl.' },
  ],
  summary: 'Rajma chawal with a small salad.',
}

/** Bounds spend if the access code ever leaks. Best-effort: concurrent requests can race past by one or two. */
const withinDailyLimit = async () => {
  const store = getStore('hibi-usage')
  const key = `analyze-meal/${new Date().toISOString().slice(0, 10)}`
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
  const denied = checkAccessCode(req)
  if (denied) return denied

  let body: AnalyzeMealRequest
  try {
    body = await req.json() as AnalyzeMealRequest
  } catch {
    return fail(400, 'Expected a JSON body.')
  }
  if (typeof body.image !== 'string' || !body.image || body.image.length > MAX_IMAGE_CHARS) return fail(413, 'That photo is too large. Try again; the app shrinks photos before sending.')
  if (!MEDIA_TYPES.has(body.mediaType)) return fail(400, 'Unsupported image type.')
  const hint = typeof body.hint === 'string' ? body.hint.trim().slice(0, 300) : ''

  if (process.env.HIBI_MOCK_AI === '1') return json(MOCK)
  if (!process.env.ANTHROPIC_API_KEY) return fail(503, 'Photo analysis isn’t set up on this server yet (missing Anthropic API key).')
  if (!(await withinDailyLimit())) return fail(429, `Today’s limit of ${DAILY_LIMIT} photo analyses is used up. It resets at midnight UTC.`)

  // Netlify stops synchronous functions at 60 s; leave room to answer.
  const client = new Anthropic({ timeout: 50_000, maxRetries: 1 })
  try {
    const response = await client.beta.messages.parse({
      model: 'claude-opus-5-5',
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      // If a safety classifier declines, the API retries on Anthropic's recommended fallback model.
      fallbacks: 'default',
      output_config: { effort: 'medium', format: betaZodOutputFormat(MealAnalysisSchema) },
      system: SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: body.mediaType, data: body.image } },
          { type: 'text', text: hint ? `My note about this meal: ${hint}` : 'Estimate this meal.' },
        ],
      }],
    })

    if (response.stop_reason === 'refusal') return fail(422, 'This photo couldn’t be analyzed. Try another photo or add the food manually.')
    if (response.stop_reason === 'max_tokens' || !response.parsed_output) return fail(502, 'The estimate came back incomplete. Please try again.')
    return json(tidy(response.parsed_output))
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) return fail(503, 'The server’s Anthropic API key isn’t valid.')
    if (error instanceof Anthropic.RateLimitError) return fail(429, 'The AI service is busy. Wait a moment and try again.')
    if (error instanceof Anthropic.APIConnectionTimeoutError) return fail(504, 'The analysis took too long. Please try again.')
    if (error instanceof Anthropic.APIError) {
      console.error('Anthropic API error', error.status, error.message)
      return fail(502, 'The AI service returned an error. Please try again.')
    }
    console.error('analyze-meal failed', error)
    return fail(500, 'Something went wrong while analyzing the photo.')
  }
}

export const config: Config = { path: '/api/analyze-meal', method: 'POST' }
