<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { Camera, Image as ImageIcon, LoaderCircle, Plus, RotateCcw, Sparkles, Trash2 } from 'lucide-vue-next'
import { useHealthStore } from '../stores/health'
import { analyzeMeal, getPhotoProvider, prepareImage, type PhotoProvider } from '../services/mealPhoto'
import type { MealItem } from '../shared/meal'
import type { FoodEntry } from '../types'

const props = defineProps<{ meal: FoodEntry['meal'] }>()
const emit = defineEmits<{ saved: [] }>()
const store = useHealthStore()

type Step = 'pick' | 'ready' | 'analyzing' | 'review'
/** Per-gram rates let a grams edit rescale calories and protein without compounding rounding. */
interface EditableItem extends MealItem { key: number; kcalPerGram: number; proteinPerGram: number }

const step = ref<Step>('pick')
const photo = ref<Awaited<ReturnType<typeof prepareImage>> | null>(null)
const hint = ref('')
const error = ref('')
const summary = ref('')
const items = reactive<EditableItem[]>([])
const saveToQuick = ref(false)
let controller: AbortController | null = null
let nextKey = 1
onBeforeUnmount(() => controller?.abort())

const provider = ref<PhotoProvider | 'unknown' | 'loading'>('loading')
onMounted(async () => { provider.value = await getPhotoProvider() })
/** Shown before any photo is sent: users should know which company receives it and on what terms. */
const disclosure = computed(() => ({
  gemini: 'The photo is resized and sent to Google Gemini for the estimate. On Gemini’s free tier, Google may use submitted photos to improve its products. Hibi doesn’t keep the photo.',
  claude: 'The photo is resized and sent to Anthropic’s Claude for the estimate. Hibi doesn’t keep the photo.',
  mock: 'Test mode: photos aren’t sent anywhere.',
  unknown: 'The photo is resized and sent to an AI service for the estimate. Hibi doesn’t keep the photo.',
  loading: '',
}[provider.value ?? 'unknown'] ?? ''))
const unavailable = computed(() => provider.value === null)

const rates = (item: Pick<MealItem, 'grams' | 'calories' | 'protein'>) => ({
  kcalPerGram: item.grams > 0 ? item.calories / item.grams : 0,
  proteinPerGram: item.grams > 0 ? item.protein / item.grams : 0,
})

const onFile = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  error.value = ''
  try {
    photo.value = await prepareImage(file)
    step.value = 'ready'
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : 'Couldn’t open that photo.'
  }
}

const analyze = async () => {
  if (!photo.value) return
  controller?.abort()
  const current = (controller = new AbortController())
  step.value = 'analyzing'
  error.value = ''
  try {
    const result = await analyzeMeal({ image: photo.value.base64, mediaType: photo.value.mediaType, hint: hint.value }, current.signal)
    summary.value = result.summary
    items.splice(0, items.length, ...result.items.map((item) => ({ ...item, key: nextKey++, ...rates(item) })))
    step.value = 'review'
  } catch (reason) {
    if (current.signal.aborted) return
    error.value = reason instanceof Error ? reason.message : 'Something went wrong. Please try again.'
    step.value = 'ready'
  }
}

const cancel = () => {
  controller?.abort()
  step.value = 'ready'
}

const startOver = () => {
  photo.value = null
  hint.value = ''
  items.splice(0)
  error.value = ''
  step.value = 'pick'
}

const setGrams = (item: EditableItem, value: number) => {
  item.grams = Number.isFinite(value) && value > 0 ? value : 0
  if (item.kcalPerGram || item.proteinPerGram) {
    item.calories = Math.round(item.kcalPerGram * item.grams)
    item.protein = Math.round(item.proteinPerGram * item.grams * 10) / 10
  }
}
/** A hand-corrected calorie or protein value becomes the new per-gram rate for later grams edits. */
const setNutrient = (item: EditableItem, field: 'calories' | 'protein', value: number) => {
  item[field] = Number.isFinite(value) && value > 0 ? value : 0
  Object.assign(item, rates(item))
}

const addItem = () => items.push({ key: nextKey++, name: '', portion: '', grams: 0, calories: 0, protein: 0, confidence: 'high', note: '', kcalPerGram: 0, proteinPerGram: 0 })

const loggable = computed(() => items.filter((item) => item.name.trim()))
const totals = computed(() => ({
  calories: loggable.value.reduce((sum, item) => sum + item.calories, 0),
  protein: Math.round(loggable.value.reduce((sum, item) => sum + item.protein, 0) * 10) / 10,
}))

const logAll = () => {
  for (const item of loggable.value) {
    store.addFood({
      date: store.selectedDate.value,
      name: item.name.trim(),
      meal: props.meal,
      portion: item.portion.trim() || (item.grams ? `${item.grams} g` : '1 serving'),
      calories: Math.round(item.calories),
      protein: Math.round(item.protein * 10) / 10,
    }, saveToQuick.value)
  }
  emit('saved')
}
</script>

<template>
  <div class="photo-pane">
    <p v-if="error" class="inline-alert" role="alert">{{ error }}</p>

    <template v-if="step === 'pick'">
      <div class="photo-drop">
        <span class="empty-illustration"><Camera :size="28" /></span>
        <strong>Snap your plate</strong>
        <small>Hibi estimates each food and its calories. You check everything before it’s logged.</small>
        <div class="photo-buttons">
          <label class="primary-button"><Camera :size="17" /> Take photo<input type="file" accept="image/*" capture="environment" hidden @change="onFile" /></label>
          <label class="secondary-button"><ImageIcon :size="17" /> Choose photo<input type="file" accept="image/*" hidden @change="onFile" /></label>
        </div>
      </div>
      <p v-if="unavailable" class="inline-alert">Photo estimates aren’t set up on this Hibi server yet. Search, barcode scan and manual entry still work.</p>
      <p v-else class="data-credit">{{ disclosure }}</p>
    </template>

    <template v-else-if="step === 'ready' || step === 'analyzing'">
      <div class="photo-preview" :class="{ busy: step === 'analyzing' }">
        <img :src="photo!.previewUrl" alt="Your meal photo" />
        <div v-if="step === 'analyzing'" class="photo-busy" role="status"><LoaderCircle :size="22" class="spin" /><span>Looking at your plate…<small>Usually 10–20 seconds</small></span></div>
      </div>
      <label class="field"><span>Note for the estimate (optional)</span><input v-model="hint" maxlength="300" :disabled="step === 'analyzing'" placeholder="e.g. 2 rotis, dal made with ghee" /></label>
      <div class="photo-buttons">
        <button v-if="step === 'analyzing'" class="secondary-button" type="button" @click="cancel">Cancel</button>
        <button v-else class="secondary-button" type="button" @click="startOver"><RotateCcw :size="16" /> New photo</button>
        <button class="primary-button" type="button" :disabled="step === 'analyzing' || unavailable" @click="analyze"><Sparkles :size="17" /> Estimate calories</button>
      </div>
    </template>

    <template v-else>
      <div class="photo-review-head">
        <img :src="photo!.previewUrl" alt="" />
        <div><strong>Check before logging</strong><small>{{ summary || 'Edit anything that looks off.' }}</small></div>
      </div>
      <p v-if="!items.length" class="lookup-status">No food found in this photo. Add items yourself below or try another photo.</p>
      <div class="estimate-list">
        <article v-for="item in items" :key="item.key" :class="['estimate-item', `confidence-${item.confidence}`]">
          <div class="estimate-row">
            <input v-model="item.name" class="estimate-name" aria-label="Food name" placeholder="Food name" />
            <button class="delete-button" type="button" :aria-label="`Remove ${item.name || 'item'}`" @click="items.splice(items.indexOf(item), 1)"><Trash2 :size="16" /></button>
          </div>
          <input v-model="item.portion" class="estimate-portion" aria-label="Portion" placeholder="Portion, e.g. 1 katori" />
          <div class="estimate-numbers">
            <label><span>Grams</span><input :value="item.grams || ''" type="number" min="0" inputmode="decimal" @input="setGrams(item, Number(($event.target as HTMLInputElement).value))" /></label>
            <label><span>kcal</span><input :value="item.calories" type="number" min="0" inputmode="numeric" @input="setNutrient(item, 'calories', Number(($event.target as HTMLInputElement).value))" /></label>
            <label><span>Protein g</span><input :value="item.protein" type="number" min="0" step="0.1" inputmode="decimal" @input="setNutrient(item, 'protein', Number(($event.target as HTMLInputElement).value))" /></label>
          </div>
          <p v-if="item.confidence !== 'high' || item.note" class="estimate-note"><span v-if="item.confidence !== 'high'" class="confidence-pill">{{ item.confidence === 'low' ? 'Check this' : 'Rough estimate' }}</span>{{ item.note }}</p>
        </article>
      </div>
      <button class="link-button" type="button" @click="addItem"><Plus :size="15" /> Add an item</button>
      <div class="nutrition-summary" aria-live="polite">
        <div><strong>{{ totals.calories }}</strong><span>kcal total</span></div>
        <div><strong>{{ totals.protein }}g</strong><span>protein</span></div>
      </div>
      <label class="check-row"><input v-model="saveToQuick" type="checkbox" /><span>Also save these to quick foods</span></label>
      <div class="photo-buttons">
        <button class="secondary-button" type="button" @click="startOver"><RotateCcw :size="16" /> Start over</button>
        <button class="primary-button" type="button" :disabled="!loggable.length" @click="logAll">Add {{ loggable.length }} {{ loggable.length === 1 ? 'item' : 'items' }} to {{ meal.toLowerCase() }}</button>
      </div>
    </template>
  </div>
</template>
