import { createHash } from 'node:crypto'
import { getStore } from '@netlify/blobs'
import type { Context } from '@netlify/functions'

/** The caller's IP, hashed before it's stored. Netlify passes it on the function context. */
export const clientId = (req: Request, context?: Pick<Context, 'ip'>) => {
  const ip = context?.ip || req.headers.get('x-nf-client-connection-ip') || 'unknown'
  return createHash('sha256').update(ip).digest('hex').slice(0, 12)
}

/**
 * Daily per-IP allowance, so one visitor can't use up the free AI quota for everyone.
 * Best-effort: concurrent requests can race past the limit by one or two.
 */
export const withinDailyLimit = async (bucket: string, who: string, limit: number) => {
  const store = getStore('hibi-usage')
  const key = `${bucket}/${new Date().toISOString().slice(0, 10)}/${who}`
  const used = Number((await store.get(key)) ?? 0)
  if (used >= limit) return false
  await store.set(key, String(used + 1))
  return true
}
