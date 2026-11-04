<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref } from 'vue'
import { Camera, Image as ImageIcon, LoaderCircle, RotateCcw, ScanText } from 'lucide-vue-next'
import { prepareImage } from '../services/mealPhoto'
import { readLabel } from '../services/products'
import type { FoodProduct } from '../services/openFoodFacts'

/** With a barcode, the product can be remembered and shared for the next scan. */
const props = defineProps<{ barcode?: string }>()
const emit = defineEmits<{ done: [product: FoodProduct, share: boolean]; cancel: [] }>()

type Step = 'pick' | 'reading' | 'review'
const step = ref<Step>('pick')
const preview = ref('')
const error = ref('')
const note = ref('')
const share = ref(true)
/** Empty string = not on the label (only fibre and serving size may be left empty). */
const form = reactive({ name: '', brand: '', unit: 'g' as 'g' | 'ml', kcal: '' as number | '', protein: '' as number | '', carbs: '' as number | '', fat: '' as number | '', fiber: '' as number | '', serving: '' as number | '' })
let controller: AbortController | null = null
onBeforeUnmount(() => controller?.abort())

const num = (value: number | '') => (typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined)

const onFile = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  error.value = ''
  controller?.abort()
  const current = (controller = new AbortController())
  try {
    const photo = await prepareImage(file)
    preview.value = photo.previewUrl
    step.value = 'reading'
    const reading = await readLabel({ image: photo.base64, mediaType: photo.mediaType }, current.signal)
    if (!reading.readable) {
      error.value = reading.note || 'The nutrition table couldn’t be read. Try a closer, sharper photo of the table.'
      step.value = 'pick'
      return
    }
    Object.assign(form, {
      name: reading.name, brand: reading.brand, unit: reading.unit,
      kcal: reading.kcalPer100, protein: reading.proteinPer100, carbs: reading.carbsPer100, fat: reading.fatPer100,
      fiber: reading.fiberPer100 ?? '', serving: reading.servingSize > 0 ? reading.servingSize : '',
    })
    note.value = reading.note
    step.value = 'review'
  } catch (reason) {
    if (current.signal.aborted) return
    error.value = reason instanceof Error ? reason.message : 'Couldn’t read that photo.'
    step.value = 'pick'
  }
}

const valid = computed(() => !!form.name.trim() && [form.kcal, form.protein, form.carbs, form.fat].every((value) => num(value) !== undefined))

const use = () => {
  if (!valid.value) return
  const serving = num(form.serving)
  const product: FoodProduct = {
    barcode: props.barcode ?? '',
    name: form.name.trim(),
    brand: form.brand.trim(),
    kcalPer100g: num(form.kcal)!,
    proteinPer100g: num(form.protein)!,
    carbsPer100g: num(form.carbs),
    fatPer100g: num(form.fat),
    ...(num(form.fiber) === undefined ? {} : { fiberPer100g: num(form.fiber) }),
    ...(serving ? { servingGrams: serving, servingLabel: `${serving} ${form.unit}` } : {}),
  }
  emit('done', product, !!props.barcode && share.value)
}
</script>

<template>
  <div class="label-reader">
    <p v-if="error" class="inline-alert" role="alert">{{ error }}</p>

    <div v-if="step === 'pick'" class="photo-drop">
      <span class="empty-illustration"><ScanText :size="28" /></span>
      <strong>Photograph the nutrition label</strong>
      <small>Fill the frame with the table on the back of the pack. Hibi reads the per-100 g values, and you check them before using them.</small>
      <div class="photo-buttons">
        <label class="primary-button"><Camera :size="17" /> Take photo<input type="file" accept="image/*" capture="environment" hidden @change="onFile" /></label>
        <label class="secondary-button"><ImageIcon :size="17" /> Choose photo<input type="file" accept="image/*" hidden @change="onFile" /></label>
      </div>
    </div>

    <div v-else-if="step === 'reading'" class="photo-preview busy">
      <img :src="preview" alt="Your label photo" />
      <div class="photo-busy" role="status"><LoaderCircle :size="22" class="spin" /><span>Reading the label…<small>Usually a few seconds</small></span></div>
    </div>

    <form v-else class="form-stack" @submit.prevent="use">
      <div class="photo-review-head">
        <img :src="preview" alt="" />
        <div><strong>Check against the label</strong><small>{{ note || `Values per 100 ${form.unit}. Fix anything that was misread.` }}</small></div>
      </div>
      <div class="field-row">
        <label class="field"><span>Product</span><input v-model="form.name" required placeholder="e.g. Masala oats" /></label>
        <label class="field"><span>Brand</span><input v-model="form.brand" placeholder="Optional" /></label>
      </div>
      <div class="field-row three">
        <label class="field"><span>kcal / 100 {{ form.unit }}</span><input v-model.number="form.kcal" type="number" min="0" step="0.1" inputmode="decimal" required /></label>
        <label class="field"><span>Protein g</span><input v-model.number="form.protein" type="number" min="0" step="0.1" inputmode="decimal" required /></label>
        <label class="field"><span>Carbs g</span><input v-model.number="form.carbs" type="number" min="0" step="0.1" inputmode="decimal" required /></label>
        <label class="field"><span>Fat g</span><input v-model.number="form.fat" type="number" min="0" step="0.1" inputmode="decimal" required /></label>
        <label class="field"><span>Fibre g</span><input v-model.number="form.fiber" type="number" min="0" step="0.1" inputmode="decimal" placeholder="Not listed" /></label>
        <label class="field"><span>Serving {{ form.unit }}</span><input v-model.number="form.serving" type="number" min="0" step="1" inputmode="decimal" placeholder="Not listed" /></label>
      </div>
      <label v-if="barcode" class="check-row"><input v-model="share" type="checkbox" /><span>Share this product with other Hibi users, so their scan of {{ barcode }} finds it</span></label>
      <div class="photo-buttons">
        <button class="secondary-button" type="button" @click="step = 'pick'; error = ''"><RotateCcw :size="16" /> New photo</button>
        <button class="primary-button" type="submit" :disabled="!valid">Use these values</button>
      </div>
    </form>

    <p v-if="step !== 'review'" class="data-credit">The photo is resized and sent to Google Gemini to read the numbers. On Gemini’s free tier, Google may use submitted photos to improve its products. Hibi doesn’t keep the photo.</p>
    <button type="button" class="link-button centered" @click="emit('cancel')">Cancel</button>
  </div>
</template>
