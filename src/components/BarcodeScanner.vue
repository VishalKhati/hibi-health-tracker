<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { LoaderCircle } from 'lucide-vue-next'
import { cameraErrorMessage, createDetector } from '../services/barcode'

const emit = defineEmits<{ detected: [code: string] }>()
const video = ref<HTMLVideoElement | null>(null)
const status = ref<'starting' | 'scanning' | 'error'>('starting')
const error = ref('')
const manualCode = ref('')
let stream: MediaStream | null = null
let timer = 0
let stopped = false

const stop = () => {
  stopped = true
  window.clearTimeout(timer)
  stream?.getTracks().forEach((track) => track.stop())
  stream = null
}

onMounted(async () => {
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('unsupported')
    const [media, detector] = await Promise.all([
      navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false }),
      createDetector(),
    ])
    if (stopped) return media.getTracks().forEach((track) => track.stop())
    stream = media
    video.value!.srcObject = media
    await video.value!.play()
    status.value = 'scanning'
    const scan = async () => {
      if (stopped || !video.value) return
      try {
        const [hit] = await detector.detect(video.value)
        if (hit?.rawValue) {
          navigator.vibrate?.(40)
          stop()
          emit('detected', hit.rawValue)
          return
        }
      } catch {
        // A frame that isn't ready yet throws; the next tick retries.
      }
      timer = window.setTimeout(scan, 220)
    }
    scan()
  } catch (reason) {
    stop()
    status.value = 'error'
    error.value = cameraErrorMessage(reason)
  }
})
onBeforeUnmount(stop)

const submitManual = () => {
  const code = manualCode.value.replace(/\D/g, '')
  if (code.length >= 6) emit('detected', code)
}
</script>

<template>
  <div class="scanner">
    <div v-if="status !== 'error'" class="scanner-view">
      <video ref="video" muted playsinline aria-label="Camera preview" />
      <div class="scanner-frame" aria-hidden="true"><i /></div>
      <p v-if="status === 'starting'" class="scanner-status"><LoaderCircle :size="16" class="spin" /> Starting camera…</p>
      <p v-else class="scanner-status">Point at the barcode on the pack</p>
    </div>
    <p v-else class="inline-alert" role="alert">{{ error }}</p>
    <form class="search-bar" @submit.prevent="submitManual">
      <input v-model="manualCode" inputmode="numeric" autocomplete="off" placeholder="Or type the barcode number" aria-label="Barcode number" />
      <button class="secondary-button" type="submit" :disabled="manualCode.replace(/\D/g, '').length < 6">Look up</button>
    </form>
  </div>
</template>
