import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

// Deploying under a sub-path (e.g. https://example.com/hibi/)? Build with HIBI_BASE=/hibi/.
// Everything below is relative, so the manifest, icons, and service worker follow the base.
const base = process.env.HIBI_BASE ?? '/'
// Netlify sets COMMIT_REF during builds; shown in Settings so it's easy to tell which version a phone runs.
const version = `${process.env.COMMIT_REF?.slice(0, 7) ?? 'local'} · ${new Date().toISOString().slice(0, 10)}`

export default defineConfig({
  base,
  define: { __APP_VERSION__: JSON.stringify(version) },
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'icons/*.png', 'push-sw.js'],
      manifest: {
        id: base,
        name: 'Hibi — Daily Health',
        short_name: 'Hibi',
        description: 'A calm, private daily health tracker for food, movement, body, and routines.',
        lang: 'en',
        dir: 'ltr',
        theme_color: '#152a23',
        background_color: '#f5f3ed',
        display: 'standalone',
        orientation: 'portrait',
        start_url: './',
        scope: './',
        categories: ['health', 'fitness', 'lifestyle'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
        // Long-press the home-screen icon (Android) or right-click it (desktop) to jump straight in.
        shortcuts: [
          { name: 'Log food', short_name: 'Food', url: './?action=log-food', icons: [{ src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' }] },
          { name: 'Log weight', short_name: 'Weight', url: './?action=log-weight', icons: [{ src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' }] },
        ],
        // Chrome shows these in a richer install dialog instead of the plain "Install app?" sheet.
        screenshots: [
          { src: 'screenshots/today-phone.png', sizes: '780x1688', type: 'image/png', form_factor: 'narrow', label: 'Today at a glance' },
          { src: 'screenshots/progress-phone.png', sizes: '780x1688', type: 'image/png', form_factor: 'narrow', label: 'Streaks and progress' },
          { src: 'screenshots/body-desktop.png', sizes: '1440x900', type: 'image/png', form_factor: 'wide', label: 'Weight trend, BMI, and calorie needs' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        navigateFallback: 'index.html',
        // Server functions answer under /api; never serve the app shell for them.
        navigateFallbackDenylist: [/^\/api\//],
        // Push and notification-click handlers for reminders.
        importScripts: ['push-sw.js'],
      },
    }),
  ],
})
