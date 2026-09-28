<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { WeightEntry } from '../types'

const props = defineProps<{ entries: WeightEntry[]; trend: WeightEntry[] }>()

const root = ref<HTMLDivElement | null>(null)
const width = ref(640)
const active = ref<number | null>(null)
let observer: ResizeObserver | null = null
onMounted(() => {
  observer = new ResizeObserver(([entry]) => { width.value = Math.max(260, entry.contentRect.width) })
  if (root.value) observer.observe(root.value)
})
onBeforeUnmount(() => observer?.disconnect())

const height = computed(() => (width.value < 480 ? 190 : 230))
const pad = { top: 18, right: 46, bottom: 28, left: 38 }
const day = (key: string) => Date.UTC(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, Number(key.slice(8, 10))) / 86_400_000
const shortDay = (key: string) => new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(`${key}T12:00:00`))

const scale = computed(() => {
  const days = props.entries.map((entry) => day(entry.date))
  let first = Math.min(...days)
  let last = Math.max(...days)
  if (first === last) { first -= 1; last += 1 }
  const values = [...props.entries, ...props.trend].map((entry) => entry.kg)
  let low = Math.min(...values)
  let high = Math.max(...values)
  if (high - low < 2) { const middle = (high + low) / 2; low = middle - 1; high = middle + 1 }
  const step = [0.5, 1, 2, 5, 10, 20].find((candidate) => (high - low) / candidate <= 4) ?? 50
  low = Math.floor(low / step) * step
  high = Math.ceil(high / step) * step
  const ticks: number[] = []
  for (let value = low; value <= high + step / 2; value += step) ticks.push(Math.round(value * 10) / 10)
  const plotWidth = width.value - pad.left - pad.right
  const plotHeight = height.value - pad.top - pad.bottom
  return {
    ticks,
    x: (key: string) => pad.left + ((day(key) - first) / (last - first)) * plotWidth,
    y: (kg: number) => pad.top + (1 - (kg - low) / (high - low)) * plotHeight,
  }
})

const trendPath = computed(() => props.trend.map((point, index) => `${index ? 'L' : 'M'}${scale.value.x(point.date).toFixed(1)},${scale.value.y(point.kg).toFixed(1)}`).join(' '))
const lastTrend = computed(() => props.trend[props.trend.length - 1])
const dateLabels = computed(() => {
  const first = props.entries[0]
  const last = props.entries[props.entries.length - 1]
  return first.date === last.date ? [last] : [first, last]
})

const pick = (event: PointerEvent) => {
  const box = (event.currentTarget as SVGElement).getBoundingClientRect()
  const x = event.clientX - box.left
  let best = 0
  props.entries.forEach((entry, index) => {
    if (Math.abs(scale.value.x(entry.date) - x) < Math.abs(scale.value.x(props.entries[best].date) - x)) best = index
  })
  active.value = best
}
const onKey = (event: KeyboardEvent) => {
  const last = props.entries.length - 1
  if (event.key === 'ArrowLeft') active.value = Math.max(0, (active.value ?? last + 1) - 1)
  else if (event.key === 'ArrowRight') active.value = Math.min(last, (active.value ?? -1) + 1)
  else if (event.key === 'Escape') active.value = null
  else return
  event.preventDefault()
}
const tooltip = computed(() => {
  if (active.value === null) return null
  const entry = props.entries[active.value]
  const trend = props.trend.find((point) => point.date === entry.date)
  const x = scale.value.x(entry.date)
  return { entry, trend, x, flip: x > width.value * 0.62 }
})
const summary = computed(() => {
  const first = props.entries[0]
  const last = props.entries[props.entries.length - 1]
  return `Weight chart, ${props.entries.length} weigh-ins from ${shortDay(first.date)} (${first.kg} kg) to ${shortDay(last.date)} (${last.kg} kg). Use the arrow keys to read each weigh-in.`
})
</script>

<template>
  <div ref="root" class="weight-chart">
    <div class="chart-legend" aria-hidden="true">
      <span><i class="legend-line" /> 7-day trend</span>
      <span><i class="legend-dot" /> Daily weigh-in</span>
    </div>
    <svg :width="width" :height="height" :viewBox="`0 0 ${width} ${height}`" role="group" :aria-label="summary" tabindex="0"
      @pointermove="pick" @pointerleave="active = null" @keydown="onKey" @blur="active = null">
      <g class="chart-grid">
        <template v-for="tick in scale.ticks" :key="tick">
          <line :x1="pad.left" :x2="width - pad.right" :y1="scale.y(tick)" :y2="scale.y(tick)" />
          <text :x="pad.left - 8" :y="scale.y(tick) + 3.5" text-anchor="end">{{ tick }}</text>
        </template>
        <text v-for="(entry, index) in dateLabels" :key="entry.date" :x="scale.x(entry.date)" :y="height - 6" :text-anchor="dateLabels.length === 1 ? 'middle' : index ? 'end' : 'start'">{{ shortDay(entry.date) }}</text>
      </g>
      <line v-if="tooltip" class="crosshair" :x1="tooltip.x" :x2="tooltip.x" :y1="pad.top - 6" :y2="height - pad.bottom" />
      <circle v-for="entry in entries" :key="entry.date" class="weigh-in" :cx="scale.x(entry.date)" :cy="scale.y(entry.kg)" r="4" />
      <path class="trend-line" :d="trendPath" />
      <template v-if="lastTrend">
        <circle class="trend-end" :cx="scale.x(lastTrend.date)" :cy="scale.y(lastTrend.kg)" r="4.5" />
        <text class="trend-label" :x="scale.x(lastTrend.date) + 9" :y="scale.y(lastTrend.kg) + 4">{{ lastTrend.kg.toFixed(1) }}</text>
      </template>
      <circle v-if="tooltip" class="weigh-in active" :cx="tooltip.x" :cy="scale.y(tooltip.entry.kg)" r="5" />
    </svg>
    <div v-if="tooltip" class="chart-tooltip" :class="{ flip: tooltip.flip }" :style="{ left: `${tooltip.x}px` }" role="status">
      <small>{{ shortDay(tooltip.entry.date) }}</small>
      <div><i class="legend-dot" /><strong>{{ tooltip.entry.kg.toFixed(1) }} kg</strong> weigh-in</div>
      <div v-if="tooltip.trend"><i class="legend-line" /><strong>{{ tooltip.trend.kg.toFixed(1) }} kg</strong> trend</div>
    </div>
  </div>
</template>
