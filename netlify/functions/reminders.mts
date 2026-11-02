import type { Config } from '@netlify/functions'
import { ReminderSyncSchema, type ReminderRecord } from '../../src/shared/reminders'
import { fail, json } from './lib/http'
import { keyFor, reminderStore, vapidReady } from './lib/reminder-store'

/**
 * GET    -> the VAPID public key the app needs to subscribe.
 * PUT    -> save this device's subscription, time zone and reminder schedule.
 * DELETE -> forget this device (body: { endpoint }).
 * Only times and supplement names are stored, never health logs.
 */
export default async (req: Request) => {
  if (!vapidReady()) return fail(503, 'Reminders aren’t set up on this server yet.')
  if (req.method === 'GET') return json({ publicKey: process.env.VAPID_PUBLIC_KEY })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return fail(400, 'Expected a JSON body.')
  }
  const store = reminderStore()

  if (req.method === 'DELETE') {
    const endpoint = (body as { endpoint?: unknown })?.endpoint
    if (typeof endpoint !== 'string') return fail(400, 'Missing endpoint.')
    await store.delete(keyFor(endpoint))
    return json({ ok: true })
  }

  const parsed = ReminderSyncSchema.safeParse(body)
  if (!parsed.success) return fail(400, 'Invalid reminder settings.')
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: parsed.data.timeZone })
  } catch {
    return fail(400, 'Unknown time zone.')
  }
  const key = keyFor(parsed.data.subscription.endpoint)
  const previous = await store.get(key, { type: 'json' }) as ReminderRecord | null
  const record: ReminderRecord = { ...parsed.data, updatedAt: Date.now(), lastRunAt: previous?.lastRunAt ?? Date.now() }
  await store.setJSON(key, record)
  return json({ ok: true })
}

export const config: Config = { path: '/api/reminders', method: ['GET', 'PUT', 'DELETE'] }
