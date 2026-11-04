<script setup lang="ts">
import { computed } from 'vue'
import { calorieSplit, round1 } from '../utils/macros'

const props = defineProps<{ protein: number; carbs?: number; fat?: number; fiber?: number; note?: string }>()

const split = computed(() => calorieSplit({ calories: 0, protein: props.protein, carbs: props.carbs, fat: props.fat }))
const percent = (share?: number) => `${Math.round((share ?? 0) * 100)}%`
const rows = computed(() => [
  { key: 'protein', label: 'Protein', grams: props.protein, share: split.value?.protein },
  { key: 'carbs', label: 'Carbs', grams: props.carbs, share: split.value?.carbs },
  { key: 'fat', label: 'Fat', grams: props.fat, share: split.value?.fat },
  { key: 'fiber', label: 'Fibre', grams: props.fiber, share: undefined },
])
const label = computed(() => (split.value ? `Calories from protein ${percent(split.value.protein)}, carbs ${percent(split.value.carbs)}, fat ${percent(split.value.fat)}` : 'No breakdown yet'))
</script>

<template>
  <div class="macro-bar">
    <div class="macro-split" role="img" :aria-label="label">
      <template v-if="split">
        <span class="macro-protein" :style="{ width: percent(split.protein) }" />
        <span class="macro-carbs" :style="{ width: percent(split.carbs) }" />
        <span class="macro-fat" :style="{ width: percent(split.fat) }" />
      </template>
    </div>
    <dl class="macro-values">
      <div v-for="row in rows" :key="row.key">
        <dt><i :class="`macro-dot macro-${row.key}`" />{{ row.label }}</dt>
        <dd>{{ typeof row.grams === 'number' ? `${round1(row.grams)}g` : '—' }}<small v-if="row.share !== undefined && split">{{ percent(row.share) }}</small></dd>
      </div>
    </dl>
    <p v-if="note" class="macro-note">{{ note }}</p>
  </div>
</template>
