import { describe, expect, it } from 'vitest'
import { dueReminders, localClock, MAX_LOOKBACK_MS, ReminderSyncSchema } from '../reminders'

const base = {
  timeZone: 'Asia/Kolkata',
  settings: { water: { enabled: false, start: '09:00', end: '21:00', everyMinutes: 120 }, supplements: true },
  supplements: [
    { id: 's1', name: 'Vitamin D3', dosage: '1 tablet', time: '08:00', days: [0, 1, 2, 3, 4, 5, 6] },
    { id: 's2', name: 'Omega 3', dosage: '2 capsules', time: '08:00', days: [1, 3, 5] },
  ],
}
// 2026-11-02 is a Monday. 08:00 IST = 02:30 UTC.
const at = (iso: string) => Date.parse(iso)

describe('localClock', () => {
  it('reads wall-clock time in the device time zone', () => {
    expect(localClock(at('2026-11-02T02:30:00Z'), 'Asia/Kolkata')).toEqual({ weekday: 1, minutes: 8 * 60 })
    expect(localClock(at('2026-11-02T02:30:00Z'), 'America/New_York')).toEqual({ weekday: 0, minutes: 21 * 60 + 30 })
  })
})

describe('dueReminders', () => {
  it('fires each supplement scheduled for that weekday and minute', () => {
    const pushes = dueReminders(base, at('2026-11-02T02:25:00Z'), at('2026-11-02T02:30:00Z'))
    expect(pushes.map((push) => push.title)).toEqual(['Vitamin D3', 'Omega 3'])
    expect(pushes[0]).toMatchObject({ body: '1 tablet · 08:00', actions: [{ action: 'taken', url: './?action=take-supplement&id=s1' }] })
  })

  it('skips days a supplement is not scheduled', () => {
    // Tuesday 08:00 IST: Omega 3 is Mon/Wed/Fri only.
    const pushes = dueReminders(base, at('2026-11-03T02:25:00Z'), at('2026-11-03T02:30:00Z'))
    expect(pushes.map((push) => push.title)).toEqual(['Vitamin D3'])
  })

  it('uses a window that excludes its start and includes its end, so runs never double-send', () => {
    expect(dueReminders(base, at('2026-11-02T02:30:00Z'), at('2026-11-02T02:35:00Z'))).toHaveLength(0)
  })

  it('sends nothing when supplement reminders are off', () => {
    const off = { ...base, settings: { ...base.settings, supplements: false } }
    expect(dueReminders(off, at('2026-11-02T02:25:00Z'), at('2026-11-02T02:30:00Z'))).toHaveLength(0)
  })

  it('spaces water reminders from the start time and stops after the end time', () => {
    const water = { ...base, supplements: [], settings: { supplements: false, water: { enabled: true, start: '09:00', end: '13:00', everyMinutes: 120 } } }
    // Simulate the scheduled function running every 5 minutes from 08:30 to 14:30 IST.
    const pushes = []
    for (let end = at('2026-11-02T03:05:00Z'); end <= at('2026-11-02T09:00:00Z'); end += 5 * 60_000) pushes.push(...dueReminders(water, end - 5 * 60_000, end))
    expect(pushes.map((push) => push.tag)).toEqual(['water-2026-11-02T03:30', 'water-2026-11-02T05:30', 'water-2026-11-02T07:30'])
  })

  it('caps the lookback so a long outage does not send a burst of stale reminders', () => {
    const water = { ...base, supplements: [], settings: { supplements: false, water: { enabled: true, start: '00:00', end: '23:59', everyMinutes: 30 } } }
    const end = at('2026-11-02T12:00:00Z')
    const pushes = dueReminders(water, end - 6 * 60 * 60_000, end)
    expect(pushes.length).toBeLessThanOrEqual(MAX_LOOKBACK_MS / (30 * 60_000) + 1)
  })

  it('follows daylight-saving changes through the time zone database', () => {
    const ny = { ...base, timeZone: 'America/New_York', supplements: [{ ...base.supplements[0] }] }
    // 08:00 New York is 12:00 UTC before the 2026-11-01 change and 13:00 UTC after it.
    expect(dueReminders(ny, at('2026-10-31T11:55:00Z'), at('2026-10-31T12:00:00Z'))).toHaveLength(1)
    expect(dueReminders(ny, at('2026-11-02T12:55:00Z'), at('2026-11-02T13:00:00Z'))).toHaveLength(1)
  })
})

describe('ReminderSyncSchema', () => {
  const valid = { subscription: { endpoint: 'https://fcm.googleapis.com/fcm/send/abc', keys: { p256dh: 'p', auth: 'a' } }, ...base }

  it('accepts a well-formed device payload', () => {
    expect(ReminderSyncSchema.safeParse(valid).success).toBe(true)
  })

  it.each([
    ['a malformed time', { ...valid, supplements: [{ ...base.supplements[0], time: '8am' }] }],
    ['too-frequent water reminders', { ...valid, settings: { ...base.settings, water: { ...base.settings.water, everyMinutes: 5 } } }],
    ['a non-URL endpoint', { ...valid, subscription: { ...valid.subscription, endpoint: 'nope' } }],
  ])('rejects %s', (_, payload) => {
    expect(ReminderSyncSchema.safeParse(payload).success).toBe(false)
  })
})
