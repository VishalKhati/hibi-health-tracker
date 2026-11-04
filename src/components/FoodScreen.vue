<script setup lang="ts">
import { computed } from 'vue'
import { Plus, Trash2, UtensilsCrossed } from 'lucide-vue-next'
import MacroBar from './MacroBar.vue'
import { useHealthStore } from '../stores/health'
import { macroLine } from '../utils/macros'
import type { FoodEntry } from '../types'

defineEmits<{ addFood: [meal?: FoodEntry['meal']] }>()
const store = useHealthStore()
const meals: FoodEntry['meal'][] = ['Breakfast', 'Lunch', 'Dinner', 'Snack']
const totals = computed(() => store.todayTotals.value)
const breakdownNote = computed(() => {
  const missing = totals.value.foodsWithoutBreakdown
  if (!missing) return ''
  return `${missing === 1 ? '1 food' : `${missing} foods`} logged before the breakdown was added ${missing === 1 ? 'has' : 'have'} only calories and protein, so carbs and fat are lower than eaten.`
})
const grouped = computed(() => Object.fromEntries(meals.map((meal) => [meal, store.foodsForDate.value.filter((item) => item.meal === meal)])) as Record<FoodEntry['meal'], FoodEntry[]>)
</script>

<template>
  <div class="screen">
    <header class="page-header"><div><p class="eyebrow">Nutrition</p><h1>Food</h1><p class="header-copy">Track what matters. Skip the perfection.</p></div><button class="primary-button compact" @click="$emit('addFood')"><Plus :size="18" /> Log food</button></header>
    <section class="macro-banner">
      <div><span>Calories eaten</span><strong>{{ store.todayTotals.value.calories.toLocaleString() }}</strong><small>of {{ store.data.profile.goals.calories.toLocaleString() }} kcal</small></div>
      <div class="vertical-rule" />
      <div><span>Protein</span><strong>{{ store.todayTotals.value.protein }}g</strong><small>of {{ store.data.profile.goals.protein }}g</small></div>
      <div class="macro-progress"><span :style="{ width: `${Math.min(100, store.todayTotals.value.calories / store.data.profile.goals.calories * 100)}%` }" /></div>
    </section>
    <section v-if="totals.foodsLogged" class="panel macro-panel" aria-label="Today’s breakdown">
      <h2>Today’s breakdown</h2>
      <MacroBar :protein="totals.protein" :carbs="totals.carbs" :fat="totals.fat" :fiber="totals.fiber" :note="breakdownNote" />
    </section>
    <section class="meal-list">
      <article v-for="meal in meals" :key="meal" class="panel meal-card">
        <header><div><h2>{{ meal }}</h2><span>{{ grouped[meal].reduce((sum, item) => sum + item.calories, 0) }} kcal</span></div><button class="round-add" :aria-label="`Add ${meal}`" @click="$emit('addFood', meal)"><Plus :size="18" /></button></header>
        <div v-if="grouped[meal].length" class="entry-list">
          <div v-for="entry in grouped[meal]" :key="entry.id" class="entry-row">
            <div class="entry-glyph"><UtensilsCrossed :size="17" /></div><div class="entry-main"><strong>{{ entry.name }}</strong><small>{{ entry.portion }} · {{ macroLine(entry) }}</small></div><span>{{ entry.calories }} kcal</span><button class="delete-button" aria-label="Delete food" @click="store.remove('food', entry.id)"><Trash2 :size="16" /></button>
          </div>
        </div>
        <button v-else class="empty-meal" @click="$emit('addFood', meal)">Nothing logged yet <span>Add {{ meal.toLowerCase() }}</span></button>
      </article>
    </section>
  </div>
</template>
