<script setup lang="ts">
import { Check, Clock3, Plus, SkipForward, Sparkles, Trash2 } from 'lucide-vue-next'
import { useHealthStore } from '../stores/health'

defineEmits<{ addSupplement: [] }>()
const store = useHealthStore()
const scheduleLabel = (days: number[]) => days.length === 7 ? 'Every day' : days.length === 5 && !days.includes(0) && !days.includes(6) ? 'Weekdays' : `${days.length} days/week`
</script>

<template>
  <div class="screen">
    <header class="page-header"><div><p class="eyebrow">Daily routine</p><h1>Supplements</h1><p class="header-copy">A gentle nudge, never a guilt trip.</p></div><button class="primary-button compact" @click="$emit('addSupplement')"><Plus :size="18" /> Add supplement</button></header>
    <section v-if="store.scheduledSupplements.value.length" class="dose-list">
      <article v-for="item in store.scheduledSupplements.value" :key="item.id" :class="['dose-card panel', store.doseStatus(item.id)]">
        <div class="dose-time"><Clock3 :size="15" /> {{ item.time }}</div>
        <div class="dose-icon"><Sparkles :size="21" /></div>
        <div class="entry-main"><strong>{{ item.name }}</strong><small>{{ item.dosage }} · {{ scheduleLabel(item.days) }}</small></div>
        <div class="dose-actions">
          <button :class="{ selected: store.doseStatus(item.id) === 'taken' }" @click="store.logDose(item.id, 'taken')"><Check :size="17" /> Taken</button>
          <button :class="{ selected: store.doseStatus(item.id) === 'skipped' }" @click="store.logDose(item.id, 'skipped')"><SkipForward :size="16" /> Skip</button>
        </div>
        <button class="delete-button dose-delete" aria-label="Delete supplement" @click="store.remove('supplement', item.id)"><Trash2 :size="15" /></button>
      </article>
    </section>
    <section v-else class="empty-state"><div class="empty-illustration"><Sparkles :size="31" /></div><h2>Your routine is open</h2><p>Add vitamins, medicines, or other supplements and choose the days you take them.</p><button class="secondary-button" @click="$emit('addSupplement')"><Plus :size="17" /> Build your routine</button></section>
    <section v-if="store.data.supplements.length" class="all-routines panel">
      <div class="section-title compact-title"><div><span class="eyebrow">Schedule</span><h2>All routines</h2></div></div>
      <div v-for="item in store.data.supplements" :key="item.id" class="routine-row"><span>{{ item.name }}</span><small>{{ item.time }} · {{ scheduleLabel(item.days) }}</small></div>
    </section>
  </div>
</template>
