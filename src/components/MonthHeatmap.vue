<script setup lang="ts">
import { computed, ref } from 'vue'
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-vue-next'
import { useHealthStore } from '../stores/health'
import { dateKey, longDate, monthGrid, monthLabel } from '../utils/date'

const emit = defineEmits<{ openDate: [date: string] }>()
const store = useHealthStore()
const today = dateKey()
const now = new Date()
const view = ref({ year: now.getFullYear(), month: now.getMonth() })
const focused = ref<string | null>(null)
const pinned = ref<string | null>(null)

const monthIndex = (year: number, month: number) => year * 12 + month
const earliest = computed(() => {
  const [year, month] = store.earliestDate.value.split('-').map(Number)
  return monthIndex(year, month - 1)
})
const canGoBack = computed(() => monthIndex(view.value.year, view.value.month) > earliest.value)
const canGoForward = computed(() => monthIndex(view.value.year, view.value.month) < monthIndex(now.getFullYear(), now.getMonth()))
const shift = (amount: number) => {
  const index = monthIndex(view.value.year, view.value.month) + amount
  view.value = { year: Math.floor(index / 12), month: index % 12 }
  pinned.value = null
}

const cells = computed(() => monthGrid(view.value.year, view.value.month).map((date) => {
  if (!date) return null
  const future = date > today
  const stats = future ? null : store.dayStats(date)
  return { date, day: Number(date.slice(8)), future, stats, level: stats ? stats.goalsMet : 0 }
}))

const readout = computed(() => {
  const date = focused.value ?? pinned.value
  const cell = cells.value.find((item) => item?.date === date)
  return cell?.stats ? cell : null
})
const describe = (cell: NonNullable<(typeof cells.value)[number]>) =>
  cell.future ? `${longDate(cell.date)}, upcoming` : `${longDate(cell.date)}: ${cell.level} of ${cell.stats!.goalChecks} goals met`
const weekdays = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
</script>

<template>
  <section class="panel heatmap-card">
    <div class="section-title compact-title">
      <div><span class="eyebrow">Month view</span><h2>{{ monthLabel(view.year, view.month) }}</h2></div>
      <div class="month-nav">
        <button class="icon-button" aria-label="Previous month" :disabled="!canGoBack" @click="shift(-1)"><ChevronLeft :size="18" /></button>
        <button class="icon-button" aria-label="Next month" :disabled="!canGoForward" @click="shift(1)"><ChevronRight :size="18" /></button>
      </div>
    </div>
    <div class="heatmap" role="group" :aria-label="`Goals met each day in ${monthLabel(view.year, view.month)}`">
      <span v-for="(label, index) in weekdays" :key="`h${index}`" class="heatmap-weekday" aria-hidden="true">{{ label }}</span>
      <template v-for="(cell, index) in cells" :key="cell?.date ?? `blank${index}`">
        <span v-if="!cell" class="heatmap-blank" />
        <button v-else :class="['heatmap-cell', `level-${cell.level}`, { future: cell.future, today: cell.date === today, pinned: cell.date === pinned }]"
          :disabled="cell.future" :aria-label="describe(cell)" :aria-pressed="cell.date === pinned"
          @pointerenter="focused = cell.date" @pointerleave="focused = null" @focus="focused = cell.date" @blur="focused = null"
          @click="pinned = pinned === cell.date ? null : cell.date">{{ cell.day }}</button>
      </template>
    </div>
    <div class="heatmap-footer">
      <p v-if="readout" class="heatmap-readout" aria-live="polite">
        <strong>{{ readout.level }}/{{ readout.stats!.goalChecks }} goals</strong>
        <span>{{ longDate(readout.date) }} · {{ readout.stats!.calories.toLocaleString() }} kcal · {{ readout.stats!.steps.toLocaleString() }} steps · {{ readout.stats!.water }} glasses · {{ readout.stats!.activityMinutes }} min active</span>
        <button v-if="pinned === readout.date" class="text-button" @click="emit('openDate', readout.date)">Open day <ArrowRight :size="14" /></button>
      </p>
      <p v-else class="heatmap-readout muted">Tap a day to see its details. Goals are food logged, steps, water, and activity.</p>
      <div class="heatmap-legend" aria-hidden="true"><span>Less</span><i class="level-0" /><i class="level-1" /><i class="level-2" /><i class="level-3" /><i class="level-4" /><span>More</span></div>
    </div>
  </section>
</template>
