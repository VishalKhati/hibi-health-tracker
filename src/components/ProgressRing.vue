<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{ value: number; max: number; size?: number; stroke?: number; color?: string }>(), {
  size: 84,
  stroke: 8,
  color: 'var(--sage)',
})
const radius = computed(() => (props.size - props.stroke) / 2)
const circumference = computed(() => 2 * Math.PI * radius.value)
const progress = computed(() => Math.min(1, Math.max(0, props.value / Math.max(1, props.max))))
</script>

<template>
  <svg class="progress-ring" :width="size" :height="size" :viewBox="`0 0 ${size} ${size}`" aria-hidden="true">
    <circle class="ring-track" :cx="size / 2" :cy="size / 2" :r="radius" fill="none" :stroke-width="stroke" />
    <circle class="ring-value" :cx="size / 2" :cy="size / 2" :r="radius" fill="none" :stroke="color" :stroke-width="stroke"
      :stroke-dasharray="circumference" :stroke-dashoffset="circumference * (1 - progress)" />
  </svg>
</template>
