import { createHash, timingSafeEqual } from 'node:crypto'

export const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { 'cache-control': 'no-store' } })

export const fail = (status: number, error: string) => json({ error }, status)

const digest = (value: string) => createHash('sha256').update(value).digest()

/** HIBI_ACCESS_CODE may hold several comma-separated codes, e.g. one per friend, so each can be revoked alone. */
export const accessCodes = () => (process.env.HIBI_ACCESS_CODE ?? '').split(',').map((code) => code.trim()).filter(Boolean)

/**
 * Photo estimates spend the owner's AI quota, so they require one of the configured access codes.
 * Every code is compared (constant-time on hashes) so timing doesn't reveal which ones exist.
 */
export const checkAccessCode = (req: Request): { denied: Response } | { code: string } => {
  const codes = accessCodes()
  if (!codes.length) return { denied: fail(503, 'Photo estimates aren’t set up on this server yet (missing access code).') }
  const given = digest(req.headers.get('x-hibi-access-code') ?? '')
  let match = ''
  for (const code of codes) if (timingSafeEqual(given, digest(code))) match = code
  return match ? { code: match } : { denied: fail(401, 'That access code isn’t right. Check it and enter it again.') }
}
