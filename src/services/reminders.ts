import { ref, watch } from 'vue'
import type { ReminderSync } from '../shared/reminders'
import { useHealthStore } from '../stores/health'

export type ReminderStatus = 'checking' | 'unsupported' | 'needs-install' | 'blocked' | 'off' | 'on'

const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
const isStandalone = () => matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true

/** iOS exposes Web Push only to apps added to the Home Screen (iOS 16.4+). */
const support = () => {
  if ('serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window) return 'ok' as const
  return isIos && !isStandalone() ? 'needs-install' as const : 'unsupported' as const
}

const urlBase64ToBytes = (value: string) => {
  const base64 = (value + '='.repeat((4 - (value.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))
}

/** The service worker is only registered in production builds; don't wait forever in dev. */
const registration = async () => {
  const ready = navigator.serviceWorker.ready
  const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Notifications need the installed app (the service worker isn’t running here).')), 6000))
  return Promise.race([ready, timeout])
}

const api = async (method: 'GET' | 'PUT' | 'DELETE', body?: unknown) => {
  const response = await fetch('/api/reminders', {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await response.json().catch(() => null) as { error?: string; publicKey?: string } | null
  if (!response.ok) throw new Error(data?.error ?? `The server returned an error (${response.status}).`)
  return data
}

// Module scope: one subscription per device, shared by Settings and the background sync watcher.
const status = ref<ReminderStatus>('checking')
const busy = ref(false)
const error = ref('')
let subscription: PushSubscription | null = null
let watching = false

const payload = (): ReminderSync => {
  const store = useHealthStore()
  return {
    subscription: subscription!.toJSON() as ReminderSync['subscription'],
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    settings: JSON.parse(JSON.stringify(store.data.preferences.reminders)),
    supplements: store.data.supplements.map(({ id, name, dosage, time, days }) => ({ id, name, dosage, time, days: [...days] })),
  }
}

const sync = async () => {
  if (!subscription) return
  try {
    await api('PUT', payload())
    error.value = ''
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : 'Couldn’t save reminders.'
  }
}

export const useReminders = () => {
  const refresh = async () => {
    const supported = support()
    if (supported !== 'ok') { status.value = supported; return }
    if (Notification.permission === 'denied') { status.value = 'blocked'; return }
    const reg = await navigator.serviceWorker.getRegistration()
    subscription = (await reg?.pushManager.getSubscription()) ?? null
    status.value = subscription && Notification.permission === 'granted' ? 'on' : 'off'
  }

  const enable = async () => {
    busy.value = true
    error.value = ''
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        status.value = permission === 'denied' ? 'blocked' : 'off'
        return
      }
      const [{ publicKey }, reg] = await Promise.all([api('GET') as Promise<{ publicKey: string }>, registration()])
      subscription = (await reg.pushManager.getSubscription())
        ?? await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToBytes(publicKey) })
      await api('PUT', payload())
      status.value = 'on'
    } catch (reason) {
      error.value = reason instanceof Error ? reason.message : 'Couldn’t turn on notifications.'
    } finally {
      busy.value = false
    }
  }

  const disable = async () => {
    busy.value = true
    try {
      const endpoint = subscription?.endpoint
      await subscription?.unsubscribe()
      subscription = null
      status.value = 'off'
      if (endpoint) await api('DELETE', { endpoint }).catch(() => undefined)
    } finally {
      busy.value = false
    }
  }

  const sendTest = async () => {
    const reg = await registration()
    await reg.showNotification('Reminders are on', {
      body: 'This is how Hibi reminders will look.',
      icon: `${import.meta.env.BASE_URL}icons/icon-192.png`,
      badge: `${import.meta.env.BASE_URL}icons/badge-96.png`,
      tag: 'hibi-test',
    })
  }

  /** Keeps the server's copy of the schedule in step with edits to reminders or supplements. */
  const startSync = () => {
    if (watching) return
    watching = true
    const store = useHealthStore()
    let timer = 0
    watch(() => [store.data.preferences.reminders, store.data.supplements], () => {
      if (status.value !== 'on') return
      window.clearTimeout(timer)
      timer = window.setTimeout(sync, 1200)
    }, { deep: true })
    refresh()
  }

  return { status, busy, error, refresh, enable, disable, sendTest, startSync }
}
