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

const generateContent = vi.fn()
vi.mock('@google/genai', () => {
  class ApiError extends Error {
    status: number
    constructor({ message, status }: { message: string; status: number }) { super(message); this.status = status }
  }
  class GoogleGenAI { models = { generateContent } }
  return { ApiError, GoogleGenAI }
})
const { ApiError } = await import('@google/genai')

const sendNotification = vi.fn()
vi.mock('web-push', () => ({ default: { setVapidDetails: vi.fn(), sendNotification } }))

const { default: analyzeMeal } = await import('../analyze-meal.mts')
const { default: foodSearch } = await import('../food-search.mts')
const { default: readLabel } = await import('../read-label.mts')
const { default: products } = await import('../products.mts')
const { default: reminders } = await import('../reminders.mts')
const { default: sendReminders } = await import('../send-reminders.mts')

const post = (body: unknown, ip = '203.0.113.7') => analyzeMeal(new Request('https://hibi.test/api/analyze-meal', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
}), { ip } as never)
const photo = { image: 'aGVsbG8=', mediaType: 'image/jpeg' }
const search = (q: string, ip = '203.0.113.7') => foodSearch(new Request(`https://hibi.test/api/food-search?q=${encodeURIComponent(q)}`), { ip } as never)

beforeEach(() => {
  stores.clear()
  sendNotification.mockReset()
  generateContent.mockReset()
  vi.stubEnv('HIBI_MOCK_AI', '1')
  vi.stubEnv('VAPID_PUBLIC_KEY', 'public-key')
  vi.stubEnv('VAPID_PRIVATE_KEY', 'private-key')
})
afterEach(() => vi.unstubAllEnvs())

describe('analyze-meal', () => {
  it('validates the photo before calling the model', async () => {
    expect((await post({ ...photo, mediaType: 'image/gif' })).status).toBe(400)
    expect((await post({ ...photo, image: '' })).status).toBe(413)
  })

  it('returns an editable estimate without any access code', async () => {
    const response = await post(photo)
    expect(response.status).toBe(200)
    const body = await response.json() as { items: Record<string, unknown>[] }
    expect(body.items.length).toBeGreaterThan(0)
    expect(body.items[0]).toEqual(expect.objectContaining({ name: expect.any(String), calories: expect.any(Number), confidence: expect.any(String) }))
  })

  it('tells the app which AI service is configured', async () => {
    const get = () => analyzeMeal(new Request('https://hibi.test/api/analyze-meal'))
    expect(await (await get()).json()).toEqual({ provider: 'mock' })
    vi.stubEnv('HIBI_MOCK_AI', '')
    vi.stubEnv('GEMINI_API_KEY', 'g-key')
    expect(await (await get()).json()).toEqual({ provider: 'gemini' })
    vi.stubEnv('GEMINI_API_KEY', '')
    vi.stubEnv('ANTHROPIC_API_KEY', 'a-key')
    expect(await (await get()).json()).toEqual({ provider: 'claude' })
  })

  it('needs an API key outside mock mode', async () => {
    vi.stubEnv('HIBI_MOCK_AI', '')
    vi.stubEnv('GEMINI_API_KEY', '')
    vi.stubEnv('ANTHROPIC_API_KEY', '')
    expect((await post(photo)).status).toBe(503)
  })
})

describe('analyze-meal with Gemini', () => {
  const estimate = { items: [{ name: 'Poha', portion: '1 plate (~200 g)', grams: 200.4, calories: 250.6, protein: 5.04, carbs: 44.36, fat: 6.04, fiber: 2.01, confidence: 'high', note: ' ' }], summary: ' Poha. ' }
  beforeEach(() => {
    vi.stubEnv('HIBI_MOCK_AI', '')
    vi.stubEnv('GEMINI_API_KEY', 'g-key')
  })

  it('sends the photo with the shared prompt and returns a tidied estimate', async () => {
    generateContent.mockResolvedValue({ text: JSON.stringify(estimate) })
    const response = await post({ ...photo, hint: '  extra peanuts ' })
    expect(await response.json()).toEqual({ summary: 'Poha.', items: [{ ...estimate.items[0], grams: 200, calories: 251, protein: 5, carbs: 44.4, fat: 6, fiber: 2, note: '' }] })
    const request = generateContent.mock.calls[0][0]
    expect(request.model).toBe('gemini-3.8-flash')
    expect(request.contents[0].parts[0]).toEqual({ inlineData: { mimeType: 'image/jpeg', data: photo.image } })
    expect(request.contents[0].parts[1].text).toContain('extra peanuts')
    expect(request.config.responseJsonSchema).not.toHaveProperty('$schema')
  })

  it('falls back to the next model when Google is overloaded', async () => {
    generateContent.mockRejectedValueOnce(new ApiError({ message: 'high demand', status: 503 }))
    generateContent.mockResolvedValueOnce({ text: JSON.stringify(estimate) })
    expect((await post(photo)).status).toBe(200)
    expect(generateContent.mock.calls.map((call) => call[0].model)).toEqual(['gemini-3.8-flash', 'gemini-3.5-flash'])
  })

  it('turns exhausted quota and malformed replies into clear errors', async () => {
    generateContent.mockRejectedValue(new ApiError({ message: 'Resource exhausted', status: 429 }))
    const limited = await post(photo)
    expect(limited.status).toBe(429)
    expect((await limited.json() as { error: string }).error).toContain('quota')
    generateContent.mockReset()
    generateContent.mockResolvedValueOnce({ text: 'not json' })
    expect((await post(photo)).status).toBe(502)
  })

  it('limits each visitor separately per day', async () => {
    generateContent.mockResolvedValue({ text: JSON.stringify(estimate) })
    for (let i = 0; i < 40; i += 1) await post(photo, '198.51.100.1')
    expect((await post(photo, '198.51.100.1')).status).toBe(429)
    expect((await post(photo, '198.51.100.2')).status).toBe(200)
  })
})

describe('food-search', () => {
  const foods = { foods: [
    { name: ' Plain roti ', detail: 'Whole wheat, no oil ', kcalPer100g: 247.4, proteinPer100g: 8.24, carbsPer100g: 46.04, fatPer100g: 1.46, fiberPer100g: 6.5, servingLabel: '1 medium roti', servingGrams: 35.2 },
    { name: 'plain roti', detail: 'duplicate', kcalPer100g: 250, proteinPer100g: 8, carbsPer100g: 46, fatPer100g: 1, fiberPer100g: 6, servingLabel: '1 roti', servingGrams: 35 },
    { name: 'Water', detail: 'No energy', kcalPer100g: 0, proteinPer100g: 0, carbsPer100g: 0, fatPer100g: 0, fiberPer100g: 0, servingLabel: '1 glass', servingGrams: 250 },
  ] }
  beforeEach(() => {
    vi.stubEnv('HIBI_MOCK_AI', '')
    vi.stubEnv('GEMINI_API_KEY', 'g-key')
  })

  it('needs at least two letters', async () => {
    expect((await search(' r ')).status).toBe(400)
    expect(generateContent).not.toHaveBeenCalled()
  })

  it('returns tidied reference values and caches them for the next person', async () => {
    generateContent.mockResolvedValue({ text: JSON.stringify(foods) })
    const first = await (await search('Roti')).json()
    expect(first).toEqual({ foods: [{ name: 'Plain roti', detail: 'Whole wheat, no oil', kcalPer100g: 247, proteinPer100g: 8.2, carbsPer100g: 46, fatPer100g: 1.5, fiberPer100g: 6.5, servingLabel: '1 medium roti', servingGrams: 35 }] })
    const request = generateContent.mock.calls[0][0]
    expect(request.model).toBe('gemini-3.5-flash')
    expect(request.config.systemInstruction).toContain('IFCT 2017')
    expect(request.contents[0].parts[0].text).toBe('Search term: Roti')
    // Same words, different case and spacing, another visitor: served from the cache.
    expect(await (await search('  roti ', '198.51.100.9')).json()).toEqual(first)
    expect(generateContent).toHaveBeenCalledTimes(1)
  })

  it('reports a busy service after trying every model', async () => {
    generateContent.mockRejectedValue(new ApiError({ message: 'high demand', status: 503 }))
    const response = await search('dal')
    expect(response.status).toBe(503)
    expect((await response.json() as { error: string }).error).toContain('busy')
    expect(generateContent).toHaveBeenCalledTimes(2)
  })

  it('reports a missing key', async () => {
    vi.stubEnv('GEMINI_API_KEY', '')
    expect((await search('dal')).status).toBe(503)
  })
})

describe('read-label', () => {
  const label = (body: unknown) => readLabel(new Request('https://hibi.test/api/read-label', { method: 'POST', body: JSON.stringify(body) }), { ip: '203.0.113.7' } as never)
  const reading = { readable: true, name: ' Masala oats ', brand: 'Saffola', unit: 'g', kcalPer100: 380, proteinPer100: 10.5, carbsPer100: 66, fatPer100: 8.2, fiberPer100: null, servingSize: 40, note: '' }

  it('validates the photo first', async () => {
    expect((await label({ ...photo, mediaType: 'image/gif' })).status).toBe(400)
    expect((await label({ ...photo, image: '' })).status).toBe(413)
  })

  it('reads the per-100 g values with Gemini, keeping a missing fibre as null', async () => {
    vi.stubEnv('HIBI_MOCK_AI', '')
    vi.stubEnv('GEMINI_API_KEY', 'g-key')
    generateContent.mockResolvedValue({ text: JSON.stringify(reading) })
    const body = await (await label(photo)).json()
    expect(body).toEqual({ ...reading, name: 'Masala oats' })
    const request = generateContent.mock.calls[0][0]
    expect(request.model).toBe('gemini-3.5-flash-lite')
    expect(request.config.systemInstruction).toContain('per 100 g')
  })
})

describe('shared products', () => {
  const call = (method: string, code: string, body?: unknown, ip = '203.0.113.7') =>
    products(new Request(`https://hibi.test/api/products/${code}`, { method, body: body ? JSON.stringify(body) : undefined }), { ip, params: { code } } as never)
  const oats = { name: 'Masala oats', brand: 'Saffola', kcalPer100g: 380, proteinPer100g: 10.5, carbsPer100g: 66, fatPer100g: 8.2, servingGrams: 40, servingLabel: '40 g' }

  it('stores a confirmed product and serves it to the next scan', async () => {
    expect((await call('GET', '8901234567890')).status).toBe(404)
    expect((await call('PUT', '8901234567890', oats)).status).toBe(200)
    const { product } = await (await call('GET', '8901234567890', undefined, '198.51.100.9')).json() as { product: Record<string, unknown> }
    expect(product).toMatchObject(oats)
  })

  it('rejects bad barcodes and impossible values', async () => {
    expect((await call('GET', 'abc')).status).toBe(400)
    expect((await call('PUT', '8901234567890', { ...oats, kcalPer100g: 5000 })).status).toBe(400)
    expect((await call('PUT', '8901234567890', { ...oats, name: ' ' })).status).toBe(400)
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
