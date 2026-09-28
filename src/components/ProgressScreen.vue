<script setup lang="ts">
import { computed } from 'vue'
import { Activity, Droplets, Flame, Footprints, Pill, Salad, TrendingUp, Trophy } from 'lucide-vue-next'
import MonthHeatmap from './MonthHeatmap.vue'
import { useHealthStore } from '../stores/health'
import { weekdayShort } from '../utils/date'

defineEmits<{ openDate: [date: string] }>()
const store = useHealthStore()
const goals = computed(() => store.data.profile.goals)
const average = (key: 'calories' | 'protein' | 'steps' | 'water' | 'activityMinutes') => store.week.value.reduce((sum, day) => sum + day[key], 0) / 7
const consistency = computed(() => {
  const met = store.week.value.reduce((sum, day) => sum + day.goalsMet, 0)
  const possible = store.week.value.reduce((sum, day) => sum + day.goalChecks, 0)
  return Math.round((met / possible) * 100)
})
const calorieMax = computed(() => Math.max(goals.value.calories, ...store.week.value.map((day) => day.calories), 1))
const streakIcons: Record<string, typeof Flame> = { logging: Salad, water: Droplets, movement: Activity, routine: Pill }
</script>

<template>
  <div class="screen">
    <header class="page-header"><div><p class="eyebrow">Last 7 days</p><h1>Progress</h1><p class="header-copy">Notice the rhythm, not just the numbers.</p></div><span class="status-pill neutral"><TrendingUp :size="15" /> Weekly view</span></header>
    <section class="consistency-card">
      <div><span class="eyebrow">Overall consistency</span><strong>{{ consistency }}%</strong><p>Share of daily goals met this week: food logged, steps, water, and activity.</p></div>
      <div class="consistency-orbit" :style="{ '--score': `${consistency * 3.6}deg` }"><span>{{ consistency >= 70 ? 'Steady' : consistency >= 35 ? 'Growing' : 'Starting' }}</span></div>
    </section>

    <section class="streak-grid" aria-label="Streaks">
      <article v-for="streak in store.streaks.value" :key="streak.id" :class="['streak-card', { live: streak.current > 0 }]">
        <span class="streak-icon"><component :is="streakIcons[streak.id]" :size="17" /></span>
        <div>
          <small>{{ streak.label }}</small>
          <strong>{{ streak.current }} <span>{{ streak.current === 1 ? 'day' : 'days' }}</span></strong>
          <p><Trophy :size="12" /> Best {{ streak.best }}</p>
        </div>
        <Flame v-if="streak.current >= 3" class="streak-flame" :size="18" aria-label="Streak going" />
      </article>
    </section>

    <section class="weekly-stats">
      <article><span class="stat-icon orange"><Salad :size="18" /></span><div><small>Avg calories</small><strong>{{ Math.round(average('calories')).toLocaleString() }}</strong></div></article>
      <article><span class="stat-icon violet"><Footprints :size="18" /></span><div><small>Avg steps</small><strong>{{ Math.round(average('steps')).toLocaleString() }}</strong></div></article>
      <article><span class="stat-icon blue"><Droplets :size="18" /></span><div><small>Avg water</small><strong>{{ average('water').toFixed(1) }} glasses</strong></div></article>
      <article><span class="stat-icon green"><Activity :size="18" /></span><div><small>Avg activity</small><strong>{{ Math.round(average('activityMinutes')) }} min</strong></div></article>
    </section>
    <section class="panel chart-card">
      <div class="section-title compact-title"><div><span class="eyebrow">Food energy</span><h2>Calories eaten</h2></div><span class="chart-goal">Goal {{ goals.calories.toLocaleString() }}</span></div>
      <div class="bar-chart">
        <div v-for="day in store.week.value" :key="day.date" class="bar-column">
          <div class="bar-space"><span class="goal-tick" :style="{ bottom: `${goals.calories / calorieMax * 100}%` }" /><div class="bar" :class="{ today: day.date === store.selectedDate.value }" :style="{ height: `${Math.max(day.calories ? 5 : 1, day.calories / calorieMax * 100)}%` }"><i>{{ day.calories || '' }}</i></div></div>
          <span>{{ weekdayShort(day.date) }}</span>
        </div>
      </div>
    </section>
    <section class="panel habit-card">
      <div class="section-title compact-title"><div><span class="eyebrow">At a glance</span><h2>Daily goals</h2></div></div>
      <div class="habit-grid"><div v-for="day in store.week.value" :key="day.date"><span>{{ weekdayShort(day.date).slice(0, 1) }}</span><i :class="{ met: day.steps >= goals.steps }" title="Steps" /><i :class="{ met: day.water >= goals.water }" title="Water" /><i :class="{ met: day.activityMinutes >= goals.activityMinutes }" title="Activity" /></div></div>
      <div class="habit-legend"><span><i class="violet" /> Steps</span><span><i class="blue" /> Water</span><span><i class="green" /> Activity</span></div>
    </section>
    <MonthHeatmap @open-date="$emit('openDate', $event)" />
  </div>
</template>
