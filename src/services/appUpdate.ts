import { ref } from 'vue'
import { registerSW } from 'virtual:pwa-register'

export type UpdateCheck = 'idle' | 'checking' | 'latest' | 'offline' | 'unavailable'

/** True once a newer version has downloaded and is waiting for the user to tap Update. */
export const updateReady = ref(false)
export const checkState = ref<UpdateCheck>('idle')

let registration: ServiceWorkerRegistration | undefined
let applyWaiting: ((reload?: boolean) => Promise<void>) | undefined

/**
 * Browsers only look for a new service worker on navigation, and an installed app is usually
 * resumed rather than relaunched, so also check hourly and whenever the app returns to the screen.
 * A found update waits until the user taps Update, so it never reloads in the middle of an entry.
 */
export const startAppUpdates = () => {
  applyWaiting = registerSW({
    immediate: true,
    onNeedRefresh() { updateReady.value = true },
    onRegisteredSW(_url, reg) {
      registration = reg
      if (!reg) return
      const check = () => { if (navigator.onLine) reg.update().catch(() => undefined) }
      setInterval(check, 60 * 60 * 1000)
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check() })
    },
  })
}

/** Activates the waiting version; the page reloads itself once it takes over. */
export const applyUpdate = () => applyWaiting?.(true)

export const checkForUpdates = async () => {
  if (updateReady.value) return
  if (!registration) { checkState.value = 'unavailable'; return }
  if (!navigator.onLine) { checkState.value = 'offline'; return }
  checkState.value = 'checking'
  try {
    await registration.update()
    // A found update downloads in the background; give it up to 15 s to finish and start waiting.
    const deadline = Date.now() + 15_000
    while (registration.installing && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 250))
    }
    if (registration.waiting) updateReady.value = true
    checkState.value = updateReady.value ? 'idle' : 'latest'
  } catch {
    checkState.value = 'offline'
  }
}
