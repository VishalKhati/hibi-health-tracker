/* Push reminders. Imported into the Workbox-generated service worker (see vite.config.ts). */
self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { title: 'Hibi', body: event.data ? event.data.text() : '' }
  }
  const scope = self.registration.scope
  const actions = Array.isArray(data.actions) ? data.actions : []
  event.waitUntil(self.registration.showNotification(data.title || 'Hibi', {
    body: data.body || '',
    tag: data.tag,
    icon: `${scope}icons/icon-192.png`,
    badge: `${scope}icons/badge-96.png`,
    data: { url: data.url || './', actions },
    actions: actions.map(({ action, title }) => ({ action, title })),
  }))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const { url = './', actions = [] } = event.notification.data || {}
  const chosen = actions.find((item) => item.action === event.action)
  const target = new URL(chosen ? chosen.url : url, self.registration.scope).href
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const open = windows.find((client) => client.url.startsWith(self.registration.scope))
    if (open) {
      await open.focus()
      return open.navigate(target)
    }
    return self.clients.openWindow(target)
  })())
})
