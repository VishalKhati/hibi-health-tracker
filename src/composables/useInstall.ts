import { computed, ref } from 'vue'

/** Chrome/Edge/Samsung Internet event; not in the TS DOM lib yet. */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISS_KEY = 'hibi-install-dismissed'

const standaloneQuery = window.matchMedia('(display-mode: standalone)')
const isStandalone = () => standaloneQuery.matches || (navigator as Navigator & { standalone?: boolean }).standalone === true

// Module scope so the event is caught even if it fires before any component mounts.
const deferred = ref<BeforeInstallPromptEvent | null>(null)
const installed = ref(isStandalone())
const dismissed = ref((() => { try { return localStorage.getItem(DISMISS_KEY) === '1' } catch { return false } })())

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault()
  deferred.value = event as BeforeInstallPromptEvent
})
window.addEventListener('appinstalled', () => {
  installed.value = true
  deferred.value = null
})
standaloneQuery.addEventListener('change', () => { installed.value = isStandalone() })

/** iPhone/iPad Safari has no install prompt; users add the app from the Share sheet. iPadOS reports itself as a Mac. */
const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

export const useInstall = () => {
  const canPrompt = computed(() => !!deferred.value && !installed.value)
  const showIosSteps = computed(() => isIos && !installed.value)
  /** True when there's something useful to offer: a one-tap install or the iOS steps. */
  const available = computed(() => canPrompt.value || showIosSteps.value)

  const install = async () => {
    const event = deferred.value
    if (!event) return false
    deferred.value = null // A prompt can only be shown once.
    await event.prompt()
    const { outcome } = await event.userChoice
    return outcome === 'accepted'
  }

  const dismiss = () => {
    dismissed.value = true
    try { localStorage.setItem(DISMISS_KEY, '1') } catch { /* private mode: just hide for this session */ }
  }

  return { installed, canPrompt, showIosSteps, available, dismissed, install, dismiss }
}
