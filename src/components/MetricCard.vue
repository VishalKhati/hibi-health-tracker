<script setup lang="ts">
import { computed, type Component } from 'vue'
import ProgressRing from './ProgressRing.vue'

const props = defineProps<{
  label: string
  value: number
  goal: number
  unit: string
  icon: Component
  color: string
  action?: string
}>()
defineEmits<{ action: [] }>()
const percentage = computed(() => Math.min(100, Math.round((props.value / Math.max(1, props.goal)) * 100)))
</script>

<template>
  <article class="metric-card" :style="{ '--metric': color }">
    <div class="metric-top">
      <span class="metric-icon"><component :is="icon" :size="18" /></span>
      <span class="metric-percent">{{ percentage }}%</span>
    </div>
    <div class="metric-content">
      <div class="metric-ring-wrap">
        <ProgressRing :value="value" :max="goal" :size="76" :stroke="7" :color="color" />
        <strong>{{ value.toLocaleString() }}</strong>
      </div>
      <div>
        <h3>{{ label }}</h3>
        <p>of {{ goal.toLocaleString() }} {{ unit }}</p>
      </div>
    </div>
    <button v-if="action" class="metric-action" @click="$emit('action')">{{ action }}</button>
  </article>
</template>
