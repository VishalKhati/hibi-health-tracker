<script setup lang="ts">
import { computed, reactive } from 'vue'
import BaseModal from './BaseModal.vue'
import { useHealthStore } from '../stores/health'
import type { ActivityEntry } from '../types'
import { estimateActivityCalories } from '../utils/health'

const emit = defineEmits<{ close: []; saved: [] }>()
const store = useHealthStore()
const form = reactive({ type: 'Walk' as ActivityEntry['type'], name: '', duration: 30, distance: undefined as number | undefined, sets: undefined as number | undefined, reps: undefined as number | undefined, weight: undefined as number | undefined, calories: undefined as number | undefined })
const isCardio = computed(() => ['Walk', 'Run'].includes(form.type))
const estimate = computed(() => {
  const kg = store.latestWeight.value?.kg
  return kg ? estimateActivityCalories(form.type, form.duration || 0, kg, isCardio.value ? form.distance : undefined) : 0
})
const submit = () => {
  const { distance, sets, reps, weight, calories, ...rest } = form
  const optional = (value: number | undefined) => (typeof value === 'number' && Number.isFinite(value) ? value : undefined)
  store.addActivity({
    ...rest,
    date: store.selectedDate.value,
    name: form.name.trim() || form.type,
    calories: optional(calories),
    ...(isCardio.value ? { distance: optional(distance) } : form.type === 'Gym' ? { sets: optional(sets), reps: optional(reps), weight: optional(weight) } : {}),
  })
  emit('saved')
}
</script>

<template>
  <BaseModal title="Log activity" eyebrow="Move your way" @close="$emit('close')">
    <form class="form-stack" @submit.prevent="submit">
      <div class="choice-grid four">
        <button v-for="type in ['Walk', 'Run', 'Gym', 'Other']" :key="type" type="button" :class="['choice-chip', { active: form.type === type }]" @click="form.type = type as ActivityEntry['type']">{{ type }}</button>
      </div>
      <label class="field"><span>Activity name</span><input v-model="form.name" :placeholder="form.type === 'Gym' ? 'e.g. Upper body' : `e.g. Evening ${form.type.toLowerCase()}`" /></label>
      <div class="field-row">
        <label class="field"><span>Duration (min)</span><input v-model.number="form.duration" type="number" min="1" required /></label>
        <label class="field"><span>Calories burned</span><input v-model.number="form.calories" type="number" min="0" :placeholder="estimate ? `~${estimate} estimated` : 'Optional'" /></label>
      </div>
      <p class="field-hint">{{ store.latestWeight.value ? 'Leave calories blank to save an estimate based on your weight, the activity and its pace.' : 'Log your weight on the Body screen and Hibi can estimate calories burned for you.' }}</p>
      <label v-if="isCardio" class="field"><span>Distance (km)</span><input v-model.number="form.distance" type="number" min="0" step="0.1" placeholder="Optional" /></label>
      <div v-else-if="form.type === 'Gym'" class="field-row three">
        <label class="field"><span>Sets</span><input v-model.number="form.sets" type="number" min="0" /></label>
        <label class="field"><span>Reps</span><input v-model.number="form.reps" type="number" min="0" /></label>
        <label class="field"><span>Weight kg</span><input v-model.number="form.weight" type="number" min="0" step="0.5" /></label>
      </div>
      <button class="primary-button" type="submit">Save activity</button>
    </form>
  </BaseModal>
</template>
