export const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { 'cache-control': 'no-store' } })

export const fail = (status: number, error: string) => json({ error }, status)

/** Thrown by an AI provider with the HTTP status and message the app should see. */
export class AiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message)
  }
}
