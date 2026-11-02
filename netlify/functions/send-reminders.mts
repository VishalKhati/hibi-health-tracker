import type { Config } from '@netlify/functions'
import webpush from 'web-push'
import { dueReminders, type ReminderRecord } from '../../src/shared/reminders'
import { reminderStore, vapidReady } from './lib/reminder-store'

/** Runs every 5 minutes and sends each device the reminders that fell due since its last check. */
export default async () => {
  if (!vapidReady()) return
  const store = reminderStore()
  const now = Date.now()
  const { blobs } = await store.list()
  let sent = 0

  await Promise.all(blobs.map(async ({ key }) => {
    const record = await store.get(key, { type: 'json' }) as ReminderRecord | null
    if (!record) return
    const pushes = dueReminders(record, record.lastRunAt ?? now - 5 * 60_000, now)
    for (const push of pushes) {
      try {
        // Reminders are useless once stale, so let the push service drop them after 15 minutes.
        await webpush.sendNotification(record.subscription, JSON.stringify(push), { TTL: 900, urgency: 'high' })
        sent += 1
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode
        // 404/410: the browser unsubscribed or the app was uninstalled.
        if (status === 404 || status === 410) {
          await store.delete(key)
          return
        }
        console.error('push failed', status, (error as Error).message)
      }
    }
    await store.setJSON(key, { ...record, lastRunAt: now })
  }))

  console.log(`checked ${blobs.length} devices, sent ${sent} reminders`)
}

export const config: Config = { schedule: '*/5 * * * *' }
