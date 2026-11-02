import { createApp } from 'vue'
import App from './App.vue'
import './style.css'
import { registerSW } from 'virtual:pwa-register'

registerSW({
  immediate: true,
  // An installed app is often resumed rather than relaunched, and browsers only look for a new
  // service worker on navigation, so also check hourly and whenever the app comes back to the screen.
  onRegisteredSW(_url, registration) {
    if (!registration) return
    const check = () => { if (navigator.onLine) registration.update().catch(() => undefined) }
    setInterval(check, 60 * 60 * 1000)
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check() })
  },
})
createApp(App).mount('#app')
