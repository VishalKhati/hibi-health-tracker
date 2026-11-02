import { ApiError, GoogleGenAI } from '@google/genai'
import { z } from 'zod'
import { MealAnalysisSchema, type MealAnalysis } from '../../../src/shared/meal'
import { SYSTEM_PROMPT, userText, VisionError, type VisionInput } from './meal-prompt'

export const GEMINI_MODEL = process.env.GEMINI_MODEL ?? 'gemini-3.8-flash'

// Gemini accepts a subset of JSON Schema; the $schema marker isn't part of it.
const { $schema: _unused, ...responseJsonSchema } = z.toJSONSchema(MealAnalysisSchema) as Record<string, unknown>

/**
 * Free option: Gemini Flash on Google's free tier. Note that Google's free tier terms allow
 * submitted content to be used to improve Google's products; the app tells users this.
 */
export const estimateWithGemini = async ({ image, mediaType, hint }: VisionInput): Promise<MealAnalysis> => {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY, httpOptions: { timeout: 50_000 } })
  let text: string | undefined
  try {
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [{ role: 'user', parts: [{ inlineData: { mimeType: mediaType, data: image } }, { text: userText(hint) }] }],
      config: { systemInstruction: SYSTEM_PROMPT, responseMimeType: 'application/json', responseJsonSchema },
    })
    if (response.promptFeedback?.blockReason) throw new VisionError(422, 'This photo couldn’t be analyzed. Try another photo or add the food manually.')
    text = response.text
  } catch (error) {
    if (error instanceof VisionError) throw error
    if (error instanceof ApiError) {
      if (error.status === 429) throw new VisionError(429, 'The free photo-estimate quota is used up for now. Try again later, or add the food manually.')
      if (error.status === 401 || error.status === 403 || (error.status === 400 && /api key/i.test(error.message))) throw new VisionError(503, 'The server’s Gemini API key isn’t valid.')
      console.error('Gemini API error', error.status, error.message)
      throw new VisionError(502, 'The AI service returned an error. Please try again.')
    }
    if (error instanceof Error && /timed? ?out|abort/i.test(error.message)) throw new VisionError(504, 'The analysis took too long. Please try again.')
    throw error
  }
  let raw: unknown = null
  try {
    raw = text ? JSON.parse(text) : null
  } catch {
    // Falls through to the validation failure below.
  }
  const parsed = MealAnalysisSchema.safeParse(raw)
  if (!parsed.success) throw new VisionError(502, 'The estimate came back incomplete. Please try again.')
  return parsed.data
}
