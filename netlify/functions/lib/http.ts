import { createHash, timingSafeEqual } from 'node:crypto'

export const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { 'cache-control': 'no-store' } })

export const fail = (status: number, error: string) => json({ error }, status)

const digest = (value: string) => createHash('sha256').update(value).digest()

/**
 * The photo analyzer spends the owner's Anthropic credit, so it requires the access code
 * configured in HIBI_ACCESS_CODE. Hashing first keeps the comparison constant-time
 * regardless of input length.
 */
export const checkAccessCode = (req: Request): Response | null => {
  const expected = process.env.HIBI_ACCESS_CODE
  if (!expected) return fail(503, 'Photo analysis isn’t set up on this server yet (missing access code).')
  const given = req.headers.get('x-hibi-access-code') ?? ''
  if (!given || !timingSafeEqual(digest(given), digest(expected))) return fail(401, 'That access code isn’t right. Check it and enter it again.')
  return null
}
