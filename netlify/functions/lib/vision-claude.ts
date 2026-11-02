import Anthropic from '@anthropic-ai/sdk'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import { MealAnalysisSchema, type MealAnalysis } from '../../../src/shared/meal'
import { SYSTEM_PROMPT, userText, VisionError, type VisionInput } from './meal-prompt'

/** Paid option: Claude Opus 5.5 with structured output. Used when ANTHROPIC_API_KEY is set and Gemini isn't. */
export const estimateWithClaude = async ({ image, mediaType, hint }: VisionInput): Promise<MealAnalysis> => {
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
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: image } },
          { type: 'text', text: userText(hint) },
        ],
      }],
    })
    if (response.stop_reason === 'refusal') throw new VisionError(422, 'This photo couldn’t be analyzed. Try another photo or add the food manually.')
    if (response.stop_reason === 'max_tokens' || !response.parsed_output) throw new VisionError(502, 'The estimate came back incomplete. Please try again.')
    return response.parsed_output
  } catch (error) {
    if (error instanceof VisionError) throw error
    if (error instanceof Anthropic.AuthenticationError) throw new VisionError(503, 'The server’s Anthropic API key isn’t valid.')
    if (error instanceof Anthropic.RateLimitError) throw new VisionError(429, 'The AI service is busy. Wait a moment and try again.')
    if (error instanceof Anthropic.APIConnectionTimeoutError) throw new VisionError(504, 'The analysis took too long. Please try again.')
    if (error instanceof Anthropic.APIError) {
      console.error('Anthropic API error', error.status, error.message)
      throw new VisionError(502, 'The AI service returned an error. Please try again.')
    }
    throw error
  }
}
