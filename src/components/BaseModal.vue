<script setup lang="ts">
import { X } from 'lucide-vue-next'

defineProps<{ title: string; eyebrow?: string }>()
defineEmits<{ close: [] }>()
</script>

<template>
  <div class="modal-backdrop" @click.self="$emit('close')">
    <section class="modal-sheet" role="dialog" aria-modal="true" :aria-label="title">
      <div class="sheet-handle" />
      <header class="modal-header">
        <div>
          <span v-if="eyebrow" class="eyebrow">{{ eyebrow }}</span>
          <h2>{{ title }}</h2>
        </div>
        <button class="icon-button subtle" aria-label="Close" @click="$emit('close')"><X :size="20" /></button>
      </header>
      <div class="modal-body"><slot /></div>
    </section>
  </div>
</template>
