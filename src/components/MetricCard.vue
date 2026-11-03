<script setup lang="ts">
import { computed, type Component } from 'vue'
import { Minus } from 'lucide-vue-next'
import ProgressRing from './ProgressRing.vue'

const props = defineProps<{
  label: string
  value: number
  goal: number
  unit: string
  icon: Component
  color: string
  action?: string
  /** Accessible name for a "−1" button beside the action, e.g. "Remove a glass". */
  undo?: string
}>()
defineEmits<{ action: []; undo: [] }>()
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
    <div v-if="action" class="metric-actions">
      <button v-if="undo" class="metric-action metric-undo" type="button" :aria-label="undo" :title="undo" :disabled="value <= 0" @click="$emit('undo')"><Minus :size="14" /></button>
      <button class="metric-action" type="button" @click="$emit('action')">{{ action }}</button>
    </div>
  </article>
</template>
