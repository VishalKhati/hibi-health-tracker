import { MealAnalysisSchema, type MealAnalysis } from '../../../src/shared/meal'
import { generateJson, geminiSchema, type ModelChoice } from './gemini'
import { SYSTEM_PROMPT, userText, VisionError, type VisionInput } from './meal-prompt'

/** GEMINI_MODEL overrides the first choice; the fallback covers Google's frequent "high demand" replies. */
export const PHOTO_MODELS: ModelChoice[] = [
  { model: process.env.GEMINI_MODEL ?? 'gemini-3.8-flash', timeoutMs: 28_000 },
  { model: 'gemini-3.5-flash', timeoutMs: 20_000 },
]

const responseSchema = geminiSchema(MealAnalysisSchema)

/**
 * Gemini Flash on Google's free tier. Google's free-tier terms allow submitted content to be
 * used to improve its products; the app tells users this before a photo is sent.
 */
export const estimateWithGemini = async ({ image, mediaType, hint }: VisionInput): Promise<MealAnalysis> => {
  const raw = await generateJson({
    models: PHOTO_MODELS,
    system: SYSTEM_PROMPT,
    parts: [{ inlineData: { mimeType: mediaType, data: image } }, { text: userText(hint) }],
    responseSchema,
    busyMessage: 'The free photo-estimate quota is used up or busy right now. Try again in a little while, or add the food manually.',
    blockedMessage: 'This photo couldn’t be analyzed. Try another photo or add the food manually.',
  })
  const parsed = MealAnalysisSchema.safeParse(raw)
  if (!parsed.success) throw new VisionError(502, 'The estimate came back incomplete. Please try again.')
  return parsed.data
}
