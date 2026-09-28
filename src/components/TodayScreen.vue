<script setup lang="ts">
import { computed } from 'vue'
import { Activity, Check, ChevronLeft, ChevronRight, Droplets, Footprints, Flame, Plus, Salad, Sparkles } from 'lucide-vue-next'
import MetricCard from './MetricCard.vue'
import InstallPrompt from './InstallPrompt.vue'
import { useHealthStore } from '../stores/health'
import { dateKey, longDate } from '../utils/date'

defineEmits<{ addFood: []; addActivity: []; addSupplement: [] }>()
const store = useHealthStore()
const goals = computed(() => store.data.profile.goals)
const greeting = computed(() => {
  const hour = new Date().getHours()
  return hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
})
const shiftDay = (amount: number) => {
  const date = new Date(`${store.selectedDate.value}T12:00:00`)
  date.setDate(date.getDate() + amount)
  if (dateKey(date) <= dateKey()) store.selectedDate.value = dateKey(date)
}
const isToday = computed(() => store.selectedDate.value === dateKey())
const updateSteps = () => {
  const value = window.prompt("Steps today", String(store.todayTotals.value.steps))
  if (value !== null) store.setDayValue("steps", Number(value) || 0)
}
const supplementProgress = computed(() => {
  const count = store.scheduledSupplements.value.filter((item) => store.doseStatus(item.id) === 'taken').length
  return { count, total: store.scheduledSupplements.value.length }
})
</script>

<template>
  <div class="screen today-screen">
    <header class="page-header today-header">
      <div>
        <p class="eyebrow">{{ isToday ? greeting : 'Daily review' }}<span v-if="store.data.profile.name">, {{ store.data.profile.name }}</span></p>
        <h1>{{ isToday ? 'Today' : longDate(store.selectedDate.value) }}</h1>
        <p class="header-copy">Small choices, steady progress.</p>
      </div>
      <div class="date-switcher">
        <button class="icon-button" aria-label="Previous day" @click="shiftDay(-1)"><ChevronLeft :size="19" /></button>
        <span>{{ isToday ? 'Today' : longDate(store.selectedDate.value).split(',').slice(1).join(',') }}</span>
        <button class="icon-button" aria-label="Next day" :disabled="isToday" @click="shiftDay(1)"><ChevronRight :size="19" /></button>
      </div>
    </header>

    <InstallPrompt variant="banner" />

    <section class="hero-card">
      <div class="hero-orbit"><span>{{ Math.round((store.todayTotals.value.calories / Math.max(1, goals.calories)) * 100) }}%</span><small>fuelled</small></div>
      <div class="hero-copy">
        <span class="status-pill"><Sparkles :size="14" /> Daily snapshot</span>
        <h2>{{ store.todayTotals.value.calories ? 'You’re building your day.' : 'Ready when you are.' }}</h2>
        <p>{{ store.todayTotals.value.calories ? `${Math.max(0, goals.calories - store.todayTotals.value.calories).toLocaleString()} calories remain in today’s food goal.` : 'Start with one small check-in. It only takes a moment.' }}</p>
      </div>
      <button class="hero-add" @click="$emit('addFood')"><Plus :size="20" /> Log food</button>
    </section>

    <div class="section-title"><div><span class="eyebrow">Daily balance</span><h2>Your essentials</h2></div><span class="quiet-label">Goals stay flexible</span></div>
    <section class="metric-grid">
      <MetricCard label="Calories" :value="store.todayTotals.value.calories" :goal="goals.calories" unit="kcal" :icon="Flame" color="#e99863" action="Add food" @action="$emit('addFood')" />
      <MetricCard label="Protein" :value="store.todayTotals.value.protein" :goal="goals.protein" unit="g" :icon="Salad" color="#86a78c" />
      <MetricCard label="Steps" :value="store.todayTotals.value.steps" :goal="goals.steps" unit="steps" :icon="Footprints" color="#8d83bd" action="Update" @action="updateSteps()" />
      <MetricCard label="Water" :value="store.todayTotals.value.water" :goal="goals.water" unit="glasses" :icon="Droplets" color="#659faf" action="Add glass" @action="store.setDayValue('water', store.todayTotals.value.water + 1)" />
    </section>

    <section class="split-grid">
      <article class="panel activity-summary">
        <div class="panel-heading"><div class="panel-icon peach"><Activity :size="19" /></div><div><span class="eyebrow">Movement</span><h2>{{ store.todayTotals.value.activityMinutes }} active minutes</h2></div><button class="text-button" @click="$emit('addActivity')"><Plus :size="16" /> Add</button></div>
        <div class="goal-bar"><span :style="{ width: `${Math.min(100, store.todayTotals.value.activityMinutes / goals.activityMinutes * 100)}%` }" /></div>
        <div class="summary-row"><span>{{ goals.activityMinutes - Math.min(goals.activityMinutes, store.todayTotals.value.activityMinutes) }} min to goal</span><span>{{ store.todayTotals.value.caloriesBurned }} kcal burned</span></div>
      </article>
      <article class="panel supplements-summary">
        <div class="panel-heading"><div class="panel-icon sage"><Sparkles :size="19" /></div><div><span class="eyebrow">Routine</span><h2>Supplements</h2></div><span class="count-badge">{{ supplementProgress.count }}/{{ supplementProgress.total }}</span></div>
        <div v-if="store.scheduledSupplements.value.length" class="mini-list">
          <button v-for="item in store.scheduledSupplements.value.slice(0, 3)" :key="item.id" :class="['mini-dose', { done: store.doseStatus(item.id) === 'taken' }]" @click="store.logDose(item.id, 'taken')">
            <span><Check :size="14" /></span><div><strong>{{ item.name }}</strong><small>{{ item.dosage }} · {{ item.time }}</small></div>
          </button>
        </div>
        <button v-else class="empty-action" @click="$emit('addSupplement')"><Plus :size="16" /> Add your first supplement</button>
      </article>
    </section>

    <section class="quick-actions">
      <button @click="$emit('addFood')"><span><Salad :size="21" /></span><strong>Meal</strong><small>Log food</small></button>
      <button @click="$emit('addActivity')"><span><Activity :size="21" /></span><strong>Workout</strong><small>Add movement</small></button>
      <button @click="store.setDayValue('water', store.todayTotals.value.water + 1)"><span><Droplets :size="21" /></span><strong>Water</strong><small>+1 glass</small></button>
    </section>
  </div>
</template>
