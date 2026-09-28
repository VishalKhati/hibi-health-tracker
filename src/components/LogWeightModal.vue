<script setup lang="ts">
import { ref } from 'vue'
import BaseModal from './BaseModal.vue'
import { useHealthStore } from '../stores/health'
import { dateKey } from '../utils/date'

const emit = defineEmits<{ close: []; saved: [] }>()
const store = useHealthStore()
const today = dateKey()
const date = ref(store.selectedDate.value)
const kg = ref<number | ''>(store.data.weights.find((entry) => entry.date === date.value)?.kg ?? store.latestWeight.value?.kg ?? '')

const submit = () => {
  if (typeof kg.value !== 'number' || kg.value < 20 || kg.value > 400 || !date.value || date.value > today) return
  store.logWeight(date.value, Math.round(kg.value * 10) / 10)
  emit('saved')
}
</script>

<template>
  <BaseModal title="Log weight" eyebrow="One number, any time of day" @close="$emit('close')">
    <form class="form-stack" @submit.prevent="submit">
      <div class="field-row">
        <label class="field"><span>Weight (kg)</span><input v-model.number="kg" type="number" min="20" max="400" step="0.1" inputmode="decimal" required autofocus /></label>
        <label class="field"><span>Date</span><input v-model="date" type="date" :max="today" required /></label>
      </div>
      <p class="field-hint">Weighing at the same time each day, like first thing in the morning, makes the trend line steadier. Logging again on the same date replaces that day’s value.</p>
      <button class="primary-button" type="submit">Save weight</button>
    </form>
  </BaseModal>
</template>
