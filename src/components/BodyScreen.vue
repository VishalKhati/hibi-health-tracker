<script setup lang="ts">
import { computed, ref } from 'vue'
import { Check, Flame, HeartPulse, Plus, Ruler, Scale, Trash2 } from 'lucide-vue-next'
import WeightChart from './WeightChart.vue'
import { useHealthStore } from '../stores/health'
import { addDays, dateKey, longDate } from '../utils/date'
import { ACTIVITY_LEVELS, bmiBand, healthyWeightRange, movingAverage, suggestedGoals } from '../utils/health'
import type { ActivityLevel } from '../types'

defineEmits<{ logWeight: [] }>()
const store = useHealthStore()
// Computed so the form keeps working after a backup import replaces the profile object.
const body = computed(() => store.data.profile.body)
const metrics = store.bodyMetrics
const latest = store.latestWeight
const thisYear = new Date().getFullYear()
const shortDay = (key: string) => new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(`${key}T12:00:00`))
const kcal = (value: number) => Math.round(value).toLocaleString()

const ranges = [{ id: 30, label: '30 days' }, { id: 90, label: '90 days' }, { id: 365, label: '1 year' }, { id: 0, label: 'All' }]
const range = ref(90)
const trendAll = computed(() => movingAverage(store.sortedWeights.value))
const cutoff = computed(() => (range.value ? addDays(dateKey(), -range.value + 1) : ''))
const visibleWeights = computed(() => store.sortedWeights.value.filter((entry) => entry.date >= cutoff.value))
const visibleTrend = computed(() => trendAll.value.filter((entry) => entry.date >= cutoff.value))

/** Trend-to-trend change over about a month, so one heavy morning doesn't swing it. */
const change = computed(() => {
  const trend = trendAll.value
  if (trend.length < 2) return null
  const last = trend[trend.length - 1]
  const target = addDays(last.date, -30)
  const base = [...trend].reverse().find((point) => point.date <= target) ?? trend[0]
  if (base.date === last.date) return null
  return { kg: last.kg - base.kg, since: base.date }
})

const bmi = computed(() => (metrics.value ? { value: metrics.value.bmi, ...bmiBand(metrics.value.bmi) } : null))
const bmiMarker = computed(() => (bmi.value ? Math.min(100, Math.max(0, ((bmi.value.value - 15) / 20) * 100)) : 0))
const healthyRange = computed(() => (body.value.heightCm ? healthyWeightRange(body.value.heightCm) : null))

const missing = computed(() => [
  !body.value.heightCm && 'height',
  !body.value.birthYear && 'birth year',
  !body.value.sex && 'sex',
  !latest.value && 'a weight',
].filter(Boolean) as string[])

const suggestion = computed(() => (metrics.value ? suggestedGoals(metrics.value) : null))
const goalsMatch = computed(() => {
  const goals = store.data.profile.goals
  return !!suggestion.value && goals.calories === suggestion.value.calories && goals.protein === suggestion.value.protein && goals.water === suggestion.value.water
})
const applySuggestion = () => { if (suggestion.value) Object.assign(store.data.profile.goals, suggestion.value) }

const history = computed(() => {
  const sorted = store.sortedWeights.value
  return sorted.slice(-12).reverse().map((entry) => {
    const index = sorted.indexOf(entry)
    return { ...entry, delta: index > 0 ? entry.kg - sorted[index - 1].kg : null }
  })
})
const signed = (value: number) => `${value > 0 ? '+' : value < 0 ? '−' : '±'}${Math.abs(value).toFixed(1)}`
</script>

<template>
  <div class="screen">
    <header class="page-header"><div><p class="eyebrow">Measurements</p><h1>Body</h1><p class="header-copy">Numbers for context, never for judgement.</p></div><button class="primary-button compact" @click="$emit('logWeight')"><Plus :size="18" /> Log weight</button></header>

    <section class="body-summary">
      <article class="panel body-card">
        <div class="panel-heading"><div class="panel-icon sage"><Scale :size="19" /></div><div><span class="eyebrow">Weight</span><h2>Latest weigh-in</h2></div></div>
        <template v-if="latest">
          <p class="body-figure">{{ latest.kg.toFixed(1) }}<small>kg</small></p>
          <p class="body-note">{{ latest.date === dateKey() ? 'Today' : longDate(latest.date) }}<template v-if="change"> · <strong>{{ signed(change.kg) }} kg</strong> trend since {{ shortDay(change.since) }}</template></p>
        </template>
        <button v-else class="empty-action" @click="$emit('logWeight')"><Plus :size="16" /> Log your first weight</button>
      </article>

      <article class="panel body-card">
        <div class="panel-heading"><div class="panel-icon violet"><Ruler :size="19" /></div><div><span class="eyebrow">Body mass index</span><h2>BMI</h2></div></div>
        <template v-if="bmi">
          <p class="body-figure">{{ bmi.value.toFixed(1) }}<span :class="['band-pill', bmi.band]">{{ bmi.label }}</span></p>
          <div class="bmi-scale" role="img" :aria-label="`BMI ${bmi.value.toFixed(1)}, ${bmi.label}`">
            <span class="under" /><span class="healthy" /><span class="over" /><span class="obese" />
            <i :style="{ left: `${bmiMarker}%` }" />
          </div>
          <div class="bmi-ticks" aria-hidden="true"><span style="left: 17.5%">18.5</span><span style="left: 50%">25</span><span style="left: 75%">30</span></div>
          <p v-if="healthyRange" class="body-note">Healthy range for {{ body.heightCm }} cm: {{ healthyRange.min.toFixed(0) }}–{{ healthyRange.max.toFixed(0) }} kg</p>
        </template>
        <p v-else class="body-note">Add {{ missing.join(', ') }} to see your BMI.</p>
      </article>

      <article class="panel body-card">
        <div class="panel-heading"><div class="panel-icon peach"><Flame :size="19" /></div><div><span class="eyebrow">Daily energy</span><h2>Calorie needs</h2></div></div>
        <template v-if="metrics && suggestion">
          <p class="body-figure">{{ kcal(metrics.tdee) }}<small>kcal / day</small></p>
          <dl class="body-facts">
            <div><dt>At rest (BMR)</dt><dd>{{ kcal(metrics.bmr) }} kcal</dd></div>
            <div><dt>Protein target</dt><dd>{{ suggestion.protein }} g</dd></div>
            <div><dt>Water target</dt><dd>{{ suggestion.water }} glasses</dd></div>
          </dl>
          <button class="secondary-button wide" :disabled="goalsMatch" @click="applySuggestion">
            <template v-if="goalsMatch"><Check :size="17" /> These are your goals</template>
            <template v-else>Use as my daily goals</template>
          </button>
        </template>
        <p v-else class="body-note">Add {{ missing.join(', ') }} to estimate how much energy your body uses each day.</p>
      </article>
    </section>

    <section class="panel chart-card body-chart">
      <div class="section-title compact-title">
        <div><span class="eyebrow">Weight trend</span><h2>How it’s moving</h2></div>
        <div class="range-picker" role="group" aria-label="Chart range">
          <button v-for="option in ranges" :key="option.id" :class="{ active: range === option.id }" :aria-pressed="range === option.id" @click="range = option.id">{{ option.label }}</button>
        </div>
      </div>
      <WeightChart v-if="visibleWeights.length >= 2" :entries="visibleWeights" :trend="visibleTrend" />
      <p v-else class="chart-empty">{{ store.sortedWeights.value.length >= 2 ? 'No weigh-ins in this range yet. Try a longer range.' : 'Log at least two weigh-ins to see your trend.' }}</p>
    </section>

    <section class="body-lower">
      <article class="panel settings-card">
        <div class="settings-heading"><span class="settings-icon"><HeartPulse :size="20" /></span><div><h2>Body profile</h2><p>Used for BMI, calorie needs, and activity estimates.</p></div></div>
        <div class="form-stack">
          <div class="field-row">
            <label class="field"><span>Height (cm)</span><input v-model.number="body.heightCm" type="number" min="100" max="250" inputmode="decimal" placeholder="e.g. 172" /></label>
            <label class="field"><span>Birth year</span><input v-model.number="body.birthYear" type="number" min="1900" :max="thisYear - 13" inputmode="numeric" placeholder="e.g. 1995" /></label>
          </div>
          <label class="field"><span>Sex (for the BMR formula)</span><select v-model="body.sex"><option :value="undefined" disabled>Choose</option><option value="female">Female</option><option value="male">Male</option></select></label>
          <label class="field"><span>Activity level</span>
            <select v-model="body.activityLevel"><option v-for="(level, id) in ACTIVITY_LEVELS" :key="id" :value="id as ActivityLevel">{{ level.label }} — {{ level.hint }}</option></select>
          </label>
        </div>
      </article>

      <article class="panel settings-card">
        <div class="section-title compact-title"><div><span class="eyebrow">History</span><h2>Recent weigh-ins</h2></div></div>
        <div v-if="history.length" class="entry-list">
          <div v-for="entry in history" :key="entry.date" class="entry-row">
            <div class="entry-main"><strong>{{ entry.kg.toFixed(1) }} kg</strong><small>{{ longDate(entry.date) }}</small></div>
            <span v-if="entry.delta !== null" class="delta">{{ signed(entry.delta) }}</span>
            <button class="delete-button" :aria-label="`Delete weigh-in from ${longDate(entry.date)}`" @click="store.removeWeight(entry.date)"><Trash2 :size="16" /></button>
          </div>
        </div>
        <p v-else class="body-note">Your weigh-ins will be listed here.</p>
      </article>
    </section>

    <p class="fine-print">BMI uses the WHO adult bands, and calorie needs use the Mifflin-St Jeor equation with a standard activity multiplier. They’re population estimates for adults, a starting point rather than medical advice.</p>
  </div>
</template>
