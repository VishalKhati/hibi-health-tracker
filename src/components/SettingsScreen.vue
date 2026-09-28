<script setup lang="ts">
import { ref } from 'vue'
import { Check, Database, Download, Info, Monitor, Moon, Palette, RotateCcw, Sun, Upload } from 'lucide-vue-next'
import { useHealthStore } from '../stores/health'
import InstallPrompt from './InstallPrompt.vue'

const store = useHealthStore()
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
      <article class="panel settings-card">
        <div class="settings-heading"><span class="settings-icon peach"><Database :size="20" /></span><div><h2>Your data</h2><p>Keep a copy somewhere safe.</p></div></div>
        <div class="backup-actions"><button class="secondary-button" @click="download"><Download :size="18" /> Export backup</button><button class="secondary-button" @click="fileInput?.click()"><Upload :size="18" /> Import backup</button><input ref="fileInput" hidden type="file" accept="application/json,.json" @change="upload" /></div>
        <p class="privacy-note"><Info :size="16" /> Hibi is offline-first. Clearing browser data can remove your entries, so export a backup regularly.</p>
        <p v-if="message" class="success-message"><Check :size="16" /> {{ message }}</p>
      </article>
      <article class="panel about-card"><div class="brand-mark small">日</div><div><h2>Hibi <span>v1.0</span></h2><p>日々 — “day by day.” A private little place for the choices that add up.</p></div></article>
    </section>
  </div>
</template>
