<script setup lang="ts">
import { CircleCheck, Download, Share, Smartphone, SquarePlus, X } from 'lucide-vue-next'
import { useInstall } from '../composables/useInstall'

/** "banner" is the dismissible nudge on Today; "card" is the permanent entry in Settings. */
defineProps<{ variant: 'banner' | 'card' }>()
const iconUrl = `${import.meta.env.BASE_URL}icons/icon-192.png`
const { installed, canPrompt, showIosSteps, available, dismissed, install, dismiss } = useInstall()
</script>

<template>
  <section v-if="variant === 'banner' && available && !dismissed" class="install-banner" aria-label="Install Hibi">
    <img :src="iconUrl" alt="" width="42" height="42" />
    <div>
      <strong>Put Hibi on your home screen</strong>
      <small v-if="canPrompt">Opens like an app, works offline.</small>
      <small v-else>In Safari, tap <Share :size="13" aria-label="Share" /> then “Add to Home Screen”.</small>
    </div>
    <button v-if="canPrompt" class="primary-button" @click="install"><Download :size="16" /> Install</button>
    <button class="icon-button subtle" aria-label="Dismiss" @click="dismiss"><X :size="17" /></button>
  </section>

  <article v-else-if="variant === 'card'" class="panel settings-card">
    <div class="settings-heading"><span class="settings-icon"><Smartphone :size="20" /></span><div><h2>Install the app</h2><p>Hibi installs from the browser: no app store, same data, and it works offline.</p></div></div>
    <p v-if="installed" class="success-message"><CircleCheck :size="16" /> Hibi is installed and running as an app.</p>
    <button v-else-if="canPrompt" class="primary-button" @click="install"><Download :size="18" /> Install Hibi</button>
    <ol v-else-if="showIosSteps" class="install-steps">
      <li>Open this page in <strong>Safari</strong>.</li>
      <li>Tap the <strong>Share</strong> button <Share :size="15" aria-hidden="true" /> in the toolbar.</li>
      <li>Choose <strong>Add to Home Screen</strong> <SquarePlus :size="15" aria-hidden="true" />, then tap <strong>Add</strong>.</li>
    </ol>
    <p v-else class="privacy-note">Open your browser’s menu and choose <strong>Install app</strong> or <strong>Add to Home screen</strong>. In Chrome on a computer, you can also use the install icon at the right end of the address bar. Installing needs the site to be on HTTPS.</p>
  </article>
</template>
