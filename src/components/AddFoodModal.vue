<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref } from 'vue'
import { ArrowLeft, BookmarkPlus, LoaderCircle, Plus, ScanBarcode, Search } from 'lucide-vue-next'
import BaseModal from './BaseModal.vue'
import BarcodeScanner from './BarcodeScanner.vue'
import PhotoMeal from './PhotoMeal.vue'
import { useHealthStore } from '../stores/health'
import { FoodLookupError, lookupBarcode, nutritionFor, searchFoods, type FoodProduct } from '../services/openFoodFacts'
import type { FoodEntry } from '../types'

const props = withDefaults(defineProps<{ initialMeal?: FoodEntry['meal'] }>(), { initialMeal: 'Breakfast' })
const emit = defineEmits<{ close: []; saved: [] }>()
const store = useHealthStore()
const mode = ref<'saved' | 'search' | 'photo' | 'custom'>('saved')
const meal = ref<FoodEntry['meal']>(props.initialMeal)
const form = reactive({ name: '', portion: '', calories: 0, protein: 0, save: true })

const useSaved = (food: (typeof store.data.savedFoods)[number]) => {
  store.addSavedFood(food, meal.value)
  emit('saved')
}
const submit = () => {
  if (!form.name.trim() || form.calories < 0) return
  store.addFood({ date: store.selectedDate.value, name: form.name.trim(), meal: meal.value, portion: form.portion || '1 serving', calories: form.calories, protein: form.protein }, form.save)
  emit('saved')
}

const query = ref('')
const results = ref<FoodProduct[] | null>(null)
const loading = ref(false)
const lookupError = ref('')
const scanning = ref(false)
const selected = ref<FoodProduct | null>(null)
const grams = ref(100)
const saveProduct = ref(true)
let controller: AbortController | null = null

const lookup = async <T,>(run: (signal: AbortSignal) => Promise<T>) => {
  controller?.abort()
  const current = (controller = new AbortController())
  loading.value = true
  lookupError.value = ''
  try {
    return await run(current.signal)
  } catch (error) {
    if (current.signal.aborted) return undefined
    lookupError.value = error instanceof FoodLookupError ? error.message : 'Something went wrong while looking that up.'
    return undefined
  } finally {
    if (controller === current) loading.value = false
  }
}
onBeforeUnmount(() => controller?.abort())

const runSearch = async () => {
  const term = query.value.trim()
  if (term.length < 2) return
  const found = await lookup((signal) => searchFoods(term, signal))
  if (found) results.value = found
}

const choose = (product: FoodProduct) => {
  selected.value = product
  grams.value = product.servingGrams ?? 100
}

const onDetected = async (code: string) => {
  scanning.value = false
  const product = await lookup((signal) => lookupBarcode(code, signal))
  if (product) choose(product)
  else if (product === null) lookupError.value = `No product found for barcode ${code}. You can add it under “New food”.`
}

const portion = computed(() => (selected.value ? nutritionFor(selected.value, grams.value || 0) : { calories: 0, protein: 0 }))
const isServing = computed(() => !!selected.value?.servingGrams && grams.value === selected.value.servingGrams)

const addProduct = () => {
  const product = selected.value
  if (!product || !(grams.value > 0)) return
  store.addFood({
    date: store.selectedDate.value,
    name: product.brand ? `${product.name} (${product.brand})` : product.name,
    meal: meal.value,
    portion: isServing.value ? `1 serving (${grams.value} g)` : `${grams.value} g`,
    calories: portion.value.calories,
    protein: portion.value.protein,
    barcode: product.barcode || undefined,
  }, saveProduct.value)
  emit('saved')
}
</script>

<template>
  <BaseModal title="Log food" eyebrow="A few taps, then done" @close="$emit('close')">
    <div class="segmented" role="tablist">
      <button role="tab" :aria-selected="mode === 'saved'" :class="{ active: mode === 'saved' }" @click="mode = 'saved'">Saved</button>
      <button role="tab" :aria-selected="mode === 'search'" :class="{ active: mode === 'search' }" @click="mode = 'search'">Search</button>
      <button role="tab" :aria-selected="mode === 'photo'" :class="{ active: mode === 'photo' }" @click="mode = 'photo'">Photo</button>
      <button role="tab" :aria-selected="mode === 'custom'" :class="{ active: mode === 'custom' }" @click="mode = 'custom'">New</button>
    </div>
    <label class="field"><span>Meal</span><select v-model="meal"><option>Breakfast</option><option>Lunch</option><option>Dinner</option><option>Snack</option></select></label>

    <div v-if="mode === 'saved'" class="saved-grid">
      <button v-for="food in store.data.savedFoods" :key="food.id" class="saved-food" @click="useSaved(food)">
        <span class="saved-plus"><Plus :size="17" /></span>
        <strong>{{ food.name }}</strong><small>{{ food.portion }}</small>
        <span>{{ food.calories }} kcal · {{ food.protein }}g</span>
      </button>
      <button class="saved-food add-new" @click="mode = 'search'"><span class="saved-plus"><Search :size="16" /></span><strong>Find a food</strong><small>Search or scan a barcode</small></button>
    </div>

    <div v-else-if="mode === 'search'" class="search-pane">
      <form v-if="selected" class="product-panel" @submit.prevent="addProduct">
        <button type="button" class="link-button" @click="selected = null"><ArrowLeft :size="15" /> Back to results</button>
        <div class="product-heading">
          <strong>{{ selected.name }}</strong>
          <small>{{ [selected.brand, `${Math.round(selected.kcalPer100g)} kcal · ${selected.proteinPer100g}g protein per 100 g`].filter(Boolean).join(' · ') }}</small>
        </div>
        <div class="portion-chips">
          <button v-if="selected.servingGrams" type="button" :class="['choice-chip', { active: isServing }]" @click="grams = selected.servingGrams!">1 serving · {{ selected.servingGrams }} g</button>
          <button type="button" :class="['choice-chip', { active: grams === 100 && !isServing }]" @click="grams = 100">100 g</button>
        </div>
        <label class="field"><span>Amount (g)</span><input v-model.number="grams" type="number" min="1" step="1" inputmode="decimal" required /></label>
        <div class="nutrition-summary" aria-live="polite">
          <div><strong>{{ portion.calories }}</strong><span>kcal</span></div>
          <div><strong>{{ portion.protein }}g</strong><span>protein</span></div>
        </div>
        <label class="check-row"><input v-model="saveProduct" type="checkbox" /><BookmarkPlus :size="18" /><span>Save for quick logging</span></label>
        <button class="primary-button" type="submit" :disabled="!(grams > 0)">Add to {{ meal.toLowerCase() }}</button>
      </form>

      <template v-else-if="scanning">
        <BarcodeScanner @detected="onDetected" />
        <button type="button" class="link-button centered" @click="scanning = false">Cancel scanning</button>
      </template>

      <template v-else>
        <form class="search-bar" role="search" @submit.prevent="runSearch">
          <input v-model="query" type="search" enterkeyhint="search" placeholder="e.g. oats, paneer, peanut butter" aria-label="Search foods" />
          <button class="primary-button" type="submit" :disabled="loading || query.trim().length < 2" aria-label="Search"><Search :size="18" /></button>
        </form>
        <button type="button" class="secondary-button wide" @click="lookupError = ''; scanning = true"><ScanBarcode :size="18" /> Scan a barcode</button>
        <p v-if="loading" class="lookup-status"><LoaderCircle :size="16" class="spin" /> Looking it up…</p>
        <p v-else-if="lookupError" class="inline-alert" role="alert">{{ lookupError }}</p>
        <p v-else-if="results && !results.length" class="lookup-status">No matches. Try a simpler term, or add it under “New food”.</p>
        <div v-if="results?.length && !loading" class="result-list">
          <button v-for="product in results" :key="product.barcode || product.name" class="result-row" @click="choose(product)">
            <span class="entry-main"><strong>{{ product.name }}</strong><small>{{ product.brand || 'Unbranded' }}</small></span>
            <span class="result-values"><strong>{{ Math.round(product.kcalPer100g) }}</strong> kcal<small>per 100 g</small></span>
          </button>
        </div>
        <p class="data-credit">Food data from <a href="https://world.openfoodfacts.org" target="_blank" rel="noopener">Open Food Facts</a>, shared under the ODbL. Values are per the product label.</p>
      </template>
    </div>

    <PhotoMeal v-else-if="mode === 'photo'" :meal="meal" @saved="emit('saved')" />

    <form v-else class="form-stack" @submit.prevent="submit">
      <label class="field"><span>Food or meal</span><input v-model="form.name" required placeholder="e.g. Paneer rice bowl" autofocus /></label>
      <label class="field"><span>Portion</span><input v-model="form.portion" placeholder="e.g. 1 bowl" /></label>
      <div class="field-row">
        <label class="field"><span>Calories</span><input v-model.number="form.calories" type="number" min="0" required inputmode="numeric" /></label>
        <label class="field"><span>Protein (g)</span><input v-model.number="form.protein" type="number" min="0" inputmode="decimal" /></label>
      </div>
      <label class="check-row"><input v-model="form.save" type="checkbox" /><BookmarkPlus :size="18" /><span>Save for quick logging</span></label>
      <button class="primary-button" type="submit">Add to {{ meal.toLowerCase() }}</button>
    </form>
  </BaseModal>
</template>
