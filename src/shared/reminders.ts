import { z } from 'zod'

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM')

export const ReminderSettingsSchema = z.object({
  water: z.object({
    enabled: z.boolean(),
    start: time,
    end: time,
    everyMinutes: z.number().int().min(30).max(360),
  }),
  supplements: z.boolean(),
})

export const ReminderSupplementSchema = z.object({
  id: z.string().max(80),
  name: z.string().max(80),
  dosage: z.string().max(80),
  time,
  days: z.array(z.number().int().min(0).max(6)).max(7),
})

/** What a device sends to PUT /api/reminders. */
export const ReminderSyncSchema = z.object({
  subscription: z.object({
    endpoint: z.string().url().max(1000),
    keys: z.object({ p256dh: z.string().max(200), auth: z.string().max(100) }),
  }),
  timeZone: z.string().max(64),
  settings: ReminderSettingsSchema,
  supplements: z.array(ReminderSupplementSchema).max(40),
})

export type ReminderSettings = z.infer<typeof ReminderSettingsSchema>
export type ReminderSupplement = z.infer<typeof ReminderSupplementSchema>
export type ReminderSync = z.infer<typeof ReminderSyncSchema>
/** Stored per device; lastRunAt is the end of the last window that was checked. */
export type ReminderRecord = ReminderSync & { updatedAt: number; lastRunAt?: number }

export interface ReminderPush {
  tag: string
  title: string
  body: string
  /** Opened when the notification itself or its action is tapped. */
  url: string
  actions: { action: string; title: string; url: string }[]
}

const toMinutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5))
const WEEKDAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }

/** Wall-clock minute-of-day and weekday for an instant in the device's time zone. */
export const localClock = (utcMs: number, timeZone: string) => {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(new Date(utcMs))
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? ''
  return { weekday: WEEKDAYS[get('weekday')], minutes: Number(get('hour')) * 60 + Number(get('minute')) }
}

const MINUTE = 60_000
/** Never look back further than this, so a long outage doesn't fire a burst of stale reminders. */
export const MAX_LOOKBACK_MS = 30 * MINUTE

/**
 * Reminders whose scheduled minute falls in (fromMs, toMs], evaluated in the device's time zone
 * so DST and travel are handled by the zone database rather than by stored offsets.
 */
export const dueReminders = (record: Pick<ReminderRecord, 'timeZone' | 'settings' | 'supplements'>, fromMs: number, toMs: number): ReminderPush[] => {
  const pushes: ReminderPush[] = []
  const { water } = record.settings
  const waterStart = toMinutes(water.start)
  const waterEnd = toMinutes(water.end)
  const start = Math.max(fromMs, toMs - MAX_LOOKBACK_MS)

  for (let minute = Math.floor(start / MINUTE) * MINUTE + MINUTE; minute <= toMs; minute += MINUTE) {
    const { weekday, minutes } = localClock(minute, record.timeZone)
    const stamp = new Date(minute).toISOString().slice(0, 16)

    if (record.settings.supplements) {
      for (const item of record.supplements) {
        if (!item.days.includes(weekday) || toMinutes(item.time) !== minutes) continue
        const url = `./?action=take-supplement&id=${encodeURIComponent(item.id)}`
        pushes.push({
          tag: `supplement-${item.id}-${stamp}`,
          title: item.name,
          body: `${item.dosage} · ${item.time}`,
          url: './?screen=supplements',
          actions: [{ action: 'taken', title: 'Taken', url }],
        })
      }
    }

    if (water.enabled && minutes >= waterStart && minutes <= waterEnd && (minutes - waterStart) % water.everyMinutes === 0) {
      pushes.push({
        tag: `water-${stamp}`,
        title: 'Water break',
        body: 'Time for a glass of water.',
        url: './',
        actions: [{ action: 'add-water', title: '+1 glass', url: './?action=add-water' }],
      })
    }
  }
  return pushes
}
