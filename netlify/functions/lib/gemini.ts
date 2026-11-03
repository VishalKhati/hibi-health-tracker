import { ApiError, GoogleGenAI, type Part } from '@google/genai'
import { z } from 'zod'
import { AiError } from './http'

export interface ModelChoice { model: string; timeoutMs: number }

/** Overload (503), per-model quota (429) and timeouts move on to the next model in the list. */
const RETRYABLE = new Set([429, 500, 503, 504])

/** Gemini accepts a subset of JSON Schema; the $schema marker isn't part of it. */
export const geminiSchema = (schema: z.ZodType) => {
  const { $schema: _unused, ...rest } = z.toJSONSchema(schema) as Record<string, unknown>
  return rest
}

interface JsonRequest {
  models: ModelChoice[]
  system: string
  parts: Part[]
  responseSchema: Record<string, unknown>
  temperature?: number
  /** Shown when every model is out of quota or overloaded. */
  busyMessage: string
  blockedMessage: string
}

/**
 * Asks Gemini for JSON matching the schema and returns the parsed value (null when the reply
 * isn't JSON). Google often answers "high demand" for its newest model, so this falls back
 * through the list instead of failing the request.
 */
export const generateJson = async ({ models, system, parts, responseSchema, temperature, busyMessage, blockedMessage }: JsonRequest): Promise<unknown> => {
  let lastStatus = 503
  for (const { model, timeoutMs } of models) {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY, httpOptions: { timeout: timeoutMs } })
    try {
      const response = await ai.models.generateContent({
        model,
        contents: [{ role: 'user', parts }],
        config: { systemInstruction: system, responseMimeType: 'application/json', responseJsonSchema: responseSchema, ...(temperature === undefined ? {} : { temperature }) },
      })
      if (response.promptFeedback?.blockReason) throw new AiError(422, blockedMessage)
      try {
        return response.text ? JSON.parse(response.text) : null
      } catch {
        return null
      }
    } catch (error) {
      if (error instanceof AiError) throw error
      if (error instanceof ApiError) {
        if (error.status === 401 || error.status === 403 || (error.status === 400 && /api key/i.test(error.message))) throw new AiError(503, 'The server’s Gemini API key isn’t valid.')
        if (!RETRYABLE.has(error.status)) {
          console.error('Gemini API error', model, error.status, error.message)
          throw new AiError(502, 'The AI service returned an error. Please try again.')
        }
        console.warn('Gemini unavailable, trying the next model', model, error.status)
        lastStatus = error.status
        continue
      }
      if (error instanceof Error && /timed? ?out|abort/i.test(error.message)) {
        console.warn('Gemini timed out, trying the next model', model)
        lastStatus = 504
        continue
      }
      throw error
    }
  }
  throw new AiError(lastStatus === 504 ? 504 : lastStatus === 429 ? 429 : 503, busyMessage)
}
