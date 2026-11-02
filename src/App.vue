<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watchEffect } from 'vue'
import { Activity, BarChart3, CalendarDays, ChevronRight, Ellipsis, Pill, Salad, Scale, Settings, Sparkles } from 'lucide-vue-next'
import TodayScreen from './components/TodayScreen.vue'
import FoodScreen from './components/FoodScreen.vue'
import ActivityScreen from './components/ActivityScreen.vue'
import SupplementsScreen from './components/SupplementsScreen.vue'
import BodyScreen from './components/BodyScreen.vue'
import ProgressScreen from './components/ProgressScreen.vue'
import SettingsScreen from './components/SettingsScreen.vue'
import AddFoodModal from './components/AddFoodModal.vue'
import AddActivityModal from './components/AddActivityModal.vue'
import AddSupplementModal from './components/AddSupplementModal.vue'
import LogWeightModal from './components/LogWeightModal.vue'
import BaseModal from './components/BaseModal.vue'
import type { FoodEntry, Screen } from './types'
import { useHealthStore } from './stores/health'
import { useReminders } from './services/reminders'

const store = useHealthStore()
const active = ref<Screen>('today')
const modal = ref<'food' | 'activity' | 'supplement' | 'weight' | 'more' | null>(null)
const initialMeal = ref<FoodEntry['meal']>('Breakfast')
const toast = ref('')

const navigation = [
  { id: 'today' as Screen, label: 'Today', icon: CalendarDays },
  { id: 'food' as Screen, label: 'Food', icon: Salad },
  { id: 'activity' as Screen, label: 'Activity', icon: Activity },
  { id: 'supplements' as Screen, label: 'Routine', icon: Pill },
  { id: 'body' as Screen, label: 'Body', icon: Scale },
  { id: 'progress' as Screen, label: 'Progress', icon: BarChart3 },
  { id: 'settings' as Screen, label: 'Settings', icon: Settings },
]
/** Six slots fit a phone; Routine and Settings live behind "More". */
const mobileNavigation = navigation.filter((item) => !['supplements', 'settings'].includes(item.id))
const moreItems = [
  { id: 'supplements' as Screen, label: 'Routine', hint: 'Supplements and medicines', icon: Pill },
  { id: 'settings' as Screen, label: 'Settings', hint: 'Goals, appearance, and backups', icon: Settings },
]
const component = computed(() => ({
  today: TodayScreen,
  food: FoodScreen,
  activity: ActivityScreen,
  supplements: SupplementsScreen,
  body: BodyScreen,
  progress: ProgressScreen,
  settings: SettingsScreen,
}[active.value]))
const openFood = (meal?: FoodEntry['meal']) => {
  initialMeal.value = meal || (new Date().getHours() < 11 ? 'Breakfast' : new Date().getHours() < 15 ? 'Lunch' : new Date().getHours() < 20 ? 'Dinner' : 'Snack')
  modal.value = 'food'
}
const go = (screen: Screen) => {
  active.value = screen
  if (modal.value === 'more') modal.value = null
}
const openDate = (date: string) => {
  store.selectedDate.value = date
  go('today')
}
const saved = (message: string) => {
  modal.value = null
  showToast(message)
}

// Home-screen shortcuts and notification buttons open the app with ?action=… or ?screen=…
const showToast = (message: string) => {
  toast.value = message
  window.setTimeout(() => toast.value = '', 2600)
}
onMounted(() => {
  const url = new URL(window.location.href)
  const action = url.searchParams.get('action')
  const screen = url.searchParams.get('screen')
  if (!action && !screen) return
  if (screen === 'supplements') go('supplements')
  if (action === 'log-food') openFood()
  else if (action === 'log-weight') { go('body'); modal.value = 'weight' }
  else if (action === 'add-water') {
    store.setDayValue('water', store.todayTotals.value.water + 1)
    showToast(`Water logged · ${store.todayTotals.value.water} of ${store.data.profile.goals.water} glasses`)
  } else if (action === 'take-supplement') {
    const supplement = store.data.supplements.find((item) => item.id === url.searchParams.get('id'))
    if (supplement) {
      store.logDose(supplement.id, 'taken')
      go('supplements')
      showToast(`${supplement.name} marked as taken`)
    }
  }
  url.searchParams.delete('action')
  url.searchParams.delete('screen')
  url.searchParams.delete('id')
  window.history.replaceState(null, '', url)
})
useReminders().startSync()

// "system" leaves the attribute off so the prefers-color-scheme media query decides.
const systemDark = window.matchMedia('(prefers-color-scheme: dark)')
const isSystemDark = ref(systemDark.matches)
const onSchemeChange = (event: MediaQueryListEvent) => { isSystemDark.value = event.matches }
systemDark.addEventListener('change', onSchemeChange)
onBeforeUnmount(() => systemDark.removeEventListener('change', onSchemeChange))
watchEffect(() => {
  const theme = store.data.preferences.theme
  if (theme === 'system') delete document.documentElement.dataset.theme
  else document.documentElement.dataset.theme = theme
  const dark = theme === 'dark' || (theme === 'system' && isSystemDark.value)
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0f1714' : '#152a23')
})
</script>

<template>
  <div class="app-shell">
    <aside class="sidebar">
      <div class="brand"><div class="brand-mark">日</div><div><strong>Hibi</strong><small>day by day</small></div></div>
      <nav class="side-nav" aria-label="Main navigation">
        <button v-for="item in navigation" :key="item.id" :class="{ active: active === item.id }" :aria-current="active === item.id ? 'page' : undefined" @click="go(item.id)"><component :is="item.icon" :size="19" /><span>{{ item.label }}</span><i /></button>
      </nav>
      <div class="sidebar-note"><Sparkles :size="17" /><p><strong>Private by design</strong>Your entries stay on this device.</p></div>
    </aside>

    <main class="main-content">
      <Transition name="screen" mode="out-in">
        <component :is="component" :key="active" @add-food="openFood" @add-activity="modal = 'activity'" @add-supplement="modal = 'supplement'" @log-weight="modal = 'weight'" @open-date="openDate" />
      </Transition>
    </main>

    <nav class="bottom-nav" aria-label="Mobile navigation">
      <button v-for="item in mobileNavigation" :key="item.id" :class="{ active: active === item.id }" :aria-current="active === item.id ? 'page' : undefined" @click="go(item.id)"><component :is="item.icon" :size="21" /><span>{{ item.label }}</span></button>
      <button :class="{ active: active === 'supplements' || active === 'settings' }" aria-haspopup="dialog" @click="modal = 'more'"><Ellipsis :size="21" /><span>More</span></button>
    </nav>

    <Transition name="modal"><AddFoodModal v-if="modal === 'food'" :initial-meal="initialMeal" @close="modal = null" @saved="saved('Food added to your day')" /></Transition>
    <Transition name="modal"><AddActivityModal v-if="modal === 'activity'" @close="modal = null" @saved="saved('Activity logged')" /></Transition>
    <Transition name="modal"><AddSupplementModal v-if="modal === 'supplement'" @close="modal = null" @saved="saved('Routine updated')" /></Transition>
    <Transition name="modal"><LogWeightModal v-if="modal === 'weight'" @close="modal = null" @saved="saved('Weight saved')" /></Transition>
    <Transition name="modal">
      <BaseModal v-if="modal === 'more'" title="More" @close="modal = null">
        <div class="more-list">
          <button v-for="item in moreItems" :key="item.id" :class="{ active: active === item.id }" @click="go(item.id)">
            <span class="settings-icon"><component :is="item.icon" :size="19" /></span>
            <span><strong>{{ item.label }}</strong><small>{{ item.hint }}</small></span>
            <ChevronRight :size="18" />
          </button>
        </div>
      </BaseModal>
    </Transition>
    <Transition name="toast"><div v-if="toast" class="toast" role="status"><span>✓</span>{{ toast }}</div></Transition>
  </div>
</template>
