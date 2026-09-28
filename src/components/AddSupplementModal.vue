<script setup lang="ts">
import { reactive } from 'vue'
import BaseModal from './BaseModal.vue'
import { useHealthStore } from '../stores/health'

const emit = defineEmits<{ close: []; saved: [] }>()
const store = useHealthStore()
const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const form = reactive({ name: '', dosage: '', time: '08:00', days: [0, 1, 2, 3, 4, 5, 6] })
const toggleDay = (day: number) => form.days = form.days.includes(day) ? form.days.filter((value) => value !== day) : [...form.days, day]
const submit = () => {
  if (!form.name.trim() || !form.days.length) return
  store.addSupplement({ name: form.name.trim(), dosage: form.dosage || '1 dose', time: form.time, days: [...form.days] })
  emit('saved')
}
</script>

<template>
  <BaseModal title="Add supplement" eyebrow="Build your routine" @close="$emit('close')">
    <form class="form-stack" @submit.prevent="submit">
      <label class="field"><span>Name</span><input v-model="form.name" required placeholder="e.g. Vitamin D3" autofocus /></label>
      <div class="field-row"><label class="field"><span>Dosage</span><input v-model="form.dosage" placeholder="e.g. 1 tablet" /></label><label class="field"><span>Time</span><input v-model="form.time" type="time" required /></label></div>
      <fieldset class="day-picker"><legend>Schedule</legend><button v-for="(day, index) in days" :key="index" type="button" :class="{ active: form.days.includes(index) }" @click="toggleDay(index)">{{ day }}</button></fieldset>
      <button class="primary-button" type="submit">Add to routine</button>
    </form>
  </BaseModal>
</template>
