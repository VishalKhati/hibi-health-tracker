<script setup lang="ts">
import { ref } from 'vue'
import { Check, Database, Download, Info, LoaderCircle, Monitor, Moon, Palette, RefreshCw, RotateCcw, Sun, Trash2, Upload } from 'lucide-vue-next'
import { useHealthStore } from '../stores/health'
import InstallPrompt from './InstallPrompt.vue'
import RemindersCard from './RemindersCard.vue'
import { applyUpdate, checkForUpdates, checkState, updateReady } from '../services/appUpdate'

const store = useHealthStore()
const appVersion = __APP_VERSION__
const appBuild = __APP_BUILD__
const checkMessages = {
  idle: '',
  checking: '',
  latest: 'You have the latest version.',
  offline: 'Couldn’t check. Are you online?',
  unavailable: 'Updates are checked in the installed app.',
} as const
const themes = [
  { id: 'system', label: 'System', icon: Monitor },
  { id: 'light', label: 'Light', icon: Sun },
  { id: 'dark', label: 'Dark', icon: Moon },
] as const
const fileInput = ref<HTMLInputElement | null>(null)
const message = ref('')
const download = () => {
  const blob = new Blob([store.exportData()], { type: 'application/json' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `hibi-backup-${new Date().toISOString().slice(0, 10)}.json`
  link.click()
  URL.revokeObjectURL(link.href)
  message.value = 'Backup exported.'
}
const confirmingReset = ref(false)
const reset = () => {
  store.resetData()
  confirmingReset.value = false
  message.value = 'Hibi has been reset. Your theme and reminder settings were kept.'
}
const upload = async (event: Event) => {
  try {
    const file = (event.target as HTMLInputElement).files?.[0]
    if (!file) return
    store.importData(await file.text())
    message.value = 'Backup restored successfully.'
  } catch (error) {
    message.value = error instanceof Error ? error.message : 'Could not import this backup.'
  }
}
</script>

<template>
  <div class="screen">
    <header class="page-header"><div><p class="eyebrow">Make it yours</p><h1>Settings</h1><p class="header-copy">Your data stays on this device unless you export it.</p></div></header>
    <section class="settings-layout">
      <article class="panel settings-card">
        <div class="settings-heading"><span class="settings-icon"><RotateCcw :size="20" /></span><div><h2>Profile & daily goals</h2><p>Adjust Hibi to fit your real life. The Body screen can suggest calorie, protein, and water goals.</p></div></div>
        <div class="form-stack">
          <label class="field"><span>Your name</span><input v-model="store.data.profile.name" placeholder="Optional" /></label>
          <div class="goal-fields">
            <label class="field"><span>Calories (kcal)</span><input v-model.number="store.data.profile.goals.calories" type="number" min="1" /></label>
            <label class="field"><span>Protein (g)</span><input v-model.number="store.data.profile.goals.protein" type="number" min="1" /></label>
            <label class="field"><span>Steps</span><input v-model.number="store.data.profile.goals.steps" type="number" min="1" /></label>
            <label class="field"><span>Water (glasses)</span><input v-model.number="store.data.profile.goals.water" type="number" min="1" /></label>
            <label class="field"><span>Activity (minutes)</span><input v-model.number="store.data.profile.goals.activityMinutes" type="number" min="1" /></label>
          </div>
        </div>
      </article>
      <article class="panel settings-card">
        <div class="settings-heading"><span class="settings-icon violet"><Palette :size="20" /></span><div><h2>Appearance</h2><p>System follows your phone or computer’s setting.</p></div></div>
        <div class="theme-options" role="radiogroup" aria-label="Theme">
          <button v-for="theme in themes" :key="theme.id" role="radio" :aria-checked="store.data.preferences.theme === theme.id" :class="['choice-chip', { active: store.data.preferences.theme === theme.id }]" @click="store.data.preferences.theme = theme.id"><component :is="theme.icon" :size="16" /> {{ theme.label }}</button>
        </div>
      </article>
      <InstallPrompt variant="card" />
      <RemindersCard />
      <article class="panel settings-card">
        <div class="settings-heading"><span class="settings-icon peach"><Database :size="20" /></span><div><h2>Your data</h2><p>Keep a copy somewhere safe.</p></div></div>
        <div class="backup-actions"><button class="secondary-button" @click="download"><Download :size="18" /> Export backup</button><button class="secondary-button" @click="fileInput?.click()"><Upload :size="18" /> Import backup</button><input ref="fileInput" hidden type="file" accept="application/json,.json" @change="upload" /></div>
        <p class="privacy-note"><Info :size="16" /> Hibi is offline-first. Clearing browser data can remove your entries, so export a backup regularly.</p>
        <div v-if="confirmingReset" class="reset-confirm" role="alert">
          <p><strong>Delete everything and start fresh?</strong> This removes all food, activity, water, steps, weight and supplement entries, your saved foods and your goals, and puts back the starting values. It can’t be undone, so export a backup first if you might want it later.</p>
          <div class="backup-actions"><button class="secondary-button" type="button" @click="confirmingReset = false">Cancel</button><button class="danger-button" type="button" @click="reset"><Trash2 :size="16" /> Yes, reset Hibi</button></div>
        </div>
        <button v-else class="link-button danger-link" type="button" @click="message = ''; confirmingReset = true"><RotateCcw :size="15" /> Reset all data…</button>
        <p v-if="message" class="success-message"><Check :size="16" /> {{ message }}</p>
      </article>
      <article class="panel about-card">
        <div class="brand-mark small">日</div>
        <div class="about-copy"><h2>Hibi <span :title="`Build ${appBuild}`">{{ appVersion }}</span></h2><p>日々 — “day by day.” A private little place for the choices that add up.</p><p v-if="checkMessages[checkState]" class="update-status" role="status">{{ checkMessages[checkState] }}</p></div>
        <button v-if="updateReady" class="primary-button" type="button" @click="applyUpdate"><RefreshCw :size="16" /> Update now</button>
        <button v-else class="secondary-button" type="button" :disabled="checkState === 'checking'" @click="checkForUpdates"><LoaderCircle v-if="checkState === 'checking'" :size="16" class="spin" /><RefreshCw v-else :size="16" /> Check for updates</button>
      </article>
    </section>
  </div>
</template>
