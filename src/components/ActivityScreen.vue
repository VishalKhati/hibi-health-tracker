<script setup lang="ts">
import { Activity, Dumbbell, Footprints, Plus, Route, Trash2 } from 'lucide-vue-next'
import { useHealthStore } from '../stores/health'

defineEmits<{ addActivity: [] }>()
const store = useHealthStore()
const icon = (type: string) => type === 'Gym' ? Dumbbell : type === 'Run' ? Route : type === 'Walk' ? Footprints : Activity
</script>

<template>
  <div class="screen">
    <header class="page-header"><div><p class="eyebrow">Movement</p><h1>Activity</h1><p class="header-copy">Every kind of movement counts.</p></div><button class="primary-button compact" @click="$emit('addActivity')"><Plus :size="18" /> Log activity</button></header>
    <section class="activity-hero">
      <div class="big-stat"><strong>{{ store.todayTotals.value.activityMinutes }}</strong><span>active<br />minutes</span></div>
      <div class="activity-facts"><div><span>Steps</span><strong>{{ store.todayTotals.value.steps.toLocaleString() }}</strong></div><div><span>Estimated burn</span><strong>{{ store.todayTotals.value.caloriesBurned }} kcal</strong></div></div>
      <p>Calories eaten and estimated burn stay separate, so your day stays easy to understand.</p>
    </section>
    <div class="section-title"><div><span class="eyebrow">Your day</span><h2>Activity log</h2></div></div>
    <section v-if="store.activitiesForDate.value.length" class="timeline">
      <article v-for="entry in [...store.activitiesForDate.value].reverse()" :key="entry.id" class="timeline-entry panel">
        <div class="timeline-icon"><component :is="icon(entry.type)" :size="21" /></div>
        <div class="entry-main"><span class="entry-type">{{ entry.type }}</span><strong>{{ entry.name }}</strong><small>{{ entry.duration }} min<span v-if="entry.distance"> · {{ entry.distance }} km</span><span v-if="entry.sets"> · {{ entry.sets }} × {{ entry.reps }}<template v-if="entry.weight"> @ {{ entry.weight }}kg</template></span></small></div>
        <span v-if="entry.calories" class="burn-label">~{{ entry.calories }} kcal</span><button class="delete-button" aria-label="Delete activity" @click="store.remove('activity', entry.id)"><Trash2 :size="16" /></button>
      </article>
    </section>
    <section v-else class="empty-state"><div class="empty-illustration"><Footprints :size="31" /></div><h2>No movement logged yet</h2><p>A ten-minute walk is a perfectly good place to begin.</p><button class="secondary-button" @click="$emit('addActivity')"><Plus :size="17" /> Add activity</button></section>
  </div>
</template>
