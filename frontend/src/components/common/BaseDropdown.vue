<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'

const emit = defineEmits<{
  open: []
  close: []
}>()

defineSlots<{
  trigger(props: { toggle: () => void; isOpen: boolean }): any
  dropdown(props: { close: () => void }): any
}>()

const isOpen = ref(false)
const elRef = ref<HTMLElement | null>(null)

function onDocumentClick(e: MouseEvent) {
  if (elRef.value && !elRef.value.contains(e.target as Node)) {
    isOpen.value = false
  }
}

function toggle() { isOpen.value = !isOpen.value }
function close()  { isOpen.value = false }

watch(isOpen, (v) => { if (v) emit('open'); else emit('close') })

onMounted(() => document.addEventListener('click', onDocumentClick))
onUnmounted(() => document.removeEventListener('click', onDocumentClick))
</script>

<template>
  <div ref="elRef" class="relative">
    <slot name="trigger" :toggle="toggle" :is-open="isOpen" />
    <div v-if="isOpen" class="absolute right-0 top-full mt-2 bg-white border border-black/8 rounded-lg shadow-lg z-50">
      <slot name="dropdown" :close="close" />
    </div>
  </div>
</template>
