<script setup lang="ts">
import { computed } from 'vue'
import { Bell, BellOff, BellRing, Droplets, LoaderCircle, Pill, Send } from 'lucide-vue-next'
import { useHealthStore } from '../stores/health'
import { useReminders } from '../services/reminders'

const store = useHealthStore()
const reminders = computed(() => store.data.preferences.reminders)
const { status, busy, error, enable, disable, sendTest } = useReminders()
const intervals = [60, 90, 120, 180, 240]
const supplementTimes = computed(() => [...new Set(store.data.supplements.map((item) => item.time))].sort().join(', '))
</script>

<template>
  <article class="panel settings-card">
    <div class="settings-heading"><span class="settings-icon"><BellRing :size="20" /></span><div><h2>Reminders</h2><p>Notifications for water and your supplement schedule, even when Hibi is closed.</p></div></div>

    <p v-if="status === 'unsupported'" class="privacy-note">This browser can’t receive push notifications. Use Chrome on Android, or Safari on iPhone with Hibi added to the Home Screen.</p>
    <p v-else-if="status === 'needs-install'" class="privacy-note">On iPhone, reminders work once Hibi is on your Home Screen: in Safari tap Share, then “Add to Home Screen”, and open Hibi from there.</p>
    <p v-else-if="status === 'server-off'" class="privacy-note"><span>Reminders aren’t switched on for this Hibi server yet, so this device can’t subscribe. If you run this Hibi, finish the server setup (<code>npm run setup:netlify</code>); otherwise ask the person who shared it with you.</span></p>
    <p v-else-if="status === 'blocked'" class="privacy-note">Notifications are blocked for Hibi. Allow them in your browser or phone settings, then come back here.</p>

    <div v-else class="form-stack">
      <div class="reminder-switch">
        <span><component :is="status === 'on' ? Bell : BellOff" :size="17" /> {{ status === 'on' ? 'Notifications are on for this device' : 'Notifications are off on this device' }}</span>
        <button v-if="status === 'on'" class="secondary-button" :disabled="busy" @click="disable">Turn off</button>
        <button v-else class="primary-button" :disabled="busy || status === 'checking'" @click="enable"><LoaderCircle v-if="busy" :size="16" class="spin" /> Turn on</button>
      </div>

      <label class="check-row"><input v-model="reminders.supplements" type="checkbox" /><Pill :size="17" />
        <span>Supplement reminders <small v-if="store.data.supplements.length">at {{ supplementTimes }}</small><small v-else>(add supplements under Routine)</small></span>
      </label>

      <label class="check-row"><input v-model="reminders.water.enabled" type="checkbox" /><Droplets :size="17" /><span>Water reminders</span></label>
      <div v-if="reminders.water.enabled" class="field-row three">
        <label class="field"><span>From</span><input v-model="reminders.water.start" type="time" required /></label>
        <label class="field"><span>Until</span><input v-model="reminders.water.end" type="time" required /></label>
        <label class="field"><span>Every</span><select v-model.number="reminders.water.everyMinutes"><option v-for="minutes in intervals" :key="minutes" :value="minutes">{{ minutes < 120 ? `${minutes} min` : `${minutes / 60} hours` }}</option></select></label>
      </div>

      <button v-if="status === 'on'" class="link-button" type="button" @click="sendTest"><Send :size="15" /> Send a test notification</button>
      <p v-if="error" class="inline-alert" role="alert">{{ error }}</p>
      <p class="field-hint">Reminder times and supplement names are stored on Hibi’s server so it can notify you; your logs stay on this device.</p>
    </div>
  </article>
</template>
