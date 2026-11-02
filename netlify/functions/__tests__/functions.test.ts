import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// In-memory stand-in for Netlify Blobs, shared across stores by name.
const stores = new Map<string, Map<string, string>>()
vi.mock('@netlify/blobs', () => ({
  getStore: (options: string | { name: string }) => {
    const name = typeof options === 'string' ? options : options.name
    if (!stores.has(name)) stores.set(name, new Map())
    const data = stores.get(name)!
    return {
      get: async (key: string, opts?: { type?: string }) => (data.has(key) ? (opts?.type === 'json' ? JSON.parse(data.get(key)!) : data.get(key)) : null),
      set: async (key: string, value: string) => { data.set(key, value) },
      setJSON: async (key: string, value: unknown) => { data.set(key, JSON.stringify(value)) },
      delete: async (key: string) => { data.delete(key) },
      list: async () => ({ blobs: [...data.keys()].map((key) => ({ key })) }),
    }
  },
}))

const sendNotification = vi.fn()
vi.mock('web-push', () => ({ default: { setVapidDetails: vi.fn(), sendNotification } }))

const { default: analyzeMeal } = await import('../analyze-meal.mts')
const { default: reminders } = await import('../reminders.mts')
const { default: sendReminders } = await import('../send-reminders.mts')

const post = (body: unknown, code?: string) => new Request('https://hibi.test/api/analyze-meal', {
  method: 'POST',
  headers: { 'content-type': 'application/json', ...(code ? { 'x-hibi-access-code': code } : {}) },
  body: JSON.stringify(body),
})
const photo = { image: 'aGVsbG8=', mediaType: 'image/jpeg' }

beforeEach(() => {
  stores.clear()
  sendNotification.mockReset()
  vi.stubEnv('HIBI_ACCESS_CODE', 'secret-code')
  vi.stubEnv('HIBI_MOCK_AI', '1')
  vi.stubEnv('VAPID_PUBLIC_KEY', 'public-key')
  vi.stubEnv('VAPID_PRIVATE_KEY', 'private-key')
})
afterEach(() => vi.unstubAllEnvs())

describe('analyze-meal', () => {
  it('requires the access code', async () => {
    expect((await analyzeMeal(post(photo))).status).toBe(401)
    expect((await analyzeMeal(post(photo, 'wrong'))).status).toBe(401)
  })

  it('reports a missing server setup instead of failing open', async () => {
    vi.stubEnv('HIBI_ACCESS_CODE', '')
    expect((await analyzeMeal(post(photo, 'anything'))).status).toBe(503)
  })

  it('validates the photo before calling the model', async () => {
    expect((await analyzeMeal(post({ ...photo, mediaType: 'image/gif' }, 'secret-code'))).status).toBe(400)
    expect((await analyzeMeal(post({ ...photo, image: '' }, 'secret-code'))).status).toBe(413)
  })

  it('returns an editable estimate', async () => {
    const response = await analyzeMeal(post(photo, 'secret-code'))
    expect(response.status).toBe(200)
    const body = await response.json() as { items: Record<string, unknown>[] }
    expect(body.items.length).toBeGreaterThan(0)
    expect(body.items[0]).toEqual(expect.objectContaining({ name: expect.any(String), calories: expect.any(Number), confidence: expect.any(String) }))
  })

  it('needs an API key outside mock mode', async () => {
    vi.stubEnv('HIBI_MOCK_AI', '')
    vi.stubEnv('ANTHROPIC_API_KEY', '')
    expect((await analyzeMeal(post(photo, 'secret-code'))).status).toBe(503)
  })
})

const device = {
  subscription: { endpoint: 'https://push.example/abc', keys: { p256dh: 'p', auth: 'a' } },
  timeZone: 'Asia/Kolkata',
  settings: { water: { enabled: false, start: '09:00', end: '21:00', everyMinutes: 120 }, supplements: true },
  supplements: [{ id: 's1', name: 'Vitamin D3', dosage: '1 tablet', time: '08:00', days: [0, 1, 2, 3, 4, 5, 6] }],
}
const call = (method: string, body?: unknown) => reminders(new Request('https://hibi.test/api/reminders', { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }))

describe('reminders API', () => {
  it('serves the public key', async () => {
    expect(await (await call('GET')).json()).toEqual({ publicKey: 'public-key' })
  })

  it('stores one record per device and replaces it on update', async () => {
    expect((await call('PUT', device)).status).toBe(200)
    expect((await call('PUT', { ...device, supplements: [] })).status).toBe(200)
    const saved = [...stores.get('hibi-reminders')!.values()].map((value) => JSON.parse(value))
    expect(saved).toHaveLength(1)
    expect(saved[0].supplements).toEqual([])
  })

  it('rejects invalid schedules and unknown time zones', async () => {
    expect((await call('PUT', { ...device, settings: { ...device.settings, water: { ...device.settings.water, start: '25:00' } } })).status).toBe(400)
    expect((await call('PUT', { ...device, timeZone: 'Mars/Olympus' })).status).toBe(400)
  })

  it('forgets a device on DELETE', async () => {
    await call('PUT', device)
    await call('DELETE', { endpoint: device.subscription.endpoint })
    expect(stores.get('hibi-reminders')!.size).toBe(0)
  })
})

describe('send-reminders', () => {
  it('sends due reminders, advances the window, and drops uninstalled devices', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-02T02:25:00Z')) // 07:55 in India
    await call('PUT', device)
    await call('PUT', { ...device, subscription: { ...device.subscription, endpoint: 'https://push.example/gone' } })

    vi.setSystemTime(new Date('2026-11-02T02:30:00Z')) // 08:00
    sendNotification.mockImplementation(async (subscription: { endpoint: string }) => {
      if (subscription.endpoint.endsWith('/gone')) throw Object.assign(new Error('Gone'), { statusCode: 410 })
    })
    await sendReminders()
    expect(sendNotification).toHaveBeenCalledTimes(2)
    expect(JSON.parse(sendNotification.mock.calls[0][1])).toMatchObject({ title: 'Vitamin D3', body: '1 tablet · 08:00' })
    const left = [...stores.get('hibi-reminders')!.values()].map((value) => JSON.parse(value))
    expect(left).toHaveLength(1)
    expect(left[0].lastRunAt).toBe(Date.parse('2026-11-02T02:30:00Z'))

    // The next run must not resend the 08:00 reminder.
    sendNotification.mockClear()
    vi.setSystemTime(new Date('2026-11-02T02:35:00Z'))
    await sendReminders()
    expect(sendNotification).not.toHaveBeenCalled()
    vi.useRealTimers()
  })
})
